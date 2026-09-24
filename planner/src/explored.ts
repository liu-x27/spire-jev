/**
 * What the explorations that won did differently (bench.ts --explore).
 *
 *   node src/explored.ts runs/bench-ins-explore.json [--show 4]
 *
 * For each save the plain planner lost and some exploration won, the two
 * lines side by side, turn by turn (cards and potions), with the boss's HP
 * at the end of each turn. Then, over all such saves: for every card, the
 * turn it was first played in the winning lines and in the losing ones, and
 * when potions were drunk — what the evaluation keeps misjudging.
 */

import fs from "node:fs";
import { parseArgs } from "node:util";
import type { FightLog } from "./run-fights.ts";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { show: { type: "string", default: "4" } } });
const file = positionals[0];
if (!file) throw new Error("usage: explored.ts runs/bench-x.json");
const data = JSON.parse(fs.readFileSync(file, "utf8")) as { results: { save: string; explore: number; fights: FightLog[] }[] };

const bySave = new Map<string, { explore: number; fight: FightLog }[]>();
for (const r of data.results) {
  const f = r.fights.at(-1);
  if (f) bySave.set(r.save, [...(bySave.get(r.save) ?? []), { explore: r.explore, fight: f }]);
}

const byTurn = (f: FightLog) => {
  const turns = new Map<number, string[]>();
  for (const s of f.sequence ?? []) {
    const m = s.match(/^t(\d+):(.*)$/);
    if (m) turns.set(Number(m[1]), [...(turns.get(Number(m[1])) ?? []), m[2]!]);
  }
  return turns;
};
const bossHp = (f: FightLog) => f.endTurn.map((t) => {
  const hps = [...t.before.matchAll(/E\d+ \w+ (\d+)hp/g)].map((m) => Number(m[1]));
  return hps.length ? Math.max(...hps) : 0;
});

const firstTurn = { won: new Map<string, number[]>(), lost: new Map<string, number[]>() };
const potionTurns = { won: [] as number[], lost: [] as number[] };
let shown = 0;
let pairs = 0;
for (const [save, runs] of bySave) {
  const plain = runs.find((r) => r.explore === 0);
  const winner = runs.find((r) => r.explore > 0 && r.fight.won);
  if (!plain || plain.fight.won || !winner) continue;
  pairs++;
  for (const [kind, f] of [["won", winner.fight], ["lost", plain.fight]] as const) {
    const seen = new Set<string>();
    for (const [turn, plays] of byTurn(f)) {
      for (const p of plays) {
        if (p.startsWith("POTION:")) potionTurns[kind].push(turn);
        const card = p.replace(/\+$/, "");
        if (seen.has(card)) continue;
        seen.add(card);
        firstTurn[kind].set(card, [...(firstTurn[kind].get(card) ?? []), turn]);
      }
    }
  }
  if (shown < Number(values.show)) {
    shown++;
    const w = byTurn(winner.fight);
    const l = byTurn(plain.fight);
    const wh = bossHp(winner.fight);
    const lh = bossHp(plain.fight);
    console.log(`\n${save} — plain lost (${plain.fight.turns} turns, HP ${plain.fight.hpStart}→${plain.fight.hpEnd}); exploration ${winner.explore} won (${winner.fight.turns} turns, HP left ${winner.fight.hpEnd})`);
    const turns = Math.max(winner.fight.turns, plain.fight.turns);
    for (let t = 1; t <= Math.min(turns, 8); t++) {
      console.log(`  t${t}  won: ${(w.get(t) ?? []).join(" ") || "-"}  [boss ${wh[t - 1] ?? "-"}]`);
      console.log(`      lost: ${(l.get(t) ?? []).join(" ") || "-"}  [boss ${lh[t - 1] ?? "-"}]`);
    }
  }
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
console.log(`\n${pairs} saves lost by the plain planner and won by an exploration.`);
const cards = new Set([...firstTurn.won.keys(), ...firstTurn.lost.keys()]);
const rows = [...cards].map((c) => {
  const w = firstTurn.won.get(c) ?? [];
  const l = firstTurn.lost.get(c) ?? [];
  return { c, w, l, d: mean(w) - mean(l) };
}).filter((r) => r.w.length + r.l.length >= 3).sort((a, b) => (a.d || 0) - (b.d || 0));
console.log("card: first turn played, winning lines vs losing lines (and in how many of each) — earlier in the winners first:");
for (const r of rows) console.log(`  ${r.c.padEnd(22)} ${mean(r.w).toFixed(1)} (${r.w.length}) vs ${mean(r.l).toFixed(1)} (${r.l.length})`);
console.log(`potions: winning lines drank ${potionTurns.won.length} at mean turn ${mean(potionTurns.won).toFixed(1)}; losing lines ${potionTurns.lost.length} at ${mean(potionTurns.lost).toFixed(1)}`);
