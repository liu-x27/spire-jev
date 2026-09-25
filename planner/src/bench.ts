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
    // Or play on until a fight on this floor (33: from the pre-Vantom save through act 2 to The Insatiable).
    "stop-floor": { type: "string", default: "999" },
    sandboxes: { type: "string", default: "8" },
    port: { type: "string", default: "47100" },
    ascension: { type: "string", default: "10" },
    // Also replay each save under these exploration seeds (1..N), as save-and-load would.
    explore: { type: "string", default: "0" },
    // The library: runs/saves (seeds 46-135, the confirmation set) or runs/saves-dev (136-315, for tuning).
    library: { type: "string", default: "saves" },
    // The saves' seeds, a-b: an explicit manifest (the library also holds saves from other seed sets).
    seeds: { type: "string" },
  },
});
if (!values.tag) throw new Error("--tag is required");
const here = path.resolve(import.meta.dirname, "..");
const dir = path.join(here, "runs", values.library);
const seedOf = (f: string) => Number(f.match(/JEV0*(\d+)/)?.[1] ?? -1);
const [lo, hi] = (values.seeds ?? "0-999999").split("-").map(Number) as [number, number];
const saves = fs.readdirSync(dir).filter((f) => f.endsWith(".save") && f.includes(values.saves) && seedOf(f) >= lo && seedOf(f) <= hi).sort();
// An act replay plays every fight up to the stop floor.
const maxFights = Number(values["stop-floor"]) < 999 && values.fights === "1" ? "99" : values.fights;
if (saves.length === 0) throw new Error(`no saves matching ${values.saves} in ${dir}`);
const n = Math.min(Number(values.sandboxes), saves.length);
// Each job: a save, and an exploration seed (0: the plain planner).
const jobs: { save: string; explore: number }[] = [];
for (const save of saves) for (let e = 0; e <= Number(values.explore); e++) jobs.push({ save, explore: e });
const queues: { save: string; explore: number }[][] = Array.from({ length: n }, () => []);
jobs.forEach((j, i) => queues[i % n]!.push(j));
const logs = path.join(here, "..", "sandbox");

const t0 = Date.now();
/** One replay: its fights and screens, and whether it ran to its end (a crash or timeout is not a loss). */
interface Replay {
  save: string;
  explore: number;
  status: "ok" | "failed";
  fights: FightLog[];
  rooms: unknown[];
  ends: unknown[];
}
const results: Replay[] = [];
await Promise.all(
  queues.map(async (queue, i) => {
    const port = Number(values.port) + i;
    for (const { save, explore } of queue) {
      const seed = seedOf(save);
      const out = path.join(here, "runs", `bench-${values.tag}-${port}.json`);
      // A replay that did not run to its end is tried once more, then recorded as failed.
      for (let attempt = 0; attempt < 2; attempt++) {
      const log = fs.openSync(path.join(logs, `bench-${values.tag}-${port}.log`), "a");
      await new Promise<void>((resolve) => {
        const child = spawn(
          process.execPath,
          [
            path.join(here, "src", "run-fights.ts"), "--runs", "1", "--seed", String(seed), "--port", String(port),
            "--choices", values.choices, "--ascension", values.ascension, "--flags", values.flags, "--weights", values.weights,
            "--resume", path.join(dir, save), "--max-fights", maxFights, "--stop-floor", values["stop-floor"], "--cards", "take", "--out", out,
            ...(explore > 0 ? ["--explore", String(explore)] : []),
          ],
          { cwd: here, stdio: ["ignore", log, log] },
        );
        child.on("exit", () => resolve());
      });
      fs.closeSync(log);
      const part = fs.existsSync(out) ? (JSON.parse(fs.readFileSync(out, "utf8")) as { fights: FightLog[]; rooms?: unknown[]; ends?: { terminal?: boolean; error?: string }[] }) : undefined;
      if (part) fs.rmSync(out);
      // Ran to its end: the game said the run was over, or the replay reached its stop (a fight past
      // the stop floor, or the fight limit), rather than a lost connection or a timeout.
      const last = part?.fights.at(-1);
      const ended = part !== undefined && part.fights.length > 0 && !(part.ends ?? []).some((e) => e.error)
        && ((part.ends?.length ?? 0) > 0 || (last !== undefined && (!last.won || last.floor >= Number(values["stop-floor"]) || part.fights.length >= Number(maxFights))));
      if (ended || attempt === 1) {
        results.push({ save, explore, status: ended ? "ok" : "failed", fights: part?.fights ?? [], rooms: part?.rooms ?? [], ends: part?.ends ?? [] });
        break;
      }
      }
    }
  }),
);

results.sort((a, b) => a.save.localeCompare(b.save) || a.explore - b.explore);
fs.writeFileSync(path.join(here, "runs", `bench-${values.tag}.json`), JSON.stringify({ tag: values.tag, weights: values.weights, flags: values.flags, results }, null, 1));
const failed = results.filter((r) => r.status === "failed");
if (failed.length) console.log(`  FAILED replays (left out below): ${failed.map((r) => `${seedOf(r.save)}${r.explore ? `/e${r.explore}` : ""}`).join(" ")}`);
const plain = results.filter((r) => r.explore === 0 && r.status === "ok");
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
if (Number(values["stop-floor"]) < 999) {
  // An act replayed to its boss: how many reached the boss floor, and won there.
  const floor = Number(values["stop-floor"]);
  const at = plain.map((r) => r.fights.find((f) => f.floor === floor)).filter((f): f is FightLog => f !== undefined);
  console.log(`  reached floor ${floor}: ${at.length} of ${plain.length}; won there ${at.filter((f) => f.won).length} (clean ${at.filter((f) => f.won && f.hpEnd >= 0.3 * f.maxHp).length}); HP coming in ${Math.round(100 * mean(at.map((f) => f.hpStart / f.maxHp)))}%`);
}
// A replay resumed after a hang or crash (run-fights resumeRun) is not a clean one: say which.
const resumedReplays = results.filter((r) => r.fights.some((f) => (f.resumed?.length ?? 0) > 0));
if (resumedReplays.length) console.log(`  resumed after a hang or crash: ${resumedReplays.length} of ${results.length} replays (${resumedReplays.map((r) => `${seedOf(r.save)}${r.explore ? `/e${r.explore}` : ""}@${r.fights.find((f) => f.resumed)!.resumed!.map((x) => x.floor).join(",")}`).join(" ")})`);
console.log(`  per save: ${results.map((r) => `${(r.save.match(/JEV0*(\d+)/)?.[1] ?? "?")}:${r.fights.at(-1)?.won ? "W" : "L"}${r.fights.at(-1)?.hpEnd ?? "?"}`).join(" ")}`);
