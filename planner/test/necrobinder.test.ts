// The Necrobinder's rules (src/characters/necrobinder.ts), each from the game's IL at v0.111: Osty,
// Summon, Doom, the Souls, and her cards and powers.
import assert from "node:assert/strict";
import { test } from "node:test";
import { type Card, type Enemy, fromObservation, hpLoss, play, playable, costOf, type State, stateKey } from "../src/sim.ts";
import { nextTurn, seeded } from "../src/turn.ts";
import { evaluate } from "../src/search.ts";
import { ostyAfterTurn, summon } from "../src/characters/necrobinder.ts";
import type { Observation } from "../src/obs.ts";

const card = (id: string, type: string, target: string, vars: Record<string, number>, cost = 1, extra: Partial<Card> = {}): Card => ({
  id, cost, costsX: false, type, target, keywords: [], vars, upgrades: 0, locked: false, glows: false, ...extra,
});
const STRIKE = card("STRIKE_NECROBINDER", "Attack", "AnyEnemy", { Damage: 6 });
const DEFEND = card("DEFEND_NECROBINDER", "Skill", "Self", { Block: 5 });
const BODYGUARD = card("BODYGUARD", "Skill", "Self", { Summon: 5 });
const UNLEASH = card("UNLEASH", "Attack", "AnyEnemy", { CalculationBase: 6, ExtraDamage: 1, CalculatedDamage: 6 });
const POKE = card("POKE", "Attack", "AnyEnemy", { OstyDamage: 6 }, 0);
const FLATTEN = card("FLATTEN", "Attack", "AnyEnemy", { OstyDamage: 12 }, 2);
const RATTLE = card("RATTLE", "Attack", "AnyEnemy", { OstyDamage: 7, CalculationBase: 0, CalculationExtra: 1, CalculatedHits: 1 });
const SCOURGE = card("SCOURGE", "Skill", "AnyEnemy", { DoomPower: 13, Cards: 1 });
const BLIGHT = card("BLIGHT_STRIKE", "Attack", "AnyEnemy", { Damage: 8 });
const SOUL = card("SOUL", "Skill", "Self", { Cards: 2 }, 0, { keywords: ["Exhaust"] });

function foe(hp: number, id = 1, attack = 0, hits = 1, powers: Record<string, number> = {}): Enemy {
  return {
    id, model: "DUMMY", hp, maxHp: hp, block: 0, alive: true, powers: { ...powers }, weakAtStart: false, startStrength: 0,
    intents: attack ? [{ type: "Attack", damage: attack, hits }] : [{ type: "Buff", damage: 0, hits: 0 }],
  };
}
/** A Necrobinder's turn: Osty at `osty` HP (max `max`), Bound Phylactery. */
function state(hand: Card[], osty: number, over: Partial<State> = {}, enemies: Enemy[] = [foe(80)], max = osty): State {
  return {
    player: { hp: 50, maxHp: 66, block: 0, powers: {} },
    energy: 3, hand, draw: Array(8).fill(DEFEND) as Card[], discard: [], exhaust: [], enemies, drawn: 0, exact: true, lostHp: false,
    exhaustedThisTurn: false, relics: ["BOUND_PHYLACTERY"], played: 0, skills: 0, unmovableUsed: false, potions: [], potionSlots: 3, potionsUsed: 0, turn: 2,
    ext: {
      ostyHp: osty, ostyMax: max, ostyUp: true, ostyAttacksBefore: 0, ostyAttacks: 0, etherealBefore: 0, ethereal: 0, doomed: false,
      drawnSince: 0, deaths: 0, borrowed: 0, energyNext: 0, drawNext: 0,
    },
    ...over,
  };
}
const at = (s: State, hand: number, target?: number) => play(s, { kind: "play", hand, ...(target !== undefined ? { target } : {}) });
const next = (s: State) => nextTurn(s, seeded(1), (e) => e.intents)!;
const hp = (s: State, i = 0) => s.enemies[i]!.hp;
const osty = (s: State) => [s.ext!["ostyHp"], s.ext!["ostyMax"]];

// ---------------------------------------------------------------- Osty in front

test("osty: the part of a hit past her block is his, the rest hers once he dies (CreatureCmd.Damage)", () => {
  const s = state([], 3, {}, [foe(80, 1, 10)]);
  assert.equal(hpLoss(s), 7);
  assert.equal(ostyAfterTurn(s), 0);
  // Her block first, then Osty: 4 blocked, 6 into a 10-HP Osty, none to her.
  const blocked = state([], 10, { player: { hp: 50, maxHp: 66, block: 4, powers: {} } }, [foe(80, 1, 10)]);
  assert.equal(hpLoss(blocked), 0);
  assert.equal(ostyAfterTurn(blocked), 4);
  // Hit by hit: 2x5 into 3 block and a 4-HP Osty: 2 to him, then 2 more to him and 3 to her.
  const multi = state([], 4, { player: { hp: 50, maxHp: 66, block: 3, powers: {} } }, [foe(80, 1, 5, 2)]);
  assert.equal(hpLoss(multi), 3);
  assert.equal(ostyAfterTurn(multi), 0);
});

