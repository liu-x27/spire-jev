/**
 * A deck played out against a model boss, in the simulator — what a card adds
 * to a deck, measured by the planner that will play it (--flags spar).
 *
 *   node src/spar.ts build            → data/card-catalog.json from every run's card catalogue
 *   node src/spar.ts "STRIKE_IRONCLAD,..." [VANTOM|THE_INSATIABLE]
 *
 * The card rules count cards by kind ("a Strength source", "two draw
 * cards"); astra-review-3 found act 2 decks losing to The Insatiable on output
 * and defence together (31.5 damage a turn, 127 of its 341 HP left when they
 * died) while Inflame was taken 0 of 16 times. Here a deck is shuffled, drawn
 * and played by planTurn for a few turns against the boss's own script
 * (intents.ts; its HP at A10), the draws real this time (setKnownDraws) —
 * over a few shuffles, the same ones for every deck compared (common random
 * numbers), so the difference a card makes is not drowned in draw luck.
 * A card's worth is the score with it minus the score without.
 */

import fs from "node:fs";
import path from "node:path";
import { setIntentAscension } from "./intents.ts";
import { expectedIntents, planTurn, TURN_WEIGHTS } from "./search.ts";
import type { CardObs } from "./obs.ts";
import { type Card, cardOf, type Enemy, play, setKnownDraws, type State } from "./sim.ts";
import { nextTurn, seeded } from "./turn.ts";

const CATALOG_FILE = path.resolve(import.meta.dirname, "..", "data", "card-catalog.json");

let catalog: Record<string, Omit<CardObs, "index" | "can_play">> | undefined;
function cards(): Record<string, Omit<CardObs, "index" | "can_play">> {
  if (!catalog) {
    try {
      catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8")) as Record<string, Omit<CardObs, "index" | "can_play">>;
    } catch {
      catalog = {};
    }
  }
  return catalog;
}

/** A deck id ("POMMEL_STRIKE+") as the simulator's card, from the catalogue (the unupgraded one if the upgrade was never seen). */
export function cardFromId(id: string): Card | undefined {
  const c = cards()[id] ?? cards()[id.replace(/\+$/, "")];
  if (!c) return undefined;
  return cardOf({ ...c, index: 0, can_play: true } as CardObs);
}

export interface Boss {
  model: string;
  hp: number;
  powers: Record<string, number>;
}
/** The act bosses at A10 (docs/a10-combat-research.md). */
export const BOSSES: Record<string, Boss> = {
  VANTOM: { model: "VANTOM", hp: 183, powers: { SLIPPERY: 9 } },
  THE_INSATIABLE: { model: "THE_INSATIABLE", hp: 341, powers: {} },
  // 250 HP at A8+ (wiki, v0.107.1; our A10 logs agree), Steam Eruption 20 from its opening
  // Pressurize and +3 a move: 17 here, so that turn N starts at 20 + 3(N-2) as in the game.
  WATERFALL_GIANT: { model: "WATERFALL_GIANT", hp: 250, powers: { STEAM_ERUPTION: 17 } },
};

export interface Bout {
  damage: number;
  hpLost: number;
  won: boolean;
  turns: number;
}

/** Won: nothing alive, and no killed Waterfall Giant's DeathBlow still to come. */
const over = (s: State) => s.enemies.every((e) => !e.alive && !((e.deathBlow ?? 0) > 0));

/**
 * One shuffle of the deck against the boss, for at most `turns` turns (The Insatiable's Sandpit gives
 * about eight), and the two turns a killed Waterfall Giant takes to strike.
 */
