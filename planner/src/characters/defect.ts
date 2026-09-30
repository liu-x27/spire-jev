/**
 * The Defect's own rules (see characters/index.ts for the hooks), each written from the game's IL
 * (sts2.dll v0.111.0), read into specs kept out of the repository; the comments name the method.
 *
 * - Orbs (IL: OrbQueue, OrbCmd): a list, the front (Orbs[0]) the oldest, the one evoked next. A channel
 *   into full slots evokes the front first (EvokeNext, dequeue), then appends; the Defect has 3 slots a
 *   fight (at most 10) and with none its channels are lost, while a character with no slots of its own
 *   gets one for its first channel. RemoveSlots deletes the newest orbs past the capacity, unevoked.
 *   "Evoke the front N times" (Dualcast, Multi-Cast, Quadcast) evokes it in place and removes it on
 *   the last.
 * - Values (IL: <Orb>.PassiveVal/EvokeVal, FocusPower.ModifyOrbValue: max(0, value + Focus), read live):
 *   Lightning 3/8 and Frost 2/5 with Focus (Infused Core +1 on Lightning's, after the floor); Dark adds
 *   6 + Focus to its own evoke (6 as channeled) each passive, and its evoke is that sum as it stands;
 *   Plasma 1/2 energy, no Focus; Glass hits every enemy for its value (4 as channeled) + Focus, then
 *   loses 1 of it (none at a value of 0), its evoke twice its passive.
 * - Orb damage and block are unpowered (IL: props 4): no Strength, Weak, Vulnerable, Dexterity or
 *   Frail; enemy block, Intangible, Slippery and the like still apply (sim.ts hit), Thorns does not.
 *   Lightning hits a random enemy, Dark's evoke the one with the least HP, Glass every one.
 * - The turn (IL: CombatManager): at its end Hailstorm (BeforeSideTurnEnd), then the orbs' passives
 *   front first (OrbQueue.BeforeTurnEnd; Gold-Plated Cables triggers the front one twice), then the
 *   flush, then Consuming Shadow's evokes and the temporary Focus given back (AfterSideTurnEnd). At its
 *   start Lightning Rod and Spinner channel (AfterEnergyReset, before the draw), Machine Learning draws
 *   more, Loop and Emotion Chip trigger passives after the draw, Coolant and Biased Cognition
 *   (AfterSideTurnStart), and last the Plasma orbs' energy (OrbQueue.AfterTurnStart).
 *
 * State: `orbs` and `orbSlots` on State.ext (shared with the other characters' fields: read only these,
 * replace the array, never change it in place), and the counts since the observation (dfSpent,
 * dfLightning, dfFeral). An observation's orbs are the bridge's player_orbs and orb_slots; a spar
 * bout, with none, opens with the Defect's 3 slots and its turn-1 relics' orbs.
 */

import { character } from "../character.ts";
import type { Observation } from "../obs.ts";
import type { Weights } from "../search.ts";
import {
  addPower, applyPower, autoPlay, blockGain, type Card, costOf, died, dmg, draw, type Enemy, endOfTurnBlock, exhaustCard, extraTurn, gainBlock,
  HAND_LIMIT, hit, incomingHits, junkIndex, num, one, powerVar, relicVar, setRelicVar, standard, type State, strike, takeFromDraw,
} from "../sim.ts";
import type { CardRow, CharacterRules, Rule } from "./index.ts";

export type OrbId = "LIGHTNING_ORB" | "FROST_ORB" | "DARK_ORB" | "PLASMA_ORB" | "GLASS_ORB";
/** An orb: its kind, and the number its own class keeps (a Dark orb's evoke so far, a Glass orb's passive before Focus). */
export interface Orb {
  id: OrbId;
  n?: number;
}
/** The Defect's part of State.ext. */
interface Ext {
  orbs: readonly Orb[];
  orbSlots: number;
  /** Energy paid for cards since the observation (Helix Drill), and before the card being played. */
  dfSpent?: number;
  dfSpentBefore?: number;
  /** Lightning channeled since the observation (Voltaic counts the fight's). */
  dfLightning?: number;
  /** 0-cost attacks Feral sent back since the observation. */
  dfFeral?: number;
  /** The card being played and the cost it was played at (Feral asks the cost played at, not paid). */
  dfPlayed?: string;
  /** Storm's and Subroutine's amounts as a Power card began (IL: BeforeCardPlayed snapshots). */
  dfStorm?: number;
  dfSub?: number;
  /** Plays of the card being played (Signal Boost, Echo Form): Storm and Subroutine answer each. */
  dfPlays?: number;
}

const ORB_IDS: readonly OrbId[] = ["LIGHTNING_ORB", "FROST_ORB", "DARK_ORB", "PLASMA_ORB", "GLASS_ORB"];
/** The Defect's slots as a fight opens (IL: Defect.BaseOrbSlotCount). */
export const DEFECT_SLOTS = 3;
export const MAX_SLOTS = 10;

const isDefect = (s: State) => character() === "DEFECT" || s.relics.includes("CRACKED_CORE") || s.relics.includes("INFUSED_CORE");
/** A state the Defect's rules are for: the Defect's, or one with orbs. Another character's is left as it was (no ext of the Defect's made). */
const on = (s: State) => mine(s) !== undefined || isDefect(s);

/**
 * The orbs a fight opens with, for a state no observation made (a spar bout): the Defect's slots, Runic
 * Capacitor's 3 more; on turn 1 Cracked Core's Lightning (Infused Core's 3) and Symbiotic Virus's Dark,
 * the newest kept where they overflow.
 */
function opening(s: State): Ext {
  if (!isDefect(s)) return { orbs: [], orbSlots: 0 };
  const slots = Math.min(MAX_SLOTS, DEFECT_SLOTS + (s.relics.includes("RUNIC_CAPACITOR") ? relicVar(s, "RUNIC_CAPACITOR", "Repeat", 3) : 0));
  const orbs: Orb[] = [];
  if ((s.turn ?? 1) <= 1) {
    if (s.relics.includes("CRACKED_CORE")) for (let i = 0; i < relicVar(s, "CRACKED_CORE", "Lightning", 1); i++) orbs.push({ id: "LIGHTNING_ORB" });
    if (s.relics.includes("INFUSED_CORE")) for (let i = 0; i < relicVar(s, "INFUSED_CORE", "Lightning", 3); i++) orbs.push({ id: "LIGHTNING_ORB" });
    if (s.relics.includes("SYMBIOTIC_VIRUS")) orbs.push(newOrb("DARK_ORB"));
  }
  return { orbs: orbs.slice(Math.max(0, orbs.length - slots)), orbSlots: slots };
}
const mine = (s: State): Ext | undefined => (Array.isArray((s.ext as Partial<Ext> | undefined)?.orbs) ? (s.ext as unknown as Ext) : undefined);
/** The Defect's state, read only. */
export const orbState = (s: State): Ext => mine(s) ?? opening(s);
export const orbsOf = (s: State): readonly Orb[] => orbState(s).orbs;
/** Change the Defect's part of State.ext: the other characters' fields kept, the orbs made on the state the first time. */
function set(s: State, patch: Partial<Ext>): void {
  const st = orbState(s);
  s.ext = { ...(s.ext ?? {}), orbs: st.orbs, orbSlots: st.orbSlots, ...patch };
}
function setOrbs(s: State, orbs: readonly Orb[], slots = orbState(s).orbSlots): void {
  set(s, { orbs, orbSlots: slots });
}
const count = (s: State, k: "dfSpent" | "dfLightning" | "dfFeral") => mine(s)?.[k] ?? 0;

const power = (s: State, p: string) => Math.max(0, s.player.powers[p] ?? 0);
const focus = (s: State) => s.player.powers["FOCUS"] ?? 0;
const withFocus = (s: State, v: number, f = focus(s)) => Math.max(0, v + f);
/** Infused Core (IL: ModifyOrbValue after Focus's floor): the Lightning's values 1 more. */
const infused = (s: State) => (s.relics.includes("INFUSED_CORE") ? relicVar(s, "INFUSED_CORE", "ExtraDamage", 1) : 0);

