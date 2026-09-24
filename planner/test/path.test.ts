import assert from "node:assert/strict";
import { test } from "node:test";
import { type MapPoint, planPath } from "../src/path.ts";

// Two ways to the boss from row 1: an elite (col 0) or a fight (col 1), each followed by a rest site.
const FORK: MapPoint[] = [
  { col: 0, row: 1, type: "Elite", children: [[0, 2]] },
  { col: 1, row: 1, type: "Monster", children: [[0, 2]] },
  { col: 0, row: 2, type: "RestSite", children: [] },
];
const offers = [{ col: 0, row: 1 }, { col: 1, row: 1 }];

test("pathdp: the elite at full HP when a rest follows, the fight when hurt", () => {
  const ctx = { maxHp: 87, act: 0, ascension: 10, gold: 100 };
  assert.equal(planPath(FORK, offers, { ...ctx, hp: 87 }).best, 0);
  assert.equal(planPath(FORK, offers, { ...ctx, hp: 52 }).best, 1);
});

test("pathdp: a row of elites is avoided when a quiet path exists", () => {
  const map: MapPoint[] = [
    { col: 0, row: 1, type: "Elite", children: [[0, 2]] },
    { col: 0, row: 2, type: "Elite", children: [[0, 3]] },
    { col: 0, row: 3, type: "Elite", children: [[2, 4]] },
    { col: 1, row: 1, type: "Monster", children: [[1, 2]] },
    { col: 1, row: 2, type: "Unknown", children: [[1, 3]] },
    { col: 1, row: 3, type: "Monster", children: [[2, 4]] },
    { col: 2, row: 4, type: "RestSite", children: [] },
  ];
  const plan = planPath(map, offers, { hp: 60, maxHp: 87, act: 0, ascension: 10, gold: 100 });
  assert.equal(plan.best, 1);
  assert.ok(plan.values[0]! < plan.values[1]!);
});

test("pathdp: an offer not on the map is never chosen", () => {
  const plan = planPath(FORK, [{ col: 5, row: 1 }, { col: 1, row: 1 }], { hp: 87, maxHp: 87, act: 0, ascension: 0, gold: 0 });
  assert.equal(plan.best, 1);
});
