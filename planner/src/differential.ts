/**
 * The check on the simulator: after every card the game plays, compare what
 * sim.ts said would happen with what did.
 *
 * Only the fields the planner scores on and the piles it tracks are compared.
 * A card that drew is compared on everything but the hand, whose new cards
 * the model could not know.
 */

import type { State } from "./sim.ts";

export interface Mismatch {
  card: string;
  field: string;
  predicted: number | string;
  actual: number | string;
  /** The state the card was played from, for reading the log. */
  before?: string;
}

const powers = (p: Record<string, number>) =>
  Object.keys(p)
    .filter((k) => p[k] !== 0)
    .sort()
    .map((k) => `${k}${p[k]}`)
    .join(" ");

export function compare(card: string, predicted: State, actual: State): Mismatch[] {
  const out: Mismatch[] = [];
  const check = (field: string, p: number | string, a: number | string) => {
    if (p !== a) out.push({ card, field, predicted: p, actual: a });
  };
  check("player.hp", predicted.player.hp, actual.player.hp);
  check("player.block", predicted.player.block, actual.player.block);
  check("player.powers", powers(predicted.player.powers), powers(actual.player.powers));
  check("energy", predicted.energy, actual.energy);
  for (const pe of predicted.enemies) {
    const ae = actual.enemies.find((e) => e.id === pe.id);
    if (!ae) {
      if (pe.alive) out.push({ card, field: `enemy${pe.id}.present`, predicted: "alive", actual: "gone" });
      continue;
    }
    check(`enemy${pe.id}.hp`, pe.hp, ae.hp);
    check(`enemy${pe.id}.block`, pe.block, ae.block);
    check(`enemy${pe.id}.alive`, String(pe.alive), String(ae.alive));
    if (ae.alive) check(`enemy${pe.id}.powers`, powers(pe.powers), powers(ae.powers));
  }
  if (predicted.drawn === 0) check("hand.size", predicted.hand.length, actual.hand.length);
  check("discard.size", predicted.discard.length, actual.discard.length);
  check("exhaust.size", predicted.exhaust.length, actual.exhaust.length);
  return out;
}
