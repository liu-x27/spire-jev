/**
 * The Necrobinder's own rules (characters/index.ts has the hooks), from the game's IL at v0.111.
 *
 * Osty (IL: Player.Osty, OstyCmd.Summon, DieForYouPower) is her pet. The combat's first Summon makes
 * him: Bound Phylactery's, before turn 1, so every fight opens with him at 1/1. Summon N adds N to a
 * living Osty's max HP and HP, and brings a dead one back at N/N. While he lives he takes the part
 * past block of every enemy attack hit aimed at her, and what is left when he dies goes on to her
 * (poison, thorns and HP loss do not go to him). His attacks, the Osty Attack cards, are his: her
 * Strength, Weak and Vigor do not count, the target's Vulnerable, Calcify and Lethality do. With
 * him dead an Osty card is still played and does nothing; High Five cannot be played.
 *
 * Doom (IL: DoomPower) never decays. An enemy with HP at or under its Doom dies at the end of the
 * enemies' turn, after it has acted, as a kill (the Giant's blow still comes). On her (Neurosurge) it
 * is checked at the end of her own turn.
 *
 * Soul: a 0-cost token that draws 2 (3 upgraded) and exhausts; Haunt and Devour Life answer it.
 *
 * Her state is kept flat on State.ext, so the default shallow copy is enough.
 */

import type { Observation } from "../obs.ts";
import {
  addPower, applyPower, blockGain, type Card, costOf, counted, died, dmg, downed, draw, type Enemy, gainBlock, has, hit, hpLoss,
  one, type Soak, type State, strike, targetable, type Unit, autoPlay, HAND_LIMIT,
} from "../sim.ts";
import type { Weights } from "../search.ts";
import type { CharacterRules, Rule } from "./index.ts";

/** Her state on State.ext. */
interface Necro {
  /** Osty's HP (0: dead) and max HP; `ostyUp`: summoned this combat. */
  ostyHp: number;
  ostyMax: number;
  ostyUp: boolean;
  /** Osty's attacks this turn before the observation (Rattle's hits show it), and since. */
  ostyAttacksBefore: number;
  ostyAttacks: number;
  /** Ethereal cards played this combat before the observation (Pull From Below shows it), and since. */
  etherealBefore: number;
  ethereal: number;
  /** She applied Doom this turn (Death's Door). */
  doomed: boolean;
  /** Cards drawn in the turn since the observation (Death March). */
  drawnSince: number;
  /** Deaths since the observation (Melancholy costs 1 less for each). */
  deaths: number;
  /** Borrowed Time's cost added this turn since the observation. */
  borrowed: number;
  /** Max energy and turn-start draws the powers played since the observation add from next turn (Friendship, Demesne). */
  energyNext: number;
  drawNext: number;
}

const PHYLACTERY: Record<string, number> = { BOUND_PHYLACTERY: 1, PHYLACTERY_UNBOUND: 5 };

/** Her state, or the fight's opening where there is no observation (spar's bouts): the phylactery's summon. */
function necro(s: State): Necro | undefined {
  const x = s.ext as Partial<Necro> | undefined;
  if (x && typeof x.ostyHp === "number") return x as Necro;
  const start = s.relics.reduce((a, r) => a + (PHYLACTERY[r] ?? 0), 0);
  if (start <= 0) return undefined;
  // Phylactery Unbound summons 2 more after turn 1's draw (IL: AfterSideTurnStart).
  const opening = start + ((s.turn ?? 1) === 1 && s.relics.includes("PHYLACTERY_UNBOUND") ? 2 : 0);
  const n: Necro = blank();
  n.ostyHp = n.ostyMax = opening;
  n.ostyUp = true;
  s.ext = { ...(s.ext ?? {}), ...n };
  return s.ext as unknown as Necro;
}

const blank = (): Necro => ({
  ostyHp: 0, ostyMax: 0, ostyUp: false, ostyAttacksBefore: 0, ostyAttacks: 0, etherealBefore: 0, ethereal: 0, doomed: false,
  drawnSince: 0, deaths: 0, borrowed: 0, energyNext: 0, drawNext: 0,
});

/** Writes go through here: `s.ext` is shared with the state it was cloned from until replaced. */
function set(s: State, patch: Partial<Necro>): void {
  s.ext = { ...(s.ext ?? {}), ...patch };
}

export const ostyAlive = (s: State): boolean => (necro(s)?.ostyHp ?? 0) > 0;

/** Summon n (IL: OstyCmd.Summon): alive, max HP and HP up by n; dead or not yet made, n/n. */
export function summon(s: State, n: number): void {
  if (n <= 0) return;
  const x = necro(s) ?? blank();
  if (x.ostyHp > 0) set(s, { ostyMax: x.ostyMax + n, ostyHp: x.ostyHp + n, ostyUp: true });
  else set(s, { ostyMax: n, ostyHp: n, ostyUp: true });
}

/** Osty loses n HP (thorns, Sacrifice, the enemies' hits): Necro Mastery hits every enemy for it; at 0 he is dead. */
function ostyLoses(s: State, n0: number): void {
  const x = necro(s);
  if (!x || x.ostyHp <= 0 || n0 <= 0) return;
  const n = Math.min(n0, x.ostyHp);
  set(s, { ostyHp: x.ostyHp - n });
  if (x.ostyHp - n <= 0) set(s, { deaths: x.deaths + 1 });
  necroMastery(s, n);
}

