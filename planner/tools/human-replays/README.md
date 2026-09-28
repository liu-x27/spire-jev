# Human replays: the bot against A10 players on the same states

The scripts behind `docs/human-replays-2026-09-28.md`, as they ran on 2026-09-27/28. They were written
in a session scratchpad. The work dir holding `replays/` and `out/` is `REPLAY_WORK` (set it before
running); the other paths are that machine's absolute ones: the worktrees `D:/CODE/spire-jev-playlab` (the driver and its
`runs/replay-<seed>/`), `D:/CODE/spire-jev-botlab` (main at 0c19af2) and `D:/CODE/spire-jev-botlab2`
(the look-ahead flags' commits). Set them for another machine before running.

## Inputs

- Replays: Spire Codex. `GET https://spire-codex.com/api/replays?character=IRONCLAD&build_id=v0.111.0&ascension=10&players=single`
  lists runs (`run_hash`, `has_replay`); `GET /api/runs/<hash>/replay` returns the run's NDJSON (plain,
  not gzip). Use curl: Python's urllib gets a Cloudflare 403. The replays are players' data and stay
  out of the repo.
- `drive_queue.json`: the 93 vanilla winning runs driven (three modded ones are skipped by the driver).
- `forks-from-spire-jev.json`, `forks2-from-spire-jev.json`: the two batches of 200 fork points each
  (the experiment session's selection from `pairs.jsonl`); `forks_be.json` / `forks_hall.json`: batch 1's
  boss/elite and hallway points.

## The replay in the game

`planner/src/replay-drive.ts` plays a replay's run in the game, step by step, with the replay's seed on
the veteran profile (the bridge build with `discard_potion` and the bundle select: `dotnet build -c Replay2`),
and writes `runs/replay-<seed>/`: `f<floor>.save` (each fight's save as its map node is chosen),
`turns.jsonl` / `turn-ends.jsonl` (each turn's observation, the planner's line, the human's plays and the
human's end of turn) and `drive.json` (checks, fights, notes). With `--resume <save> --fork-turn T --branch
human|bot --flags ...` it forks a fight at turn T and has run-fights' `fight()` play it out.

- `replay_drive_only2.sh <port> <hash>...`, `replay_redrive.sh <port> <hash>...` (keeps bot files): batches.
- `drive_summary.sh <batch log>...`: each drive's stop and first anomalies.
- `dump_floor.py <hash> <floors>`: a replay's events on some floors.

## The analyses

- `export_pairs.mts` / `export_done.sh`: `pairs.jsonl` per run, the human's end and planTurn's end of each
  exact turn, scored one turn and by the fixed look-ahead (the `exact` flag: every fight before matched
  the replay's HP and no hand mismatched so far).
- `analyze_pairs.py [--json out]`: the differing turns, the look-ahead's and one-turn verdicts, by kind of
  difference.
- `rank_check.mts`, `rank_check2.mts`: the human's end's rank among the one-turn ends, and whether the
  look-ahead's candidates (top 5, with `lookdiverse`) hold it.
- `forkq.py --ports ... [--list] [--flags C|lookfix|lookdiverse|lookwide|hallwide|lookadapt]`: the forks,
  both branches finished by the bot in the game; `fork_report.py`, `fork_compare.py`: the verdicts.
- `botq.py --ports ... [--arms] [--kinds] [--max-floor]`: whole fights from the exact saves (elite/boss:
  `bot2`/`botfix2`; hallways: `hC`/`hlook`/`hadapt`/`htie`); `botq_report.py`, `hall_ab.py [--bench]`:
  paired results (and `runs/bench-hall-<arm>.json`).
- `diag_u3f0.mts [seed floor turn]`: planTurn2's rated candidates on one turn's start state.
- `lookfix.mts`: the look-ahead lab that found the ±1e6 leaf averaging (the part before the replays).
- `replay_report.py`, `merge_bench.py`, `parse_replays.py`: the first night's tables and replay parsing.
