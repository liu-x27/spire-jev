#!/bin/sh
# pairs.jsonl for every replay dir whose drive is finished (drive.json) and newer than its pairs.
S="${REPLAY_WORK:?REPLAY_WORK: the work dir holding replays/ and out/ (see README.md)}"
R=/d/CODE/spire-jev-playlab/planner/runs
todo=""
for d in $R/replay-*; do
  [ -f $d/drive.json ] || continue
  if [ ! -f $d/pairs.jsonl ] || [ $d/drive.json -nt $d/pairs.jsonl ]; then todo="$todo D:/CODE/spire-jev-playlab/planner/runs/$(basename $d)"; fi
done
[ -n "$todo" ] && node $S/export_pairs.mts $todo
