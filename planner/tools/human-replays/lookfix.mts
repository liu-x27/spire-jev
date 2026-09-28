// Is the "fair look ahead doesn't help" result (hall_oracle / boss_oracle, the other session, 9-27) a
// property of the game, or of how the look ahead was scored? Same bouts (spar.ts bout, the bench
// files' own decks, HP and relics, the same live seeds 9000 + i*100 + k), played by:
//   base      planTurn (one turn, draws unknown)
//   fair16    the old fair look ahead, as it was: top 5 ends x 16 next turns, each sample on its own
//             seed, a win or a death in a sample worth +-1e6 averaged with ~100-point evaluations
//   fx<S>     the same look ahead with the scale fixed: a win is the HP it keeps (the evaluation's own
//             unit), a death -DEATH, so a 1-in-16 chance of killing next turn is not worth 62,500 HP;
//             and common random numbers: sample i draws with the same seed for every candidate line
//   fxnc<S>   scale fixed, no common random numbers (each line its own seeds): which fix matters
//   crn<S>    common random numbers, the old +-1e6 scale
//   fxk<K>s<S> scale + CRN, the best K ends instead of 5
//   fxd2s<S>  scale + CRN, two more turns played by planTurn (a rollout), the leaf by the evaluation
//   oracle1/2 the cheat, as before (draws known this turn and the next ones)
// Output: one JSON line per bout (fight index, shuffle, variant, won, HP lost %, death), for pairing.
//   node lookfix.mts <hall|boss> <bench json,...> <fights> <shuffles> <variants> [floors] [out.jsonl]
import fs from "node:fs";
import { setIntentAscension } from "file:///D:/CODE/spire-jev-playlab/planner/src/intents.ts";
import { evaluate, expectedIntents, explore, planTurn, planTurn2, planTurnRoll, TURN_WEIGHTS, type Plan, useLookFix } from "file:///D:/CODE/spire-jev-playlab/planner/src/search.ts";
import { type Card, type State, setKnownDraws, stateKey } from "file:///D:/CODE/spire-jev-playlab/planner/src/sim.ts";
import { BARE, BOSSES, bout, cardFromId, hallways, useBoutPlanner } from "file:///D:/CODE/spire-jev-playlab/planner/src/spar.ts";
import { nextTurn, seeded } from "file:///D:/CODE/spire-jev-playlab/planner/src/turn.ts";

setIntentAscension(10);
const [mode, benchFiles, fightsArg, shufflesArg, variantsArg, floorsArg, outArg] = process.argv.slice(2);
const variants = variantsArg!.split(",");
const W = TURN_WEIGHTS;
const WIN = 1e6;
const DEATH_MULT = Number(process.env["LOOKFIX_DEATH"] ?? 2); // a death, in max HPs