/** What an orb's passive gives now (damage, block, Dark's gain, energy), Focus in; `f`: another Focus. */
export function passiveOf(s: State, o: Orb, f = focus(s)): number {
  switch (o.id) {
    case "LIGHTNING_ORB": return withFocus(s, 3, f) + infused(s);
    case "FROST_ORB": return withFocus(s, 2, f);
    case "DARK_ORB": return withFocus(s, 6, f);
    case "PLASMA_ORB": return 1;
    case "GLASS_ORB": return withFocus(s, o.n ?? 4, f);
  }
}
/** What an orb's evoke gives now. */
export function evokeOf(s: State, o: Orb, f = focus(s)): number {
  switch (o.id) {
    case "LIGHTNING_ORB": return withFocus(s, 8, f) + infused(s);
    case "FROST_ORB": return withFocus(s, 5, f);
    case "DARK_ORB": return o.n ?? 6;
    case "PLASMA_ORB": return 2;
    case "GLASS_ORB": return 2 * withFocus(s, o.n ?? 4, f);
  }
}

const alive = (s: State) => s.enemies.filter((e) => e.alive);
/**
 * The fight goes on (IL: CombatManager.IsOverOrEnding false): an enemy alive, or a killed Waterfall Giant
 * with its blow still to come, a Test Subject to come back (JEV04001: a Dark channeled at the dying
 * Giant, the model had the fight over and channeled nothing).
 */
const fighting = (s: State) => s.enemies.some((e) => e.alive || (e.deathBlow ?? 0) > 0 || (e.revive ?? 0) > 0);

/** Unpowered damage to one enemy through its block (an orb's, Hailstorm's, Thunder's). */
function zap(s: State, e: Enemy, n: number): void {
  if (!e.alive || n <= 0) return;
  hit(e, n);
  if (!e.alive) died(s, e);
}
/** Unpowered damage to every living enemy. */
function zapAll(s: State, n: number): void {
  for (const e of alive(s)) zap(s, e, n);
}
/**
 * A random enemy (IL: CombatTargets): exact with one left; with more, the model takes the one with the
 * most HP, so the damage lands but no kill is taken for granted, and says it is not exact.
 */
function randomEnemy(s: State): Enemy | undefined {
  const living = alive(s);
  if (living.length > 1) s.exact = false;
  return living.reduce<Enemy | undefined>((a, e) => (!a || e.hp > a.hp ? e : a), undefined);
}
/** The living enemy with the least HP, the first of equals (IL: DarkOrb.Evoke, MinBy(CurrentHp)). */
const weakest = (s: State): Enemy | undefined => alive(s).reduce<Enemy | undefined>((a, e) => (!a || e.hp < a.hp ? e : a), undefined);

/** An orb's passive, once (OrbModel.Passive); `target`: Tesla Coil's for a Lightning. Returns the orb as it is after. */
export function passive(s: State, o: Orb, target?: Enemy): Orb {
  if (!fighting(s)) return o;
  const v = passiveOf(s, o);
  switch (o.id) {
    case "LIGHTNING_ORB": {
      const e = target ?? randomEnemy(s);
      if (e) zap(s, e, v);
      return o;
    }
    case "FROST_ORB":
      gainBlock(s, v);
      return o;
    case "DARK_ORB":
      return { ...o, n: (o.n ?? 6) + v };
    case "PLASMA_ORB":
      s.energy += v;
      return o;
    case "GLASS_ORB":
      // No damage and no decay at 0 (IL: GlassOrb.Passive returns first); the hit is the value before the decay.
      if (v <= 0) return o;
      zapAll(s, v);
      return { ...o, n: Math.max(0, (o.n ?? 4) - 1) };
  }
}

/** An orb's evoke (OrbModel.Evoke), then Thunder on the enemy a Lightning's hit, if it lives (IL: ThunderPower.AfterOrbEvoked). */
export function evoke(s: State, o: Orb): void {
  if (!fighting(s)) return;
  const v = evokeOf(s, o);
  switch (o.id) {
    case "LIGHTNING_ORB": {
      const e = randomEnemy(s);
      if (!e) return;
      zap(s, e, v);
      if (e.alive) zap(s, e, power(s, "THUNDER"));
      return;
    }
    case "FROST_ORB":
      gainBlock(s, v);
      return;
    case "DARK_ORB": {
      const e = weakest(s);
      if (e) zap(s, e, v);
      return;
    }
    case "PLASMA_ORB":
      s.energy += v;
      return;
    case "GLASS_ORB":
      if (v > 0) zapAll(s, v);
      return;
  }
}

/** Evoke the front orb (OrbCmd.EvokeNext); `dequeue`: removed before it resolves, else left where it is. */
export function evokeNext(s: State, dequeue = true): void {
  const orbs = orbsOf(s);
  const front = orbs[0];
  if (!front || !fighting(s)) return;
  if (dequeue) setOrbs(s, orbs.slice(1));
  evoke(s, front);
}
/** Evoke the front orb `times` times, removed on the last (Dualcast, Multi-Cast, Quadcast). */
export function evokeFront(s: State, times: number): void {
  if (orbsOf(s).length === 0) return;
  for (let i = 0; i < times; i++) evokeNext(s, i === times - 1);
}
/** Evoke the newest orb (OrbCmd.EvokeLast), removed first: Consuming Shadow's. */
export function evokeLast(s: State): void {
  const orbs = orbsOf(s);
  const last = orbs[orbs.length - 1];
  if (!last || !fighting(s)) return;
  setOrbs(s, orbs.slice(0, -1));
  evoke(s, last);
}

/** A new orb as channeled (IL: DarkOrb..ctor 6, GlassOrb..ctor 4). */
export function newOrb(id: OrbId): Orb {
  return id === "DARK_ORB" ? { id, n: 6 } : id === "GLASS_ORB" ? { id, n: 4 } : { id };
}

/**
 * Channel an orb (OrbCmd.Channel), `times` times: for a character with no slots of its own a slot
 * first, the front evoked into full slots, then appended; lost with no slots (the Defect after Bulk
 * Up); nothing once the fight is won. Metronome counts each (its 7th: 30 to every enemy, once a fight).
 */
export function channel(s: State, id: OrbId, times = 1): void {
  for (let i = 0; i < times; i++) {
    if (!fighting(s)) return;
    let st = orbState(s);
    if (st.orbSlots === 0 && !isDefect(s)) setOrbs(s, st.orbs, 1);
    st = orbState(s);
    if (st.orbSlots === 0) continue;
    if (st.orbs.length >= st.orbSlots) {
      evokeNext(s, true);
      if (!fighting(s)) return;
      st = orbState(s);
    }
    setOrbs(s, [...st.orbs, newOrb(id)], st.orbSlots);
    if (id === "LIGHTNING_ORB") set(s, { dfLightning: count(s, "dfLightning") + 1 });
    if (s.relics.includes("METRONOME")) {
      const n = relicVar(s, "METRONOME", "_orbsChanneled", 0) + 1;
      setRelicVar(s, "METRONOME", "_orbsChanneled", n);
      if (n === relicVar(s, "METRONOME", "OrbCount", 7)) zapAll(s, relicVar(s, "METRONOME", "Damage", 30));
    }
  }
}
/** A random orb (IL: OrbModel.GetRandomOrb, uniform over the five): the model channels a Lightning, and says it is not exact. */
function channelRandom(s: State, times: number): void {
  if (times <= 0) return;
  s.exact = false;
  channel(s, "LIGHTNING_ORB", times);
}

/** Slots added (OrbCmd.AddSlots), at most 10 in all. */
export function addSlots(s: State, n: number): void {
  if (!fighting(s)) return;
  const st = orbState(s);
  setOrbs(s, st.orbs, Math.min(MAX_SLOTS, st.orbSlots + Math.max(0, n)));
}
/** Slots taken away (OrbCmd.RemoveSlots): the newest orbs past the capacity go, unevoked. */
export function removeSlots(s: State, n: number): void {
  if (!fighting(s)) return;
  const st = orbState(s);
  const slots = Math.max(0, st.orbSlots - Math.max(0, n));
  setOrbs(s, st.orbs.slice(0, slots), slots);
}

/**
 * The orbs' automatic passives (OrbModel.TriggerPassive over a snapshot, front first): at the turn's end
 * all but Plasma's, at its start only Plasma's (`plasma`); Gold-Plated Cables triggers the front one
 * twice. `all`: every orb (Emotion Chip's OrbCmd.Passive with the hooks).
 */