/** Necro Mastery (IL: NecroMasteryPower.AfterCurrentHpChanged): Osty's HP lost, times its amount, to every enemy, unblockable. */
function necroMastery(s: State, lost: number): void {
  const m = s.player.powers["NECRO_MASTERY"] ?? 0;
  if (m <= 0 || lost <= 0) return;
  for (const e of s.enemies) if (e.alive) unblockable(s, e, lost * m);
}

/** Damage past block, not an attack (Necro Mastery, Haunt, Capture Spirit): Intangible and the rest still apply. */
function unblockable(s: State, e: Enemy, n: number): void {
  const block = e.block;
  e.block = 0;
  hit(e, n);
  e.block = block;
  if (!e.alive) kill(s, e);
}

/** An enemy's death since the observation: the core's, and Melancholy's count. */
function kill(s: State, e: Enemy): void {
  died(s, e);
  const x = necro(s);
  if (x) set(s, { deaths: x.deaths + 1 });
}

/** Osty as the attacker: none of her Strength, Weak or Vigor; Pen Nib, Lethality and Cruelty reach him. */
function ostyUnit(s: State): Unit {
  const x = necro(s)!;
  const p = s.player.powers;
  const powers: Record<string, number> = {};
  for (const k of ["PEN_NIB_DOUBLE", "LETHAL_NOW", "CRUELTY", "HANG_NOW"]) if ((p[k] ?? 0) > 0) powers[k] = p[k]!;
  return { hp: x.ostyHp, maxHp: x.ostyMax, block: 0, powers };
}

/** Thorns on an enemy Osty hit: back at him, through her block (IL: pets use the owner's block). */
function ostyThorns(s: State, e: Enemy): void {
  const n = e.powers["THORNS"] ?? 0;
  if (n <= 0) return;
  const absorbed = Math.min(s.player.block, n);
  s.player.block -= absorbed;
  ostyLoses(s, n - absorbed);
}

/** An Osty Attack card's own number, and Miniature Cannon's on an upgraded card. */
function ostyBase(s: State, c: Card, base: number): number {
  const cannon = c.upgrades > 0 && s.relics.includes("MINIATURE_CANNON") ? s.relicVars?.["MINIATURE_CANNON"]?.["ExtraDamage"] ?? 3 : 0;
  return base + cannon;
}

/**
 * Osty attacks (IL: DamageCmd.Attack.FromOsty): false, and nothing, if he is dead. Calcify adds to
 * every hit; each hit on an enemy with Sic 'Em summons its amount; Bone Flute gives 2 block for the
 * attack; the attack counts for Rattle and makes every Flatten cost 0 this turn.
 */
function ostyAttack(s: State, victims: readonly Enemy[], base: number, times = 1): boolean {
  const x = necro(s);
  if (!x || x.ostyHp <= 0) return false;
  const calcify = Math.max(0, s.player.powers["CALCIFY"] ?? 0);
  const sicEm = times * victims.filter((e) => e.alive && (e.powers["SIC_EM"] ?? 0) > 0).reduce((a, e) => a + e.powers["SIC_EM"]!, 0);
  strike(s, victims, base + calcify, times, ostyUnit(s), ostyThorns);
  set(s, { ostyAttacks: (necro(s)?.ostyAttacks ?? 0) + 1 });
  if (sicEm > 0) summon(s, sicEm);
  if (s.relics.includes("BONE_FLUTE")) gainBlock(s, s.relicVars?.["BONE_FLUTE"]?.["Block"] ?? 2);
  return true;
}

/** Doom on an enemy, from her (Shroud, Sleight of Flesh and Death's Door see it through afterPlay's diff). */
function doom(s: State, e: Enemy | undefined, n: number): void {
  if (!e || !targetable(e) || n <= 0) return;
  if (has(e, "ARTIFACT")) {
    addPower(e, "ARTIFACT", -1);
    return;
  }
  addPower(e, "DOOM", n);
}

const doomOf = (u: Unit) => Math.max(0, u.powers["DOOM"] ?? 0);
/** Doom at or over its HP: it dies at the end of the enemies' turn. */
export const doomed = (e: Enemy) => e.alive && doomOf(e) > 0 && e.hp <= doomOf(e);

/** A Soul (IL: Soul: cost 0, Exhaust, draw 2; upgraded, 3). */
export function soulCard(upgraded = false): Card {
  return {
    id: "SOUL", cost: 0, costsX: false, type: "Skill", target: "Self", keywords: ["Exhaust"],
    vars: { Cards: upgraded ? 3 : 2 }, upgrades: upgraded ? 1 : 0, locked: false, glows: false,
  };
}
const SWEEPING_GAZE: Card = {
  id: "SWEEPING_GAZE", cost: 0, costsX: false, type: "Attack", target: "RandomEnemy", keywords: ["Ethereal", "Exhaust"],
  vars: { OstyDamage: 10 }, upgrades: 0, locked: false, glows: false,
};

/** Souls into the draw pile at random places (IL: CardPilePosition.Random): the order is not known. */
function soulsToDraw(s: State, n: number, upgraded = false): void {
  for (let i = 0; i < n; i++) s.draw.splice(Math.floor(s.draw.length / 2), 0, soulCard(upgraded));
  if (n > 0 && s.draw.length > n) s.exact = false;
}

/** Into the hand, or the discard pile with the hand full (IL: CardPileCmd.Add). */
function toHand(s: State, c: Card): void {
  if (s.hand.length + s.drawn < HAND_LIMIT) s.hand.push({ ...c, locked: false });
  else s.discard.push(c);
}

