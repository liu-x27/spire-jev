// Cards whose effect is more than their numbers, each rule written from the game's IL
// (tools/inspect --il; the card classes' OnPlay and hooks, and the powers they apply).
import assert from "node:assert/strict";
import { test } from "node:test";
import { type Card, endOfTurn, type Enemy, hpLoss, play, type State } from "../src/sim.ts";
import { nextTurn, seeded } from "../src/turn.ts";

const card = (id: string, type: string, target: string, vars: Record<string, number>, cost = 1, keywords: string[] = [], extra: Partial<Card> = {}): Card => ({
  id, cost, costsX: false, type, target, keywords, vars, upgrades: 0, locked: false, glows: false, ...extra,
});
const STRIKE = card("STRIKE_IRONCLAD", "Attack", "AnyEnemy", { Damage: 6 });
const DEFEND = card("DEFEND_IRONCLAD", "Skill", "Self", { Block: 5 });
const TWIN = card("TWIN_STRIKE", "Attack", "AnyEnemy", { Damage: 5, Repeat: 2 });
const WOUND = card("WOUND", "Status", "None", {}, -1, ["Unplayable"]);
const CURSE = card("CLUMSY", "Curse", "None", {}, -1, ["Unplayable"]);
const DAZED = card("DAZED", "Status", "None", {}, -1, ["Ethereal", "Unplayable"]);

function foe(hp: number, id = 1, powers: Record<string, number> = {}): Enemy {
  return { id, model: "DUMMY", hp, maxHp: hp, block: 0, alive: true, powers: { ...powers }, weakAtStart: false, startStrength: powers["STRENGTH"] ?? 0, intents: [{ type: "Buff", damage: 0, hits: 0 }] };
}
function state(hand: Card[], enemies: Enemy[] = [foe(50)], over: Partial<State> = {}): State {
  return {
    player: { hp: 60, maxHp: 80, block: 0, powers: {} },
    energy: 3, hand, draw: [], discard: [], exhaust: [], enemies, drawn: 0, exact: true, lostHp: false,
    exhaustedThisTurn: false, relics: [], played: 0, skills: 0, unmovableUsed: false, potions: [], potionSlots: 3, potionsUsed: 0,
    turn: 1, ...over,
  };
}
const withPowers = (s: State, powers: Record<string, number>, powerVars?: Record<string, Record<string, number>>): State =>
  ({ ...s, player: { ...s.player, powers: { ...s.player.powers, ...powers }, ...(powerVars ? { powerVars } : {}) } });
const at = (s: State, hand: number, target?: number) => play(s, { kind: "play", hand, ...(target !== undefined ? { target } : {}) });
const next = (s: State) => nextTurn(s, seeded(1), () => [])!;
const hp = (s: State, i = 0) => s.enemies[i]!.hp;

// ---------------------------------------------------------------- calculated damage, from the state

const calc = (id: string, base: number, extra: number, extraCard: Partial<Card> = {}) =>
  card(id, "Attack", "AnyEnemy", { CalculationBase: base, ExtraDamage: extra, CalculatedDamage: base }, 1, [], extraCard);

test("perfected strike: 2 more for every Strike in the combat's piles, itself included", () => {
  const s = state([calc("PERFECTED_STRIKE", 6, 2), STRIKE], [foe(50)], { draw: [STRIKE, DEFEND], discard: [TWIN] });
  assert.equal(hp(at(s, 0, 1)), 50 - (6 + 2 * 4));
});

test("bully: 2 more for every Vulnerable on its target, as it stands", () => {
  const s = state([calc("BULLY", 4, 2)], [foe(50, 1, { VULNERABLE: 2 })]);
  assert.equal(hp(at(s, 0, 1)), 50 - Math.floor((4 + 2 * 2) * 1.5));
});

test("ashen strike: 3 more for every card in the exhaust pile", () => {
  const s = state([calc("ASHEN_STRIKE", 6, 3)], [foe(50)], { exhaust: [WOUND, WOUND, CURSE] });
  assert.equal(hp(at(s, 0, 1)), 50 - 15);
});

test("rend: 5 more for every debuff on its target, less Strength one of them", () => {
  const s = state([calc("REND", 10, 5)], [foe(50, 1, { WEAK: 1, STRENGTH: -2 })]);
  assert.equal(hp(at(s, 0, 1)), 50 - 20);
});

