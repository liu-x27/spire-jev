/**
 * The Silent's own rules: see characters/index.ts for the hooks.
 *
 * Every rule is from the game's IL (v0.111.0), read into specs kept out of the repository; the
 * comments name the method. What the Silent adds to the fight:
 *
 * - Poison (IL: PoisonPower.AfterSideTurnStart, Trigger): at the start of the poisoned enemy's turn,
 *   after its block is cleared and before it acts, it loses its Poison in HP through block (1 a tick
 *   through Intangible), and the Poison goes 1 down; Accelerant makes it tick again (P, P-1, …, at
 *   most 1 + Accelerant times). An enemy it kills does not act (sim.ts incomingHitsBy asks
 *   enemyTurnStart). Artifact takes Poison like any debuff; Snecko Skull gives 1 more (sim.ts
 *   applyPower). The evaluation counts what the Poison on each enemy will take over its turns to
 *   come, the deck's pace of other damage shortening them, each turn later worth less.
 * - Shivs (IL: Shiv, Shiv.CreateInHand): 0 cost, 4 damage (6 upgraded), Exhaust, one enemy (all of
 *   them under Fan of Knives); into the hand, past 10 cards into the discard pile. Accuracy adds to
 *   every Shiv's hit and Phantom Blades to the turn's first, like Strength.
 * - Discards (IL: CardCmd.DiscardAndDraw): an effect's discard moves each card to the discard pile
 *   (Tingsha and Tough Bandages answer each one), then its draw, then every Sly card it discarded is
 *   played for free (CardCmd.AutoPlay), a random target for one that needs it. The end of the turn's
 *   discard is not one of these. Which card goes is the player's choice: discardIndex, which the
 *   runner's selects use too (combatSelect), so what the model assumes is what is played.
 */

import type { CharacterRules, Count, Rule } from "./index.ts";
import {
  addPower, applyPower, autoPlay, blockGain, type Card, counted, died, dmg, draw, type Enemy, gainBlock, HAND_LIMIT, has, hit, junkIndex,
  num, one, relicDamage, relicVar, resolve, type State, strike,
} from "../sim.ts";
import { deckPace } from "../search.ts";

/** The Silent's counters since the observation, on State.ext: cards discarded and drawn, Shivs played; Nightmare's card. */
interface SilentExt {
  discards?: number;
  draws?: number;
  shivs?: number;
  nightmare?: Card;
}
const ext = (s: State): SilentExt => (s.ext ?? {}) as SilentExt;
function bump(s: State, key: "discards" | "draws" | "shivs", n = 1): void {
  s.ext = { ...(s.ext ?? {}), [key]: (ext(s)[key] ?? 0) + n };
}

const alive = (s: State) => s.enemies.filter((e) => e.alive);
const amount = (s: State, p: string) => Math.max(0, s.player.powers[p] ?? 0);

// ---- Poison ---------------------------------------------------------------------------------------

const poisonOf = (e: Enemy) => Math.max(0, e.powers["POISON"] ?? 0);
/** How many times an enemy's Poison ticks (IL: PoisonPower.get_TriggerCount): min(P, 1 + the player's Accelerant). */
const ticks = (s: State, p: number) => Math.min(p, 1 + amount(s, "ACCELERANT"));
/**
 * What a turn's start's Poison does to `e` (IL: PoisonPower.Trigger): its ticks, p, p-1, …, each
 * through what caps an enemy's HP loss as a hit's (sim.ts hit: Intangible 1, Slippery 1 a stack,
 * Hard to Kill; SlipperyPower.ModifyHpLostAfterOsty has no powered check), on a copy of it: the HP
 * it loses and its powers after (Poison down, Slippery's stacks spent).
 */
function poisonTick(s: State, e: Enemy): { lost: number; powers: Record<string, number> } {
  const p = poisonOf(e);
  const copy: Enemy = { ...e, block: 0, powers: { ...e.powers } };
  const n = ticks(s, p);
  for (let i = 0; i < n && copy.alive; i++) hit(copy, p - i);
  if (copy.alive) {
    if (p - n > 0) copy.powers["POISON"] = p - n;
    else delete copy.powers["POISON"];
  }
  return { lost: e.hp - copy.hp, powers: copy.powers };
}

/** HP an enemy loses through block (Poison, Strangle): each hit a tick, as the game deals them. */
function drain(s: State, e: Enemy, n: number): void {
  if (n <= 0 || !e.alive) return;
  const block = e.block;
  e.block = 0;
  hit(e, n);
  if (e.alive) e.block = block;
  else died(s, e);
}

/** Poison ticking now, as if the enemy's turn had started (IL: Outbreak's PoisonPower.Trigger). */
function tickNow(s: State, e: Enemy): void {
  const p = poisonOf(e);
  if (p <= 0) return;
  const n = ticks(s, p);
  for (let i = 0; i < n && e.alive; i++) drain(s, e, has(e, "INTANGIBLE") ? 1 : p - i);
  if (e.alive) {
    if (p - n > 0) e.powers["POISON"] = p - n;
    else delete e.powers["POISON"];
  }
}

/** Each turn of Poison later is worth this much less: the fight may be won, or lost, before it lands. */
const POISON_DECAY = 0.85;
/** At most this many turns of it are counted. */
const POISON_TURNS = 10;
/**
 * What the Poison on the enemies will take from here on, in HP, as evaluate counts the enemies' HP:
 * turn by turn its ticks, then the deck's pace of other damage, until the enemy is dead or the
 * Poison gone. The first ticks are this enemy turn's, before it acts.
 */
