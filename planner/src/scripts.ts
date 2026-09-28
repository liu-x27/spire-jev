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
  /** The cards the next hand starts with before its draw (kept ones; the Myte's Toxics go here). */
  hand: Card[];
  /** The other enemies, as the player's turn left them (the Queen asks whether her Torch Head lives). */
  allies: readonly Enemy[];
  /** Powers the move gives every other living enemy (the Queen's Burn Bright for Me), after all have moved. */
  allyPowers: Record<string, number>;
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
  id, cost: id === "BECKON" || id === "FRANTIC_ESCAPE" ? 1 : -1, costsX: false, type: "Status", target: id === "FRANTIC_ESCAPE" ? "Self" : "None", keywords, vars, upgrades: 0, locked: false, glows: false,
});
const burn = () => status("BURN", { Damage: 2 }, ["Unplayable"]);
const torchAlive = (t: EnemyTurn) => t.allies.some((a) => a.alive && a.model === "TORCH_HEAD_AMALGAM");
const beckon = () => status("BECKON", { HpLoss: 6 }, []);
/** Dazed (IL: Ethereal, Unplayable). Toxic (IL: costs 1, exhausts; left in hand, 5 at the turn's end into block). */
const dazed = () => status("DAZED", {}, ["Ethereal", "Unplayable"]);
const toxic = (): Card => ({ ...status("TOXIC", { Damage: 5 }, ["Exhaust"]), cost: 1 });
/** The Thieving Hopper's moves in order: Flutter broken on the turn it showed the k-th, the one after it next. */
const HOPPER_CHAIN = ["THIEVERY_MOVE", "FLUTTER_MOVE", "HAT_TRICK_MOVE", "NAB_MOVE", "ESCAPE_MOVE"] as const;

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
  // Act 2's Tunneler (IL: Tunneler.GenerateMoveStateMachine, A10 numbers): Bite, Burrow (block and
  // Burrowed, whose block the enemies' turn does not clear: BurrowedPower.ShouldClearBlock), then
  // Below every turn until the block is broken (sim.ts hit: stunned, Bite next).
  TUNNELER: {
    BITE_MOVE: { damage: 15, next: "BURROW_MOVE" },
    BURROW_MOVE: {
      shows: ["Buff", "Defend"],
      effect: (t) => {
        t.block += 37;
        add(t.powers, "BURROWED", 1);
      },
      next: "BELOW_MOVE",
    },
    BELOW_MOVE: { damage: 26, next: "BELOW_MOVE" },
    STUNNED: { shows: ["Stun"], next: "BITE_MOVE" },
    DIZZY_MOVE: { shows: ["Stun"], next: "BITE_MOVE" },
  },
  // Act 2's hallway monsters (IL: each one's GenerateMoveStateMachine, A10; checked against the
  // intents of 783 act 2 hallway fights of act2-take / act2b-take: every one the machine allows).
  // Where the game rolls (RandomBranchState: weight 1 a move, CannotRepeat / CanRepeatXTimes), the
  // rule is in the comment and `next` is a fixed guess, marked RANDOM. A game stun (CreatureCmd.Stun)
  // puts STUNNED in place of the move shown, and the move it names (or the shown one's) after it.
  //
  // Bowlbug Rock: Headbutt every turn; fully blocked, stunned the next (turn.ts offBalance).
  BOWLBUG_ROCK: {
    HEADBUTT_MOVE: { damage: 16, next: "HEADBUTT_MOVE" },
    STUNNED: { shows: ["Stun"], next: "HEADBUTT_MOVE" },
    DIZZY_MOVE: { shows: ["Stun"], next: "HEADBUTT_MOVE" },
  },
  // Bowlbug Silk: Toxic Spit (Weak 1) first, then Thrash 5x2, turn about.
  BOWLBUG_SILK: {
    TOXIC_SPIT_MOVE: { shows: ["Debuff"], effect: (t) => add(t.player, "WEAK", 1), next: "THRASH_MOVE" },
    THRASH_MOVE: { damage: 5, hits: 2, next: "TOXIC_SPIT_MOVE" },
  },
  // Bowlbug Nectar: Thrash 3, Buff (+16 Strength), then Thrash (19) for good.
  BOWLBUG_NECTAR: {
    THRASH_MOVE: { damage: 3, next: "BUFF_MOVE" },
    BUFF_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 16), next: "THRASH2_MOVE" },
    THRASH2_MOVE: { damage: 3, next: "THRASH2_MOVE" },
  },
  // Bowlbug Egg: Bite 8 and 8 block, every turn.
  BOWLBUG_EGG: {
    BITE_MOVE: { damage: 8, shows: ["Defend"], effect: (t) => void (t.block += 8), next: "BITE_MOVE" },
  },
  // Slumbering Beetle (Plating 18, Slumber 3): Snore while it has Slumber, then Roll Out 18 and +2
  // Strength every turn. Slumber: a stack off at the enemies' turn's end, and one for every hit that
  // takes HP (sim.ts hit), the last waking it (Plating gone; by a hit, stunned this turn). Plating: a
  // stack off as its turn starts (not the first), its amount in block at the turn's end, before
  // Slumber's tick (the last sleeping turn still gives it).
  SLUMBERING_BEETLE: {
    SNORE_MOVE: {
      shows: ["Sleep"],
      effect: (t) => {
        if (t.turn >= 2 && (t.powers["PLATING"] ?? 0) > 0) add(t.powers, "PLATING", -1);
        t.block += Math.max(0, t.powers["PLATING"] ?? 0);
        if ((t.powers["SLUMBER"] ?? 0) <= 1) {
          delete t.powers["SLUMBER"];
          delete t.powers["PLATING"];
        } else add(t.powers, "SLUMBER", -1);
      },
      next: (t) => ((t.powers["SLUMBER"] ?? 0) > 0 ? "SNORE_MOVE" : "ROLL_OUT_MOVE"),
    },
    STUNNED: {
      shows: ["Stun"],
      effect: (t) => {
        delete t.powers["SLUMBER"];
        delete t.powers["PLATING"];
      },
      next: "ROLL_OUT_MOVE",
    },
    ROLL_OUT_MOVE: { damage: 18, shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 2), next: "ROLL_OUT_MOVE" },
  },
  // Exoskeleton (Hard to Kill 9): Skitter 1x4 -> Mandibles 9 -> Enrage (+2 Strength) -> RANDOM
  // (Skitter or Mandibles, 50/50, not twice running; logs 93 / 88): by the turn, one then the other,
  // the rolls' mean (always the bigger hit had the bouts losing 5-7 points more than the game).
  EXOSKELETON: {
    SKITTER_MOVE: { damage: 1, hits: 4, next: "MANDIBLES_MOVE" },
    MANDIBLES_MOVE: { damage: 9, next: "ENRAGE_MOVE" },
    ENRAGE_MOVE: {
      shows: ["Buff"],
      effect: (t) => add(t.powers, "STRENGTH", 2),
      next: (t) => (t.turn % 2 === 0 ? "SKITTER_MOVE" : "MANDIBLES_MOVE"),
    },
  },
  // Chomper (Artifact 2): Clamp 9x2 and Screech (3 Dazed into the discard pile), turn about.
  CHOMPER: {
    CLAMP_MOVE: { damage: 9, hits: 2, next: "SCREECH_MOVE" },
    SCREECH_MOVE: {
      shows: ["StatusCard"],
      effect: (t) => {
        for (let i = 0; i < 3; i++) t.discard.push(dazed());
      },
      next: "CLAMP_MOVE",
    },
  },
  // Myte: Toxic (2 Toxic into the player's hand), Bite 15, Suck 6 and +3 Strength, round.
  MYTE: {
    TOXIC_MOVE: { shows: ["StatusCard"], effect: (t) => void t.hand.push(toxic(), toxic()), next: "BITE_MOVE" },
    BITE_MOVE: { damage: 15, next: "SUCK_MOVE" },
    SUCK_MOVE: { damage: 6, shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 3), next: "TOXIC_MOVE" },
  },
  // Hunter Killer: Tenderizing Goop (Tender 1 on the player, for good: every card played that turn -1
  // Strength and Dexterity) first, then RANDOM for good: Bite 19 (not twice running) or Puncture 8x3
  // (not three times): after Bite, Puncture; after a second Puncture, Bite; else 50/50.
  HUNTER_KILLER: {
    TENDERIZING_GOOP_MOVE: { shows: ["Debuff"], effect: (t) => add(t.player, "TENDER", 1), next: "PUNCTURE_MOVE" },
    BITE_MOVE: { damage: 19, next: "PUNCTURE_MOVE" },
    PUNCTURE_MOVE: { damage: 8, hits: 3, next: "BITE_MOVE" },
  },
  // Spiny Toad: Protruding Spikes (+5 Thorns), Spike Explosion 25 (the Thorns off after it), Tongue
  // Lash 19, round: the Thorns are up the whole player turn that shows the Explosion.
  SPINY_TOAD: {
    PROTRUDING_SPIKES_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "THORNS", 5), next: "SPIKE_EXPLOSION_MOVE" },
    SPIKE_EXPLOSION_MOVE: { damage: 25, effect: (t) => add(t.powers, "THORNS", -5), next: "TONGUE_LASH_MOVE" },
    TONGUE_LASH_MOVE: { damage: 19, next: "PROTRUDING_SPIKES_MOVE" },
  },
  // Louse Progenitor (Curl Up 18): Web Cannon 10 and Frail 2, Curl and Grow (18 block, +7 Strength),
  // Pounce 16, round.
  LOUSE_PROGENITOR: {
    WEB_CANNON_MOVE: { damage: 10, shows: ["Debuff"], effect: (t) => add(t.player, "FRAIL", 2), next: "CURL_AND_GROW_MOVE" },
    CURL_AND_GROW_MOVE: {
      shows: ["Defend", "Buff"],
      effect: (t) => {
        t.block += 18;
        add(t.powers, "STRENGTH", 7);
      },
      next: "POUNCE_MOVE",
    },
    POUNCE_MOVE: { damage: 16, next: "WEB_CANNON_MOVE" },
  },
  // The Obscura: Illusion first (a Parafright summoned: not modelled here), then RANDOM for good, none
  // twice running (1/3 each after Illusion, else 50/50 of the other two): Piercing Gaze 11, Wail (+3
  // Strength to it and every other enemy), Hardening Strike 7 and 7 block.
  THE_OBSCURA: {
    ILLUSION_MOVE: { shows: ["Summon"], next: "PIERCING_GAZE_MOVE" },
    PIERCING_GAZE_MOVE: { damage: 11, next: "HARDENING_STRIKE_MOVE" },
    SAIL_MOVE: {
      shows: ["Buff"],
      effect: (t) => {
        add(t.powers, "STRENGTH", 3);
        add(t.allyPowers, "STRENGTH", 3);
      },
      next: "PIERCING_GAZE_MOVE",
    },
    HARDENING_STRIKE_MOVE: { damage: 7, shows: ["Defend"], effect: (t) => void (t.block += 7), next: "PIERCING_GAZE_MOVE" },
  },
  // Parafright (Illusion, Minion): Slam 17 for good; killed, it revives to full at once (not modelled).
  PARAFRIGHT: {
    SLAM_MOVE: { damage: 17, next: "SLAM_MOVE" },
    REVIVE_MOVE: { shows: ["Heal"], next: "SLAM_MOVE" },
  },
  // Thieving Hopper (Escape Artist 5): Thievery 19 (and a card of the deck stolen: not modelled),
  // Flutter (5 stacks: half damage taken, a stack off for every hit that takes HP, the last a stun:
  // sim.ts hit), Hat Trick 23, Nab 16, Escape.
  THIEVING_HOPPER: {
    THIEVERY_MOVE: { damage: 19, shows: ["CardDebuff"], next: "FLUTTER_MOVE" },
    FLUTTER_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "FLUTTER", 5), next: "HAT_TRICK_MOVE" },
    HAT_TRICK_MOVE: { damage: 23, next: "NAB_MOVE" },
    NAB_MOVE: { damage: 16, next: "ESCAPE_MOVE" },
    ESCAPE_MOVE: { shows: ["Escape"], next: "ESCAPE_MOVE" },
    STUNNED: { shows: ["Stun"], next: (t) => HOPPER_CHAIN[Math.min(t.turn, HOPPER_CHAIN.length - 1)]! },
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
  // The Insatiable (IL: TheInsatiable.GenerateMoveStateMachine): Liquify Ground once (Sandpit 4 on
  // itself; six Frantic Escapes, three shuffled into the draw pile and three into the discard), then
  // Thrash 9x2, Lunging Bite 31, Salivate (+3 Strength), Thrash 9x2 again, round and round.
  THE_INSATIABLE: {
    LIQUIFY_GROUND_MOVE: {
      shows: ["Buff", "StatusCard"],
      effect: (t) => {
        add(t.powers, "SANDPIT", 4);
        for (let i = 0; i < 6; i++) (i < 3 ? t.draw : t.discard).push(status("FRANTIC_ESCAPE", {}, []));
      },
      next: "THRASH_MOVE",
    },
    THRASH_MOVE: { damage: 9, hits: 2, next: "LUNGING_BITE_MOVE" },
    LUNGING_BITE_MOVE: { damage: 31, next: "SALIVATE_MOVE" },
    SALIVATE_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 3), next: "THRASH_MOVE_2" },
    THRASH_MOVE_2: { damage: 9, hits: 2, next: "THRASH_MOVE" },
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
  // The Queen (IL: Queen.GenerateMoveStateMachine): Puppet Strings, You Are Mine, then Burn Bright
  // for Me every turn while the Torch Head Amalgam lives; once it is dead, Off with Your Head,
  // Execution, Enrage over and over. Its death with Burn Bright shown turns that into Enrage at once
  // (Queen.AfterDeath: sim.ts died).
  QUEEN: {
    PUPPET_STRINGS_MOVE: { shows: ["CardDebuff"], effect: (t) => add(t.player, "CHAINS_OF_BINDING", 3), next: "YOU_ARE_MINE_MOVE" },
    YOU_ARE_MINE_MOVE: {
      shows: ["Debuff"],
      effect: (t) => {
        for (const d of ["FRAIL", "WEAK", "VULNERABLE"]) add(t.player, d, 99);
      },
      next: (t) => (torchAlive(t) ? "BURN_BRIGHT_FOR_ME_MOVE" : "OFF_WITH_YOUR_HEAD_MOVE"),
    },
    // 1 Strength to every teammate but herself, then 20 block on her.
    BURN_BRIGHT_FOR_ME_MOVE: {
      shows: ["Buff", "Defend"],
      effect: (t) => {
        add(t.allyPowers, "STRENGTH", 1);
        t.block += 20;
      },
      next: (t) => (torchAlive(t) ? "BURN_BRIGHT_FOR_ME_MOVE" : "OFF_WITH_YOUR_HEAD_MOVE"),
    },
    OFF_WITH_YOUR_HEAD_MOVE: { damage: 4, hits: 5, next: "EXECUTION_MOVE" },
    EXECUTION_MOVE: { damage: 18, next: "ENRAGE_MOVE" },
    ENRAGE_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 2), next: "OFF_WITH_YOUR_HEAD_MOVE" },
  },
  // A minion of the Queen's (IL: TorchHeadAmalgam): Strong Tackle and Tackle once, then Beam and two
  // Weak Tackles over and over.
  TORCH_HEAD_AMALGAM: {
    STRONG_TACKLE_MOVE: { damage: 32, next: "TACKLE_2_MOVE" },
    TACKLE_2_MOVE: { damage: 22, next: "BEAM_MOVE" },
    BEAM_MOVE: { damage: 8, hits: 3, next: "TACKLE_3_MOVE" },
    TACKLE_3_MOVE: { damage: 16, next: "TACKLE_4_MOVE" },
    TACKLE_4_MOVE: { damage: 16, next: "BEAM_MOVE" },
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
  THE_INSATIABLE: "LIQUIFY_GROUND_MOVE",
  CRUSHER: "THRASH_MOVE", ROCKET: "TARGETING_RETICLE_MOVE", TEST_SUBJECT: "BITE_MOVE", AEONGLASS: "EBB_MOVE",
  QUEEN: "PUPPET_STRINGS_MOVE", TORCH_HEAD_AMALGAM: "STRONG_TACKLE_MOVE",
};

export const scripted = (e: Enemy): boolean => e.move !== undefined && SCRIPTS[e.model]?.[e.move] !== undefined;

/**
 * The intents a move shows: its damage with the enemy's Strength, times the player's Vulnerable, the
 * enemy's Weak and a claw's back attack, as the game computes them; `hits` for Multi Claw's count.
 */
export function moveIntents(model: string, move: string, strength: number, mult: { vulnerable: boolean; weak: boolean; behind: boolean; shrink?: number }, hits?: number): IntentObs[] {
  const m = SCRIPTS[model]?.[move];
  if (!m) return [];
  const out: IntentObs[] = [];
  if (m.damage !== undefined) {
    // Shrink (Beetle Juice): the game shows the attack its DamageDecrease share less (ts-f32: the Crab's
    // next attacks at 0.7 of the prediction while it lasted).
    const per = Math.max(0, m.damage + strength) * (mult.vulnerable ? 1.5 : 1) * (mult.weak ? 0.75 : 1) * (mult.behind ? 1.5 : 1) * (1 - (mult.shrink ?? 0));
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
