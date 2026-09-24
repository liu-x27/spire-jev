import assert from "node:assert/strict";
import { test } from "node:test";
import { cardValue, chooseCardReward, chooseCardSelectFor, chooseEvent, chooseMap, chooseRest, chooseShop, chooseUpgrade, healCarried, setFlags, worstCard } from "../src/choices.ts";
import { relicValue } from "../src/relics.ts";
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

test("restbudget: heals mid-act when the heal would last to the boss, not when it would overflow", () => {
  const legal = [act("choose_rest:HEAL"), act("choose_rest:SMITH")];
  const a10 = (hp: number, floor: number) => obs({ player_hp: hp, player_max_hp: 87, floor, ascension: 10 });
  // A10 seed 26: smithed at 59/87 on floor 11 and came to floor 16 at 34.
  assert.ok(healCarried(a10(59, 11)) >= 20);
  assert.ok(healCarried(a10(82, 7)) <= 5);
  assert.equal(chooseRest(a10(59, 11), legal), "choose_rest:SMITH");
  setFlags(["restbudget"]);
  try {
    assert.equal(chooseRest(a10(59, 11), legal), "choose_rest:HEAL");
    assert.equal(chooseRest(a10(82, 7), legal), "choose_rest:SMITH");
    assert.equal(chooseRest(a10(75, 14), legal), "choose_rest:SMITH");
  } finally {
    setFlags([]);
  }
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

const eventObs = (id: string, options: { key: string; description?: string; kills?: boolean }[], over: Partial<Observation> = {}): Observation =>
  obs({
    phase: "event",
    room: { room_type: "Event", options: [], details: { event_id: id, options: options.map((x, index) => ({ index, text_key: `${id}.pages.INITIAL.options.${x.key}`, title: x.key, description: x.description ?? "", locked: false, proceed: false, kills: x.kills ?? false })) } },
    ...over,
  });
const eventLegal = (n: number) => Array.from({ length: n }, (_, i) => act(`choose_event:${i}`));

test("events: the rule's option by its key, whatever its place", () => {
  assert.equal(chooseEvent(eventObs("BYRDONIS_NEST", [{ key: "TAKE" }, { key: "EAT" }]), eventLegal(2)), "choose_event:1");
  const cheese = [{ key: "GORGE" }, { key: "SEARCH" }];
  assert.equal(chooseEvent(eventObs("ROOM_FULL_OF_CHEESE", cheese, { player_hp: 70 }), eventLegal(2)), "choose_event:1");
  assert.equal(chooseEvent(eventObs("ROOM_FULL_OF_CHEESE", cheese, { player_hp: 45 }), eventLegal(2)), "choose_event:0");
});

test("an event with no rule never takes the option that kills", () => {
  assert.equal(chooseEvent(eventObs("SOMETHING_NEW", [{ key: "JUMP", kills: true }, { key: "WALK" }]), eventLegal(2)), "choose_event:1");
});

test("the card select after an enchant takes a good card; after a transform, a bad one", () => {
  const select = [act("choose_card_select:0:STRIKE_IRONCLAD"), act("choose_card_select:1:POMMEL_STRIKE")];
  chooseEvent(eventObs("SELF_HELP_BOOK", [{ key: "READ_THE_BACK", description: "选择一张攻击牌附魔：锋利2。" }]), eventLegal(1));
  assert.equal(chooseCardSelectFor(obs(), select), "choose_card_select:1:POMMEL_STRIKE");
  chooseEvent(eventObs("SYMBIOTE", [{ key: "KILL_WITH_FIRE", description: "选择一张牌变化。" }]), eventLegal(1));
  assert.equal(chooseCardSelectFor(obs(), select), "choose_card_select:0:STRIKE_IRONCLAD");
});

test("the map: a rest site when hurt, a shop with gold, an elite only when healthy", () => {
  const legal = [act("choose_map:1:Monster"), act("choose_map:2:Elite"), act("choose_map:3:RestSite"), act("choose_map:4:Shop")];
  assert.equal(chooseMap(obs({ player_hp: 30, floor: 8 }), legal), "choose_map:3:RestSite");
  assert.equal(chooseMap(obs({ player_hp: 70, gold: 200, floor: 8 }), legal), "choose_map:4:Shop");
  assert.equal(chooseMap(obs({ player_hp: 75, gold: 50, floor: 8 }), legal), "choose_map:2:Elite");
  assert.equal(chooseMap(obs({ player_hp: 55, gold: 50, floor: 8 }), [act("choose_map:1:Monster"), act("choose_map:2:Elite")]), "choose_map:1:Monster");
});

test("the map looks beyond the next node: hurt, the way with fewer fights before a rest site", () => {
  const legal = [act("choose_map:1:Monster"), act("choose_map:2:Monster")];
  const room = { room_type: "Map", options: [], details: { lookahead: [{ RestSite: 4, fights_to_rest_min: 3 }, { RestSite: 2, fights_to_rest_min: 1 }] } };
  assert.equal(chooseMap(obs({ player_hp: 30, room }), legal), "choose_map:2:Monster");
});

test("removals: Burning Pact is not a burn, and a Tremble held is not the worst card", () => {
  const deck = [...STARTER, "BURNING_PACT", "TREMBLE", "TREMBLE"];
  assert.equal(worstCard(["BURNING_PACT", "STRIKE_IRONCLAD"], deck), 1);
  assert.equal(worstCard(["TREMBLE", "DEFEND_IRONCLAD"], deck), 1);
  assert.equal(worstCard(["BURN", "STRIKE_IRONCLAD"], deck), 0);
  assert.equal(worstCard(["SOMETHING_NEW", "STRIKE_IRONCLAD"], deck, ["Curse", "Attack"]), 0);
});

test("relicvalue: the relic worth most at its price, not the cheapest; Dingy Rug never", () => {
  assert.ok((relicValue("PANTOGRAPH") ?? 0) > (relicValue("DINGY_RUG") ?? 1));
  const shopItem = (i: number, id: string, price: number) =>
    act(`shop_buy:${i}:${id}`, { entry_type: "MerchantRelicEntry", item_id: id, price, stocked: true, affordable: true });
  const legal = [shopItem(0, "DINGY_RUG", 150), shopItem(1, "STRIKE_DUMMY", 160), shopItem(2, "PANTOGRAPH", 190), act("shop_leave")];
  const rich = obs({ phase: "shop", gold: 400, deck_cards: ["BASH", "OFFERING"] });
  assert.equal(chooseShop(rich, legal), "shop_buy:0:DINGY_RUG");
  setFlags(["relicvalue"]);
  try {
    assert.equal(chooseShop(rich, legal), "shop_buy:2:PANTOGRAPH");
    assert.equal(chooseShop(rich, [shopItem(0, "DINGY_RUG", 150), act("shop_leave")]), "shop_leave");
  } finally {
    setFlags([]);
  }
});

test("shop2: an affordable Inflame for a deck with no damage scaling comes before the removal", () => {
  const shopItem = (i: number, entry: string, id: string, price: number) =>
    act(`shop_buy:${i}:${id}`, { entry_type: entry, item_id: id, price, stocked: true, affordable: true });
  const legal = [shopItem(0, "MerchantCardEntry", "INFLAME", 38), shopItem(1, "MerchantCardRemovalEntry", "REMOVAL", 150), act("shop_leave")];
  const o = obs({ phase: "shop", act: 2, floor: 24, gold: 200, deck_cards: [...STARTER, "POMMEL_STRIKE", "ANGER"] });
  assert.equal(chooseShop(o, legal), "shop_buy:1:REMOVAL");
  setFlags(["shop2", "packages2"]);
  try {
    assert.equal(chooseShop(o, legal), "shop_buy:0:INFLAME");
  } finally {
    setFlags([]);
  }
});

test("smith2: winners' upgrade order, and a smith before the act 2 boss unless under half HP", () => {
  const legal = [act("choose_upgrade:0:POMMEL_STRIKE"), act("choose_upgrade:1:ARMAMENTS"), act("choose_upgrade:2:STRIKE_IRONCLAD")];
  const rest = [act("choose_rest:HEAL"), act("choose_rest:SMITH")];
  setFlags(["smith2"]);
  try {
    assert.equal(chooseUpgrade(obs({ phase: "deck_upgrade" }), legal), "choose_upgrade:1:ARMAMENTS");
    assert.equal(chooseRest(obs({ floor: 32, act: 2, player_hp: 50, player_max_hp: 80 }), rest), "choose_rest:SMITH");
    assert.equal(chooseRest(obs({ floor: 32, act: 2, player_hp: 35, player_max_hp: 80 }), rest), "choose_rest:HEAL");
    assert.equal(chooseRest(obs({ floor: 16, act: 1, player_hp: 60, player_max_hp: 80 }), rest), "choose_rest:HEAL");
    assert.equal(chooseRest(obs({ floor: 11, act: 1, player_hp: 40, player_max_hp: 80 }), rest), "choose_rest:SMITH");
  } finally {
    setFlags([]);
  }
});
