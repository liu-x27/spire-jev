/**
 * The Regent's own rules (see characters/index.ts for the hooks), each written from the game's IL
 * (sts2.dll v0.111.0) and checked against the game where the fights have shown it.
 *
 * - Stars: a second resource, 0 as a fight begins, kept from turn to turn, changed only by gains and by
 *   the star costs cards pay (IL: PlayerCombatState.GainStars/LoseStars, CardModel.SpendStars). Divine
 *   Right gives 3 as the fight begins. They live on State.ext (stars); an observation's are the
 *   bridge's player_stars. A spar bout, which has no observation, starts from its relics'.
 * - Star costs: the card's (sim.ts Card.starCost, the bridge's cost with modifiers), paid before the card
 *   resolves; a card costing more than there are is not playable. Stardust's X is every star.
 * - Forge n (IL: ForgeCmd.Forge): with no Sovereign Blade outside the exhaust pile, one is made in the
 *   hand (the discard pile with a full hand) at 10; then every blade, exhausted ones too, deals n more.
 *   A blade's damage is its Damage var, as the bridge reports it.
 * - The Sovereign Blade (a token, 2 energy, Retain): hits its target (every enemy under Seeking Edge),
 *   ×2 on one under Conqueror, then Parry's amount in block; Sword Sage plays it again a stack.
 */

import { character } from "../character.ts";
import type { Weights } from "../search.ts";
import {
  addPower, applyPower, autoPlay, blockGain, type Card, costOf, counted, died, dmg, draw, type Enemy, exhaustCard, gainBlock, HAND_LIMIT,
  has, hit, incomingHitsBy, endOfTurnBlock, junkIndex, num, one, relicDamage, relicVar, setRelicVar, standard, type State, strike, targetable,
} from "../sim.ts";
import type { Observation } from "../obs.ts";
import type { CardRow, CharacterRules, Rule } from "./index.ts";

/** The Regent's part of State.ext. Counts "since the observation" start at 0 with every observation. */
interface Ext {
  stars: number;
  /** Stars gained since the observation (Radiate hits for every star gained this turn). */
  gained?: number;
  /** Cards made for the player since the observation (Supermassive counts those of the fight). */
  generated?: number;
  /** Stars the card being played paid: Stardust's X, and Black Hole's trigger after it. */
  spent?: number;
  /** Powered attack hits on each enemy since the observation (Beat Into Shape), and at it for the first. */
  hitsOn?: Readonly<Record<number, number>>;
  /** Mini Regent's Strength and Regalite's block, once a turn: used this turn. */
  miniUsed?: boolean;
  regaliteUsed?: boolean;
  /** Energy paid for cards since the observation, and Orbit's triggers since (its counters at the observation are the bridge's). */
  orbitSpent?: number;
  orbitTriggers?: number;
  /** Void Form ended the turn: nothing more is played. */
  ended?: boolean;
  /** Monologue: Strength a card for the rest of the turn, and what it has given (taken back at the turn's end). */
  monologue?: number;
  monologueGiven?: number;
}

const BLADE = "SOVEREIGN_BLADE";
/** Tokens a Regent card makes, as the game builds them (IL), for when the catalogue lacks them. */
const TOKENS: Record<string, Card> = {
  SOVEREIGN_BLADE: token("SOVEREIGN_BLADE", 2, "Attack", "AnyEnemy", ["Retain"], { Damage: 10, CalculationBase: 0, CalculationExtra: 1, CalculatedBlock: 0, Repeat: 1 }),
  MINION_STRIKE: token("MINION_STRIKE", 0, "Attack", "AnyEnemy", ["Exhaust"], { Damage: 6, Cards: 1 }),
  "MINION_STRIKE+": token("MINION_STRIKE", 0, "Attack", "AnyEnemy", ["Exhaust"], { Damage: 9, Cards: 1 }, 1),
  MINION_DIVE_BOMB: token("MINION_DIVE_BOMB", 0, "Attack", "AnyEnemy", ["Exhaust"], { Damage: 13 }),
  "MINION_DIVE_BOMB+": token("MINION_DIVE_BOMB", 0, "Attack", "AnyEnemy", ["Exhaust"], { Damage: 16 }, 1),
  MINION_SACRIFICE: token("MINION_SACRIFICE", 0, "Skill", "Self", ["Exhaust"], { Block: 7 }),
  "MINION_SACRIFICE+": token("MINION_SACRIFICE", 0, "Skill", "Self", ["Exhaust"], { Block: 10 }, 1),
  DEBRIS: token("DEBRIS", 1, "Status", "None", ["Exhaust"], {}),
};
function token(id: string, cost: number, type: string, target: string, keywords: string[], vars: Record<string, number>, upgrades = 0): Card {
  return { id, cost, costsX: false, type, target, keywords, vars, upgrades, locked: false, glows: false };
}
/**
 * A token as the game makes it. From TOKENS, not spar's catalogue: this module loads with sim.ts,
 * before spar.ts can.
 */
function made(id: string, upgraded = false): Card {
  return { ...(TOKENS[upgraded ? `${id}+` : id] ?? TOKENS[id]!) };
}

/** The damage the deck deals a turn (search.ts deckPace's rough reckoning: a hand of five, a quarter off). */
function pacePerTurn(s: State): number {
  const cards = [...s.hand, ...s.draw, ...s.discard];
  if (cards.length === 0) return 1;
  const damage = cards.reduce((a, c) => a + (c.type === "Attack" ? (c.vars["Damage"] ?? c.vars["CalculationBase"] ?? 0) * Math.max(1, c.vars["Repeat"] ?? 1) : 0), 0);
  return Math.max(1, (damage / cards.length) * 5 * 0.75);
}

/** The stars a fight opens with, for a state no observation made (a spar bout): Divine Right's, and Divine Destiny's on turn 1. */
function opening(s: State): number {
  const right = s.relics.includes("DIVINE_RIGHT") || (s.relics.length === 0 && character() === "REGENT") ? relicVar(s, "DIVINE_RIGHT", "Stars", 3) : 0;
  const destiny = s.relics.includes("DIVINE_DESTINY") && (s.turn ?? 1) <= 1 ? relicVar(s, "DIVINE_DESTINY", "Stars", 7) : 0;
  return right + destiny;
}
/**
 * State.ext is shared by every character's rules (the Silent's counts, the Necrobinder's Osty): the Regent's
 * part is there once it has its stars.
 */
const mine = (s: State): Ext | undefined => typeof (s.ext as Partial<Ext> | undefined)?.stars === "number" ? s.ext as unknown as Ext : undefined;
/** The Regent's state, read only. */
const peek = (s: State): Ext => mine(s) ?? { stars: opening(s) };
/** The Regent's state, to change: made on the state (its own copy, sim.ts clone) the first time. */
function ext(s: State): Ext {
  if (!mine(s)) s.ext = { ...(s.ext ?? {}), stars: opening(s) } satisfies Partial<Ext>;
  return s.ext as unknown as Ext;
}
export const starsOf = (s: State): number => peek(s).stars;
const power = (s: State, p: string) => Math.max(0, s.player.powers[p] ?? 0);
const inFight = (s: State) => s.enemies.some((e) => e.alive);

/** Stars gained (IL: PlayerCmd.GainStars): Black Hole hits every enemy once a gain. */
export function gainStars(s: State, n: number): void {
  if (n <= 0 || !inFight(s)) return;
  const e = ext(s);
  e.stars += n;
  e.gained = (e.gained ?? 0) + n;
  const hole = power(s, "BLACK_HOLE");
  if (hole > 0) relicDamage(s, hole, true);
}

