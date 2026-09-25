// Relics that act in a fight, each rule from the game's IL (tools/inspect --il; the relic classes'
// hooks), and the ones that act as it opens, which a spar bout gives the player (relicOpening).
import assert from "node:assert/strict";
import { test } from "node:test";
import { BARE, type Boss, bout, cardFromId, type Player, relicOpening } from "../src/spar.ts";
import { type Card, drink, endOfTurn, type Enemy, play, type State } from "../src/sim.ts";
import { nextTurn, seeded } from "../src/turn.ts";

const card = (id: string, type: string, target: string, vars: Record<string, number>, cost = 1, extra: Partial<Card> = {}): Card => ({
  id, cost, costsX: false, type, target, keywords: [], vars, upgrades: 0, locked: false, glows: false, ...extra,
});
const STRIKE = card("STRIKE_IRONCLAD", "Attack", "AnyEnemy", { Damage: 6 });
const STRIKE_UP = card("STRIKE_IRONCLAD", "Attack", "AnyEnemy", { Damage: 9 }, 1, { upgrades: 1 });
const DEFEND = card("DEFEND_IRONCLAD", "Skill", "Self", { Block: 5 });
const INFLAME = card("INFLAME", "Power", "Self", { StrengthPower: 2 });
const TRUE_GRIT = card("TRUE_GRIT", "Skill", "Self", { Block: 7 }, 1, { keywords: ["Exhaust"] });
const HEMO = card("HEMOKINESIS", "Attack", "AnyEnemy", { Damage: 15, HpLoss: 2 });

function foe(hp: number, id = 1, attack = 0, hits = 1, powers: Record<string, number> = {}): Enemy {
  return {
    id, model: "DUMMY", hp, maxHp: hp, block: 0, alive: true, powers: { ...powers }, weakAtStart: false, startStrength: 0,
    intents: attack ? [{ type: "Attack", damage: attack, hits }] : [{ type: "Buff", damage: 0, hits: 0 }],
  };
}
function state(hand: Card[], relics: string[], over: Partial<State> = {}, enemies: Enemy[] = [foe(80)]): State {
  return {
    player: { hp: 60, maxHp: 80, block: 0, powers: {} },
    energy: 3, hand, draw: Array(8).fill(DEFEND) as Card[], discard: [], exhaust: [], enemies, drawn: 0, exact: true, lostHp: false,
    exhaustedThisTurn: false, relics, played: 0, skills: 0, unmovableUsed: false, potions: [], potionSlots: 3, potionsUsed: 0, turn: 1, ...over,
  };
}
const at = (s: State, hand: number, target?: number) => play(s, { kind: "play", hand, ...(target !== undefined ? { target } : {}) });
const next = (s: State) => nextTurn(s, seeded(1), () => [])!;
const hp = (s: State, i = 0) => s.enemies[i]!.hp;

// ---------------------------------------------------------------- in the fight

test("miniature cannon: an upgraded card's hits 3 more, before Vulnerable", () => {
  const s = state([STRIKE_UP, STRIKE], ["MINIATURE_CANNON"], {}, [foe(80, 1, 0, 1, { VULNERABLE: 1 })]);
  assert.equal(hp(at(s, 0, 1)), 80 - Math.floor((9 + 3) * 1.5));
  assert.equal(hp(at(s, 1, 1)), 80 - 9);
});

test("centennial puzzle: the fight's first damage past block draws 3, once; the enemies' turn's too", () => {
  const s = at(state([HEMO], ["CENTENNIAL_PUZZLE"]), 0, 1);
  assert.equal(s.drawn, 3);
  assert.equal(s.relicVars!["CENTENNIAL_PUZZLE"]!["_usedThisCombat"], 1);
  assert.equal(at({ ...s, hand: [HEMO], energy: 3 }, 0, 1).drawn, 3);
  const hitByEnemy = next(state([], ["CENTENNIAL_PUZZLE"], {}, [foe(80, 1, 10)]));
  assert.equal(hitByEnemy.hand.length, 8);
  assert.equal(hitByEnemy.relicVars!["CENTENNIAL_PUZZLE"]!["_usedThisCombat"], 1);
});

test("red skull: 3 Strength at half HP or under, taken back above", () => {
  const s = at(state([HEMO], ["RED_SKULL"], { player: { hp: 41, maxHp: 80, block: 0, powers: {} } }), 0, 1);
  assert.equal(s.player.powers["STRENGTH"], 3);
  const healed = at({ ...s, hand: [card("NOT_YET", "Skill", "Self", { Heal: 10 }, 0)], energy: 3 }, 0);
  assert.equal(healed.player.powers["STRENGTH"] ?? 0, 0);
});

