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
  /** Its condition holds, as the game shows by the gold glow. */
  glows: boolean;
  /** Calculated vars as the game computed them at the observation: Perfected Strike's damage. */
  calc?: Readonly<Record<string, number>>;
  /** The card's enchantment, if it has one; its vars are already the enchanted ones. */
  enchantment?: string;
  /** The enchantment's own numbers: Corrupted's damage to you. */
  enchantmentVars?: Readonly<Record<string, number>>;
  /** Numbers the card's own class keeps, for hand cards: Thrash's extra damage. */
  fields?: Readonly<Record<string, number>>;
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
  /** Strength at the start of the turn: the intent damage already includes it (Mangle takes it away). */
  startStrength: number;
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
  /** The player lost HP this turn (Spite hits again). */
  lostHp: boolean;
  /** A card was exhausted this turn (Evil Eye blocks again). */
  exhaustedThisTurn: boolean;
  relics: readonly string[];
  /** Relics' numbers and counters, where the game reports them. */
  relicVars?: Readonly<Record<string, Record<string, number>>>;
  /** Cards played since the observation (Slow counts them). */
  played: number;
  /** Skills played since the observation (Tuning Fork counts them). */
  skills: number;
  /** Unmovable has doubled a card's block this turn already (taken as so if there is block at the observation). */
  unmovableUsed: boolean;
  /** Potions held, and how many slots there are. */
  potions: Potion[];
  potionSlots: number;
  /** Potions drunk since the observation (the evaluation charges for each). */
  potionsUsed: number;
}

export type Action = { kind: "play"; hand: number; target?: number } | { kind: "potion"; slot: number; target?: number } | { kind: "end" };

/** A potion held, as the bridge describes it. */
export interface Potion {
  slot: number;
  id: string;
  target: string;
  usage: string;
  vars: Readonly<Record<string, number>>;
}

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
    // An enchantment's numbers are the card's numbers for the rest of the run.
    vars: c.enchanted && Object.keys(c.enchanted).length > 0 ? { ...c.vars, ...c.enchanted } : c.vars,
    upgrades: c.upgrades,
    locked: energy !== undefined && !c.can_play && (c.costs_x || c.current_cost <= energy),
    glows: c.glows ?? false,
    ...(c.calculated && Object.keys(c.calculated).length > 0 ? { calc: c.calculated } : {}),
    ...(c.enchantment ? { enchantment: c.enchantment } : {}),
    ...(c.enchantment_vars && Object.keys(c.enchantment_vars).length > 0 ? { enchantmentVars: c.enchantment_vars } : {}),
    ...(c.fields && Object.keys(c.fields).length > 0 ? { fields: c.fields } : {}),
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
    // Free Attack makes every attack in hand show cost 0, but only the next
    // one played is free: give them their own cost back and let play() apply it.
    hand: c.hand.map((card) => {
      const model = cardOf(card, obs.player_energy);
      return (obs.player_powers["FREE_ATTACK_POWER"] ?? 0) > 0 && card.card_type === "Attack" ? { ...model, cost: card.cost } : model;
    }),
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
        startStrength: powers["STRENGTH"] ?? 0,
      };
    }),
    drawn: 0,
    exact: true,
    lostHp: c.hand.some((card) => card.card_id === "SPITE" && card.glows === true),
    exhaustedThisTurn: c.hand.some((card) => card.card_id === "EVIL_EYE" && card.glows === true),
    relics: obs.relics,
    ...(obs.relic_vars ? { relicVars: obs.relic_vars } : {}),
    played: 0,
    skills: 0,
    unmovableUsed: obs.player_block > 0,
    potions: (obs.potion_details ?? []).map((p) => ({ slot: p.slot, id: p.id, target: p.target ?? "None", usage: p.usage ?? "", vars: p.vars ?? {} })),
    potionSlots: obs.potion_slots ?? 3,
    potionsUsed: 0,
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
    lostHp: s.lostHp,
    exhaustedThisTurn: s.exhaustedThisTurn,
    relics: s.relics,
    ...(s.relicVars ? { relicVars: s.relicVars } : {}),
    played: s.played,
    skills: s.skills,
    unmovableUsed: s.unmovableUsed,
    potions: s.potions.slice(),
    potionSlots: s.potionSlots,
    potionsUsed: s.potionsUsed,
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
export function attackDamage(base: number, attacker: Unit, target: Unit, extra = 1): number {
  let d = (base + (attacker.powers["STRENGTH"] ?? 0)) * extra;
  if (has(attacker, "WEAK")) d *= 0.75;
  // Shrink (Shrinker Beetle): the owner's attacks deal DamageDecrease percent less.
  if (present(attacker, "SHRINK")) d *= 1 - powerVar(attacker, "SHRINK", "DamageDecrease", 30) / 100;
  if (has(target, "VULNERABLE")) d *= powerVar(target, "VULNERABLE", "DamageIncrease", 1.5);
  // Flutter (Thieving Hopper): attacks on it deal DamageDecrease percent less.
  if (has(target, "FLUTTER")) d *= 1 - powerVar(target, "FLUTTER", "DamageDecrease", 50) / 100;
  return Math.max(0, Math.floor(d));
}

