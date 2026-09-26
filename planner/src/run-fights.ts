/**
 * Plays real fights in a sandboxed game and checks the simulator against it.
 *
 *   node src/run-fights.ts [--policy planner|naive] [--runs 3] [--seed 1] [--max-fights 30] [--port 47100] [--cards skip|take]
 *                          [--weights '{"future":0.5}'] [--out runs/x.json] [--choices first|rules] [--ascension 10]
 *
 * One headless game per run: an Ironclad run on a fixed seed, fixed choices
 * outside combat, and every combat fought by the chosen policy until the run
 * ends. After every card played, what sim.ts predicted is compared with what
 * the game did (differential.ts); after every end of turn, the predicted HP
 * loss with the real one.
 *
 * The choices outside combat are dull on purpose, so that both policies meet
 * the same fights on the same seed: take gold, skip cards, potions and relics,
 * heal at rest sites, the first map node, the first event option, leave shops.
 * `--cards take` takes the first card offered instead, which is what puts
 * cards other than the starter deck in front of the simulator. `--choices
 * rules` makes every choice outside combat by choices.ts instead (card
 * rewards, the shop, rest sites, upgrades, events, card selects, potions):
 * phase 2's baseline, measured against the fixed choices on the same seeds.
 *
 * The naive policy is the baseline: the first playable card, on the first
 * enemy, until nothing is playable.
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { Game, savesDir, type StepResult } from "./bridge.ts";
import { compare, type Mismatch } from "./differential.ts";
import type { CardObs, LegalAction, Observation } from "./obs.ts";
import { type ChoiceState, restoreChoiceState, saveChoiceState } from "./choices.ts";
import { cardValue, plainCardValue, chooseCardReward, chooseCardSelectFor, chooseEvent, chooseMap, chooseMapByPath, chooseRest, chooseSelect, chooseShop, chooseUpgrade, hasFlag, noteCombatStart, setActBoss, setFlags, useRules2, wantsPotion } from "./choices.ts";
import type { MapPoint } from "./path.ts";
import { setIntentAscension } from "./intents.ts";
import { actionId, DEFAULT_WEIGHTS, expectedIntents, planTurn, planTurn2, planTurnExplore, planTurnRoll, planTurnValue, type Rollouts, safetyMargin, useValueNet, useBossRules, useGiantRules, useHpNeed, useHpScale, usePotionSaving, useTorchFirst, type Weights } from "./search.ts";
import { learnCard } from "./spar.ts";
import { loadValueNet } from "./value.ts";
import { nextTurn, seeded } from "./turn.ts";
import { type Action, type Card, drink, drinkable, type Enemy, fromObservation, hpAfterTurn, junkIndex, play, type State } from "./sim.ts";

type Policy = "planner" | "naive";

/** The planner's evaluation weights for this run: the defaults, with --weights on top. */
let weights: Weights = DEFAULT_WEIGHTS;

export interface FightLog {
  seed: string;
  /** The resumes its run took (resumeRun), on every fight of the run: bench's runs stop before a RunEnd. */
  resumed?: Resume[];
  floor: number;
  enemies: string[];
  relics: string[];
  /** Relics' numbers and counters when the fight began. */
  relicVars: Record<string, Record<string, number>>;
  /** Potions held when the fight began. */
  potions: string[];
  won: boolean;
  hpStart: number;
  /** After the fight, so after relics that heal on a win (Burning Blood). */
  hpEnd: number;
  /** Taken during the fight, the step that won it included (its HP before the heals for winning). */
  hpLost: number;
  /**
   * Of hpLost, what the step that won the fight took: a fight won in the enemies' turn (a Waterfall
   * Giant's DeathBlow as it dies) is counted since 2026-09-24. Logs without it left that turn out.
   */
  hpLostWinning?: number;
  maxHp: number;
  turns: number;
  plays: number;
  planMs: number[];
  nodes: number[];
  truncated: number;
  /** Plans that ran on an approximated card. */
  inexact: number;
  mismatches: Mismatch[];
  endTurn: { turn: number; predicted: number; actual: number; before: string }[];
  /** Action ids the policy chose that the game did not offer. */
  illegal: string[];
  /** How often each card was played. */
  cardsPlayed: Record<string, number>;
  /** Every action in order, "t<turn>:<card or POTION:id>" (end of turn not listed). */
  sequence?: string[];
  /** Turn starts checked against turn.ts nextTurn's prediction, and the fields that differed. */
  transitionChecks?: number;
  transitions?: { turn: number; field: string; predicted: string; actual: string }[];
}

const label = (c: Card) => `${c.id}${c.upgrades > 0 ? "+" : ""}`;

/** Every non-combat screen met, as the game describes it, and what was chosen: what phase 2's choices are written from. */
export interface RoomLog {
  seed: string;
  floor: number;
  phase: string;
  hp: number;
  maxHp: number;
  gold: number;
  deck: string[];
  room: Observation["room"];
  chosen: string;
}
const rooms: RoomLog[] = [];

/** How each run ended, as the game had it: a win is the game's own victory flag, not a guess from the floor. */
export interface RunEnd {
  seed: string;
  floor: number;
  terminal: boolean;
  victory: boolean;
  hp: number;
  maxHp: number;
  /** The deck and relics at the end. */
  deck: string[];
  relics: string[];
  /** Set when the run stopped on an error (a lost connection, a timeout), not on the game's terms. */
  error?: string;
  /**
   * The resumes the run took (resumeRun): where the game's save brought it back (floor and screen),
   * and the error before it. A run with any is not a clean one; eval.ts counts them.
   */
  resumed?: Resume[];
}
export interface Resume {
  floor: number;
  phase: string;
  error: string;
  /** No snapshot for that screen: the logs were kept as they were, and may hold a fight twice. */
  unmatched?: boolean;
}
const ends: RunEnd[] = [];

/** Every card seen, as the game describes it: what a card's own rule is written from. */
const catalog = new Map<string, Omit<CardObs, "index" | "can_play">>();
function collect(o: Observation): void {
  const c = o.combat;
  if (!c) return;
  for (const card of [...c.hand, ...c.draw_pile, ...c.discard_pile, ...c.exhaust_pile]) {
    const key = `${card.card_id}${card.upgrades > 0 ? "+" : ""}`;
    if (catalog.has(key)) continue;
    // An affliction (Bound) lasts the combat, not the card: not in the catalogue.
    const { index: _index, can_play: _canPlay, affliction: _affliction, affliction_amount: _afflictionAmount, ...rest } = card;
    catalog.set(key, rest);
    // spar3: the bouts know every card the run has shown.
    if (hasFlag("spar3")) learnCard(key, rest);
  }
}

