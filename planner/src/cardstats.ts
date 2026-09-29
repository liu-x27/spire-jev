/**
 * What strong players think an Ironclad card is worth at A10, from
 * planner/data/card-stats-a10.json (docs/a10-decks-research.md: Spire Codex's
 * community run data, Ironclad at A10; `wr50.eloVsSkip` is the card's Elo
 * among uploaders with at least a 50% win rate, minus the Elo of skipping —
 * below 0, they would rather take something else or nothing).
 */

import fs from "node:fs";
import { character, dataFile } from "./character.ts";

/** The character's own (character.ts dataFile): data/card-stats-a10.json is the Ironclad's. */
const FILE = () => dataFile("card-stats-a10.json");

interface CardStat {
  pick?: (number | null)[];
  n?: number | null;
  wr50?: { eloVsSkip?: number; n?: number };
}

function load(): Record<string, CardStat> {
  try {
    return (JSON.parse(fs.readFileSync(FILE(), "utf8")) as { cards?: Record<string, CardStat> }).cards ?? {};
  } catch {
    return {};
  }
}

const loaded = new Map<string, Record<string, CardStat>>();
const stats = (): Record<string, CardStat> => {
  if (!loaded.has(character())) loaded.set(character(), load());
  return loaded.get(character())!;
};

/** Elo over skipping among strong A10 players, or undefined for a card the data lacks (or too rarely seen). */
export function eloVsSkip(card: string): number | undefined {
  const s = stats()[card]?.wr50;
  if (!s || typeof s.eloVsSkip !== "number" || (s.n ?? 0) < 100) return undefined;
  return s.eloVsSkip;
}

/** The card's worth on the 0-1 scale cardValue uses, 0.5 being as good as skipping. */
export function eloValue(card: string): number | undefined {
  const e = eloVsSkip(card);
  return e === undefined ? undefined : 0.5 + Math.max(-400, Math.min(400, e)) / 800;
}