export function poisonAhead(s: State): number {
  let total = 0;
  let pace: number | undefined;
  for (const e of s.enemies) {
    if (!e.alive || poisonOf(e) <= 0) continue;
    pace ??= deckPace(s).perTurn;
    let hp = e.hp;
    let p = poisonOf(e);
    let slippery = Math.max(0, e.powers["SLIPPERY"] ?? 0);
    for (let t = 0; t < POISON_TURNS && p > 0 && hp > 0; t++) {
      const n = ticks(s, p);
      for (let i = 0; i < n && hp > 0; i++) {
        const d = Math.min(hp, has(e, "INTANGIBLE") || slippery-- > 0 ? 1 : p);
        total += d * Math.pow(POISON_DECAY, t);
        hp -= d;
        p--;
      }
      hp -= pace;
    }
  }
  return total;
}

// ---- Shivs ----------------------------------------------------------------------------------------

/** A Shiv as the game makes one (IL: Shiv): Retain too under Phantom Blades, all enemies under Fan of Knives. */
export function shivCard(s: State, upgraded = false, inky = false): Card {
  return {
    id: "SHIV", cost: 0, costsX: false, type: "Attack", target: has(s.player, "FAN_OF_KNIVES") ? "AllEnemies" : "AnyEnemy",
    keywords: has(s.player, "PHANTOM_BLADES") ? ["Exhaust", "Retain"] : ["Exhaust"], vars: { Damage: upgraded ? 6 : 4 },
    upgrades: upgraded ? 1 : 0, locked: false, glows: false,
    ...(inky ? { enchantment: "INKY", enchantmentVars: { WeakPower: 1 } } : {}),
  };
}

/** `n` Shivs into the hand (IL: Shiv.CreateInHand), past 10 cards into the discard pile. */
export function createShivs(s: State, n: number, upgraded = false, inky = false): void {
  for (let i = 0; i < n; i++) (s.hand.length + s.drawn < HAND_LIMIT ? s.hand : s.discard).push(shivCard(s, upgraded, inky));
}

/** No Shiv played yet this turn (Phantom Blades' bonus): none before the observation, none since. */
const firstShiv = (s: State) => (ext(s).shivs ?? 0) === 0 && !(s.playedBefore ?? []).some((p) => p.id === "SHIV");

const upgradedShiv = (c: Card): Card => (c.upgrades > 0 ? c : { ...c, vars: { ...c.vars, Damage: (c.vars["Damage"] ?? 4) + 2 }, upgrades: 1 });

// ---- Discards -------------------------------------------------------------------------------------

type Described = { id: string; type: string; keywords: readonly string[] };
const isSly = (c: Described) => c.keywords.includes("Sly");
const isJunk = (c: Described) => c.type === "Status" || c.type === "Curse";

/**
 * The card of a hand to give up to a discard: a Sly card first (it is played for free), else what
 * junkIndex gives up (a status or curse, else the last card). With no Sly card in the hand, exactly
 * junkIndex, what every discard chose before the Silent.
 */
export function discardIndex(cards: readonly Described[]): number {
  const sly = cards.findIndex((c) => isSly(c) && !c.keywords.includes("Unplayable") && !isJunk(c));
  return sly >= 0 ? sly : junkIndex(cards);
}

/** A card discarded by an effect: counted, and Tingsha's damage and Tough Bandages' block for it. */
function discarded(s: State, card: Card | undefined): void {
  bump(s, "discards");
  if (s.relics.includes("TINGSHA")) relicDamage(s, relicVar(s, "TINGSHA", "Damage", 3), false);
  if (s.relics.includes("TOUGH_BANDAGES")) gainBlock(s, relicVar(s, "TOUGH_BANDAGES", "Block", 3));
  if (card && !isSly(card)) s.discard.push(card);
}

/**
 * Discard `n` cards of the hand, as discardIndex picks them. With cards drawn this turn the model
 * does not know, one of those goes when the known hand has nothing it would rather lose (the real
 * choice is made seeing them; the runner's discardIndex falls back on the hand's last card, which is
 * the one just drawn); `unseen` is what the draw took off the pile, so the discard pile gets one of
 * them. The Sly cards are returned, to be played once the effect is done.
 */
function discardCards(s: State, n: number, unseen: Card[] = []): Card[] {
  const sly: Card[] = [];
  for (let k = 0; k < n; k++) {
    if (s.hand.length === 0) {
      if (s.drawn <= 0) break;
      s.drawn--;
      s.exact = false;
      discarded(s, unseen.pop());
      continue;
    }
    const pick = s.hand[discardIndex(s.hand)]!;
    if (s.drawn > 0 && !isSly(pick) && !isJunk(pick)) {
      s.drawn--;
      s.exact = false;
      discarded(s, unseen.pop());
      continue;
    }
    s.hand.splice(s.hand.indexOf(pick), 1);
    discarded(s, pick);
    if (isSly(pick)) sly.push(pick);
  }
  return sly;
}

/** The discarded Sly cards, played for free in the order they went (IL: AutoPlay, SlyDiscard). */
function playSly(s: State, sly: readonly Card[]): void {
  for (const c of sly) autoPlay(s, c);
}

