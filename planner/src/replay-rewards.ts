/**
 * A log's card rewards chosen again under a set of flags (chooseCardReward): which picks a deck-building
 * change makes otherwise, with no game.
 *
 *   node src/replay-rewards.ts --log runs/eval-X.json [--log …] [--flags …] [--add sparengval] [--acts 1,2] [--every 20] [--max 150] --out runs/picks-X.json
 *   node src/replay-rewards.ts --compare runs/picks-a.json runs/picks-b.json
 *
 * One set of flags a process: spar's caches of the base deck's bouts (choices.ts sparBase, spar5Base) do
 * not know the flags, so two sets in one process would share them. --flags defaults to the first log's;
 * --add puts more on top. Each reward is rebuilt from the room the log shows (the deck, HP, gold, the
 * offers as described) with the relics of the last fight at or before it, the act's boss from the run's
 * own boss fight (a run that died before it: its rewards are left out), the log's rules, ascension and
 * weights (run-fights configure), and every card the log's runs learnt (its `cards`). Not in the log: the
 * opening of the fight before (spar3's player: the bout takes the relics' opening instead), a relic won
 * with that fight, the potions (only sparpots reads them), act 3's second boss (sparboth, sparpair). So
 * the log's own flags do not always pick what its run did: --compare reports that agreement for each
 * side, and the picks the two sides differ on. --every n takes every n-th reward of the acts asked for,
 * in the logs' order (seed by seed), so a sample spans the seeds; --max stops after that many.
 */

import fs from "node:fs";
import { parseArgs } from "node:util";
import { chooseCardReward, setActBoss } from "./choices.ts";
import type { CardObs, LegalAction, Observation } from "./obs.ts";
import { configure, type FightLog } from "./run-fights.ts";

import { cardFromId, learnCard } from "./spar.ts";

interface Room {
  seed: string;
  floor: number;
  phase: string;
  hp: number;
  maxHp: number;
  gold: number;
  deck?: string[];
  room?: { room_type: string; options: string[]; details: Record<string, unknown> } | null;
  chosen?: string;
}
interface Log {
  choices?: string;
  ascension?: number;
  flags?: string;
  weights?: Record<string, number>;
  fights: FightLog[];
  rooms: Room[];
  cards?: Record<string, Omit<CardObs, "index" | "can_play">>;
}
export interface Pick {
  seed: string;
  floor: number;
  act: number;
  boss: string;
  offered: string[];
  /** What the run took ("skip" for none), and what the replay does. */
  chosen: string;
  pick: string;
  ms: number;
  /** Powers measured (sparengval's bouts, engval): search.ts engineMeasures. */
  measures: number;
}
interface Picks {
  flags: string;
  logs: string[];
  picks: Pick[];
}

