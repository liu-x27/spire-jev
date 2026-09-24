/**
 * Search over this turn's play orders.
 *
 * Depth-first over every legal sequence of plays, with states that are the
 * same merged (the order of two Defends does not matter) and identical cards
 * in hand offered once. Every node is also scored as "end the turn here", so
 * the best sequence is the best place to stop as well as the best order.
 *
 * The planner only ever executes the first action and plans again, so a
 * draw — whose cards the model cannot know — ends up planned for once the
 * cards are real, not guessed at.
 */

import { type Beast, loadBestiary } from "./bestiary.ts";
import { type Action, actions, type Card, drink, type Enemy, endOfTurnRevival, formsToCome, hpLoss, play, type State, stateKey, WRIGGLER_HP } from "./sim.ts";
import { likelyIntent } from "./intents.ts";
import type { IntentObs } from "./obs.ts";
import { nextTurn, seeded } from "./turn.ts";

export interface Weights {
  /** Per point of HP the enemies' attacks will take this turn. */
  hpLoss: number;
  /** Per point of HP left on the enemies. */
  enemyHp: number;
  /** Per stack of vulnerable on a living enemy, up to 3. */
  vulnerable: number;
  /** Per stack of weak on a living, attacking enemy, up to 3. */
  weak: number;
  /** Per point of the player's strength. */
  strength: number;
  /** Per card drawn this turn and not yet known. */
  drawn: number;
  /**
   * Per point of the damage the enemies left alive are expected to deal before
   * they die (futureDamage); 0 leaves the rest of the fight out, as the first
   * version did.
   */
  future: number;
  /**
   * 1: the future counts only what gets past the block the deck makes every
   * turn (futureDamage's blockAware), so an enemy the deck out-blocks puts
   * no pressure on the fight's length; 0: all of it, as first written.
   */
  futureBlock: number;
  /**
   * What drinking a potion costs, in HP: it is gone for later fights. A
   * third of it in a fight with an enemy of 100 max HP or more (a boss or an
   * elite), and less again when the belt is full (the next one would be lost).
   */
  potion: number;
  /**
   * 1: powers in play count for what they will do in the next turns of this
   * fight (setupValue: per-turn benefit, over at most two more turns, at 0.7,
   * none if the fight ends now); 0: not at all, as the one-turn evaluation
   * had it — Feel No Pain, Vicious, Crimson Mantle sat in hand unplayed.
   */
  setup: number;
  /**
   * 1: a big enemy (80 max HP or more: elites, bosses) weighs its HP at
   * what each HP of it will cost us — its average damage a turn (the
   * bestiary's, not this turn's intent, or Dismember turns would be spent
   * hitting) over the deck's damage a turn — when that is more than
   * enemyHp; 0: every enemy at enemyHp. Vantom (A10) was blocked for five
   * turns while Slippery held; the guides strip it in the first three.
   */
  long: number;
  /**
   * 1: plan two turns (planTurn2): the best few ends of this turn are each
   * carried into the next turn — the enemies' turn, a hand drawn at random
   * from the draw pile, a few times — and judged by the best second turn
   * from there; 0: this turn only.
   */
  look: number;
  /**
   * 1: HP above the fight's safety margin (the damage still to come, over the turns the kill will
   * take, plus 10) counts at the state's hpWorth — run-fights sets it for boss fights: 0.25 in acts
   * 1 and 2 (the next Ancient heals 80% of missing HP), ~0 in the run's last fight
   * (docs/a10-combat-research.md rules 1-2); 0: every HP counts the same.
   */
  stakes: number;
  /**
   * 1: The Insatiable's Sandpit judged with a pessimistic pace (four fifths of the deck's) and a
   * turn to spare, so a Frantic Escape is worth playing unless the kill surely fits in the timer
   * (research rules 4-5); 0: the deck's pace and no margin.
   */
  sandpit2: number;
  /**
   * 1: the powers in play are worth what they will give over the turns the
   * fight has left (enginesWorth: each power's gain a turn from this deck's
   * own rates, over at most four more turns); 0: only Demon Form is, as
   * demonFormWorth. Feel No Pain stayed unplayed in 14 of 17 A10 fights that
   * ended with it in hand, Vicious 25 of 32, Crimson Mantle 9 of 11
   * (astra-review-2 #3).
   */
  engines: number;
}