function triggerOrbs(s: State, which: "end" | "plasma" | "all"): void {
  const orbs = orbsOf(s);
  if (orbs.length === 0) return;
  const cables = s.relics.includes("GOLD_PLATED_CABLES");
  const after: Orb[] = [];
  orbs.forEach((o, i) => {
    const fires = which === "all" || (which === "plasma") === (o.id === "PLASMA_ORB");
    let x = o;
    if (fires) for (let k = 0; k < (cables && i === 0 ? 2 : 1); k++) x = passive(s, x);
    after.push(x);
  });
  // Evokes during the passives cannot happen: the list is the snapshot's, with each orb's numbers after.
  setOrbs(s, after);
}

/** Every Dark orb's passive, `times` times each, orb by orb, no Gold-Plated Cables (Darkness's OrbCmd.Passive). */
function darkPassives(s: State, times: number): void {
  setOrbs(s, orbsOf(s).map((o) => {
    let x = o;
    if (o.id === "DARK_ORB") for (let k = 0; k < times; k++) x = passive(s, x);
    return x;
  }));
}

/** The kinds of orb held (IL: Orbs.GroupBy(Id).Count()). */
export const distinctOrbs = (s: State) => new Set(orbsOf(s).map((o) => o.id)).size;

// ---- Cards and tokens --------------------------------------------------------------------------------

function token(id: string, cost: number, type: string, target: string, keywords: string[], vars: Record<string, number> = {}, upgrades = 0): Card {
  return { id, cost, costsX: false, type, target, keywords, vars, upgrades, locked: false, glows: false };
}
const DAZED = token("DAZED", -1, "Status", "None", ["Ethereal", "Unplayable"]);
const BURN = token("BURN", -1, "Status", "None", ["Unplayable"], { Damage: 2 });
const WOUND = token("WOUND", -1, "Status", "None", ["Unplayable"]);
const SLIMED = token("SLIMED", 1, "Status", "Self", ["Exhaust"]);
const VOID = token("VOID", -1, "Status", "None", ["Unplayable", "Ethereal"], { Energy: 1 });
const fuel = (upgraded: boolean) => token("FUEL", 0, "Skill", "Self", ["Exhaust"], { Energy: upgraded ? 2 : 1 }, upgraded ? 1 : 0);

/**
 * A Status the player's own card makes (IL: AddGeneratedCardToCombat with the player as creator), into
 * the discard pile, and what answers it: Smokestack's damage to every enemy, Trash to Treasure's random
 * orbs, every Rocket Punch 1 cheaper until played. An enemy's Statuses (no creator) answer nothing.
 */
function makeStatus(s: State, c: Card): void {
  s.discard.push({ ...c });
  zapAll(s, power(s, "SMOKESTACK"));
  channelRandom(s, power(s, "TRASH_TO_TREASURE"));
  const cheaper = (x: Card) => (x.id === "ROCKET_PUNCH" && x.cost > 0 ? { ...x, cost: x.cost - 1 } : x);
  s.hand = s.hand.map(cheaper);
  s.draw = s.draw.map(cheaper);
  s.discard = s.discard.map(cheaper);
}

/** Temporary Focus (IL: TemporaryFocusPower): its power and the Focus, given back at the end of the turn; `sign` −1 for Hyperbeam's. */
function tempFocus(s: State, key: string, n: number, sign = 1): void {
  if (n <= 0) return;
  addPower(s.player, key, n);
  addPower(s.player, "FOCUS", sign * n);
  if ((s.player.powers["FOCUS"] ?? 0) === 0) delete s.player.powers["FOCUS"];
}
const TEMP_FOCUS: readonly [string, number][] = [["FOCUSED_STRIKE", 1], ["HOTFIX", 1], ["SYNCHRONIZE", 1], ["HYPERBEAM_FOCUS_DOWN", -1]];
/** Focus that outlives the turn: the temporary powers' part taken out. */
export const lastingFocus = (s: State) => focus(s) - TEMP_FOCUS.reduce((a, [k, sign]) => a + sign * power(s, k), 0);

/** Cards played this turn so far, the one resolving not counted (Echo Form, FTL): the runner's before the observation, the model's since. */
const playsThisTurn = (s: State) => (s.playedBefore?.length ?? 0) + s.played;

/** What the game computed at the observation for a calculated var, where the card had one. */
const shown = (c: Card, name: string) => c.calc?.[name];

/** The card of the discard pile Hologram takes back (and the runner's select with it): the dearest card that is not a Status or Curse. */
export function hologramPick(cards: readonly { id: string; type: string; cost?: number }[]): number {
  let best = -1;
  cards.forEach((c, i) => {
    if (c.type === "Status" || c.type === "Curse") return;
    const b = best >= 0 ? cards[best]! : undefined;
    const worth = (x: { type: string; cost?: number }) => (x.type === "Power" ? 10 : 0) + Math.max(0, x.cost ?? 1);
    if (!b || worth(c) > worth(b)) best = i;
  });
  return best >= 0 ? best : Math.max(0, cards.length - 1);
}

const hitOnce = (s: State, c: Card, t: Enemy | undefined) => strike(s, one(t), dmg(s, c, t), 1);
const hitAll = (s: State, c: Card) => strike(s, alive(s), dmg(s, c), 1);

