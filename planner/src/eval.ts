/**
 * One configuration over many seeds, several sandboxes at once.
 *
 *   node src/eval.ts --tag future05 [--weights '{"future":0.5}'] [--policy planner|naive]
 *                    [--seeds 1-15] [--sandboxes 4] [--cards take|skip]
 *
 * The seeds are split over sandboxes on ports 47100, 47101, … (each its own
 * headless game); when all are done their fights are merged into
 * runs/eval-<tag>.json and summarised, with how far every seed got. Runs on
 * the same seed meet the same fights whatever fights them (run-fights.ts), so
 * two tags compare fight for fight: compare.ts.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { type FightLog, summarise } from "./run-fights.ts";

const { values } = parseArgs({
  options: {
    tag: { type: "string" },
    weights: { type: "string", default: "{}" },
    policy: { type: "string", default: "planner" },
    seeds: { type: "string", default: "1-15" },
    sandboxes: { type: "string", default: "4" },
    cards: { type: "string", default: "take" },
    choices: { type: "string", default: "first" },
    ascension: { type: "string", default: "0" },
    flags: { type: "string", default: "" },
    capture: { type: "string", default: "" },
    port: { type: "string", default: "47100" },
  },
});
if (!values.tag) throw new Error("--tag is required");
const [from, to] = values.seeds.split("-").map(Number) as [number, number];
const seeds = Array.from({ length: to - from + 1 }, (_, i) => from + i);
const n = Math.min(Number(values.sandboxes), seeds.length);

const here = path.resolve(import.meta.dirname, "..");
const runs = path.join(here, "runs");
const logs = path.join(here, "..", "sandbox");
fs.mkdirSync(runs, { recursive: true });
fs.mkdirSync(logs, { recursive: true });

// Contiguous chunks, one per sandbox.
const chunks: number[][] = Array.from({ length: n }, () => []);
seeds.forEach((seed, i) => chunks[Math.floor((i * n) / seeds.length)]!.push(seed));

const t0 = Date.now();
const parts = await Promise.all(
  chunks.map((chunk, i) => {
    const port = Number(values.port) + i;
    const out = path.join(runs, `eval-${values.tag}-${port}.json`);
    const log = fs.openSync(path.join(logs, `eval-${values.tag}-${port}.log`), "w");
    const child = spawn(
      process.execPath,
      [
        path.join(here, "src", "run-fights.ts"),
        "--policy", values.policy, "--runs", String(chunk.length), "--seed", String(chunk[0]),
        "--port", String(port), "--cards", values.cards, "--weights", values.weights, "--out", out, "--choices", values.choices, "--ascension", values.ascension, "--flags", values.flags, "--capture", values.capture,
      ],
      { cwd: here, stdio: ["ignore", log, log] },
    );
    return new Promise<string>((resolve) => child.on("exit", () => resolve(out)));
  }),
);

const fights: FightLog[] = [];
const rooms: unknown[] = [];
const ends: { seed: string; victory: boolean }[] = [];
/** Every card seen, as the game described it (spar.ts builds its catalogue from these). */
const cards: Record<string, unknown> = {};
let weights: unknown;
for (const file of parts) {
  if (!fs.existsSync(file)) {
    console.log(`missing ${file}: see sandbox/eval-${values.tag}-*.log`);
    continue;
  }
  const part = JSON.parse(fs.readFileSync(file, "utf8")) as { weights: unknown; fights: FightLog[]; rooms?: unknown[]; ends?: { seed: string; victory: boolean }[]; cards?: Record<string, unknown> };
  for (const [k, v] of Object.entries(part.cards ?? {})) cards[k] ??= v;
  weights = part.weights;
  fights.push(...part.fights);
  rooms.push(...(part.rooms ?? []));
  ends.push(...(part.ends ?? []));
  fs.rmSync(file);
}
const merged = path.join(runs, `eval-${values.tag}.json`);
fs.writeFileSync(merged, JSON.stringify({ tag: values.tag, policy: values.policy, choices: values.choices, ascension: Number(values.ascension), flags: values.flags, weights, fights, rooms, ends, cards }, null, 1));

const bySeed = new Map<string, FightLog[]>();
for (const f of fights) bySeed.set(f.seed, [...(bySeed.get(f.seed) ?? []), f]);
const floors = [...bySeed].sort(([a], [b]) => a.localeCompare(b)).map(([seed, fs_]) => {
  const last = fs_[fs_.length - 1]!;
  return `${seed.slice(-2)}:${last.floor}${last.won ? "+" : ""}`;
});
const mean = [...bySeed.values()].reduce((a, fs_) => a + fs_[fs_.length - 1]!.floor, 0) / Math.max(1, bySeed.size);
console.log(`${values.tag}  weights ${JSON.stringify(weights)}`);
console.log(`floors reached (last fight's floor; + if it was won): ${floors.join(" ")}  mean ${mean.toFixed(1)}`);
const wins = ends.filter((e) => e.victory).map((e) => e.seed.slice(-2));
console.log(`victories: ${wins.length} of ${ends.length} runs${wins.length ? ` (seeds ${wins.join(" ")})` : ""}`);
console.log(summarise(values.tag, fights).split("\n").filter((l) => !l.startsWith("    ")).join("\n"));
console.log(`${((Date.now() - t0) / 60000).toFixed(1)} min, merged into ${path.relative(here, merged)}`);
