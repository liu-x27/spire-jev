// The Defect's rules (src/characters/defect.ts), each from the game's IL (v0.111.0).
import assert from "node:assert/strict";
import { test } from "node:test";
import { type Card, type Enemy, endOfTurn, hpLoss, play, type State } from "../src/sim.ts";
import { nextTurn, seeded } from "../src/turn.ts";
import { evaluate } from "../src/search.ts";
import { channel, hologramPick, type Orb, orbKey, orbsOf, orbState } from "../src/characters/defect.ts";

const card = (id: string, type: string, target: string, vars: Record<string, number> = {}, cost = 1, keywords: string[] = [], extra: Partial<Card> = {}): Card => ({
  id, cost, costsX: false, type, target, keywords, vars, upgrades: 0, locked: false, glows: false, ...extra,
});
const STRIKE = card("STRIKE_DEFECT", "Attack", "AnyEnemy", { Damage: 6 });
const DEFEND = card("DEFEND_DEFECT", "Skill", "Self", { Block: 5 });
const ZAP = card("ZAP", "Skill", "Self");
const DUALCAST = card("DUALCAST", "Skill", "Self");
const COLD_SNAP = card("COLD_SNAP", "Attack", "AnyEnemy", { Damage: 6 });

function foe(hp: number, id = 1, powers: Record<string, number> = {}, attack = 0): Enemy {
  return {
    id, model: "DUMMY", hp, maxHp: hp, block: 0, alive: true, powers: { ...powers }, weakAtStart: false, startStrength: 0,
    intents: attack > 0 ? [{ type: "Attack", damage: attack, hits: 1 }] : [{ type: "Buff", damage: 0, hits: 0 }],
  };
}
/** A Defect's state mid-fight: `orbs` front first, 3 slots unless said. */
function state(hand: Card[], orbs: Orb[] = [], enemies: Enemy[] = [foe(60)], over: Partial<State> = {}, slots = 3): State {
  return {
    player: { hp: 60, maxHp: 75, block: 0, powers: {} },
    energy: 3, maxEnergy: 3, hand, draw: [], discard: [], exhaust: [], enemies, drawn: 0, exact: true, lostHp: false,
    exhaustedThisTurn: false, relics: ["CRACKED_CORE"], played: 0, skills: 0, unmovableUsed: false, potions: [], potionSlots: 2, potionsUsed: 0,
    turn: 2, ext: { orbs, orbSlots: slots }, ...over,
  };
}
const L: Orb = { id: "LIGHTNING_ORB" };
const F: Orb = { id: "FROST_ORB" };
const D = (n = 6): Orb => ({ id: "DARK_ORB", n });
const G = (n = 4): Orb => ({ id: "GLASS_ORB", n });
const P: Orb = { id: "PLASMA_ORB" };
/** The state with no ext (a spar bout's, another character's). */
const noExt = (s: State): State => {
  const { ext: _e, ...rest } = s;
  return rest;
};
const withPowers = (s: State, powers: Record<string, number>): State => ({ ...s, player: { ...s.player, powers: { ...s.player.powers, ...powers } } });
const at = (s: State, hand: number, target?: number) => play(s, { kind: "play", hand, ...(target !== undefined ? { target } : {}) });
const next = (s: State) => nextTurn(s, seeded(1), () => [])!;

// ---------------------------------------------------------------- the orb queue

test("channel: into free slots it appends at the back; the front is the oldest", () => {
  const s = at(state([ZAP], [F]), 0);
  assert.equal(orbKey(s), "3:FROST LIGHTNING");
});

test("channel: into full slots the front is evoked (removed) first, then the new orb appended", () => {
  const s = at(state([ZAP], [L, F, F]), 0);
  assert.equal(orbKey(s), "3:FROST FROST LIGHTNING");
  assert.equal(s.enemies[0]!.hp, 60 - 8);
});

test("channel: the Defect with no slots loses the orb; another character gets a slot for its first", () => {
  const none = at(state([ZAP], [], [foe(60)], {}, 0), 0);
  assert.equal(orbKey(none), "0:");
  const ironclad = noExt(state([ZAP], [], [foe(60)], { relics: [] }));
  const s = at(ironclad, 0);
  assert.equal(orbKey(s), "1:LIGHTNING");
});

test("dualcast: the front orb evoked twice, removed on the second; nothing with no orbs", () => {
  const s = at(state([DUALCAST], [L, F]), 0);
  assert.equal(s.enemies[0]!.hp, 60 - 16);
  assert.equal(orbKey(s), "3:FROST");
  const empty = at(state([DUALCAST], []), 0);
  assert.equal(empty.enemies[0]!.hp, 60);
  assert.equal(empty.energy, 2);
});

