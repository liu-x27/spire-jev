/**
 * A fast, deterministic model of the player's turn — what search runs on.
 *
 * It is not the game. It models what a card does from the numbers the bridge
 * reports (its dynamic variables: Damage, Block, Vulnerable, Cards …), with
 * the standard modifiers, and it is checked against the game card by card
 * (see differential.ts): every mismatch is either a card that needs its own
 * rule or a modifier this gets wrong. A card whose effect it cannot know from
 * its numbers — random targets, X costs — is played approximately, and the
 * state says so.
 *
 * Draws are unknown: a card that draws adds to `drawn`, not to the hand, and
 * the planner replans once the real cards are in hand.
 */

import type { CardObs, IntentObs, Observation } from "./obs.ts";

export interface Card {
  id: string;
  cost: number;
  costsX: boolean;
  type: string;
  target: string;
  keywords: readonly string[];
  vars: Readonly<Record<string, number>>;
  upgrades: number;
  /** The game refuses it this turn though it is affordable: a condition the model does not know. */
  locked: boolean;
}

export interface Unit {
  hp: number;
  maxHp: number;
  block: number;
  /** Normalised power ids: VULNERABLE, WEAK, STRENGTH, DEXTERITY, FRAIL, … */
  powers: Record<string, number>;
  /** A power's own numbers, where the game reports them: SHRINK → { DamageDecrease: 30 }. */
  powerVars?: Record<string, Record<string, number>>;
}

export interface Enemy extends Unit {
  id: number;
  model: string;
  alive: boolean;
  intents: readonly IntentObs[];
  /** Weak at the start of the turn: the intent damage already includes it. */
  weakAtStart: boolean;
}

export interface State {
  player: Unit;
  energy: number;
  hand: Card[];
  draw: Card[];
  discard: Card[];
  exhaust: Card[];
  enemies: Enemy[];
  /** Cards drawn this turn that the model cannot know yet. */
  drawn: number;
  /** False once a card was played whose effect was approximated. */
  exact: boolean;
}

export type Action = { kind: "play"; hand: number; target?: number } | { kind: "end" };

/** "VulnerablePower", "VULNERABLE_POWER", "vulnerable" → "VULNERABLE". */
export function powerKey(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toUpperCase()
    .replace(/_?POWER$/, "");
}

function powersOf<T>(raw: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(raw)) out[powerKey(k)] = v;
  return out;
}

/** `energy` only for the hand: pile cards are never asked whether they can be played. */
function cardOf(c: CardObs, energy?: number): Card {
  return {
    id: c.card_id,
    cost: c.current_cost,
    costsX: c.costs_x,
    type: c.card_type,
    target: c.target_type,
    keywords: c.keywords,
    vars: c.vars,
    upgrades: c.upgrades,
    locked: energy !== undefined && !c.can_play && (c.costs_x || c.current_cost <= energy),
  };
}

export function fromObservation(obs: Observation): State {
  const c = obs.combat;
  if (!c) throw new Error("not in combat");
  return {
    player: {
      hp: obs.player_hp, maxHp: obs.player_max_hp, block: obs.player_block,
      powers: powersOf(obs.player_powers), powerVars: powersOf(obs.player_power_vars ?? {}),
    },
    energy: obs.player_energy,
    hand: c.hand.map((card) => cardOf(card, obs.player_energy)),
    draw: c.draw_pile.map((card) => cardOf(card)),
    discard: c.discard_pile.map((card) => cardOf(card)),
    exhaust: c.exhaust_pile.map((card) => cardOf(card)),
    enemies: c.enemies.map((e) => {
      const powers = powersOf(e.powers);
      return {
        id: e.combat_id,
        model: e.model_id,
        hp: e.hp,
        maxHp: e.max_hp,
        block: e.block,
        alive: e.is_alive && e.hp > 0,
        intents: e.intents,
        powers,
        powerVars: powersOf(e.power_vars ?? {}),
        weakAtStart: (powers["WEAK"] ?? 0) > 0,
      };
    }),
    drawn: 0,
    exact: true,
  };
}

function clone(s: State): State {
  return {
    player: { ...s.player, powers: { ...s.player.powers } },
    energy: s.energy,
    hand: s.hand.slice(),
    draw: s.draw.slice(),
    discard: s.discard.slice(),
    exhaust: s.exhaust.slice(),
    // powerVars are shared: nothing in a turn changes a power's own numbers.
    enemies: s.enemies.map((e) => ({ ...e, powers: { ...e.powers } })),
    drawn: s.drawn,
    exact: s.exact,
  };
}

const has = (u: Unit, p: string) => (u.powers[p] ?? 0) > 0;
/** Shrink shows an amount of -1: it is on for as long as it is there at all. */
const present = (u: Unit, p: string) => (u.powers[p] ?? 0) !== 0;
const powerVar = (u: Unit, p: string, name: string, fallback: number) => u.powerVars?.[p]?.[name] ?? fallback;
const addPower = (u: Unit, p: string, n: number) => {
  u.powers[p] = (u.powers[p] ?? 0) + n;
};

/**
 * Attack damage from `attacker` to `target`: strength added, then every
 * multiplier, rounded down once at the end (Shrink and Vulnerable together:
 * 6 x 1.5 x 0.7 = 6.3, and the game dealt 6).
 */
export function attackDamage(base: number, attacker: Unit, target: Unit): number {
  let d = base + (attacker.powers["STRENGTH"] ?? 0);
  if (has(attacker, "WEAK")) d *= 0.75;
  // Shrink (Shrinker Beetle): the owner's attacks deal DamageDecrease percent less.
  if (present(attacker, "SHRINK")) d *= 1 - powerVar(attacker, "SHRINK", "DamageDecrease", 30) / 100;
  if (has(target, "VULNERABLE")) d *= powerVar(target, "VULNERABLE", "DamageIncrease", 1.5);
  return Math.max(0, Math.floor(d));
}

