#!/bin/sh
# Each drive in the given batch logs: its stop and its first two anomalies (not target notes or matching HP lines).
S="${REPLAY_WORK:?REPLAY_WORK: the work dir holding replays/ and out/ (see README.md)}"
for f in "$@"; do grep -h "^==" $f | while read a h s rest; do log=$S/out/drive-$s.txt; [ -f $log ] || continue; grep -q "^stopped\|^{" $log || { echo "$s (running)"; continue; }; stop=$(grep "^stopped" $log | cut -c10-70); first=$(grep -v "fit the replay's hits\|^{\|relics: game" $log | grep -v "^stopped" | awk '/MISMATCH|not legal|nothing in the replay|not on the|not offered|no consistent|ended but|not usable|not all in hand|to throw away|offered .*, replay/' | head -n 2 | cut -c1-190 | tr '\n' '|'); echo "$s [$stop] $first"; done; done
