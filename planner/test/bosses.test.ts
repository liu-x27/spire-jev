// The eight bosses the bot had never met before the veteran profile (docs/run-generation.md): The
// Kin, Ceremonial Beast, Lagavulin Matriarch, Soul Fysh, Knowledge Demon, Kaiser Crab, Test Subject
// and Aeonglass. Each rule is written from the game's IL (tools/inspect --il) and checked against
// replays of pre-boss saves with the act's boss swapped in (runs/boss-*).
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Observation } from "../src/obs.ts";
import { evaluate, planTurn, useBossRules } from "../src/search.ts";
import { actions, type Card, type Enemy, formsToCome, fromObservation, hpLoss, incomingDamage, play, type State } from "../src/sim.ts";
import { nextTurn, seeded } from "../src/turn.ts";

const card = (id: string, type: string, target: string, vars: Record<string, number>, cost = 1, keywords: string[] = []): Card => ({
  id, cost, costsX: false, type, target, keywords, vars, upgrades: 0, locked: false, glows: false,
});
const STRIKE = card("STRIKE_IRONCLAD", "Attack", "AnyEnemy", { Damage: 6 });
const DEFEND = card("DEFEND_IRONCLAD", "Skill", "Self", { Block: 5 });
const TWIN = card("TWIN_STRIKE", "Attack", "AnyEnemy", { Damage: 5, Repeat: 2 });
const INFLAME = card("INFLAME", "Power", "Self", { StrengthPower: 2 });
const BECKON = card("BECKON", "Status", "None", { HpLoss: 6 });

function foe(model: string, hp: number, powers: Record<string, number> = {}, id = 1, attack = 10): Enemy {
  return {
    id, model, hp, maxHp: hp, block: 0, alive: true, powers: { ...powers }, weakAtStart: false, startStrength: powers["STRENGTH"] ?? 0,
    intents: attack ? [{ type: "Attack", damage: attack, hits: 1 }] : [{ type: "Buff", damage: 0, hits: 0 }],
  };
}
function state(hand: Card[], enemies: Enemy[], hp = 80, energy = 3): State {
  return {
    player: { hp, maxHp: 80, block: 0, powers: {} },
    energy, hand, draw: [STRIKE, STRIKE, STRIKE, DEFEND, DEFEND], discard: [], exhaust: [], enemies, drawn: 0, exact: true, lostHp: false,
    exhaustedThisTurn: false, relics: [], played: 0, skills: 0, unmovableUsed: false, potions: [], potionSlots: 3, potionsUsed: 0,
  };
}
const at = (s: State, hand: number, target?: number) => play(s, { kind: "play", hand, ...(target !== undefined ? { target } : {}) });
const plays = (s: State) => actions(s).filter((a) => a.kind === "play").length;

// ---------------------------------------------------------------- The Kin

test("kin: with the Priest up, a Strike goes at the Priest unless it saves a follower's hit", () => {
  const kin = (followerHp: number): Enemy[] => [
    foe("KIN_FOLLOWER", followerHp, { MINION: 1 }, 1, 8), foe("KIN_FOLLOWER", 62, { MINION: 1 }, 2, 0), foe("KIN_PRIEST", 199, {}, 3, 9),
  ];
  const target = (s: State) => {
    const a = planTurn(s).actions[0];
    return a?.kind === "play" ? a.target : undefined;
  };
  useBossRules({ sleep: false, kin: true });
  try {
    assert.equal(target(state([STRIKE], kin(40), 80, 1)), 3);
    // A follower a Strike kills before its 8 lands: that one.
    assert.equal(target(state([STRIKE], kin(6), 80, 1)), 1);
  } finally {
    useBossRules({ sleep: false });
  }
});

// ---------------------------------------------------------------- Ceremonial Beast