const OSTY_ATTACKS = new Set(["BONE_SHARDS", "FETCH", "FLATTEN", "HIGH_FIVE", "POKE", "PROTECTOR", "RATTLE", "RIGHT_HAND_HAND", "SIC_EM", "SNAP", "SQUEEZE", "SWEEPING_GAZE", "UNLEASH"]);
const isBasic = (id: string) => /^(STRIKE|DEFEND)_/.test(id);

/**
 * What a card is worth keeping, for the selects her cards ask for (Snap's Retain, Graveblast's and
 * Dredge's pick, Cleanse's and Seance's loss): the same rule the runner answers the game with
 * (combatSelect), so the prediction stays the play.
 */
function worth(c: { id: string; type: string; keywords: readonly string[] }): number {
  if (c.type === "Curse" || c.type === "Status") return -10;
  if (c.id === "SOUL") return 1;
  if (isBasic(c.id)) return c.id.startsWith("DEFEND") ? 0.5 : 0;
  if (c.type === "Power") return 4;
  return OSTY_ATTACKS.has(c.id) ? 2.5 : 3;
}
const best = (cards: readonly { id: string; type: string; keywords: readonly string[] }[], ok = (_: number) => true) => {
  let at = -1;
  cards.forEach((c, i) => {
    if (ok(i) && (at < 0 || worth(c) > worth(cards[at]!))) at = i;
  });
  return at;
};
const worst = (cards: readonly { id: string; type: string; keywords: readonly string[] }[], ok = (_: number) => true) => {
  let at = -1;
  cards.forEach((c, i) => {
    if (ok(i) && (at < 0 || worth(c) < worth(cards[at]!))) at = i;
  });
  return at;
};

/** The select a card of hers asks for: the index of the card to take, or undefined (not hers). */
function select(source: string | undefined, cards: readonly { id: string; type: string; keywords: readonly string[] }[]): number | undefined {
  if (cards.length === 0) return undefined;
  switch (source) {
    // Snap: Retain for the rest of the fight on the card most worth keeping, not one that has it.
    case "SNAP": {
      const i = best(cards, (j) => !cards[j]!.keywords.includes("Retain"));
      return i >= 0 ? i : 0;
    }
    // Sculpting Strike: Ethereal on the card least worth keeping (a curse exhausts at the turn's end).
    case "SCULPTING_STRIKE": {
      const i = worst(cards, (j) => !cards[j]!.keywords.includes("Ethereal"));
      return i >= 0 ? i : 0;
    }
    case "GRAVEBLAST":
    case "DREDGE":
    case "TRANSFIGURE":
      return best(cards);
    case "CLEANSE":
    case "SEANCE":
      return worst(cards);
    default:
      return undefined;
  }
}

/** A hand card chosen by `select` for `source`, replaced by `f` of it. */
function changeInHand(s: State, source: string, f: (c: Card) => Card): void {
  const i = select(source, s.hand);
  if (i === undefined || !s.hand[i]) return;
  s.hand[i] = f(s.hand[i]!);
}

const withKeyword = (k: string) => (c: Card): Card => (c.keywords.includes(k) ? c : { ...c, keywords: [...c.keywords, k] });

/** A card's number by the first of its names the bridge reports. */
const v = (c: Card, ...names: string[]) => {
  for (const n of names) if (c.vars[n] !== undefined) return c.vars[n]!;
  return 0;
};

/** Her own hit on the target (the core's strike: her Strength, Weak, Vigor). */
function playerHit(s: State, t: Enemy | undefined, base: number, times = 1): void {
  if (t) strike(s, [t], base, times);
}

const alive = (s: State) => s.enemies.filter((e) => e.alive);