/** Stars paid (IL: CardModel.SpendStars): Child of the Stars' block, Galactic Dust's, Mini Regent's Strength. */
function spendStars(s: State, n: number): void {
  const e = ext(s);
  e.spent = n;
  if (n <= 0) return;
  e.stars = Math.max(0, e.stars - n);
  const child = power(s, "CHILD_OF_THE_STARS");
  if (child > 0) gainBlock(s, child * n);
  if (s.relics.includes("GALACTIC_DUST")) {
    const every = relicVar(s, "GALACTIC_DUST", "Stars", 10);
    const total = relicVar(s, "GALACTIC_DUST", "_starsSpent", 0) + n;
    if (total >= every) gainBlock(s, Math.floor(total / every) * relicVar(s, "GALACTIC_DUST", "Block", 10));
    setRelicVar(s, "GALACTIC_DUST", "_starsSpent", total % every);
  }
  if (s.relics.includes("MINI_REGENT") && !e.miniUsed && relicVar(s, "MINI_REGENT", "_usedThisTurn", 0) === 0) {
    e.miniUsed = true;
    addPower(s.player, "STRENGTH", relicVar(s, "MINI_REGENT", "StrengthPower", 1));
  }
}

/**
 * Cards made for the player (IL: Hook.AfterCardGeneratedForCombat, on every generated or transformed
 * card, a Forge's new blade too): Arsenal's Strength, Pillar of Creation's block, Regalite's once a turn.
 */
function generated(s: State, k = 1): void {
  if (k <= 0) return;
  const e = ext(s);
  e.generated = (e.generated ?? 0) + k;
  const arsenal = power(s, "ARSENAL");
  if (arsenal > 0) addPower(s.player, "STRENGTH", arsenal * k);
  const pillar = power(s, "PILLAR_OF_CREATION");
  for (let i = 0; i < k && pillar > 0; i++) gainBlock(s, pillar);
  if (s.relics.includes("REGALITE") && !e.regaliteUsed && relicVar(s, "REGALITE", "_usedThisTurn", 0) === 0) {
    e.regaliteUsed = true;
    gainBlock(s, relicVar(s, "REGALITE", "Block", 4));
  }
}

/** A card made into the hand, or the discard pile with a full one. */
function intoHand(s: State, c: Card): void {
  if (s.hand.length + s.drawn < HAND_LIMIT) s.hand.push(c);
  else s.discard.push(c);
}

/** Random cards made into the hand (colourless: Bundle of Joy, Quasar, Spectrum Shift): unknown, as draws are. */
function unknownIntoHand(s: State, k: number): void {
  for (let i = 0; i < k; i++) if (s.hand.length + s.drawn < HAND_LIMIT) s.drawn++;
  s.exact = false;
  generated(s, k);
}

const isBlade = (c: Card) => c.id === BLADE;
const blades = (s: State) => [...s.hand, ...s.draw, ...s.discard].filter(isBlade);

/** Forge n (IL: ForgeCmd.Forge). */
export function forge(s: State, n: number): void {
  if (!inFight(s)) return;
  if (!blades(s).length) {
    intoHand(s, made(BLADE));
    generated(s);
  }
  const up = (c: Card) => (isBlade(c) ? { ...c, vars: { ...c.vars, Damage: (c.vars["Damage"] ?? 10) + n } } : c);
  s.hand = s.hand.map(up);
  s.draw = s.draw.map(up);
  s.discard = s.discard.map(up);
  s.exhaust = s.exhaust.map(up);
}

/** Hits through strike (the afterHit hook counts them, for Beat Into Shape and Monarch's Gaze). */
function hits(s: State, victims: readonly Enemy[], base: number, times: number): void {
  if (times > 0) strike(s, victims, base, times);
}
const alive = (s: State) => s.enemies.filter((e) => e.alive);
/** A card's victims: its target, or every enemy for an AllEnemies card. */
const victimsOf = (s: State, c: Card, t: Enemy | undefined) => (c.target === "AllEnemies" ? alive(s) : one(t));

/** An enemy's Strength taken until the end of its turn (IL: TemporaryStrengthPower): the power gives it back (nextTurn). */
function strengthDown(s: State, e: Enemy, n: number, marker: string): void {
  if (n > 0 && targetable(e) && applyPower(s, e, "STRENGTH", -n)) addPower(e, marker, n);
}

type Pick = { id: string; type: string };
/** The card a transform takes (Begone, Charge): a status or curse, a Strike, a Defend, else the core's pick. */
function worstIndex(cards: readonly Pick[]): number {
  for (const test of [(c: Pick) => c.type === "Status" || c.type === "Curse", (c: Pick) => c.id === "STRIKE_REGENT", (c: Pick) => c.id === "DEFEND_REGENT"]) {
    const i = cards.findIndex(test);
    if (i >= 0) return i;
  }
  return Math.max(0, junkIndex(cards));
}
/**
 * The card put back on top of the draw pile (Glimmer, Photon Cut): I Am Invincible (it plays itself
 * there at the turn's end), a Kingly card (better for every draw), else the worst.
 */
function putBackIndex(cards: readonly Pick[]): number {
  for (const id of ["I_AM_INVINCIBLE", "KINGLY_KICK", "KINGLY_PUNCH"]) {
    const i = cards.findIndex((c) => c.id === id);
    if (i >= 0) return i;
  }
  return worstIndex(cards);
}
/** The discard pile's card Cosmic Indifference puts on top: a blade, else the first that is not a status or curse. */
function topIndex(cards: readonly Pick[]): number {
  const blade = cards.findIndex((c) => c.id === BLADE);
  if (blade >= 0) return blade;
  return Math.max(0, cards.findIndex((c) => c.type !== "Status" && c.type !== "Curse"));
}

/** A card of the hand put on top of the draw pile (Glimmer, Photon Cut), known on top. */
function putBack(s: State): void {
  if (s.hand.length === 0) return;
  const i = putBackIndex(s.hand);
  const [c] = s.hand.splice(i >= 0 ? i : 0, 1);
  s.draw.push(c!);
  s.onTop = (s.onTop ?? 0) + 1;
  s.exact = false;
}

/** The Sovereign Blade (IL: SovereignBlade.OnPlay), played again for every Sword Sage stack. */
const sovereignBlade: Rule = (s, c, t) => {
  const times = 1 + power(s, "SWORD_SAGE");
  for (let i = 0; i < times; i++) {
    const victims = has(s.player, "SEEKING_EDGE") ? alive(s) : one(t && t.alive ? t : i > 0 ? alive(s)[0] : t);
    if (i > 0 && victims.length > 0 && victims[0] !== t) s.exact = false;
    const base = dmg(s, c, victims[0]);
    const str = s.player.powers["STRENGTH"] ?? 0;
    for (const v of victims) {
      // Conqueror (IL: ModifyDamageMultiplicative ×2 on the Sovereign Blade's powered hits at it): as a
      // base whose hit, with Strength, is twice the plain one.
      const doubled = (v.powers["CONQUEROR"] ?? 0) > 0;
      hits(s, [v], doubled ? 2 * base + str : base, Math.max(1, c.vars["Repeat"] ?? 1));
    }
    // Vigor goes with the first attack; a replay is another.
    delete s.player.powers["VIGOR"];
    const parry = power(s, "PARRY");
    if (parry > 0) gainBlock(s, blockGain(parry, s.player), true);
  }
};

