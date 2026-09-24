/**
 * What a relic is worth to an A10 Ironclad, from docs/relic-tiers.md (web
 * research: DoggertQBones' tier list, Jorbs' sheet, MetaBot, Spire Codex;
 * the table's "value" column, 0-1). Read from the document itself so there
 * is one copy of the numbers.
 */

import fs from "node:fs";
import path from "node:path";

const DOC = path.resolve(import.meta.dirname, "..", "..", "docs", "relic-tiers.md");

function load(): Map<string, number> {
  const values = new Map<string, number>();
  if (!fs.existsSync(DOC)) return values;
  for (const line of fs.readFileSync(DOC, "utf8").split(/\r?\n/)) {
    // | ID (id guessed) | rarity | effect | tier | value | conditions | evidence |
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 7) continue;
    const id = cells[1]!.replace(/\s*\(id guessed\)$/, "");
    const value = Number(cells[5]);
    if (/^[A-Z][A-Z0-9_]+$/.test(id) && Number.isFinite(value)) values.set(id, value);
  }
  return values;
}

const VALUES = load();

/** The table's value, or undefined for a relic it does not have. */
export const relicValue = (id: string): number | undefined => VALUES.get(id);

/** §2 rule 4: relics that add a choice the bot does not answer yet, and Dingy Rug. */
const SKIP = new Set([
  "DINGY_RUG", "MINIATURE_TENT", "TOOLBOX", "GAMBLING_CHIP", "KIFUDA", "DOLLYS_MIRROR", "ROYAL_STAMP",
  "PUNCH_DAGGER", "GNARLED_HAMMER", "SHOVEL", "GIRYA",
]);
/** §2 rule 5: relics whose worth builds over the fights and pickups still to come. */
const BUILDERS = new Set(["MOLTEN_EGG", "FROZEN_EGG", "TOXIC_EGG", "DRAGON_FRUIT", "ORRERY", "WING_CHARM", "WHITE_STAR", "PRAYER_WHEEL", "CHOSEN_CHEESE", "MEMBERSHIP_CARD"]);
/** Boss and HP relics: as good in act 3, which at A10 ends with two bosses. */
const LASTING = new Set(["PANTOGRAPH", "LEES_WAFFLE", "ETERNAL_FEATHER", "REGAL_PILLOW", "LIZARD_TAIL"]);

/**
 * §2 rule 1: a relic's worth at this price, in gold — 600 × (value − 0.25),
 * the value discounted by act (rule 5) — minus the price. Undefined for a
 * relic to skip or one the table does not have.
 */
export function relicSurplus(id: string, price: number, act: 0 | 1 | 2): number | undefined {
  const v = VALUES.get(id);
  if (v === undefined || SKIP.has(id)) return undefined;
  const m = BUILDERS.has(id) ? [1, 0.8, 0.5][act]! : LASTING.has(id) ? 1 : [1, 0.95, 0.9][act]!;
  return 600 * (v * m - 0.25) - price;
}