const SPECIAL: Record<string, Rule> = {
  // Channel 1 Lightning.
  ZAP: (s) => channel(s, "LIGHTNING_ORB"),
  // The front orb evoked in place, then again and removed; nothing with no orbs.
  DUALCAST: (s) => evokeFront(s, 2),
  // The hit, then a copy that costs 0 for the fight into the discard pile.
  ADAPTIVE_STRIKE: (s, c, t) => {
    hitOnce(s, c, t);
    s.discard.push({ ...c, cost: 0 });
  },
  // The hit, then every 0-cost card (not X) of the discard pile, attack, skill or power, into the hand.
  ALL_FOR_ONE: (s, c, t) => {
    hitOnce(s, c, t);
    const back = s.discard.filter((x) => x.cost === 0 && !x.costsX && (x.type === "Attack" || x.type === "Skill" || x.type === "Power"));
    for (const x of back) {
      if (s.hand.length + s.drawn >= HAND_LIMIT) break;
      s.discard.splice(s.discard.indexOf(x), 1);
      s.hand.push({ ...x, locked: false });
    }
  },
  BALL_LIGHTNING: (s, c, t) => {
    hitOnce(s, c, t);
    channel(s, "LIGHTNING_ORB");
  },
  // A hit for every orb held.
  BARRAGE: (s, c, t) => strike(s, one(t), dmg(s, c, t), orbsOf(s).length),
  // Block, and a Dazed of the player's own into the discard pile.
  BOOST_AWAY: (s, c, t, x) => {
    standard(s, c, t, x);
    makeStatus(s, DAZED);
  },
  // A slot less (the newest orb past it gone, unevoked), then Strength and Dexterity.
  BULK_UP: (s, c) => {
    removeSlots(s, num(c, "OrbSlots") || 1);
    applyPower(s, s.player, "STRENGTH", num(c, "StrengthPower"));
    applyPower(s, s.player, "DEXTERITY", num(c, "DexterityPower"));
  },
  // Slots (no power).
  CAPACITOR: (s, c) => addSlots(s, num(c, "Repeat") || 2),
  CHAOS: (s, c) => channelRandom(s, num(c, "Repeat") || 1),
  // Block, and an energy next turn (EnergyNextTurnPower), not now.
  CHARGE_BATTERY: (s, c) => {
    gainBlock(s, blockGain(num(c, "Block"), s.player), true);
    addPower(s.player, "ENERGY_NEXT_TURN", num(c, "Energy") || 1);
  },
  // A Frost for every enemy there is to hit.
  CHILL: (s) => channel(s, "FROST_ORB", alive(s).length),
  // The hit, then every Claw of the fight 2 (3) more damage: the others here, this one as it goes to its pile (afterCard).
  CLAW: (s, c, t) => {
    hitOnce(s, c, t);
    const more = (x: Card) => (x.id === "CLAW" ? { ...x, vars: { ...x.vars, Damage: (x.vars["Damage"] ?? 0) + (num(c, "Increase") || 2) } } : x);
    s.hand = s.hand.map(more);
    s.draw = s.draw.map(more);
    s.discard = s.discard.map(more);
    s.exhaust = s.exhaust.map(more);
  },
  COLD_SNAP: (s, c, t) => {
    hitOnce(s, c, t);
    channel(s, "FROST_ORB");
  },
  // Block; every Status in the hand becomes a Fuel (upgraded with it).
  COMPACT: (s, c) => {
    gainBlock(s, blockGain(num(c, "Block"), s.player), true);
    s.hand = s.hand.map((x) => (x.type === "Status" ? fuel(c.upgrades > 0) : x));
  },
  // The hit, then a card for every kind of orb held.
  COMPILE_DRIVER: (s, c, t) => {
    hitOnce(s, c, t);
    draw(s, distinctOrbs(s));
  },
  CONSUMING_SHADOW: (s, c) => {
    channel(s, "DARK_ORB", num(c, "Repeat") || 2);
    applyPower(s, s.player, "CONSUMING_SHADOW", num(c, "ConsumingShadowPower") || 1);
  },
  COOLHEADED: (s, c) => {
    channel(s, "FROST_ORB");
    draw(s, num(c, "Cards") || 1);
  },
  // A Dark, then every Dark orb's passive once (twice upgraded).
  DARKNESS: (s, c) => {
    channel(s, "DARK_ORB");
    darkPassives(s, c.upgrades > 0 ? 2 : 1);
  },
  // Energy as much as there is, after its own cost.
  DOUBLE_ENERGY: (s) => {
    s.energy += s.energy;
  },
  // Block, and two Wounds of the player's own into the discard pile.
  FIGHT_THROUGH: (s, c) => {
    gainBlock(s, blockGain(num(c, "Block"), s.player), true);
    makeStatus(s, WOUND);
    makeStatus(s, WOUND);
  },
  // Every Status of the hand, draw and discard piles exhausted, then a random enemy hit for each.
  FLAK_CANNON: (s, c) => {
    const n = [...s.hand, ...s.draw, ...s.discard].filter((x) => x.type === "Status").length;
    for (const pile of ["hand", "draw", "discard"] as const) {
      const keep = s[pile].filter((x) => x.type !== "Status");
      for (const x of s[pile].filter((y) => y.type === "Status")) exhaustCard(s, x);
      s[pile] = keep;
    }
    for (let i = 0; i < n; i++) {
      const e = alive(s);
      if (e.length === 0) break;
      if (e.length > 1) s.exact = false;
      strike(s, [e[i % e.length]!], dmg(s, c), 1);
    }
  },
  // The hit, then Focus for the turn.
  FOCUSED_STRIKE: (s, c, t) => {
    hitOnce(s, c, t);
    tempFocus(s, "FOCUSED_STRIKE", num(c, "FocusPower") || 1);
  },
  // The hit; a card if fewer than 3 (4) cards were played before it this turn.
  FTL: (s, c, t) => {
    hitOnce(s, c, t);
    if (playsThisTurn(s) < (num(c, "PlayMax") || 3)) draw(s, num(c, "Cards") || 1);
  },
  FUSION: (s) => channel(s, "PLASMA_ORB"),
  // Its block as it stands (it grows 3 (4) a play: afterCard).
  GENETIC_ALGORITHM: (s, c) => gainBlock(s, blockGain(num(c, "Block"), s.player), true),
  GLACIER: (s, c) => {
    gainBlock(s, blockGain(num(c, "Block"), s.player), true);
    channel(s, "FROST_ORB", 2);
  },
  GLASSWORK: (s, c) => {
    gainBlock(s, blockGain(num(c, "Block"), s.player), true);
    channel(s, "GLASS_ORB");
  },
  // The hit; Weak only on a target that means to attack.
  GO_FOR_THE_EYES: (s, c, t) => {
    hitOnce(s, c, t);
    if (t && t.alive && t.intents.some((i) => i.type === "Attack")) applyPower(s, t, "WEAK", num(c, "WeakPower") || 1);
  },
  // Three hits, then a Slimed of the player's own.
  GUNK_UP: (s, c, t) => {
    strike(s, one(t), dmg(s, c, t), num(c, "Repeat") || 3);
    makeStatus(s, SLIMED);
  },
  // A hit for every energy paid for cards this turn before it (the game's count at the observation, and since).
  HELIX_DRILL: (s, c, t) => strike(s, one(t), dmg(s, c, t), Math.max(0, (shown(c, "CalculatedHits") ?? 0) + (mine(s)?.dfSpentBefore ?? count(s, "dfSpent")))),
  // Block, then a card of the discard pile into the hand (the choice: hologramPick).
  HOLOGRAM: (s, c) => {
    gainBlock(s, blockGain(num(c, "Block"), s.player), true);
    if (s.discard.length === 0 || s.hand.length + s.drawn >= HAND_LIMIT) return;
    const i = hologramPick(s.discard);
    s.hand.push({ ...s.discard.splice(i, 1)[0]!, locked: false });
  },
  HOTFIX: (s, c) => tempFocus(s, "HOTFIX", num(c, "FocusPower") || 2),
  // Every enemy hit, then 3 Focus less for the turn only.
  HYPERBEAM: (s, c) => {
    hitAll(s, c);
    tempFocus(s, "HYPERBEAM_FOCUS_DOWN", num(c, "FocusPower") || 3, -1);
  },
  ICE_LANCE: (s, c, t) => {
    hitOnce(s, c, t);
    channel(s, "FROST_ORB", num(c, "Repeat") || 3);
  },
  METEOR_STRIKE: (s, c, t) => {
    hitOnce(s, c, t);
    channel(s, "PLASMA_ORB", 3);
  },
  // A slot, cards; it costs 1 more for the fight (afterCard).
  MODDED: (s, c) => {
    addSlots(s, num(c, "Repeat") || 1);
    draw(s, num(c, "Cards") || 1);
  },
  // The front orb evoked X times (X+1 upgraded), removed on the last.
  MULTI_CAST: (s, c, _t, x) => evokeFront(s, x + (c.upgrades > 0 ? 1 : 0)),
  // The hit, Weak whatever it means to do, then a Dark.
  NULL: (s, c, t, x) => {
    standard(s, c, t, x);
    channel(s, "DARK_ORB");
  },
  // Cards, then a Burn of the player's own.
  OVERCLOCK: (s, c) => {
    draw(s, num(c, "Cards") || 2);
    makeStatus(s, BURN);
  },
  QUADCAST: (s, c) => evokeFront(s, num(c, "Repeat") || 4),
  RAINBOW: (s) => {
    channel(s, "LIGHTNING_ORB");
    channel(s, "FROST_ORB");
    channel(s, "DARK_ORB");
  },
  // The hand under the draw pile, discard and draw shuffled together, then cards.
  REBOOT: (s, c) => {
    s.exact = false;
    s.draw = [...s.hand, ...s.draw, ...s.discard];
    s.hand = [];
    s.discard = [];
    s.drawn = 0;
    draw(s, num(c, "Cards") || 4);
  },
  // Two hits whatever its Repeat, then Repeat Glass.
  REFRACT: (s, c, t) => {
    strike(s, one(t), dmg(s, c, t), 2);
    channel(s, "GLASS_ORB", num(c, "Repeat") || 2);
  },
  // A card of the hand exhausted (the choice: junkIndex, as the runner's), and energy next turn.
  SCAVENGE: (s, c) => {
    if (s.hand.length > 0) {
      s.exact = false;
      for (const x of s.hand.splice(junkIndex(s.hand), 1)) exhaustCard(s, x);
    }
    addPower(s.player, "ENERGY_NEXT_TURN", num(c, "Energy") || 2);
  },
  // The hit, cards, and the drawn ones that do not cost 0 (X too, Statuses and Curses) discarded: the
  // draw pile's cards as the model has them, the 0-cost ones kept as unknown draws.
  SCRAPE: (s, c, t) => {
    hitOnce(s, c, t);
    s.exact = false;
    for (let n = Math.min(num(c, "Cards") || 4, HAND_LIMIT - s.hand.length - s.drawn); n > 0; n--) {
      const x = takeFromDraw(s);
      if (!x) break;
      if (x.cost === 0 && !x.costsX) s.drawn++;
      else s.discard.push(x);
    }
  },
  SHADOW_SHIELD: (s, c) => {
    gainBlock(s, blockGain(num(c, "Block"), s.player), true);
    channel(s, "DARK_ORB");
  },
  // Every enemy hit, then every orb held evoked twice, front to back, each removed on its second.
  SHATTER: (s, c) => {
    hitAll(s, c);
    const n = orbsOf(s).length;
    for (let i = 0; i < n; i++) {
      evokeNext(s, false);
      evokeNext(s, true);
    }
  },
  // Upgraded, a Glass now; the power channels Glass every turn to come.
  SPINNER: (s, c) => {
    if (c.upgrades > 0) channel(s, "GLASS_ORB");
    applyPower(s, s.player, "SPINNER", num(c, "SpinnerPower") || 1);
  },
  // The hit; energy if it killed.
  SUNDER: (s, c, t) => {
    const was = t?.alive ?? false;
    hitOnce(s, c, t);
    if (was && t && !t.alive) s.energy += num(c, "Energy") || 3;
  },
  // Focus for the turn: 1 (2) for every kind of orb held.
  SYNCHRONIZE: (s, c) => tempFocus(s, "SYNCHRONIZE", (num(c, "CalculationExtra") || 1) * distinctOrbs(s)),
  // The hit; the next Power card costs 0.
  SYNTHESIS: (s, c, t) => {
    hitOnce(s, c, t);
    addPower(s.player, "FREE_POWER", 1);
  },
  // X Lightning (X+1 upgraded).
  TEMPEST: (s, c, _t, x) => channel(s, "LIGHTNING_ORB", x + (c.upgrades > 0 ? 1 : 0)),
  // The hit, then every Lightning's passive at the target (twice each upgraded).
  TESLA_COIL: (s, c, t) => {
    hitOnce(s, c, t);
    if (!t) return;
    const times = c.upgrades > 0 ? 2 : 1;
    for (const o of orbsOf(s).filter((x) => x.id === "LIGHTNING_ORB")) for (let k = 0; k < times; k++) passive(s, o, t);
  },
  // Energy, then a Void of the player's own.
  TURBO: (s, c) => {
    s.energy += num(c, "Energy") || 2;
    makeStatus(s, VOID);
  },
  // Two hits, then a random attack of the draw pile played for free.
  UPROAR: (s, c, t) => {
    strike(s, one(t), dmg(s, c, t), 2);
    const attacks = s.draw.filter((x) => x.type === "Attack" && !x.keywords.includes("Unplayable"));
    if (attacks.length === 0) return;
    s.exact = false;
    const pick = attacks[attacks.length - 1]!;
    s.draw.splice(s.draw.lastIndexOf(pick), 1);
    autoPlay(s, pick);
  },
  // A Lightning for every Lightning channeled this fight (the game's count at the observation, and since).
  VOLTAIC: (s, c) => channel(s, "LIGHTNING_ORB", (shown(c, "CalculatedChannels") ?? 0) + count(s, "dfLightning")),
  // A random Power card of the Defect's into the hand, free this turn: not known.
  WHITE_NOISE: (s) => {
    s.exact = false;
    if (s.hand.length + s.drawn < HAND_LIMIT) s.drawn++;
  },
};

