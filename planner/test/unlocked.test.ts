// Rules for what the unlocked timeline brought (2026-09-24): the Underdocks' monsters, the
// Waterfall Giant's DeathBlow, and the Ironclad cards the locked profile never offered. Each is
// written from the game's IL (tools/inspect --il) and the A10 runs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { type Action, type Card, type Enemy, hpLoss, incomingDamage, play, type State } from "../src/sim.ts";
import { evaluate, planTurn, useHpNeed, useHpScale, usePotionSaving, useTorchFirst } from "../src/search.ts";
import { chooseEvent } from "../src/choices.ts";
import type { LegalAction, Observation } from "../src/obs.ts";

const card = (id: string, type: string, target: string, vars: Record<string, number>, cost = 1): Card => ({
  id, cost, costsX: false, type, target, keywords: [], vars, upgrades: 0, locked: false, glows: false,
});
const STRIKE = card("STRIKE_IRONCLAD", "Attack", "AnyEnemy", { Damage: 6 });
const DEFEND = card("DEFEND_IRONCLAD", "Skill", "Self", { Block: 5 });

function foe(model: string, hp: number, powers: Record<string, number> = {}, id = 1): Enemy {
  return {
    id, model, hp, maxHp: hp, block: 0, alive: true, powers: { ...powers }, weakAtStart: false, startStrength: 0,
    intents: [{ type: "Attack", damage: 10, hits: 1 }],
  };
}
function state(hand: Card[], enemies: Enemy[], hp = 80): State {
  return {
    player: { hp, maxHp: 80, block: 0, powers: {} },
    energy: 3, hand, draw: [STRIKE, STRIKE, STRIKE], discard: [], exhaust: [], enemies, drawn: 0, exact: true, lostHp: false, exhaustedThisTurn: false, relics: [], played: 0, skills: 0, unmovableUsed: false, potions: [], potionSlots: 3, potionsUsed: 0,
  };
}
const at = (s: State, hand: number, target = 1) => play(s, { kind: "play", hand, target });
const after = (s: State, line: readonly Action[]) => line.reduce((x, a) => (a.kind === "play" ? play(x, a) : x), s);

test("the Waterfall Giant killed is not dead: it strikes for its Steam Eruption the turn after", () => {
  const s = at(state([STRIKE], [foe("WATERFALL_GIANT", 5, { STEAM_ERUPTION: 41 })]), 0);
  const giant = s.enemies[0]!;
  assert.equal(giant.alive, false);
  assert.equal(giant.deathBlow, 41);
  assert.equal(giant.blowNow, false);
  // Stunned: nothing at this turn's end.
  assert.equal(incomingDamage(s), 0);
});

test("on the DeathBlow's turn the planner blocks, though nothing is left to hit", () => {
  const dying: Enemy = {
    ...foe("WATERFALL_GIANT", 0), alive: false, deathBlow: 45, blowNow: true, intents: [{ type: "DeathBlow", damage: 45, hits: 1 }],
  };
  const s = state([STRIKE, DEFEND, DEFEND], [dying], 38);
  assert.equal(hpLoss(s), 45);
  // Two Defends leave 3 HP; ending the turn at once (the first replays) died.
  assert.equal(hpLoss(after(s, planTurn(s).actions)), 35);
});

test("weak put on the dying Giant takes a quarter off its DeathBlow", () => {
  const dying: Enemy = {
    ...foe("WATERFALL_GIANT", 0), alive: false, deathBlow: 44, blowNow: true, intents: [{ type: "DeathBlow", damage: 44, hits: 1 }],
  };
  const uppercut = card("UPPERCUT", "Attack", "AnyEnemy", { Damage: 13, Power: 1 }, 2);
  assert.equal(incomingDamage(at(state([uppercut], [dying]), 0)), 33);
});

test("colossus played this turn halves a vulnerable enemy's attack", () => {
  const e = foe("SEAPUNK", 40, { VULNERABLE: 1 });
  e.intents = [{ type: "Attack", damage: 20, hits: 1 }];
  const colossus = card("COLOSSUS", "Skill", "Self", { Block: 0, Colossus: 1 });
  assert.equal(incomingDamage(play(state([colossus], [e]), { kind: "play", hand: 0 })), 10);
});

