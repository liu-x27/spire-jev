// Chains of Binding's Bound and the second lives (Lizard Tail, Fairy in a Bottle), from the Queen
// fight of seed 17 (rules2-a0, the first clear) and the game's own hooks: ChainsOfBindingPower
// (AfterCardDrawn, BeforeCardPlayed, ShouldPlay, BeforeSideTurnEnd; Data.boundCardPlayed),
// FairyInABottle.ShouldDie, LizardTail.ShouldDieLate.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { CardObs, Observation } from "../src/obs.ts";
import { evaluate, planTurn } from "../src/search.ts";
import { actions, type Card, type Enemy, fromObservation, hpAfterTurn, type Potion, play, revivalFor, type State, stateKey } from "../src/sim.ts";
import { nextTurn, seeded } from "../src/turn.ts";

const card = (id: string, type: string, target: string, vars: Record<string, number>, cost = 1): Card => ({
  id, cost, costsX: false, type, target, keywords: [], vars, upgrades: 0, locked: false, glows: false,
});
const STRIKE = card("STRIKE_IRONCLAD", "Attack", "AnyEnemy", { Damage: 6 });
const DEFEND = card("DEFEND_IRONCLAD", "Skill", "Self", { Block: 5 });
const bound = (c: Card): Card => ({ ...c, bound: true });
const FAIRY: Potion = { slot: 0, id: "FAIRY_IN_A_BOTTLE", target: "None", usage: "Automatic", vars: {} };

function foe(hp: number, attack: number, id = 1, model = "QUEEN"): Enemy {
  return {
    id, model, hp, maxHp: hp, block: 0, alive: true, powers: {}, weakAtStart: false, startStrength: 0,
    intents: attack ? [{ type: "Attack", damage: attack, hits: 1 }] : [{ type: "Buff", damage: 0, hits: 0 }],
  };
}
function state(hand: Card[], energy: number, enemies: Enemy[], hp = 80, maxHp = 80): State {
  return {
    player: { hp, maxHp, block: 0, powers: {} },
    energy, hand, draw: [STRIKE, STRIKE, DEFEND, DEFEND, STRIKE], discard: [], exhaust: [], enemies, drawn: 0, exact: true,
    lostHp: false, exhaustedThisTurn: false, relics: [], played: 0, skills: 0, unmovableUsed: false, potions: [], potionSlots: 3, potionsUsed: 0,
  };
}
const withTail = (s: State, used = 0): State => ({ ...s, relics: [...s.relics, "LIZARD_TAIL"], relicVars: { LIZARD_TAIL: { Heal: 50, _wasUsed: used } } });
const plays = (s: State) => actions(s).filter((a) => a.kind === "play").map((a) => (a.kind === "play" ? s.hand[a.hand]!.id + (s.hand[a.hand]!.bound ? "*" : "") : ""));

// ---------------------------------------------------------------- Bound

test("bound: one Bound card a turn; the others wait, free cards do not", () => {
  const s = state([bound(STRIKE), bound(DEFEND), STRIKE], 3, [foe(300, 10)]);
  assert.deepEqual(plays(s).sort(), ["DEFEND_IRONCLAD*", "STRIKE_IRONCLAD", "STRIKE_IRONCLAD*"]);
  const after = play(s, { kind: "play", hand: 0, target: 1 });
  assert.equal(after.boundPlayed, true);
  // The Bound Defend is refused now; the free Strike is not.
  assert.deepEqual(plays(after), ["STRIKE_IRONCLAD"]);
});

test("bound: a Bound and a free copy of a card are different plays and different states", () => {
  const s = state([bound(STRIKE), STRIKE], 3, [foe(300, 10)]);
  // Identical cards are offered once; a Bound one is not identical to a free one.
  assert.equal(plays(s).length, 2);
  const viaBound = play(s, { kind: "play", hand: 0, target: 1 });
  const viaFree = play(s, { kind: "play", hand: 1, target: 1 });
  assert.notEqual(stateKey(viaBound), stateKey(viaFree));
});

test("bound: the planner does not count on a second Bound card", () => {
  // Two Bound Defends would block the 10; only one can be played, so the right line is the Bound
  // Defend and the free Strike, not a plan that needs both Defends.
  const s = state([bound(DEFEND), bound(DEFEND), STRIKE], 2, [foe(300, 10)]);
  const plan = planTurn(s);
  let t = s;
  let boundPlays = 0;
  for (const a of plan.actions) {
    if (a.kind !== "play") break;
    if (t.hand[a.hand]!.bound) boundPlays++;
    t = play(t, a);
  }
  assert.ok(boundPlays <= 1);
});

const cardObs = (id: string, extra: Partial<CardObs> = {}): CardObs => ({
  index: 0, card_id: id, cost: 1, current_cost: 1, costs_x: false, can_play: true, target_type: "AnyEnemy", upgrades: 0, keywords: [],
  vars: { Damage: 6 }, card_type: "Attack", ...extra,
});
function observation(hand: CardObs[], powerVars: Record<string, Record<string, number>> = {}): Observation {
  return {
    phase: "combat", is_terminal: false, is_victory: false, seed: "JEV00017", act: 3, floor: 48, gold: 0,
    player_hp: 56, player_max_hp: 104, player_block: 0, player_energy: 3, player_powers: { CHAINS_OF_BINDING_POWER: 3 }, player_power_vars: powerVars,
    deck_cards: [], relics: [], potions: [],
    combat: { turn: 3, hand, draw_pile: [], discard_pile: [], exhaust_pile: [], draw_pile_count: 0, discard_pile_count: 0, exhaust_pile_count: 0, max_energy: 3, enemies: [] },
    room: null,
  };
}

