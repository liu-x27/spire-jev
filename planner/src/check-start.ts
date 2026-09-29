/**
 * How a run of the character starts: the character the game plays, the ascension, HP, deck, relics,
 * and each act's rooms from current_run.save (what the start draws: the Ancient, the bosses, the
 * elites', events' and hallway fights' orders).
 *
 *   node src/check-start.ts [--character SILENT] [--seed JEV01846] [--ascension 10] [--port 47150] [--check <save>]
 *
 * --check <save>: a save of the same seed (any floor), whose acts' rooms must be the same — the run
 * was drawn as that one was. Run on the Ironclad against a save from before a change to the profile
 * (data/progress-veteran.save), it says whether the change left the Ironclad's runs alone.
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { Game, savesDir } from "./bridge.ts";
import { character, setCharacter } from "./character.ts";

const { values } = parseArgs({
  options: {
    character: { type: "string" },
    seed: { type: "string", default: "JEV01846" },
    ascension: { type: "string", default: "10" },
    port: { type: "string", default: "47150" },
    check: { type: "string" },
  },
});
if (values.character) setCharacter(values.character);
const here = path.resolve(import.meta.dirname, "..");
const sandbox = path.join(here, "..", "sandbox", `p${values.port}`);

/** What of an act's rooms the start draws (the counts of rooms visited move on as the run does). */
const ROOMS = ["ancient_id", "boss_id", "second_boss_id", "elite_encounter_ids", "event_ids", "normal_encounter_ids"];
type Save = { acts?: { id?: string; rooms?: Record<string, unknown> }[] };
const roomsOf = (save: Save) => (save.acts ?? []).map((a) => ({ id: a.id, ...Object.fromEntries(ROOMS.map((k) => [k, a.rooms?.[k] ?? null])) }));

const game = await Game.launch(sandbox, Number(values.port));
try {
  const o = (await game.startRun(values.seed, Number(values.ascension))).observation;
  console.log(`${values.seed}: asked ${character()}, the game plays ${o.character}; ascension ${o.ascension}; HP ${o.player_hp}/${o.player_max_hp}; gold ${o.gold}; ${o.phase}`);
  console.log(`deck ${o.deck_cards.join(" ")}\nrelics ${o.relics.join(" ")}; potions ${o.potions.join(" ") || "-"} (${o.potion_slots} slots)`);
  const current = path.join(savesDir(sandbox), "current_run.save");
  if (!fs.existsSync(current)) throw new Error("no current_run.save after the start");
  const rooms = roomsOf(JSON.parse(fs.readFileSync(current, "utf8")) as Save);
  for (const a of rooms) console.log(`  ${JSON.stringify(a)}`);
  if (values.check) {
    const want = roomsOf(JSON.parse(fs.readFileSync(values.check, "utf8")) as Save);
    const same = JSON.stringify(want) === JSON.stringify(rooms);
    console.log(`\n--check ${path.basename(values.check)}: ${same ? "the same rooms, act for act" : "DIFFERENT"}`);
    if (!same) for (const [i, a] of want.entries()) if (JSON.stringify(a) !== JSON.stringify(rooms[i])) console.log(`  act ${i}: was ${JSON.stringify(a)}`);
    process.exitCode = same ? 0 : 1;
  }
} finally {
  await game.kill();
}
