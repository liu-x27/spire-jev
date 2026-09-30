// The Regent's rules (characters/regent.ts), each written from the game's IL: stars, Forge and the
// Sovereign Blade, the cards and powers built on them.
import assert from "node:assert/strict";
import { test } from "node:test";
import { actions, type Card, drink, endOfTurn, type Enemy, play, stateKey, type State } from "../src/sim.ts";
import { nextTurn, seeded } from "../src/turn.ts";
import { evaluate } from "../src/search.ts";
import { starsOf } from "../src/characters/regent.ts";

const card = (id: string, type: string, target: string, vars: Record<string, number>, cost = 1, keywords: string[] = [], extra: Partial<Card> = {}): Card => ({
  id, cost, costsX: false, type, target, keywords, vars, upgrades: 0, locked: false, glows: false, ...extra,
});
const STRIKE = card("STRIKE_REGENT", "Attack", "AnyEnemy", { Damage: 6 });
const DEFEND = card("DEFEND_REGENT", "Skill", "Self", { Block: 5 });
const FALLING_STAR = card("FALLING_STAR", "Attack", "AnyEnemy", { Damage: 8, VulnerablePower: 1, WeakPower: 1 }, 0, [], { starCost: 2 });
const VENERATE = card("VENERATE", "Skill", "Self", { Stars: 2 });
const BLADE = card("SOVEREIGN_BLADE", "Attack", "AnyEnemy", { Damage: 10, CalculationBase: 0, CalculationExtra: 1, CalculatedBlock: 0, Repeat: 1 }, 2, ["Retain"]);
const WOUND = card("WOUND", "Status", "None", {}, -1, ["Unplayable"]);

function foe(hp: number, id = 1, powers: Record<string, number> = {}, attack = 0): Enemy {
  return {
    id, model: "DUMMY", hp, maxHp: hp, block: 0, alive: true, powers: { ...powers }, weakAtStart: false, startStrength: powers["STRENGTH"] ?? 0,
    intents: attack > 0 ? [{ type: "Attack", damage: attack, hits: 1 }] : [{ type: "Buff", damage: 0, hits: 0 }],
  };
}
function state(hand: Card[], stars = 3, enemies: Enemy[] = [foe(50)], over: Partial<State> = {}): State {
  return {
    player: { hp: 60, maxHp: 75, block: 0, powers: {} },
    energy: 3, hand, draw: [], discard: [], exhaust: [], enemies, drawn: 0, exact: true, lostHp: false,
    exhaustedThisTurn: false, relics: ["DIVINE_RIGHT"], played: 0, skills: 0, unmovableUsed: false, potions: [], potionSlots: 2, potionsUsed: 0,
    turn: 1, ext: { stars }, ...over,
  };
}
/** A state no observation made (a spar bout's): no Regent state yet. */
const noExt = (s: State): State => {
  const { ext: _e, ...rest } = s;
  return rest;
};
const withPowers = (s: State, powers: Record<string, number>): State => ({ ...s, player: { ...s.player, powers: { ...s.player.powers, ...powers } } });
const at = (s: State, hand: number, target?: number) => play(s, { kind: "play", hand, ...(target !== undefined ? { target } : {}) });
const next = (s: State) => nextTurn(s, seeded(1), () => [])!;
const hp = (s: State, i = 0) => s.enemies[i]!.hp;
const bladeDamage = (s: State) => [...s.hand, ...s.draw, ...s.discard, ...s.exhaust].filter((c) => c.id === "SOVEREIGN_BLADE").map((c) => c.vars["Damage"]);

// ---------------------------------------------------------------- stars

test("a star cost is paid before the card resolves, and a card costing more than there are is not playable", () => {
  const s = state([FALLING_STAR], 2);
  const after = at(s, 0, 1);
  assert.equal(starsOf(after), 0);
  assert.equal(hp(after), 50 - 8);
  // Weak and Vulnerable after the hit: this one is not boosted by its own Vulnerable.
  assert.equal(after.enemies[0]!.powers["VULNERABLE"], 1);
  assert.equal(actions(state([FALLING_STAR], 1)).filter((a) => a.kind === "play").length, 0);
});

test("stars are kept from turn to turn, and a bout's start from Divine Right's 3", () => {
  const s = at(state([VENERATE, STRIKE], 3), 0);
  assert.equal(starsOf(s), 5);
  assert.equal(starsOf(next(s)), 5);
  const bout = noExt(state([FALLING_STAR], 0));
  assert.equal(starsOf(bout), 3);
  assert.equal(starsOf(at(bout, 0, 1)), 1);
  // A bout's opening stars carry into the next turn though no star moved.
  assert.equal(starsOf(next(noExt(state([STRIKE], 0)))), 3);
});