/** One line of the state that matters for a mismatch: HP, block, powers and their numbers, intents. */
function brief(o: Observation): string {
  const pw = (p: Record<string, number>, v: Record<string, Record<string, number>> | undefined) =>
    Object.entries(p).map(([k, n]) => `${k}${n}${v?.[k] ? JSON.stringify(v[k]) : ""}`).join(",");
  const player = `P ${o.player_hp}hp ${o.player_block}blk ${o.player_energy}e [${pw(o.player_powers, o.player_power_vars)}]`;
  const enemies = (o.combat?.enemies ?? []).filter((e) => e.is_alive).map((e) =>
    `E${e.combat_id} ${e.model_id} ${e.hp}hp ${e.block}blk [${pw(e.powers, e.power_vars)}] ${e.intents.map((i) => i.type + (i.damage ? `${i.damage}x${i.hits}` : "")).join("+")}`);
  const hand = `H[${(o.combat?.hand ?? []).map((c) => c.card_id + (c.upgrades > 0 ? "+" : "") + (c.enchantment ? `~${c.enchantment}` : "") + (c.affliction ? `@${c.affliction}` : "")).join(",")}] draw ${o.combat?.draw_pile.length ?? 0} discard ${o.combat?.discard_pile.length ?? 0} exhaust ${o.combat?.exhaust_pile.length ?? 0}`;
  return [player, hand, ...enemies].join(" | ");
}

function parseAction(id: string): Action {
  if (id === "end_turn") return { kind: "end" };
  const m = /^play_card:(\d+)(?::target:(\d+))?$/.exec(id);
  if (!m) throw new Error(`not a card play: ${id}`);
  return m[2] === undefined ? { kind: "play", hand: Number(m[1]) } : { kind: "play", hand: Number(m[1]), target: Number(m[2]) };
}

function naive(legal: LegalAction[]): Action {
  const first = legal.find((a) => a.action_id.startsWith("play_card:"));
  return parseAction(first ? first.action_id : "end_turn");
}

let skippedCardsOn = -1;

/** Everything outside combat by choices.ts's rules; the map stays the first node, so seeds stay comparable up to the first difference. */
function rules(obs: Observation, legal: LegalAction[]): string {
  const ids = legal.map((a) => a.action_id);
  const find = (re: RegExp) => ids.find((i) => re.test(i));
  const first = ids[0];
  if (first === undefined) throw new Error(`no legal action in phase ${obs.phase}`);
  switch (obs.phase) {
    case "rewards":
      // A card reward skipped on this floor stays on the screen: do not open it again.
      return find(/^choose_reward:\d+:Gold$/) ?? (skippedCardsOn !== obs.floor ? find(/^choose_reward:\d+:Card$/) : undefined)
        ?? (wantsPotion(obs, obs.potion_slots ?? 3) ? find(/^choose_reward:\d+:Potion$/) : undefined)
        ?? find(/^choose_reward:\d+:Relic$/) ?? find(/^proceed$/) ?? first;
    case "card_reward": {
      const pick = chooseCardReward(obs, legal);
      if (pick === "skip_card") skippedCardsOn = obs.floor;
      return pick;
    }
    case "rest_site":
      return chooseRest(obs, legal);
    case "shop":
      return chooseShop(obs, legal);
    case "deck_upgrade":
      return chooseUpgrade(obs, legal);
    case "event":
      return chooseEvent(obs, legal);
    case "deck_card_select":
    case "simple_card_select":
      return chooseCardSelectFor(obs, legal);
    case "card_select":
      return chooseSelect(obs, legal);
    case "map":
      return chooseMap(obs, legal);
    default:
      return first;
  }
}

/** Everything outside combat: fixed, so both policies walk the same run. */
function routine(obs: Observation, legal: LegalAction[], takeCards: boolean): string {
  const ids = legal.map((a) => a.action_id);
  const find = (re: RegExp) => ids.find((i) => re.test(i));
  const first = ids[0];
  if (first === undefined) throw new Error(`no legal action in phase ${obs.phase}`);
  switch (obs.phase) {
    case "rewards":
      return find(/^choose_reward:\d+:Gold$/) ?? (takeCards ? find(/^choose_reward:\d+:Card$/) : undefined) ?? find(/^proceed$/) ?? first;
    case "card_reward":
      return (takeCards ? find(/^choose_card:/) : undefined) ?? find(/^skip_card$/) ?? first;
    case "rest_site":
      return find(/^choose_rest:.*heal/i) ?? first;
    case "shop":
      return find(/^shop_leave$/) ?? first;
    default:
      // map: the first node; event: the first option; treasure, upgrades, card selects: the first.
      return first;
  }
}

/**
 * A selection a card asks for mid-fight (True Grit+ or Burning Pact from the
 * hand, Headbutt from the discard pile, Armaments' upgrade), chosen the way
 * sim.ts assumes it is, so the prediction stays the play: a status or curse
 * from the hand, else its last card; the discard pile's first card; the best
 * card to upgrade.
 */
function combatSelect(obs: Observation, legal: LegalAction[]): string {
  const details = (obs.room?.details ?? {}) as { purpose?: string; cards?: CardObs[] };
  const cards = details.cards ?? [];
  const offers = legal.filter((a) => a.action_id.startsWith("choose_card_select:"));
  if (offers.length === 0) return legal[0]?.action_id ?? "proceed";
  const purpose = details.purpose ?? "";
  let i = 0;
  // The Knowledge Demon's Curse of Knowledge (IL: a choose-a-card screen on its turn, no skip):
  // Disintegration 6/7/8 at the end of every turn, stacking, or Mind Rot, Sloth, Waste Away. curse:
  // Sloth (3 cards a turn; these decks play 3-4) over a second Disintegration (13 a turn with the
  // first); Disintegration over Mind Rot (a card a turn) and over Waste Away (an energy a turn).
  const sloth = cards.findIndex((c) => c.card_id === "SLOTH");
  if (hasFlag("curse") && sloth >= 0 && cards.some((c) => c.card_id === "DISINTEGRATION")) return offers[Math.min(sloth, offers.length - 1)]!.action_id;
  if (/^FromHand(ForDiscard)?$/.test(purpose)) {
    i = cards.length ? junkIndex(cards.map((c) => ({ id: c.card_id, type: c.card_type }))) : offers.length - 1;
  } else if (/Upgrade|ChooseACard|SimpleGrid|Bundle/.test(purpose)) {
    let best = -Infinity;
    cards.forEach((c, j) => {
      const v = plainCardValue(c.card_id, 0, obs.deck_cards);
      if (v > best) [best, i] = [v, j];
    });
  }
  return offers[Math.min(i, offers.length - 1)]!.action_id;
}

/** potions2: potions not drunk early (a heal at full HP, block with nothing coming), and single hits Slippery blunts. */
const LATE_POTIONS = new Set(["BLOOD_POTION", "BLOCK_POTION", "FRUIT_JUICE"]);
const ONE_HIT_POTIONS = new Set(["FIRE_POTION", "EXPLOSIVE_AMPOULE", "POTION_SHAPED_ROCK"]);
/**
 * wgpot: what to keep for a Waterfall Giant's DeathBlow turn, not drink on turn 1 — block, Dexterity,
 * Weak on the Giant, and the draws and picks that find a block card in a hand of attacks.
 */
