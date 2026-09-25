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
import { moveIntents } from "./scripts.ts";
import { type Card, cardOf, type Enemy, formsToCome, play, setKnownDraws, type State } from "./sim.ts";
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
  /** Its first move, for a boss scripts.ts plays (the rest follow from it); else intents.ts guesses. */
  move?: string;
  /** Block it starts with (the Lagavulin Matriarch's Plating), and its powers' own numbers. */
  block?: number;
  powerVars?: Record<string, Record<string, number>>;
  /** The encounter's other monsters: The Kin's followers, the Kaiser Crab's Rocket. */
  with?: Omit<Boss, "with" | "player">[];
  /** What the encounter puts on the player (the Crab's Surrounded, facing the Rocket). */
  player?: Record<string, number>;
  /**
   * spar2: the turns a bout plays against it, where eight is too few for the fight to be decided (the
   * Waterfall Giant's DeathBlow comes after a kill that takes ten; Knowledge Demon heals back).
   */
  turns?: number;
}
/** The act bosses at A10 (docs/a10-combat-research.md; the eight from the IL, scratchpad specs). */
export const BOSSES: Record<string, Boss> = {
  VANTOM: { model: "VANTOM", hp: 183, powers: { SLIPPERY: 9 } },
  THE_INSATIABLE: { model: "THE_INSATIABLE", hp: 341, powers: {} },
  // 250 HP at A8+ (wiki, v0.107.1; our A10 logs agree), Steam Eruption 20 from its opening
  // Pressurize and +3 a move: 17 here, so that turn N starts at 20 + 3(N-2) as in the game.
  WATERFALL_GIANT: { model: "WATERFALL_GIANT", hp: 250, powers: { STEAM_ERUPTION: 17 }, turns: 12 },
  // The Priest is the one to kill: its followers are minions, gone with it.
  THE_KIN: {
    model: "KIN_PRIEST", hp: 199, powers: {}, move: "ORB_OF_FRAILTY_MOVE",
    with: [
      { model: "KIN_FOLLOWER", hp: 62, powers: { MINION: 1 }, move: "POWER_DANCE_MOVE" },
      { model: "KIN_FOLLOWER", hp: 63, powers: { MINION: 1 }, move: "QUICK_SLASH_MOVE" },
    ],
  },
  CEREMONIAL_BEAST: { model: "CEREMONIAL_BEAST", hp: 262, powers: {}, move: "STAMP_MOVE" },
  LAGAVULIN_MATRIARCH: { model: "LAGAVULIN_MATRIARCH", hp: 233, powers: { ASLEEP: 3, PLATING: 12 }, block: 12, move: "SLEEP_MOVE" },
  SOUL_FYSH: { model: "SOUL_FYSH", hp: 221, powers: {}, move: "BECKON_MOVE" },
  KNOWLEDGE_DEMON: { model: "KNOWLEDGE_DEMON", hp: 399, powers: {}, move: "CURSE_OF_KNOWLEDGE_MOVE", turns: 12 },
  KAISER_CRAB: {
    model: "CRUSHER", hp: 219, powers: { BACK_ATTACK_LEFT: 1, CRAB_RAGE: 1 }, move: "THRASH_MOVE", turns: 12,
    powerVars: { CRAB_RAGE: { StrengthPower: 6, Block: 99 } },
    with: [{ model: "ROCKET", hp: 209, powers: { BACK_ATTACK_RIGHT: 1, CRAB_RAGE: 1 }, move: "TARGETING_RETICLE_MOVE", powerVars: { CRAB_RAGE: { StrengthPower: 6, Block: 99 } } }],
    player: { SURROUNDED: 1 },
  },
  TEST_SUBJECT: { model: "TEST_SUBJECT", hp: 111, powers: { ADAPTABLE: 1, ENRAGE: 3 }, move: "BITE_MOVE", turns: 12 },
  AEONGLASS: {
    model: "AEONGLASS", hp: 535, powers: { WITHERING_PRESENCE: 6, ARTIFACT: 3 }, move: "EBB_MOVE", turns: 12,
    powerVars: { WITHERING_PRESENCE: { CardsLeft: 6 } },
  },
};

export interface Bout {
  damage: number;
  hpLost: number;
  won: boolean;
  turns: number;
}

/** Won: nothing alive, no killed Waterfall Giant's DeathBlow still to come, no Test Subject to respawn. */
const over = (s: State) => s.enemies.every((e) => !e.alive && !((e.deathBlow ?? 0) > 0) && !((e.revive ?? 0) > 0));
/** The HP a fight still needs: every monster's, and the Test Subject's forms to come. */
const pool = (s: State) => s.enemies.reduce((a, e) => a + (e.alive ? e.hp : 0) + formsToCome(e), 0);

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
  // The monsters as the fight opens; a scripted boss shows its first move (a claw behind the player
  // with it: the player faces the Rocket, the last monster, at the start).
  const monsters = [boss, ...(boss.with ?? [])];
  const surrounded = (boss.player?.["SURROUNDED"] ?? 0) > 0;
  const enemies = monsters.map((m, i): Enemy => {
    const e: Enemy = {
      id: i + 1, model: m.model, hp: m.hp, maxHp: m.hp, block: m.block ?? 0, alive: true, powers: { ...m.powers },
      weakAtStart: false, startStrength: 0, intents: [],
      ...(m.powerVars ? { powerVars: m.powerVars } : {}),
      ...(m.move ? { move: m.move } : {}),
    };
    const behind = surrounded && i < monsters.length - 1;
    e.intents = m.move ? moveIntents(m.model, m.move, 0, { vulnerable: false, weak: false, behind }) : expectedIntents(e, 1);
    if (behind) e.behindAtStart = true;
    return e;
  });
  let s: State = {
    player: { hp, maxHp: hp, block: 0, powers: { ...(boss.player ?? {}) } }, energy: 3, maxEnergy: 3, turn: 1,
    hand: pile.splice(pile.length - 5, 5), draw: pile, discard: [], exhaust: [], enemies,
    drawn: 0, exact: true, lostHp: false, exhaustedThisTurn: false, relics: [], played: 0, skills: 0,
    unmovableUsed: false, potions: [], potionSlots: 0, potionsUsed: 0,
    ...(surrounded ? { facing: monsters.length } : {}),
  };
  const full = pool(s);
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
      if (over(s)) return { damage: full, hpLost: hp - s.player.hp, won: true, turns: t };
      if (s.player.hp <= 0) return { damage: full - pool(s), hpLost: hp, won: false, turns: t };
    }
    const next = nextTurn(s, rng, expectedIntents);
    if (!next) return { damage: full - pool(s), hpLost: hp, won: false, turns: t };
    s = next;
    if (over(s)) return { damage: full, hpLost: hp - s.player.hp, won: true, turns: t };
  }
  return { damage: full - pool(s), hpLost: hp - s.player.hp, won: false, turns };
}

/** A deck's score against a boss: damage dealt, a win's worth, HP lost; the mean over `samples` shuffles from `seed`. */
let bossTurns = false;
/** spar2: each boss's own horizon (Boss.turns), not eight turns for every one. */
export function useBossTurns(on: boolean): void {
  bossTurns = on;
}

export function sparScore(ids: readonly string[], boss: Boss, samples = 8, seed = 1): number {
  const deck = ids.map(cardFromId).filter((c): c is Card => c !== undefined);
  let total = 0;
  for (let i = 0; i < samples; i++) {
    const b = bout(deck, boss, seeded(seed * 1000 + i), bossTurns ? boss.turns ?? 8 : 8);
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
