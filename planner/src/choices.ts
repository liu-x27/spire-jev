/**
 * Choices outside combat, by rules: card rewards, the shop, rest sites,
 * upgrades, removals, potions. Phase 2's baseline, before any judge.
 *
 * Written from docs/STRATEGY-research.md — two top players' tier lists
 * (Jorbs, Baalorlord), Mobalytics and nat1's, and Untapped's pick rates by
 * act from A7+ runs — each rule naming its section there. What a card is
 * worth is half what the four lists say of it and half how often strong
 * players take it in this act, which already carries "damage in act 1,
 * engines later" (§3.3).
 */

import type { LegalAction, Observation } from "./obs.ts";

const TIER: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1, F: 0 };

/** §3.2: Jorbs, Baalorlord, Mobalytics, nat1 tiers, and Untapped pick % in acts 1/2/3. */
const CARDS: Record<string, { tiers: string; pick: [number, number, number] }> = {
  ANGER: { tiers: "BAAC", pick: [27, 6, 3] },
  ARMAMENTS: { tiers: "ABCB", pick: [24, 8, 3] },
  ASHEN_STRIKE: { tiers: "SABC", pick: [36, 30, 26] },
  BARRICADE: { tiers: "CBDC", pick: [36, 22, 35] },
  BATTLE_TRANCE: { tiers: "AASA", pick: [64, 60, 44] },
  BLUDGEON: { tiers: "CAAB", pick: [38, 11, 7] },
  BODY_SLAM: { tiers: "CACC", pick: [9, 8, 9] },
  BREAKTHROUGH: { tiers: "CBBC", pick: [24, 7, 2] },
  BURNING_PACT: { tiers: "BASB", pick: [35, 40, 37] },
  COLOSSUS: { tiers: "SSSA", pick: [63, 65, 56] },
  CONFLAGRATION: { tiers: "CBDA", pick: [69, 40, 28] },
  DISMANTLE: { tiers: "SBBB", pick: [41, 19, 10] },
  EVIL_EYE: { tiers: "ASBC", pick: [38, 36, 30] },
  FEEL_NO_PAIN: { tiers: "AAAB", pick: [29, 37, 38] },
  FIEND_FIRE: { tiers: "SSSA", pick: [63, 31, 24] },
  FIGHT_ME: { tiers: "CACB", pick: [44, 19, 11] },
  FLAME_BARRIER: { tiers: "SAAB", pick: [60, 40, 24] },
  // §1.2: buffed in v0.111 to 1 energy for 3 with no condition; the ratings predate it.
  FORGOTTEN_RITUAL: { tiers: "AABB", pick: [35, 40, 40] },
  HAVOC: { tiers: "DDCF", pick: [4, 2, 1] },
  HEADBUTT: { tiers: "CAAB", pick: [21, 11, 6] },
  HEMOKINESIS: { tiers: "BAAC", pick: [23, 6, 2] },
  HOWL_FROM_BEYOND: { tiers: "BBCB", pick: [20, 14, 9] },
  INFERNAL_BLADE: { tiers: "BBCC", pick: [29, 13, 8] },
  INFLAME: { tiers: "CCCC", pick: [31, 13, 9] },
  IRON_WAVE: { tiers: "BBBD", pick: [12, 3, 1] },
  JUGGERNAUT: { tiers: "CADC", pick: [42, 17, 18] },
  JUGGLING: { tiers: "CBCD", pick: [6, 7, 7] },
  // §1.2: buffed to 20 damage in v0.110.
  MANGLE: { tiers: "BBDB", pick: [44, 17, 15] },
  OFFERING: { tiers: "SSSS", pick: [91, 75, 73] },
  PERFECTED_STRIKE: { tiers: "BBCC", pick: [29, 13, 9] },
  POMMEL_STRIKE: { tiers: "SSSA", pick: [56, 34, 21] },
  RAGE: { tiers: "BSAC", pick: [41, 32, 24] },
  RUPTURE: { tiers: "BBCB", pick: [25, 23, 18] },
  SECOND_WIND: { tiers: "ABAC", pick: [25, 24, 26] },
  SETUP_STRIKE: { tiers: "BCCC", pick: [12, 5, 3] },
  SHRUG_IT_OFF: { tiers: "CAAA", pick: [45, 29, 16] },
  SPITE: { tiers: "CBBC", pick: [15, 10, 6] },
  STOKE: { tiers: "BSAA", pick: [66, 38, 34] },
  SWORD_BOOMERANG: { tiers: "CCCC", pick: [12, 7, 5] },
  TAUNT: { tiers: "SABB", pick: [59, 33, 18] },
  THRASH: { tiers: "ASBA", pick: [74, 43, 33] },
  THUNDERCLAP: { tiers: "CCCD", pick: [12, 4, 2] },
  TREMBLE: { tiers: "SBSD", pick: [40, 26, 17] },
  TRUE_GRIT: { tiers: "ABCB", pick: [26, 14, 8] },
  TWIN_STRIKE: { tiers: "CCBC", pick: [15, 7, 4] },
  UNRELENTING: { tiers: "CBBC", pick: [38, 12, 6] },
  UPPERCUT: { tiers: "BASB", pick: [57, 32, 20] },
  VICIOUS: { tiers: "ASCC", pick: [27, 33, 25] },
  WHIRLWIND: { tiers: "CABB", pick: [33, 15, 6] },
};