const BLOW_POTIONS = new Set([
  "BLOCK_POTION", "DEXTERITY_POTION", "SPEED_POTION", "WEAK_POTION", "SWIFT_POTION", "GAMBLERS_BREW", "SKILL_POTION",
  "DUPLICATOR", "FORTIFIER", "HEART_OF_IRON", "LIQUID_BRONZE", "DISTILLED_CHAOS", "COLORLESS_POTION", "LIQUID_MEMORIES",
]);
/** hp48b: the HP each second boss needs coming in (the act 3 handbook; the Test Subject's from the ts49 replays). */
const SECOND_NEEDS: Record<string, number> = { QUEEN_BOSS: 60, AEONGLASS_BOSS: 85, TEST_SUBJECT_BOSS: 90 };
/**
 * potwin: when each kind of potion is drunk in floor 48's fight (the act 3 handbook: all 80 potions
 * of the act 3 boss fights went on turn 1, by potions2's rule, and floor 49 met none). Burst and
 * debuffs at the Torch Head while it lives; against Aeonglass, Strength and powers on turn 1, no
 * debuff into its Artifact; block when 25 or more is coming; heals kept for floor 49.
 */
const BURST_POTIONS = new Set(["STRENGTH_POTION", "FLEX_POTION", "ATTACK_POTION", "FIRE_POTION", "EXPLOSIVE_AMPOULE", "DUPLICATOR", "POWER_POTION", "DISTILLED_CHAOS", "ENERGY_POTION"]);
const DEBUFF_POTIONS = new Set(["WEAK_POTION", "VULNERABLE_POTION"]);
const GUARD_POTIONS = new Set(["DEXTERITY_POTION", "BLOCK_POTION", "SPEED_POTION", "FORTIFIER", "LIQUID_BRONZE"]);
function inWindow(id: string, s: ReturnType<typeof fromObservation>, bossTurn: number): boolean {
  const alive = (m: string) => s.enemies.some((e) => e.alive && e.model === m);
  const aeonglass = s.enemies.find((e) => e.alive && e.model === "AEONGLASS");
  const incoming = s.enemies.reduce((a, e) => a + (e.alive ? e.intents.filter((i) => i.type === "Attack").reduce((b, i) => b + i.damage * Math.max(1, i.hits), 0) : 0), 0);
  if (GUARD_POTIONS.has(id)) return incoming >= 25;
  if (alive("TORCH_HEAD_AMALGAM") && bossTurn <= 2) return BURST_POTIONS.has(id) || DEBUFF_POTIONS.has(id);
  if (aeonglass) {
    if (DEBUFF_POTIONS.has(id)) return (aeonglass.powers["ARTIFACT"] ?? 0) <= 0;
    return bossTurn <= 1 && (id === "STRENGTH_POTION" || id === "POWER_POTION" || id === "FLEX_POTION");
  }
  return false;
}
/** bossroll's rollouts: this turn's best 4 ends, each played 2 turns on 3 times, 800 nodes a turn. */
const BOSS_ROLL: Rollouts = { ends: 4, samples: 3, depth: 2, nodes: 800 };
/** A10's first act 3 boss (floor 48): the second follows on the same HP (pot48, hp48). */
const firstOfPair = (floor: number, boss: boolean) => boss && ascension >= 10 && floor === 48;
/** potsave: a fight of act 3 before its two bosses (floors 34-47) keeps its potions for them. */
const savingFor = (floor: number, boss: boolean) => hasFlag("potsave") && floor > 33 && floor < 48 && !boss;
/** Potions that work by themselves (Fairy in a Bottle saves a death), or are worth more kept. */
const KEEP_POTIONS = new Set(["FAIRY_IN_A_BOTTLE"]);
// By the monsters' ids, as the fights report them: The Kin is its Priest (and followers), the Kaiser
// Crab its two claws. Until 2026-09-26 the set named those two encounters, which no monster is called,
// and none of theirs has 250 HP: neither fight counted as a boss's (potions2's early potions, the
// boss-fight flags; the other session found bossroll and bossvalue identical to the plain planner
// against the Crab).
export const BOSSES = new Set(["VANTOM", "KIN_PRIEST", "KIN_FOLLOWER", "CEREMONIAL_BEAST", "WATERFALL_GIANT", "LAGAVULIN_MATRIARCH", "SOUL_FYSH",
  "KNOWLEDGE_DEMON", "CRUSHER", "ROCKET", "THE_INSATIABLE", "QUEEN", "TORCH_HEAD_AMALGAM", "TEST_SUBJECT", "AEONGLASS"]);
/** Elites by act (A10-reference): a potion is drunk in them once HP is under half. */
const ELITES = /^(PHROG_PARASITE|BYGONE_EFFIGY|BYRDONIS|TERROR_EEL|PHANTASMAL_GARDENER|SKULKING_COLONY|DECIMILLIPEDE_SEGMENT_\w+|INFESTED_PRISM|ENTOMANCER|FLAIL_KNIGHT|SPECTRAL_KNIGHT|MAGI_KNIGHT|MECHA_KNIGHT|SOUL_NEXUS)$/;

/**
 * §10.8: a potion the planner cannot model is still worth drinking where it
 * counts — dying with a full belt was the rule, not the exception (2-5
 * potions held at almost every death). In a boss fight, drink them in the
 * first two turns; in any fight, drink before a turn no play survives.
 * Thrown potions go at the enemy with the least HP.
 */