/** The first version: this turn only. */
export const TURN_WEIGHTS: Weights = { hpLoss: 1, enemyHp: 0.35, vulnerable: 1.5, weak: 1.2, strength: 2, drawn: 1.5, future: 0, futureBlock: 0, potion: 10, setup: 0, long: 0, look: 0, stakes: 0, sandpit2: 0, engines: 0 };
export const DEFAULT_WEIGHTS: Weights = TURN_WEIGHTS;

/** Damage the deck deals in a turn, and per hit: the pace the rest of the fight goes at. */
export interface Pace {
  perTurn: number;
  perHit: number;
  /** Block that comes every turn without a card: Metallicize, Feel No Pain, Barricade. */
  blockPerTurn: number;
  /** Block still to come from Plating, which gives a stack less every turn. */
  blockToCome: number;
  /** Block the deck's cards make in a turn: the average card's block over half a hand (the other half attacks). */
  cardBlock: number;
}

const BESTIARY: Record<string, Beast> = loadBestiary();

const HAND = 5;

function cardDamage(c: Card): { damage: number; hits: number } {
  if (c.type !== "Attack") return { damage: 0, hits: 0 };
  const per = c.vars["Damage"] ?? c.calc?.["CalculatedDamage"] ?? c.vars["CalculationBase"] ?? 0;
  const hits = c.id === "TWIN_STRIKE" ? 2 : Math.max(1, c.vars["Repeat"] ?? 1);
  return { damage: per * hits, hits };
}

/**
 * The deck's pace, from every card still in the fight (hand, draw and discard
 * piles): the average card's damage over a five-card hand, a quarter off for
 * the energy and the blocks a turn also needs, and Strength on every hit —
 * Strength for the turn only (Setup Strike) left out.
 */
export function deckPace(s: State): Pace {
  const cards = [...s.hand, ...s.draw, ...s.discard];
  let damage = 0;
  let hits = 0;
  let block = 0;
  let blockers = 0;
  for (const c of cards) {
    const d = cardDamage(c);
    damage += d.damage;
    hits += d.hits;
    const b = c.vars["Block"] ?? 0;
    block += b;
    if (b > 0) blockers++;
  }
  const n = Math.max(1, cards.length);
  const p = s.player.powers;
  const strength = (p["STRENGTH"] ?? 0) - (p["SETUP_STRIKE"] ?? 0);
  const hitsPerTurn = (hits / n) * HAND * 0.75;
  // Powers in play work every turn: Juggernaut hits for every block gained (about one and a half a turn).
  const perTurn = Math.max(4, (damage / n) * HAND * 0.75 + strength * hitsPerTurn + (p["JUGGERNAUT"] ?? 0) * 1.5);
  const perHit = Math.max(1, (hits > 0 ? damage / hits : 6) + strength);
  // Feel No Pain blocks for every card exhausted (about one every other turn); Barricade keeps some block over.
  const blockPerTurn = (p["METALLICIZE"] ?? 0) + (p["FEEL_NO_PAIN"] ?? 0) * 0.5 + ((p["BARRICADE"] ?? 0) > 0 ? 3 : 0);
  const plating = Math.max(0, p["PLATING"] ?? 0);
  const cardBlock = (block / n) * HAND * 0.5 + (p["DEXTERITY"] ?? 0) * (blockers / n) * HAND * 0.5;
  return { perTurn, perHit, blockPerTurn, blockToCome: (plating * (plating - 1)) / 2, cardBlock: Math.max(0, cardBlock) };
}

/**
 * An enemy's damage per turn from here on: what its intents show, or what the
 * bestiary says the monster averages, whichever is more — the intent shows
 * one turn, and some turns are quiet ones. A monster the bestiary has not
 * seen, on a turn it does not attack, is guessed from its size and strength.
 */
export function threat(e: Enemy): number {
  let attack = 0;
  for (const i of e.intents) if (i.type === "Attack" || i.type === "DeathBlow") attack += i.damage * Math.max(1, i.hits);
  const seen = BESTIARY[e.model]?.perTurn;
  if (seen !== undefined) return Math.max(attack, seen);
  if (attack > 0) return attack;
  return Math.max(5, 0.12 * e.maxHp) + Math.max(0, e.powers["STRENGTH"] ?? 0);
}

/**
 * What the enemies left alive will do before they die, if the rest of the
 * fight goes at the deck's pace: each enemy's damage per turn times the turns
 * until it is dead, killing first the one that does most per turn it takes to
 * kill (Smith's rule — the order that makes the sum smallest). An enemy the
 * deck kills during a turn does not attack in it, so it attacks for half a
 * turn less than it lives: one that dies next turn does not attack again (a
 * Mawler at 7 HP was counted as 10 more damage, and the planner hit it
 * instead of blocking its 21). A stack of
 * Slippery is a hit that takes 1 HP instead of a full one; Vulnerable left
 * after this enemy turn makes those turns deal half again as much; Weak left
 * takes a quarter off those turns of its damage.
 */
