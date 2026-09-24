import assert from "node:assert/strict";
import { test } from "node:test";
import { actionId, deckPace, evaluate, futureDamage, planTurn, TURN_WEIGHTS } from "../src/search.ts";
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
    lostHp: false, exhaustedThisTurn: false, relics: [], played: 0, skills: 0, unmovableUsed: false, potions: [], potionSlots: 3, potionsUsed: 0,
  };
}

test("the deck's pace comes from every card still in the fight", () => {
  const pace = deckPace(state([STRIKE, DEFEND], 1, [foe(1, 40, 6)]));
  // 3 strikes and 3 defends: 3 damage a card, over a five-card hand, a quarter off.
  assert.equal(pace.perTurn, 11.25);
  assert.equal(pace.perHit, 6);
  // 3 defends of 5 over 6 cards, half a hand.
  assert.equal(pace.cardBlock, 6.25);
});

test("counting block, an enemy the deck out-blocks puts no pressure on the fight", () => {
  const nibbit = state([], 0, [foe(1, 40, 6)]);
  assert.equal(futureDamage(nibbit, undefined, true), 0);
  const brute = state([], 0, [foe(1, 40, 16)]);
  assert.ok(futureDamage(brute, undefined, true) > 0);
  assert.ok(futureDamage(brute, undefined, true) < futureDamage(brute));
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

test("frantic escape is played while the sandpit still has turns, not kept for the last one", () => {
  const escape = card("FRANTIC_ESCAPE", "Skill", "Self", {});
  const s = state([escape, STRIKE], 1, [foe(1, 270, 0)]);
  s.enemies[0]!.powers["SANDPIT"] = 3;
  assert.equal(actionId(planTurn(s).actions[0]!), "play_card:0");
});

test("against slippery, stripping stacks is worth more than a block that saves little", () => {
  const twin = card("TWIN_STRIKE", "Attack", "AnyEnemy", { Damage: 5 });
  const vantom = foe(1, 170, 3);
  vantom.powers["SLIPPERY"] = 6;
  const s = state([twin, DEFEND], 1, [vantom]);
  assert.equal(actionId(planTurn(s).actions[0]!), "play_card:0:target:1");
});

test("HP a card spends counts in the evaluation", () => {
  const s = state([], 1, [foe(1, 40, 0)]);
  const hurt = state([], 1, [foe(1, 40, 0)]);
  hurt.player.hp = 10;
  assert.ok(evaluate(s) > evaluate(hurt) + 50);
});