test("Black Hole hits every enemy for every gain of stars and after every card that paid stars, past Strength", () => {
  const two = [foe(50, 1), foe(50, 2)];
  const s = withPowers(state([VENERATE, FALLING_STAR], 3, two), { BLACK_HOLE: 3, STRENGTH: 5 });
  const gained = at(s, 0);
  assert.deepEqual(gained.enemies.map((e) => e.hp), [47, 47]);
  const spent = at(gained, 0, 1);
  assert.deepEqual(spent.enemies.map((e) => e.hp), [47 - (8 + 5) - 3, 44]);
});

test("Child of the Stars: block for every star spent, past Dexterity", () => {
  const s = withPowers(state([FALLING_STAR], 3), { CHILD_OF_THE_STARS: 2, DEXTERITY: 3 });
  assert.equal(at(s, 0, 1).player.block, 4);
});

test("The Sealed Throne: a star for every card played, before it resolves", () => {
  const s = withPowers(state([STRIKE, FALLING_STAR], 1), { THE_SEALED_THRONE: 1 });
  const a = at(s, 0, 1);
  assert.equal(starsOf(a), 2);
  // Falling Star paid with 2, then 1 more.
  assert.equal(starsOf(at(a, 0, 1)), 1);
});

test("Genesis and Star Next Turn give their stars as the next turn starts", () => {
  const s = withPowers(state([STRIKE], 0), { GENESIS: 2, STAR_NEXT_TURN: 3 });
  const n = next(s);
  assert.equal(starsOf(n), 5);
  assert.equal(n.player.powers["STAR_NEXT_TURN"], undefined);
});

// ---------------------------------------------------------------- Forge and the Sovereign Blade

const REFINE = card("REFINE_BLADE", "Skill", "Self", { Forge: 8, Energy: 1 });
test("Forge with no blade makes one in the hand at 10, then adds its amount; Refine Blade's energy is next turn's", () => {
  const s = at(state([REFINE]), 0);
  assert.deepEqual(bladeDamage(s), [18]);
  assert.equal(s.hand[0]!.id, "SOVEREIGN_BLADE");
  assert.equal(s.energy, 2);
  assert.equal(s.player.powers["ENERGY_NEXT_TURN"], 1);
});

test("Forge with a blade in the draw pile adds to it; an exhausted one gets it too but is no blade to find", () => {
  const drawn = at(state([REFINE], 3, [foe(50)], { draw: [BLADE] }), 0);
  assert.deepEqual(bladeDamage(drawn), [18]);
  assert.equal(drawn.hand.length, 0);
  const gone = at(state([REFINE], 3, [foe(50)], { exhaust: [BLADE] }), 0);
  assert.deepEqual(bladeDamage(gone).sort(), [18, 18]);
});

test("the blade: its Damage, ×2 on a Conqueror target (with Strength), Parry's block, Sword Sage plays it again", () => {
  assert.equal(hp(at(state([BLADE]), 0, 1)), 40);
  const str = withPowers(state([BLADE], 3, [foe(80, 1, { CONQUEROR: 1 })]), { STRENGTH: 2 });
  assert.equal(hp(at(str, 0, 1)), 80 - 24);
  const parry = at(withPowers(state([BLADE]), { PARRY: 10, DEXTERITY: 1 }), 0, 1);
  assert.equal(parry.player.block, 11);
  const sage = at(withPowers(state([BLADE], 3, [foe(80)]), { SWORD_SAGE: 1 }), 0, 1);
  assert.equal(hp(sage), 60);
});

test("Seeking Edge: the blade hits every enemy", () => {
  const s = withPowers(state([BLADE], 3, [foe(50, 1), foe(50, 2)]), { SEEKING_EDGE: 1 });
  assert.deepEqual(at(s, 0, 1).enemies.map((e) => e.hp), [40, 40]);
});

test("the blade is retained at the turn's end", () => {
  const n = next(state([BLADE, STRIKE]));
  assert.ok(n.hand.some((c) => c.id === "SOVEREIGN_BLADE"));
});

test("Furnace forges as every turn starts", () => {
  const n = next(withPowers(state([STRIKE]), { FURNACE: 5 }));
  assert.deepEqual(bladeDamage(n), [15]);
});