export function futureDamage(s: State, pace: Pace = deckPace(s), blockAware = false): number {
  const left = s.enemies.filter((e) => e.alive).map((e) => {
    const hp = e.hp + Math.max(0, e.powers["SLIPPERY"] ?? 0) * Math.max(0, pace.perHit - 1);
    const vulnerable = Math.max(0, (e.powers["VULNERABLE"] ?? 0) - 1);
    const fast = pace.perTurn * 1.5;
    const turns = hp <= vulnerable * fast ? hp / fast : vulnerable + (hp - vulnerable * fast) / pace.perTurn;
    return { turns, perTurn: threat(e), weak: Math.max(0, (e.powers["WEAK"] ?? 0) - 1) };
  });
  left.sort((a, b) => b.perTurn / Math.max(1e-6, b.turns) - a.perTurn / Math.max(1e-6, a.turns));
  if (blockAware) {
    // Turn by turn, the enemies still alive hit for their sum and the deck's
    // block takes its share: what gets through, over each stretch between kills.
    const guard = pace.cardBlock + pace.blockPerTurn;
    let clock = 0;
    let before = 0;
    let total = 0;
    let incoming = left.reduce((a, e) => a + e.perTurn, 0);
    for (const e of left) {
      clock += e.turns;
      const attacks = Math.max(0, clock - 0.5);
      total += (attacks - before) * Math.max(0, incoming - guard);
      before = attacks;
      incoming -= e.perTurn;
    }
    return Math.max(0, total - Math.min(pace.blockToCome, total));
  }
  let clock = 0;
  let total = 0;
  for (const e of left) {
    clock += e.turns;
    const attacks = Math.max(0, clock - 0.5);
    total += e.perTurn * attacks - 0.25 * e.perTurn * Math.min(e.weak, attacks);
  }
  // Block that comes on its own takes its share, over as many turns as the fight has left.
  return Math.max(0, total - pace.blockPerTurn * clock - Math.min(pace.blockToCome, total));
}

const WIN = 1e6;
/** What a turn of Sandpit short of the kill costs, in HP. */
const SANDPIT_TURN = 20;

/**
 * A killed Waterfall Giant's DeathBlow due at the end of next turn (the one due at this turn's end
 * is in hpLoss), less the block a whole hand of the deck makes when nothing is left to attack:
 * Weak that outlasts the enemies' turn takes a quarter off.
 */
function blowToCome(s: State): number {
  let total = 0;
  for (const e of s.enemies) {
    if (e.alive || e.blowNow || (e.deathBlow ?? 0) <= 0) continue;
    const pace = deckPace(s);
    const guard = 2 * pace.cardBlock + pace.blockPerTurn + Math.max(0, (s.player.powers["PLATING"] ?? 0) - 1);
    total += Math.max(0, Math.floor(e.deathBlow! * ((e.powers["WEAK"] ?? 0) >= 2 ? 0.75 : 1)) - guard);
  }
  return total;
}