test("bound: from the bridge, a card's affliction and whether this turn's Bound card was played", () => {
  const fresh = fromObservation(observation([cardObs("STRIKE_IRONCLAD", { affliction: "BOUND", affliction_amount: 1 }), cardObs("STRIKE_IRONCLAD")]));
  assert.equal(fresh.hand[0]!.bound, true);
  assert.equal(fresh.hand[1]!.bound, undefined);
  assert.equal(fresh.boundPlayed, undefined);
  const later = fromObservation(observation([cardObs("STRIKE_IRONCLAD", { affliction: "BOUND", can_play: false })], { CHAINS_OF_BINDING_POWER: { boundCardPlayed: 1 } }));
  assert.equal(later.boundPlayed, true);
  // The game already refuses it: locked, as any card it refuses though affordable.
  assert.equal(later.hand[0]!.locked, true);
});

test("bound: the next turn's first three draws are Bound, retained cards are not, none played yet", () => {
  const s = state([{ ...bound(DEFEND), keywords: ["Retain"] }], 0, [foe(300, 0)]);
  s.player.powers["CHAINS_OF_BINDING"] = 3;
  s.boundPlayed = true;
  const next = nextTurn(s, seeded(1), () => [])!;
  assert.equal(next.hand[0]!.bound, undefined); // retained: Bound ended with the turn
  assert.deepEqual(next.hand.slice(1).map((c) => c.bound ?? false), [true, true, true, false, false]);
  assert.equal(next.boundPlayed, undefined);
});

// ---------------------------------------------------------------- second lives

test("lizard tail: seed 17's Queen, turn 5 — 18 HP, a 24 hit, back at 52 (the log: -34)", () => {
  const s = withTail(state([], 0, [foe(19, 24, 1, "TORCH_HEAD_AMALGAM"), foe(374, 0, 2)], 18, 104));
  const end = hpAfterTurn(s);
  assert.deepEqual(end, { hp: 52, revived: "LIZARD_TAIL" });
  assert.equal(s.player.hp - end.hp, -34);
  // Used once: no second time.
  assert.deepEqual(hpAfterTurn(withTail(state([], 0, [foe(19, 24)], 18, 104), 1)), { hp: -6 });
});

test("lizard tail: a card's HP cost that would kill is undone during the turn, once", () => {
  const hemo = card("HEMOKINESIS", "Attack", "AnyEnemy", { Damage: 14, HpLoss: 2 });
  const s = withTail(state([hemo, hemo], 2, [foe(300, 0)], 2, 80));
  const once = play(s, { kind: "play", hand: 0, target: 1 });
  assert.equal(once.player.hp, 40);
  assert.equal(once.relicVars?.["LIZARD_TAIL"]?.["_wasUsed"], 1);
  assert.equal(once.revivals, 1);
  // The state it was played from still has its tail.
  assert.equal(s.relicVars?.["LIZARD_TAIL"]?.["_wasUsed"], 0);
  // Without one, a death ends the turn: nothing is left to play.
  const dead = play(state([hemo, hemo], 2, [foe(300, 0)], 2, 80), { kind: "play", hand: 0, target: 1 });
  assert.ok(dead.player.hp <= 0);
  assert.deepEqual(actions(dead), [{ kind: "end" }]);
});

test("fairy in a bottle goes before lizard tail (ShouldDie before ShouldDieLate)", () => {
  const s = withTail(state([], 0, [foe(300, 50)], 10, 100));
  s.potions = [FAIRY];
  assert.deepEqual(revivalFor(s), { by: "FAIRY_IN_A_BOTTLE", hp: 30 });
  const next = nextTurn(s, seeded(1), () => [])!;
  assert.equal(next.player.hp, 30);
  assert.equal(next.potions.length, 0);
  assert.equal(next.relicVars?.["LIZARD_TAIL"]?.["_wasUsed"], 0);
  assert.equal(next.revivals, 1);
});

test("evaluation: a second life spent during the turn costs as one spent at its end does", () => {
  const hemo = card("HEMOKINESIS", "Attack", "AnyEnemy", { Damage: 14, HpLoss: 2 });
  const s = withTail(state([hemo], 1, [foe(300, 0)], 2, 80));
  const spent = play(s, { kind: "play", hand: 0, target: 1 }); // 40 HP, the tail gone, 14 damage done
  const kept = { ...withTail(state([], 0, [foe(286, 0)], 40, 80)) }; // 40 HP, the tail kept, same damage
  assert.ok(evaluate(kept) > evaluate(spent));
  // And a win that spent the tail is worth less than one that did not.
  const winSpent = { ...spent, enemies: spent.enemies.map((e) => ({ ...e, hp: 0, alive: false })) };
  const winKept = { ...kept, enemies: kept.enemies.map((e) => ({ ...e, hp: 0, alive: false })) };
  assert.ok(evaluate(winKept) > evaluate(winSpent));
});
