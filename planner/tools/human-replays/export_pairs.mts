// Labelled pairs from the human replays (for a learned leaf value, review 6's item 2): at each of the
// human's turns, from the same full observation, the human's end of turn (the game's observation of it)
// and the planner's best end (planTurn's line in the simulator), both scored one turn (evaluate) and a
// turn on (the fixed look ahead: 16 next hands shared by both, leaves in HP), with the fight's outcome.
// Writes <replay dir>/pairs.jsonl for every replay dir given (default: all runs/replay-*).
//   node export_pairs.mts [dir ...]
import fs from "node:fs";
import path from "node:path";
import { setIntentAscension } from "file:///D:/CODE/spire-jev-playlab/planner/src/intents.ts";
import { evaluate, expectedIntents, explore, leafValue, TURN_WEIGHTS } from "file:///D:/CODE/spire-jev-playlab/planner/src/search.ts";
import { type Action, drink, fromObservation, play, type State, stateKey } from "file:///D:/CODE/spire-jev-playlab/planner/src/sim.ts";
import { nextTurn, seeded } from "file:///D:/CODE/spire-jev-playlab/planner/src/turn.ts";
import type { Observation } from "file:///D:/CODE/spire-jev-playlab/planner/src/obs.ts";

setIntentAscension(10);
const ROOT = "D:/CODE/spire-jev-playlab/planner/runs";
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(ROOT).filter((d) => /^replay/.test(d)).map((d) => path.join(ROOT, d));
const W = TURN_WEIGHTS;
const fnv = (t: string) => {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  return h >>> 0;
};
const aliveHp = (s: State) => s.enemies.reduce((a, e) => a + (e.alive ? e.hp : 0), 0);
function lookValue(end: State, base: number, n = 16): number {
  const v0 = evaluate(end, W);
  if (v0 >= 0.9e6 || v0 <= -0.9e6) return leafValue(v0, end);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const next = nextTurn(end, seeded((base + i * 7919) >>> 0), expectedIntents);
    if (!next) {
      sum += -2 * end.player.maxHp - 0.35 * aliveHp(end);
      continue;
    }
    const t = explore(next, W, 1500, 0);
    sum += leafValue(t.best.score, t.best.state);
  }
  return sum / n;
}
function labelLine(start: State, line: readonly Action[]): string[] {
  let s = start;
  const out: string[] = [];
  for (const a of line) {
    if (a.kind === "end") break;
    if (a.kind === "potion") {
      out.push(`potion:${s.potions.find((p) => p.slot === a.slot)?.id ?? a.slot}`);
      try { s = drink(s, a); } catch { break; }
      continue;
    }
    const c = s.hand[a.hand];
    const t = a.target !== undefined ? s.enemies.find((e) => e.id === a.target)?.model : undefined;
    out.push(`${c?.id ?? "?"}${(c?.upgrades ?? 0) > 0 ? "+" : ""}${t ? `>${t}` : ""}`);
    try { s = play(s, a); } catch { break; }
  }
  return out;
}
const round = (x: number) => Math.round(x * 10) / 10;
let total = 0;
for (const dir of dirs) {
  const read = (f: string) => fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l)) : [];
  const starts = read("turns.jsonl") as { floor: number; encounter: string; turn: number; human: string[]; obs: Observation }[];
  const ends = new Map((read("turn-ends.jsonl") as { floor: number; turn: number; obs: Observation }[]).map((e) => [`${e.floor}|${e.turn}`, e.obs]));
  const drive = fs.existsSync(path.join(dir, "drive.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "drive.json"), "utf8")) as { seed: string; fights: { floor: number; humanHpLost: number | null; humanTurns: number; gameHpAfter?: number; replayHpAfter?: number }[]; log?: { floor: number; phase: string; what: string }[] } : undefined;
  // The first turn of each fight whose hand was not the human's (the driver's draw check): from it on, not the human's state.
  const drawBadAt = new Map<number, number>();
  for (const n of drive?.log ?? []) {
    const m = n.phase === "combat" ? /^turn (\d+) draws/.exec(n.what) : null;
    if (m) drawBadAt.set(n.floor, Math.min(drawBadAt.get(n.floor) ?? Infinity, Number(m[1])));
  }
  // A hand not the human's can be a deck not the human's (Neow's two removals as two Strikes): the run is past exact from there.
  const firstDrawBad = Math.min(Infinity, ...drawBadAt.keys());
  const fight = new Map((drive?.fights ?? []).map((f) => [f.floor, f]));
  // Exact: every fight before this one ended at the replay's HP (the state is the human's own).
  const exactUpTo = (() => {
    let last = Infinity;
    for (const f of drive?.fights ?? []) if (f.gameHpAfter === undefined || f.gameHpAfter !== f.replayHpAfter) { last = f.floor; break; }
    return last;
  })();
  const out: string[] = [];
  for (const t of starts) {
    const endObs = ends.get(`${t.floor}|${t.turn}`);
    if (!endObs) continue;
    let s0: State, h: State;
    try {
      s0 = fromObservation(t.obs);
      h = fromObservation(endObs);
    } catch {
      continue;
    }
    const plan = explore(s0, W, 20_000, 0);
    const base = fnv(stateKey(s0));
    const f = fight.get(t.floor);
    out.push(JSON.stringify({
      seed: drive?.seed, floor: t.floor, encounter: t.encounter, turn: t.turn, exact: t.floor < exactUpTo && (t.floor < firstDrawBad || (t.floor === firstDrawBad && t.turn < drawBadAt.get(t.floor)!)),
      fightHumanHpLost: f?.humanHpLost ?? null, fightHumanTurns: f?.humanTurns ?? null,
      human: { line: t.human, one: round(evaluate(h, W)), look: round(lookValue(h, base)), end: endObs },
      planner: { line: labelLine(s0, plan.best.actions), one: round(plan.best.score), look: round(lookValue(plan.best.state, base)), end: plan.best.state },
      start: t.obs,
    }));
  }
  fs.writeFileSync(path.join(dir, "pairs.jsonl"), out.length ? `${out.join("\n")}\n` : "");
  total += out.length;
  console.log(`${path.basename(dir)}: ${out.length} pairs`);
}
console.log(`${total} pairs in ${dirs.length} runs`);