function potionUrge(obs: Observation, s: ReturnType<typeof fromObservation>, legal: LegalAction[], hopeless: boolean, tried: Set<string>): string | undefined {
  const boss = s.enemies.some((e) => e.alive && (BOSSES.has(e.model) || e.maxHp >= 250));
  const turn = obs.combat?.turn ?? 1;
  // The boss fight's turn. sleep: the Lagavulin Matriarch's begins when she wakes, after her third
  // turn (search.ts useBossRules): nothing drunk while she sleeps, and her first two turns awake
  // are the boss's first two.
  let bossTurn = turn;
  if (hasFlag("sleep") && s.enemies.some((e) => e.model === "LAGAVULIN_MATRIARCH")) {
    if (!hopeless && s.enemies.some((e) => e.alive && (e.powers["ASLEEP"] ?? 0) >= 2)) return undefined;
    bossTurn = Math.max(1, turn - 2);
  }
  const elite = s.enemies.some((e) => e.alive && ELITES.test(e.model));
  const hurt = s.player.hp < 0.5 * s.player.maxHp;
  // potsave: act 3's elites before its two bosses drink only when nothing else survives.
  if (!(hopeless || (boss && bossTurn <= 2) || (elite && hurt && !savingFor(obs.floor, boss)))) return undefined;
  const byHp = [...s.enemies].filter((e) => e.alive).sort((a, b) => a.hp - b.hp);
  // A potion tried this turn and still held was refused: not again this turn.
  // Only potions the search cannot model — it already weighs the ones it can (a Block Potion was
  // forced on a turn with no attack coming) — unless no play survives the turn.
  const modelled = new Set(s.potions.filter((p) => drinkable(p)).map((p) => p.slot));
  // potions2: in a boss fight's first two turns, every potion — the ones the search models too. The
  // explorations that won Vantom fights the planner lost drank theirs at turn 2.2 on average, the
  // losing lines at 4.5 (Liquid Bronze 2.7 vs 13, Clarity 3 vs 10.5): one turn sees a fight-long
  // buff as a turn's worth. Not the heals or block (wasted at full HP or with no attack coming), and
  // not single-hit damage while Slippery would take it down to 1.
  // pot48: the first of A10's two act 3 bosses does not drink the belt at once; the second does.
  // potwin: the first drinks each kind in its window (inWindow), a Test Subject first as a last fight.
  const subject = s.enemies.some((e) => e.model === "TEST_SUBJECT");
  const windows = hasFlag("potwin") && firstOfPair(obs.floor, boss) && !subject;
  const early = hasFlag("potions2") && boss && bossTurn <= 2 && !(hasFlag("pot48") && firstOfPair(obs.floor, boss)) && !windows;
  const giant = hasFlag("wgpot") && s.enemies.some((e) => e.alive && e.model === "WATERFALL_GIANT");
  const slippery = s.enemies.some((e) => e.alive && (e.powers["SLIPPERY"] ?? 0) > 0);
  const id = (a: LegalAction) => String(a.metadata?.["potion_id"] ?? "");
  const uses = legal.filter((a) => a.action_id.startsWith("use_potion:") && !KEEP_POTIONS.has(id(a))
    && !tried.has(`${turn}:${a.action_id.split(":")[1]}`)
    && (hopeless || (windows ? inWindow(id(a), s, bossTurn) : !modelled.has(Number(a.action_id.split(":")[1])) || (early && !LATE_POTIONS.has(id(a)) && !(slippery && ONE_HIT_POTIONS.has(id(a))) && !(giant && BLOW_POTIONS.has(id(a)))))));
  for (const a of uses) {
    const target = a.metadata?.["target_id"];
    if (target === undefined || !s.enemies.some((e) => e.id === Number(target))) return a.action_id;
    if (Number(target) === byHp[0]?.id) return a.action_id;
  }
  return uses[0]?.action_id;
}

/**
 * The HP a won fight ended on, before the heals for winning, which the screen after it already has.
 * The game's order (IL, CombatManager.EndCombatInternal): Hook.AfterCombatEnd — Chosen Cheese's max
 * HP, which heals as much (CreatureCmd.GainMaxHp) — then Hook.AfterCombatVictory, every
 * AfterCombatVictoryEarly — Meat on the Bone, at or under HpThreshold% of max HP — before every
 * AfterCombatVictory — Burning Blood, Black Blood. No other model heals there. A heal cut short by
 * max HP, or Meat on the Bone's threshold, can bring two HPs to the same screen: `guess`, what the
 * simulator expected, picks between them. A screen no HP heals to (a heal that did not happen) is
 * taken as it is.
 */
export function hpBeforeWinHeals(before: Pick<Observation, "player_max_hp" | "relics" | "relic_vars">, after: Pick<Observation, "player_hp" | "player_max_hp">, guess: number): number {
  let best: number | undefined;
  for (const hp of hpsBeforeWinHeals(before, after)) {
    const d = Math.abs(hp - guess) - (best === undefined ? Infinity : Math.abs(best - guess));
    if (d < 0 || (d === 0 && hp > best!)) best = hp;
  }
  return best ?? after.player_hp - Math.max(0, after.player_max_hp - before.player_max_hp);
}

/** Every HP the heals for winning bring to `after`'s (hpBeforeWinHeals), lowest first: one, unless a heal was cut short. */
export function hpsBeforeWinHeals(before: Pick<Observation, "player_max_hp" | "relics" | "relic_vars">, after: Pick<Observation, "player_hp" | "player_max_hp">): number[] {
  const maxHp = after.player_max_hp;
  const gained = Math.max(0, maxHp - before.player_max_hp);
  const heal = (id: string) => (before.relics.includes(id) ? (before.relic_vars?.[id]?.["Heal"] ?? 0) : 0);
  const meat = before.relics.includes("MEAT_ON_THE_BONE") ? Math.floor((maxHp * (before.relic_vars?.["MEAT_ON_THE_BONE"]?.["HpThreshold"] ?? 50)) / 100) : -1;
  const healed = (hp: number) => {
    let h = hp + gained;
    if (h <= meat) h = Math.min(maxHp, h + heal("MEAT_ON_THE_BONE"));
    for (const id of ["BURNING_BLOOD", "BLACK_BLOOD"]) h = Math.min(maxHp, h + heal(id));
    return h;
  };
  const hps: number[] = [];
  for (let hp = 1; hp <= before.player_max_hp; hp++) if (healed(hp) === after.player_hp) hps.push(hp);
  return hps;
}

