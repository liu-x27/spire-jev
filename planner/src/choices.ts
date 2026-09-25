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

import { type MapPoint, planPath } from "./path.ts";
import { fillsNeed, packageBonus, planBonus, profile, usePackages2, useScalingFromAct1 } from "./packages.ts";
import { fromObservation, useSmartExhaust } from "./sim.ts";
import { eloValue } from "./cardstats.ts";
import { relicSurplus } from "./relics.ts";
import { BARE, type Boss, bossFor, knownExactly, learnCard, modelledBoss, pairScore, type Player, sparScore, unknownCards, useBossTurns } from "./spar.ts";
import type { CardObs, LegalAction, Observation } from "./obs.ts";

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

/**
 * rules2 (--choices rules2, from docs/astra-review-1.md §4 and §7): cards the
 * §3.2 table lacks, rated roughly from what §2-§3.4 say of them (these are
 * our estimates, not sources' ratings), and act 1's damage slots filled first.
 */
let rules2 = false;
export function useRules2(on: boolean): void {
  rules2 = on;
}

/** Changes under test (--flags a,b), each off unless named. */
const flags = new Set<string>();
export function setFlags(names: readonly string[]): void {
  flags.clear();
  for (const n of names) if (n) flags.add(n);
  useScalingFromAct1(flags.has("scale1"));
  usePackages2(flags.has("packages2"));
  useSmartExhaust(flags.has("exhaust2"));
  useBossTurns(flags.has("spar2"));
}
export const hasFlag = (name: string) => flags.has(name);

/**
 * The act's boss, as the bridge reports it from the act's start (run-fights sets it on every screen);
 * "" when an older bridge does not say. Until 2026-09-24 every act 1 boss was Vantom (the first-run
 * profile), and act 1's multi-hit rule was written for its Slippery alone.
 */
