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
import { Game, type StepResult } from "./bridge.ts";
import { compare, type Mismatch } from "./differential.ts";
import type { CardObs, LegalAction, Observation } from "./obs.ts";
import { cardValue, chooseCardReward, chooseCardSelectFor, chooseEvent, chooseMap, chooseMapByPath, chooseRest, chooseSelect, chooseShop, chooseUpgrade, hasFlag, setFlags, useRules2, wantsPotion } from "./choices.ts";
import type { MapPoint } from "./path.ts";
import { setIntentAscension } from "./intents.ts";
import { actionId, DEFAULT_WEIGHTS, expectedIntents, planTurn, planTurn2, safetyMargin, type Weights } from "./search.ts";
import { nextTurn, seeded } from "./turn.ts";
import { type Action, type Card, drink, drinkable, type Enemy, fromObservation, hpLoss, junkIndex, play, type State } from "./sim.ts";

type Policy = "planner" | "naive";

/** The planner's evaluation weights for this run: the defaults, with --weights on top. */
let weights: Weights = DEFAULT_WEIGHTS;

export interface FightLog {
  seed: string;
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
  /** Taken during the fight. */
  hpLost: number;
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
    const { index: _index, can_play: _canPlay, ...rest } = card;
    catalog.set(key, rest);
  }
}

/** One line of the state that matters for a mismatch: HP, block, powers and their numbers, intents. */
function brief(o: Observation): string {
  const pw = (p: Record<string, number>, v: Record<string, Record<string, number>> | undefined) =>
    Object.entries(p).map(([k, n]) => `${k}${n}${v?.[k] ? JSON.stringify(v[k]) : ""}`).join(",");
  const player = `P ${o.player_hp}hp ${o.player_block}blk ${o.player_energy}e [${pw(o.player_powers, o.player_power_vars)}]`;
  const enemies = (o.combat?.enemies ?? []).filter((e) => e.is_alive).map((e) =>
    `E${e.combat_id} ${e.model_id} ${e.hp}hp ${e.block}blk [${pw(e.powers, e.power_vars)}] ${e.intents.map((i) => i.type + (i.damage ? `${i.damage}x${i.hits}` : "")).join("+")}`);
  const hand = `H[${(o.combat?.hand ?? []).map((c) => c.card_id + (c.upgrades > 0 ? "+" : "") + (c.enchantment ? `~${c.enchantment}` : "")).join(",")}] draw ${o.combat?.draw_pile.length ?? 0} discard ${o.combat?.discard_pile.length ?? 0} exhaust ${o.combat?.exhaust_pile.length ?? 0}`;
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
  if (/^FromHand(ForDiscard)?$/.test(purpose)) {
    i = cards.length ? junkIndex(cards.map((c) => ({ id: c.card_id, type: c.card_type }))) : offers.length - 1;
  } else if (/Upgrade|ChooseACard|SimpleGrid|Bundle/.test(purpose)) {
    let best = -Infinity;
    cards.forEach((c, j) => {
      const v = cardValue(c.card_id, 0, obs.deck_cards);
      if (v > best) [best, i] = [v, j];
    });
  }
  return offers[Math.min(i, offers.length - 1)]!.action_id;
}

/** Potions that work by themselves (Fairy in a Bottle saves a death), or are worth more kept. */
const KEEP_POTIONS = new Set(["FAIRY_IN_A_BOTTLE"]);
const BOSSES = new Set(["VANTOM", "THE_KIN", "CEREMONIAL_BEAST", "WATERFALL_GIANT", "LAGAVULIN_MATRIARCH", "SOUL_FYSH",
  "KNOWLEDGE_DEMON", "KAISER_CRAB", "THE_INSATIABLE", "QUEEN", "TEST_SUBJECT", "AEONGLASS"]);
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
  const elite = s.enemies.some((e) => e.alive && ELITES.test(e.model));
  const hurt = s.player.hp < 0.5 * s.player.maxHp;
  if (!(hopeless || (boss && turn <= 2) || (elite && hurt))) return undefined;
  const byHp = [...s.enemies].filter((e) => e.alive).sort((a, b) => a.hp - b.hp);
  // A potion tried this turn and still held was refused: not again this turn.
  // Only potions the search cannot model — it already weighs the ones it can (a Block Potion was
  // forced on a turn with no attack coming) — unless no play survives the turn.
  const modelled = new Set(s.potions.filter((p) => drinkable(p)).map((p) => p.slot));
  const uses = legal.filter((a) => a.action_id.startsWith("use_potion:") && !KEEP_POTIONS.has(String(a.metadata?.["potion_id"] ?? ""))
    && !tried.has(`${turn}:${a.action_id.split(":")[1]}`) && (hopeless || !modelled.has(Number(a.action_id.split(":")[1]))));
  for (const a of uses) {
    const target = a.metadata?.["target_id"];
    if (target === undefined || !s.enemies.some((e) => e.id === Number(target))) return a.action_id;
    if (Number(target) === byHp[0]?.id) return a.action_id;
  }
  return uses[0]?.action_id;
}