// ---- The turn's end and the next turn's start --------------------------------------------------------

/** The player's end of the turn before the enemies (sim.ts endOfTurn): Hailstorm, the orbs' passives, Consuming Shadow. */
function endTurn(s: State): void {
  // Hailstorm (IL: BeforeSideTurnEnd): a Frost orb held, its amount to every enemy.
  const hail = power(s, "HAILSTORM");
  if (hail > 0 && orbsOf(s).some((o) => o.id === "FROST_ORB")) zapAll(s, hail);
  triggerOrbs(s, "end");
  // Consuming Shadow (IL: AfterSideTurnEnd): the newest orb evoked, a stack at a time, if there were orbs.
  if (orbsOf(s).length > 0) for (let i = 0; i < power(s, "CONSUMING_SHADOW"); i++) evokeLast(s);
}

/** What the Defect's powers and relics do as the next turn begins (turn.ts nextTurn's hook). */
function startTurn(prev: State, next: State): void {
  const p = next.player.powers;
  // The temporary Focus goes back at the end of the turn (IL: TemporaryFocusPower.AfterSideTurnEnd).
  for (const [k, sign] of TEMP_FOCUS) {
    const n = p[k] ?? 0;
    if (n === 0) continue;
    p["FOCUS"] = (p["FOCUS"] ?? 0) - sign * n;
    if (p["FOCUS"] === 0) delete p["FOCUS"];
    delete p[k];
  }
  // Signal Boost and Free Power last until used; Feral's count starts again.
  set(next, { dfSpent: 0, dfSpentBefore: 0, dfFeral: 0 });
  const pv = next.player.powerVars;
  if (pv?.["FERAL"]) next.player.powerVars = { ...pv, FERAL: { ...pv["FERAL"], zeroCostAttacksPlayed: 0 } };
  // AfterEnergyReset: Lightning Rod's Lightning (a stack a turn), Spinner's Glass.
  if ((p["LIGHTNING_ROD"] ?? 0) > 0) {
    channel(next, "LIGHTNING_ORB");
    p["LIGHTNING_ROD"]! -= 1;
    if (p["LIGHTNING_ROD"]! <= 0) delete p["LIGHTNING_ROD"];
  }
  channel(next, "GLASS_ORB", power(next, "SPINNER"));
  // Buffer's stacks the enemies' hits spent (a hit past block that would take HP, a stack each).
  const buffer = power(prev, "BUFFER");
  if (buffer > 0 && !extraTurn(prev)) {
    let block = endOfTurnBlock(prev);
    let used = 0;
    for (const h of incomingHits(prev)) {
      if (h > block && used < buffer) used++;
      block = Math.max(0, block - h);
    }
    if (used >= buffer) delete p["BUFFER"];
    else if (used > 0) p["BUFFER"] = buffer - used;
  }
  // Creative AI (IL: BeforeHandDraw): a random Power card of the Defect's into the hand a stack, not known here.
  for (let i = 0; i < power(next, "CREATIVE_AI") && next.hand.length + next.drawn < HAND_LIMIT; i++) next.drawn++;
  // Machine Learning: that many more cards in the turn's draw.
  for (let i = 0; i < power(next, "MACHINE_LEARNING") && next.hand.length < HAND_LIMIT && next.draw.length > 0; i++) next.hand.push({ ...next.draw.pop()!, locked: false });
  // AfterPlayerTurnStart: Emotion Chip, if the player lost HP last turn or in the enemies' (every orb, the hooks on); Loop (the front orb's, a stack a time).
  if (next.relics.includes("EMOTION_CHIP") && (prev.lostHp || next.player.hp < prev.player.hp)) triggerOrbs(next, "all");
  for (let i = 0; i < power(next, "LOOP") && orbsOf(next).length > 0; i++) setOrbs(next, [passive(next, orbsOf(next)[0]!), ...orbsOf(next).slice(1)]);
  // AfterSideTurnStart: Coolant's block for every kind of orb, Biased Cognition's Focus lost.
  const cool = power(next, "COOLANT") * distinctOrbs(next);
  if (cool > 0) gainBlock(next, cool);
  const biased = power(next, "BIASED_COGNITION");
  if (biased > 0) {
    p["FOCUS"] = (p["FOCUS"] ?? 0) - biased;
    if (p["FOCUS"] === 0) delete p["FOCUS"];
  }
  // Last, the Plasma orbs' energy.
  triggerOrbs(next, "plasma");
}

// ---- The evaluation ----------------------------------------------------------------------------------

/** Each turn later is worth this much less (the fight may end first), as the Silent's Poison. */
const DECAY = 0.85;
/** HP a point of block a turn to come is worth (not every point will be needed), and an energy. */
const BLOCK_WORTH = 0.6;
const ENERGY_WORTH = 2;

