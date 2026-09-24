/**
 * How dependable each stage of a run is, not whether a run got lucky.
 *
 *   node src/stages.ts runs/eval-a.json [runs/eval-b.json …]
 *
 * For each boss floor (17, 33, 48; 49 at A10): runs that reached it, won it,
 * and how — clean (30%+ max HP left, no revival), narrow (under 30%), or
 * revived (Lizard Tail used in the fight, or a Fairy in a Bottle gone without
 * being drunk). The first A0 clear was a revival (Lizard Tail
 * in the Queen fight), the second a 7 HP finish: neither is a strategy.
 * Then the deck each run brought to the boss — the last screen *before* the
 * boss floor (the boss floor's own screens come after the fight: its reward;
 * counting them credited winners with the card they won, astra-review-2) —
 * (packages.ts profile): size,
 * Strikes and Defends left, scaling, draw, AoE, answers to big hits — and
 * the win rate with and without scaling.
 */

import fs from "node:fs";
import { profile } from "./packages.ts";
import type { FightLog, RoomLog } from "./run-fights.ts";

const BOSS_FLOORS = [17, 33, 48, 49];
const AOE = new Set(["CONFLAGRATION", "BREAKTHROUGH", "WHIRLWIND", "HOWL_FROM_BEYOND", "THUNDERCLAP", "INFERNO"]);
const base = (c: string) => c.replace(/\+$/, "");
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "-");
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Whether a revival saved this fight: Lizard Tail's _wasUsed flips by the next fight, or a Fairy vanishes undrunk. */
function revivedIn(f: FightLog, next: FightLog | undefined): boolean {
  const tailBefore = f.relicVars?.["LIZARD_TAIL"]?.["_wasUsed"];
  const tailAfter = next?.relicVars?.["LIZARD_TAIL"]?.["_wasUsed"];
  if (tailBefore === 0 && tailAfter === 1) return true;
  const fairy = (xs: readonly string[]) => xs.filter((p) => p === "FAIRY_IN_A_BOTTLE").length;
  const drunk = f.cardsPlayed["POTION:FAIRY_IN_A_BOTTLE"] ?? 0;
  if (next && fairy(f.potions) - drunk > fairy(next.potions)) return true;
  // The last fight of a run has no next: an unused Lizard Tail or a Fairy held, and the fight won from below zero.
  return !next && f.won && f.hpLost > f.hpStart && (tailBefore === 0 || fairy(f.potions) > 0);
}

for (const file of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(file, "utf8")) as { tag?: string; fights: FightLog[]; rooms?: RoomLog[]; ends?: { seed: string; victory: boolean }[] };
  const rooms = d.rooms ?? [];
  const wins = (d.ends ?? []).filter((e) => e.victory).length;
  console.log(`\n${d.tag ?? file}: ${new Set(d.fights.map((f) => f.seed)).size} runs, ${wins} victories`);
  for (const floor of BOSS_FLOORS) {
    const fights = d.fights.filter((f) => f.floor === floor);
    if (fights.length === 0) continue;
    const won = fights.filter((f) => f.won);
    const nextOf = (f: FightLog) => {
      const run = d.fights.filter((x) => x.seed === f.seed);
      return run[run.indexOf(f) + 1];
    };
    const revived = won.filter((f) => revivedIn(f, nextOf(f)));
    const narrow = won.filter((f) => !revived.includes(f) && f.hpEnd < 0.3 * f.maxHp);
    const clean = won.length - revived.length - narrow.length;
    const left = won.filter((f) => !revived.includes(f)).map((f) => f.hpEnd / f.maxHp);
    // Since the veteran profile each floor has one of three bosses (six in act 1): one line each.
    const bossOf = (f: FightLog) => [...new Set(f.enemies.filter((e) => !/TORCH/.test(e)))].sort().join("+");
    const names = [...new Set(fights.map(bossOf))];
    console.log(
      `  f${floor} ${names.length === 1 ? names[0] : `${names.length} bosses`}: won ${won.length}/${fights.length} (${pct(won.length, fights.length)}) — clean ${clean}, narrow ${narrow.length}, revived ${revived.length};` +
        ` HP in ${Math.round(100 * mean(fights.map((f) => f.hpStart / f.maxHp)))}%, left after a win ${Math.round(100 * mean(left))}%`,
    );
    if (names.length > 1) {
      for (const name of names.sort()) {
        const mine = fights.filter((f) => bossOf(f) === name);
        const w = mine.filter((f) => f.won);
        const c = w.filter((f) => !revived.includes(f) && f.hpEnd >= 0.3 * f.maxHp).length;
        console.log(`     ${name}: won ${w.length}/${mine.length}, clean ${c}; HP in ${Math.round(100 * mean(mine.map((f) => f.hpStart / f.maxHp)))}%`);
      }
    }
    // The deck brought to the boss: the last screen before its floor.
    const decks = fights.map((f) => {
      const r = [...rooms].reverse().find((x) => x.seed === f.seed && x.floor < floor);
      return { f, deck: r?.deck ?? [] };
    });
    const withScaling = decks.filter(({ deck }) => profile(deck).scaling > 0);
    const without = decks.filter(({ deck }) => profile(deck).scaling === 0);
    const p = decks.map(({ deck }) => profile(deck));
    console.log(
      `     deck: ${mean(decks.map((x) => x.deck.length)).toFixed(1)} cards, Strike/Defend left ${mean(decks.map((x) => x.deck.filter((c) => /^(STRIKE|DEFEND)_IRONCLAD/.test(c)).length)).toFixed(1)};` +
        ` scaling ${pct(withScaling.length, decks.length)}, draw>=2 ${pct(p.filter((x) => x.draw >= 2).length, p.length)},` +
        ` AoE ${pct(decks.filter(({ deck }) => deck.some((c) => AOE.has(base(c)))).length, decks.length)}, big-hit answer ${pct(p.filter((x) => x.bigHitAnswers > 0).length, p.length)}` +
        ` | won with scaling ${withScaling.filter((x) => x.f.won).length}/${withScaling.length}, without ${without.filter((x) => x.f.won).length}/${without.length}`,
    );
  }
}
