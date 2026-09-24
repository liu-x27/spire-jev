import assert from "node:assert/strict";
import { test } from "node:test";
import { actionId, deckPace, evaluate, futureDamage, planTurn, safetyMargin, TURN_WEIGHTS } from "../src/search.ts";
import { type Card, type Enemy, play, type State } from "../src/sim.ts";

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

test("with setup on, a power worth its turns is played on a safe turn, and not when the fight ends now", () => {
  const fnp = card("FEEL_NO_PAIN", "Power", "Self", { Power: 3 });
  const long = state([fnp, STRIKE], 1, [foe(1, 120, 0)]);
  assert.equal(actionId(planTurn(long, { ...TURN_WEIGHTS, setup: 1 }).actions[0]!), "play_card:0");
  assert.equal(actionId(planTurn(long, TURN_WEIGHTS).actions[0]!), "play_card:1:target:1");
  const short = state([fnp, STRIKE], 1, [foe(1, 6, 0)]);
  assert.equal(actionId(planTurn(short, { ...TURN_WEIGHTS, setup: 1 }).actions[0]!), "play_card:1:target:1");
});

test("long: strips more of Vantom's Slippery on a small-hit turn", () => {
  const vantom = (attack: number): Enemy => ({
    id: 1, model: "VANTOM", hp: 183, maxHp: 183, block: 0, alive: true, powers: { SLIPPERY: 9 }, weakAtStart: false, startStrength: 0,
    intents: [{ type: "Attack", damage: attack, hits: 1 }],
  });
  // Stacks of Slippery the plan strips: one per strike.
  const stripped = (attack: number, w: typeof TURN_WEIGHTS, draw: Card[]) => {
    let s = state([STRIKE, STRIKE, DEFEND, DEFEND], 3, [vantom(attack)]);
    s.draw = draw;
    for (const a of planTurn(s, w).actions) if (a.kind === "play") s = play(s, a);
    return 9 - (s.enemies[0]!.powers["SLIPPERY"] ?? 0);
  };
  const long = { ...TURN_WEIGHTS, long: 1 };
  // A starter deck: one strike and two defends against Ink Blot's 8, two strikes with long.
  const starter = [STRIKE, STRIKE, DEFEND, DEFEND];
  assert.equal(stripped(8, TURN_WEIGHTS, starter), 1);
  assert.equal(stripped(8, long, starter), 2);
  // (With a deck of big hits a stack hides more HP, and long hits into Dismember too: one turn does
  // not know the stacks could go on a quiet turn instead. Whether that costs is for the runs to say.)
});

test("a death this turn is not the end with Lizard Tail unused", () => {
  const dying = () => {
    const s = state([], 0, [foe(1, 40, 90)]);
    s.relics = ["LIZARD_TAIL"];
    return s;
  };
  const unused = dying();
  unused.relicVars = { LIZARD_TAIL: { Heal: 50, _wasUsed: 0 } };
  const used = dying();
  used.relicVars = { LIZARD_TAIL: { Heal: 50, _wasUsed: 1 } };
  assert.ok(evaluate(unused) > -1e5);
  assert.ok(evaluate(used) < -1e5);
  // Surviving with plenty of HP is still better than spending the tail.
  const safe = state([], 0, [foe(1, 40, 10)]);
  safe.relics = ["LIZARD_TAIL"];
  safe.relicVars = unused.relicVars;
  assert.ok(evaluate(safe) > evaluate(unused));
});

test("stakes, sandpit2, and a Sandpit death that no revival undoes", () => {
  // Sandpit at 1: eaten after this turn, Lizard Tail or not.
  const pit = state([], 0, [foe(1, 200, 0)]);
  pit.enemies[0]!.powers["SANDPIT"] = 1;
  pit.relics = ["LIZARD_TAIL"];
  pit.relicVars = { LIZARD_TAIL: { Heal: 50, _wasUsed: 0 } };
  assert.ok(evaluate(pit) < -1e5);

  // A boss near its end (60 HP left, a deck of big hits to draw), the player at full HP: with stakes
  // (hpWorth 0.25) the HP above what the rest of the fight needs is spent on damage.
  const HEAVY = card("HEAVY", "Attack", "AnyEnemy", { Damage: 20 }, 2);
  const strikesPlayed = (w: typeof TURN_WEIGHTS, worth?: number) => {
    let s = state([STRIKE, STRIKE, DEFEND, DEFEND], 3, [{ ...foe(1, 60, 14), model: "VANTOM", maxHp: 183 }]);
    s.draw = [HEAVY, HEAVY, HEAVY, HEAVY];
    if (worth !== undefined) s.hpWorth = { worth, margin: safetyMargin(s) };
    let n = 0;
    for (const a of planTurn(s, w).actions) if (a.kind === "play") { if (s.hand[a.hand]!.id === "STRIKE_IRONCLAD") n++; s = play(s, a); }
    return n;
  };
  assert.ok(strikesPlayed({ ...TURN_WEIGHTS, stakes: 1 }, 0.25) > strikesPlayed(TURN_WEIGHTS), "stakes: more strikes at full HP in a boss fight");

  // The Insatiable at 200 HP with Sandpit 4 and a pace that would just make it: sandpit2 wants a turn to spare.
  const race = state([], 0, [foe(1, 200, 0)]);
  race.enemies[0]!.powers["SANDPIT"] = 4;
  const more = structuredClone(race);
  more.enemies[0]!.powers["SANDPIT"] = 5;
  const gain = (w: typeof TURN_WEIGHTS) => evaluate(more, w) - evaluate(race, w);
  assert.ok(gain({ ...TURN_WEIGHTS, sandpit2: 1 }) > gain(TURN_WEIGHTS));
});

test("engines: Feel No Pain in play is worth its blocks to come in a long fight with exhausting cards", () => {
  const EXH = card("TRUE_GRIT", "Skill", "Self", { Block: 7 });
  const fnp = state([], 0, [foe(1, 200, 5)]);
  fnp.draw = [EXH, EXH, EXH, STRIKE, STRIKE, DEFEND];
  const plain = structuredClone(fnp);
  fnp.player.powers["FEEL_NO_PAIN"] = 3;
  const w = { ...TURN_WEIGHTS, engines: 1 };
  assert.ok(evaluate(fnp, w) - evaluate(plain, w) > 10);
  assert.equal(evaluate(fnp, TURN_WEIGHTS), evaluate(plain, TURN_WEIGHTS));
  // With the fight about to end, it is worth nothing.
  const ending = structuredClone(fnp);
  ending.enemies[0]!.hp = 5;
  const endingPlain = structuredClone(plain);
  endingPlain.enemies[0]!.hp = 5;
  assert.equal(evaluate(ending, w), evaluate(endingPlain, w));
});