/** Turns the fight will likely last after this one: the enemies' HP at the deck's pace, at most four. */
function turnsLeft(s: State): number {
  const live = alive(s);
  if (live.length === 0) return 0;
  const cards = [...s.hand, ...s.draw, ...s.discard];
  const damage = cards.reduce((a, c) => a + (c.type === "Attack" ? (c.vars["Damage"] ?? 0) * Math.max(1, c.vars["Repeat"] ?? 1) : 0), 0);
  const orbDamage = orbsOf(s).reduce((a, o) => a + (o.id === "LIGHTNING_ORB" ? passiveOf(s, o) : o.id === "GLASS_ORB" ? passiveOf(s, o) * live.length : 0), 0);
  const pace = Math.max(4, (damage / Math.max(1, cards.length)) * 5 * 0.75 + orbDamage);
  return Math.min(4, Math.max(0, live.reduce((a, e) => a + e.hp, 0) / pace - 1));
}
/** 1 + DECAY + DECAY² … over `t` turns (a part turn counted in part). */
function discounted(t: number): number {
  let sum = 0;
  for (let i = 0; i < Math.ceil(t); i++) sum += Math.pow(DECAY, i) * Math.min(1, t - i);
  return sum;
}

/**
 * What the orbs and the Defect's powers will give over the turns to come (this turn's end is already in
 * the state), on evaluate's scale: damage at enemyHp, block at BLOCK_WORTH, energy at ENERGY_WORTH, a
 * card at drawn. Every value at the Focus that lasts; an orb's evoke counted in part (it comes when an
 * orb is pushed out, or not at all).
 */
export function defectAhead(s: State, w: Weights): number {
  const st = mine(s);
  const p = s.player.powers;
  const live = alive(s);
  if (live.length === 0) return 0;
  if (!on(s)) return 0;
  const engines = ["LOOP", "STORM", "HAILSTORM", "SPINNER", "COOLANT", "LIGHTNING_ROD", "BIASED_COGNITION", "MACHINE_LEARNING", "ECHO_FORM", "BUFFER",
    "THUNDER", "SUBROUTINE", "TRASH_TO_TREASURE", "SMOKESTACK", "FERAL", "CONSUMING_SHADOW", "CREATIVE_AI", "ITERATION"];
  if (!st && !engines.some((k) => (p[k] ?? 0) > 0)) return 0;
  const t = turnsLeft(s);
  if (t <= 0) return 0;
  const d = discounted(t);
  const f = lastingFocus(s);
  const orbs = st?.orbs ?? [];
  const cables = s.relics.includes("GOLD_PLATED_CABLES");
  /** An orb's passive a turn, on evaluate's scale. */
  const perTurn = (o: Orb): number => {
    const v = passiveOf(s, o, f);
    switch (o.id) {
      case "LIGHTNING_ORB": return v * w.enemyHp;
      case "FROST_ORB": return v * BLOCK_WORTH;
      case "DARK_ORB": return v * 0.6 * w.enemyHp;
      case "PLASMA_ORB": return v * ENERGY_WORTH;
      case "GLASS_ORB": return 0;
    }
  };
  let score = 0;
  orbs.forEach((o, i) => {
    const times = cables && i === 0 ? 2 : 1;
    if (o.id === "GLASS_ORB") {
      // Its hits run down a point a turn (to Focus's, with Focus).
      let base = o.n ?? 4;
      for (let k = 0; k < Math.ceil(t); k++) {
        for (let r = 0; r < times; r++) {
          const v = Math.max(0, base + f);
          if (v <= 0) break;
          score += v * live.length * w.enemyHp * Math.pow(DECAY, k) * Math.min(1, t - k);
          base = Math.max(0, base - 1);
        }
      }
    } else score += perTurn(o) * times * d;
    // The evoke still to come, in part: a Dark's is most of its worth.
    const ev = evokeOf(s, o, f);
    score += o.id === "DARK_ORB" ? ev * 0.6 * w.enemyHp : o.id === "FROST_ORB" ? ev * BLOCK_WORTH * 0.3 : o.id === "PLASMA_ORB" ? ev * ENERGY_WORTH * 0.3 : ev * (o.id === "GLASS_ORB" ? live.length : 1) * w.enemyHp * 0.3;
  });
  // Focus and slots for the orbs still to be channeled: half the empty slots filled, a point each a turn.
  const empty = Math.max(0, (st?.orbSlots ?? DEFECT_SLOTS) - orbs.length);
  score += Math.max(0, f) * empty * 0.5 * 0.8 * d;
  // The powers: each one's gain a turn.
  const g = (k: string) => Math.max(0, p[k] ?? 0);
  const lightning = (3 + Math.max(0, f)) * w.enemyHp;
  let gain = 0;
  if (orbs[0]) gain += g("LOOP") * perTurn(orbs[0]);
  gain += g("STORM") * 0.3 * lightning;
  gain += g("HAILSTORM") * live.length * w.enemyHp * (orbs.some((o) => o.id === "FROST_ORB") ? 0.9 : 0.5);
  gain += g("SPINNER") * (4 + Math.max(0, f)) * live.length * w.enemyHp * 0.8;
  gain += g("COOLANT") * Math.max(1, distinctOrbs(s)) * BLOCK_WORTH;
  gain -= g("BIASED_COGNITION") * Math.max(1, orbs.length) * 0.8 * (t + 1) / 2;
  gain += g("MACHINE_LEARNING") * w.drawn;
  gain += g("ECHO_FORM") * 4;
  gain += g("THUNDER") * 0.4 * w.enemyHp;
  gain += g("SUBROUTINE") * 0.3 * ENERGY_WORTH;
  gain += (g("TRASH_TO_TREASURE") * 0.3 * lightning) + g("SMOKESTACK") * 0.3 * live.length * w.enemyHp;
  gain += g("FERAL") * 0.5 * w.drawn;
  gain += g("CONSUMING_SHADOW") * 3 * w.enemyHp;
  gain += g("CREATIVE_AI") * 2;
  gain += g("ITERATION") * 0.3 * w.drawn;
  score += gain * d;
  // Lightning Rod's Lightning for the turns it has left, Buffer's hits stopped (once each).
  score += Math.min(g("LIGHTNING_ROD"), Math.ceil(t)) * (lightning * Math.max(1, t / 2) + 8 * w.enemyHp * 0.3);
  score += g("BUFFER") * 6;
  return Math.min(80, score);
}

// ---- The hooks ---------------------------------------------------------------------------------------

/** The bridge's orbs: base numbers (Dark's evoke so far, Glass's passive before Focus) from their own fields. */
function fromBridge(obs: Observation): Ext | undefined {
  if (obs.orb_slots === undefined && !obs.player_orbs) return undefined;
  const orbs: Orb[] = [];
  for (const o of obs.player_orbs ?? []) {
    const id = o.id.replace(/^ORB\./, "").toUpperCase() as OrbId;
    if (!ORB_IDS.includes(id)) continue;
    if (id === "DARK_ORB") orbs.push({ id, n: o.fields?.["_evokeVal"] ?? o.evoke });
    else if (id === "GLASS_ORB") orbs.push({ id, n: o.fields?.["_passiveVal"] ?? 4 });
    else orbs.push({ id });
  }
  return { orbs, orbSlots: obs.orb_slots ?? orbs.length };
}

/** A short text of the orbs, for the state's key and the checks against the game: "3:LIGHTNING DARK12". */
export function orbKey(s: State): string | undefined {
  const st = mine(s);
  if (!st) return undefined;
  return `${st.orbSlots}:${st.orbs.map((o) => `${o.id.replace(/_ORB$/, "")}${o.n ?? ""}`).join(" ")}`;
}

/** A Power card (Storm, Subroutine, Signal Boost and Free Power answer them). */
const POWER_CARD = (c: Card) => c.type === "Power";

