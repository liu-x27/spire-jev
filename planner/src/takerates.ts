/**
 * How often A10 players take a card when a reward offers it, by act (planner/data/take-rates-a10.json:
 * the other session's count of Spire Codex's v0.111.0 A10 Ironclad card_choices; upgraded copies
 * merged into the base id). --flags sparhuman ranks a reward's offers by it.
 *
 * The bot is offered the defensive skills as often as humans are and passes on them (Flame Barrier
 * taken 1% of 97 offers against 52%, Feel No Pain and Burning Pact 0% against 44% and 47%), and takes
 * the mid attacks they pass on (Hemokinesis 77% against 17%, Anger 65% against 21%).
 */

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve(import.meta.dirname, "..", "data", "take-rates-a10.json");

type Counts = Record<string, [number, number]>;
let rates: Record<string, Counts> | undefined;

function load(): Record<string, Counts> {
  if (rates) return rates;
  try {
    rates = JSON.parse(fs.readFileSync(FILE, "utf8")) as Record<string, Counts>;
  } catch {
    rates = {};
  }
  return rates;
}

/** The share of offers of `card` humans took in act `act` (0-2), or undefined below `min` offers. */
export function humanTake(card: string, act: number, min = 30): number | undefined {
  const c = load()[card.replace(/\+$/, "")]?.[`a${act + 1}`];
  if (!c || c[1] < min) return undefined;
  return c[0] / c[1];
}

/** The share of reward screens humans skipped in act `act`, or undefined. */
export function humanSkip(act: number): number | undefined {
  const c = load()["_skip"]?.[`a${act + 1}`];
  return c && c[1] > 0 ? c[0] / c[1] : undefined;
}

/**
 * --flags sparpick: A10 players' preference for a card within a reward screen, by act (the other
 * session's conditional logit on Spire Codex's card_choices: each screen's cards and skip, skip the
 * reference at 0, ridge sd 2; planner/data/pick-scores-a10.json: { CARD: { a1, a2, a3 } }, _offered
 * and _se by card), shrunk toward 0 by the offers seen (n / (n + 40)). Unlike take rates, what a card
 * was offered beside is accounted for.
 */
const SCORES = path.resolve(import.meta.dirname, "..", "data", "pick-scores-a10.json");
type Scores = Record<string, Record<string, number> | Record<string, Record<string, number>>>;
let scores: Scores | undefined;
const SHRINK_N = 40;
function loadScores(): Scores {
  if (!scores) {
    try {
      scores = JSON.parse(fs.readFileSync(SCORES, "utf8")) as Scores;
    } catch {
      scores = {};
    }
  }
  return scores;
}
export function humanScore(card: string, act: number): number | undefined {
  const s = loadScores();
  const id = card.replace(/\+$/, "");
  const key = `a${act + 1}`;
  const v = (s[id] as Record<string, number> | undefined)?.[key];
  if (typeof v !== "number") return undefined;
  const n = (s["_offered"] as Record<string, Record<string, number>> | undefined)?.[id]?.[key];
  return n === undefined ? v : (v * n) / (n + SHRINK_N);
}
/**
 * sparpick's skip line: SPIRE_JEV_PICK_SKIP (a score), or none — a reward is skipped only when every
 * offer is vetoed. The humans' own line (0, the skip) would skip 35% of act 2's rewards as they do,
 * and skipping more has cost the bot act 2 each time.
 */
export function humanSkipScore(): number {
  const v = process.env["SPIRE_JEV_PICK_SKIP"];
  return v === undefined ? -Infinity : Number(v);
}