export function blockGain(base: number, u: Unit): number {
  let b = base + (u.powers["DEXTERITY"] ?? 0);
  if (has(u, "FRAIL")) b *= 0.75;
  return Math.max(0, Math.floor(b));
}

function hit(target: Enemy, damage: number): number {
  const absorbed = Math.min(target.block, damage);
  const hadBlock = target.block > 0;
  target.block -= absorbed;
  // Burrowed (Tunneler) goes when its block is broken.
  if (hadBlock && target.block === 0) delete target.powers["BURROWED"];
  let lost = damage - absorbed;
  // Slippery (Inklet): a hit takes at most 1 HP, and uses up a stack.
  if (lost > 0 && has(target, "SLIPPERY")) {
    lost = 1;
    addPower(target, "SLIPPERY", -1);
  }
  // Hard to Kill (Exoskeleton): a hit takes at most that much HP.
  if (has(target, "HARD_TO_KILL")) lost = Math.min(lost, target.powers["HARD_TO_KILL"] ?? 0);
  target.hp -= lost;
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
  }
  return lost;
}

/** The most cards a hand holds; a draw past it does not happen. */
const HAND_LIMIT = 10;

/**
 * Draw `k` cards. Which cards come is not known — the draw pile's order is
 * hidden from the player, and the planner does not peek at it — so the hand
 * grows by `drawn`, not by cards. The piles still add up: an empty draw pile
 * takes the discard pile back first, as the game does, and the card being
 * played is not in the discard pile yet when it draws.
 */
export function draw(s: State, k: number): void {
  if (has(s.player, "NO_DRAW")) return;
  for (let n = Math.min(k, HAND_LIMIT - s.hand.length - s.drawn); n > 0; n--) {
    if (!takeFromDraw(s)) return;
    s.drawn++;
  }
}

/** Some card off the draw pile, shuffling the discard pile in when it is empty. */
function takeFromDraw(s: State): Card | undefined {
  if (s.draw.length === 0) {
    if (s.discard.length === 0) return undefined;
    s.draw = s.discard;
    s.discard = [];
  }
  return s.draw.pop();
}

/** A card the model can play at all, given its cost and keywords. */
export function playable(s: State, card: Card): boolean {
  if (card.locked || card.keywords.includes("Unplayable")) return false;
  // A status without Unplayable can be played (Slimed); a curse cannot.
  if (card.type === "Curse") return false;
  return card.costsX || costOf(s, card) <= s.energy;
}

/** What playing it costs now: Free Attack (Unrelenting) makes the next attack free. */
function costOf(s: State, card: Card): number {
  return card.type === "Attack" && has(s.player, "FREE_ATTACK") ? 0 : card.cost;
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
  for (const p of s.potions) {
    if (!drinkable(p)) continue;
    if (p.target === "AnyEnemy") {
      for (const e of s.enemies) if (e.alive) out.push({ kind: "potion", slot: p.slot, target: e.id });
    } else {
      out.push({ kind: "potion", slot: p.slot });
    }
  }
  out.push({ kind: "end" });
  return out;
}

/**
 * Potions whose effect is not what their numbers say, from the runs. The
 * temporary ones leave a power named after themselves that takes the effect
 * back at the end of the turn.
 */
