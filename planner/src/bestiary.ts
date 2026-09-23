/**
 * What each monster does per turn, on average, from our own run logs.
 *
 *   node src/bestiary.ts runs/eval-a.json [runs/eval-b.json …]   → data/bestiary.json
 *
 * An enemy's intent shows only this turn, and some turns are its quiet ones
 * (Vantom shows 7 on turn 1 and averages 13.6, rising). The planner takes the
 * larger of the two. Built from the seeds it is then measured on, so a
 * configuration that uses it is checked on seeds it was not built from too.
 */

import fs from "node:fs";
import path from "node:path";
import type { FightLog } from "./run-fights.ts";

export interface Beast {
  turns: number;
  /** Attack damage per turn, over every turn it was seen, quiet ones counted as 0. */
  perTurn: number;
}

export const BESTIARY_FILE = path.resolve(import.meta.dirname, "..", "data", "bestiary.json");

export function loadBestiary(file = BESTIARY_FILE): Record<string, Beast> {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, Beast>;
  } catch {
    return {};
  }
}

/** From the state before every end of turn: each living enemy's model and intents. */
export function buildBestiary(fights: readonly FightLog[]): Record<string, Beast> {
  const sums = new Map<string, { turns: number; damage: number }>();
  for (const f of fights) {
    for (const e of f.endTurn) {
      for (const m of e.before.matchAll(/E\d+ (\w+) \d+hp \d+blk \[[^\]]*\] (\S+)/g)) {
        let damage = 0;
        for (const a of m[2]!.matchAll(/Attack(\d+)x(\d+)/g)) damage += Number(a[1]) * Number(a[2]);
        const s = sums.get(m[1]!) ?? { turns: 0, damage: 0 };
        s.turns++;
        s.damage += damage;
        sums.set(m[1]!, s);
      }
    }
  }
  const out: Record<string, Beast> = {};
  for (const [model, s] of [...sums].sort(([a], [b]) => a.localeCompare(b))) {
    out[model] = { turns: s.turns, perTurn: Math.round((s.damage / s.turns) * 10) / 10 };
  }
  return out;
}

if (import.meta.main) {
  const files = process.argv.slice(2);
  if (files.length === 0) throw new Error("usage: bestiary.ts runs/eval-*.json …");
  const fights = files.flatMap((f) => (JSON.parse(fs.readFileSync(f, "utf8")) as { fights: FightLog[] }).fights);
  const bestiary = buildBestiary(fights);
  fs.mkdirSync(path.dirname(BESTIARY_FILE), { recursive: true });
  fs.writeFileSync(BESTIARY_FILE, `${JSON.stringify(bestiary, null, 1)}\n`);
  console.log(`${Object.keys(bestiary).length} monsters from ${fights.length} fights → ${path.relative(process.cwd(), BESTIARY_FILE)}`);
}
