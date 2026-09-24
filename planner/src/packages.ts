/**
 * Cards as parts of a deck (--flags packages; review #7). The card table
 * rates each card alone, so the payoffs of the archetypes in
 * docs/STRATEGY-research.md §2 sit below the skip threshold whatever the deck
 * holds (Body Slam 0.29, Barricade 0.31, Rupture 0.39 in act 2; fix1-a0 took
 * Body Slam 0 times in 76 offers, Inflame 0 in 24) and act 3's needs (§9c.8:
 * an engine that re-establishes itself between A10's two bosses, draw, a way
 * through 25-45 damage hits) are never asked about.
 *
 * packageBonus adds to a card's value (0-1 scale):
 * - a payoff, for the enablers the deck already has (Feel No Pain for its
 *   exhaust sources, Body Slam for its block, Rupture for its self-damage...);
 * - an enabler, when the deck has its payoff;
 * - from act 2, what the deck still lacks: scaling, then draw; in act 3,
 *   answers to big single hits.
 * The sizes are ours, to be measured.
 */

const set = (...ids: string[]) => new Set(ids);

/** §2.2. */
const EXHAUST_SOURCES = set("TRUE_GRIT", "BURNING_PACT", "SECOND_WIND", "FIEND_FIRE", "STOKE", "BRAND", "CINDER", "THRASH", "TREMBLE", "OFFERING", "FORGOTTEN_RITUAL", "MOLTEN_FIST", "CORRUPTION");
const EXHAUST_PAYOFFS = set("FEEL_NO_PAIN", "DARK_EMBRACE", "ASHEN_STRIKE", "PACTS_END", "EVIL_EYE");
/** §2.1; Bash is counted apart: "you need 2 or 3 reliable Vulnerable sources besides Bash". */
const VULNERABLE_SOURCES = set("TREMBLE", "TAUNT", "UPPERCUT", "THUNDERCLAP", "MOLTEN_FIST", "BREAK");
const VULNERABLE_PAYOFFS = set("DISMANTLE", "BULLY", "DOMINATE", "CRUELTY", "COLOSSUS", "VICIOUS");
/** §2.3. */
const SELF_DAMAGE = set("BLOODLETTING", "OFFERING", "BLOOD_WALL", "BREAKTHROUGH", "HEMOKINESIS", "BRAND", "CRIMSON_MANTLE", "INFERNO", "TEAR_ASUNDER");
const SELF_DAMAGE_PAYOFFS = set("RUPTURE", "INFERNO", "SPITE", "TEAR_ASUNDER");
/** §2.5: cards that block (Defends counted too, at half). */
const BLOCK = set("SHRUG_IT_OFF", "FLAME_BARRIER", "TAUNT", "TRUE_GRIT", "COLOSSUS", "EVIL_EYE", "IMPERVIOUS", "UNMOVABLE", "CRIMSON_MANTLE", "SECOND_WIND", "IRON_WAVE", "BLOOD_WALL", "STONE_ARMOR", "RAGE");
const BLOCK_PAYOFFS = set("BODY_SLAM", "BARRICADE", "JUGGERNAUT");
/** §2.4. */
const STRENGTH = set("DOMINATE", "INFLAME", "SETUP_STRIKE", "FIGHT_ME", "DEMON_FORM", "BRAND", "RUPTURE");
const MULTI_HITS = set("TWIN_STRIKE", "SWORD_BOOMERANG", "THRASH", "WHIRLWIND", "CONFLAGRATION", "ANGER", "FIGHT_ME", "PECK");
/** §9c.8 item 2. */
const DRAW = set("POMMEL_STRIKE", "BATTLE_TRANCE", "OFFERING", "BURNING_PACT", "DARK_EMBRACE", "BLOODLETTING");
/** §9c.8 item 3. */
const BIG_HIT_ANSWERS = set("IMPERVIOUS", "FLAME_BARRIER", "MANGLE", "UNMOVABLE", "UPPERCUT");
/** §3.4, §9c.8 item 1: scaling that holds up over a long fight, whatever else the deck has. */
const SCALING = set("DOMINATE", "DEMON_FORM", "THRASH", "ASHEN_STRIKE", "INFERNO", "CRIMSON_MANTLE", "UNMOVABLE", "CRUELTY", "STOKE");

