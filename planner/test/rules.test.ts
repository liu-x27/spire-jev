// Card rules, each as the game showed it in a coverage run (planner/runs).
import assert from "node:assert/strict";
import { test } from "node:test";
import { type Card, type Enemy, hpLoss, play, type State } from "../src/sim.ts";

const card = (id: string, type: string, target: string, vars: Record<string, number>, cost = 1): Card => ({
  id, cost, costsX: false, type, target, keywords: [], vars, upgrades: 0, locked: false, glows: false,
});
const STRIKE = card("STRIKE_IRONCLAD", "Attack", "AnyEnemy", { Damage: 6 });
const BASH = card("BASH", "Attack", "AnyEnemy", { Damage: 8, VulnerablePower: 2 }, 2);

function foe(hp: number, attack = 0): Enemy {
  return {
    id: 1, model: "NIBBIT", hp, maxHp: hp, block: 0, alive: true, powers: {}, weakAtStart: false, startStrength: 0,
    intents: attack ? [{ type: "Attack", damage: attack, hits: 1 }] : [],
  };
}
function state(hand: Card[], e: Enemy = foe(80)): State {
  return {
    player: { hp: 80, maxHp: 80, block: 0, powers: {} },
    energy: 3, hand, draw: [STRIKE, STRIKE, STRIKE], discard: [], exhaust: [], enemies: [e], drawn: 0, exact: true, lostHp: false, exhaustedThisTurn: false, relics: [],
  };
}
const at = (s: State, hand: number) => play(s, { kind: "play", hand, target: 1 });

test("anger puts a copy of itself in the discard pile", () => {
  const after = at(state([card("ANGER", "Attack", "AnyEnemy", { Damage: 6 }, 0)]), 0);
  assert.deepEqual(after.discard.map((c) => c.id), ["ANGER", "ANGER"]);
});

test("vicious is a power, and applying vulnerable under it draws", () => {
  const vicious = card("VICIOUS", "Power", "Self", { Cards: 2 });
  const s = play(state([vicious, BASH]), { kind: "play", hand: 0 });
  assert.equal(s.player.powers["VICIOUS"], 2);
  assert.equal(s.drawn, 0);
  assert.equal(at(s, 0).drawn, 2);
});

test("artifact blocks a debuff and loses a stack", () => {
  const e = foe(60);
  e.powers["ARTIFACT"] = 1;
  const after = at(state([BASH], e), 0);
  assert.equal(after.enemies[0]!.powers["VULNERABLE"], undefined);
  assert.equal(after.enemies[0]!.powers["ARTIFACT"], 0);
});

test("spite hits twice only once the player has lost HP this turn", () => {
  const spite = card("SPITE", "Attack", "AnyEnemy", { Damage: 5, Repeat: 2 }, 0);
  assert.equal(at(state([spite]), 0).enemies[0]!.hp, 75);
  const hurt = state([spite]);
  hurt.lostHp = true;
  assert.equal(at(hurt, 0).enemies[0]!.hp, 70);
});

test("mangle's strength loss comes off the enemy's attack this turn", () => {
  const mangle = card("MANGLE", "Attack", "AnyEnemy", { Damage: 20, StrengthLoss: 10 }, 3);
  const after = at(state([mangle], foe(80, 14)), 0);
  assert.equal(after.enemies[0]!.powers["STRENGTH"], -10);
  assert.equal(hpLoss(after), 4);
});

test("constrict hits at the end of the turn, into block like an attack", () => {
  const s = state([], foe(40, 7));
  s.player.block = 6;
  s.player.powers["CONSTRICT"] = 6;
  assert.equal(hpLoss(s), 7);
});

test("killing the shrinker beetle takes its shrink away", () => {
  const beetle = foe(3);
  beetle.model = "SHRINKER_BEETLE";
  const s = state([STRIKE], beetle);
  s.player.powers["SHRINK"] = -1;
  assert.equal(at(s, 0).player.powers["SHRINK"], undefined);
});

test("stoke exhausts the rest of the hand and draws as many", () => {
  const stoke = card("STOKE", "Skill", "Self", {});
  const after = play(state([stoke, STRIKE, STRIKE]), { kind: "play", hand: 0 });
  assert.equal(after.exhaust.length, 2);
  assert.equal(after.drawn, 2);
});

test("thorns hit the player back for every hit, into block first", () => {
  const toad = foe(100);
  toad.powers["THORNS"] = 5;
  const twin = card("TWIN_STRIKE", "Attack", "AnyEnemy", { Damage: 5 });
  const s = state([twin], toad);
  s.player.block = 3;
  const after = at(s, 0);
  assert.equal(after.player.block, 0);
  assert.equal(after.player.hp, 73);
  assert.equal(after.lostHp, true);
});

test("hard to kill caps what a hit takes", () => {
  const exo = foe(24);
  exo.powers["HARD_TO_KILL"] = 9;
  const s = state([BASH], exo);
  s.player.powers["STRENGTH"] = 3;
  assert.equal(at(s, 0).enemies[0]!.hp, 15);
});

test("second wind exhausts the non-attacks in hand and blocks for each", () => {
  const wind = card("SECOND_WIND", "Skill", "Self", { Block: 5 });
  const defend = card("DEFEND_IRONCLAD", "Skill", "Self", { Block: 5 });
  const after = play(state([STRIKE, wind, defend, defend]), { kind: "play", hand: 1 });
  assert.equal(after.player.block, 10);
  assert.deepEqual(after.hand.map((c) => c.id), ["STRIKE_IRONCLAD"]);
  assert.equal(after.exhaust.length, 2);
});

test("relax's energy and cards come next turn", () => {
  const relax = { ...card("RELAX", "Skill", "Self", { Block: 16, Cards: 2, Energy: 2 }, 3), keywords: ["Exhaust"] };
  const after = play(state([relax]), { kind: "play", hand: 0 });
  assert.equal(after.energy, 0);
  assert.equal(after.drawn, 0);
  assert.equal(after.player.powers["ENERGY_NEXT_TURN"], 2);
});

test("infection left in hand hurts at the end of the turn", () => {
  const infection = { ...card("INFECTION", "Status", "None", { Damage: 3 }), keywords: ["Unplayable"] };
  const s = state([infection, infection], foe(40, 6));
  s.player.block = 8;
  assert.equal(hpLoss(s), 4);
});

test("strike dummy adds 3 to strikes only", () => {
  const s = state([STRIKE, BASH]);
  s.relics = ["STRIKE_DUMMY"];
  assert.equal(at(s, 0).enemies[0]!.hp, 71);
  assert.equal(at(s, 1).enemies[0]!.hp, 72);
});

test("feel no pain blocks when a card is exhausted, and juggernaut hits back when block comes", () => {
  const s = state([{ ...card("TREMBLE", "Skill", "AnyEnemy", { VulnerablePower: 3 }), keywords: ["Exhaust"] }], foe(40));
  s.player.powers["FEEL_NO_PAIN"] = 3;
  s.player.powers["JUGGERNAUT"] = 6;
  const after = at(s, 0);
  assert.equal(after.player.block, 3);
  assert.equal(after.enemies[0]!.hp, 34);
  assert.equal(after.exact, true);
});