/** One fight, logged into `logs` as it goes, so a game that dies mid-fight still leaves what it did. */
export async function fight(game: Pick<Game, "step">, start: StepResult, policy: Policy, seed: string, logs: FightLog[]): Promise<{ log: FightLog; next: StepResult }> {
  const o = start.observation;
  const log: FightLog = {
    seed, floor: o.floor, enemies: (o.combat?.enemies ?? []).map((e) => e.model_id), relics: o.relics, relicVars: o.relic_vars ?? {}, potions: o.potions,
    won: false, hpStart: o.player_hp, hpEnd: o.player_hp, hpLost: 0, maxHp: o.player_max_hp,
    turns: 0, plays: 0, planMs: [], nodes: [], truncated: 0, inexact: 0, mismatches: [], endTurn: [], illegal: [], cardsPlayed: {},
  };
  logs.push(log);
  const bossFight = (o.combat?.enemies ?? []).some((e) => BOSSES.has(e.model_id) || e.max_hp >= 250);
  const firstOfTwo = firstOfPair(o.floor, bossFight);
  // potwin keeps floor 48's potions for their windows, and for the second boss; a Test Subject first
  // is fought as the last fight (the handbook: its win costs 91% of max HP, the second is out of reach).
  const subjectFirst = (o.combat?.enemies ?? []).some((e) => e.model_id === "TEST_SUBJECT");
  const windows = firstOfTwo && hasFlag("potwin") && !subjectFirst;
  usePotionSaving(savingFor(o.floor, bossFight) ? 4 : firstOfTwo && (hasFlag("pot48") || windows) ? 3 : 1);
  useHpScale(firstOfTwo && hasFlag("hp48") ? 1.5 : 1);
  useHpNeed(firstOfTwo && hasFlag("hp48b") ? SECOND_NEEDS[(o.act_second_boss ?? "").replace(/^ENCOUNTER\./, "")] ?? 0 : 0);
  useTorchFirst(hasFlag("torch"));
  const tried = new Set<string>();
  let cur = start;
  // What nextTurn said the turn after an end of turn would start with, to hold it to the game.
  let foreseen: { turn: number; state: State } | undefined;
  log.transitionChecks = 0;
  log.transitions = [];
  while (cur.observation.phase === "combat" && cur.observation.combat) {
    const obs = cur.observation;
    collect(obs);
    const s = fromObservation(obs);
    if (foreseen && obs.combat!.turn === foreseen.turn + 1) {
      log.transitionChecks++;
      for (const d of compareTurnStart(foreseen.state, s)) log.transitions.push({ turn: obs.combat!.turn, ...d });
    }
    foreseen = undefined;
    const legal = new Set(cur.legal_actions.map((a) => a.action_id));

    let a: Action;
    let urged: string | undefined;
    if (policy === "planner") {
      if (weights.stakes > 0 && obs.combat!.enemies.some((e) => BOSSES.has(e.model_id))) {
        // The act 1 and 2 bosses: the next Ancient heals 80% of missing HP. The run's last fight
        // (floor 48 below A10, 49 at A10): nothing after it.
        const last = ascension >= 10 ? 49 : 48;
        if (obs.floor === 17 || obs.floor === 33) s.hpWorth = { worth: 0.25, margin: safetyMargin(s) };
        else if (obs.floor >= last) s.hpWorth = { worth: 0.05, margin: safetyMargin(s) };
      }
      // bossroll: a boss fight's turn by rollouts (search.ts planTurnRoll). The act 3 research's pilot:
      // A10 winners' decks beat their first act 3 boss 11.7% of 480 bouts with planTurn, 15.6% with
      // two turns of rollouts (18.3% against 10.8% on 30 decks; four turns and more samples 17.5%).
      const plan = exploring ? planTurnExplore(s, weights, exploring)
        : hasFlag("bossvalue") && bossFight ? planTurnValue(s, weights)
        : hasFlag("bossroll") && bossFight ? planTurnRoll(s, weights, 20_000, BOSS_ROLL)
        : weights.look > 0 ? planTurn2(s, weights) : planTurn(s, weights);
      log.planMs.push(plan.ms);
      log.nodes.push(plan.nodes);
      if (plan.truncated) log.truncated++;
      if (!plan.exact) log.inexact++;
      a = plan.actions[0] ?? { kind: "end" };
      // A potion the planner does not model, where it counts (the plan's own potions come first).
      if (a.kind !== "potion" && usePotions) urged = potionUrge(obs, s, cur.legal_actions, plan.score < -5e5, tried);
    } else {
      a = naive(cur.legal_actions);
    }
    let id = actionId(a);
    if (urged) {
      const slot = Number(urged.split(":")[1]);
      tried.add(`${obs.combat?.turn ?? 1}:${slot}`);
      a = urged.includes(":target:") ? { kind: "potion", slot, target: Number(urged.split(":")[3]) } : { kind: "potion", slot };
      id = urged;
    }
    // A potion drunk on the player is offered with the player's combat id as its target.
    if (a.kind === "potion" && !legal.has(id)) {
      const prefix = `use_potion:${a.slot}`;
      id = [...legal].find((l) => l.startsWith(prefix)) ?? id;
    }
    if (!legal.has(id)) {
      const card = a.kind === "play" ? s.hand[a.hand] : undefined;
      const slot = a.kind === "potion" ? a.slot : -1;
      log.illegal.push(`${id}${card ? ` (${label(card)})` : slot >= 0 ? ` (${s.potions.find((p) => p.slot === slot)?.id})` : ""}`);
      a = { kind: "end" };
      id = "end_turn";
    }

    if (a.kind === "end") {
      const predicted = nextTurn(s, seeded(0), expectedIntents);
      if (predicted) foreseen = { turn: obs.combat!.turn, state: predicted };
    }
    let next = await game.step(id);
    // A card that asks for a selection stops the step there; answer it and read the play's outcome after.
    for (let guard = 0; next.observation.phase === "card_select" && guard < 10; guard++) {
      next = await game.step(combatSelect(next.observation, next.legal_actions));
    }
    const after = next.observation;
    const inCombat = after.phase === "combat" && after.combat !== null;
    const won = !inCombat && after.phase !== "game_over";
    const played = a.kind === "play" ? play(s, a) : undefined;
    // Once the fight is won the HP shown already includes the heals for winning: undone, so that a
    // fight won in the enemies' turn counts that turn too (JEV00675's Waterfall Giant: its DeathBlow
    // took 62 HP to 25, Burning Blood made it 31, and the fight logged 16 lost where the game has 53).
    const hpAfter = won ? hpBeforeWinHeals(obs, after, played ? played.player.hp : a.kind === "end" ? hpAfterTurn(s).hp : obs.player_hp) : after.player_hp;
    const lost = Math.max(0, obs.player_hp - hpAfter);
    log.hpLost += lost;
    if (won) log.hpLostWinning = lost;
    if (a.kind === "play") {
      log.plays++;
      const card = s.hand[a.hand]!;
      log.cardsPlayed[label(card)] = (log.cardsPlayed[label(card)] ?? 0) + 1;
      (log.sequence ??= []).push(`t${obs.combat!.turn}:${label(card)}`);
      const predicted = played!;
      if (inCombat) {
        for (const m of compare(label(card), predicted, fromObservation(after))) log.mismatches.push({ ...m, before: brief(obs) });
      } else if (after.phase !== "game_over" && predicted.enemies.some((e) => e.alive)) {
        log.mismatches.push({ card: label(card), field: "combat.ended", predicted: "ongoing", actual: after.phase, before: brief(obs) });
      }
    } else if (a.kind === "potion") {
      const held = s.potions.find((p) => p.slot === a.slot);
      const potion = held?.id ?? "?";
      log.cardsPlayed[`POTION:${potion}`] = (log.cardsPlayed[`POTION:${potion}`] ?? 0) + 1;
      (log.sequence ??= []).push(`t${obs.combat!.turn}:POTION:${potion}`);
      // Only the potions the model can drink are held to its prediction.
      if (inCombat && held && drinkable(held)) for (const m of compare(`POTION:${potion}`, drink(s, a), fromObservation(after))) log.mismatches.push({ ...m, before: brief(obs) });
    } else if (!won || hpsBeforeWinHeals(obs, after).length === 1) {
      // A fight won in the enemies' turn — a Waterfall Giant's DeathBlow as it dies, one that
      // escapes or dies to Flame Barrier — shows HP after the win's heals: held to the prediction
      // when only one HP heals to it (not when the guess picked between HPs), and no turn gone on after.
      if (!won) log.turns++;
      // HP cannot fall below 0: a lethal turn shows only the HP there was, and one that Lizard Tail
      // or Fairy in a Bottle undoes shows a gain (seed 17's Queen, turn 5: 18 HP to 52, -34).
      const end = hpAfterTurn(s);
      const predicted = end.hp > 0 ? s.player.hp - end.hp : s.player.hp;
      log.endTurn.push({ turn: obs.combat!.turn, predicted, actual: obs.player_hp - hpAfter, before: brief(obs) });
    }
    cur = next;
  }
  log.won = cur.observation.phase !== "game_over";
  log.hpEnd = cur.observation.player_hp;
  return { log, next: cur };
}

