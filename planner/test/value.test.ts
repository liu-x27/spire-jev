// value.ts: the features of an end-of-turn state, one number for each name.
import assert from "node:assert/strict";
import { test } from "node:test";
import { features, FEATURE_NAMES } from "../src/value.ts";
import type { Card, Enemy, State } from "../src/sim.ts";

const card = (id: string, type: string, vars: Record<string, number>): Card => ({
  id, cost: 1, costsX: false, type, target: "AnyEnemy", keywords: [], vars, upgrades: 0, locked: false, glows: false,
});
function state(enemies: Enemy[]): State {
  return {
    player: { hp: 60, maxHp: 80, block: 5, powers: { STRENGTH: 2 } }, energy: 1, hand: [], draw: [card("STRIKE_IRONCLAD", "Attack", { Damage: 6 })],
    discard: [card("DEFEND_IRONCLAD", "Skill", { Block: 5 })], exhaust: [], enemies, drawn: 0, exact: true, lostHp: false, exhaustedThisTurn: false,
    relics: [], played: 0, skills: 0, unmovableUsed: false, potions: [], potionSlots: 3, potionsUsed: 0,
  };
}
const foe = (model: string, hp: number, powers: Record<string, number> = {}, id = 1): Enemy => ({
  id, model, hp, maxHp: hp, block: 0, alive: true, powers, weakAtStart: false, startStrength: 0, intents: [{ type: "Attack", damage: 12, hits: 1 }],
});

test("every feature has its name", () => {
  assert.equal(features(state([foe("VANTOM", 100)])).length, FEATURE_NAMES.length);
});

test("the Queen's HP and her Torch's are apart: 419/11 is not 219/211", () => {
  const a = features(state([foe("QUEEN", 419, {}, 1), foe("TORCH_HEAD_AMALGAM", 11, { MINION: 1 }, 2)]));
  const b = features(state([foe("QUEEN", 219, {}, 1), foe("TORCH_HEAD_AMALGAM", 211, { MINION: 1 }, 2)]));
  const i = FEATURE_NAMES.indexOf("boss_hp");
  assert.notEqual(a[i], b[i]);
  assert.equal(a[FEATURE_NAMES.indexOf("enemy_hp")], b[FEATURE_NAMES.indexOf("enemy_hp")]);
});
