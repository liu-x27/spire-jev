/**
 * Two evaluations, fight for fight.
 *
 *   node src/compare.ts runs/eval-a.json runs/eval-b.json
 *
 * Runs on the same seed meet the same fights in the same order until one of
 * them dies, so the fights both lived to play are the same fights: HP lost on
 * those, fights won, and how far each seed got.
 */

import fs from "node:fs";
import type { FightLog } from "./run-fights.ts";

interface Evaluation {
  tag: string;
  fights: FightLog[];
}

const [fileA, fileB] = process.argv.slice(2);
if (!fileA || !fileB) throw new Error("usage: compare.ts a.json b.json");
const load = (f: string) => JSON.parse(fs.readFileSync(f, "utf8")) as Evaluation;
const a = load(fileA);
const b = load(fileB);

const key = (f: FightLog) => `${f.seed}/${f.floor}/${f.enemies.join("+")}`;
const inB = new Map(b.fights.map((f) => [key(f), f]));
let shared = 0;
let lostA = 0;
let lostB = 0;
let wonA = 0;
let wonB = 0;
const worse: string[] = [];
for (const fa of a.fights) {
  const fb = inB.get(key(fa));
  if (!fb) continue;
  shared++;
  lostA += fa.hpLost;
  lostB += fb.hpLost;
  wonA += fa.won ? 1 : 0;
  wonB += fb.won ? 1 : 0;
  if (fb.hpLost - fa.hpLost >= 15) worse.push(`${key(fa)}: ${a.tag} -${fa.hpLost}, ${b.tag} -${fb.hpLost}`);
}

const last = (fights: FightLog[]) => {
  const bySeed = new Map<string, FightLog>();
  for (const f of fights) bySeed.set(f.seed, f);
  return bySeed;
};
const endA = last(a.fights);
const endB = last(b.fights);
// Only the seeds both evaluations ran (one may cover more seeds than the other).
const seeds = [...endA.keys()].filter((s) => endB.has(s)).sort();
for (const m of [endA, endB]) for (const k of [...m.keys()]) if (!seeds.includes(k)) m.delete(k);
let further = 0;
let shorter = 0;
const rows = seeds.map((s) => {
  const fa = endA.get(s)?.floor ?? 0;
  const fb = endB.get(s)?.floor ?? 0;
  if (fb > fa) further++;
  if (fb < fa) shorter++;
  return `${s.slice(-2)}:${fa}/${fb}`;
});
const mean = (m: Map<string, FightLog>) => [...m.values()].reduce((x, f) => x + f.floor, 0) / Math.max(1, m.size);

console.log(`${a.tag} vs ${b.tag}`);
// hpLost counts a fight won in the enemies' turn only since 2026-09-24 (run-fights.ts hpLostWinning).
const counted = (e: Evaluation) => e.fights.some((f) => f.hpLostWinning !== undefined);
if (counted(a) !== counted(b)) {
  console.log(`  note: ${counted(a) ? b.tag : a.tag} was logged before HP lost counted a fight won in the enemies' turn (a Waterfall Giant's DeathBlow): HP lost is not like for like`);
}
console.log(`  floors reached (${a.tag}/${b.tag}): ${rows.join(" ")}`);
console.log(`  mean floor ${mean(endA).toFixed(1)} vs ${mean(endB).toFixed(1)}; ${b.tag} further on ${further} seeds, shorter on ${shorter}`);
console.log(`  ${shared} fights both played: HP lost ${lostA} vs ${lostB} (${(((lostB - lostA) / Math.max(1, lostA)) * 100).toFixed(0)}%), won ${wonA} vs ${wonB}`);
console.log(`  all fights: ${a.fights.length} (${a.fights.filter((f) => f.won).length} won) vs ${b.fights.length} (${b.fights.filter((f) => f.won).length} won)`);
// Bosses by floor, on the shared seeds: reached (a fight on that floor) and beaten (past it, or won
// there). Conditional win rates hide less than mean floors: crules6 gained 1.3 floors while its
// Insatiable wins fell 10/21 -> 7/29 (runs/analysis-report.html 5.5).
const bossLine = (fights: FightLog[]) =>
  [17, 33, 48, 49].map((floor) => {
    const bySeed = new Map<string, FightLog[]>();
    for (const f of fights) if (seeds.includes(f.seed)) bySeed.set(f.seed, [...(bySeed.get(f.seed) ?? []), f]);
    let reached = 0;
    let beaten = 0;
    for (const fs_ of bySeed.values()) {
      const last = fs_[fs_.length - 1]!;
      if (!fs_.some((f) => f.floor === floor)) continue;
      reached++;
      if (last.floor > floor || (last.floor === floor && last.won)) beaten++;
    }
    return `f${floor} ${beaten}/${reached}`;
  }).join(", ");
console.log(`  bosses beaten/reached: ${a.tag} ${bossLine(a.fights)}; ${b.tag} ${bossLine(b.fights)}`);
if (worse.length) console.log(`  fights where ${b.tag} lost 15+ HP more:\n    ${worse.join("\n    ")}`);
