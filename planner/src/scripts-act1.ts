/**
 * Act 1's elites and hallway monsters' move scripts at A10, from the game's IL (each one's
 * GenerateMoveStateMachine and its powers' hooks; beta v0.111.0), merged into scripts.ts's SCRIPTS:
 * turn.ts nextTurn plays them, so a look ahead meets their real next move and what it does (the
 * Bygone Effigy's +10 Strength, the Wrigglers' +2, Byrdonis's Territorial) where intents.ts guessed
 * an attack by the turn number.
 *
 * Where the game rolls (RandomBranchState), the entry says the rule exactly in a comment and gives
 * the deterministic guess, marked RANDOM (weights as the IL has them; CannotRepeat: not the move just
 * made; CanRepeatXTimes N: not an (N+1)-th time running; UseOnlyOnce: never again once in the log;
 * cooldown N: not if among the last N moves). What the game does that EnemyTurn cannot carry (a summon,
 * a stolen card or gold, a memory of past moves, the player's block) is marked NEEDS.
 *
 * The StateLog a roll looks at holds the moves as they were rolled; a stun (CreatureCmd.Stun) puts
 * STUNNED in place of the move shown without logging it, and the move after it is the one named, or
 * (none named) the move it replaced, logged a second time.
 *
 * Act 1 is two acts in this beta: Overgrowth (Bygone Effigy, Byrdonis, Phrog Parasite elites) and
 * Underdocks (Phantasmal Gardeners, Skulking Colony, Terror Eel elites).
 *
 * Checked (a background agent's act1check.ts, 2026-09-28) against the intents of the 11,701 act 1
 * fights (floors 1-16) of every planner/runs/*a10* file, deduplicated: all 58,572 monster turns are
 * ones the machines below allow, with their damage as shown (Strength, Vigor, Vulnerable, Weak,
 * Colossus), every stun by its cause (Shriek, Ravenous), every summon by its spawn move. Ambergris
 * (the player's extra turn) skips the enemies' turn whole; a stun or death after the sighting
 * (Stampede's attack at the turn's end, Thorns in the enemies' turn) makes the move shown not come.
 */

import type { Card, Enemy } from "./sim.ts";
import type { EnemyTurn } from "./scripts.ts";

interface Move {
  damage?: number;
  hits?: number;
  shows?: readonly string[];
  effect?: (t: EnemyTurn, e: Enemy) => void;
  next: string | ((t: EnemyTurn, e: Enemy) => string);
}

const add = (p: Record<string, number>, k: string, n: number) => {
  p[k] = (p[k] ?? 0) + n;
  if (p[k] === 0) delete p[k];
};
const card = (id: string, cost: number, keywords: string[], vars: Record<string, number>): Card => ({
  id, cost, costsX: false, type: "Status", target: "None", keywords, vars, upgrades: 0, locked: false, glows: false,
});
/** Dazed (IL: Dazed ctor cost -1; keywords Ethereal, Unplayable). */
const dazed = () => card("DAZED", -1, ["Ethereal", "Unplayable"], {});
/**
 * Infection (IL: Infection ctor cost -1, Unplayable; OnTurnEndInHand: 3 damage to its owner, props
 * Move|Unpowered: into block). sim.ts hpLoss takes a Status card's Damage at the turn's end already.
 */
const infection = () => card("INFECTION", -1, ["Unplayable"], { Damage: 3 });
/** Slimed (IL: Slimed ctor cost 1, Exhaust; OnPlay: draw 1 card, CardsVar 1). */
const slimed = () => card("SLIMED", 1, ["Exhaust"], { Cards: 1 });
/**
 * Plating on an enemy (IL: PlatingPower): its amount in block at the player's first turn start
 * (SETUP block), a stack off as the enemies' turn starts from round 2 (AfterSideTurnStart), its
 * amount in block at the enemies' turn end (BeforeSideTurnEndEarly). turn.ts counts it down only
 * for a sleeper, so the Sewer Clam's moves do it here (the Slumbering Beetle's Snore the same way).
 */
const plating = (t: EnemyTurn) => {
  if (t.turn >= 2 && (t.powers["PLATING"] ?? 0) > 0) add(t.powers, "PLATING", -1);
  t.block += Math.max(0, t.powers["PLATING"] ?? 0);
};
/** Suck (Fossil Stalker): +3 Strength a hit past the player's block; NEEDS the block, so every hit counts. */
const suck = (t: EnemyTurn, hits: number) => add(t.powers, "STRENGTH", (t.powers["SUCK"] ?? 3) * hits);
/** A 50/50 roll as the rolls' mean: one way on even turns, the other on odd (the repo's Exoskeleton). */
const byTurn = (t: EnemyTurn, even: string, odd: string) => (t.turn % 2 === 0 ? even : odd);

/**
 * The Wriggler's slot (IL: InfestedPower.AfterDeath adds four, wriggler1..wriggler4, in order): 0-3.
 * They take the ids after the Parasite's (the game's combat ids: the Parasite 1, the Wriggler 2-5 in
 * our logs; sim.ts died the same); with the Parasite gone from the state, its id is taken as 1.
 */
function wrigglerSlot(t: EnemyTurn, e: Enemy): number {
  const phrog = t.allies.find((a) => a.model === "PHROG_PARASITE")?.id ?? 1;
  return (((e.id - phrog - 1) % 4) + 4) % 4;
}

/**
 * Two-Tailed Rat (IL: TwoTailedRat.CanSummon): Call for Backup can come when its own counter
 * (TurnsUntilSummonable, 2 at its creation, one off for each Scratch, Disease Bite or Screech it makes)
 * is down, fewer than 3 calls have been made in the fight (CallForBackupCount, every rat's set to the
 * highest + 1 at a call), the encounter has a free slot (five: fewer than five rats), and no other rat
 * has Call for Backup as its next move at this roll (so one call a turn: the rats roll in turn order,
 * the first able one takes it about 85% of the time). NEEDS: the counters and who has called. Guess:
 * the first three rats (ids 1-3) are ready from their third move (turn >= 2 at this roll) and call in
 * id order; the calls made are the highest rat id over 3 (the called ones get ids 4, 5, 6) and the
 * ones showing Summon now; the first rat alive past those is the one to call.
 */