/** How good it is to end the turn in state `s`. */
export function evaluate(s: State, w: Weights = DEFAULT_WEIGHTS): number {
  const alive = s.enemies.filter((e) => e.alive);
  // Dying to one's own card (Offering, Hemokinesis at low HP, Thorns) is no win.
  if (s.player.hp <= 0) return -WIN * 2;
  // A second life the turn already spent (a card's HP cost into Lizard Tail, sim.ts loseHp) costs
  // what one spent at the end of the turn does.
  const spent = (s.revivals ?? 0) * REVIVE_COST * s.player.maxHp;
  // Nothing alive, but a killed Waterfall Giant still to strike: the win is living through it.
  const blows = s.enemies.some((e) => !e.alive && (e.deathBlow ?? 0) > 0);
  // Nothing alive, but a Test Subject to respawn: no win, the next form's HP still to take.
  const reviving = s.enemies.some((e) => !e.alive && (e.revive ?? 0) > 0);
  if (alive.length === 0 && !blows && !reviving) return WIN + (s.player.hp - spent) * 10;
  // The Test Subject's forms to come count with its HP (sim.ts formsToCome), so a kill is worth what
  // it took and no more. sleep: damage into a Lagavulin Matriarch asleep for two more turns is worth
  // nothing (her HP as it was), and waking her costs WAKE_COST.
  let enemyHp = alive.reduce((a, e) => a + e.hp, 0) + s.enemies.reduce((a, e) => a + formsToCome(e), 0);
  let woken = 0;
  if (bossRules.sleep) {
    for (const e of s.enemies) {
      if (!e.asleep || e.asleep.turns < 2) continue;
      enemyHp += Math.max(0, e.asleep.hp - e.hp);
      if (e.alive && (e.powers["ASLEEP"] ?? 0) <= 0) woken++;
    }
  }
  const loss = hpLoss(s);
  // A death this turn is the end only with nothing to bring the player back (seed 17's Queen fight:
  // the model saw a certain death on turn 5, and Lizard Tail won it). The revival is worth its HP,
  // less what the relic or potion would have been worth later.
  let hpLeft = s.player.hp - loss;
  if (hpLeft <= 0) {
    const back = endOfTurnRevival(s);
    if (back === undefined) return -WIN - enemyHp;
    hpLeft = back.hp - REVIVE_COST * s.player.maxHp;
  }
  hpLeft -= spent + woken * WAKE_COST;
  if (alive.length === 0 && !reviving) {
    // The blow lands this turn and the player lives: won. It lands next turn: as good as won, by
    // how much HP it leaves (a blow that looks lethal still depends on next turn's draw).
    // A potion costs what it does elsewhere, on this scale of 10 a point of HP.
    const pending = s.enemies.some((e) => !e.alive && !e.blowNow && (e.deathBlow ?? 0) > 0);
    return (pending ? WIN / 2 + (hpLeft - blowToCome(s)) * 10 : WIN + hpLeft * 10) - s.potionsUsed * potionCost(s, w) * 10;
  }
  if (blows) hpLeft -= blowToCome(s);
  // wghp: HP the Giant's blow will need, counted twice while short of it.
  if (giantMargin && giantAlive(s)) hpLeft -= Math.max(0, giantBlowAhead(s) - hpLeft);

  // A stack of Slippery (Vantom) is a hit that will take 1 HP instead of a
  // full one: count it as the HP it hides, so stripping it is worth playing.
  const slippery = alive.reduce((a, e) => a + Math.max(0, e.powers["SLIPPERY"] ?? 0), 0);
  // An Infested Phrog Parasite's Wrigglers are HP still to take once it dies: counted from the start,
  // so killing it is not a sudden rise in the enemies' HP the planner would shy from.
  const infested = alive.reduce((a, e) => a + Math.max(0, e.powers["INFESTED"] ?? 0), 0) * WRIGGLER_HP;
  const hidden = (slippery > 0 ? slippery * Math.max(0, deckPace(s).perHit - 1) : 0) + infested;
  const extra = w.long > 0 ? longFightExtra(s, alive, w) : 0;
  // HP at the end of the turn, after the enemies: what the cards spent (Offering, Hemokinesis,
  // Corrupted, Thorns) counts as much as what the enemies take. (Only the end of turn's loss was
  // charged: a state at 70 HP and one at 10 scored the same.) Root HP is the same for every line.
  let score = hpValue(s, hpLeft, alive, w) * w.hpLoss - (enemyHp + hidden) * w.enemyHp - extra - s.potionsUsed * potionCost(s, w);
  if (w.future > 0) score -= futureDamage(s, deckPace(s), w.futureBlock > 0) * w.future;
  for (const e of alive) {
    score += Math.min(3, e.powers["VULNERABLE"] ?? 0) * w.vulnerable;
    const attacking = e.intents.some((i) => i.type === "Attack");
    if (attacking) score += Math.min(3, e.powers["WEAK"] ?? 0) * w.weak;
  }
  score += (s.player.powers["STRENGTH"] ?? 0) * w.strength;
  const demon = s.player.powers["DEMON_FORM"] ?? 0;
  if (demon > 0) score += demon * demonFormWorth(s, w);
  if (w.engines > 0) score += enginesWorth(s, w) * w.engines;
  if (w.setup > 0) score += setupValue(s) * w.setup;
  score += s.drawn * w.drawn;
  // Sandpit (The Insatiable) devours the player when it runs out, and only
  // Frantic Escape winds it back: every turn short of the turns the deck needs
  // to kill it is a Frantic Escape still to find. Without this a turn-only
  // planner keeps the escape until the last turn, and dies holding it.
  const pits = alive.filter((e) => (e.powers["SANDPIT"] ?? 0) > 0);
  if (pits.length > 0) {
    const pace = deckPace(s).perTurn;
    for (const e of pits) {
      const sandpit = e.powers["SANDPIT"] ?? 0;
      score -= w.sandpit2 > 0
        ? SANDPIT_TURN * Math.max(0, e.hp / (0.8 * pace) - (sandpit - 1))
        : SANDPIT_TURN * Math.max(0, e.hp / pace - sandpit);
    }
  }
  return score;
}

