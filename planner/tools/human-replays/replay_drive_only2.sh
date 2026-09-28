#!/bin/sh
# Human runs replayed in the game only (no bot passes): each turn's exact state and the human's line
# (turns.jsonl, turn-ends.jsonl) and every fight's save, for the evaluation's fit and later bot passes.
#   sh replay_drive_only.sh <port> <hash> [<hash> ...]
S="${REPLAY_WORK:?REPLAY_WORK: the work dir holding replays/ and out/ (see README.md)}"
export SPIRE_JEV_MOD="D:/CODE/spire-jev-playlab/mod/Bridge/bin/Replay2/net9.0/package"
port=$1; shift
cd /d/CODE/spire-jev-playlab/planner
for h in "$@"; do
  seed=$(head -c 400 $S/replays/$h.ndjson | sed -n 's/.*"seed": *"\([A-Z0-9]*\)".*/\1/p')
  dir=runs/replay-$seed
  echo "== $h $seed drive $(date +%H:%M)"
  rm -rf $dir
  node src/replay-drive.ts --replay "$S/replays/$h.ndjson" --port $port --out $dir > $S/out/drive-$seed.txt 2>&1
  tail -n 2 $S/out/drive-$seed.txt
done
echo "drive-only batch done $(date +%H:%M)"