function ratCanCall(t: EnemyTurn, e: Enemy): boolean {
  if (e.id > 3 || t.turn < 2 || e.intents.some((i) => i.type === "Summon")) return false;
  const rats = [e, ...t.allies.filter((a) => a.model === "TWO_TAILED_RAT")];
  const summoning = rats.filter((r) => r !== e && r.alive && r.intents.some((i) => i.type === "Summon"));
  const done = Math.max(3, ...rats.map((r) => r.id)) - 3;
  const calls = done + summoning.length;
  const alive = rats.filter((r) => r === e || r.alive).length + summoning.length;
  if (calls >= 3 || alive >= 5) return false;
  const called = (r: Enemy) => r.id <= done || summoning.includes(r);
  const next = rats.filter((r) => r.id <= 3 && (r === e || r.alive) && !called(r)).sort((a, b) => a.id - b.id)[0];
  return next === e;
}

export const ACT1_SCRIPTS: Record<string, Record<string, Move>> = {
  // ===================== ELITES =====================
  // Bygone Effigy (IL: BygoneEffigy; HP 132; Slow 1 from AfterAddedToRoom). Sleeps turn 1 (SLEEP_MOVE,
  // Sleep intent, does nothing), Wake turn 2 (+10 Strength), then Slashes 15 (+10 = 25) every turn for
  // good. Nothing wakes it early (no damage hook). SLEEP_MOVE_2 (Sleep, then Slashes) is never reached.
  // Slow (SlowPower): every card played (by anyone, AfterCardPlayed) adds 10% to the powered attack
  // damage it takes this turn, back to 0 as its side's turn starts (sim.ts already: s.played).
  // Logs: 806 of 806 turns as scripted, Strength 10 from turn 3 in every fight the player did not touch.
  BYGONE_EFFIGY: {
    SLEEP_MOVE: { shows: ["Sleep"], next: "WAKE_MOVE" },
    WAKE_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 10), next: "SLASHES_MOVE" },
    SLASHES_MOVE: { damage: 15, next: "SLASHES_MOVE" },
    SLEEP_MOVE_2: { shows: ["Sleep"], next: "SLASHES_MOVE" },
  },
  // Phrog Parasite (IL: PhrogParasite; HP 66-68; Infested 4). Infect (3 Infection into the discard
  // pile, AddToCombatAndPreview<Infection>(Discard, 3)) and Lash 5x4, turn about, Infect first (the RAND
  // it builds is wired to nothing). Infested (InfestedPower.AfterDeath): its death adds four Wrigglers
  // (slots wriggler1-4, StartStunned) and the fight goes on (ShouldStopCombatFromEnding); sim.ts died
  // adds them (WRIGGLER_HP 20 for 18-22). NEEDS: died to give them move SPAWNED_MOVE. Logs: 688 of 688
  // turns; 1,183 Wrigglers, each Stun (SPAWNED) the turn it came.
  PHROG_PARASITE: {
    INFECT_MOVE: {
      shows: ["StatusCard"],
      effect: (t) => {
        for (let i = 0; i < 3; i++) t.discard.push(infection());
      },
      next: "LASH_MOVE",
    },
    LASH_MOVE: { damage: 5, hits: 4, next: "INFECT_MOVE" },
  },
  // Wriggler (IL: Wriggler; HP 18-22). Out of the Parasite: SPAWNED_MOVE first (Stun intent, nothing)
  // on the turn it comes, then by slot (INIT_MOVE): wriggler1 and 3 Nasty Bite 7, wriggler2 and 4
  // Wriggle; then turn about. Wriggle: 1 Infection into the discard pile, then +2 Strength: the
  // Wrigglers grow 2 every other turn each (wriggler2 and 4 from their first move). Logs: 3,609 of 3,609
  // turns; the slot rule 2,426 of 2,426 steps.
  WRIGGLER: {
    SPAWNED_MOVE: { shows: ["Stun"], next: (t, e) => (wrigglerSlot(t, e) % 2 === 0 ? "NASTY_BITE_MOVE" : "WRIGGLE_MOVE") },
    NASTY_BITE_MOVE: { damage: 7, next: "WRIGGLE_MOVE" },
    WRIGGLE_MOVE: {
      shows: ["Buff", "StatusCard"],
      effect: (t) => {
        t.discard.push(infection());
        add(t.powers, "STRENGTH", 2);
      },
      next: "NASTY_BITE_MOVE",
    },
  },
  // Byrdonis (IL: Byrdonis; HP 90; Territorial 1). Swoop 19 first, then Peck 4x3, turn about.
  // Territorial (TerritorialPower.AfterSideTurnEnd): +1 Strength at every enemies' turn end, so turn
  // n shows (n - 1) more (turn.ts already adds TERRITORIAL's Strength each enemies' turn).
  BYRDONIS: {
    SWOOP_MOVE: { damage: 19, next: "PECK_MOVE" },
    PECK_MOVE: { damage: 4, hits: 3, next: "SWOOP_MOVE" },
  },
  // Terror Eel (IL: TerrorEel; HP 150; Shriek 75). Crash 18 and Thrash 4x3 (+ Vigor 6 on itself after
  // the hits: its next attack +6 on each hit, gone after it) turn about, Crash first. So every Crash
  // but the first shows 24 (+ Strength). Shriek (ShriekPower.AfterDamageReceived): the first hit with
  // HP lost that leaves it at or under 75 stuns it (CreatureCmd.Stun to TERROR_MOVE: the move it
  // showed gone) and Shriek goes; Terror next (99 Vulnerable on the player), then Crash (with any
  // Vigor left), Thrash... sim.ts hit clears its intents there. NEEDS: hit to set move = "STUNNED";
  // moveIntents / the enemies' attack to add the enemy's VIGOR to each hit (the game shows Crash 24).
  TERROR_EEL: {
    CRASH_MOVE: { damage: 18, effect: (t) => void delete t.powers["VIGOR"], next: "THRASH_MOVE" },
    THRASH_MOVE: { damage: 4, hits: 3, shows: ["Buff"], effect: (t) => add(t.powers, "VIGOR", 6), next: "CRASH_MOVE" },
    STUNNED: { shows: ["Stun"], next: "TERROR_MOVE" },
    // The machine's own STUN_MOVE (Stun intent, then Terror) is never set: the stun is CreatureCmd's.
    STUN_MOVE: { shows: ["Stun"], next: "TERROR_MOVE" },
    TERROR_MOVE: { shows: ["Debuff"], effect: (t) => add(t.player, "VULNERABLE", 99), next: "CRASH_MOVE" },
  },
  // Phantasmal Gardener (IL: PhantasmalGardener; HP 27-32; Skittish 7), four of them (slots first to
  // fourth). Bite 5, Lash 7, Flail 1x3, Enlarge (+3 Strength), round; first move by slot: first
  // Flail, second Bite, third Lash, fourth Enlarge. Skittish (SkittishPower): the first card attack a
  // turn that takes HP from it gives it 7 block (sim.ts already: skittishUsed).
  PHANTASMAL_GARDENER: {
    BITE_MOVE: { damage: 5, next: "LASH_MOVE" },
    LASH_MOVE: { damage: 7, next: "FLAIL_MOVE" },
    FLAIL_MOVE: { damage: 1, hits: 3, next: "ENLARGE_MOVE" },
    ENLARGE_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 3), next: "BITE_MOVE" },
  },
  // Skulking Colony (IL: SkulkingColony; HP 80; Hardened Shell 20). Zoom 16, Zoom 16 again (ZOOM_MOVE_2),
  // Inertia 11 and +4 Strength after it, Piercing Stabs 8x2, round. Hardened Shell
  // (HardenedShellPower.ModifyHpLostBeforeOstyLate): at most 20 HP lost a turn, the count back to 0 as
  // either side's turn starts (sim.ts already: shellTaken).
  SKULKING_COLONY: {
    ZOOM_MOVE: { damage: 16, next: "ZOOM_MOVE_2" },
    ZOOM_MOVE_2: { damage: 16, next: "INERTIA_MOVE" },
    INERTIA_MOVE: { damage: 11, shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 4), next: "PIERCING_STABS_MOVE" },
    PIERCING_STABS_MOVE: { damage: 8, hits: 2, next: "ZOOM_MOVE" },
  },

  // ===================== HALLWAY =====================
  // Corpse Slug (IL: CorpseSlug; HP 27-29; Ravenous 5). Whip Slap 3x2, Glomp 9, Goop (Frail 2 on the
  // player), round. First move: the encounter (Corpse Slugs, 2 or 3 of them) draws r in 0-2 and the
  // i-th slug starts at (r + i) % 3 of Whip Slap, Glomp, Goop (EnsureCorpseSlugsStartWithDifferentMoves).
  // Ravenous (RavenousPower.AfterDeath): any other enemy's death gives every slug alive +5 Strength and
  // stuns it (CreatureCmd.Stun, no move named: the move it showed comes next turn instead; a second
  // death the same turn adds the Strength, the stun stays one). sim.ts died already gives the Strength
  // and clears its intents. NEEDS: died to set move = "STUNNED" and keep the move it showed
  // (stunnedFrom here); without it, Glomp.
  CORPSE_SLUG: {
    WHIP_SLAP_MOVE: { damage: 3, hits: 2, next: "GLOMP_MOVE" },
    GLOMP_MOVE: { damage: 9, next: "GOOP_MOVE" },
    GOOP_MOVE: { shows: ["Debuff"], effect: (t) => add(t.player, "FRAIL", 2), next: "WHIP_SLAP_MOVE" },
    STUNNED: { shows: ["Stun"], next: (_t, e) => e.stunnedFrom ?? "GLOMP_MOVE" },
  },
  // Toadpole (IL: Toadpole; HP 22-26), two (Toadpoles Weak: the first IsFront). Whirl 8, Spiken (+2
  // Thorns), Spike Spit 4x3 (the 2 Thorns off before its hits), round; the front one starts with
  // Spiken, the other with Whirl. So the Thorns are up for the player turn that shows Spike Spit.
  TOADPOLE: {
    WHIRL_MOVE: { damage: 8, next: "SPIKEN_MOVE" },
    SPIKEN_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "THORNS", 2), next: "SPIKE_SPIT_MOVE" },
    SPIKE_SPIT_MOVE: { damage: 4, hits: 3, effect: (t) => add(t.powers, "THORNS", -2), next: "WHIRL_MOVE" },
  },
  // Nibbit (IL: Nibbit; HP 44-48). Slice 7 and 6 block, Hiss (+3 Strength), Butt 13, round. First move
  // (INIT_MOVE): alone (Nibbits Weak) Butt; of two (Nibbits Normal: front, back) the front Slice, the
  // back Hiss.
  NIBBIT: {
    SLICE_MOVE: { damage: 7, shows: ["Defend"], effect: (t) => void (t.block += 6), next: "HISS_MOVE" },
    HISS_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 3), next: "BUTT_MOVE" },
    BUTT_MOVE: { damage: 13, next: "SLICE_MOVE" },
  },
  // Seapunk (IL: Seapunk; HP 47-49). Sea Kick 13, Spinning Kick 2x4, Bubble Burp (8 block, +2
  // Strength), round, Sea Kick first.
  SEAPUNK: {
    SEA_KICK_MOVE: { damage: 13, next: "SPINNING_KICK_MOVE" },
    SPINNING_KICK_MOVE: { damage: 2, hits: 4, next: "BUBBLE_BURP_MOVE" },
    BUBBLE_BURP_MOVE: {
      shows: ["Buff", "Defend"],
      effect: (t) => {
        t.block += 8;
        add(t.powers, "STRENGTH", 2);
      },
      next: "SEA_KICK_MOVE",
    },
  },
  // Twig Slime S (IL: TwigSlimeS; HP 8-12): Tackle 5 every turn.
  TWIG_SLIME_S: {
    TACKLE_MOVE: { damage: 5, next: "TACKLE_MOVE" },
  },
  // Leaf Slime S (IL: LeafSlimeS; HP 12-16). Starts on RAND: Tackle 4 or Goop (1 Slimed into the discard
  // pile), weight 1 each, both CannotRepeat: the first 50/50, then turn about for good.
  LEAF_SLIME_S: {
    TACKLE_MOVE: { damage: 4, next: "GOOP_MOVE" },
    GOOP_MOVE: { shows: ["StatusCard"], effect: (t) => void t.discard.push(slimed()), next: "TACKLE_MOVE" },
  },
  // Twig Slime M (IL: TwigSlimeM; HP 27-29). Sticky Shot (1 Slimed into the discard pile) first, then
  // RAND for good: Clump Shot 12 (POKEY_POUNCE_MOVE; CanRepeatXTimes 2) or Sticky Shot (CannotRepeat),
  // weight 1 each: after Sticky, Clump; after one Clump 50/50; after two, Sticky.
  TWIG_SLIME_M: {
    STICKY_SHOT_MOVE: { shows: ["StatusCard"], effect: (t) => void t.discard.push(slimed()), next: "POKEY_POUNCE_MOVE" },
    // RANDOM: after a first Clump 50/50, after a second Sticky for sure; the id does not say which, so
    // Sticky (at least 50%).
    POKEY_POUNCE_MOVE: { damage: 12, next: "STICKY_SHOT_MOVE" },
  },
  // Leaf Slime M (IL: LeafSlimeM; HP 33-36). Sticky Shot (2 Slimed into the discard pile) first, then
  // Clump Shot 9, turn about.
  LEAF_SLIME_M: {
    STICKY_SHOT: {
      shows: ["StatusCard"],
      effect: (t) => {
        t.discard.push(slimed(), slimed());
      },
      next: "CLUMP_SHOT",
    },
    CLUMP_SHOT: { damage: 9, next: "STICKY_SHOT" },
  },
  // Shrinker Beetle (IL: ShrinkerBeetle; HP 40-42). Shrinker first (DebuffStrong: Shrink -1 on the
  // player, for good while the beetle lives: the player's attacks deal 30% less, ShrinkPower gone at
  // its applier's death, sim.ts APPLIED_BY), then Chomp 8 and Stomp 14 turn about.
  SHRINKER_BEETLE: {
    SHRINKER_MOVE: { shows: ["DebuffStrong"], effect: (t) => void (t.player["SHRINK"] = -1), next: "CHOMP_MOVE" },
    CHOMP_MOVE: { damage: 8, next: "STOMP_MOVE" },
    STOMP_MOVE: { damage: 14, next: "CHOMP_MOVE" },
  },
  // Fuzzy Wurm Crawler (IL: FuzzyWurmCrawler; HP 58-59). Acid Goop 6 (FIRST_ACID_GOOP), Inhale (+7
  // Strength), Acid Goop 6 (ACID_GOOP), round: +7 every third turn (6, Inhale, 13, 13, Inhale, 20...).
  FUZZY_WURM_CRAWLER: {
    FIRST_ACID_GOOP: { damage: 6, next: "INHALE" },
    INHALE: { shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 7), next: "ACID_GOOP" },
    ACID_GOOP: { damage: 6, next: "FIRST_ACID_GOOP" },
  },
  // Two-Tailed Rat (IL: TwoTailedRat; HP 18-22), three (slots third, fourth, fifth of five). Scratch 9,
  // Disease Bite 7, Screech (Frail 1 on the player), Call for Backup (a new rat in the last free slot).
  // First move: the encounter draws r in 0-2 and the i-th rat starts at (r + i) % 3 of Scratch, Disease
  // Bite, Screech; a called rat starts on RAND. RAND for good: Scratch and Disease Bite CannotRepeat,
  // Screech CannotRepeat with cooldown 3 (not if among its last 3 moves), weight 1 each (1/12 each
  // while it can summon); Call for Backup UseOnlyOnce, weight 0.75 while it can summon, else 0
  // (ratCanCall: then about 82-90%). NEEDS: the summon; the counters (ratCanCall's guess).
  TWO_TAILED_RAT: {
    // RANDOM: Disease Bite or Screech 50/50 (Screech not within 3 of the last): Disease Bite.
    SCRATCH_MOVE: { damage: 9, next: (t, e) => (ratCanCall(t, e) ? "CALL_FOR_BACKUP_MOVE" : "DISEASE_BITE_MOVE") },
    // RANDOM: Scratch or Screech: Scratch.
    DISEASE_BITE_MOVE: { damage: 7, next: (t, e) => (ratCanCall(t, e) ? "CALL_FOR_BACKUP_MOVE" : "SCRATCH_MOVE") },
    SCREECH_MOVE: {
      shows: ["Debuff"],
      effect: (t) => add(t.player, "FRAIL", 1),
      // RANDOM: Scratch or Disease Bite 50/50: by the turn.
      next: (t, e) => (ratCanCall(t, e) ? "CALL_FOR_BACKUP_MOVE" : byTurn(t, "SCRATCH_MOVE", "DISEASE_BITE_MOVE")),
    },
    // NEEDS: the rat it adds (HP 18-22, its first move RAND of the three). RANDOM: the three 1/3 each
    // (Screech not within 3): Scratch.
    CALL_FOR_BACKUP_MOVE: { shows: ["Summon"], next: "SCRATCH_MOVE" },
  },
  // Sludge Spinner (IL: SludgeSpinner; HP 41-42). Oil Spray 9 and Weak 1 first, then RAND for good:
  // Oil Spray, Slam 12, Rage 7 and +3 Strength after it, weight 1 each, all CannotRepeat (50/50 of
  // the other two).
  SLUDGE_SPINNER: {
    // RANDOM (50/50): by the turn.
    OIL_SPRAY_MOVE: { damage: 9, shows: ["Debuff"], effect: (t) => add(t.player, "WEAK", 1), next: (t) => byTurn(t, "SLAM_MOVE", "RAGE_MOVE") },
    SLAM_MOVE: { damage: 12, next: (t) => byTurn(t, "OIL_SPRAY_MOVE", "RAGE_MOVE") },
    RAGE_MOVE: { damage: 7, shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 3), next: (t) => byTurn(t, "OIL_SPRAY_MOVE", "SLAM_MOVE") },
  },
  // Inklet (IL: Inklet; HP 12-18; Slippery 1: the first hit that takes HP takes 1, sim.ts already),
  // three (Inklets Normal: the second is the middle one). Jab 4, then RAND: Piercing Gaze 11 or
  // Whirlwind 3x3 (weight 1 each, CannotRepeat: 50/50 after a Jab); either is followed by a Jab. The
  // middle one starts with Whirlwind, the others with Jab. (INIT_RAND is built but never used.)
  INKLET: {
    // RANDOM (50/50): by the turn.
    JAB_MOVE: { damage: 4, next: (t) => byTurn(t, "PIERCING_GAZE_MOVE", "WHIRLWIND_MOVE") },
    WHIRLWIND_MOVE: { damage: 3, hits: 3, next: "JAB_MOVE" },
    PIERCING_GAZE_MOVE: { damage: 11, next: "JAB_MOVE" },
  },
  // Calcified Cultist (IL: CalcifiedCultist; HP 39-42). Incantation (Ritual 2) first, then Dark Strike
  // 11 every turn. Ritual (RitualPower.AfterSideTurnEnd): +2 Strength at every enemies' turn end but the
  // one it was put on (WasJustAppliedByEnemy): Dark Strike 11, 13, 15... from turn 2. turn.ts adds a
  // RITUAL's amount at every enemies' turn end, this one too, so Incantation takes it off once here.
  CALCIFIED_CULTIST: {
    INCANTATION_MOVE: {
      shows: ["Buff"],
      effect: (t) => {
        add(t.powers, "RITUAL", 2);
        add(t.powers, "STRENGTH", -2);
      },
      next: "DARK_STRIKE_MOVE",
    },
    DARK_STRIKE_MOVE: { damage: 11, next: "DARK_STRIKE_MOVE" },
  },
  // Damp Cultist (IL: DampCultist; HP 52-54): the same with Ritual 6 and Dark Strike 3 (3, 9, 15...).
  DAMP_CULTIST: {
    INCANTATION_MOVE: {
      shows: ["Buff"],
      effect: (t) => {
        add(t.powers, "RITUAL", 6);
        add(t.powers, "STRENGTH", -6);
      },
      next: "DARK_STRIKE_MOVE",
    },
    DARK_STRIKE_MOVE: { damage: 3, next: "DARK_STRIKE_MOVE" },
  },
  // Flyconid (IL: Flyconid; HP 51-53). Starts on INITIAL: Frail Spores 9 and Frail 2 (cooldown 2) or
  // Smash 12, 50/50; then RAND for good: Vulnerable Spores (Vulnerable 2; cooldown 3: not if among its
  // last 3 moves), Frail Spores (cooldown 2: not among the last 2), Smash (CannotRepeat), weight 1 each.
  // With every weight 0 the first branch comes (RandomBranchState.GetNextState: NextFloat(0) is 0):
  // after Vulnerable Spores, Frail Spores, Smash it is Vulnerable Spores again. So after Smash it is
  // the spores not used just before it (the other one's cooldown blocks it), 50/50 only after a
  // first-move Smash; after either spores, Smash for sure or 50/50. NEEDS: its last moves. Guess after
  // Smash: the spores whose debuff the player does not have (Vulnerable 2 / Frail 2 from the move before
  // Smash are still up next turn; nothing else in its encounters gives them).
  FLYCONID: {
    // RANDOM: Smash for sure after Frail Spores then Vulnerable; else 50/50 with Frail Spores: Smash.
    VULNERABLE_SPORES_MOVE: { shows: ["Debuff"], effect: (t) => add(t.player, "VULNERABLE", 2), next: "SMASH_MOVE" },
    // RANDOM: Smash for sure with Vulnerable Spores among the last 3; else 50/50: Smash.
    FRAIL_SPORES_MOVE: { damage: 9, shows: ["Debuff"], effect: (t) => add(t.player, "FRAIL", 2), next: "SMASH_MOVE" },
    SMASH_MOVE: {
      damage: 12,
      next: (t) => ((t.player["VULNERABLE"] ?? 0) > 0 && (t.player["FRAIL"] ?? 0) <= 0 ? "FRAIL_SPORES_MOVE" : "VULNERABLE_SPORES_MOVE"),
    },
  },
  // Sewer Clam (IL: SewerClam; HP 58; Plating 9). Jet 11 first, then Pressurize (+4 Strength), turn
  // about. Plating: 9 block at the player's first turn (SETUP), then its amount at every enemies' turn
  // end, a stack off from its second turn on (plating()).
  SEWER_CLAM: {
    JET_MOVE: { damage: 11, effect: (t) => plating(t), next: "PRESSURIZE_MOVE" },
    PRESSURIZE_MOVE: {
      shows: ["Buff"],
      effect: (t) => {
        add(t.powers, "STRENGTH", 4);
        plating(t);
      },
      next: "JET_MOVE",
    },
  },
  // Fossil Stalker (IL: FossilStalker; HP 54-56; Suck 3). Latch 14 first, then RAND for good: Tackle 11
  // and Frail 1, Latch, Lash 4x2, weight 1 each, all CanRepeatXTimes 2 (not a third time running).
  // Suck (SuckPower.AfterAttack): +3 Strength for every hit of its attack that got past the player's
  // block (logs: 315 of 324 attacks as the rule has it; 230 of them had every hit through). NEEDS:
  // the player's block (EnemyTurn has none): every hit taken as through here (suck()).
  FOSSIL_STALKER: {
    // RANDOM (1/3 each, or 1/2 after two running): by the turn.
    LATCH_MOVE: { damage: 14, effect: (t) => suck(t, 1), next: (t) => byTurn(t, "TACKLE_MOVE", "LASH_MOVE") },
    TACKLE_MOVE: {
      damage: 11, shows: ["Debuff"],
      effect: (t) => {
        suck(t, 1);
        add(t.player, "FRAIL", 1);
      },
      next: (t) => byTurn(t, "LATCH_MOVE", "LASH_MOVE"),
    },
    LASH_MOVE: { damage: 4, hits: 2, effect: (t) => suck(t, 2), next: (t) => byTurn(t, "LATCH_MOVE", "TACKLE_MOVE") },
  },
  // Punch Construct (IL: PunchConstruct; HP 60; Artifact 1). Ready (10 block), Fast Punch 6x2 and Frail
  // 1, Strong Punch 16, round; Ready first (the Punch Off event's pair: the first starts with Fast
  // Punch, both 2-9 HP down).
  PUNCH_CONSTRUCT: {
    READY_MOVE: { shows: ["Defend"], effect: (t) => void (t.block += 10), next: "FAST_PUNCH_MOVE" },
    FAST_PUNCH_MOVE: { damage: 6, hits: 2, shows: ["Debuff"], effect: (t) => add(t.player, "FRAIL", 1), next: "STRONG_PUNCH_MOVE" },
    STRONG_PUNCH_MOVE: { damage: 16, next: "READY_MOVE" },
  },
  // Snapping Jaxfruit (IL: SnappingJaxfruit; HP 34-36): Energy Orb 4 and +2 Strength after it, every
  // turn (4, 6, 8...).
  SNAPPING_JAXFRUIT: {
    ENERGY_ORB_MOVE: { damage: 4, shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 2), next: "ENERGY_ORB_MOVE" },
  },
  // Gremlin Merc (IL: GremlinMerc; HP 51-53; Surprise, Thievery 20). Gimme 8x2, Double Smash 7x2 and
  // Weak 2, Hehe 9 and +2 Strength, round; every one also steals min(20, gold) gold (ThieveryPower.Steal,
  // once a move). Surprise (SurprisePower.AfterDeath): its death adds a Fat Gremlin (holding the gold
  // stolen, HeistPower) and a Sneaky Gremlin, and the fight goes on. NEEDS: the two summons, the gold.
  GREMLIN_MERC: {
    GIMME_MOVE: { damage: 8, hits: 2, next: "DOUBLE_SMASH_MOVE" },
    DOUBLE_SMASH_MOVE: { damage: 7, hits: 2, shows: ["Debuff"], effect: (t) => add(t.player, "WEAK", 2), next: "HEHE_MOVE" },
    HEHE_MOVE: { damage: 9, shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 2), next: "GIMME_MOVE" },
  },
  // Fat Gremlin (IL: FatGremlin; HP 14-18): SPAWNED_MOVE (Stun intent, nothing) the turn it comes, then
  // Flee (Escape) every turn: it leaves with the gold if not killed.
  FAT_GREMLIN: {
    SPAWNED_MOVE: { shows: ["Stun"], next: "FLEE_MOVE" },
    FLEE_MOVE: { shows: ["Escape"], next: "FLEE_MOVE" },
  },
  // Sneaky Gremlin (IL: SneakyGremlin; HP 11-15): SPAWNED_MOVE, then Tackle 10 every turn.
  SNEAKY_GREMLIN: {
    SPAWNED_MOVE: { shows: ["Stun"], next: "TACKLE_MOVE" },
    TACKLE_MOVE: { damage: 10, next: "TACKLE_MOVE" },
  },
  // Vine Shambler (IL: VineShambler; HP 64). Swipe 7x2, Grasping Vines 9 and Tangled 1 (the player's
  // attacks cost 1 more for the next turn, TangledPower gone at the player's turn end), Chomp 18,
  // round, Swipe first. NEEDS (sim): Tangled's cost.
  VINE_SHAMBLER: {
    SWIPE_MOVE: { damage: 7, hits: 2, next: "GRASPING_VINES_MOVE" },
    GRASPING_VINES_MOVE: { damage: 9, shows: ["CardDebuff"], effect: (t) => add(t.player, "TANGLED", 1), next: "CHOMP_MOVE" },
    CHOMP_MOVE: { damage: 18, next: "SWIPE_MOVE" },
  },
  // Living Fog (IL: LivingFog; HP 82). Advanced Gas 9 and Smoggy (for good: once the player plays a
  // Skill in a turn the other Skills are Smog-locked for that turn) first, then Bloat 6 (first a Gas
  // Bomb into the next free slot, BloatAmount 1) and Super Gas Blast 9 turn about. NEEDS: the bomb;
  // Smoggy's lock (sim).
  LIVING_FOG: {
    ADVANCED_GAS_MOVE: { damage: 9, shows: ["CardDebuff"], effect: (t) => void (t.player["SMOGGY"] = 1), next: "BLOAT_MOVE" },
    BLOAT_MOVE: { damage: 6, shows: ["Summon"], next: "SUPER_GAS_BLAST_MOVE" },
    SUPER_GAS_BLAST_MOVE: { damage: 9, next: "BLOAT_MOVE" },
  },
  // Gas Bomb (IL: GasBomb; HP 8; Minion). Explode (DeathBlow intent, 9) on its first turn, then it
  // kills itself (CreatureCmd.Kill). NEEDS: the intent type (DeathBlow, shown as an attack here) and the
  // death.
  GAS_BOMB: {
    EXPLODE_MOVE: { damage: 9, next: "EXPLODE_MOVE" },
  },
  // Haunted Ship (IL: HauntedShip; HP 67). Haunt first (Weak 3 on the player, 5 Dazed into the discard
  // pile), then Swipe 14 and Stomp 5x3 turn about.
  HAUNTED_SHIP: {
    HAUNT_MOVE: {
      shows: ["Debuff", "StatusCard"],
      effect: (t) => {
        add(t.player, "WEAK", 3);
        for (let i = 0; i < 5; i++) t.discard.push(dazed());
      },
      next: "SWIPE_MOVE",
    },
    SWIPE_MOVE: { damage: 14, next: "STOMP_MOVE" },
    STOMP_MOVE: { damage: 5, hits: 3, next: "SWIPE_MOVE" },
  },
  // Mawler (IL: Mawler; HP 76). Claw 5x2 first, then RAND for good: Rip and Tear 16 (CannotRepeat), Roar
  // (Vulnerable 3; UseOnlyOnce), Claw (CannotRepeat), weight 1 each. NEEDS: whether it has roared.
  MAWLER: {
    // RANDOM: Rip and Tear or (not yet) Roar: Rip and Tear.
    CLAW_MOVE: { damage: 5, hits: 2, next: "RIP_AND_TEAR_MOVE" },
    // RANDOM: Claw or (not yet) Roar: Claw.
    RIP_AND_TEAR_MOVE: { damage: 16, next: "CLAW_MOVE" },
    // RANDOM (50/50): by the turn.
    ROAR_MOVE: { shows: ["Debuff"], effect: (t) => add(t.player, "VULNERABLE", 3), next: (t) => byTurn(t, "RIP_AND_TEAR_MOVE", "CLAW_MOVE") },
  },
  // Crossbow Ruby Raider (IL: CrossbowRubyRaider; HP 19-22). Reload (3 block) first, then Fire 16, turn
  // about.
  CROSSBOW_RUBY_RAIDER: {
    RELOAD_MOVE: { shows: ["Defend"], effect: (t) => void (t.block += 3), next: "FIRE_MOVE" },
    FIRE_MOVE: { damage: 16, next: "RELOAD_MOVE" },
  },
  // Cubex Construct (IL: CubexConstruct; HP 70; Artifact 1; 13 block from AfterAddedToRoom, gone by the
  // player's first turn in every log). Charge Up
  // (+2 Strength), then Repeater Blast 8 (+2 Strength after the hit), Repeater Blast again
  // (REPEATER_BLAST_MOVE_2), Expel 6x2, and back to Repeater Blast: +2 a Blast (10, 12, 12x2, 14, 16,
  // 16x2...).
  CUBEX_CONSTRUCT: {
    CHARGE_UP_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 2), next: "REPEATER_BLAST_MOVE" },
    REPEATER_BLAST_MOVE: { damage: 8, shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 2), next: "REPEATER_BLAST_MOVE_2" },
    REPEATER_BLAST_MOVE_2: { damage: 8, shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 2), next: "EXPEL_MOVE" },
    EXPEL_MOVE: { damage: 6, hits: 2, next: "REPEATER_BLAST_MOVE" },
  },
  // Tracker Ruby Raider (IL: TrackerRubyRaider; HP 22-26). Track (Frail 2) first, then Hounds 1x9 for
  // good.
  TRACKER_RUBY_RAIDER: {
    TRACK_MOVE: { shows: ["Debuff"], effect: (t) => add(t.player, "FRAIL", 2), next: "HOUNDS_MOVE" },
    HOUNDS_MOVE: { damage: 1, hits: 9, next: "HOUNDS_MOVE" },
  },
  // Fogmog (IL: Fogmog; HP 78). Illusion first (an Eye With Teeth into the "illusion" slot), Swipe 9 and
  // +1 Strength after it, then BRANCH: Swipe again (SWIPE_RANDOM_MOVE, weight 0.4) or Headbutt 16
  // (0.6), both CannotRepeat (never blocking: the last move is SWIPE_MOVE); Swipe again is followed by
  // Headbutt, Headbutt by Swipe. NEEDS: the summon.
  FOGMOG: {
    ILLUSION_MOVE: { shows: ["Summon"], next: "SWIPE_MOVE" },
    // RANDOM (0.4 Swipe / 0.6 Headbutt): Headbutt.
    SWIPE_MOVE: { damage: 9, shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 1), next: "HEADBUTT_MOVE" },
    SWIPE_RANDOM_MOVE: { damage: 9, shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 1), next: "HEADBUTT_MOVE" },
    HEADBUTT_MOVE: { damage: 16, next: "SWIPE_MOVE" },
  },
  // Eye With Teeth (IL: EyeWithTeeth; HP 6; Illusion, which gives Minion): Distract (3 Dazed into the
  // discard pile) every turn. Killed, it stays, untargetable, on REVIVE_MOVE (Heal intent: back to full
  // on its turn, then Distract); the fight is won when the Fogmog dies. NEEDS: the revive (as the
  // Parafright's).
  EYE_WITH_TEETH: {
    DISTRACT_MOVE: {
      shows: ["StatusCard"],
      effect: (t) => {
        for (let i = 0; i < 3; i++) t.discard.push(dazed());
      },
      next: "DISTRACT_MOVE",
    },
    REVIVE_MOVE: { shows: ["Heal"], next: "DISTRACT_MOVE" },
  },
  // Brute Ruby Raider (IL: BruteRubyRaider; HP 31-34). Beat 8 first, then Roar (+3 Strength), turn about.
  BRUTE_RUBY_RAIDER: {
    BEAT_MOVE: { damage: 8, next: "ROAR_MOVE" },
    ROAR_MOVE: { shows: ["Buff"], effect: (t) => add(t.powers, "STRENGTH", 3), next: "BEAT_MOVE" },
  },
  // Assassin Ruby Raider (IL: AssassinRubyRaider; HP 19-24): Killshot 11 every turn.
  ASSASSIN_RUBY_RAIDER: {
    KILLSHOT_MOVE: { damage: 11, next: "KILLSHOT_MOVE" },
  },
  // Axe Ruby Raider (IL: AxeRubyRaider; HP 21-23). Swing 6 and 6 block (SWING_1), Swing again (SWING_2),
  // Big Swing 13, round.
  AXE_RUBY_RAIDER: {
    SWING_1: { damage: 6, shows: ["Defend"], effect: (t) => void (t.block += 6), next: "SWING_2" },
    SWING_2: { damage: 6, shows: ["Defend"], effect: (t) => void (t.block += 6), next: "BIG_SWING" },
    BIG_SWING: { damage: 13, next: "SWING_1" },
  },
  // Slithering Strangler (IL: SlitheringStrangler; HP 54-56). Constrict (Constrict 3 on the player,
  // stacking: at the player's turn end that much damage into block, for good while the strangler
  // lives, sim.ts hpLoss / APPLIED_BY) first, then "rand" (CanRepeatForever, weight 1 each): Thwack 8 and
  // 5 block, or Lash 13; either is followed by Constrict.
  SLITHERING_STRANGLER: {
    // RANDOM (50/50): by the turn.
    CONSTRICT: { shows: ["Debuff"], effect: (t) => add(t.player, "CONSTRICT", 3), next: (t) => byTurn(t, "THWACK", "LASH") },
    THWACK: { damage: 8, shows: ["Defend"], effect: (t) => void (t.block += 5), next: "CONSTRICT" },
    LASH: { damage: 13, next: "CONSTRICT" },
  },
};