test("bulk up: a slot less, the newest orb past it gone unevoked; Strength and Dexterity", () => {
  const bulk = card("BULK_UP", "Power", "Self", { OrbSlots: 1, StrengthPower: 2, DexterityPower: 2 }, 2);
  const s = at(state([bulk], [L, F, D(10)]), 0);
  assert.equal(orbKey(s), "2:LIGHTNING FROST");
  assert.equal(s.enemies[0]!.hp, 60);
  assert.equal(s.player.powers["STRENGTH"], 2);
  assert.equal(s.player.powers["DEXTERITY"], 2);
});

test("capacitor: slots, at most 10", () => {
  const cap = card("CAPACITOR", "Power", "Self", { Repeat: 2 });
  assert.equal(orbState(at(state([cap], []), 0)).orbSlots, 5);
  assert.equal(orbState(at(state([cap], [], [foe(60)], {}, 9), 0)).orbSlots, 10);
});

// ---------------------------------------------------------------- values and the turn's end

test("lightning: 3 at the end of the turn, with Focus; unpowered — no Strength or Vulnerable, into block", () => {
  const s = withPowers(state([], [L], [{ ...foe(40, 1, { VULNERABLE: 2 }), block: 1 }]), { FOCUS: 2, STRENGTH: 5 });
  const e = endOfTurn(s);
  assert.equal(e.enemies[0]!.block, 0);
  assert.equal(e.enemies[0]!.hp, 40 - 4);
});

test("focus below 0 floors every value at 0", () => {
  const s = withPowers(state([], [L, F]), { FOCUS: -5 });
  const e = endOfTurn(s);
  assert.equal(e.enemies[0]!.hp, 60);
  assert.equal(e.player.block, 0);
});

test("frost: its block at the end of the turn stops the enemies' attack; Dexterity and Frail do not touch it", () => {
  const s = withPowers(state([], [F, F], [foe(60, 1, {}, 10)]), { DEXTERITY: 3, FRAIL: 1 });
  assert.equal(hpLoss(s), 10 - 4);
});

test("dark: each end of turn adds 6 + Focus to its evoke; the evoke hits the enemy with the least HP, Focus not added again", () => {
  const s = withPowers(state([], [D()], [foe(50, 1), foe(10, 2)]), { FOCUS: 3 });
  const e = endOfTurn(s);
  assert.deepEqual(orbsOf(e)[0], { id: "DARK_ORB", n: 15 });
  // Dualcast: the first evoke kills the weaker, the second finds the other the weakest.
  const ev = at({ ...e, ended: false, hand: [DUALCAST] }, 0);
  assert.equal(ev.enemies[1]!.alive, false);
  assert.equal(ev.enemies[0]!.hp, 50 - 15);
});

test("glass: every enemy hit for its value, then it loses 1; its evoke is twice its passive", () => {
  const s = state([], [G()], [foe(30, 1), foe(30, 2)]);
  const e = endOfTurn(s);
  assert.equal(e.enemies[0]!.hp, 26);
  assert.equal(e.enemies[1]!.hp, 26);
  assert.deepEqual(orbsOf(e)[0], { id: "GLASS_ORB", n: 3 });
  const ev = at(state([DUALCAST], [G(3)], [foe(30, 1), foe(30, 2)]), 0);
  assert.equal(ev.enemies[0]!.hp, 30 - 12);
});

test("glass at 0: no hit and no decay; with Focus it keeps hitting for the Focus", () => {
  const zero = endOfTurn(state([], [G(0)]));
  assert.equal(zero.enemies[0]!.hp, 60);
  const focused = endOfTurn(withPowers(state([], [G(0)]), { FOCUS: 2 }));
  assert.equal(focused.enemies[0]!.hp, 58);
  assert.deepEqual(orbsOf(focused)[0], { id: "GLASS_ORB", n: 0 });
});

test("plasma: nothing at the end of the turn, an energy at the next turn's start; its evoke 2 energy now", () => {
  const s = state([], [P, P]);
  assert.equal(endOfTurn(s).energy, 3);
  assert.equal(next(s).energy, 3 + 2);
  const ev = at(state([DUALCAST], [P]), 0);
  assert.equal(ev.energy, 2 + 4);
});

test("gold-plated cables: the front orb's passive twice at the end of the turn", () => {
  const s = state([], [L, L], [foe(60)], { relics: ["CRACKED_CORE", "GOLD_PLATED_CABLES"] });
  assert.equal(endOfTurn(s).enemies[0]!.hp, 60 - 9);
});

