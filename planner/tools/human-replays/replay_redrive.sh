#!/bin/sh
# Human runs driven again (a fixed driver), keeping the bot's fights already fought from their saves:
# only the drive's own outputs are removed first. Replay2's bridge.
#   sh replay_redrive.sh <port> <hash> [<hash> ...]
S="${REPLAY_WORK:?REPLAY_WORK: the work dir holding replays/ and out/ (see README.md)}"
export SPIRE_JEV_MOD="D:/CODE/spire-jev-playlab/mod/Bridge/bin/Replay2/net9.0/package"
port=$1; shift
cd /d/CODE/spire-jev-playlab/planner
for h in "$@"; do
  seed=$(head -c 400 $S/replays/$h.ndjson | sed -n 's/.*"seed": *"\([A-Z0-9]*\)".*/\1/p')
  dir=runs/replay-$seed
  echo "== $h $seed drive $(date +%H:%M)"
  mkdir -p $dir
  rm -f $dir/drive.json $dir/turns.jsonl $dir/turn-ends.jsonl $dir/pairs.jsonl $dir/f*.save
  node src/replay-drive.ts --replay "$S/replays/$h.ndjson" --port $port --out $dir > $S/out/drive-$seed.txt 2>&1
  tail -n 2 $S/out/drive-$seed.txt
done
echo "redrive batch done $(date +%H:%M)"
