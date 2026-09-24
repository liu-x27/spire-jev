import assert from "node:assert/strict";
import { test } from "node:test";
import { damageScaling, packageBonus, profile, usePackages2, useScalingFromAct1 } from "../src/packages.ts";

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

test("packages2: payoffs need support, defensive scaling does not stop the call for damage", () => {
  usePackages2(true);
  try {
    // Rupture with no self-damage is worse than nothing; with two sources it is wanted.
    assert.ok(packageBonus("RUPTURE", 1, [...STARTER, "TWIN_STRIKE", "ANGER"]) < 0);
    assert.ok(packageBonus("RUPTURE", 1, [...STARTER, "OFFERING", "BLOODLETTING"]) > 0.1);
    // A deck with Crimson Mantle (defensive) still wants damage scaling in act 2.
    const mantle = [...STARTER, "CRIMSON_MANTLE", "POMMEL_STRIKE"];
    assert.ok(packageBonus("INFLAME", 1, mantle) >= 0.2);
    assert.equal(damageScaling(mantle), 0);
    // Bloodletting is not draw; Shrug It Off is.
    assert.ok(packageBonus("SHRUG_IT_OFF", 1, STARTER) > packageBonus("BLOODLETTING", 1, STARTER));
    // Frontload commons give way once the deck has four and no damage scaling.
    const frontload = [...STARTER, "POMMEL_STRIKE", "ANGER", "TAUNT", "TWIN_STRIKE"];
    assert.ok(packageBonus("ANGER", 1, frontload) < 0);
  } finally {
    usePackages2(false);
  }
});
