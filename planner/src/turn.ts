/**
 * The start of the player's next turn, as far as the model can tell: what a
 * two-turn lookahead (search.ts planTurn2) plans the second turn from.
 *
 * Known: the HP the enemies' turn takes (hpLoss, exact in ~98% of turns),
 * which powers end with the turn, which lose a stack a round, what Demon Form
 * and the next-turn powers give, the hand discarded (Retain kept, Ethereal
 * exhausted), the draw pile's contents. Not known, so guessed: the order of
 * the draw pile (a random draw from what is in it — the player does not see
 * the order either), and what the enemies will do next (one attack of their
 * average damage a turn; buffs and debuffs they cast are not modelled).
 */

import type { IntentObs } from "./obs.ts";
import { type Card, type Enemy, endOfTurnBlock, hpAfterTurn, incomingDamage, spendRevival, type State } from "./sim.ts";

/** Powers that last the turn they were played in. */
const TURN_ONLY = ["NO_DRAW", "RAGE", "FLAME_BARRIER", "FREE_ATTACK", "COLOSSUS", "RETAIN_HAND", "DUPLICATION", "TAINTED"];
/** Powers that lose a stack every round. */
const TICKS = ["WEAK", "FRAIL", "VULNERABLE", "BLUR", "PLATING", "REGEN"];
/** Temporary Strength and Dexterity, and what they were added to. */
const TEMPORARY: [string, string][] = [["SETUP_STRIKE", "STRENGTH"], ["FLEX_POTION", "STRENGTH"], ["SPEED_POTION", "DEXTERITY"]];
const HAND_LIMIT = 10;

/** mulberry32: a small seeded generator, so a lookahead is the same every time it is asked. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: T[], rng: () => number): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
  }
  return xs;
}

const tick = (powers: Record<string, number>, keys: readonly string[]) => {
  for (const k of keys) {
    if ((powers[k] ?? 0) <= 0) continue;
    powers[k]! -= 1;
    if (powers[k]! <= 0) delete powers[k];
  }
};

/**
 * The state at the start of the next turn, the hand drawn at random; undefined
 * if the enemies' turn kills the player. `foresee` says what an enemy will
 * show on the next turn.
 */
