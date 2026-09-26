/**
 * A learned value for a boss fight's end-of-turn state (the leaves the planner scores): what the rest
 * of the fight comes to, learnt from bouts the simulator played out (valuegen.ts, then
 * tools/train_value.py). The act 3 research had found the planner's hand-weighed evaluation the
 * limit: A10 winners' decks beat their first act 3 boss 11.7% of the time in its hands (15-18% with
 * rollouts two or four turns on), where the humans holding them won; the simulator, its relics
 * filled in, now agrees with the game on our own decks (6-8% against 4/55).
 *
 * The target is spar.ts outcomeScore (a win 100 + up to 30 for the HP kept; a loss up to 60 for the
 * share of the fight's HP taken off), so the net's number and a bout's score mean the same.
 *
 * Features, version 2 (the other session's review of version 1): the boss's HP apart from its
 * allies' (a Queen at 419 with her Torch at 11 and one at 219 with it at 211 had summed alike), the
 * HP the turn's end will cost (sim.ts hpLoss, and hpAfterTurn with any second life), the turns the
 * kill will take at the deck's pace, the Test Subject's form, whether the boss can be hit next turn,
 * Aeonglass's Withering count, the status damage in the cycle, the potions held.
 */

import fs from "node:fs";
import path from "node:path";
import { type Card, type Enemy, formsToCome, hpAfterTurn, hpLoss, incomingDamage, revivalFor, type State } from "./sim.ts";

export const FEATURE_VERSION = 2;

/** The player's powers the value sees, by name (sim.ts keys); anything else is not read. */
const POWERS = [
  "STRENGTH", "DEXTERITY", "VULNERABLE", "WEAK", "FRAIL", "DEMON_FORM", "BARRICADE", "FEEL_NO_PAIN", "DARK_EMBRACE",
  "METALLICIZE", "PLATING", "THORNS", "RAGE", "INFERNO", "CRUELTY", "JUGGERNAUT", "RUPTURE", "VIGOR", "BUFFER",
  "INTANGIBLE", "ARTIFACT", "REGEN", "CORRUPTION", "NO_DRAW", "CHAINS_OF_BINDING", "MIND_ROT", "STAMPEDE",
  "CRIMSON_MANTLE", "VICIOUS", "JUGGLING", "AGGRESSION", "HELLRAISER", "MAYHEM", "CALAMITY", "TAINTED", "COLOSSUS",
  "SURROUNDED", "SANDPIT", "BLOCK_NEXT_TURN", "ENERGY_NEXT_TURN", "DRAW_CARDS_NEXT_TURN",
  "FLAME_BARRIER", "SELF_FORMING_CLAY", "CONSTRICT", "DISINTEGRATION", "SETUP_STRIKE", "NO_BLOCK", "FREE_ATTACK",
  "ONE_TWO_PUNCH", "RETAIN_HAND",
] as const;
/** The bosses, one-hot; any other fight is the last slot. */
const BOSS_MODELS = [
  "VANTOM", "THE_INSATIABLE", "WATERFALL_GIANT", "KIN_PRIEST", "CEREMONIAL_BEAST", "LAGAVULIN_MATRIARCH", "SOUL_FYSH",
  "KNOWLEDGE_DEMON", "CRUSHER", "TEST_SUBJECT", "AEONGLASS", "QUEEN",
] as const;
const ENEMY_POWERS = [
  "STRENGTH", "VULNERABLE", "WEAK", "ARTIFACT", "INTANGIBLE", "PLATING", "MINION", "ENRAGE", "SLIPPERY", "ASLEEP", "SANDPIT",
  "PAINFUL_STABS", "NEMESIS", "ADAPTABLE", "WITHERING_PRESENCE",
] as const;

const clip = (x: number, hi = 3) => Math.max(-hi, Math.min(hi, x));
const hitsOf = (c: Card) => Math.max(1, c.vars["Repeat"] ?? 1);
const baseDamage = (c: Card) => (c.type === "Attack" ? c.vars["Damage"] ?? c.vars["CalculationBase"] ?? 0 : 0);
const isJunk = (c: Card) => c.type === "Status" || c.type === "Curse" || c.keywords.includes("Unplayable");
// The Kaiser Crab's Rocket is its other half, not an ally: both claws must die.
const isBoss = (e: Enemy) => (BOSS_MODELS as readonly string[]).includes(e.model) || e.model === "ROCKET";

