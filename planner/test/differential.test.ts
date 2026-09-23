import assert from "node:assert/strict";
import { test } from "node:test";
import { compare } from "../src/differential.ts";
import { type Card, play, type State } from "../src/sim.ts";

const STRIKE: Card = {
  id: "STRIKE_IRONCLAD", cost: 1, costsX: false, type: "Attack", target: "AnyEnemy",
  keywords: [], vars: { Damage: 6 }, upgrades: 0, locked: false, glows: false,
};
const POMMEL: Card = { ...STRIKE, id: "POMMEL_STRIKE", vars: { Damage: 9, Cards: 1 } };

function state(hand: Card[]): State {
  return {
    player: { hp: 80, maxHp: 80, block: 0, powers: {} },
    energy: 3, hand, draw: [], discard: [], exhaust: [],
    enemies: [{ id: 1, model: "NIBBIT", hp: 44, maxHp: 44, block: 0, alive: true, powers: {}, weakAtStart: false, startStrength: 0, intents: [] }],
    drawn: 0, exact: true, lostHp: false, exhaustedThisTurn: false, relics: [],
  };
}

test("a prediction the game agrees with has no mismatches", () => {
  const s = state([STRIKE]);
  const predicted = play(s, { kind: "play", hand: 0, target: 1 });
  assert.deepEqual(compare("STRIKE_IRONCLAD", predicted, structuredClone(predicted)), []);
});

test("each field the game disagrees on is its own mismatch", () => {
  const s = state([STRIKE]);
  const predicted = play(s, { kind: "play", hand: 0, target: 1 });
  const actual = structuredClone(predicted);
  actual.enemies[0]!.hp = 40;
  actual.enemies[0]!.powers["CURL_UP"] = 3;
  const m = compare("STRIKE_IRONCLAD", predicted, actual);
  assert.deepEqual(m.map((x) => x.field), ["enemy1.hp", "enemy1.powers"]);
  assert.equal(m[0]!.predicted, 38);
  assert.equal(m[1]!.actual, "CURL_UP3");
});

test("a card that drew is not held to the hand size", () => {
  const s = state([POMMEL]);
  s.draw = [STRIKE];
  const predicted = play(s, { kind: "play", hand: 0, target: 1 });
  assert.equal(predicted.drawn, 1);
  const actual = structuredClone(predicted);
  actual.hand.push(STRIKE);
  assert.deepEqual(compare("POMMEL_STRIKE", predicted, actual), []);
});
