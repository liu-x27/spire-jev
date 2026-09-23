/**
 * Search over this turn's play orders.
 *
 * Depth-first over every legal sequence of plays, with states that are the
 * same merged (the order of two Defends does not matter) and identical cards
 * in hand offered once. Every node is also scored as "end the turn here", so
 * the best sequence is the best place to stop as well as the best order.
 *
 * The planner only ever executes the first action and plans again, so a
 * draw — whose cards the model cannot know — ends up planned for once the
 * cards are real, not guessed at.
 */

import { type Action, actions, hpLoss, play, type State, stateKey } from "./sim.ts";

export interface Weights {
  /** Per point of HP the enemies' attacks will take this turn. */
  hpLoss: number;
  /** Per point of HP left on the enemies. */
  enemyHp: number;
  /** Per stack of vulnerable on a living enemy, up to 3. */
  vulnerable: number;
  /** Per stack of weak on a living, attacking enemy, up to 3. */
  weak: number;
  /** Per point of the player's strength. */
  strength: number;
  /** Per card drawn this turn and not yet known. */
  drawn: number;
}

export const DEFAULT_WEIGHTS: Weights = { hpLoss: 1, enemyHp: 0.35, vulnerable: 1.5, weak: 1.2, strength: 2, drawn: 1.5 };

const WIN = 1e6;

/** How good it is to end the turn in state `s`. */
export function evaluate(s: State, w: Weights = DEFAULT_WEIGHTS): number {
  const alive = s.enemies.filter((e) => e.alive);
  if (alive.length === 0) return WIN + s.player.hp * 10;
  const enemyHp = alive.reduce((a, e) => a + e.hp, 0);
  const loss = hpLoss(s);
  if (loss >= s.player.hp) return -WIN - enemyHp;

  let score = -loss * w.hpLoss - enemyHp * w.enemyHp;
  for (const e of alive) {
    score += Math.min(3, e.powers["VULNERABLE"] ?? 0) * w.vulnerable;
    const attacking = e.intents.some((i) => i.type === "Attack");
    if (attacking) score += Math.min(3, e.powers["WEAK"] ?? 0) * w.weak;
  }
  score += (s.player.powers["STRENGTH"] ?? 0) * w.strength;
  score += s.drawn * w.drawn;
  return score;
}

export interface Plan {
  actions: Action[];
  score: number;
  /** States expanded. */
  nodes: number;
  ms: number;
  /** The node cap was hit before every order was tried. */
  truncated: boolean;
  /** Every card on the chosen line was modelled exactly. */
  exact: boolean;
}

export function planTurn(start: State, w: Weights = DEFAULT_WEIGHTS, maxNodes = 20_000): Plan {
  const t0 = performance.now();
  let nodes = 0;
  let truncated = false;
  let best: { score: number; actions: Action[]; exact: boolean } = { score: -Infinity, actions: [{ kind: "end" }], exact: true };
  const seen = new Set<string>([stateKey(start)]);

  const visit = (s: State, path: Action[]): void => {
    nodes++;
    const here = evaluate(s, w);
    if (here > best.score) best = { score: here, actions: [...path, { kind: "end" }], exact: s.exact };
    if (here >= WIN) return; // everything is dead; nothing left to plan
    if (nodes >= maxNodes) {
      truncated = true;
      return;
    }
    for (const a of actions(s)) {
      if (a.kind === "end") continue;
      const next = play(s, a);
      const key = stateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      visit(next, [...path, a]);
      if (truncated) return;
    }
  };
  visit(start, []);
  return { ...best, nodes, ms: performance.now() - t0, truncated };
}

/** The bridge's id for an action, against the current hand's indices. */
export function actionId(a: Action): string {
  if (a.kind === "end") return "end_turn";
  return a.target === undefined ? `play_card:${a.hand}` : `play_card:${a.hand}:target:${a.target}`;
}