export function bout(deck: readonly Card[], boss: Boss, rng: () => number, turns = 8, hp = 80): Bout {
  const pile = [...deck];
  for (let i = pile.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pile[i], pile[j]] = [pile[j]!, pile[i]!];
  }
  const enemy: Enemy = {
    id: 1, model: boss.model, hp: boss.hp, maxHp: boss.hp, block: 0, alive: true, powers: { ...boss.powers },
    weakAtStart: false, startStrength: 0, intents: [],
  };
  enemy.intents = expectedIntents(enemy, 1);
  let s: State = {
    player: { hp, maxHp: hp, block: 0, powers: {} }, energy: 3, maxEnergy: 3, turn: 1,
    hand: pile.splice(pile.length - 5, 5), draw: pile, discard: [], exhaust: [], enemies: [enemy],
    drawn: 0, exact: true, lostHp: false, exhaustedThisTurn: false, relics: [], played: 0, skills: 0,
    unmovableUsed: false, potions: [], potionSlots: 0, potionsUsed: 0,
  };
  const blowing = (st: State) => st.enemies.some((e) => !e.alive && (e.deathBlow ?? 0) > 0);
  for (let t = 1; t <= turns || blowing(s); t++) {
    for (let step = 0; step < 15; step++) {
      const a = planTurn(s, TURN_WEIGHTS, 3000).actions[0];
      if (!a || a.kind !== "play") break;
      setKnownDraws(true);
      try {
        s = play(s, a);
      } finally {
        setKnownDraws(false);
      }
      if (over(s)) return { damage: boss.hp, hpLost: hp - s.player.hp, won: true, turns: t };
      if (s.player.hp <= 0) return { damage: boss.hp - s.enemies[0]!.hp, hpLost: hp, won: false, turns: t };
    }
    const next = nextTurn(s, rng, expectedIntents);
    if (!next) return { damage: boss.hp - s.enemies[0]!.hp, hpLost: hp, won: false, turns: t };
    s = next;
    if (over(s)) return { damage: boss.hp, hpLost: hp - s.player.hp, won: true, turns: t };
  }
  return { damage: boss.hp - s.enemies[0]!.hp, hpLost: hp - s.player.hp, won: false, turns };
}

/** A deck's score against a boss: damage dealt, a win's worth, HP lost; the mean over `samples` shuffles from `seed`. */
export function sparScore(ids: readonly string[], boss: Boss, samples = 8, seed = 1): number {
  const deck = ids.map(cardFromId).filter((c): c is Card => c !== undefined);
  let total = 0;
  for (let i = 0; i < samples; i++) {
    const b = bout(deck, boss, seeded(seed * 1000 + i));
    total += b.damage + (b.won ? 60 : 0) - 0.7 * b.hpLost;
  }
  return total / samples;
}

/** The boss a deck is measured against in each act (acts 1-2 of this pool; act 3 against the act 2 one for now). */
export const bossForAct = (act: number): Boss => (act === 0 ? BOSSES["VANTOM"]! : BOSSES["THE_INSATIABLE"]!);

/** The act's boss by its encounter id ("WATERFALL_GIANT_BOSS"), where it is modelled here; else the act's default. */
export function bossFor(encounter: string, act: number): Boss {
  return BOSSES[encounter.replace(/^ENCOUNTER\./, "").replace(/_BOSS$/, "")] ?? bossForAct(act);
}

if (import.meta.main) {
  const [arg, bossName] = process.argv.slice(2);
  if (arg === "build") {
    const runs = path.resolve(import.meta.dirname, "..", "runs");
    const out: Record<string, unknown> = {};
    for (const f of fs.readdirSync(runs).filter((x) => x.endsWith(".json"))) {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(runs, f), "utf8")) as { cards?: Record<string, unknown> };
        for (const [k, v] of Object.entries(d.cards ?? {})) out[k] ??= v;
      } catch {
        // not a run file
      }
    }
    fs.mkdirSync(path.dirname(CATALOG_FILE), { recursive: true });
    fs.writeFileSync(CATALOG_FILE, `${JSON.stringify(out, null, 1)}\n`);
    console.log(`${Object.keys(out).length} cards → ${CATALOG_FILE}`);
  } else if (arg) {
    setIntentAscension(10);
    const t0 = performance.now();
    const boss = BOSSES[bossName ?? "THE_INSATIABLE"]!;
    console.log(`${boss.model}: score ${sparScore(arg.split(","), boss).toFixed(1)} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  }
}
