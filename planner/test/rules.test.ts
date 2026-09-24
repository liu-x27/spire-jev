// Card rules, each as the game showed it in a coverage run (planner/runs).
import assert from "node:assert/strict";
import { test } from "node:test";
import { actions, type Card, drink, type Enemy, hpLoss, junkIndex, play, type State, useSmartExhaust } from "../src/sim.ts";
import { planTurn } from "../src/search.ts";

const card = (id: string, type: string, target: string, vars: Record<string, number>, cost = 1): Card => ({
  id, cost, costsX: false, type, target, keywords: [], vars, upgrades: 0, locked: false, glows: false,
});
const STRIKE = card("STRIKE_IRONCLAD", "Attack", "AnyEnemy", { Damage: 6 });
const BASH = card("BASH", "Attack", "AnyEnemy", { Damage: 8, VulnerablePower: 2 }, 2);

function foe(hp: number, attack = 0): Enemy {
  return {
    id: 1, model: "NIBBIT", hp, maxHp: hp, block: 0, alive: true, powers: {}, weakAtStart: false, startStrength: 0,
    intents: attack ? [{ type: "Attack", damage: attack, hits: 1 }] : [],
  };
}
function state(hand: Card[], e: Enemy = foe(80)): State {
  return {
    player: { hp: 80, maxHp: 80, block: 0, powers: {} },
    energy: 3, hand, draw: [STRIKE, STRIKE, STRIKE], discard: [], exhaust: [], enemies: [e], drawn: 0, exact: true, lostHp: false, exhaustedThisTurn: false, relics: [], played: 0, skills: 0, unmovableUsed: false, potions: [], potionSlots: 3, potionsUsed: 0,
  };
}
const at = (s: State, hand: number) => play(s, { kind: "play", hand, target: 1 });

test("anger puts a copy of itself in the discard pile", () => {
  const after = at(state([card("ANGER", "Attack", "AnyEnemy", { Damage: 6 }, 0)]), 0);
  assert.deepEqual(after.discard.map((c) => c.id), ["ANGER", "ANGER"]);
});

test("vicious is a power, and applying vulnerable under it draws", () => {
  const vicious = card("VICIOUS", "Power", "Self", { Cards: 2 });
  const s = play(state([vicious, BASH]), { kind: "play", hand: 0 });
  assert.equal(s.player.powers["VICIOUS"], 2);
  assert.equal(s.drawn, 0);
  assert.equal(at(s, 0).drawn, 2);
});

test("artifact blocks a debuff and loses a stack", () => {
  const e = foe(60);
  e.powers["ARTIFACT"] = 1;
  const after = at(state([BASH], e), 0);
  assert.equal(after.enemies[0]!.powers["VULNERABLE"], undefined);
  assert.equal(after.enemies[0]!.powers["ARTIFACT"], 0);
});

test("spite hits twice only once the player has lost HP this turn", () => {
  const spite = card("SPITE", "Attack", "AnyEnemy", { Damage: 5, Repeat: 2 }, 0);
  assert.equal(at(state([spite]), 0).enemies[0]!.hp, 75);
  const hurt = state([spite]);
  hurt.lostHp = true;
  assert.equal(at(hurt, 0).enemies[0]!.hp, 70);
});

test("mangle's strength loss comes off the enemy's attack this turn", () => {
  const mangle = card("MANGLE", "Attack", "AnyEnemy", { Damage: 20, StrengthLoss: 10 }, 3);
  const after = at(state([mangle], foe(80, 14)), 0);
  assert.equal(after.enemies[0]!.powers["STRENGTH"], -10);
  assert.equal(hpLoss(after), 4);
});

test("constrict hits at the end of the turn, into block like an attack", () => {
  const s = state([], foe(40, 7));
  s.player.block = 6;
  s.player.powers["CONSTRICT"] = 6;
  assert.equal(hpLoss(s), 7);
});

test("killing the shrinker beetle takes its shrink away", () => {
  const beetle = foe(3);
  beetle.model = "SHRINKER_BEETLE";
  const s = state([STRIKE], beetle);
  s.player.powers["SHRINK"] = -1;
  assert.equal(at(s, 0).player.powers["SHRINK"], undefined);
});

test("stoke exhausts the rest of the hand and draws as many", () => {
  const stoke = card("STOKE", "Skill", "Self", {});
  const after = play(state([stoke, STRIKE, STRIKE]), { kind: "play", hand: 0 });
  assert.equal(after.exhaust.length, 2);
  assert.equal(after.drawn, 2);
});