test("bronze scales: every hit of an enemy's attack costs it the Thorns", () => {
  const s = state([], ["BRONZE_SCALES"], { player: { hp: 60, maxHp: 80, block: 0, powers: { THORNS: 3 } } }, [foe(80, 1, 5, 3)]);
  assert.equal(hp(next(s)), 80 - 9);
});

test("horn cleat: 14 block at turn 2's start", () => {
  assert.equal(next(state([], ["HORN_CLEAT"])).player.block, 14);
  assert.equal(next(next(state([], ["HORN_CLEAT"]))).player.block, 0);
});

test("sparkling rouge: 1 Strength and 1 Dexterity at turn 3's start", () => {
  const t3 = next(next(state([], ["SPARKLING_ROUGE"])));
  assert.deepEqual([t3.player.powers["STRENGTH"], t3.player.powers["DEXTERITY"]], [1, 1]);
});

test("mercury hourglass: 3 to every enemy at each turn's start", () => {
  const n = next(state([], ["MERCURY_HOURGLASS"], {}, [foe(80, 1), foe(50, 2)]));
  assert.deepEqual([hp(n, 0), hp(n, 1)], [77, 47]);
});

test("permafrost: the fight's first power gives 7 block, once", () => {
  const s = at(state([INFLAME, INFLAME], ["PERMAFROST"]), 0);
  assert.equal(s.player.block, 7);
  assert.equal(at(s, 0).player.block, 7);
});

test("vambrace: the fight's first card that gains block, doubled, once", () => {
  const s = at(state([DEFEND, DEFEND], ["VAMBRACE"]), 0);
  assert.equal(s.player.block, 10);
  assert.equal(at(s, 0).player.block, 15);
});

test("joss paper: every 5th card exhausted, counted across fights, draws 1", () => {
  const s = at(state([TRUE_GRIT, DEFEND], ["JOSS_PAPER"], { relicVars: { JOSS_PAPER: { _cardsExhausted: 3 } } }), 0);
  // True Grit exhausts the Defend (the 4th) and then itself (the 5th).
  assert.equal(s.relicVars!["JOSS_PAPER"]!["_cardsExhausted"], 0);
  assert.equal(s.drawn, 1);
});

test("orichalcum: no block at the turn's end, 6", () => {
  assert.equal(endOfTurn(state([], ["ORICHALCUM"])).player.block, 6);
  assert.equal(endOfTurn(at(state([DEFEND], ["ORICHALCUM"]), 0)).player.block, 5);
});

test("ripple basin: no attack this turn, 4 block at its end", () => {
  assert.equal(endOfTurn(at(state([DEFEND], ["RIPPLE_BASIN"]), 0)).player.block, 9);
  assert.equal(endOfTurn(at(state([STRIKE], ["RIPPLE_BASIN"]), 0, 1)).player.block, 0);
});

test("parrying shield: 10 block or more at the turn's end, 6 to an enemy", () => {
  const s = state([DEFEND, DEFEND], ["PARRYING_SHIELD"]);
  assert.equal(hp(endOfTurn(at(at(s, 0), 0))), 74);
  assert.equal(hp(endOfTurn(at(s, 0))), 80);
});

test("self-forming clay: 3 block next turn for every damage past block", () => {
  const s = at(state([HEMO], ["SELF_FORMING_CLAY"]), 0, 1);
  assert.equal(s.player.powers["SELF_FORMING_CLAY"], 3);
  // And the enemies' two hits that got through: 3 + 2 x 3.
  const n = next({ ...s, enemies: [foe(80, 1, 5, 2)] });
  assert.equal(n.player.block, 9);
  assert.equal(n.player.powers["SELF_FORMING_CLAY"], undefined);
});

test("nunchaku: every 10th attack, counted across fights, an energy; the count goes on", () => {
  const s = at(state([STRIKE, STRIKE], ["NUNCHAKU"], { relicVars: { NUNCHAKU: { _attacksPlayed: 9 } } }), 0, 1);
  assert.equal(s.energy, 3);
  assert.equal(next(at(state([STRIKE], ["NUNCHAKU"], { relicVars: { NUNCHAKU: { _attacksPlayed: 5 } } }), 0, 1)).relicVars!["NUNCHAKU"]!["_attacksPlayed"], 6);
});

test("kusarigama: every 3rd attack of the turn, 6 to an enemy", () => {
  const s = at(at(at(state([STRIKE, STRIKE, STRIKE], ["KUSARIGAMA"]), 0, 1), 0, 1), 0, 1);
  assert.equal(hp(s), 80 - 18 - 6);
});

test("letter opener: every 3rd skill of the turn, 5 to every enemy", () => {
  const s = at(at(at(state([DEFEND, DEFEND, DEFEND], ["LETTER_OPENER"], {}, [foe(80, 1), foe(40, 2)]), 0), 0), 0);
  assert.deepEqual([hp(s, 0), hp(s, 1)], [75, 35]);
});

