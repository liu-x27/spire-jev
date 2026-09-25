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
import { expectedIntents, type Plan, planTurn, TURN_WEIGHTS } from "./search.ts";
import type { CardObs } from "./obs.ts";
import { moveIntents } from "./scripts.ts";
import { type Card, cardOf, type Enemy, formsToCome, play, type Potion, redSkull, relicDamage, setKnownDraws, type State } from "./sim.ts";
import { nextTurn, seeded } from "./turn.ts";

// SPIRE_JEV_CATALOG: another catalogue (an older one, to replay the choices it made).
const CATALOG_FILE = process.env["SPIRE_JEV_CATALOG"] ?? path.resolve(import.meta.dirname, "..", "data", "card-catalog.json");

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

/**
 * A card as the game describes it, learnt while playing (run-fights' collect, a reward's or shop's
 * offer): until 2026-09-25 the catalogue was the one built from the locked profile's runs, 112 cards,
 * and 70 of the 201 the veteran decks held (Break, Feeding Frenzy, Dominate, Inferno, every curse)
 * were dropped from both decks compared, their worth 0 (astra-review-4).
 */
export function learnCard(id: string, c: Omit<CardObs, "index" | "can_play">): void {
  const all = cards();
  if (all[id]) return;
  const { affliction: _a, affliction_amount: _b, ...rest } = c as CardObs;
  all[id] = rest;
}

/** A deck id ("POMMEL_STRIKE+") as the simulator's card, from the catalogue (the unupgraded one if the upgrade was never seen). */
export function cardFromId(id: string): Card | undefined {
  const c = cards()[id] ?? cards()[id.replace(/\+$/, "")];
  if (!c) return undefined;
  // Without the catalogue's calculated numbers: they are some other fight's (Tear Asunder's 10 hits,
  // Gold Axe's 21), and sim.ts works them out from the bout's own state.
  return cardOf({ ...c, calculated: {}, index: 0, can_play: true } as CardObs);
}

/** The catalogue has this very card ("BASH+" upgraded), not only its unupgraded self. */
export const knownExactly = (id: string): boolean => cards()[id] !== undefined;

/** The deck ids the catalogue does not know at all: sparScore would leave them out. */
export const unknownCards = (ids: readonly string[]): string[] => ids.filter((id) => !cards()[id] && !cards()[id.replace(/\+$/, "")]);

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
  // The Torch Head Amalgam is her minion: it leaves when she dies (IL: Queen, TorchHeadAmalgam).
  QUEEN: {
    model: "QUEEN", hp: 419, powers: {}, move: "PUPPET_STRINGS_MOVE", turns: 12,
    with: [{ model: "TORCH_HEAD_AMALGAM", hp: 211, powers: { MINION: 1 }, move: "STRONG_TACKLE_MOVE" }],
  },
  TEST_SUBJECT: { model: "TEST_SUBJECT", hp: 111, powers: { ADAPTABLE: 1, ENRAGE: 3 }, move: "BITE_MOVE", turns: 12 },
  AEONGLASS: {
    model: "AEONGLASS", hp: 535, powers: { WITHERING_PRESENCE: 6, ARTIFACT: 3 }, move: "EBB_MOVE", turns: 12,
    powerVars: { WITHERING_PRESENCE: { CardsLeft: 6 } },
  },
};

/**
 * The player a bout plays (spar3, astra-review-4 #1): the run's max HP, its relics and their numbers,
 * and what its last fight opened with (energy, hand, the relics' Strength, Vigor, block); the default
 * is the one every bout played before, an 80-HP Ironclad with three energy and nothing else.
 */
export interface Player {
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  hand: number;
  block: number;
  powers: Record<string, number>;
  relics: readonly string[];
  relicVars?: Record<string, Record<string, number>>;
  /** Its energy, hand, block and powers are a fight's own opening already (spar3's): the relics' opening is in them. */
  opened?: boolean;
  /** The belt the bout may drink from (spar3: the run's own), and its slots. */
  potions?: readonly Potion[];
  potionSlots?: number;
}
export const BARE: Player = { hp: 80, maxHp: 80, energy: 3, maxEnergy: 3, hand: 5, block: 0, powers: {}, relics: [] };

