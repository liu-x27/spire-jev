/**
 * An evaluation, digested for a reader: why runs end where they end.
 *
 *   node src/digest.ts runs/eval-crules5.json [--out runs/digest-crules5.md] [--fights 12]
 *
 * Summary (floors, deaths by fight, bosses, potions), one line per run (how
 * far, what killed it, HP coming in, the deck's own cards, relics, potions
 * left), the choices made outside combat, and turn-by-turn accounts of the
 * boss fights lost and the costliest other deaths. Small enough to read whole.
 */

import fs from "node:fs";
import { parseArgs } from "node:util";
import type { FightLog, RoomLog } from "./run-fights.ts";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: "string" }, fights: { type: "string", default: "12" } } });
const file = positionals[0];
if (!file) throw new Error("usage: digest.ts runs/eval-x.json");
const data = JSON.parse(fs.readFileSync(file, "utf8")) as { tag?: string; weights?: unknown; fights: FightLog[]; rooms?: RoomLog[] };
const fights = data.fights;
const rooms = data.rooms ?? [];
const out: string[] = [];
const say = (s = "") => out.push(s);

const BOSSES = /^(VANTOM|THE_INSATIABLE|QUEEN|TEST_SUBJECT|AEONGLASS|THE_KIN|WATERFALL_GIANT|CEREMONIAL_BEAST|KNOWLEDGE_DEMON|SOUL_FYSH|LAGAVULIN_MATRIARCH)$/;
const bySeed = new Map<string, FightLog[]>();
for (const f of fights) bySeed.set(f.seed, [...(bySeed.get(f.seed) ?? []), f]);
const ends = [...bySeed].map(([seed, fs_]) => ({ seed, fights: fs_, last: fs_[fs_.length - 1]! }));
const starters = new Set(["STRIKE_IRONCLAD", "DEFEND_IRONCLAD", "BASH"]);
const lastRoom = (seed: string, floor: number) => [...rooms].reverse().find((r) => r.seed === seed && r.floor <= floor);
const shortBrief = (b: string) => b.replace(/_POWER/g, "").replace(/\{"DamageIncrease":1\.5\}/g, "").replace(/\{"DamageDecrease":0\.75\}/g, "").replace(/\{"Decrement":1\}/g, "");

say(`# Digest of ${data.tag ?? file}`);
say();
say(`Weights: \`${JSON.stringify(data.weights)}\`. ${ends.length} runs, ${fights.length} fights (${fights.filter((f) => f.won).length} won).`);
const floors = ends.map((e) => e.last.floor).sort((a, b) => a - b);
// A boss is beaten if the run went past its floor, or won the fight on it (a run can stop there).
const beaten = (floor: number) => ends.filter((e) => e.last.floor > floor || (e.last.floor === floor && e.last.won)).length;
const reached = (floor: number) => ends.filter((e) => e.last.floor >= floor).length;
say(`Floors reached: mean ${(floors.reduce((a, b) => a + b, 0) / floors.length).toFixed(1)}, median ${floors[Math.floor(floors.length / 2)]}. Act 1 boss (floor 17) reached by ${reached(17)}, beaten by ${beaten(17)}; act 2 boss (33) reached by ${reached(33)}, beaten by ${beaten(33)}; act 3 boss (48) reached by ${reached(48)}, beaten by ${beaten(48)}. Acts are floors 1-17, 18-33, 34-48 (A10: a second boss on 49).`);
say();

say("## Deaths by fight");
const deaths: Record<string, number> = {};
for (const e of ends) if (!e.last.won) deaths[e.last.enemies.join("+")] = (deaths[e.last.enemies.join("+")] ?? 0) + 1;
for (const [k, n] of Object.entries(deaths).sort((a, b) => b[1] - a[1])) say(`- ${n} × ${k}`);
const stopped = ends.filter((e) => e.last.won);
if (stopped.length) say(`- ${stopped.length} runs ended on a won fight (the game process died or a screen stalled): ${stopped.map((e) => `${e.seed} f${e.last.floor}`).join(", ")}`);
say();

