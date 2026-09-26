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
import { type EnemyTurn, moveIntents, playMove, scripted } from "./scripts.ts";
import { type Card, type Enemy, endOfTurn, endOfTurnBlock, hpAfterTurn, hpLoss, incomingDamage, isClaw, redSkull, spendRevival, startOfTurn, type State } from "./sim.ts";

/** Powers that last the turn they were played in. */
const TURN_ONLY = ["NO_DRAW", "ONE_TWO_PUNCH", "RAGE", "FLAME_BARRIER", "FREE_ATTACK", "COLOSSUS", "RETAIN_HAND", "DUPLICATION", "TAINTED"];
/** Powers that lose a stack every round. */
const TICKS = ["WEAK", "FRAIL", "VULNERABLE", "BLUR", "PLATING", "REGEN", "NO_BLOCK"];
/** Temporary Strength and Dexterity, and what they were added to. */
const TEMPORARY: [string, string][] = [["SETUP_STRIKE", "STRENGTH"], ["FLEX_POTION", "STRENGTH"], ["SPEED_POTION", "DEXTERITY"], ["REPTILE_TRINKET", "STRENGTH"]];
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
export function nextTurn(s0: State, rng: () => number, foresee: (e: Enemy, turn: number) => readonly IntentObs[]): State | undefined {
  // The player's end of the turn first (sim.ts endOfTurn: Stampede, Howl from Beyond, the Bombs).
  const s = endOfTurn(s0);
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
  let extraDraw = (powers["DRAW_CARDS_NEXT_TURN"] ?? 0) + (every("PENDULUM") ? relic("PENDULUM", "Cards", 1) : 0);
  block += powers["BLOCK_NEXT_TURN"] ?? 0;
  const relicVar = (id: string, name: string, fallback: number) => s.relicVars?.[id]?.[name] ?? fallback;
  // Horn Cleat (IL: AfterBlockCleared): 14 block on turn 2; Sparkling Rouge: 1 Strength and 1 Dexterity on turn 3.
  if (turn === 2) block += relic("HORN_CLEAT", "Block", 14);
  if (turn === 3 && s.relics.includes("SPARKLING_ROUGE")) {
    powers["STRENGTH"] = (powers["STRENGTH"] ?? 0) + relic("SPARKLING_ROUGE", "StrengthPower", 1);
    powers["DEXTERITY"] = (powers["DEXTERITY"] ?? 0) + relic("SPARKLING_ROUGE", "DexterityPower", 1);
  }
  // Pocketwatch (IL: AfterSideTurnStart): 3 cards or fewer played last turn, 3 more drawn.
  const playedLast = relicVar("POCKETWATCH", "_cardsPlayedThisTurn", 0) + s.played;
  if (s.relics.includes("POCKETWATCH") && playedLast <= relicVar("POCKETWATCH", "CardThreshold", 3)) extraDraw += relicVar("POCKETWATCH", "Cards", 3);
  // Centennial Puzzle: the fight's first damage past block, if the enemies' turn deals it, draws 3.
  const puzzle = s.relics.includes("CENTENNIAL_PUZZLE") && relicVar("CENTENNIAL_PUZZLE", "_usedThisCombat", 0) === 0 && hpLoss(s) > 0;
  if (puzzle) extraDraw += relicVar("CENTENNIAL_PUZZLE", "Cards", 3);
  for (const k of ["ENERGY_NEXT_TURN", "DRAW_CARDS_NEXT_TURN", "BLOCK_NEXT_TURN"]) delete powers[k];

  const keepAll = (s.player.powers["RETAIN_HAND"] ?? 0) > 0 || ((s.turn ?? 1) === 1 && s.relics.includes("RINGING_TRIANGLE"));
  const hand: Card[] = [];
  let discard = s.discard.slice();
  const exhaust = s.exhaust.slice();
  for (const held of s.hand) {
    // Stomp's cuts are for the turn.
    const c = uncut(held);
    // Bound ends with the turn (Chains of Binding un-Binds the hand). Ethereal goes before a kept
    // hand is looked at (IL: DoTurnEnd, ShouldEtherealTrigger).
    if (c.keywords.includes("Ethereal")) exhaust.push(c);
    else if (keepAll || c.keywords.includes("Retain")) hand.push({ ...free(c), locked: false });
    else discard.push(c);
  }
  // The enemies' turn, before the next hand is drawn: a scripted boss's move (scripts.ts) puts its
  // cards into the piles and its debuffs on the player.
  const draw = s.draw.slice();
  const clawsUp = s.enemies.filter((e) => e.alive && isClaw(e)).length;
  const gifts: { from: number; powers: Record<string, number> }[] = [];
  /** Whether the player was Vulnerable when each scripted enemy's next intents were worked out. */
  const shownWith = new Map<number, boolean>();
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
    // Strength taken for the turn (Mangle, Dark Shackles) comes back at the end of the enemy's turn.
    for (const k of ["MANGLE", "DARK_SHACKLES"]) {
      if ((ep[k] ?? 0) <= 0) continue;
      ep["STRENGTH"] = (ep["STRENGTH"] ?? 0) + ep[k]!;
      if (ep["STRENGTH"] === 0) delete ep["STRENGTH"];
      delete ep[k];
    }
    tick(ep, ["WEAK", "VULNERABLE"]);
    // Sandpit (The Insatiable; IL: SandpitPower.AfterSideTurnStartLate) runs down a stack as the enemies'
    // turn starts; at 0 it devours the player (hpLoss already takes it all when it stands at 1).
    if ((ep["SANDPIT"] ?? 0) > 0) ep["SANDPIT"] = Math.max(1, ep["SANDPIT"]! - 1);
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
    const moved: EnemyTurn = {
      turn: s.turn ?? 1, powers: ep, block: sleepBlock, heal: 0, player: powers, draw, discard,
      allies: s.enemies.filter((o) => o !== e), allyPowers: {},
    };
    const move = playMove(e, moved);
    if (Object.keys(moved.allyPowers).length > 0) gifts.push({ from: e.id, powers: moved.allyPowers });
    sleepBlock = moved.block;
    // Strength every turn: Byrdonis's Territorial, a Ritual.
    for (const k of ["TERRITORIAL", "RITUAL"]) if ((ep[k] ?? 0) > 0) ep["STRENGTH"] = (ep["STRENGTH"] ?? 0) + ep[k]!;
    // The Waterfall Giant's Steam Eruption grows 3 every turn, and its Heal turn gives back 15
    // (A10, our logs: every turn's buff, and each heal's miss in the turn-start checks).
    if ((ep["STEAM_ERUPTION"] ?? 0) > 0) ep["STEAM_ERUPTION"] = ep["STEAM_ERUPTION"]! + 3;
    const heal = (e.model === "WATERFALL_GIANT" && e.intents.some((i) => i.type === "Heal") ? 15 : 0) + moved.heal;
    // Stone Calendar: 52 to every enemy at the end of turn 7.
    const calendar = (s.turn ?? 1) === 7 ? relic("STONE_CALENDAR", "Damage", 52) : 0;
    // Demise (IL: DemisePower.AfterSideTurnEnd): its amount off the enemy at its turn's end, past block.
    const demise = Math.max(0, ep["DEMISE"] ?? 0);
    const hp = Math.min(e.maxHp, e.hp + heal) - calendar - demise;
    const { asleep: _asleep, behindAtStart: _behind, move: _move, ...rest } = e;
    const sleeping = (ep["ASLEEP"] ?? 0) > 0;
    // Its next move's intents as the game will show them: Strength, the player's Vulnerable, its own
    // Weak, a claw's back attack (the player still faces the claw last targeted); Multi Claw a hit more.
    const behind = s.facing !== undefined && e.id !== s.facing && clawsUp > 1 && isClaw(e);
    const hits = move === "MULTI_CLAW_MOVE" && e.move === "MULTI_CLAW_MOVE" ? (e.intents.find((i) => i.type === "Attack")?.hits ?? 3) + 1 : undefined;
    const intents = move !== undefined
      ? moveIntents(e.model, move, ep["STRENGTH"] ?? 0, { vulnerable: (powers["VULNERABLE"] ?? 0) > 0, weak: (ep["WEAK"] ?? 0) > 0, behind }, hits)
      : sleeping ? [{ type: "Sleep", damage: 0, hits: 0 }] : foresee(e, turn);
    if (move !== undefined) shownWith.set(e.id, (powers["VULNERABLE"] ?? 0) > 0);
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

  // Thorns on the player (Bronze Scales; IL: ThornsPower.BeforeDamageReceived): every hit of an
  // enemy's attack costs the attacker its amount, blocked or not.
  const thornsBack = Math.max(0, powers["THORNS"] ?? 0);
  if (thornsBack > 0) {
    s.enemies.forEach((before, i) => {
      const e = enemies[i]!;
      if (!before.alive || !e.alive) return;
      const hits = before.intents.filter((x) => x.type === "Attack").reduce((a, x) => a + Math.max(1, x.hits), 0);
      if (hits === 0) return;
      e.hp = Math.max(0, e.hp - thornsBack * hits);
      if (e.hp === 0) e.alive = false;
    });
  }

  // Powers one enemy's move gives the others (Burn Bright for Me) go on every living one; and an
  // enemy that moved before another made the player Vulnerable (You Are Mine) shows it all the same:
  // the game works a shown hit out as it stands.
  const gifted = new Set<number>();
  for (const g of gifts) {
    for (const o of enemies) {
      if (o.id === g.from || !o.alive) continue;
      for (const [k, n] of Object.entries(g.powers)) o.powers[k] = (o.powers[k] ?? 0) + n;
      o.startStrength = o.powers["STRENGTH"] ?? 0;
      gifted.add(o.id);
    }
  }
  const vulnerable = (powers["VULNERABLE"] ?? 0) > 0;
  for (const o of enemies) {
    if (!o.alive || !scripted(o) || !o.intents.some((i) => i.type === "Attack")) continue;
    if (!gifted.has(o.id) && shownWith.get(o.id) === vulnerable) continue;
    const mult = { vulnerable, weak: (o.powers["WEAK"] ?? 0) > 0, behind: o.behindAtStart ?? false };
    o.intents = moveIntents(o.model, o.move!, o.startStrength, mult, o.intents.find((i) => i.type === "Attack")?.hits);
  }

  // Chains of Binding (the Queen): the first cards drawn each turn, as many as its amount, are Bound.
  const binding = Math.max(0, powers["CHAINS_OF_BINDING"] ?? 0);
  // Mind Rot (the Knowledge Demon's curse; IL: MindRotPower.ModifyHandDraw): the turn's draw, less its amount.
  // Pael's Blood (IL: PaelsBlood.ModifyHandDraw): a card more every turn.
  const handDraw = Math.max(0, 5 + relic("PAELS_BLOOD", "Cards", 1) - Math.max(0, powers["MIND_ROT"] ?? 0));
  // Nostalgia's cards are on top, known; the rest of the pile is in an order not known.
  const top = Math.min(s.onTop ?? 0, draw.length);
  let pile = [...shuffle(draw.slice(0, draw.length - top), rng), ...draw.slice(draw.length - top)];
  // Bolas and Thrumming Hatchet played this turn come back before the draw.
  for (const from of [discard, pile]) {
    for (let i = from.length - 1; i >= 0; i--) {
      if (!from[i]!.returns || hand.length >= HAND_LIMIT) continue;
      const { returns: _r, ...back } = from.splice(i, 1)[0]!;
      hand.push({ ...back, locked: false });
    }
  }
  // Aggression (IL: AggressionPower, before the draw): a random attack of the discard pile into the
  // hand a stack, upgraded (its upgraded numbers are not known here: as it is).
  for (let i = 0; i < (powers["AGGRESSION"] ?? 0) && hand.length < HAND_LIMIT; i++) {
    const at = discard.map((c, j) => (c.type === "Attack" ? j : -1)).filter((j) => j >= 0);
    if (at.length === 0) break;
    hand.push({ ...free(discard.splice(at[Math.floor(rng() * at.length)]!, 1)[0]!), locked: false });
  }
  for (let i = 0; i < handDraw + extraDraw && hand.length < HAND_LIMIT; i++) {
    if (pile.length === 0) {
      if (discard.length === 0) break;
      pile = shuffle(discard, rng);
      discard = [];
      // Stratagem (IL: AfterShuffle): a card of the new pile into the hand a stack (the choice: any).
      for (let k = 0; k < (powers["STRATAGEM"] ?? 0) && pile.length > 1 && hand.length < HAND_LIMIT - 1; k++) hand.push({ ...free(pile.shift()!), locked: false });
    }
    hand.push({ ...free(pile.pop()!), locked: false, ...(i < binding ? { bound: true } : {}) });
  }

  // Sloth counts the cards of a turn: the next starts at 0 (IL: SlothPower.BeforeSideTurnStart).
  let powerVars = s.player.powerVars?.["SLOTH"] ? { ...s.player.powerVars, SLOTH: { ...s.player.powerVars["SLOTH"], _cardsPlayedThisTurn: 0 } } : s.player.powerVars;
  // Juggling counts the attacks of a turn the same way.
  if (powerVars?.["JUGGLING"]) powerVars = { ...powerVars, JUGGLING: { ...powerVars["JUGGLING"], attacksPlayedThisTurn: 0 } };
  // The hits of the enemies' turn that got past block (Tear Asunder counts them): the block takes
  // the hits in turn.
  let left = endOfTurnBlock(s);
  let through = 0;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    for (const i of e.intents) {
      if (i.type !== "Attack") continue;
      for (let h = 0; h < Math.max(1, i.hits); h++) {
        if (i.damage > left) {
          through++;
          left = 0;
        } else left -= i.damage;
      }
    }
  }
  const hurt = (s.hurt ?? 0) + through;
  // Self-Forming Clay (IL: SelfFormingClayPower, at the block's clearing): 3 block for every damage past block.
  if (s.relics.includes("SELF_FORMING_CLAY")) {
    block += (powers["SELF_FORMING_CLAY"] ?? 0) + through * relicVar("SELF_FORMING_CLAY", "BlockNextTurn", 3);
    delete powers["SELF_FORMING_CLAY"];
  }
  const bombs = (s.bombs ?? []).map((b) => ({ ...b, turns: b.turns - 1 }));
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
    ...(s.relicVars || puzzle ? { relicVars: nextRelicVars(s, puzzle) } : {}),
    played: 0,
    skills: 0,
    unmovableUsed: false,
    potions: s.potions.slice(),
    potionSlots: s.potionSlots,
    potionsUsed: s.potionsUsed,
    ...(s.revivals ? { revivals: s.revivals } : {}),
    ...(hurt ? { hurt } : {}),
    ...(bombs.length ? { bombs } : {}),
  };
  if (after.revived) spendRevival(next, after.revived);
  redSkull(next);
  // After the draw: Inferno's cost and hit, Mayhem's and Hellraiser's free plays.
  startOfTurn(next);
  if (next.player.hp <= 0) return undefined;
  return next;
}