/** First moves (A10). A slot-dependent monster's entry is by its place in the encounter (0-based). */
export const ACT1_OPENING: Record<string, string | readonly string[]> = {
  BYGONE_EFFIGY: "SLEEP_MOVE", PHROG_PARASITE: "INFECT_MOVE", BYRDONIS: "SWOOP_MOVE", TERROR_EEL: "CRASH_MOVE",
  // Slots first to fourth.
  PHANTASMAL_GARDENER: ["FLAIL_MOVE", "BITE_MOVE", "LASH_MOVE", "ENLARGE_MOVE"],
  SKULKING_COLONY: "ZOOM_MOVE",
  // Out of the Parasite: stunned the turn it comes.
  WRIGGLER: "SPAWNED_MOVE",
  // RANDOM (r in 0-2, then each slug the move after the one before's): Whip Slap, Glomp, Goop.
  CORPSE_SLUG: ["WHIP_SLAP_MOVE", "GLOMP_MOVE", "GOOP_MOVE"],
  // The front one (first) Spiken, the other Whirl.
  TOADPOLE: ["SPIKEN_MOVE", "WHIRL_MOVE"],
  // First: Butt if alone (Nibbits Weak, the commoner), Slice if the front of two; second (back): Hiss.
  // NEEDS: IsAlone.
  NIBBIT: ["BUTT_MOVE", "HISS_MOVE"],
  SEAPUNK: "SEA_KICK_MOVE", TWIG_SLIME_S: "TACKLE_MOVE",
  // RANDOM (50/50): Tackle.
  LEAF_SLIME_S: "TACKLE_MOVE",
  TWIG_SLIME_M: "STICKY_SHOT_MOVE", LEAF_SLIME_M: "STICKY_SHOT", SHRINKER_BEETLE: "SHRINKER_MOVE",
  FUZZY_WURM_CRAWLER: "FIRST_ACID_GOOP",
  // RANDOM (r in 0-2, each rat the move after the one before's): Scratch, Disease Bite, Screech.
  TWO_TAILED_RAT: ["SCRATCH_MOVE", "DISEASE_BITE_MOVE", "SCREECH_MOVE"],
  SLUDGE_SPINNER: "OIL_SPRAY_MOVE",
  // The middle one (second) Whirlwind.
  INKLET: ["JAB_MOVE", "WHIRLWIND_MOVE", "JAB_MOVE"],
  CALCIFIED_CULTIST: "INCANTATION_MOVE", DAMP_CULTIST: "INCANTATION_MOVE",
  // RANDOM (50/50 Frail Spores / Smash): Smash.
  FLYCONID: "SMASH_MOVE",
  SEWER_CLAM: "JET_MOVE", FOSSIL_STALKER: "LATCH_MOVE",
  // Punch Off's first: Fast Punch.
  PUNCH_CONSTRUCT: "READY_MOVE",
  SNAPPING_JAXFRUIT: "ENERGY_ORB_MOVE", GREMLIN_MERC: "GIMME_MOVE", FAT_GREMLIN: "SPAWNED_MOVE", SNEAKY_GREMLIN: "SPAWNED_MOVE",
  VINE_SHAMBLER: "SWIPE_MOVE", LIVING_FOG: "ADVANCED_GAS_MOVE", GAS_BOMB: "EXPLODE_MOVE", HAUNTED_SHIP: "HAUNT_MOVE",
  MAWLER: "CLAW_MOVE", CROSSBOW_RUBY_RAIDER: "RELOAD_MOVE", CUBEX_CONSTRUCT: "CHARGE_UP_MOVE", TRACKER_RUBY_RAIDER: "TRACK_MOVE",
  FOGMOG: "ILLUSION_MOVE", EYE_WITH_TEETH: "DISTRACT_MOVE", BRUTE_RUBY_RAIDER: "BEAT_MOVE", ASSASSIN_RUBY_RAIDER: "KILLSHOT_MOVE",
  AXE_RUBY_RAIDER: "SWING_1", SLITHERING_STRANGLER: "CONSTRICT",
};

