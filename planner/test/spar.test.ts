// spar3 (astra-review-4 #1): the bout is played with the run's own player, cards and boss, and says
// so when it cannot be.
import assert from "node:assert/strict";
import { test } from "node:test";
import { setIntentAscension } from "../src/intents.ts";
import { BARE, BOSSES, bout, cardFromId, learnCard, modelledBoss, pairScore, sparScore, unknownCards } from "../src/spar.ts";
import { seeded } from "../src/turn.ts";
import { chooseCardReward, chooseRest, chooseSelect, chooseShop, chooseUpgrade, setActBoss, setFlags } from "../src/choices.ts";
import type { CardObs, LegalAction, Observation } from "../src/obs.ts";

const STARTER = [...Array(5).fill("STRIKE_IRONCLAD"), ...Array(4).fill("DEFEND_IRONCLAD"), "BASH"];
setIntentAscension(10);

test("a bout with a fourth energy and the relics' Strength does better than the bare Ironclad", () => {
  const vantom = BOSSES["VANTOM"]!;
  const bare = sparScore(STARTER, vantom, 16, 3);
  const strong = sparScore(STARTER, vantom, 16, 3, { ...BARE, energy: 4, maxEnergy: 4, powers: { STRENGTH: 2 } });
  assert.ok(strong > bare + 10, `${strong} vs ${bare}`);
});

test("more HP to lose is more HP kept: a 100-HP Ironclad loses less of the score", () => {
  // The Insatiable without its opening move, so without its Sandpit (which devours a starter deck
  // whatever its HP): the player's HP is what the bout is about.
  const noPit = { model: "THE_INSATIABLE", hp: 341, powers: {} };
  const bare = sparScore(STARTER, noPit, 16, 3);
  const big = sparScore(STARTER, noPit, 16, 3, { ...BARE, hp: 110, maxHp: 110 });
  assert.ok(big > bare, `${big} vs ${bare}`);
});

test("a potion the bout's plan drinks is drunk, not the turn's end", () => {
  const beast = BOSSES["CEREMONIAL_BEAST"]!;
  const bomb = { slot: 0, id: "FIRE_POTION", target: "AnyEnemy", usage: "CombatOnly", vars: { Damage: 999 } };
  const r = bout(STARTER.map(cardFromId).filter((c) => c !== undefined), beast, seeded(1), 8, { ...BARE, potions: [bomb], potionSlots: 3 });
  assert.equal(r.won, true);
  assert.equal(r.turns, 1);
});

test("the Matriarch starts a bout asleep as a fight's observation has her, for the sleep rule", () => {
  let first: { asleep?: { turns: number; hp: number } } | undefined;
  bout(STARTER.map(cardFromId).filter((c) => c !== undefined), BOSSES["LAGAVULIN_MATRIARCH"]!, seeded(1), 1, BARE, (_end, _full, start) => {
    first ??= start.enemies[0];
  });
  assert.deepEqual(first?.asleep, { turns: 3, hp: 233 });
});

test("a boss spar has no model of is no boss, not another act's", () => {
  assert.equal(modelledBoss("NOT_A_BOSS_BOSS"), undefined);
  assert.equal(modelledBoss("WATERFALL_GIANT_BOSS")?.model, "WATERFALL_GIANT");
});

test("a card is known once the run has shown it", () => {
  assert.deepEqual(unknownCards(["STRIKE_IRONCLAD", "NO_SUCH_CARD+"]), ["NO_SUCH_CARD+"]);
  const described: Omit<CardObs, "index" | "can_play"> = {
    card_id: "NO_SUCH_CARD", cost: 1, current_cost: 1, costs_x: false, target_type: "AnyEnemy", upgrades: 1,
    keywords: [], vars: { Damage: 30 }, card_type: "Attack",
  };
  learnCard("NO_SUCH_CARD+", described);
  assert.deepEqual(unknownCards(["NO_SUCH_CARD+"]), []);
});

function reward(boss: string): Observation {
  return {
    phase: "card_reward", is_terminal: false, is_victory: false, seed: "T", act: 0, floor: 3, gold: 100, act_boss: boss,
    player_hp: 70, player_max_hp: 80, player_block: 0, player_energy: 3, player_powers: {},
    deck_cards: STARTER, relics: [], potions: [], combat: null, room: null,
  };
}
const act = (id: string, metadata?: Record<string, unknown>): LegalAction => ({ action_id: id, action_type: id.split(":")[0]!, description: "", ...(metadata ? { metadata } : {}) });

test("spar3: an unmodelled boss or an unseen card leaves the reward to the rules", () => {
  const legal = [act("choose_card:0:IRON_WAVE", { card_id: "IRON_WAVE", card_index: 0 }), act("choose_card:1:OFFERING", { card_id: "OFFERING", card_index: 1 }), act("skip_card")];
  const unseen = [act("choose_card:0:NEVER_SEEN", { card_id: "NEVER_SEEN", card_index: 0 }), ...legal.slice(1)];
  setFlags([]);
  const rules = chooseCardReward(reward("NOT_A_BOSS_BOSS"), legal);
  const rulesUnseen = chooseCardReward(reward("VANTOM_BOSS"), unseen);
  try {
    setFlags(["spar", "spar3"]);
    setActBoss("NOT_A_BOSS_BOSS");
    assert.equal(chooseCardReward(reward("NOT_A_BOSS_BOSS"), legal), rules);
    setActBoss("VANTOM_BOSS");
    assert.equal(chooseCardReward(reward("VANTOM_BOSS"), unseen), rulesUnseen);
  } finally {
    setFlags([]);
    setActBoss("");
  }
});