export function nextTurn(s: State, rng: () => number, foresee: (e: Enemy, turn: number) => readonly IntentObs[]): State | undefined {
  // A death the enemies' turn deals is undone by Lizard Tail or Fairy in a Bottle, if there is one.
  const after = hpAfterTurn(s);
  if (after.hp <= 0) return undefined;
  const hp = after.hp;
  const powers: Record<string, number> = { ...s.player.powers };
  // Block that outlives the enemies' turn: Barricade and Blur keep what the attacks left.
  const kept = Math.max(0, endOfTurnBlock(s) - incomingDamage(s));
  let block = (powers["BARRICADE"] ?? 0) > 0 || (powers["BLUR"] ?? 0) > 0 ? kept : 0;
  const regen = powers["REGEN"] ?? 0;
  for (const [temp, stat] of TEMPORARY) {
    if (!powers[temp]) continue;
    powers[stat] = (powers[stat] ?? 0) - powers[temp]!;
    delete powers[temp];
  }
  for (const k of TURN_ONLY) delete powers[k];
  tick(powers, TICKS);
  // The next turn begins.
  const turn = (s.turn ?? 1) + 1;
  const relic = (id: string, name: string, fallback: number) => (s.relics.includes(id) ? (s.relicVars?.[id]?.[name] ?? fallback) : 0);
  // Relics that give by the turn number (docs/relic-tiers.md): Candelabra on turn 2, Chandelier on 3,
  // Happy Flower and Pendulum every third turn, Bread from turn 2, Ice Cream keeps what was not spent.
  const every = (id: string) => {
    const seen = s.relicVars?.[id]?.["_turnsSeen"];
    const period = s.relicVars?.[id]?.["Turns"] ?? 3;
    return s.relics.includes(id) && (seen !== undefined ? (seen + 1) % period === 0 : turn % period === 0);
  };
  if (powers["DEMON_FORM"]) powers["STRENGTH"] = (powers["STRENGTH"] ?? 0) + powers["DEMON_FORM"]!;
  const energy = (s.maxEnergy ?? 3) + (powers["ENERGY_NEXT_TURN"] ?? 0)
    + (turn === 2 ? relic("CANDELABRA", "Energy", 2) : 0) + (turn === 3 ? relic("CHANDELIER", "Energy", 3) : 0)
    + (every("HAPPY_FLOWER") ? relic("HAPPY_FLOWER", "Energy", 1) : 0) + (s.relics.includes("BREAD") ? 1 : 0)
    + (s.relics.includes("ICE_CREAM") ? s.energy : 0);
  const extraDraw = (powers["DRAW_CARDS_NEXT_TURN"] ?? 0) + (every("PENDULUM") ? relic("PENDULUM", "Cards", 1) : 0);
  block += powers["BLOCK_NEXT_TURN"] ?? 0;
  for (const k of ["ENERGY_NEXT_TURN", "DRAW_CARDS_NEXT_TURN", "BLOCK_NEXT_TURN"]) delete powers[k];

  const keepAll = (s.player.powers["RETAIN_HAND"] ?? 0) > 0 || ((s.turn ?? 1) === 1 && s.relics.includes("RINGING_TRIANGLE"));
  const hand: Card[] = [];
  let discard = s.discard.slice();
  const exhaust = s.exhaust.slice();
  for (const c of s.hand) {
    // Bound ends with the turn (Chains of Binding un-Binds the hand).
    if (keepAll || c.keywords.includes("Retain")) hand.push({ ...free(c), locked: false });
    else if (c.keywords.includes("Ethereal")) exhaust.push(c);
    else discard.push(c);
  }
  // Chains of Binding (the Queen): the first cards drawn each turn, as many as its amount, are Bound.
  const binding = Math.max(0, powers["CHAINS_OF_BINDING"] ?? 0);
  let pile = shuffle(s.draw.slice(), rng);
  for (let i = 0; i < 5 + extraDraw && hand.length < HAND_LIMIT; i++) {
    if (pile.length === 0) {
      if (discard.length === 0) break;
      pile = shuffle(discard, rng);
      discard = [];
    }
    hand.push({ ...free(pile.pop()!), locked: false, ...(i < binding ? { bound: true } : {}) });
  }

  const enemies = s.enemies.map((e): Enemy => {
    // A killed Waterfall Giant: its stun passes, and the turn after it strikes for its DeathBlow (the
    // game shows it with Weak taken off already); once struck it is gone.
    if (!e.alive && (e.deathBlow ?? 0) > 0) {
      const ep = { ...e.powers };
      tick(ep, ["WEAK", "VULNERABLE"]);
      if (e.blowNow) return { ...e, powers: ep, deathBlow: 0, blowNow: false, intents: [] };
      const weak = (ep["WEAK"] ?? 0) > 0;
      const blow = weak ? Math.floor(e.deathBlow! * 0.75) : e.deathBlow!;
      return {
        ...e, powers: ep, deathBlow: blow, blowNow: true, intents: [{ type: "DeathBlow", damage: blow, hits: 1 }],
        weakAtStart: weak, vulnerableAtStart: (ep["VULNERABLE"] ?? 0) > 0,
      };
    }
    if (!e.alive) return { ...e, powers: { ...e.powers } };
    const ep = { ...e.powers };
    tick(ep, ["WEAK", "VULNERABLE"]);
    // Strength every turn: Byrdonis's Territorial, a Ritual.
    for (const k of ["TERRITORIAL", "RITUAL"]) if ((ep[k] ?? 0) > 0) ep["STRENGTH"] = (ep["STRENGTH"] ?? 0) + ep[k]!;
    // The Waterfall Giant's Steam Eruption grows 3 every turn, and its Heal turn gives back 15
    // (A10, our logs: every turn's buff, and each heal's miss in the turn-start checks).
    if ((ep["STEAM_ERUPTION"] ?? 0) > 0) ep["STEAM_ERUPTION"] = ep["STEAM_ERUPTION"]! + 3;
    const heal = e.model === "WATERFALL_GIANT" && e.intents.some((i) => i.type === "Heal") ? 15 : 0;
    // Stone Calendar: 52 to every enemy at the end of turn 7.
    const calendar = (s.turn ?? 1) === 7 ? relic("STONE_CALENDAR", "Damage", 52) : 0;
    const hp = Math.min(e.maxHp, e.hp + heal) - calendar;
    return {
      ...e, powers: ep, block: 0, hp: Math.max(0, hp), alive: hp > 0,
      intents: foresee(e, turn),
      weakAtStart: (ep["WEAK"] ?? 0) > 0,
      startStrength: ep["STRENGTH"] ?? 0,
      vulnerableAtStart: (ep["VULNERABLE"] ?? 0) > 0,
      skittishUsed: false,
      shellTaken: 0,
    };
  });

  const next: State = {
    player: { ...s.player, hp: Math.min(s.player.maxHp, hp + regen), block, powers },
    energy,
    turn,
    colossusAtStart: (powers["COLOSSUS"] ?? 0) > 0,
    ...(s.maxEnergy !== undefined ? { maxEnergy: s.maxEnergy } : {}),
    hand,
    draw: pile,
    discard,
    exhaust,
    enemies,
    drawn: 0,
    exact: false,
    lostHp: false,
    exhaustedThisTurn: false,
    relics: s.relics,
    ...(s.relicVars ? { relicVars: s.relicVars } : {}),
    played: 0,
    skills: 0,
    unmovableUsed: false,
    potions: s.potions.slice(),
    potionSlots: s.potionSlots,
    potionsUsed: s.potionsUsed,
    ...(s.revivals ? { revivals: s.revivals } : {}),
  };
  if (after.revived) spendRevival(next, after.revived);
  return next;
}

/** The card without Bound. */
function free(c: Card): Card {
  if (!c.bound) return c;
  const { bound: _bound, ...rest } = c;
  return rest;
}