/** One fight, logged into `logs` as it goes, so a game that dies mid-fight still leaves what it did. */
async function fight(game: Game, start: StepResult, policy: Policy, seed: string, logs: FightLog[]): Promise<{ log: FightLog; next: StepResult }> {
  const o = start.observation;
  const log: FightLog = {
    seed, floor: o.floor, enemies: (o.combat?.enemies ?? []).map((e) => e.model_id), relics: o.relics, relicVars: o.relic_vars ?? {}, potions: o.potions,
    won: false, hpStart: o.player_hp, hpEnd: o.player_hp, hpLost: 0, maxHp: o.player_max_hp,
    turns: 0, plays: 0, planMs: [], nodes: [], truncated: 0, inexact: 0, mismatches: [], endTurn: [], illegal: [], cardsPlayed: {},
  };
  logs.push(log);
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
      const plan = weights.look > 0 ? planTurn2(s, weights) : planTurn(s, weights);
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
    // Once the fight is won the HP shown already includes the heal for winning.
    if (inCombat || after.phase === "game_over") log.hpLost += Math.max(0, obs.player_hp - after.player_hp);
    if (a.kind === "play") {
      log.plays++;
      const card = s.hand[a.hand]!;
      log.cardsPlayed[label(card)] = (log.cardsPlayed[label(card)] ?? 0) + 1;
      const predicted = play(s, a);
      if (!inCombat && after.phase !== "game_over") log.hpLost += Math.max(0, obs.player_hp - predicted.player.hp);
      if (inCombat) {
        for (const m of compare(label(card), predicted, fromObservation(after))) log.mismatches.push({ ...m, before: brief(obs) });
      } else if (after.phase !== "game_over" && predicted.enemies.some((e) => e.alive)) {
        log.mismatches.push({ card: label(card), field: "combat.ended", predicted: "ongoing", actual: after.phase, before: brief(obs) });
      }
    } else if (a.kind === "potion") {
      const held = s.potions.find((p) => p.slot === a.slot);
      const potion = held?.id ?? "?";
      log.cardsPlayed[`POTION:${potion}`] = (log.cardsPlayed[`POTION:${potion}`] ?? 0) + 1;
      // Only the potions the model can drink are held to its prediction.
      if (inCombat && held && drinkable(held)) for (const m of compare(`POTION:${potion}`, drink(s, a), fromObservation(after))) log.mismatches.push({ ...m, before: brief(obs) });
    } else if (inCombat || after.phase === "game_over") {
      // (A fight that ends in the enemies' turn — one escapes, or dies to
      // Flame Barrier — shows HP after the win's heal: nothing to compare.)
      log.turns++;
      // HP cannot fall below 0: a lethal turn shows only the HP there was.
      const predicted = Math.min(hpLoss(s), s.player.hp);
      log.endTurn.push({ turn: obs.combat!.turn, predicted, actual: obs.player_hp - after.player_hp, before: brief(obs) });
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

async function playRun(game: Game, seed: string, policy: Policy, maxFights: number, takeCards: boolean, logs: FightLog[]): Promise<void> {
  let cur = await game.startRun(seed, ascension);
  let fights = 0;
  for (let steps = 0; !cur.observation.is_terminal && steps < MAX_STEPS; steps++) {
    if (cur.observation.phase === "combat" && cur.observation.combat) {
      if (fights++ >= maxFights) return;
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
    let chosen: string;
    if (useRules && o.phase === "map" && hasFlag("pathdp")) {
      const map = (await game.call("map")) as { points?: MapPoint[] };
      chosen = chooseMapByPath(o, cur.legal_actions, map.points ?? []);
    } else chosen = useRules ? rules(o, cur.legal_actions) : routine(o, cur.legal_actions, takeCards);
    if (o.phase !== "rewards") {
      rooms.push({ seed, floor: o.floor, phase: o.phase, hp: o.player_hp, maxHp: o.player_max_hp, gold: o.gold, deck: o.deck_cards, room: o.room, chosen });
    }
    cur = await game.step(chosen);
  }
  const o = cur.observation;
  ends.push({ seed, floor: o.floor, terminal: o.is_terminal, victory: o.is_victory, hp: o.player_hp, maxHp: o.player_max_hp, deck: o.deck_cards, relics: o.relics });
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
      port: { type: "string", default: "47100" },
      cards: { type: "string", default: "skip" },
      weights: { type: "string", default: "{}" },
      out: { type: "string" },
      choices: { type: "string", default: "first" },
      ascension: { type: "string", default: "0" },
      flags: { type: "string", default: "" },
    },
  });
  const policy = values.policy as Policy;
  weights = { ...DEFAULT_WEIGHTS, ...(JSON.parse(values.weights) as Partial<Weights>) };
  useRules = values.choices === "rules" || values.choices === "rules2";
  useRules2(values.choices === "rules2");
  setFlags(values.flags.split(","));
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
    let game: Game | undefined;
    try {
      game = await Game.launch(sandbox, Number(values.port));
      await playRun(game, seed, policy, Number(values["max-fights"]), values.cards === "take", logs);
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
      console.log(`  run stopped: ${(err as Error).message}`);
    } finally {
      await game?.kill();
    }
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
