import assert from "node:assert/strict";
import { test } from "node:test";
import { packageBonus, profile, useScalingFromAct1 } from "../src/packages.ts";

const STARTER = [...Array(5).fill("STRIKE_IRONCLAD"), ...Array(4).fill("DEFEND_IRONCLAD"), "BASH"];

test("packages: a payoff is worth its enablers, and nothing without them", () => {
  const exhaust = [...STARTER, "TRUE_GRIT", "BURNING_PACT", "SECOND_WIND"];
  assert.equal(packageBonus("FEEL_NO_PAIN", 0, STARTER), 0);
  assert.ok(packageBonus("FEEL_NO_PAIN", 0, exhaust) >= 0.24);
  assert.equal(packageBonus("RUPTURE", 0, STARTER), 0);
  assert.ok(packageBonus("RUPTURE", 0, [...STARTER, "OFFERING", "BLOODLETTING"]) > 0.1);
});

test("packages: an enabler is worth more once its payoff is in the deck", () => {
  assert.ok(packageBonus("BURNING_PACT", 0, [...STARTER, "FEEL_NO_PAIN"]) > packageBonus("BURNING_PACT", 0, STARTER));
  assert.ok(packageBonus("SHRUG_IT_OFF", 0, [...STARTER, "BODY_SLAM"]) > packageBonus("SHRUG_IT_OFF", 0, STARTER));
});

test("packages: from act 2, scaling first when the deck has none; act 3 wants an answer to big hits", () => {
  assert.equal(packageBonus("DEMON_FORM", 0, STARTER), 0);
  assert.ok(packageBonus("DEMON_FORM", 1, STARTER) >= 0.15);
  assert.equal(packageBonus("DEMON_FORM", 1, [...STARTER, "DOMINATE"]), 0);
  assert.ok(packageBonus("IMPERVIOUS", 2, STARTER) > packageBonus("IMPERVIOUS", 1, STARTER));
  assert.equal(profile([...STARTER, "FEEL_NO_PAIN", "TRUE_GRIT", "STOKE", "OFFERING"]).scaling, 2); // Stoke, and FNP with 3 sources
});

test("scale1: in act 1, once there are two damage cards, scaling is wanted", () => {
  const two = [...STARTER, "POMMEL_STRIKE", "TWIN_STRIKE"];
  const off = packageBonus("DEMON_FORM", 0, two);
  const starterOff = packageBonus("DEMON_FORM", 0, STARTER);
  useScalingFromAct1(true);
  try {
    assert.ok(packageBonus("DEMON_FORM", 0, two) - off >= 0.2);
    assert.equal(packageBonus("DEMON_FORM", 0, STARTER), starterOff, "not before the damage cards");
  } finally {
    useScalingFromAct1(false);
  }
});