test("osty: Tungsten Rod cuts only what gets through to her", () => {
  const s = state([], 3, { relics: ["BOUND_PHYLACTERY", "TUNGSTEN_ROD"] }, [foe(80, 1, 10)]);
  assert.equal(hpLoss(s), 6);
  // All of it into Osty: nothing to cut.
  assert.equal(hpLoss(state([], 20, { relics: ["BOUND_PHYLACTERY", "TUNGSTEN_ROD"] }, [foe(80, 1, 10)])), 0);
});

test("osty: not in front of what is not an attack (Constrict)", () => {
  const s = state([], 20, { player: { hp: 50, maxHp: 66, block: 0, powers: { CONSTRICT: 4 } } }, [foe(80, 1, 6)]);
  assert.equal(hpLoss(s), 4);
  assert.equal(ostyAfterTurn(s), 14);
});

test("osty: dead, he takes nothing; the next turn Bound Phylactery brings him back at 1/1", () => {
  const s = state([], 0, {}, [foe(80, 1, 10)], 7);
  assert.equal(hpLoss(s), 10);
  assert.deepEqual(osty(next(s)), [1, 1]);
  // Alive, the phylactery adds 1 to both.
  assert.deepEqual(osty(next(state([], 5, {}, [foe(80, 1, 3)], 8))), [3, 9]);
});

// ---------------------------------------------------------------- Summon, Osty's attacks

test("summon: alive, max HP and HP up by N; dead, N/N (OstyCmd.Summon)", () => {
  const alive = state([], 3, {}, [foe(80)], 6);
  summon(alive, 5);
  assert.deepEqual(osty(alive), [8, 11]);
  const dead = state([], 0, {}, [foe(80)], 20);
  summon(dead, 5);
  assert.deepEqual(osty(dead), [5, 5]);
  assert.deepEqual(osty(at(state([BODYGUARD], 1), 0)), [6, 6]);
});

test("unleash: 6 + Osty's HP, his hit: not her Strength, the target's Vulnerable yes", () => {
  const s = state([UNLEASH], 9, { player: { hp: 50, maxHp: 66, block: 0, powers: { STRENGTH: 3 } } });
  assert.equal(hp(at(s, 0, 1)), 80 - 15);
  const vuln = state([UNLEASH], 9, {}, [foe(80, 1, 0, 1, { VULNERABLE: 1 })]);
  assert.equal(hp(at(vuln, 0, 1)), 80 - Math.floor(15 * 1.5));
  // Osty dead: paid for, nothing.
  const dead = at(state([UNLEASH], 0), 0, 1);
  assert.equal(hp(dead), 80);
  assert.equal(dead.energy, 2);
});

test("calcify: every Osty hit 4 more; rattle: a hit more for each Osty attack before it this turn", () => {
  const s = state([POKE, RATTLE], 5, { player: { hp: 50, maxHp: 66, block: 0, powers: { CALCIFY: 4 } } });
  const poked = at(s, 0, 1);
  assert.equal(hp(poked), 80 - 10);
  assert.equal(hp(at(poked, 0, 1)), 80 - 10 - 2 * 11);
});

test("flatten: 0 once Osty has attacked this turn", () => {
  const s = state([POKE, FLATTEN], 5);
  assert.equal(costOf(s, s.hand[1]!), 2);
  const poked = at(s, 0, 1);
  assert.equal(costOf(poked, poked.hand[0]!), 0);
});

test("high five cannot be played with Osty dead", () => {
  const five = card("HIGH_FIVE", "Attack", "AllEnemies", { OstyDamage: 11, VulnerablePower: 2 }, 2);
  assert.equal(playable(state([five], 0), five), false);
  assert.equal(playable(state([five], 3), five), true);
});

test("bone shards: Osty hits them all, she blocks, and he dies", () => {
  const shards = card("BONE_SHARDS", "Attack", "AllEnemies", { OstyDamage: 9, Block: 9 });
  const s = at(state([shards], 6, {}, [foe(30), foe(30, 2)]), 0);
  assert.deepEqual([hp(s, 0), hp(s, 1), s.player.block, s.ext!["ostyHp"]], [21, 21, 9, 0]);
});

test("sacrifice: block three times Osty's max HP, then he dies; Necro Mastery hits them all for his HP", () => {
  const sac = card("SACRIFICE", "Skill", "Self", { CalculationBase: 0, CalculationExtra: 1 }, 1, { keywords: ["Retain"] });
  const s = at(state([sac], 4, { player: { hp: 50, maxHp: 66, block: 0, powers: { NECRO_MASTERY: 1 } } }, [foe(30), foe(30, 2)], 7), 0);
  assert.deepEqual([s.player.block, s.ext!["ostyHp"], hp(s, 0), hp(s, 1)], [21, 0, 26, 26]);
});

