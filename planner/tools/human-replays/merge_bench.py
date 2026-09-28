"""The replay arms as bench files (bench.ts's shape: results[] of {save, explore, status, fights[], rooms[], ends[]}),
one result per fight save, so compare.ts / reach.ts-style pairing works on them:
  runs/bench-human-bot.json     the bot (current flags) from each save
  runs/bench-human-botfix.json  the bot with halllook,lookfix,bossroll8
  runs/bench-human-human.json   the human's own fight from the replay (hpStart, hpLost = hp_lost_total, won, turns)
Each fight also carries replay extras: seed, exact (every fight before it reproduced), diverged (the driver's own replay of it).
    python merge_bench.py
"""
import glob, json, os

ROOT = 'D:/CODE/spire-jev-playlab/planner/runs'
arms = {'bot': [], 'botfix': [], 'human': []}
for d in sorted(glob.glob(os.path.join(ROOT, 'replay-*'))):
    dj = os.path.join(d, 'drive.json')
    if not os.path.exists(dj):
        continue
    drive = json.load(open(dj, encoding='utf8'))
    seed = drive['seed']
    exact = True
    for f in drive['fights']:
        save = f"{seed}-f{f['floor']}.save"
        reproduced = f.get('gameHpAfter') is not None and f.get('gameHpAfter') == f.get('replayHpAfter')
        extra = {'seed': seed, 'exact': exact, 'reproduced': reproduced, 'diverged': bool(f.get('diverged'))}
        # The human: the replay's own numbers for the fight.
        if f.get('humanHpLost') is not None:
            arms['human'].append({'save': save, 'explore': 0, 'status': 'ok', 'rooms': [], 'ends': [], 'fights': [{
                'seed': seed, 'floor': f['floor'], 'enemies': [f['encounter']], 'hpStart': f['hpStart'], 'hpLost': f['humanHpLost'],
                'won': True, 'turns': f.get('humanTurns'), **extra}]})
        for tag in ('bot', 'botfix'):
            p = os.path.join(d, f"{tag}-f{f['floor']}.json")
            if not os.path.exists(p):
                continue
            try:
                logs = json.load(open(p, encoding='utf8'))
            except Exception:
                continue
            fl = [x for x in logs.get('fights', []) if x.get('floor') == f['floor']]
            if not fl:
                continue
            for x in fl:
                x.update(extra)
            arms[tag].append({'save': save, 'explore': 0, 'status': 'ok', 'rooms': logs.get('rooms', []), 'ends': logs.get('ends', []), 'fights': fl})
        exact = exact and reproduced
for tag, results in arms.items():
    out = os.path.join(ROOT, f'bench-human-{tag}.json')
    json.dump({'tag': f'human-{tag}', 'results': results}, open(out, 'w'), indent=1)
    print(out, len(results), 'fights')
