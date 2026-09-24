/**
 * The whole act's map, planned (--flags pathdp; review #5, HP-budget pathing).
 *
 * chooseMap scores the rooms one step ahead, with a glance further: A10 runs
 * walked into rows of elites that way (seed 17 fought three in act 1 at
 * 58-68% HP on a map with an elite-free path). Here every path to the boss
 * is weighed at once, by dynamic programming over (map point, HP): fights
 * take the HP they take on average in our runs, and may kill; rest sites
 * heal or upgrade, whichever leaves more; rewards count in HP; and the boss
 * is worth more the more HP the run brings to it.
 *
 * The numbers are ours, rough, from fix1-a0 and fix1-a10 (HP lost per fight
 * by act and ascension); the reward values are guesses to be tested.
 */

export interface MapPoint {
  col: number;
  row: number;
  type: string;
  children: [number, number][];
}

export interface PathContext {
  hp: number;
  maxHp: number;
  /** 0-2. */
  act: number;
  ascension: number;
  gold: number;
  /** How much more an elite costs this deck than the average (upgrade2: 1.4 before it has three attacks). */
  eliteScale?: number;
}

/** HP an ordinary fight takes, acts 1-3 at A0 (fix1-a0 without its elites); ×1.38 at A10. */
const MONSTER_LOSS = [9.3, 13.5, 17];
const ELITE_TIMES = 2.7;
/** What rooms give, in HP. */
const VALUE = { card: 3, relic: 18, treasure: 12, upgrade: 6, event: 4 };
/** A run that dies here loses everything after: the boss's whole worth and more. */
const DEATH = 150;
/** What the boss fight is worth at full HP (a win), falling to nothing at a quarter. */
const BOSS = 90;

function phi(x: number): number {
  // Abramowitz and Stegun 7.1.26, through erf.
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

export interface PathPlan {
  /** The value of entering each offered point with the HP there is now. */
  values: number[];
  /** Index into the offers of the best. */
  best: number;
}

export function planPath(points: readonly MapPoint[], offers: readonly { col: number; row: number }[], ctx: PathContext): PathPlan {
  const key = (col: number, row: number) => `${col},${row}`;
  const byKey = new Map(points.map((p) => [key(p.col, p.row), p]));
  const max = Math.max(1, ctx.maxHp);
  const scale = 1 + 0.038 * ctx.ascension;
  const monster = (MONSTER_LOSS[Math.min(2, Math.max(0, ctx.act))] ?? 13.5) * scale;
  const firstRow = Math.min(...offers.map((o) => o.row));
  const memo = new Map<string, number>();

  const boss = (hp: number) => BOSS * Math.min(1, Math.max(0, (hp - 0.25 * max) / (0.7 * max)));
  const fight = (hp: number, loss: number, reward: number, next: (hp: number) => number) => {
    const sigma = 0.7 * loss;
    const die = 1 - phi((hp - loss) / sigma);
    const after = Math.max(1, Math.round(hp - loss));
    return (1 - die) * (reward + next(after)) - die * DEATH;
  };

  const value = (p: MapPoint, hp: number): number => {
    hp = Math.max(1, Math.min(max, Math.round(hp)));
    const k = `${p.col},${p.row},${hp}`;
    const known = memo.get(k);
    if (known !== undefined) return known;
    const children = p.children.map(([c, r]) => byKey.get(key(c, r))).filter((q): q is MapPoint => q !== undefined);
    const next = (h: number) => (children.length ? Math.max(...children.map((q) => value(q, h))) : boss(h));
    let v: number;
    if (/Elite/i.test(p.type)) v = fight(hp, monster * ELITE_TIMES * (ctx.eliteScale ?? 1), VALUE.relic + VALUE.card, next);
    else if (/Monster/i.test(p.type)) v = fight(hp, monster, VALUE.card, next);
    else if (/Rest/i.test(p.type)) v = Math.max(next(hp + Math.round(0.3 * max)), VALUE.upgrade + next(hp));
    else if (/Shop|Merchant/i.test(p.type)) {
      // Gold grows about 8 a floor on the way there.
      const gold = ctx.gold + 8 * (p.row - firstRow);
      v = (gold >= 150 ? 10 : gold >= 75 ? 5 : 1) + next(hp);
    } else if (/Treasure/i.test(p.type)) v = VALUE.treasure + next(hp);
    else if (/Unknown|Event/i.test(p.type)) {
      // About one unknown room in four is a fight (a guess); the rest are events.
      v = 0.25 * fight(hp, monster, VALUE.card, next) + 0.75 * (VALUE.event + next(hp));
    } else v = next(hp);
    memo.set(k, v);
    return v;
  };

  const values = offers.map((o) => {
    const p = byKey.get(key(o.col, o.row));
    return p ? value(p, ctx.hp) : -Infinity;
  });
  let best = 0;
  values.forEach((v, i) => {
    if (v > values[best]!) best = i;
  });
  return { values, best };
}