const base = (id: string) => id.replace(/\+$/, "");

export interface DeckProfile {
  exhaust: number;
  exhaustPayoffs: number;
  vulnerable: number;
  vulnerablePayoffs: number;
  selfDamage: number;
  selfDamagePayoffs: number;
  block: number;
  blockPayoffs: number;
  strength: number;
  multiHits: number;
  draw: number;
  bigHitAnswers: number;
  /** Scaling the deck has, counting the conditional kinds once they have their enablers. */
  scaling: number;
}

export function profile(deck: readonly string[]): DeckProfile {
  const ids = deck.map(base);
  const n = (s: Set<string>) => ids.filter((c) => s.has(c)).length;
  const p: DeckProfile = {
    exhaust: n(EXHAUST_SOURCES),
    exhaustPayoffs: n(EXHAUST_PAYOFFS),
    vulnerable: n(VULNERABLE_SOURCES),
    vulnerablePayoffs: n(VULNERABLE_PAYOFFS),
    selfDamage: n(SELF_DAMAGE),
    selfDamagePayoffs: n(SELF_DAMAGE_PAYOFFS),
    block: n(BLOCK) + 0.5 * ids.filter((c) => c === "DEFEND_IRONCLAD").length,
    blockPayoffs: n(BLOCK_PAYOFFS),
    strength: n(STRENGTH),
    multiHits: n(MULTI_HITS),
    draw: n(DRAW),
    bigHitAnswers: n(BIG_HIT_ANSWERS),
    scaling: 0,
  };
  p.scaling = n(SCALING)
    + (ids.includes("FEEL_NO_PAIN") && p.exhaust >= 3 ? 1 : 0)
    + (ids.includes("RUPTURE") && p.selfDamage >= 3 ? 1 : 0)
    + (ids.includes("BARRICADE") && p.block >= 4 ? 1 : 0)
    + (ids.includes("JUGGERNAUT") && p.block >= 4 ? 1 : 0)
    + (ids.includes("INFLAME") ? 1 : 0);
  return p;
}

/** Whether a card would be scaling in this deck, once added. */
function scales(card: string, p: DeckProfile): boolean {
  if (SCALING.has(card) || card === "INFLAME") return true;
  if (card === "FEEL_NO_PAIN") return p.exhaust >= 3;
  if (card === "RUPTURE") return p.selfDamage >= 3;
  if (card === "BARRICADE" || card === "JUGGERNAUT") return p.block >= 4;
  return false;
}

/** How many damage cards a deck has of its own (§10.1.1 wants two before anything else in act 1). */
const OWN_DAMAGE = set("THRASH", "CONFLAGRATION", "DISMANTLE", "BLUDGEON", "POMMEL_STRIKE", "TWIN_STRIKE", "ANGER", "PERFECTED_STRIKE", "HEMOKINESIS", "UNRELENTING", "SWORD_BOOMERANG", "WHIRLWIND", "FIGHT_ME", "HEADBUTT", "UPPERCUT", "ASHEN_STRIKE", "BREAKTHROUGH");

/**
 * scale1: the scaling need from act 1 on, once the deck has its two damage cards. A10 runs that
 * brought scaling to Vantom won 10 of 11 (combo-a10) and 11 of 12 (combopk-a10); without it 7 of
 * 17 and 6 of 14 — and fewer than half had any.
 */
let scalingFromAct1 = false;
export function useScalingFromAct1(on: boolean): void {
  scalingFromAct1 = on;
}

/**
 * packages2 (astra-review-2 change 1): contributions a deck can use, kept apart.
 * - Damage scaling and defensive scaling are separate: Crimson Mantle or
 *   Unmovable "scaling" stopped the deck asking for damage, and the act 2
 *   decks dealt 27-36 a turn to an Insatiable that needs ~49.
 * - A conditional payoff needs its support first: Rupture was taken with no
 *   self-damage in the deck (seed 25) because it counted as a Strength card.
 * - Draw is draw: Bloodletting is HP for energy; Shrug It Off draws.
 * - Once the deck lacks damage scaling, frontload commons it already has
 *   several of give way (Pommel 34/38, Taunt 23/34, Anger 19/28 taken).
 * - Act 2 without AoE takes it: half the act 2 hallway deaths were to groups.
 */
