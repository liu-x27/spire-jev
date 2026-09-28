/**
 * A human's run, replayed in the game: every choice the replay (Spire Codex's NDJSON: every draw,
 * play, target, enemy move and choice) says the player made, made again through the bridge on the
 * same seed, so that each fight of theirs can be fought again by the planner from the same start —
 * the same deck, relics, potions, HP, and the same random numbers (so the same draws).
 *
 *   node src/replay-drive.ts --replay <file.ndjson> [--port 47150] [--out runs/replay-<seed>] [--to-floor 49]
 *
 * Writes into --out: f<floor>.save (the game's save as the map node of each fight is chosen: resumed,
 * it starts that fight again), turns.jsonl (each of the human's turn starts: the observation, the
 * planner's line from it, the human's plays), and drive.json (what matched and what did not).
 *
 * A floor the replay shows twice (a quit and continue: the room starts again) is replayed from its
 * last showing. A play's target is the monster's id in the replay; between two of the same monster,
 * the one whose HP makes the replay's hits and kills add up (solveTargets).
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { Game, savesDir, type StepResult } from "./bridge.ts";
import { setIntentAscension } from "./intents.ts";
import type { LegalAction, Observation } from "./obs.ts";
import { actionId, planTurn, TURN_WEIGHTS } from "./search.ts";
import { type Action, drink, fromObservation, play, type State } from "./sim.ts";

// deno-lint-ignore no-explicit-any
type Ev = { t: string; s: number; floor?: number; act?: number; [k: string]: any };

const { values } = parseArgs({
  options: {
    replay: { type: "string" },
    port: { type: "string", default: "47150" },
    out: { type: "string" },
    "to-floor": { type: "string", default: "99" },
    ascension: { type: "string", default: "10" },
    "max-steps": { type: "string", default: "6000" },
    // A fork (a turn's choice priced by the fight's end): resume a fight save, play the human's turns
    // before --fork-turn, then at it the human's line (--branch human, the bot from the next turn) or
    // the bot's (--branch bot); the bot (run-fights' fight(), --flags) plays the fight out.
    resume: { type: "string" },
    "fork-turn": { type: "string" },
    branch: { type: "string", default: "human" },
    flags: { type: "string", default: "" },
    "fork-out": { type: "string" },
  },
});
if (!values.replay) throw new Error("--replay is required");
const events: Ev[] = fs.readFileSync(values.replay, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l) as Ev);
const header = events.find((e) => e.t === "header")!;
// A run played with a content mod (Chaos cards, Ancient Affection's Neow relics) cannot be replayed on the base game.
{
  const raw = JSON.stringify(events);
  const mod = raw.includes("CHAOS_") ? "Chaos cards" : raw.includes("ANCIENTAFFECTION") ? "Ancient Affection" : undefined;
  if (mod) {
    console.log(`stopped: modded run (${mod})`);
    process.exit(0);
  }
}
const seed = header["seed"] as string;
const outDir = path.resolve(values.out ?? path.join(import.meta.dirname, "..", "runs", `replay-${seed}`));
fs.mkdirSync(outDir, { recursive: true });
const ascension = Number(values.ascension);
setIntentAscension(ascension);

/** Each floor's events, from its last "room" on (a floor shown again after a quit and continue starts again). */
const blocks = new Map<number, Ev[]>();
{
  let floor = 0;
  let cur: Ev[] = [];
  blocks.set(0, cur);
  for (const e of events) {
    if (e.t === "room") {
      floor = e.floor!;
      const had = blocks.get(floor);
      const first = had?.find((x) => x.t === "room");
      // The same room again is a quit and continue (the room starts over); another room on the same
      // floor (THE_ARCHITECT after floor 49's boss) goes on from the last.
      if (had && first && (first["coord"] !== e["coord"] || first["id"] !== e["id"])) cur = had;
      else {
        cur = [];
        blocks.set(floor, cur);
      }
    }
    // A reload into a fight's rewards (the save after it): what was taken before is undone.
    if (e.t === "resume" && e["combat_id"]) {
      const end = cur.map((x) => x.t === "combat_end" && x["combat_id"] === e["combat_id"]).lastIndexOf(true);
      // (The fight's own end stays: its HP changes as it closed, Burning Blood's heal.)
      let keep = end + 1;
      while (end >= 0 && keep < cur.length && cur[keep]!.t === "hp") keep++;
      if (end >= 0) cur.length = keep;
    }
    if (e.t === "header" || e.t === "resume" || e.t === "end") continue;
    cur.push(e);
  }
}
/** Where each floor's room is, for the map. */
const roomOf = (floor: number): Ev | undefined => blocks.get(floor)?.find((e) => e.t === "room");
/** Each act's boss as the replay's map shows it. */
const mapBoss = new Map<number, string>();
for (const e of events) if (e.t === "map" && !mapBoss.has(e.act!)) mapBoss.set(e.act!, `${e["boss"]}|${e["boss2"] ?? ""}`);

/** The relics the replay has the player holding as each floor begins (the starting ones, then every "relic" event before it). */
const relicsBefore = new Map<number, string[]>();
{
  const held: string[] = [...((header["starting_relics"] as string[] | undefined) ?? [])];
  let at = 0;
  for (const [f, b] of [...blocks.entries()].sort((x, y) => x[0] - y[0])) {
    while (at < f) relicsBefore.set(++at, [...held]);
    for (const e of b) if (e.t === "relic") held.push(e["id"] as string);
  }
  relicsBefore.set(at + 1, [...held]);
}
/** The enchantments events put on deck cards (by the card's number in the deck, from the floor on): which copy a play was. */
const enchantOf = new Map<number, { floor: number; id: string }>();
for (const [f, b] of [...blocks.entries()].sort((x, y) => x[0] - y[0])) for (const e of b) if (e.t === "enchant" && e["c"] !== undefined) enchantOf.set(Number(e["c"]), { floor: f, id: String(e["enchantment"]) });
const enchantAt = (deckC: unknown, floor: number): string | null => {
  const x = deckC === undefined ? undefined : enchantOf.get(Number(deckC));
  return x && floor > x.floor ? x.id : null;
};
/**
 * Each deck card as the replay's fights show it: its id and the floors it was drawn on, and what its
 * plays gave (block, damage). An old replay (v4) logs no pick for an event's transform or enchant:
 * the transformed card is the one never drawn again, the enchanted one the copy whose plays give more.
 */
const deckCards = new Map<number, { id: string; floors: number[]; gains: number[] }>();
const removedAt = new Map<number, number>();
for (const [f, b] of [...blocks.entries()].sort((x, y) => x[0] - y[0])) {
  for (let i = 0; i < b.length; i++) {
    const e = b[i]!;
    if (e.t === "remove" && e["c"] !== undefined) removedAt.set(Number(e["c"]), f);
    if (e.t === "draw" && e["deck_c"] !== undefined) {
      const c = Number(e["deck_c"]);
      const d = deckCards.get(c) ?? { id: String(e["id"]), floors: [], gains: [] };
      d.floors.push(f);
      deckCards.set(c, d);
    }
    if (e.t === "play" && e["deck_c"] !== undefined && !e["auto"]) {
      let gain = 0;
      for (let j = i + 1; j < b.length; j++) {
        const x = b[j]!;
        if (x.t === "play" || x.t === "end_turn" || x.t === "potion_used" || x.t === "combat_end") break;
        if (x.t === "block" && x["src"] === "player") gain += Number(x["n"] ?? 0);
        if (x.t === "hit" && x["src"] === "player") gain += Number(x["dmg"] ?? 0) + Number(x["blocked"] ?? 0);
      }
      const d = deckCards.get(Number(e["deck_c"]));
      if (d) d.gains.push(gain);
    }
  }
}
/** The deck cards of these ids the human held on this floor (drawn by then or after it, not removed before it), by number. */
const heldAt = (floor: number, ids: string[]): number[] => [...deckCards.entries()]
  .filter(([c, d]) => ids.includes(d.id) && (removedAt.get(c) ?? Infinity) >= floor && d.floors.some((f) => f <= floor) || (ids.includes(d.id) && c <= 11 && (removedAt.get(c) ?? Infinity) >= floor))
  .map(([c]) => c).sort((a, b) => a - b);