/** turn.ts's seeded generator, its state out in the open so a copy can be run ahead (the oracle). */
class Rng {
  a: number;
  constructor(a: number) {
    this.a = a;
  }
  next = (): number => {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  clone(): Rng {
    return new Rng(this.a);
  }
}
let live: Rng = new Rng(1);

const done = (s: State) => s.enemies.every((e) => !e.alive && !((e.revive ?? 0) > 0) && !((e.deathBlow ?? 0) > 0));
const left = (s: State) => s.enemies.reduce((a, e) => a + (e.alive ? e.hp : 0), 0);
function known<T>(f: () => T): T {
  setKnownDraws(true);
  try {
    return f();
  } finally {
    setKnownDraws(false);
  }
}
function fnv(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * evaluate()'s score on one scale, the HP it keeps: a win is WIN + 10·HP (search.ts), a win with a
 * killed Giant's blow still to come WIN/2 + 10·HP after it, a death -WIN - enemy HP; everything
 * else is already HP less 0.35 an enemy HP. The potion cost rides along in each (x10 in a win's).
 */
function unify(score: number, maxHp: number, enemyHpLeft = 0): number {
  const death = DEATH_MULT * maxHp;
  if (score >= 0.9 * WIN) return (score - WIN) / 10;
  if (score >= 0.4 * WIN) return (score - WIN / 2) / 10;
  if (score <= -1.5 * WIN) return -death - 100; // dying to one's own card
  if (score <= -0.9 * WIN) return -death - 0.35 * Math.max(0, -score - WIN);
  if (score <= -0.2 * WIN) return -death + (score + WIN / 4) / 10; // a blow that looks lethal (wgblow)
  return score;
}

/** Where a candidate end of turn leads over `depth` more turns, one sample: on the unified scale or the old one. */
let leafWeights: typeof W | undefined;
function leafScore(st: State, chosenScore: number): number {
  if (!leafWeights || chosenScore >= 0.4 * WIN || chosenScore <= -0.2 * WIN) return chosenScore;
  return evaluate(st, leafWeights);
}
/** A killed Waterfall Giant's blow still to come (WIN/2, or wgblow's -WIN/4): not an end, its turn is played. */
const pendingBlow = (v: number) => (v >= 0.4 * WIN && v < 0.9 * WIN) || (v <= -0.2 * WIN && v > -0.9 * WIN);
const settled = (v: number) => v >= 0.9 * WIN || v <= -0.9 * WIN;
function sampleValue(end: State, rng: () => number, depth: number, unified: boolean): number {
  const maxHp = end.player.maxHp;
  let st = end;
  // A blow pending at the horizon gets its turn: one more than `depth`.
  for (let d = 0; d <= depth; d++) {
    const next = nextTurn(st, rng, expectedIntents);
    if (!next) return unified ? -DEATH_MULT * maxHp - 0.35 * left(st) : -WIN - left(st);
    if (done(next)) return unified ? next.player.hp : WIN + next.player.hp * 10;
    const turn = explore(next, W, 1500, 0);
    const v = leafScore(turn.best.state, turn.best.score);
    if (settled(v) || (d >= depth - 1 && !(pendingBlow(v) && d < depth))) return unified ? unify(v, maxHp, left(turn.best.state)) : v;
    st = turn.best.state;
  }
  return unified ? unify(evaluate(st, W), maxHp) : evaluate(st, W);
}

function lookahead(opts: { samples: number; keep: number; depth: number; unified: boolean; crn: boolean }) {
  let freshSeed = 1;
  return (s: State): Plan => {
    const { best, top, nodes, truncated } = explore(s, W, 3000, opts.keep);
    const lines = top.length ? top : [best];
    const base = fnv(stateKey(s)) ^ ((s.turn ?? 1) * 2654435761);
    let chosen = best;
    let value = -Infinity;
    for (const line of lines) {
      let v: number;
      if (settled(line.score)) v = opts.unified ? unify(line.score, s.player.maxHp, left(line.state)) : line.score;
      else {
        let sum = 0;
        for (let i = 0; i < opts.samples; i++) {
          const rng = opts.crn ? seeded((base + i * 7919) >>> 0) : seeded(freshSeed++);
          sum += sampleValue(line.state, rng, opts.depth, opts.unified);
        }
        v = sum / opts.samples;
      }
      if (v > value) {
        value = v;
        chosen = line;
      }
    }
    return { actions: chosen.actions, score: value, exact: chosen.exact, nodes, ms: 0, truncated };
  };
}

/** The old fair16, verbatim (boss_oracle.mts): own seeds per sample, the +-1e6 scale. */
let fairSeed = 1;
function fairOld(samples: number) {
  return (s: State): Plan => {
    const { best, top, nodes, truncated } = explore(s, W, 3000, 5);
    let chosen = best;
    let value = -Infinity;
    for (const line of top.length ? top : [best]) {
      let v: number;
      if (line.score >= WIN || line.score <= -WIN) v = line.score;
      else {
        let sum = 0;
        for (let i = 0; i < samples; i++) {
          const r = new Rng(fairSeed++);
          const next = nextTurn(line.state, r.next, expectedIntents);
          sum += !next ? -WIN - left(line.state) : done(next) ? WIN + next.player.hp * 10 : explore(next, W, 1500, 0).best.score;
        }
        v = sum / samples;
      }
      if (v > value) {
        value = v;
        chosen = line;
      }
    }
    return { actions: chosen.actions, score: value, exact: chosen.exact, nodes, ms: 0, truncated };
  };
}

/** The oracle, verbatim (boss_oracle.mts): the draws known, the next `depth` turns played exactly. */
function exactly(end: State, r: Rng, depth: number): number {
  let st = end;
  let v = evaluate(end, W);
  for (let d = 0; d < depth; d++) {
    if (done(st)) return WIN + st.player.hp * 10;
    const next = nextTurn(st, r.next, expectedIntents);
    if (!next) return -WIN - left(st);
    if (done(next)) return WIN + next.player.hp * 10;
    const turn = known(() => explore(next, W, 1500, 0));
    v = turn.best.score;
    if (v >= WIN || v <= -WIN) return v;
    st = turn.best.state;
  }
  return v;
}
function oracle(depth: number) {
  return (s: State): Plan => {
    const { best, top, nodes, truncated } = known(() => explore(s, W, 3000, 5));
    let chosen = best;
    let value = -Infinity;
    for (const line of top.length ? top : [best]) {
      const v = line.score >= WIN || line.score <= -WIN ? line.score : exactly(line.state, live.clone(), depth);
      if (v > value) {
        value = v;
        chosen = line;
      }
    }
    return { actions: chosen.actions, score: value, exact: chosen.exact, nodes, ms: 0, truncated };
  };
}

function planner(v: string): (s: State) => Plan {
  if (v === "base") return (s) => planTurn(s, W, 3000);
  if (v === "look") return (s) => planTurn2(s, W, 3000);
  // The patch as the game would run it (search.ts useLookFix): planTurn2, and bossroll's rollouts
  // (4 ends, 3 samples, 2 turns, 800 nodes). The toggle is the module's: run these on their own.
  if (v === "look2fix") {
    useLookFix(true);
    return (s) => planTurn2(s, W, 3000);
  }
  if (v === "rollfix") {
    useLookFix(true);
    return (s) => planTurnRoll(s, W, 3000, { ends: 4, samples: 3, depth: 2, nodes: 800 });
  }
  if (v === "roll") return (s) => planTurnRoll(s, W, 3000, { ends: 4, samples: 3, depth: 2, nodes: 800 });
  if (v === "known0") return (s) => {
    const { best, nodes, truncated } = known(() => explore(s, W, 3000, 0));
    return { actions: best.actions, score: best.score, exact: best.exact, nodes, ms: 0, truncated };
  };
  if (v === "fair16") return fairOld(16);
  let m = /^oracle(\d)$/.exec(v);
  if (m) return oracle(Number(m[1]));
  m = /^fx(\d+)$/.exec(v);
  if (m) return lookahead({ samples: Number(m[1]), keep: 5, depth: 1, unified: true, crn: true });
  m = /^fxnc(\d+)$/.exec(v);
  if (m) return lookahead({ samples: Number(m[1]), keep: 5, depth: 1, unified: true, crn: false });
  m = /^crn(\d+)$/.exec(v);
  if (m) return lookahead({ samples: Number(m[1]), keep: 5, depth: 1, unified: false, crn: true });
  m = /^fxk(\d+)s(\d+)$/.exec(v);
  if (m) return lookahead({ samples: Number(m[2]), keep: Number(m[1]), depth: 1, unified: true, crn: true });
  // The leaf weighing a big enemy's HP at what it costs (search.ts `long`): the Giant's Steam Eruption and
  // hits make its HP dearer than 0.35 a point, so a look ahead that blocks instead of killing pays for it.
  m = /^fxl(\d+)$/.exec(v);
  if (m) {
    leafWeights = { ...W, long: 1 };
    return lookahead({ samples: Number(m[1]), keep: 5, depth: 1, unified: true, crn: true });
  }
  m = /^fxld2s(\d+)$/.exec(v);
  if (m) {
    leafWeights = { ...W, long: 1 };
    return lookahead({ samples: Number(m[1]), keep: 5, depth: 2, unified: true, crn: true });
  }
  m = /^fxf(\d+)$/.exec(v);
  if (m) {
    leafWeights = { ...W, future: 1, futureBlock: 1 };
    return lookahead({ samples: Number(m[1]), keep: 5, depth: 1, unified: true, crn: true });
  }
  m = /^fxd(\d)s(\d+)$/.exec(v);
  if (m) return lookahead({ samples: Number(m[2]), keep: 5, depth: Number(m[1]), unified: true, crn: true });
  throw new Error(`unknown variant ${v}`);
}

type Fight = { seed?: string; floor: number; enemies: string[]; relics: string[]; relicVars?: Record<string, Record<string, number>>; hpStart: number; maxHp: number; won: boolean; hpLost: number };
type Start = { deck: Card[]; fight: Fight; key: string; boss: (typeof BOSSES)[string]; name: string };
const starts: Start[] = [];
const seen = new Set<string>();
const halls = new Map(hallways().map((h) => [h.key, h]));
const byComposition = new Map(Object.entries(BOSSES).map(([k, b]) => [[b.model, ...(b.with ?? []).map((x) => x.model)].sort().join("+"), { name: k, boss: b }]));
const floors = new Set((floorsArg && floorsArg !== "-" ? floorsArg : mode === "hall" ? "18-32" : "17,33,48,49").split(",").flatMap((x) => {
  const r = /^(\d+)-(\d+)$/.exec(x);
  if (!r) return [Number(x)];
  const out: number[] = [];
  for (let f = Number(r[1]); f <= Number(r[2]); f++) out.push(f);
  return out;
}));
for (const f of benchFiles!.split(",")) {
  const d = JSON.parse(fs.readFileSync(f, "utf8")) as { results: { fights: Fight[]; rooms: { floor: number; deck?: string[] }[] }[] };
  for (const r of d.results) {
    for (const x of r.fights) {
      if (!floors.has(x.floor)) continue;
      let boss: Start["boss"] | undefined;
      let name = "";
      let key: string;
      if (mode === "hall") {
        key = [...x.enemies].sort().join("+");
        const h = halls.get(key);
        if (!h) continue;
        boss = h.boss;
        name = key;
      } else {
        key = [...new Set(x.enemies)].sort().join("+");
        const hit = byComposition.get(key) ?? byComposition.get([...x.enemies].sort().join("+"));
        if (!hit) continue;
        boss = hit.boss;
        name = hit.name;
      }
      const id = `${x.seed ?? ""}@${x.floor}/${x.hpStart}/${key}`;
      if (x.seed !== undefined && seen.has(id)) continue;
      const deck = [...r.rooms].filter((m) => m.floor < x.floor && m.deck).at(-1)?.deck;
      if (!deck) continue;
      seen.add(id);
      starts.push({ deck: deck.map(cardFromId).filter((c): c is Card => c !== undefined), fight: x, key, boss, name });
    }
  }
}
const limit = Number(fightsArg ?? 60), n = Number(shufflesArg ?? 4);
const step = Math.max(1, Math.floor(starts.length / limit));
const chosen = starts.filter((_, i) => i % step === 0).slice(0, limit);
const turns = mode === "hall" ? 12 : 20;
const out = outArg ? fs.openSync(outArg, "a") : undefined;
const res: Record<string, { won: number; lost: number[]; deaths: number }> = Object.fromEntries(variants.map((v) => [v, { won: 0, lost: [], deaths: 0 }]));
const plans = Object.fromEntries(variants.map((v) => [v, planner(v)]));
const t0 = Date.now();
for (const [i, s] of chosen.entries()) {
  const me = { ...BARE, hp: s.fight.hpStart, maxHp: s.fight.maxHp, relics: s.fight.relics, ...(s.fight.relicVars ? { relicVars: s.fight.relicVars } : {}) };
  for (let k = 0; k < n; k++) {
    for (const v of variants) {
      useBoutPlanner(plans[v]!);
      live = new Rng(9000 + i * 100 + k);
      const b = bout(s.deck, s.boss, live.next, turns, me);
      const lost = (100 * Math.min(b.hpLost, me.hp)) / me.maxHp;
      const dead = b.hpLost >= me.hp;
      res[v]!.lost.push(lost);
      if (b.won) res[v]!.won++;
      if (dead) res[v]!.deaths++;
      if (out !== undefined) fs.writeSync(out, `${JSON.stringify({ mode, i, k, v, name: s.name, floor: s.fight.floor, won: b.won, lost, dead, turns: b.turns })}\n`);
    }
  }
  if ((i + 1) % 10 === 0) console.error(`${i + 1}/${chosen.length} fights, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const names = [...new Set(chosen.map((s) => s.name))].length;
console.log(`${mode}: ${chosen.length} fights (${names} kinds) x ${n} shuffles; the game's own: won ${chosen.filter((s) => s.fight.won).length}/${chosen.length}, lost ${mean(chosen.map((s) => (100 * (s.fight.won ? s.fight.hpLost : s.fight.hpStart)) / s.fight.maxHp)).toFixed(1)}%`);
const ref = res[variants[0]!]!;
for (const v of variants) {
  const r = res[v]!;
  const diff = r.lost.map((x, j) => x - ref.lost[j]!);
  const sd = Math.sqrt(diff.reduce((a, x) => a + (x - mean(diff)) ** 2, 0) / Math.max(1, diff.length - 1));
  console.log(`  ${v.padEnd(10)} won ${r.won}/${r.lost.length} (${((100 * r.won) / r.lost.length).toFixed(1)}%)  HP lost ${mean(r.lost).toFixed(1)}%  deaths ${r.deaths}  vs ${variants[0]} ${mean(diff) >= 0 ? "+" : ""}${mean(diff).toFixed(1)} ± ${(sd / Math.sqrt(Math.max(1, diff.length))).toFixed(1)}`);
}