const DEFECT_RULES: CharacterRules = {
  special: SPECIAL,
  potions: {
    // Potion of Capacity: 2 slots; Essence of Darkness: a Dark for every slot there is.
    POTION_OF_CAPACITY: (s, n) => addSlots(s, n || 2),
    ESSENCE_OF_DARKNESS: (s) => channel(s, "DARK_ORB", orbState(s).orbSlots),
  },

  fromObservation(obs, s) {
    const x = fromBridge(obs);
    if (x) setOrbs(s, x.orbs, x.orbSlots);
  },

  cost(s, card, cost) {
    // Free Power (Synthesis; IL: FreePowerPower.TryModifyEnergyCostInCombatLate): a Power card in hand costs 0.
    return POWER_CARD(card) && power(s, "FREE_POWER") > 0 ? 0 : cost;
  },

  beforePlay(s, card) {
    if (!on(s)) return;
    const paid = card.costsX ? 0 : costOf(s, card);
    const spent = count(s, "dfSpent");
    set(s, {
      dfSpentBefore: spent, dfSpent: spent + paid, dfPlayed: `${card.id}:${card.costsX ? -1 : card.cost}`,
      // Storm's and Subroutine's amounts as a Power card begins (IL: BeforeCardPlayed): the Storm that makes the power gives none.
      ...(POWER_CARD(card) ? { dfStorm: power(s, "STORM"), dfSub: power(s, "SUBROUTINE") } : { dfStorm: 0, dfSub: 0 }),
    });
    // Free Power is spent by the Power card played, free already or not (IL: FreePowerPower.BeforeCardPlayed).
    if (POWER_CARD(card) && power(s, "FREE_POWER") > 0) {
      addPower(s.player, "FREE_POWER", -1);
      if (power(s, "FREE_POWER") <= 0) delete s.player.powers["FREE_POWER"];
    }
  },

  extraPlays(s, card) {
    let n = 0;
    // Echo Form (IL: EchoFormPower.ModifyCardPlayCount): the turn's first cards, a stack each, once more;
    // not the Echo Form that makes the power (it is not there yet as that card's plays are counted).
    const echo = power(s, "ECHO_FORM") - (card.id === "ECHO_FORM" ? num(card, "EchoForm") || 1 : 0);
    if (echo > playsThisTurn(s)) n++;
    // Signal Boost: a Power card once more, a stack spent.
    if (POWER_CARD(card) && power(s, "SIGNAL_BOOST") > 0) {
      n++;
      addPower(s.player, "SIGNAL_BOOST", -1);
      if (power(s, "SIGNAL_BOOST") <= 0) delete s.player.powers["SIGNAL_BOOST"];
    }
    if (n > 0 && on(s)) set(s, { dfPlays: 1 + n });
    return n;
  },

  afterPlay(s, card) {
    if (!POWER_CARD(card) || !on(s)) return;
    const x = mine(s);
    const plays = x?.dfPlays ?? 1;
    // Storm: its amount in Lightning a play; Subroutine: its amount in energy a play.
    channel(s, "LIGHTNING_ORB", (x?.dfStorm ?? 0) * plays);
    s.energy += (x?.dfSub ?? 0) * plays;
    set(s, { dfStorm: 0, dfSub: 0, dfPlays: 1 });
  },

  afterCard(s, card) {
    switch (card.id) {
      case "CLAW": return { ...card, vars: { ...card.vars, Damage: (card.vars["Damage"] ?? 0) + (card.vars["Increase"] ?? 2) } };
      case "GENETIC_ALGORITHM": return { ...card, vars: { ...card.vars, Block: (card.vars["Block"] ?? 1) + (card.vars["Increase"] ?? 3) } };
      case "MODDED": return { ...card, cost: card.cost + 1 };
      case "MOMENTUM_STRIKE": return { ...card, cost: 0 };
      // Rocket Punch's cuts are until played: back to its 2.
      case "ROCKET_PUNCH": return { ...card, cost: 2 };
      default: return card;
    }
  },

  resultPile(s, card) {
    // Feral (IL: FeralPower.ModifyCardPlayResultLocation): an attack played at cost 0, a stack a turn, back into the hand.
    if (card.type !== "Attack" || power(s, "FERAL") <= 0) return undefined;
    const x = mine(s);
    const played = x?.dfPlayed?.startsWith(`${card.id}:`) ? Number(x.dfPlayed.split(":")[1]) : card.cost;
    set(s, { dfPlayed: "" });
    const used = powerVar(s.player, "FERAL", "zeroCostAttacksPlayed", 0) + count(s, "dfFeral");
    if (played !== 0 || used >= power(s, "FERAL")) return undefined;
    set(s, { dfFeral: count(s, "dfFeral") + 1 });
    return "hand";
  },

  endOfTurn: {
    needed: (s) => orbsOf(s).length > 0 || power(s, "HAILSTORM") > 0,
    run: endTurn,
  },

  nextTurn: (prev, next) => {
    if (!mine(next) && !isDefect(next) && !TEMP_FOCUS.some(([k]) => (next.player.powers[k] ?? 0) !== 0)) return;
    startTurn(prev, next);
  },

  evaluate: defectAhead,

  soak(s) {
    // Buffer (IL: BufferPower.ModifyHpLostAfterOstyLate): the next hits that would take HP take none, a stack each.
    let left = on(s) ? power(s, "BUFFER") : 0;
    if (left <= 0) return undefined;
    return (past) => {
      if (past <= 0 || left <= 0) return past;
      left--;
      return 0;
    };
  },

  keyExt(s) {
    const x = mine(s);
    if (!x) return "";
    return `${orbKey(s)}/${x.dfSpent ?? 0}/${x.dfLightning ?? 0}/${x.dfFeral ?? 0}`;
  },

  combatSelect(source, purpose, cards) {
    // Hologram's pick of the discard pile is the model's (hologramPick).
    if (source === "HOLOGRAM" && /CombatPile/i.test(purpose)) return hologramPick(cards);
    return undefined;
  },
};

// ---- Card choices (from the humans' v0.111 A10 runs: data/defect/) ----------------------------------

