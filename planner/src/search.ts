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
import { type Action, actions, type Card, drink, type Enemy, hpLoss, play, type State, stateKey } from "./sim.ts";

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
}

/** The first version: this turn only. */
export const TURN_WEIGHTS: Weights = { hpLoss: 1, enemyHp: 0.35, vulnerable: 1.5, weak: 1.2, strength: 2, drawn: 1.5, future: 0, futureBlock: 0, potion: 10, setup: 0 };
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

/** How good it is to end the turn in state `s`. */
export function evaluate(s: State, w: Weights = DEFAULT_WEIGHTS): number {
  const alive = s.enemies.filter((e) => e.alive);
  // Dying to one's own card (Offering, Hemokinesis at low HP, Thorns) is no win.
  if (s.player.hp <= 0) return -WIN * 2;
  if (alive.length === 0) return WIN + s.player.hp * 10;
  const enemyHp = alive.reduce((a, e) => a + e.hp, 0);
  const loss = hpLoss(s);
  if (loss >= s.player.hp) return -WIN - enemyHp;

  // A stack of Slippery (Vantom) is a hit that will take 1 HP instead of a
  // full one: count it as the HP it hides, so stripping it is worth playing.
  const slippery = alive.reduce((a, e) => a + Math.max(0, e.powers["SLIPPERY"] ?? 0), 0);
  const hidden = slippery > 0 ? slippery * Math.max(0, deckPace(s).perHit - 1) : 0;
  // HP at the end of the turn, after the enemies: what the cards spent (Offering, Hemokinesis,
  // Corrupted, Thorns) counts as much as what the enemies take. (Only the end of turn's loss was
  // charged: a state at 70 HP and one at 10 scored the same.) Root HP is the same for every line.
  let score = (s.player.hp - loss) * w.hpLoss - (enemyHp + hidden) * w.enemyHp - s.potionsUsed * potionCost(s, w);
  if (w.future > 0) score -= futureDamage(s, deckPace(s), w.futureBlock > 0) * w.future;
  for (const e of alive) {
    score += Math.min(3, e.powers["VULNERABLE"] ?? 0) * w.vulnerable;
    const attacking = e.intents.some((i) => i.type === "Attack");
    if (attacking) score += Math.min(3, e.powers["WEAK"] ?? 0) * w.weak;
  }
  score += (s.player.powers["STRENGTH"] ?? 0) * w.strength;
  if (w.setup > 0) score += setupValue(s) * w.setup;
  score += s.drawn * w.drawn;
  // Sandpit (The Insatiable) devours the player when it runs out, and only
  // Frantic Escape winds it back: every turn short of the turns the deck needs
  // to kill it is a Frantic Escape still to find. Without this a turn-only
  // planner keeps the escape until the last turn, and dies holding it.
  const pits = alive.filter((e) => (e.powers["SANDPIT"] ?? 0) > 0);
  if (pits.length > 0) {
    const pace = deckPace(s).perTurn;
    for (const e of pits) score -= SANDPIT_TURN * Math.max(0, e.hp / pace - (e.powers["SANDPIT"] ?? 0));
  }
  return score;
}

function potionCost(s: State, w: Weights): number {
  const big = s.enemies.some((e) => e.maxHp >= 100);
  const full = s.potions.length + s.potionsUsed >= s.potionSlots;
  return w.potion * (big ? 0.3 : 1) * (full ? 0.6 : 1);
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

export function planTurn(start: State, w: Weights = DEFAULT_WEIGHTS, maxNodes = 20_000): Plan {
  const t0 = performance.now();
  let nodes = 0;
  let truncated = false;
  let best: { score: number; actions: Action[]; exact: boolean } = { score: -Infinity, actions: [{ kind: "end" }], exact: true };
  const seen = new Set<string>([stateKey(start)]);

  const visit = (s: State, path: Action[]): void => {
    nodes++;
    const here = evaluate(s, w);
    if (here > best.score) best = { score: here, actions: [...path, { kind: "end" }], exact: s.exact };
    if (here >= WIN) return; // everything is dead; nothing left to plan
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
  return { ...best, nodes, ms: performance.now() - t0, truncated };
}

/** The bridge's id for an action, against the current hand's indices. */
export function actionId(a: Action): string {
  if (a.kind === "end") return "end_turn";
  // A potion drunk on the player needs the player's combat id, which the runner reads off the legal actions.
  if (a.kind === "potion") return a.target === undefined ? `use_potion:${a.slot}` : `use_potion:${a.slot}:target:${a.target}`;
  return a.target === undefined ? `play_card:${a.hand}` : `play_card:${a.hand}:target:${a.target}`;
}
