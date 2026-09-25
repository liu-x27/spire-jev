// Cutting a recorded run by its timeline (src/demo-media.ts): the caption bar's text, when each
// caption shows, the frames a floor spans, and the cut that plays fights slower than the rest.
import assert from "node:assert/strict";
import { test } from "node:test";
import { captions, cutFilter, floorSpan, foeName, foes, outro, runSpan, stretches, timeIn, type TimelineLine } from "../src/demo-media.ts";

const line = (frame: number, floor: number, phase: string, extra: Partial<TimelineLine> = {}): TimelineLine => ({
  frame, t: 0, method: "step", phase, act: 1, floor, hp: 70, max_hp: 80, gold: 99, terminal: false, ...extra,
});

test("foes are named as the game's ids read, and counted", () => {
  assert.equal(foeName("WATERFALL_GIANT_BOSS:212"), "Waterfall Giant");
  assert.equal(foes(["NIBBIT:20", "NIBBIT:18", "SHRINKER_BEETLE:30"]), "Nibbit ×2 and Shrinker Beetle");
  assert.equal(foes(["VANTOM:180"]), "Vantom");
});

test("captions: one per state, merged while it holds, timed by frame over the speed", () => {
  const lines = [
    line(300, 1, "map"),
    line(330, 1, "map"),
    line(360, 2, "combat", { turn: 1, enemies: ["NIBBIT:20"] }),
    line(420, 2, "combat", { turn: 1, enemies: ["NIBBIT:14"], hp: 66 }),
    line(480, 2, "rewards", { hp: 66 }),
  ];
  const ass = captions(lines, 300, 540, (f) => (f - 300) / 30 / 2, "label");
  const dialogue = ass.split("\n").filter((l) => l.startsWith("Dialogue"));
  // map (300-330), the fight picked on it (330-360), its turn 1 at 70 HP (360-420) and at 66
  // (420-480), rewards (480-540), and the label.
  assert.equal(dialogue.length, 6);
  assert.match(dialogue[0]!, /0:00:00\.00,0:00:00\.50,State.*Floor 1 .* map$/);
  assert.match(dialogue[1]!, /0:00:00\.50,0:00:01\.00,State.*Floor 2 · HP 70\/80.*vs Nibbit$/);
  assert.match(dialogue[2]!, /0:00:01\.00,0:00:02\.00,State.*vs Nibbit, turn 1$/);
  assert.match(dialogue[3]!, /HP 66\/80.*vs Nibbit/);
  assert.match(dialogue[5]!, /0:00:00\.00,0:00:04\.00,Label,,0,0,0,,label$/);
});

test("spans: a floor from the map it was picked on to the next floor's first look, the run to past its end", () => {
  const lines = [line(100, 1, "map"), line(200, 2, "combat"), line(260, 2, "rewards"), line(300, 3, "map", { terminal: true })];
  assert.deepEqual(floorSpan(lines, 2, 2), [100, 300]);
  assert.deepEqual(floorSpan([line(100, 1, "event"), ...lines.slice(1)], 2, 2), [185, 300]);
  assert.deepEqual(runSpan(lines), [70, 300 + 180]);
});

test("the outro: the fight that ended the run, and whether it was the act's boss", () => {
  const giant = { enemies: ["WATERFALL_GIANT:220"], boss: "WATERFALL_GIANT_BOSS", turn: 1 };
  assert.equal(outro([line(100, 17, "combat", giant), line(130, 17, "combat", { ...giant, enemies: ["WATERFALL_GIANT:40"] })], false), "Floor 17 · lost to Waterfall Giant, act 1's boss");
  assert.equal(outro([line(100, 12, "combat", { enemies: ["BYRDONIS:90"], boss: "VANTOM_BOSS" })], false), "Floor 12 · lost to Byrdonis");
  // A timeline from before it had the boss: a boss floor at A0.
  assert.equal(outro([line(100, 33, "combat", { enemies: ["THE_INSATIABLE:300"] })], false), "Floor 33 · lost to The Insatiable, act 1's boss");
  assert.equal(outro([line(100, 48, "game_over")], true), "Run won · floor 48");
});

test("a cut: fights at the speed, the rest faster, and the times of frames in it", () => {
  const lines = [line(100, 1, "map"), line(160, 2, "combat"), line(220, 2, "combat"), line(280, 2, "rewards")];
  const cut = stretches(lines, 70, 340, 2, 3);
  // Before the first look and the map at 6x, the fight (both looks) at 2x, the rewards at 6x.
  assert.deepEqual(cut, [{ start: 70, end: 160, step: 6 }, { start: 160, end: 280, step: 2 }, { start: 280, end: 340, step: 6 }]);
  assert.equal(timeIn(cut, 70), 0);
  assert.equal(timeIn(cut, 160), 15 / 30);
  assert.equal(timeIn(cut, 280), (15 + 60) / 30);
  assert.equal(timeIn(cut, 340), (15 + 60 + 10) / 30);
  assert.equal(
    cutFilter(cut),
    "trim=start_frame=70:end_frame=340,select='between(n\\,0\\,89)*not(mod(n-0\\,6))+between(n\\,90\\,209)*not(mod(n-90\\,2))+between(n\\,210\\,269)*not(mod(n-210\\,6))',setpts=N/(30*TB)",
  );
});