// ---------------------------------------------------------------- Doom

test("doom: an enemy at or under it dies at the enemies' turn's end, after it has hit", () => {
  const s = at(state([SCOURGE], 5, {}, [foe(12, 1, 8), foe(40, 2, 3)]), 0, 1);
  assert.equal(s.enemies[0]!.powers["DOOM"], 13);
  // It still hits: 8 + 3 into a 5-HP Osty, 6 to her.
  assert.equal(hpLoss(s), 6);
  const n = next(s);
  assert.equal(n.enemies[0]!.alive, false);
  assert.equal(n.enemies[1]!.alive, true);
  // As good as dead in the evaluation.
  const without = state([SCOURGE], 5, {}, [foe(12, 1, 8), foe(40, 2, 3)]);
  assert.ok(evaluate(s) > evaluate(without));
});

test("blight strike: Doom as much as the hit dealt, block included, overkill not", () => {
  const s = at(state([BLIGHT], 1, {}, [{ ...foe(30), block: 3 }]), 0, 1);
  assert.equal(s.enemies[0]!.powers["DOOM"], 8);
  const kill = at(state([BLIGHT], 1, {}, [foe(5)]), 0, 1);
  assert.equal(kill.enemies[0]!.alive, false);
});

test("shroud and sleight of flesh answer her Doom", () => {
  const s = at(state([SCOURGE], 5, { player: { hp: 50, maxHp: 66, block: 0, powers: { SHROUD: 3, SLEIGHT_OF_FLESH: 9 } } }), 0, 1);
  assert.deepEqual([s.player.block, hp(s)], [3, 71]);
});

test("end of days kills at once whatever is at or under its Doom", () => {
  const eod = card("END_OF_DAYS", "Skill", "AllEnemies", { DoomPower: 29 }, 3);
  const s = at(state([eod], 1, {}, [foe(20), foe(50, 2)]), 0);
  assert.deepEqual([s.enemies[0]!.alive, s.enemies[1]!.alive, s.enemies[1]!.powers["DOOM"]], [false, true, 29]);
});

// ---------------------------------------------------------------- Souls and powers

test("soul: draws 2; Haunt takes HP from an enemy, Devour Life summons", () => {
  const s = at(state([SOUL], 3, { player: { hp: 50, maxHp: 66, block: 0, powers: { HAUNT: 7, DEVOUR_LIFE: 1 } } }), 0);
  assert.deepEqual([s.drawn, hp(s), s.ext!["ostyHp"], s.exhaust.length], [2, 73, 4, 1]);
});

test("friendship: 2 Strength off her, an energy a turn from the next", () => {
  const f = card("FRIENDSHIP", "Power", "Self", { StrengthPower: 2, Energy: 1 });
  const s = at(state([f], 3, { maxEnergy: 3 }), 0);
  assert.equal(s.player.powers["STRENGTH"], -2);
  assert.equal(next(s).energy, 4);
});

test("borrowed time: 4 energy, every card 1 more this turn", () => {
  const bt = card("BORROWED_TIME", "Skill", "Self", { Energy: 4, ExtraCost: 1 });
  const s = at(state([bt, STRIKE], 3), 0);
  assert.equal(s.energy, 6);
  assert.equal(costOf(s, s.hand[0]!), 2);
  assert.equal(costOf(next(s), STRIKE), 1);
});

test("lethality: the turn's first attack card half as much again, Osty's hits too", () => {
  const s = state([POKE, STRIKE], 5, { player: { hp: 50, maxHp: 66, block: 0, powers: { LETHALITY: 50 } } });
  const poked = at(s, 0, 1);
  assert.equal(hp(poked), 80 - 9);
  assert.equal(hp(at(poked, 0, 1)), 80 - 9 - 6);
});

// ---------------------------------------------------------------- the observation

test("the observation: Osty from player_allies, and his state in the key", () => {
  const obs = {
    phase: "combat", is_terminal: false, is_victory: false, seed: "X", act: 1, floor: 2, gold: 99, character: "NECROBINDER",
    player_hp: 60, player_max_hp: 66, player_block: 0, player_energy: 3, player_powers: {}, deck_cards: [], relics: ["BOUND_PHYLACTERY"], potions: [],
    player_allies: [{ combat_id: 9, model_id: "OSTY", is_osty: true, hp: 4, max_hp: 6, block: 0, is_alive: true, powers: { DIE_FOR_YOU_POWER: 1 } }],
    combat: { turn: 2, hand: [], draw_pile: [], discard_pile: [], exhaust_pile: [], draw_pile_count: 0, discard_pile_count: 0, exhaust_pile_count: 0, max_energy: 3, enemies: [] },
    room: null,
  } as unknown as Observation;
  const s = fromObservation(obs);
  assert.deepEqual(osty(s), [4, 6]);
  const t = fromObservation({ ...obs, player_allies: [{ ...obs.player_allies![0]!, hp: 3 }] } as Observation);
  assert.notEqual(stateKey(s), stateKey(t));
});
