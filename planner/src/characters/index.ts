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

import type { Card, Enemy, Soak, State } from "../sim.ts";
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
  /** The state built from an observation (sim.ts fromObservation): fill `ext` from the bridge's fields. */
  fromObservation?(obs: Observation, s: State): void;
  /** False: the card cannot be played now (a cost the core does not know, like the Regent's stars). */
  playable?(s: State, card: Card): boolean;
  /** A card paid for, before it resolves (sim.ts play; after Intimidating Helmet). */
  beforePlay?(s: State, card: Card, target: Enemy | undefined): void;
  /** A card resolved (sim.ts resolve, after the relics' AfterCardPlayed, before it goes to its pile). */
  afterPlay?(s: State, card: Card, target: Enemy | undefined): void;
  /** The player's turn started, after the draw (sim.ts startOfTurn). */
  startOfTurn?(s: State): void;
  /**
   * The player's end of the turn before the enemies act (sim.ts endOfTurn): `needed` says whether
   * there is anything to do (the state is cloned only then), `run` does it on the clone.
   */
  endOfTurn?: { needed(s: State): boolean; run(s: State): void };
  /** The next turn's state is built (turn.ts nextTurn), before its start-of-turn effects: `ext` carries over as it was. */
  nextTurn?(prev: State, next: State): void;
  /** A term added to search.ts evaluate's score of a state that is neither won nor lost. */
  evaluate?(s: State, w: Weights): number;
  /**
   * An ally in front of the player this turn (sim.ts hpLoss): it takes each enemy attack hit's part
   * past block before the player does (the Necrobinder's Osty, Die for You); none, undefined.
   */
  soak?(s: State): Soak | undefined;
  /** A copy of `ext` a play may change (sim.ts clone); by default a shallow copy, so replace values, do not mutate them. */
  cloneExt?(ext: Record<string, unknown>): Record<string, unknown>;
  /** What of `ext` makes two states different (sim.ts stateKey). */
  keyExt?(s: State): string;

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
}

export const ALL: readonly CharacterRules[] = [SILENT, NECROBINDER, REGENT, DEFECT];

export interface Merged {
  special: Record<string, Rule>;
  counts: Record<string, Count>;
  fromObservation: NonNullable<CharacterRules["fromObservation"]>[];
  playable: NonNullable<CharacterRules["playable"]>[];
  beforePlay: NonNullable<CharacterRules["beforePlay"]>[];
  afterPlay: NonNullable<CharacterRules["afterPlay"]>[];
  startOfTurn: NonNullable<CharacterRules["startOfTurn"]>[];
  endOfTurn: NonNullable<CharacterRules["endOfTurn"]>[];
  nextTurn: NonNullable<CharacterRules["nextTurn"]>[];
  evaluate: NonNullable<CharacterRules["evaluate"]>[];
  soak: NonNullable<CharacterRules["soak"]>[];
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
}

let merged: Merged | undefined;

/** Every character's rules together. */
export function rules(): Merged {
  if (merged) return merged;
  const m: Merged = {
    special: {}, counts: {}, fromObservation: [], playable: [], beforePlay: [], afterPlay: [], startOfTurn: [],
    endOfTurn: [], nextTurn: [], evaluate: [], soak: [], cloneExt: [], keyExt: [],
    cards: {}, always: new Set(), never: new Set(), aoe: new Set(), multiHit: new Set(), damage: new Set(), smithFirst: [], smithLast: new Set(),
  };
  for (const r of ALL) {
    for (const [id, f] of Object.entries(r.special ?? {})) {
      if (m.special[id]) throw new Error(`characters: two rules for ${id}`);
      m.special[id] = f;
    }
    Object.assign(m.counts, r.counts ?? {});
    Object.assign(m.cards, r.cards ?? {});
    for (const k of ["fromObservation", "playable", "beforePlay", "afterPlay", "startOfTurn", "endOfTurn", "nextTurn", "evaluate", "soak", "cloneExt", "keyExt"] as const) {
      const f = r[k];
      if (f) (m[k] as unknown[]).push(typeof f === "function" ? f.bind(r) : f);
    }
    for (const k of ["always", "never", "aoe", "multiHit", "damage", "smithLast"] as const) for (const id of r[k] ?? []) m[k].add(id);
    m.smithFirst.push(...(r.smithFirst ?? []));
  }
  merged = m;
  return m;
}