const { values, positionals } = parseArgs({
  options: {
    log: { type: "string", multiple: true, default: [] },
    flags: { type: "string" },
    add: { type: "string", default: "" },
    acts: { type: "string", default: "1,2,3" },
    every: { type: "string", default: "1" },
    max: { type: "string", default: "1000000" },
    out: { type: "string" },
    compare: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

/** The encounter each boss fight's monsters belong to (spar.ts BOSSES), by the act's boss floor. */
const BOSS_OF: Record<string, string> = {
  VANTOM: "VANTOM", THE_INSATIABLE: "THE_INSATIABLE", WATERFALL_GIANT: "WATERFALL_GIANT", KIN_PRIEST: "THE_KIN",
  CEREMONIAL_BEAST: "CEREMONIAL_BEAST", LAGAVULIN_MATRIARCH: "LAGAVULIN_MATRIARCH", SOUL_FYSH: "SOUL_FYSH",
  KNOWLEDGE_DEMON: "KNOWLEDGE_DEMON", CRUSHER: "KAISER_CRAB", ROCKET: "KAISER_CRAB", TEST_SUBJECT: "TEST_SUBJECT",
  AEONGLASS: "AEONGLASS", QUEEN: "QUEEN", TORCH_HEAD_AMALGAM: "QUEEN",
};
const BOSS_FLOORS = [17, 33, 48];
/** Acts 1-3, as the bridge numbers them (choices.ts actOf reads 1 as act 1). */
const actOf = (floor: number) => (floor <= 17 ? 1 : floor <= 33 ? 2 : 3);

function replay(files: readonly string[]): Picks {
  const logs = files.map((f) => JSON.parse(fs.readFileSync(f, "utf8")) as Log);
  const first = logs[0]!;
  const flags = [...(values.flags ?? first.flags ?? "").split(","), ...values.add.split(",")].filter(Boolean);
  configure(flags, first.choices ?? "rules2", first.ascension ?? 10, first.weights ?? {});
  for (const log of logs) for (const [id, c] of Object.entries(log.cards ?? {})) learnCard(id, c);
  const acts = new Set(values.acts.split(",").map(Number));
  const every = Math.max(1, Number(values.every));
  const max = Number(values.max);
  let seen = 0;
  const picks: Pick[] = [];
  for (const log of logs) {
    const fightsBy = new Map<string, FightLog[]>();
    const bossBy = new Map<string, string>();
    for (const f of log.fights) {
      fightsBy.set(f.seed, [...(fightsBy.get(f.seed) ?? []), f]);
      const boss = BOSS_FLOORS.includes(f.floor) ? f.enemies.map((e) => BOSS_OF[e]).find(Boolean) : undefined;
      if (boss) bossBy.set(`${f.seed}/${actOf(f.floor)}`, `${boss}_BOSS`);
    }
    for (const r of log.rooms) {
      if (picks.length >= max) break;
      if (r.phase !== "card_reward" || !acts.has(actOf(r.floor))) continue;
      const boss = bossBy.get(`${r.seed}/${actOf(r.floor)}`);
      const cards = (r.room?.details?.["cards"] ?? []) as { card_id: string; upgrades?: number }[];
      if (!boss || cards.length === 0 || !r.deck || seen++ % every !== 0) continue;
      const before = (fightsBy.get(r.seed) ?? []).filter((f) => f.floor <= r.floor).at(-1);
      const legal: LegalAction[] = [
        ...cards.map((c, i) => ({
          action_id: `choose_card:${i}:${c.card_id}`, action_type: "choose_card", description: "",
          metadata: { card_index: i, card_id: c.card_id, upgrades: c.upgrades ?? 0 },
        })),
        { action_id: "skip_card", action_type: "skip_card", description: "" },
      ];
      const o: Observation = {
        phase: "card_reward", is_terminal: false, is_victory: false, seed: r.seed, act: actOf(r.floor), act_boss: boss, floor: r.floor,
        gold: r.gold, player_hp: r.hp, player_max_hp: r.maxHp, player_block: 0, player_energy: 3, player_powers: {},
        deck_cards: r.deck, relics: before?.relics ?? [], ...(before?.relicVars ? { relic_vars: before.relicVars } : {}),
        potions: [], combat: null, room: r.room ?? null,
      };
      const name = (id: string | undefined) => {
        if (!id || id === "skip_card") return "skip";
        const [, i, card] = id.split(":");
        return `${card}${(cards[Number(i)]?.upgrades ?? 0) > 0 ? "+" : ""}`;
      };
      setActBoss(boss);
      const t0 = performance.now();
      const m0 = 0;
      const pick = chooseCardReward(o, legal);
      picks.push({
        seed: r.seed, floor: r.floor, act: actOf(r.floor), boss, offered: cards.map((_c, i) => name(legal[i]!.action_id)),
        chosen: name(r.chosen), pick: name(pick), ms: Math.round(performance.now() - t0), measures: m0,
      });
      if (picks.length % 25 === 0) console.log(`${picks.length} rewards`);
    }
  }
  return { flags: flags.join(","), logs: [...files], picks };
}

/** Two replays of the same rewards: each one's agreement with the runs, and where they part. */
function compare(a: Picks, b: Picks): void {
  const inB = new Map(b.picks.map((p) => [`${p.seed}/${p.floor}`, p]));
  const pairs = a.picks.flatMap((p) => (inB.has(`${p.seed}/${p.floor}`) ? [[p, inB.get(`${p.seed}/${p.floor}`)!] as const] : []));
  const agree = (side: 0 | 1) => pairs.filter((pp) => pp[side].pick === pp[side].chosen).length;
  const ms = (side: 0 | 1) => pairs.reduce((s, pp) => s + pp[side].ms, 0) / Math.max(1, pairs.length);
  console.log(`${pairs.length} rewards in both`);
  for (const [side, x] of [[0, a], [1, b]] as const) {
    console.log(`  ${side === 0 ? "a" : "b"} ${x.flags}\n    as the run: ${agree(side)} (${((100 * agree(side)) / Math.max(1, pairs.length)).toFixed(0)}%), ${ms(side).toFixed(0)} ms a reward`);
  }
  const apart = pairs.filter(([p, q]) => p.pick !== q.pick);
  console.log(`  picked otherwise: ${apart.length}`);
  for (const act of [1, 2, 3]) {
    const n = pairs.filter(([p]) => p.act === act).length;
    if (n > 0) console.log(`    act ${act}: ${apart.filter(([p]) => p.act === act).length} of ${n}`);
  }
  const type = (id: string) => (id === "skip" ? "skip" : cardFromId(id)?.type ?? "?");
  const tally = (side: 0 | 1) => {
    const m = new Map<string, number>();
    for (const pp of apart) m.set(type(pp[side].pick), (m.get(type(pp[side].pick)) ?? 0) + 1);
    return [...m].sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(", ");
  };
  console.log(`    a took: ${tally(0)}\n    b took: ${tally(1)}`);
  const moves = new Map<string, number>();
  for (const [p, q] of apart) moves.set(`${p.pick} -> ${q.pick}`, (moves.get(`${p.pick} -> ${q.pick}`) ?? 0) + 1);
  for (const [m, n] of [...moves].sort((x, y) => y[1] - x[1]).slice(0, 20)) console.log(`    ${n} x ${m}`);
  // Where the runs went on from: the side agreeing with the run where the other does not.
  console.log(`    a as the run, b not: ${apart.filter(([p]) => p.pick === p.chosen).length}; b as the run, a not: ${apart.filter(([, q]) => q.pick === q.chosen).length}`);
}

if (values.compare) {
  const [fa, fb] = positionals;
  if (!fa || !fb) throw new Error("usage: replay-rewards.ts --compare a.json b.json");
  const load = (f: string) => JSON.parse(fs.readFileSync(f, "utf8")) as Picks;
  compare(load(fa), load(fb));
} else {
  if (values.log.length === 0 || !values.out) throw new Error("usage: replay-rewards.ts --log runs/eval-X.json [--flags …] [--add …] --out runs/picks-X.json");
  const out = replay(values.log);
  fs.writeFileSync(values.out, JSON.stringify(out, null, 1));
  const same = out.picks.filter((p) => p.pick === p.chosen).length;
  console.log(`${out.flags}: ${out.picks.length} rewards, ${same} picked as the run; ${values.out}`);
}