/** Standard, then more. */
const plus = (then: Rule): Rule => (s, c, t, x) => {
  standard(s, c, t, x);
  then(s, c, t, x);
};
/** Hit the card's victims with its Damage, `times` times. */
const hitWith = (times: (s: State, c: Card, t: Enemy | undefined, x: number) => number): Rule => (s, c, t, x) => {
  hits(s, victimsOf(s, c, t), dmg(s, c, t), times(s, c, t, x));
};

const SPECIAL: Record<string, Rule> = {
  SOVEREIGN_BLADE: sovereignBlade,
  // Stars: gained, as the Stars var says.
  VENERATE: (s, c) => gainStars(s, num(c, "Stars")),
  GATHER_LIGHT: plus((s, c) => gainStars(s, num(c, "Stars"))),
  SOLAR_STRIKE: plus((s, c) => gainStars(s, num(c, "Stars"))),
  SHINING_STRIKE: plus((s, c) => gainStars(s, num(c, "Stars"))),
  ROYAL_GAMBLE: (s, c) => gainStars(s, num(c, "Stars")),
  HIDDEN_CACHE: (s, c) => {
    gainStars(s, num(c, "Stars"));
    addPower(s.player, "STAR_NEXT_TURN", num(c, "StarNextTurnPower"));
  },
  // Draw, 1 star, 1 energy, Forge 5, in that order.
  BIG_BANG: (s, c) => {
    draw(s, num(c, "Cards"));
    gainStars(s, num(c, "Stars"));
    s.energy += num(c, "Energy");
    forge(s, num(c, "Forge"));
  },
  // Stars, a draw now and one next turn.
  GLOW: (s, c) => {
    gainStars(s, num(c, "Stars"));
    draw(s, num(c, "Cards"));
    addPower(s.player, "DRAW_CARDS_NEXT_TURN", num(c, "Cards"));
  },
  // Knockout Blow: 5 stars only for the kill.
  KNOCKOUT_BLOW: (s, c, t) => {
    hits(s, one(t), dmg(s, c, t), 1);
    if (t && !t.alive) gainStars(s, num(c, "Stars"));
  },
  // Forge.
  BULWARK: plus((s, c) => forge(s, num(c, "Forge"))),
  WROUGHT_IN_WAR: plus((s, c) => forge(s, num(c, "Forge"))),
  THE_SMITH: (s, c) => forge(s, num(c, "Forge")),
  SPOILS_OF_BATTLE: (s, c) => {
    forge(s, num(c, "Forge"));
    draw(s, num(c, "Cards"));
  },
  // Its Energy is next turn's.
  REFINE_BLADE: (s, c) => {
    forge(s, num(c, "Forge"));
    addPower(s.player, "ENERGY_NEXT_TURN", num(c, "Energy"));
  },
  SEEKING_EDGE: (s, c) => {
    s.player.powers["SEEKING_EDGE"] = 1;
    forge(s, num(c, "Forge"));
  },
  // Every blade not in the hand into it, the exhausted too, then Forge.
  SUMMON_FORTH: (s, c) => {
    for (const pile of ["draw", "discard", "exhaust"] as const) {
      const out = s[pile].filter(isBlade);
      if (out.length === 0) continue;
      s[pile] = s[pile].filter((x) => !isBlade(x));
      for (const b of out) intoHand(s, b);
    }
    forge(s, num(c, "Forge"));
  },
  // Conqueror is a debuff: an Artifact stack takes it instead (the Punch Construct's, JEV00006).
  CONQUEROR: (s, c, t) => {
    forge(s, num(c, "Forge"));
    if (!t || !targetable(t)) return;
    if ((t.powers["ARTIFACT"] ?? 0) > 0) addPower(t, "ARTIFACT", -1);
    else addPower(t, "CONQUEROR", 1);
  },
  // Forge its base, and its extra for every powered hit on the target this turn before it.
  BEAT_INTO_SHAPE: (s, c, t) => {
    const before = t ? peek(s).hitsOn?.[t.id] ?? 0 : 0;
    hits(s, one(t), dmg(s, c, t), 1);
    forge(s, num(c, "CalculationBase") + num(c, "CalculationExtra") * before);
  },
  // Two hits on every enemy (the game's literal, no Repeat var).
  ASTRAL_PULSE: hitWith(() => 2),
  // Stars spent (every one there was) hits, each on a random enemy.
  STARDUST: (s, c) => {
    const x = (peek(s).spent ?? 0) + (s.relics.includes("CHEMICAL_X") ? relicVar(s, "CHEMICAL_X", "Increase", 2) : 0);
    for (let r = 0; r < x; r++) {
      const live = alive(s);
      if (live.length === 0) break;
      if (live.length > 1) s.exact = false;
      hits(s, [live[r % live.length]!], dmg(s, c), 1);
    }
  },
  // X energy, doubled from its Energy (4) up: that many hits; no energy gained.
  HEAVENLY_DRILL: (s, c, t, x) => {
    hits(s, one(t), dmg(s, c, t), x >= num(c, "Energy") ? 2 * x : x);
  },
  // Hits: the skills played this turn (its count at the observation, and since).
  LUNAR_BLAST: hitWith((s, c) => (c.calc?.["CalculatedHits"] ?? 0) + s.skills),
  // Hits on every enemy: the stars gained this turn; its Stars var is only shown.
  RADIATE: hitWith((s, c) => (c.calc?.["CalculatedHits"] ?? 0) + (peek(s).gained ?? 0)),
  // Its Strength var is the player's; every enemy loses 1 for good.
  RESONANCE: (s, c) => {
    applyPower(s, s.player, "STRENGTH", num(c, "StrengthPower"));
    for (const e of alive(s)) applyPower(s, e, "STRENGTH", -1);
  },
  // The hit, then Strength taken until the end of the enemies' turn.
  CRUSH_UNDER: (s, c, t) => {
    const were = alive(s);
    hits(s, were, dmg(s, c, t), 1);
    for (const e of were) strengthDown(s, e, num(c, "StrengthLoss"), "CRUSH_UNDER");
  },
  DYING_STAR: (s, c, t) => {
    const were = alive(s);
    hits(s, were, dmg(s, c, t), 1);
    for (const e of were) strengthDown(s, e, num(c, "StrengthLoss"), "DYING_STAR");
  },
  // The hit, and a Debris into the hand.
  COLLISION_COURSE: (s, c, t) => {
    hits(s, one(t), dmg(s, c, t), 1);
    intoHand(s, made("DEBRIS"));
    generated(s);
  },
  // The hit on every enemy, then the hand filled to 10 with Debris.
  CRASH_LANDING: (s, c, t) => {
    hits(s, alive(s), dmg(s, c, t), 1);
    const n = Math.max(0, HAND_LIMIT - s.hand.length - s.drawn);
    for (let i = 0; i < n; i++) s.hand.push(made("DEBRIS"));
    generated(s, n);
  },
  // A card of the hand transformed into a Minion Strike (the worst, as the runner chooses).
  BEGONE: (s, c) => {
    if (s.hand.length === 0) return;
    s.hand[worstIndex(s.hand)] = made("MINION_STRIKE", c.upgrades > 0);
    generated(s);
  },
  // Two cards of the draw pile into Minion Dive Bombs (which is not known: the pile's order is not).
  CHARGE: (s, c) => {
    const n = Math.min(num(c, "Cards") || 2, s.draw.length);
    for (let k = 0; k < n; k++) s.draw[worstIndex(s.draw.map((d) => (d.id.startsWith("MINION_") ? { id: d.id, type: "Minion" } : d)))] = made("MINION_DIVE_BOMB", c.upgrades > 0);
    if (n > 0) s.exact = false;
    generated(s, n);
  },
  // Every status and curse of the hand into a Minion Sacrifice.
  GUARDS: (s, c) => {
    let n = 0;
    s.hand = s.hand.map((h) => (h.type === "Status" || h.type === "Curse" ? (n++, made("MINION_SACRIFICE", c.upgrades > 0)) : h));
    generated(s, n);
  },
  // Random colourless cards into the hand.
  BUNDLE_OF_JOY: (s, c) => unknownIntoHand(s, num(c, "Cards")),
  MANIFEST_AUTHORITY: plus((s) => unknownIntoHand(s, 1)),
  QUASAR: (s) => unknownIntoHand(s, 1),
  // The whole hand kept this turn; energy and stars next turn, none now.
  CONVERGENCE: (s, c) => {
    s.player.powers["RETAIN_HAND"] = 1;
    addPower(s.player, "ENERGY_NEXT_TURN", num(c, "Energy"));
    addPower(s.player, "STAR_NEXT_TURN", num(c, "Stars"));
  },
  // Block, and a card of the discard pile on top of the draw pile.
  COSMIC_INDIFFERENCE: plus((s) => {
    if (s.discard.length === 0) return;
    s.draw.push(s.discard.splice(topIndex(s.discard), 1)[0]!);
    s.onTop = (s.onTop ?? 0) + 1;
    s.exact = false;
  }),
  GLIMMER: (s, c) => {
    draw(s, num(c, "Cards"));
    for (let i = 0; i < (num(c, "PutBack") || 1); i++) putBack(s);
  },
  PHOTON_CUT: (s, c, t) => {
    hits(s, one(t), dmg(s, c, t), 1);
    draw(s, num(c, "Cards"));
    for (let i = 0; i < (num(c, "PutBack") || 1); i++) putBack(s);
  },
  // Block, and its BlockNextTurn (Dexterity and Frail as it is played) for the next turn.
  GLITTERSTREAM: plus((s, c) => addPower(s.player, "BLOCK_NEXT_TURN", blockGain(num(c, "BlockNextTurn"), s.player))),
  // The hit; its Cards are next turn's draw.
  GUIDING_STAR: (s, c, t) => {
    hits(s, one(t), dmg(s, c, t), 1);
    addPower(s.player, "DRAW_CARDS_NEXT_TURN", num(c, "Cards"));
  },
  // The hit; its Energy is next turn's.
  HEGEMONY: (s, c, t) => {
    hits(s, one(t), dmg(s, c, t), 1);
    addPower(s.player, "ENERGY_NEXT_TURN", num(c, "Energy"));
  },
  // One hit (its Repeat is copies), then a copy of a colourless card of the hand: a blade, a minion.
  HEIRLOOM_HAMMER: (s, c, t) => {
    hits(s, one(t), dmg(s, c, t), 1);
    const colourless = s.hand.find((h) => isBlade(h)) ?? s.hand.find((h) => h.id.startsWith("MINION_"));
    if (!colourless) return;
    for (let i = 0; i < (num(c, "Repeat") || 1); i++) intoHand(s, { ...colourless, locked: false });
    generated(s, num(c, "Repeat") || 1);
  },
  // One hit; its Cards is when it comes back (every 3rd skill), not a draw.
  MAKE_IT_SO: (s, c, t) => hits(s, one(t), dmg(s, c, t), 1),
  // The power at the Cards var's amount; nothing now (the best of the draw pile next turn).
  FOREGONE_CONCLUSION: (s, c) => addPower(s.player, "FOREGONE_CONCLUSION", num(c, "Cards")),
  // Its Energy var is the power's: energy for every 4 spent on cards (not modelled), none now.
  ORBIT: (s, c) => addPower(s.player, "ORBIT", num(c, "Energy") || 1),
  // Its Block var is the power's: block for every card made.
  PILLAR_OF_CREATION: (s, c) => addPower(s.player, "PILLAR_OF_CREATION", num(c, "Block")),
  // Block, and what the enemies' blocked hits deal back to them (nextTurn).
  REFLECT: plus((s) => addPower(s.player, "REFLECT", 1)),
  // The power, and the turn ends (IL: PlayerCmd.EndTurn); no card is free the turn it is played.
  VOID_FORM: (s, c) => {
    addPower(s.player, "VOID_FORM", num(c, "VoidFormPower") || 2);
    const e = ext(s);
    e.ended = true;
  },
  // Every later card this turn gives 1 Strength; given back at the turn's end.
  MONOLOGUE: (s, c) => {
    const e = ext(s);
    e.monologue = (e.monologue ?? 0) + (num(c, "Power") || 1);
  },
  // Draw, then the best skill of the hand played 3 times for nothing.
  DECISIONS_DECISIONS: (s, c) => {
    draw(s, num(c, "Cards"));
    const i = decisionsIndex(s.hand);
    if (i < 0) return;
    const pick = s.hand[i]!;
    s.hand.splice(s.hand.indexOf(pick), 1);
    s.exact = false;
    for (let i = 0; i < (num(c, "Repeat") || 3); i++) {
      autoPlay(s, pick);
      // It resolves again from wherever it went: one copy stays.
      if (i < (num(c, "Repeat") || 3) - 1) for (const pile of [s.discard, s.exhaust, s.hand]) {
        const j = pile.lastIndexOf(pick);
        if (j >= 0) {
          pile.splice(j, 1);
          break;
        }
      }
    }
  },
  // Multiplayer only: nothing alone.
  TUTOR: () => {},
  LARGESSE: () => {},
  PLOT: () => {},
  CONSTELLATION: () => {},
};

