/**
 * Every character's own rules, in one place for the simulator, the search and the choices to read.
 *
 * Each character has a module here (silent.ts, necrobinder.ts, …) that the session working on it
 * owns; the core (sim.ts, turn.ts, search.ts, choices.ts) only calls the hooks below, so the
 * characters' work does not touch the same lines. All of them are always on: card and power ids
 * are the game's and do not overlap, and a card of another character's (Prismatic Shard, a
 * transform) plays as it should.
 *
 * The tables are merged the first time they are asked for, not when this module loads: the
 * character modules import sim.ts's helpers, and sim.ts imports this — at call time every module
 * of the cycle has loaded, whichever was imported first.
 *
 * Nothing here is the Ironclad's: its rules stay where they were (sim.ts SPECIAL, choices.ts
 * CARDS). With every module empty the core plays exactly as before.
 */

import type { Card, Enemy, State } from "../sim.ts";
import type { Observation } from "../obs.ts";
import type { Weights } from "../search.ts";
import { DEFECT } from "./defect.ts";
import { NECROBINDER } from "./necrobinder.ts";
import { REGENT } from "./regent.ts";
import { SILENT } from "./silent.ts";

/** A card's effect when it is not what its numbers say (sim.ts SPECIAL); x: an X card's X. */
export type Rule = (s: State, card: Card, target: Enemy | undefined, x: number) => void;
/** What a calculated card counts (sim.ts COUNTS): damage = CalculationBase + ExtraDamage × this. */
export type Count = (s: State, c: Card, t: Enemy | undefined) => number | undefined;

/** A reward's card, as choices.ts CARDS rates it: four tier lists (S-F) and pick % in acts 1-3. */
export interface CardRow {
  tiers: string;
  pick: [number, number, number];
}

export interface CharacterRules {
  /** Cards whose effect is not what their numbers say, by card id. */
  special?: Record<string, Rule>;
  /** Calculated damage, by card id. */
  counts?: Record<string, Count>;
  /**
   * Potions whose effect is not what their numbers say (sim.ts POTION_SPECIAL), by potion id: `n` is its
   * Cards var or else its first. The Regent's Star Potion (stars), King's Courage (Forge).
   */
  potions?: Record<string, (s: State, n: number) => void>;
  /** The state built from an observation (sim.ts fromObservation): fill `ext` from the bridge's fields. */
  fromObservation?(obs: Observation, s: State): void;
  /** False: the card cannot be played now (a cost the core does not know, like the Regent's stars). */
  playable?(s: State, card: Card): boolean;
  /** The energy a card costs now, given what the core says it costs (sim.ts costOf: the Silent's Free Skill). */
  cost?(s: State, card: Card, cost: number): number;
  /** A card paid for, before it resolves (sim.ts play; after Intimidating Helmet). */
  beforePlay?(s: State, card: Card, target: Enemy | undefined): void;
  /** A card resolved (sim.ts resolve, after the relics' AfterCardPlayed, before it goes to its pile). */
  afterPlay?(s: State, card: Card, target: Enemy | undefined): void;
  /** How many more times the card resolves (sim.ts resolve, as One-Two Punch replays an attack): the Silent's Burst. */
  extraPlays?(s: State, card: Card): number;
  /** The card as it goes to its pile after the play (sim.ts resolve): Up My Sleeve's cost, Master Planner's Sly. */
  afterCard?(s: State, card: Card): Card;
  /** `n` cards were drawn in the turn (sim.ts draw), known or not: the Silent's Corrosive Wave, Speedster. */
  onDraw?(s: State, n: number): void;
  /** A hit of the player's attack landed on `e` and took `lost` HP (sim.ts strike): the Silent's Envenom. */
  afterHit?(s: State, e: Enemy, lost: number): void;
  /**
   * Where a played card goes instead of the discard pile (IL: GetResultLocationForCardPlay): "hand"
   * (Particle Wall), "top" of the draw pile (Shining Strike); undefined for the discard pile.
   */
  resultPile?(s: State, card: Card): "hand" | "top" | undefined;
  /** The player's turn started, after the draw (sim.ts startOfTurn). */
  startOfTurn?(s: State): void;
  /**
   * The player's end of the turn before the enemies act (sim.ts endOfTurn): `needed` says whether
   * there is anything to do (the state is cloned only then), `run` does it on the clone.
   */
  endOfTurn?: { needed(s: State): boolean; run(s: State): void };
  /** The next turn's state is built (turn.ts nextTurn), before its start-of-turn effects: `ext` carries over as it was. */
  nextTurn?(prev: State, next: State): void;
  /**
   * An enemy's turn starts, before it acts: the HP it loses then (the Silent's Poison). turn.ts nextTurn
   * passes the enemy's powers for the next turn, to change as the tick leaves them; sim.ts
   * incomingHitsBy asks without them, to know whether it lives to act.
   */
  enemyTurnStart?(s: State, e: Enemy, powers?: Record<string, number>): number;
  /** A term added to search.ts evaluate's score of a state that is neither won nor lost. */
  evaluate?(s: State, w: Weights): number;
  /** A copy of `ext` a play may change (sim.ts clone); by default a shallow copy, so replace values, do not mutate them. */
  cloneExt?(ext: Record<string, unknown>): Record<string, unknown>;
  /** What of `ext` makes two states different (sim.ts stateKey). */
  keyExt?(s: State): string;
  /**
   * A card select in a fight (run-fights' combatSelect, and the simulator's own guess of it): the index
   * of the card to take from `cards`, for the select's `purpose` (the bridge's CardSelectCmd method:
   * FromHand, FromHandForDiscard…) after playing `source`; undefined leaves it to the core (junkIndex).
   */
  combatSelect?(source: string | undefined, purpose: string, cards: readonly { id: string; type: string; keywords: readonly string[] }[]): number | undefined;