test("gold axe: 1 for every card played this combat, the observation's count and the ones since", () => {
  const s = state([calc("GOLD_AXE", 0, 1, { calc: { CalculatedDamage: 3 } })], [foe(50)], { played: 2 });
  assert.equal(hp(at(s, 0, 1)), 45);
});

test("mind blast: the draw pile's size", () => {
  const s = state([calc("MIND_BLAST", 0, 1)], [foe(50)], { draw: [STRIKE, STRIKE, DEFEND, DEFEND] });
  assert.equal(hp(at(s, 0, 1)), 46);
});

test("tear asunder: a hit more for every time the player took damage past block, across the turns", () => {
  const tear = card("TEAR_ASUNDER", "Attack", "AnyEnemy", { Damage: 5, Repeat: 1, CalculationBase: 0, CalculationExtra: 1, CalculatedHits: 0 }, 2, [], { calc: { CalculatedHits: 2 } });
  assert.equal(hp(at(state([tear], [foe(50)], { hurt: 1 }), 0, 1)), 50 - 5 * 4);
  // A card's HP cost counts.
  const hemo = card("HEMOKINESIS", "Attack", "AnyEnemy", { Damage: 15, HpLoss: 2 });
  assert.equal(at(state([hemo]), 0, 1).hurt, 1);
});

test("rampage: each play adds its Increase to its own Damage", () => {
  const s = at(state([card("RAMPAGE", "Attack", "AnyEnemy", { Damage: 10, Increase: 5 })]), 0, 1);
  assert.equal(hp(s), 40);
  assert.equal(s.discard[0]!.vars["Damage"], 15);
});

// ---------------------------------------------------------------- how a card is played

test("stomp: every attack played makes it cost 1 less this turn; the next turn it is back at 3", () => {
  const stomp = card("STOMP", "Attack", "AllEnemies", { Damage: 12 }, 3);
  const s = at(state([STRIKE, stomp]), 0, 1);
  assert.equal(s.hand[0]!.cost, 2);
  assert.equal(next(s).discard.find((c) => c.id === "STOMP")?.cost ?? next(s).hand.find((c) => c.id === "STOMP")?.cost, 3);
});

test("sword boomerang: a random enemy each hit — exact against one, spread over two", () => {
  const boomerang = card("SWORD_BOOMERANG", "Attack", "RandomEnemy", { Damage: 3, Repeat: 3 });
  const one = at(state([boomerang]), 0);
  assert.equal(hp(one), 41);
  assert.equal(one.exact, true);
  const two = at(state([boomerang], [foe(50, 1), foe(50, 2)]), 0);
  assert.deepEqual([hp(two, 0), hp(two, 1)], [44, 47]);
  assert.equal(two.exact, false);
});

test("volley: X hits at random enemies, none lost on a dead one", () => {
  const volley = card("VOLLEY", "Attack", "RandomEnemy", { Damage: 10 }, 0, [], { costsX: true });
  const s = at(state([volley], [foe(5, 1), foe(5, 2)], { energy: 2 }), 0);
  assert.ok(s.enemies.every((e) => !e.alive));
});

test("breakthrough: the HP first, so Rupture's Strength is in the hit", () => {
  const s = withPowers(state([card("BREAKTHROUGH", "Attack", "AllEnemies", { Damage: 9, HpLoss: 1 })]), { RUPTURE: 1 });
  assert.equal(hp(at(s, 0)), 40);
});

test("whirlwind: Chemical X gives two more hits", () => {
  const whirl = card("WHIRLWIND", "Attack", "AllEnemies", { Damage: 5 }, 0, [], { costsX: true });
  assert.equal(hp(at(state([whirl], [foe(50)], { relics: ["CHEMICAL_X"] }), 0)), 50 - 25);
});

test("fasten: a Defend's block gains its amount", () => {
  assert.equal(at(withPowers(state([DEFEND]), { FASTEN: 4 }), 0).player.block, 9);
});

// ---------------------------------------------------------------- powers

test("juggling: the turn's third attack comes back into the hand", () => {
  let s = withPowers(state([STRIKE, STRIKE, STRIKE]), { JUGGLING: 1 });
  s = at(at(s, 0, 1), 0, 1);
  assert.equal(s.hand.length, 1);
  s = at(s, 0, 1);
  assert.deepEqual(s.hand.map((c) => c.id), ["STRIKE_IRONCLAD"]);
});