/** §10.1.2: top-tier in all three good lists and picked 63-91%. */
const ALWAYS = new Set(["OFFERING", "BATTLE_TRANCE", "COLOSSUS", "UNMOVABLE", "CRIMSON_MANTLE", "DOMINATE", "BREAK", "FIEND_FIRE"]);
/** §10.1.6. */
const NEVER = new Set(["HAVOC", "JUGGLING", "TANK", "HELLRAISER", "RAMPAGE"]);
const AOE = new Set(["CONFLAGRATION", "BREAKTHROUGH", "WHIRLWIND", "HOWL_FROM_BEYOND"]);
/** §10.1.4: what strips Slippery. */
const MULTI_HIT = new Set(["TWIN_STRIKE", "SWORD_BOOMERANG", "PECK", "CONFLAGRATION", "THRASH", "WHIRLWIND", "FIGHT_ME", "ANGER", "INFERNO"]);
const DAMAGE = new Set(["THRASH", "CONFLAGRATION", "DISMANTLE", "BLUDGEON", "POMMEL_STRIKE", "TWIN_STRIKE", "ANGER", "PERFECTED_STRIKE", "HEMOKINESIS", "UNRELENTING"]);

/** Act 1, 2 or 3 from the observation (the bridge counts from 0 or 1; either works here). */
function actOf(o: Observation): 0 | 1 | 2 {
  const a = o.act >= 1 ? o.act - 1 : o.act;
  return a <= 0 ? 0 : a >= 2 ? 2 : 1;
}

const base = (id: string) => id.replace(/\+$/, "");
const count = (deck: readonly string[], ids: Set<string>) => deck.filter((c) => ids.has(base(c))).length;

type Act = 0 | 1 | 2;

/** How much a card is worth adding to this deck in this act (0-2 for acts 1-3), about 0-1; below 0 means never. */
export function cardValue(id: string, act: Act, deck: readonly string[]): number {
  const card = base(id);
  if (NEVER.has(card)) return -1;
  const row = CARDS[card];
  let v = row ? 0.5 * ([...row.tiers].reduce((a, t) => a + (TIER[t] ?? 2), 0) / (row.tiers.length * 5)) + 0.5 * (row.pick[act] / 100) : 0.3;
  if (ALWAYS.has(card)) v = Math.max(v, 0.9);
  // §10.1.10, §3.5: the first Battle Trance, not the second; two Trembles at most.
  const copies = deck.filter((c) => base(c) === card).length;
  if (card === "BATTLE_TRANCE" && copies >= 1) v *= 0.5;
  if (card === "TREMBLE" && copies >= 2) return -1;
  if (act === 0) {
    // §10.1.3: an AoE card when the deck has none.
    if (AOE.has(card) && count(deck, AOE) === 0) v += 0.15;
    // §10.1.4: three multi-hit sources before Vantom, the act 1 boss we keep meeting.
    if (MULTI_HIT.has(card) && count(deck, MULTI_HIT) < 3) v += 0.1;
    // §10.1.1: damage first until the deck has two damage cards of its own.
    if (DAMAGE.has(card) && count(deck, DAMAGE) < 2) v += 0.1;
  }
  return v;
}