test("thorns hit the player back for every hit, into block first", () => {
  const toad = foe(100);
  toad.powers["THORNS"] = 5;
  const twin = card("TWIN_STRIKE", "Attack", "AnyEnemy", { Damage: 5 });
  const s = state([twin], toad);
  s.player.block = 3;
  const after = at(s, 0);
  assert.equal(after.player.block, 0);
  assert.equal(after.player.hp, 73);
  assert.equal(after.lostHp, true);
});

test("hard to kill caps what a hit takes", () => {
  const exo = foe(24);
  exo.powers["HARD_TO_KILL"] = 9;
  const s = state([BASH], exo);
  s.player.powers["STRENGTH"] = 3;
  assert.equal(at(s, 0).enemies[0]!.hp, 15);
});

test("second wind exhausts the non-attacks in hand and blocks for each", () => {
  const wind = card("SECOND_WIND", "Skill", "Self", { Block: 5 });
  const defend = card("DEFEND_IRONCLAD", "Skill", "Self", { Block: 5 });
  const after = play(state([STRIKE, wind, defend, defend]), { kind: "play", hand: 1 });
  assert.equal(after.player.block, 10);
  assert.deepEqual(after.hand.map((c) => c.id), ["STRIKE_IRONCLAD"]);
  assert.equal(after.exhaust.length, 2);
});

test("relax's energy and cards come next turn", () => {
  const relax = { ...card("RELAX", "Skill", "Self", { Block: 16, Cards: 2, Energy: 2 }, 3), keywords: ["Exhaust"] };
  const after = play(state([relax]), { kind: "play", hand: 0 });
  assert.equal(after.energy, 0);
  assert.equal(after.drawn, 0);
  assert.equal(after.player.powers["ENERGY_NEXT_TURN"], 2);
});

test("infection left in hand hurts at the end of the turn", () => {
  const infection = { ...card("INFECTION", "Status", "None", { Damage: 3 }), keywords: ["Unplayable"] };
  const s = state([infection, infection], foe(40, 6));
  s.player.block = 8;
  assert.equal(hpLoss(s), 4);
});

test("strike dummy adds 3 to strikes only", () => {
  const s = state([STRIKE, BASH]);
  s.relics = ["STRIKE_DUMMY"];
  assert.equal(at(s, 0).enemies[0]!.hp, 71);
  assert.equal(at(s, 1).enemies[0]!.hp, 72);
});

test("feel no pain blocks when a card is exhausted, and juggernaut hits back when block comes", () => {
  const s = state([{ ...card("TREMBLE", "Skill", "AnyEnemy", { VulnerablePower: 3 }), keywords: ["Exhaust"] }], foe(40));
  s.player.powers["FEEL_NO_PAIN"] = 3;
  s.player.powers["JUGGERNAUT"] = 6;
  const after = at(s, 0);
  assert.equal(after.player.block, 3);
  assert.equal(after.enemies[0]!.hp, 34);
  assert.equal(after.exact, true);
});

test("tender takes strength and dexterity after each card, not before it", () => {
  const s = state([STRIKE, STRIKE]);
  s.player.powers["TENDER"] = 1;
  const once = at(s, 0);
  assert.equal(once.enemies[0]!.hp, 74);
  assert.equal(once.player.powers["STRENGTH"], -1);
  assert.equal(once.player.powers["DEXTERITY"], -1);
  assert.equal(at(once, 0).enemies[0]!.hp, 69);
});

test("burrowed goes when the block is broken", () => {
  const tunneler = foe(23);
  tunneler.block = 1;
  tunneler.powers["BURROWED"] = 1;
  assert.equal(at(state([STRIKE], tunneler), 0).enemies[0]!.powers["BURROWED"], undefined);
});

test("an enchanted card plays with its enchanted numbers", () => {
  const s = state([{ ...STRIKE, vars: { Damage: 9 }, enchantment: "SHARP" }]);
  assert.equal(at(s, 0).enemies[0]!.hp, 71);
});

test("strike dummy counts for strikes with rules of their own", () => {
  const s = state([card("TWIN_STRIKE", "Attack", "AnyEnemy", { Damage: 5 })]);
  s.relics = ["STRIKE_DUMMY"];
  assert.equal(at(s, 0).enemies[0]!.hp, 64);
});

test("flutter halves attacks on it and loses a stack a hit", () => {
  const hopper = foe(30);
  hopper.powers["FLUTTER"] = 5;
  const s = state([STRIKE], hopper);
  s.player.powers["STRENGTH"] = 3;
  const after = at(s, 0);
  assert.equal(after.enemies[0]!.hp, 26);
  assert.equal(after.enemies[0]!.powers["FLUTTER"], 4);
});

test("thrash exhausts an attack from hand and leaves skills alone", () => {
  const thrash = card("THRASH", "Attack", "AnyEnemy", { Damage: 4 });
  const tremble = card("TREMBLE", "Skill", "AnyEnemy", { VulnerablePower: 3 });
  assert.equal(at(state([thrash, tremble]), 0).exhaust.length, 0);
  assert.equal(at(state([thrash, STRIKE]), 0).exhaust.length, 1);
});