/** The planner a bout plays with (planTurn at 3000 nodes; an experiment can put another: planTurn2, planTurnRoll). */
let boutPlanner: (s: State) => Plan = (s) => planTurn(s, TURN_WEIGHTS, 3000);
export function useBoutPlanner(plan: (s: State) => Plan): void {
  boutPlanner = plan;
}

export interface Bout {
  /** The HP the fight needed in all (every monster's and forms to come): damage / pool is the burden taken off. */
  pool?: number;
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
 * What the player's relics give as a fight opens (IL: BeforeCombatStart, AfterRoomEntered, the first
 * turn's hooks): block, Strength, Dexterity, Plating, Thorns, Vigor, energy, cards, a heal. A live
 * observation shows these already; a bout from a deck needs them, and spar3's opening has them
 * (opened), so they are not given twice. Paper Phrog's marker is not an opening's and always goes on.
 */
export function relicOpening(me: Player): Player {
  const has = (r: string) => me.relics.includes(r);
  const v = (r: string, k: string, fb: number) => me.relicVars?.[r]?.[k] ?? fb;
  const powers: Record<string, number> = { ...me.powers, ...(has("PAPER_PHROG") ? { PAPER_PHROG: 1 } : {}) };
  if (me.opened) return { ...me, powers };
  const add = (k: string, n: number) => {
    powers[k] = (powers[k] ?? 0) + n;
  };
  if (has("VAJRA")) add("STRENGTH", v("VAJRA", "StrengthPower", 1));
  if (has("ODDLY_SMOOTH_STONE")) add("DEXTERITY", v("ODDLY_SMOOTH_STONE", "DexterityPower", 1));
  if (has("GORGET")) add("PLATING", v("GORGET", "PlatingPower", 4));
  if (has("BRONZE_SCALES")) add("THORNS", v("BRONZE_SCALES", "ThornsPower", 3));
  if (has("AKABEKO")) add("VIGOR", v("AKABEKO", "VigorPower", 8));
  // Venerable Tea Set: 2 energy in the fight after a rest site, which a boss's is.
  const tea = has("VENERABLE_TEA_SET") && v("VENERABLE_TEA_SET", "_gainEnergyInNextCombat", 1) === 1 ? v("VENERABLE_TEA_SET", "Energy", 2) : 0;
  return {
    ...me, powers,
    block: me.block + (has("ANCHOR") ? v("ANCHOR", "Block", 10) : 0),
    energy: me.energy + (has("LANTERN") ? v("LANTERN", "Energy", 1) : 0) + tea,
    hand: me.hand + (has("BAG_OF_PREPARATION") ? v("BAG_OF_PREPARATION", "Cards", 2) : 0),
    hp: Math.min(me.maxHp, me.hp + (has("BLOOD_VIAL") ? v("BLOOD_VIAL", "Heal", 2) : 0)),
  };
}

/**
 * One shuffle of the deck against the boss, for at most `turns` turns (The Insatiable's Sandpit gives
 * about eight), and the two turns a killed Waterfall Giant takes to strike.
 */
export function bout(deck: readonly Card[], boss: Boss, rng: () => number, turns = 8, player: Player = BARE): Bout {
  const me = relicOpening(player);
  const hp = player.hp;
  const pile = [...deck];
  for (let i = pile.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pile[i], pile[j]] = [pile[j]!, pile[i]!];
  }
  // Stone Cracker (IL: AfterRoomEntered): 2 random upgradable cards of the draw pile upgraded for the fight.
  if (me.relics.includes("STONE_CRACKER") && !me.opened) {
    const up = pile.map((c, i) => (c.upgrades === 0 ? i : -1)).filter((i) => i >= 0);
    for (let n = 0; n < (me.relicVars?.["STONE_CRACKER"]?.["Cards"] ?? 2) && up.length > 0; n++) {
      const i = up.splice(Math.floor(rng() * up.length), 1)[0]!;
      pile[i] = cardFromId(`${pile[i]!.id}+`) ?? pile[i]!;
    }
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
    player: { hp, maxHp: me.maxHp, block: me.block, powers: { ...me.powers, ...(boss.player ?? {}) } }, energy: me.energy, maxEnergy: me.maxEnergy, turn: 1,
    hand: pile.splice(Math.max(0, pile.length - me.hand), me.hand), draw: pile, discard: [], exhaust: [], enemies,
    drawn: 0, exact: true, lostHp: false, exhaustedThisTurn: false, relics: me.relics, ...(me.relicVars ? { relicVars: me.relicVars } : {}), played: 0, skills: 0,
    unmovableUsed: false, potions: [...(me.potions ?? [])], potionSlots: me.potionSlots ?? 0, potionsUsed: 0,
    ...(surrounded ? { facing: monsters.length } : {}),
  };
  // The fight's HP before anything is dealt: the opening relics' damage is the bout's too.
  const full = pool(s);
  // The relics that act on the enemies as the fight opens (always: an opening seen in a fight is the
  // player's side only): Bag of Marbles' Vulnerable and Red Mask's Weak (their first turn), Festive
  // Popper's 9 and Mercury Hourglass's first 3 to every enemy, after the draw.
  for (const [relic, power] of [["BAG_OF_MARBLES", "VULNERABLE"], ["RED_MASK", "WEAK"]] as const) {
    if (!me.relics.includes(relic)) continue;
    for (const e of s.enemies) {
      if ((e.powers["ARTIFACT"] ?? 0) > 0) e.powers["ARTIFACT"]! -= 1;
      else e.powers[power] = (e.powers[power] ?? 0) + (me.relicVars?.[relic]?.[`${power === "WEAK" ? "Weak" : "Vulnerable"}Power`] ?? 1);
    }
  }
  if (me.relics.includes("FESTIVE_POPPER")) relicDamage(s, me.relicVars?.["FESTIVE_POPPER"]?.["Damage"] ?? 9, true);
  if (me.relics.includes("MERCURY_HOURGLASS")) relicDamage(s, me.relicVars?.["MERCURY_HOURGLASS"]?.["Damage"] ?? 3, true);
  redSkull(s);
  const blowing = (st: State) => st.enemies.some((e) => !e.alive && (e.deathBlow ?? 0) > 0);
  for (let t = 1; t <= turns || blowing(s); t++) {
    for (let step = 0; step < 15; step++) {
      const a = boutPlanner(s).actions[0];
      if (!a || a.kind !== "play") break;
      setKnownDraws(true);
      try {
        s = play(s, a);
      } finally {
        setKnownDraws(false);
      }
      if (over(s)) return { pool: full, damage: full, hpLost: hp - s.player.hp, won: true, turns: t };
      if (s.player.hp <= 0) return { pool: full, damage: full - pool(s), hpLost: hp, won: false, turns: t };
    }
    const next = nextTurn(s, rng, expectedIntents);
    if (!next) return { pool: full, damage: full - pool(s), hpLost: hp, won: false, turns: t };
    s = next;
    if (over(s)) return { pool: full, damage: full, hpLost: hp - s.player.hp, won: true, turns: t };
  }
  return { pool: full, damage: full - pool(s), hpLost: hp - s.player.hp, won: false, turns };
}