/**
 * Orbit (IL: OrbitPower.AfterEnergySpent): the energy paid for a card counts, over the fight; every
 * Energy (4) of it gives the power's amount in energy at once. An X card's pay is not known here (its X
 * is): left out.
 */
function orbit(s: State, e: Ext, c: Card): void {
  const amount = power(s, "ORBIT");
  if (amount <= 0 || c.costsX) return;
  const paid = costOf(s, c);
  if (paid <= 0) return;
  const v = s.player.powerVars?.["ORBIT"];
  const every = v?.["Energy"] ?? 4;
  const spent = (v?.["energySpent"] ?? 0) + (e.orbitSpent ?? 0) + paid;
  const triggers = (v?.["triggerCount"] ?? 0) + (e.orbitTriggers ?? 0);
  e.orbitSpent = (e.orbitSpent ?? 0) + paid;
  const now = Math.floor(spent / every) - triggers;
  if (now > 0) {
    s.energy += amount * now;
    e.orbitTriggers = (e.orbitTriggers ?? 0) + now;
  }
}

/** Decisions, Decisions' skill: the one of most block and stars (3 a star) and forge (half a point). */
function decisionsIndex(cards: readonly { id: string; type: string; keywords: readonly string[]; vars?: Readonly<Record<string, number>> }[]): number {
  let best = -1;
  let worth = -Infinity;
  cards.forEach((c, i) => {
    if (c.type !== "Skill" || c.keywords.includes("Unplayable")) return;
    const v = (c.vars?.["Block"] ?? 0) + (c.vars?.["Stars"] ?? 0) * 3 + (c.vars?.["Forge"] ?? 0) * 0.5;
    if (v > worth) [best, worth] = [i, v];
  });
  return best;
}