/**
 * What `long` adds to the enemies' HP's cost: for each big enemy, its HP
 * (Slippery's too) at the weight above enemyHp. Big by max HP, which a fight
 * does not change: a threshold on HP left would pay for crossing it.
 */
function longFightExtra(s: State, alive: readonly Enemy[], w: Weights): number {
  const pace = deckPace(s);
  let extra = 0;
  for (const e of alive) {
    const seen = BESTIARY[e.model]?.perTurn;
    if (seen === undefined || e.maxHp < 80) continue;
    const hp = e.hp + Math.max(0, e.powers["SLIPPERY"] ?? 0) * Math.max(0, pace.perHit - 1);
    const weight = Math.min(1.5, (w.long * seen) / pace.perTurn);
    if (weight > w.enemyHp) extra += hp * (weight - w.enemyHp);
  }
  return extra;
}

/**
 * What a stack of Demon Form in play is worth: a Strength on every hit of every
 * turn still to come, one more each turn — over the turns the fight will
 * likely last after this one (the enemies' HP at the deck's pace, at most
 * four), at enemyHp's rate, and never less than a turn of Strength. Valued
 * at one turn's Strength (e00d275) the one-turn planner held it: seed 17,
 * the first A0 clear, replayed on that code never played it in five fights
 * and died on floor 22.
 */
function demonFormWorth(s: State, w: Weights): number {
  const alive = s.enemies.filter((e) => e.alive);
  if (alive.length === 0) return 0;
  const pace = deckPace(s);
  const turns = Math.min(4, Math.max(0, alive.reduce((a, e) => a + e.hp, 0) / Math.max(1, pace.perTurn) - 1));
  const hitsPerTurn = pace.perTurn / Math.max(1, pace.perHit);
  // Turn k after this one has k stacks' Strength: 1 + 2 + ... + turns.
  const strengthHits = ((turns * (turns + 1)) / 2) * hitsPerTurn;
  return Math.max(w.strength, strengthHits * w.enemyHp);
}

/** Turns the fight will likely last after this one: the enemies' HP at the deck's pace, at most four. */
function turnsAfter(s: State): number {
  const alive = s.enemies.filter((e) => e.alive);
  if (alive.length === 0) return 0;
  const pace = deckPace(s);
  return Math.min(4, Math.max(0, alive.reduce((a, e) => a + e.hp, 0) / Math.max(1, pace.perTurn) - 1));
}

const EXHAUST_IDS = new Set(["TRUE_GRIT", "BURNING_PACT", "SECOND_WIND", "FIEND_FIRE", "STOKE", "BRAND", "CINDER", "THRASH", "HAVOC"]);
const VULNERABLE_IDS = new Set(["BASH", "TREMBLE", "TAUNT", "UPPERCUT", "THUNDERCLAP", "MOLTEN_FIST", "DOMINATE", "BREAK"]);

/**
 * What the powers in play (Demon Form apart) will give in the turns this
 * fight has left, from the deck's own rates: the share of the cards still in
 * the fight that trigger each, times a hand of five.
 */
export function enginesWorth(s: State, w: Weights): number {
  const turns = turnsAfter(s);
  if (turns <= 0) return 0;
  const cards = [...s.hand, ...s.draw, ...s.discard];
  const n = Math.max(1, cards.length);
  const perHand = (test: (c: Card) => boolean) => (cards.filter(test).length / n) * 5;
  const exhausts = perHand((c) => c.keywords.includes("Exhaust") || EXHAUST_IDS.has(c.id) || c.type === "Status" || c.type === "Curse");
  const vulnerables = perHand((c) => VULNERABLE_IDS.has(c.id));
  const selfDamage = perHand((c) => (c.vars["HpLoss"] ?? 0) > 0);
  const blockers = perHand((c) => (c.vars["Block"] ?? 0) > 0);
  const pace = deckPace(s);
  const hits = pace.perTurn / Math.max(1, pace.perHit);
  const p = s.player.powers;
  let perTurn = 0;
  perTurn += (p["FEEL_NO_PAIN"] ?? 0) * exhausts * 0.7; // block, about 70% of it wanted
  perTurn += Math.max(0, (p["CRIMSON_MANTLE"] ?? 0) * 0.8 - (p["CRIMSON_MANTLE"] ? 1 : 0)); // block every turn, for 1 HP
  perTurn += (p["METALLICIZE"] ?? 0) * 0.8;
  perTurn += (p["BARRICADE"] ?? 0) > 0 ? 3 : 0;
  perTurn += (p["VICIOUS"] ?? 0) * vulnerables * w.drawn;
  perTurn += (p["DARK_EMBRACE"] ?? 0) * exhausts * w.drawn;
  perTurn += (p["RUPTURE"] ?? 0) * selfDamage * hits * w.enemyHp;
  perTurn += (p["JUGGERNAUT"] ?? 0) * blockers * w.enemyHp;
  return Math.min(40, perTurn * turns);
}