/** The card an unrecorded event transform took: the one held here and never drawn after it (nor removed after it). */
function inferTransformed(floor: number, ids: string[]): number | undefined {
  const gone = heldAt(floor, ids).filter((c) => !deckCards.get(c)!.floors.some((f) => f > floor) && removedAt.get(c) === undefined);
  return gone.length ? gone[0] : undefined;
}
/** The copy an unrecorded event enchant took: the one whose plays after it give clearly more than its copies'. */
function inferEnchanted(floor: number, ids: string[]): number | undefined {
  const mean = (c: number) => { const g = deckCards.get(c)!.gains; return g.length ? g.reduce((a, x) => a + x, 0) / g.length : undefined; };
  const scored = heldAt(floor, ids).map((c) => ({ c, m: mean(c) })).filter((x) => x.m !== undefined).sort((a, b) => b.m! - a.m!);
  if (scored.length === 1) return scored[0]!.c;
  if (scored.length >= 2 && scored[0]!.m! - scored[1]!.m! >= 1) return scored[0]!.c;
  return undefined;
}
/** A card's type from the planner's catalogue (Attack, Skill, Power, ...). */
const CATALOG = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "data", "card-catalog.json"), "utf8")) as Record<string, { card_type?: string }>;
  } catch {
    return {} as Record<string, { card_type?: string }>;
  }
})();
const catalogType = (id: string): string | undefined => CATALOG[id.replace(/\+$/, "")]?.card_type;
/** The words the game's Chinese option texts use for each card type. */
const TYPE_WORDS: Record<string, string> = { Attack: "攻击", Skill: "技能", Power: "能力" };
/** A cursor over a floor's events: what has been done of it. */
const cursor = new Map<number, number>();
function next(floor: number, pred: (e: Ev) => boolean, stopAt?: (e: Ev) => boolean): Ev | undefined {
  const b = blocks.get(floor) ?? [];
  for (let i = cursor.get(floor) ?? 0; i < b.length; i++) {
    const e = b[i]!;
    if (stopAt?.(e)) return undefined;
    if (pred(e)) return e;
  }
  return undefined;
}
/** Past `e` (never back: an event found behind the cursor, like a reward's offer, leaves it where it is). */
function consume(floor: number, e: Ev): void {
  const b = blocks.get(floor) ?? [];
  const i = b.indexOf(e);
  if (i >= 0 && i + 1 > (cursor.get(floor) ?? 0)) cursor.set(floor, i + 1);
}

const log: { floor: number; phase: string; what: string }[] = [];
const note = (floor: number, phase: string, what: string) => {
  log.push({ floor, phase, what });
  console.log(`  [${floor} ${phase}] ${what}`);
};

/**
 * The instance each single-target play (and each hit of a card with no target) went to, where the
 * replay names only the monster: the assignment under which every hit leaves its target alive or
 * kills it as the replay says (a kill's hit is the HP it had left).
 */
function solveTargets(combat: Ev[], enemies: { i: number; id: string; hp: number }[]): Map<number, number> | undefined {
  type Step = { ev: Ev; kind: "play" | "hit" | "reset" };
  const steps: Step[] = [];
  for (const e of combat) {
    // A play_index above 0 is the same card played again by the game (play_count 2: a replay), not a choice.
    if (e.t === "play" && !e["auto"] && (e["play_index"] ?? 0) === 0) steps.push({ ev: e, kind: "play" });
    else if (e.t === "hit" && e["src"] === "player") steps.push({ ev: e, kind: "hit" });
    // Past a turn's end or a potion, the player's hits are no longer the last card's (Thorns on the attackers).
    else if (e.t === "end_turn" || e.t === "turn" || e.t === "potion_used") steps.push({ ev: e, kind: "reset" });
  }
  const assign = new Map<number, number>();
  const hp = enemies.map((e) => e.hp);
  const sameModel = (m: string) => enemies.filter((e) => e.id === m).map((e) => e.i);
  let budget = 200_000;
  const go = (k: number, current: number | undefined, currentModel: string | undefined): boolean => {
    if (--budget < 0) return false;
    if (k === steps.length) return true;
    const { ev, kind } = steps[k]!;
    if (kind === "reset") return go(k + 1, undefined, undefined);
    if (kind === "play") {
      const m = ev["target"] as string | undefined;
      if (!m) return go(k + 1, undefined, undefined);
      const cands = sameModel(m).filter((i) => hp[i]! > 0);
      if (cands.length === 0) return go(k + 1, undefined, m); // a target already dead to the model (summons, heals): skip
      for (const i of cands) {
        assign.set(ev.s, i);
        if (go(k + 1, i, m)) return true;
      }
      assign.delete(ev.s);
      return false;
    }
    // A hit: on the play's target, or (no target, or another monster) on any living one of that id.
    const m = ev["dst"] as string;
    const dmg = Number(ev["dmg"] ?? 0);
    const killed = Boolean(ev["killed"]);
    const cands = current !== undefined && currentModel === m ? [current] : sameModel(m).filter((i) => hp[i]! > 0);
    if (cands.length === 0) return go(k + 1, current, currentModel);
    for (const i of cands) {
      const before = hp[i]!;
      const after = before - dmg;
      if (killed ? after > 0 : after <= 0) continue;
      hp[i] = killed ? 0 : after;
      if (current === undefined || currentModel !== m) assign.set(ev.s, i);
      if (go(k + 1, current, currentModel)) return true;
      hp[i] = before;
    }
    if (current === undefined || currentModel !== m) assign.delete(ev.s);
    return false;
  };
  return go(0, undefined, undefined) ? assign : undefined;
}

/**
 * The target of the play at `from` (an index into the fight's events) when its own hits cannot tell:
 * from the enemies as they stand now (live HP by combat id), the assignment of this and every later
 * single-target play (and every later hit of a card with no target) under which each hit leaves its
 * enemy alive or kills it exactly as the replay says. undefined when none is consistent.
 */