/** Its Damage, as the bridge's calculated number counted, and the cards since: Supermassive (cards made this fight). */
const COUNTS = {
  SUPERMASSIVE: (s: State, c: Card) => counted(c) + (peek(s).generated ?? 0),
  // Crescent Spear: the cards with a star cost in every pile, itself (being played) included.
  CRESCENT_SPEAR: (s: State) => [...s.hand, ...s.draw, ...s.discard, ...s.exhaust].filter((c) => c.starCost !== undefined || c.starX).length + 1,
};

/** Powers that give Strength back to an enemy at the end of its turn (IL: TemporaryStrengthPower). */
const TEMP_DOWN = ["CRUSH_UNDER", "DYING_STAR", "MONARCHS_GAZE_STRENGTH_DOWN"];

/** Its star cost now, with Void Form's free cards. */
function starCost(s: State, c: Card): number {
  if (c.starX) return starsOf(s);
  const cost = c.starCost ?? 0;
  if (cost <= 0) return 0;
  return voidFree(s) ? 0 : cost;
}

/**
 * Void Form (IL: VoidFormPower): the turn's first cards (its amount), counted from the runner's plays
 * this turn before the observation and the model's since, cost no energy and no stars; none on the
 * turn it was played, which it ends.
 */
function voidFree(s: State): boolean {
  const vf = power(s, "VOID_FORM");
  if (vf <= 0 || mine(s)?.ended) return false;
  return (s.playedBefore?.length ?? 0) + s.played < vf;
}

/** Score for a star kept, the first 6, and past them; a forge point on a blade still in play. */
const STAR = Number(process.env["SPIRE_JEV_STAR_WORTH"] ?? 1.0);
const STAR_MORE = 0.4;
const FORGE = Number(process.env["SPIRE_JEV_FORGE_WORTH"] ?? 0.25);

/** What the Regent's powers give in the turns the fight has left, as enginesWorth does the Ironclad's. */
function regentEngines(s: State, w: Weights): number {
  const p = s.player.powers;
  const any = ["GENESIS", "FURNACE", "BLACK_HOLE", "CHILD_OF_THE_STARS", "SWORD_SAGE", "PARRY", "PILLAR_OF_CREATION", "SPECTRUM_SHIFT",
    "VOID_FORM", "THE_SEALED_THRONE", "ARSENAL", "MONARCHS_GAZE", "TYRANNY", "ORBIT", "PLATING", "PALE_BLUE_DOT"].some((k) => (p[k] ?? 0) > 0);
  if (!any) return 0;
  const live = alive(s);
  const turns = Math.min(4, Math.max(0, live.reduce((a, e) => a + e.hp, 0) / pacePerTurn(s) - 1));
  if (turns <= 0) return 0;
  const g = (k: string) => Math.max(0, p[k] ?? 0);
  const bladeDamage = Math.max(0, ...blades(s).map((b) => b.vars["Damage"] ?? 10));
  let perTurn = 0;
  perTurn += g("GENESIS") * STAR;
  perTurn += g("FURNACE") * FORGE * 2;
  perTurn += g("BLACK_HOLE") * live.length * 1.5 * w.enemyHp;
  perTurn += g("CHILD_OF_THE_STARS") * 2 * 0.7;
  perTurn += g("SWORD_SAGE") * bladeDamage * 0.5 * w.enemyHp;
  perTurn += g("PARRY") * 0.5 * 0.7;
  perTurn += g("PILLAR_OF_CREATION") * 0.5 * 0.7;
  perTurn += g("SPECTRUM_SHIFT") * w.drawn;
  perTurn += g("VOID_FORM") > 0 ? 2.5 * 2 : 0;
  perTurn += g("THE_SEALED_THRONE") * 4 * STAR;
  perTurn += g("ARSENAL") * 0.5 * w.strength;
  perTurn += g("MONARCHS_GAZE") * 3 * 0.5;
  perTurn += g("TYRANNY") * w.drawn * 0.5;
  perTurn += g("ORBIT") * 0.75 * 2;
  perTurn += g("PALE_BLUE_DOT") * w.drawn * 0.5;
  // Plating to come: a stack less every turn.
  perTurn += (g("PLATING") > 1 ? (g("PLATING") - 1) / 2 : 0) * 0.7;
  return Math.min(40, perTurn * turns);
}

/** Enemies' attacks this turn's block will stop, dealt back to them by Reflect (as HP they lose). */
function reflected(s: State): number {
  if (power(s, "REFLECT") <= 0) return 0;
  let left = endOfTurnBlock(s);
  let back = 0;
  for (const hitsOf of incomingHitsBy(s)) for (const h of hitsOf) {
    const b = Math.min(left, h);
    back += b;
    left -= b;
  }
  return back;
}

/**
 * choices.ts's CARDS for the Regent's cards: four tier lists on v0.111.0 (Jorbs, Baalorlord, nat1gaming,
 * JapaneseExport/Mobalytics; the merge and its sources are in docs/regent-research.md) and the share of
 * offers A10 Regents took in acts 1-3 (Spire Codex, v0.111.0, 1523 runs; an act with under 15 offers
 * takes the act before's; Meteor Shower and The Sealed Throne, never offered as rewards, 60).
 */
