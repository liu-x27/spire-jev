// HP lost per fight: the step that wins a fight counts too, its heals for winning undone.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { StepResult } from "../src/bridge.ts";
import type { Observation } from "../src/obs.ts";
import { fight, type FightLog, hpBeforeWinHeals } from "../src/run-fights.ts";

const BLOOD = { relics: ["BURNING_BLOOD"], relic_vars: { BURNING_BLOOD: { Heal: 6 } } };

test("a won fight's HP before Burning Blood: JEV00675's Waterfall Giant ended on 25, shown as 31", () => {
  assert.equal(hpBeforeWinHeals({ player_max_hp: 86, ...BLOOD }, { player_hp: 31, player_max_hp: 86 }, 0), 25);
  assert.equal(hpBeforeWinHeals({ player_max_hp: 86, relics: [], relic_vars: {} }, { player_hp: 31, player_max_hp: 86 }, 0), 31);
});

test("a heal cut short by max HP: the guess picks among the HPs that heal to it", () => {
  const at = (guess: number) => hpBeforeWinHeals({ player_max_hp: 80, ...BLOOD }, { player_hp: 80, player_max_hp: 80 }, guess);
  assert.equal(at(80), 80);
  assert.equal(at(77), 77);
  // Nothing under 74 heals to 80.
  assert.equal(at(60), 74);
});

test("Meat on the Bone heals at or under half HP, before Burning Blood; Chosen Cheese's max HP heals as much", () => {
  const meat = { player_max_hp: 80, relics: ["BURNING_BLOOD", "MEAT_ON_THE_BONE"], relic_vars: { BURNING_BLOOD: { Heal: 6 }, MEAT_ON_THE_BONE: { Heal: 12, HpThreshold: 50 } } };
  // 40 is half of 80: 40 + 12 + 6.
  assert.equal(hpBeforeWinHeals(meat, { player_hp: 58, player_max_hp: 80 }, 0), 40);
  // 52 is 34 + 12 + 6 and 46 + 6: the one nearer the guess.
  assert.equal(hpBeforeWinHeals(meat, { player_hp: 52, player_max_hp: 80 }, 45), 46);
  assert.equal(hpBeforeWinHeals(meat, { player_hp: 52, player_max_hp: 80 }, 30), 34);
  const cheese = { player_max_hp: 80, relics: ["BURNING_BLOOD", "CHOSEN_CHEESE"], relic_vars: { BURNING_BLOOD: { Heal: 6 }, CHOSEN_CHEESE: { MaxHp: 1 } } };
  assert.equal(hpBeforeWinHeals(cheese, { player_hp: 32, player_max_hp: 81 }, 0), 25);
});

test("a heal that did not happen: the screen is taken as it is", () => {
  assert.equal(hpBeforeWinHeals({ player_max_hp: 80, ...BLOOD }, { player_hp: 3, player_max_hp: 80 }, 3), 3);
});

// JEV00675 at A0, floor 17, by its recording's HP: 65 into turn 10, 62 into turn 11, 62 into turn 12
// with the Giant "dead" (999999999 HP, stunned), 62 to 25 at the end of turn 12 as it dies, and the
// rewards screen at 31 (Burning Blood's 6). The game's run history: 53 taken, 13 before turn 10.
// The hands and intents are left out: the accounting reads HP.
function screen(hp: number, turn: number, giant: { hp: number; intent: { type: string; damage: number; hits: number } }): StepResult {
  const observation: Observation = {
    phase: "combat", is_terminal: false, is_victory: false, seed: "JEV00675", act: 1, floor: 17, gold: 363,
    player_hp: hp, player_max_hp: 86, player_block: 0, player_energy: 3, player_powers: {},
    deck_cards: [], potions: [], room: null, ...BLOOD,
    combat: {
      turn, hand: [], draw_pile: [], discard_pile: [], exhaust_pile: [], draw_pile_count: 0, discard_pile_count: 0, exhaust_pile_count: 0, max_energy: 3,
      enemies: [{ combat_id: 1, model_id: "WATERFALL_GIANT", hp: giant.hp, max_hp: 220, block: 0, is_alive: true, intent: giant.intent.type, intents: [giant.intent], powers: { STEAM_ERUPTION: 37 } }],
    },
  };
  return { observation, legal_actions: [{ action_id: "end_turn", action_type: "end_turn", description: "" }] };
}

test("a fight won in the enemies' turn counts that turn: the Giant's DeathBlow as it dies", async () => {
  const rewards: StepResult = {
    observation: { ...screen(31, 12, { hp: 0, intent: { type: "Unknown", damage: 0, hits: 0 } }).observation, phase: "rewards", combat: null },
    legal_actions: [{ action_id: "proceed", action_type: "proceed", description: "" }],
  };
  const screens = [
    screen(62, 11, { hp: 11, intent: { type: "Attack", damage: 0, hits: 1 } }),
    screen(62, 12, { hp: 999999996, intent: { type: "DeathBlow", damage: 37, hits: 1 } }),
    rewards,
  ];
  const game = { step: async () => screens.shift()! };
  const logs: FightLog[] = [];
  const { log } = await fight(game, screen(65, 10, { hp: 45, intent: { type: "Attack", damage: 3, hits: 1 } }), "planner", "JEV00675", logs);
  assert.equal(screens.length, 0);
  assert.equal(log.won, true);
  assert.equal(log.hpEnd, 31);
  // 3 on turn 10, 37 on turn 12 (the old count stopped at 3): with the 13 before turn 10, the game's 53.
  assert.equal(log.hpLost, 40);
  assert.equal(log.hpLostWinning, 37);
});
