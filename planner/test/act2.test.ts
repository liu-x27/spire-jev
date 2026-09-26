// The act 2 bosses against our logs of them (runs/bench-*-f32-*.json, the f33 fights): The Insatiable
// from its IL (TheInsatiable.GenerateMoveStateMachine, SandpitPower, FranticEscape), and what the
// Knowledge Demon fights missed that was not the Demon's (Demise, Pael's Blood).
import assert from "node:assert/strict";
import { test } from "node:test";
import { setIntentAscension } from "../src/intents.ts";
import { BARE, BOSSES, bout, cardFromId } from "../src/spar.ts";
import { type Card, type Enemy, hpLoss, play, type State } from "../src/sim.ts";
import { moveIntents } from "../src/scripts.ts";
import { nextTurn, seeded } from "../src/turn.ts";

setIntentAscension(10);
const card = (id: string, type: string, target: string, vars: Record<string, number>, cost = 1): Card => ({
  id, cost, costsX: false, type, target, keywords: [], vars, upgrades: 0, locked: false, glows: false,
});
const STRIKE = card("STRIKE_IRONCLAD", "Attack", "AnyEnemy", { Damage: 6 });
const DEFEND = card("DEFEND_IRONCLAD", "Skill", "Self", { Block: 5 });
const ESCAPE = cardFromId("FRANTIC_ESCAPE")!;

function insatiable(hp: number, move: string, powers: Record<string, number> = {}): Enemy {
  const strength = powers["STRENGTH"] ?? 0;
  return {
    id: 1, model: "THE_INSATIABLE", hp, maxHp: 341, block: 0, alive: true, powers: { ...powers }, weakAtStart: false, startStrength: strength,
    intents: moveIntents("THE_INSATIABLE", move, strength, { vulnerable: false, weak: false, behind: false }), move,
  };
}
function state(hand: Card[], enemies: Enemy[], over: Partial<State> = {}): State {
  return {
    player: { hp: 80, maxHp: 80, block: 0, powers: {} },
    energy: 3, hand, draw: Array(10).fill(STRIKE) as Card[], discard: [], exhaust: [], enemies, drawn: 0, exact: true, lostHp: false,
    exhaustedThisTurn: false, relics: [], played: 0, skills: 0, unmovableUsed: false, potions: [], potionSlots: 3, potionsUsed: 0, turn: 1, ...over,
  };
}
const next = (s: State) => nextTurn(s, seeded(1), () => []);
const intent = (e: Enemy) => e.intents.map((i) => (i.type === "Attack" ? `Attack${i.damage}x${i.hits}` : i.type)).join("+");

// ---------------------------------------------------------------- The Insatiable

test("insatiable: Liquify Ground gives it Sandpit 4 and the player six Frantic Escapes, three to draw, three to discard", () => {
  const s = next(state([], [insatiable(312, "LIQUIFY_GROUND_MOVE")]))!;
  const e = s.enemies[0]!;
  assert.equal(e.powers["SANDPIT"], 4);
  assert.equal(intent(e), "Attack9x2");
  const escapes = (cards: Card[]) => cards.filter((c) => c.id === "FRANTIC_ESCAPE").length;
  assert.equal(escapes(s.discard), 3);
  assert.equal(escapes(s.hand) + escapes(s.draw), 3);
});

test("insatiable: its cycle and Sandpit a stack less every turn (seed 635's fight, turns 2-5)", () => {
  // The end of turn 2: Sandpit 5 (4 and a Frantic Escape), Strength 1, Thrash shown. Turn 3 began at
  // Sandpit 4 with Lunging Bite 32 shown.
  const t3 = next(state([], [insatiable(162, "THRASH_MOVE", { SANDPIT: 5, STRENGTH: 1 })]))!;
  assert.equal(t3.enemies[0]!.powers["SANDPIT"], 4);
  assert.equal(intent(t3.enemies[0]!), "Attack32x1");
  // Salivate at Strength 2, Sandpit 4: turn 5 began at Strength 5, Sandpit 3, Thrash 14x2.
  const t5 = next(state([], [insatiable(26, "SALIVATE_MOVE", { SANDPIT: 4, STRENGTH: 2 })]))!;
  assert.equal(t5.enemies[0]!.powers["STRENGTH"], 5);
  assert.equal(t5.enemies[0]!.powers["SANDPIT"], 3);
  assert.equal(intent(t5.enemies[0]!), "Attack14x2");
  // Thrash 2 comes round to Thrash.
  assert.equal(next(state([], [insatiable(200, "THRASH_MOVE_2", { SANDPIT: 4 })]))!.enemies[0]!.move, "THRASH_MOVE");
});