export function blockGain(base: number, u: Unit): number {
  let b = base + (u.powers["DEXTERITY"] ?? 0);
  if (has(u, "FRAIL")) b *= 0.75;
  return Math.max(0, Math.floor(b));
}

function hit(target: Enemy, damage: number): void {
  const absorbed = Math.min(target.block, damage);
  target.block -= absorbed;
  let lost = damage - absorbed;
  // Slippery (Inklet): a hit takes at most 1 HP, and uses up a stack.
  if (lost > 0 && has(target, "SLIPPERY")) {
    lost = 1;
    addPower(target, "SLIPPERY", -1);
  }
  target.hp -= lost;
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
  }
}

/** A card the model can play at all, given its cost and keywords. */
export function playable(s: State, card: Card): boolean {
  if (card.locked || card.keywords.includes("Unplayable")) return false;
  if (card.type === "Status" || card.type === "Curse") return false;
  return card.costsX || card.cost <= s.energy;
}

export function needsTarget(card: Card): boolean {
  return card.target === "AnyEnemy";
}

/** Every legal play from `s`, and ending the turn. */
export function actions(s: State): Action[] {
  const out: Action[] = [];
  const seen = new Set<string>();
  s.hand.forEach((card, i) => {
    if (!playable(s, card)) return;
    // Identical cards give identical successors: offer only the first.
    const sig = `${card.id}/${card.upgrades}/${card.cost}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    if (needsTarget(card)) {
      for (const e of s.enemies) if (e.alive) out.push({ kind: "play", hand: i, target: e.id });
    } else {
      out.push({ kind: "play", hand: i });
    }
  });
  out.push({ kind: "end" });
  return out;
}

/** Cards whose effect is not what their numbers say, with their own rules. */
const SPECIAL: Record<string, (s: State, card: Card, target: Enemy | undefined) => void> = {};

export function play(s0: State, a: Action & { kind: "play" }): State {
  const s = clone(s0);
  const card = s.hand[a.hand];
  if (!card) throw new Error(`no card at hand index ${a.hand}`);
  s.hand.splice(a.hand, 1);

  const x = card.costsX ? s.energy : 0;
  s.energy -= card.costsX ? s.energy : card.cost;
  const target = a.target === undefined ? undefined : s.enemies.find((e) => e.id === a.target);
  const v = card.vars;

  const special = SPECIAL[card.id];
  if (special) {
    special(s, card, target);
  } else {
    if (card.costsX || card.target === "RandomEnemy") s.exact = false;
    const repeat = (v["Repeat"] ?? 1) * (card.costsX ? x : 1);

    const victims = card.target === "AllEnemies" ? s.enemies.filter((e) => e.alive)
      : card.target === "RandomEnemy" ? s.enemies.filter((e) => e.alive).slice(0, 1)
      : target ? [target] : [];

    if (v["Damage"] !== undefined && card.type === "Attack") {
      for (let r = 0; r < repeat; r++) {
        for (const e of victims) if (e.alive) hit(e, attackDamage(v["Damage"], s.player, e));
      }
    }
    if (v["Block"] !== undefined) s.player.block += blockGain(v["Block"], s.player);

    // Debuffs go on whoever the card targets; a self-targeted card's powers
    // are the player's own (Inflame's Strength).
    for (const [name, n] of Object.entries(v)) {
      const key = powerKey(name);
      if (!name.endsWith("Power")) continue;
      if (card.target === "Self" || card.target === "None") addPower(s.player, key, n);
      else for (const e of victims) if (e.alive) addPower(e, key, n);
    }
    if (v["Energy"] !== undefined) s.energy += v["Energy"];
    if (v["HpLoss"] !== undefined) s.player.hp -= v["HpLoss"];
    if (v["Cards"] !== undefined) s.drawn += v["Cards"];
  }

  if (card.type === "Power") {
    // In play for the rest of the combat; not in any pile.
  } else if (card.keywords.includes("Exhaust")) {
    s.exhaust.push(card);
  } else {
    s.discard.push(card);
  }
  return s;
}

/** What the enemies' intents will do to the player at the end of this turn. */
export function incomingDamage(s: State): number {
  let total = 0;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    // The shown damage already includes the enemy's strength and weak and the
    // player's vulnerable as they stood when it was computed; weak applied to
    // the enemy this turn cuts it by a quarter.
    const weakened = !e.weakAtStart && has(e, "WEAK");
    for (const i of e.intents) {
      if (i.type !== "Attack" && i.type !== "DeathBlow") continue;
      let per = i.damage;
      if (weakened) per = Math.floor(per * 0.75);
      total += per * Math.max(1, i.hits);
    }
  }
  return total;
}

/** Block the player will have when the enemies attack: Plating adds its amount at the end of the turn. */
export function endOfTurnBlock(s: State): number {
  return s.player.block + Math.max(0, s.player.powers["PLATING"] ?? 0);
}

export function hpLoss(s: State): number {
  return Math.max(0, incomingDamage(s) - endOfTurnBlock(s));
}

/** A key that is equal for states search should treat as the same. */
export function stateKey(s: State): string {
  const hand = s.hand.map((c) => `${c.id}.${c.upgrades}.${c.cost}`).sort().join(",");
  const pw = (p: Record<string, number>) => Object.keys(p).sort().map((k) => `${k}${p[k]}`).join("");
  const enemies = s.enemies.map((e) => `${e.alive ? e.hp : "x"}/${e.block}/${pw(e.powers)}`).join(";");
  return `${s.energy}|${s.player.hp}/${s.player.block}/${pw(s.player.powers)}|${hand}|${enemies}|${s.drawn}`;
}