/** §3.6: strong players take a card from ~86% / 61% / 49% of rewards; below this, skip. */
export const SKIP_BELOW: [number, number, number] = [0.3, 0.45, 0.52];

export function chooseCardReward(o: Observation, legal: LegalAction[]): string {
  const offers = legal.filter((a) => a.action_id.startsWith("choose_card:"));
  let best: { id: string; v: number } | undefined;
  for (const a of offers) {
    const card = String(a.metadata?.["card_id"] ?? a.action_id.split(":")[2]);
    const v = cardValue(card, actOf(o), o.deck_cards);
    if (!best || v > best.v) best = { id: a.action_id, v };
  }
  if (best && best.v >= SKIP_BELOW[actOf(o)]) return best.id;
  return legal.find((a) => a.action_id === "skip_card")?.action_id ?? best?.id ?? legal[0]!.action_id;
}

/**
 * §7, §10.5: smith at 65%+ of max HP; rest at 40% or below, or under 25 HP
 * (35 before the boss); between, smith unless the boss is next.
 */
export function chooseRest(o: Observation, legal: LegalAction[]): string {
  const find = (re: RegExp) => legal.find((a) => re.test(a.action_id))?.action_id;
  const heal = find(/^choose_rest:.*heal/i);
  const smith = find(/^choose_rest:.*smith/i);
  const share = o.player_hp / Math.max(1, o.player_max_hp);
  const bossNext = [16, 32, 48].includes(o.floor);
  const rest = share <= 0.4 || o.player_hp < (bossNext ? 35 : 25) || (bossNext && share < 0.65);
  return (rest ? heal ?? smith : smith ?? heal) ?? legal[0]!.action_id;
}

/** §3.8, §10.5.6: upgrades that change how a card works first; never Strike or Defend while better exists. */
const SMITH_ORDER = [
  "BODY_SLAM", "BARRICADE", "UNMOVABLE", "DARK_EMBRACE", "STAMPEDE", "INFERNAL_BLADE", "CORRUPTION",
  "STOKE", "ARMAMENTS", "TRUE_GRIT",
  "UPPERCUT", "RUPTURE", "POMMEL_STRIKE", "WHIRLWIND", "VICIOUS", "PYRE", "CASCADE",
  "THRASH", "FIEND_FIRE", "ASHEN_STRIKE",
];
const SMITH_LAST = new Set(["STRIKE_IRONCLAD", "DEFEND_IRONCLAD", "SHRUG_IT_OFF", "COLOSSUS", "TREMBLE", "EVIL_EYE", "BLOOD_WALL", "FEED"]);

export function chooseUpgrade(o: Observation, legal: LegalAction[]): string {
  const offers = legal.filter((a) => a.action_id.startsWith("choose_upgrade:"));
  const idOf = (a: LegalAction) => base(a.action_id.split(":")[2] ?? "");
  const rank = (a: LegalAction) => {
    const id = idOf(a);
    const i = SMITH_ORDER.indexOf(id);
    if (i >= 0) return 100 - i;
    // Bash only in act 1, and only with no other Vulnerable source (§3.8).
    if (id === "BASH") return actOf(o) === 0 ? 10 : 0;
    if (SMITH_LAST.has(id)) return -10;
    return 20 + cardValue(id, actOf(o), o.deck_cards) * 10;
  };
  const best = [...offers].sort((a, b) => rank(b) - rank(a))[0];
  return best?.action_id ?? legal[0]!.action_id;
}

/**
 * §10.2.1: the card a removal or transform should take — curses and
 * statuses, then Defend before Strike if the deck has three block cards of
 * its own, else Strike; Bash last.
 */