/**
 * HP as the evaluation counts it: all of it, or with weights.stakes, the HP up to the fight's safety
 * margin in full and what is above it at s.hpWorth.
 */
function hpValue(s: State, hpLeft: number, _alive: readonly Enemy[], w: Weights): number {
  if (w.stakes <= 0 || s.hpWorth === undefined || hpLeft <= 0) return hpLeft;
  const { worth, margin } = s.hpWorth;
  return Math.min(hpLeft, margin) + Math.max(0, hpLeft - margin) * worth;
}

/** The HP a fight still needs: the damage to come over the turns the kill will take, plus 10 (research rule 1). */
export function safetyMargin(s: State): number {
  const alive = s.enemies.filter((e) => e.alive);
  const pace = deckPace(s);
  const turns = Math.max(1, alive.reduce((a, e) => a + e.hp, 0) / Math.max(1, pace.perTurn));
  const incoming = alive.reduce((a, e) => a + threat(e), 0);
  return Math.min(s.player.maxHp, turns * incoming + 10);
}

/** What a second life costs, as a share of max HP: the Lizard Tail or Fairy in a Bottle is gone. */
const REVIVE_COST = 0.3;

/** The HP a death would leave, if something brings the player back (sim.ts revivalFor, in the game's order). */
export function revival(s: State): number | undefined {
  return endOfTurnRevival(s)?.hp;
}

/**
 * The Waterfall Giant's DeathBlow (sim.ts) decides its fight after the kill: of the 14 losses in the
 * 21 replays from before it (bench-unl-wg2-f16), 9 killed it and died to the blow (41-56), their
 * hand that turn all attacks, their potions drunk on turn 1. --flags wgpot: potions are worth five
 * times as much while it lives (the blow's turn is where a Block, Weak or draw potion wins the
 * fight); --flags wghp: HP under the blow it will strike counts twice.
 */
let giantPotions = false;
let giantMargin = false;
export function useGiantRules(potions: boolean, margin: boolean): void {
  giantPotions = potions;
  giantMargin = margin;
}

/**
 * --flags sleep: a Lagavulin Matriarch asleep for two more enemy turns is left asleep (IL:
 * AsleepPower). Woken by damage she is stunned a turn and then runs her cycle; asleep she wakes by
 * herself after her third turn. Either way she acts the same number of turns before the kill, so
 * waking her early buys nothing, and the turns she sleeps are free ones for the player's powers.
 */
const bossRules = { sleep: false };
export function useBossRules(rules: { sleep: boolean }): void {
  bossRules.sleep = rules.sleep;
}
/** sleep: what waking the Matriarch early costs, in HP: a tie-break toward letting her sleep. */
const WAKE_COST = 6;
const giantAlive = (s: State) => s.enemies.some((e) => e.alive && e.model === "WATERFALL_GIANT");

/**
 * The DeathBlow a living Waterfall Giant will strike, less a hand's block: its Steam Eruption grows
 * 3 a turn (20 on turn 2) over the turns the deck needs to kill it.
 */
export function giantBlowAhead(s: State): number {
  const giant = s.enemies.find((e) => e.alive && e.model === "WATERFALL_GIANT");
  if (!giant) return 0;
  const pace = deckPace(s);
  const steam = giant.powers["STEAM_ERUPTION"] ?? 17;
  const turns = Math.max(0, Math.ceil(giant.hp / Math.max(1, pace.perTurn)) - 1);
  return Math.max(0, steam + 3 * turns - (2 * pace.cardBlock + pace.blockPerTurn));
}

