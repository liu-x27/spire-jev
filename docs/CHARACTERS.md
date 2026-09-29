# Characters beyond the Ironclad

Since 2026-09-29 the planner can play any of the game's five characters. The Ironclad plays exactly
as before (spar bouts on four decks against every modelled boss: identical to main 905680d; 302 of
302 tests); the others start with none of their own rules, and each is filled in by the work on it.

## Who is playing

- `SPIRE_JEV_CHARACTER` (IRONCLAD by default), or `--character SILENT` on run-fights, eval and
  bench (it goes into the environment, so the game and every spawned run play the same).
- A resumed save plays whoever it was saved as: run-fights follows the observation's `character`.
- `planner/src/character.ts`: the starting kits (IL: `<Character>.StartingHp`, `StartingDeck`,
  `StartingRelics`), `isBasic` / `isBasicStrike` / `isBasicDefend` for any character's Strikes and
  Defends, `starterExtras()` (Bash; Neutralize and Survivor), `dataFile(name)`.

| | HP | deck | relic |
|---|---|---|---|
| IRONCLAD | 80 | 5 Strike, 4 Defend, Bash | Burning Blood |
| SILENT | 70 | 5 Strike, 5 Defend, Neutralize, Survivor | Ring of the Snake |
| DEFECT | 75 | 4 Strike, 4 Defend, Zap, Dualcast | Cracked Core |
| NECROBINDER | 66 | 4 Strike, 4 Defend, Bodyguard, Unleash | Bound Phylactery |
| REGENT | 75 | 4 Strike, 4 Defend, Falling Star, Venerate | Divine Right |

## A character's own rules

`planner/src/characters/<character>.ts`, one module each, owned by the work on that character.
The core only calls the hooks `characters/index.ts` declares:

- `special`, `counts`: cards whose effect is not what their numbers say, and calculated damage
  (the Ironclad's stay in sim.ts SPECIAL and COUNTS);
- `fromObservation`, `playable`, `beforePlay`, `afterPlay`, `startOfTurn`, `endOfTurn`,
  `nextTurn`: the simulator's and the next turn's (turn.ts) points;
- `evaluate`: a term added to search.ts evaluate (beside Demon Form's and the engines' worth);
- `ext`, `cloneExt`, `keyExt`: a character's own state on `State.ext` (the Regent's stars, the
  Necrobinder's Osty), copied for every successor and part of the state's key;
- `cards`, `always`, `never`, `aoe`, `multiHit`, `damage`, `smithFirst`, `smithLast`: choices.ts's
  tables for the character's cards.

Every character's rules are always on: ids do not overlap, and a card of another character's
(Prismatic Shard, a transform) plays as it should.

## Data and saves

- Card stats, take rates and pick scores: `data/<name>` is the Ironclad's; the others read
  `data/<character>/<name>` (none yet: the loaders' empty tables, and the rules decide).
- The card catalogue spar builds from runs: `data/card-catalog.json` plus every
  `data/<character>/card-catalog.json`; `node src/spar.ts build` as another character writes only
  the cards the Ironclad's lacks, into its own.
- Save libraries: `runs/saves` for the Ironclad, `runs/saves-<character>` for the others
  (`SPIRE_JEV_LIBRARY` and bench `--library` still choose another).
- `data/progress-veteran.save`: A10 open for all five (the game reads the character's own
  MaxAscension), the other four with no runs, so NumberOfRuns (the total over every character,
  what the first-run rules read) stays 2 and the Ironclad's runs are drawn as before.

## The bridge

One package for every character's fields (the Regent's `player_stars` and star costs, the
Necrobinder's `player_allies`), built as `mod/Bridge/bin/StagingChars`. The Ironclad's evaluations
keep their package.