const POTION_SPECIAL: Record<string, (s: State, n: number) => void> = {
  FLEX_POTION: (s, n) => {
    applyPower(s, s.player, "STRENGTH", n);
    addPower(s.player, "FLEX_POTION", n);
  },
  SPEED_POTION: (s, n) => {
    applyPower(s, s.player, "DEXTERITY", n);
    addPower(s.player, "SPEED_POTION", n);
  },
  // Takes Strength from every enemy for the turn (Artifact blocks it).
  SHACKLING_POTION: (s, n) => {
    for (const e of s.enemies) if (e.alive && applyPower(s, e, "STRENGTH", -n)) addPower(e, "SHACKLING_POTION", n);
  },
  // Shuffles the discard pile into the draw pile, then draws.
  BOTTLED_POTENTIAL: (s, n) => {
    s.draw.push(...s.discard);
    s.discard = [];
    draw(s, n);
  },
};

/** The numbers a potion can have that the model knows what to do with. */
const POTION_VARS = /^(Damage|Block|Energy|Cards|Heal|HpLoss|Repeat|\w+Power)$/;

/** A potion the model can drink in a fight: one whose every number it understands. */
export function drinkable(p: Potion): boolean {
  if (/OutOfCombat|Automatic|None/i.test(p.usage)) return false;
  if (POTION_SPECIAL[p.id]) return true;
  const names = Object.keys(p.vars);
  return names.length > 0 && names.every((n) => POTION_VARS.test(n));
}

/**
 * Drink a potion: its numbers, flat (a potion's damage and block are not the
 * player's attack or card block, so Strength, Dexterity and Vulnerable are
 * left out until the game says otherwise); a power on the player unless the
 * potion is thrown at enemies.
 */
export function drink(s0: State, a: Action & { kind: "potion" }): State {
  const s = clone(s0);
  const i = s.potions.findIndex((p) => p.slot === a.slot);
  const p = s.potions[i];
  if (!p) throw new Error(`no potion in slot ${a.slot}`);
  s.potions.splice(i, 1);
  s.potionsUsed++;
  const v = p.vars;
  const special = POTION_SPECIAL[p.id];
  if (special) {
    special(s, v["Cards"] ?? Object.values(v)[0] ?? 0);
    return s;
  }
  const target = a.target === undefined ? undefined : s.enemies.find((e) => e.id === a.target);
  const atEnemies = p.target === "AnyEnemy" || p.target === "AllEnemies" || p.target === "RandomEnemy";
  const victims = p.target === "AllEnemies" ? s.enemies.filter((e) => e.alive) : p.target === "RandomEnemy" ? s.enemies.filter((e) => e.alive).slice(0, 1) : one(target);
  if (p.target === "RandomEnemy") s.exact = false;
  if (v["Damage"] !== undefined) {
    for (let r = 0; r < (v["Repeat"] ?? 1); r++) for (const e of victims) if (e.alive) {
      hit(e, v["Damage"]);
      if (!e.alive) died(s, e);
    }
  }
  if (v["Block"] !== undefined) gainBlock(s, v["Block"]);
  for (const [name, n] of Object.entries(v)) {
    if (!name.endsWith("Power") || name === "Power") continue;
    if (atEnemies) {
      for (const e of victims) if (e.alive) applyPower(s, e, powerKey(name), n);
    } else {
      applyPower(s, s.player, powerKey(name), n);
    }
  }
  if (v["Energy"] !== undefined) s.energy += v["Energy"];
  if (v["Heal"] !== undefined) s.player.hp = Math.min(s.player.maxHp, s.player.hp + v["Heal"]);
  if (v["HpLoss"] !== undefined && v["HpLoss"] > 0) {
    s.player.hp -= v["HpLoss"];
    s.lostHp = true;
  }
  if (v["Cards"] !== undefined) draw(s, v["Cards"]);
  return s;
}

/** Debuffs Artifact blocks, a stack each. */
const DEBUFFS = new Set(["VULNERABLE", "WEAK", "FRAIL"]);

/**
 * Put `n` of `key` on `u`; false if Artifact blocked it (Cubex Construct:
 * Bash's Vulnerable used up the stack and did not land). Applying Vulnerable
 * while the player has Vicious draws that many cards.
 */
function applyPower(s: State, u: Unit, key: string, n: number): boolean {
  const debuff = DEBUFFS.has(key) || (key === "STRENGTH" && n < 0);
  if (debuff && has(u, "ARTIFACT")) {
    addPower(u, "ARTIFACT", -1);
    return false;
  }
  addPower(u, key, n);
  if (key === "VULNERABLE" && u !== s.player && has(s.player, "VICIOUS")) draw(s, s.player.powers["VICIOUS"] ?? 0);
  return true;
}

/**
 * Block for the player. Juggernaut answers every gain with its damage to a
 * random enemy — which one is only known when there is one left.
 */