test("plow: HP lost that leaves the Beast at or under its Plow stuns it and strips its Strength", () => {
  const beast = foe("CEREMONIAL_BEAST", 166, { PLOW: 160, STRENGTH: 6 }, 1, 26);
  const s = state([STRIKE, STRIKE], [beast]);
  assert.equal(incomingDamage(s), 26);
  const broken = at(s, 0, 1);
  const b = broken.enemies[0]!;
  assert.equal(b.hp, 160);
  assert.equal(b.powers["PLOW"], undefined);
  assert.equal(b.powers["STRENGTH"], undefined);
  assert.equal(incomingDamage(broken), 0);
  // One HP short of it: nothing.
  const short = at(state([STRIKE], [{ ...beast, hp: 167 }]), 0, 1);
  assert.equal(short.enemies[0]!.powers["PLOW"], 160);
  assert.equal(incomingDamage(short), 26);
  // Damage its block takes breaks nothing.
  const blocked = at(state([STRIKE], [{ ...beast, block: 10 }]), 0, 1);
  assert.equal(blocked.enemies[0]!.powers["PLOW"], 160);
});

test("plow: the planner breaks it when a hand can, and takes no hit", () => {
  // 22 HP to the threshold: two Strikes and a Twin Strike do it; ending otherwise takes 26.
  const s = state([STRIKE, STRIKE, TWIN, DEFEND], [foe("CEREMONIAL_BEAST", 182, { PLOW: 160, STRENGTH: 6 }, 1, 26)]);
  const end = planTurn(s).actions.reduce((x, a) => (a.kind === "play" ? play(x, a) : x), s);
  assert.equal(end.enemies[0]!.powers["PLOW"], undefined);
  assert.equal(hpLoss(end), 0);
});

test("ringing: one card a turn", () => {
  const s = state([STRIKE, DEFEND, DEFEND], [foe("CEREMONIAL_BEAST", 100, {}, 1, 17)]);
  s.player.powers["RINGING"] = 1;
  assert.equal(plays(s), 2);
  assert.equal(plays(at(s, 1)), 0);
});

// ---------------------------------------------------------------- Lagavulin Matriarch

test("asleep: damage past her block wakes the Matriarch, stunned; into her block it does not", () => {
  const matriarch = { ...foe("LAGAVULIN_MATRIARCH", 233, { ASLEEP: 3, PLATING: 12 }, 1, 0), block: 12, intents: [{ type: "Sleep", damage: 0, hits: 0 }] };
  const s = state([STRIKE, STRIKE, STRIKE], [matriarch]);
  const two = at(at(s, 0, 1), 0, 1);
  assert.equal(two.enemies[0]!.powers["ASLEEP"], 3);
  const woken = at(two, 0, 1);
  const m = woken.enemies[0]!;
  assert.equal(m.powers["ASLEEP"], undefined);
  assert.equal(m.powers["PLATING"], undefined);
  assert.equal(m.hp, 227);
  assert.equal(incomingDamage(woken), 0);
});

test("asleep: she sleeps three enemy turns, Plating's block on her, and wakes by herself", () => {
  let s = state([], [{ ...foe("LAGAVULIN_MATRIARCH", 233, { ASLEEP: 3, PLATING: 12 }, 1, 0), block: 12, intents: [{ type: "Sleep", damage: 0, hits: 0 }] }]);
  s.turn = 1;
  const blocks: number[] = [];
  for (let t = 1; t <= 3; t++) {
    s = nextTurn(s, seeded(t), () => [{ type: "Attack", damage: 21, hits: 1 }])!;
    blocks.push(s.enemies[0]!.block);
  }
  assert.deepEqual(blocks, [12, 11, 0]);
  assert.equal(s.enemies[0]!.powers["ASLEEP"], undefined);
  assert.equal(incomingDamage(s), 21);
});

test("sleep: the planner leaves her asleep with two turns to go, and plays its powers", () => {
  const asleep = (turns: number): Enemy => ({
    ...foe("LAGAVULIN_MATRIARCH", 233, { ASLEEP: turns, PLATING: 12 }, 1, 0), block: 0, intents: [{ type: "Sleep", damage: 0, hits: 0 }],
    asleep: { turns, hp: 233 },
  });
  useBossRules({ sleep: true });
  try {
    const first = state([STRIKE, STRIKE, INFLAME], [asleep(3)]);
    const line = planTurn(first).actions.filter((a) => a.kind === "play").map((a) => (a.kind === "play" ? first.hand[a.hand]!.id : ""));
    assert.deepEqual(line, ["INFLAME"]);
    // Her last turn asleep: waking her now costs nothing, so the Strikes go in.
    const last = state([STRIKE, STRIKE], [asleep(1)]);
    const end = planTurn(last).actions.reduce((x, a) => (a.kind === "play" ? play(x, a) : x), last);
    assert.equal(end.enemies[0]!.hp, 221);
  } finally {
    useBossRules({ sleep: false });
  }
});

