/**
 * Boss fights replayed from saves: the same fights for every configuration.
 *
 *   node src/bench.ts --tag X --saves f32 [--weights '{...}'] [--flags a,b] [--fights 1]
 *                     [--sandboxes 8] [--port 47100] [--ascension 10]
 *
 * Every runs/saves/<seed>-a<asc>-f<floor>.save matching --saves (a substring
 * of the file name, e.g. "a10-f32") is resumed in a sandbox (run-fights
 * --resume: the bridge presses Continue) and played for --fights fights — the
 * boss after the pre-boss rest's map. A resumed fight is the fight the run
 * had (checked: seed 16's Vantom, turn for turn), so two configurations on
 * the same saves differ only in how they fight. Writes runs/bench-<tag>.json.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import type { FightLog } from "./run-fights.ts";

const { values } = parseArgs({
  options: {
    tag: { type: "string" },
    saves: { type: "string", default: "a10-f32" },
    weights: { type: "string", default: "{}" },
    flags: { type: "string", default: "" },
    choices: { type: "string", default: "rules2" },
    fights: { type: "string", default: "1" },
    sandboxes: { type: "string", default: "8" },
    port: { type: "string", default: "47100" },
    ascension: { type: "string", default: "10" },
    // Also replay each save under these exploration seeds (1..N), as save-and-load would.
    explore: { type: "string", default: "0" },
    // The library: runs/saves (seeds 46-135, the confirmation set) or runs/saves-dev (136-315, for tuning).
    library: { type: "string", default: "saves" },
  },
});
if (!values.tag) throw new Error("--tag is required");
const here = path.resolve(import.meta.dirname, "..");
const dir = path.join(here, "runs", values.library);
const saves = fs.readdirSync(dir).filter((f) => f.endsWith(".save") && f.includes(values.saves)).sort();
if (saves.length === 0) throw new Error(`no saves matching ${values.saves} in ${dir}`);
const n = Math.min(Number(values.sandboxes), saves.length);
// Each job: a save, and an exploration seed (0: the plain planner).
const jobs: { save: string; explore: number }[] = [];
for (const save of saves) for (let e = 0; e <= Number(values.explore); e++) jobs.push({ save, explore: e });
const queues: { save: string; explore: number }[][] = Array.from({ length: n }, () => []);
jobs.forEach((j, i) => queues[i % n]!.push(j));
const logs = path.join(here, "..", "sandbox");

const t0 = Date.now();
const results: { save: string; explore: number; fights: FightLog[] }[] = [];
await Promise.all(
  queues.map(async (queue, i) => {
    const port = Number(values.port) + i;
    for (const { save, explore } of queue) {
      const seed = Number(save.match(/JEV0*(\d+)/)?.[1] ?? 1);
      const out = path.join(here, "runs", `bench-${values.tag}-${port}.json`);
      const log = fs.openSync(path.join(logs, `bench-${values.tag}-${port}.log`), "a");
      await new Promise<void>((resolve) => {
        const child = spawn(
          process.execPath,
          [
            path.join(here, "src", "run-fights.ts"), "--runs", "1", "--seed", String(seed), "--port", String(port),
            "--choices", values.choices, "--ascension", values.ascension, "--flags", values.flags, "--weights", values.weights,
            "--resume", path.join(dir, save), "--max-fights", values.fights, "--cards", "take", "--out", out,
            ...(explore > 0 ? ["--explore", String(explore)] : []),
          ],
          { cwd: here, stdio: ["ignore", log, log] },
        );
        child.on("exit", () => resolve());
      });
      fs.closeSync(log);
      if (fs.existsSync(out)) {
        results.push({ save, explore, fights: (JSON.parse(fs.readFileSync(out, "utf8")) as { fights: FightLog[] }).fights });
        fs.rmSync(out);
      }
    }
  }),
);

results.sort((a, b) => a.save.localeCompare(b.save) || a.explore - b.explore);
fs.writeFileSync(path.join(here, "runs", `bench-${values.tag}.json`), JSON.stringify({ tag: values.tag, weights: values.weights, flags: values.flags, results }, null, 1));
const plain = results.filter((r) => r.explore === 0);
const boss = plain.map((r) => r.fights[r.fights.length - 1]).filter((f): f is FightLog => f !== undefined);
if (Number(values.explore) > 0) {
  // Saves the plain planner lost and some exploration won: the fights that were winnable.
  const bySave = new Map<string, { plain?: boolean; wins: number[] }>();
  for (const r of results) {
    const e = bySave.get(r.save) ?? { wins: [] };
    const won = r.fights.at(-1)?.won ?? false;
    if (r.explore === 0) e.plain = won;
    else if (won) e.wins.push(r.explore);
    bySave.set(r.save, e);
  }
  const rescued = [...bySave].filter(([, e]) => e.plain === false && e.wins.length > 0);
  console.log(`  explored x${values.explore}: ${rescued.length} of ${[...bySave].filter(([, e]) => e.plain === false).length} lost fights won by some exploration: ${rescued.map(([s, e]) => `${s.match(/JEV0*(\d+)/)?.[1]}(${e.wins.join(",")})`).join(" ")}`);
}
const won = boss.filter((f) => f.won);
const clean = won.filter((f) => f.hpEnd >= 0.3 * f.maxHp);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
console.log(`bench ${values.tag}: ${boss.length} fights from ${saves.length} saves — won ${won.length} (clean ${clean.length}); HP left after a win ${Math.round(100 * mean(won.map((f) => f.hpEnd / f.maxHp)))}%; turns ${mean(boss.map((f) => f.turns)).toFixed(1)}; ${((Date.now() - t0) / 60000).toFixed(1)} min`);
console.log(`  per save: ${results.map((r) => `${(r.save.match(/JEV0*(\d+)/)?.[1] ?? "?")}:${r.fights.at(-1)?.won ? "W" : "L"}${r.fights.at(-1)?.hpEnd ?? "?"}`).join(" ")}`);