function gainBlock(s: State, n: number, fromCard = false): void {
  if (n <= 0) return;
  // Unmovable: the first block a card gives each turn is doubled.
  if (fromCard && has(s.player, "UNMOVABLE") && !s.unmovableUsed) {
    n *= 2;
    s.unmovableUsed = true;
  }
  s.player.block += n;
  const juggernaut = s.player.powers["JUGGERNAUT"] ?? 0;
  if (juggernaut <= 0) return;
  const alive = s.enemies.filter((e) => e.alive);
  if (alive.length > 1) s.exact = false;
  const victim = alive[0];
  if (victim) {
    hit(victim, juggernaut);
    if (!victim.alive) died(s, victim);
  }
}

/** Into the exhaust pile. Feel No Pain blocks for every card exhausted, not changed by Dexterity or Frail. */
function exhaustCard(s: State, card: Card): void {
  s.exhaust.push(card);
  s.exhaustedThisTurn = true;
  gainBlock(s, s.player.powers["FEEL_NO_PAIN"] ?? 0);
  // Dark Embrace draws for every card exhausted.
  if (has(s.player, "DARK_EMBRACE")) draw(s, s.player.powers["DARK_EMBRACE"] ?? 1);
}

/** HP a card costs the player (Offering, Hemokinesis, Brand): Rupture turns it into Strength. */
function cardHpLoss(s: State, n: number): void {
  if (n <= 0) return;
  s.player.hp -= n;
  s.lostHp = true;
  if (has(s.player, "RUPTURE")) addPower(s.player, "STRENGTH", s.player.powers["RUPTURE"] ?? 1);
}

/** Thorns (Spiny Toad): every hit on it hits the player back, into block first. */
function thorns(s: State, e: Enemy): void {
  const n = e.powers["THORNS"] ?? 0;
  if (n <= 0) return;
  const absorbed = Math.min(s.player.block, n);
  s.player.block -= absorbed;
  if (n > absorbed) {
    s.player.hp -= n - absorbed;
    s.lostHp = true;
  }
}

/** Powers that go when the monster that put them on dies (the powers' AfterDeath). */
const APPLIED_BY: Record<string, string> = { SHRINK: "SHRINKER_BEETLE", CONSTRICT: "SLITHERING_STRANGLER" };

function died(s: State, e: Enemy): void {
  for (const [power, model] of Object.entries(APPLIED_BY)) {
    if (e.model === model && !s.enemies.some((o) => o.alive && o.model === model)) delete s.player.powers[power];
  }
  // Gremlin Horn: every enemy's death gives energy and a card.
  if (s.relics.includes("GREMLIN_HORN")) {
    s.energy += s.relicVars?.["GREMLIN_HORN"]?.["Energy"] ?? 1;
    draw(s, s.relicVars?.["GREMLIN_HORN"]?.["Cards"] ?? 1);
  }
  // Minions (Eye with Teeth) go when nothing but minions is left, and the fight is won.
  const alive = s.enemies.filter((o) => o.alive);
  if (alive.length > 0 && alive.every((o) => has(o, "MINION"))) for (const o of alive) o.alive = false;
}

/** Each living victim, `times` times over. */
function strike(s: State, victims: readonly Enemy[], base: number, times: number): void {
  const curling = new Map<Enemy, number>();
  for (let r = 0; r < times; r++) {
    for (const e of victims) {
      if (!e.alive) continue;
      // Slow (Bygone Effigy): 10% more for every card played this turn, this one not yet counted.
      const slow = has(e, "SLOW") ? 1 + (powerVar(e, "SLOW", "SlowAmount", 0) + s.played) / 10 : 1;
      const lost = hit(e, attackDamage(base, s.player, e, slow));
      // Curl Up (Louse Progenitor): the first HP it loses curls it up, for block once the card is done.
      if (lost > 0 && has(e, "CURL_UP")) curling.set(e, e.powers["CURL_UP"] ?? 0);
      thorns(s, e);
      // Flutter loses a stack for every hit it takes.
      if (has(e, "FLUTTER")) addPower(e, "FLUTTER", -1);
      if (!e.alive) died(s, e);
    }
  }
  for (const [e, block] of curling) {
    delete e.powers["CURL_UP"];
    if (e.alive) e.block += block;
  }
}

/**
 * Exhaust a card from the hand that the game picks — at random, or by a
 * choice the bridge makes for us — so which one is not known. The model takes
 * the least useful: a status or curse if there is one, else the last card.
 */