const SPECIAL: Record<string, Rule> = {
  // Osty's attacks (IL: Osty.CheckMissingWithAnim first: dead, nothing).
  UNLEASH: (s, c, t) => void ostyAttack(s, one(t), ostyBase(s, c, v(c, "CalculationBase") + v(c, "ExtraDamage") * (necro(s)?.ostyHp ?? 0))),
  POKE: (s, c, t) => void ostyAttack(s, one(t), ostyBase(s, c, v(c, "OstyDamage"))),
  FLATTEN: (s, c, t) => void ostyAttack(s, one(t), ostyBase(s, c, v(c, "OstyDamage"))),
  RIGHT_HAND_HAND: (s, c, t) => void ostyAttack(s, one(t), ostyBase(s, c, v(c, "OstyDamage"))),
  // Snap: the Retain comes whether Osty is there or not.
  SNAP: (s, c, t) => {
    ostyAttack(s, one(t), ostyBase(s, c, v(c, "OstyDamage")));
    changeInHand(s, "SNAP", withKeyword("Retain"));
  },
  // Fetch: its first play each turn draws (every copy's is, but for a second play of one card).
  FETCH: (s, c, t) => {
    if (ostyAttack(s, one(t), ostyBase(s, c, v(c, "OstyDamage")))) draw(s, v(c, "Cards") || 1);
  },
  // Rattle: a hit more for every other Osty attack this turn (attacks, not hits).
  RATTLE: (s, c, t) => {
    const x = necro(s);
    const k = (x?.ostyAttacksBefore ?? 0) + (x?.ostyAttacks ?? 0);
    ostyAttack(s, one(t), ostyBase(s, c, v(c, "OstyDamage")), 1 + k);
  },
  // Sic 'Em: its power goes on even with Osty dead; his hit comes first, so it does not summon.
  SIC_EM: (s, c, t) => {
    ostyAttack(s, one(t), ostyBase(s, c, v(c, "OstyDamage")));
    if (t && targetable(t)) addPower(t, "SIC_EM", v(c, "SicEmPower") || 3);
  },
  HIGH_FIVE: (s, c) => {
    if (!ostyAttack(s, alive(s), ostyBase(s, c, v(c, "OstyDamage")))) return;
    for (const e of s.enemies) if (e.alive) applyPower(s, e, "VULNERABLE", v(c, "VulnerablePower") || 2);
  },
  // Bone Shards: Osty hits them all, she blocks, and he dies.
  BONE_SHARDS: (s, c) => {
    if (!ostyAttack(s, alive(s), ostyBase(s, c, v(c, "OstyDamage")))) return;
    gainBlock(s, blockGain(v(c, "Block"), s.player), true);
    const x = necro(s);
    if (x && x.ostyHp > 0) ostyLoses(s, x.ostyHp);
  },
  // Squeeze: 5 more for every other Osty Attack card in her piles.
  SQUEEZE: (s, c, t) => {
    const others = [...s.hand, ...s.draw, ...s.discard, ...s.exhaust].filter((o) => OSTY_ATTACKS.has(o.id)).length;
    ostyAttack(s, one(t), ostyBase(s, c, v(c, "CalculationBase") + v(c, "ExtraDamage") * others));
  },
  PROTECTOR: (s, c, t) => void ostyAttack(s, one(t), ostyBase(s, c, v(c, "CalculationBase") + v(c, "ExtraDamage") * (necro(s)?.ostyMax ?? 0))),
  // Sweeping Gaze: a random enemy.
  SWEEPING_GAZE: (s, c) => {
    const a = alive(s);
    if (a.length > 1) s.exact = false;
    ostyAttack(s, a.slice(0, 1), ostyBase(s, c, v(c, "OstyDamage")));
  },

  // Summons.
  BODYGUARD: (s, c) => summon(s, v(c, "Summon")),
  AFTERLIFE: (s, c) => summon(s, v(c, "Summon")),
  REANIMATE: (s, c) => summon(s, v(c, "Summon")),
  PULL_AGGRO: (s, c) => {
    summon(s, v(c, "Summon"));
    gainBlock(s, blockGain(v(c, "Block"), s.player), true);
  },
  // Cleanse: a card of the draw pile exhausted, the one least worth keeping.
  CLEANSE: (s, c) => {
    summon(s, v(c, "Summon"));
    const i = select("CLEANSE", s.draw);
    if (i !== undefined && i >= 0) s.exhaust.push(s.draw.splice(i, 1)[0]!);
  },
  // Spur: summon, then heal Osty (a dead Osty is back at the summon's N/N, full already).
  SPUR: (s, c) => {
    summon(s, v(c, "Summon"));
    const x = necro(s);
    if (x && x.ostyHp > 0) set(s, { ostyHp: Math.min(x.ostyMax, x.ostyHp + v(c, "Heal")) });
  },
  // Invoke: next turn's summon and energy.
  INVOKE: (s, c) => {
    addPower(s.player, "SUMMON_NEXT_TURN", v(c, "Summon"));
    addPower(s.player, "ENERGY_NEXT_TURN", v(c, "Energy"));
  },
  // Dirge: X summons, X Souls into the draw pile (upgraded with it).
  DIRGE: (s, c, _t, x) => {
    s.exact = false;
    for (let i = 0; i < x; i++) summon(s, v(c, "Summon"));
    soulsToDraw(s, x, c.upgrades > 0);
  },
  NECRO_MASTERY: (s, c) => {
    summon(s, v(c, "Summon"));
    addPower(s.player, "NECRO_MASTERY", 1);
  },

  // Souls.
  REAVE: (s, c, t) => {
    playerHit(s, t, dmg(s, c, t));
    soulsToDraw(s, v(c, "Cards") || 1, c.upgrades > 0);
  },
  GRAVE_WARDEN: (s, c) => {
    gainBlock(s, blockGain(v(c, "Block"), s.player), true);
    soulsToDraw(s, v(c, "Cards") || 1);
  },
  // Capture Spirit: HP loss, not an attack.
  CAPTURE_SPIRIT: (s, c, t) => {
    if (t?.alive) unblockable(s, t, v(c, "Damage"));
    soulsToDraw(s, v(c, "Cards"));
  },
  // Severance: a Soul to the draw pile, the discard pile and the hand.
  SEVERANCE: (s, c, t) => {
    playerHit(s, t, dmg(s, c, t));
    soulsToDraw(s, 1);
    s.discard.push(soulCard());
    toHand(s, soulCard());
  },
  // Seance: a card of the draw pile becomes a Soul.
  SEANCE: (s) => {
    const i = select("SEANCE", s.draw);
    if (i !== undefined && i >= 0) s.draw[i] = soulCard();
  },

  // Doom.
  SCOURGE: (s, c, t) => {
    doom(s, t, v(c, "DoomPower", "Doom"));
    draw(s, v(c, "Cards"));
  },
  NEGATIVE_PULSE: (s, c) => {
    gainBlock(s, blockGain(v(c, "Block"), s.player), true);
    for (const e of alive(s)) doom(s, e, v(c, "DoomPower", "Doom"));
  },
  DEATHBRINGER: (s, c) => {
    for (const e of alive(s)) doom(s, e, v(c, "DoomPower", "Doom"));
    for (const e of alive(s)) applyPower(s, e, "WEAK", v(c, "WeakPower") || 1);
  },
  // No Escape: 5 more for every 10 Doom already on it.
  NO_ESCAPE: (s, c, t) => {
    if (!t) return;
    const n = v(c, "CalculationBase") + v(c, "CalculationExtra") * Math.floor(doomOf(t) / (v(c, "DoomThreshold") || 10));
    doom(s, t, n);
  },
  // Blight Strike: Doom as much as the hit dealt, block included, overkill not.
  BLIGHT_STRIKE: (s, c, t) => {
    if (!t) return;
    const before = t.hp + t.block;
    playerHit(s, t, dmg(s, c, t));
    doom(s, t, Math.max(0, before - (t.alive ? t.hp + t.block : t.block)));
  },
  OBLIVION: (s, c, t) => {
    if (t && targetable(t)) addPower(t, "OBLIVION", v(c, "DoomPower", "Doom", "OblivionPower"));
  },
  // End of Days: Doom on them all, then every enemy at or under its Doom dies now.
  END_OF_DAYS: (s, c) => {
    for (const e of alive(s)) doom(s, e, v(c, "DoomPower", "Doom"));
    for (const e of s.enemies) {
      if (!doomed(e)) continue;
      downed(e);
      kill(s, e);
    }
  },
  // Death's Door: block twice more if she applied Doom this turn.
  DEATHS_DOOR: (s, c) => {
    const again = necro(s)?.doomed || c.glows ? v(c, "Repeat") || 2 : 0;
    for (let i = 0; i <= again; i++) gainBlock(s, blockGain(v(c, "Block"), s.player), true);
  },

  // Her others.
  DELAY: (s, c) => {
    gainBlock(s, blockGain(v(c, "Block"), s.player), true);
    addPower(s.player, "ENERGY_NEXT_TURN", v(c, "Energy"));
  },
  PUTREFY: (s, c, t) => {
    if (!t || !targetable(t)) return;
    applyPower(s, t, "WEAK", v(c, "Power", "WeakPower"));
    applyPower(s, t, "VULNERABLE", v(c, "Power", "VulnerablePower"));
  },
  FRIENDSHIP: (s, c) => {
    addPower(s.player, "STRENGTH", -v(c, "StrengthPower"));
    addPower(s.player, "FRIENDSHIP", v(c, "Energy") || 1);
    const x = necro(s) ?? blank();
    set(s, { energyNext: x.energyNext + (v(c, "Energy") || 1) });
  },
  DEMESNE: (s, c) => {
    const n = v(c, "Cards") || 1;
    addPower(s.player, "DEMESNE", n);
    const x = necro(s) ?? blank();
    set(s, { energyNext: x.energyNext + n, drawNext: x.drawNext + n });
  },
  HAUNT: (s, c) => addPower(s.player, "HAUNT", v(c, "HpLoss")),
  SHROUD: (s, c) => addPower(s.player, "SHROUD", v(c, "Block")),
  NEUROSURGE: (s, c) => {
    s.energy += v(c, "Energy");
    draw(s, v(c, "Cards"));
    addPower(s.player, "NEUROSURGE", v(c, "NeurosurgePower") || 3);
  },
  // Borrowed Time: energy now, every card 1 more this turn (not X cards).
  BORROWED_TIME: (s, c) => {
    s.energy += v(c, "Energy");
    const extra = v(c, "ExtraCost") || 1;
    addPower(s.player, "BORROWED_TIME", extra);
    set(s, { borrowed: (necro(s)?.borrowed ?? 0) + extra });
  },
  // Enfeebling Touch: Strength off for the enemies' turn, given back at its end (turn.ts).
  ENFEEBLING_TOUCH: (s, c, t) => {
    if (t && targetable(t) && applyPower(s, t, "STRENGTH", -v(c, "StrengthLoss"))) addPower(t, "ENFEEBLING_TOUCH", v(c, "StrengthLoss"));
  },
  SHARED_FATE: (s, c, t) => {
    addPower(s.player, "STRENGTH", -v(c, "PlayerStrengthLoss"));
    if (t && targetable(t)) applyPower(s, t, "STRENGTH", -v(c, "EnemyStrengthLoss"));
  },
  VEILPIERCER: (s, c, t) => {
    playerHit(s, t, dmg(s, c, t));
    addPower(s.player, "VEILPIERCER", 1);
  },
  SCULPTING_STRIKE: (s, c, t) => {
    playerHit(s, t, dmg(s, c, t));
    changeInHand(s, "SCULPTING_STRIKE", withKeyword("Ethereal"));
  },
  GRAVEBLAST: (s, c, t) => {
    playerHit(s, t, dmg(s, c, t));
    const i = select("GRAVEBLAST", s.discard);
    if (i !== undefined && i >= 0) toHand(s, s.discard.splice(i, 1)[0]!);
  },
  // Dredge: as many as the hand has room for, up to 3, from the discard pile.
  DREDGE: (s, c) => {
    let n = Math.min(v(c, "Cards") || 3, HAND_LIMIT - s.hand.length - s.drawn);
    for (; n > 0 && s.discard.length > 0; n--) {
      const i = select("DREDGE", s.discard)!;
      toHand(s, s.discard.splice(i, 1)[0]!);
    }
  },
  // Drain Power: upgrades random discard cards for the fight (not modelled: their numbers are not known here).
  DRAIN_POWER: (s, c, t) => {
    playerHit(s, t, dmg(s, c, t));
    if (s.discard.length > 0) s.exact = false;
  },
  // Sacrifice: block three times Osty's max HP, counted before he dies.
  SACRIFICE: (s) => {
    const x = necro(s);
    if (!x || x.ostyHp <= 0) return;
    gainBlock(s, blockGain(3 * x.ostyMax, s.player), true);
    ostyLoses(s, x.ostyHp);
  },
  // Hang: its damage times the target's Hang, which then at least doubles.
  HANG: (s, c, t) => {
    if (!t) return;
    s.player.powers["HANG_NOW"] = 1;
    playerHit(s, t, dmg(s, c, t));
    delete s.player.powers["HANG_NOW"];
    if (targetable(t)) addPower(t, "HANG", Math.max(2, t.powers["HANG"] ?? 0));
  },
  // Misery: the target's debuffs, as they were before the hit, onto every other enemy.
  MISERY: (s, c, t) => {
    if (!t) return;
    const debuffs = Object.entries(t.powers).filter(([k, n]) => DEBUFF_KEYS.has(k) ? n > 0 : k === "STRENGTH" && n < 0);
    playerHit(s, t, dmg(s, c, t));
    for (const e of alive(s)) {
      if (e === t) continue;
      for (const [k, n] of debuffs) addPower(e, k, n);
    }
  },
  // Undeath: its block, and a copy of it into the discard pile.
  UNDEATH: (s, c) => {
    gainBlock(s, blockGain(v(c, "Block"), s.player), true);
    s.discard.push({ ...c, locked: false });
  },
  // Eidolon: every Ethereal card of the exhaust pile played for free (random targets), off to its pile.
  EIDOLON: (s) => {
    const cards = s.exhaust.filter((x) => x.keywords.includes("Ethereal") && !x.keywords.includes("Unplayable"));
    s.exhaust = s.exhaust.filter((x) => !cards.includes(x));
    for (const x of cards) autoPlay(s, x);
  },
  // Transfigure: a hand card played twice from now on, for 1 more: not modelled.
  TRANSFIGURE: (s) => {
    s.exact = false;
  },
  // Time's Up, Soul Storm: counts (below); Eradicate, Banshee's Cry, The Scythe: the core's own.
};