let packages2 = false;
export function usePackages2(on: boolean): void {
  packages2 = on;
}
const DRAW2 = set("POMMEL_STRIKE", "BATTLE_TRANCE", "OFFERING", "BURNING_PACT", "DARK_EMBRACE", "SHRUG_IT_OFF");
const FRONTLOAD = set("POMMEL_STRIKE", "ANGER", "TAUNT", "TWIN_STRIKE", "HEADBUTT", "IRON_WAVE", "SWORD_BOOMERANG", "PERFECTED_STRIKE", "TREMBLE", "BREAKTHROUGH");
const AOE2 = set("CONFLAGRATION", "BREAKTHROUGH", "WHIRLWIND", "HOWL_FROM_BEYOND", "THUNDERCLAP", "INFERNO");

/** Damage that grows over a long fight, counting the conditional kinds only with their support. */
export function damageScaling(deck: readonly string[]): number {
  const ids = deck.map(base);
  const p = profile(deck);
  const n = (c: string) => ids.filter((x) => x === c).length;
  return n("DEMON_FORM") + n("INFLAME") + n("THRASH") + n("CRUELTY") + n("STOKE")
    + (p.vulnerable >= 1 ? n("DOMINATE") : 0)
    + (p.selfDamage >= 2 ? n("RUPTURE") + n("INFERNO") : 0)
    + (p.exhaust >= 2 ? n("ASHEN_STRIKE") : 0)
    + (p.block >= 4 ? n("JUGGERNAUT") : 0);
}

/** Whether adding `card` gives the deck damage scaling it could use. */
function scalesDamage(card: string, p: DeckProfile): boolean {
  if (["DEMON_FORM", "INFLAME", "THRASH", "CRUELTY", "STOKE"].includes(card)) return true;
  if (card === "DOMINATE") return p.vulnerable >= 1;
  if (card === "RUPTURE" || card === "INFERNO") return p.selfDamage >= 2;
  if (card === "ASHEN_STRIKE") return p.exhaust >= 2;
  if (card === "JUGGERNAUT") return p.block >= 4;
  return false;
}

/**
 * shop2: whether a card fills a gap this deck has now — damage scaling it can use (from act 2),
 * AoE in act 2, or draw when it has under two — so a shop buys it before a removal.
 */
export function fillsNeed(id: string, act: number, deck: readonly string[]): boolean {
  const card = base(id);
  const ids = deck.map(base);
  if (act >= 1 && damageScaling(deck) === 0 && scalesDamage(card, profile(deck))) return true;
  if (act === 1 && !ids.some((c) => AOE2.has(c)) && AOE2.has(card)) return true;
  return ids.filter((c) => DRAW2.has(c)).length < 2 && DRAW2.has(card);
}

