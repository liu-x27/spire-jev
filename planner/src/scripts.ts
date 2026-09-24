/**
 * The eight bosses' move scripts at A10, from the game's IL: what each move shows, what it does on the
 * enemies' turn besides the damage shown (Strength, the player's debuffs, block, a heal, the cards it
 * gives), and the move after it. None of them rolls its moves: every script is a fixed cycle, or a
 * branch on something the state shows (Asleep, the turn).
 *
 * turn.ts nextTurn plays an enemy's move by its id (the bridge's NextMove.Id), so a two-turn
 * lookahead and spar.ts meet the boss's real next move and what its turn does, where intents.ts
 * could only guess an attack by the turn number.
 */

import type { IntentObs } from "./obs.ts";
import type { Card, Enemy } from "./sim.ts";

/** What the enemies' turn touches, as a move's effect sees it: all for the turn that follows. */
export interface EnemyTurn {
  /** The turn now ending. */
  turn: number;
  /** The enemy's powers, and the block and heal its move gives. */
  powers: Record<string, number>;
  block: number;
  heal: number;
  /** The player's powers next turn (newly applied debuffs skip their first tick: they last the turn). */
  player: Record<string, number>;
  /** The player's piles, before the next hand is drawn (new arrays; the cards in them are shared). */
  draw: Card[];
  discard: Card[];
}

interface Move {
  /** Damage a hit before Strength, and hits; none: no attack. */
  damage?: number;
  hits?: number;
  /** The other intents it shows. */
  shows?: readonly string[];
  effect?: (t: EnemyTurn, e: Enemy) => void;
  /** The move after it. */
  next: string | ((t: EnemyTurn, e: Enemy) => string);
}

const add = (p: Record<string, number>, k: string, n: number) => {
  p[k] = (p[k] ?? 0) + n;
};
const status = (id: string, vars: Record<string, number>, keywords: string[]): Card => ({
  id, cost: id === "BECKON" ? 1 : -1, costsX: false, type: "Status", target: "None", keywords, vars, upgrades: 0, locked: false, glows: false,
});
const burn = () => status("BURN", { Damage: 2 }, ["Unplayable"]);
const beckon = () => status("BECKON", { HpLoss: 6 }, []);