test("insatiable: Sandpit at 1 devours the player at the turn's end; at 2 the next turn starts at 1", () => {
  assert.equal(next(state([], [insatiable(200, "SALIVATE_MOVE", { SANDPIT: 1 })])), undefined);
  assert.equal(hpLoss(state([], [insatiable(200, "SALIVATE_MOVE", { SANDPIT: 1 })])), 80);
  assert.equal(next(state([], [insatiable(200, "SALIVATE_MOVE", { SANDPIT: 2 })]))!.enemies[0]!.powers["SANDPIT"], 1);
});

test("frantic escape: Sandpit a stack more, and the card costs 1 more each time it is played", () => {
  const s = play(state([ESCAPE], [insatiable(200, "THRASH_MOVE", { SANDPIT: 3 })]), { kind: "play", hand: 0 });
  assert.equal(s.enemies[0]!.powers["SANDPIT"], 4);
  assert.equal(s.energy, 2);
  assert.equal(s.discard.find((c) => c.id === "FRANTIC_ESCAPE")!.cost, 2);
});

test("insatiable: left alone, the pit takes the player at the end of turn 5; in a spar bout it has Sandpit too", () => {
  // Turn 1 Liquify (Sandpit 4 at its end), turns 2-4 start at 3, 2, 1: turn 5's end devours.
  let s: State | undefined = state([], [insatiable(341, "LIQUIFY_GROUND_MOVE")], { player: { hp: 999, maxHp: 999, block: 0, powers: {} } });
  let turns = 0;
  while (s && turns < 10) {
    s = next({ ...s, hand: [] });
    turns++;
  }
  assert.equal(turns, 5); // the fifth end of turn is the one that never comes back
  // spar's Insatiable opens with Liquify Ground; a bout that cannot hold the pit off is devoured.
  assert.equal(BOSSES["THE_INSATIABLE"]!.move, "LIQUIFY_GROUND_MOVE");
  const b = bout(Array(12).fill(STRIKE) as Card[], BOSSES["THE_INSATIABLE"]!, seeded(3), 20, { ...BARE, hp: 999, maxHp: 999 });
  assert.equal(b.won, false);
  assert.equal(b.hpLost, 999);
});

// ---------------------------------------------------------------- what the Knowledge Demon fights missed

test("demise: its amount off the enemy at the end of its turn (seed 598's Demon, 347 -> 338)", () => {
  const demon: Enemy = {
    id: 1, model: "KNOWLEDGE_DEMON", hp: 347, maxHp: 399, block: 0, alive: true, powers: { DEMISE: 9 }, weakAtStart: false, startStrength: 0,
    intents: [{ type: "Debuff", damage: 0, hits: 0 }], move: "CURSE_OF_KNOWLEDGE_MOVE",
  };
  const n = next(state([], [demon]))!;
  assert.equal(n.enemies[0]!.hp, 338);
  assert.equal(n.enemies[0]!.powers["DEMISE"], 9);
});

test("pael's blood: six cards a turn", () => {
  const dummy: Enemy = {
    id: 1, model: "DUMMY", hp: 100, maxHp: 100, block: 0, alive: true, powers: {}, weakAtStart: false, startStrength: 0, intents: [{ type: "Buff", damage: 0, hits: 0 }],
  };
  assert.equal(next(state([], [dummy], { relics: ["PAELS_BLOOD"] }))!.hand.length, 6);
  assert.equal(next(state([], [dummy]))!.hand.length, 5);
});
