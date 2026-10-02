// The Silent's rules (src/characters/silent.ts), each from the game's IL (v0.111.0).
import assert from "node:assert/strict";
import { test } from "node:test";
import { type Card, type Enemy, hpLoss, incomingHits, junkIndex, play, type State } from "../src/sim.ts";
import { nextTurn, seeded } from "../src/turn.ts";
import { evaluate } from "../src/search.ts";
import { discardIndex, poisonAhead, SILENT } from "../src/characters/silent.ts";
import { setCharacter } from "../src/character.ts";

const card = (id: string, type: string, target: string, vars: Record<string, number>, cost = 1, keywords: string[] = [], extra: Partial<Card> = {}): Card => ({
  id, cost, costsX: false, type, target, keywords, vars, upgrades: 0, locked: false, glows: false, ...extra,
});
const STRIKE = card("STRIKE_SILENT", "Attack", "AnyEnemy", { Damage: 6 });
const DEFEND = card("DEFEND_SILENT", "Skill", "Self", { Block: 5 });
const SURVIVOR = card("SURVIVOR", "Skill", "Self", { Block: 8 });
const TACTICIAN = card("TACTICIAN", "Skill", "Self", { Energy: 1 }, 3, ["Sly"]);
const DEADLY_POISON = card("DEADLY_POISON", "Skill", "AnyEnemy", { PoisonPower: 5 });
const BLADE_DANCE = card("BLADE_DANCE", "Skill", "Self", { Cards: 3 }, 1, ["Exhaust"]);
const SHIV = card("SHIV", "Attack", "AnyEnemy", { Damage: 4 }, 0, ["Exhaust"]);
const SLIMED = card("SLIMED", "Status", "None", {}, 1, ["Exhaust"]);

function foe(hp: number, id = 1, powers: Record<string, number> = {}, attack = 0): Enemy {
  return {
    id, model: "DUMMY", hp, maxHp: hp, block: 0, alive: true, powers: { ...powers }, weakAtStart: false, startStrength: powers["STRENGTH"] ?? 0,
    intents: attack > 0 ? [{ type: "Attack", damage: attack, hits: 1 }] : [{ type: "Buff", damage: 0, hits: 0 }],
  };
}
function state(hand: Card[], enemies: Enemy[] = [foe(50)], over: Partial<State> = {}): State {
  return {
    player: { hp: 60, maxHp: 70, block: 0, powers: {} },
    energy: 3, hand, draw: [], discard: [], exhaust: [], enemies, drawn: 0, exact: true, lostHp: false,
    exhaustedThisTurn: false, relics: [], played: 0, skills: 0, unmovableUsed: false, potions: [], potionSlots: 2, potionsUsed: 0,
    turn: 1, ...over,
  };
}
const withPowers = (s: State, powers: Record<string, number>): State => ({ ...s, player: { ...s.player, powers: { ...s.player.powers, ...powers } } });
const at = (s: State, hand: number, target?: number) => play(s, { kind: "play", hand, ...(target !== undefined ? { target } : {}) });
const next = (s: State) => nextTurn(s, seeded(1), () => [])!;

// ---------------------------------------------------------------- Poison

test("poison: at the enemy's turn start it loses its Poison through block, and the Poison goes 1 down", () => {
  const s = state([], [{ ...foe(20, 1, { POISON: 5 }), block: 10 }]);
  const n = next(s);
  assert.equal(n.enemies[0]!.hp, 15);
  assert.equal(n.enemies[0]!.powers["POISON"], 4);
});

test("poison: an enemy it kills does not act — its attack is not coming", () => {
  const s = state([], [foe(4, 1, { POISON: 5 }, 12)]);
  assert.deepEqual(incomingHits(s), []);
  assert.equal(hpLoss(s), 0);
  const alive = state([], [foe(9, 1, { POISON: 5 }, 12)]);
  assert.deepEqual(incomingHits(alive), [12]);
});