/** Script by model, then move id. */
export const SCRIPTS: Record<string, Record<string, Move>> = {
  KIN_FOLLOWER: {
    QUICK_SLASH_MOVE: { damage: 5, next: "BOOMERANG_MOVE" },
    BOOMERANG_MOVE: { damage: 2, hits: 2, next: "POWER_DANCE_MOVE" },
    POWER_DANCE_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 3), next: "QUICK_SLASH_MOVE" },
  },
  KIN_PRIEST: {
    ORB_OF_FRAILTY_MOVE: { damage: 9, shows: ["Debuff"], effect: (t) => add(t.player, "FRAIL", 1), next: "ORB_OF_WEAKNESS_MOVE" },
    ORB_OF_WEAKNESS_MOVE: { damage: 9, shows: ["Debuff"], effect: (t) => add(t.player, "WEAK", 1), next: "BEAM_MOVE" },
    BEAM_MOVE: { damage: 3, hits: 3, next: "RITUAL_MOVE" },
    RITUAL_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 3), next: "ORB_OF_FRAILTY_MOVE" },
  },
  CEREMONIAL_BEAST: {
    STAMP_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "PLOW", 160), next: "PLOW_MOVE" },
    PLOW_MOVE: { damage: 20, shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 2), next: "PLOW_MOVE" },
    // Plow broken (sim.ts hit): one stunned turn, then Beast Cry, Stomp, Crush.
    STUNNED: { shows: ["Stun"], next: "BEAST_CRY_MOVE" },
    BEAST_CRY_MOVE: { shows: ["Debuff"], effect: (t) => add(t.player, "RINGING", 1), next: "STOMP_MOVE" },
    STOMP_MOVE: { damage: 17, next: "CRUSH_MOVE" },
    CRUSH_MOVE: { damage: 19, shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 4), next: "BEAST_CRY_MOVE" },
  },
  LAGAVULIN_MATRIARCH: {
    // Asleep (turn.ts counts it down and gives Plating's block): she sleeps until it runs out.
    SLEEP_MOVE: { shows: ["Sleep"], next: (t) => ((t.powers["ASLEEP"] ?? 0) > 0 ? "SLEEP_MOVE" : "SLASH_MOVE") },
    STUNNED: { shows: ["Stun"], next: "SLASH_MOVE" },
    SLASH_MOVE: { damage: 21, next: "DISEMBOWEL_MOVE" },
    DISEMBOWEL_MOVE: { damage: 10, hits: 2, next: "SLASH2_MOVE" },
    SLASH2_MOVE: { damage: 14, shows: ["Defend"], effect: (t) => void (t.block += 14), next: "SOUL_SIPHON_MOVE" },
    SOUL_SIPHON_MOVE: {
      shows: ["Debuff", "Buff"],
      effect: (t) => {
        add(t.player, "STRENGTH", -2);
        add(t.player, "DEXTERITY", -2);
        add(t.powers, "STRENGTH", 2);
      },
      next: "SLASH_MOVE",
    },
  },
  SOUL_FYSH: {
    // One Beckon into the draw pile (at a random place), one into the discard pile.
    BECKON_MOVE: {
      shows: ["StatusCard"],
      effect: (t) => {
        t.draw.splice(Math.floor(t.draw.length / 2), 0, beckon());
        t.discard.push(beckon());
      },
      next: "DE_GAS_MOVE",
    },
    DE_GAS_MOVE: { damage: 18, next: "GAZE_MOVE" },
    GAZE_MOVE: { damage: 8, shows: ["StatusCard"], effect: (t) => void t.discard.push(beckon()), next: "FADE_MOVE" },
    // Intangible 2, a stack gone at this turn's end: 1 on the player's turn that follows.
    FADE_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "INTANGIBLE", 1), next: "SCREAM_MOVE" },
    SCREAM_MOVE: { damage: 15, shows: ["Debuff"], effect: (t) => add(t.player, "VULNERABLE", 3), next: "BECKON_MOVE" },
  },
  KNOWLEDGE_DEMON: {
    // The player's pick is made on the enemies' turn (run-fights combatSelect); Disintegration is
    // the one the bot takes by default. Curses come on turns 1, 5 and 9.
    CURSE_OF_KNOWLEDGE_MOVE: {
      shows: ["Debuff"],
      effect: (t) => add(t.player, "DISINTEGRATION", t.turn <= 1 ? 6 : t.turn <= 5 ? 7 : 8),
      next: "SLAP_MOVE",
    },
    SLAP_MOVE: { damage: 18, next: "KNOWLEDGE_OVERWHELMING_MOVE" },
    KNOWLEDGE_OVERWHELMING_MOVE: { damage: 9, hits: 3, next: "PONDER_MOVE" },
    PONDER_MOVE: {
      damage: 13, shows: ["Heal", "Buff"],
      effect: (t) => {
        t.heal += 30;
        add(t.powers, "STRENGTH", 3);
      },
      next: (t) => (t.turn <= 8 ? "CURSE_OF_KNOWLEDGE_MOVE" : "SLAP_MOVE"),
    },
  },
  CRUSHER: {
    THRASH_MOVE: { damage: 14, next: "ENLARGING_STRIKE_MOVE" },
    ENLARGING_STRIKE_MOVE: { damage: 4, next: "BUG_STING_MOVE" },
    BUG_STING_MOVE: {
      damage: 7, hits: 2, shows: ["Debuff"],
      effect: (t) => {
        add(t.player, "WEAK", 2);
        add(t.player, "FRAIL", 2);
      },
      next: "ADAPT_MOVE",
    },
    ADAPT_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 3), next: "GUARDED_STRIKE_MOVE" },
    GUARDED_STRIKE_MOVE: { damage: 14, shows: ["Defend"], effect: (t) => void (t.block += 18), next: "THRASH_MOVE" },
  },
  ROCKET: {
    TARGETING_RETICLE_MOVE: { damage: 4, next: "PRECISION_BEAM_MOVE" },
    PRECISION_BEAM_MOVE: { damage: 20, next: "CHARGE_UP_MOVE" },
    CHARGE_UP_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 3), next: "LASER_MOVE" },
    LASER_MOVE: { damage: 35, next: "RECHARGE_MOVE" },
    RECHARGE_MOVE: { shows: ["Sleep"], next: "TARGETING_RETICLE_MOVE" },
  },
  TEST_SUBJECT: {
    BITE_MOVE: { damage: 22, next: "SKULL_BASH_MOVE" },
    SKULL_BASH_MOVE: { damage: 16, shows: ["Debuff"], effect: (t) => add(t.player, "VULNERABLE", 1), next: "BITE_MOVE" },
    // One more hit every time (3, 4, 5, ...): turn.ts counts on from the hits shown.
    MULTI_CLAW_MOVE: { damage: 11, hits: 3, next: "MULTI_CLAW_MOVE" },
    PHASE3_LACERATE_MOVE: { damage: 11, hits: 3, next: "BIG_POUNCE" },
    BIG_POUNCE: { damage: 45, next: "BURNING_GROWL_MOVE" },
    BURNING_GROWL_MOVE: {
      shows: ["StatusCard", "Buff"],
      effect: (t) => {
        for (let i = 0; i < 5; i++) t.discard.push(burn());
        add(t.powers, "STRENGTH", 3);
      },
      next: "PHASE3_LACERATE_MOVE",
    },
  },
  AEONGLASS: {
    EBB_MOVE: { damage: 26, shows: ["Defend"], effect: (t) => void (t.block += 33), next: "EYE_LASERS_MOVE" },
    EYE_LASERS_MOVE: { damage: 12, hits: 2, next: "INCREASING_INTENSITY_MOVE" },
    // Every Wither the player has gets 3 more damage, two more go into the discard pile, and it gains
    // 4 Strength, one more each time (on turns 3, 6, 9: 3 + turn / 3).
    INCREASING_INTENSITY_MOVE: {
      shows: ["StatusCard", "Buff"],
      effect: (t) => {
        const level = Math.floor(t.turn / 3);
        for (const pile of [t.draw, t.discard]) {
          pile.forEach((c, i) => {
            if (c.id === "WITHER") pile[i] = { ...c, vars: { ...c.vars, Damage: (c.vars["Damage"] ?? 3) + 3 } };
          });
        }
        for (let i = 0; i < 2; i++) t.discard.push(status("WITHER", { Damage: 3 + 3 * level }, ["Unplayable"]));
        add(t.powers, "STRENGTH", 3 + level);
      },
      next: "EBB_MOVE",
    },
  },
};

