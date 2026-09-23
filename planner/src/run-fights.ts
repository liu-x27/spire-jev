/**
 * Plays real fights in a sandboxed game and checks the simulator against it.
 *
 *   node src/run-fights.ts [--policy planner|naive] [--runs 3] [--seed 1] [--max-fights 30] [--port 47100] [--cards skip|take]
 *                          [--weights '{"future":0.5}'] [--out runs/x.json] [--choices first|rules]
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
import { cardValue, chooseCardReward, chooseCardSelectFor, chooseEvent, chooseMap, chooseRest, chooseSelect, chooseShop, chooseUpgrade, wantsPotion } from "./choices.ts";
import { actionId, DEFAULT_WEIGHTS, planTurn, type Weights } from "./search.ts";
import { type Action, type Card, drink, fromObservation, hpLoss, play } from "./sim.ts";

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
    const junk = cards.findIndex((c) => c.card_type === "Status" || c.card_type === "Curse");
    i = junk >= 0 ? junk : offers.length - 1;
  } else if (/Upgrade/.test(purpose)) {
    let best = -Infinity;
    cards.forEach((c, j) => {
      const v = cardValue(c.card_id, 0, obs.deck_cards);
      if (v > best) [best, i] = [v, j];
    });
  }
  return offers[Math.min(i, offers.length - 1)]!.action_id;
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
  let cur = start;
  while (cur.observation.phase === "combat" && cur.observation.combat) {
    const obs = cur.observation;
    collect(obs);
    const s = fromObservation(obs);
    const legal = new Set(cur.legal_actions.map((a) => a.action_id));

    let a: Action;
    if (policy === "planner") {
      const plan = planTurn(s, weights);
      log.planMs.push(plan.ms);
      log.nodes.push(plan.nodes);
      if (plan.truncated) log.truncated++;
      if (!plan.exact) log.inexact++;
      a = plan.actions[0] ?? { kind: "end" };
    } else {
      a = naive(cur.legal_actions);
    }
    let id = actionId(a);
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
      const potion = s.potions.find((p) => p.slot === a.slot)?.id ?? "?";
      log.cardsPlayed[`POTION:${potion}`] = (log.cardsPlayed[`POTION:${potion}`] ?? 0) + 1;
      if (inCombat) for (const m of compare(`POTION:${potion}`, drink(s, a), fromObservation(after))) log.mismatches.push({ ...m, before: brief(obs) });
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

const MAX_STEPS = 2000;

let useRules = false;

async function playRun(game: Game, seed: string, policy: Policy, maxFights: number, takeCards: boolean, logs: FightLog[]): Promise<void> {
  let cur = await game.startRun(seed);
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
    const chosen = useRules ? rules(o, cur.legal_actions) : routine(o, cur.legal_actions, takeCards);
    if (o.phase !== "map" && o.phase !== "rewards") {
      rooms.push({ seed, floor: o.floor, phase: o.phase, hp: o.player_hp, maxHp: o.player_max_hp, gold: o.gold, deck: o.deck_cards, room: o.room, chosen });
    }
    cur = await game.step(chosen);
  }
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
    },
  });
  const policy = values.policy as Policy;
  weights = { ...DEFAULT_WEIGHTS, ...(JSON.parse(values.weights) as Partial<Weights>) };
  useRules = values.choices === "rules";
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
  fs.writeFileSync(file, JSON.stringify({ policy, weights, fights: logs, cards, rooms }, null, 1));
  console.log(`\n${summarise(policy, logs)}\n\nlog: ${file}`);
}

if (import.meta.main) await main();
