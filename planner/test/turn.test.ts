import assert from "node:assert/strict";
import { test } from "node:test";
import { planTurn, planTurn2, TURN_WEIGHTS } from "../src/search.ts";
import { type Card, type Enemy, play, type State } from "../src/sim.ts";
import { nextTurn, seeded } from "../src/turn.ts";

const card = (id: string, type: string, target: string, vars: Record<string, number>, cost = 1, keywords: string[] = []): Card => ({
  id, cost, costsX: false, type, target, keywords, vars, upgrades: 0, locked: false, glows: false,
});
const STRIKE = card("STRIKE_IRONCLAD", "Attack", "AnyEnemy", { Damage: 6 });
const DEFEND = card("DEFEND_IRONCLAD", "Skill", "Self", { Block: 5 });
const DEMON_FORM = card("DEMON_FORM", "Power", "Self", { StrengthPower: 3 }, 3);

function foe(hp: number, attack: number): Enemy {
  return {
    id: 1, model: "TEST_DUMMY", hp, maxHp: hp, block: 0, alive: true, powers: {}, weakAtStart: false, startStrength: 0,
    intents: [{ type: "Attack", damage: attack, hits: 1 }],
  };
}
function state(hand: Card[], energy: number, enemies: Enemy[], draw: Card[] = [STRIKE, STRIKE, STRIKE, DEFEND, DEFEND, STRIKE]): State {
  return {
    player: { hp: 80, maxHp: 80, block: 0, powers: {} }, energy, maxEnergy: 3,
    hand, draw, discard: [], exhaust: [], enemies, drawn: 0, exact: true,
    lostHp: false, exhaustedThisTurn: false, relics: [], played: 0, skills: 0, unmovableUsed: false, potions: [], potionSlots: 3, potionsUsed: 0,
  };
}

test("Demon Form is a power for the turns to come, not Strength now", () => {
  const s = play(state([DEMON_FORM], 3, [foe(100, 5)]), { kind: "play", hand: 0 });
  assert.equal(s.player.powers["DEMON_FORM"], 3);
  assert.equal(s.player.powers["STRENGTH"] ?? 0, 0);
});

test("the next turn: HP after the enemies, powers ticked, Demon Form's Strength, a hand of five, full energy", () => {
  const s = state([STRIKE, DEFEND], 0, [foe(100, 12)]);
  s.player.powers = { DEMON_FORM: 3, WEAK: 2, RAGE: 3, NO_DRAW: 1 };
  s.player.block = 5;
  const next = nextTurn(s, seeded(1), () => 9)!;
  assert.equal(next.player.hp, 80 - 7);
  assert.equal(next.player.block, 0);
  assert.equal(next.player.powers["STRENGTH"], 3);
  assert.equal(next.player.powers["WEAK"], 1);
  assert.equal(next.player.powers["RAGE"], undefined);
  assert.equal(next.player.powers["NO_DRAW"], undefined);
  assert.equal(next.hand.length, 5);
  assert.equal(next.energy, 3);
  assert.equal(next.discard.length + next.draw.length + next.hand.length, 8);
  assert.deepEqual(next.enemies[0]!.intents, [{ type: "Attack", damage: 9, hits: 1 }]);
  // The same state and seed draw the same hand.
  assert.deepEqual(nextTurn(s, seeded(1), () => 9)!.hand.map((c) => c.id), next.hand.map((c) => c.id));
  // A turn the enemies win has no next.
  const dying = state([], 0, [foe(100, 90)]);
  assert.equal(nextTurn(dying, seeded(1), () => 9), undefined);
});

test("planTurn2 plays Demon Form into a long fight where one turn would not", () => {
  const long = () => state([DEMON_FORM, STRIKE, STRIKE, DEFEND], 3, [foe(400, 4)], Array(8).fill(STRIKE));
  const first = (p: ReturnType<typeof planTurn>, s: State) => (p.actions[0]!.kind === "play" ? s.hand[(p.actions[0] as { hand: number }).hand]!.id : "end");
  const s1 = long();
  const s2 = long();
  const one = planTurn(s1, TURN_WEIGHTS);
  const two = planTurn2(s2, { ...TURN_WEIGHTS, look: 1 });
  assert.notEqual(first(one, s1), "DEMON_FORM", "one turn: strikes and block");
  assert.equal(first(two, s2), "DEMON_FORM", "two turns: Demon Form");
});
