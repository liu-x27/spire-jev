import assert from "node:assert/strict";
import { test } from "node:test";
import { actionId, deckPace, futureDamage, planTurn, TURN_WEIGHTS } from "../src/search.ts";
import type { Card, Enemy, State } from "../src/sim.ts";

const card = (id: string, type: string, target: string, vars: Record<string, number>, cost = 1): Card => ({
  id, cost, costsX: false, type, target, keywords: [], vars, upgrades: 0, locked: false, glows: false,
});
const STRIKE = card("STRIKE_IRONCLAD", "Attack", "AnyEnemy", { Damage: 6 });
const DEFEND = card("DEFEND_IRONCLAD", "Skill", "Self", { Block: 5 });

function foe(id: number, hp: number, attack: number): Enemy {
  return {
    // Not a monster the bestiary has seen, so its threat is what it shows.
    id, model: "TEST_DUMMY", hp, maxHp: hp, block: 0, alive: true, powers: {}, weakAtStart: false, startStrength: 0,
    intents: [{ type: "Attack", damage: attack, hits: 1 }],
  };
}
function state(hand: Card[], energy: number, enemies: Enemy[]): State {
  return {
    player: { hp: 80, maxHp: 80, block: 0, powers: {} },
    energy, hand, draw: [STRIKE, STRIKE, DEFEND, DEFEND], discard: [], exhaust: [], enemies, drawn: 0, exact: true,
    lostHp: false, exhaustedThisTurn: false, relics: [], played: 0, skills: 0,
  };
}

test("the deck's pace comes from every card still in the fight", () => {
  const pace = deckPace(state([STRIKE, DEFEND], 1, [foe(1, 40, 6)]));
  // 3 strikes and 3 defends: 3 damage a card, over a five-card hand, a quarter off.
  assert.equal(pace.perTurn, 11.25);
  assert.equal(pace.perHit, 6);
});

test("slippery counts as HP the deck has to chew through", () => {
  const plain = state([], 0, [foe(1, 40, 6)]);
  const slippery = state([], 0, [foe(1, 40, 6)]);
  slippery.enemies[0]!.powers["SLIPPERY"] = 8;
  assert.ok(futureDamage(slippery) > futureDamage(plain) * 1.5);
});

test("the enemy that does most per turn it takes to kill is counted as killed first", () => {
  const s = state([], 0, [foe(1, 60, 4), foe(2, 20, 12)]);
  // Pace 11.25: the 20 HP one is gone in 1.78 turns, the other at 7.1; each attacks half a turn less than it lives.
  assert.equal(Math.round(futureDamage(s) * 100) / 100, Math.round((12 * (20 / 11.25 - 0.5) + 4 * (80 / 11.25 - 0.5)) * 100) / 100);
});

test("an enemy the deck kills next turn will not attack again", () => {
  // The Mawler at 7 HP: the planner hit it instead of blocking the 21 it showed.
  assert.equal(futureDamage(state([], 0, [foe(1, 5, 21)])), 0);
});

test("against a hard hitter the fight's length is worth more than a block", () => {
  const s = state([STRIKE, DEFEND], 1, [foe(1, 100, 12)]);
  assert.equal(actionId(planTurn(s, TURN_WEIGHTS).actions[0]!), "play_card:1");
  assert.equal(actionId(planTurn(s, { ...TURN_WEIGHTS, future: 0.5 }).actions[0]!), "play_card:0:target:1");
});