function solveLive(events: Ev[], from: number, live: { id: number; model: string; hp: number }[]): number | undefined {
  const steps: { ev: Ev; kind: "play" | "hit" | "reset" }[] = [];
  for (let i = from; i < events.length; i++) {
    const e = events[i]!;
    if (e.t === "play" && !e["auto"] && (e["play_index"] ?? 0) === 0) steps.push({ ev: e, kind: "play" });
    else if (e.t === "hit" && e["src"] === "player") steps.push({ ev: e, kind: "hit" });
    else if (i > from && (e.t === "end_turn" || e.t === "turn" || e.t === "potion_used")) steps.push({ ev: e, kind: "reset" });
  }
  const hp = new Map(live.map((e) => [e.id, e.hp]));
  const of = (m: string) => live.filter((e) => e.model === m && (hp.get(e.id) ?? 0) > 0).map((e) => e.id);
  let first: number | undefined;
  let budget = 200_000;
  const go = (k: number, cur: number | undefined, curModel: string | undefined): boolean => {
    if (--budget < 0) return false;
    if (k === steps.length) return true;
    const { ev, kind } = steps[k]!;
    if (kind === "reset") return go(k + 1, undefined, undefined);
    if (kind === "play") {
      const m = ev["target"] as string | undefined;
      if (!m) return go(k + 1, undefined, undefined);
      const cands = of(m);
      if (cands.length === 0) return go(k + 1, undefined, m);
      for (const id of cands) {
        if (k === 0) first = id;
        if (go(k + 1, id, m)) return true;
      }
      return false;
    }
    const m = ev["dst"] as string;
    const dmg = Number(ev["dmg"] ?? 0);
    const killed = Boolean(ev["killed"]);
    const cands = cur !== undefined && curModel === m ? [cur] : of(m);
    if (cands.length === 0) return go(k + 1, cur, curModel);
    for (const id of cands) {
      const before = hp.get(id) ?? 0;
      const after = before - dmg;
      if (killed ? after !== 0 : after <= 0) continue;
      hp.set(id, after);
      if (go(k + 1, cur, curModel)) return true;
      hp.set(id, before);
    }
    return false;
  };
  return go(0, undefined, undefined) ? first : undefined;
}

/** The legal action for a play of the replay's card (id, upgrade and enchantment: null for none) on the given enemy. */
function playAction(obs: Observation, legal: LegalAction[], card: string, up: number, target: number | undefined, enchantment: string | null = null): string | undefined {
  const hand = obs.combat?.hand ?? [];
  const ids = new Set(legal.map((a) => a.action_id));
  // ("*": some enchantment the replay does not name, the copy an old replay's event enchanted.)
  const off = (c: (typeof hand)[number]) => Math.abs(c.upgrades - up) * 2 + ((enchantment === "*" ? !!c.enchantment : (c.enchantment ?? null) === enchantment) ? 0 : 1);
  const order = hand.map((c, i) => ({ c, i })).filter(({ c }) => c.card_id === card).sort((a, b) => off(a.c) - off(b.c));
  for (const { i } of order) {
    if (target !== undefined && ids.has(`play_card:${i}:target:${target}`)) return `play_card:${i}:target:${target}`;
    if (ids.has(`play_card:${i}`)) return `play_card:${i}`;
    // A target the replay did not name (a random one): the first legal.
    const any = legal.find((a) => a.action_id.startsWith(`play_card:${i}:`));
    if (any) return any.action_id;
  }
  return undefined;
}

/** A turn's line by card names: each action read off the hand as it stands when it is played (indices shift as cards go). */
export function labelLine(start: State, line: readonly Action[]): string[] {
  let s = start;
  const out: string[] = [];
  for (const a of line) {
    if (a.kind === "end") {
      out.push("END");
      break;
    }
    if (a.kind === "potion") {
      out.push(`potion:${s.potions.find((p) => p.slot === a.slot)?.id ?? a.slot}`);
      try {
        s = drink(s, a);
      } catch {
        break;
      }
      continue;
    }
    const c = s.hand[a.hand];
    const t = a.target !== undefined ? s.enemies.find((e) => e.id === a.target)?.model : undefined;
    out.push(`${c?.id ?? "?"}${(c?.upgrades ?? 0) > 0 ? "+" : ""}${t ? `>${t}` : ""}`);
    try {
      s = play(s, a);
    } catch {
      break;
    }
  }
  return out;
}

interface TurnRow {
  floor: number;
  encounter: string;
  turn: number;
  hp: number;
  energy: number;
  hand: string[];
  enemies: { id: string; hp: number; block: number; intents: string }[];
  human: string[];
  planner: string[];
  plannerScore: number;
}

/** What replay-drive's forks take from run-fights (the botlab worktree's, with configure()). */
type ForkRunner = {
  configure(flags: readonly string[], choices?: string, asc?: number): void;
  fight(game: unknown, start: StepResult, policy: "planner", seed: string, logs: unknown[]): Promise<{ log: { hpStart: number; hpLost: number; won: boolean; turns: number } }>;
  hpBeforeWinHeals(before: Observation, after: Observation, guess: number): number;
};
let forkMeta: Record<string, unknown> = {};
function writeFork(r: Record<string, unknown>): void {
  const out = { seed, floor: forkMeta["floor"], encounter: forkMeta["encounter"], turn: Number(values["fork-turn"]), branch: values.branch, flags: values.flags, humanLine: forkMeta["line"], hpTurnStart: forkMeta["hp"], ...r };
  fs.writeFileSync(path.resolve(values["fork-out"] ?? path.join(outDir, `fork-${values["fork-turn"]}-${values.branch}.json`)), JSON.stringify(out, null, 1));
  console.log(`fork: ${JSON.stringify(out)}`);
}

