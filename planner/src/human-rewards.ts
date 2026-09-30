/**
 * The bot's card choices on human reward screens, with no game: A10 runs from the Spire Codex export
 * (the character's, v0.111.0; winners only by default), each sampled reward screen rebuilt as the bot
 * would see it — the deck then (the run's final deck, the cards added by that floor; cards removed
 * before the end are not known), the relics then, HP, gold, the act's boss from the run's own boss
 * room — and put to chooseCardReward under a set of flags. How often the bot takes what the human took
 * (a skip included), and what it takes instead.
 *
 *   node src/human-rewards.ts --runs <export.jsonl> --character REGENT [--flags a,b] [--choices rules2]
 *        [--every 10] [--max 200] [--acts 1,2,3] [--all] --out runs/human-rewards-X.json
 *
 * One set of flags a process (spar's caches do not know the flags). The export is not in the
 * repository (the analysis session's scratchpad).
 */

import fs from "node:fs";
import { parseArgs } from "node:util";
import { setCharacter } from "./character.ts";
import { chooseCardReward, setActBoss } from "./choices.ts";
import type { CardObs, LegalAction, Observation } from "./obs.ts";
import { configure } from "./run-fights.ts";
import { cardFromId } from "./spar.ts";

const { values } = parseArgs({
  options: {
    runs: { type: "string" },
    character: { type: "string", default: "REGENT" },
    flags: { type: "string", default: "" },
    choices: { type: "string", default: "rules2" },
    every: { type: "string", default: "10" },
    max: { type: "string", default: "200" },
    acts: { type: "string", default: "1,2,3" },
    all: { type: "boolean", default: false },
    out: { type: "string" },
  },
});
if (!values.runs || !values.out) throw new Error("--runs and --out are required");
setCharacter(values.character!);
configure(values.flags ? values.flags.split(",") : [], values.choices, 10, {});
const acts = new Set(values.acts!.split(",").map(Number));
const every = Number(values.every);
const max = Number(values.max);

interface Card { id: string; floor_added_to_deck?: number; current_upgrade_level?: number }
interface Point { map_point_type?: string; rooms?: { room_type?: string; model_id?: string }[]; player_stats: Record<string, unknown>[] }
interface Run { build_id: string; ascension: number; win: boolean; seed: string; players: { character: string; deck: Card[]; relics: Card[] }[]; map_point_history: Point[][] }

const want = `CHARACTER.${values.character}`;
const out: { seed: string; act: number; floor: number; offered: string[]; human: string; bot: string; ms: number }[] = [];
let seen = 0;
const t0 = performance.now();
const strip = (id: string) => id.replace(/^(CARD|RELIC|ENCOUNTER)\./, "");

for (const line of fs.readFileSync(values.runs, "utf8").split("\n")) {
  if (!line.trim() || out.length >= max) continue;
  const r = JSON.parse(line) as Run;
  if (r.build_id !== "v0.111.0" || r.ascension !== 10 || r.players.length !== 1 || r.players[0]!.character !== want) continue;
  if (!values.all && !r.win) continue;
  const p = r.players[0]!;
  let floor = 0;
  r.map_point_history.forEach((points, ai) => {
    const act = ai + 1;
    const boss = points.flatMap((x) => x.rooms ?? []).find((x) => x.room_type === "boss")?.model_id;
    for (const point of points) {
      floor++;
      if (!acts.has(act) || !boss || out.length >= max) continue;
      const room = point.rooms?.[0]?.room_type;
      if (room !== "monster" && room !== "elite" && room !== "boss") continue;
      const stats = point.player_stats[0] as { card_choices?: { card: Card; was_picked?: boolean }[]; current_hp?: number; max_hp?: number; current_gold?: number };
      const choices = stats.card_choices ?? [];
      if (choices.length < 2 || choices.length > 3) continue;
      if (seen++ % every !== 0) continue;
      // The deck as it was when this reward was offered: the cards added before this floor.
      const deck = p.deck.filter((c) => (c.floor_added_to_deck ?? 0) < floor || ((c.floor_added_to_deck ?? 0) <= 1 && floor > 1))
        .map((c) => strip(c.id));
      const relics = p.relics.filter((c) => (c.floor_added_to_deck ?? 0) <= floor).map((c) => strip(c.id));
      const cards = choices.map((c, i) => {
        const id = strip(c.card.id);
        const up = (c.card.current_upgrade_level ?? 0) > 0;
        const known = cardFromId(up ? `${id}+` : id);
        return {
          index: i, card_id: id, cost: known?.cost ?? 1, current_cost: known?.cost ?? 1, costs_x: known?.costsX ?? false, can_play: true,
          target_type: known?.target ?? "AnyEnemy", upgrades: up ? 1 : 0, keywords: [...(known?.keywords ?? [])], vars: { ...(known?.vars ?? {}) },
          card_type: known?.type ?? "Attack",
        } as CardObs;
      });
      const legal: LegalAction[] = [
        ...cards.map((c, i) => ({ action_id: `choose_card:${i}:${c.card_id}`, action_type: "choose_card", description: "", metadata: { card_index: i, card_id: c.card_id, upgrades: c.upgrades } })),
        { action_id: "skip_card", action_type: "skip_card", description: "" },
      ];
      const o = {
        phase: "card_reward", is_terminal: false, is_victory: false, seed: r.seed, act, floor, gold: stats.current_gold ?? 100,
        act_boss: strip(boss), player_hp: stats.current_hp ?? 50, player_max_hp: stats.max_hp ?? 75, player_block: 0, player_energy: 3,
        player_powers: {}, deck_cards: deck, relics, potions: [], combat: null,
        room: { room_type: "card_reward", options: [], details: { cards } },
      } as unknown as Observation;
      setActBoss(strip(boss));
      const t = performance.now();
      const pick = chooseCardReward(o, legal);
      const name = (id: string) => (id === "skip_card" ? "skip" : `${id.split(":")[2]}${cards[Number(id.split(":")[1])]?.upgrades ? "+" : ""}`);
      const human = choices.findIndex((c) => c.was_picked);
      out.push({
        seed: r.seed, act, floor, offered: cards.map((c) => c.card_id + (c.upgrades ? "+" : "")),
        human: human < 0 ? "skip" : cards[human]!.card_id + (cards[human]!.upgrades ? "+" : ""), bot: name(pick), ms: Math.round(performance.now() - t),
      });
    }
  });
}

fs.writeFileSync(values.out, JSON.stringify(out, null, 1));
const agree = out.filter((x) => x.human === x.bot).length;
const skipsH = out.filter((x) => x.human === "skip").length;
const skipsB = out.filter((x) => x.bot === "skip").length;
console.log(`${values.flags || "(no flags)"}: ${out.length} screens, agree ${agree} (${((100 * agree) / Math.max(1, out.length)).toFixed(0)}%), human skips ${skipsH}, bot skips ${skipsB}, ${((performance.now() - t0) / 1000).toFixed(0)} s`);
for (const a of [1, 2, 3]) {
  const xs = out.filter((x) => x.act === a);
  if (xs.length) console.log(`  act ${a}: ${xs.length} screens, agree ${xs.filter((x) => x.human === x.bot).length}, bot skips ${xs.filter((x) => x.bot === "skip").length}, human skips ${xs.filter((x) => x.human === "skip").length}`);
}