/** A deck's score against a boss: damage dealt, a win's worth, HP lost; the mean over `samples` shuffles from `seed`. */
let bossTurns = false;
/** spar2: each boss's own horizon (Boss.turns), not eight turns for every one. */
export function useBossTurns(on: boolean): void {
  bossTurns = on;
}

/**
 * `hpWeight`: what a point of HP lost costs. Between two players who start the bout with different
 * HP (heal or smith), the HP lost measures nothing (the healed one, losing as well, loses more):
 * 0 there, the damage dealt and the win alone.
 */
export function sparScore(ids: readonly string[], boss: Boss, samples = 8, seed = 1, me: Player = BARE, first = 0, hpWeight = 0.7, turns?: number): number {
  const deck = ids.map(cardFromId).filter((c): c is Card => c !== undefined);
  let total = 0;
  for (let i = first; i < first + samples; i++) {
    const b = bout(deck, boss, seeded(seed * 1000 + i), turns ?? (bossTurns ? boss.turns ?? 8 : 8), me);
    total += b.damage + (b.won ? 60 : 0) - hpWeight * b.hpLost;
  }
  return total / samples;
}

/**
 * sparpair (astra-review-4 #3): A10's act 3, both bosses on one HP bar. The first bout, then the
 * second on what the first left (and the heals for winning: Burning Blood, Black Blood), on its own
 * shuffles; the second is only fought if the first is won. The score is the two bouts' together,
 * the second's win worth as much as the first's. Both are played out (PAIR_TURNS at most): in eight
 * turns no act 3 deck beats Aeonglass's 535 HP, and the second was never fought (e23d63b, seeds
 * 377, 407, 533: not a pick changed).
 */