/** The Silent's cards whose select is a discard (IL: CardSelectCmd.FromHandForDiscard). */
const DISCARDS = new Set(["SURVIVOR", "DAGGER_THROW", "ACROBATICS", "PREPARED", "HIDDEN_DAGGERS"]);

/** Discard `n`, then play the Sly ones: a card's discard with nothing after it. */
const discardThenSly = (s: State, n: number, unseen: Card[] = []) => playSly(s, discardCards(s, n, unseen));

/** Draw `n` as sim.ts draw does, and the cards it took off the pile unseen (the top ones, unless it reshuffled). */
function drawUnseen(s: State, n: number): Card[] {
  const top = s.draw.slice(-n).reverse();
  const drawn = s.drawn;
  draw(s, n);
  return top.slice(0, s.drawn - drawn).reverse();
}

/** The whole hand, the cards not known yet with it. */
const handSize = (s: State) => s.hand.length + s.drawn;

/** Hand Trick's and Nightmare's pick of a hand: the dearest card (a Sly skill played free saves the most). */
function dearest(cards: readonly { cost: number; type: string }[], skillsOnly: boolean): number {
  let best = -1;
  cards.forEach((c, i) => {
    if (skillsOnly && c.type !== "Skill") return;
    if (best < 0 || c.cost > cards[best]!.cost) best = i;
  });
  return best;
}

// ---- Cards ----------------------------------------------------------------------------------------

const block = (s: State, c: Card, n = num(c, "Block")) => gainBlock(s, blockGain(n, s.player), true);