test("daughter of the wind blocks 1 for every attack", () => {
  const s = state([STRIKE]);
  s.relics = ["DAUGHTER_OF_THE_WIND"];
  assert.equal(at(s, 0).player.block, 1);
});

test("a corrupted card costs its player HP when played", () => {
  const s = state([{ ...STRIKE, enchantment: "CORRUPTED", enchantmentVars: { _damageAmount: 2 } }]);
  s.player.block = 6;
  const after = at(s, 0);
  assert.equal(after.player.hp, 78);
  assert.equal(after.player.block, 6);
  assert.equal(after.lostHp, true);
});

test("slow adds 10% for every card played this turn", () => {
  const effigy = foe(82);
  effigy.powers["SLOW"] = 1;
  effigy.powers["VULNERABLE"] = 1;
  // As seen on seed 11: two cards played, 82 HP, Vulnerable — 6 x 1.5 x 1.2 = 10.8, and it took 10.
  effigy.powerVars = { SLOW: { SlowAmount: 2 } };
  const s = state([STRIKE, STRIKE], effigy);
  const once = at(s, 0);
  assert.equal(once.enemies[0]!.hp, 72);
  assert.equal(at(once, 0).enemies[0]!.hp, 61);
});

test("minions go when only minions are left", () => {
  const leader = foe(5);
  const eye = { ...foe(2), id: 2, powers: { MINION: 1 } };
  const s = state([STRIKE], leader);
  s.enemies.push(eye);
  const after = at(s, 0);
  assert.equal(after.enemies.every((e) => !e.alive), true);
});

test("curl up blocks once the card that hurt it is done", () => {
  const louse = foe(136);
  louse.powers["CURL_UP"] = 14;
  const twin = card("TWIN_STRIKE", "Attack", "AnyEnemy", { Damage: 5 });
  const after = at(state([twin], louse), 0);
  assert.equal(after.enemies[0]!.hp, 126);
  assert.equal(after.enemies[0]!.block, 14);
  assert.equal(after.enemies[0]!.powers["CURL_UP"], undefined);
});

test("unrelenting makes the next attack free, and only the next", () => {
  const unrelenting = card("UNRELENTING", "Attack", "AnyEnemy", { Damage: 14 }, 2);
  const s = state([unrelenting, STRIKE, STRIKE]);
  s.energy = 2;
  const after = at(s, 0);
  assert.equal(after.energy, 0);
  const free = at(after, 0);
  assert.equal(free.energy, 0);
  assert.equal(free.player.powers["FREE_ATTACK"], 0);
  assert.equal(free.hand.length, 1);
});

test("tuning fork blocks on the tenth skill, counting the ones before this fight", () => {
  const defend = card("DEFEND_IRONCLAD", "Skill", "Self", { Block: 5 });
  const s = state([defend, defend]);
  s.relics = ["TUNING_FORK"];
  s.relicVars = { TUNING_FORK: { Cards: 10, Block: 7, _skillsPlayed: 8 } };
  const ninth = play(s, { kind: "play", hand: 0 });
  assert.equal(ninth.player.block, 5);
  assert.equal(play(ninth, { kind: "play", hand: 0 }).player.block, 17);
});

test("fiend fire exhausts the rest of the hand and hits once for each", () => {
  const fire = { ...card("FIEND_FIRE", "Attack", "AnyEnemy", { Damage: 7 }, 2), keywords: ["Exhaust"] };
  const wound = { ...card("WOUND", "Status", "None", {}), keywords: ["Unplayable"] };
  const after = at(state([fire, wound, wound, STRIKE]), 0);
  assert.equal(after.enemies[0]!.hp, 59);
  assert.equal(after.exhaust.length, 4);
  assert.equal(after.hand.length, 0);
});

test("unmovable doubles the first block a card gives each turn, and only that", () => {
  const defend = card("DEFEND_IRONCLAD", "Skill", "Self", { Block: 5 });
  const s = state([defend, defend]);
  s.player.powers["UNMOVABLE"] = 1;
  const once = play(s, { kind: "play", hand: 0 });
  assert.equal(once.player.block, 10);
  assert.equal(play(once, { kind: "play", hand: 0 }).player.block, 15);
});

test("vigor goes into the next attack and is spent", () => {
  const s = state([STRIKE, STRIKE]);
  s.player.powers["VIGOR"] = 8;
  const once = at(s, 0);
  assert.equal(once.enemies[0]!.hp, 66);
  assert.equal(once.player.powers["VIGOR"], undefined);
  assert.equal(at(once, 0).enemies[0]!.hp, 60);
});

