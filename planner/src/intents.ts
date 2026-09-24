/**
 * What each monster shows on each turn of a fight, from our run logs — for
 * the two-turn lookahead, which otherwise guesses one attack of the
 * monster's average (Vantom's cycle is 8, 7×2, Dismember 30, Prepare; the
 * average says 14 every turn).
 *
 *   node src/intents.ts   → data/intents.json, from every runs/eval-*.json
 *
 * Kept by ascension (A10's numbers are higher): model → ascension → turn →
 * intent → times seen. Runs whose file name has "a10" are A10, the rest A0.
 * Built from the seeds the evaluations use, like the bestiary.
 */

import fs from "node:fs";
import path from "node:path";
import type { IntentObs } from "./obs.ts";
import type { FightLog } from "./run-fights.ts";

export type IntentTable = Record<string, Record<string, Record<string, Record<string, number>>>>;

export const INTENTS_FILE = path.resolve(import.meta.dirname, "..", "data", "intents.json");

let table: IntentTable | undefined;
function load(): IntentTable {
  if (table) return table;
  try {
    table = JSON.parse(fs.readFileSync(INTENTS_FILE, "utf8")) as IntentTable;
  } catch {
    table = {};
  }
  return table;
}

let ascension = 0;
/** The ascension the runs are played at (run-fights sets it). */
export function setIntentAscension(a: number): void {
  ascension = a;
}

/** "Attack30x1+StatusCard" → the intents the planner reads. */
export function parseIntent(text: string): IntentObs[] {
  return text.split("+").filter(Boolean).map((part) => {
    const m = part.match(/^Attack(\d+)x(\d+)$/);
    return m ? { type: "Attack", damage: Number(m[1]), hits: Number(m[2]) } : { type: part, damage: 0, hits: 0 };
  });
}

/**
 * What `model` will most likely show on `turn`, if the logs have seen it
 * there at least three times and one intent was shown at least 60% of them.
 */
export function likelyIntent(model: string, turn: number): IntentObs[] | undefined {
  const byTurn = load()[model]?.[String(ascension >= 1 ? 10 : 0)]?.[String(turn)];
  if (!byTurn) return undefined;
  const total = Object.values(byTurn).reduce((a, n) => a + n, 0);
  const [best, n] = Object.entries(byTurn).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  if (total < 3 || n / total < 0.6) return undefined;
  return parseIntent(best);
}

export function buildIntents(files: readonly string[]): IntentTable {
  const out: IntentTable = {};
  for (const file of files) {
    const asc = /a10/.test(path.basename(file)) ? "10" : "0";
    const fights = (JSON.parse(fs.readFileSync(file, "utf8")) as { fights: FightLog[] }).fights;
    for (const f of fights) {
      for (const e of f.endTurn) {
        for (const m of e.before.matchAll(/E\d+ (\w+) \d+hp \d+blk \[[^\]]*\] (\S+)/g)) {
          const byTurn = (((out[m[1]!] ??= {})[asc] ??= {})[String(e.turn)] ??= {});
          byTurn[m[2]!] = (byTurn[m[2]!] ?? 0) + 1;
        }
      }
    }
  }
  return out;
}

if (import.meta.main) {
  const runs = path.resolve(import.meta.dirname, "..", "runs");
  const files = fs.readdirSync(runs).filter((f) => /^eval-.*\.json$/.test(f)).map((f) => path.join(runs, f));
  const built = buildIntents(files);
  fs.mkdirSync(path.dirname(INTENTS_FILE), { recursive: true });
  fs.writeFileSync(INTENTS_FILE, `${JSON.stringify(built)}\n`);
  console.log(`${Object.keys(built).length} monsters from ${files.length} evaluations → ${path.relative(process.cwd(), INTENTS_FILE)}`);
}
