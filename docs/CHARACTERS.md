# Characters beyond the Ironclad

Since 2026-09-29 the planner can play any of the game's five characters. The Ironclad plays exactly
as before (spar bouts on four decks against every modelled boss: identical to main 905680d; 302 of
302 tests); the others start with none of their own rules, and each is filled in by the work on it.
All five now have theirs: the Silent (`silent.ts`), the Necrobinder (`necrobinder.ts`), the Regent
(`regent.ts`) and, since 2026-09-30, the Defect (`defect.ts`: orbs and Focus, below).

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

## The Defect's orbs

`characters/defect.ts`, from the game's IL (v0.111.0):

- The orb queue (IL: OrbQueue): the front, the oldest, is evoked next. A channel into full slots
  evokes the front (removed) and appends; 3 slots a fight, at most 10; with none, the Defect's
  channels are lost (another character gets a slot for its first). Bulk Up's lost slot deletes the
  newest orb unevoked. Dualcast, Multi-Cast and Quadcast evoke the front in place, removed on the last.
- Values, read live: Lightning 3/8 and Frost 2/5 with Focus, `max(0, v + Focus)`; Dark grows its
  evoke by 6 + Focus a passive (6 as channeled; its evoke no Focus); Plasma 1/2 energy, no Focus;
  Glass hits every enemy for 4 + Focus and loses 1 a passive, its evoke twice its passive. Orb damage
  and block are unpowered: no Strength, Vulnerable, Dexterity or Frail.
- The turn: at its end Hailstorm, the passives front first (Gold-Plated Cables: the front twice),
  then Consuming Shadow's evokes; temporary Focus (Hotfix, Focused Strike, Synchronize, Hyperbeam's
  −3) is given back after. At the next start Lightning Rod and Spinner channel before the draw, Loop
  and Emotion Chip trigger passives after it, and Plasma's energy comes last.
- State: `orbs` and `orbSlots` on `State.ext` (the bridge's `player_orbs`, front first, and
  `orb_slots`); the checks against the game compare them after every card and at every turn's start.
- The evaluation counts what the orbs and the powers will give over the fight's likely turns
  (`defectAhead`), as the Silent's counts its Poison.
- Human data: `data/defect/` (v0.111.0 A10, 1731 runs, 16.1% won).

## The bridge

One package for every character's fields (the Regent's `player_stars` and star costs, the
Necrobinder's `player_allies`), built as `mod/Bridge/bin/StagingChars`; the Defect's `player_orbs`
and `orb_slots` from `mod/Bridge/bin/StagingDefect` on. The Ironclad's evaluations
keep their package.