test("stampede: at the end of the turn an attack of the hand is played for free", () => {
  const s = endOfTurn(withPowers(state([STRIKE, DEFEND]), { STAMPEDE: 1 }));
  assert.equal(hp(s), 44);
  assert.deepEqual(s.hand.map((c) => c.id), ["DEFEND_IRONCLAD"]);
  // And the end of the turn is read through it once.
  assert.equal(endOfTurn(s), s);
});

test("calamity: every attack played makes a random attack in the hand", () => {
  assert.equal(at(withPowers(state([STRIKE]), { CALAMITY: 1 }), 0, 1).drawn, 1);
});

test("inferno: the start of the turn costs its SelfDamage and hits every enemy", () => {
  const s = withPowers(state([], [foe(50)], { draw: [DEFEND, DEFEND, DEFEND, DEFEND, DEFEND] }), { INFERNO: 6 }, { INFERNO: { SelfDamage: 1 } });
  const n = next(s);
  assert.equal(n.player.hp, 59);
  assert.equal(hp(n), 44);
});

test("aggression: an attack of the discard pile into the hand before the draw", () => {
  const s = withPowers(state([], [foe(50)], { discard: [TWIN], draw: [DEFEND, DEFEND, DEFEND, DEFEND, DEFEND] }), { AGGRESSION: 1 });
  const n = next(s);
  assert.ok(n.hand.some((c) => c.id === "TWIN_STRIKE"));
  assert.equal(n.hand.length, 6);
});

test("mayhem: the draw pile's top card played after the draw", () => {
  const s = withPowers(state([], [foe(50)], { draw: [STRIKE, STRIKE, STRIKE, STRIKE, STRIKE, STRIKE] }), { MAYHEM: 1 });
  assert.equal(hp(next(s)), 44);
});

test("hellraiser: a Strike drawn is played at once", () => {
  const s = withPowers(state([], [foe(50)], { draw: [STRIKE, DEFEND, DEFEND, DEFEND, DEFEND] }), { HELLRAISER: 1 });
  const n = next(s);
  assert.equal(hp(n), 44);
  assert.ok(!n.hand.some((c) => c.id === "STRIKE_IRONCLAD"));
});

test("nostalgia: the turn's first attack or skill goes on top of the draw pile, and is drawn next", () => {
  const s = at(withPowers(state([DEFEND], [foe(50)], { draw: [STRIKE, STRIKE, STRIKE, STRIKE, STRIKE, STRIKE, STRIKE] }), { NOSTALGIA: 1 }), 0);
  assert.equal(s.draw.at(-1)!.id, "DEFEND_IRONCLAD");
  assert.ok(next(s).hand.some((c) => c.id === "DEFEND_IRONCLAD"));
});

test("stratagem: a shuffle puts a card of the new draw pile into the hand", () => {
  const pommel = card("POMMEL_STRIKE", "Attack", "AnyEnemy", { Damage: 9, Cards: 1 });
  const s = at(withPowers(state([pommel], [foe(50)], { discard: [DEFEND, DEFEND, DEFEND] }), { STRATAGEM: 1 }), 0, 1);
  assert.equal(s.drawn, 2);
});

// ---------------------------------------------------------------- piles and free plays

test("seeker strike: the hit and one card of the draw pile, not three", () => {
  const s = at(state([card("SEEKER_STRIKE", "Attack", "AnyEnemy", { Damage: 9, Cards: 3 })], [foe(50)], { draw: [STRIKE, DEFEND, TWIN] }), 0, 1);
  assert.equal(hp(s), 41);
  assert.equal(s.drawn, 1);
  assert.equal(s.draw.length, 2);
});

test("catastrophe: plays cards of the draw pile for free", () => {
  const s = at(state([card("CATASTROPHE", "Skill", "Self", { Cards: 2 }, 2)], [foe(50)], { draw: [STRIKE, STRIKE] }), 0);
  assert.equal(hp(s), 38);
  assert.equal(s.energy, 1);
});

test("purity: exhausts statuses and curses of the hand, draws nothing", () => {
  const s = at(state([card("PURITY", "Skill", "Self", { Cards: 3 }, 0, ["Exhaust", "Retain"]), WOUND, CURSE, STRIKE], [foe(50)], { draw: [DEFEND] }), 0);
  assert.deepEqual(s.hand.map((c) => c.id), ["STRIKE_IRONCLAD"]);
  assert.equal(s.drawn, 0);
});