/**
 * Relic counters for the next turn: the turn's counts start again (Ornamental Fan's, Kusarigama's,
 * Letter Opener's attacks and skills, Pocketwatch's cards), the fight's and run's go on (Iron Club's
 * cards, Pen Nib's and Nunchaku's attacks, Tuning Fork's skills), and Centennial Puzzle is spent if
 * the enemies' turn drew its cards.
 */
function nextRelicVars(s: State, puzzle = false): Readonly<Record<string, Record<string, number>>> {
  const v = s.relicVars ?? {};
  const fan = v["ORNAMENTAL_FAN"];
  const club = v["IRON_CLUB"];
  const nib = v["PEN_NIB"];
  const nun = s.relics.includes("NUNCHAKU") ? v["NUNCHAKU"] ?? {} : undefined;
  const kus = v["KUSARIGAMA"];
  const opener = v["LETTER_OPENER"];
  const watch = s.relics.includes("POCKETWATCH") ? v["POCKETWATCH"] ?? {} : undefined;
  const fork = v["TUNING_FORK"];
  return {
    ...v,
    ...(nun ? { NUNCHAKU: { ...nun, _attacksPlayed: ((nun["_attacksPlayed"] ?? 0) + (s.attacks ?? 0)) % (nun["Cards"] || 10) } } : {}),
    ...(kus ? { KUSARIGAMA: { ...kus, _attacksPlayedThisTurn: 0 } } : {}),
    ...(opener ? { LETTER_OPENER: { ...opener, _skillsPlayedThisTurn: 0 } } : {}),
    ...(watch ? { POCKETWATCH: { ...watch, _cardsPlayedLastTurn: (watch["_cardsPlayedThisTurn"] ?? 0) + s.played, _cardsPlayedThisTurn: 0 } } : {}),
    ...(fork ? { TUNING_FORK: { ...fork, _skillsPlayed: (fork["_skillsPlayed"] ?? 0) + s.skills } } : {}),
    ...(puzzle ? { CENTENNIAL_PUZZLE: { ...(v["CENTENNIAL_PUZZLE"] ?? {}), _usedThisCombat: 1 } } : {}),
    ...(nib ? { PEN_NIB: { ...nib, _attacksPlayed: ((nib["_attacksPlayed"] ?? 0) + (s.attacks ?? 0)) % 10 } } : {}),
    ...(fan ? { ORNAMENTAL_FAN: { ...fan, _attacksPlayedThisTurn: 0 } } : {}),
    ...(club ? { IRON_CLUB: { ...club, _cardsPlayed: (club["_cardsPlayed"] ?? 0) + s.played } } : {}),
  };
}

/** The card at its cost before the turn's cuts (Stomp). */
function uncut(c: Card): Card {
  if (c.fullCost === undefined) return c;
  const { fullCost, ...rest } = c;
  return { ...rest, cost: fullCost };
}

/** The card without Bound. */
function free(c: Card): Card {
  if (!c.bound) return c;
  const { bound: _bound, ...rest } = c;
  return rest;
}
