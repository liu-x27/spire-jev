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
  const nine = () => [{ type: "Attack", damage: 9, hits: 1 }];
  const next = nextTurn(s, seeded(1), nine)!;
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
  assert.deepEqual(nextTurn(s, seeded(1), nine)!.hand.map((c) => c.id), next.hand.map((c) => c.id));
  // A turn the enemies win has no next.
  const dying = state([], 0, [foe(100, 90)]);
  assert.equal(nextTurn(dying, seeded(1), nine), undefined);
});

test("Demon Form is played into a long fight, by one turn and by two, and not into a short one", () => {
  const fight = (hp: number) => state([DEMON_FORM, STRIKE, STRIKE, DEFEND], 3, [foe(hp, 4)], Array(8).fill(STRIKE));
  const first = (p: ReturnType<typeof planTurn>, s: State) => (p.actions[0]!.kind === "play" ? s.hand[(p.actions[0] as { hand: number }).hand]!.id : "end");
  const long1 = fight(400);
  const long2 = fight(400);
  assert.equal(first(planTurn(long1, TURN_WEIGHTS), long1), "DEMON_FORM");
  assert.equal(first(planTurn2(long2, { ...TURN_WEIGHTS, look: 1 }), long2), "DEMON_FORM");
  const short = fight(14);
  assert.notEqual(first(planTurn(short, TURN_WEIGHTS), short), "DEMON_FORM");
});

test("seed 17's Vantom, Dismember coming and no block in hand: Demon Form (it won the first A0 clear)", () => {
  const ANGER = card("ANGER", "Attack", "AnyEnemy", { Damage: 6 }, 0);
  const POMMEL = card("POMMEL_STRIKE", "Attack", "AnyEnemy", { Damage: 10, Cards: 2 }, 1);
  const BLOODLETTING = card("BLOODLETTING", "Skill", "Self", { HpLoss: 3, Energy: 2 }, 0);
  const vantom: Enemy = { ...foe(149, 26), model: "VANTOM", maxHp: 183 };
  const s = state([ANGER, POMMEL, DEMON_FORM, STRIKE, BLOODLETTING], 3, [vantom], [STRIKE, DEFEND]);
  s.player.hp = 77;
  s.player.powers = { PLATING: 2, STRENGTH: 1 };
  let t = s;
  const played: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = planTurn(t, TURN_WEIGHTS).actions[0]!;
    if (a.kind !== "play") break;
    played.push(t.hand[a.hand]!.id);
    t = play(t, a);
  }
  assert.ok(played.includes("DEMON_FORM"), played.join(" "));
});