function exhaustOne(s: State): void {
  if (s.hand.length === 0) return;
  s.exact = false;
  let i = s.hand.findIndex((c) => c.type === "Status" || c.type === "Curse");
  if (i < 0) i = s.hand.length - 1;
  for (const c of s.hand.splice(i, 1)) exhaustCard(s, c);
}

/** A card's attack damage before modifiers: its Damage, or its calculated damage. */
function damageOf(s: State, card: Card): number | undefined {
  const v = card.vars;
  let damage: number | undefined;
  if (v["CalculatedDamage"] === undefined) damage = v["Damage"];
  // Body Slam: its extra damage per point of block, and block changes within the turn.
  else if (card.id === "BODY_SLAM") damage = (v["CalculationBase"] ?? 0) + (v["ExtraDamage"] ?? 0) * s.player.block;
  else damage = card.calc?.["CalculatedDamage"] ?? v["CalculationBase"];
  // Vigor (Akabeko): the next attack played deals that much more.
  if (damage !== undefined && card.type === "Attack") damage += Math.max(0, s.player.powers["VIGOR"] ?? 0);
  // Strike Dummy: more for every Strike, added like strength.
  if (damage !== undefined && card.id.includes("STRIKE") && s.relics.includes("STRIKE_DUMMY")) {
    damage += s.relicVars?.["STRIKE_DUMMY"]?.["ExtraDamage"] ?? 3;
  }
  return damage;
}

const one = (t: Enemy | undefined): Enemy[] => (t ? [t] : []);
const num = (c: Card, name: string) => c.vars[name] ?? 0;
/** A card's damage as damageOf gives it: relics like Strike Dummy count for special cards too. */
const dmg = (s: State, c: Card) => damageOf(s, c) ?? 0;

type Rule = (s: State, card: Card, target: Enemy | undefined) => void;