// ---------------------------------------------------------------- Soul Fysh

test("intangible: every hit on the Fysh is 1", () => {
  const s = at(state([TWIN], [foe("SOUL_FYSH", 120, { INTANGIBLE: 1 }, 1, 15)]), 0, 1);
  assert.equal(s.enemies[0]!.hp, 118);
});

test("beckon: 6 HP a Beckon held at the end of the turn, past block; played, it costs an energy and nothing else", () => {
  const s = state([BECKON, BECKON, DEFEND], [foe("SOUL_FYSH", 200, {}, 1, 0)]);
  s.player.block = 20;
  assert.equal(hpLoss(s), 12);
  const played = at(s, 0);
  assert.equal(played.player.hp, 80);
  assert.equal(played.energy, 2);
  assert.equal(played.discard.at(-1)!.id, "BECKON");
  assert.equal(hpLoss(played), 6);
});

test("beckon: with nothing to hit, the planner plays its Beckons", () => {
  const s = state([BECKON, BECKON, STRIKE], [foe("SOUL_FYSH", 200, { INTANGIBLE: 1 }, 1, 0)]);
  const end = planTurn(s).actions.reduce((x, a) => (a.kind === "play" ? play(x, a) : x), s);
  assert.equal(end.hand.filter((c) => c.id === "BECKON").length, 0);
});

// ---------------------------------------------------------------- Knowledge Demon

test("disintegration: its amount at the end of the turn, into block", () => {
  const s = state([], [foe("KNOWLEDGE_DEMON", 399, {}, 1, 18)]);
  s.player.powers["DISINTEGRATION"] = 13;
  assert.equal(hpLoss(s), 31);
  s.player.block = 20;
  assert.equal(hpLoss(s), 11);
});

test("sloth: three cards a turn, counting the ones played before the observation", () => {
  const s = state([STRIKE, STRIKE, DEFEND, DEFEND], [foe("KNOWLEDGE_DEMON", 399)], 80, 4);
  s.player.powers["SLOTH"] = 3;
  s.player.powerVars = { SLOTH: { _cardsPlayedThisTurn: 1 } };
  const two = at(at(s, 0, 1), 0, 1);
  assert.equal(plays(two), 0);
  // The next turn counts again from 0.
  const next = nextTurn(two, seeded(1), () => [])!;
  assert.equal(next.player.powerVars?.["SLOTH"]?.["_cardsPlayedThisTurn"], 0);
});

test("mind rot: a card fewer at the start of the turn", () => {
  const s = state([], [foe("KNOWLEDGE_DEMON", 399, {}, 1, 0)]);
  s.player.powers["MIND_ROT"] = 1;
  assert.equal(nextTurn(s, seeded(1), () => [])!.hand.length, 4);
});

// ---------------------------------------------------------------- Kaiser Crab

const crab = (): Enemy[] => {
  // As at the start: facing Rocket (Right), Crusher behind, its Thrash shown as 14 x 1.5 = 21.
  const crusher = foe("CRUSHER", 219, { BACK_ATTACK_LEFT: 1, CRAB_RAGE: 1 }, 1, 21);
  const rocket = foe("ROCKET", 209, { BACK_ATTACK_RIGHT: 1, CRAB_RAGE: 1 }, 2, 20);
  crusher.behindAtStart = true;
  for (const e of [crusher, rocket]) e.powerVars = { CRAB_RAGE: { StrengthPower: 6, Block: 99 } };
  return [crusher, rocket];
};
const crabState = (hand: Card[]): State => ({ ...state(hand, crab()), facing: 2 });

test("surrounded: the claw behind deals x1.5; targeting the other turns the player to it", () => {
  const s = crabState([STRIKE, STRIKE]);
  assert.equal(incomingDamage(s), 41);
  // Struck, the Crusher is faced: its 14 as it is, the Rocket's 20 now from behind, 30.
  const turned = at(s, 0, 1);
  assert.equal(turned.facing, 1);
  assert.equal(incomingDamage(turned), 44);
  // And back.
  assert.equal(incomingDamage(at(turned, 0, 2)), 41);
});