export function worstCard(ids: readonly string[], deck: readonly string[]): number {
  const blockCards = deck.filter((c) => ["SHRUG_IT_OFF", "FLAME_BARRIER", "TAUNT", "TRUE_GRIT", "COLOSSUS", "EVIL_EYE", "IMPERVIOUS", "UNMOVABLE", "CRIMSON_MANTLE", "SECOND_WIND", "IRON_WAVE"].includes(base(c))).length;
  const order = (id: string) => {
    const c = base(id);
    if (/CURSE|INJURY|CLUMSY|SPORE_MIND|NORMALITY|DECAY|GUILTY|POOR_SLEEP|GREED|BAD_LUCK|WOUND|DAZED|SLIMED|BURN|INFECTION/.test(c)) return 0;
    if (c === "DEFEND_IRONCLAD") return blockCards >= 3 ? 1 : 2;
    if (c === "STRIKE_IRONCLAD") return blockCards >= 3 ? 2 : 1;
    if (c === "BASH") return 50;
    return 10 + (CARDS[c] ? cardValue(c, 0, deck) * 30 : 20);
  };
  let best = 0;
  ids.forEach((id, i) => {
    if (order(id) < order(ids[best]!)) best = i;
  });
  return best;
}

export function chooseCardSelect(o: Observation, legal: LegalAction[]): string {
  const offers = legal.filter((a) => a.action_id.startsWith("choose_card_select:"));
  if (offers.length === 0) return legal[0]!.action_id;
  const ids = offers.map((a) => a.action_id.split(":")[2] ?? "");
  return offers[worstCard(ids, o.deck_cards)]!.action_id;
}

const REMOVABLE = /STRIKE_IRONCLAD|DEFEND_IRONCLAD|CURSE|INJURY|CLUMSY|SPORE_MIND|NORMALITY|DECAY|GUILTY|POOR_SLEEP|GREED|BAD_LUCK/;

/**
 * §5, §10.3: removal first while there is a Strike, Defend or curse to take
 * out, unless an S-tier card is on sale; then a card worth taking; relics
 * when there is gold for them; potions in act 3 only; then leave.
 */
export function chooseShop(o: Observation, legal: LegalAction[]): string {
  const leave = legal.find((a) => a.action_id === "shop_leave")?.action_id ?? legal[0]!.action_id;
  const stock = legal.filter((a) => a.action_id.startsWith("shop_buy:") && a.metadata?.["stocked"] !== false && a.metadata?.["affordable"] !== false);
  const price = (a: LegalAction) => Number(a.metadata?.["price"] ?? 9999);
  // The bridge names entries by class: MerchantCardEntry, MerchantCardRemovalEntry, MerchantRelicEntry, MerchantPotionEntry.
  const type = (a: LegalAction) => String(a.metadata?.["entry_type"] ?? "").replace(/^Merchant/, "").replace(/Entry$/, "");
  const item = (a: LegalAction) => String(a.metadata?.["item_id"] ?? "");
  const cards = stock.filter((a) => type(a) === "Card").map((a) => ({ a, v: cardValue(item(a), actOf(o), o.deck_cards) })).sort((x, y) => y.v - x.v);
  const removal = stock.find((a) => /remov/i.test(type(a)));
  const topCard = cards[0];
  if (topCard && topCard.v >= 0.85) return topCard.a.action_id;
  if (removal && o.deck_cards.some((c) => REMOVABLE.test(c))) return removal.action_id;
  if (topCard && topCard.v >= 0.65) return topCard.a.action_id;
  const relic = stock.filter((a) => type(a) === "Relic").sort((x, y) => price(x) - price(y))[0];
  if (relic && o.gold - price(relic) >= 0) return relic.action_id;
  if (actOf(o) === 2 && o.potions.length < 3) {
    const potion = stock.filter((a) => type(a) === "Potion").sort((x, y) => price(y) - price(x))[0];
    if (potion) return potion.action_id;
  }
  return leave;
}

/** §10.8: take a potion when there is a free slot (3, or 2 at A4+). */
export function wantsPotion(o: Observation, slots = 3): boolean {
  return o.potions.filter((p) => p && p !== "EMPTY").length < slots;
}