/** Cards whose effect is not what their numbers say, each written from what the game did. */
const SPECIAL: Record<string, Rule> = {
  // A copy of itself goes into the discard pile.
  ANGER: (s, c, t) => {
    strike(s, one(t), dmg(s, c), 1);
    s.discard.push({ ...c });
  },
  // Upgrades a card in hand, by a choice made for us: its new numbers are not known.
  ARMAMENTS: (s, c) => {
    gainBlock(s, blockGain(num(c, "Block"), s.player), true);
    s.exact = false;
  },
  BATTLE_TRANCE: (s, c) => {
    draw(s, num(c, "Cards"));
    applyPower(s, s.player, "NO_DRAW", 1);
  },
  BURNING_PACT: (s, c) => {
    exhaustOne(s);
    draw(s, num(c, "Cards"));
  },
  COLOSSUS: (s, c) => {
    gainBlock(s, blockGain(num(c, "Block"), s.player), true);
    applyPower(s, s.player, "COLOSSUS", num(c, "Colossus"));
  },
  // Hits twice if the target is Vulnerable.
  DISMANTLE: (s, c, t) => strike(s, one(t), dmg(s, c), t && has(t, "VULNERABLE") ? 2 : 1),
  // Strength for the player, and a little for the target.
  // Lose HP, gain Strength, exhaust a card from hand (chosen as exhaustOne does).
  BRAND: (s, c) => {
    cardHpLoss(s, num(c, "HpLoss"));
    applyPower(s, s.player, "STRENGTH", num(c, "StrengthPower"));
    exhaustOne(s);
  },
  // Max HP for energy and cards.
  BRIGHTEST_FLAME: (s, c) => {
    s.player.maxHp -= num(c, "MaxHp");
    s.player.hp = Math.min(s.player.hp, s.player.maxHp);
    s.energy += num(c, "Energy");
    draw(s, num(c, "Cards"));
  },
  // Frees the player a turn from The Insatiable's Sandpit.
  FRANTIC_ESCAPE: (s) => {
    for (const e of s.enemies) if (e.alive && (e.powers["SANDPIT"] ?? 0) > 0) addPower(e, "SANDPIT", 1);
  },
  // Exhausts the rest of the hand and hits once for every card it exhausted.
  FIEND_FIRE: (s, c, t) => {
    const n = s.hand.length;
    for (const h of s.hand.splice(0)) exhaustCard(s, h);
    strike(s, one(t), dmg(s, c), n);
  },
  FIGHT_ME: (s, c, t) => {
    strike(s, one(t), dmg(s, c), num(c, "Repeat") || 1);
    applyPower(s, s.player, "STRENGTH", num(c, "StrengthPower"));
    if (t?.alive) applyPower(s, t, "STRENGTH", num(c, "EnemyStrength"));
  },
  // Blocks again if a card was exhausted this turn (the game makes it glow).
  EVIL_EYE: (s, c) => {
    gainBlock(s, blockGain(num(c, "Block"), s.player), true);
    if (s.exhaustedThisTurn) gainBlock(s, blockGain(num(c, "Block"), s.player), true);
  },
  FLAME_BARRIER: (s, c) => {
    gainBlock(s, blockGain(num(c, "Block"), s.player), true);
    applyPower(s, s.player, "FLAME_BARRIER", num(c, "DamageBack"));
  },
  // Plays the top card of the draw pile, which the player cannot see, and exhausts it.
  HAVOC: (s) => {
    const top = takeFromDraw(s);
    if (top) exhaustCard(s, top);
    s.exact = false;
  },
  // A card from the discard pile goes on top of the draw pile.
  HEADBUTT: (s, c, t) => {
    strike(s, one(t), dmg(s, c), 1);
    const back = s.discard.shift();
    if (back) s.draw.push(back);
  },
  // A random attack into the hand: a card the model does not know.
  INFERNAL_BLADE: (s) => {
    if (s.hand.length + s.drawn < HAND_LIMIT) s.drawn++;
  },
  // Takes strength away for the turn (MANGLE is what gives it back).
  MANGLE: (s, c, t) => {
    strike(s, one(t), dmg(s, c), 1);
    if (t?.alive && applyPower(s, t, "STRENGTH", -num(c, "StrengthLoss"))) addPower(t, "MANGLE", num(c, "StrengthLoss"));
  },
  RAGE: (s, c) => {
    applyPower(s, s.player, "RAGE", num(c, "Power"));
  },
  // Its cards and energy come next turn, not now.
  RELAX: (s, c) => {
    gainBlock(s, blockGain(num(c, "Block"), s.player), true);
    applyPower(s, s.player, "DRAW_CARDS_NEXT_TURN", num(c, "Cards"));
    applyPower(s, s.player, "ENERGY_NEXT_TURN", num(c, "Energy"));
  },
  // A power of its own; its Strength number is what it gives later, when a card costs HP.
  RUPTURE: (s, c) => {
    applyPower(s, s.player, "RUPTURE", num(c, "StrengthPower"));
  },
  // Exhausts every card in hand that is not an attack, and blocks for each.
  SECOND_WIND: (s, c) => {
    const gone = s.hand.filter((h) => h.type !== "Attack");
    s.hand = s.hand.filter((h) => h.type === "Attack");
    for (const h of gone) {
      exhaustCard(s, h);
      gainBlock(s, blockGain(num(c, "Block"), s.player), true);
    }
  },
  // Strength for the turn: the strength goes to the player, not the target.
  SETUP_STRIKE: (s, c, t) => {
    strike(s, one(t), dmg(s, c), 1);
    applyPower(s, s.player, "STRENGTH", num(c, "StrengthPower"));
    addPower(s.player, "SETUP_STRIKE", num(c, "StrengthPower"));
  },
  // The next attack played is free.
  UNRELENTING: (s, c, t) => {
    strike(s, one(t), dmg(s, c), 1);
    applyPower(s, s.player, "FREE_ATTACK", 1);
  },
  // Hits again only if the player lost HP this turn.
  SPITE: (s, c, t) => strike(s, one(t), dmg(s, c), s.lostHp ? num(c, "Repeat") || 1 : 1),
  // Exhausts the rest of the hand and makes as many new cards: made, not drawn, so no pile is touched.
  STOKE: (s) => {
    const n = s.hand.length;
    for (const h of s.hand.splice(0)) exhaustCard(s, h);
    s.drawn += Math.min(n, HAND_LIMIT);
  },
  // Hits, then draws until it draws a card that is not an attack: how many is not known.
  PILLAGE: (s, c, t) => {
    strike(s, one(t), dmg(s, c), 1);
    draw(s, 2);
    s.exact = false;
  },
  TRUE_GRIT: (s, c) => {
    gainBlock(s, blockGain(num(c, "Block"), s.player), true);
    exhaustOne(s);
  },
  // Hits twice with its damage and what it has gained, and exhausts a card from hand.
  // Hits twice with its damage and what it has gained, and exhausts a random
  // attack from hand — none if there is no attack there (Tremble stayed).
  THRASH: (s, c, t) => {
    // (Its _extraDamage field is not in the hits: Thrash dealt 2 x 10 with 4 damage and 6 Strength.)
    strike(s, one(t), dmg(s, c), 2);
    const attacks = s.hand.filter((h) => h.type === "Attack");
    if (attacks.length === 0) return;
    if (new Set(attacks.map((h) => `${h.id}.${h.upgrades}`)).size > 1) s.exact = false;
    const i = s.hand.indexOf(attacks[attacks.length - 1]!);
    for (const h of s.hand.splice(i, 1)) exhaustCard(s, h);
  },
  TWIN_STRIKE: (s, c, t) => strike(s, one(t), dmg(s, c), 2),
  // Weak, then Vulnerable, each for its one Power number.
  UPPERCUT: (s, c, t) => {
    strike(s, one(t), dmg(s, c), 1);
    if (t?.alive) {
      applyPower(s, t, "WEAK", num(c, "Power"));
      applyPower(s, t, "VULNERABLE", num(c, "Power"));
    }
  },
};