test("infused core: the Lightning's values 1 more, after Focus's floor", () => {
  const s = withPowers(state([], [L], [foe(60)], { relics: ["INFUSED_CORE"] }), { FOCUS: -9 });
  assert.equal(endOfTurn(s).enemies[0]!.hp, 59);
});

// ---------------------------------------------------------------- cards and powers

test("hyperbeam: 3 Focus less for this turn's passives only; back the next turn", () => {
  const beam = card("HYPERBEAM", "Attack", "AllEnemies", { Damage: 24, FocusPower: 3 }, 2);
  const s = at(withPowers(state([beam], [L], [foe(100)]), { FOCUS: 4 }), 0);
  assert.equal(s.player.powers["FOCUS"], 1);
  assert.equal(s.player.powers["HYPERBEAM_FOCUS_DOWN"], 3);
  assert.equal(endOfTurn(s).enemies[0]!.hp, 100 - 24 - 4);
  const n = next(s);
  assert.equal(n.player.powers["FOCUS"], 4);
  assert.equal(n.player.powers["HYPERBEAM_FOCUS_DOWN"], undefined);
});

test("hotfix: Focus for the turn, its power beside it", () => {
  const hotfix = card("HOTFIX", "Skill", "Self", { FocusPower: 2 }, 0, ["Exhaust"]);
  const s = at(state([hotfix], [F]), 0);
  assert.equal(s.player.powers["FOCUS"], 2);
  assert.equal(endOfTurn(s).player.block, 4);
  assert.equal(next(s).player.powers["FOCUS"], undefined);
});

test("echo form: the turn's first card is played twice; the Echo Form that makes the power is not", () => {
  const echo = card("ECHO_FORM", "Power", "Self", { EchoForm: 1 }, 3);
  const played = at(state([echo, STRIKE]), 0);
  assert.equal(played.player.powers["ECHO_FORM"], 1);
  const s = at(withPowers(state([STRIKE, STRIKE]), { ECHO_FORM: 1 }), 0, 1);
  assert.equal(s.enemies[0]!.hp, 60 - 12);
  const second = at(s, 0, 1);
  assert.equal(second.enemies[0]!.hp, 60 - 18);
});

test("storm: a Power card played channels its amount in Lightning; the Storm that makes the power does not", () => {
  const storm = card("STORM", "Power", "Self", { StormPower: 1 });
  const defrag = card("DEFRAGMENT", "Power", "Self", { FocusPower: 1 });
  const s = at(state([storm, defrag]), 0);
  assert.equal(orbKey(s), "3:");
  const t = at(s, 0);
  assert.equal(orbKey(t), "3:LIGHTNING");
  assert.equal(t.player.powers["FOCUS"], 1);
});

test("consuming shadow: at the end of the turn the newest orb is evoked and removed, after the passives", () => {
  const s = withPowers(state([], [L, F], [foe(60, 1, {}, 10)]), { CONSUMING_SHADOW: 1 });
  const e = endOfTurn(s);
  assert.equal(orbKey(e), "3:LIGHTNING");
  assert.equal(e.player.block, 2 + 5);
});

test("hailstorm: a Frost held, its amount to every enemy at the end of the turn", () => {
  const s = withPowers(state([], [F], [foe(30, 1), foe(30, 2)]), { HAILSTORM: 6 });
  const e = endOfTurn(s);
  assert.equal(e.enemies[0]!.hp, 24);
  assert.equal(endOfTurn(withPowers(state([], [L], [foe(30)]), { HAILSTORM: 6 })).enemies[0]!.hp, 27);
});

test("thunder: a Lightning's evoke hits the same enemy again for its amount, if it lives", () => {
  const s = at(withPowers(state([ZAP], [L, F, F], [foe(60)]), { THUNDER: 8 }), 0);
  assert.equal(s.enemies[0]!.hp, 60 - 8 - 8);
});

test("tesla coil: the hit, then every Lightning's passive at the target", () => {
  const coil = card("TESLA_COIL", "Attack", "AnyEnemy", { Damage: 3 }, 0);
  const s = at(state([coil], [L, F, L], [foe(40, 1), foe(40, 2)]), 0, 2);
  assert.equal(s.enemies[1]!.hp, 40 - 3 - 6);
  assert.equal(s.enemies[0]!.hp, 40);
});

test("loop: the front orb's passive at the next turn's start", () => {
  const s = withPowers(state([], [F]), { LOOP: 1 });
  const n = next(s);
  assert.equal(n.player.block, 2);
});