const special: Record<string, Rule> = {
  SHIV: (s, c, t) => {
    const bonus = amount(s, "ACCURACY") + (firstShiv(s) ? amount(s, "PHANTOM_BLADES") : 0);
    const victims = has(s.player, "FAN_OF_KNIVES") || c.target === "AllEnemies" ? alive(s) : one(t);
    strike(s, victims, dmg(s, c, t) + bonus, 1);
    // Inky (Blade of Ink's; IL: Inky.OnPlay, after the Shiv's): Weak on whoever it hit.
    if (c.enchantment === "INKY") for (const e of victims) if (e.alive) applyPower(s, e, "WEAK", c.enchantmentVars?.["WeakPower"] ?? 1);
  },
  // Block, then a card of the hand discarded (IL: Survivor.OnPlay, FromHandForDiscard 1).
  SURVIVOR: (s, c) => {
    block(s, c);
    discardThenSly(s, 1);
  },
  // Draw, then one discarded.
  ACROBATICS: (s, c) => discardThenSly(s, 1, drawUnseen(s, num(c, "Cards"))),
  // Draw Cards, then as many discarded.
  PREPARED: (s, c) => discardThenSly(s, num(c, "Cards"), drawUnseen(s, num(c, "Cards"))),
  // A hit, a draw, a discard.
  DAGGER_THROW: (s, c, t) => {
    strike(s, one(t), dmg(s, c, t), 1);
    discardThenSly(s, 1, drawUnseen(s, 1));
  },
  // The whole hand discarded, then as many drawn, then its Sly cards played (IL: DiscardAndDraw).
  CALCULATED_GAMBLE: (s) => {
    const n = handSize(s);
    if (n === 0) return;
    const sly = discardCards(s, n);
    draw(s, n);
    playSly(s, sly);
  },
  // Two discarded, then Shivs (upgraded ones for Hidden Daggers+).
  HIDDEN_DAGGERS: (s, c) => {
    discardThenSly(s, num(c, "Cards") || 2);
    createShivs(s, num(c, "Shivs") || 2, c.upgrades > 0);
  },
  // The hand discarded, then as many Shivs as it held (counted before the discard).
  STORM_OF_STEEL: (s, c) => {
    const n = handSize(s);
    discardThenSly(s, n);
    createShivs(s, n, c.upgrades > 0);
  },
  // The hand discarded; next turn, attacks deal double (turn: nextTurn below). Its Cards is never read.
  SHADOW_STEP: (s) => {
    discardThenSly(s, handSize(s));
    addPower(s.player, "SHADOW_STEP", 1);
  },
  // Cards is how many Shivs, not a draw.
  CLOAK_AND_DAGGER: (s, c) => {
    block(s, c);
    createShivs(s, num(c, "Cards"));
  },
  BLADE_DANCE: (s, c) => createShivs(s, num(c, "Cards")),
  BLADE_OF_INK: (s, c) => createShivs(s, num(c, "Cards"), false, true),
  LEADING_STRIKE: (s, c, t) => {
    strike(s, one(t), dmg(s, c, t), 1);
    createShivs(s, num(c, "Shivs") || 2);
  },
  UP_MY_SLEEVE: (s, c) => createShivs(s, num(c, "Cards")),
  // Fan of Knives is a flag (amount 1, whatever the card's Shivs).
  FAN_OF_KNIVES: (s, c) => {
    s.player.powers["FAN_OF_KNIVES"] = 1;
    createShivs(s, num(c, "Shivs"));
  },
  INFINITE_BLADES: (s) => addPower(s.player, "INFINITE_BLADES", 1),
  // Every Shiv of the exhaust pile played at the target for free (upgraded first by Knife Trap+); one
  // whose target died deals nothing.
  KNIFE_TRAP: (s, c, t) => {
    const shivs = s.exhaust.filter((x) => x.id === "SHIV");
    s.exhaust = s.exhaust.filter((x) => x.id !== "SHIV");
    for (const shiv of shivs) {
      const card = c.upgrades > 0 ? upgradedShiv(shiv) : shiv;
      if (t && t.alive) resolve(s, card, t, 0);
      else s.exhaust.push(card);
    }
  },
  // The target's block and Artifact gone, then its Power in Vulnerable (the var is named "Power").
  EXPOSE: (s, c, t) => {
    if (!t) return;
    t.block = 0;
    delete t.powers["ARTIFACT"];
    applyPower(s, t, "VULNERABLE", num(c, "Power"));
  },
  DAGGER_SPRAY: (s, c) => strike(s, alive(s), dmg(s, c), 2),
  // A sweep of every enemy, and one more for every enemy it killed.
  ECHOING_SLASH: (s, c) => {
    for (let sweeps = 1, guard = 0; sweeps > 0 && guard < 10; sweeps--, guard++) {
      const victims = alive(s);
      if (victims.length === 0) break;
      strike(s, victims, dmg(s, c), 1);
      sweeps += victims.filter((e) => !e.alive).length;
    }
  },
  // The block it gave, next turn again (past Dexterity already: not again).
  DODGE_AND_ROLL: (s, c) => {
    const before = s.player.block;
    block(s, c);
    addPower(s.player, "BLOCK_NEXT_TURN", s.player.block - before);
  },
  // Draw one; block only if it is a skill (not known: by the draw pile's share of skills).
  ESCAPE_PLAN: (s, c) => {
    const hand = s.hand.length;
    const drawn = s.drawn;
    draw(s, 1);
    if (s.hand.length > hand) {
      if (s.hand[s.hand.length - 1]!.type === "Skill") block(s, c);
    } else if (s.drawn > drawn) {
      const pile = s.draw.length > 0 ? s.draw : s.discard;
      const share = pile.length > 0 ? pile.filter((x) => x.type === "Skill").length / pile.length : 0;
      s.exact = false;
      block(s, c, Math.floor(num(c, "Block") * share));
    }
  },
  // Energy next turn, not now.
  SIDESTEP: (s, c) => addPower(s.player, "ENERGY_NEXT_TURN", num(c, "Energy")),
  // As many hits as attacks played before it this turn: the game's count at the observation, and since.
  FINISHER: (s, c, t) => {
    const before = c.calc?.["CalculatedHits"] ?? s.attacksBefore ?? 0;
    strike(s, one(t), dmg(s, c, t), Math.max(0, before + (s.attacks ?? 1) - 1));
  },
  // As many hits as skills in the hand.
  FLECHETTES: (s, c, t) => {
    if (s.drawn > 0) s.exact = false;
    strike(s, one(t), dmg(s, c, t), s.hand.filter((x) => x.type === "Skill").length);
  },
  // Block, then a skill of the hand made Sly for the turn.
  HAND_TRICK: (s, c) => {
    block(s, c);
    const i = dearest(s.hand.map((x) => (isSly(x) ? { ...x, type: "" } : x)), true);
    if (i >= 0) s.hand[i] = { ...s.hand[i]!, keywords: [...s.hand[i]!.keywords, "Sly"] };
  },
  // X, and one more upgraded: that much Strength off the target, then as much Weak.
  MALAISE: (s, c, t, x) => {
    const n = x + (c.upgrades > 0 ? 1 : 0);
    if (!t || n <= 0) return;
    applyPower(s, t, "STRENGTH", -n);
    applyPower(s, t, "WEAK", n);
  },
  MASTER_PLANNER: (s) => {
    s.player.powers["MASTER_PLANNER"] = 1;
  },
  // Block as much as the Poison on every enemy.
  MIRAGE: (s, c) => block(s, c, alive(s).reduce((a, e) => a + poisonOf(e), 0)),
  // A card of the hand, three copies of it into next turn's hand (turn: nextTurn below).
  NIGHTMARE: (s) => {
    const i = dearest(s.hand, false);
    if (i < 0) return;
    s.ext = { ...(s.ext ?? {}), nightmare: s.hand[i] };
    addPower(s.player, "NIGHTMARE", 3);
  },
  // Poison on every enemy, then every poisoned one ticks at once.
  OUTBREAK: (s, c) => {
    for (const e of alive(s)) applyPower(s, e, "POISON", num(c, "PoisonPower"));
    for (const e of alive(s)) tickNow(s, e);
  },
  // Strength off every enemy until its turn is over (turn.ts gives it back); Artifact takes it all.
  PIERCING_WAIL: (s, c) => {
    const n = num(c, "StrengthLoss");
    for (const e of alive(s)) if (applyPower(s, e, "STRENGTH", -n)) addPower(e, "PIERCING_WAIL", n);
  },
  POUNCE: (s, c, t) => {
    strike(s, one(t), dmg(s, c, t), 1);
    addPower(s.player, "FREE_SKILL", 1);
  },
  PREDATOR: (s, c, t) => {
    strike(s, one(t), dmg(s, c, t), 1);
    addPower(s.player, "DRAW_CARDS_NEXT_TURN", 2);
  },
  // Its var is named "Power"; the doubling of the turn's block is not modelled.
  SHADOWMELD: (s, c) => {
    addPower(s.player, "SHADOWMELD", num(c, "Power") || 1);
    s.exact = false;
  },
  // Tracking is 50 (the game's constant), not the card's first var.
  TRACKING: (s) => addPower(s.player, "TRACKING", 50),
  BLUR: (s, c) => {
    block(s, c);
    addPower(s.player, "BLUR", num(c, "Blur") || 1);
  },
  // Repeat times Poison on a random enemy: spread over the living ones in turn.
  BOUNCING_FLASK: (s, c) => {
    for (let r = 0; r < (num(c, "Repeat") || 3); r++) {
      const living = alive(s);
      if (living.length === 0) break;
      if (living.length > 1) s.exact = false;
      applyPower(s, living[r % living.length]!, "POISON", num(c, "PoisonPower"));
    }
  },
  // Poison only on a poisoned target.
  BUBBLE_BUBBLE: (s, c, t) => {
    if (t && poisonOf(t) > 0) applyPower(s, t, "POISON", num(c, "PoisonPower"));
  },
  // The hand's cards free this turn (not the X ones); no more draws this turn.
  BULLET_TIME: (s) => {
    s.hand = s.hand.map((h) => (h.costsX || h.cost <= 0 ? h : { ...h, cost: 0, fullCost: h.fullCost ?? h.cost }));
    applyPower(s, s.player, "NO_DRAW", 1);
  },
  BURST: (s, c) => addPower(s.player, "BURST", num(c, "Skills") || 1),
  CORROSIVE_WAVE: (s, c) => addPower(s.player, "CORROSIVE_WAVE", num(c, "CorrosiveWave")),
};

