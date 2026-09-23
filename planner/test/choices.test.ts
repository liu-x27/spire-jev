import assert from "node:assert/strict";
import { test } from "node:test";
import { cardValue, chooseCardReward, chooseRest, chooseShop, chooseUpgrade, worstCard } from "../src/choices.ts";
import type { LegalAction, Observation } from "../src/obs.ts";

const STARTER = [...Array(5).fill("STRIKE_IRONCLAD"), ...Array(4).fill("DEFEND_IRONCLAD"), "BASH"];
function obs(over: Partial<Observation> = {}): Observation {
  return {
    phase: "card_reward", is_terminal: false, is_victory: false, seed: "T", act: 1, floor: 3, gold: 100,
    player_hp: 70, player_max_hp: 80, player_block: 0, player_energy: 3, player_powers: {},
    deck_cards: STARTER, relics: [], potions: [], combat: null, room: null, ...over,
  };
}
const act = (id: string, metadata?: Record<string, unknown>): LegalAction => ({ action_id: id, action_type: id.split(":")[0]!, description: "", ...(metadata ? { metadata } : {}) });

test("offering over everything; havoc never", () => {
  assert.ok(cardValue("OFFERING", 0, STARTER) > cardValue("POMMEL_STRIKE", 0, STARTER));
  assert.ok(cardValue("HAVOC", 0, STARTER) < 0);
});

test("frontload cards lose their value after act 1, engines keep theirs", () => {
  assert.ok(cardValue("ANGER", 0, STARTER) > cardValue("ANGER", 1, STARTER));
  assert.ok(cardValue("FEEL_NO_PAIN", 2, STARTER) >= cardValue("FEEL_NO_PAIN", 0, STARTER) - 0.05);
});

test("a reward of weak cards is skipped in act 3 and taken in act 1", () => {
  const legal = [act("choose_card:0:IRON_WAVE", { card_id: "IRON_WAVE" }), act("choose_card:1:THUNDERCLAP", { card_id: "THUNDERCLAP" }), act("skip_card")];
  assert.equal(chooseCardReward(obs({ act: 3 }), legal), "skip_card");
  assert.notEqual(chooseCardReward(obs({ act: 1 }), legal), "skip_card");
});

test("rest when low, smith when healthy, rest before the boss unless near full", () => {
  const legal = [act("choose_rest:HEAL"), act("choose_rest:SMITH")];
  assert.equal(chooseRest(obs({ player_hp: 30, player_max_hp: 80 }), legal), "choose_rest:HEAL");
  assert.equal(chooseRest(obs({ player_hp: 60, player_max_hp: 80 }), legal), "choose_rest:SMITH");
  assert.equal(chooseRest(obs({ player_hp: 48, player_max_hp: 80, floor: 16 }), legal), "choose_rest:HEAL");
});

test("upgrades a card whose upgrade changes it before a strike", () => {
  const legal = [act("choose_upgrade:0:STRIKE_IRONCLAD"), act("choose_upgrade:1:BODY_SLAM"), act("choose_upgrade:2:BASH")];
  assert.equal(chooseUpgrade(obs(), legal), "choose_upgrade:1:BODY_SLAM");
});

test("a removal takes a curse first, then a strike while the deck is short on block", () => {
  assert.equal(worstCard(["BASH", "STRIKE_IRONCLAD", "CLUMSY"], STARTER), 2);
  assert.equal(worstCard(["DEFEND_IRONCLAD", "STRIKE_IRONCLAD"], STARTER), 1);
  assert.equal(worstCard(["DEFEND_IRONCLAD", "STRIKE_IRONCLAD"], [...STARTER, "SHRUG_IT_OFF", "TAUNT", "FLAME_BARRIER"]), 0);
});

test("the shop buys the removal before an ordinary card, and an S-tier card before the removal", () => {
  const removal = act("shop_buy:9:CardRemoval", { entry_type: "MerchantCardRemovalEntry", item_id: "MerchantCardRemovalEntry", price: 75, stocked: true, affordable: true });
  const twin = act("shop_buy:0:Card", { entry_type: "MerchantCardEntry", item_id: "TWIN_STRIKE", price: 50, stocked: true, affordable: true });
  const offering = act("shop_buy:1:Card", { entry_type: "MerchantCardEntry", item_id: "OFFERING", price: 150, stocked: true, affordable: true });
  assert.equal(chooseShop(obs({ phase: "shop" }), [twin, removal, act("shop_leave")]), removal.action_id);
  assert.equal(chooseShop(obs({ phase: "shop", gold: 200 }), [twin, removal, offering, act("shop_leave")]), offering.action_id);
  assert.equal(chooseShop(obs({ phase: "shop", deck_cards: ["BASH"] }), [twin, removal, act("shop_leave")]), "shop_leave");
});