test("accelerant: Poison ticks once more a stack, one less each time", () => {
  const s = withPowers(state([], [foe(30, 1, { POISON: 5 })]), { ACCELERANT: 1 });
  const n = next(s);
  assert.equal(n.enemies[0]!.hp, 30 - 5 - 4);
  assert.equal(n.enemies[0]!.powers["POISON"], 3);
});

test("poison through Slippery: 1 a tick and a stack spent (IL: SlipperyPower.ModifyHpLostAfterOsty, any damage)", () => {
  const n = next(state([], [foe(30, 1, { POISON: 5, SLIPPERY: 2 })]));
  assert.equal(n.enemies[0]!.hp, 29);
  assert.equal(n.enemies[0]!.powers["SLIPPERY"], 1);
  assert.equal(n.enemies[0]!.powers["POISON"], 4);
});

test("poison through Intangible: 1 a tick", () => {
  const n = next(state([], [foe(30, 1, { POISON: 5, INTANGIBLE: 1 })]));
  assert.equal(n.enemies[0]!.hp, 29);
});

test("deadly poison: its Poison on the target; Artifact takes it; Snecko Skull adds 1", () => {
  assert.equal(at(state([DEADLY_POISON]), 0, 1).enemies[0]!.powers["POISON"], 5);
  const art = at(state([DEADLY_POISON], [foe(50, 1, { ARTIFACT: 1 })]), 0, 1).enemies[0]!;
  assert.equal(art.powers["POISON"] ?? 0, 0);
  assert.equal(art.powers["ARTIFACT"], 0);
  assert.equal(at(state([DEADLY_POISON], [foe(50)], { relics: ["SNECKO_SKULL"] }), 0, 1).enemies[0]!.powers["POISON"], 6);
});

test("poison's worth: what it will take over the turns to come, each later one worth less", () => {
  const s = state([], [foe(100, 1, { POISON: 3 })]);
  // 3 now, 2 and 1 on the next two turns (the deck's pace does not kill a 100-HP enemy that soon).
  assert.ok(Math.abs(poisonAhead(s) - (3 + 2 * 0.85 + 1 * 0.85 * 0.85)) < 1e-9);
  assert.ok(evaluate(s) > evaluate(state([], [foe(100)])));
  // Capped by the enemy's HP.
  assert.equal(poisonAhead(state([], [foe(2, 1, { POISON: 10 })])), 2);
});

test("outbreak: Poison on every enemy, then every poisoned one ticks at once", () => {
  const outbreak = card("OUTBREAK", "Skill", "AllEnemies", { PoisonPower: 9 }, 3);
  const s = at(state([outbreak], [foe(30, 1), foe(30, 2, { POISON: 2 })]), 0);
  assert.equal(s.enemies[0]!.hp, 21);
  assert.equal(s.enemies[0]!.powers["POISON"], 8);
  assert.equal(s.enemies[1]!.hp, 19);
  assert.equal(s.enemies[1]!.powers["POISON"], 10);
});

// ---------------------------------------------------------------- Shivs

test("blade dance: its Cards is how many Shivs into the hand, not a draw", () => {
  const s = at(state([BLADE_DANCE]), 0);
  assert.equal(s.hand.filter((c) => c.id === "SHIV").length, 3);
  assert.equal(s.drawn, 0);
  // Past 10 cards they go to the discard pile.
  const full = at(state([BLADE_DANCE, ...Array<Card>(8).fill(STRIKE)]), 0);
  assert.equal(full.hand.length, 10);
  assert.equal(full.discard.filter((c) => c.id === "SHIV").length, 1);
});

