/**
 * How dependable each stage of a run is, not whether a run got lucky.
 *
 *   node src/stages.ts runs/eval-a.json [runs/eval-b.json …]
 *
 * For each boss floor (17, 33, 48; 49 at A10): runs that reached it, won it,
 * and how — clean (30%+ max HP left, no revival), narrow (under 30%), or
 * revived (the fight took more HP than there was: Lizard Tail, Fairy in a
 * Bottle, healing mid-fight). The first A0 clear was a revival (Lizard Tail
 * in the Queen fight), the second a 7 HP finish: neither is a strategy.
 * Then the deck each run brought to the boss (packages.ts profile): size,
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

for (const file of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(file, "utf8")) as { tag?: string; fights: FightLog[]; rooms?: RoomLog[]; ends?: { seed: string; victory: boolean }[] };
  const rooms = d.rooms ?? [];
  const wins = (d.ends ?? []).filter((e) => e.victory).length;
  console.log(`\n${d.tag ?? file}: ${new Set(d.fights.map((f) => f.seed)).size} runs, ${wins} victories`);
  for (const floor of BOSS_FLOORS) {
    const fights = d.fights.filter((f) => f.floor === floor);
    if (fights.length === 0) continue;
    const won = fights.filter((f) => f.won);
    const revived = won.filter((f) => f.hpLost > f.hpStart);
    const narrow = won.filter((f) => f.hpLost <= f.hpStart && f.hpEnd < 0.3 * f.maxHp);
    const clean = won.length - revived.length - narrow.length;
    const left = won.filter((f) => f.hpLost <= f.hpStart).map((f) => f.hpEnd / f.maxHp);
    console.log(
      `  f${floor} ${fights[0]!.enemies.find((e) => !/TORCH/.test(e)) ?? ""}: won ${won.length}/${fights.length} (${pct(won.length, fights.length)}) — clean ${clean}, narrow ${narrow.length}, revived ${revived.length};` +
        ` HP in ${Math.round(100 * mean(fights.map((f) => f.hpStart / f.maxHp)))}%, left after a win ${Math.round(100 * mean(left))}%`,
    );
    // The deck brought to the boss: the last screen before its floor.
    const decks = fights.map((f) => {
      const r = [...rooms].reverse().find((x) => x.seed === f.seed && x.floor <= floor);
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
