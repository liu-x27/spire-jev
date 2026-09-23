import assert from "node:assert/strict";
import { test } from "node:test";
import { actionId, planTurn } from "../src/search.ts";
import { attackDamage, type Card, type Enemy, hpLoss, play, powerKey, type State } from "../src/sim.ts";

const card = (id: string, type: string, target: string, vars: Record<string, number>, cost = 1): Card => ({
  id, cost, costsX: false, type, target, keywords: [], vars, upgrades: 0, locked: false, glows: false,
});
const STRIKE = card("STRIKE_IRONCLAD", "Attack", "AnyEnemy", { Damage: 6 });
const DEFEND = card("DEFEND_IRONCLAD", "Skill", "Self", { Block: 5 });
const BASH = card("BASH", "Attack", "AnyEnemy", { Damage: 8, VulnerablePower: 2 }, 2);

function enemy(hp: number, attack: number, hits = 1): Enemy {
  return {
    id: 1, model: "NIBBIT", hp, maxHp: hp, block: 0, alive: true, powers: {}, weakAtStart: false, startStrength: 0,
    intents: [{ type: "Attack", damage: attack, hits }],
  };
}
function state(hand: Card[], energy: number, foe: Enemy, playerHp = 80): State {
  return {
    player: { hp: playerHp, maxHp: 80, block: 0, powers: {} },
    energy, hand, draw: [], discard: [], exhaust: [], enemies: [foe], drawn: 0, exact: true, lostHp: false, exhaustedThisTurn: false, relics: [], played: 0, skills: 0,
  };
}

test("power names from the game and from card variables normalise to the same key", () => {
  assert.equal(powerKey("VulnerablePower"), "VULNERABLE");
  assert.equal(powerKey("VULNERABLE_POWER"), "VULNERABLE");
  assert.equal(powerKey("StrengthPower"), "STRENGTH");
});

test("strike deals 6; after bash's vulnerable it deals 9", () => {
  const s = state([BASH, STRIKE], 3, enemy(44, 12));
  const afterBash = play(s, { kind: "play", hand: 0, target: 1 });
  assert.equal(afterBash.enemies[0]!.hp, 36);
  assert.equal(afterBash.enemies[0]!.powers["VULNERABLE"], 2);
  const afterStrike = play(afterBash, { kind: "play", hand: 0, target: 1 });
  assert.equal(afterStrike.enemies[0]!.hp, 27);
  assert.equal(afterStrike.energy, 0);
  assert.deepEqual(afterStrike.discard.map((c) => c.id), ["BASH", "STRIKE_IRONCLAD"]);
});

test("weak on the attacker and block on the target", () => {
  const e = enemy(20, 0);
  e.block = 4;
  assert.equal(attackDamage(6, { hp: 1, maxHp: 1, block: 0, powers: { WEAK: 1 } }, e), 4);
  const s = state([STRIKE], 1, e);
  const after = play(s, { kind: "play", hand: 0, target: 1 });
  assert.equal(after.enemies[0]!.block, 0);
  assert.equal(after.enemies[0]!.hp, 18);
});

test("slippery lets a hit take 1 HP and uses up a stack (seen on Inklet)", () => {
  const e = enemy(12, 0);
  e.powers["SLIPPERY"] = 1;
  const once = play(state([STRIKE, STRIKE], 2, e), { kind: "play", hand: 0, target: 1 });
  assert.equal(once.enemies[0]!.hp, 11);
  assert.equal(once.enemies[0]!.powers["SLIPPERY"], 0);
  const twice = play(once, { kind: "play", hand: 0, target: 1 });
  assert.equal(twice.enemies[0]!.hp, 5);
});

test("shrink cuts the player's attacks by its damage decrease, rounded once (seen on Shrinker Beetle)", () => {
  const player = { hp: 80, maxHp: 80, block: 0, powers: { SHRINK: -1 }, powerVars: { SHRINK: { DamageDecrease: 30 } } };
  const beetle = enemy(21, 7);
  assert.equal(attackDamage(8, player, beetle), 5);
  beetle.powers["VULNERABLE"] = 1;
  assert.equal(attackDamage(6, player, beetle), 6);
});

test("plating is block at the end of the turn", () => {
  const s = state([], 0, enemy(40, 15));
  s.player.block = 5;
  s.player.powers["PLATING"] = 4;
  assert.equal(hpLoss(s), 6);
});

test("drawing from an empty draw pile takes the discard pile back first (seen on Pommel Strike)", () => {
  const POMMEL = card("POMMEL_STRIKE", "Attack", "AnyEnemy", { Damage: 9, Cards: 1 });
  const s = state([POMMEL], 1, enemy(40, 0));
  s.discard = [STRIKE, STRIKE, DEFEND];
  const after = play(s, { kind: "play", hand: 0, target: 1 });
  assert.equal(after.drawn, 1);
  assert.equal(after.draw.length, 2);
  assert.deepEqual(after.discard.map((c) => c.id), ["POMMEL_STRIKE"]);
});

test("takes the kill when it is there", () => {
  const plan = planTurn(state([STRIKE, STRIKE, DEFEND], 2, enemy(12, 30)));
  assert.deepEqual(plan.actions.map(actionId), ["play_card:0:target:1", "play_card:0:target:1", "end_turn"]);
});

test("blocks what would kill it before anything else", () => {
  // 12 incoming at 5 HP: two Defends are the only way through the turn.
  const plan = planTurn(state([STRIKE, STRIKE, DEFEND, DEFEND, DEFEND], 3, enemy(44, 12), 5));
  const defends = plan.actions.filter((a) => a.kind === "play" && a.target === undefined).length;
  assert.ok(defends >= 2, `only ${defends} defends in ${plan.actions.map(actionId).join(" ")}`);
});

test("plays bash before strike, for the vulnerable", () => {
  const plan = planTurn(state([STRIKE, BASH], 3, enemy(100, 0)));
  assert.deepEqual(plan.actions.map(actionId), ["play_card:1:target:1", "play_card:0:target:1", "end_turn"]);
});

test("identical cards are expanded once", () => {
  const plan = planTurn(state([DEFEND, DEFEND, DEFEND, DEFEND, DEFEND], 3, enemy(44, 12)));
  assert.ok(plan.nodes <= 4, `${plan.nodes} nodes for five identical cards`);
});

test("a full starter hand plans well inside the budget", () => {
  const plan = planTurn(state([BASH, STRIKE, STRIKE, DEFEND, DEFEND], 3, enemy(44, 12)));
  assert.ok(!plan.truncated);
  assert.ok(plan.ms < 50, `${plan.ms.toFixed(2)} ms`);
});