/** What spar.ts would set them up with (A10): HP range, powers, block at turn 1. */
export const ACT1_SETUP: Record<string, { hp: readonly [number, number]; powers: Record<string, number>; block?: number }> = {
  BYGONE_EFFIGY: { hp: [132, 132], powers: { SLOW: 1 } },
  PHROG_PARASITE: { hp: [66, 68], powers: { INFESTED: 4 } },
  WRIGGLER: { hp: [18, 22], powers: {} },
  BYRDONIS: { hp: [90, 90], powers: { TERRITORIAL: 1 } },
  TERROR_EEL: { hp: [150, 150], powers: { SHRIEK: 75 } },
  PHANTASMAL_GARDENER: { hp: [27, 32], powers: { SKITTISH: 7 } },
  SKULKING_COLONY: { hp: [80, 80], powers: { HARDENED_SHELL: 20 } },
  CORPSE_SLUG: { hp: [27, 29], powers: { RAVENOUS: 5 } },
  TOADPOLE: { hp: [22, 26], powers: {} },
  NIBBIT: { hp: [44, 48], powers: {} },
  SEAPUNK: { hp: [47, 49], powers: {} },
  TWIG_SLIME_S: { hp: [8, 12], powers: {} },
  LEAF_SLIME_S: { hp: [12, 16], powers: {} },
  TWIG_SLIME_M: { hp: [27, 29], powers: {} },
  LEAF_SLIME_M: { hp: [33, 36], powers: {} },
  SHRINKER_BEETLE: { hp: [40, 42], powers: {} },
  FUZZY_WURM_CRAWLER: { hp: [58, 59], powers: {} },
  TWO_TAILED_RAT: { hp: [18, 22], powers: {} },
  SLUDGE_SPINNER: { hp: [41, 42], powers: {} },
  INKLET: { hp: [12, 18], powers: { SLIPPERY: 1 } },
  CALCIFIED_CULTIST: { hp: [39, 42], powers: {} },
  DAMP_CULTIST: { hp: [52, 54], powers: {} },
  FLYCONID: { hp: [51, 53], powers: {} },
  SEWER_CLAM: { hp: [58, 58], powers: { PLATING: 9 }, block: 9 },
  FOSSIL_STALKER: { hp: [54, 56], powers: { SUCK: 3 } },
  PUNCH_CONSTRUCT: { hp: [60, 60], powers: { ARTIFACT: 1 } },
  SNAPPING_JAXFRUIT: { hp: [34, 36], powers: {} },
  GREMLIN_MERC: { hp: [51, 53], powers: { SURPRISE: 1, THIEVERY: 20 } },
  FAT_GREMLIN: { hp: [14, 18], powers: {} },
  SNEAKY_GREMLIN: { hp: [11, 15], powers: {} },
  VINE_SHAMBLER: { hp: [64, 64], powers: {} },
  LIVING_FOG: { hp: [82, 82], powers: {} },
  GAS_BOMB: { hp: [8, 8], powers: { MINION: 1 } },
  HAUNTED_SHIP: { hp: [67, 67], powers: {} },
  MAWLER: { hp: [76, 76], powers: {} },
  CROSSBOW_RUBY_RAIDER: { hp: [19, 22], powers: {} },
  // The 13 block of AfterAddedToRoom is gone before the player's first turn (all 186 fights: 0 then).
  CUBEX_CONSTRUCT: { hp: [70, 70], powers: { ARTIFACT: 1 } },
  TRACKER_RUBY_RAIDER: { hp: [22, 26], powers: {} },
  FOGMOG: { hp: [78, 78], powers: {} },
  EYE_WITH_TEETH: { hp: [6, 6], powers: { ILLUSION: 1, MINION: 1 } },
  BRUTE_RUBY_RAIDER: { hp: [31, 34], powers: {} },
  ASSASSIN_RUBY_RAIDER: { hp: [19, 24], powers: {} },
  AXE_RUBY_RAIDER: { hp: [21, 23], powers: {} },
  SLITHERING_STRANGLER: { hp: [54, 56], powers: {} },
};
