/**
 * Every card's numbers as the game has them (the bridge's "cards": canonical and upgraded once), into
 * the playing character's catalogue for spar (data/<character>/card-catalog.json): its own pool's
 * cards, and the cards of no character's pool (colourless, tokens like the Sovereign Blade,
 * statuses, curses, events') that the Ironclad's catalogue lacks. A deck is then simulated with cards never
 * met in a fight.
 *
 *   node src/dump-cards.ts [--character REGENT] [--port 47140]
 *
 * The whole dump goes to runs/cards-all.json.
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { Game } from "./bridge.ts";
import { character, dataFile, setCharacter } from "./character.ts";
import type { CardObs } from "./obs.ts";

const { values } = parseArgs({
  options: {
    character: { type: "string" },
    port: { type: "string", default: "47140" },
  },
});
if (values.character) setCharacter(values.character);
const here = path.resolve(import.meta.dirname, "..");
const sandbox = path.join(here, "..", "sandbox", `p${values.port}`);

type Entry = { pool: string; card: CardObs };
const game = await Game.launch(sandbox, Number(values.port));
let dump: { cards: Record<string, Entry>; errors: string[] };
try {
  await game.startRun("JEV00001", 10);
  dump = await game.call("cards");
} finally {
  await game.kill();
}
fs.mkdirSync(path.join(here, "runs"), { recursive: true });
fs.writeFileSync(path.join(here, "runs", "cards-all.json"), JSON.stringify(dump, null, 1));

const main = JSON.parse(fs.readFileSync(path.join(here, "data", "card-catalog.json"), "utf8")) as Record<string, unknown>;
const pools = new Set(Object.values(dump.cards).map((e) => e.pool).filter((p) => p !== ""));
const own = [...pools].find((p) => p.includes(character()));
const characterPool = (p: string) => /IRONCLAD|SILENT|DEFECT|NECROBINDER|REGENT/.test(p);
const out: Record<string, Omit<CardObs, "index" | "can_play">> = {};
for (const [id, e] of Object.entries(dump.cards)) {
  if (!(e.pool === own || (!characterPool(e.pool) && !(id in main)))) continue;
  const { index: _i, can_play: _c, ...card } = e.card;
  out[id] = card;
}
const file = dataFile("card-catalog.json");
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, `${JSON.stringify(Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b))), null, 1)}\n`);
console.log(`${Object.keys(dump.cards).length} cards in the game (pools: ${[...pools].join(", ")}); ${dump.errors.length} errors`);
for (const e of dump.errors.slice(0, 10)) console.log(`  ${e}`);
console.log(`${Object.keys(out).length} cards (${own}'s and the poolless the Ironclad's catalogue lacks) → ${file}`);