/** The Defect's cards for choices.ts: tiers = A10 Elo against skipping, then the per-act pick score; pick = the human take rate by act. */
const CARDS: Record<string, CardRow> = {
  ADAPTIVE_STRIKE: { tiers: "CACC", pick: [31, 6, 18] }, // Elo -59, offered 149/100/9
  ALL_FOR_ONE: { tiers: "ASAC", pick: [39, 37, 38] }, // Elo +156, offered 176/93/17
  BALL_LIGHTNING: { tiers: "DBFF", pick: [29, 5, 1] }, // Elo -206, offered 1047/579/289
  BARRAGE: { tiers: "DBDD", pick: [19, 12, 7] }, // Elo -227, offered 1044/608/265
  BEAM_CELL: { tiers: "CBDD", pick: [25, 13, 11] }, // Elo -86, offered 1022/545/295
  BOOST_AWAY: { tiers: "CABC", pick: [35, 35, 26] }, // Elo -32, offered 997/565/288
  BOOT_SEQUENCE: { tiers: "BABB", pick: [53, 47, 45] }, // Elo +64, offered 395/180/94
  BUFFER: { tiers: "BSAC", pick: [41, 44, 42] }, // Elo +74, offered 158/90/17
  BULK_UP: { tiers: "CABC", pick: [42, 33, 24] }, // Elo -10, offered 354/199/108
  CAPACITOR: { tiers: "BAAB", pick: [43, 48, 49] }, // Elo +97, offered 359/190/105
  CHAOS: { tiers: "DBDF", pick: [14, 7, 3] }, // Elo -197, offered 350/202/76
  CHARGE_BATTERY: { tiers: "BACC", pick: [44, 27, 20] }, // Elo +5, offered 1011/592/287
  CHILL: { tiers: "BSBC", pick: [58, 46, 23] }, // Elo +55, offered 389/178/94
  CLAW: { tiers: "CACD", pick: [34, 18, 15] }, // Elo -20, offered 1028/532/274
  COLD_SNAP: { tiers: "DADF", pick: [30, 9, 4] }, // Elo -161, offered 1106/573/304
  COMPACT: { tiers: "BABB", pick: [37, 42, 49] }, // Elo +102, offered 361/194/86
  COMPILE_DRIVER: { tiers: "DCCD", pick: [13, 15, 8] }, // Elo -208, offered 1036/531/299
  CONSUMING_SHADOW: { tiers: "DBCC", pick: [14, 10, 12] }, // Elo -178, offered 185/88/10
  COOLANT: { tiers: "BAAC", pick: [31, 42, 36] }, // Elo +14, offered 162/100/16
  COOLHEADED: { tiers: "CABC", pick: [39, 34, 28] }, // Elo -6, offered 1027/527/290
  CREATIVE_AI: { tiers: "ASAC", pick: [41, 44, 42] }, // Elo +247, offered 162/78/10
  DARKNESS: { tiers: "CACC", pick: [42, 18, 18] }, // Elo -64, offered 384/215/98
  DEFRAGMENT: { tiers: "SSSC", pick: [75, 63, 69] }, // Elo +269, offered 155/101/9
  DOUBLE_ENERGY: { tiers: "CBCC", pick: [16, 27, 24] }, // Elo -28, offered 368/204/85
  ECHO_FORM: { tiers: "SSSC", pick: [77, 77, 77] }, // Elo +441, offered 181/92/9
  FERAL: { tiers: "BACB", pick: [32, 27, 31] }, // Elo +14, offered 364/208/118
  FIGHT_THROUGH: { tiers: "CABC", pick: [35, 35, 27] }, // Elo -11, offered 338/195/88
  FLAK_CANNON: { tiers: "ASAC", pick: [48, 50, 49] }, // Elo +158, offered 186/88/9
  FOCUSED_STRIKE: { tiers: "FCDF", pick: [11, 5, 6] }, // Elo -322, offered 986/528/283
  FTL: { tiers: "CACC", pick: [39, 27, 19] }, // Elo -40, offered 404/194/101
  FUSION: { tiers: "CBCD", pick: [22, 18, 16] }, // Elo -68, offered 377/195/93
  GENETIC_ALGORITHM: { tiers: "BSBC", pick: [34, 16, 25] }, // Elo +12, offered 159/97/11
  GLACIER: { tiers: "ASAB", pick: [79, 63, 49] }, // Elo +136, offered 375/206/103
  GLASSWORK: { tiers: "CACF", pick: [44, 21, 4] }, // Elo -118, offered 358/209/92
  GO_FOR_THE_EYES: { tiers: "CACD", pick: [37, 23, 15] }, // Elo -70, offered 1007/576/267
  GUNK_UP: { tiers: "DBDD", pick: [18, 8, 6] }, // Elo -235, offered 1059/572/283
  HAILSTORM: { tiers: "DBBC", pick: [28, 31, 20] }, // Elo -150, offered 372/210/119
  HELIX_DRILL: { tiers: "CABC", pick: [25, 18, 22] }, // Elo -5, offered 159/79/11
  HOLOGRAM: { tiers: "BABB", pick: [39, 43, 42] }, // Elo +75, offered 1070/542/289
  HOTFIX: { tiers: "DCCD", pick: [10, 14, 12] }, // Elo -133, offered 1041/571/303
  HYPERBEAM: { tiers: "DACC", pick: [27, 9, 18] }, // Elo -181, offered 178/88/7
  ICE_LANCE: { tiers: "BSBC", pick: [41, 27, 34] }, // Elo +23, offered 192/93/9
  ITERATION: { tiers: "CBBC", pick: [21, 31, 30] }, // Elo -14, offered 363/223/104
  LEAP: { tiers: "DBCF", pick: [18, 13, 6] }, // Elo -173, offered 1037/572/323
  LIGHTNING_ROD: { tiers: "DACD", pick: [33, 14, 8] }, // Elo -124, offered 1091/538/286
  LOOP: { tiers: "CBCC", pick: [25, 25, 22] }, // Elo -57, offered 359/203/91
  MACHINE_LEARNING: { tiers: "SSAC", pick: [48, 56, 52] }, // Elo +282, offered 166/82/15
  METEOR_STRIKE: { tiers: "CBCC", pick: [12, 10, 11] }, // Elo -79, offered 170/92/11
  MODDED: { tiers: "ASSC", pick: [57, 66, 62] }, // Elo +227, offered 169/89/9
  MOMENTUM_STRIKE: { tiers: "FBFF", pick: [16, 3, 1] }, // Elo -274, offered 1063/560/289
  MULTI_CAST: { tiers: "DBCC", pick: [15, 8, 12] }, // Elo -126, offered 156/83/12
  NULL: { tiers: "DACD", pick: [36, 18, 13] }, // Elo -127, offered 355/201/105
  OVERCLOCK: { tiers: "AAAB", pick: [53, 64, 53] }, // Elo +154, offered 335/200/105
  RAINBOW: { tiers: "DACC", pick: [18, 12, 15] }, // Elo -200, offered 156/107/11
  REBOOT: { tiers: "BABC", pick: [28, 28, 28] }, // Elo +109, offered 167/75/13
  REFRACT: { tiers: "DACF", pick: [50, 13, 6] }, // Elo -191, offered 371/194/101
  ROCKET_PUNCH: { tiers: "CABC", pick: [33, 34, 33] }, // Elo -50, offered 362/213/92
  SCAVENGE: { tiers: "BBCC", pick: [25, 24, 22] }, // Elo +35, offered 390/202/76
  SCRAPE: { tiers: "DCCD", pick: [12, 17, 14] }, // Elo -146, offered 356/194/96
  SHADOW_SHIELD: { tiers: "CACC", pick: [49, 25, 21] }, // Elo -63, offered 344/202/112
  SHATTER: { tiers: "BSAC", pick: [47, 33, 40] }, // Elo +12, offered 151/75/13
  SIGNAL_BOOST: { tiers: "ASBC", pick: [29, 31, 30] }, // Elo +143, offered 177/77/7
  SKIM: { tiers: "BBBB", pick: [20, 45, 49] }, // Elo +52, offered 337/166/117
  SMOKESTACK: { tiers: "DBCC", pick: [19, 19, 20] }, // Elo -155, offered 353/240/127
  SPINNER: { tiers: "BSBC", pick: [50, 25, 38] }, // Elo +9, offered 194/93/14
  STORM: { tiers: "CBBB", pick: [25, 29, 45] }, // Elo -62, offered 383/221/110
  SUBROUTINE: { tiers: "BABB", pick: [31, 42, 45] }, // Elo +76, offered 399/202/110
  SUNDER: { tiers: "FBDF", pick: [29, 6, 2] }, // Elo -381, offered 368/166/108
  SUPERCRITICAL: { tiers: "ASAC", pick: [37, 49, 43] }, // Elo +164, offered 168/95/9
  SWEEPING_BEAM: { tiers: "FBFF", pick: [16, 3, 2] }, // Elo -326, offered 1021/536/292
  SYNCHRONIZE: { tiers: "CBCC", pick: [15, 26, 28] }, // Elo -117, offered 375/200/83
  SYNTHESIS: { tiers: "FCDF", pick: [13, 11, 5] }, // Elo -307, offered 373/206/95
  TEMPEST: { tiers: "CBCC", pick: [24, 15, 16] }, // Elo -98, offered 361/201/99
  TESLA_COIL: { tiers: "DBDD", pick: [25, 11, 10] }, // Elo -123, offered 396/213/96
  THUNDER: { tiers: "CABB", pick: [39, 36, 36] }, // Elo -44, offered 387/205/104
  TRASH_TO_TREASURE: { tiers: "ASAC", pick: [44, 44, 44] }, // Elo +141, offered 189/87/8
  TURBO: { tiers: "BABB", pick: [31, 42, 36] }, // Elo +44, offered 1049/565/295
  UPROAR: { tiers: "DBDD", pick: [15, 9, 8] }, // Elo -228, offered 1044/605/318
  VOLTAIC: { tiers: "BABC", pick: [28, 22, 25] }, // Elo +87, offered 162/92/10
  WHITE_NOISE: { tiers: "AABB", pick: [46, 46, 56] }, // Elo +134, offered 390/187/89
};

export const DEFECT: CharacterRules = {
  ...DEFECT_RULES,
  character: "DEFECT",
  cards: CARDS,
  aoe: ["SWEEPING_BEAM", "HYPERBEAM", "SHATTER"],
  multiHit: ["BARRAGE", "GUNK_UP", "REFRACT", "UPROAR", "FLAK_CANNON", "HELIX_DRILL"],
  // Rest sites: what human winners upgrade most, of the cards they held (and least).
  smithFirst: ["DEFRAGMENT", "BUFFER", "BULK_UP", "STORM", "DARKNESS", "FERAL", "NULL", "HOLOGRAM", "MACHINE_LEARNING", "OVERCLOCK", "ROCKET_PUNCH", "MODDED", "LOOP", "THUNDER"],
  smithLast: ["BOOT_SEQUENCE", "FTL", "COMPILE_DRIVER", "BOOST_AWAY", "LEAP", "BALL_LIGHTNING", "COLD_SNAP", "ALL_FOR_ONE"],
};

export const _forTests = { opening, randomEnemy, weakest, discounted, turnsLeft, makeStatus, tempFocus };