say("## Bosses and elites");
const tally = new Map<string, { n: number; won: number; hpIn: number[]; lost: number[] }>();
for (const f of fights) {
  const k = f.enemies.find((e) => BOSSES.test(e)) ?? (f.maxHp && f.enemies.length === 1 ? f.enemies[0]! : f.enemies.join("+"));
  const t = tally.get(k) ?? { n: 0, won: 0, hpIn: [], lost: [] };
  t.n++;
  if (f.won) t.won++;
  t.hpIn.push(f.hpStart);
  t.lost.push(f.hpLost);
  tally.set(k, t);
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
for (const [k, t] of [...tally].filter(([, t]) => t.n >= 3 || t.won < t.n).sort((a, b) => (a[1].won / a[1].n) - (b[1].won / b[1].n)).slice(0, 25)) {
  say(`- ${k}: ${t.won}/${t.n} won; HP coming in ${mean(t.hpIn).toFixed(0)}, HP lost ${mean(t.lost).toFixed(0)}`);
}
say();

let drunk = 0;
const drunkBy: Record<string, number> = {};
for (const f of fights) for (const [k, n] of Object.entries(f.cardsPlayed)) if (k.startsWith("POTION:")) { drunk += n; drunkBy[k.slice(7)] = (drunkBy[k.slice(7)] ?? 0) + n; }
say(`## Potions: ${drunk} drunk. Held at the start of the fatal fight (not at death): ${ends.filter((e) => !e.last.won).map((e) => e.last.potions.length).join(" ")}`);
say(`Drunk most: ${Object.entries(drunkBy).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} ${n}`).join(", ")}`);
say();

say("## Choices outside combat");
const byPhase: Record<string, Record<string, number>> = {};
for (const r of rooms) {
  const key = r.chosen.replace(/^choose_card:\d+:/, "take ").replace(/^choose_card_select:\d+:/, "select ").replace(/^shop_buy:\d+:/, "buy ").replace(/^choose_event:\d+/, `event ${(r.room?.details as { event_id?: string } | undefined)?.event_id ?? "?"}`);
  const p = r.phase + (r.phase === "card_select" ? ` ${(r.room?.details as { purpose?: string } | undefined)?.purpose ?? ""}` : "");
  (byPhase[p] ??= {})[key] = ((byPhase[p] ??= {})[key] ?? 0) + 1;
}
for (const [p, m] of Object.entries(byPhase)) say(`- ${p}: ${Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, n]) => `${k} ${n}`).join(", ")}`);
say();

say("## One line per run");
say("seed | floor | ended by | HP in | deck's own cards (size), from the last screen before | relics | potions at the last fight's start");
say("---|---|---|---|---|---|---");
for (const e of ends.sort((a, b) => a.seed.localeCompare(b.seed))) {
  const room = lastRoom(e.seed, e.last.floor);
  const deck = room?.deck ?? [];
  const own = deck.filter((c) => !starters.has(c));
  const counts: Record<string, number> = {};
  for (const c of own) counts[c] = (counts[c] ?? 0) + 1;
  const ownText = Object.entries(counts).map(([c, n]) => (n > 1 ? `${c}×${n}` : c)).join(" ");
  const strikes = deck.filter((c) => c === "STRIKE_IRONCLAD").length;
  const defends = deck.filter((c) => c === "DEFEND_IRONCLAD").length;
  say(`${e.seed.slice(-2)} | ${e.last.floor} | ${e.last.won ? "(stopped)" : e.last.enemies.join("+")} | ${e.last.hpStart}/${e.last.maxHp} | ${ownText} + ${strikes}S ${defends}D (${deck.length}) | ${e.last.relics.join(" ")} | ${e.last.potions.join(" ") || "-"}`);
}
say();

say("## Boss fights lost, turn by turn");
const lostBoss = fights.filter((f) => !f.won && f.enemies.some((e) => BOSSES.test(e)));
const nonBoss = ends.filter((e) => !e.last.won && !e.last.enemies.some((x) => BOSSES.test(x))).map((e) => e.last);
const show = (f: FightLog) => {
  say(`### ${f.seed} floor ${f.floor}: ${f.enemies.join("+")} — HP ${f.hpStart}/${f.maxHp}, ${f.turns} turns, potions at start ${f.potions.join(" ") || "-"}`);
  say(`played: ${Object.entries(f.cardsPlayed).map(([k, n]) => `${k}${n > 1 ? `×${n}` : ""}`).join(" ")}`);
  for (const t of f.endTurn) say(`- t${t.turn} lost ${t.actual}: ${shortBrief(t.before)}`);
  say();
};
const perKind = new Map<string, number>();
for (const f of lostBoss) {
  const k = f.enemies.find((e) => BOSSES.test(e))!;
  if ((perKind.get(k) ?? 0) >= 3) continue;
  perKind.set(k, (perKind.get(k) ?? 0) + 1);
  show(f);
}
say("## Other deaths, the first few turn by turn");
for (const f of nonBoss.slice(0, Number(values.fights))) show(f);

const target = values.out ?? file.replace(/eval-(.*)\.json$/, "digest-$1.md");
fs.writeFileSync(target, out.join("\n"));
console.log(`${target}: ${out.length} lines, ${(out.join("\n").length / 1024).toFixed(0)} KB`);