const CARDS: Record<string, CardRow> = {
  ALIGNMENT: { tiers: "CBBB", pick: [22, 30, 31] },
  ARSENAL: { tiers: "SSCC", pick: [52, 44, 44] },
  ASTRAL_PULSE: { tiers: "BAAS", pick: [28, 7, 0] },
  BEAT_INTO_SHAPE: { tiers: "BCCC", pick: [20, 23, 23] },
  BEGONE: { tiers: "AAAA", pick: [31, 19, 15] },
  BIG_BANG: { tiers: "SSSS", pick: [78, 81, 81] },
  BLACK_HOLE: { tiers: "ABBB", pick: [47, 29, 13] },
  BOMBARDMENT: { tiers: "BSBB", pick: [47, 37, 37] },
  BULWARK: { tiers: "ASAS", pick: [76, 51, 38] },
  BUNDLE_OF_JOY: { tiers: "CBCA", pick: [28, 18, 18] },
  CELESTIAL_MIGHT: { tiers: "BBBC", pick: [13, 3, 1] },
  CHARGE: { tiers: "SSAS", pick: [66, 58, 37] },
  CHILD_OF_THE_STARS: { tiers: "AAAS", pick: [54, 53, 47] },
  CLOAK_OF_STARS: { tiers: "CBBA", pick: [27, 20, 15] },
  COLLISION_COURSE: { tiers: "ABDA", pick: [28, 10, 2] },
  COMET: { tiers: "ASSS", pick: [34, 35, 35] },
  CONQUEROR: { tiers: "ABCC", pick: [17, 19, 18] },
  CONVERGENCE: { tiers: "CASS", pick: [64, 63, 45] },
  COSMIC_INDIFFERENCE: { tiers: "BCCC", pick: [30, 30, 17] },
  CRASH_LANDING: { tiers: "AADS", pick: [30, 17, 17] },
  CRESCENT_SPEAR: { tiers: "CCDD", pick: [8, 4, 3] },
  CRUSH_UNDER: { tiers: "BBCB", pick: [25, 7, 1] },
  DECISIONS_DECISIONS: { tiers: "BSAB", pick: [41, 56, 56] },
  DEVASTATE: { tiers: "DDCC", pick: [15, 6, 5] },
  DYING_STAR: { tiers: "ABBA", pick: [43, 36, 25] },
  FOREGONE_CONCLUSION: { tiers: "DACC", pick: [20, 10, 10] },
  FURNACE: { tiers: "DBCC", pick: [37, 25, 25] },
  GAMMA_BLAST: { tiers: "AABA", pick: [42, 28, 19] },
  GATHER_LIGHT: { tiers: "ABBA", pick: [55, 33, 20] },
  GENESIS: { tiers: "BCBC", pick: [37, 27, 59] },
  GLIMMER: { tiers: "CCBB", pick: [15, 22, 30] },
  GLITTERSTREAM: { tiers: "SABB", pick: [28, 17, 12] },
  GLOW: { tiers: "CAAS", pick: [40, 31, 22] },
  GUARDS: { tiers: "BSAS", pick: [45, 47, 47] },
  GUIDING_STAR: { tiers: "BAAB", pick: [19, 14, 9] },
  HEAVENLY_DRILL: { tiers: "SABB", pick: [21, 19, 19] },
  HEGEMONY: { tiers: "CBCC", pick: [18, 9, 9] },
  HEIRLOOM_HAMMER: { tiers: "ABCD", pick: [18, 14, 14] },
  HIDDEN_CACHE: { tiers: "SABB", pick: [32, 22, 15] },
  I_AM_INVINCIBLE: { tiers: "ABBC", pick: [32, 15, 15] },
  KINGLY_KICK: { tiers: "AABA", pick: [27, 3, 2] },
  KINGLY_PUNCH: { tiers: "AABB", pick: [19, 3, 0] },
  KNOCKOUT_BLOW: { tiers: "CCDC", pick: [16, 1, 0] },
  KNOW_THY_PLACE: { tiers: "AABS", pick: [34, 27, 18] },
  LUNAR_BLAST: { tiers: "BDDC", pick: [15, 6, 3] },
  MAKE_IT_SO: { tiers: "SBAA", pick: [39, 33, 33] },
  MANIFEST_AUTHORITY: { tiers: "BACA", pick: [51, 38, 22] },
  METEOR_SHOWER: { tiers: "SASS", pick: [60, 60, 60] },
  MONARCHS_GAZE: { tiers: "DBFD", pick: [20, 19, 31] },
  MONOLOGUE: { tiers: "DCFD", pick: [9, 9, 9] },
  NEUTRON_AEGIS: { tiers: "CDDC", pick: [18, 21, 21] },
  ORBIT: { tiers: "CABA", pick: [41, 55, 49] },
  PALE_BLUE_DOT: { tiers: "BABC", pick: [16, 27, 30] },
  PARRY: { tiers: "BBDC", pick: [22, 33, 41] },
  PARTICLE_WALL: { tiers: "BSAA", pick: [39, 36, 25] },
  PATTER: { tiers: "ABCB", pick: [23, 12, 7] },
  PHOTON_CUT: { tiers: "CBBB", pick: [12, 5, 2] },
  PILLAR_OF_CREATION: { tiers: "AACS", pick: [32, 43, 50] },
  PROPHESIZE: { tiers: "DBDC", pick: [5, 8, 10] },
  QUASAR: { tiers: "CACA", pick: [26, 22, 24] },
  RADIATE: { tiers: "ABBA", pick: [18, 14, 14] },
  REFINE_BLADE: { tiers: "ABCA", pick: [29, 12, 9] },
  REFLECT: { tiers: "SSSS", pick: [69, 65, 46] },
  RESONANCE: { tiers: "BFFD", pick: [13, 13, 13] },
  ROYALTIES: { tiers: "DBBA", pick: [18, 7, 7] },
  ROYAL_GAMBLE: { tiers: "AABS", pick: [29, 41, 42] },
  SEEKING_EDGE: { tiers: "ACCC", pick: [42, 26, 26] },
  SEVEN_STARS: { tiers: "SDCC", pick: [31, 18, 18] },
  SHINING_STRIKE: { tiers: "ABBC", pick: [22, 11, 7] },
  SOLAR_STRIKE: { tiers: "CCCC", pick: [15, 5, 1] },
  SPECTRUM_SHIFT: { tiers: "BACS", pick: [42, 36, 40] },
  SPOILS_OF_BATTLE: { tiers: "CCCC", pick: [17, 16, 13] },
  STARDUST: { tiers: "BBCC", pick: [23, 18, 18] },
  SUMMON_FORTH: { tiers: "BBCC", pick: [30, 25, 30] },
  SUPERMASSIVE: { tiers: "AACB", pick: [16, 21, 19] },
  SWORD_SAGE: { tiers: "BBCC", pick: [35, 29, 29] },
  TERRAFORMING: { tiers: "CBFC", pick: [18, 9, 11] },
  THE_SEALED_THRONE: { tiers: "SSSS", pick: [60, 60, 60] },
  THE_SMITH: { tiers: "BAAA", pick: [34, 35, 35] },
  TYRANNY: { tiers: "SSBA", pick: [65, 56, 56] },
  VOID_FORM: { tiers: "BSAS", pick: [55, 47, 47] },
  WROUGHT_IN_WAR: { tiers: "ACCC", pick: [18, 2, 0] },
};

