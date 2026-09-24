# How the profile shapes the runs (2026-09-24)

Every run so far was generated for a player on their first run ever — with the unlocked timeline
too. What the game reads from `progress.save` when it rolls a run, from sts2.dll's IL (local reading
only; nothing of the game's code is kept here):

| Rule (method) | Condition | Effect on a sandbox profile |
|---|---|---|
| Act choice (`ActModel.GetRandomList`) | an unlocked act that is not the default and not in `discovered_acts` | forced: act 1 was always the Overgrowth (locked), is always the Underdocks (unlocked) |
| Boss (`ActModel.ApplyDiscoveryOrderModifications`) | the first boss in `BossDiscoveryOrder` that `UnlockState.HasSeenEncounter` does not know — any key of `encounter_stats` | forced: Vantom or the Waterfall Giant, The Insatiable, Queen in every run. The console's "unlock all" does not write `encounter_stats`; only fights do |
| First run (`Overgrowth.ApplyActDiscoveryOrderModifications`) | `NumberOfRuns` (wins + losses in `character_stats`) is 0 | "First run ever. Presenting rooms in a set order.": hallway fights 1-7, events 1-2 and elites 1-2 set |
| Unknown rooms (`UnknownMapPointOdds.Roll`) | `NumberOfRuns` 0 | the first two `?` rooms are events, the third a fight |
| Treasure (`TreasureRoomRelicSynchronizer.TryGetRelicForTutorial`) | `NumberOfRuns` 0 | the first chest's relic is set |
| Rewards (`RewardsSet.TryGenerateTutorialRewards`) | `NumberOfRuns` 0 and no epoch unlocked, Ironclad | set card rewards for the first seven fights (off once an epoch is unlocked) |
| Unlocked content (`UnlockState`) | epochs with state 5 (`Revealed`) | `progress-unlocked.save` gets this right |

The saves show it. In the locked libraries (`runs/saves` 46-135 and `runs/saves-dev` 136-315, 261
seeds) act 1 is the Overgrowth 261/261 with Vantom 261/261; hallway fights 1-7 are Nibbits, Slimes,
Shrinker Beetle, Inklets, Mawler, Ruby Raiders, Nibbits 261/261; elites 1-3 Byrdonis, Phrog
Parasite, Bygone Effigy 261/261; events 1-2 Byrdonis Nest and Sapphire Seed 261/261; The Insatiable
and Queen 261/261. In `runs/saves-unl` (the unlocked timeline, 21 seeds) act 1 is the Underdocks with
the Waterfall Giant 21/21, then The Insatiable and Queen 21/21. Eight of the twelve bosses (The Kin,
Ceremonial Beast, Lagavulin Matriarch, Soul Fysh, Knowledge Demon, Kaiser Crab, Test Subject,
Aeonglass) were never met before floor 49.

## The fix: a veteran profile

`planner/data/progress-veteran.save`, from `progress-unlocked.save` by
`planner/data/make-veteran-profile.py`: every epoch revealed, every act in `discovered_acts`, all 87
encounters in `encounter_stats` (one win each; ids from the `EncounterModel` classes, checked against
all 73 the saves contain), Ironclad with one win and one loss (`NumberOfRuns` 2) and A10 open.

Checked on the game (A10, seeds 16-39, the run save read right after start_run, nothing played):
act 1 was the Overgrowth 8 times and the Underdocks 16; act 1 bosses Lagavulin Matriarch 7,
Waterfall Giant 5, Vantom 4, Soul Fysh 4, Ceremonial Beast 3, The Kin 1; act 2 Kaiser Crab 9, The
Insatiable 9, Knowledge Demon 6; act 3 Queen 10, Aeonglass 9, Test Subject 5. None of the 8
Overgrowth runs had the first-run hallway fights or events. The same check with
`progress-unlocked.save` (seeds 16-18): the Underdocks, the Waterfall Giant, The Insatiable and Queen
every time.

## What it changes

- Re-baseline with it; `runs/saves`, `saves-dev` and `saves-unl` are libraries of the forced
  sequence and replay only it.
- Results that survive: the methods (paired seeds, the replay bench, the stage report, explorations)
  and the simulator's general rules. Results to re-check: everything tuned to the scripted act 1
  (Byrdonis was the first elite of every run; the act 1 damage-slot rule was written against it) and
  to the three bosses (Vantom's multi-hit, Sandpit, potions2's timing, pathdp's HP costs).
- Stage reports need a split by boss: an act's boss is one of three, so per-boss samples are a third
  of what they were.
- Coverage: the Underdocks and eight bosses the simulator has not met. On the unlocked runs
  (`eval-unl-base-a10`) the simulator's mismatches rose to 7.8 per 100 cards (about 1.5 before), most
  on the Waterfall Giant (Steam Eruption), Phantasmal Gardeners (Skittish block), Corpse Slugs
  (Ravenous), Skulking Colony (Hardened Shell), Sewer Clam, and new cards (Catastrophe, Restlessness,
  Neow's Fury, Pact's End, Darkness) and the Spiral enchantment.
