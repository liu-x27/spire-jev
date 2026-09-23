/**
 * What the game knows, at an ascension: acts, encounter pools, every
 * monster's numbers, and act 1 maps over many seeds.
 *
 *   node src/dump-catalog.ts [--ascension 10] [--seeds 1-20] [--port 47100]
 *
 * Writes runs/catalog-a<N>.json (acts, pools, monsters, as the game computes
 * them at that ascension) and runs/maps-a<N>.json (act 1's map per seed),
 * and prints how act 1's rooms are laid out: which room types appear on
 * which rows, and how many of each a map has. Local reference only: the
 * numbers are the game's, and stay out of the repository.
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { Game } from "./bridge.ts";

interface MapPoint {
  col: number;
  row: number;
  type: string;
  children: [number, number][];
}

const { values } = parseArgs({
  options: {
    ascension: { type: "string", default: "10" },
    seeds: { type: "string", default: "1-20" },
    port: { type: "string", default: "47100" },
  },
});
const ascension = Number(values.ascension);
const [from, to] = values.seeds.split("-").map(Number) as [number, number];
const here = path.resolve(import.meta.dirname, "..");
const sandbox = path.join(here, "..", "sandbox", `p${values.port}`);
const maps: Record<string, unknown> = {};
let catalog: unknown;

for (let seed = from; seed <= to; seed++) {
  const id = `JEV${String(seed).padStart(5, "0")}`;
  const game = await Game.launch(sandbox, Number(values.port));
  try {
    const started = await game.startRun(id, ascension);
    if (catalog === undefined) catalog = await game.call("catalog");
    const map = (await game.call("map")) as { ascension?: number; points?: MapPoint[] };
    maps[id] = map;
    console.log(`${id}: ascension ${map.ascension ?? started.observation.ascension}, ${map.points?.length ?? 0} map points`);
  } catch (err) {
    console.log(`${id}: ${(err as Error).message}`);
  } finally {
    await game.kill();
  }
}

fs.mkdirSync(path.join(here, "runs"), { recursive: true });
fs.writeFileSync(path.join(here, "runs", `catalog-a${ascension}.json`), JSON.stringify(catalog, null, 1));
fs.writeFileSync(path.join(here, "runs", `maps-a${ascension}.json`), JSON.stringify(maps, null, 1));

// How act 1 is laid out: room types by row, and per map.
const byRow = new Map<number, Record<string, number>>();
const perMap: Record<string, number[]> = {};
for (const m of Object.values(maps) as { points?: MapPoint[] }[]) {
  const counts: Record<string, number> = {};
  for (const p of m.points ?? []) {
    const r = byRow.get(p.row) ?? {};
    r[p.type] = (r[p.type] ?? 0) + 1;
    byRow.set(p.row, r);
    counts[p.type] = (counts[p.type] ?? 0) + 1;
  }
  for (const [t, n] of Object.entries(counts)) (perMap[t] ??= []).push(n);
}
console.log("\nact 1 rooms per map (min / mean / max):");
for (const [t, ns] of Object.entries(perMap)) {
  console.log(`  ${t.padEnd(10)} ${Math.min(...ns)} / ${(ns.reduce((a, b) => a + b, 0) / ns.length).toFixed(1)} / ${Math.max(...ns)}`);
}
console.log("\nby row (share of the row's points):");
for (const [row, r] of [...byRow].sort((a, b) => a[0] - b[0])) {
  const total = Object.values(r).reduce((a, b) => a + b, 0);
  console.log(`  row ${String(row).padStart(2)}: ${Object.entries(r).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${Math.round((n / total) * 100)}%`).join(", ")}`);
}
