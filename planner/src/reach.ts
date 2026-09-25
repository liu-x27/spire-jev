/**
 * How far each start got, two evaluations paired on their seeds (astra-review-4: completions per
 * original start, and the discordant seeds behind a difference, not conditional boss rates).
 *
 *   node src/reach.ts runs/eval-a.json runs/eval-b.json
 *
 * The milestones: act 1's boss beaten (floor 17), act 2's (33), act 3's first (48), its second (49,
 * the win at A10). A run that ended on an error is censored where it stopped, and counted apart.
 */

import fs from "node:fs";
import path from "node:path";

interface Run {
  fights: { seed: string; floor: number; won: boolean; enemies: string[] }[];
  ends: { seed: string; victory: boolean; floor?: number; error?: string }[];
  tag?: string;
}

const MILESTONES = [17, 33, 48, 49] as const;
const NAMES = ["act 1 boss", "act 2 boss", "floor 48", "floor 49 (won)"];

/** Per seed: the milestones it passed (0-4), and whether it ended on an error. */
function reach(file: string): { tag: string; by: Map<string, { passed: number; censored: boolean }> } {
  const d = JSON.parse(fs.readFileSync(file, "utf8")) as Run;
  const by = new Map<string, { passed: number; censored: boolean }>();
  for (const e of d.ends) by.set(e.seed, { passed: e.victory ? 4 : 0, censored: e.error !== undefined });
  for (const f of d.fights) {
    const i = MILESTONES.indexOf(f.floor as (typeof MILESTONES)[number]);
    if (i < 0 || !f.won) continue;
    const r = by.get(f.seed) ?? { passed: 0, censored: false };
    r.passed = Math.max(r.passed, i + 1);
    by.set(f.seed, r);
  }
  return { tag: d.tag ?? path.basename(file), by };
}

const [fa, fb] = process.argv.slice(2);
if (!fa) {
  console.log("usage: node src/reach.ts runs/eval-a.json [runs/eval-b.json]");
  process.exit(1);
}
const a = reach(fa);
const b = fb ? reach(fb) : undefined;
const seeds = [...a.by.keys()].filter((s) => !b || b.by.has(s));
console.log(`${a.tag}${b ? ` vs ${b.tag}` : ""}: ${seeds.length} starts${b ? " on both" : ""}`);
for (let m = 0; m < MILESTONES.length; m++) {
  const pa = seeds.filter((s) => a.by.get(s)!.passed > m).length;
  if (!b) {
    console.log(`  ${NAMES[m]!.padEnd(15)} ${String(pa).padStart(4)} (${((100 * pa) / seeds.length).toFixed(1)}%)`);
    continue;
  }
  const pb = seeds.filter((s) => b.by.get(s)!.passed > m).length;
  const gained = seeds.filter((s) => a.by.get(s)!.passed <= m && b.by.get(s)!.passed > m);
  const lost = seeds.filter((s) => a.by.get(s)!.passed > m && b.by.get(s)!.passed <= m);
  // McNemar's exact two-sided p over the discordant seeds.
  const n = gained.length + lost.length;
  const k = Math.min(gained.length, lost.length);
  let p = 0;
  for (let i = 0; i <= k; i++) p += choose(n, i) / 2 ** n;
  console.log(
    `  ${NAMES[m]!.padEnd(15)} ${String(pa).padStart(4)} → ${String(pb).padStart(4)}` +
      `  (${((100 * pa) / seeds.length).toFixed(1)}% → ${((100 * pb) / seeds.length).toFixed(1)}%)` +
      `  gained ${gained.length}, lost ${lost.length}${n > 0 ? `, p ${Math.min(1, 2 * p).toFixed(3)}` : ""}` +
      (m >= 2 && gained.length > 0 ? `  [${gained.join(" ")}]` : ""),
  );
}
const cens = (r: typeof a) => seeds.filter((s) => r.by.get(s)!.censored);
console.log(`  ended on an error: ${cens(a).length}${b ? ` → ${cens(b).length}` : ""}`);

function choose(n: number, k: number): number {
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return c;
}