  /** choices.ts: the character's cards as CARDS rates the Ironclad's (tiers, pick %). */
  cards?: Record<string, CardRow>;
  /** choices.ts rules2's sets: always take, never take, AoE, multi-hit, damage. */
  always?: readonly string[];
  never?: readonly string[];
  aoe?: readonly string[];
  multiHit?: readonly string[];
  damage?: readonly string[];
  /** choices.ts chooseUpgrade: upgraded first, in this order; and last. */
  smithFirst?: readonly string[];
  smithLast?: readonly string[];
  /**
   * choices.ts ancientPick: an Ancient's relics this character takes first (in order), and avoids,
   * over the table's (the Ironclad's): the Regent takes Touch of Orobas (Divine Right → Divine Destiny).
   */
  ancients?: Readonly<Record<string, { first?: readonly string[]; avoid?: readonly string[] }>>;
}

export const ALL: readonly CharacterRules[] = [SILENT, NECROBINDER, REGENT, DEFECT];

export interface Merged {
  special: Record<string, Rule>;
  counts: Record<string, Count>;
  potions: Record<string, (s: State, n: number) => void>;
  fromObservation: NonNullable<CharacterRules["fromObservation"]>[];
  playable: NonNullable<CharacterRules["playable"]>[];
  cost: NonNullable<CharacterRules["cost"]>[];
  onDraw: NonNullable<CharacterRules["onDraw"]>[];
  afterHit: NonNullable<CharacterRules["afterHit"]>[];
  combatSelect: NonNullable<CharacterRules["combatSelect"]>[];
  beforePlay: NonNullable<CharacterRules["beforePlay"]>[];
  afterPlay: NonNullable<CharacterRules["afterPlay"]>[];
  extraPlays: NonNullable<CharacterRules["extraPlays"]>[];
  afterCard: NonNullable<CharacterRules["afterCard"]>[];
  resultPile: NonNullable<CharacterRules["resultPile"]>[];
  startOfTurn: NonNullable<CharacterRules["startOfTurn"]>[];
  endOfTurn: NonNullable<CharacterRules["endOfTurn"]>[];
  nextTurn: NonNullable<CharacterRules["nextTurn"]>[];
  enemyTurnStart: NonNullable<CharacterRules["enemyTurnStart"]>[];
  evaluate: NonNullable<CharacterRules["evaluate"]>[];
  cloneExt: NonNullable<CharacterRules["cloneExt"]>[];
  keyExt: NonNullable<CharacterRules["keyExt"]>[];
  cards: Record<string, CardRow>;
  always: Set<string>;
  never: Set<string>;
  aoe: Set<string>;
  multiHit: Set<string>;
  damage: Set<string>;
  smithFirst: string[];
  smithLast: Set<string>;
  ancients: Record<string, { first: string[]; avoid: string[] }>;
}

let merged: Merged | undefined;

/** Every character's rules together. */
export function rules(): Merged {
  if (merged) return merged;
  const m: Merged = {
    special: {}, counts: {}, potions: {}, fromObservation: [], playable: [], cost: [], beforePlay: [], afterPlay: [], resultPile: [], extraPlays: [], afterCard: [], onDraw: [], afterHit: [], combatSelect: [], startOfTurn: [],
    endOfTurn: [], nextTurn: [], enemyTurnStart: [], evaluate: [], cloneExt: [], keyExt: [],
    cards: {}, always: new Set(), never: new Set(), aoe: new Set(), multiHit: new Set(), damage: new Set(), smithFirst: [], smithLast: new Set(), ancients: {},
  };
  for (const r of ALL) {
    for (const [id, f] of Object.entries(r.special ?? {})) {
      if (m.special[id]) throw new Error(`characters: two rules for ${id}`);
      m.special[id] = f;
    }
    Object.assign(m.counts, r.counts ?? {});
    Object.assign(m.potions, r.potions ?? {});
    Object.assign(m.cards, r.cards ?? {});
    for (const k of ["fromObservation", "playable", "cost", "beforePlay", "afterPlay", "resultPile", "extraPlays", "afterCard", "onDraw", "afterHit", "startOfTurn", "endOfTurn", "nextTurn", "enemyTurnStart", "evaluate", "cloneExt", "keyExt", "combatSelect"] as const) {
      const f = r[k];
      if (f) (m[k] as unknown[]).push(typeof f === "function" ? f.bind(r) : f);
    }
    for (const k of ["always", "never", "aoe", "multiHit", "damage", "smithLast"] as const) for (const id of r[k] ?? []) m[k].add(id);
    m.smithFirst.push(...(r.smithFirst ?? []));
    for (const [id, a] of Object.entries(r.ancients ?? {})) {
      const to = (m.ancients[id] ??= { first: [], avoid: [] });
      to.first.push(...(a.first ?? []));
      to.avoid.push(...(a.avoid ?? []));
    }
  }
  merged = m;
  return m;
}
