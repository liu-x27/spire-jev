/**
 * The planner on a human's fights: each f<floor>.save that replay-drive.ts wrote (the game's save as
 * the fight's map node was chosen) resumed and fought by the bot, the run's flags as in the game
 * benches, one fight each; then the bot's HP lost beside the human's, fight by fight.
 *
 *   node src/replay-bot.ts --dir runs/replay-<seed> [--port 47150] [--flags ...] [--tag bot] [--floors 2-33]
 *
 * Writes <dir>/<tag>.json: per fight, the human's HP lost and turns (the replay's combat_end) and
 * the bot's (run-fights' log).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import type { FightLog } from "./run-fights.ts";

const CORE = "pathdp,restbudget,potions2,sleep,spar,spar3,spar5,spar4up,spar4shop,powbonus,spartake";
const { values } = parseArgs({
  options: {
    dir: { type: "string" },
    port: { type: "string", default: "47150" },
    flags: { type: "string", default: CORE },
    tag: { type: "string", default: "bot" },
    floors: { type: "string", default: "0-99" },
    weights: { type: "string", default: "{}" },
  },
});
if (!values.dir) throw new Error("--dir is required");
const dir = path.resolve(values.dir);
const here = path.resolve(import.meta.dirname, "..");
const drive = JSON.parse(fs.readFileSync(path.join(dir, "drive.json"), "utf8")) as { fights: { floor: number; encounter: string; save: string; hpStart: number; humanHpLost: number | null; humanTurns: number; gameHpLost?: number }[] };
const [lo, hi] = values.floors.split("-").map(Number) as [number, number];
const out: Record<string, unknown>[] = [];
for (const f of drive.fights) {
  if (f.floor < lo || f.floor > hi) continue;
  const save = path.join(dir, f.save);
  if (!fs.existsSync(save)) continue;
  const tmp = path.join(dir, `${values.tag}-f${f.floor}.json`);
  const t0 = Date.now();
  spawnSync(process.execPath, [
    path.join(here, "src", "run-fights.ts"), "--runs", "1", "--seed", "0", "--port", values.port, "--choices", "rules2", "--ascension", "10",
    "--flags", values.flags, "--weights", values.weights, "--resume", save, "--max-fights", "1", "--stop-floor", String(f.floor), "--cards", "take", "--out", tmp,
  ], { cwd: here, stdio: ["ignore", "inherit", "inherit"], env: process.env });
  const log = fs.existsSync(tmp) ? (JSON.parse(fs.readFileSync(tmp, "utf8")) as { fights: FightLog[] }).fights.find((x) => x.floor === f.floor) : undefined;
  const row = {
    floor: f.floor, encounter: f.encounter, hpStart: f.hpStart, human: f.humanHpLost, humanTurns: f.humanTurns,
    bot: log ? log.hpLost : null, botWon: log?.won ?? null, botTurns: log?.turns ?? null, botStart: log?.hpStart ?? null, secs: Math.round((Date.now() - t0) / 1000),
  };
  out.push(row);
  console.log(`floor ${String(f.floor).padStart(2)} ${f.encounter.padEnd(34)} human -${f.humanHpLost} in ${f.humanTurns}  bot ${row.bot === null ? "?" : `-${row.bot}`} in ${row.botTurns}${row.botWon === false ? " LOST" : ""}  (${row.secs} s)`);
  fs.writeFileSync(path.join(dir, `${values.tag}.json`), JSON.stringify({ flags: values.flags, fights: out }, null, 1));
}