const PAIR_TURNS = 20;
export function pairScore(ids: readonly string[], first: Boss, second: Boss, samples = 8, seed = 1, me: Player = BARE, from = 0, hpWeight = 0.7): number {
  const deck = ids.map(cardFromId).filter((c): c is Card => c !== undefined);
  // The heals for winning, and Pantograph's 25 as the second boss fight starts.
  const heal = (["BURNING_BLOOD", "BLACK_BLOOD"] as const).reduce((a, id) => a + (me.relics.includes(id) ? me.relicVars?.[id]?.["Heal"] ?? 6 : 0), 0)
    + (me.relics.includes("PANTOGRAPH") ? 25 : 0);
  const turns = () => PAIR_TURNS;
  let total = 0;
  for (let i = from; i < from + samples; i++) {
    const a = bout(deck, first, seeded(seed * 1000 + i), turns(), me);
    total += a.damage + (a.won ? 60 : 0) - hpWeight * a.hpLost;
    if (!a.won) continue;
    const hp = Math.min(me.maxHp, me.hp - a.hpLost + heal);
    const b = bout(deck, second, seeded(seed * 1000 + i + 500_000), turns(), { ...me, hp });
    total += b.damage + (b.won ? 60 : 0) - hpWeight * b.hpLost;
  }
  return total / samples;
}

/**
 * spar5 (astra-review-5 #2): a bout's outcome, win first. The damage + 60·won − 0.7·hpLost score let
 * a dead deck's 60 more damage be worth a win. Here a win is 100 and the HP it kept up to 30 more; a
 * loss is the share of the fight's HP taken off, up to 60, and a fight still going at the horizon
 * (SPAR5_TURNS, fought out) the HP it has kept, up to 10 more. Per shuffle, for paired differences.
 */
export const SPAR5_TURNS = 20;
export function outcomeScore(b: Bout, me: Player): number {
  const kept = Math.max(0, me.hp - b.hpLost) / Math.max(1, me.maxHp);
  if (b.won) return 100 + 30 * kept;
  const taken = b.damage / Math.max(1, b.pool ?? b.damage);
  return 60 * Math.min(1, Math.max(0, taken)) + (b.hpLost < me.hp ? 10 * kept : 0);
}
export function sparOutcomes(ids: readonly string[], boss: Boss, samples: number, seed: number, me: Player = BARE, first = 0): number[] {
  const deck = ids.map(cardFromId).filter((c): c is Card => c !== undefined);
  const out: number[] = [];
  for (let i = first; i < first + samples; i++) out.push(outcomeScore(bout(deck, boss, seeded(seed * 1000 + i), SPAR5_TURNS, me), me));
  return out;
}

/** The boss a deck is measured against in each act (acts 1-2 of this pool; act 3 against the act 2 one for now). */
export const bossForAct = (act: number): Boss => (act === 0 ? BOSSES["VANTOM"]! : BOSSES["THE_INSATIABLE"]!);

/** A boss by its encounter id ("WATERFALL_GIANT_BOSS"), if it is modelled here. */
export const modelledBoss = (encounter: string): Boss | undefined => BOSSES[encounter.replace(/^ENCOUNTER\./, "").replace(/_BOSS$/, "")];

/** The act's boss by its encounter id, where it is modelled here; else the act's default. */
export function bossFor(encounter: string, act: number): Boss {
  return modelledBoss(encounter) ?? bossForAct(act);
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