test("surrounded: with one claw killed, the player faces the other and nothing is behind", () => {
  const [crusher, rocket] = crab();
  const s: State = { ...state([STRIKE], [{ ...crusher!, hp: 5 }, rocket!]), facing: 1 };
  const killed = at(s, 0, 1);
  assert.equal(killed.facing, 2);
  // The Rocket's 20, its Crab Rage's 6 on top, not x1.5.
  assert.equal(incomingDamage(killed), 26);
  assert.equal(killed.enemies[1]!.block, 99);
});

test("surrounded: the facing comes from the bridge's _facing (Right 0, Left 1)", () => {
  const enemy = (id: number, model: string, side: string) => ({
    combat_id: id, model_id: model, hp: 200, max_hp: 219, block: 0, is_alive: true, intent: "", intents: [{ type: "Attack", damage: 21, hits: 1 }],
    powers: { [side]: 1, CRAB_RAGE_POWER: 1 },
  });
  const obs = (facing: number): Observation => ({
    phase: "combat", is_terminal: false, is_victory: false, seed: "X", act: 1, floor: 33, gold: 0, player_hp: 80, player_max_hp: 80,
    player_block: 0, player_energy: 3, player_powers: { SURROUNDED_POWER: 1 }, player_power_vars: { SURROUNDED_POWER: { _facing: facing } },
    deck_cards: [], relics: [], potions: [], room: null,
    combat: { turn: 1, hand: [], draw_pile: [], discard_pile: [], exhaust_pile: [], draw_pile_count: 0, discard_pile_count: 0, exhaust_pile_count: 0, max_energy: 3,
      enemies: [enemy(1, "CRUSHER", "BACK_ATTACK_LEFT_POWER"), enemy(2, "ROCKET", "BACK_ATTACK_RIGHT_POWER")] },
  });
  const right = fromObservation(obs(0));
  assert.equal(right.facing, 2);
  assert.deepEqual(right.enemies.map((e) => e.behindAtStart === true), [true, false]);
  const left = fromObservation(obs(1));
  assert.equal(left.facing, 1);
  assert.deepEqual(left.enemies.map((e) => e.behindAtStart === true), [false, true]);
});

// ---------------------------------------------------------------- Test Subject

test("enrage: every skill played gives the Test Subject its amount in Strength, and its attack grows", () => {
  const s = state([DEFEND, DEFEND, STRIKE], [foe("TEST_SUBJECT", 111, { ADAPTABLE: 1, ENRAGE: 3 }, 1, 20)]);
  assert.equal(incomingDamage(s), 20);
  const two = at(at(s, 0), 0);
  assert.equal(two.enemies[0]!.powers["STRENGTH"], 6);
  assert.equal(incomingDamage(two), 26);
  // An attack is no skill.
  assert.equal(at(two, 0, 1).enemies[0]!.powers["STRENGTH"], 6);
});

test("adaptable: a Test Subject killed in its first form is no win: it respawns at 212", () => {
  const subject = foe("TEST_SUBJECT", 6, { ADAPTABLE: 1, ENRAGE: 3, STRENGTH: 9, VULNERABLE: 2 }, 1, 31);
  subject.maxHp = 111;
  const s = state([STRIKE], [subject]);
  assert.equal(formsToCome(subject), 525);
  const killed = at(s, 0, 1);
  const k = killed.enemies[0]!;
  assert.equal(k.alive, false);
  assert.equal(k.revive, 212);
  assert.deepEqual(k.powers, { ADAPTABLE: 1 });
  assert.equal(incomingDamage(killed), 0);
  // Better than ending the turn under its 31, and nowhere near a win.
  assert.ok(evaluate(killed) > evaluate(s));
  assert.ok(evaluate(killed) < 1e5);
  const next = nextTurn(killed, seeded(1), () => [])!;
  const back = next.enemies[0]!;
  assert.equal(back.alive, true);
  assert.equal(back.hp, 212);
  assert.deepEqual(back.powers, { ADAPTABLE: 1, PAINFUL_STABS: 1 });
});

