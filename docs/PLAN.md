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
     155 and 45 saves in `runs/saves-dev`. There potions2 gives Vantom 91/155
     (confirming 55/81 vs 50/81), the Insatiable 4/45 vs 5/45: adopted.
   - **Act 2 replayed from the same act 1 ends** (`bench --stop-floor 33` from the
     pre-Vantom saves, potions2 throughout). Tuning library: base reached the
     Insatiable 46 times and won 5, packages2+shop2 44 and 9, deckplan+exhaust2+
     keepbasics+shop2 40 and 5, elo2+packages2+shop2 41 and 5. On the
     confirmation saves packages2+shop2 did not replicate (26 and 2 vs 26 and 3):
     no deck rule so far moves The Insatiable off ~10%.
   - Astra's third review (`docs/astra-review-3.md`): the replays match the
     originals; packages2+shop2 is noise (paired p≈.29 on tuning, reversed on
     confirmation); seeds 46-135 are now exposed (fresh confirmation beyond
     315; ~320-480 paired starts to detect five points). Isolation fixed:
     in-fight picks use `plainCardValue` (deck flags had changed 8 Vantom
     fights), bench selects by `--seeds`, retries and reports failed replays
     (run-fights records its errors), keeps rooms. The act 2 wall is output
     and defence together (losses: 6.8 turns, 31.5 damage a turn, 127 of 341
     HP left); Inflame was taken 0 of 16 times in act 2, and shops passed over
     37-74 gold Inflames for removals.
   - **`--flags spar`** (Astra's marginal contribution): `src/spar.ts` plays the
     deck out in the simulator against the act boss's script at A10 (real
     draws, 32 shuffles, the same for every candidate); a card reward or shop
     item is worth the score it adds (removals on the same scale). On a mid act
     2 deck: Demon Form +112, Offering +24, Anger +17, Inflame +15-25,
     Bloodletting +4, a second Pommel +1, a curse 0 to -14. Being measured with
     the act 2 replay.
   - Evaluation: a death with Lizard Tail unused or Fairy in a Bottle held is
     scored as the revival (seed 17's Queen fight).
   - Known stall: seed 43's BATTLEWORN_DUMMY event (act 3, A0) — clicking any
     option throws in `NEventOptionButton.OnRelease`; the only seed that meets
     it. Orrery (card rewards inside the shop) stalled seed 35; not bought now.
   - Fixed outright: in-fight exhausts from hand took The Insatiable's
     Frantic Escapes first (they are status cards).
   - **Every result above was on a locked timeline.** `prepare()` deleted the
     sandbox's progress.save with the run saves, so each launch began a fresh
     profile: 5 of 57 epochs (IRONCLAD3-7, RELIC1-5, POTION1-2, COLORLESS1-5,
     EVENT1-3, the alternate acts all missing). In 26,161 card rewards 11
     Ironclad cards never appeared, among them Dominate and Cruelty (strong
     players' #2 and #7 by Elo vs skip); act 1 was always the Overgrowth.
     And every run was a *first run* (`docs/run-generation.md`, from the IL):
     an unlocked act not in `discovered_acts` is forced, each act's boss is
     the first of its discovery order not in `encounter_stats` (so always
     Vantom, The Insatiable, Queen: 3 of the 12 bosses), and with no wins or
     losses the Overgrowth scripts its first seven hallway fights, two events,
     two elites and the first chest (the 261 locked saves: 261/261 the same).
     Now `data/progress-veteran.save` is installed each launch
     (`SPIRE_JEV_PROFILE`=veteran by default, `unlocked` for the timeline
     alone, `locked` for the old fresh profile): all epochs, acts and
     encounters seen, a win and a loss. Acts and bosses are then drawn as for
     a player past their first runs (A10 seeds 16-39: Overgrowth 8 /
     Underdocks 16, all 12 bosses). Every baseline and save library is to be
     redone on it. The `unl-*` runs (`runs/saves-unl`, `SPIRE_JEV_LIBRARY`)
     were on the unlocked profile alone: Underdocks, Waterfall Giant,
     Insatiable, Queen every time.
   - Unlocked baseline (`unl-base-a10`, 16-45, after the bridge fixes below):
     mean floor 16.6 (22 on the locked pool), Waterfall Giant 7/21. The
     Giant at 0 HP is stunned a turn, then strikes for its Steam Eruption
     (20 on turn 2, +3 a turn: 38-56) and dies. Of the 14 losses in the 21
     pre-Giant replays, **9 killed it and died to that blow**, their hand that
     turn all attacks and their potions drunk on turn 1 (potions2). Modelled
     now (sim.ts `deathBlow`; the search had stopped at the "win" and ended
     the blow's turn unblocked); on the replays that gives 7/21 with 6 clean
     (was 5) and 38% HP left. `--flags wgpot` (block, Dex, Weak and draw
     potions kept for the blow; potions five times dearer while it lives)
     8/21, `wghp` (HP under the coming blow counted twice) no change: the
     blow needs HP and block cards in the deck before the fight, not play.
   - The bridge, for screens the unlocked content brings: a rest or event
     option can offer rewards before it finishes (Dream Catcher, Tiny
     Mailbox, Punch Off's Nab), which AutoSlay drains only after the room;
     Punch Off's punch animation loop froze the game headless (skipped);
     powers report their internal data. Simulator rules from the IL
     (`tools/inspect --il`): Colossus's halving (never modelled), Skittish,
     Ravenous, Hardened Shell, Dominate, Molten Fist, Pact's End, Cruelty,
     Inferno; `test/unlocked.test.ts`. The other session (branch
     `sim-lizard-bound`) models the eight bosses the bot never met.
   - **Veteran baseline** (`vet-base-a10`, 16-45, 2026-09-24): mean last
     floor 18.2, no clear; 19 of 26 deaths in act 1. Act 1 bosses 8/21 —
     Soul Fysh 3/4, Ceremonial Beast 2/4, Waterfall Giant 2/4, Lagavulin
     Matriarch 1/5 (4 deaths), Vantom 0/3 (15-card decks: without the
     first-run script act 1's fights are harder and fewer), The Kin 0/1.
     The other session's boss-swap replays (a save's `acts[i].rooms.boss_id`
     set to another boss) give 8 fights a boss from the old libraries; the
     Waterfall Giant has 155 + 81 that way (`runs/boss-wg-dev`, `-conf`).
   - **The eight bosses the bot had never met** (branch `sim-lizard-bound`,
     `test/bosses.test.ts`; rules from the IL, `tools/inspect --il`):
     Ceremonial Beast's Plow (HP lost that leaves it at or under 160 stuns it
     and strips its Strength) and Beast Cry's Ringing (one card a turn);
     Lagavulin Matriarch's Asleep (damage past her block wakes her, stunned
     a turn; asleep, Plating's block decays and she wakes after her third
     turn); Soul Fysh's Intangible (every hit 1) and Beckon (played it does
     nothing, held it costs 6 HP past block); the Knowledge Demon's
     Disintegration (end of turn, into block), Sloth and Mind Rot; the Kaiser
     Crab's Surrounded (the claw behind deals x1.5, the player faces the one
     last targeted; the bridge now reports powers' enum fields, `_facing`)
     and Crab Rage; the Test Subject's Enrage, respawns (a kill in its first
     two forms is no win: evaluate counts the forms to come) and Nemesis;
     Aeonglass's Withering Presence. `scripts.ts` plays each boss's moves by
     the id the bridge reports (the two-turn lookahead and spar meet their
     real turns), and spar has all eight (`bossFor`).
   - Measured on 24 pre-boss saves a boss with the boss swapped in (seeds
     136-, `runs/boss-*-dev24`), before and after in frozen worktrees:
     Soul Fysh 16 won (7 clean) → 18 (16), end-of-turn HP exact 80/182 →
     228/230; Ceremonial Beast 17 (11) → 19 (15); The Kin 13 (9) and
     Lagavulin Matriarch 15 (7) unchanged; act 2 decks against the act 2
     and 3 bosses as before (Kaiser Crab 1, Knowledge Demon 1, Test Subject
     and Aeonglass 0; the Demon's end-of-turn HP 47/162 → 150/167). No save
     did worse. Flags on the same saves: `sleep` (leave the Matriarch asleep
     while she has two turns to go, no potions then; woken early she acts
     as many turns before the kill, and her sleep is free turns) 14 won but
     13 clean against 7, 58% HP after a win against 38%; `curse` (Sloth over
     a second Disintegration) the same wins, a turn more alive; `kin` (the
     followers' HP not counted while the Priest lives) 9 (3) against 13 (9):
     killing the followers first is right, dropped.
   - Confirmed on the veteran library's own fights with these bosses (100
     pre-boss saves of `runs/saves-vet-dev`, main 13cd381 against it plus the
     rules, paired): 31 won (14 clean) → 44 (23). Soul Fysh 10/30 (2 clean)
     → 20/30 (9), 15 saves better and 1 worse; Ceremonial Beast 9/20 (7) →
     12/20 (9), 4 better; the Matriarch 7/26, The Kin 4/14, Knowledge Demon
     1/4, Kaiser Crab 0/4 and Aeonglass 0/2 as before. End-of-turn HP exact
     687/849 → 914/934. The one worse (seed 374): a Beckon played goes back
     to the discard pile, so each one drawn is an energy or 6 HP again; the
     planner paid the energy every time and the fight took 12 turns instead
     of 6 — the one-turn evaluation prices a card's damage below HP.
     `--flags sleep` on the 26 Matriarch saves: 7 won (4 clean) → 9 (8), 29%
     → 40% HP after a win, 4 better and 1 worse; with the swapped saves'
     7 → 13 clean, **adopted** (add `sleep` to the flags runs use).
   - Bridge, for the veteran profile's content: a fight with no rewards
     (Gremlin Merc ran off) goes back to the map; a purchase can offer
     rewards (Cauldron); an event option can start a fight inside the event
     (Punch Off's), which AutoSlay plays with its test cheats — ours plays it,
     but its rewards screen then ignores proceed (known issue; Punch Off now
     takes Nab, and run-fights gives a run up after 200 unchanged screens).
     The act's boss is in the observation (`act_boss`): act 1's multi-hit
     rule now applies with Vantom only.
   - **Veteran libraries** (fresh seeds, code 3067839): tuning 316-495
     (`vet-dev0-a10`, 151 saves in `runs/saves-vet-dev`), confirmation 496-585
     (`vet-conf0-a10`, 86 in `runs/saves-vet-conf`). vet-dev0: mean floor 18.3,
     124 of 176 deaths in act 1; act 1 bosses 52/131 — Waterfall Giant 13/22
     (10 clean, after the DeathBlow model), Vantom 9/19, Ceremonial Beast 9/20,
     Soul Fysh 10/30, Lagavulin Matriarch 7/26, The Kin 4/14; act 2 3/18.
   - Waterfall Giant on 155 boss-swapped tuning saves: default 81 wins (43
     clean), `wgpot` 79 (34): not adopted.
   - Act 1 elites ended the run 27 of 65 times on floors 5-9 (42%), the path
     model said ~9%. `--flags elitedeath` (the measured rates as a floor on an
     elite's death chance): 145 runs reached the act 1 boss instead of 131, but
     50 beat it instead of 52 — elite deaths became boss deaths without the
     relics. Not adopted: act 1's limit is the deck, not the route.
   - Phrog Parasite (18 of 42 fights lost): Infested lets out four stunned
     Wrigglers (18-22 HP at A8+) when it dies, and the planner took the kill
     for the win, as with the Giant. Modelled (sim.ts `died`), its Wrigglers
     counted as HP still to take while it lives.
   - Tablet of Truth (every Decipher doubles its max HP cost; 34 of 36 visits
     left 20+ max HP behind, runs at 1 max HP): decipher once or twice, then
     give up. `vet-dev1-a10` (Infested + Tablet), paired on 316-495: mean
     floor 18.4 → 19.0, act 1 bosses 53/133 → 55/142.
   - The Ancients' relics by §10.9's orders (Neow had given Lost Coffer 22 of
     43 times offered); the other session's eight bosses merged (9b700c8);
     `--flags sleep` (Lagavulin Matriarch left asleep). `vet-dev2-a10` against
     vet-dev1, paired: mean floor 19.0 → 19.9, **act 1 bosses 55/141 → 67/141
     (39% → 48%, clean 30 → 40)**, act 1 deaths 124 → 111, act 2 bosses 4/19
     → 5/25. By boss: Ceremonial Beast 11/24 → 18/26, Soul Fysh 10/30 →
     15/28, Matriarch 7/26 → 12/31, Vantom 9/23 → 12/23, The Kin 4/17 →
     2/16, Waterfall Giant 14/22 → 8/17 — not the merge: the 155 boss-swapped
     Giant fights are the same fight for fight on 9b700c8 (81 wins, 43
     clean); other decks reach it now (the Ancients), and 17 is few.
   - Act 2: of the 67 runs out of act 1 in vet-dev2, 62 died in act 2, 42 of
     them outside the boss fight. From the IL: Reattach (Decimillipede), Illusion
     (The Obscura's Parafright), Slumber (Slumbering Beetle), Imbalanced (Bowlbug
     Rock), Personal Hive (Entomancer's Dazed). `vet-dev3-a10` (the first four)
     against vet-dev2: act 2 bosses 5/25 → 7/27, act 2's other fights lost 42 →
     40 — right, but small: act 2's limit is the deck.
   - **`--flags spar`** (card rewards and shop picks by what they add to the
     deck against the act's own boss, played out in the simulator; the act's
     boss from `act_boss`, the other session's bosses in spar's BOSSES) —
     `vet-dev4s-a10` against vet-dev3, paired on 316-495: **mean floor 20.1 →
     23.8** (further on 86 seeds, shorter on 35), **act 1 bosses 68/142 →
     99/156 (48% → 63%, clean 40 → 65)**, act 2 bosses reached 28 → 58, won 7 →
     12; act 1 deaths 111 → 81. The Kin 2/16 → 11/21, Matriarch 12/31 → 22/33,
     Soul Fysh 15/28 → 22/29, Vantom 12/23 → 17/24; the Waterfall Giant 9/18 →
     8/21 (its fight outlasts spar's eight turns).
   - spar confirmed on 496-585 (`vet-conf4s-a10` against vet-conf2): mean
     floor 22.0 → 25.0 (further on 42 seeds, shorter on 19), act 1 bosses
     56/79 (71%), act 1 deaths 49 → 34. Adopted into the run flags.
   - **No A10 run could have been won**: AutoSlay's PlayRunAsync abandons a run
     once its total floor reaches 49 ("Run completed (max floor reached)") —
     A10's second act 3 boss is on floor 49. Seed 497 beat Aeonglass on floor
     48 and was abandoned. Fixed (b5d1c92, a transpiler raising 49 to 99); the
     replay of 497 then met the Test Subject on floor 49 at 48 of 128 HP and
     lost in four turns: the furthest run so far, one fight from a clear.
   - `--flags spar2` (twelve turns for the long bosses) against spar on 316-495:
     neutral (mean floor 23.8 → 23.5, 13 seeds changed). Not adopted.
   - Astra's fourth review (`docs/astra-review-4.md`): of 270 spar starts,
     act 2 ends 136 (88% of act 1's survivors), its boss only 69; spar's bout is
     unlike the run it scores (80/80 HP, three energy, no relics or potions,
     Queen missing from BOSSES, upgraded offers scored bare, 32 shuffles against
     a five-point threshold); shops, removal, upgrades and rests still follow the
     old rules; act 3 needs both bosses on one HP bar. Next: scorer fidelity and
     censoring, one evaluator for rewards/shops/removal/upgrades judged by act 2
     completions per start, a double-boss evaluator, then 300 fresh seeds.
   - Battleworn Dummy (act 3): each setting's fight replaces the event room, and
     AutoSlay waited for a map (seeds 374, 413, 545, 580 lost). Fixed in the
     event loop.
   - Colourless cards: shops offered them 9,092 times (38 kinds), bought 0 —
     `cardValue` gives cards missing from its tables 0.3. Mostly right:
     strong players' Elo puts nearly all of them below skipping (Spire Codex
     wr50, all characters); only Hidden Gem +27, Finesse +5, Dark Shackles 0
     and Fasten -8 come near.
   - **spar never saw a third of the veteran cards.** Its catalogue
     (`data/card-catalog.json`) was built on 2026-09-24 from the locked
     profile's runs: 112 cards. Of the 201 ids the veteran decks held, 70 were
     missing (Break, Feeding Frenzy, Molten Fist, Dominate, Inferno, Primal
     Force, every curse): dropped from both decks compared, their gain 0, never
     taken. Rebuilt (361). Replaying conf4s's 754 recorded card rewards through
     chooseCardReward (the old catalogue reproduces 744 of the recorded picks),
     the new one changes 192: 66 fewer skips, Cinder +26, Molten Fist +23, Drum
     of Battle +14. Two of those the simulator had wrong by the generic vars
     (IL): Drum of Battle draws and gives its energy only when exhausted, Cinder
     exhausts a random card of the hand after its hit. Fixed; the other cards
     whose IL does more than damage/block/energy/draw/powers are being audited.
   - `--flags spar3` (astra-review-4 #1): the bout plays the run's max HP,
     relics and their numbers, and its last fight's opening (energy, hand size,
     relic Strength/Vigor/block); an upgraded offer is scored upgraded (the
     bridge's `upgrades`, the offer's own description learnt); a boss spar has
     no model of, or an offer it has never seen, is left to the rules (bossFor
     had put The Insatiable in for the Queen); candidates near the line get 128
     more shuffles. The Queen and her Torch Head are in the simulator now
     (sim-queen), and `--flags sparboth` measures act 3's picks against both
     bosses.
   - `--flags spar4` (astra-review-4 #2): every legal removal weighed (a curse
     first: the simulator plays Decay, Regret, Doubt as dead cards, all five
     gave the same +2.1), the select takes that card; upgrades by what they add;
     before the boss, heal or smith by the bout at this HP, without the HP-lost
     term (the healed Ironclad, losing as well, lost more); what the bout turned
     down the rules no longer buy. spar3 and spar3+spar4 on the fresh seeds
     586-855 against vet-hunt3 (spar) in a frozen worktree (ba04ecc).
   - The floor-49 Test Subject (497, 712, 722 all died to it at 42-48 HP):
     the other session's replays from 712's and 722's f47 saves put the need at
     ~80-100 HP (37-60 HP 0/16, ~80 2/8, ~100 4/8), against the 44-61 the Queen
     leaves; the Queen's loss was already the best line the planner finds; both
     came with no potions; heal or smith at 47 changed nothing on 49. Its third
     form (313 HP, intangible every other turn) is a burst test: ~310 damage in
     its first turn not intangible, or ~155 in two. `--flags potsave` keeps act
     3's potions for its bosses (to test). `--flags sparboth2` (the second boss
     at half HP, its own horizon, averaged with the first) on the 17 f32 saves
     that beat act 2's boss in vet-hunt3, ×2: 48 won 3 → 0 (3 discordant, all
     against), act 3 picks 37% → 31% — averaging in a boss the deck loses to
     anyway halves the first boss's signal. Not adopted.
   - **The arms on the fresh seeds 586-855** (`src/reach.ts`, completions per
     start, paired; all Staging8, A10, veteran):

     | per start | vet-hunt3 spar (bbda587) | vet-s3 spar3 (ba04ecc) | vet-s3f spar3 + card rules (0efdefd) |
     |---|---:|---:|---:|
     | act 1 boss beaten | 144 | 167 (+47/-24, p 0.009) | 188 (+40/-19 on s3, p 0.009) |
     | act 2 boss beaten | 17 | 20 (+15/-12) | 31 (+22/-11 on s3, p 0.08; on hunt3 p 0.029) |
     | floor 48 won | 1 | 1 | 2 (the first Test Subject wins: 681, 708) |
     | won | 0 | 0 | 0 |

     Act 1 bosses 59% → 67% → 75%, act 2's 24% → 24% → 32%. The two floor-48
     wins came to 49 with 11 and 22 HP. vet-s3 lost 4 runs and s3f 6 to
     AutoSlay's 30 s screen wait (spar's bouts on a rewards screen): the
     bridge lengthens those waits from Staging9 (f43a6c8). The s3f mismatches by
     card: Restlessness, Salvo, Panic Button, Equilibrium, Omnislice, Sword
     Boomerang far fewer; Tear Asunder one hit too many (fixed, 47acb58, with
     Intimidating Helmet, Ornamental Fan, Game Piece, Iron Club, Pen Nib).
   - **spar4 against s3f** (`vet-s4g-a10`, 586-855, Staging9): act 1 188 → 174
     (+23/-37, p 0.09), act 2 31 → 34 (+19/-16); floor-16 heals 157 → 112,
     boss-entry HP 91% → 87% (astra-review-5: the rest's bout smiths ties and
     values no HP). Its parts as flags (spar4rest, spar4up, spar4rm,
     spar4shop), screened on 586-675 (90 starts, Staging10) against vet-d-base
     (spar3 on today's code: 57 act 1 bosses, 8 act 2, like s3f's 58 and 8):
     spar4up+rm+shop 59/12 (+11/-9, +8/-4), spar4up 64/8 (+14/-7, +2/-2),
     spar4rm 55/10, spar4shop 61/12 (+5/-1, +6/-2). None significant on 90
     starts; the rest is where s4g lost act 1. spar4up and spar4rm now
     shortlist (12 shuffles each, the best 4 fully): a smith of 25 cards had
     outrun AutoSlay's three minutes. Staging11 (c31c5b6) also stops a card
     preview's tween from hanging a run (the other session: 589, 591, 627).
   - **Can our planner pilot the decks humans win with?** (another session's act
     3 research, Spire Codex's v0.111.0 export: 2,418 A10 solo Ironclad runs,
     1,017 at act 3's bosses.) Winners' decks at floor 48: 30 cards, 10 attacks
     / 14 skills / 4 powers, 98% HP; ours at 47: 24, 13 / 8 / 1.4, 57% before
     the rest. The bot never took the engine cards (Feel No Pain 0/92, Burning
     Pact 0/76, Barricade 0/29) — spar scored them negative — and in spar's bout
     (fought out, full HP, their relics) the winners' own decks beat their
     first act 3 boss 3-4% of the time (60 decks × 8, 480 bouts): planTurn 3.1%,
     with engines+setup 4.2%, planTurn2 4.0% / 4.4%, planTurnRoll (b514909: this
     turn's best lines ranked by rollouts two turns on) 3.3% / 4.4%; losers
     0.4-0.6%, ours 1.7-3.8%. No planner variant moves it: the simulator is
     the limit. The Queen: 1.5% (her Torch killed first, 2.6%); the Test
     Subject 0.4%, against the bot's own 2/11 and 2/26 on floor 48 in the game.
     Most of the relics those decks hold are not in the simulator at all (Bag of
     Preparation, Gorget, Centennial Puzzle, Lantern, Anchor, Oddly Smooth Stone,
     Bag of Marbles, Vajra, Mercury Hourglass, Nunchaku, Miniature Cannon — 626's
     upgraded attacks hit 3 harder than predicted, every time), a bout has no
     potions, and a bout starts without what a relic gives at the start. Next:
     the relics (the other session, as for the cards), potions in the bout, and
     this pilot as the measure — the winners' decks should win in the simulator
     before spar can prefer what makes them win.
   - **Act 3's pair, from the 55 f47 saves** (`runs/saves-f47-all`: 36 seeds,
     the arms' libraries, every order; 56214be, Staging10; floor 47's rest and
     both bosses, paired): base wins floor 48 4/55 (Queen 2/24, Aeonglass 1/24,
     Test Subject 1/7), losing 71 HP on average, and 49 0/4 (at 11, 42, 44, 65
     HP). `torch` (the Queen's HP at half while her Torch lives) 3/55; `potwin`
     (each potion in its window, heals kept for 49) 4/55, one more potion into
     49; `hp48b` (HP under the second boss's need counted twice) 3/55: 849's
     four-turn Aeonglass win became a seven-turn loss; all three 3/55; `pot48`
     4/55. None helps: 51 of the 55 decks lose the first boss whatever they
     hold back, and drink to survive it (69-70 of 71 potions). The act 3
     handbook (the other session, from 66 floor 48/49 fights) had found why: the
     first boss's win costs 36-44 (Queen), 72 (Aeonglass), 75-96 (Test Subject)
     HP, the second needs ~60/85/90. The pair is a deck-strength question.
   - `sparpair`: in e23d63b's eight turns no act 3 deck beat Aeonglass, and the
     second bout was never played; fought out (20 turns) it still is not, mid
     act 3 (407's decks 0/32 against Aeonglass at 8, 12 and 20 turns): it is
     spar there, until the deck can beat the first boss.
   - **The bout against the game, boss by boss** (2026-09-26): the bench's s3f
     saves (none in the value data) in spar's bout against their own boss, from
     the fight's real HP (the save is before floor 16's rest: 15-22 HP under it)
     and its belt, next to the same fight in the game (val-f16-base,
     val-f32-base). One turn's prediction in the game is exact (endTurn,
     predicted = actual to a point a turn for every boss); the whole bout was
     not. Act 1 won 35.2% of bouts against the game's 74.6%, act 2 11.3%
     against 30.9%. Four faults, each fixed with a test: a potion the plan drank
     first ended the bout's turn (f43bcae; the belt cost bouts — act 1 44.8%
     with it, 52.4% without); Ringing never went (12723ea: after the first
     Beast Cry a card a turn for good — the Ceremonial Beast 46.6% -> 82.2%,
     the game 92.3%); the Matriarch started the bout without `asleep`, so the
     sleep rule could not see her and the bout woke her on turn 1 (3a7298f:
     44.9% -> 60.9%, the game 66.7%); the Kin's Priest stood first, and with
     damage short of a kill the same on any enemy the planner hit the first one
     (2e4f9b5: followers alive at turn 5 1.16 -> 0.26, the game 0.18; 53.9% ->
     71.1%, the game 71.1%). The Queen's Torch Head now opens before her as in
     the game too. Now act 1 70.2% against 74.6% (Vantom 75.8/74.2, Giant
     54.0/56.0, Soul Fysh 78.6/85.7), act 2 26.0% against 30.9% (Knowledge
     Demon 25.6/35.9, Insatiable 26.9/37.0, Crab 25.8/19.4). What is left is
     largely the bout's: the save's deck without the rest's upgrade, and the
     potions it cannot drink (Skill, Attack, Power, Colorless: the game's bot
     drinks every one by turn 2). value-net.json (v2b) learnt from the bouts
     before these fixes.
   - **The learned value in the game** (`--flags bossvalue`, planTurnValue:
     the evaluation plus MIX × the net at a turn's end; boss fights only;
     paired with the plain planner on the same saves, none in the net's data).
     The first net (v1, mix 1) cost act 2: f32 30 -> 24 won (+2/-8), the
     enemies' HP left at the end 14.1 ± 4.9 higher; f47 4 -> 3; f16 188 -> 186.
     v2b (value.ts v2, the Insatiable's Sandpit; mix 0.3): f32 31 -> 34
     (+3/-0). v3 (ebc695a, the fixed bout's data, ranking 0.930): f32 31 -> 32
     (+3/-2), f47 4 -> 3 (HP lost when both won 46 -> 38), f16 190 -> 195
     (+15/-10, p 0.42: fights 0.26 ± 0.07 turns shorter, the Matriarch left 7 ±
     3 HP lower); at mix 1 f47 4 -> 4, f32 31 -> 31. In the bout v3 is ahead
     everywhere (f16 70.2% -> 73.8%, act 3's human winners 12.3% -> 18.3% at
     mix 1), in the game within noise. A second iteration (data played by
     v3 at mix 1, 8,400 bouts) scores the same in the bout. Neither the net
     nor rollouts are the lever the pair needs.
   - **The Waterfall Giant** is the act 1 boss runs die to most (8-12 of 90
     dev starts). The game's lost Giant fights (fix-f16-base, 22 of 50) are a
     kill and then its DeathBlow, 17-43 HP short of it with the next hand's
     block. On the 50 Giant saves in the bout (400 bouts; the game 56.0%):
     base 54.0%, `wghp` 55.0%, `wgpot` 51.8%, hpLoss weight 1.5 51.0%, and
     `wgblow` (a kill whose blow is not expected to be survived counted as a
     likely loss, a5b7933) 51.0%: held back, the blow grows 3 a turn. The HP
     goes before the kill; it is the deck's.
   - **Whole runs with the fixed bout** (ebc695a, dev seeds 586-675, paired
     with the same flags before it): spar3 act 1 boss 57 -> 63 (+9/-3), act 2
     boss 8 -> 4 (+2/-6); the combo (spar5, spar4up, spar4shop) 65 -> 65, 12 ->
     11. The combo against spar3 on the fixed bout: act 1 boss 63 -> 65, act 2
     boss 4 -> 11 (+10/-3, p 0.09); before the fix it was 8 -> 12 (+9/-5):
     +19/-8 over the 180 paired starts. The runs die at act 1's boss (17-26 of
     90: the Giant 8-12), in act 2 before its boss (26-29: Entomancer 5-7,
     Decimillipede, the Bowlbug trio) and at it (22-30: the Crab 12-17).
   - **The planner leaves powers in hand.** An A10 winner's deck (Spire Codex,
     5 turns and 21 HP against Aeonglass) in the bout kept Demon Form, Feel No
     Pain, Hellraiser and Dark Embrace all fight: one turn's evaluation does
     not see what a power gives the turns after. Played first whenever the
     hand can (`powfirst`, 2dc7636, a probe) the act 3 pilot's winners' decks
     win 12.3% -> 18.3% of bouts (the learned value at its best: 18.3%). In the
     game, paired on the same saves: f16 190 -> 197 (+8/-1, p 0.039; every act
     1 boss even or up), f32 31 -> 34 (+5/-2; the enemies' HP left at the end
     10.5 ± 3.9 lower), f47 4 -> 5 (+2/-1) and 849's floor 49 won — the bench's
     first (Aeonglass 83 -> 27, the Test Subject in 4 turns; base lost it at 61
     HP). +15/-4 over 404 fights. Blind, a power costs a turn's block
     (Hellraiser before Flame Barrier into 30); `powbonus` (5e6637d,
     planTurnPowers) plays one when the turn after it scores within 10 of the
     best line: in the pilot 17.7/4.6/9.0% (winners/losers/ours) against
     powfirst's 18.3/4.4/8.0. In the game: f16 190 -> 197 (+8/-1, the same
     fights as powfirst), f32 31 -> 34 (+4/-1; HP left 9.9 ± 3.5 lower, the
     Knowledge Demon's 18.7 ± 7.7), f47 4 -> 6 (+3/-1; the Queen's pair 26 ±
     15 lower): +15/-3, p 0.008. Training the net on bouts that play powers at
     random (valuegen --explore-powers 0.5, v4) did worse than v3 (15.0%).
     The other session's package test with pow10 in the bout: standalone
     powers score for the next boss (Demon Form +5.5 to +36.6, Inflame, Barricade;
     the bout's Demon Form matches the game in 113 fights, 571 turn checks),
     the exhaust engine (FNP, Dark Embrace, Burning Pact) does not on these
     decks, which lack its enablers.
   - The evaluation counted temporary Strength (Setup Strike, Flex Potion,
     Reptile Trinket) as kept (2f509a9: Setup Strike over a second Defend into
     11x4); small in the bout (with powbonus f16 71.0 -> 71.3%, f32 27.8 ->
     28.4%). On the winners' decks whose every card the bout knows (a third
     hold Wish, Alchemize, Apparition...): planTurn 12.2%, powbonus 14.6%,
     their losers' 0.4 / 1.8% — the bout tells decks apart; the planner is
     still far from the humans who won with them.
   - **s3f's choices have a hole**: the 849 recording (the video session)
     found s3f's floor 6 card reward never seen by the bot — AutoSlay's 30 s
     screen wait (Staging8) ran out under the eval's load; replayed, it took
     Thunderclap. Other s3f seeds may have lost picks the same way;
     Staging9 on waits 3 minutes.
   - **What does not carry over from the bout.** With powbonus in the game
     (ts-*, 2f509a9) f16 197, f32 35, f47 6 of the plain planner's 190 / 31
     / 4. `bosslook` (0576ba7: those turns compared by planTurn2; the act 3
     pilot's best, 20.2/5.0/11.1%, f32 in the bout 28.4 -> 30.9%) in the game:
     f16 197 -> 189 (+13/-21), f32 35 -> 33 (+5/-7; HP left 8.2 ± 4.9 higher),
     f47 6 -> 4 (+2/-4): not adopted. The weights swept with powbonus
     (enemyHp 0.25-0.6, strength 1/3, vulnerable 1/2.5, weak 0.6/2, drawn
     0.5/2.5, engines 1) move the bout's f16, f32 and act 3 by at most ~1-2
     points. Of the planner changes since the bout matched the game, the
     powers played (powbonus) are what the game confirms; the learned value,
     rollouts, the second turn's look and the weights are not. A likely
     reason: in the bout the enemies are the model's own, so anything that
     looks a turn ahead sees them exactly; in the game the next turn is
     predicted (ts-*, 2,610 enemy turns: the next hand's size missed 232 times,
     enemy powers 166, player powers 308), and powers played are the
     player's own cards, which the model has right.
   - Aeonglass's Withering Presence reset to 6 each turn in the bout (f4685bd:
     the game counts across turns; its next hands had 1-3 cards more). Our f47
     decks against her in the pilot: 12/160 -> 5/160 bouts won (the game 1/24);
     with powbonus 18/160 -> 6/160 (more cards played cost the bout nothing).
     Act 3 pilot now: planTurn 10.4/2.7/5.2%, powbonus 15.2/3.8/4.9.
   - The next turn from the game's checks (50307a9): a Ritual on the player
     (25 turns a Strength short), Toasty Mittens (54: v0.110's exhaust from
     the hand, +1 Strength), the Waterfall Giant's Debuff = Weak 1 on turns 2
     and 7 (73 turns). With the Weak the bout's Giant is 56.0% -> 46.5% (8
     shuffles; the game 56%): what it had right was two errors cancelling. The
     game's Giant fights drink on turn 1 in 46 of 50 (Attack, Power,
     Colorless, Liquid Memories, Touch of Insanity: cards the bout cannot
     make), the Giant at 206.5 after it; the 4 without, 218.3 — the bout's
     219. The potions that make cards are what the bout lacks now.
   - More of the next turn from the game's checks: energy from Seal of Gold
     (every turn, 30 of 30 fights), Pael's Flesh (turn 3), Art of War (after a
     turn without an attack) (91e26f1); Shrink runs down and shows in a
     scripted boss's next attack (63f0313). With powbonus the game plays f32
     and f47 fight for fight as before (nt-*: 35, 6) — the fight reads its
     own turn from the game — and bosslook on top is still worse: f32 35 ->
     32 (+5/-8; HP left 10.5 ± 4.5 higher), f47 6 -> 4. It is not these
     errors; the look ahead does not carry over.
   - **Act 2 played through** from s3f's f16 saves 586-705 (111; powbonus,
     the fixed bout, --stop-floor 33): the act 1 boss won 82, the act 2
     boss reached 46 and won 14. Deaths: the Kaiser Crab 16, the Giant 14,
     the Insatiable 9, the Demon 7, the Kin 5, and act 2's other fights 36,
     no one of them more than 2. The game's Crab fights (124): 70 of the 93
     losses end with both claws up — the Crusher at 74 of 219 on average,
     the Rocket at 126 of 209, in 5 turns from 65 HP: out-damaged, as the
     Giant's are. `powelite` (powbonus's planner in elite fights too, 95772ce)
     on the same 111: act 2's elites won 41/59 against 42/59, the act 2 boss
     reached 45 against 46, won 14 both; 3 of the 111 went differently.
   - **The human prior** (the other session, branch human-prior, --flags
     prior: 2 x the Spire Codex A10 winners' shrunk lift in spar's act 2-3
     reward gain), whole runs from s3f's 252 f16 saves: the act 2 boss
     30/103 -> 19/90 (base-only wins 17, prior-only 6, p 0.03), 13 fewer
     runs reaching it; engine cards taken 19/326 -> 77/286 but rewards
     skipped 48% -> 63%, the act 2 boss's deck 23.1 -> 22.4. Shelved. From
     here (the user, 2026-09-26): the other session takes act 2's fights
     (their play, the bout against the game), this one deck strength.
     `spartake` (eef4f3b): spar5 takes a reward's best offer unless it
     clearly hurts the next boss.
   - **Whole runs at a1f3054** (dev seeds 586-675; the combo, powbonus, and
     spar's bouts with every fix above): the act 1 boss 70/90, the act 2
     boss 13, floor 48 2 (593, 626), floor 49 none. Against vet-d-pow
     (1c565ec, the same flags): 67 -> 70, 14 -> 13, 0 -> 2. Against
     vet-d-base (spar3 on the bout before its fixes): the act 1 boss 57 -> 70
     (+17/-4, p 0.007), the act 2 boss 8 -> 13 (+9/-4).
   - **Act 2's deck-building played through** (s3f's f16 saves 586-705, 111;
     powbonus; paired): spar3 the act 2 boss reached 46, won 14; the combo
     44, 18 (+8/-4); the combo with `spartake` 51, 24 — against spar3 +14/-4
     (p 0.031), against the combo +13/-7. Taking the offer that does not
     hurt the next boss beats spar5's proof of help. In whole runs (dev
     586-675, eef4f3b) it does not show: against vet-d-nt the act 1 boss 70
     -> 69, the act 2 boss 13 -> 13 (+7/-7), floor 48 2 -> 0 — act 1's picks
     change too, and 90 starts reach act 2 some 65 times. On s3f's other
     f16 saves (706-855, 141) the combo 21 -> 23 with spartake (+10/-8): over
     all 252, 39 -> 47 act 2 boss wins (+23/-15, p 0.26). Positive, smaller
     than the first 111 said. `spartakeshop` (the same for the shop's buys
     and removal, 422eea9) on the first 111: 24 -> 17 against spartake
     alone (+1/-8, p 0.039; the runs less far +3/-13) — back to the
     combo's 18. Not adopted: what the shop's gold does without proof of help
     is worse spent than kept.
   - `elitedeath` on act 2 played through (the other session, 111 saves):
     the act 2 boss reached 47/47, won 14/13; the route differed on 4 seeds.
     The base's act 2 elite deaths (12, most from 16-60% HP) had the elite as
     the map's only way on by then: the route was taken at higher HP and the
     hallway fights drained it. Act 2 is attrition in ordinary fights.
   - **Act 2's attrition** (the other session, a2-base against Spire Codex's
     v0.111.0 A10 Ironclad runs, 2,418): the bot loses 1.5-2 times the
     humans' HP in every act 2 hallway fight (Exoskeleton 17.8% vs 12.1%,
     Tunneler 17.4 vs 11.1, Myte 27.4 vs 14.1, Hunter Killer 33.2 vs 20.8,
     Chomper 28.8 vs 18.4) while killing as fast (review 6: slightly faster
     once the logs' turns are +1, some multi-enemy fights slower — HP
     traded for speed). The winners' decks hold ~14 skills to ours ~8. Two halves tested on act 2
     played through: the play (the other session's hallhp / hallhp2,
     be66b84: an ordinary fight's HP counts 1.5 / 2 times) and the deck
     (`sparhall`, 173b548: spar weighs a change by the HP kept in act 2's
     ten commonest ordinary fights too, bouts built from our own logs by
     tools/hallways.cjs; with s3f's f16 decks they lose Tunneler 22.8% of max
     HP, Exoskeletons 15.7, Myte 29.9, Hunter Killer 45.2, Chomper 44.6).
     The play half, against act2-take on the same 111 (the act 1 boss fights
     identical 111/111): hallway HP lost per won fight 23.4 -> 21.5 (hallhp)
     / 21.7 (hallhp2) % of max, enemy turns 2.82 -> 2.96 / 3.07, the act 2
     boss reached 51 -> 52 / 53 at 83 -> 86 / 85% HP, won 24 -> 21 / 19 (+7/-10,
     +7/-12). A fight's HP weighted harder saves ~2 points of the ~50% gap:
     the planner is not throwing away HP the cards could keep. Dropped (the
     other session); the gap is the deck's. The deck half, `sparhall`, on the
     same 111: the act 2 boss reached 51 -> 46, won 24 -> 17 (+4/-11, p 0.12;
     the runs less far +11/-23, p 0.058), hallway HP lost per fight 25.1 ->
     25.3%: it does not keep the HP it was built to keep. Not adopted — the
     bouts' scripts (their commonest intent, no potions, no status cards)
     are not the fights that bleed the runs.
   - **The Workshop build's core** (the mod session: rules2, pathdp,
     restbudget, potions2, sleep, powbonus; no spar) on the same 111: the act
     2 boss reached 40, won 10. `nopickrates` (3fd4607: the tiers alone, no
     Untapped / Spire Codex pick rates): 47, 15 — the runs further +27/-10
     (p 0.008), the boss +8/-3; the tiers alone value higher and skip less.
     spar3 over the core: 46, 14 (further +26/-10, p 0.011); the combo with
     spartake: 51, 24 (the boss +17/-3, p 0.003). Taking more cards is the
     thread: spartake, nopickrates, and the human prior's skips going the
     other way. Act 2's rewards skipped and the deck at its boss: the core
     44%, 20.8 cards; with nopickrates 6%, 24.6; spar3 45%, 22.2; the combo
     47%, 23.2; with spartake 15%, 25.2.
   - **What the decks hold** at floor 32 (the other session: Spire Codex
     v0.111.0 A10 Ironclad decks rebuilt at f32, against act2-take): as many
     cards (25.9 winners / 25.6 ours) but 10.6 attacks to our 14.2, 11.0
     skills to 8.4, 2.7 powers to 1.5, 3.6 block cards past Defend to 2.0,
     2.2 exhaust enablers to 0.8. Humans who died in act 2's hallways held
     fewer skills (9.9), block cards (3.2) and exhaust enablers (1.7) than
     those who reached the boss, and more than ours. Ours carry Anger,
     Cinder, Molten Fist, Setup Strike, Hemokinesis, Bully, Twin Strike where
     theirs carry Shrug It Off, Flame Barrier, True Grit, Blood Wall,
     Colossus, Burning Pact, Second Wind, Feel No Pain. Next:
     `spartakeall` (9f85c1c: no skip unless every offer is never to take) and
     `sparmix` (ce858b0: act 2, 11 attacks or more, a non-attack offer first)
     on all 252. On the first 111, against spartake's 24 act 2 boss wins:
     spartakeall 17 (+2/-9, p 0.065; skipped 0%, 14.4 attacks at the boss) —
     taking what clearly hurts the next boss costs; sparmix 24 (+5/-5; 13.3
     attacks, 8.6 skills: the boss's bout seldom lets a block skill through,
     decks enter act 2 with 10.9 attacks). `sparmix2` (ae272c8: the best
     non-attack whatever the boss's bout says): 24 -> 14 (+1/-11, p 0.006;
     12.4 attacks, 8.6 skills, hallway HP lost 25.1 -> 25.8%) — it takes
     weaker cards, not the block the winners hold. The boss's bout is
     right about boss wins; a mix rule that overrides it is not the
     winners' mix. Kept: spartake (+23/-15 over 252).
   - **Offered as often, taken far less** (the other session: Spire Codex
     card_choices, 25,171 screens, against ours, 3,217): the defensive skills
     are offered to the bot as often as to humans and passed on — Flame
     Barrier taken 1% of 97 offers (humans 52%), Shrug It Off 8% (39%), True
     Grit 3% (24%), Feel No Pain and Burning Pact 0% (44%, 47%), Colossus 12%
     (57%) — and the mid attacks humans pass on are taken — Hemokinesis 77%
     (17%), Anger 65% (21%), Cinder 36% (7%). ~70% of the humans' copies come
     from card rewards. `sparhuman` (097e01c; data/take-rates-a10.json by
     act, 09dcf54): the offers the boss's bout does not clearly turn down,
     ranked by the act's human take rate. The veto lets most defensive
     offers through (re-scored on 150 act 2 screens: Shrug 77%, True Grit
     74%, Flame Barrier 71%, Burning Pact 67%, Feel No Pain 60%; their mean
     gains -3 to +2, SE ~4 — the boss's bout can barely tell them apart). On
     act 2 played through against spartake: reached 51 -> 40, won 24 -> 19
     (the runs less far +12/-26, p 0.034); it skipped 29% (a best offer
     humans take under 10% of the time is skipped; act 2's humans skip 35%)
     and held 11.9 attacks, 8.0 skills at the boss. `sparhuman2` (51fc8dc:
     the ranking without that skip): skipped 15% as spartake did, reached 44,
     won 20 (+3/-7; the runs less far +10/-18), 13.0 attacks, 8.1 skills,
     hallway HP 25.3% — the humans' take rates in place of the boss's bout
     do not give the bot the humans' deck. (What it picked at act 2's
     rewards: 134 skills, 169 attacks, 25 powers, 58 skips over 397 screens,
     against spartake's 97, 223, 15, 60 over 411 — it did take the skills;
     neither the hallway HP nor the boss followed.)
   - **It is not the mix** (the other session, a2_block_cut.py; act 2 hallway
     monster rooms, each fight less the humans' mean for its encounter):
     humans with 0-1 / 2 / 3+ block cards past Defend +1.0 / 0.0 / -0.4 of max
     HP, ours (act2-take) +8.2 / +10.9 / +8.6, act2-human2 +8.6 / +7.6 /
     +9.7. Not the obvious leaks either: block left in hand on a turn that
     then lost HP 3% of the HP, potions per hallway fight 0.31 (humans 0.26),
     upgrades by f32 5.5 (5.6). Relics: humans reaching f33 hold ~14 by f32
     (ours 8.6; elites give them 4.78 a run), worth 2-3 of the ~9 points;
     humans with 8 or fewer still lose 15.4% to our 22-25%. What is left, ~6
     points, is in the turn: every ordinary fight is planTurn's one turn.
     Next: `halllook` (planTurn2 in ordinary fights) and `hallfuture`
     (futureDamage 0.5 there: which of several enemies to hit), ab54390.
     The other session's oracle bouts (hall_oracle.mts, boss_oracle.mts: real
     fights' decks, HP and relics; paired shuffles), act 2 hallways, HP lost:
     planTurn 19.0%, planTurn2 21.1 (+2.1 ± 0.4), the exact future 1 / 2 / 3
     turns ahead 16.4 / 15.3 / 14.6 — the bout is easier than the game there
     (19.0% against 22.7%), so carried over as a share (-23%) perfect
     information 3 turns ahead would leave the game's ~17.5% against the
     humans' 14.3: half the gap; bosses f17 75.8 -> look 75.0, fair 16-sample lookahead
     75.8, oracle 2 turns 90.0; f33 28.3 -> 30.0 / 25.8 / 47.5; act 3 5.0 ->
     9.2 / 13.3 / 15.0 — a fair look ahead pays in act 3's long fights only.
     halllook dropped. The turn itself is planned on right numbers: 97.3%
     of 3,537 act 2 hallway turns' HP loss predicted exactly, ~0.7 HP a fight
     missed (the Ovicopter most). Act 3 again on 71 distinct f48/49 fights
     (× 6): planTurn 29/426 (6.8%), planTurn2 37/426, the fair 16-sample
     look 37/426 (HP -1.0 ± 0.4) — ~2 points, as bosslook's game result; the
     40-fight 5 -> 13% was noise. Not prioritised. `hallfuture` (futureDamage
     0.5 in ordinary fights) on act 2 played through: won 24 -> 16 (+3/-11,
     p 0.057; the runs less far +9/-23, p 0.020); hallway HP 25.1 -> 25.6%,
     multi-enemy fights 25.5 -> 25.7%. Dropped.
   - **Reading the act 2 arms**: every one of them was paired with act2-take
     on 586-705, whose 24 wins of 111 (22%) look lucky beside its 23 of 141
     on 706-855 (16%) — a different decision sends a run down another of
     the game's random paths, so each arm carries its own luck. Arms at
     19-21 (hallhp 21, sparhuman 19, sparhuman2 20, sparpick 21) are then
     more likely neutral than harmful; the clear falls (sparmix2 14,
     hallfuture 16, spartakeall 17, sparhall 17, spartakeshop 17) less so.
     None beats spartake. `sparpick` (94b26b2: the other
     session's conditional logit by act, skip only when every offer is
     vetoed): reached 44, won 21 (+3/-6 against spartake, +2/-1 against
     sparhuman2), 133 skills picked at act 2's rewards, hallway HP 25.2%.
     Neither human ranking helps: picking as the humans pick does not play
     as they play. spar5 with spartake's veto stays the reward rule.
   - **The humans' decks in the bot's hands** (2026-09-27; hdecks.py: 6,362
     act 2 hallway fights of the Codex v0.111.0 A10 Ironclad runs, each deck
     rebuilt back to its floor, upgrades undone; the 3,763 whose every card
     the simulator knows, with their relics and HP, in spar's hallway bout
     under planTurn, beside 658 of ours from act2-take / act2b-take). HP
     lost, % of max: humans in the game 14.0, the bot with their decks 21.2
     (+7.1 over the humans' mean for the encounter); ours in the game 23.2,
     the bot with ours in the bout 19.3 (+5.0). In the bout the bot does
     worse with the humans' decks than with its own, and the human decks
     have a tail ours do not (bouts losing half or more: 143 of 3,763, ours
     5 of 658), heavy in Burning Pact, Stoke, Havoc, Pyre, Crimson Mantle,
     Vicious, Rampage. That overturns "hallhp saved only 2 points, so the
     gap is the deck's" — but not more (Astra, review 6): the bout gives no
     potions or relic counters, its monsters are the logs' intents, 23% of
     the human fights are left out for an unknown card, the groups are not
     paired; it does not say the human decks are weaker, and 0.84 (bout /
     game, ours) is no transfer rate. Drafting as the humans draft did not
     pay in the game (sparhuman/sparpick) for as long as the play is this. A
     ridge over the humans' fights (cards, relics, encounter; HP lost in the
     game against the bout): the engine and exhaust cards are what the
     humans get HP from and the bot does not (bout minus game per copy:
     Havoc +3.9, Dark Embrace +4.0, Stoke +3.0, Aggression +3.0, Burning
     Pact +2.5, Vicious +2.6, Drum of Battle +2.6, Pyre +2.4), plain attacks
     the other way (Anger -1.4, Bully -1.7, Setup Strike -1.6, Stomp -1.7).
     Some of that is the simulator's: Havoc exhausts the top card without
     playing it, Stoke's new cards never become playable, Pyre's power does
     nothing. The rest is the one-turn play (known draws inside the turn:
     22.0 -> 20.0 for the human decks, before the Tunneler's rules below;
     the drawn weight 0.5 / 3: nothing). A fight log's `turns` is the
     game's turns_taken less the killing turn (review 6: the mode of 9.4k
     of our wins is +1), so the Tunneler takes us 3.78 turns, the humans
     4.21, and some multi-enemy fights take us longer: HP traded for speed,
     not "killing as fast"; the HP lost per turn is still 2-3 times theirs.
   - **The Tunneler** (70abb40, from the IL): Bite 15, Burrow (37 block,
     Burrowed; the block is not cleared while burrowed), Below 26 every turn
     until the block breaks, which stuns it at once (BurrowedPower
     .AfterBlockBroken: Tunneler.GetStunned, then Bite). The simulator only
     took the power off: the planner saw the 26 still coming after a break,
     and damage into the block as worth nothing (a bout: 37 block untouched
     four turns, 45 HP lost; the human 7). Now the break stuns, the burrow
     block counts as HP to take, the script is the game's, and the hallway
     bouts play it (the logs' commonest intents never burrowed). Bout,
     Tunneler fights: the human decks 24.2 -> 22.1% (block as HP; priced
     at its share of the Below 23.5, planTurn2 while burrowed 22-24), ours
     18.7 -> 18.1; the humans 10.9, ours in the game 20.8. With it the
     Bowlbug Rock's Imbalanced stun (a fully blocked attack) in nextTurn:
     the bout never had it. On act 2 played through (queue67, act2-burrow
     against act2-take, 111 saves): each save's first Tunneler fight from
     the same state (floor and HP) in both, 41: HP lost 15.8 -> 11.0
     (-4.9 ± 1.4; better 12, worse 0, the same 29 — over before the
     burrow; JEV00608 59 -> 31, JEV00651 39 -> 11, JEV00700 24 -> 0). The
     runs barely part otherwise: the act 2 boss reached 51 -> 54, won 24
     -> 24 (further +4/-2). Kept: review 6's first fixed-state win.
     The hallway bouts' other scripts are the logs' intents with no effects
     (the Silk's Weak, the Beetle's Strength): ours lose 36.3% to Rock +
     Silk + Beetle in the game, 19.5 in the bout; four Exoskeletons 27.7 /
     16.6; Myte 23.7 / 14.6.
   - **A census of act 2's transitions** (review 6's item 1; act2-take /
     act2b-take, 948 act 2 fights, 11,614 plays; the per-play mismatches and
     the enemies' turns' HP): 690 mismatched fields (6% of plays; Cascade
     and Sword Boomerang random by design). Fixed from the IL (da51891,
     49d0ed7): Spiral (a Spiral Strike or Defend plays twice: 90 of the 196
     block misses), Pael's Legion (a card's block doubled every other turn:
     30), Anticipate (its Dexterity is for the turn; the model kept it),
     The Gambit (an attack past block kills for the rest of the fight: one
     game death, predicted 20, took 72), Stampede (the game's pick is
     random; the model took the hand's first, and the planner ended two
     turns with 4 energy and a hand of attacks on that kill: 24 and 26 HP).
     The hallway monsters from the IL (01d9fc5; a background agent read
     their state machines, every intent of 783 fights fits): Bowlbug ×4,
     Slumbering Beetle, Exoskeleton, Chomper, Myte (Toxics into the hand),
     Hunter Killer, Spiny Toad, Louse Progenitor, Obscura/Parafright,
     Thieving Hopper; random branches as fixed guesses. With them: Tender's
     losses given back at the turn's end (kept for good), Flutter's last
     stack a stun, Curl Up on blocked hits. The hallway bout against the
     game on our own fights (658 × 4; potions in the game only): 19.3 ->
     25.1% against 23.2 (Myte 14.6 -> 24.0 / 23.7, Rock + Silk + Beetle
     19.5 -> 35.9 / 36.3, Chomper 30.8 / 30.1, Hunter Killer 30.1 / 28.7,
     three Exoskeletons 16.4 / 16.4; the Tunneler 16.2 / 20.8 — the game
     fights before its fix). The humans' decks in the bot's hands on the
     same bout: 27.8% (the humans 14.0). Only the Stampede, Gambit, Spiral,
     Legion, Anticipate, Tunneler, Flutter and Curl Up rules touch the
     game's one-turn play; the scripts reach it through nextTurn only (the
     look ahead), and the bouts. To be shown on real fights before they
     count (review 6).
   - **The look ahead's scoring** (the card-play session, 2026-09-27):
     planTurn2 sums the second turn's best score over 4 hands, and a kill
     there scores WIN + 10·HP (a death -WIN): each kill adds 250,000 to the
     mean, so the line picked is the one with most turn-2 kills out of 4 and
     HP only breaks ties; every line also draws its own hands (the seed is
     its end state's hash: no common random numbers). planTurnRoll and the
     lab's fair16 average the same way. So bosslook's, halllook's and the
     oracle study's "a fair look ahead does not pay" measured this, not the
     game. Their lab fix (a win as the HP it keeps, a death -2·max HP less
     0.35·enemy HP, shared seeds, 5 ends × 16): act 2 hallways, interim,
     -0.8 HP% against planTurn's 19.0 (planTurn2 as it is +2.5). Here as
     `--flags lookfix` (b9a9f9e, their patch). On the IL's hallway scripts
     (01d9fc5; 120 act2-take fights × 2 shuffles, paired): planTurn 24.4%
     (the game 22.7), planTurn2 as it was +0.4 ± 0.7, with lookfix -1.9 ±
     0.6, a 2-turn rollout -2.0, the cheat one / three turns known -4.2 /
     -6.5; deaths 17 -> 11 (the cheat's 11). In the game (eval58 at
     b9a9f9e, s3f's 586-705, act 2 played through): the census's one-turn
     fixes, act2-burrow -> act2-fix: hallway HP 22.7 -> 22.4%, deaths 19 ->
     17, the first hallway fight from the same state -0.5 ± 0.5 (better 5,
     worse 1, the same 73), the runs further +10/-4 (against act2-take,
     the Tunneler's with them: +12/-3, p 0.035) — kept. halllook + lookfix
     on them, act2-fix -> act2-fixlook: hallway HP 22.4 -> 20.8% (the
     bout's -1.6 exactly), deaths 17 -> 15, but the first hallway fight
     from the same state +0.9 ± 0.7 (better 15, worse 22, of 82) and act 2's
     boss 25 -> 22 won (+7/-10): the all-fights mean mixes states that
     have parted; the one clean comparison does not show it. Not promoted;
     act2b-fix / act2b-fixlook (706-855, 141 more first fights) and the
     card-play session's forks to decide. A 3-turn rollout
     (8 samples) -2.6 (deaths 14). Bosses (spar's bouts on HEAD, 40 fights
     × 3, powbonus's planner inside): act 1 won 79.2% -> planTurn2 +
     lookfix 79.2 -> a 2-turn rollout + lookfix (5 ends × 8, 1500 nodes)
     85.8, deaths 25 -> 17 (the Waterfall Giant 13 / 10 / 13 of 24: one
     turn looked at loses it, two do not; Matriarch 17 -> 21); act 2 21.7
     -> 24.2 -> 29.2 (the cheat 40.0; the Insatiable 6 / 10 / 13 of 39,
     the Crab 1 / 3 / 5 of 24, the Knowledge Demon 19 / 16 / 17 of 57 —
     worse with a look, to watch). `--flags bossroll8` (2662b8b): that
     rollout as powbonus's inner planner in boss fights (bossroll's own
     BOSS_ROLL sat behind powbonus in the chain and never ran). A leaf with
     `long` 1: nothing; with future / futureBlock: worse in hallways. In
     the game (eval59 at 4a2ab60; s3f's 97 f32 saves, act 2's boss from
     the same state, a2boss-base / a2boss-roll): won 35 -> 36 (+7/-6, p
     1.0; the Crab 9 -> 12 of 31, the Knowledge Demon 16 -> 13 of 39, the
     Insatiable 10 -> 11 of 27), HP -2.0 where both won. Not shown; the
     bout's +7.5 points did not carry (its base 21.7% against the game's
     36.1% on these: the bout's act 2 bosses are harder than the game's).
   - **Human runs replayed in the game** (the card-play session, 2026-09-27;
     the user raised it to first priority): Spire Codex's step-by-step
     replays (489 v0.111 A10 Ironclad, 120 wins; Ace Ryo 19 clean wins).
     A human seed on the veteran profile reproduces the run (map, boss,
     Neow, hands, enemies); the human's plays, driven, end fights at the
     human's HP exactly (28/29 draw checks; the first drift at floor 13,
     spawned Wrigglers' HP). The bot then re-fights each fight from the
     same save — the same deck, relics, potions, HP and draws. Ace Ryo's
     A7R6HPY1A6PZ, 10 fights: the human lost 122 HP; the combo 284 and
     died in 3 (the Bygone Effigy f9, the Phrog Parasite f13, the
     Ceremonial Beast f17 — the human lost 20, 6, 34); with halllook,
     lookfix, bossroll8 better (Fogmog 37 -> 17, the human 14; the Phrog
     from dead to -38), the Effigy and the Beast still deaths. The
     simulator's turn predictions were exact: the play. The bot blocks
     against scaling enemies where the human races (the Effigy: 25 a turn
     from turn 3, blocked two cards a turn for 10 turns, dead; the human
     bursts with Armaments+ into Slow's many-card turns), spreads damage
     over Wrigglers the human kills one by one, and plays Drum + Pommel
     where the human's Barricade+ (turn 5) held the Beast 16 turns. On 51
     of the human's turns: the one-turn evaluate puts the human's end
     -2.7 below the planner's, the fixed look ahead (16 shared hands) +6.2
     above (the human's better on 14, the planner's on 10). pairs.jsonl per
     replay (the human's and the planner's end from the same start, both
     scored): review 6's item 2 data — a leaf value that ranks the human's
     end above the planner's, against the real outcome. Unscripted act 1
     monsters (the Effigy, the Phrog and Wrigglers) gave the look ahead
     no growth to see: scripts-act1.ts (cf49017; the six elites and 38
     hallway monsters from the IL, every one of 58,572 monster turns of
     11,701 act 1 fights in our logs fits) — the Effigy wakes to +10 and
     Slashes 25 for good, the Wrigglers grow 2 every other turn,
     Byrdonis 1 a turn. A leaf value fitted on the pairs (pairfeat.ts /
     pairfit.py, scratchpad; the first drives' batch: 978 pairs, 267 kept —
     exact, lines differing as multisets, no unseen draw on either side —
     from 30 runs): held out by run, a logistic model on the two ends'
     feature differences ranks the human's end higher on 68%, the one-turn
     evaluate on 25% (the planner's end is its argmax), the fixed look
     ahead on 48%. Its weights read as the humans' style: fewer enemies
     alive (-0.8 to -1.9 a monster: they finish one), fewer turns left,
     potions kept (-4.3 a potion), Colossus / Flame Barrier / Feel No Pain
     up — and HP given up (-0.17 an HP). Added to evaluate
     (`useLeafBonus`, search.ts, off by default) it made the IL hallway
     bout worse at every scale (our 658 × 4: 24.1% HP lost -> 30.2 at 2×,
     36 at 5×, 52 at 10×); fitted with evaluate as a feature it gave
     evaluate no weight (-0.0006), so no scale ties it to HP (bout 56-58%).
     Imitation against the planner's own argmax learns what humans do
     differently, costs included: not a value. Stopped (review 6's rule).
     Item 2 needs the outcome: from a replay's fight save, the human's
     plays driven to turn t, then {the human's line, the planner's line},
     each played on by the bot to the fight's end in the game — the turn's
     choice priced under the bot's own continuation. **Done** (the card-play
     session's replay-drive.ts forks, 2026-09-28; 200 exact decision points
     from 23 human runs, mostly act 1: 109 where the one-turn evaluate
     prefers planTurn's end and the fixed look ahead the human's, 91 the
     control where the look ahead prefers planTurn's; each branch played
     on by the bot to the fight's end in the game). With the combo (C)
     continuing, human's turn better / even / bot's better: where the
     look ahead backs the human 57 / 37 / 14 (hallways WEAK 21 / 4 / 0,
     NORMAL 16 / 7 / 2; elites 13 / 12 / 8; bosses 4 / 14 / 4); the
     control 26 / 14 / 21. So in ordinary fights the look ahead's "the
     human's end is better" is right against real outcomes nearly every
     time the one-turn evaluate disagrees; its "the planner's is better"
     is a coin. At the 95 boss and elite points, the look ahead's own
     turn-t choice as branch B (each arm continuing with itself): C 17 /
     26 / 12 (look-says-human; deaths human's turn 15, bot's 20),
     lookfix + lookdiverse 19 / 28 / 8, + lookwide (K 20) 17 / 30 / 8; the
     human's turn beats the bot's ~1.6× as often and the bot's leads to
     ~40% more deaths whatever the candidates — there the gap is in what
     the look ahead's leaves and scripts value, not in the lines it sees
     (lookfix alone 21 / 26 / 8, bot's-turn deaths 21 against C's 20; only
     the HP where both won shrinks, +1.6 -> +0.1 with lookwide). At the 53
     hallway points where it backs the human, the look ahead's own choice
     (halllook + lookfix continuing): 22 / 27 / 4 against C's 40 / 11 / 2
     — read then as "it finds the human's end about half the times it would
     back it", which review 7 corrects: the arm changes the continuation
     too (NORMAL's human end in the one-turn top 5 58%, top 20 89%);
     `--flags hallwide` (26c2528: halllook at K 20) on the same points
     next. Bosses and elites need more than two turns seen: a value from
     real outcomes (the branches), not a wider search. First fit on them
     (forkfeat.ts / forkfit.py, scratchpad; batch 1's 200 points, C
     continuing: the human's branch better 94, even 60, the bot's 46):
     where the outcome differs (140), the sign of the one-turn evaluate's
     difference is right 32% (it backs the bot's end, wrongly 2 to 1), the
     fixed look ahead's 62%, a ridge value of the two ends' features held
     out by run 54-58%. Its weights now read as a value (HP +0.5 an HP;
     Crimson Mantle +3.3, Feel No Pain +2.5, Barricade +1.1, Dark Embrace
     +0.9 a stack; -0.9 an enemy alive; -0.8 a potion drunk; Weak / Vulnerable
     on them +0.8 / +0.5; their Strength -0.6) but 200 points are too few
     to beat the look ahead. Batch 2 (forks2: 200 more, 69 of act 2; the
     human's turn better / even / the bot's: look-says-human 67 / 34 / 28,
     bosses 9 / 15 / 6, elites 23 / 11 / 8; the control 36 / 11 / 23). Both
     batches, 397 points: the one-turn evaluate's sign right 33%, the look
     ahead's 61%, the ridge value held out 57% (its weights unsteady
     between batches: Weak on them +0.8 -> -2.4). A linear value of these
     features does not beat the look ahead on 400 labels. (Review 7: "the
     look ahead is the best predictor there is" overstated — "the human's
     branch is better" alone is right 67.8% of 398 points without ties,
     the look ahead 60.6%; a value fit must report that baseline, with
     deaths and HP.) The hallway pick: at the 53 hallway points, hallwide
     (K 20) 18 / 29 / 6 and lookadapt (3aa7842) 19 / 29 / 5 against
     lookfix's 22 / 27 / 4. (Review 7: each arm changes both the turn-t
     move and the continuation, so "it finds the human's end half the
     times" does not follow; and 3aa7842's lookadapt re-rated the best 3
     but picked among all, so a noisy 16-hand mean could still win — no
     test of the sampling error; the pick is among the re-rated since
     review 7's fix.) Whole fights
     from the replays' exact saves (fixed state, each arm the whole fight):
     171 elite and boss fights, C against C,halllook,lookfix,bossroll8:
     deaths 39 -> 30 (C's alone 18, the look's alone 9, p 0.12), HP -1.6 ±
     1.1 where both won (123). **The hallway look ahead on fixed real
     states**: 414 exact hallway fight saves of the replays (acts 1-2,
     non-elite, non-boss; each arm the whole fight from the save), hlook
     (C,halllook,lookfix) - hC (C): -0.89 ± 0.32 HP% of max (better 136,
     worse 82; deaths 2 -> 1); WEAK -0.92 ± 0.30 (294), NORMAL -1.06 ± 0.84
     (117); act 1 -1.10 ± 0.31 (362), act 2 +0.61 ± 1.44 (52, 18 / 18: the
     Bowlbugs +13.3 on 5, the Spiny Toad +3.7 on 4; Exoskeletons, Mytes,
     Hunter Killer, Ovicopter better). Shown (review 6's fixed-state step)
     for act 1's hallways. The act 2 Bowlbugs: a tie at the look's noise
     (U3F06ZT323WD f19: four ends within 0.5 HP, the pick drew first and
     blocked after; the game's draw left 15 block where the one-turn line's
     21 stunned the Rock) — `--flags looktie` (426da02: a tie within 1 HP
     goes to the higher one-turn score; bout -0.08 ± 0.18, no harm) is the
     htie arm on the same saves. Act 2 played through, both s3f sets
     (act2-fix / act2-fixlook 586-705, act2b-fix / act2b-fixlook 706-855):
     the first hallway fight from the same state -0.12 ± 0.47 (194; the
     Tunneler +1.0 on 63, the Exoskeletons -1.5 on 41), act 2's boss won 53
     -> 46 (+13/-20, not shown; potions into it 1.1-1.4 in both, HP 85-86%);
     the census's fixes on 706-855: act2b-take -> act2b-fix, the boss 23 ->
     28 (+7/-2), the runs further +16/-9. So the hallway look ahead is
     shown in act 1 and not in act 2: `--flags halllook1` (halllook on
     floors 1-17 only). looktie on the 414 saves: htie - hlook -0.01 ± 0.18
     (the Bowlbugs -4.6 on 4, the Slimes +1.0 on 38): neutral, left out.
     **The second confirmation** (2026-09-28, spire-jev-conf2 at eeeec65;
     fresh seeds 1516-1845, 330, whole runs at A10, floors 16/32/47
     captured): conf2-c-a10 (C) against conf2-look-a10 (C + halllook1 +
     lookfix), paired by seed. halllook1 is `!bossFight && floor <= 17`:
     act 1's elites are in it too (review 7) — read conf2 as act 1's
     non-boss fights. 330 pairs detect ~6.5 points at 80% power. **Done**
     2026-09-28 15:16 (C stopped at 13:57 for the evening's idle window and
     its 117 seeds left rerun on 7 sandboxes: conf2-c2a / conf2-c2b, joined
     with queue73's logs as eval-conf2-cfull-a10.json): act 1's boss
     beaten 241 -> 260 (73.0 -> 78.8%; +37/-18, p 0.014), act 2's 44 -> 59
     (13.3 -> 17.9%; +36/-21, p 0.063), act 3's first 2 -> 3, wins 0 / 0,
     errors 0 / 0. The last step of the method: **the combo + halllook1 +
     lookfix is the new best** (C2 = pathdp,restbudget,potions2,sleep,
     spar,spar3,spar5,spar4up,spar4shop,powbonus,spartake,halllook1,
     lookfix; SPIRE_JEV_POW_BONUS=10).
   - **Direction, review 7** (Astra, 2026-09-28, docs/astra-review-7.md;
     the user asked): review 6 holds.
     Combat decisions and fidelity stay the main line, now aimed at act 2's
     boss; small causal run-level tests start now; widening or resampling
     the hallway look ahead stops. The funnel (eval-conf-best): act 1 done
     528, act 2's boss reached 307 (58% of those), beaten 102 (33.2%),
     act 3's first boss reached 60, beaten 6 — act 3 is the next wall, not
     a consequence of fixing act 2; +10 points of act 2's boss beaten is
     ~+4.65 of act 2 completion; 25% completion needs ~54% at the boss.
     Corrections: the replays' "exact" checks HP after fights and draws,
     not the full state (04Y1GLVP01WK f5: an extra Lantern in the game,
     its later pairs still "exact"): bot-against-bot A/B on one save stands,
     human-against-bot gaps are not all play; recomputed, the drives are
     exact to a median floor 11, act 1 whole in 21, none past floor 33;
     155 of the 171 elite and boss saves are act 1's. The act 2 bout
     against the game (21.7 against 36.1% at the boss) is unmatched: 35 of
     the 97 base boss fights had simulator mismatches, 48 inexact plans —
     cards, transitions and the state's reconstruction to check, not the
     boss scripts alone. The ± are standard errors; clustered by source
     run act 1's is ~0.28 and holds; promotion needs deaths, net HP after
     the fight, potions / revivals and the tail too. Plan: P0 (day 1) the
     evidence frozen (hashes, lists, exclusions), the tables one command
     to rebuild; P1 (days 1-4) act 2's boss calibrated — ~30 of the bot's
     own entry states a boss, the first important deviation in the lost
     fights, fixes by impact, then bounded multi-step rollouts; +10 points
     on held-out real states (200-300 pairs); P2 (days 3-8) candidates
     against value — the human's move injected as a candidate at 60-90
     high-loss points; if ranking is it, ~600 new points × 4 candidates
     (half the bot's own act 2 boss and elite states, a quarter mechanism
     counterexamples, a quarter random), split 400 / 200 by source run, a
     small nonlinear model (trees) on lookfix as the base or residual,
     death risk apart from net resources; the 398 points so far are for
     development only; P3 (days 4-10) run-level tests from one save to act
     2's end: hallway potion pricing (~150 pairs), one more act 1 elite,
     one build investment (~120 pairs each), +5 of act 2 completion; P4
     (days 8-14) one candidate on fresh seeds (+5 points needs ~560
     pairs). Stopped: hallway K / sampling / tie sweeps; bout win rates,
     imitation rate or relic counts as promotion evidence; the imitation
     model and linear fits as a value; the replays' long-tail exactness;
     deeper search, ISMCTS or a big simulator rewrite before transitions
     and ranking are calibrated; a whole-run confirmation per switch;
     fixing act 2's boss without looking at act 3. "Stable": 43 wins of
     330, or 80 of 660, most of them clean.
   - **P1, act 2's boss: the census** (a2boss-base's 97 fights from s3f's
     f32 saves): 71 of 529 end-of-turn HP predictions missed (13%; the
     hallways 2.4%) — Crab 26, Knowledge Demon 25, Insatiable 20; 199
     turn-start fields mismatched. By fight, the patterns: -5, -4, -3 …
     with Regen and +1 a turn with Inferno are the log's timing (the heal at
     the turn's end, the SelfDamage at the start, which startOfTurn has);
     +4 a turn in the 6 fights with Ripple Basin and an energy over in the
     4 with Art of War were real: "no attack this turn" read a mid-turn
     rebuilt state's own count, 0 — the runner now counts the turn's
     attacks into State.attacksBefore (3597943, a9dde2a). Toasty Mittens'
     hand one over is the check's timing (the game asks for the card to
     exhaust after the observation). Left: a hand one over in ~6 fights
     with no common relic (Frantic Escape and Relax held; the catalogue
     shows no Retain on either), the Crab's HP off by 2-6 at a turn's start.
     The bot's own entry states (p1-boss-c: eval-conf-best-a10's 307 f32
     captures, the floor 33 fight only, C at 5b1301c): won 99 (32.2%) —
     the Crab 17/94 (18%), the Knowledge Demon 45/110 (41%), the Insatiable
     37/103 (36%); the same outcome as the confirmation's own fights (at
     39fa6c6) in 298 of 307. A stable fixed-state set for act 2's boss:
     review 7's +10 points is to be shown here. The Crab: 68 of its 77
     losses end with both claws alive (5.5 turns, 69 HP in; the wins 82 HP
     in, the Crusher down first in 14 of 17, the damage focused on one claw
     where the losses spread it — JEV00884 201/167 -> 91/96); its play
     mismatches are mostly random-target cards (Sword Boomerang, Cascade) on
     two claws, by design. Against the humans' 49 Crab wins (the card-play
     session's replays, crab_focus.py): the bot's wins look like theirs
     (a claw killed by turn 5, ~75% of the damage on it, the other left at
     ~150 for the Rage); 41 of the 68 no-kill losses dealt enough for a
     claw, spread (the more-hit one left at ~39); by turn 5 the losses dealt
     214 against the humans' 290. A claw's death gives the other Crab Rage
     at once (sim.ts died: +6 Strength counted in this turn's hits), so the
     one-turn score sees a kill as more damage and nothing of the dead
     claw's attacks gone. `--flags crabfuture` (61a8c21: futureDamage 0.5 in
     Crab fights) on the 94 Crab states: won 17 -> 15 (+2/-4), plays changed
     in 85 of 94, the kills and the focus not (a claw killed in 26 both,
     focus 0.68 both). Dropped. A fresh C arm matches p1-boss-c play for play
     on all 94: the set is deterministic. Leads: which claw and when to
     turn (the bot kills the Crusher first 19 of 26, the humans 23 / 26
     either way; Surrounded's back attacks), and the damage itself.
     How near the 208 losses of the 307 came: the enemy HP left at the
     last turn, median 201 of the Crab's 428, 128 of the Knowledge Demon's
     399, 90 of the Insatiable's 341 (31 of its 66 losses within 80): the
     Crab is the deck's test, not the play's. Potions: 392 of the 397 go on
     turn 1 (potions2 by design; heals and block kept), every near loss had
     drunk them all, and only 28 losses end within 40 HP: timing's ceiling
     is 2-3 points. Neither gets a slot.
   - **The step-by-step rhythm** (the user, 2026-09-28: an idea goes through
     the offline replay, then only the saves it can change, then tens of
     pairs, and a batch confirmation now and then). events2 (the analysis
     session's branch, events by A10 players' choices) on the saves its
     decisions reach (src/affected.ts on eval-conf2-look-a10): 27 f16 saves
     to the act 2 boss, floor +0.04 ± 0.17, the boss 8 vs 9, HP there +3.7
     ± 2.6; 25 f32 saves to the end, floor +0.32 ± 0.50, act 3's boss
     reached 15 vs 13, beaten 1 vs 1. Neutral; its act 1 part waits for a
     batch confirmation. **A bench from a capture is not the run's own
     continuation**: C2 from those 25 f32 saves, the same code, matched the
     run to the end in 15. Three chose otherwise on the capture floor itself
     (1639 took a card the run skipped and lost the boss the run beat): the
     resume came back without the choices' state (spar3's opening, the
     upgrade or removal planned; restoreChoiceState ran only for a crash's
     own checkpoints). Now a capture writes `<save>.choices.json`, that
     floor's first checkpoint and the cards learnt, and --resume reads it:
     on 4 fresh f32 captures every floor 32 choice and boss fight is the
     run's own with it, 1639 and 1830 not without. The rest parted later
     with the same choices and different rewards (1807's potions, 1770's
     card offer): the game's own draws after a resume, beyond a sidecar. So
     both arms play from the saves, always; a save played twice is the
     same play (94 of 94). An eval's process plays a chunk of seeds and
     resets none of the choices' state, the cards learnt or spar's caches
     (their keys hold neither the opening nor which relics) between them:
     a seed's first choices can hang on the seed before.
     The analysis session's candidates, both arms from the saves, the dev
     half (odd seeds) of the saves each can change, pre-registered, a check
     half only on ~2 SE:
     - `smith2` (the winners' rest thresholds): 60 f16 saves to the act 2
       boss, the boss 12 vs 22 (+3/-13), HP there -22.9 ± 1.9 points, for
       1.25 more upgrades; 42 f32 saves (floor 32's smith or heal alone), the
       boss 17 vs 21, HP -22.1 ± 1.9, act 3's boss reached 6 vs 12. Harmful.
     - `smithhuman` (upgrade what A10 players upgrade; which card, not
       whether): 60 f16 saves, the boss 18 vs 18 (5 / 5), HP +3.3 ± 2.1,
       the Skills and Powers upgraded by 33 +0.08 ± 0.11. Neutral.
     - `shoprm` (the shop's removal back): 60 f16 saves with an act 2
       shop, 0.48 fewer basic cards, the boss 11 vs 17 (+2/-8), HP -0.15 ±
       1.30. Its curses-only form (SPIRE_JEV_RM_KEEP=99, set in queue88.sh;
       the bench log records only shoprm): 38 of the 77 f16 saves it can
       change against bench-c2full-f16, 0.87 fewer curses, the boss 5 vs 10
       (+1/-6; act 2 finished -13.2 ± 6.7 points), 0.84 fewer other buys a
       save: a removal takes the gold the buys had. The two together 3 vs
       14 flips (p ~0.01): harmful.
     - `engval` (a Power's worth measured: the next turn planned with and
       without it over 8 shared draws, times the turns left): on P1's
       states (the boss alone; A = p1-boss-c, this commit's C2 play for
       play) the pack +Feel No Pain, Burning Pact, True Grit -3 Strikes
       under C2 16 vs 15 won (46), engval on it 17 vs 16, HP at the end
       (hpEnd, 0 dead) +0.97 ± 0.73 (review 8; the +0.88 first written took
       the start less the HP lost), on the bot's own decks 19 vs 19, -0.27 ±
       0.27 (60): C2 already
       plays Feel No Pain in 35 of those 46. On the replays' exact hallway
       and elite saves (554, acts 1-2): HP lost -0.38 ± 0.26 (better 36,
       worse 24, deaths 20 / 20, Powers a fight 0.32 -> 0.42; plays changed
       in 66), elites -0.81 ± 0.84 (143). Right-signed, not shown; spar's
       bouts do not see it, so the decks it would pay in are not built.
     events2's and smithhuman's changes are mostly act 1's, which f16 saves
     have settled: their "neutral" is acts 2-3's. The next whole-run batch
     captures 4, 8, 12, 16, 32, 47 (with sidecars) for act 1's.
     That batch (c2early, seeds 1846-2045, 6a0a9e8, 200 runs, no errors):
     act 1's boss 159 / 193, act 2's 37 / 101, act 3's first 1 / 18, wins 0
     (the second confirmation's 78.8% / 17.9% again). Act 1 from its f4
     saves against a bench of all of them (bench-c2full-f4), HP% at the
     boss, 0 if not reached: events2 dev +3.91 ± 2.71 (20), check +7.08 ±
     7.20 (20), pooled +5.50 ± 3.80 (40, the boss 33 vs 31): same-signed,
     1.4 SE, undecided and stopped on budget (the -2.35 ± 3.43 first
     written counted only the 18 pairs both at the boss, not JEV01906 and
     JEV01916, which only the candidate brought there; review 8);
     smithhuman dev +1.93 ± 1.63 (26), check -1.06 ± 1.22, pooled +0.49 ±
     1.04 (50, 42 vs 41; the Skills and Powers upgraded +0.46 ± 0.13):
     neutral. **99 of the 200 f4
     saves never resumed** (ECONNRESET on Staging11): each had a fight on
     floor 4, and a capture resumes at its floor's room, so into the fight;
     events, shops and rests resume. Capture act 1 at floor 1 (Neow), or
     resume fights on the replays' bridge (Replay2).
   - **The character adaptations' plumbing** (char-plumbing, the Regent,
     Silent and Necrobinder sessions' shared branch; 31 files, the veteran
     profile with the other four at A10): e94aeb7 played the Ironclad's
     C2 fight for fight as main on 18 saves (6 f4, 12 f16; 100 fights;
     the profile's maps checked by the Silent session), merged. Then the
     Regent session's find: Vigor was added to Spiral's and One-Two
     Punch's replays too (VigorPower.AfterAttack spends it on the first
     play; a Spiral Strike at -2 Strength and 2 Vigor, 12 modelled, 10 in
     the game), now spent after the first play. Then 221fa1b (hooks),
     b0edc12 (Ambergris: an extra turn, AmbergrisPower.ShouldTakeExtraTurn;
     held in 76 of the baselines' 4,330 fights, drunk 28 times, always on
     act 1's boss by potions2) and 7fac83f (the Silent's core), merged
     (b4e8f8f) after 17 saves without Ambergris played fight for fight as
     main; of 6 whose base drank it, 3 part at that fight (its turn's loss
     now predicted 0, not 5) and 3 play alike.
   - **sparengval** (the engval branch, 208769e; not in main: the user took
     only src/replay-rewards.ts from it, b3981ea): spar's bouts planned with
     engval too, so a deck's Powers are worth what they do in the turns to
     come. Offline (replay-rewards on c2early, acts 1-2, 1 reward in 10:
     200; C2 replayed as chosen 95%): 18 picks changed, a Power taken in 9
     of them against 1 given up, a skip in 4 against 1 (Powers picked 20 ->
     28 of 200); spar5's score of a Power +2.21 ± 0.73 (73); 1.35 times the
     CPU where it costs most (the Crab, the Insatiable). In the game, C2 +
     engval + sparengval from the 157 odd f16 saves to the act 2 boss, A =
     bench-c2full-f16 (3 of them replayed as A, play for play): HP% at the
     boss (0 if not reached) -0.01 ± 1.54; the boss reached 83 vs 81, beaten
     26 vs 30 (+9/-13); act 1's boss HP lost -0.12 ± 0.31. The mechanism is
     all there: Powers in the deck at 33 +0.27 ± 0.08 on the 77 pairs both
     at the boss (+0.20 on all 157, the early deaths' decks with them),
     played a hallway fight 0.44 -> 0.70, rewards skipped 0.92 -> 0.83; no
     timeout (one connection reset at a shop, resumed). Stopped on budget,
     no check half (act 2 finished: a one-sided bound of about +2.4
     points): the engine line (engval, then the deck) stops here.
   - **Review 8** (Astra, 2026-09-30, the analysis session ran it; into
     docs/ when the user says): the nine did not show the engine, the deck
     or the driving worthless, only that small nudges read on distant,
     noisy measures stay under the bar. Three labels, not "zero": undecided
     (events2's act 1), stopped on budget (sparengval), harmful (smith2,
     shoprm). Measures: a long continuation's primary is act 2 finished
     over all starts (HP at the boss, 0 if not reached, missed 10 of the 22
     boss flips), HP at the boss beside it; a bench's --stop-floor stops at
     the first fight after one on or past that floor (run-fights: the last
     logged fight's floor), so stop 34 plays act 3's first fight and
     bench.ts's "reached floor 34" can read 0 when the boss was beaten:
     take f17 / f33 from the fights themselves. Its next steps (the user's
     to choose): fixed-state real forks at 60-90 of the bot's costliest act
     2 boss and elite decisions, two structurally different candidates
     each, the driving after fixed (no good candidate, or a good one not
     chosen?); one more act 1 elite from f1 saves, both arms to act 2's end
     (act 2 finished over all f1 starts); act 2 hallway potions (search.ts:
     a 0.3 price whenever any enemy has 100+ max HP, so they go early),
     f16 to act 2's end, 120-150 pairs, 0.3-0.5 more potions into the boss.
     The user chose all three.
   - **Review 8's forks** (branches forks 676e18f / forks2 3749c2e, local;
     SPIRE_JEV_FORK: at a fight's floor and turn the end of one kind among
     the turn's — explore(diverse): block, damage, power, noPotion, focus on
     one enemy — played card by card, matched by card and target, the bot
     after; forks2's until keeps the kind up to a turn, a focus on the first
     turn's enemy). Every bot arm (180) played its source fight play for
     play. Round 1, the turn before each fight's worst enemy turn, one turn
     off the bot's line: 90 points (60 lost act 2 boss fights of P1's, 30
     act 2 elites of c2full-f16's), 63 with a distinct candidate: the Crab
     14 all lost whatever was played, the Knowledge Demon 1 flip in 14, the
     Insatiable 3 in 9 (block +5.5 ± 2.8), elites 18 won either way;
     flips 5 up / 3 down; where all lost, a focus or a Power left the
     enemies 21-25 HP more. Undecided: the points came when the fight was
     mostly settled, and one turn off is undone the next. Round 2, turn 1,
     the candidates kept up (the analysis session's design): two strata of
     30, close losses (the enemies under 60 HP at the death) and close wins
     (under 30% HP left), and the Crab's own 30 (15 lost, 15 won), focus
     on one claw until it dies or turn 5; the test net flips (the losses a
     candidate wins less the wins it loses: luck's regression to the mean
     is about 0 there). Close fights: block -6 (won 1 of 13 losses, lost 7
     of 14 wins), damage -4, power +1 (7), all -9; the Crab: focus on the
     weaker claw -7, the other -8, all -15 (won 0 of 24, lost 15 of 23; HP
     in the won fights -22 points), dev and held alike (-8 / -7). The bot's
     own line beats these structural ones at the start as late: the kept-up
     focus on the Crab is harmful, block and damage kept up do worse; what
     loses is the state the fight begins in (the deck, the HP), which is
     what the elite and the hallway-potion tests change.
   - **Floor 1 captures** (c2f1, main c1ac146, fresh seeds 2046-2245, 199
     saves with sidecars, each run played only to its capture: every one
     resumes, Neow's first choice already in it) and the C2 base from all
     of them to act 2's end (bench-c2f1-base; 2165 / 2167 played again
     after a port collision interrupted them, and played as before).
   - **elite1** (the analysis session's p3-potions-elite 25de51f, off by
     default: act 1's path aims at one elite more than pathdp's own plan,
     set at the run's first map, dropped below half HP; C2 on this branch
     played 3 f1 saves as the base, play for play): the 99 odd f1 saves
     to act 2's end. Act 1's elites 0.60 -> 1.42 (+0.83 ± 0.05); act 2
     finished 17 -> 19 (+12/-10, +2.0 ± 4.8 points; one-sided 95% bound
     about +9.9), act 2's boss reached 52 -> 57; but act 1 paid: deaths
     before its boss 2 -> 6 (+4.0 ± 2.0 points), its boss beaten 86 -> 79
     (-7.1 ± 4.6), HP% at it (0 if not reached) -7.0 ± 2.2, upgrades
     -0.28, for +0.81 relics and +0.36 cards. Stopped on budget, no check
     half (0.4 SE): the relics did not turn into act 2's end, and pathdp's
     caution about elites is not without reason.
   - **hallpots** (the same branch: act 2's ordinary fights keep a potion's
     full price where an enemy has 100+ max HP; elites, bosses and the
     runner's urges as they were): the 185 f16 saves whose base
     (bench-c2full-f16-c1, c1ac146, the 315 to act 2's end) drank in an act
     2 hallway fight, to act 2's end; the other 130 play as the base (a
     price only rises). Hallway potions 1.64 -> 1.46 a run, into act 2's
     boss +0.15 ± 0.04 (registered +0.3-0.5); act 2 finished 44 -> 43
     (+6/-7; -0.5 ± 2.0 points on the 185, -0.3 ± 1.1 on all 315, a
     one-sided bound of about +1.5); hallway deaths 48 / 49, HP at the boss
     -0.6 ± 0.9. Stopped on budget: the discount barely moves the potions,
     and the few kept do not reach act 2's end.
   - **The hallway forks** (the user's next pick: the bot's act 2 hallway
     fights cost about twice the humans'): the 8 act 2 ordinary encounters
     costing most in bench-c2full-f16-c1 (HP lost, + 10 a potion: the three
     Bowlbugs 33.9, Spiny Toad 28.8, Hunter Killer 26.8, Chomper 26.6, Louse
     Progenitor 24.7, Myte 23.2, Egg + Nectar + Rock 22.8, The Obscura
     21.3), 15 fights of each drawn at random, whatever came of them; turn
     1; block and damage kept to turn 2, power to turn 2 where a Power is in
     hand, guard (forks2 3865098: the most block when an attack is coming,
     else the most damage) the fight long; judged on the points where the
     plays parted. Dev half (62; the bot 29.3 a fight, every bot arm its
     source): block +5.2 ± 1.6 a fight (44 of 61 parted; deaths 8 / 5),
     damage +8.0 ± 1.9 (48), guard +7.7 ± 2.8 (52; deaths 9 / 5, +10
     potions), power +1.9 ± 1.7 (9 of 18). Every one costs more than the bot:
     harmful (power undecided); the held-out half not run. The hallways'
     cost is not these structural choices; the deck's defence is next.
   - **The Gremlin Merc's Surprise** (b06a323; the Defect session's find,
     SurprisePower.AfterDeath): its death brings a Fat and a Sneaky Gremlin,
     not the win the model had. **And a regression the characters' merge
     brought** (148a0a9): the Necrobinder's keyExt ("" for the Ironclad)
     put "|" on every Ironclad state key since 4b75738, and lookfix seeds
     its sampled draws by the key's hash, so act 1's hallway look ahead drew
     other hands: 25 of 31 f1 saves parted from c1ac146's base before floor
     16 (bisected on JEV02074's floor 2, then the hooks one by one); the
     Defect session's f16 check could not see it (act 2's hallways have no
     look ahead). extKey adds nothing when no character does. At 148a0a9 the
     31 f1 saves that meet the Merc play as the base up to it in 30 (the
     last holds the Defect's Bulk Up, a foreign card); its fight -1.1 ± 0.9
     HP + 10 a potion (30, all won).
   - **The deck's defence** (the analysis session's design, the user
     approved): bench-c2full-f16-c1's f16 saves with 3 unupgraded Strikes
     swapped (edit_deck.py) for a defence pack D (Flame Barrier, Shrug It
     Off, Impervious) or an attack pack K of the same human act 1 pick rate
     (Uppercut, Fight Me, Pommel Strike), C2 to act 2's end, the 153 odd
     seeds. Act 2's hallway cost a fight (HP lost + 10 a potion, a save's
     mean): A 21.1, D 17.7, K 19.7; D-A -3.65 ± 0.64, K-A -1.54 ± 0.64,
     D-K -2.08 ± 0.57 (5.7 / 2.4 / 3.7 SE): past the registered bar (D-A
     3 or more, D-K 2 or more), defence is the hallways' lever. Act 2
     finished 30 -> 41 (D) / 42 (K) of 153 (+7.2 / +7.8 ± 4.0 points), act
     1's boss won 128 -> 135 / 146: three Strikes for three good cards is
     worth act 2's end either way, and the hallways' saved HP is not what
     ends it. Played a hallway fight: Shrug It Off 0.87, Impervious 0.44,
     Flame Barrier 0.29. The check half (the 154 even seeds) agrees: act 2
     finished D-A +9.7 ± 4.0, K-A +11.0 ± 4.1 points, the hallway D-K -1.40
     ± 0.68. Both halves (307): act 2 finished 59 -> 85 (D) / 88 (K), +8.5
     ± 2.8 / +9.4 ± 2.7 (3.1 / 3.5 SE), D-K -1.0 ± 3.0; the hallway D-A
     -3.83 ± 0.47, K-A -1.95, D-K -1.74 ± 0.44 (3.9 SE). Shown: three
     Strikes for three good cards finish act 2 more often, and defence is
     the hallways' own lever. A removal arm R (the 3 Strikes out, nothing
     in), both halves (307): act 2 finished 59 -> 73, +4.6 ± 2.6 (1.7 SE;
     R-D -3.9 ± 2.7, R-K -4.9 ± 2.7), the hallway -1.05 ± 0.49 (R-D +2.58
     ± 0.45): undecided by the registered bar (2 SE). The thinner deck
     looks like about half of act 2's gain and the good cards the other
     half, neither shown alone; the hallways' saving is the defence cards'.
     On a second character (the Regent session, 47 fresh f16 saves, its
     own packs by its humans' pick rates): good cards for three Strikes
     again help (act 1's boss 34 -> 42 / 42, the hallways D -3.2, K -5.2),
     but defence is not the hallways' own lever there — the attack pack
     saves as much by killing sooner (4.8 turns a hallway fight against
     6.2) and alone finishes act 2 more (4 -> 10). What carries over is the
     deck's quality (good cards, fewer Strikes), not block as such.
     Next (the analysis session's, by the registered order): card picks and
     buys leaning to good cards first, a removal's price after.
   - **pick1** (the analysis session's p3 4de865c: sparhuman2's ranking —
     spar5's loose veto, then A10 players' pick rates — on act 1's card
     rewards alone; sparhuman, sparhuman2 and sparpick had been tried on
     act 2's only): all 199 f1 saves to act 2's end against bench-c2f1-base
     (C2 on this branch played 2 of them as the base). At 16, block cards
     1.29 -> 1.74, attacks 6.52 -> 5.83 (not counting the basics), act 1's
     skips 99 -> 66 of ~1,400; act 1's boss won 168 -> 155 (-6.5 ± 3.3,
     2.0 SE), act 2 finished 33 -> 28 (+16/-21, -2.5 ± 3.1), the hallways
     even (+0.05, +0.34), act 2's boss reached 99 -> 90. Stopped on budget,
     the sign against it (the main measure not clearly harmed; every measure
     leans the wrong way, act 1's boss by 2 SE); no more variants of act 1's
     picks by human pick rates. The humans' act 1 picks trade attacks for
     skills and the act 1 boss pays; spar's picks, scored against that boss,
     fit it better than pick rates drawn from whole runs. The deck test's
     gain was three Strikes out and good cards in; pick1 trades an attack
     for a skill on the same offer: not the same thing.
   - **events2 again, on f1 saves** (the user's pick; p3 5d7d811 = c1ac146 +
     events-main's commits; C2 there played 2 f1 saves as the base): the 90
     of 199 affected.ts finds it can change, to act 2's end. Act 2 finished
     15 -> 17 (+6/-4; +1.0 ± 1.6 points over 199, +2.2 ± 3.5 over the 90);
     HP% at act 1's boss (0 if not reached) +4.1 ± 1.4 (2.9 SE; the f4
     half's +5.5 ± 3.8 again), act 1's boss won 78 -> 74, the hallways -0.3
     / -0.9. 105 of 880 event choices changed (Brain Leech 37, Abyssal Baths
     26, Self-Help Book 16, Trash Heap 13). Undecided, the direction
     repeated: about 4 points more HP into act 1's boss on two sets of
     seeds, not yet act 1's boss won or act 2 finished (act 2's boss
     reached 47 -> 43, relics -0.16: HP for relics, about even). Not
     confirmed on its own (+1 point of act 2 finished is past 200 pairs'
     reach); harmless, a candidate to ride along when a substantial one
     goes to a fresh-seed confirmation.
   - **The randomized swaps** (the analysis session's design, the user
     approved; the deck value model's v1 had D's sign wrong — the bot takes
     block only when a run is already going badly, so its own decks cannot
     say what block is worth): the 296 f16 saves with 3+ unupgraded
     Strikes, those 3 out (as R) and 3 different cards of a 20-card pool
     in (the bot's 18 most offered act 1-2 commons, without Havoc and
     Perfected Strike, + Flame Barrier and Colossus; balanced and seeded,
     44-45 a card an arm; runs/rand-swap-manifest.json), two arms (two
     draws a save), p3 5d7d811, C2 to stop 34. Registered: y_rand - y_R on
     the 3 cards' indicators, no intercept, SEs clustered by save. Act 2
     finished: rand - R +1.7 ± 2.0 points (rand - A +6.1 ± 1.8): three
     random commons for three Strikes add little past the removal, where
     the D / K packs (cards of ~50% human pick rates) added +3.9 / +4.9 —
     the gain is in which cards. By card (SE ~5 points, 88-90 a card): Molten
     Fist +16.3 ± 4.7 (3.5 SE); the rest within 2 SE (Armaments -9.9, Blood
     Wall -9.1, both 1.9 SE; Body Slam +7.8, Tremble +6.7). The cards told
     apart at all, by randomization (the draws shuffled among the saves
     within an arm, 2,000 times; scratchpad randperm.py): the clustered
     Wald statistic for 20 equal cards p 0.036, the largest card's |t| p
     0.018 — on act 2's end the cards do differ, mostly by Molten Fist (the
     Regent session's first χ², classical SEs and the diagonal only, p
     0.12); the hallways and act 1's boss: no card told apart
     (randomization p 0.46 / 0.73). On the Regent (131 saves, three
     draws, a 10-card pool, ~112 rows a card, the same test): no card told
     apart on any outcome (p 0.92 / 0.17 / 0.15; the hallways' largest,
     Know Thy Place -1.9 ± 0.7, p 0.25 as the largest of 10), the three
     cards against R -1.1 points of act 2 (docs/regent-research.md §10) —
     not for want of power: its SEs are no larger than the Ironclad's.
   - **Molten Fist's confirmation** (registered 2026-10-02 15:11, before
     any result; scratchpad mfconf.py): fresh seeds, the 182 S2 f16 saves
     (1846-2045, base6a saves-c2early) with 3+ unupgraded Strikes; per
     save M = the 3 Strikes out, two pool cards (balanced, seeded, Molten
     Fist left out) and Molten Fist in, N = the same two and a third pool
     card; p3 5d7d811, C2 to stop 34 (runs/bench-mfM, bench-mfN;
     mf-conf-manifest.json). M - N is the regression's own contrast
     (predicted +16.5; the largest of 20 is likely high). Act 2 finished,
     paired over all saves: confirmed at 2 SE or more, harmful at -2 SE or
     less, undecided between; also act 1's boss, act 2's hallway cost. The
     bot takes Molten Fist at 38-54% of its rewards' offers now. The hallways (259 saves with both arms there):
     rand - R -0.48 ± 0.30 a fight; Thunderclap -1.9 (2.3 SE), Anger -1.5
     (2.1), Armaments +1.5 (2.1 SE worse). Act 1's boss: rand - R +2.2 ±
     1.2; Colossus +6.3, Cinder +5.8 (2.0 / 2.1 SE), Twin Strike -6.2
     (1.6). D's cards in the pool (Flame Barrier + Shrug It Off) -9.0 ±
     7.8 on act 2, -0.1 ± 1.2 in the hallways; K's Pommel Strike -6.9 ±
     5.3: not what the packs measured, within 2 SE. Each estimate is a
     card added to a thinned deck, played by C2. Run with
     sandbox/persave.mjs (bench.ts's replay, written a save at a time;
     the first try with bench.ts was cut off at 111 of 592 and kept
     nothing). Next (the analysis session's): the estimates as anchors
     for the deck value model, then whether it predicts D; Molten Fist's
     +16 confirmed before it moves any pick.
   - **Direction** (Astra, review 6, docs/astra-review-6.md; the user sent
     it): the limit is a bounded pilot and a biased bout, which spar then
     uses to decide the deck — self-reinforcing; more switches on the same
     scoring are not the main line. Kept: the one-turn search as the
     candidate generator. Next two weeks: (1) a census of fixed-state real
     fights (~120 hallway, elite and boss), full start states and
     transitions checked, the three costliest misplays found and each fix
     shown on held-out real fights (a fix that only raises the simulator's
     agreement stops that line) — the Tunneler and the Bowlbug above are of
     this kind; (2) a fight value trained on real branches (200 decision
     points × 3-4 differing candidates, played out in the game, held out by
     source run; stop if it does not rank real candidates better than the
     linear score). Weeks three and four, by the evidence: act 1's run value
     (random branches at act 1 forks: safe route against an extra elite,
     power now against parts for later; labelled by act 2's end), or the
     corrected look ahead (common random numbers, diverse candidates, 4 →
     16 → 64 samples, on enemies with reliable scripts). Method: a
     counterexample, then fixed states, then fixed-start continuations,
     then one fresh-seed confirmation — not a whole-run round per idea.
     Detecting +4 points of act 2 needs ~880 pairs, +5 ~560. Stopped:
     global weight sweeps, bout-made labels at scale, per-card human-rate
     bonuses, scaling oracle gains. "Stable" (proposed): a frozen policy on
     fresh seeds with a one-sided 95% lower bound of 10% wins, most of them
     clean (no revival, 30%+ HP left); on the way, act 2 cleared from the
     start ~14% -> 25%. The confirmation's interim (review 6, 19:47, 460
     pairs): act 1 338 -> 365 (67/40, p 0.015), act 2 56 -> 65 (p 0.37).
   - **The confirmation** (the user, 2026-09-27; spire-jev-conf at 39fa6c6):
     fresh seeds 856-1515, the spar3 reference against the combo with
     powbonus and spartake, whole runs, floors 16/32/47 captured. Done
     2026-09-28 01:20 (660 paired, 3 errors each): act 1's boss beaten 485
     -> 528 (73.5 -> 80.0%; +96/-53, p 0.001), act 2's 86 -> 102 (13.0 ->
     15.5%; +67/-51, p 0.17), act 3's first 3 -> 6, wins 0 / 0. Act 2's
     boss is the wall: reached by 41.7 -> 46.7% of the runs (at 82 / 83%
     HP), beaten by 31.4 -> 33.2% of those — the Kaiser Crab 13/86 ->
     17/94, the Knowledge Demon 34/97 -> 46/110, the Insatiable 39/91 ->
     39/103. Act 1's bosses (reached): 77.7 -> 85.9% (the Waterfall Giant
     69/108 -> 85/107, Vantom 66/94 -> 74/94). The combo's act 1 gain holds
     on fresh seeds; its act 2 gain is +2.5 points, not shown (review 6's
     "not yet cashed, not shown to be zero"). Libraries for the benches:
     saves-conf-ref-a10 / saves-conf-best-a10 (f16 / f32 / f47).
3. **Whole runs against the real game** in fast mode; README, GIF.

## Constraints

- Do not publish decompiled game code or game assets; the repo holds only our
  code, and reads the game from the local install.
- Public repo (liu-x27/spire-jev); commit locally; push only when asked.