test("Beat Into Shape: Forge its base and its extra for every hit on the target this turn before it", () => {
  const beat = card("BEAT_INTO_SHAPE", "Attack", "AnyEnemy", { Damage: 5, CalculationBase: 5, CalculationExtra: 5 });
  const s = at(at(state([STRIKE, STRIKE, beat]), 0, 1), 0, 1);
  assert.deepEqual(bladeDamage(at(s, 0, 1)), [10 + 5 + 10]);
});

// ---------------------------------------------------------------- cards

test("Gather Light, Solar Strike, Shining Strike: their Stars too; Shining Strike goes on top of the draw pile", () => {
  const gather = card("GATHER_LIGHT", "Skill", "Self", { Block: 8, Stars: 1 });
  assert.equal(starsOf(at(state([gather], 0), 0)), 1);
  const shining = card("SHINING_STRIKE", "Attack", "AnyEnemy", { Damage: 8, Stars: 2 });
  const s = at(state([shining], 0), 0, 1);
  assert.equal(starsOf(s), 2);
  assert.equal(s.discard.length, 0);
  assert.equal(s.draw[s.draw.length - 1]!.id, "SHINING_STRIKE");
  assert.equal(s.onTop, 1);
});

test("Particle Wall comes back into the hand", () => {
  const wall = card("PARTICLE_WALL", "Skill", "Self", { Block: 9 }, 0, [], { starCost: 2 });
  const s = at(state([wall], 4), 0);
  assert.equal(s.hand[0]!.id, "PARTICLE_WALL");
  assert.equal(s.player.block, 9);
  assert.equal(starsOf(at(s, 0)), 0);
});

test("Guiding Star and Glow: next turn's draw, not now; Hegemony's energy next turn", () => {
  const guiding = card("GUIDING_STAR", "Attack", "AnyEnemy", { Damage: 12, Cards: 2 }, 1, [], { starCost: 1 });
  const s = at(state([guiding], 1, [foe(50)], { draw: [STRIKE, STRIKE] }), 0, 1);
  assert.equal(s.drawn, 0);
  assert.equal(s.player.powers["DRAW_CARDS_NEXT_TURN"], 2);
  const hegemony = card("HEGEMONY", "Attack", "AnyEnemy", { Damage: 15, Energy: 2 }, 2);
  const h = at(state([hegemony]), 0, 1);
  assert.equal(h.energy, 1);
  assert.equal(h.player.powers["ENERGY_NEXT_TURN"], 2);
});

test("Convergence: the hand kept, energy and stars next turn", () => {
  const conv = card("CONVERGENCE", "Skill", "Self", { Energy: 1, Stars: 1 });
  const s = at(state([conv, STRIKE, DEFEND], 0), 0);
  assert.equal(s.energy, 2);
  const n = next(s);
  assert.equal(starsOf(n), 1);
  assert.equal(n.energy, 4);
  assert.ok(n.hand.filter((c) => c.id === "STRIKE_REGENT").length >= 1 && n.hand.some((c) => c.id === "DEFEND_REGENT"));
});

test("Dying Star and Crush Under: Strength taken until the end of the enemies' turn", () => {
  const dying = card("DYING_STAR", "Attack", "AllEnemies", { Damage: 9, StrengthLoss: 9 }, 1, ["Ethereal"], { starCost: 3 });
  const s = at(state([dying], 3, [foe(50, 1, {}, 12)]), 0);
  assert.equal(s.enemies[0]!.powers["STRENGTH"], -9);
  const n = next(s);
  assert.equal(n.enemies[0]!.powers["STRENGTH"], undefined);
  assert.equal(n.player.hp, 60 - 3);
});

test("Begone: the worst card of the hand into a Minion Strike", () => {
  const begone = card("BEGONE", "Skill", "Self", {});
  const s = at(state([begone, STRIKE, WOUND]), 0);
  assert.deepEqual(s.hand.map((c) => c.id).sort(), ["MINION_STRIKE", "STRIKE_REGENT"]);
});

test("Stardust: a hit for every star there was, paid with all of them", () => {
  const dust = card("STARDUST", "Attack", "RandomEnemy", { Damage: 5 }, 0, [], { starX: true });
  const s = at(state([dust], 4, [foe(50)]), 0);
  assert.equal(hp(s), 30);
  assert.equal(starsOf(s), 0);
});

