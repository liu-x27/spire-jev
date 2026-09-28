// Can the look-ahead even see the human's line? It weighs only the one-turn evaluation's best few
// distinct ends of the turn (planTurn2 lookfix: 5; bossroll8's rollouts: its ends). For every exact
// turn where the look-ahead prefers the human's end (look_h > look_q + 1), the rank of the human's end
// among the turn's explored ends by the one-turn score (1 = the planner's own best).
//   node rank_check.mts [pairs_rows.json]
import fs from "node:fs";
import path from "node:path";
import { setIntentAscension } from "file:///D:/CODE/spire-jev-botlab/planner/src/intents.ts";
import { evaluate, explore, TURN_WEIGHTS } from "file:///D:/CODE/spire-jev-botlab/planner/src/search.ts";
import { drink, fromObservation, play, type State } from "file:///D:/CODE/spire-jev-botlab/planner/src/sim.ts";

setIntentAscension(10);
const ROOT = "D:/CODE/spire-jev-playlab/planner/runs";
const rows = JSON.parse(fs.readFileSync(process.argv[2] ?? "pairs_rows.json", "utf8")) as { seed: string; floor: number; turn: number; kind: string; same: boolean; look_h: number; look_q: number; one_h: number; one_q: number; reason?: string }[];
const want = new Map(rows.filter((r) => !r.same && r.look_h > r.look_q + 1).map((r) => [`${r.seed}|${r.floor}|${r.turn}`, r]));
const ranks: { kind: string; reason: string; rank: number }[] = [];
for (const d of fs.readdirSync(ROOT).filter((x) => x.startsWith("replay-"))) {
  const f = path.join(ROOT, d, "pairs.jsonl");
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const p = JSON.parse(line) as { seed: string; floor: number; turn: number; start: unknown; human: { one: number; line: string[] } };
    const r = want.get(`${p.seed}|${p.floor}|${p.turn}`);
    if (!r) continue;
    let start;
    try {
      start = fromObservation(p.start as never);
    } catch {
      continue;
    }
    // The human's line played in the simulator (the same basis as the explored ends): by card id,
    // upgrade and target kind, the first copy and the living target of that kind with the least HP.
    let s: State = start;
    let ok = true;
    for (const lab of p.human.line) {
      try {
        if (lab.startsWith("potion:")) {
          const pot = s.potions.find((x) => x.id === lab.slice(7));
          if (!pot) { ok = false; break; }
          const tgt = s.enemies.filter((e) => e.alive).sort((a, b) => a.hp - b.hp)[0]?.id;
          s = drink(s, { kind: "potion", slot: pot.slot, ...(tgt !== undefined ? { target: tgt } : {}) } as never);
          continue;
        }
        const [card, model] = lab.split(">");
        const up = card!.endsWith("+");
        const id = card!.replace(/\+$/, "");
        const hand = s.hand.findIndex((c) => c.id === id && ((c.upgrades ?? 0) > 0) === up);
        const at = hand >= 0 ? hand : s.hand.findIndex((c) => c.id === id);
        if (at < 0) { ok = false; break; }
        const tgt = model ? s.enemies.filter((e) => e.alive && e.model === model).sort((a, b) => a.hp - b.hp)[0]?.id : undefined;
        s = play(s, { kind: "card", hand: at, ...(tgt !== undefined ? { target: tgt } : {}) } as never);
      } catch {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const humanScore = evaluate(s, TURN_WEIGHTS);
    const { top } = explore(start, TURN_WEIGHTS, 20_000, 300);
    // Ends the one-turn score puts above the human's (by more than rounding).
    const above = top.filter((l) => l.score > humanScore + 0.05).length;
    ranks.push({ kind: r.kind, reason: r.reason ?? "?", rank: above + 1 });
  }
}
const pct = (xs: number[], k: number) => `${((100 * xs.filter((x) => x <= k).length) / Math.max(1, xs.length)).toFixed(0)}%`;
const show = (name: string, xs: number[]) => {
  const sorted = [...xs].sort((a, b) => a - b);
  console.log(`  ${name.padEnd(46)} n=${String(xs.length).padStart(4)}  within top 5: ${pct(xs, 5).padStart(4)}  top 8: ${pct(xs, 8).padStart(4)}  top 20: ${pct(xs, 20).padStart(4)}  median rank ${sorted[Math.floor(sorted.length / 2)] ?? "-"}`);
};
console.log(`The human's end's rank by the one-turn score, where the look-ahead prefers it (${ranks.length} turns):`);
show("all", ranks.map((r) => r.rank));
for (const k of ["WEAK", "NORMAL", "ELITE", "BOSS"]) show(k, ranks.filter((r) => r.kind === k).map((r) => r.rank));
const reasons = [...new Set(ranks.map((r) => r.reason))];
for (const why of reasons) show(`  ${why}`, ranks.filter((r) => r.reason === why).map((r) => r.rank));