test("thinking ahead: draws 2 and puts one back, a card in all", () => {
  assert.equal(at(state([card("THINKING_AHEAD", "Skill", "Self", { Cards: 2 }, 0, ["Exhaust"])], [foe(50)], { draw: [STRIKE, STRIKE] }), 0).drawn, 1);
});

test("cascade: plays the top X cards of the draw pile for free", () => {
  const cascade = card("CASCADE", "Skill", "Self", {}, 0, [], { costsX: true });
  const s = at(state([cascade], [foe(50)], { energy: 2, draw: [STRIKE, STRIKE, DEFEND] }), 0);
  assert.equal(s.player.block, 5);
  assert.equal(hp(s), 44);
  assert.equal(s.energy, 0);
});

test("beat down: plays the discard pile's attacks for free, exact when there are no more than it plays", () => {
  const s = at(state([card("BEAT_DOWN", "Skill", "RandomEnemy", { Cards: 3 }, 3)], [foe(50)], { discard: [STRIKE, DEFEND, TWIN] }), 0);
  assert.equal(hp(s), 50 - 6 - 10);
  assert.equal(s.exact, true);
});

test("omnislice: every other enemy takes the hit as dealt", () => {
  const s = withPowers(state([card("OMNISLICE", "Attack", "AnyEnemy", { Damage: 8 }, 0)], [foe(50, 1), foe(50, 2)]), { STRENGTH: 2 });
  const after = at(s, 0, 1);
  assert.deepEqual([hp(after, 0), hp(after, 1)], [40, 40]);
});

test("fisticuffs: block as much as the hit dealt", () => {
  assert.equal(at(state([card("FISTICUFFS", "Attack", "AnyEnemy", { Damage: 7 })]), 0, 1).player.block, 7);
});

test("jack of all trades: a card made, none drawn", () => {
  const s = at(state([card("JACK_OF_ALL_TRADES", "Skill", "Self", { Cards: 1 }, 0, ["Exhaust"])], [foe(50)], { draw: [STRIKE] }), 0);
  assert.equal(s.drawn, 1);
  assert.equal(s.draw.length, 1);
});

test("impatience: draws only with no attack in hand", () => {
  const imp = card("IMPATIENCE", "Skill", "Self", { Cards: 2 }, 0);
  const draw = [DEFEND, DEFEND, DEFEND];
  assert.equal(at(state([imp, STRIKE], [foe(50)], { draw }), 0).drawn, 0);
  assert.equal(at(state([imp, DEFEND], [foe(50)], { draw }), 0).drawn, 2);
});

test("discovery: a chosen card into the hand", () => {
  assert.equal(at(state([card("DISCOVERY", "Skill", "Self", {}, 1, ["Exhaust"])]), 0).drawn, 1);
});

test("scrawl: draws until the hand is full", () => {
  const draw = Array(12).fill(DEFEND) as Card[];
  assert.equal(at(state([card("SCRAWL", "Skill", "Self", {}, 1, ["Exhaust"]), STRIKE, STRIKE], [foe(50)], { draw }), 0).drawn, 8);
});

test("the bomb: goes off on every enemy at the end of its third turn", () => {
  let s = at(state([card("THE_BOMB", "Skill", "Self", { Turns: 3, BombDamage: 40 }, 2)], [foe(100)], { draw: Array(20).fill(DEFEND) as Card[] }), 0);
  assert.equal(hp(endOfTurn(s)), 100);
  s = next(s);
  assert.equal(hp(endOfTurn(s)), 100);
  s = next(s);
  assert.equal(hp(endOfTurn(s)), 60);
});

test("shockwave: Weak and Vulnerable on every enemy", () => {
  const s = at(state([card("SHOCKWAVE", "Skill", "AllEnemies", { Power: 3 }, 2, ["Exhaust"])], [foe(50, 1), foe(50, 2)]), 0);
  for (const e of s.enemies) assert.deepEqual([e.powers["WEAK"], e.powers["VULNERABLE"]], [3, 3]);
});

test("feed: a kill gives max HP and heals it", () => {
  const s = at(state([card("FEED", "Attack", "AnyEnemy", { Damage: 10, MaxHp: 3 }, 1, ["Exhaust"])], [foe(5)]), 0, 1);
  assert.deepEqual([s.player.maxHp, s.player.hp], [83, 63]);
});

// ---------------------------------------------------------------- conditions and later turns