/** The features of an end-of-turn state, in FEATURE_NAMES's order. */
export function features(s: State): number[] {
  const p = s.player;
  const f: number[] = [];
  const maxHp = Math.max(1, p.maxHp);
  // The turn's end: the HP it costs, what is left (a second life included), a second life still held.
  const loss = hpLoss(s);
  const after = hpAfterTurn(s);
  const second = revivalFor(s);
  f.push(
    p.hp / maxHp, p.hp / 100, p.maxHp / 100, clip(p.block / 50), clip(s.energy / 3), clip((s.maxEnergy ?? 3) / 3), clip((s.turn ?? 1) / 20),
    clip(loss / 50), Math.max(0, after.hp) / maxHp, after.revived ? 1 : 0, second ? second.hp / maxHp : 0,
    s.potions.length / 3,
  );
  for (const k of POWERS) f.push(clip((p.powers[k] ?? 0) / 10));
  // The cards still in the cycle (hand, draw, discard), the draw pile apart, and what is gone.
  const cycle = [...s.hand, ...s.draw, ...s.discard];
  const n = Math.max(1, cycle.length);
  const share = (cards: readonly Card[], t: (c: Card) => boolean) => cards.filter(t).length / Math.max(1, cards.length);
  const mean = (cards: readonly Card[], v: (c: Card) => number) => cards.reduce((a, c) => a + v(c), 0) / Math.max(1, cards.length);
  const attacks = cycle.filter((c) => c.type === "Attack");
  const strength = p.powers["STRENGTH"] ?? 0;
  const perAttack = attacks.length > 0 ? mean(attacks, (c) => (baseDamage(c) + strength) * hitsOf(c)) : 0;
  const attacksPerHand = share(cycle, (c) => c.type === "Attack") * 5;
  const weak = (p.powers["WEAK"] ?? 0) > 0 ? 0.75 : 1;
  const statusDamage = (cards: readonly Card[]) => cards.filter(isJunk).reduce((a, c) => a + (c.vars["Damage"] ?? 0) + (c.vars["HpLoss"] ?? 0), 0);
  f.push(
    cycle.length / 40,
    share(cycle, (c) => c.type === "Attack"), share(cycle, (c) => c.type === "Skill"), share(cycle, (c) => c.type === "Power"),
    share(cycle, isJunk), share(cycle, (c) => c.keywords.includes("Exhaust")),
    mean(cycle, (c) => baseDamage(c) * hitsOf(c)) / 20, mean(cycle, (c) => c.vars["Block"] ?? 0) / 20,
    mean(cycle, (c) => c.vars["Cards"] ?? 0), mean(cycle, (c) => c.vars["Energy"] ?? 0),
    mean(cycle, (c) => (c.costsX ? 1.5 : Math.max(0, c.cost))) / 2,
    attacks.length > 0 ? mean(attacks, hitsOf) / 3 : 0,
    s.draw.length / 40, s.discard.length / 40, s.exhaust.length / 40, s.hand.length / 10, s.drawn / 5,
    mean(s.draw, (c) => baseDamage(c) * hitsOf(c)) / 20, mean(s.draw, (c) => c.vars["Block"] ?? 0) / 20, mean(s.draw, (c) => c.vars["Cards"] ?? 0),
    s.draw.length < 5 ? 1 : 0,
    clip(statusDamage(cycle) / 50), clip(statusDamage(s.draw) / 50),
    cycle.filter((c) => c.type === "Power").length / 5,
  );
  // The enemies: the boss (the one whose death ends it) apart from its allies.
  const alive = s.enemies.filter((e) => e.alive);
  const bosses = s.enemies.filter(isBoss);
  const allies = s.enemies.filter((e) => !isBoss(e));
  const hpOf = (es: readonly Enemy[]) => es.reduce((a, e) => a + (e.alive ? e.hp : 0) + formsToCome(e), 0);
  const maxOf = (es: readonly Enemy[]) => es.reduce((a, e) => a + e.maxHp + formsToCome(e), 0);
  const bossHp = hpOf(bosses);
  const allyHp = hpOf(allies);
  const vulnerable = s.enemies.some((e) => e.alive && isBoss(e) && (e.powers["VULNERABLE"] ?? 0) > 0) ? 1.5 : 1;
  const pace = Math.max(1, perAttack * attacksPerHand * weak * vulnerable);
  const most = (k: string) => alive.reduce((a, e: Enemy) => Math.max(a, e.powers[k] ?? 0), 0);
  const boss = bosses[0];
  // The Test Subject's form (1-3, by the forms still to come) and a form reviving next turn.
  const subject = s.enemies.find((e) => e.model === "TEST_SUBJECT");
  // (Forms still to come: 212 + 313 in the first, 313 in the second, none in the third.)
  const toCome = subject ? formsToCome(subject) : 0;
  const form = subject ? (toCome > 400 ? 1 : toCome > 0 ? 2 : 3) : 0;
  const reviving = subject !== undefined && !subject.alive && (subject.revive ?? 0) > 0;
  // A third form comes back intangible (turn.ts: its revival brings Intangible 1).
  const tangibleNext = reviving && toCome > 0 && toCome <= 400 ? 0
    : boss ? ((boss.powers["INTANGIBLE"] ?? 0) > 0 ? 1 : (boss.powers["NEMESIS"] ?? 0) > 0 ? 0 : 1) : 1;
  f.push(
    alive.length / 5,
    bossHp / 500, bosses.length ? bossHp / Math.max(1, maxOf(bosses)) : 0, allyHp / 300, allies.filter((e) => e.alive).length / 4,
    (bossHp + allyHp) / 500, (bossHp + allyHp) / Math.max(1, maxOf(s.enemies)),
    clip(incomingDamage(s) / 100),
    bosses.reduce((a, e) => a + (e.alive ? e.block : 0), 0) / 100, allies.reduce((a, e) => a + (e.alive ? e.block : 0), 0) / 100,
    clip(pace / 60), clip((bossHp || allyHp) / pace / 10),
    form / 3, reviving ? 1 : 0, tangibleNext,
    clip((boss?.powerVars?.["WITHERING_PRESENCE"]?.["CardsLeft"] ?? 0) / 6),
  );
  for (const k of ENEMY_POWERS) f.push(clip(most(k) / 10));
  for (const b of BOSS_MODELS) f.push(boss?.model === b ? 1 : 0);
  f.push(boss ? 0 : 1);
  return f;
}
export const FEATURE_NAMES: string[] = [
  "hp_share", "hp", "max_hp", "block", "energy_left", "max_energy", "turn",
  "hp_loss", "hp_after_share", "revives_this_turn", "second_life", "potions",
  ...POWERS.map((k) => `p_${k}`),
  "cycle", "attacks", "skills", "powers", "junk", "exhausting", "damage_per_card", "block_per_card", "draw_per_card", "energy_per_card", "cost_per_card",
  "hits_per_attack", "draw_pile", "discard_pile", "exhaust_pile", "hand", "drawn",
  "draw_damage", "draw_block", "draw_cards", "reshuffle_soon", "status_damage_cycle", "status_damage_draw", "powers_in_cycle",
  "enemies", "boss_hp", "boss_hp_share", "ally_hp", "allies", "enemy_hp", "enemy_hp_share", "incoming", "boss_block", "ally_block",
  "pace", "turns_to_kill", "ts_form", "ts_reviving", "boss_tangible_next", "withering_left",
  ...ENEMY_POWERS.map((k) => `e_${k}`),
  ...BOSS_MODELS.map((b) => `boss_${b}`), "boss_other",
];