function potionCost(s: State, w: Weights): number {
  const big = s.enemies.some((e) => e.maxHp >= 100);
  const full = s.potions.length + s.potionsUsed >= s.potionSlots;
  return w.potion * (big ? 0.3 : 1) * (full ? 0.6 : 1) * (giantPotions && giantAlive(s) ? 5 : 1);
}

/**
 * What the powers in play are worth for the rest of this fight, in HP: each
 * power's benefit per turn (block, or damage and cards at the evaluation's
 * own rates), over the turns after this one that the fight will likely last —
 * at most two, discounted 0.7 — so a power played in the last turn of a
 * fight is worth nothing.
 */
export function setupValue(s: State): number {
  const alive = s.enemies.filter((e) => e.alive);
  if (alive.length === 0) return 0;
  const pace = deckPace(s);
  const turnsLeft = alive.reduce((a, e) => a + e.hp, 0) / Math.max(1, pace.perTurn);
  const horizon = Math.min(2, Math.max(0, turnsLeft - 1)) * 0.7;
  if (horizon <= 0) return 0;
  const p = s.player.powers;
  const damage = 0.35; // an HP of enemy damage, as enemyHp weighs it
  let perTurn = 0;
  perTurn += (p["FEEL_NO_PAIN"] ?? 0) * 0.5; // about one card exhausted every other turn
  perTurn += (p["METALLICIZE"] ?? 0) + (p["PLATING"] ?? 0) * 0.5;
  perTurn += (p["CRIMSON_MANTLE"] ?? 0) - (p["CRIMSON_MANTLE"] ? 1 : 0); // block every turn, for 1 HP
  perTurn += (p["BARRICADE"] ?? 0) > 0 ? 3 : 0;
  perTurn += (p["JUGGERNAUT"] ?? 0) * 1.5 * damage;
  perTurn += (p["DEMON_FORM"] ?? 0) * 2.5 * damage * 1.5; // Strength on every hit, growing
  perTurn += (p["VICIOUS"] ?? 0) * 0.5 * 1.5; // a card for every Vulnerable applied, about every other turn
  perTurn += (p["DARK_EMBRACE"] ?? 0) * 0.5 * 1.5;
  perTurn += (p["RUPTURE"] ?? 0) * 0.3 * 2.5 * damage;
  return Math.min(30, perTurn * horizon);
}

export interface Plan {
  actions: Action[];
  score: number;
  /** States expanded. */
  nodes: number;
  ms: number;
  /** The node cap was hit before every order was tried. */
  truncated: boolean;
  /** Every card on the chosen line was modelled exactly. */
  exact: boolean;
}

interface Line {
  score: number;
  actions: Action[];
  exact: boolean;
  state: State;
}

/** Every play order from `start`, equal states merged; the best line, and the best `keep` distinct ends. */
function explore(start: State, w: Weights, maxNodes: number, keep: number): { best: Line; top: Line[]; nodes: number; truncated: boolean } {
  let nodes = 0;
  let truncated = false;
  let best: Line = { score: -Infinity, actions: [{ kind: "end" }], exact: true, state: start };
  const top: Line[] = [];
  const seen = new Set<string>([stateKey(start)]);

  const visit = (s: State, path: Action[]): void => {
    nodes++;
    const here = evaluate(s, w);
    if (here > best.score) best = { score: here, actions: [...path, { kind: "end" }], exact: s.exact, state: s };
    if (keep > 0 && (top.length < keep || here > top[top.length - 1]!.score)) {
      top.push({ score: here, actions: [...path, { kind: "end" }], exact: s.exact, state: s });
      top.sort((a, b) => b.score - a.score);
      if (top.length > keep) top.pop();
    }
    // Everything is dead: nothing left to plan. Not while a killed Waterfall Giant's DeathBlow is to
    // come: living through it scores as a win already, and more block is still more HP (the first
    // replays ended the blow's turn at once, 10-24 HP worse off).
    if (here >= WIN && !s.enemies.some((e) => e.alive || (e.deathBlow ?? 0) > 0)) return;
    if (nodes >= maxNodes) {
      truncated = true;
      return;
    }
    for (const a of actions(s)) {
      if (a.kind === "end") continue;
      const next = a.kind === "potion" ? drink(s, a) : play(s, a);
      const key = stateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      visit(next, [...path, a]);
      if (truncated) return;
    }
  };
  visit(start, []);
  return { best, top, nodes, truncated };
}