test("skittish: once a turn, a card's attack that took HP gives the Gardener its block after", () => {
  const twin = card("TWIN_STRIKE", "Attack", "AnyEnemy", { Damage: 5, Repeat: 2 });
  const s = at(state([twin, STRIKE], [foe("PHANTASMAL_GARDENER", 30, { SKITTISH: 7 })]), 0);
  // Both hits land before the block.
  assert.equal(s.enemies[0]!.hp, 20);
  assert.equal(s.enemies[0]!.block, 7);
  // The next attack goes into that block, and gives no more.
  const t = at(s, 0);
  assert.equal(t.enemies[0]!.hp, 20);
  assert.equal(t.enemies[0]!.block, 1);
});

test("ravenous: killing a slug gives the others strength, and stuns them for this turn", () => {
  const s = at(state([STRIKE], [foe("CORPSE_SLUG", 4, { RAVENOUS: 5 }, 1), foe("CORPSE_SLUG", 20, { RAVENOUS: 5 }, 2)]), 0, 1);
  assert.equal(s.enemies[1]!.powers["STRENGTH"], 5);
  assert.equal(incomingDamage(s), 0);
});

test("hardened shell lets through at most its amount of HP a turn", () => {
  const big = card("BLUDGEON", "Attack", "AnyEnemy", { Damage: 15 });
  const s = at(at(state([big, big], [foe("SKULKING_COLONY", 80, { HARDENED_SHELL: 20 })]), 0), 0);
  assert.equal(s.enemies[0]!.hp, 60);
});

test("dominate: vulnerable first, then strength for every vulnerable the target has", () => {
  const dominate = card("DOMINATE", "Skill", "AnyEnemy", { VulnerablePower: 1, StrengthPerVulnerable: 1 });
  const s = at(state([dominate], [foe("SEAPUNK", 40, { VULNERABLE: 2 })]), 0);
  assert.equal(s.enemies[0]!.powers["VULNERABLE"], 3);
  assert.equal(s.player.powers["STRENGTH"], 3);
});

test("cruelty adds its amount to vulnerable's multiplier; molten fist doubles vulnerable", () => {
  const s = state([STRIKE], [foe("SEAPUNK", 40, { VULNERABLE: 2 })]);
  s.player.powers["CRUELTY"] = 25;
  assert.equal(at(s, 0).enemies[0]!.hp, 30); // 6 x 1.75
  const fist = card("MOLTEN_FIST", "Attack", "AnyEnemy", { Damage: 10 });
  assert.equal(at(state([fist], [foe("SEAPUNK", 40, { VULNERABLE: 2 })]), 0).enemies[0]!.powers["VULNERABLE"], 4);
});

test("pact's end hits every enemy, and only with three cards exhausted; it draws nothing", () => {
  const pact = card("PACTS_END", "Attack", "AllEnemies", { Damage: 18, Cards: 3 }, 0);
  const two = () => [foe("SEAPUNK", 40, {}, 1), foe("SEAPUNK", 40, {}, 2)];
  const none = play(state([pact], two()), { kind: "play", hand: 0 });
  assert.deepEqual(none.enemies.map((e) => e.hp), [40, 40]);
  assert.equal(none.drawn, 0);
  const ready = state([pact], two());
  ready.exhaust = [STRIKE, STRIKE, STRIKE];
  assert.deepEqual(play(ready, { kind: "play", hand: 0 }).enemies.map((e) => e.hp), [22, 22]);
});

test("inferno: HP lost on the player's turn hits every enemy", () => {
  const s = state([card("BLOODLETTING", "Skill", "Self", { HpLoss: 3, Energy: 2 }, 0)], [foe("SEAPUNK", 40, {}, 1), foe("SEAPUNK", 40, {}, 2)]);
  s.player.powers["INFERNO"] = 6;
  assert.deepEqual(play(s, { kind: "play", hand: 0 }).enemies.map((e) => e.hp), [34, 34]);
});

test("shriek: the hit that leaves the Terror Eel at 75 or under stuns it, its attack this turn gone", () => {
  const eel = foe("TERROR_EEL", 80, { SHRIEK: 75 });
  eel.intents = [{ type: "Attack", damage: 24, hits: 1 }];
  const s = at(state([STRIKE], [eel]), 0);
  assert.equal(s.enemies[0]!.hp, 74);
  assert.equal(s.enemies[0]!.powers["SHRIEK"], undefined);
  assert.equal(incomingDamage(s), 0);
});

