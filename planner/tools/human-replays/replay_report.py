"""The human-run replays, fight by fight: the human's HP lost (the replay) against the bot's from the same
save, for every fight whose save was reached on an exact replay (every fight before it ended at the
replay's HP), with the bot's current flags (bot) and with the fixed look ahead (botfix).
    python replay_report.py            -> table by kind, per-fight list, replay_report.json
"""
import glob, json, os, re, collections

ROOT = 'D:/CODE/spire-jev-playlab/planner/runs'
TAGS = ('bot', 'botfix')
kind = lambda enc: (re.search(r'_(WEAK|NORMAL|ELITE|BOSS)$', enc or '') or [None, '?'])[1]
rows = []
for d in sorted(glob.glob(os.path.join(ROOT, 'replay-*'))):
    dj = os.path.join(d, 'drive.json')
    if not os.path.exists(dj):
        continue
    drive = json.load(open(dj, encoding='utf8'))
    got = {}
    for t in TAGS:
        p = os.path.join(d, f'{t}.json')
        if os.path.exists(p):
            got[t] = {f['floor']: f for f in json.load(open(p, encoding='utf8'))['fights']}
    exact = True
    for f in drive['fights']:
        ok = f.get('gameHpAfter') is not None and f.get('gameHpAfter') == f.get('replayHpAfter')
        r = {'seed': drive['seed'], 'floor': f['floor'], 'act': 1 if f['floor'] <= 17 else 2 if f['floor'] <= 33 else 3,
             'encounter': f['encounter'], 'kind': kind(f['encounter']), 'hpStart': f['hpStart'], 'human': f.get('humanHpLost'),
             'humanTurns': f.get('humanTurns'), 'valid': exact}
        for t, g in got.items():
            x = g.get(f['floor'])
            if x and x.get('bot') is not None:
                r[t] = min(x['bot'], f['hpStart']); r[t + 'Won'] = x.get('botWon'); r[t + 'Turns'] = x.get('botTurns')
        rows.append(r)
        exact = exact and ok
json.dump(rows, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'replay_report.json'), 'w'), indent=1)
valid = [r for r in rows if r['valid'] and r['human'] is not None]
print(f"{len(rows)} fights in {len({r['seed'] for r in rows})} runs; saves reached exactly: {len(valid)}")
both = [r for r in valid if all(t in r for t in TAGS)]
one = [r for r in valid if 'bot' in r]
for name, v in (('bot (current flags)', one), ('both arms', both)):
    if not v:
        continue
    print(f"\n== {name}: {len(v)} fights")
    for k in ('WEAK', 'NORMAL', 'ELITE', 'BOSS'):
        xs = [r for r in v if r['kind'] == k]
        if not xs:
            continue
        line = f"  {k:6s} n={len(xs):3d}  human -{sum(r['human'] for r in xs)/len(xs):5.1f}"
        for t in TAGS:
            ys = [r for r in xs if t in r]
            if len(ys) == len(xs):
                line += f"  {t} -{sum(r[t] for r in ys)/len(ys):5.1f} (dead {sum(1 for r in ys if r.get(t + 'Won') is False)})"
        print(line)
    tot = f"  all    n={len(v):3d}  human -{sum(r['human'] for r in v)/len(v):5.1f}"
    for t in TAGS:
        ys = [r for r in v if t in r]
        if len(ys) == len(v):
            tot += f"  {t} -{sum(r[t] for r in ys)/len(ys):5.1f} (dead {sum(1 for r in ys if r.get(t + 'Won') is False)})"
    print(tot)
print()
for r in one:
    extra = ''.join(f"  {t} -{r[t]:3d}{' DEAD' if r.get(t + 'Won') is False else '     '}" for t in TAGS if t in r)
    print(f"  {r['seed']} f{r['floor']:2d} {r['encounter']:32s} hp {r['hpStart']:3d}  human -{r['human']:3d}{extra}")
