# -*- coding: utf-8 -*-
"""A progress.save for a player who has played before, so that runs are generated as they are for
everyone past their first runs (read from sts2.dll's IL, 2026-09-24):

- ActModel.GetRandomList: an unlocked act that is not the default and is not in discovered_acts is
  forced (a fresh profile gets the Underdocks every time once it is unlocked).
- ActModel.ApplyDiscoveryOrderModifications: the act's boss is the first in BossDiscoveryOrder that
  UnlockState.HasSeenEncounter does not know, and that is every key of encounter_stats. A fresh
  profile meets Vantom (or the Waterfall Giant), The Insatiable and Queen in every run. The console's
  own "unlock all" does not write encounter_stats: only fights do.
- NumberOfRuns (total wins + losses in character_stats) == 0 is the first run ever: Overgrowth sets
  its first seven hallway fights, two events and two elites (Nibbits, Slimes, Shrinker Beetle,
  Inklets, Mawler, Ruby Raiders, Nibbits; Byrdonis Nest, Sapphire Seed; Byrdonis, Phrog Parasite),
  the first two unknown rooms are events and the third a fight (UnknownMapPointOdds.Roll), the first
  treasure gives a set relic (TreasureRoomRelicSynchronizer.TryGetRelicForTutorial).

Every epoch revealed (EpochState 5, what UnlockState counts), as in progress-unlocked.save.

    python make-veteran-profile.py progress-unlocked.save encounter-ids.txt progress-veteran.save

encounter-ids.txt: every EncounterModel class of sts2.dll but the mocks and DeprecatedEncounter,
as ENCOUNTER.<UPPER_SNAKE of the class name> (tools/inspect --derived EncounterModel); every one of
the 73 encounter ids in runs/saves* comes out of that rule.
"""
import json, sys

src, ids_file, out = sys.argv[1:4]
d = json.load(open(src, encoding='utf8'))
assert all(e['state'] == 'revealed' for e in d['epochs']), 'every epoch revealed'

encounters = sorted({l.strip() for l in open(ids_file, encoding='utf8') if l.strip()})
acts = ['ACT.OVERGROWTH', 'ACT.UNDERDOCKS', 'ACT.HIVE', 'ACT.GLORY']
win = [{'character': 'CHARACTER.IRONCLAD', 'losses': 0, 'wins': 1}]

d['discovered_acts'] = acts
d['encounter_stats'] = [{'encounter_id': e, 'fight_stats': win} for e in encounters]
# One win and one loss: NumberOfRuns 2, past every first-run rule; A10 open in the lobby as well.
stats = {c['id']: c for c in d.get('character_stats', [])}
stats['CHARACTER.IRONCLAD'] = {
    'badges': [], 'best_win_streak': 1, 'current_streak': 0, 'fastest_win_time': -1, 'id': 'CHARACTER.IRONCLAD',
    'max_ascension': 10, 'playtime': 0, 'preferred_ascension': 10, 'total_losses': 1, 'total_wins': 1,
}
d['character_stats'] = list(stats.values())
json.dump(d, open(out, 'w', encoding='utf8', newline='\n'), indent=2, ensure_ascii=False)
print(f'{out}: {len(d["epochs"])} epochs, {len(acts)} acts, {len(encounters)} encounters seen, Ironclad 1 win 1 loss')
