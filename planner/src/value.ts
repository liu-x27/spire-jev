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
 */

import fs from "node:fs";
import path from "node:path";
import { type Card, type Enemy, formsToCome, incomingDamage, type State } from "./sim.ts";

/** The player's powers the value sees, by name (sim.ts keys); anything else is not read. */
const POWERS = [
  "STRENGTH", "DEXTERITY", "VULNERABLE", "WEAK", "FRAIL", "DEMON_FORM", "BARRICADE", "FEEL_NO_PAIN", "DARK_EMBRACE",
  "METALLICIZE", "PLATING", "THORNS", "RAGE", "INFERNO", "CRUELTY", "JUGGERNAUT", "RUPTURE", "VIGOR", "BUFFER",
  "INTANGIBLE", "ARTIFACT", "REGEN", "CORRUPTION", "NO_DRAW", "CHAINS_OF_BINDING", "MIND_ROT", "STAMPEDE",
  "CRIMSON_MANTLE", "VICIOUS", "JUGGLING", "AGGRESSION", "HELLRAISER", "MAYHEM", "CALAMITY", "TAINTED", "COLOSSUS",
  "SURROUNDED", "SANDPIT", "BLOCK_NEXT_TURN", "ENERGY_NEXT_TURN", "DRAW_CARDS_NEXT_TURN",
] as const;
/** The bosses, one-hot; any other fight is the last slot. */
const BOSS_MODELS = [
  "VANTOM", "THE_INSATIABLE", "WATERFALL_GIANT", "KIN_PRIEST", "CEREMONIAL_BEAST", "LAGAVULIN_MATRIARCH", "SOUL_FYSH",
  "KNOWLEDGE_DEMON", "CRUSHER", "TEST_SUBJECT", "AEONGLASS", "QUEEN",
] as const;
const ENEMY_POWERS = ["STRENGTH", "VULNERABLE", "WEAK", "ARTIFACT", "INTANGIBLE", "PLATING", "MINION", "ENRAGE", "SLIPPERY", "ASLEEP", "SANDPIT"] as const;

const clip = (x: number, hi = 3) => Math.max(-hi, Math.min(hi, x));
const damageOfCard = (c: Card) => (c.type === "Attack" ? (c.vars["Damage"] ?? c.vars["CalculationBase"] ?? 0) * Math.max(1, c.vars["Repeat"] ?? 1) : 0);

/** The features of an end-of-turn state, in FEATURE_NAMES's order. */
export function features(s: State): number[] {
  const p = s.player;
  const f: number[] = [];
  f.push(p.hp / Math.max(1, p.maxHp), p.hp / 100, p.maxHp / 100, clip(p.block / 50), clip(s.energy / 3), clip((s.maxEnergy ?? 3) / 3), clip((s.turn ?? 1) / 20));
  for (const k of POWERS) f.push(clip((p.powers[k] ?? 0) / 10));
  // The cards still in the cycle (hand, draw, discard), and what is gone.
  const cycle = [...s.hand, ...s.draw, ...s.discard];
  const n = Math.max(1, cycle.length);
  const share = (t: (c: Card) => boolean) => cycle.filter(t).length / n;
  f.push(
    cycle.length / 40,
    share((c) => c.type === "Attack"),
    share((c) => c.type === "Skill"),
    share((c) => c.type === "Power"),
    share((c) => c.type === "Status" || c.type === "Curse" || c.keywords.includes("Unplayable")),
    share((c) => c.keywords.includes("Exhaust")),
    cycle.reduce((a, c) => a + damageOfCard(c), 0) / n / 20,
    cycle.reduce((a, c) => a + (c.vars["Block"] ?? 0), 0) / n / 20,
    cycle.reduce((a, c) => a + (c.vars["Cards"] ?? 0), 0) / n,
    cycle.reduce((a, c) => a + (c.vars["Energy"] ?? 0), 0) / n,
    cycle.reduce((a, c) => a + (c.costsX ? 1.5 : Math.max(0, c.cost)), 0) / n / 2,
    s.draw.length / 40,
    s.discard.length / 40,
    s.exhaust.length / 40,
    s.hand.length / 10,
    s.drawn / 5,
  );
  // The enemies, together.
  const alive = s.enemies.filter((e) => e.alive);
  const hp = s.enemies.reduce((a, e) => a + (e.alive ? e.hp : 0) + formsToCome(e), 0);
  const maxHp = s.enemies.reduce((a, e) => a + e.maxHp + formsToCome(e), 0);
  const most = (k: string) => alive.reduce((a, e: Enemy) => Math.max(a, e.powers[k] ?? 0), 0);
  f.push(alive.length / 5, hp / 500, maxHp / 500, hp / Math.max(1, maxHp), clip(incomingDamage(s) / 100), alive.reduce((a, e) => a + e.block, 0) / 100);
  for (const k of ENEMY_POWERS) f.push(clip(most(k) / 10));
  const boss = s.enemies.find((e) => (BOSS_MODELS as readonly string[]).includes(e.model));
  for (const b of BOSS_MODELS) f.push(boss?.model === b ? 1 : 0);
  f.push(boss ? 0 : 1);
  return f;
}
export const FEATURE_NAMES: string[] = [
  "hp_share", "hp", "max_hp", "block", "energy_left", "max_energy", "turn",
  ...POWERS.map((k) => `p_${k}`),
  "cycle", "attacks", "skills", "powers", "junk", "exhausting", "damage_per_card", "block_per_card", "draw_per_card", "energy_per_card", "cost_per_card",
  "draw_pile", "discard_pile", "exhaust_pile", "hand", "drawn",
  "enemies", "enemy_hp", "enemy_max_hp", "enemy_hp_share", "incoming", "enemy_block",
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
    return JSON.parse(fs.readFileSync(file, "utf8")) as ValueNet;
  } catch {
    return undefined;
  }
}
/** The net's outcome score (0-130) for the features `x`. */
export function valueOf(net: ValueNet, x: readonly number[]): number {
  let h = x.map((v, i) => (v - net.mean[i]!) / (net.std[i]! || 1));
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