/** Calculated damage: what each counts, from the game's number at the observation and since. */
const counts: Record<string, Count> = {
  // The cards discarded this turn.
  MEMENTO_MORI: (s, c) => counted(c) + (ext(s).discards ?? 0),
  // The cards drawn this fight.
  MURDER: (s, c) => counted(c) + (ext(s).draws ?? 0),
  // Minus the other cards of the hand, this one already out of it.
  PRECISE_CUT: (s) => -handSize(s),
};

const SILENT_RULES: CharacterRules = {
  special,
  counts,

  // Free Skill (Pounce) shows every skill of the hand at 0: their own cost back, the next one's paid by cost().
  fromObservation(obs, s) {
    if ((obs.player_powers["FREE_SKILL_POWER"] ?? 0) <= 0 || !obs.combat) return;
    s.hand = s.hand.map((c, i) => (c.type === "Skill" && !c.costsX ? { ...c, cost: obs.combat!.hand[i]?.cost ?? c.cost } : c));
  },
  // Grand Finale only with the draw pile empty.
  playable: (s, card) => card.id !== "GRAND_FINALE" || s.draw.length === 0,
  cost: (s, card, cost) => (card.type === "Skill" && has(s.player, "FREE_SKILL") ? 0 : cost),
  beforePlay(s, card) {
    if (card.type === "Skill" && has(s.player, "FREE_SKILL")) {
      addPower(s.player, "FREE_SKILL", -1);
      if ((s.player.powers["FREE_SKILL"] ?? 0) <= 0) delete s.player.powers["FREE_SKILL"];
    }
  },
  afterPlay(s, card, target) {
    if (card.id === "SHIV") {
      bump(s, "shivs");
      // Helical Dart (IL: AfterCardPlayed): a Dexterity for the turn a Shiv (turn.ts TEMPORARY takes it back).
      if (s.relics.includes("HELICAL_DART")) {
        applyPower(s, s.player, "DEXTERITY", 1);
        addPower(s.player, "HELICAL_DART", 1);
      }
    }
    // Afterimage (IL: AfterimagePower, its amount before the card): block a card, past no Dexterity.
    const image = amount(s, "AFTERIMAGE") - (card.id === "AFTERIMAGE" ? num(card, "AfterimagePower") : 0);
    if (image > 0) gainBlock(s, image);
    // Sneaky: block for every attack.
    if (card.type === "Attack" && has(s.player, "SNEAKY")) gainBlock(s, amount(s, "SNEAKY"));
    // Serpent Form (its amount before the card): that much to a random enemy, no Strength, into block.
    const serpent = amount(s, "SERPENT_FORM") - (card.id === "SERPENT_FORM" ? num(card, "SerpentFormPower") : 0);
    if (serpent > 0) relicDamage(s, serpent, false);
    // Strangle (IL: StranglePower, its amount before the card): every card after it, HP through block.
    for (const e of alive(s)) {
      const strangle = Math.max(0, e.powers["STRANGLE"] ?? 0) - (card.id === "STRANGLE" && e === target ? num(card, "StranglePower") : 0);
      if (strangle > 0) drain(s, e, has(e, "INTANGIBLE") ? 1 : strangle);
    }
    // Pinpoint costs 1 less this turn for every skill played.
    if (card.type === "Skill") {
      s.hand = s.hand.map((h) => (h.id === "PINPOINT" && h.cost > 0 ? { ...h, cost: h.cost - 1, fullCost: h.fullCost ?? h.cost } : h));
    }
  },
  // Burst: the next skills of the turn twice, a stack each (not Burst itself).
  extraPlays(s, card) {
    if (card.type !== "Skill" || card.id === "BURST" || !has(s.player, "BURST")) return 0;
    addPower(s.player, "BURST", -1);
    return 1;
  },
  afterCard(s, card) {
    // Up My Sleeve (IL: EnergyCost.AddThisCombat -1): a cost less for the rest of the fight a play.
    if (card.id === "UP_MY_SLEEVE" && card.cost > 0) return { ...card, cost: card.cost - 1 };
    // Master Planner: every skill played is Sly for the rest of the fight.
    if (card.type === "Skill" && has(s.player, "MASTER_PLANNER") && !isSly(card)) return { ...card, keywords: [...card.keywords, "Sly"] };
    return card;
  },
  onDraw(s, n) {
    bump(s, "draws", n);
    // Corrosive Wave: Poison on every enemy a card drawn this turn.
    const wave = amount(s, "CORROSIVE_WAVE");
    if (wave > 0) for (let i = 0; i < n; i++) for (const e of alive(s)) applyPower(s, e, "POISON", wave);
    // Speedster: every card drawn in the turn (not the turn's hand), damage to every enemy, into block.
    const speed = amount(s, "SPEEDSTER");
    if (speed > 0) for (let i = 0; i < n; i++) relicDamage(s, speed, true);
  },
  // Envenom: every hit of the player's attacks past block, Poison on whoever took it.
  afterHit(s, e, lost) {
    if (lost > 0 && e.alive && has(s.player, "ENVENOM")) applyPower(s, e, "POISON", amount(s, "ENVENOM"));
  },
  enemyTurnStart(s, e, powers) {
    const tick = poisonOf(e) > 0 ? poisonTick(s, e) : undefined;
    if (powers && tick) {
      for (const k of Object.keys(powers)) if (!(k in tick.powers)) delete powers[k];
      Object.assign(powers, tick.powers);
    }
    // Strangle is the player's turn's; gone by the enemy's end.
    if (powers) delete powers["STRANGLE"];
    return tick?.lost ?? 0;
  },
  nextTurn(prev, next) {
    const p = prev.player.powers;
    // Shadow Step: double damage this turn (IL: ShadowStepPower.AfterSideTurnStart).
    if ((p["SHADOW_STEP"] ?? 0) > 0) {
      next.player.powers["DOUBLE_DAMAGE"] = (next.player.powers["DOUBLE_DAMAGE"] ?? 0) + p["SHADOW_STEP"]!;
      delete next.player.powers["SHADOW_STEP"];
    }
    // Infinite Blades: its Shivs before the draw (here after it: the hand's room is the same).
    createShivs(next, Math.max(0, p["INFINITE_BLADES"] ?? 0));
    // Nightmare: three copies of its card.
    const nightmare = ext(prev).nightmare;
    if ((p["NIGHTMARE"] ?? 0) > 0 && nightmare) {
      for (let i = 0; i < (p["NIGHTMARE"] ?? 3) && next.hand.length < HAND_LIMIT; i++) next.hand.push({ ...nightmare, locked: false });
      delete next.player.powers["NIGHTMARE"];
      const { nightmare: _gone, ...rest } = ext(next);
      next.ext = rest;
    }
    // Tools of the Trade: that many more drawn, then as many discarded (after the draw).
    const tools = Math.max(0, p["TOOLS_OF_THE_TRADE"] ?? 0);
    for (let i = 0; i < tools && next.draw.length > 0 && next.hand.length < HAND_LIMIT; i++) next.hand.push({ ...next.draw.pop()!, locked: false });
    if (tools > 0) discardThenSly(next, tools);
    // Noxious Fumes: Poison on every enemy once the hand is drawn.
    const fumes = Math.max(0, p["NOXIOUS_FUMES"] ?? 0);
    if (fumes > 0) for (const e of next.enemies) if (e.alive) applyPower(next, e, "POISON", fumes);
    // Wraith Form: Dexterity lost every turn.
    const wraith = Math.max(0, p["WRAITH_FORM"] ?? 0);
    if (wraith > 0) applyPower(next, next.player, "DEXTERITY", -wraith);
    // The counters are the turn's (the fight's draws go on).
    if (next.ext) {
      const { discards: _d, shivs: _s, ...rest } = ext(next);
      next.ext = rest;
    }
  },
  evaluate: (s, w) => poisonAhead(s) * w.enemyHp,
  keyExt(s) {
    // Only the Silent's own counters (State.ext is shared: another character's fields are not hers).
    const x = ext(s);
    if (x.discards === undefined && x.draws === undefined && x.shivs === undefined && x.nightmare === undefined) return "";
    return `${x.discards ?? 0}/${x.draws ?? 0}/${x.shivs ?? 0}/${x.nightmare?.id ?? ""}`;
  },
  // The runner's selects pick as the model does: a discard by discardIndex, Hand Trick's skill and
  // Nightmare's card the dearest. The bridge names every one of them FromHand (FromHandForDiscard calls
  // FromHand, whose name is the last one set): the card played says which it is. With none (the turn's
  // start: Tools of the Trade; a potion: Gambler's Brew) it is a discard.
  combatSelect(source, purpose, cards) {
    if (cards.length === 0 || !/^FromHand(ForDiscard)?$/.test(purpose)) return undefined;
    const id = source?.replace(/\+$/, "");
    if (id === "HAND_TRICK" || id === "NIGHTMARE") {
      const i = dearest(cards.map((c) => ({ cost: c.cost ?? 0, type: c.type })), id === "HAND_TRICK");
      return i >= 0 ? i : undefined;
    }
    if (id === undefined || DISCARDS.has(id)) return discardIndex(cards);
    return undefined;
  },
};