test("shiv: 4, Accuracy on it like Strength; Phantom Blades on the turn's first only; Fan of Knives hits every enemy", () => {
  const acc = withPowers(state([SHIV, SHIV], [foe(50)]), { ACCURACY: 4, PHANTOM_BLADES: 9 });
  const one = at(acc, 0, 1);
  assert.equal(one.enemies[0]!.hp, 50 - (4 + 4 + 9));
  assert.equal(at(one, 0, 1).enemies[0]!.hp, 50 - 17 - 8);
  // A Shiv played before the observation: no bonus for this one.
  const later = at({ ...acc, playedBefore: [{ id: "SHIV", type: "Attack" }] }, 0, 1);
  assert.equal(later.enemies[0]!.hp, 50 - 8);
  const fan = at(withPowers(state([SHIV], [foe(20, 1), foe(20, 2)]), { FAN_OF_KNIVES: 1 }), 0, 1);
  assert.deepEqual(fan.enemies.map((e) => e.hp), [16, 16]);
});

// ---------------------------------------------------------------- Discards and Sly

test("survivor: block, then a Sly card discarded is played for free", () => {
  const s = at(state([SURVIVOR, STRIKE, TACTICIAN], [foe(50)], { energy: 1 }), 0);
  assert.equal(s.player.block, 8);
  assert.equal(s.energy, 0 + 1);
  assert.deepEqual(s.hand.map((c) => c.id), ["STRIKE_SILENT"]);
  assert.ok(s.discard.some((c) => c.id === "TACTICIAN"));
});

test("survivor with no Sly card: the card junkIndex gives up (a status first)", () => {
  const s = at(state([SURVIVOR, STRIKE, SLIMED, DEFEND]), 0);
  assert.deepEqual(s.hand.map((c) => c.id), ["STRIKE_SILENT", "DEFEND_SILENT"]);
  // Without Sly cards discardIndex is junkIndex: the Ironclad's discards are as they were.
  for (const hand of [[STRIKE, DEFEND], [STRIKE, SLIMED], [DEFEND, STRIKE, DEFEND]]) assert.equal(discardIndex(hand), junkIndex(hand));
});

test("prepared: the card drawn unseen, discarded, goes to the discard pile with Prepared", () => {
  const prepared = card("PREPARED", "Skill", "Self", { Cards: 1 }, 0);
  const s = at(state([prepared, STRIKE, DEFEND], [foe(50)], { draw: [SLIMED, STRIKE] }), 0);
  assert.equal(s.hand.length, 2);
  assert.equal(s.drawn, 0);
  assert.equal(s.discard.length, 2);
});

test("tingsha and tough bandages answer each card an effect discards", () => {
  const s = at(state([SURVIVOR, STRIKE], [foe(50)], { relics: ["TINGSHA", "TOUGH_BANDAGES"] }), 0);
  assert.equal(s.enemies[0]!.hp, 47);
  assert.equal(s.player.block, 8 + 3);
});

test("calculated gamble: the hand discarded, as many drawn", () => {
  const gamble = card("CALCULATED_GAMBLE", "Skill", "Self", {}, 0, ["Exhaust"]);
  const s = at(state([gamble, STRIKE, DEFEND], [foe(50)], { draw: [STRIKE, STRIKE, STRIKE] }), 0);
  assert.equal(s.hand.length, 0);
  assert.equal(s.drawn, 2);
  assert.equal(s.discard.length, 2);
});

// ---------------------------------------------------------------- Other cards and powers

test("piercing wail: every enemy's attack 6 less this turn, its Strength back after", () => {
  const wail = card("PIERCING_WAIL", "Skill", "AllEnemies", { StrengthLoss: 6 }, 1, ["Exhaust"]);
  const s = at(state([wail], [foe(50, 1, {}, 10), foe(50, 2, { ARTIFACT: 1 }, 10)]), 0);
  assert.deepEqual(incomingHits(s), [4, 10]);
  assert.equal(next(s).enemies[0]!.powers["STRENGTH"] ?? 0, 0);
});

test("afterimage: flat block for every card played after it", () => {
  const image = card("AFTERIMAGE", "Power", "Self", { AfterimagePower: 1 });
  const s = at(at(state([image, STRIKE]), 0), 0, 1);
  assert.equal(s.player.block, 1);
});