test("Knockout Blow gives its stars only for the kill", () => {
  const ko = card("KNOCKOUT_BLOW", "Attack", "AnyEnemy", { Damage: 30, Stars: 5 }, 3);
  assert.equal(starsOf(at(state([ko], 0, [foe(50)]), 0, 1)), 0);
  assert.equal(starsOf(at(state([ko], 0, [foe(20), foe(20, 2)]), 0, 1)), 5);
});

test("Void Form ends the turn; next turn its first two cards are free", () => {
  const vf = card("VOID_FORM", "Power", "Self", { VoidFormPower: 2 }, 3, ["Ethereal"]);
  const s = at(state([vf, STRIKE]), 0);
  assert.equal(actions(s).filter((a) => a.kind === "play").length, 0);
  const n = next({ ...s, hand: [STRIKE, STRIKE, STRIKE, FALLING_STAR] });
  const a = at(at(n, 0, 1), 0, 1);
  assert.equal(a.energy, 3);
  assert.equal(a.hand.find((c) => c.id === "STRIKE_REGENT")?.cost, 1);
});

test("Reflect deals the blocked hits back as the enemies attack", () => {
  const reflect = card("REFLECT", "Skill", "Self", { Block: 15 }, 1, [], { starCost: 3 });
  const s = at(state([reflect], 3, [foe(50, 1, {}, 10)]), 0);
  const n = next(s);
  assert.equal(n.enemies[0]!.hp, 40);
  assert.equal(n.player.powers["REFLECT"], undefined);
});

test("the evaluation counts stars kept and the blade's damage, and the state's key tells them apart", () => {
  const kept = state([STRIKE], 4);
  const spent = state([STRIKE], 1);
  assert.ok(evaluate(kept) > evaluate(spent));
  assert.notEqual(stateKey(kept), stateKey(spent));
  const forged = at(state([REFINE]), 0);
  assert.ok(evaluate(forged) > evaluate({ ...forged, hand: [] }));
});

test("an Ironclad's state gets no Regent state", () => {
  const s: State = { ...state([card("STRIKE_IRONCLAD", "Attack", "AnyEnemy", { Damage: 6 })], 0), relics: ["BURNING_BLOOD"] };
  delete s.ext;
  const a = at(s, 0, 1);
  assert.equal(a.ext, undefined);
  assert.equal(endOfTurn(a).ext, undefined);
});

test("Conqueror on an enemy with Artifact: the Artifact goes, no Conqueror", () => {
  const conq = card("CONQUEROR", "Skill", "AnyEnemy", { Forge: 3 });
  const s = at(state([conq], 3, [foe(60, 1, { ARTIFACT: 1 })]), 0, 1);
  assert.equal(s.enemies[0]!.powers["ARTIFACT"], 0);
  assert.equal(s.enemies[0]!.powers["CONQUEROR"], undefined);
});

test("Orbit: every 4 energy paid for cards over the fight gives its amount, from the bridge's counters", () => {
  const s = withPowers(state([STRIKE, DEFEND, STRIKE]), { ORBIT: 1 });
  s.player.powerVars = { ORBIT: { Energy: 4, energySpent: 3, triggerCount: 0 } };
  const a = at(s, 0, 1);
  assert.equal(a.energy, 3);
  assert.equal(at(a, 0).energy, 2);
});

test("the Regent's potions: Star Potion's stars, King's Courage's Forge", () => {
  const s = state([STRIKE], 1, [foe(50)], {
    potions: [
      { slot: 0, id: "STAR_POTION", target: "AnyPlayer", usage: "CombatOnly", vars: { Stars: 3 } },
      { slot: 1, id: "KINGS_COURAGE", target: "AnyPlayer", usage: "CombatOnly", vars: { Forge: 15 } },
    ],
  });
  assert.ok(actions(s).some((a) => a.kind === "potion" && a.slot === 0));
  const a = drink(s, { kind: "potion", slot: 0 });
  assert.equal(starsOf(a), 4);
  const b = drink(a, { kind: "potion", slot: 1 });
  assert.deepEqual(bladeDamage(b), [25]);
});

test("another character's fields on State.ext: the Regent's rules keep them and score as without them", () => {
  const plain = state([FALLING_STAR, STRIKE], 3);
  const shared = { ...plain, ext: { ...plain.ext, discards: 2, ostyHp: 5 } };
  assert.equal(evaluate(shared), evaluate(plain));
  const a = at(shared, 0, 1);
  assert.equal(starsOf(a), 1);
  assert.equal((a.ext as Record<string, unknown>)["ostyHp"], 5);
  const other: State = { ...noExt(plain), ext: { discards: 2 } };
  assert.ok(Number.isFinite(evaluate(other)));
});