/**
 * Card rewards (choices.ts cardValue reads `cards` as it reads the Ironclad's CARDS): no tier lists
 * like Jorbs' and Baalorlord's for the Silent in v0.111, so the four tiers are one, from strong A10
 * players' Elo over skipping (data/silent/card-stats-a10.json: S from +250, A +120, B 0, C -150,
 * D -300, F below), and the pick % is how often v0.111 A10 players took the card when offered, by
 * act (data/silent/take-rates-a10.json, 2127 runs; an act with fewer than 30 offers takes the
 * card's overall rate). Left out: Blade Symphony, Concoct, Fade, Flanking and Sneaky, never offered
 * as a reward in those runs; Suppress and Wraith Form, too rarely picked to be rated.
 */
export const SILENT: CharacterRules = {
  ...SILENT_RULES,
  character: "SILENT",
  cards: {
    ABRASIVE: { tiers: "AAAA", pick: [54, 44, 50] }, // Elo +149, offered 213/124/18
    ACCELERANT: { tiers: "BBBB", pick: [34, 33, 26] }, // Elo +45, offered 456/266/165
    ACCURACY: { tiers: "BBBB", pick: [47, 49, 46] }, // Elo +80, offered 472/252/144
    ACROBATICS: { tiers: "AAAA", pick: [49, 51, 51] }, // Elo +182, offered 428/236/131
    ADRENALINE: { tiers: "SSSS", pick: [73, 79, 77] }, // Elo +367, offered 193/126/27
    AFTERIMAGE: { tiers: "SSSS", pick: [70, 70, 70] }, // Elo +344, offered 207/115/16
    ANTICIPATE: { tiers: "DDDD", pick: [7, 6, 8] }, // Elo -299, offered 1273/712/431
    ASSASSINATE: { tiers: "BBBB", pick: [33, 21, 28] }, // Elo +31, offered 213/147/27
    BACKFLIP: { tiers: "BBBB", pick: [45, 45, 43] }, // Elo +43, offered 1327/711/403
    BACKSTAB: { tiers: "DDDD", pick: [43, 15, 5] }, // Elo -168, offered 465/249/133
    BLADE_DANCE: { tiers: "CCCC", pick: [33, 19, 18] }, // Elo -30, offered 1352/673/424
    BLADE_OF_INK: { tiers: "AAAA", pick: [57, 45, 52] }, // Elo +165, offered 194/138/22
    BLUR: { tiers: "BBBB", pick: [43, 53, 59] }, // Elo +87, offered 426/230/140
    BOUNCING_FLASK: { tiers: "CCCC", pick: [35, 19, 15] }, // Elo -136, offered 469/260/144
    BUBBLE_BUBBLE: { tiers: "CCCC", pick: [32, 33, 28] }, // Elo -77, offered 468/240/137
    BULLET_TIME: { tiers: "BBBB", pick: [33, 31, 32] }, // Elo +57, offered 214/127/16
    BURST: { tiers: "AAAA", pick: [39, 37, 38] }, // Elo +157, offered 202/133/16
    CALCULATED_GAMBLE: { tiers: "AAAA", pick: [45, 57, 57] }, // Elo +134, offered 446/254/155
    CLOAK_AND_DAGGER: { tiers: "CCCC", pick: [36, 24, 16] }, // Elo -46, offered 1314/707/452
    CORROSIVE_WAVE: { tiers: "BBBB", pick: [21, 15, 19] }, // Elo +14, offered 201/137/19
    DAGGER_SPRAY: { tiers: "FFFF", pick: [20, 3, 1] }, // Elo -328, offered 1291/704/457
    DAGGER_THROW: { tiers: "DDDD", pick: [20, 4, 3] }, // Elo -188, offered 1289/730/445
    DASH: { tiers: "DDDD", pick: [34, 13, 6] }, // Elo -171, offered 485/233/124
    DEADLY_POISON: { tiers: "DDDD", pick: [31, 12, 6] }, // Elo -240, offered 1303/747/410
    DEFLECT: { tiers: "CCCC", pick: [20, 23, 19] }, // Elo -138, offered 1325/733/381
    DODGE_AND_ROLL: { tiers: "DDDD", pick: [17, 20, 19] }, // Elo -192, offered 1261/747/443
    ECHOING_SLASH: { tiers: "DDDD", pick: [56, 21, 1] }, // Elo -226, offered 435/244/147
    ENVENOM: { tiers: "BBBB", pick: [32, 26, 30] }, // Elo +71, offered 211/134/27
    ESCAPE_PLAN: { tiers: "AAAA", pick: [48, 51, 45] }, // Elo +130, offered 402/257/150
    EXPERTISE: { tiers: "DDDD", pick: [12, 18, 17] }, // Elo -162, offered 449/254/137
    EXPOSE: { tiers: "AAAA", pick: [48, 55, 40] }, // Elo +187, offered 483/274/148
    FAN_OF_KNIVES: { tiers: "AAAA", pick: [46, 33, 41] }, // Elo +151, offered 229/117/21
    FINISHER: { tiers: "CCCC", pick: [16, 10, 8] }, // Elo -127, offered 439/258/150
    FLECHETTES: { tiers: "DDDD", pick: [22, 11, 6] }, // Elo -224, offered 469/240/149
    FLICK_FLACK: { tiers: "FFFF", pick: [18, 5, 1] }, // Elo -301, offered 1275/715/455
    FOOTWORK: { tiers: "AAAA", pick: [83, 78, 71] }, // Elo +160, offered 458/268/169
    GRAND_FINALE: { tiers: "DDDD", pick: [6, 6, 7] }, // Elo -212, offered 190/112/20
    HAND_TRICK: { tiers: "CCCC", pick: [20, 19, 18] }, // Elo -150, offered 474/262/147
    HAZE: { tiers: "CCCC", pick: [34, 24, 11] }, // Elo -78, offered 458/263/145
    HIDDEN_DAGGERS: { tiers: "BBBB", pick: [64, 53, 42] }, // Elo +117, offered 424/244/135
    INFINITE_BLADES: { tiers: "CCCC", pick: [42, 24, 20] }, // Elo -10, offered 467/261/160
    KNIFE_TRAP: { tiers: "AAAA", pick: [43, 47, 45] }, // Elo +184, offered 214/135/15
    LEADING_STRIKE: { tiers: "CCCC", pick: [40, 24, 12] }, // Elo -63, offered 1329/735/445
    LEG_SWEEP: { tiers: "BBBB", pick: [59, 50, 37] }, // Elo +17, offered 454/251/152
    MALAISE: { tiers: "BBBB", pick: [47, 28, 41] }, // Elo +106, offered 213/128/12
    MASTER_PLANNER: { tiers: "BBBB", pick: [17, 17, 17] }, // Elo +64, offered 222/126/13
    MEMENTO_MORI: { tiers: "FFFF", pick: [5, 2, 3] }, // Elo -356, offered 495/252/133
    MIRAGE: { tiers: "DDDD", pick: [17, 25, 25] }, // Elo -174, offered 471/242/142
    MURDER: { tiers: "DDDD", pick: [7, 8, 8] }, // Elo -153, offered 188/110/14
    NIGHTMARE: { tiers: "BBBB", pick: [14, 24, 17] }, // Elo +77, offered 194/107/16
    NOXIOUS_FUMES: { tiers: "BBBB", pick: [68, 43, 30] }, // Elo +14, offered 474/293/174
    OUTBREAK: { tiers: "DDDD", pick: [46, 24, 37] }, // Elo -168, offered 202/120/22
    PHANTOM_BLADES: { tiers: "CCCC", pick: [40, 28, 26] }, // Elo -68, offered 489/270/174
    PIERCING_WAIL: { tiers: "BBBB", pick: [39, 42, 36] }, // Elo +108, offered 1233/721/455
    PINPOINT: { tiers: "DDDD", pick: [20, 4, 1] }, // Elo -238, offered 429/250/140
    POISONED_STAB: { tiers: "FFFF", pick: [15, 3, 1] }, // Elo -331, offered 1251/750/437
    POUNCE: { tiers: "DDDD", pick: [29, 17, 9] }, // Elo -252, offered 459/247/163
    PRECISE_CUT: { tiers: "FFFF", pick: [20, 6, 1] }, // Elo -363, offered 422/248/142
    PREDATOR: { tiers: "FFFF", pick: [12, 2, 3] }, // Elo -376, offered 1321/750/401
    PREPARED: { tiers: "BBBB", pick: [39, 41, 37] }, // Elo +106, offered 1328/720/388
    REFLEX: { tiers: "BBBB", pick: [15, 30, 33] }, // Elo +4, offered 430/235/136
    RICOCHET: { tiers: "DDDD", pick: [18, 8, 5] }, // Elo -221, offered 1313/737/440
    SERPENT_FORM: { tiers: "BBBB", pick: [47, 36, 44] }, // Elo +58, offered 226/118/18
    SHADOWMELD: { tiers: "BBBB", pick: [30, 32, 30] }, // Elo +14, offered 212/110/22
    SHADOW_STEP: { tiers: "CCCC", pick: [18, 10, 16] }, // Elo -2, offered 200/135/10
    SIDESTEP: { tiers: "BBBB", pick: [33, 37, 37] }, // Elo +15, offered 501/240/146
    SKEWER: { tiers: "FFFF", pick: [8, 3, 4] }, // Elo -447, offered 439/237/144
    SLICE: { tiers: "FFFF", pick: [7, 2, 1] }, // Elo -427, offered 1338/741/412
    SNAKEBITE: { tiers: "DDDD", pick: [39, 14, 11] }, // Elo -176, offered 1313/707/429
    SPEEDSTER: { tiers: "DDDD", pick: [6, 7, 5] }, // Elo -242, offered 464/245/178
    STORM_OF_STEEL: { tiers: "CCCC", pick: [17, 15, 16] }, // Elo -12, offered 212/131/19
    STRANGLE: { tiers: "DDDD", pick: [19, 6, 4] }, // Elo -193, offered 453/217/134
    SUCKER_PUNCH: { tiers: "FFFF", pick: [13, 6, 4] }, // Elo -338, offered 1324/748/407
    TACTICIAN: { tiers: "BBBB", pick: [26, 33, 35] }, // Elo +43, offered 455/240/169
    THE_HUNT: { tiers: "DDDD", pick: [31, 16, 25] }, // Elo -191, offered 221/131/12
    TOOLS_OF_THE_TRADE: { tiers: "AAAA", pick: [52, 46, 51] }, // Elo +187, offered 214/136/18
    TRACKING: { tiers: "AAAA", pick: [35, 27, 33] }, // Elo +183, offered 219/140/21
    UNTOUCHABLE: { tiers: "DDDD", pick: [13, 17, 18] }, // Elo -164, offered 1342/791/438
    UP_MY_SLEEVE: { tiers: "CCCC", pick: [23, 11, 8] }, // Elo -5, offered 494/262/144
    WELL_LAID_PLANS: { tiers: "AAAA", pick: [51, 50, 50] }, // Elo +177, offered 232/150/22
  },
};
