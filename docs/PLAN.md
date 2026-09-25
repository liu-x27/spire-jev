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
3. **Whole runs against the real game** in fast mode; README, GIF.

## Constraints

- Do not publish decompiled game code or game assets; the repo holds only our
  code, and reads the game from the local install.
- Public repo (liu-x27/spire-jev); commit locally; push only when asked.
