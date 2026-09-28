// U3F06ZT323WD f19 turn 1 (Bowlbugs: Rock Attack 16, Nectar Attack 3): planTurn's and planTurn2+lookfix's
// choice on the human's start state, and planTurn2's rated candidates as it rates them (16 shared hands,
// leaves in HP), with the line that blocks the Rock fully (21 block, no potion) rated the same way.
//   node diag_u3f0.mts [seed floor turn]
import fs from "node:fs";
const B = "file:///D:/CODE/spire-jev-botlab2/planner/src";
const { configure } = await import(`${B}/run-fights.ts`);
const { DEFAULT_WEIGHTS, evaluate, explore, expectedIntents, leafValue, planTurn, planTurn2 } = await import(`${B}/search.ts`);
const { drink, fromObservation, play, stateKey } = await import(`${B}/sim.ts`);
const { nextTurn, seeded } = await import(`${B}/turn.ts`);

const [seed, floor, turn] = [process.argv[2] ?? "U3F06ZT323WD", Number(process.argv[3] ?? 19), Number(process.argv[4] ?? 1)];
const C = "pathdp,restbudget,potions2,sleep,spar,spar3,spar5,spar4up,spar4shop,powbonus,spartake";
configure(`${C},halllook,lookfix`.split(","), "rules2", 10);
const rows = fs.readFileSync(`D:/CODE/spire-jev-playlab/planner/runs/replay-${seed}/turns.jsonl`, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
const row = rows.find((r) => r.floor === floor && r.turn === turn);
if (!row) throw new Error("no such turn");
const s0 = fromObservation(row.obs);
const W = DEFAULT_WEIGHTS;
const fnv = (t: string) => { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return h >>> 0; };
const aliveHp = (s: any) => s.enemies.reduce((a: number, e: any) => a + (e.alive ? e.hp : 0), 0);
const label = (line: any[]) => {
  let s = s0; const out: string[] = [];
  for (const a of line) {
    if (a.kind === "end") break;
    if (a.kind === "potion") { out.push(`potion:${s.potions.find((p: any) => p.slot === a.slot)?.id}`); s = drink(s, a); continue; }
    const c = s.hand[a.hand]; const t = a.target !== undefined ? s.enemies.find((e: any) => e.id === a.target)?.model : undefined;
    out.push(`${c?.id}${(c?.upgrades ?? 0) > 0 ? "+" : ""}${t ? ">" + t : ""}`); s = play(s, a);
  }
  return out.join(" ");
};
const shared = fnv(stateKey(s0));
const look = (st: any, n = 16) => {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const next = nextTurn(st, seeded(shared + i * 7919), expectedIntents);
    if (!next) { sum += -2 * st.player.maxHp - 0.35 * aliveHp(st); continue; }
    const second = explore(next, W, 1500, 0);
    sum += leafValue(second.best.score, second.best.state);
  }
  return sum / n;
};
console.log(`${seed} f${floor} t${turn}: HP ${s0.player.hp}, hand ${s0.hand.map((c: any) => c.id + ((c.upgrades ?? 0) > 0 ? "+" : "")).join(",")}, enemies ${s0.enemies.filter((e: any) => e.alive).map((e: any) => `${e.model}:${e.hp}`).join(",")}`);
console.log(`human played: ${row.human.join(" ")}`);
const p1 = planTurn(s0, W, 20_000);
console.log(`planTurn:  ${label(p1.actions)}  (one-turn ${p1.score.toFixed(1)})`);
const p2 = planTurn2(s0, W, 20_000);
console.log(`planTurn2: ${label(p2.actions)}  (look ${p2.score.toFixed(1)})`);
const { top } = explore(s0, W, 20_000, 300);
console.log(`\nplanTurn2's candidates (the one-turn top 5), rated as it rates them:`);
for (const [i, l] of top.slice(0, 5).entries()) console.log(`  #${i + 1} one-turn ${l.score.toFixed(1).padStart(7)}  block ${String(l.state.player.block).padStart(3)}  potions ${l.state.potionsUsed}  look ${look(l.state).toFixed(1).padStart(7)}  ${label(l.actions)}`);
const full = top.map((l: any, i: number) => ({ l, i })).filter(({ l }: any) => l.state.player.block >= 21 && l.state.potionsUsed === 0);
console.log(`\nLines with 21+ block and no potion (the Rock fully blocked), best by one-turn score:`);
for (const { l, i } of full.slice(0, 5)) console.log(`  rank ${String(i + 1).padStart(3)} one-turn ${l.score.toFixed(1).padStart(7)}  block ${String(l.state.player.block).padStart(3)}  look ${look(l.state).toFixed(1).padStart(7)}  ${label(l.actions)}`);