test("lightning rod: a Lightning at each of the next turns' start, a stack a turn", () => {
  const rod = card("LIGHTNING_ROD", "Skill", "Self", { Block: 4, LightningRodPower: 2 });
  const s = at(state([rod], []), 0);
  assert.equal(orbKey(s), "3:");
  const n = next(s);
  assert.equal(orbKey(n), "3:LIGHTNING");
  assert.equal(n.player.powers["LIGHTNING_ROD"], 1);
});

test("charge battery: block now, the energy next turn", () => {
  const cb = card("CHARGE_BATTERY", "Skill", "Self", { Block: 7, Energy: 1 });
  const s = at(state([cb]), 0);
  assert.equal(s.energy, 2);
  assert.equal(next(s).energy, 4);
});

test("buffer: the next hit that would take HP takes none", () => {
  const s = withPowers(state([], [], [foe(60, 1, {}, 10), foe(60, 2, {}, 7)]), { BUFFER: 1 });
  assert.equal(hpLoss(s), 7);
});

test("buffer: a stack the enemies' hit spent is gone the next turn; a blocked hit spends none", () => {
  const s = withPowers(state([], [], [foe(60, 1, {}, 10)]), { BUFFER: 2 });
  assert.equal(next(s).player.powers["BUFFER"], 1);
  const blocked = withPowers({ ...state([], [], [foe(60, 1, {}, 10)]), player: { hp: 60, maxHp: 75, block: 12, powers: {} } }, { BUFFER: 1 });
  assert.equal(next(blocked).player.powers["BUFFER"], 1);
});

test("creative ai: a card at the next turn's start the model cannot know", () => {
  const n = next(withPowers(state([]), { CREATIVE_AI: 1 }));
  assert.equal(n.drawn, 1);
});

test("a killed Waterfall Giant with its blow to come: the fight goes on, a channel still channels", () => {
  const giant: Enemy = { ...foe(0, 1), model: "WATERFALL_GIANT", alive: false, deathBlow: 41, blowNow: true };
  const s = at(state([ZAP], [L, L]), 0);
  assert.equal(orbKey(s), "3:LIGHTNING LIGHTNING LIGHTNING");
  const g = at(state([card("SHADOW_SHIELD", "Skill", "Self", { Block: 11 }, 2)], [L, L], [giant], {}, 2), 0);
  assert.equal(orbKey(g), "2:LIGHTNING DARK6");
});

test("metronome: the fight's 7th channel deals 30 to every enemy, once", () => {
  const s = state([ZAP], [], [foe(60)], { relics: ["CRACKED_CORE", "METRONOME"], relicVars: { METRONOME: { _orbsChanneled: 6, Damage: 30 } } });
  assert.equal(at(s, 0).enemies[0]!.hp, 30);
});

test("self-made Statuses: Smokestack's damage to every enemy, Rocket Punch 1 cheaper", () => {
  const overclock = card("OVERCLOCK", "Skill", "Self", { Cards: 2 }, 0);
  const punch = card("ROCKET_PUNCH", "Attack", "AnyEnemy", { Damage: 13, Cards: 1 }, 2);
  const s = at(withPowers(state([overclock, punch]), { SMOKESTACK: 5 }), 0);
  assert.equal(s.enemies[0]!.hp, 55);
  assert.equal(s.hand[0]!.cost, 1);
  assert.ok(s.discard.some((c) => c.id === "BURN"));
});

test("cold snap: the hit, then a Frost", () => {
  const s = at(state([COLD_SNAP], []), 0, 1);
  assert.equal(s.enemies[0]!.hp, 54);
  assert.equal(orbKey(s), "3:FROST");
});

test("hologram: the dearest card of the discard pile that is not a Status", () => {
  assert.equal(hologramPick([{ id: "DAZED", type: "Status", cost: -1 }, { id: "STRIKE_DEFECT", type: "Attack", cost: 1 }, { id: "GLACIER", type: "Skill", cost: 2 }]), 2);
});

test("a spar bout's Defect opens with 3 slots and Cracked Core's Lightning on turn 1", () => {
  const s: State = noExt(state([], [], [foe(60)], { turn: 1 }));
  assert.equal(orbsOf(s).length, 1);
  channel(s, "FROST_ORB");
  assert.equal(orbKey(s), "3:LIGHTNING FROST");
});

test("orbs to come count in the evaluation: a Frost held is worth more than none", () => {
  const without = state([], [], [foe(80, 1, {}, 5)]);
  const withFrost = state([], [F], [foe(80, 1, {}, 5)]);
  assert.ok(evaluate(withFrost) > evaluate(without));
});

test("another character's state: no Defect ext made by its plays", () => {
  const s: State = noExt(state([STRIKE, DEFEND], [], [foe(60)], { relics: [] }));
  const a = at(at(s, 0, 1), 0);
  assert.equal(a.ext, undefined);
});