function packageBonus2(card: string, act: number, deck: readonly string[]): number {
  const p = profile(deck);
  const ids = deck.map(base);
  const has = (c: string) => ids.includes(c);
  let b = 0;
  // Payoffs, for the support already there; nothing without it.
  if (EXHAUST_PAYOFFS.has(card) && p.exhaust >= 2) b += 0.08 * Math.min(4, p.exhaust);
  if (VULNERABLE_PAYOFFS.has(card) && p.vulnerable >= 1) b += 0.06 * Math.min(3, p.vulnerable);
  if (card === "RUPTURE" || card === "SPITE" || card === "TEAR_ASUNDER") b += p.selfDamage >= 2 ? 0.08 * Math.min(4, p.selfDamage) : -0.1;
  if (card === "INFERNO") b += 0.06 * Math.min(4, p.selfDamage);
  if (card === "BODY_SLAM") b += p.block >= 4 ? 0.04 * Math.min(6, p.block) + (has("BARRICADE") ? 0.2 : 0) : -0.1;
  if (card === "BARRICADE") b += p.block >= 4 ? 0.03 * Math.min(6, p.block) + (has("BODY_SLAM") || has("JUGGERNAUT") ? 0.15 : 0) : 0;
  if (card === "JUGGERNAUT") b += p.block >= 4 ? 0.03 * Math.min(6, p.block) : 0;
  if (MULTI_HITS.has(card)) b += 0.05 * Math.min(2, ids.filter((c) => ["DOMINATE", "INFLAME", "DEMON_FORM", "SETUP_STRIKE", "FIGHT_ME"].includes(c)).length);
  if (["INFLAME", "DEMON_FORM", "DOMINATE"].includes(card)) b += 0.04 * Math.min(3, p.multiHits);
  // Enablers, once their payoff is in.
  if (EXHAUST_SOURCES.has(card) && p.exhaustPayoffs > 0) b += 0.08;
  if (VULNERABLE_SOURCES.has(card) && p.vulnerablePayoffs > 0) b += 0.06;
  if (SELF_DAMAGE.has(card) && p.selfDamagePayoffs > 0) b += 0.08;
  if (BLOCK.has(card) && p.blockPayoffs > 0) b += 0.05;
  // What the deck lacks, from act 2.
  if (act >= 1) {
    const scaling = damageScaling(deck);
    if (scaling === 0 && scalesDamage(card, p)) b += act === 1 ? 0.2 : 0.25;
    if (scaling === 0 && FRONTLOAD.has(card) && ids.filter((c) => FRONTLOAD.has(c)).length >= 4) b -= 0.1;
    const draw = ids.filter((c) => DRAW2.has(c)).length;
    if (draw < 2 && DRAW2.has(card)) b += 0.08;
    if (act === 1 && !ids.some((c) => AOE2.has(c)) && AOE2.has(card)) b += 0.1;
  }
  if (act >= 2 && p.bigHitAnswers === 0 && BIG_HIT_ANSWERS.has(card)) b += 0.08;
  return b;
}

/** What a card adds to a deck beyond its own rating, for act 0-2. */
export function packageBonus(id: string, act: number, deck: readonly string[]): number {
  const card = base(id);
  if (packages2) return packageBonus2(card, act, deck);
  const p = profile(deck);
  const has = (c: string) => deck.some((d) => base(d) === c);
  let b = 0;
  // Payoffs, for the enablers already there.
  if (EXHAUST_PAYOFFS.has(card)) b += 0.08 * Math.min(4, p.exhaust);
  if (VULNERABLE_PAYOFFS.has(card)) b += 0.06 * Math.min(3, p.vulnerable);
  if (SELF_DAMAGE_PAYOFFS.has(card)) b += 0.08 * Math.min(4, p.selfDamage);
  if (card === "BODY_SLAM") b += 0.04 * Math.min(6, p.block) + (has("BARRICADE") ? 0.2 : 0);
  if (card === "BARRICADE") b += 0.03 * Math.min(6, p.block) + (has("BODY_SLAM") || has("JUGGERNAUT") ? 0.15 : 0);
  if (card === "JUGGERNAUT") b += 0.03 * Math.min(6, p.block);
  if (MULTI_HITS.has(card)) b += 0.05 * Math.min(2, p.strength);
  if (STRENGTH.has(card)) b += 0.04 * Math.min(3, p.multiHits);
  // Enablers, for a payoff already there.
  if (EXHAUST_SOURCES.has(card) && p.exhaustPayoffs > 0) b += 0.08;
  if (VULNERABLE_SOURCES.has(card) && p.vulnerablePayoffs > 0) b += 0.06;
  if (SELF_DAMAGE.has(card) && p.selfDamagePayoffs > 0) b += 0.08;
  if (BLOCK.has(card) && p.blockPayoffs > 0) b += 0.05;
  // From act 2 (scale1: from act 1, after two damage cards): what the deck still lacks.
  const ownDamage = deck.filter((c) => OWN_DAMAGE.has(base(c))).length;
  if (act === 0 && scalingFromAct1 && ownDamage >= 2 && p.scaling === 0 && scales(card, p)) b += 0.2;
  if (act >= 1) {
    if (p.scaling === 0 && scales(card, p)) b += act === 1 ? 0.15 : 0.2;
    if (p.draw < 2 && DRAW.has(card)) b += 0.08;
  }
  if (act >= 2 && p.bigHitAnswers === 0 && BIG_HIT_ANSWERS.has(card)) b += 0.08;
  return b;
}
