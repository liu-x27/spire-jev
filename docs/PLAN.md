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
1. **Combat planner, Ironclad**, measured headless: fights won, HP lost, and
   planning time per turn.
2. **Non-combat decisions**: rules alone vs rules + judge, measured.
3. **Whole runs against the real game** in fast mode; README, GIF.

## Constraints

- Do not publish decompiled game code or game assets; the repo holds only our
  code, and reads the game from the local install.
- No model-training or distillation demo in public before 2026-12-17 (it
  overlaps the paper under review).
- Private repo; commit locally; push only when asked.