/**
 * Where the predicted start of a turn differs from the game's, on what does
 * not depend on the draw: the player's HP, block, energy, powers and hand
 * size, and each living enemy's HP, block and powers.
 */
function compareTurnStart(p: State, a: State): { field: string; predicted: string; actual: string }[] {
  const out: { field: string; predicted: string; actual: string }[] = [];
  const powers = (x: Record<string, number>) => Object.entries(x).filter(([, n]) => n !== 0).map(([k, n]) => `${k}${n}`).sort().join(" ");
  const check = (field: string, pv: string | number, av: string | number) => {
    if (String(pv) !== String(av)) out.push({ field, predicted: String(pv), actual: String(av) });
  };
  check("player.hp", p.player.hp, a.player.hp);
  check("player.block", p.player.block, a.player.block);
  check("energy", p.energy, a.energy);
  check("hand.size", p.hand.length, a.hand.length);
  check("player.powers", powers(p.player.powers), powers(a.player.powers));
  a.enemies.forEach((e, i) => {
    const q = p.enemies.find((x) => x.id === e.id);
    if (!q || !e.alive) return;
    check(`enemy${i + 1}.hp`, q.hp, e.hp);
    check(`enemy${i + 1}.block`, q.block, e.block);
    check(`enemy${i + 1}.powers`, powers(q.powers), powers(e.powers));
    const intents = (x: Enemy) => x.intents.map((t) => (t.type === "Attack" ? `Attack${t.damage}x${t.hits}` : t.type)).join("+");
    check(`enemy${i + 1}.intents`, intents(q), intents(e));
  });
  return out;
}

const MAX_STEPS = 2000;

let useRules = false;
let ascension = 0;
/** Drink potions the planner cannot model, where it counts (on with --choices rules). */
let usePotions = false;

/** --stop-floor: the run ends at the first fight after one on this floor. */
let stopFloor = 999;
/** Floors whose map screen's save is copied into runs/saves (--capture). */
let capture = new Set<number>();
/** The exploration's generator, when exploring (--explore): its draws counted, for a resume to pick up where it was. */
let exploring: (() => number) | undefined;
let exploreSeed = 0;
let exploreDraws = 0;
function startExploring(seedValue: number, draws = 0): void {
  const base = seeded(seedValue);
  for (let i = 0; i < draws; i++) base();
  exploreSeed = seedValue;
  exploreDraws = draws;
  exploring = () => {
    exploreDraws++;
    return base();
  };
}

/**
 * A run interrupted by a hang or a crash (the bridge's "no reply", ECONNRESET, the game exiting)
 * is resumed from the game's own save, as bench resumes a boss save: at most MAX_RESUMES times a
 * run. Which save: the one of the room the run was in, copied as its first screen showed (the game
 * writes current_run.save as the map's node is chosen, before the room). Not the game's latest: a
 * fight won writes one too, before its rewards, and continued it brings the room back with its
 * fight over, which AutoSlay then waits for ("Combat did not start": seed 586, killed on its floor
 * 8 rewards). The run is deterministic: the planner is put back as it was the first time it saw
 * that screen (floor and phase), and the fights and rooms logged since are dropped, to be logged
 * again as they are played again.
 */
const MAX_RESUMES = 2;
const RESUMABLE = /no reply in|ECONNRESET|closed the connection|not connected|EPIPE|game exited/;
interface Checkpoint {
  logs: number;
  rooms: number;
  fights: number;
  choices: ChoiceState;
  exploreDraws: number;
  skippedCardsOn: number;
}
/** The run's first sight of each screen, by `${floor}|${phase}`. */
const checkpoints = new Map<string, Checkpoint & { floor: number }>();
/** The run's resumes so far, and the error the next start resumes after. */
let resumes: Resume[] = [];
let resumeAfter: string | undefined;
/** The last observation the run had: a run that ended (a death) is not resumed. */
let lastObservation: Observation | undefined;
/** The save of the room the run is in (a copy, out of the profile's saves: each launch empties them), and its floor. */
let roomSave: string | undefined;
let roomSaveFloor = -1;