/** What a card does from its numbers alone. */
function standard(s: State, card: Card, target: Enemy | undefined, x: number): void {
  const v = card.vars;
  if (card.costsX || card.target === "RandomEnemy") s.exact = false;
  const repeat = (v["Repeat"] ?? 1) * (card.costsX ? x : 1);
  const victims = card.target === "AllEnemies" ? s.enemies.filter((e) => e.alive)
    : card.target === "RandomEnemy" ? s.enemies.filter((e) => e.alive).slice(0, 1)
    : one(target);

  const damage = damageOf(s, card);
  if (damage !== undefined && card.type === "Attack") strike(s, victims, damage, repeat);
  if (v["Block"] !== undefined) gainBlock(s, blockGain(v["Block"], s.player), true);

  // A var named for a power is that power: on the player for a card that
  // targets itself (Inflame's Strength), else on whoever the card hits.
  const powers = Object.entries(v).filter(([name]) => name.endsWith("Power") && name !== "Power");
  if (card.type === "Power") {
    // A power card's numbers are its power's: Vicious's Cards is how many
    // Vicious draws later, not a draw now. Unless they name a power, the
    // power is the card's own.
    if (powers.length > 0) for (const [name, n] of powers) applyPower(s, s.player, powerKey(name), n);
    else applyPower(s, s.player, card.id, Object.values(v)[0] ?? 1);
    return;
  }
  for (const [name, n] of powers) {
    if (card.target === "Self" || card.target === "None") applyPower(s, s.player, powerKey(name), n);
    else for (const e of victims) if (e.alive) applyPower(s, e, powerKey(name), n);
  }
  if (v["Energy"] !== undefined) s.energy += v["Energy"];
  if (v["HpLoss"] !== undefined) cardHpLoss(s, v["HpLoss"]);
  if (v["Cards"] !== undefined) draw(s, v["Cards"]);
}