test("adaptable: the third form dies for good", () => {
  const subject = foe("TEST_SUBJECT", 6, { NEMESIS: 1 }, 1, 45);
  subject.maxHp = 313;
  const killed = at(state([STRIKE], [subject]), 0, 1);
  assert.equal(killed.enemies[0]!.revive, undefined);
  assert.ok(evaluate(killed) >= 1e6);
});

test("the dead window: an observed Test Subject at 0 HP with Adaptable is one to respawn", () => {
  const obs: Observation = {
    phase: "combat", is_terminal: false, is_victory: false, seed: "X", act: 1, floor: 33, gold: 0, player_hp: 50, player_max_hp: 80,
    player_block: 0, player_energy: 2, player_powers: {}, deck_cards: [], relics: [], potions: [], room: null,
    combat: { turn: 3, hand: [], draw_pile: [], discard_pile: [], exhaust_pile: [], draw_pile_count: 0, discard_pile_count: 0, exhaust_pile_count: 0, max_energy: 3,
      enemies: [{ combat_id: 1, model_id: "TEST_SUBJECT", hp: 0, max_hp: 212, block: 0, is_alive: false, intent: "RESPAWN_MOVE",
        intents: [{ type: "Heal", damage: 0, hits: 0 }, { type: "Buff", damage: 0, hits: 0 }], powers: { ADAPTABLE_POWER: 1, PAINFUL_STABS_POWER: 1 } }] },
  };
  const s = fromObservation(obs);
  assert.equal(s.enemies[0]!.revive, 313);
  assert.ok(evaluate(s) < 1e5);
  const third = nextTurn(s, seeded(1), () => [])!.enemies[0]!;
  assert.equal(third.hp, 313);
  assert.equal(third.powers["INTANGIBLE"], 1);
  // Nemesis: Intangible every other turn.
  assert.equal(nextTurn({ ...s, enemies: [third] }, seeded(2), () => [])!.enemies[0]!.powers["INTANGIBLE"], undefined);
});

// ---------------------------------------------------------------- Kaiser Crab, Aeonglass

test("crab rage: the claw left alone gains 6 Strength and 99 Block", () => {
  const rage = { CRAB_RAGE: 1 };
  const crusher = foe("CRUSHER", 5, rage, 1, 12);
  const rocket = foe("ROCKET", 200, rage, 2, 18);
  for (const e of [crusher, rocket]) e.powerVars = { CRAB_RAGE: { StrengthPower: 6, Block: 99 } };
  const s = at(state([STRIKE], [crusher, rocket]), 0, 1);
  const left = s.enemies[1]!;
  assert.equal(s.enemies[0]!.alive, false);
  assert.equal(left.powers["STRENGTH"], 6);
  assert.equal(left.block, 99);
  assert.equal(incomingDamage(s), 24);
});

// ---------------------------------------------------------------- Scripts (scripts.ts, turn.ts)

const none = () => [];

test("scripts: the Kin Priest's Orb of Frailty frails the next turn, and Orb of Weakness is shown next", () => {
  const priest: Enemy = { ...foe("KIN_PRIEST", 199, {}, 3, 9), move: "ORB_OF_FRAILTY_MOVE" };
  const next = nextTurn(state([], [priest]), seeded(1), none)!;
  assert.equal(next.player.powers["FRAIL"], 1);
  assert.equal(next.enemies[0]!.move, "ORB_OF_WEAKNESS_MOVE");
  assert.deepEqual(next.enemies[0]!.intents.map((i) => `${i.type}${i.damage}`), ["Attack9", "Debuff0"]);
  // Ritual: +3 Strength, and every hit after it shows it.
  const ritual = nextTurn(state([], [{ ...priest, move: "RITUAL_MOVE", intents: [{ type: "Buff", damage: 0, hits: 0 }] }]), seeded(1), none)!;
  assert.equal(ritual.enemies[0]!.powers["STRENGTH"], 3);
  assert.equal(ritual.enemies[0]!.intents[0]!.damage, 12);
});