test("expose: the target's block and Artifact gone, then its Vulnerable", () => {
  const expose = card("EXPOSE", "Skill", "AnyEnemy", { Power: 2 }, 0, ["Exhaust"]);
  const e = at(state([expose], [{ ...foe(50, 1, { ARTIFACT: 2 }), block: 12 }]), 0, 1).enemies[0]!;
  assert.equal(e.block, 0);
  assert.equal(e.powers["VULNERABLE"], 2);
});

test("dodge and roll: the block it gave, next turn again", () => {
  const roll = card("DODGE_AND_ROLL", "Skill", "Self", { Block: 4 });
  const s = at(withPowers(state([roll]), { DEXTERITY: 2 }), 0);
  assert.equal(s.player.block, 6);
  assert.equal(next(s).player.block, 6);
});

test("finisher: a hit for every attack played before it this turn", () => {
  const finisher = card("FINISHER", "Attack", "AnyEnemy", { Damage: 6, CalculationBase: 0, CalculationExtra: 1 });
  const s = at(at(state([STRIKE, finisher], [foe(50)], { attacksBefore: 1 }), 0, 1), 0, 1);
  assert.equal(s.enemies[0]!.hp, 50 - 6 - 12);
});

test("echoing slash: a sweep more for every enemy a sweep killed", () => {
  const slash = card("ECHOING_SLASH", "Attack", "AllEnemies", { Damage: 10 });
  const s = at(state([slash], [foe(8, 1), foe(30, 2)]), 0);
  assert.equal(s.enemies[1]!.hp, 10);
});

test("well-laid plans: the whole hand kept at the turn's end", () => {
  const s = withPowers(state([STRIKE, DEFEND]), { WELL_LAID_PLANS: 1 });
  assert.equal(next(s).hand.filter((c) => c.id === "STRIKE_SILENT" || c.id === "DEFEND_SILENT").length, 2);
});

test("pounce: the next skill is free, one skill a stack", () => {
  const pounce = card("POUNCE", "Attack", "AnyEnemy", { Damage: 14 }, 2);
  const s = at(state([pounce, DEFEND, DEFEND], [foe(50)], { energy: 2 }), 0, 1);
  assert.equal(s.energy, 0);
  const one = at(s, 0);
  assert.equal(one.player.block, 5);
  assert.equal(one.player.powers["FREE_SKILL"] ?? 0, 0);
});

test("noxious fumes and infinite blades: their Poison and Shivs as the next turn starts", () => {
  const s = withPowers(state([], [foe(50)]), { NOXIOUS_FUMES: 2, INFINITE_BLADES: 1 });
  const n = next(s);
  assert.equal(n.enemies[0]!.powers["POISON"], 2);
  assert.equal(n.hand.filter((c) => c.id === "SHIV").length, 1);
});

test("the runner's selects: the bridge says FromHand for a discard too; the card played says which it is", () => {
  const hand = [{ id: "ASCENDERS_BANE", type: "Curse", keywords: ["Unplayable"], cost: -1 }, { id: "RICOCHET", type: "Attack", keywords: ["Sly"], cost: 2 }, { id: "DEFEND_SILENT", type: "Skill", keywords: [], cost: 1 }];
  const select = SILENT.combatSelect!;
  assert.equal(select("SURVIVOR", "FromHand", hand), 1);
  setCharacter("SILENT");
  assert.equal(select(undefined, "FromHand", hand), 1);
  // Another character's run: a select with no card played is its own (the Ironclad's junkIndex, the Regent's).
  setCharacter("IRONCLAD");
  assert.equal(select(undefined, "FromHand", hand), undefined);
  assert.equal(select("HAND_TRICK", "FromHand", hand), 2);
  // Not the Silent's discard (True Grit+, Burning Pact): the core's choice.
  assert.equal(select("TRUE_GRIT", "FromHand", hand), undefined);
  assert.equal(select("SURVIVOR", "FromDeckForUpgrade", hand), undefined);
});