const DEBUFF_KEYS = new Set(["WEAK", "VULNERABLE", "DOOM", "POISON", "HANG", "OBLIVION", "DEBILITATE", "SIC_EM", "FRAIL", "ENFEEBLING_TOUCH"]);

/** Debuffs she put on an enemy by a card: a count each (Sleight of Flesh), and the Doom (Shroud). */
const WATCHED = ["WEAK", "VULNERABLE", "DOOM", "DEBILITATE", "SIC_EM", "HANG", "OBLIVION", "POISON", "FRAIL"];
interface Before {
  enemies: { e: Enemy; powers: Record<string, number>; hp: number; block: number }[];
}
const beforePlays = new WeakMap<Card, Before>();

export const NECROBINDER: CharacterRules = {
  special: SPECIAL,
  counts: {
    // Time's Up: the target's Doom.
    TIMES_UP: (_s, _c, t) => (t ? doomOf(t) : undefined),
    // Soul Storm: Souls in the exhaust pile.
    SOUL_STORM: (s) => s.exhaust.filter((c) => c.id === "SOUL").length,
    // Death March: cards drawn in the turn, not by the turn's own draw: what the card showed, and since.
    DEATH_MARCH: (s, c) => counted(c) + (necro(s)?.drawnSince ?? 0),
  },

  fromObservation(obs: Observation, s: State): void {
    const o = obs.player_allies?.find((a) => a.is_osty);
    if (!o && obs.character !== "NECROBINDER" && !obs.relics.some((r) => PHYLACTERY[r])) return;
    const hand = obs.combat?.hand ?? [];
    const calc = (id: string, name: string) => Math.max(0, ...hand.filter((c) => c.card_id === id).map((c) => c.calculated?.[name] ?? 0));
    const n = blank();
    n.ostyUp = o !== undefined;
    n.ostyHp = o && o.is_alive ? Math.max(0, o.hp) : 0;
    n.ostyMax = o ? o.max_hp : 0;
    // Rattle shows 1 + the Osty attacks so far; Pull From Below the Ethereal plays of the fight.
    n.ostyAttacksBefore = Math.max(0, calc("RATTLE", "CalculatedHits") - 1);
    n.etherealBefore = calc("PULL_FROM_BELOW", "CalculatedHits");
    n.doomed = hand.some((c) => c.card_id === "DEATHS_DOOR" && c.glows === true);
    s.ext = { ...(s.ext ?? {}), ...n };
    // Enfeebling Touch's amount is the Strength it gives back, whatever sign the bridge shows.
    for (const e of s.enemies) if (e.powers["ENFEEBLING_TOUCH"]) e.powers["ENFEEBLING_TOUCH"] = Math.abs(e.powers["ENFEEBLING_TOUCH"]!);
  },

  playable(s, card) {
    // High Five (IL: IsPlayable = !IsOstyMissing).
    return card.id !== "HIGH_FIVE" || ostyAlive(s);
  },

  cost(s, card, cost) {
    const x = necro(s);
    if (!x || card.costsX) return cost;
    let c = cost;
    // Flatten: 0 once Osty has attacked this turn (before the turn's global costs).
    if (card.id === "FLATTEN" && x.ostyAttacks > 0) c = 0;
    // Melancholy: 1 less for every death; Banshee's Cry: 2 less for every Ethereal card played.
    if (card.id === "MELANCHOLY") c -= x.deaths;
    if (card.id === "BANSHEES_CRY") c -= 2 * x.ethereal;
    c += x.borrowed;
    // Veilpiercer (a late modifier: over Borrowed Time too): an Ethereal card in hand costs 0.
    if ((s.player.powers["VEILPIERCER"] ?? 0) > 0 && card.keywords.includes("Ethereal")) c = 0;
    return Math.max(0, c);
  },

  beforePlay(s, card) {
    if (!necro(s)) return;
    beforePlays.set(card, { enemies: s.enemies.map((e) => ({ e, powers: { ...e.powers }, hp: e.hp, block: e.block })) });
    // Lethality: the turn's first attack card.
    const lethality = s.player.powers["LETHALITY"] ?? 0;
    if (card.type === "Attack" && lethality > 0 && (s.attacksBefore ?? 0) + (s.attacks ?? 0) === 0) s.player.powers["LETHAL_NOW"] = lethality;
    // Danse Macabre (IL: BeforeCardPlayed): a card of 2 or more gives its block first, past Dexterity.
    const danse = s.player.powers["DANSE_MACABRE"] ?? 0;
    if (danse > 0 && (card.costsX ? 0 : costOf(s, card) + 0) >= 2) gainBlock(s, danse);
    // Spirit of Ash: an Ethereal card played, its block first.
    const ash = s.player.powers["SPIRIT_OF_ASH"] ?? 0;
    if (ash > 0 && card.keywords.includes("Ethereal")) gainBlock(s, ash);
    // Veilpiercer: an Ethereal card played takes a stack.
    if ((s.player.powers["VEILPIERCER"] ?? 0) > 0 && card.keywords.includes("Ethereal")) {
      addPower(s.player, "VEILPIERCER", -1);
      if ((s.player.powers["VEILPIERCER"] ?? 0) <= 0) delete s.player.powers["VEILPIERCER"];
    }
  },

  afterPlay(s, card) {
    const x = necro(s);
    if (!x) return;
    delete s.player.powers["LETHAL_NOW"];
    const before = beforePlays.get(card);
    beforePlays.delete(card);
    // Reaper Form: the card's attack damage, block included, as Doom on whoever took it.
    const reaper = s.player.powers["REAPER_FORM"] ?? 0;
    if (before && reaper > 0 && card.type === "Attack") {
      for (const b of before.enemies) {
        const dealt = b.hp + b.block - (b.e.hp + b.e.block);
        if (dealt > 0) doom(s, b.e, dealt * reaper);
      }
    }
    // Oblivion: every card played after it this turn, its amount in Doom on that enemy.
    if (card.id !== "OBLIVION") for (const e of s.enemies) if ((e.powers["OBLIVION"] ?? 0) > 0) doom(s, e, e.powers["OBLIVION"]!);
    // Her debuffs, one by one: Sleight of Flesh hits for each, Shroud blocks for each Doom, and Death's Door knows.
    if (before) {
      const sleight = s.player.powers["SLEIGHT_OF_FLESH"] ?? 0;
      const shroud = s.player.powers["SHROUD"] ?? 0;
      let doomApplied = false;
      for (const b of before.enemies) {
        let debuffs = 0;
        for (const k of WATCHED) if ((b.e.powers[k] ?? 0) > (b.powers[k] ?? 0)) debuffs++;
        if ((b.e.powers["STRENGTH"] ?? 0) < (b.powers["STRENGTH"] ?? 0)) debuffs++;
        const doomUp = (b.e.powers["DOOM"] ?? 0) > (b.powers["DOOM"] ?? 0);
        if (doomUp) doomApplied = true;
        if (doomUp && shroud > 0) gainBlock(s, shroud);
        for (let i = 0; i < debuffs && sleight > 0 && b.e.alive; i++) {
          hit(b.e, sleight);
          if (!b.e.alive) kill(s, b.e);
        }
      }
      if (doomApplied && !x.doomed) set(s, { doomed: true });
    }
    const now = necro(s)!;
    // A Soul played: Haunt's HP loss on a random enemy, Devour Life's summon.
    if (card.id === "SOUL") {
      const haunt = s.player.powers["HAUNT"] ?? 0;
      const a = alive(s);
      if (haunt > 0 && a.length > 0) {
        if (a.length > 1) s.exact = false;
        unblockable(s, a[0]!, haunt);
      }
      summon(s, s.player.powers["DEVOUR_LIFE"] ?? 0);
    }
    if (card.keywords.includes("Ethereal")) set(s, { ethereal: now.ethereal + 1 });
    // Right Hand Hand: a card of 2 or more played brings it back from the discard pile.
    const paid = card.costsX ? 0 : card.cost;
    if (paid >= 2) {
      for (let i = s.discard.length - 1; i >= 0; i--) if (s.discard[i]!.id === "RIGHT_HAND_HAND") toHand(s, s.discard.splice(i, 1)[0]!);
    }
    // Ivory Tile: a card of 3 or more, an energy back.
    if (paid >= 3 && s.relics.includes("IVORY_TILE")) s.energy += s.relicVars?.["IVORY_TILE"]?.["Energy"] ?? 1;
  },

  onDraw(s, n) {
    const x = necro(s);
    if (x) set(s, { drawnSince: x.drawnSince + n });
  },

  soak(s): Soak | undefined {
    const x = necro(s);
    if (!x || x.ostyHp <= 0) return undefined;
    return soaker(x.ostyHp).take;
  },

  nextTurn(prev, next) {
    const x = necro(prev);
    if (!x) return;
    // Osty after the enemies' hits; Necro Mastery answers what he lost.
    const left = ostyAfterTurn(prev);
    const lost = Math.max(0, x.ostyHp - left);
    set(next, {
      ...blank(), ostyUp: x.ostyUp, ostyMax: x.ostyMax, ostyHp: left, deaths: x.deaths + (x.ostyHp > 0 && left <= 0 ? 1 : 0),
      ethereal: x.etherealBefore + x.ethereal, etherealBefore: 0,
    });
    const nm = prev.player.powers["NECRO_MASTERY"] ?? 0;
    if (nm > 0 && lost > 0) for (const e of next.enemies) if (e.alive) unblockable(next, e, lost * nm);
    // Doom: every enemy at or under its Doom dies as the enemies' turn ends (IL: BeforeSideTurnEnd).
    for (const e of next.enemies) {
      if (!doomed(e)) continue;
      downed(e);
      kill(next, e);
    }
    // The enemies' turn's end: Sic 'Em goes, Debilitate runs down; hers: Oblivion and Borrowed Time go.
    for (const e of next.enemies) {
      delete e.powers["SIC_EM"];
      delete e.powers["OBLIVION"];
      if ((e.powers["DEBILITATE"] ?? 0) > 0 && --e.powers["DEBILITATE"]! <= 0) delete e.powers["DEBILITATE"];
    }
    const p = next.player.powers;
    delete p["BORROWED_TIME"];
    delete p["VEILPIERCER"];
    // Friendship and Demesne played this turn: max energy from now on (the observation's max has the older ones).
    if (x.energyNext > 0) {
      next.energy += x.energyNext;
      next.maxEnergy = (next.maxEnergy ?? 3) + x.energyNext;
    }
    // Demesne: a card more in every turn's draw.
    const extra = Math.max(0, p["DEMESNE"] ?? 0);
    for (let i = 0; i < extra && next.draw.length > 0 && next.hand.length < HAND_LIMIT; i++) next.hand.push({ ...next.draw.pop()!, locked: false });
    // The turn's start: Bound Phylactery's summon (from turn 2, before the draw), Phylactery Unbound's,
    // Invoke's; Sentry Mode's Sweeping Gazes into the hand.
    summon(next, (next.relics.includes("BOUND_PHYLACTERY") ? 1 : 0) + (next.relics.includes("PHYLACTERY_UNBOUND") ? 2 : 0) + Math.max(0, p["SUMMON_NEXT_TURN"] ?? 0));
    delete p["SUMMON_NEXT_TURN"];
    for (let i = 0; i < (p["SENTRY_MODE"] ?? 0) && next.hand.length < HAND_LIMIT; i++) next.hand.push({ ...SWEEPING_GAZE });
    // After the draw: Neurosurge's Doom on her, Countdown's on a random enemy (Shroud and Sleight of Flesh answer it).
    if ((p["NEUROSURGE"] ?? 0) > 0) addPower(next.player, "DOOM", p["NEUROSURGE"]!);
    const countdown = p["COUNTDOWN"] ?? 0;
    const target = next.enemies.find((e) => e.alive);
    if (countdown > 0 && target) {
      doom(next, target, countdown);
      if ((p["SHROUD"] ?? 0) > 0) next.player.block += p["SHROUD"]!;
      if ((p["SLEIGHT_OF_FLESH"] ?? 0) > 0) {
        hit(target, p["SLEIGHT_OF_FLESH"]!);
        if (!target.alive) kill(next, target);
      }
      set(next, { doomed: true });
    }
  },

  evaluate(s: State, w: Weights): number {
    const x = necro(s);
    if (!x) return 0;
    let score = 0;
    // Doom at or over its HP is a kill at the enemies' turn's end; under it, HP as good as taken.
    for (const e of s.enemies) if (e.alive) score += Math.min(e.hp, doomOf(e)) * w.enemyHp;
    // Osty's HP after the enemies' turn: the hits he will still take for her.
    score += OSTY_HP * ostyAfterTurn(s);
    // Neurosurge's Doom at or over her HP at her turn's end: dead.
    if (doomOf(s.player) > 0 && s.player.hp <= doomOf(s.player)) score -= 1e6;
    return score;
  },

  keyExt(s) {
    const x = necro(s);
    return x ? `${x.ostyHp}/${x.ostyMax}/${x.ostyAttacks}/${x.ethereal}/${x.doomed ? 1 : 0}/${x.deaths}/${x.borrowed}/${x.energyNext}/${x.drawnSince}` : "";
  },

  combatSelect: (source, _purpose, cards) => select(source, cards),
};

/** What an HP of Osty's after the enemies' turn is worth, against one of hers (1): he only lasts the fight. */
const OSTY_HP = 0.5;

/** Osty in front of her for the turn's hits: each hit past block, what he takes and what gets through. */
function soaker(hp0: number): { take: Soak; left: () => number } {
  let hp = hp0;
  return {
    take: (past) => {
      if (hp <= 0 || past <= 0) return past;
      const took = Math.min(hp, past);
      hp -= took;
      return past - took;
    },
    left: () => hp,
  };
}

/** Osty's HP once the enemies' turn is over: the same hits hpLoss plays. */
export function ostyAfterTurn(s: State): number {
  const x = necro(s);
  if (!x || x.ostyHp <= 0) return 0;
  const o = soaker(x.ostyHp);
  hpLoss(s, o.take);
  return o.left();
}