test("restlessness: draws and gains energy only as the one card in hand", () => {
  const rest = card("RESTLESSNESS", "Skill", "Self", { Cards: 2, Energy: 2 }, 0, ["Retain"]);
  const draw = [DEFEND, DEFEND];
  const alone = at(state([rest], [foe(50)], { draw }), 0);
  assert.deepEqual([alone.drawn, alone.energy], [2, 5]);
  const held = at(state([rest, STRIKE], [foe(50)], { draw }), 0);
  assert.deepEqual([held.drawn, held.energy], [0, 3]);
});

test("dark shackles: Strength taken for the turn and given back after the enemy's", () => {
  const s = at(state([card("DARK_SHACKLES", "Skill", "AnyEnemy", { StrengthLoss: 9 }, 0, ["Exhaust"])], [foe(50, 1, { STRENGTH: 2 })]), 0, 1);
  assert.equal(s.enemies[0]!.powers["STRENGTH"], -7);
  assert.equal(next(s).enemies[0]!.powers["STRENGTH"], 2);
});

test("salvo: the hand is kept, an Ethereal card still goes", () => {
  const s = at(state([card("SALVO", "Attack", "AnyEnemy", { Damage: 12 }), DEFEND, DAZED], [foe(50)], { draw: Array(5).fill(STRIKE) as Card[] }), 0, 1);
  const n = next(s);
  assert.ok(n.hand.some((c) => c.id === "DEFEND_IRONCLAD"));
  assert.ok(!n.hand.some((c) => c.id === "DAZED"));
});

test("equilibrium: block, and the hand is kept", () => {
  const s = at(state([card("EQUILIBRIUM", "Skill", "Self", { Block: 13, Equilibrium: 1 }, 2)]), 0);
  assert.equal(s.player.block, 13);
  assert.equal(s.player.powers["RETAIN_HAND"], 1);
});

test("one-two punch: the next attack is played twice", () => {
  const s = at(at(state([card("ONE_TWO_PUNCH", "Skill", "Self", { Attacks: 1 }), STRIKE]), 0), 0, 1);
  assert.equal(hp(s), 38);
  assert.equal(s.player.powers["ONE_TWO_PUNCH"] ?? 0, 0);
});

test("primal force: every attack in hand becomes a Giant Rock", () => {
  const s = at(state([card("PRIMAL_FORCE", "Skill", "Self", {}, 0), STRIKE, DEFEND]), 0);
  assert.deepEqual(s.hand.map((c) => `${c.id}:${c.vars["Damage"] ?? ""}`), ["GIANT_ROCK:20", "DEFEND_IRONCLAD:"]);
});

test("not yet: heals, up to max HP", () => {
  assert.equal(at(state([card("NOT_YET", "Skill", "Self", { Heal: 10 }, 2, ["Exhaust"])]), 0).player.hp, 70);
});

test("prolong: next turn's block, as much as the player has", () => {
  const s = at(state([card("PROLONG", "Skill", "Self", {}, 0, ["Exhaust"])], [foe(50)], { player: { hp: 60, maxHp: 80, block: 12, powers: {} }, draw: Array(5).fill(STRIKE) as Card[] }), 0);
  assert.equal(next(s).player.block, 12);
});

test("panic button: its block, then none from cards", () => {
  const s = at(state([card("PANIC_BUTTON", "Skill", "Self", { Block: 30, Turns: 2 }, 0, ["Exhaust"]), DEFEND]), 0);
  assert.equal(s.player.block, 30);
  assert.equal(at(s, 0).player.block, 30);
});

test("howl from beyond: in the exhaust pile at the end of the turn it plays itself, into the discard pile", () => {
  const howl = card("HOWL_FROM_BEYOND", "Attack", "AllEnemies", { Damage: 18 }, 3);
  const s = endOfTurn(state([], [foe(50)], { exhaust: [howl] }));
  assert.equal(hp(s), 32);
  assert.deepEqual([s.exhaust.length, s.discard[0]!.id], [0, "HOWL_FROM_BEYOND"]);
  // The end of the turn's HP loss reads the same state.
  assert.equal(hpLoss(state([], [foe(50)], { exhaust: [howl] })), 0);
});

test("bolas: played, it is back in the hand before the next draw", () => {
  const s = at(state([card("BOLAS", "Attack", "AnyEnemy", { Damage: 3 }, 0)], [foe(50)], { draw: Array(5).fill(DEFEND) as Card[] }), 0, 1);
  const n = next(s);
  assert.ok(n.hand.some((c) => c.id === "BOLAS"));
  assert.equal(n.hand.length, 6);
});