test("infested: the Phrog Parasite's death lets out its Wrigglers, stunned; the fight is not won", () => {
  const s = at(state([STRIKE], [foe("PHROG_PARASITE", 5, { INFESTED: 4 })]), 0);
  const wrigglers = s.enemies.filter((e) => e.model === "WRIGGLER");
  assert.equal(wrigglers.length, 4);
  assert.ok(wrigglers.every((e) => e.alive && e.hp === 20));
  assert.equal(incomingDamage(s), 0);
});

test("tablet of truth: decipher once, twice with 70+ max HP, then give up", () => {
  const screen = (page: string, keys: string[], hp: number, maxHp: number) => {
    const options = keys.map((k, index) => ({ index, text_key: `TABLET_OF_TRUTH.pages.${page}.options.${k}`, locked: false, proceed: false }));
    const o = { phase: "event", player_hp: hp, player_max_hp: maxHp, room: { details: { event_id: "TABLET_OF_TRUTH", options } } } as unknown as Observation;
    const legal = keys.map((_, i) => ({ action_id: `choose_event:${i}` })) as LegalAction[];
    return chooseEvent(o, legal);
  };
  assert.equal(screen("INITIAL", ["DECIPHER_1", "SMASH"], 67, 80), "choose_event:0");
  assert.equal(screen("INITIAL", ["DECIPHER_1", "SMASH"], 30, 80), "choose_event:1");
  assert.equal(screen("DECIPHER_1", ["DECIPHER", "GIVE_UP"], 67, 77), "choose_event:0");
  assert.equal(screen("DECIPHER_1", ["DECIPHER", "GIVE_UP"], 60, 65), "choose_event:1");
  assert.equal(screen("DECIPHER_2", ["DECIPHER", "GIVE_UP"], 67, 71), "choose_event:1");
});

test("neow: the relic highest in the research's order, not the first listed; the avoided last", () => {
  const offer = (relics: string[], hp = 80, maxHp = 80) => {
    const options = relics.map((relic, index) => ({ index, text_key: `NEOW.pages.INITIAL.options.${relic}`, relic, locked: false, proceed: false }));
    const o = { phase: "event", player_hp: hp, player_max_hp: maxHp, gold: 99, deck_cards: [], room: { details: { event_id: "NEOW", options } } } as unknown as Observation;
    return chooseEvent(o, relics.map((_, i) => ({ action_id: `choose_event:${i}` })) as LegalAction[]);
  };
  assert.equal(offer(["LOST_COFFER", "WINGED_BOOTS", "STONE_HUMIDIFIER"]), "choose_event:2");
  assert.equal(offer(["LOST_COFFER", "FISHING_ROD", "LAVA_ROCK"]), "choose_event:1");
  // Leafy Poultice costs 12 max HP: not under 70.
  assert.equal(offer(["LEAFY_POULTICE", "NEW_LEAF"], 60, 65), "choose_event:1");
});

test("slumber: a hit past its block takes a stack off, the last wakes it stunned", () => {
  const beetle = foe("SLUMBERING_BEETLE", 60, { SLUMBER: 2 });
  const once = at(state([STRIKE, STRIKE], [beetle]), 0);
  assert.equal(once.enemies[0]!.powers["SLUMBER"], 1);
  const twice = at(once, 0);
  assert.equal(twice.enemies[0]!.powers["SLUMBER"], undefined);
  assert.equal(incomingDamage(twice), 0);
});

test("reattach: a segment killed while another lives is HP still to take; all dead is the win", () => {
  const seg = (id: number, hp: number) => foe("DECIMILLIPEDE_SEGMENT_FRONT", hp, { REATTACH: 25 }, id);
  const one = at(state([STRIKE], [seg(1, 5), seg(2, 40)]), 0, 1);
  const both = at(at(state([STRIKE, STRIKE], [seg(1, 5), seg(2, 5)]), 0, 1), 0, 2);
  assert.ok(evaluate(both) > evaluate(one) + 1e5);
  // The same kill without Reattach is worth its 25 HP more (at enemyHp 0.35): the segment comes back.
  const plain = at(state([STRIKE], [foe("DECIMILLIPEDE_SEGMENT_FRONT", 5, {}, 1), foe("DECIMILLIPEDE_SEGMENT_FRONT", 40, {}, 2)]), 0, 1);
  assert.ok(Math.abs(evaluate(plain) - evaluate(one) - 25 * 0.35) < 0.01);
});