async function playRun(game: Game, seed: string, policy: Policy, maxFights: number, takeCards: boolean, logs: FightLog[], resume = false, sandbox = ""): Promise<void> {
  let cur = await game.startRun(seed, ascension, resume);
  const captured = new Set<number>();
  let fights = 0;
  if (resumeAfter !== undefined) {
    const o = cur.observation;
    const exact = checkpoints.get(`${o.floor}|${o.phase}`);
    // A screen never seen before (it should not happen): the floor's first sight, if any.
    const cp = exact ?? [...checkpoints.values()].filter((c) => c.floor === o.floor).sort((a, b) => a.logs - b.logs || a.rooms - b.rooms)[0];
    if (cp) {
      logs.length = cp.logs;
      rooms.length = cp.rooms;
      fights = cp.fights;
      restoreChoiceState(cp.choices);
      skippedCardsOn = cp.skippedCardsOn;
      if (exploring) startExploring(exploreSeed, cp.exploreDraws);
    }
    resumes.push({ floor: o.floor, phase: o.phase, error: resumeAfter, ...(exact ? {} : { unmatched: true }) });
    console.log(`  resumed at floor ${o.floor}, ${o.phase}${exact ? "" : cp ? " (the floor's first screen)" : " (no snapshot: logs kept)"}`);
    resumeAfter = undefined;
  }
  // A screen that comes back unchanged after its action did nothing (a reward that cannot be taken,
  // a button the game ignores) cost whole runs: 2,000 steps on one rewards screen after Punch Off's
  // fight. Seen 25 times, say so and try another action; 200 times, give the run up as stuck.
  let lastScreen = "";
  let repeats = 0;
  let stuck: string | undefined;
  for (let steps = 0; !cur.observation.is_terminal && steps < MAX_STEPS; steps++) {
    lastObservation = cur.observation;
    if (sandbox && cur.observation.floor !== roomSaveFloor) {
      const from = path.join(savesDir(sandbox), "current_run.save");
      if (fs.existsSync(from)) {
        roomSave = path.join(sandbox, "..", `resume-${path.basename(sandbox)}.save`);
        fs.copyFileSync(from, roomSave);
        roomSaveFloor = cur.observation.floor;
      }
    }
    const key = `${cur.observation.floor}|${cur.observation.phase}`;
    if (!checkpoints.has(key)) {
      checkpoints.set(key, { floor: cur.observation.floor, logs: logs.length, rooms: rooms.length, fights, choices: saveChoiceState(), exploreDraws, skippedCardsOn });
    }
    if (cur.observation.phase === "combat" && cur.observation.combat) {
      if (fights++ >= maxFights) return;
      if (logs.length > 0 && logs[logs.length - 1]!.seed === seed && logs[logs.length - 1]!.floor >= stopFloor) return;
      noteCombatStart(cur.observation);
      const { log, next } = await fight(game, cur, policy, seed, logs);
      const ms = log.planMs.length ? ` plan p95 ${pct(log.planMs, 0.95).toFixed(2)} ms` : "";
      console.log(
        `  floor ${String(log.floor).padStart(2)} ${log.won ? "won " : "LOST"} ${log.enemies.join("+").padEnd(28)}` +
          ` hp ${log.hpStart} -${log.hpLost} turns ${log.turns}${ms}` +
          (log.mismatches.length ? ` mismatches ${log.mismatches.length}` : "") +
          (log.illegal.length ? ` illegal ${log.illegal.length}` : ""),
      );
      cur = next;
      continue;
    }
    const o = cur.observation;
    setActBoss(o.act_boss, o.act_second_boss);
    if (o.phase === "map" && capture.has(o.floor) && !captured.has(o.floor) && sandbox) {
      captured.add(o.floor);
      const from = path.join(savesDir(sandbox), "current_run.save");
      if (fs.existsSync(from)) {
        // SPIRE_JEV_LIBRARY: another save library (runs/saves-unl for the unlocked timeline).
        const dir = path.resolve(import.meta.dirname, "..", "runs", process.env["SPIRE_JEV_LIBRARY"] ?? "saves");
        fs.mkdirSync(dir, { recursive: true });
        // The port tells apart two evaluations of the same seeds running at once.
        fs.copyFileSync(from, path.join(dir, `${seed}-a${ascension}-f${o.floor}-p${path.basename(sandbox).replace(/^p/, "")}.save`));
      }
    }
    let chosen: string;
    if (useRules && o.phase === "map" && hasFlag("pathdp")) {
      const map = (await game.call("map")) as { points?: MapPoint[] };
      chosen = chooseMapByPath(o, cur.legal_actions, map.points ?? []);
    } else chosen = useRules ? rules(o, cur.legal_actions) : routine(o, cur.legal_actions, takeCards);
    const screen = `${o.phase}|${o.floor}|${cur.legal_actions.map((a) => a.action_id).join(",")}`;
    repeats = screen === lastScreen ? repeats + 1 : 0;
    lastScreen = screen;
    if (repeats >= 25) {
      const ids = cur.legal_actions.map((a) => a.action_id);
      if (repeats === 25) console.log(`  stuck at floor ${o.floor}, ${o.phase}: [${ids.join(" ")}], chose ${chosen} 25 times`);
      if (repeats >= 200) {
        stuck = `stuck at floor ${o.floor}, ${o.phase}: [${ids.join(" ")}]`;
        break;
      }
      const others = ids.filter((id) => id !== chosen);
      chosen = ids.find((id) => /^(proceed|skip|leave|shop_leave)/.test(id) && id !== chosen) ?? others[(repeats - 25) % Math.max(1, others.length)] ?? chosen;
    }
    if (o.phase !== "rewards") {
      rooms.push({ seed, floor: o.floor, phase: o.phase, hp: o.player_hp, maxHp: o.player_max_hp, gold: o.gold, deck: o.deck_cards, room: o.room, chosen });
    }
    cur = await game.step(chosen);
  }
  const o = cur.observation;
  lastObservation = o;
  ends.push({
    seed, floor: o.floor, terminal: o.is_terminal, victory: o.is_victory, hp: o.player_hp, maxHp: o.player_max_hp, deck: o.deck_cards, relics: o.relics,
    ...(stuck ? { error: stuck } : {}), ...(resumes.length ? { resumed: [...resumes] } : {}),
  });
}

/**
 * The game's own verdict on a run: the "win" of its run-history file for this
 * seed, written at the end. (The bridge's victory flag misses the early-access
 * ending — The Architect takes the last HP and the game-over screen follows,
 * yet the history says win: seed 17 of rules2-a0, the first A0 clear.)
 */
export function historyWin(sandbox: string, seed: string, since: number): boolean | undefined {
  const dir = path.join(sandbox, "userdata", "SlayTheSpire2", "default", "1", "modded", "profile1", "saves", "history");
  if (!fs.existsSync(dir)) return undefined;
  let verdict: boolean | undefined;
  let latest = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".run")) continue;
    const file = path.join(dir, f);
    const mtime = fs.statSync(file).mtimeMs;
    if (mtime < since || mtime < latest) continue;
    try {
      const run = JSON.parse(fs.readFileSync(file, "utf8")) as { seed?: string; win?: boolean };
      if (run.seed !== seed) continue;
      verdict = run.win === true;
      latest = mtime;
    } catch {
      // A file being written: the next run's check will not need it.
    }
  }
  return verdict;
}