test("paper phrog: the player's attacks on a Vulnerable enemy x1.75", () => {
  const s = state([STRIKE], ["PAPER_PHROG"], { player: { hp: 60, maxHp: 80, block: 0, powers: { PAPER_PHROG: 1 } } }, [foe(80, 1, 0, 1, { VULNERABLE: 1 })]);
  assert.equal(hp(at(s, 0, 1)), 80 - Math.floor(6 * 1.75));
});

test("reptile trinket: a potion gives 3 Strength for the turn", () => {
  const s = drink(state([], ["REPTILE_TRINKET"], { potions: [{ slot: 0, id: "BLOCK_POTION", target: "Self", usage: "CombatOnly", vars: { Block: 12 } }] }), { kind: "potion", slot: 0 });
  assert.equal(s.player.powers["STRENGTH"], 3);
  assert.equal(next(s).player.powers["STRENGTH"] ?? 0, 0);
});

test("pocketwatch: 3 cards or fewer played last turn, 3 more drawn", () => {
  assert.equal(next(at(state([DEFEND], ["POCKETWATCH"]), 0)).hand.length, 8);
  const busy = state([DEFEND, DEFEND, DEFEND, DEFEND], ["POCKETWATCH"], { energy: 4 });
  assert.equal(next(at(at(at(at(busy, 0), 0), 0), 0)).hand.length, 5);
});

test("tuning fork: its skills count goes on into the next turn", () => {
  const s = next(at(state([DEFEND], ["TUNING_FORK"], { relicVars: { TUNING_FORK: { _skillsPlayed: 4, Cards: 10, Block: 7 } } }), 0));
  assert.equal(s.relicVars!["TUNING_FORK"]!["_skillsPlayed"], 5);
});

// ---------------------------------------------------------------- as a fight opens (spar's bouts)

const me = (relics: string[], over: Partial<Player> = {}): Player => ({ ...BARE, relics, ...over });

test("relic opening: block, Strength, Dexterity, Plating, Thorns, Vigor, energy, cards and a heal", () => {
  const o = relicOpening(me(["ANCHOR", "VAJRA", "ODDLY_SMOOTH_STONE", "GORGET", "BRONZE_SCALES", "AKABEKO", "LANTERN", "BAG_OF_PREPARATION", "BLOOD_VIAL"], { hp: 70 }));
  assert.equal(o.block, 10);
  assert.deepEqual(o.powers, { STRENGTH: 1, DEXTERITY: 1, PLATING: 4, THORNS: 3, VIGOR: 8 });
  assert.deepEqual([o.energy, o.hand, o.hp], [4, 7, 72]);
});

test("relic opening: Venerable Tea Set's 2 energy only after a rest site; not twice over spar3's opening", () => {
  assert.equal(relicOpening(me(["VENERABLE_TEA_SET"])).energy, 5);
  assert.equal(relicOpening(me(["VENERABLE_TEA_SET"], { relicVars: { VENERABLE_TEA_SET: { _gainEnergyInNextCombat: 0 } } })).energy, 3);
  const opened = relicOpening(me(["ANCHOR", "PAPER_PHROG"], { opened: true, block: 10 }));
  assert.deepEqual([opened.block, opened.powers["PAPER_PHROG"]], [10, 1]);
});

const dummy: Boss = { model: "DUMMY_BOSS", hp: 200, powers: {} };
const strikes = Array(10).fill(STRIKE) as Card[];

test("festive popper and mercury hourglass: 9 and 3 to every enemy as the fight opens", () => {
  const b = bout(Array(10).fill(card("WOUND", "Status", "None", {}, -1, { keywords: ["Unplayable"] })) as Card[], dummy, seeded(1), 1, me(["FESTIVE_POPPER", "MERCURY_HOURGLASS"]));
  // 9 and 3 as it opens, and the Hourglass's 3 again as turn 2 starts (the bout's one turn ends there).
  assert.equal(b.damage, 15);
});

test("bag of marbles: the enemies Vulnerable on the first turn", () => {
  const plain = bout(strikes, dummy, seeded(1), 1, me([]));
  const marbles = bout(strikes, dummy, seeded(1), 1, me(["BAG_OF_MARBLES"]));
  assert.equal(plain.damage, 18);
  assert.equal(marbles.damage, 27);
});

test("stone cracker: two cards of the deck upgraded for the fight", () => {
  const upgraded = cardFromId("STRIKE_IRONCLAD+");
  if (!upgraded || upgraded.upgrades === 0) return; // the catalogue has no upgraded Strike: nothing to check
  const deck = Array(5).fill(cardFromId("STRIKE_IRONCLAD")!) as Card[];
  const plain = bout(deck, dummy, seeded(1), 1, me([]));
  const cracked = bout(deck, dummy, seeded(1), 1, me(["STONE_CRACKER"]));
  assert.ok(cracked.damage > plain.damage);
});
