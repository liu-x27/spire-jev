/**
 * The character a run plays: SPIRE_JEV_CHARACTER, the Ironclad by default (what every result before
 * 2026-09-29 played), or what the observation says (run-fights sets it from the first one, so a
 * resumed save plays as whoever it was saved as).
 *
 * Each one's starting kit is the game's (IL: <Character>.StartingHp, StartingDeck, StartingRelics).
 * Its own rules (cards, powers, choices) are in characters/; this is only who is playing.
 */

import fs from "node:fs";
import path from "node:path";

export type CharacterId = "IRONCLAD" | "SILENT" | "DEFECT" | "NECROBINDER" | "REGENT";

export interface CharacterInfo {
  id: CharacterId;
  /** Starting (and max) HP. */
  hp: number;
  /** The starting deck, as the game builds it. */
  deck: readonly string[];
  relic: string;
}

const kit = (id: CharacterId, hp: number, strikes: number, defends: number, extras: string[], relic: string): CharacterInfo => ({
  id, hp, relic,
  deck: [...Array<string>(strikes).fill(`STRIKE_${id}`), ...Array<string>(defends).fill(`DEFEND_${id}`), ...extras],
});

export const CHARACTERS: Readonly<Record<CharacterId, CharacterInfo>> = {
  IRONCLAD: kit("IRONCLAD", 80, 5, 4, ["BASH"], "BURNING_BLOOD"),
  SILENT: kit("SILENT", 70, 5, 5, ["NEUTRALIZE", "SURVIVOR"], "RING_OF_THE_SNAKE"),
  DEFECT: kit("DEFECT", 75, 4, 4, ["ZAP", "DUALCAST"], "CRACKED_CORE"),
  NECROBINDER: kit("NECROBINDER", 66, 4, 4, ["BODYGUARD", "UNLEASH"], "BOUND_PHYLACTERY"),
  REGENT: kit("REGENT", 75, 4, 4, ["FALLING_STAR", "VENERATE"], "DIVINE_RIGHT"),
};

/** "CHARACTER.SILENT", "silent" → SILENT; undefined for no character the game has. */
export function characterOf(name: string): CharacterId | undefined {
  const id = name.trim().replace(/^CHARACTER\./i, "").toUpperCase();
  return id in CHARACTERS ? (id as CharacterId) : undefined;
}

function parse(name: string): CharacterId {
  const id = characterOf(name);
  if (!id) throw new Error(`SPIRE_JEV_CHARACTER: one of ${Object.keys(CHARACTERS).join(", ")}, not ${name}`);
  return id;
}

let current: CharacterId = parse(process.env["SPIRE_JEV_CHARACTER"] || "IRONCLAD");

export const character = (): CharacterId => current;
export const characterInfo = (): CharacterInfo => CHARACTERS[current];

/**
 * Play as `name` from now on. Also into the environment, so the game this process starts
 * (bridge.ts) and the runs it spawns (eval, bench) play the same.
 */
export function setCharacter(name: string): void {
  current = parse(name);
  process.env["SPIRE_JEV_CHARACTER"] = current;
}

const IDS = Object.keys(CHARACTERS).join("|");
const BASIC = new RegExp(`^(STRIKE|DEFEND)_(${IDS})`);
const STRIKE = new RegExp(`^STRIKE_(${IDS})`);
const DEFEND = new RegExp(`^DEFEND_(${IDS})`);
/** Any character's basic Strike or Defend, upgraded too ("STRIKE_SILENT+"). */
export const isBasic = (id: string): boolean => BASIC.test(id);
export const isBasicStrike = (id: string): boolean => STRIKE.test(id);
export const isBasicDefend = (id: string): boolean => DEFEND.test(id);
/** The starting deck's cards besides the Strikes and Defends: Bash; Neutralize and Survivor. */
export const starterExtras = (): readonly string[] => characterInfo().deck.filter((c) => !isBasic(c));

const DATA = path.resolve(import.meta.dirname, "..", "data");
/**
 * One of the character's own data files (card stats, take rates): data/<name> for the Ironclad, as
 * it always was, data/<character>/<name> for the others (missing: the loaders' empty table).
 */
export function dataFile(name: string): string {
  return current === "IRONCLAD" ? path.join(DATA, name) : path.join(DATA, current.toLowerCase(), name);
}

/** Whether the character has that data file (a loader with none falls back to its rules). */
export const hasDataFile = (name: string): boolean => fs.existsSync(dataFile(name));

/** The save library under runs/ (--capture, bench): saves for the Ironclad, saves-<character> for the others. */
export function defaultLibrary(): string {
  return current === "IRONCLAD" ? "saves" : `saves-${current.toLowerCase()}`;
}