async function main(): Promise<void> {
  const repo = path.resolve(import.meta.dirname, "..", "..");
  const sandbox = path.join(repo, "sandbox", `p${values.port}`);
  const game = await Game.launch(sandbox, Number(values.port), values.resume);
  const turnsFile = path.join(outDir, "turns.jsonl");
  fs.writeFileSync(turnsFile, "");
  fs.writeFileSync(path.join(outDir, "turn-ends.jsonl"), "");
  const checks: Record<string, number> = { bossOk: 0, bossBad: 0, rewardOk: 0, rewardBad: 0, enemiesOk: 0, enemiesBad: 0, drawOk: 0, drawBad: 0, hpOk: 0, hpBad: 0 };
  const fightsOut: { floor: number; encounter: string; save: string; hpStart: number; humanHpLost: number | null; humanTurns: number; gameHpLost?: number; result?: string }[] = [];
  let stopReason = "";
  try {
    let cur: StepResult = await game.startRun(seed, ascension, values.resume !== undefined);
    let combatFloor = -1;
    let combatEvents: Ev[] = [];
    let targets: Map<number, number> | undefined;
    let lastTurnSeen = 0;
    let row: TurnRow | undefined;
    let hpAtStart = 0;
    /** The replay's fight and the game's parted (a play not legal, one side over first): the planner finishes it. */
    let diverged = false;
    /** Event screens in a row with nothing left of the replay's event: past a few, the drive is stuck. */
    let stuck: number | undefined;
    /** The floor whose fight got a turn ended for the replay's ending in a turn's end (Stampede): once a fight. */
    let endedAt: number | undefined;
    const forkTurn = values["fork-turn"] !== undefined ? Number(values["fork-turn"]) : undefined;
    /** The fork's turn as it began (HP, the human's line), and the draw mismatches up to it. */
    let forkHp: number | undefined;
    let forkDrawBad = 0;
    let lastKey = "";
    let repeats = 0;
    const bossChecked = new Set<number>();
    const relicsChecked = new Set<number>();
    for (let step = 0; step < Number(values["max-steps"]); step++) {
      const o = cur.observation;
      const legal = cur.legal_actions;
      const ids = legal.map((a) => a.action_id);
      const floor = o.floor;
      if (o.is_terminal || o.phase === "game_over") {
        stopReason = `terminal at floor ${floor} (${o.phase})`;
        break;
      }
      if (floor > Number(values["to-floor"])) {
        stopReason = `past --to-floor at ${floor}`;
        break;
      }
      if (!bossChecked.has(o.act) && o.act_boss) {
        bossChecked.add(o.act);
        const want = mapBoss.get(o.act);
        const have = `${o.act_boss.replace(/^ENCOUNTER\./, "")}|${(o.act_second_boss ?? "").replace(/^ENCOUNTER\./, "")}`;
        if (want && want.split("|")[0] === have.split("|")[0]) checks["bossOk"]!++;
        else {
          checks["bossBad"]!++;
          note(floor, o.phase, `act ${o.act} boss: game ${have}, replay ${want}`);
        }
      }
      // The relics as the floor begins, against the replay's (a chest's choice, an event's relic).
      if (!relicsChecked.has(floor)) {
        relicsChecked.add(floor);
        const want = relicsBefore.get(floor);
        if (want) {
          const have = [...o.relics].sort().join(",");
          const need = [...want].map((r) => r.replace(/^ANCIENTAFFECTION-(?:[A-Z]+_)?/, "")).sort().join(",");
          if (have === need) checks["relicsOk"] = (checks["relicsOk"] ?? 0) + 1;
          else {
            checks["relicsBad"] = (checks["relicsBad"] ?? 0) + 1;
            note(floor, o.phase, `relics: game ${have}; replay ${need}`);
          }
        }
      }
      if (process.env["DRIVE_DEBUG"] === "1" && o.phase !== "combat") console.log(`    . f${floor} ${o.phase} gold ${o.gold} | ${ids.join(" ")}${o.room?.options?.length ? ` | ${o.room.options.join(" ")}` : ""}`);
      let action: string | undefined;
      switch (o.phase) {
        case "map": {
          const room = roomOf(floor + 1);
          if (!room) {
            stopReason = `no room for floor ${floor + 1} in the replay`;
            break;
          }
          const [col, row0] = String(room["coord"]).split(",").map(Number);
          action = legal.find((a) => a.metadata?.["col"] === col && a.metadata?.["row"] === row0)?.action_id;
          if (!action) note(floor, "map", `node ${room["coord"]} not offered: ${legal.map((a) => `${a.metadata?.["col"]},${a.metadata?.["row"]}`).join(" ")}`);
          break;
        }
        case "combat": {
          const combat = o.combat!;
          if (combatFloor !== floor) {
            combatFloor = floor;
            const b = blocks.get(floor) ?? [];
            const start = b.findIndex((e) => e.t === "combat_start");
            const end = b.findIndex((e, i) => i > start && e.t === "combat_end");
            combatEvents = start >= 0 ? b.slice(start, end >= 0 ? end + 1 : b.length) : [];
            const cs = combatEvents[0];
            const enemies = (cs?.["enemies"] ?? []) as { i: number; id: string; hp: number }[];
            const game = combat.enemies.map((e) => `${e.model_id}:${e.hp}`).join(",");
            const rep = enemies.map((e) => `${e.id}:${e.hp}`).join(",");
            if (game === rep) checks["enemiesOk"]!++;
            else {
              checks["enemiesBad"]!++;
              note(floor, "combat", `enemies: game ${game}, replay ${rep}`);
            }
            targets = solveTargets(combatEvents, enemies);
            if (!targets && new Set(enemies.map((e) => e.id)).size < enemies.length) note(floor, "combat", "targets: no consistent assignment, lowest HP of the kind instead");
            lastTurnSeen = 0;
            diverged = false;
            hpAtStart = o.player_hp;
            const end0 = combatEvents.find((e) => e.t === "combat_end");
            fightsOut.push({ floor, encounter: cs?.["encounter"] ?? "?", save: `f${floor}.save`, hpStart: o.player_hp, humanHpLost: end0?.["hp_lost_total"] ?? null, humanTurns: end0?.["turns"] ?? 0 });
            if (cs && cursor.get(floor) === undefined) consume(floor, cs);
          }
          // A new turn of ours: the observation, the planner's line from it, the human's plays to come.
          if (combat.turn !== lastTurnSeen) {
            lastTurnSeen = combat.turn;
            const b = blocks.get(floor) ?? [];
            const from = cursor.get(floor) ?? 0;
            const human: string[] = [];
            const drawn: string[] = [];
            let seenTurn = false;
            for (let i = from; i < b.length; i++) {
              const e = b[i]!;
              if (e.t === "turn" && e["side"] === "player") {
                if (seenTurn) break;
                seenTurn = true;
              }
              if (e.t === "draw" && !seenTurn) drawn.push(e["id"] as string);
              if (e.t === "play" && !e["auto"] && (e["play_index"] ?? 0) === 0) human.push(`${e["id"]}${e["up"] ? "+" : ""}${e["target"] ? `>${e["target"]}` : ""}`);
              if (e.t === "potion_used" && e["id"] !== "FAIRY_IN_A_BOTTLE") human.push(`potion:${e["id"]}`);
              if (e.t === "end_turn" && e["side"] === "player") break;
              if (e.t === "combat_end") break;
            }
            // The turn's draws are in the hand (the game's shuffle is the replay's).
            const hand = combat.hand.map((c) => c.card_id);
            const left = [...hand];
            let ok = true;
            for (const d of drawn) {
              const j = left.indexOf(d);
              if (j < 0) ok = false;
              else left.splice(j, 1);
            }
            if (drawn.length > 0) {
              if (ok) checks["drawOk"]!++;
              else {
                checks["drawBad"]!++;
                note(floor, "combat", `turn ${combat.turn} draws ${drawn.join(",")} not all in hand ${hand.join(",")}`);
              }
            }
            let planner: string[] = [];
            let score = 0;
            try {
              const s = fromObservation(o);
              const plan = planTurn(s, TURN_WEIGHTS, 20_000);
              score = plan.score;
              planner = labelLine(s, plan.actions);
            } catch (err) {
              planner = [`error: ${(err as Error).message}`];
            }
            row = {
              floor, encounter: combatEvents[0]?.["encounter"] ?? "?", turn: combat.turn, hp: o.player_hp, energy: o.player_energy,
              hand: combat.hand.map((c) => c.card_id + (c.upgrades > 0 ? "+" : "")),
              enemies: combat.enemies.filter((e) => e.is_alive).map((e) => ({ id: e.model_id, hp: e.hp, block: e.block, intents: e.intents.map((i) => `${i.type}${i.damage ? `${i.damage}x${i.hits}` : ""}`).join("+") })),
              human, planner, plannerScore: score,
            };
            fs.appendFileSync(turnsFile, `${JSON.stringify({ ...row, obs: o })}\n`);
            if (forkTurn !== undefined && combat.turn === forkTurn && forkHp === undefined) {
              forkHp = o.player_hp;
              forkMeta = { floor, hp: o.player_hp, line: [...human], encounter: row.encounter };
              forkDrawBad = checks["drawBad"]!;
            }
          }
          if (forkTurn !== undefined && (combat.turn > forkTurn || (combat.turn === forkTurn && values.branch === "bot"))) {
            // The fork: the bot plays the fight out from here.
            const rf = (await import("./run-fights.ts")) as unknown as ForkRunner;
            rf.configure(values.flags!.split(",").filter(Boolean), "rules2", ascension);
            const { log: fl } = await rf.fight(game, cur, "planner", seed, []);
            writeFork({
              handedAt: combat.turn, hpHanded: fl.hpStart, hpLost: (forkHp ?? fl.hpStart) - fl.hpStart + fl.hpLost, won: fl.won, turns: fl.turns,
              exact: !diverged && forkDrawBad === 0 && forkHp !== undefined,
            });
            stopReason = "fork done";
            break;
          }
          // Parted from the replay: the planner plays the rest of this fight.
          const byPlanner = (): string => {
            try {
              const plan = planTurn(fromObservation(o), TURN_WEIGHTS, 20_000);
              const id = actionId(plan.actions[0] ?? { kind: "end" });
              if (ids.includes(id)) return id;
            } catch {}
            return ids.includes("end_turn") ? "end_turn" : ids[0]!;
          };
          if (diverged) {
            action = byPlanner();
            break;
          }
          // The human's next action this turn.
          // (Fairy in a Bottle's "potion_used" is the game saving the human from a killing blow, not a drink.)
          const e = next(floor, (x) => (x.t === "play" && !x["auto"] && (x["play_index"] ?? 0) === 0) || (x.t === "potion_used" && x["id"] !== "FAIRY_IN_A_BOTTLE") || (x.t === "end_turn" && x["side"] === "player") || x.t === "combat_end");
          if (e && e.t === "combat_end" && endedAt !== floor) {
            // The fight ended in the turn's end, with no end_turn logged: Stampede's plays (auto) or the
            // player's hits after the human's last action. The human ended the turn; if the game's fight
            // still goes on after it, the two have parted.
            const b = blocks.get(floor) ?? [];
            const tail = b.slice(cursor.get(floor) ?? 0, b.indexOf(e));
            if (tail.some((x) => (x.t === "play" && x["auto"]) || (x.t === "hit" && x["src"] === "player"))) {
              endedAt = floor;
              action = "end_turn";
              fs.appendFileSync(path.join(outDir, "turn-ends.jsonl"), `${JSON.stringify({ floor, turn: combat.turn, obs: o })}
`);
              break;
            }
          }
          if (!e || e.t === "combat_end") {
            // The replay's fight is over and the game's is not.
            note(floor, "combat", `replay's fight ended but the game's goes on (turn ${combat.turn}): the planner finishes it`);
            diverged = true;
            if (e) consume(floor, e);
            action = byPlanner();
            break;
          }
          consume(floor, e);
          if (e.t === "end_turn") {
            action = "end_turn";
            // The human's end of turn, as the game has it: for scoring their line against the planner's.
            fs.appendFileSync(path.join(outDir, "turn-ends.jsonl"), `${JSON.stringify({ floor, turn: combat.turn, obs: o })}\n`);
            break;
          }
          if (e.t === "potion_used") {
            const slot = (o.potion_details ?? []).find((p) => p.id === e["id"])?.slot;
            const after = next(floor, (x) => (x.t === "hit" && x["src"] === "player") || (x.t === "power" && x["src"] === "player" && x["tgt"] !== "IRONCLAD"), (x) => x.t === "play" || x.t === "end_turn");
            const tgtModel = after ? (after["dst"] ?? after["tgt"]) as string : undefined;
            const tgt = tgtModel ? combat.enemies.filter((x) => x.is_alive && x.model_id === tgtModel).sort((a, b) => a.hp - b.hp)[0]?.combat_id : undefined;
            action = slot === undefined ? undefined
              : ids.find((a) => tgt !== undefined && a === `use_potion:${slot}:target:${tgt}`) ?? ids.find((a) => a === `use_potion:${slot}`) ?? ids.find((a) => a.startsWith(`use_potion:${slot}:`));
            if (!action) {
              note(floor, "combat", `potion ${e["id"]} (slot ${slot}) not usable: ${ids.filter((a) => a.startsWith("use_potion")).join(" ")}: the planner finishes the fight`);
              diverged = true;
              action = byPlanner();
            }
            break;
          }
          // A card.
          const model = e["target"] as string | undefined;
          let target: number | undefined;
          if (model) {
            const alive = combat.enemies.filter((x) => x.is_alive && x.model_id === model);
            // The play's own hits in the replay (up to the next action): what they did to their target.
            const b = blocks.get(floor) ?? [];
            let dmg = 0;
            let blocked = 0;
            let killed = false;
            for (let i = b.indexOf(e) + 1; i < b.length; i++) {
              const x = b[i]!;
              if ((x.t === "play" && (x["play_index"] ?? 0) === 0) || x.t === "potion_used" || x.t === "end_turn" || x.t === "combat_end") break;
              if (x.t === "hit" && x["src"] === "player" && x["dst"] === model) {
                dmg += Number(x["dmg"] ?? 0);
                blocked += Number(x["blocked"] ?? 0);
                killed = killed || Boolean(x["killed"]);
              }
            }
            // The one the game's HP and block say took them: a kill takes exactly what it had left.
            const fits = alive.filter((x) => (killed ? x.hp === dmg : x.hp > dmg) && (blocked === 0 || x.block >= blocked));
            const inst = targets?.get(e.s);
            const cs = (combatEvents[0]?.["enemies"] ?? []) as { i: number; id: string }[];
            const byIndex = inst !== undefined ? combat.enemies[cs.findIndex((x) => x.i === inst)] : undefined;
            const solved = byIndex && byIndex.is_alive && byIndex.model_id === model ? byIndex : undefined;
            // Not told by its own hits: what the rest of the fight's hits and kills allow, from the HP now.
            let live: typeof alive[number] | undefined;
            if (fits.length !== 1 && alive.length > 1) {
              const from = combatEvents.indexOf(e);
              const id = from >= 0 ? solveLive(combatEvents, from, combat.enemies.filter((x) => x.is_alive).map((x) => ({ id: x.combat_id, model: x.model_id, hp: x.hp }))) : undefined;
              live = alive.find((x) => x.combat_id === id);
            }
            const pick = fits.length === 1 ? fits[0] : live ?? (solved && (fits.length === 0 || fits.includes(solved)) ? solved : fits[0] ?? alive.sort((a2, b2) => a2.hp - b2.hp)[0]);
            if (alive.length > 1 && fits.length !== 1) note(floor, "combat", `target ${model}: ${fits.length} of ${alive.length} fit the replay's hits (${dmg}${killed ? " killed" : ""}); took E${pick?.combat_id}`);
            target = pick?.combat_id;
          }
          action = playAction(o, legal, e["id"], Number(e["up"] ?? 0), target, enchantAt(e["deck_c"], floor));
          if (!action) {
            note(floor, "combat", `play ${e["id"]}${e["up"] ? "+" : ""} not legal (hand ${combat.hand.map((c) => c.card_id).join(",")}; ${o.player_energy} energy): the planner finishes the fight`);
            diverged = true;
            action = byPlanner();
          }
          break;
        }
        case "card_select": {
          // In a fight (Headbutt, True Grit+, Burning Pact...) or out of one (a Neow removal): the replay's pick.
          // In a fight, Armaments' choice shows only as its "upgrade" (no decision_id, no pick).
          // (A fight's first select can come before its first combat screen: Toasty Mittens' exhaust as turn 1 starts.)
          const b0 = blocks.get(floor) ?? [];
          const inFight = combatFloor === floor
            || (["combat", "elite", "boss"].includes(String(roomOf(floor)?.["kind"])) && b0.some((x) => x.t === "combat_start") && !b0.slice(0, cursor.get(floor) ?? 0).some((x) => x.t === "combat_end"));
          // In a fight, Armaments' choice shows only as its "upgrade", Brand's (True Grit+, Burning Pact) as its "exhaust".
          const e = next(floor, (x) => x.t === "pick" || x.t === "discard" || x.t === "remove" || x.t === "transform" || x.t === "enchant" || (x.t === "upgrade" && (inFight || x["decision_id"] !== undefined)) || (inFight && x.t === "exhaust") || (x.t === "acquire" && x["source"] === "event"), inFight ? (x) => x.t === "end_turn" || x.t === "combat_end" || (x.t === "play" && (x["play_index"] ?? 0) === 0) : undefined);
          // A rest site's smith comes as a card select, its "upgrade" logged before the "rest" the cursor passed.
          const smith = !e && !inFight ? (blocks.get(floor) ?? []).find((x) => x.t === "upgrade" && !x["_used"] && x["decision_id"] === undefined) : undefined;
          if (smith) smith["_used"] = true;
          // Everything the replay took in this selection: the bridge answers a selection with one action,
          // and fills a short one from the front (Neow's two removals became two Strikes), so a
          // multi-select goes as one choose_cards. Its cards are its pick's, or its own removes/transforms/...
          const same = e && e["decision_id"] !== undefined && e.t !== "acquire"
            ? (blocks.get(floor) ?? []).filter((x, i) => i >= (cursor.get(floor) ?? 0) && x["decision_id"] === e["decision_id"] && ["pick", "remove", "transform", "enchant", "upgrade", "discard"].includes(x.t))
            : e ? [e] : [];
          const taken: { id: string; at?: number | undefined; c?: number | undefined }[] = [];
          for (const x of same) {
            const cards = x.t === "pick" ? (x["cards"] as { id: string; option_index?: number; c?: number }[]).map((c) => ({ id: c.id, at: c.option_index, c: c.c })) : [{ id: String(x["id"] ?? x["from_id"]), at: x["option_index"] as number | undefined, c: x["c"] as number | undefined }];
            for (const c of cards) if (!taken.some((t) => (t.at !== undefined && t.at === c.at) || (t.c !== undefined && t.c === c.c))) taken.push(c);
          }
          if (!e && smith) taken.push({ id: String(smith["id"]) });
          if (!e && inFight) {
            // Headbutt's pick is not in the replay, but it goes on top of the draw pile: the next card drawn
            // (played by the human, or by Distilled Chaos, this turn).
            const b = blocks.get(floor) ?? [];
            const at = cursor.get(floor) ?? 0;
            let from = at;
            while (from > 0 && !(b[from - 1]!.t === "turn" && b[from - 1]!["side"] === "player")) from--;
            const drawAt = b.findIndex((x, i) => i >= at && x.t === "draw");
            if (drawAt >= 0 && b.slice(from, drawAt).some((x) => x.t === "play" && x["id"] === "HEADBUTT")) taken.push({ id: String(b[drawAt]!["id"]) });
            // A choice of generated cards (Attack Potion's three) shows only as the card it adds, logged
            // just before the potion (or after the card) that offered it.
            if (!taken.length) {
              const near = [at - 1, at - 2, at, at + 1].map((i) => b[i]).find((x) => x?.t === "generate" && legal.some((a) => a.action_id.startsWith("choose_card_select:") && a.metadata?.["card_id"] === x["id"]));
              if (near) taken.push({ id: String(near["id"]) });
            }
            // Touch of Insanity's card costs 0 for the fight: the first card played after it at 0 that costs more.
            if (!taken.length && b[at - 1]?.t === "potion_used" && b[at - 1]!["id"] === "TOUCH_OF_INSANITY") {
              const offered = new Set(legal.filter((a) => a.action_id.startsWith("choose_card_select:")).map((a) => String(a.metadata?.["card_id"])));
              const free = b.slice(at).find((x) => x.t === "play" && x["cost_paid"] === 0 && offered.has(String(x["id"])) && ((CATALOG[String(x["id"])] as { cost?: number } | undefined)?.cost ?? 0) > 0);
              if (free) taken.push({ id: String(free["id"]) });
            }
          }
          if (!e && !inFight && !taken.length) {
            // An old replay's event transform or enchant, unlogged: read off the fights after it.
            const purpose = String((o.room?.details as Record<string, unknown> | undefined)?.["purpose"] ?? "");
            const selectable = legal.filter((a) => a.action_id.startsWith("choose_card_select:"));
            const offeredIds = [...new Set(selectable.map((a) => String(a.metadata?.["card_id"])))];
            const c = purpose === "FromDeckForTransformation" ? inferTransformed(floor, offeredIds) : purpose === "FromDeckForEnchantment" ? inferEnchanted(floor, offeredIds) : undefined;
            if (c !== undefined) {
              const id = deckCards.get(c)!.id;
              // Which copy: its place among the copies held (the game lists the deck in order).
              const copies = selectable.filter((a) => a.metadata?.["card_id"] === id);
              const pick = copies[Math.max(0, Math.min(heldAt(floor, [id]).indexOf(c), copies.length - 1))];
              taken.push({ id, at: pick ? Number(pick.metadata?.["card_index"]) : undefined });
              if (purpose === "FromDeckForEnchantment") enchantOf.set(c, { floor, id: "*" });
              note(floor, "card_select", `inferred the ${purpose.replace("FromDeckFor", "").toLowerCase()} of ${id} (card ${c}) from the replay's later fights`);
            }
          }
          const want = taken.map((t) => t.id);
          const list = legal.filter((a) => a.action_id.startsWith("choose_card_select:")).map((a) => ({ i: Number(a.metadata?.["card_index"] ?? a.action_id.split(":")[1]), id: String(a.metadata?.["card_id"]), a: a.action_id }));
          const chosen: typeof list = [];
          for (const t of taken) {
            // The very copy (its option index, when the game lists the same card there), else the first free one.
            const hit = list.find((x) => x.i === t.at && x.id === t.id && !chosen.includes(x)) ?? list.find((x) => x.id === t.id && !chosen.includes(x));
            if (hit) chosen.push(hit);
          }
          action = chosen.length > 1 ? `choose_cards:${chosen.map((x) => x.i).join(",")}` : chosen[0]?.a;
          if (chosen.length && chosen.length < taken.length) note(floor, "card_select", `took ${chosen.length} of the replay's ${taken.length} (${want.join(",")})`);
          for (const x of same) consume(floor, x);
          if (!action) {
            // (What asked for it: the replay's last play or potion before the cursor, to write the next inference.)
            const bb = blocks.get(floor) ?? [];
            const lastAct = bb.slice(0, cursor.get(floor) ?? 0).reverse().find((x) => x.t === "play" || x.t === "potion_used" || x.t === "relic" || x.t === "outcome");
            const asker = lastAct ? `${lastAct.t} ${String(lastAct["id"] ?? lastAct["option_id"] ?? "")}` : "?";
            note(floor, "card_select", `wanted ${want.join(",") || "(nothing in the replay)"}; offered ${legal.map((a) => a.metadata?.["card_id"] ?? a.action_id).join(",")} (${String((o.room?.details as Record<string, unknown> | undefined)?.["purpose"] ?? "?")}, after ${asker})`);
            action = ids.includes("proceed") ? "proceed" : ids[0];
          }
          break;
        }
        case "deck_card_select":
        case "simple_card_select": {
          const e = next(floor, (x) => x.t === "pick" || x.t === "remove" || x.t === "transform" || x.t === "enchant" || x.t === "upgrade" || (x.t === "acquire" && x["source"] === "event"));
          const want = e ? (e.t === "pick" ? (e["cards"] as { id: string }[]).map((c) => c.id) : [e["id"] ?? e["from_id"]]) : [];
          // The very copy the replay took (its option index, when the game lists the same card there): an
          // enchanted or upgraded copy is drawn where that one was.
          const at = e ? (e["option_index"] ?? (e.t === "pick" ? (e["cards"] as { option_index?: number }[])[0]?.option_index : undefined)) : undefined;
          action = (at !== undefined ? legal.find((a) => a.action_id === `choose_card_select:${at}:${want[0]}`)?.action_id : undefined)
            ?? legal.find((a) => a.action_id.startsWith("choose_card_select:") && want.includes(String(a.metadata?.["card_id"])))?.action_id;
          if (e) consume(floor, e);
          if (!action) {
            note(floor, o.phase, `wanted ${want.join(",")}; offered ${legal.map((a) => a.metadata?.["card_id"] ?? a.action_id).join(",")}`);
            action = ids[0];
          }
          break;
        }
        case "rewards": {
          // The replay's next reward taken on this floor, before the next room. A card given back or
          // granted (the Thieving Hopper's stolen card: "acquire ... granted", then its SpecialCard
          // reward) is the resolve that follows it.
          let e = next(floor, (x) => x.t === "resolve" || x.t === "acquire" || x.t === "potion_dropped");
          // (A potion the belt does not hold was given up to an event, The Future of Potions's trade: not ours to throw.)
          const onBelt = (x: Ev) => (o.potion_details ?? []).some((p) => p.id === x["id"]);
          while (e && ((e.t === "acquire" && e["source"] !== "reward") || (e.t === "potion_dropped" && !onBelt(e)))) {
            consume(floor, e);
            e = next(floor, (x) => x.t === "resolve" || x.t === "acquire" || x.t === "potion_dropped");
          }
          // A potion thrown away to make room (the bridge's discard_potion, the replay mod's build).
          if (e && e.t === "potion_dropped") {
            consume(floor, e);
            const slot = (o.potion_details ?? []).find((p) => p.id === e!["id"])?.slot;
            action = slot !== undefined && ids.includes(`discard_potion:${slot}`) ? `discard_potion:${slot}` : undefined;
            if (!action) {
              note(floor, "rewards", `potion ${e["id"]} to throw away: not on the belt or no discard (${ids.join(" ")})`);
              action = ids.includes("proceed") ? "proceed" : ids[0];
            }
            break;
          }
          if (!e) {
            // A card reward the replay shows an offer for and the driver has not opened (an Orrery's, bought
            // after its picks were logged): open it, the card reward takes its pick or skips it.
            const open = ids.find((a) => /^choose_reward:\d+:Card$/.test(a));
            const unseen = (blocks.get(floor) ?? []).some((x) => x.t === "decision" && x["decision_type"] === "card_reward" && !x["_used"]);
            action = open && unseen ? open : ids.includes("proceed") ? "proceed" : ids[0];
            break;
          }
          if (e.t === "acquire" || e["reward_kind"] === "CardReward") {
            action = ids.find((a) => /^choose_reward:\d+:Card$/.test(a));
            if (!action) {
              // No card reward on the screen: the replay's is taken already (a resolve after its acquire).
              consume(floor, e);
              action = ids.includes("proceed") ? "proceed" : ids[0];
            }
            break;
          }
          consume(floor, e);
          const kind = String(e["reward_kind"]).replace(/Reward$/, "").replace(/RewardChoice$/, "");
          action = ids.find((a) => a.endsWith(`:${kind}`) && a.startsWith("choose_reward:"));
          if (!action) note(floor, "rewards", `${kind} not on the screen: ${ids.join(" ")}`);
          break;
        }
        case "card_reward": {
          // The replay's offer is the one of these very cards: several can be up at once (Colorful
          // Philosophers' three, an Orrery's five) and the replay files their picks under other decision
          // ids. Else the pick's decision, else the floor's next one.
          const b = blocks.get(floor) ?? [];
          const offeredIds = o.room?.options ?? [];
          const offered = offeredIds.join(",");
          const optsOf = (x: Ev) => ((x["options"] as { option_id: string }[] | undefined) ?? []).map((y) => y.option_id).join(",");
          const isOffer = (x: Ev) => x.t === "decision" && x["decision_type"] === "card_reward" && !x["_used"];
          const pickEv = next(floor, (x) => x.t === "acquire" && x["source"] !== "shop");
          const dec = b.find((x) => isOffer(x) && optsOf(x) === offered)
            ?? (pickEv ? b.find((x) => isOffer(x) && x["decision_id"] === pickEv["decision_id"]) : undefined)
            ?? next(floor, isOffer);
          // (An offer the replay never showed still uses up one of the floor's, or the rewards reopen it for ever.)
          const spent = dec ?? b.find(isOffer);
          if (spent) spent["_used"] = true;
          if (dec) {
            const want = optsOf(dec);
            if (want === offered) checks["rewardOk"]!++;
            else {
              checks["rewardBad"]!++;
              note(floor, "card_reward", `offered ${offered}, replay ${want}`);
            }
            consume(floor, dec);
          }
          // Its pick: an acquire of one of these cards not taken yet (a shop's own purchase, with its buy, is not one).
          const bought = (x: Ev) => { const i = b.indexOf(x); return b.slice(i + 1, i + 3).some((y) => y.t === "buy" && y["id"] === x["id"]); };
          const firstOffer = b.findIndex((x) => x.t === "decision" && x["decision_type"] === "card_reward");
          const picks = b.filter((x, i) => i > firstOffer && x.t === "acquire" && !x["_used"] && offeredIds.includes(String(x["id"])) && x["source"] !== "granted" && !bought(x));
          const acq = picks.find((x) => dec && x["decision_id"] === dec["decision_id"]) ?? picks[0];
          if (acq) {
            acq["_used"] = true;
            consume(floor, acq);
            action = ids.find((a) => a.startsWith(`choose_card:`) && a.endsWith(`:${acq["id"]}`));
            // The resolve that follows it belongs to this pick.
            const r = next(floor, (x) => x.t === "resolve" && x["reward_kind"] === "CardReward", (x) => x.t === "decision");
            if (r) consume(floor, r);
          } else {
            const r = next(floor, (x) => x.t === "resolve" && x["reward_kind"] === "CardReward", (x) => x.t === "room" || x.t === "decision");
            if (r) consume(floor, r);
            action = "skip_card";
          }
          break;
        }
        case "event": {
          const dec = next(floor, (x) => x.t === "outcome" && x["decision_type"] === "event");
          if (!dec) {
            // The event's own way out (the bridge's "proceed" clicks option 0, which after an event's fight
            // can be anything: Lantern Key's clicked 40 times and the game fell over).
            const evOpts = ((o.room?.details as { options?: { index: number; text_key?: string; proceed?: boolean; locked?: boolean }[] } | undefined)?.options ?? []).filter((x) => !x.locked);
            const way = evOpts.find((x) => x.proceed);
            // No way out marked: try each option in turn (a click that changes nothing is tried again otherwise).
            const turnOf = evOpts.length ? evOpts[(stuck ?? 0) % evOpts.length] : undefined;
            action = way ? `choose_event:${way.index}` : turnOf ? `choose_event:${turnOf.index}` : ids.includes("proceed") ? "proceed" : ids[0];
            note(floor, "event", `no outcome left in the replay: ${action} (options ${evOpts.map((x) => `${x.index}:${x.text_key ?? "?"}${x.proceed ? "*" : ""}`).join(" ") || "none"})`);
            stuck = (stuck ?? 0) + 1;
            if (stuck > 6) stopReason = `stuck in floor ${floor}'s event`;
            break;
          }
          consume(floor, dec);
          stuck = 0;
          const want = String(dec["option_id"]);
          const opts = ((o.room?.details as { options?: { index: number; text_key?: string; proceed?: boolean }[] } | undefined)?.options ?? []);
          let hit = want === "PROCEED" ? opts.find((x) => x.proceed) : opts.find((x) => x.text_key === want);
          // One option per potion under the same key (The Future of Potions): the one whose potion the
          // replay then shows gone, by its place among the potions held.
          const same = opts.filter((x) => x.text_key === want);
          if (same.length > 1) {
            // The Future of Potions: each potion's option names the card type it trades for, and the card
            // reward that follows shows which the human took (its cards' type, in the option's words).
            const reward = next(floor, (x) => x.t === "decision" && x["decision_type"] === "card_reward", (x) => x.t === "room");
            const types = ((reward?.["options"] ?? []) as { option_id: string }[]).map((x) => catalogType(x.option_id));
            const type = ["Attack", "Skill", "Power"].find((t) => types.filter((x) => x === t).length * 2 > types.length);
            const word = type ? TYPE_WORDS[type] : undefined;
            const byWord = word ? same.filter((x) => (x as { description?: string }).description?.includes(word)) : [];
            if (byWord.length === 1) hit = byWord[0];
            else {
              const gone = next(floor, (x) => x.t === "potion_dropped", (x) => x.t === "decision" || x.t === "room");
              const held = (o.potion_details ?? []).slice().sort((a, b) => a.slot - b.slot).map((p) => p.id);
              const k = gone ? held.indexOf(gone["id"] as string) : -1;
              if (k >= 0 && k < same.length) hit = same[k];
            }
          }
          action = hit !== undefined ? `choose_event:${hit.index}` : want === "PROCEED" && ids.includes("proceed") ? "proceed" : undefined;
          if (!action) {
            note(floor, "event", `option ${want} not offered: ${opts.map((x) => x.text_key).join(" ")}`);
            action = ids.includes("proceed") ? "proceed" : ids[0];
          }
          break;
        }
        case "rest_site": {
          const e = next(floor, (x) => x.t === "rest");
          if (e) consume(floor, e);
          const key = String(e?.["option"] ?? "heal").toUpperCase();
          action = ids.find((a) => a.toUpperCase() === `CHOOSE_REST:${key}`) ?? ids.find((a) => a.toUpperCase().includes(key));
          if (!action) note(floor, "rest_site", `option ${key} not offered: ${ids.join(" ")}`);
          break;
        }
        case "deck_upgrade": {
          // The rest site's smith: the upgrade the replay logged before its rest.
          const b = blocks.get(floor) ?? [];
          const e = b.find((x) => x.t === "upgrade" && !x["_used"]);
          if (e) e["_used"] = true;
          action = e ? ids.find((a) => a.startsWith("choose_upgrade:") && a.endsWith(`:${e["id"]}`)) : undefined;
          if (!action) {
            note(floor, "deck_upgrade", `wanted ${e?.["id"]}; offered ${ids.join(" ")}`);
            action = ids[0];
          }
          break;
        }
        case "shop": {
          // A card removal shows as its "remove" before its "buy": buy the service, and the card
          // select that follows takes the remove; its buy is then passed over.
          const pick = () => next(floor, (x) => x.t === "buy" || x.t === "remove");
          let e = pick();
          while (e && e.t === "buy" && e["kind"] === "removal_service") {
            consume(floor, e);
            e = pick();
          }
          if (!e) {
            action = "shop_leave";
            break;
          }
          if (e.t === "remove") {
            action = legal.find((a) => a.action_id.startsWith("shop_buy:") && /Removal/i.test(String(a.metadata?.["entry_type"])))?.action_id;
            if (!action) note(floor, "shop", `card removal (${e["id"]}) not offered: ${ids.join(" ")}`);
            break;
          }
          consume(floor, e);
          const kind = String(e["kind"]);
          const item = e["id"] as string | undefined;
          action = legal.find((a) => a.action_id.startsWith("shop_buy:") && (item ? a.metadata?.["item_id"] === item : /Removal/i.test(String(a.metadata?.["entry_type"]))))?.action_id;
          if (!action && /remov/i.test(kind)) action = legal.find((a) => /Removal/i.test(String(a.metadata?.["entry_type"])))?.action_id;
          if (!action) note(floor, "shop", `buy ${kind} ${item} not offered: ${legal.map((a) => a.metadata?.["item_id"] ?? a.action_id).join(",")}`);
          break;
        }
        case "treasure":
          action = ids.includes("proceed") ? "proceed" : ids[0];
          break;
        default:
          action = ids.includes("proceed") ? "proceed" : ids[0];
      }
      if (stopReason) break;
      if (!action) {
        stopReason = `no action for floor ${floor} ${o.phase}`;
        break;
      }
      // The same screen answered the same way again and again: a loop no handler notices (stop and say where).
      const same = `${o.phase}|${floor}|${o.player_hp}|${o.gold}|${ids.join(",")}|${action}`;
      repeats = same === lastKey ? repeats + 1 : 0;
      lastKey = same;
      if (repeats >= 30) {
        stopReason = `stalled: ${o.phase} at floor ${floor}, ${action} 30 times (legal ${ids.join(" ")})`;
        break;
      }
      const wasMap = o.phase === "map";
      cur = await game.step(action);
      // The save the map's choice writes: resumed, the room starts again from here.
      if (wasMap) {
        const nf = cur.observation.floor;
        const from = path.join(savesDir(sandbox), "current_run.save");
        if (fs.existsSync(from) && (blocks.get(nf) ?? []).some((x) => x.t === "combat_start")) fs.copyFileSync(from, path.join(outDir, `f${nf}.save`));
      }
      // A fight over: what the game's HP says it cost, against the replay's.
      // A card select inside a fight (Armaments, Headbutt, True Grit+) is still the fight.
      if (combatFloor === floor && (o.phase === "combat" || o.phase === "card_select") && cur.observation.phase !== "combat" && cur.observation.phase !== "card_select") {
        const f = fightsOut[fightsOut.length - 1];
        if (f) {
          f.gameHpLost = hpAtStart - cur.observation.player_hp;
          f.result = cur.observation.phase;
          (f as Record<string, unknown>)["diverged"] = diverged;
          const endEv = combatEvents.find((x) => x.t === "combat_end");
          const human = endEv?.["hp_lost_total"];
          // hp_lost_total is before the win's heals (Burning Blood): the replay's own HP after the
          // fight is the check that the game played it as the human did.
          const b = blocks.get(floor) ?? [];
          let hpAfter: number | undefined;
          for (let i = endEv ? b.indexOf(endEv) + 1 : b.length; i < b.length; i++) {
            const x = b[i]!;
            if (x.t === "hp") hpAfter = x["hp"] as number;
            else if (x.t === "decision" || x.t === "room" || x.t === "gold" || x.t === "resolve") break;
          }
          const same = hpAfter === cur.observation.player_hp;
          if (same) checks["hpOk"]!++;
          else checks["hpBad"]!++;
          (f as Record<string, unknown>)["replayHpAfter"] = hpAfter;
          (f as Record<string, unknown>)["gameHpAfter"] = cur.observation.player_hp;
          console.log(`  floor ${floor} ${f.encounter}: the human's plays in the game: HP ${hpAtStart} -> ${cur.observation.player_hp}; the replay: -> ${hpAfter} (lost ${human})${same ? "" : "  MISMATCH"}`);
          if (forkTurn !== undefined && forkHp !== undefined) {
            // The human's forked turn ended the fight: its cost is what the game's HP says, before the win's heals.
            const rf = (await import("./run-fights.ts")) as unknown as ForkRunner;
            const won = cur.observation.phase !== "game_over";
            const before = won ? rf.hpBeforeWinHeals(o, cur.observation, cur.observation.player_hp) : 0;
            writeFork({ handedAt: null, hpHanded: null, hpLost: forkHp - before, won, turns: forkTurn, exact: !diverged && forkDrawBad === 0 });
            stopReason = "fork done (the fight ended in the forked turn)";
          }
        }
        combatFloor = -1;
      }
      void row;
    }
    if (!stopReason) stopReason = "step limit";
  } catch (err) {
    stopReason = `error: ${(err as Error).message}`;
  } finally {
    await game.kill();
  }
  fs.writeFileSync(path.join(outDir, "drive.json"), JSON.stringify({ seed, replay: path.basename(values.replay!), stopReason, checks, fights: fightsOut, log }, null, 1));
  console.log(`stopped: ${stopReason}`);
  console.log(JSON.stringify(checks));
}

await main();
