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
import { type EnemyTurn, moveIntents, playMove } from "./scripts.ts";
import { type Card, type Enemy, endOfTurnBlock, hpAfterTurn, incomingDamage, isClaw, spendRevival, type State } from "./sim.ts";

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
  // The enemies' turn, before the next hand is drawn: a scripted boss's move (scripts.ts) puts its
  // cards into the piles and its debuffs on the player.
  const draw = s.draw.slice();
  const clawsUp = s.enemies.filter((e) => e.alive && isClaw(e)).length;
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
    // A killed Test Subject respawns: the next form at full HP, Painful Stabs in the second (Multi
    // Claw 11x3), Nemesis in the third (Lacerate 11x3), whose Intangible comes the first turn.
    if (!e.alive && (e.revive ?? 0) > 0) {
      const third = (e.powers["PAINFUL_STABS"] ?? 0) > 0;
      const { revive: _revive, ...form } = e;
      return {
        ...form, alive: true, hp: e.revive!, maxHp: e.revive!, block: 0,
        powers: third ? { NEMESIS: 1, INTANGIBLE: 1 } : { ADAPTABLE: 1, PAINFUL_STABS: 1 },
        intents: [{ type: "Attack", damage: 11, hits: 3 }], move: third ? "PHASE3_LACERATE_MOVE" : "MULTI_CLAW_MOVE",
        weakAtStart: false, startStrength: 0, vulnerableAtStart: false,
      };
    }
    if (!e.alive) return { ...e, powers: { ...e.powers } };
    const ep = { ...e.powers };
    tick(ep, ["WEAK", "VULNERABLE"]);
    // Intangible goes a stack at the end of the enemies' turn (Soul Fysh's Fade covers one player
    // turn); Nemesis (the Test Subject's third form) puts it on every other turn (IL: NemesisPower).
    const intangible = (ep["INTANGIBLE"] ?? 0) > 0;
    tick(ep, ["INTANGIBLE"]);
    if ((ep["NEMESIS"] ?? 0) > 0) {
      if (intangible) delete ep["INTANGIBLE"];
      else ep["INTANGIBLE"] = 1;
    }
    // The Lagavulin Matriarch asleep (IL: AsleepPower, PlatingPower): Plating loses a stack from her
    // second turn and gives its amount in block at her turn's end; after her third turn she wakes,
    // Plating gone first.
    let sleepBlock = 0;
    if ((ep["ASLEEP"] ?? 0) > 0) {
      if (ep["ASLEEP"]! <= 1) {
        delete ep["PLATING"];
        delete ep["ASLEEP"];
      } else {
        ep["ASLEEP"] = ep["ASLEEP"]! - 1;
        if ((s.turn ?? 1) >= 2 && (ep["PLATING"] ?? 0) > 0) ep["PLATING"] = ep["PLATING"]! - 1;
        sleepBlock = Math.max(0, ep["PLATING"] ?? 0);
      }
    }
    // A boss's move by its id: what it does now, and the move it shows next.
    const moved: EnemyTurn = { turn: s.turn ?? 1, powers: ep, block: sleepBlock, heal: 0, player: powers, draw, discard };
    const move = playMove(e, moved);
    sleepBlock = moved.block;
    // Strength every turn: Byrdonis's Territorial, a Ritual.
    for (const k of ["TERRITORIAL", "RITUAL"]) if ((ep[k] ?? 0) > 0) ep["STRENGTH"] = (ep["STRENGTH"] ?? 0) + ep[k]!;
    // The Waterfall Giant's Steam Eruption grows 3 every turn, and its Heal turn gives back 15
    // (A10, our logs: every turn's buff, and each heal's miss in the turn-start checks).
    if ((ep["STEAM_ERUPTION"] ?? 0) > 0) ep["STEAM_ERUPTION"] = ep["STEAM_ERUPTION"]! + 3;
    const heal = (e.model === "WATERFALL_GIANT" && e.intents.some((i) => i.type === "Heal") ? 15 : 0) + moved.heal;
    // Stone Calendar: 52 to every enemy at the end of turn 7.
    const calendar = (s.turn ?? 1) === 7 ? relic("STONE_CALENDAR", "Damage", 52) : 0;
    const hp = Math.min(e.maxHp, e.hp + heal) - calendar;
    const { asleep: _asleep, behindAtStart: _behind, move: _move, ...rest } = e;
    const sleeping = (ep["ASLEEP"] ?? 0) > 0;
    // Its next move's intents as the game will show them: Strength, the player's Vulnerable, its own
    // Weak, a claw's back attack (the player still faces the claw last targeted); Multi Claw a hit more.
    const behind = s.facing !== undefined && e.id !== s.facing && clawsUp > 1 && isClaw(e);
    const hits = move === "MULTI_CLAW_MOVE" && e.move === "MULTI_CLAW_MOVE" ? (e.intents.find((i) => i.type === "Attack")?.hits ?? 3) + 1 : undefined;
    const intents = move !== undefined
      ? moveIntents(e.model, move, ep["STRENGTH"] ?? 0, { vulnerable: (powers["VULNERABLE"] ?? 0) > 0, weak: (ep["WEAK"] ?? 0) > 0, behind }, hits)
      : sleeping ? [{ type: "Sleep", damage: 0, hits: 0 }] : foresee(e, turn);
    return {
      ...rest, powers: ep, block: sleepBlock, hp: Math.max(0, hp), alive: hp > 0,
      intents,
      ...(move !== undefined ? { move } : {}),
      ...(move !== undefined && behind ? { behindAtStart: true } : {}),
      weakAtStart: (ep["WEAK"] ?? 0) > 0,
      startStrength: ep["STRENGTH"] ?? 0,
      vulnerableAtStart: (ep["VULNERABLE"] ?? 0) > 0,
      skittishUsed: false,
      shellTaken: 0,
      ...(sleeping ? { asleep: { turns: ep["ASLEEP"]!, hp: Math.max(0, hp) } } : {}),
    };
  });

  // Chains of Binding (the Queen): the first cards drawn each turn, as many as its amount, are Bound.
  const binding = Math.max(0, powers["CHAINS_OF_BINDING"] ?? 0);
  // Mind Rot (the Knowledge Demon's curse; IL: MindRotPower.ModifyHandDraw): the turn's draw, less its amount.
  const handDraw = Math.max(0, 5 - Math.max(0, powers["MIND_ROT"] ?? 0));
  let pile = shuffle(draw, rng);
  for (let i = 0; i < handDraw + extraDraw && hand.length < HAND_LIMIT; i++) {
    if (pile.length === 0) {
      if (discard.length === 0) break;
      pile = shuffle(discard, rng);
      discard = [];
    }
    hand.push({ ...free(pile.pop()!), locked: false, ...(i < binding ? { bound: true } : {}) });
  }

  // Sloth counts the cards of a turn: the next starts at 0 (IL: SlothPower.BeforeSideTurnStart).
  const powerVars = s.player.powerVars?.["SLOTH"] ? { ...s.player.powerVars, SLOTH: { ...s.player.powerVars["SLOTH"], _cardsPlayedThisTurn: 0 } } : s.player.powerVars;
  const next: State = {
    player: { ...s.player, hp: Math.min(s.player.maxHp, hp + regen), block, powers, ...(powerVars ? { powerVars } : {}) },
    energy,
    turn,
    ...(s.facing !== undefined ? { facing: s.facing } : {}),
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