function pct(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

export function summarise(policy: string, logs: FightLog[]): string {
  const lines: string[] = [];
  const won = logs.filter((l) => l.won);
  const lost = logs.reduce((a, l) => a + l.hpLost, 0);
  const ms = logs.flatMap((l) => l.planMs);
  const nodes = logs.flatMap((l) => l.nodes);
  lines.push(`${policy}: ${logs.length} fights, ${won.length} won, HP lost per fight ${(lost / Math.max(1, logs.length)).toFixed(1)}`);
  if (ms.length) {
    lines.push(
      `  plan ms p50 ${pct(ms, 0.5).toFixed(2)} p95 ${pct(ms, 0.95).toFixed(2)} max ${Math.max(...ms).toFixed(2)};` +
        ` nodes p50 ${pct(nodes, 0.5)} max ${Math.max(...nodes)}; truncated ${logs.reduce((a, l) => a + l.truncated, 0)}` +
        `; on approximated cards ${logs.reduce((a, l) => a + l.inexact, 0)}`,
    );
  }
  const plays = logs.reduce((a, l) => a + l.plays, 0);
  const all = logs.flatMap((l) => l.mismatches);
  const badPlays = new Set(logs.flatMap((l, i) => l.mismatches.map((m) => `${i}/${m.card}/${m.field}/${m.predicted}`))).size;
  lines.push(`  cards played ${plays}; mismatched fields ${all.length} (${badPlays} distinct)`);
  const checks = logs.reduce((a, l) => a + (l.transitionChecks ?? 0), 0);
  if (checks > 0) {
    const byField: Record<string, number> = {};
    const turnsOff = new Set<string>();
    logs.forEach((l, i) => {
      for (const t of l.transitions ?? []) {
        const k = t.field.replace(/^enemy\d+/, "enemy");
        byField[k] = (byField[k] ?? 0) + 1;
        turnsOff.add(`${i}/${t.turn}`);
      }
    });
    lines.push(
      `  turn starts foreseen ${checks}, ${checks - turnsOff.size} exactly; fields off: ` +
        Object.entries(byField).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ${n}`).join(", "),
    );
  }
  const byKey = new Map<string, { n: number; eg: Mismatch }>();
  for (const m of all) {
    const k = `${m.card} ${m.field.replace(/^enemy\d+/, "enemy")}`;
    const e = byKey.get(k);
    if (e) e.n++;
    else byKey.set(k, { n: 1, eg: m });
  }
  for (const [k, { n, eg }] of [...byKey].sort((a, b) => b[1].n - a[1].n)) {
    lines.push(`    ${String(n).padStart(3)}x ${k}: predicted ${eg.predicted}, was ${eg.actual}`);
  }
  const ends = logs.flatMap((l) => l.endTurn);
  const exact = ends.filter((e) => e.predicted === e.actual).length;
  lines.push(`  end of turn HP loss predicted exactly ${exact}/${ends.length}`);
  for (const l of logs) {
    for (const e of l.endTurn) {
      if (e.predicted !== e.actual) lines.push(`    floor ${l.floor} ${l.enemies.join("+")} turn ${e.turn}: predicted ${e.predicted}, lost ${e.actual}`);
    }
  }
  const illegal = logs.flatMap((l) => l.illegal);
  if (illegal.length) lines.push(`  illegal choices ${illegal.length}: ${[...new Set(illegal)].slice(0, 8).join(", ")}`);
  return lines.join("\n");
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      policy: { type: "string", default: "planner" },
      runs: { type: "string", default: "1" },
      seed: { type: "string", default: "1" },
      "max-fights": { type: "string", default: "30" },
      // Stop the run once a fight on this floor or above has been played (bench: an act replayed to its boss).
      "stop-floor": { type: "string", default: "999" },
      port: { type: "string", default: "47100" },
      cards: { type: "string", default: "skip" },
      weights: { type: "string", default: "{}" },
      out: { type: "string" },
      choices: { type: "string", default: "first" },
      ascension: { type: "string", default: "0" },
      flags: { type: "string", default: "" },
      // Copy the run's save when the map is shown on these floors (comma-separated), into runs/saves/.
      capture: { type: "string", default: "" },
      // Continue a saved run instead of starting one (a file from --capture; --runs 1).
      resume: { type: "string" },
      // Explore (bench.ts --explore): now and then a close second-best line, from this seed.
      explore: { type: "string" },
    },
  });
  capture = new Set(values.capture.split(",").filter(Boolean).map(Number));
  stopFloor = Number(values["stop-floor"]);
  if (values.explore !== undefined) startExploring(Number(values.explore) * 7919 + 17);
  const policy = values.policy as Policy;
  weights = { ...DEFAULT_WEIGHTS, ...(JSON.parse(values.weights) as Partial<Weights>) };
  useRules = values.choices === "rules" || values.choices === "rules2";
  useRules2(values.choices === "rules2");
  setFlags(values.flags.split(","));
  useGiantRules(hasFlag("wgpot"), hasFlag("wghp"), hasFlag("wgblow"));
  useBossRules({ sleep: hasFlag("sleep") });
  // bossvalue: a boss fight's lines by the evaluation plus the learned value (value.ts; the net in
  // SPIRE_JEV_VALUE_NET or data/value-net.json, its share SPIRE_JEV_VALUE_MIX, 1 by default).
  if (hasFlag("bossvalue")) {
    const net = loadValueNet(process.env["SPIRE_JEV_VALUE_NET"]);
    if (!net) throw new Error("--flags bossvalue needs data/value-net.json");
    useValueNet(net, Number(process.env["SPIRE_JEV_VALUE_MIX"] ?? 1));
  }
  ascension = Number(values.ascension);
  setIntentAscension(ascension);
  usePotions = useRules;
  if (policy !== "planner" && policy !== "naive") throw new Error(`unknown policy ${policy}`);
  const repo = path.resolve(import.meta.dirname, "..", "..");
  const sandbox = path.join(repo, "sandbox", `p${values.port}`);
  const logs: FightLog[] = [];

  for (let r = 0; r < Number(values.runs); r++) {
    const seed = `JEV${String(Number(values.seed) + r).padStart(5, "0")}`;
    console.log(`${policy} ${seed}`);
    const t0 = Date.now();
    const firstLog = logs.length;
    checkpoints.clear();
    resumes = [];
    resumeAfter = undefined;
    lastObservation = undefined;
    roomSave = undefined;
    roomSaveFloor = -1;
    let resumeFrom = values.resume;
    for (let attempt = 0; ; attempt++) {
      let game: Game | undefined;
      let again = false;
      try {
        game = await Game.launch(sandbox, Number(values.port), resumeFrom);
        await playRun(game, seed, policy, Number(values["max-fights"]), values.cards === "take", logs, resumeFrom !== undefined, sandbox);
        // The history file is written as the run ends: give it a moment, then take the game's word.
        for (let wait = 0; wait < 10; wait++) {
          const win = historyWin(sandbox, seed, t0);
          const end = ends[ends.length - 1];
          if (win !== undefined && end?.seed === seed) {
            end.victory = win;
            if (win) console.log(`  VICTORY (the game's run history says win)`);
            break;
          }
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (err) {
        const message = (err as Error).message;
        const save = roomSave ?? path.join(savesDir(sandbox), "current_run.save");
        // (Set by playRun: the narrowing from the reset above does not see it.)
        const last = lastObservation as Observation | undefined;
        const over = last !== undefined && (last.is_terminal || last.phase === "game_over" || last.player_hp <= 0);
        if (attempt < MAX_RESUMES && RESUMABLE.test(message) && !over && fs.existsSync(save)) {
          // Out of the profile's saves, which the next launch empties before it puts this one back.
          const copy = path.join(sandbox, "..", `resume-${path.basename(sandbox)}-from.save`);
          fs.copyFileSync(save, copy);
          resumeFrom = copy;
          // The resumed attempt copies its own room saves again from its first screen.
          roomSaveFloor = -1;
          resumeAfter = message;
          again = true;
          console.log(`  run interrupted (${message}): resuming from the game's save (${attempt + 1} of ${MAX_RESUMES})`);
        } else {
          console.log(`  run stopped: ${message}`);
          ends.push({ seed, floor: -1, terminal: false, victory: false, hp: 0, maxHp: 0, deck: [], relics: [], error: message, ...(resumes.length ? { resumed: [...resumes] } : {}) });
        }
      } finally {
        await game?.kill();
      }
      if (!again) break;
    }
    if (resumes.length) for (const l of logs.slice(firstLog)) l.resumed = [...resumes];
    console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }

  const out = path.join(repo, "planner", "runs");
  fs.mkdirSync(out, { recursive: true });
  const file = values.out ? path.resolve(values.out) : path.join(out, `${policy}-${values.cards}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const cards = Object.fromEntries([...catalog].sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(file, JSON.stringify({ policy, weights, fights: logs, cards, rooms, ends }, null, 1));
  console.log(`\n${summarise(policy, logs)}\n\nlog: ${file}`);
}

if (import.meta.main) await main();
