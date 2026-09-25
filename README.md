# spire-jev

A bot that plays Slay the Spire 2 in the real game — Ironclad, whole runs, no human input.
A mod bridges the game to a planner in TypeScript: each turn a simulator of the game's
combat searches the order to play the hand in, well under a millisecond at the median, and
the choices around the fights (card rewards, the path, rest sites, shops, events) are made
by rules. The simulator is checked against the game card by card, and the results below are
counted on seeds the rules were not tuned on.

![Floor 48, act 3's boss at ascension 10: the bot kills the Torch Head Amalgam, then dies to the Queen (2×)](docs/media/a10-707-floor48-2x.gif)

*Ascension 10, seed 707, floor 48 of 49, on the rules from before `spar`: the furthest of
the 102 seeds it was picked from, and not a win. It reached act 3's boss with 53 of 80 HP, killed the Torch Head Amalgam and died on turn 8
with the Queen at 279 HP. The whole run is [docs/media/a10-707-run.mp4](docs/media/a10-707-run.mp4)
(3 min 26 s; fights at game speed, the rest 4×); how it was recorded, and why the recording
is the same run as headless, is [docs/RECORDING.md](docs/RECORDING.md).*

Slay the Spire 2 is Mega Crit's; this project is not affiliated with Mega Crit, and the
repository holds no game files — the bridge runs against a local install. The name is for
the shape of a "System One" decision layer (fast search where search is right, one-token
judge questions for the calls around it); nothing here calls TypeSafe's Jev API, and today
no model is involved at all.

## Where it stands

Ironclad at ascension 10, the game's beta v0.111.0, on a profile that has seen every act
and boss (so runs are drawn as for a player past their first). The best configuration so
far (`--choices rules2 --flags pathdp,restbudget,potions2,sleep,spar`) on the 90
confirmation seeds (496–585), which no change was tuned on:

| | |
|---|---|
| runs won | **0 of 90** |
| mean floor reached | 25.0 of 49 (22.0 before `spar`, same seeds) |
| act 1's boss beaten | 56 of 79 reached (71%) |
| act 2's boss beaten | 7 of 30 reached (23%) |
| act 3's first boss beaten (floor 48) | 1 of 5 reached |
| fights won | 850 of 937 |
| planning time per decision | p50 0.09 ms, p95 1.3 ms, max 385 ms |
| end-of-turn HP loss predicted exactly | 3387 of 3461 turns |

The furthest run is seed 497 in that set: it beat act 3's first boss, Aeonglass, on floor
48 (120 → 48 HP). There the game's automated-play framework gave the run up — it stops at
floor 49, where A10 puts a second boss — so until the bridge was fixed no A10 run could be
won. Replayed with the fix, 497 met the second boss, Test Subject, with 48 HP and died on
its fourth turn, after the Test Subject's revival: one fight from a win. It is the only run
of the 90 that the stop cut short. 34 of the 90 runs end in act 1; past it the deck is the limit more than the play (act 2's
bosses beaten 7 of 30). The last change that counted, `spar` (card rewards and shop picks
by what they add against the act's own boss, played out in the simulator), was developed on
seeds 316–495, where it took act 1's boss from 48% to 63% and the mean floor from 20.1 to
23.8, paired. The working record — every change measured, the ones that were noise, the ones
that made things worse — is [docs/PLAN.md](docs/PLAN.md).

## How it plays

- **The bridge** (`mod/Bridge`, C#, loaded by the game's own mod loader) drives the game
  through its automated-play framework: it reports every decision the game waits on — a
  fight, the map, a reward, a card to pick, a shop, an event — with what the planner needs
  (cards' real numbers, intents, powers, the draw pile), and plays the answer. It runs the
  game headless in a sandbox of its own, several at once; with `SPIRE_JEV_VISUAL=1` it runs
  on screen instead.
- **Fights** (`planner/src/sim.ts`, `search.ts`, `turn.ts`): a simulator of the cards,
  powers, relics, potions and the bosses' move scripts, and a search over the orders a hand
  can be played in, equal states merged. Each rule was written from what the game did and
  is pinned by a test; after every card the simulator's prediction is compared with the
  game. Early on, 2482 cards on 15 seeds left 42 fields that differed, all on four things
  approximated on purpose; over the 90 confirmation runs, which meet cards and monsters those
  seeds never did, 13,068 cards left 746.
- **Everything else** (`planner/src/choices.ts`, `path.ts`, `spar.ts`): card values from
  tier lists and pick rates (`docs/STRATEGY-research.md`), a path chosen over the whole map,
  a budget for HP at rest sites, potions drunk by rule, and card picks tried out against the
  act's boss.

## Running it

It needs Slay the Spire 2 installed at the beta v0.111.0, the .NET 9 SDK (for the bridge)
and Node 24 (the planner runs its TypeScript directly, with no dependencies). The game's
folder is `D:\SteamLibrary\steamapps\common\Slay the Spire 2` unless `STS2_GAME_ROOT` says
otherwise (and `-p:GameDataDir=<game>\data_sts2_windows_x86_64` for the build).

```bash
cd mod/Bridge && dotnet build -c Release          # the bridge, into bin/Release/net9.0/package
                                                  # (-c Visual as well, for record.ts)
cd planner
npm test                                          # the simulator's rules and the planner, no game needed
node src/run-fights.ts --seed 316 --runs 1 --port 47100 --cards take \
  --choices rules2 --ascension 10 --flags pathdp,restbudget,potions2,sleep,spar
node src/eval.ts --tag mine --seeds 316-345 --sandboxes 4 --choices rules2 --ascension 10 \
  --flags pathdp,restbudget,potions2,sleep,spar   # several sandboxes at once, about 1 GB each
node src/record.ts --seed 316 --ascension 10       # one run on screen, recorded (docs/RECORDING.md)
```

A sandbox is `sandbox/p<port>`: hard links to the game's files, its own mods folder and
profile, so the real install and saves are never touched.

## Layout

| | |
|---|---|
| `mod/Bridge` | the game-side bridge, derived from divine-sts2's FullAppBridge |
| `planner/src` | simulator, search, choices, and the runners (`run-fights`, `eval`, `bench`, `record`) |
| `planner/test` | the rules, each against what the game did |
| `planner/data` | card, monster and intent tables read from the game; a veteran profile |
| `docs` | the plan and its measurements, strategy research, the recording |
| `tools` | the first spike, and an inspector for the game's types |

## Provenance

The bridge began as divine-sts2's FullAppBridge (MIT, [mod/LICENSE-divine-sts2](mod/LICENSE-divine-sts2))
and was extended for what a planner needs. `planner/data/card-stats-a10.json` is Spire
Codex's ascension-10 Ironclad data, and the strategy notes in `docs/` summarise public
guides and statistics and say where each comes from.

## License

The code written for this project is MIT — see [LICENSE](LICENSE). The bridge's parts from
divine-sts2 stay under their own MIT license ([mod/LICENSE-divine-sts2](mod/LICENSE-divine-sts2)).
Not covered, and not ours to license: Slay the Spire 2 and its art and text, which are Mega
Crit's and appear in the recordings in `docs/media`; the tables and profile saves in
`planner/data` read from the game; and Spire Codex's data in `planner/data/card-stats-a10.json`.