test("illusion: a Parafright's HP is no progress", () => {
  const obscura = foe("THE_OBSCURA", 100, {}, 1);
  const fright = foe("PARAFRIGHT", 20, { ILLUSION: 1, MINION: 1 }, 2);
  fright.intents = [];
  const hitFright = at(state([STRIKE], [obscura, fright]), 0, 2);
  const hitObscura = at(state([STRIKE], [obscura, { ...fright, powers: { ...fright.powers } }]), 0, 1);
  assert.ok(evaluate(hitObscura) > evaluate(hitFright));
});

test("personal hive: every hit on the Entomancer is a Dazed; one big hit beats many small ones", () => {
  const ento = () => foe("ENTOMANCER", 100, { PERSONAL_HIVE: 1 });
  const twin = card("TWIN_STRIKE", "Attack", "AnyEnemy", { Damage: 5, Repeat: 2 });
  assert.equal(at(state([twin], [ento()]), 0).dazedAdded, 2);
  const heavy = card("BLUDGEON", "Attack", "AnyEnemy", { Damage: 10 });
  assert.ok(evaluate(at(state([heavy], [ento()]), 0)) > evaluate(at(state([twin], [ento()]), 0)));
});

test("Cinder hits, then exhausts a card from the hand; Drum of Battle draws, its energy comes when it is exhausted", () => {
  const cinder = card("CINDER", "Attack", "AnyEnemy", { Damage: 18 }, 2);
  const s = at(state([cinder, DEFEND, STRIKE], [foe("NIBBIT", 50)]), 0);
  assert.equal(s.enemies[0]!.hp, 32);
  assert.equal(s.hand.length, 1);
  assert.equal(s.exhaust.length, 1);
  assert.equal(s.exact, false);
  const drum = card("DRUM_OF_BATTLE", "Skill", "Self", { Cards: 2, Energy: 2 }, 1);
  const d = at(state([drum], [foe("NIBBIT", 50)]), 0);
  assert.equal(d.energy, 2);
  assert.equal(d.drawn, 2);
});

test("potsave: a potion drunk before act 3's bosses costs four times as much", () => {
  const drunk = { ...state([], [foe("NIBBIT", 50)]), potionsUsed: 1 };
  const kept = state([], [foe("NIBBIT", 50)]);
  const cost = () => evaluate(kept) - evaluate(drunk);
  const plain = cost();
  usePotionSaving(true);
  try {
    assert.ok(Math.abs(cost() - 4 * plain) < 1e-9, `${cost()} vs ${plain}`);
  } finally {
    usePotionSaving(false);
  }
});

test("hp48: the first of A10's two act 3 bosses prices HP half as much again", () => {
  const hurt = state([], [foe("NIBBIT", 50)], 50);
  const whole = state([], [foe("NIBBIT", 50)], 60);
  const plain = evaluate(whole) - evaluate(hurt);
  useHpScale(1.5);
  try {
    assert.ok(Math.abs(evaluate(whole) - evaluate(hurt) - 1.5 * plain) < 1e-9);
  } finally {
    useHpScale(1);
  }
});

test("torch: while her Torch Head lives the Queen's HP counts half, the Torch's half as much again", () => {
  const queen = { ...foe("QUEEN", 400), id: 1 };
  const torch = { ...foe("TORCH_HEAD_AMALGAM", 200), id: 2 };
  const hitQueen = state([], [{ ...queen, hp: 380 }, torch]);
  const hitTorch = state([], [queen, { ...torch, hp: 180 }]);
  assert.ok(Math.abs(evaluate(hitQueen) - evaluate(hitTorch)) < 1e-9);
  useTorchFirst(true);
  try {
    assert.ok(evaluate(hitTorch) > evaluate(hitQueen));
  } finally {
    useTorchFirst(false);
  }
});

test("hp48b: under the second boss's need every HP counts twice", () => {
  const at = (hp: number) => evaluate(state([], [foe("NIBBIT", 50)], hp));
  useHpNeed(60);
  try {
    assert.ok(Math.abs(at(50) - at(40) - 2 * (at(80) - at(70))) < 1e-9);
  } finally {
    useHpNeed(0);
  }
});