test("scripts: Soul Fysh's Beckon puts a Beckon in the draw pile and one in the discard pile", () => {
  const fysh: Enemy = { ...foe("SOUL_FYSH", 221, {}, 1, 0), move: "BECKON_MOVE", intents: [{ type: "StatusCard", damage: 0, hits: 0 }] };
  const next = nextTurn(state([], [fysh]), seeded(1), none)!;
  const beckons = [...next.hand, ...next.draw, ...next.discard].filter((c) => c.id === "BECKON").length;
  assert.equal(beckons, 2);
  assert.equal(next.enemies[0]!.intents[0]!.damage, 18);
});

test("scripts: the Rocket's Laser, 38 after Charge Up, is 57 from behind", () => {
  const [crusher, rocket] = crab();
  const s: State = { ...state([], [{ ...crusher!, behindAtStart: false, move: "BUG_STING_MOVE" }, { ...rocket!, move: "CHARGE_UP_MOVE" }]), facing: 1 };
  const next = nextTurn(s, seeded(1), none)!;
  const r = next.enemies[1]!;
  assert.equal(r.powers["STRENGTH"], 3);
  assert.equal(r.intents[0]!.damage, 57);
  assert.equal(r.behindAtStart, true);
  // Bug Sting's Weak and Frail on the player, and the Crusher in front: its Adapt, a Buff.
  assert.equal(next.player.powers["WEAK"], 2);
  assert.equal(next.player.powers["FRAIL"], 2);
  assert.equal(next.enemies[0]!.intents[0]!.type, "Buff");
  assert.equal(incomingDamage(next), 57);
});

test("scripts: Increasing Intensity upgrades every Wither by 3, adds two, and gains 4 Strength the first time", () => {
  const glass: Enemy = { ...foe("AEONGLASS", 535, { ARTIFACT: 3 }, 1, 0), move: "INCREASING_INTENSITY_MOVE", intents: [{ type: "StatusCard", damage: 0, hits: 0 }] };
  const s = state([], [glass]);
  s.turn = 3;
  s.draw = [card("WITHER", "Status", "None", { Damage: 3 }, -1, ["Unplayable"])];
  const next = nextTurn(s, seeded(1), none)!;
  const withers = [...next.hand, ...next.draw, ...next.discard].filter((c) => c.id === "WITHER").map((c) => c.vars["Damage"]);
  assert.deepEqual(withers.sort(), [6, 6, 6]);
  assert.equal(next.enemies[0]!.powers["STRENGTH"], 4);
  // Ebb next, 26 with the Strength: 30.
  assert.equal(next.enemies[0]!.intents[0]!.damage, 30);
  // The Wither the draw pile held is not the one the state before still has.
  assert.equal(s.draw[0]!.vars["Damage"], 3);
});

test("scripts: the Matriarch left asleep wakes after her third turn and Slashes on the fourth", () => {
  let s = state([], [{ ...foe("LAGAVULIN_MATRIARCH", 233, { ASLEEP: 3, PLATING: 12 }, 1, 0), block: 12, move: "SLEEP_MOVE", intents: [{ type: "Sleep", damage: 0, hits: 0 }] }]);
  s.turn = 1;
  for (let t = 1; t <= 3; t++) s = nextTurn(s, seeded(t), none)!;
  assert.equal(s.enemies[0]!.move, "SLASH_MOVE");
  assert.equal(incomingDamage(s), 21);
});

test("withering presence: the card that takes CardsLeft to 0 puts a Wither in hand, which hurts at the turn's end", () => {
  const glass = foe("AEONGLASS", 535, { WITHERING_PRESENCE: 6, ARTIFACT: 3 }, 1, 0);
  glass.powerVars = { WITHERING_PRESENCE: { CardsLeft: 2 } };
  const s = state([DEFEND, DEFEND, DEFEND], [glass]);
  s.discard = [card("WITHER", "Status", "None", { Damage: 6 }, -1, ["Unplayable"])];
  const one = at(s, 0);
  assert.equal(one.hand.some((c) => c.id === "WITHER"), false);
  const two = at(one, 0);
  assert.equal(two.hand.filter((c) => c.id === "WITHER").length, 1);
  // 10 block against the Wither's 6: none of it through.
  assert.equal(hpLoss(two), 0);
  assert.equal(hpLoss({ ...two, player: { ...two.player, block: 0 } }), 6);
});
