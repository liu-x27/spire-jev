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

import { type Card, type Enemy, endOfTurnBlock, hpLoss, incomingDamage, type State } from "./sim.ts";

/** Powers that last the turn they were played in. */
const TURN_ONLY = ["NO_DRAW", "RAGE", "FLAME_BARRIER", "FREE_ATTACK", "COLOSSUS", "RETAIN_HAND", "DUPLICATION"];
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
 * if the enemies' turn kills the player. `attack` says what an enemy will hit
 * for next turn.
 */
export function nextTurn(s: State, rng: () => number, attack: (e: Enemy) => number): State | undefined {
  const hp = s.player.hp - hpLoss(s);
  if (hp <= 0) return undefined;
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
  if (powers["DEMON_FORM"]) powers["STRENGTH"] = (powers["STRENGTH"] ?? 0) + powers["DEMON_FORM"]!;
  const energy = (s.maxEnergy ?? 3) + (powers["ENERGY_NEXT_TURN"] ?? 0);
  const extraDraw = powers["DRAW_CARDS_NEXT_TURN"] ?? 0;
  block += powers["BLOCK_NEXT_TURN"] ?? 0;
  for (const k of ["ENERGY_NEXT_TURN", "DRAW_CARDS_NEXT_TURN", "BLOCK_NEXT_TURN"]) delete powers[k];

  const keepAll = (s.player.powers["RETAIN_HAND"] ?? 0) > 0;
  const hand: Card[] = [];
  let discard = s.discard.slice();
  const exhaust = s.exhaust.slice();
  for (const c of s.hand) {
    if (keepAll || c.keywords.includes("Retain")) hand.push({ ...c, locked: false });
    else if (c.keywords.includes("Ethereal")) exhaust.push(c);
    else discard.push(c);
  }
  let pile = shuffle(s.draw.slice(), rng);
  for (let i = 0; i < 5 + extraDraw && hand.length < HAND_LIMIT; i++) {
    if (pile.length === 0) {
      if (discard.length === 0) break;
      pile = shuffle(discard, rng);
      discard = [];
    }
    hand.push({ ...pile.pop()!, locked: false });
  }

  const enemies = s.enemies.map((e): Enemy => {
    if (!e.alive) return { ...e, powers: { ...e.powers } };
    const ep = { ...e.powers };
    tick(ep, ["WEAK", "VULNERABLE"]);
    const damage = Math.max(0, Math.round(attack(e)));
    return {
      ...e, powers: ep, block: 0,
      intents: damage > 0 ? [{ type: "Attack", damage, hits: 1 }] : [{ type: "Buff", damage: 0, hits: 0 }],
      weakAtStart: (ep["WEAK"] ?? 0) > 0,
      startStrength: ep["STRENGTH"] ?? 0,
    };
  });

  return {
    player: { ...s.player, hp: Math.min(s.player.maxHp, hp + regen), block, powers },
    energy,
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
  };
}