test("gremlin horn gives energy and a card for a kill", () => {
  const s = state([STRIKE], foe(5));
  s.relics = ["GREMLIN_HORN"];
  s.energy = 1;
  const after = at(s, 0);
  assert.equal(after.energy, 1);
  assert.equal(after.drawn, 1);
});

test("stoke makes its new cards without touching the piles", () => {
  const stoke = card("STOKE", "Skill", "Self", {});
  const s = state([stoke, STRIKE, STRIKE]);
  s.draw = [];
  s.discard = [STRIKE, STRIKE, STRIKE];
  const after = play(s, { kind: "play", hand: 0 });
  assert.equal(after.drawn, 2);
  assert.equal(after.discard.length, 4);
});

test("potions: a thrown one hits the target it is thrown at, a drunk one works on the player", () => {
  const s = state([], foe(40));
  s.potions = [
    { slot: 0, id: "FIRE_POTION", target: "AnyEnemy", usage: "CombatOnly", vars: { Damage: 20 } },
    { slot: 1, id: "STRENGTH_POTION", target: "Self", usage: "CombatOnly", vars: { StrengthPower: 2 } },
    { slot: 2, id: "WEAK_POTION", target: "AnyEnemy", usage: "CombatOnly", vars: { WeakPower: 3 } },
  ];
  const acts = actions(s).filter((a) => a.kind === "potion");
  assert.deepEqual(acts, [{ kind: "potion", slot: 0, target: 1 }, { kind: "potion", slot: 1 }, { kind: "potion", slot: 2, target: 1 }]);
  const fire = drink(s, { kind: "potion", slot: 0, target: 1 });
  assert.equal(fire.enemies[0]!.hp, 20);
  assert.equal(fire.potions.length, 2);
  assert.equal(drink(s, { kind: "potion", slot: 1 }).player.powers["STRENGTH"], 2);
  const weak = drink(s, { kind: "potion", slot: 2, target: 1 });
  assert.equal(weak.enemies[0]!.powers["WEAK"], 3);
  assert.equal(weak.player.powers["WEAK"], undefined);
});

test("a potion is drunk when it saves the fight, and kept when it only saves a little", () => {
  const s = state([], foe(10, 30));
  s.player.hp = 20;
  s.potions = [{ slot: 0, id: "BLOCK_POTION", target: "Self", usage: "CombatOnly", vars: { Block: 12 } }];
  assert.equal(planTurn(s).actions[0]!.kind, "potion");
  const calm = state([], foe(10, 4));
  calm.potions = s.potions;
  assert.equal(planTurn(calm).actions[0]!.kind, "end");
});

test("dark embrace draws for every card exhausted; rupture turns a card's HP cost into strength", () => {
  const s = state([{ ...card("TREMBLE", "Skill", "AnyEnemy", { VulnerablePower: 3 }), keywords: ["Exhaust"] }]);
  s.player.powers["DARK_EMBRACE"] = 1;
  assert.equal(at(s, 0).drawn, 1);
  const r = state([card("HEMOKINESIS", "Attack", "AnyEnemy", { HpLoss: 2, Damage: 15 })]);
  r.player.powers["RUPTURE"] = 1;
  const after = at(r, 0);
  assert.equal(after.player.hp, 78);
  assert.equal(after.player.powers["STRENGTH"], 1);
});

test("an exhaust from hand never takes a Frantic Escape while anything else is there", () => {
  const cards = [
    { id: "STRIKE_IRONCLAD", type: "Attack" },
    { id: "FRANTIC_ESCAPE", type: "Status" },
    { id: "DEFEND_IRONCLAD", type: "Skill" },
  ];
  assert.equal(junkIndex(cards), 2);
  assert.equal(junkIndex([...cards, { id: "WOUND", type: "Status" }]), 3);
  assert.equal(junkIndex([{ id: "FRANTIC_ESCAPE", type: "Status" }]), 0);
});

test("exhaust2: with no status in hand, a Strike goes first, then a Defend", () => {
  const hand = [{ id: "BASH", type: "Attack" }, { id: "DEFEND_IRONCLAD", type: "Skill" }, { id: "STRIKE_IRONCLAD", type: "Attack" }, { id: "OFFERING", type: "Skill" }];
  assert.equal(junkIndex(hand), 3);
  useSmartExhaust(true);
  try {
    assert.equal(junkIndex(hand), 2);
    assert.equal(junkIndex(hand.filter((c) => c.id !== "STRIKE_IRONCLAD")), 1);
    assert.equal(junkIndex([...hand, { id: "WOUND", type: "Status" }]), 4);
  } finally {
    useSmartExhaust(false);
  }
});