/** The first move of each boss's monsters, and what spar.ts sets them up with (A10). */
export const OPENING: Record<string, string> = {
  KIN_FOLLOWER: "QUICK_SLASH_MOVE", KIN_PRIEST: "ORB_OF_FRAILTY_MOVE", CEREMONIAL_BEAST: "STAMP_MOVE",
  LAGAVULIN_MATRIARCH: "SLEEP_MOVE", SOUL_FYSH: "BECKON_MOVE", KNOWLEDGE_DEMON: "CURSE_OF_KNOWLEDGE_MOVE",
  CRUSHER: "THRASH_MOVE", ROCKET: "TARGETING_RETICLE_MOVE", TEST_SUBJECT: "BITE_MOVE", AEONGLASS: "EBB_MOVE",
};

export const scripted = (e: Enemy): boolean => e.move !== undefined && SCRIPTS[e.model]?.[e.move] !== undefined;

/**
 * The intents a move shows: its damage with the enemy's Strength, times the player's Vulnerable, the
 * enemy's Weak and a claw's back attack, as the game computes them; `hits` for Multi Claw's count.
 */
export function moveIntents(model: string, move: string, strength: number, mult: { vulnerable: boolean; weak: boolean; behind: boolean }, hits?: number): IntentObs[] {
  const m = SCRIPTS[model]?.[move];
  if (!m) return [];
  const out: IntentObs[] = [];
  if (m.damage !== undefined) {
    const per = Math.max(0, m.damage + strength) * (mult.vulnerable ? 1.5 : 1) * (mult.weak ? 0.75 : 1) * (mult.behind ? 1.5 : 1);
    out.push({ type: "Attack", damage: Math.floor(per), hits: hits ?? m.hits ?? 1 });
  }
  for (const t of m.shows ?? []) out.push({ type: t, damage: 0, hits: 0 });
  return out;
}

/** Plays `e`'s move on the enemies' turn: its effect on `t`, and the move after it. */
export function playMove(e: Enemy, t: EnemyTurn): string | undefined {
  const m = e.move === undefined ? undefined : SCRIPTS[e.model]?.[e.move];
  if (!m) return undefined;
  m.effect?.(t, e);
  return typeof m.next === "string" ? m.next : m.next(t, e);
}