test("spar4: before the boss, a low-HP Ironclad heals and a full one smiths, by the bout", () => {
  const legal = [act("choose_rest:0:heal"), act("choose_rest:1:smith")];
  const rest = (hp: number): Observation => ({ ...reward("VANTOM_BOSS"), phase: "rest_site", floor: 16, player_hp: hp });
  try {
    setFlags(["spar", "spar3", "spar4"]);
    setActBoss("VANTOM_BOSS");
    assert.equal(chooseRest(rest(15), legal), "choose_rest:0:heal");
    assert.equal(chooseRest(rest(80), legal), "choose_rest:1:smith");
  } finally {
    setFlags([]);
    setActBoss("");
  }
});

test("spar4: the removal the shop bought is the card the select takes out", () => {
  const deck = [...STARTER, "INJURY"];
  const shop: Observation = { ...reward("VANTOM_BOSS"), phase: "shop", gold: 300, deck_cards: deck };
  const legal = [
    act("shop_buy:0:MerchantCardRemovalEntry", { entry_type: "MerchantCardRemovalEntry", item_id: "CARD_REMOVAL", price: 75, affordable: true, stocked: true }),
    act("shop_leave"),
  ];
  try {
    setFlags(["spar", "spar3", "spar4"]);
    setActBoss("VANTOM_BOSS");
    assert.equal(chooseShop(shop, legal), "shop_buy:0:MerchantCardRemovalEntry");
    const offered = ["STRIKE_IRONCLAD", "DEFEND_IRONCLAD", "BASH", "INJURY"];
    const select: Observation = { ...shop, phase: "card_select", room: { room_type: "CardSelect", options: [], details: { purpose: "FromDeckForRemoval", min: 1, max: 1 } } };
    assert.equal(chooseSelect(select, offered.map((id, i) => act(`choose_card_select:${i}:${id}`))), "choose_card_select:3:INJURY");
  } finally {
    setFlags([]);
    setActBoss("");
  }
});

test("spar4: a smith's offers by what the upgrade adds; one never seen upgraded leaves it to the rules", () => {
  const smith = { ...reward("VANTOM_BOSS"), phase: "card_select" };
  const offers = ["STRIKE_IRONCLAD", "DEFEND_IRONCLAD", "BASH"].map((id, i) => act(`choose_upgrade:${i}:${id}`));
  const unseen = [...offers, act("choose_upgrade:3:NEVER_UPGRADED")];
  setFlags([]);
  const rules = chooseUpgrade({ ...smith, deck_cards: [...STARTER, "NEVER_UPGRADED"] }, unseen);
  try {
    setFlags(["spar", "spar3", "spar4"]);
    setActBoss("VANTOM_BOSS");
    assert.ok(offers.some((a) => a.action_id === chooseUpgrade(smith, offers)));
    assert.equal(chooseUpgrade({ ...smith, deck_cards: [...STARTER, "NEVER_UPGRADED"] }, unseen), rules);
  } finally {
    setFlags([]);
    setActBoss("");
  }
});

test("sparpair: the second boss is fought only after the first is won, on the HP it left", () => {
  const aeonglass = BOSSES["AEONGLASS"]!;
  const subject = BOSSES["TEST_SUBJECT"]!;
  // The starter deck loses to Aeonglass every time: the pair is the first bout alone.
  assert.equal(pairScore(STARTER, aeonglass, subject, 8, 5), sparScore(STARTER, aeonglass, 8, 5));
});

test("spar4's parts are their own flags: the rest's bout alone, and its upgrade is the one smithed", () => {
  const legal = [act("choose_rest:0:heal"), act("choose_rest:1:smith")];
  const at = (hp: number): Observation => ({ ...reward("VANTOM_BOSS"), phase: "rest_site", floor: 16, player_hp: hp });
  const offers = ["STRIKE_IRONCLAD", "DEFEND_IRONCLAD", "BASH"].map((id, i) => act(`choose_upgrade:${i}:${id}`));
  try {
    // spar4up alone leaves the rest to the rules: at 70/80 before the boss, 85% says heal.
    setFlags(["spar", "spar3", "spar4up"]);
    setActBoss("VANTOM_BOSS");
    assert.equal(chooseRest(at(60), legal), "choose_rest:0:heal");
    setFlags(["spar", "spar3", "spar4rest"]);
    assert.equal(chooseRest(at(80), legal), "choose_rest:1:smith");
    const planned = chooseUpgrade(at(80), offers);
    assert.ok(offers.some((a) => a.action_id === planned));
    // Once: the next smith (another floor) is the rules' again.
    setFlags(["spar", "spar3"]);
    const rules = chooseUpgrade({ ...at(80), floor: 20 }, offers);
    assert.equal(chooseUpgrade({ ...at(80), floor: 20 }, offers), rules);
  } finally {
    setFlags([]);
    setActBoss("");
  }
});