let actBoss = "";
/** Act 3's second boss at A10 (floor 49, no rest before it); "" in other acts and from older bridges. */
let actSecondBoss = "";
export function setActBoss(boss: string | undefined, second?: string): void {
  actBoss = boss ?? "";
  actSecondBoss = second ?? "";
}
const EXTRA_CARDS: Record<string, { tiers: string; pick: [number, number, number] }> = {
  DEMON_FORM: { tiers: "BBBB", pick: [30, 30, 30] }, // §1.2: +3 Strength a turn since v0.111
  DARK_EMBRACE: { tiers: "CCCC", pick: [15, 20, 20] }, // disputed
  BLOODLETTING: { tiers: "AAAA", pick: [45, 40, 35] }, // §3.1: draw and energy are premium
  // The locked timeline never offered these (docs/PLAN.md, 2026-09-24); from here on the tiers follow
  // strong A10 players' Elo against skipping and the pick rates are A10's by act (card-stats-a10.json).
  INFERNO: { tiers: "CCCC", pick: [25, 13, 8] }, // Elo -152: below skipping, despite §2.3
  CRUELTY: { tiers: "AAAA", pick: [45, 42, 38] }, // Elo +169, 7th of 82
  BULLY: { tiers: "BBCC", pick: [30, 20, 15] },
  MOLTEN_FIST: { tiers: "BBCC", pick: [32, 27, 24] }, // Elo +6: doubles Vulnerable
  PACTS_END: { tiers: "BBBB", pick: [24, 23, 17] }, // Elo +26: 18 to all with 3 cards exhausted
  TEAR_ASUNDER: { tiers: "BBBB", pick: [26, 22, 22] }, // Elo +21
  BLOOD_WALL: { tiers: "CCCC", pick: [23, 18, 14] }, // Elo -119
  DEMONIC_SHIELD: { tiers: "CCCC", pick: [17, 21, 20] }, // Elo -93
  DRUM_OF_BATTLE: { tiers: "CCCC", pick: [15, 20, 21] }, // Elo -111
  CINDER: { tiers: "DDDD", pick: [8, 2, 1] }, // Elo -403, last of 82
  IMPERVIOUS: { tiers: "BBBB", pick: [30, 30, 30] },
  CASCADE: { tiers: "CCCC", pick: [15, 15, 15] },
  PYRE: { tiers: "CCCC", pick: [15, 15, 15] },
  STAMPEDE: { tiers: "CCCC", pick: [15, 15, 15] },
  EXPECT_A_FIGHT: { tiers: "CCCC", pick: [15, 15, 15] }, // §1.2: now a 3-cost block card
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
/**
 * cardValue with no deck-building flags: for choices inside a fight (Armaments, discovery), which
 * must not change with them — packages2+shop2 changed 8 Vantom fights through combatSelect before
 * act 2 began (astra-review-3), so deck experiments were not isolated.
 */
export function plainCardValue(id: string, act: Act, deck: readonly string[]): number {
  const saved = [...flags];
  flags.clear();
  try {
    return cardValue(id, act, deck);
  } finally {
    for (const f of saved) flags.add(f);
  }
}

export function cardValue(id: string, act: Act, deck: readonly string[]): number {
  const card = base(id);
  if (NEVER.has(card)) return -1;
  const row = CARDS[card] ?? (rules2 ? EXTRA_CARDS[card] : undefined);
  // elo: strong A10 players' own verdict (cardstats.ts), 0.5 = as good as skipping; the tier table
  // for cards the data lacks. (They rate Anger -302 and Body Slam -197 against skipping, Offering +314.)
  // elo2: only from act 2 — elo alone skipped so much in act 1 that decks met Vantom at 14.8 cards
  // (18.5 before) and won 4 of 24 (elo-a10); act 1 at A10 needs its frontload.
  const fromElo = flags.has("elo") || (flags.has("elo2") && act >= 1) ? eloValue(card) : undefined;
  let v = fromElo ?? (row ? 0.5 * ([...row.tiers].reduce((a, t) => a + (TIER[t] ?? 2), 0) / (row.tiers.length * 5)) + 0.5 * (row.pick[act] / 100) : 0.3);
  if (ALWAYS.has(card) && fromElo === undefined) v = Math.max(v, 0.9);
  // §10.1.10, §3.5: the first Battle Trance, not the second; two Trembles at most.
  const copies = deck.filter((c) => base(c) === card).length;
  if (card === "BATTLE_TRANCE" && copies >= 1) v *= 0.5;
  if (card === "TREMBLE" && copies >= 2) return -1;
  // §3.5 "too many of one card": the fourth and fifth Pommel Strike or Taunt (seen in the A0 runs)
  // are worth less than a card the deck lacks; each copy already held takes a fifth off.
  // nodup: not at all (the ablation runs/analysis-report.html 5.5 asks for: with the skip threshold
  // it took act 2's pick rate from 62% to 47%, and The Insatiable's win rate from 10/21 to 7/29).
  if (card !== "BATTLE_TRANCE" && card !== "TREMBLE" && !flags.has("nodup")) v *= Math.pow(0.8, copies);
  if (act === 0) {
    // §10.1.3: an AoE card when the deck has none.
    if (AOE.has(card) && count(deck, AOE) === 0) v += 0.15;
    // §10.1.4: three multi-hit sources before Vantom, the act 1 boss we keep meeting (rules2: Dismantle too).
    if ((MULTI_HIT.has(card) || (rules2 && card === "DISMANTLE")) && count(deck, MULTI_HIT) < 3 && (actBoss === "" || actBoss === "VANTOM_BOSS")) v += 0.1;
    // §10.1.1: damage first until the deck has two damage cards of its own. rules2: enough to beat a
    // support card's rating (A10 seed 7 took Taunt, Colossus and Taunt over Anger and Sword Boomerang).
    if (DAMAGE.has(card) && count(deck, DAMAGE) < 2) v += rules2 ? 0.25 : 0.1;
  }
  // packages: what the card adds to this deck as part of an archetype, and what the deck still lacks.
  if (flags.has("packages") || flags.has("packages2")) v += packageBonus(card, act, deck);
  if (flags.has("deckplan")) v += planBonus(card, act, deck);
  return v;
}

/** §3.6: strong players take a card from ~86% / 61% / 49% of rewards; below this, skip. */
export const SKIP_BELOW: [number, number, number] = [0.3, 0.45, 0.52];
/**
 * pickrate: thresholds at which the best offer of our runs' rewards clears
 * 86% / 61% / 49% of the time (§3.6's rates for strong players), for the
 * values rules2 gives, alone and with packages. SKIP_BELOW took 99% / 53% /
 * 12% (combo-a10, rules2-a0): the act 1 deck filled with second Taunts and
 * Angers, and act 3 took nothing.
 */
const SKIP_CALIBRATED: { plain: [number, number, number]; packages: [number, number, number] } = {
  plain: [0.45, 0.43, 0.37],
  packages: [0.46, 0.495, 0.47],
};

/**
 * spar (astra-review-3 #2, marginal contribution): what adding each card does to the deck against
 * the act's boss, played out in the simulator (spar.ts) — the same shuffles for every candidate.
 */
const SPAR_SAMPLES = 32;
const sparBase = new Map<string, number>();
function sparGain(deck: readonly string[], act: Act, floor: number, change: (d: string[]) => string[], at?: Sparring, more = 0): number {
  const bosses = sparBosses(act, at);
  const me = at?.me ?? BARE;
  // spar3's closer look: `more` shuffles after the first 32, on their own draws.
  const first = more > 0 ? SPAR_SAMPLES : 0;
  const n = more > 0 ? more : SPAR_SAMPLES;
  // sparpair: act 3's two bosses fought one after the other, on one HP bar.
  if (flags.has("sparpair") && bosses.length === 2) {
    const key = `pair/${bosses[0]!.model}/${bosses[1]!.model}/${floor}/${me.hp}/${me.maxHp}/${me.maxEnergy}/${me.relics.length}/${first}/${deck.join(",")}`;
    let base = sparBase.get(key);
    if (base === undefined) {
      if (sparBase.size > 64) sparBase.clear();
      base = pairScore(deck, bosses[0]!, bosses[1]!, n, floor, me, first);
      sparBase.set(key, base);
    }
    return pairScore(change([...deck]), bosses[0]!, bosses[1]!, n, floor, me, first) - base;
  }
  let gain = 0;
  for (const boss of bosses) {
    const key = `${boss.model}/${floor}/${me.hp}/${me.maxHp}/${me.maxEnergy}/${me.relics.length}/${first}/${deck.join(",")}`;
    let base = sparBase.get(key);
    if (base === undefined) {
      if (sparBase.size > 64) sparBase.clear();
      base = sparScore(deck, boss, n, floor, me, first);
      sparBase.set(key, base);
    }
    gain += sparScore(change([...deck]), boss, n, floor, me, first) - base;
  }
  return gain / bosses.length;
}
/** The bosses a deck is measured against: the act's, and with sparboth act 3's second too (the mean of the two). */
function sparBosses(act: Act, at?: Sparring): Boss[] {
  const bosses = [at?.boss ?? bossFor(actBoss, act)];
  // sparboth: seed 497 (A10) beat Aeonglass and died to the Test Subject, whom its act 3 picks were
  // never measured against: floor 42's Taunt, +25 against Aeonglass, is +0 against it, and Stone
  // Armor +18 and +29.
  const second = flags.has("sparboth") || flags.has("sparpair") ? modelledBoss(actSecondBoss) : undefined;
  if (second && second.model !== bosses[0]!.model) bosses.push(second);
  return bosses;
}
/** A deck's score (the mean over the bosses), for comparing what the deck and the player both change: spar4's rest. */
function sparValue(deck: readonly string[], act: Act, floor: number, at: Sparring, me: Player, first = 0, n = SPAR_SAMPLES, hpWeight = 0.7): number {
  const bosses = sparBosses(act, at);
  if (flags.has("sparpair") && bosses.length === 2) return pairScore(deck, bosses[0]!, bosses[1]!, n, floor, me, first, hpWeight);
  return bosses.reduce((a, boss) => a + sparScore(deck, boss, n, floor, me, first, hpWeight), 0) / bosses.length;
}

/**
 * spar4 (astra-review-4 #2): one evaluator for what changes the deck. Every legal removal, not
 * worstCard's nominee; the upgrade by what it adds; heal or smith before the boss by the bout; and
 * a card or removal the bout turned down is not bought by the rules after it.
 */
let removeNext: { id: string; floor: number } | undefined;
const UNREMOVABLE = new Set(["ASCENDERS_BANE"]);
function removals(deck: readonly string[]): string[] {
  return [...new Set(deck)].filter((c) => !UNREMOVABLE.has(c) && (REMOVABLE.test(c) || JUNK.has(base(c)) || /^(STRIKE|DEFEND)_IRONCLAD/.test(c)));
}
const withoutOne = (id: string) => (d: string[]) => {
  d.splice(d.indexOf(id), 1);
  return d;
};
const upgraded = (id: string) => (d: string[]) => {
  d.splice(d.indexOf(id), 1, `${id}+`);
  return d;
};
/**
 * spar4: the upgrade that adds most against the boss. Of a smith's offers, all or none: one the
 * catalogue has never seen upgraded leaves the choice to the rules; of the deck (the rest site's
 * question), those it has seen.
 */
function sparUpgrade(o: Observation, ids: readonly string[], at: Sparring, me: Player = at.me, offered = true): { id: string; gain: number } | undefined {
  let candidates = [...new Set(ids.map(base))].filter((id) => o.deck_cards.includes(id) && !JUNK.has(id));
  if (offered && candidates.some((id) => !knownExactly(`${id}+`))) return undefined;
  candidates = candidates.filter((id) => knownExactly(`${id}+`));
  if (candidates.length === 0) return undefined;
  const at2 = { ...at, me };
  const options = candidates.map((id) => ({ id, change: upgraded(id), gain: sparGain(o.deck_cards, actOf(o), o.floor, upgraded(id), at2) }));
  closerLook(o, at2, options).sort((x, y) => y.gain - x.gain);
  return options[0];
}

/**
 * spar3 (astra-review-4 #1): what the bout is played with. The run's max HP (at full HP: a rest site
 * comes before each boss), its relics and their numbers, and its last fight's opening: energy, the
 * hand drawn, the Strength, Vigor or block its relics gave. Nothing where the act's boss is not
 * modelled (the Queen was not until 2026-09-25, and bossFor gave The Insatiable): the rules decide
 * there, not a fight with another boss.
 */
interface Sparring {
  boss: Boss;
  me: Player;
}
let opening: Pick<Player, "energy" | "maxEnergy" | "hand" | "block" | "powers"> | undefined;
// What a relic gives at the start of a fight, not what the encounter puts on the player.
const OPENING_POWERS = new Set(["STRENGTH", "DEXTERITY", "VIGOR", "THORNS", "PLATED_ARMOR", "METALLICIZE", "ARTIFACT", "REGEN", "BUFFER"]);
/** A fight's first observation (run-fights, before it is played): its opening, for spar3's bouts. */
export function noteCombatStart(o: Observation): void {
  if (!o.combat || (o.combat.turn ?? 1) !== 1) return;
  try {
    const s = fromObservation(o);
    const powers = Object.fromEntries(Object.entries(s.player.powers).filter(([k, v]) => OPENING_POWERS.has(k) && v !== 0));
    opening = { energy: s.energy, maxEnergy: s.maxEnergy ?? 3, hand: o.combat.hand.length, block: s.player.block, powers };
  } catch {
    // an observation the simulator cannot read: keep the last opening
  }
}
function sparring(o: Observation, act: Act): Sparring | undefined {
  if (!flags.has("spar3")) return { boss: bossFor(actBoss, act), me: BARE };
  const boss = actBoss ? modelledBoss(actBoss) : bossFor("", act);
  if (!boss) return undefined;
  const maxHp = o.player_max_hp > 0 ? o.player_max_hp : BARE.maxHp;
  return {
    boss,
    me: { ...BARE, ...(opening ?? {}), hp: maxHp, maxHp, relics: o.relics, ...(o.relic_vars ? { relicVars: o.relic_vars } : {}) },
  };
}
/** An offered card's id as the deck would hold it ("BASH+"), its description learnt for the bout. */
function offeredId(id: string, upgrades: unknown, described?: unknown): string {
  const d = described as CardObs | undefined;
  const up = Number(upgrades ?? d?.upgrades ?? 0) > 0;
  if (d && typeof d === "object" && d.card_id === id) {
    const { index: _i, can_play: _c, ...rest } = d;
    learnCard(`${id}${(d.upgrades ?? 0) > 0 ? "+" : ""}`, rest);
  }
  return `${id}${up ? "+" : ""}`;
}
/**
 * spar3: the candidates within reach of the line (gain 5), or of the best one, looked at again over
 * 128 more shuffles: one more win in 32 is worth 1.9 of the 5 points (astra-review-4).
 */
function closerLook<T extends { gain: number; change: (d: string[]) => string[] }>(o: Observation, at: Sparring, options: T[]): T[] {
  if (!flags.has("spar3") || options.length === 0) return options;
  const best = Math.max(...options.map((x) => x.gain));
  for (const x of options) {
    if (!Number.isFinite(x.gain) || (Math.abs(x.gain - 5) > 10 && best - x.gain > 10)) continue;
    const again = sparGain(o.deck_cards, actOf(o), o.floor, x.change, at, 128);
    x.gain = (x.gain * SPAR_SAMPLES + again * 128) / (SPAR_SAMPLES + 128);
  }
  return options;
}

export function chooseCardReward(o: Observation, legal: LegalAction[]): string {
  const offers = legal.filter((a) => a.action_id.startsWith("choose_card:"));
  const at = flags.has("spar") && offers.length > 0 ? sparring(o, actOf(o)) : undefined;
  const described = (o.room?.details?.["cards"] ?? []) as unknown[];
  const ids = offers.map((a) => {
    const card = String(a.metadata?.["card_id"] ?? a.action_id.split(":")[2]);
    return flags.has("spar3") ? offeredId(card, a.metadata?.["upgrades"], described[Number(a.metadata?.["card_index"] ?? -1)]) : card;
  });
  // spar3: offers with a card the simulator has never seen are valued by the rules.
  if (at && !(flags.has("spar3") && unknownCards(ids).length > 0)) {
    const options = offers.map((a, i) => {
      const card = ids[i]!;
      const change = (d: string[]) => [...d, card];
      // never-take list
      const gain = cardValue(card.replace(/\+$/, ""), actOf(o), o.deck_cards) < 0 ? -Infinity : sparGain(o.deck_cards, actOf(o), o.floor, change, at);
      return { id: a.action_id, gain, change };
    });
    const best = closerLook(o, at, options).sort((x, y) => y.gain - x.gain)[0];
    if (best && best.gain >= 5) return best.id;
    return legal.find((a) => a.action_id === "skip_card")?.action_id ?? best?.id ?? legal[0]!.action_id;
  }
  let best: { id: string; v: number } | undefined;
  for (const a of offers) {
    const card = String(a.metadata?.["card_id"] ?? a.action_id.split(":")[2]);
    const v = cardValue(card, actOf(o), o.deck_cards);
    if (!best || v > best.v) best = { id: a.action_id, v };
  }
  const skipBelow: readonly [number, number, number] = flags.has("elo") ? [0.5, 0.5, 0.5] : flags.has("elo2") ? [SKIP_BELOW[0], 0.5, 0.5]
    : flags.has("pickrate") ? (flags.has("packages") ? SKIP_CALIBRATED.packages : SKIP_CALIBRATED.plain) : SKIP_BELOW;
  if (best && best.v >= skipBelow[actOf(o)]) return best.id;
  return legal.find((a) => a.action_id === "skip_card")?.action_id ?? best?.id ?? legal[0]!.action_id;
}

/**
 * §7, §10.5: smith at 65%+ of max HP; rest at 40% or below, or under 25 HP
 * (35 before the boss); between, smith unless the boss is next (then rest
 * below 85%, ours, from the boss fights lost).
 */
export function chooseRest(o: Observation, legal: LegalAction[]): string {
  const find = (re: RegExp) => legal.find((a) => re.test(a.action_id))?.action_id;
  const heal = find(/^choose_rest:.*heal/i);
  const smith = find(/^choose_rest:.*smith/i);
  const share = o.player_hp / Math.max(1, o.player_max_hp);
  // The rest site before each boss: acts have 17, 16 and 15 floors (the game's catalog), bosses on 17, 33, 48.
  const bossNext = [16, 32, 47].includes(o.floor);
  // Before the boss, rest below 85%: the act 1 boss fights lost ended with Vantom at 12-37 HP after
  // coming in at about 73%, and a rest (30% of max HP) is worth more there than one upgrade.
  // smith2 (docs/a10-upgrades-research.md, 51 winning A10 runs on v0.107.1+): winners smith at 81%
  // of rest sites; they heal mid-act below ~40%, before the act 2 boss below ~50% (the next Ancient
  // heals 80% of what is missing), before the act 3 double boss unless at 85%+. Before Vantom our own
  // runs say HP decides it (winners came in at 95%, losers 85%): 85% there.
  // spar4: before the boss, the bout says which: the deck at this HP healed, or upgraded at this HP.
  const at = flags.has("spar4") && bossNext && heal && smith ? sparring(o, actOf(o)) : undefined;
  if (at) {
    const now: Player = { ...at.me, hp: Math.max(1, o.player_hp) };
    const healed: Player = { ...now, hp: Math.min(o.player_max_hp, o.player_hp + Math.round(0.3 * o.player_max_hp)) };
    const up = sparUpgrade(o, o.deck_cards.filter((c) => !c.endsWith("+")), at, now, false);
    if (up) {
      const n = SPAR_SAMPLES + 128;
      // No HP term: the healed Ironclad, losing as well, would lose more of it. A tie is a smith: the
      // upgrade stays, HP after an act's boss mostly comes back (the next Ancient heals 80% of it).
      const healValue = sparValue(o.deck_cards, actOf(o), o.floor, at, healed, 0, n, 0);
      const smithValue = sparValue(upgraded(up.id)([...o.deck_cards]), actOf(o), o.floor, at, now, 0, n, 0);
      return (smithValue >= healValue ? smith : heal)!;
    }
  }
  if (flags.has("smith2")) {
    const healNow = o.floor === 32 ? share < 0.5 : bossNext ? share < 0.85 : share < 0.4 || o.player_hp < 25;
    return (healNow ? heal ?? smith : smith ?? heal) ?? legal[0]!.action_id;
  }
  const rest = share <= 0.4 || o.player_hp < (bossNext ? 35 : 25) || (bossNext && share < 0.85);
  // restbudget (review #5): away from the boss, heal when most of the heal would still be there when the
  // boss fight starts. A10 runs smithed at 58% on average and came to the rest before Vantom at 41%.
  if (!rest && !bossNext && flags.has("restbudget") && heal && smith && healCarried(o) >= 0.12 * o.player_max_hp) return heal;
  return (rest ? heal ?? smith : smith ?? heal) ?? legal[0]!.action_id;
}

/** HP lost per fight in acts 1-3 (fix1-a0, bosses left out); fix1-a10 lost 1.38 times as much. */
const LOSS_PER_FIGHT = [10.6, 15.6, 19.6];
/**
 * How much more HP a heal here leaves for the next boss: the fights before
 * the rest site ahead of it (about one floor in two between here and there,
 * as in fix1-a10) take their share whichever we do, that rest site heals
 * again, and neither heal goes past max HP.
 */
export function healCarried(o: Observation): number {
  const max = o.player_max_hp;
  const heal = Math.round(0.3 * max);
  const next = [16, 32, 47].find((f) => f > o.floor) ?? 47;
  const fights = 0.55 * Math.max(0, next - o.floor - 1);
  const loss = fights * LOSS_PER_FIGHT[actOf(o)]! * (1 + 0.038 * (o.ascension ?? 0));
  const atBoss = (hp: number) => Math.min(max, Math.max(1, Math.min(max, hp) - loss) + heal);
  return atBoss(o.player_hp + heal) - atBoss(o.player_hp);
}

/** §3.8, §10.5.6: upgrades that change how a card works first; never Strike or Defend while better exists. */
const SMITH_ORDER = [
  "BODY_SLAM", "BARRICADE", "UNMOVABLE", "DARK_EMBRACE", "STAMPEDE", "INFERNAL_BLADE", "CORRUPTION",
  "STOKE", "ARMAMENTS", "TRUE_GRIT",
  "UPPERCUT", "RUPTURE", "POMMEL_STRIKE", "WHIRLWIND", "VICIOUS", "PYRE", "CASCADE",
  "THRASH", "FIEND_FIRE", "ASHEN_STRIKE",
];
const SMITH_LAST = new Set(["STRIKE_IRONCLAD", "DEFEND_IRONCLAD", "SHRUG_IT_OFF", "COLOSSUS", "TREMBLE", "EVIL_EYE", "BLOOD_WALL", "FEED"]);
/** smith2: winners' upgrade order when held (66 A10 wins, 51 on v0.107.1+), and what they almost never upgraded. */
const SMITH_ORDER2 = [
  "ARMAMENTS", "TRUE_GRIT", "BARRICADE", "BODY_SLAM", "UNMOVABLE", "DARK_EMBRACE", "HAVOC", "PYRE", "OFFERING", "STOKE",
  "BURNING_PACT", "POMMEL_STRIKE", "UPPERCUT",
];
const SMITH_LAST2 = new Set(["STRIKE_IRONCLAD", "DEFEND_IRONCLAD", "BATTLE_TRANCE", "COLOSSUS", "TAUNT", "BASH"]);

export function chooseUpgrade(o: Observation, legal: LegalAction[]): string {
  const offers = legal.filter((a) => a.action_id.startsWith("choose_upgrade:"));
  const idOf = (a: LegalAction) => base(a.action_id.split(":")[2] ?? "");
  const at = flags.has("spar4") && offers.length > 1 ? sparring(o, actOf(o)) : undefined;
  const up = at ? sparUpgrade(o, offers.map(idOf), at) : undefined;
  if (up) return offers.find((a) => idOf(a) === up.id)!.action_id;
  const rank = (a: LegalAction) => {
    const id = idOf(a);
    // smith2 (and smithorder, the order alone — smith2's rest thresholds cost Vantom its HP: 11/26
    // with 82% coming in, against 17/28 at 94%): the order winners upgraded in, payoffs only with support.
    if (flags.has("smith2") || flags.has("smithorder")) {
      const p = profile(o.deck_cards);
      const unsupported = ((id === "BODY_SLAM" || id === "BARRICADE" || id === "JUGGERNAUT") && p.block < 4) || (id === "RUPTURE" && p.selfDamage < 2);
      const i = SMITH_ORDER2.indexOf(id);
      if (i >= 0 && !unsupported) return 200 - i;
      if (SMITH_LAST2.has(id)) return -10;
      return 20 + cardValue(id, actOf(o), o.deck_cards) * 10 - (unsupported ? 15 : 0);
    }
    // upgrade2: a payoff's upgrade only with its support (Body Slam was upgraded first regardless).
    if (flags.has("upgrade2")) {
      const p = profile(o.deck_cards);
      const unsupported = ((id === "BODY_SLAM" || id === "BARRICADE" || id === "JUGGERNAUT") && p.block < 4) || (id === "RUPTURE" && p.selfDamage < 2)
        || (id === "FEEL_NO_PAIN" && p.exhaust < 2);
      if (unsupported) return 20 + cardValue(id, actOf(o), o.deck_cards) * 10 - 15;
    }
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
/** Curses and statuses by exact id, for when the card's type is not to hand (a substring test took BURNING_PACT for BURN). */
const JUNK = new Set(["INJURY", "CLUMSY", "SPORE_MIND", "NORMALITY", "DECAY", "GUILTY", "POOR_SLEEP", "GREED", "BAD_LUCK", "DOUBT",
  "REGRET", "SHAME", "WRITHE", "PAIN", "DEBT", "ASCENDERS_BANE", "WOUND", "DAZED", "SLIMED", "BURN", "INFECTION", "VOID"]);

/**
 * What a card already in the deck is worth keeping: its ratings and its pick
 * rate over all acts, and nothing of what adding another copy would be worth
 * (the "no third Tremble" -1 made a Tremble held the worst card in the deck).
 */
function keepValue(id: string): number {
  const card = base(id);
  const row = CARDS[card];
  let v = row ? 0.5 * ([...row.tiers].reduce((a, t) => a + (TIER[t] ?? 2), 0) / (row.tiers.length * 5)) + 0.5 * ((row.pick[0] + row.pick[1] + row.pick[2]) / 300) : 0.3;
  if (ALWAYS.has(card)) v = Math.max(v, 0.9);
  return v;
}

export function worstCard(ids: readonly string[], deck: readonly string[], types?: readonly (string | undefined)[]): number {
  const blockCards = deck.filter((c) => ["SHRUG_IT_OFF", "FLAME_BARRIER", "TAUNT", "TRUE_GRIT", "COLOSSUS", "EVIL_EYE", "IMPERVIOUS", "UNMOVABLE", "CRIMSON_MANTLE", "SECOND_WIND", "IRON_WAVE"].includes(base(c))).length;
  const order = (id: string, i: number) => {
    const c = base(id);
    const type = types?.[i];
    if (type === "Curse" || type === "Status" || JUNK.has(c)) return 0;
    if (c === "DEFEND_IRONCLAD") return blockCards >= 3 ? 1 : 2;
    if (c === "STRIKE_IRONCLAD") return blockCards >= 3 ? 2 : 1;
    if (c === "BASH") return 50;
    return 10 + keepValue(c) * 30;
  };
  let best = 0;
  ids.forEach((id, i) => {
    if (order(id, i) < order(ids[best]!, best)) best = i;
  });
  return best;
}

export function chooseCardSelect(o: Observation, legal: LegalAction[]): string {
  const offers = legal.filter((a) => a.action_id.startsWith("choose_card_select:"));
  if (offers.length === 0) return legal[0]!.action_id;
  const ids = offers.map((a) => a.action_id.split(":")[2] ?? "");
  return offers[worstCard(ids, o.deck_cards)]!.action_id;
}

// (Ascender's Bane, A5, cannot be removed: not a reason to buy a removal.)
const REMOVABLE = /STRIKE_IRONCLAD|DEFEND_IRONCLAD|CURSE|INJURY|CLUMSY|SPORE_MIND|NORMALITY|DECAY|GUILTY|POOR_SLEEP|GREED|BAD_LUCK/;

/**
 * §5, §10.3: removal first while there is a Strike, Defend or curse to take
 * out, unless an S-tier card is on sale; then a card worth taking; relics
 * when there is gold for them; potions in act 3 only; then leave.
 */
/**
 * Relics that open a screen the shop cannot answer: Orrery's five card
 * rewards (base2-a0 seed 35 bought it on floor 37 and the run stalled).
 */
const SHOP_NEVER = new Set(["ORRERY"]);

export function chooseShop(o: Observation, legal: LegalAction[]): string {
  const leave = legal.find((a) => a.action_id === "shop_leave")?.action_id ?? legal[0]!.action_id;
  const stock = legal.filter((a) => a.action_id.startsWith("shop_buy:") && a.metadata?.["stocked"] !== false && a.metadata?.["affordable"] !== false
    && !SHOP_NEVER.has(String(a.metadata?.["item_id"] ?? "")));
  const price = (a: LegalAction) => Number(a.metadata?.["price"] ?? 9999);
  // The bridge names entries by class: MerchantCardEntry, MerchantCardRemovalEntry, MerchantRelicEntry, MerchantPotionEntry.
  const type = (a: LegalAction) => String(a.metadata?.["entry_type"] ?? "").replace(/^Merchant/, "").replace(/Entry$/, "");
  const item = (a: LegalAction) => String(a.metadata?.["item_id"] ?? "");
  const cards = stock.filter((a) => type(a) === "Card").map((a) => ({ a, v: cardValue(item(a), actOf(o), o.deck_cards) })).sort((x, y) => y.v - x.v);
  const removal = stock.find((a) => /remov/i.test(type(a)));
  const topCard = cards[0];
  // spar4: the bout decides the cards, this one too.
  if (topCard && topCard.v >= 0.85 && !flags.has("spar4")) return topCard.a.action_id;
  // relicvalue (docs/relic-tiers.md §2): relics by what they are worth at their price, not the
  // cheapest; one worth 100 gold more than it costs comes before the removal (rule 2).
  const relics = flags.has("relicvalue")
    ? stock.filter((a) => type(a) === "Relic").map((a) => ({ a, surplus: relicSurplus(item(a), price(a), actOf(o)) ?? -Infinity })).sort((x, y) => y.surplus - x.surplus)
    : [];
  if (relics[0] && relics[0].surplus > 100) return relics[0].a.action_id;
  // shop2 (astra-review-2 #2): a card that fills a gap comes before the removal. Removals took 65%
  // of A10 shop gold while eight affordable Inflames were passed over.
  // spar: the shop's cards and the removal on one scale, what each does to the deck against the boss.
  const at = flags.has("spar") ? sparring(o, actOf(o)) : undefined;
  // spar3: the card as the shop has it (upgraded or not), from the shop's descriptions by slot.
  const shopCards = (o.room?.details?.["cards"] ?? {}) as Record<string, unknown>;
  const shopId = (a: LegalAction) => {
    if (!flags.has("spar3")) return item(a);
    const d = shopCards[String(a.metadata?.["slot_index"] ?? "")] as CardObs | undefined;
    return offeredId(item(a), d?.upgrades, d);
  };
  let sparred = false;
  if (at && !(flags.has("spar3") && unknownCards(cards.map((c) => shopId(c.a))).length > 0)) {
    sparred = true;
    const worst = o.deck_cards[worstCard(o.deck_cards, o.deck_cards)];
    // spar4: every card a removal could take, not worstCard's alone. A curse first, whatever the bout
    // says: the simulator plays Decay, Regret, Doubt as dead cards and no more (all five gave the
    // same +2.1 from three in the starter deck against Vantom).
    const curse = removal && flags.has("spar4") ? removals(o.deck_cards).find((c) => JUNK.has(base(c))) : undefined;
    if (curse) {
      resetCardSelect();
      removeNext = { id: curse, floor: o.floor };
      return removal!.action_id;
    }
    const takeOut = removal ? (flags.has("spar4") ? removals(o.deck_cards) : worst && REMOVABLE.test(worst) ? [worst] : []) : [];
    const options: { a: LegalAction; change: (d: string[]) => string[]; gain: number; out?: string }[] = [
      ...cards.map((c) => {
        const id = shopId(c.a);
        const change = (d: string[]) => [...d, id];
        return { a: c.a, change, gain: c.v < 0 ? -Infinity : sparGain(o.deck_cards, actOf(o), o.floor, change, at) };
      }),
      ...takeOut.map((id) => ({ a: removal!, change: withoutOne(id), gain: sparGain(o.deck_cards, actOf(o), o.floor, withoutOne(id), at), out: id })),
    ];
    closerLook(o, at, options).sort((x, y) => y.gain - x.gain);
    if (options[0] && options[0].gain >= 5) {
      if (/remov/i.test(type(options[0].a))) {
        resetCardSelect();
        if (flags.has("spar4") && options[0].out) removeNext = { id: options[0].out, floor: o.floor };
      }
      return options[0].a.action_id;
    }
  }
  // spar4: what the bout turned down is not bought by the rules; relics and potions still are.
  const rulesBuy = !(sparred && flags.has("spar4"));
  const shop2 = flags.has("shop2");
  if (shop2 && rulesBuy) {
    const need = cards.find((c) => c.v >= 0.5 && fillsNeed(item(c.a), actOf(o), o.deck_cards));
    if (need) return need.a.action_id;
  }
  // keepbasics: winners keep 7-8 basics and out-grow them (docs/a10-decks-research.md §3.2); a
  // removal only for a curse or while more than 7 Strikes and Defends are left, after a good card.
  const basics = o.deck_cards.filter((c) => /^(STRIKE|DEFEND)_IRONCLAD/.test(c)).length;
  const curse = o.deck_cards.some((c) => REMOVABLE.test(c) && !/^(STRIKE|DEFEND)_IRONCLAD/.test(c));
  const keep = flags.has("keepbasics") && !curse;
  if (keep && topCard && topCard.v >= 0.55 && rulesBuy) return topCard.a.action_id;
  if (removal && rulesBuy && (!keep || basics > 7) && o.deck_cards.some((c) => REMOVABLE.test(c))) {
    // The card select that follows is the removal's, whatever an event left behind.
    resetCardSelect();
    return removal.action_id;
  }
  if (topCard && topCard.v >= (shop2 ? 0.55 : 0.65) && rulesBuy) return topCard.a.action_id;
  if (flags.has("relicvalue")) {
    if (relics[0] && relics[0].surplus > 0) return relics[0].a.action_id;
  } else {
    const relic = stock.filter((a) => type(a) === "Relic").sort((x, y) => price(x) - price(y))[0];
    if (relic && o.gold - price(relic) >= 0) return relic.action_id;
  }
  // shop2: potions from act 2 into free slots, for the damage the act 2 boss needs early. Only into
  // a free slot: with the belt full the game refuses the potion (PotionCmd.TryToProcure) and nothing
  // changes, and at A4+ the belt is 2 (JEV00707 at A10 asked for the same potion until run-fights left).
  if ((shop2 ? actOf(o) >= 1 : actOf(o) === 2) && wantsPotion(o, o.potion_slots ?? 3)) {
    const potion = stock.filter((a) => type(a) === "Potion").sort((x, y) => price(y) - price(x))[0];
    if (potion) return potion.action_id;
  }
  return leave;
}

/** §10.8: take a potion when there is a free slot (3, or 2 at A4+). */
export function wantsPotion(o: Observation, slots = 3): boolean {
  return o.potions.filter((p) => p && p !== "EMPTY").length < slots;
}

interface EventOptionObs {
  index: number;
  text_key?: string;
  title?: string;
  description?: string;
  locked?: boolean;
  proceed?: boolean;
  relic?: string | null;
  kills?: boolean;
}

const hpShare = (o: Observation) => o.player_hp / Math.max(1, o.player_max_hp);
const blockCount = (deck: readonly string[]) =>
  deck.filter((c) => ["SHRUG_IT_OFF", "FLAME_BARRIER", "TAUNT", "TRUE_GRIT", "COLOSSUS", "EVIL_EYE", "IMPERVIOUS", "UNMOVABLE", "CRIMSON_MANTLE", "SECOND_WIND", "IRON_WAVE"].includes(base(c))).length;

/**
 * §6, §10.4: the option to take at each event, by the event's id and the
 * options' keys (the part of text_key after "options."). The Ancients'
 * orders (TEZCATARA, PAEL) are §9b/§10.9's rankings for Ironclad.
 */
const EVENTS: Record<string, (o: Observation, keys: readonly string[]) => string | undefined> = {
  BYRDONIS_NEST: () => "EAT",
  SAPPHIRE_SEED: () => "EAT",
  WOOD_CARVINGS: () => "BIRD",
  MORPHIC_GROVE: (o) => (o.gold < 60 ? "GROUP" : "LONER"),
  // §9b: the relic, Clumsy and all, by default.
  THIS_OR_THAT: () => "ORNATE",
  FIELD_OF_MAN_SIZED_HOLES: () => "RESIST",
  LOST_WISP: () => "SEARCH",
  WHISPERING_HOLLOW: (o) => (hpShare(o) > 0.5 ? "HUG" : "GOLD"),
  SYMBIOTE: () => "KILL_WITH_FIRE",
  ROOM_FULL_OF_CHEESE: (o) => (o.player_hp - 14 >= 0.5 * o.player_max_hp ? "SEARCH" : "GORGE"),
  TEA_MASTER: () => "TEA_OF_DISCOURTESY",
  THE_LANTERN_KEY: () => "RETURN_THE_KEY",
  SELF_HELP_BOOK: () => "READ_THE_BACK",
  WELCOME_TO_WONGOS: (o) => (o.gold >= 100 ? "BARGAIN_BIN" : "LEAVE"),
  SPIRIT_GRAFTER: (o) => (hpShare(o) > 0.35 ? "REJECTION" : "LET_IT_IN"),
  ZEN_WEAVER: (o) => (o.gold >= 250 ? "ARACHNID_ACUPUNCTURE" : o.gold >= 125 ? "EMOTIONAL_AWARENESS" : undefined),
  AMALGAMATOR: (o) => (blockCount(o.deck_cards) >= 3 ? "COMBINE_DEFENDS" : "COMBINE_STRIKES"),
  // §9b: pay 5 HP to choose between two dolls; never take one at random while HP allows.
  DOLL_ROOM: (o) => (o.player_hp > 15 ? "TAKE_SOME_TIME" : "RANDOM"),
  // Tablet of Truth: each Decipher costs twice the max HP the one before (3, 6, 12, 24 ...) for a random
  // upgrade, and nothing stopped the default rule, which only minds HP under half: 34 of 36 visits on the
  // veteran profile left 20+ max HP behind (-76 on average), runs at 1 max HP. Decipher once (twice with
  // 70+ max HP), then give up; Smash (20 HP back) under half HP.
  TABLET_OF_TRUTH: (o, keys) => {
    const first = (o.room?.details as { options?: { text_key?: string }[] } | undefined)?.options?.[0]?.text_key ?? "";
    const page = /\.pages\.([A-Z0-9_]+)\.options\./.exec(first)?.[1] ?? "INITIAL";
    if (page === "INITIAL") return hpShare(o) < 0.5 && keys.includes("SMASH") ? "SMASH" : "DECIPHER_1";
    if (page === "DECIPHER_1" && o.player_max_hp >= 70) return "DECIPHER";
    return "GIVE_UP";
  },
  // Underdocks: Nab is a relic and an Injury for good; taking on both Punch Constructs is a relic and a
  // potion, but cost 72 and 37 HP at A10 (veteran seeds 27, 39; one alone costs about 9). Nab.
  PUNCH_OFF: (o, keys) => (keys.includes("FIGHT") ? "FIGHT" : "NAB"),
  // Slippery Bridge names the card it will take in text only: reroll once while healthy, then cross.
  SLIPPERY_BRIDGE: (o, keys) => (keys.includes("HOLD_ON_0") && hpShare(o) > 0.6 ? "HOLD_ON_0" : "OVERCOME"),
  // §9b: keep reaching deeper (5 HP a step) while HP stays at half or more, then take the prize.
  COLOSSAL_FLOWER: (o, keys) => {
    const deeper = keys.find((k) => k.startsWith("REACH_DEEPER_"));
    return deeper && o.player_hp - 5 >= 0.5 * o.player_max_hp ? deeper : keys.find((k) => k.startsWith("EXTRACT_"));
  },
  // §10.9. Nutritious Soup only with four Strikes left to enchant.
  TEZCATARA: (o, keys) => {
    const strikes = o.deck_cards.filter((c) => base(c) === "STRIKE_IRONCLAD").length;
    const order = ["TOASTY_MITTENS", "STORYBOOK", "SEAL_OF_GOLD", "VERY_HOT_COCOA", ...(strikes >= 4 ? ["NUTRITIOUS_SOUP"] : []),
      "PUMPKIN_CANDLE", "BIIIG_HUG", "YUMMY_COOKIE", "NUTRITIOUS_SOUP", "GOLDEN_COMPASS", "TOY_BOX"];
    return order.find((k) => keys.includes(k));
  },
  // §10.9 (disputed: Jorbs prefers Claw and Growth; the population data and two guides put Blood and Legion first).
  PAEL: (o, keys) => {
    const defends = o.deck_cards.filter((c) => base(c) === "DEFEND_IRONCLAD").length;
    const claw = defends >= 3 && o.deck_cards.some((c) => ["FEEL_NO_PAIN", "EVIL_EYE", "ASHEN_STRIKE", "DARK_EMBRACE"].includes(base(c)));
    const order = ["PAELS_BLOOD", ...(claw ? ["PAELS_CLAW"] : []), "PAELS_LEGION", "PAELS_GROWTH", "PAELS_FLESH", "PAELS_TEARS", "PAELS_HORN", "PAELS_CLAW", "PAELS_TOOTH"];
    return order.find((k) => keys.includes(k));
  },
};

/** What the card select after an event is for: the best card to improve, or the worst to lose. */
let selectFor: "best" | "worst" = "worst";

/**
 * The Ancients' relics, in docs/STRATEGY-research.md §10.9's default orders (Jorbs' Elo, Untapped's act
 * deltas, the tier lists), with the conditions a deck can be checked for; then any not listed, in the
 * order offered; then the weak, then the avoided. Before, the default event rule took the first option
 * that costs no HP, the order the game lists them: Neow gave Lost Coffer 22 of the 43 times it was
 * offered, Winged Boots 20/41, Lava Rock 13/20 (the bottom of Jorbs' list) and Stone Humidifier 12/23.
 */
const ANCIENTS: Record<string, { order: [string, (o: Observation) => boolean][]; weak?: string[]; avoid?: string[] }> = {
  NEOW: {
    order: [
      ["SILVER_CRUCIBLE", () => true], ["STONE_HUMIDIFIER", () => true], ["LEAFY_POULTICE", (o) => o.player_max_hp >= 70],
      ["NEOWS_TALISMAN", () => true], ["PRECARIOUS_SHEARS", (o) => o.player_hp >= 60], ["LARGE_CAPSULE", () => true],
      ["SMALL_CAPSULE", () => true], ["NEW_LEAF", () => true], ["NEOWS_SACRIFICE", () => true],
    ],
    weak: ["SCROLL_BOXES", "CURSED_PEARL", "WINGED_BOOTS", "LAVA_ROCK"],
    avoid: ["ARCANE_SCROLL", "HEFTY_TABLET", "LOST_COFFER"],
  },
  OROBAS: {
    order: [["PRISMATIC_GEM", () => true], ["ARCHAIC_TOOTH", () => true], ["GLASS_EYE", () => true], ["SAND_CASTLE", () => true]],
    avoid: ["TOUCH_OF_OROBAS"],
  },
  DARV: {
    order: [
      ["RUNIC_PYRAMID", () => true],
      ["PANDORAS_BOX", (o) => o.deck_cards.filter((c) => /^(STRIKE|DEFEND)_IRONCLAD/.test(c)).length >= 5],
      ["ASTROLABE", () => true],
    ],
  },
  PAEL: {
    order: [
      ["PAELS_BLOOD", () => true], ["PAELS_LEGION", () => true], ["PAELS_CLAW", () => true], ["PAELS_FLESH", () => true],
      ["PAELS_TEARS", () => true], ["PAELS_HORN", () => true], ["PAELS_TOOTH", () => true],
    ],
  },
  TEZCATARA: {
    order: [
      ["TOASTY_MITTENS", (o) => o.deck_cards.filter((c) => /^(STRIKE|DEFEND)_IRONCLAD/.test(c)).length >= 4],
      ["STORYBOOK", (o) => o.player_max_hp >= 55], ["SEAL_OF_GOLD", (o) => o.gold >= 175], ["VERY_HOT_COCOA", () => true],
      ["NUTRITIOUS_SOUP", (o) => o.deck_cards.filter((c) => /^STRIKE_IRONCLAD/.test(c)).length >= 4], ["PUMPKIN_CANDLE", () => true],
      ["BIIIG_HUG", (o) => o.deck_cards.filter((c) => /^(STRIKE|DEFEND)_IRONCLAD|^BASH/.test(c)).length >= 6], ["YUMMY_COOKIE", () => true],
      ["GOLDEN_COMPASS", () => true], ["TOY_BOX", () => true],
    ],
  },
  VAKUU: { order: [["MUSIC_BOX", () => true], ["FIDDLE", () => true]] },
  NONUPEIPE: { order: [["BRILLIANT_SCARF", () => true], ["BEAUTIFUL_BRACELET", () => true], ["GLITTER", () => true]] },
};

/** The Ancient's relic to take, by ANCIENTS; undefined for a page without relics or an Ancient not listed. */
function ancientPick(o: Observation, eventId: string | undefined, options: readonly EventOptionObs[]): EventOptionObs | undefined {
  const table = eventId ? ANCIENTS[eventId] : undefined;
  const relics = options.filter((x) => x.relic);
  if (!table || relics.length === 0) return undefined;
  const rank = (x: EventOptionObs) => {
    const i = table.order.findIndex(([id, ok]) => id === x.relic && ok(o));
    if (i >= 0) return i;
    if (table.avoid?.includes(x.relic!)) return 3000;
    if (table.weak?.includes(x.relic!)) return 2000;
    return 1000;
  };
  return [...relics].sort((a, b) => rank(a) - rank(b) || a.index - b.index)[0];
}

export function chooseEvent(o: Observation, legal: LegalAction[]): string {
  const details = (o.room?.details ?? {}) as { event_id?: string; options?: EventOptionObs[] };
  const options = (details.options ?? []).filter((x) => !x.locked);
  const key = (x: EventOptionObs) => (x.text_key ?? "").split(".options.").pop() ?? "";
  const byKey = (k: string | undefined) => (k === undefined ? undefined : options.find((x) => key(x) === k));
  const rule = details.event_id ? EVENTS[details.event_id] : undefined;
  let pick = ancientPick(o, details.event_id, options) ?? byKey(rule?.(o, options.map(key)));
  if (!pick) {
    // No rule: an option that cannot kill, and costs no HP while HP is under half.
    pick = options.find((x) => !x.kills && !x.proceed && !(hpShare(o) < 0.5 && /生命|HP/.test(x.description ?? ""))) ?? options[0];
  }
  if (!pick) return legal.find((a) => a.action_id === "proceed")?.action_id ?? legal[0]!.action_id;
  const text = `${pick.title ?? ""} ${pick.description ?? ""}`;
  selectFor = /附魔|升级|克隆|enchant|upgrade|clone/i.test(text) && !/移除|变化|remove|transform/i.test(text) ? "best" : "worst";
  return legal.find((a) => a.action_id === `choose_event:${pick.index}`)?.action_id ?? legal[0]!.action_id;
}

/** A card select: the worst card for a removal or transform, the best for an enchant or upgrade. */
export function chooseCardSelectFor(o: Observation, legal: LegalAction[]): string {
  const offers = legal.filter((a) => a.action_id.startsWith("choose_card_select:"));
  if (offers.length === 0) return legal[0]!.action_id;
  const ids = offers.map((a) => a.action_id.split(":")[2] ?? "");
  if (selectFor === "worst") {
    const chosen = takeRemoveNext(o, ids);
    return offers[chosen ?? worstCard(ids, o.deck_cards)]!.action_id;
  }
  let best = 0;
  ids.forEach((id, i) => {
    if (cardValue(id, actOf(o), o.deck_cards) > cardValue(ids[best]!, actOf(o), o.deck_cards)) best = i;
  });
  selectFor = "worst";
  return offers[best]!.action_id;
}

/** Card selects from here on take the worst card (a removal), until an event says otherwise. */
export function resetCardSelect(): void {
  selectFor = "worst";
}
/** spar4: the card the shop's removal was bought for, where the select offers it (once, on that floor). */
function takeRemoveNext(o: Observation, ids: readonly string[]): number | undefined {
  const want = removeNext;
  removeNext = undefined;
  if (want === undefined || want.floor !== o.floor) return undefined;
  const i = ids.indexOf(want.id);
  return i >= 0 ? i : undefined;
}

const WORST_FOR = /Removal|Transformation|Discard|Generic/;
const UPGRADE_FOR = /Upgrade/;

/**
 * A selection the game asked its selector for, outside combat, by what it is
 * for (the bridge names the CardSelectCmd method: FromDeckForRemoval,
 * FromDeckForUpgrade, FromDeckForEnchantment, FromDeckForTransformation, …):
 * the worst cards to lose, the best to upgrade or enchant or take.
 */
export function chooseSelect(o: Observation, legal: LegalAction[]): string {
  const details = (o.room?.details ?? {}) as { purpose?: string; min?: number; max?: number };
  const offers = legal.filter((a) => a.action_id.startsWith("choose_card_select:"));
  if (offers.length === 0) return legal[0]!.action_id;
  const ids = offers.map((a) => a.action_id.split(":")[2] ?? "");
  const purpose = details.purpose ?? "";
  const min = details.min ?? 1;
  const max = Math.max(1, details.max ?? 1);
  let order: number[];
  if (WORST_FOR.test(purpose)) {
    // Worst first: take the worst, then the worst of the rest, and so on.
    const types = ((o.room?.details ?? {}) as { cards?: { card_type?: string }[] }).cards?.map((c) => c.card_type) ?? [];
    const left = ids.map((_, i) => i);
    order = [];
    const chosen = /Removal/.test(purpose) ? takeRemoveNext(o, ids) : undefined;
    if (chosen !== undefined) order.push(left.splice(chosen, 1)[0]!);
    while (left.length > 0) {
      const w = worstCard(left.map((i) => ids[i]!), o.deck_cards, left.map((i) => types[i]));
      order.push(left.splice(w, 1)[0]!);
    }
  } else if (UPGRADE_FOR.test(purpose)) {
    const upgrades = ids.map((id, i) => act(`choose_upgrade:${i}:${id}`));
    const best = chooseUpgrade(o, upgrades);
    const first = Number(best.split(":")[1]);
    order = [first, ...ids.map((_, i) => i).filter((i) => i !== first)];
  } else {
    order = ids.map((_, i) => i).sort((a, b) => cardValue(ids[b]!, actOf(o), o.deck_cards) - cardValue(ids[a]!, actOf(o), o.deck_cards));
  }
  const k = Math.max(min, WORST_FOR.test(purpose) ? max : 1);
  if (k <= 1) return offers[order[0]!]!.action_id;
  return `choose_cards:${order.slice(0, k).join(",")}`;
}

const act = (id: string): LegalAction => ({ action_id: id, action_type: id.split(":")[0]!, description: "" });

/**
 * The next map node, by its type, from HP and gold (§5 route to shops at
 * 150+ gold; §7 rest sites when low; elites only when healthy enough to take
 * a relic's worth of risk). The bridge offers the reachable nodes of the
 * next row only, so this looks one step ahead.
 */
/**
 * pathdp: the offer on the best path through the whole act (path.ts), given
 * the "map" call's points; chooseMap's choice when the offers carry no
 * coordinates (a bridge older than them).
 */
export function chooseMapByPath(o: Observation, legal: LegalAction[], points: readonly MapPoint[]): string {
  const offers = legal.filter((a) => a.action_id.startsWith("choose_map:"));
  const at = offers.map((a) => ({ col: Number(a.metadata?.["col"]), row: Number(a.metadata?.["row"]) }));
  if (offers.length === 0 || points.length === 0 || at.some((p) => !Number.isFinite(p.col) || !Number.isFinite(p.row))) return chooseMap(o, legal);
  // upgrade2 (astra-review-2 #4): the path sees the deck — an elite costs more before it has three attacks of its own.
  const attacks = o.deck_cards.filter((c) => DAMAGE.has(base(c)) || MULTI_HIT.has(base(c))).length;
  const eliteScale = flags.has("upgrade2") && attacks < 3 ? 1.4 : 1;
  const plan = planPath(points, at, { hp: o.player_hp, maxHp: o.player_max_hp, act: actOf(o), ascension: o.ascension ?? 0, gold: o.gold, eliteScale, eliteDeath: flags.has("elitedeath") });
  if (!Number.isFinite(plan.values[plan.best]!)) return chooseMap(o, legal);
  return offers[plan.best]!.action_id;
}

export function chooseMap(o: Observation, legal: LegalAction[]): string {
  const offers = legal.filter((a) => a.action_id.startsWith("choose_map:"));
  if (offers.length === 0) return legal[0]!.action_id;
  const share = hpShare(o);
  const score = (type: string): number => {
    if (/Rest/i.test(type)) return share < 0.5 ? 6 : share < 0.7 ? 3.5 : 2.5;
    if (/Shop|Merchant/i.test(type)) return o.gold >= 150 ? 5 : 1;
    // A1+ has eight elites a map (A10-reference §3), and act 1 elites end most A10 runs that fail
    // (Byrdonis 17 of 45 in our first A10 runs, coming in at 56 HP on average): only near full HP.
    if (/Elite/i.test(type)) {
      if ((o.ascension ?? 0) >= 1) {
        // rules2: and only with three attacks of the deck's own (review §4: HP alone is no readiness test).
        if (rules2 && o.deck_cards.filter((c) => DAMAGE.has(base(c)) || MULTI_HIT.has(base(c))).length < 3) return 0;
        return share >= 0.9 ? 3 : share >= 0.75 ? 1.5 : 0;
      }
      return share >= 0.75 && o.floor >= 5 ? 4 : share >= 0.6 ? 2 : 0;
    }
    if (/Treasure/i.test(type)) return 4;
    if (/Unknown|Event/i.test(type)) return share < 0.5 ? 3.2 : 3;
    if (/Monster/i.test(type)) return share < 0.4 ? 2.5 : 3.1;
    return 2;
  };
  // What lies beyond each choice (the bridge's lookahead, one entry per offered node, in order):
  // hurt, the branch with the fewest fights before a rest site; with gold, a shop close by;
  // healthy, an elite within reach.
  const ahead = ((o.room?.details ?? {}) as { lookahead?: Record<string, number>[] }).lookahead ?? [];
  const beyond = (i: number): number => {
    const l = ahead[i];
    if (!l) return 0;
    let b = 0;
    const fights = l["fights_to_rest_min"] ?? 0;
    if (share < 0.5) b -= 1.2 * fights + 0.3 * (l["RestSite"] ?? 6);
    else if (share < 0.7) b -= 0.5 * fights;
    if (o.gold >= 150) b -= 0.3 * (l["Shop"] ?? 6);
    if (share >= 0.8 && (l["Elite"] ?? 9) <= 3) b += 0.3;
    return b;
  };
  const total = (a: LegalAction, i: number) => score(a.action_id.split(":")[2] ?? "") + beyond(Number(a.metadata?.["node_index"] ?? i));
  let best = 0;
  offers.forEach((a, i) => {
    if (total(a, i) > total(offers[best]!, best)) best = i;
  });
  return offers[best]!.action_id;
}