export const REGENT: CharacterRules = {
  special: SPECIAL,
  counts: COUNTS,
  // The Regent's potions (IL): Star Potion's stars, King's Courage's Forge, Cosmic Concoction's 3 upgraded
  // colourless cards (unknown, as draws are).
  potions: {
    STAR_POTION: (s, n) => gainStars(s, n),
    KINGS_COURAGE: (s, n) => forge(s, n),
    COSMIC_CONCOCTION: (s, n) => unknownIntoHand(s, n),
  },
  // Orobas: A10 Regents (Spire Codex, v0.111.0, 1523 runs) take Archaic Tooth (Falling Star into Meteor
  // Shower) 62% of the times it is offered, winning 38.7% against 26.3% of those passing it, and Touch
  // of Orobas (Divine Right into Divine Destiny: 7 stars on turn 1, not 3) 28%, 41.0% against 31.3%.
  character: "REGENT",
  ancients: { OROBAS: { first: ["ARCHAIC_TOOTH", "TOUCH_OF_OROBAS"] } },
  cards: CARDS,
  // The four lists' consensus and the humans' most-taken (65%+ of offers in act 1).
  always: ["BIG_BANG", "REFLECT", "BULWARK", "CHARGE"],
  // Every list at D or below, and taken from 13% of offers or less; the multiplayer-only cards.
  never: ["MONOLOGUE", "RESONANCE", "CRESCENT_SPEAR", "TUTOR", "LARGESSE", "PLOT", "CONSTELLATION", "HAMMER_TIME"],
  aoe: ["ASTRAL_PULSE", "CRASH_LANDING", "SEVEN_STARS", "METEOR_SHOWER", "DYING_STAR", "CRUSH_UNDER", "RADIATE", "BLACK_HOLE"],
  multiHit: ["ASTRAL_PULSE", "CELESTIAL_MIGHT", "SEVEN_STARS", "STARDUST", "RADIATE", "HEAVENLY_DRILL", "LUNAR_BLAST"],
  damage: ["ASTRAL_PULSE", "GAMMA_BLAST", "COLLISION_COURSE", "BOMBARDMENT", "COMET", "CRASH_LANDING", "KINGLY_KICK", "KINGLY_PUNCH", "SHINING_STRIKE", "CHARGE", "MAKE_IT_SO"],
  // The lists' upgrade flags and what A7+ Regents upgrade in act 1 (untapped: Spectrum Shift 77%, Orbit 73%,
  // Sword Sage 65% ...); Falling Star, upgraded by 1%, last.
  smithFirst: ["THE_SEALED_THRONE", "SPECTRUM_SHIFT", "ORBIT", "PALE_BLUE_DOT", "TYRANNY", "ARSENAL", "SWORD_SAGE", "GLOW", "BOMBARDMENT",
    "HIDDEN_CACHE", "CONVERGENCE", "MANIFEST_AUTHORITY", "ROYAL_GAMBLE", "QUASAR", "BULWARK", "BIG_BANG", "MAKE_IT_SO", "GLITTERSTREAM",
    "KNOW_THY_PLACE", "VENERATE", "MONARCHS_GAZE"],
  smithLast: ["FALLING_STAR"],

  fromObservation(obs: Observation, s: State): void {
    const regent = /REGENT/.test(String((obs as { character?: string }).character ?? ""));
    if (!regent && (obs.player_stars ?? 0) <= 0) return;
    const c = obs.combat;
    const e: Ext = { stars: obs.player_stars ?? 0 };
    // Beat Into Shape's count at the observation (the bridge calculates it for the first hittable enemy).
    const beat = c?.hand.find((h) => h.card_id === "BEAT_INTO_SHAPE" && h.calculated?.["CalculatedForge"] !== undefined);
    const first = s.enemies.find((x) => x.alive);
    if (beat && first) {
      const extra = beat.vars["CalculationExtra"] ?? 0;
      if (extra > 0) e.hitsOn = { [first.id]: Math.max(0, Math.round(((beat.calculated!["CalculatedForge"] ?? 0) - (beat.vars["CalculationBase"] ?? 0)) / extra)) };
    }
    // Void Form: the hand's own costs, the free cards' being the cost hook's (a card the game shows free
    // under it costs what it did once the free ones are used).
    if ((obs.player_powers["VOID_FORM_POWER"] ?? 0) > 0 && c) {
      c.hand.forEach((h, i) => {
        const card = s.hand[i];
        if (!card) return;
        s.hand[i] = { ...card, cost: Math.max(card.cost, h.cost), ...((h.star_cost ?? -1) >= 0 ? { starCost: h.star_cost! } : {}) };
      });
    }
    const mono = obs.player_power_vars?.["MONOLOGUE_POWER"];
    if (mono) {
      e.monologue = obs.player_powers["MONOLOGUE_POWER"] ?? 1;
      e.monologueGiven = mono["StrengthApplied"] ?? 0;
    }
    s.ext = { ...(s.ext ?? {}), ...e };
    // I Am Invincible on top of the draw pile (the bridge's first) plays itself at the turn's end.
    if (c && c.draw_pile[0]?.card_id === "I_AM_INVINCIBLE" && s.draw.length > 0 && !(s.onTop ?? 0)) {
      const top = s.draw.splice(0, 1)[0]!;
      s.draw.push(top);
      s.onTop = 1;
    }
  },

  playable(s: State, c: Card): boolean {
    if (mine(s)?.ended) return false;
    if (c.starCost === undefined && !c.starX) return true;
    return starCost(s, c) <= starsOf(s);
  },

  beforePlay(s: State, c: Card): void {
    const paid = c.starCost !== undefined || c.starX ? starCost(s, c) : 0;
    const e = mine(s) || paid > 0 || c.starX || power(s, "THE_SEALED_THRONE") > 0 || power(s, "ORBIT") > 0 ? ext(s) : undefined;
    if (!e) return;
    if (c.starCost !== undefined || c.starX) spendStars(s, paid);
    else e.spent = 0;
    orbit(s, e, c);
    // The Sealed Throne (IL: BeforeCardPlayed, after the card was paid for): stars for every card.
    gainStars(s, power(s, "THE_SEALED_THRONE"));
  },

  afterPlay(s: State, c: Card, t: Enemy | undefined): void {
    // Make It So (IL: AfterCardPlayedLate): every 3rd skill of the turn brings it back into the hand
    // (the runner's skills this turn before the observation, and the model's since).
    if (c.type === "Skill") {
      for (const pile of ["discard", "draw", "exhaust"] as const) {
        const i = s[pile].findIndex((x) => x.id === "MAKE_IT_SO");
        if (i < 0) continue;
        const card = s[pile][i]!;
        const skills = (s.playedBefore ?? []).filter((x) => x.type === "Skill").length + s.skills;
        if (skills % (num(card, "Cards") || 3) !== 0) continue;
        s[pile] = s[pile].filter((_, j) => j !== i);
        intoHand(s, card);
        s.exact = false;
      }
    }
    if (!mine(s) && power(s, "BLACK_HOLE") <= 0) return;
    const e = ext(s);
    // Black Hole (IL: AfterCardPlayed): a card that paid stars hits every enemy.
    if ((e.spent ?? 0) > 0 && power(s, "BLACK_HOLE") > 0) relicDamage(s, power(s, "BLACK_HOLE"), true);
    e.spent = 0;
    // Monologue: Strength after every other card, for the turn.
    if ((e.monologue ?? 0) > 0 && c.id !== "MONOLOGUE") {
      addPower(s.player, "STRENGTH", e.monologue!);
      e.monologueGiven = (e.monologueGiven ?? 0) + e.monologue!;
    }
  },

  cost(s: State, _c: Card, cost: number): number {
    return cost > 0 && voidFree(s) ? 0 : cost;
  },

  afterHit(s: State, e: Enemy): void {
    const gaze = power(s, "MONARCHS_GAZE");
    if (!mine(s) && gaze <= 0 && character() !== "REGENT") return;
    const x = ext(s);
    x.hitsOn = { ...(x.hitsOn ?? {}), [e.id]: (x.hitsOn?.[e.id] ?? 0) + 1 };
    // Monarch's Gaze (IL: MonarchsGazePower.AfterDamageGiven): every powered hit takes Strength for the enemy's turn.
    if (gaze > 0 && e.alive && applyPower(s, e, "STRENGTH", -gaze)) addPower(e, "MONARCHS_GAZE_STRENGTH_DOWN", gaze);
  },

  // The runner's choices inside a fight, as the rules above make them.
  combatSelect(source: string | undefined, purpose: string, cards: readonly { id: string; type: string; keywords: readonly string[] }[]): number | undefined {
    switch (source) {
      case "GLIMMER":
      case "PHOTON_CUT":
        return putBackIndex(cards);
      case "BEGONE":
      case "CHARGE":
        return worstIndex(cards);
      case "COSMIC_INDIFFERENCE":
        return topIndex(cards);
      case "HEIRLOOM_HAMMER": {
        const blade = cards.findIndex((c) => c.id === BLADE);
        return blade >= 0 ? blade : undefined;
      }
      default:
        // Tyranny's exhaust as the turn starts, and any other card of the hand to give up: a curse or
        // status, a Strike, a Defend (the core's pick is the hand's last card).
        return character() === "REGENT" && source === undefined && /^FromHand/.test(purpose) ? worstIndex(cards) : undefined;
    }
  },

  resultPile(_s: State, c: Card) {
    if (c.id === "SHINING_STRIKE") return "top";
    if (c.id === "PARTICLE_WALL") return "hand";
    return undefined;
  },

  startOfTurn(s: State): void {
    // After the draw (IL: AfterSideTurnStart): Furnace forges; Spectrum Shift's cards (before the draw in
    // the game, unknown either way); Bombardment in the exhaust pile plays itself.
    if (power(s, "FURNACE") > 0) forge(s, power(s, "FURNACE"));
    if (power(s, "SPECTRUM_SHIFT") > 0) unknownIntoHand(s, power(s, "SPECTRUM_SHIFT"));
    for (const b of s.exhaust.filter((c) => c.id === "BOMBARDMENT")) {
      s.exhaust.splice(s.exhaust.indexOf(b), 1);
      autoPlay(s, b);
    }
  },

  endOfTurn: {
    needed: (s) => s.relics.includes("LUNAR_PASTRY") || ((s.onTop ?? 0) > 0 && s.draw[s.draw.length - 1]?.id === "I_AM_INVINCIBLE"),
    run(s: State): void {
      // I Am Invincible on top of the draw pile (IL: AfterAutoPostPlayPhaseEntered): its block, then the discard pile.
      const top = s.draw[s.draw.length - 1];
      if ((s.onTop ?? 0) > 0 && top?.id === "I_AM_INVINCIBLE") {
        s.draw.pop();
        s.onTop = (s.onTop ?? 1) - 1;
        gainBlock(s, blockGain(num(top, "Block"), s.player), true);
        s.discard.push(top);
      }
      // Lunar Pastry (IL: AfterSideTurnEnd): a star at the end of every turn.
      if (s.relics.includes("LUNAR_PASTRY")) gainStars(s, relicVar(s, "LUNAR_PASTRY", "Stars", 1));
    },
  },

  nextTurn(prev: State, next: State): void {
    // Reflect: the enemies' blocked hits, dealt back to them (IL: ReflectPower.AfterDamageReceived);
    // a stack goes as the player's turn starts.
    if (power(prev, "REFLECT") > 0) {
      let left = endOfTurnBlock(prev);
      const by = incomingHitsBy(prev);
      prev.enemies.forEach((pe, i) => {
        const ne = next.enemies.find((x) => x.id === pe.id);
        for (const h of by[i] ?? []) {
          const b = Math.min(left, h);
          left -= b;
          if (b > 0 && ne?.alive) {
            hit(ne, b);
            if (!ne.alive) died(next, ne);
          }
        }
      });
      next.player.powers["REFLECT"] = power(prev, "REFLECT") - 1;
      if (next.player.powers["REFLECT"]! <= 0) delete next.player.powers["REFLECT"];
    }
    // Strength taken for the enemy's turn comes back (as Mangle's and Dark Shackles' do in turn.ts).
    for (const e of next.enemies) {
      for (const k of TEMP_DOWN) {
        if ((e.powers[k] ?? 0) <= 0) continue;
        e.powers["STRENGTH"] = (e.powers["STRENGTH"] ?? 0) + e.powers[k]!;
        if (e.powers["STRENGTH"] === 0) delete e.powers["STRENGTH"];
        delete e.powers[k];
      }
      // Conqueror lasts to the end of the enemy's turn.
      if ((e.powers["CONQUEROR"] ?? 0) > 0) e.powers["CONQUEROR"]! -= 1;
      if ((e.powers["CONQUEROR"] ?? 1) <= 0) delete e.powers["CONQUEROR"];
    }
    // A bout's state has the Regent's only once a star moved: its opening stars carry into the next turn.
    if (!mine(next)) {
      const kept = peek(prev).stars;
      if (kept <= 0 && !["GENESIS", "STAR_NEXT_TURN", "VOID_FORM", "MONOLOGUE"].some((k) => power(next, k) > 0)) return;
      next.ext = { ...(next.ext ?? {}), stars: kept } satisfies Partial<Ext>;
    }
    const e = ext(next);
    // The turn's counts start again; Monologue's Strength goes back.
    if ((e.monologueGiven ?? 0) > 0) addPower(next.player, "STRENGTH", -e.monologueGiven!);
    delete e.monologue;
    delete e.monologueGiven;
    delete e.gained;
    delete e.hitsOn;
    delete e.miniUsed;
    delete e.regaliteUsed;
    delete e.ended;
    e.spent = 0;
    // After the energy's reset (IL: AfterEnergyReset): Genesis's and Star Next Turn's stars.
    gainStars(next, power(next, "GENESIS"));
    gainStars(next, power(next, "STAR_NEXT_TURN"));
    delete next.player.powers["STAR_NEXT_TURN"];
    // Foregone Conclusion: the best of the draw pile into the hand (the game: before the draw; here after).
    const fc = power(next, "FOREGONE_CONCLUSION");
    for (let i = 0; i < fc && next.draw.length > 0 && next.hand.length < HAND_LIMIT; i++) {
      const best = next.draw.reduce((b, c, j) => (c.type !== "Status" && c.type !== "Curse" && (c.cost <= next.draw[b]!.cost || next.draw[b]!.type === "Status") ? j : b), 0);
      next.hand.push(next.draw.splice(best, 1)[0]!);
    }
    delete next.player.powers["FOREGONE_CONCLUSION"];
    // Tyranny: a card more, then one exhausted a stack.
    for (let i = 0; i < power(next, "TYRANNY"); i++) {
      if (next.draw.length > 0 && next.hand.length < HAND_LIMIT) next.hand.push(next.draw.pop()!);
      if (next.hand.length > 0) exhaustCard(next, next.hand.splice(worstIndex(next.hand), 1)[0]!);
    }
    // Kingly Kick costs 1 less, and Kingly Punch deals its Increase more, for every draw.
    next.hand = next.hand.map((c) => c.id === "KINGLY_KICK" ? { ...c, cost: Math.max(0, c.cost - 1) }
      : c.id === "KINGLY_PUNCH" ? { ...c, vars: { ...c.vars, Damage: (c.vars["Damage"] ?? 0) + num(c, "Increase") } } : c);
  },

  evaluate(s: State, w: Weights): number {
    const e = mine(s);
    const bl = blades(s);
    if (!e && bl.length === 0 && !s.draw.some((c) => c.id === "MINION_DIVE_BOMB")) return 0;
    let score = 0;
    const stars = e ? e.stars : 0;
    score += Math.min(stars, 6) * STAR + Math.max(0, stars - 6) * STAR_MORE;
    score += bl.reduce((a, b) => a + (b.vars["Damage"] ?? 10), 0) * FORGE;
    // Charge's Minion Dive Bombs in the piles to draw: free hits to come (half of each, as the fight may end first).
    for (const c of [...s.draw, ...s.discard]) if (c.id === "MINION_DIVE_BOMB") score += (c.vars["Damage"] ?? 13) * 0.5 * w.enemyHp;
    score += regentEngines(s, w);
    score += reflected(s) * w.enemyHp;
    return score;
  },

  keyExt(s: State): string {
    const e = mine(s);
    if (!e) return "";
    return `${e.stars}/${e.generated ?? 0}${e.ended ? "e" : ""}/${bladesKey(s)}`;
  },
};

const bladesKey = (s: State) => blades(s).map((b) => b.vars["Damage"] ?? 10).join(".");

// The blade's Retain needs nothing here: turn.ts keeps a Retain card in the hand.
export const _forTests = { opening, forge, gainStars, spendStars, starCost };