/**
 * Exploration, as a player uses save and load to try other lines: usually the
 * best line, but with probability `p` one of the other ends within `margin`
 * points of it, drawn with `rng` (seeded, so an exploration can be replayed).
 * bench.ts --explore runs the same boss fight under several seeds; the lines
 * that won where the plain planner lost show what its evaluation misjudges.
 */
export function planTurnExplore(start: State, w: Weights, rng: () => number, p = 0.15, margin = 5, maxNodes = 20_000): Plan {
  const t0 = performance.now();
  const { best, top, nodes, truncated } = explore(start, w, maxNodes, 4);
  let chosen = best;
  const close = top.filter((l) => l !== best && l.score > -WIN && l.score >= best.score - margin && l.actions[0] && actionKey(l.actions[0]) !== actionKey(best.actions[0]!));
  if (close.length > 0 && rng() < p) chosen = close[Math.floor(rng() * close.length)]!;
  return { actions: chosen.actions, score: chosen.score, exact: chosen.exact, nodes, ms: performance.now() - t0, truncated };
}

const actionKey = (a: Action) => (a.kind === "end" ? "end" : a.kind === "potion" ? `p${a.slot}:${a.target ?? ""}` : `c${a.hand}:${a.target ?? ""}`);

export function planTurn(start: State, w: Weights = DEFAULT_WEIGHTS, maxNodes = 20_000): Plan {
  const t0 = performance.now();
  const { best, nodes, truncated } = explore(start, w, maxNodes, 0);
  return { actions: best.actions, score: best.score, exact: best.exact, nodes, ms: performance.now() - t0, truncated };
}

/** How many ends of this turn the lookahead carries on, and how many hands it draws for each. */
const LOOK_ENDS = 4;
const LOOK_DRAWS = 4;
const LOOK_NODES = 3000;

/** A number from a state, to seed its draws: the same state draws the same hands. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** What an enemy will hit for next turn, as the lookahead guesses it: its bestiary average, else its threat. */
export const expectedAttack = (e: Enemy): number => BESTIARY[e.model]?.perTurn ?? threat(e);

/**
 * What an enemy will show on `turn`: what the logs say it shows then (intents.ts, for monsters
 * with a set script, like Vantom's), else one attack of its expected damage.
 */
export function expectedIntents(e: Enemy, turn: number): IntentObs[] {
  const known = likelyIntent(e.model, turn);
  if (known) return known;
  const damage = Math.max(0, Math.round(expectedAttack(e)));
  return damage > 0 ? [{ type: "Attack", damage, hits: 1 }] : [{ type: "Buff", damage: 0, hits: 0 }];
}

/**
 * Two turns (weights.look): the best ends of this turn by the one-turn
 * evaluation, each judged by the mean over a few random hands of the best
 * next turn from it (turn.ts nextTurn: the enemies attack for their average,
 * the hand is drawn from the draw pile's contents). A turn that wins or
 * loses the fight keeps its own score.
 */
export function planTurn2(start: State, w: Weights = DEFAULT_WEIGHTS, maxNodes = 20_000): Plan {
  const t0 = performance.now();
  const { best, top, nodes, truncated } = explore(start, w, maxNodes, LOOK_ENDS);
  let nodesAll = nodes;
  let chosen = best;
  let chosenValue = -Infinity;
  for (const line of top) {
    let value: number;
    if (line.score >= WIN || line.score <= -WIN) value = line.score;
    else {
      let sum = 0;
      const seed = hash(stateKey(line.state));
      for (let i = 0; i < LOOK_DRAWS; i++) {
        const next = nextTurn(line.state, seeded(seed + i * 7919), expectedIntents);
        if (!next) {
          sum += -WIN;
          continue;
        }
        const second = explore(next, w, LOOK_NODES, 0);
        nodesAll += second.nodes;
        sum += second.best.score;
      }
      value = sum / LOOK_DRAWS;
    }
    if (value > chosenValue) {
      chosenValue = value;
      chosen = line;
    }
  }
  return { actions: chosen.actions, score: chosenValue, exact: chosen.exact, nodes: nodesAll, ms: performance.now() - t0, truncated };
}

/** The bridge's id for an action, against the current hand's indices. */
export function actionId(a: Action): string {
  if (a.kind === "end") return "end_turn";
  // A potion drunk on the player needs the player's combat id, which the runner reads off the legal actions.
  if (a.kind === "potion") return a.target === undefined ? `use_potion:${a.slot}` : `use_potion:${a.slot}:target:${a.target}`;
  return a.target === undefined ? `play_card:${a.hand}` : `play_card:${a.hand}:target:${a.target}`;
}
