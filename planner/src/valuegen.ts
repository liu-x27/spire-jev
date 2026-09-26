/**
 * Training data for value.ts: boss bouts played out in the simulator (spar.ts bout, fought out), every
 * end of turn's features with the bout's outcome score (spar.ts outcomeScore).
 *
 *   node src/valuegen.ts --out runs/value-data/iter0.jsonl [--policy turn|value] [--bouts 4]
 *     [--human <ic_a10_act3.jsonl>] [--libraries saves-f47-all,saves-vet-s3f,...] [--seed 1]
 *
 * The decks: the save libraries' (floors 16, 32, 47: each against its act's bosses, its own and the
 * others, a varied HP) and, with --human, A10 winners' and losers' act 3 decks (Spire Codex's
 * v0.111.0 export) against the act 3 bosses. --policy value plays the bouts with the net (the next
 * iteration's data, from a better player).
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { setIntentAscension } from "./intents.ts";
import { BARE, BOSSES, type Boss, bout, cardFromId, outcomeScore, type Player, SPAR5_TURNS, useBoutPlanner } from "./spar.ts";
import { planTurn, planTurnValue, TURN_WEIGHTS, useValueNet } from "./search.ts";
import { type Card, type State } from "./sim.ts";
import { seeded } from "./turn.ts";
import { features, loadValueNet } from "./value.ts";

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    policy: { type: "string", default: "turn" },
    bouts: { type: "string", default: "4" },
    human: { type: "string" },
    // The first N lines of --human left out (the pilot's decks, held out of training).
    "human-skip": { type: "string", default: "0" },
    libraries: { type: "string", default: "saves-f47-all,saves-vet-s3f,saves-vet-dev,saves-vet-conf,saves-vet-spar" },
    seed: { type: "string", default: "1" },
    net: { type: "string" },
    // --policy value: the net's share added to the evaluation (0: the net alone).
    mix: { type: "string", default: "1" },
  },
});
if (!values.out) throw new Error("--out is required");
setIntentAscension(10);

const ACT_BOSSES: string[][] = [
  ["VANTOM", "WATERFALL_GIANT", "THE_KIN", "CEREMONIAL_BEAST", "LAGAVULIN_MATRIARCH", "SOUL_FYSH"],
  ["THE_INSATIABLE", "KNOWLEDGE_DEMON", "KAISER_CRAB"],
  ["AEONGLASS", "QUEEN", "TEST_SUBJECT"],
];
interface Deck { ids: string[]; maxHp: number; hp: number; relics: string[]; relicVars?: Record<string, Record<string, number>>; act: number; own?: string }
const decks: Deck[] = [];
const runs = path.resolve(import.meta.dirname, "..", "runs");
for (const lib of values.libraries!.split(",")) {
  const dir = path.join(runs, lib);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => /-f(16|32|47)-/.test(x))) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const p = s.players[0];
      const act = s.current_act_index as number;
      decks.push({
        ids: p.deck.map((c: { id: string; current_upgrade_level?: number }) => c.id.replace("CARD.", "") + ((c.current_upgrade_level ?? 0) > 0 ? "+" : "")),
        maxHp: p.max_hp, hp: p.current_hp ?? p.max_hp,
        relics: (p.relics ?? []).map((x: { id: string } | string) => (typeof x === "string" ? x : x.id).replace(/^RELIC\./, "")),
        act, own: String(s.acts[act].rooms.boss_id ?? "").replace(/^ENCOUNTER\./, "").replace(/_BOSS$/, ""),
      });
    } catch {
      // not a save the simulator can read
    }
  }
}
if (values.human) {
  for (const l of fs.readFileSync(values.human, "utf8").trim().split("\n").slice(Number(values["human-skip"]))) {
    const r = JSON.parse(l);
    if (!r.bosses?.[0]) continue;
    decks.push({
      ids: r.deck_raw ? r.deck_raw.map((c: { id: string; current_upgrade_level?: number }) => c.id.replace("CARD.", "") + ((c.current_upgrade_level ?? 0) > 0 ? "+" : "")) : r.deck_ids,
      maxHp: r.bosses[0].maxhp_before, hp: r.bosses[0].hp_before ?? r.bosses[0].maxhp_before,
      relics: (r.relics ?? []).map((x: unknown) => String(x).replace(/^RELIC\./, "")),
      act: 2, own: String(r.bosses[0].enc).replace(/_BOSS$/, ""),
    });
  }
}

const net = values.policy === "value" ? loadValueNet(values.net) : undefined;
if (values.policy === "value") {
  if (!net) throw new Error("--policy value needs data/value-net.json (or --net)");
  useValueNet(net, Number(values.mix));
  useBoutPlanner((s) => planTurnValue(s, TURN_WEIGHTS, 3000));
} else useBoutPlanner((s) => planTurn(s, TURN_WEIGHTS, 3000));

fs.mkdirSync(path.dirname(path.resolve(values.out)), { recursive: true });
const out = fs.openSync(path.resolve(values.out), "w");
const rng = seeded(Number(values.seed) * 7777);
const perDeck = Number(values.bouts);
let rows = 0;
let fights = 0;
let wins = 0;
const t0 = performance.now();
for (const [di, d] of decks.entries()) {
  const deck = d.ids.map(cardFromId).filter((c): c is Card => c !== undefined);
  if (deck.length < 5) continue;
  const pool = ACT_BOSSES[Math.max(0, Math.min(2, d.act))]!;
  for (let b = 0; b < perDeck; b++) {
    // Its own boss first, then the act's others at random.
    const name = b === 0 && d.own && BOSSES[d.own] ? d.own : pool[Math.floor(rng() * pool.length)]!;
    const boss: Boss | undefined = BOSSES[name];
    if (!boss) continue;
    // A varied HP: half of max to all of it (what a boss fight starts with, rests before it).
    const hp = Math.max(1, Math.round(d.maxHp * (0.5 + 0.5 * rng())));
    const me: Player = { ...BARE, hp, maxHp: d.maxHp, relics: d.relics, ...(d.relicVars ? { relicVars: d.relicVars } : {}) };
    const states: number[][] = [];
    const turnsOf: number[] = [];
    const result = bout(deck, boss, seeded(di * 1009 + b * 31 + Number(values.seed)), SPAR5_TURNS, me, (s: State) => {
      states.push(features(s));
      turnsOf.push(s.turn ?? 1);
    });
    const y = outcomeScore(result, me);
    fights++;
    if (result.won) wins++;
    for (const [i, x] of states.entries()) {
      fs.writeSync(out, `${JSON.stringify({ g: fights, x, y, boss: boss.model, turn: turnsOf[i], won: result.won ? 1 : 0 })}\n`);
      rows++;
    }
  }
  if (di % 50 === 0) console.log(`${di}/${decks.length} decks, ${fights} bouts (${wins} won), ${rows} rows, ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}
fs.closeSync(out);
console.log(`${values.policy}: ${fights} bouts (${((100 * wins) / Math.max(1, fights)).toFixed(1)}% won), ${rows} rows → ${values.out}, ${((performance.now() - t0) / 60000).toFixed(1)} min`);