export function play(s0: State, a: Action & { kind: "play" }): State {
  const s = clone(s0);
  const card = s.hand[a.hand];
  if (!card) throw new Error(`no card at hand index ${a.hand}`);
  s.hand.splice(a.hand, 1);

  const x = card.costsX ? s.energy : 0;
  s.energy -= card.costsX ? s.energy : costOf(s, card);
  if (card.type === "Attack" && has(s.player, "FREE_ATTACK")) addPower(s.player, "FREE_ATTACK", -1);
  const target = a.target === undefined ? undefined : s.enemies.find((e) => e.id === a.target);

  const special = SPECIAL[card.id];
  if (special) special(s, card, target);
  else standard(s, card, target, x);
  // Rage: block for every attack played this turn, not changed by Dexterity or Frail.
  if (card.type === "Attack" && has(s.player, "RAGE")) gainBlock(s, s.player.powers["RAGE"] ?? 0);
  // Daughter of the Wind: block for every attack played.
  if (card.type === "Attack" && s.relics.includes("DAUGHTER_OF_THE_WIND")) gainBlock(s, s.relicVars?.["DAUGHTER_OF_THE_WIND"]?.["Block"] ?? 1);
  // Corrupted: the enchantment hurts whoever plays the card, through block.
  if (card.enchantment === "CORRUPTED") {
    s.player.hp -= card.enchantmentVars?.["_damageAmount"] ?? 2;
    s.lostHp = true;
  }
  if (card.type === "Attack") delete s.player.powers["VIGOR"];
  // Vital Spark (Infested Prism): every skill played taints the player.
  if (card.type === "Skill") {
    for (const e of s.enemies) if (e.alive && has(e, "VITAL_SPARK")) addPower(s.player, "TAINTED", e.powers["VITAL_SPARK"] ?? 0);
  }
  // Juggling copies an attack into the hand by how many attacks came before it this turn, which the model does not see.
  if (card.type === "Attack" && has(s.player, "JUGGLING")) s.exact = false;
  s.played++;
  // Tuning Fork: block for every tenth skill, counted across fights.
  if (card.type === "Skill") {
    s.skills++;
    const fork = s.relics.includes("TUNING_FORK") ? s.relicVars?.["TUNING_FORK"] : undefined;
    if (fork && ((fork["_skillsPlayed"] ?? 0) + s.skills) % (fork["Cards"] || 10) === 0) gainBlock(s, fork["Block"] ?? 7);
  }
  // Tender (Hunter Killer): every card played takes that much Strength and Dexterity, after it resolves.
  const tender = s.player.powers["TENDER"] ?? 0;
  if (tender > 0) {
    addPower(s.player, "STRENGTH", -tender);
    addPower(s.player, "DEXTERITY", -tender);
  }

  if (card.type === "Power") {
    // In play for the rest of the combat; not in any pile.
  } else if (card.keywords.includes("Exhaust")) {
    exhaustCard(s, card);
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
    const strength = (e.powers["STRENGTH"] ?? 0) - e.startStrength;
    for (const i of e.intents) {
      if (i.type !== "Attack" && i.type !== "DeathBlow") continue;
      let per = Math.max(0, i.damage + strength);
      if (weakened) per = Math.floor(per * 0.75);
      total += per * Math.max(1, i.hits);
    }
  }
  return total;
}

/**
 * Block the player will have when the enemies attack: Plating adds its amount
 * at the end of the turn, and Feel No Pain blocks for every Ethereal card
 * (Dazed) that the end of the turn exhausts from the hand.
 */
export function endOfTurnBlock(s: State): number {
  const ethereal = s.hand.filter((c) => c.keywords.includes("Ethereal")).length;
  return s.player.block + Math.max(0, s.player.powers["PLATING"] ?? 0) + ethereal * Math.max(0, s.player.powers["FEEL_NO_PAIN"] ?? 0);
}

/**
 * HP the end of the turn takes. Constrict (Slithering Strangler) hits the
 * player at the end of the turn and block takes it like an attack.
 */
export function hpLoss(s: State): number {
  // Sandpit (The Insatiable) devours the player when it runs out.
  if (s.enemies.some((e) => e.alive && (e.powers["SANDPIT"] ?? 0) > 0 && (e.powers["SANDPIT"] ?? 0) <= 1)) return s.player.hp;
  const constrict = Math.max(0, s.player.powers["CONSTRICT"] ?? 0);
  // A status card left in hand that deals damage does it at the end of the turn, into block (Infection).
  const statuses = s.hand.reduce((a, c) => a + (c.type === "Status" ? c.vars["Damage"] ?? 0 : 0), 0);
  // Crimson Mantle costs HP every turn, past block.
  const mantle = s.player.powers["CRIMSON_MANTLE"] ? s.player.powerVars?.["CRIMSON_MANTLE"]?.["SelfDamage"] ?? 1 : 0;
  return Math.max(0, incomingDamage(s) + constrict + statuses - endOfTurnBlock(s)) + mantle;
}

/** A key that is equal for states search should treat as the same. */
export function stateKey(s: State): string {
  const hand = s.hand.map((c) => `${c.id}.${c.upgrades}.${c.cost}`).sort().join(",");
  const pw = (p: Record<string, number>) => Object.keys(p).sort().map((k) => `${k}${p[k]}`).join("");
  const enemies = s.enemies.map((e) => `${e.alive ? e.hp : "x"}/${e.block}/${pw(e.powers)}`).join(";");
  const potions = s.potions.map((p) => p.slot).join(",");
  return `${s.energy}|${s.player.hp}/${s.player.block}/${pw(s.player.powers)}|${hand}|${enemies}|${s.drawn}|${s.lostHp ? 1 : 0}${s.exhaustedThisTurn ? 1 : 0}|${s.played}/${s.skills}|${potions}`;
}
