# spire-jev — plan

A bot for Slay the Spire 2 in the style of a fast "System One" decision layer:
conventional search for what search is good at, and one-token judge questions
(15–30 ms on a local 8B model) for the judgement calls around it.

Decided 2026-09-23: **Ironclad first**, stay on the installed **beta v0.111.0**
(main branch is v0.107.1), **own repository, private** until there are results.

## What already exists (researched 2026-09-23)

**The game.** Godot fork ("MegaDot") 4.5 with C# on .NET 9 (bundled runtime
9.0.7). Game logic in `data_sts2_windows_x86_64/sts2.dll`; `sts2.xml` next to it
is the API's XML doc comments (2,932 types). Ships `0Harmony.dll` and has an
integrated mod loader: a mod is a DLL + manifest JSON (+ optional .pck) in
`<game>/mods/`, entry point marked `[ModInitializer]`
(`MegaCrit.Sts2.Core.Modding`). No formal modding API.

Useful internals found in `sts2.xml`:
- `MegaCrit.Sts2.Core.AutoSlay` — Mega Crit's own smoke-test autoplayer:
  `AutoSlayer.Start(seed, …)`, one handler per room and screen (combat, event,
  rest, shop, treasure, card reward, map, deck upgrade/remove/transform…).
  Its decisions are random or cheats (combat "applies massive defensive buffs
  and plays all cards"), but it is a complete driver skeleton.
- `TestSupport.ICardSelector` (+ `CardSelectCmd.UseSelector/PushSelector`) —
  the hook both tests and AutoSlay use to answer card choices.
- `TestSupport.TestMode` — "true when running unit tests"; runners named
  `NetCoreRunner`, `CiCoreRunner`: combat logic runs without the Godot front end.
- `TestRngInjector` — force card generation and initial shuffle orders.
- `Settings.FastModeType` — the game's own speed setting.
- No whole-`CombatState` clone (only `CloneCard`); card effects are C# code in
  each card class, not data.

**Bridges (state out, actions in).** STS2MCP (MIT, REST on :15526, tested on
v0.103.2), STS2-Agent (AGPL, `/state`, `/actions/available`, `/action`, SSE),
auto-spire, STS2Recorder. None claims v0.111.0.

**Data and simulators.** Spire Codex (JSON from decompiled dll + pck;
non-commercial licence). Simulators: evangambit/sts2 (C#, v0.107.1, checked
against the live game via STS2MCP), zhiyue/sts2-rl-agent (Python, claims full
coverage), divine-sts2 (MIT; runs the **real game DLL headless** in .NET 9
workers, claims ~3,100 combats/min, combat only).

**What worked in StS1.** The strongest open bot, bottled_ai, is rules plus a
brute-force search within one turn (cap 11,000 play orders, merge orders that
reach the same state, unknown mid-turn draws as placeholders, ~40-criterion
lexicographic evaluation: don't lose > win > incoming damage > …); 20–52% wins
per character. Neural replacements for combat search failed repeatedly;
non-combat decisions gave the cheapest gains. LLM agents are weak (sub-8B
models scored 0 on Orak; AgenticSTS on StS2 6/10 at A0 but 80 min a run, with
~500 routine decisions per run handed to a fast tier). Through the real game,
the bottleneck is animation, not thinking (~11 min per StS1 game).

## Design

| layer | decides | how | budget |
|---|---|---|---|
| combat planner | the order to play this turn's cards | simulator + exhaustive/beam search over play orders, merge equal states, lexicographic evaluation, unknown draws as placeholders | < 50 ms typical hand |
| judge | card rewards, map path, events, rest vs upgrade, removals | `choice()` / `noul` over *digested* facts, one fact per question where possible (the lesson from Flappy and the stop judge) | 15–30 ms each |
| rules | everything with an obvious answer | strategy document: archetype targets, card valuation, path weights | ~0 |

No model in the inner loop of the combat search: a turn evaluates thousands of
states, and only a simulator is fast enough for that.

## Phases

0. **Spike — decides the route.**
   a. .NET 9 SDK, project-local (`.tools/dotnet9`), no system install.
   b. Does a bridge work on v0.111.0? Build STS2MCP from source and try it;
      if not, a thin own mod on AutoSlay's handlers and `ICardSelector`.
   c. Does headless combat on the real DLL work on v0.111.0 (the
      divine-sts2 route)? If yes, the game's own code is the simulator and no
      card has to be reimplemented. If not, a reimplemented Ironclad subset.
   **Result, 2026-09-23.** (a) SDK 9.0.318 in `.tools/dotnet9`. (b) divine-sts2's
   FullAppBridge builds against v0.111.0 with no errors, and the shipped game
   runs headless in a sandbox (`tools/spike_fullapp.py`: hardlinked exe/pck,
   junctioned data, own `mods/` and APPDATA; real install and saves untouched).
   Bridge up in 2-6 s; `start_run` ~8 s; an Ironclad run reaches combat; a card
   play takes 17-63 ms and an end turn ~0.7 s through the bridge. A leftover
   `current_run.save` crashes the next `start_run`, so saves are cleared per
   launch. (c) Not needed for now: this bridge is too slow to search on
   (divine-sts2 measured p50 36 ms, p95 714 ms per step), so the planner gets
   its own turn simulator and the bridge is the check on it.
   Missing from the bridge's observation, needed by a planner: intent damage
   and hit count (only the move id is given), card numbers after modifiers,
   draw-pile contents (only a count), power details.

1. **Combat planner, Ironclad**, measured headless: fights won, HP lost, and
   planning time per turn.
   **Progress, 2026-09-23.** `planner/` (TypeScript, no npm dependencies):
   `sim.ts` models a turn from the numbers the bridge reports, `search.ts`
   tries every play order (equal states merged, identical cards offered once),
   scores every stopping point, plays only the first action and plans again.
   It does not look at the draw pile's order — the player cannot — so a draw
   is a count of unknown cards and a card that plays an unseen one (Havoc) is
   approximate, and the plan says so. `run-fights.ts` plays real fights in the
   sandbox and, after every card, compares the prediction with the game:
   `node src/run-fights.ts --policy planner|naive --runs 5 --seed 1 --port 47100 [--cards take]`
   (two ports run two sandboxes side by side; logs in `planner/runs/`, each
   with a catalogue of every card seen and the state before every mismatch).
   - *Against a naive policy* (first playable card), same seeds so the same
     fights, card rewards skipped, 5 seeds: over the 28 fights both played the
     planner lost 396 HP to naive's 672 and won 28 to 23; death floors averaged
     10.4 against 7.6. (Before the card rules below; to be rerun.)
   - *The simulator against the game*, card rewards taken so the deck grows,
     15 seeds reaching act 2: 169 fights, 2482 cards, 42 fields that differ —
     all on the four things modelled approximately on purpose (Sword
     Boomerang's random targets, Havoc's unseen card, Juggernaut's random
     target with more than one enemy, Juggling's count of earlier attacks).
     End-of-turn HP loss exact in 734 of 734 turns. Seeds 1-5 went from 94
     differing fields to 11, seeds 6-10 from 165 to 23, one batch of rules at
     a time, each rule written from what the game did and pinned by a test
     (`test/rules.test.ts`, 43 tests in all).
   - *Time*: planning p50 0.05 ms, p95 under 0.5 ms, max 7 ms; at most 884
     states; never truncated.
   - *Bridge fixes found on the way*: after the act 1 boss the map is rebuilt
     under the bridge and it clicked a disposed point (runs ended at floor 17);
     simple card selects offered no actions. It now also reports each power's,
     relic's and enchantment's own numbers, a hand card's gold glow and its
     calculated values.
   - *Known limits*: the planner sees one turn, so it loses to enemies that
     grow — Vantom (act 1 boss, Slippery 8+) ended 8 of the 15 runs, Byrdonis
     2. Potions are never used. Enemy HP after the enemies' turn is not
     checked (Flame Barrier's damage back is not modelled). Next: the
     evaluation weights (1.4), with the scaling enemies as the cases.
   - *1.4, evaluation weights — a negative result.* A Vantom post-mortem
     showed turns 1-3 spent blocking small hits while Slippery made each
     attack worth 1 HP. The evaluation got an optional term for the rest of
     the fight (`futureDamage` in search.ts: each enemy's damage per turn,
     from its intent or its average in `data/bestiary.json`, times the turns
     the deck needs to kill it, killed in Smith's-rule order; Slippery as HP
     to chew through; optionally only what gets past the deck's block). On
     the tuning seeds 1-15 it looked good (floors reached 18.3 → 21.3 at
     weight 0.5; 0.25, 0.75, 1.0 no better), but on held-out seeds 16-45 —
     which the bestiary was not built from — it was no better (18.6, 18.6,
     block-aware 17.4) and lost 7-10% more HP in the fights both played. The
     default stays this turn only; the term stays in the code, off. Tools:
     `src/eval.ts` (one configuration over many seeds, four sandboxes at
     once) and `src/compare.ts` (two configurations, fight for fight).
     Lesson kept: judge on held-out seeds, and on HP lost in shared fights,
     which has far less noise than floors reached.

2. **Non-combat decisions**, started 2026-09-23 night. Research in
   `docs/STRATEGY-research.md` (tier lists of two top players, Untapped's
   pick rates by act, the wiki, Jorbs' run spreadsheet; ~70 checkable rules,
   each tagged by how well it is supported). `src/choices.ts` makes the
   choices by those rules — card rewards (half tier lists, half act pick
   rate; always/never lists; AoE, multi-hit and early-damage needs in act 1;
   skip below a per-act threshold), shop (removal first, S-tier cards, no
   filler), rest (smith at 65%+, rest at 40%), upgrade order, events by id
   and option key (22 events and the two act 2 Ancients seen so far), and
   every card selection by what it is for. The bridge now hands every card
   selection to us (AutoSlay's selector picked at random: upgrades,
   removals, event transforms and in-fight selections were all random until
   then). `run-fights.ts --choices rules`; potions are picked up when there
   is a slot but not yet drunk.
   **Result, seeds 1-45** (none used to write the rules; same planner, turn
   weights): mean floor reached 18.4 with the fixed choices, **21.6** with
   the rules — further on 24 seeds, shorter on 10 (sign test p ≈ 0.02);
   11 runs reached the act 2 boss (none before). Over the 478 fights both
   played, HP lost fell 16% (8362 → 6999) and wins rose 443 → 457.
   Still to measure: rules alone vs rules + judge; potions drunk; the map.

   **Since then (A0, mean floor, same held-out seeds 16-45 from crules6 on):**
   21.6 → 26.3 (potions drunk, Sandpit term, map scoring) → 27.8 → 29.7 →
   31.1 (crules6: duplicate penalty, map lookahead) → 31.8 (fix1: Astra's
   review, `docs/astra-review-1.md`, batch 1 — removal and HP-accounting
   fixes; HP lost in shared fights −3%). No clear yet: the wall is The
   Insatiable (fix1-a0 won 6 of 20; they end on close races, several with it
   under 25 HP) and Queen (0 of 2).

   **Ascension 10** (the goal; `--ascension 10`, the bridge sets it through
   `RunState.CreateForNewRun`; `docs/A10-reference.md`): 15.6 → 16.8 (elites
   only near full HP) → 17.5 (fix1-a10); the act 1 boss beaten by 8 of 30.
   Where act 1 HP goes (fix1-a10): mid-act rests smithed at 58% HP on
   average and runs came to the rest before Vantom at 41%; Byrdonis was
   fought in 21 of 30 runs (36 HP each), sometimes at 15-35% HP, on maps
   with elite-free paths (the one-step map scoring walks into rows of
   elites); Vantom was blocked for five turns while Slippery held. Vantom
   fights lost came in at 55 HP on average, won at 74.

   Switches, one at a time against fix1 on seeds 16-45:
   - `--weights {"setup":1}` (powers valued for the turns to come): A10 17.1
     vs 17.5, HP +1% — no.
   - `--choices rules2` (cards the table lacked; act 1 damage slots first;
     elites only with three attacks): **A10 20.1 vs 17.5, further on 8 seeds,
     shorter on 0; act 1 boss beaten 11 vs 8**, HP −1%. At A0 (with the
     Frantic Escape fix below): 32.0 vs 31.8, Insatiable beaten 9/17 vs
     6/20, Queen 1/4 vs 0/2 — and **the first clear: seed 17**, 2026-09-23
     21:06 (the game's run history: win, ascension 0). Deck of 24 with Demon
     Form, Feel No Pain, Fiend Fire, Flame Barrier; Lizard Tail saved the
     Queen fight. The bridge reports that ending as a loss (The Architect
     takes the last HP before the game-over screen), so runs now read the
     verdict from the history file.
   - `--flags restbudget` (heal when the heal lasts to the boss): A10 18.4 vs
     17.5 (5/4 seeds), Vantom beaten 12/21 vs 8/21, HP coming to Vantom 70 vs
     62; 39 of 41 mid-act rests healed, and fights cost 7% more HP (fewer
     upgrades). Candidate.
   - `--flags pathdp` (whole-map dynamic programming over (point, HP),
     `src/path.ts`): **A10 21.9 vs 17.5, further on 15 seeds, shorter on 6;
     28 of 30 runs reach Vantom (21 before), 8 reach The Insatiable (2)**.
     Act 1 elites 23 (lost 1) against 31 (lost 7); relics at Vantom 2.9 vs
     3.0 — it drops the elites it would lose, not the relics. Adopted. Vantom
     itself is still won 39% of the time, and The Insatiable never at A10.
   - `--weights {"long":1}` (a big enemy's HP at its damage a turn over
     ours): A10 19.9 vs 17.5 (9/3 seeds), Vantom 12/24, Byrdonis 18/21 vs
     15/21 — but no gain on top of the combination below (22.4 vs 23.7).
   - **The combination rules2 + pathdp + restbudget: A10 23.7, Vantom 17/28,
     The Insatiable 0/7** (fix1: 17.5, 8/21, 0/2). The current base.
   - On top of it: `--flags packages` (cards valued as parts of a deck,
     `src/packages.ts`) 24.0 (6/4 seeds), Vantom 17/26, Insatiable 0/9 —
     neutral, more engine cards (Rupture, Body Slam, Ashen Strike); at A0
     32.7 vs 32.0 (12/6) and the second clear (seed 43, a 7 HP finish).
     `--weights {"look":1}` (two-turn lookahead, `src/turn.ts`, enemy scripts
     from `data/intents.json`; the next turn's start is predicted exactly 60%
     of the time) 22.1, HP +8% in shared fights, Vantom 13/28 — worse: the
     guessed second turn misleads the first. Queued: relicvalue, pickrate
     (skip thresholds calibrated to 86/61/49%), scale1 (scaling from act 1).
   - Stage report (`src/stages.ts`): per boss, clean / narrow / revived wins
     and the deck brought (the last screen *before* the boss floor — an
     earlier version counted the boss's own reward and inflated the
     scaling effect to 10/11 vs 7/17; it is 4/5 vs 13/23). Neither A0 clear
     was clean (a Lizard Tail revival; a 7 HP finish).
   - `pickrate`, `scale1`, `stakes` (HP above a safety margin at 0.25 in act
     1-2 boss fights), `sandpit2`: within noise; most changed 1-3 of 30 runs
     (`stakes`' margin — damage to come until the kill — usually exceeds HP).
   - **Confirmation on new seeds 46-135** (combination + packages,
     `eval-conf1-a10.json`): Vantom 52/81 (25 clean, 27 narrow), The
     Insatiable 3/26, Queen 0/2, no clears. The paired baseline (combination
     alone, `conf0-a10`) is running.
   - Astra's second review (`docs/astra-review-2.md`): act 2 fails on
     sustained output (27-36 damage a turn to a 341 HP Insatiable that needs
     ~49), but not for lack of removals (65% of A10 shop gold) — engines are
     scarce in offers, passed over in shops (eight affordable Inflames), and
     unplayed when drawn (Feel No Pain left in hand in 14 of 17 fights,
     Vicious 25/32, Crimson Mantle 9/11). Its ranked changes, each behind a
     switch: `--flags packages2` (contributions kept apart, payoffs only with
     support), `--weights {"engines":1}` (powers worth their turns to come),
     `--flags shop2` (a card that fills a gap before a removal; potions from
     act 2), then deck-aware path/rest/upgrade. Seeds 16-45 are now a
     development set; adoption needs a paired run on 46-135.
   - Paired baseline on 46-135 (`conf0-a10`, the combination): Vantom 50/81
     (29 clean), Insatiable 2/26 — packages on the same seeds 52/81, 3/26.
   - Screens on 16-45 against the combination (23.7, Vantom 17/28,
     Insatiable 0/7): `packages2` 22.8, 17/25; `engines` 24.1 but Vantom
     15/29 (its one Insatiable win was clean, 72% HP); `packages2`+`shop2`
     reaches the Insatiable 10 times (0 wins); all three 22.9, Vantom 14/28;
     **`elo` (strong players' Elo over skipping, docs/a10-decks-research.md)
     16.5, Vantom 4/24** — a 0.5 threshold skipped so much of act 1 that
     decks met Vantom at 14.8 cards instead of 18.5. `--flags elo2` keeps
     act 1 on rules2 and uses the Elo values from act 2: queued.
   - **Boss fights replayed from saves.** `--capture 16,32,47` copies the
     run's save at those map screens; `--resume` continues it (the bridge
     presses the main menu's Continue); the resumed fight is the original
     fight turn for turn (seed 16's Vantom, twice). `src/bench.ts` plays
     every matching save under one combat configuration: paired comparisons
     of boss play on dozens of the same fights in minutes. The library from
     the combination on 46-135 (`cap0-a10`, identical to `conf0-a10` fight for
     fight: 81 saves before Vantom, 26 before The Insatiable, 1 before Queen)
     replays the originals exactly (Insatiable 2/26, Vantom 50/81) in 1.6 and
     5.4 minutes. Combat settings on the same fights: Insatiable 2/26 for the
     default, sandpit2, stakes, long, 1/26 for engines; Vantom 50/81 (29
     clean) default and stakes (identical), 47 engines, 46 (15 clean) long —
     evaluation weights have no gain left. Explorations (`--explore N`,
     `src/explored.ts`) look for the lines that win the fights the planner
     loses. A tuning library on seeds 136-315 (`runs/saves-dev`) keeps the
     confirmation saves out of any tuning.
   - More research: `docs/a10-upgrades-research.md` (66 winning A10 runs, 51
     on v0.107.1+: upgrade order, smith 81% of rests, heal thresholds, 2
     removals) → `--flags smith2`; `docs/cn-research.md` (bilibili tier lists
     on v0.110-0.111: draw and energy on sight, a Vulnerable-draw engine
     around Vicious; Havoc, Anger rated far higher than in the English data).
   - **Explorations** (save-and-load, `bench --explore`): of the 31 Vantom fights
     the planner lost, 14 were won by some exploration (x4) — half the Vantom
     losses are play; of 24 Insatiable losses only 1 (x8) — that wall is the
     deck. The winning lines drank their potions at turn 2.2 against 4.5 (Liquid
     Bronze 2.7 vs 13, Clarity 3 vs 10.5; the one Insatiable rescue drank
     Gigantification on turn 1, not 7): a one-turn evaluation counts a
     fight-long buff as a turn's worth. `--flags potions2` (every potion but
     heals and block in a boss fight's first two turns, no single hits into
     Slippery): Vantom 55/81 (31 clean) vs 50/81 (29) on the same fights,
     Insatiable 3/26 vs 2/26 — to be confirmed on the tuning library.
   - Deck screens on 16-45, all within noise and none beating an Insatiable:
     elo2 23.6, deckplan 23.6 (Vantom clean wins 6 vs 10), exhaust2 23.9,
     keepbasics 23.6, the four together 24.8 (Vantom 19/29). `smith2` (winners'
     rest thresholds too) 21.8, Vantom 11/26 entering at 82% HP instead of 94%:
     our Vantom is HP-bound, so `--flags smithorder` keeps only the upgrade
     order.
   - Tuning library (`dev0-a10`, seeds 136-315): Vantom 87/155, Insatiable 5/45;
     155 and 45 saves in `runs/saves-dev`.
   - Evaluation: a death with Lizard Tail unused or Fairy in a Bottle held is
     scored as the revival (seed 17's Queen fight).
   - Known stall: seed 43's BATTLEWORN_DUMMY event (act 3, A0) — clicking any
     option throws in `NEventOptionButton.OnRelease`; the only seed that meets
     it. Orrery (card rewards inside the shop) stalled seed 35; not bought now.
   - Fixed outright: in-fight exhausts from hand took The Insatiable's
     Frantic Escapes first (they are status cards).
3. **Whole runs against the real game** in fast mode; README, GIF.

## Constraints

- Do not publish decompiled game code or game assets; the repo holds only our
  code, and reads the game from the local install.
- No model-training or distillation demo in public before 2026-12-17 (it
  overlaps the paper under review).
- Private repo; commit locally; push only when asked.
