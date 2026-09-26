/**
 * One run played on screen and recorded, to show the bot at work: run-fights.ts with the game drawn
 * (SPIRE_JEV_VISUAL), Godot's Movie Maker writing every frame, and the bridge's frame numbers kept
 * beside it; then demo-media.ts makes the MP4 and GIF.
 *
 *   node src/record.ts --seed 612 [--ascension 0] [--name a0-612] [--port 47190] [--fast fast]
 *                      [--choices rules2] [--flags pathdp,restbudget,potions2,sleep] [--speed 1] [--gif-floors 16]
 *                      [--resume runs/<library>/<save> --stop-floor 50]   (from a room's save, as bench.ts plays it)
 *
 * The run is the same run as headless on the same seed and settings (eval.ts), so a seed can be
 * picked from an eval and recorded after. Everything lands in recordings/<name>/ (a<ascension>-<seed>
 * by default, the ascension the game's history says it played): raw.avi (about 2.3 MB a second of
 * play at 1280x720), timeline.jsonl, run.json (run-fights' log), meta.json.
 * The window opens on the desktop; what covers it does not matter to the recording.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    seed: { type: "string" },
    ascension: { type: "string", default: "0" },
    name: { type: "string" },
    port: { type: "string", default: "47190" },
    fast: { type: "string", default: "fast" },
    choices: { type: "string", default: "rules2" },
    flags: { type: "string", default: "pathdp,restbudget,potions2,sleep" },
    "max-fights": { type: "string", default: "99" },
    // A run resumed from a room's save (bench.ts's libraries), to its stop floor, as the bench played it.
    resume: { type: "string" },
    "stop-floor": { type: "string", default: "999" },
    speed: { type: "string", default: "1" },
    "gif-floors": { type: "string" },
    "no-media": { type: "boolean", default: false },
  },
});
if (!values.seed) throw new Error("--seed is required");

const here = path.resolve(import.meta.dirname, "..");
const repo = path.resolve(here, "..");
// Named for the ascension the game played once it is known (see playedAscension), unless --name.
let name = values.name ?? `seed-${values.seed}`;
let dir = path.join(repo, "recordings", name);
fs.mkdirSync(dir, { recursive: true });
for (const f of ["raw.avi", "timeline.jsonl"]) fs.rmSync(path.join(dir, f), { force: true });

const env = {
  ...process.env,
  SPIRE_JEV_VISUAL: "1",
  SPIRE_JEV_FAST_MODE: values.fast,
  SPIRE_JEV_MOVIE: path.join(dir, "raw.avi"),
  SPIRE_JEV_TIMELINE: path.join(dir, "timeline.jsonl"),
  // The bridge with the presentation switch and the frame field, unless another is asked for.
  SPIRE_JEV_MOD: process.env["SPIRE_JEV_MOD"] ?? path.join(repo, "mod", "Bridge", "bin", "Visual", "net9.0", "package"),
};
const t0 = Date.now();
const run = spawnSync(
  process.execPath,
  [
    path.join(here, "src", "run-fights.ts"), "--runs", "1", "--seed", values.seed, "--port", values.port, "--cards", "take",
    "--choices", values.choices, "--ascension", values.ascension, "--flags", values.flags, "--max-fights", values["max-fights"],
    "--stop-floor", values["stop-floor"], ...(values.resume ? ["--resume", path.resolve(values.resume)] : []),
    "--out", path.join(dir, "run.json"),
  ],
  { cwd: here, env, stdio: "inherit" },
);
if (run.status !== 0) throw new Error(`run-fights exited ${run.status}`);

/**
 * The ascension the game played, from its history of the run: the bridge's request is not always
 * what is played (a profile's preferred ascension stands when 0 is asked for — every "A0" run of
 * 2026-09-24 on the veteran profile was A10).
 */
function playedAscension(sandbox: string, seed: string, since: number): number | undefined {
  const history = path.join(sandbox, "userdata", "SlayTheSpire2", "default", "1", "modded", "profile1", "saves", "history");
  if (!fs.existsSync(history)) return undefined;
  const runs = fs
    .readdirSync(history)
    .filter((f) => f.endsWith(".run"))
    .map((f) => path.join(history, f))
    .filter((f) => fs.statSync(f).mtimeMs >= since)
    .map((f) => JSON.parse(fs.readFileSync(f, "utf8")) as { seed?: string; ascension?: number })
    .filter((r) => r.seed === seed);
  return runs[runs.length - 1]?.ascension;
}

const log = JSON.parse(fs.readFileSync(path.join(dir, "run.json"), "utf8")) as { ends: { seed: string; victory: boolean; floor: number }[] };
const end = log.ends[log.ends.length - 1];
const seed = end?.seed ?? values.seed;
const played = playedAscension(path.join(repo, "sandbox", `p${values.port}`), seed, t0);
if (played === undefined) console.log(`  no history of ${seed}: the ascension is taken as asked, ${values.ascension}`);
else if (played !== Number(values.ascension)) console.log(`  asked for ascension ${values.ascension}, the game played ${played}`);
const ascension = played ?? Number(values.ascension);
fs.writeFileSync(
  path.join(dir, "meta.json"),
  JSON.stringify({ seed, ascension, asked: Number(values.ascension), victory: end?.victory, floor: end?.floor, fps: 30, fast: values.fast, choices: values.choices, flags: values.flags, minutes: (Date.now() - t0) / 60000 }, null, 1),
);
if (!values.name) {
  // The game has let go of raw.avi by now, but Windows may take a moment to agree.
  const named = path.join(repo, "recordings", `a${ascension}-${values.seed}`);
  fs.rmSync(named, { recursive: true, force: true });
  for (let tries = 0; ; tries++) {
    try {
      fs.renameSync(dir, named);
      [name, dir] = [path.basename(named), named];
      break;
    } catch (err) {
      if (tries >= 20) {
        console.log(`  left in ${name}: ${(err as Error).message}`);
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}
console.log(`recorded ${name}: A${ascension}, ${end?.victory ? "victory" : `ended on floor ${end?.floor}`}, ${((Date.now() - t0) / 60000).toFixed(1)} min`);

if (!values["no-media"]) {
  spawnSync(process.execPath, [path.join(here, "src", "demo-media.ts"), dir, "--speed", values.speed, ...(values["gif-floors"] ? ["--gif-floors", values["gif-floors"]] : [])], { stdio: "inherit" });
}