/** A small MLP (tools/train_value.py writes it): ReLU layers, a linear out, the features standardized first. */
export interface ValueNet {
  mean: number[];
  std: number[];
  layers: { w: number[][]; b: number[] }[];
}
export function loadValueNet(file = path.resolve(import.meta.dirname, "..", "data", "value-net.json")): ValueNet | undefined {
  try {
    const net = JSON.parse(fs.readFileSync(file, "utf8")) as ValueNet;
    // A net for another feature layout would read the wrong numbers.
    if (net.mean.length !== FEATURE_NAMES.length) throw new Error(`${file}: ${net.mean.length} features, value.ts has ${FEATURE_NAMES.length}`);
    return net;
  } catch (e) {
    if (e instanceof Error && e.message.includes("features")) throw e;
    return undefined;
  }
}
/** The net's outcome score (0-130) for the features `x`. */
export function valueOf(net: ValueNet, x: readonly number[]): number {
  // Standardized, and held to ±10: a feature the training never saw move (potions, Sandpit in act 3)
  // must not throw the net (tools/train_value.py also gives such a column a huge std).
  let h = x.map((v, i) => Math.max(-10, Math.min(10, (v - net.mean[i]!) / (net.std[i]! || 1))));
  net.layers.forEach((layer, li) => {
    const out = layer.b.slice();
    for (let j = 0; j < out.length; j++) {
      const row = layer.w[j]!;
      let a = out[j]!;
      for (let i = 0; i < h.length; i++) a += row[i]! * h[i]!;
      out[j] = li < net.layers.length - 1 ? Math.max(0, a) : a;
    }
    h = out;
  });
  return h[0]!;
}
