"""The bot against the human on the human's exact fights (botq.py's <arm>-f<floor>.json beside each
replay drive): HP lost and deaths by fight kind, for the fights every arm has fought.
    python botq_report.py [--arms bot2,botfix2] [--list]
"""
import glob, json, os, re, sys, collections

ROOT = 'D:/CODE/spire-jev-playlab/planner/runs'
SKIP = {'L1DZ6V72A4FG'}
arms = (sys.argv[sys.argv.index('--arms') + 1] if '--arms' in sys.argv else 'bot2,botfix2').split(',')
kind = lambda enc: (re.search(r'_(WEAK|NORMAL|ELITE|BOSS)$', enc or '') or [None, 'EVENT'])[1]
rows = []
for d in sorted(glob.glob(os.path.join(ROOT, 'replay-*'))):
    seed = os.path.basename(d)[7:]
    if seed in SKIP or not os.path.exists(os.path.join(d, 'drive.json')):
        continue
    dj = json.load(open(os.path.join(d, 'drive.json'), encoding='utf8'))
    for f in dj['fights']:
        r = {'seed': seed, 'floor': f['floor'], 'enc': f['encounter'], 'kind': kind(f['encounter']), 'hp': f['hpStart'], 'human': f.get('humanHpLost'), 'humanTurns': f.get('humanTurns')}
        for arm in arms:
            p = os.path.join(d, f'{arm}-f{f["floor"]}.json')
            if not os.path.exists(p):
                continue
            try:
                fl = [x for x in json.load(open(p, encoding='utf8')).get('fights', []) if x.get('floor') == f['floor']]
            except Exception:
                continue
            if fl:
                r[arm] = min(fl[0]['hpLost'], f['hpStart']) if fl[0].get('won') else f['hpStart']
                r[arm + 'Won'] = bool(fl[0].get('won'))
                r[arm + 'Turns'] = fl[0].get('turns')
        if r['human'] is not None and all(a in r for a in arms):
            rows.append(r)
print(f"{len(rows)} fights fought by every arm ({', '.join(arms)}), {len({r['seed'] for r in rows})} runs")
print(f"  {'kind':6s} {'n':>4s}  {'human':>7s}" + ''.join(f"  {a:>16s}" for a in arms))
for k in ('WEAK', 'NORMAL', 'ELITE', 'BOSS', 'EVENT', 'all'):
    xs = rows if k == 'all' else [r for r in rows if r['kind'] == k]
    if not xs:
        continue
    line = f"  {k:6s} {len(xs):4d}  -{sum(r['human'] for r in xs) / len(xs):6.1f}"
    for a in arms:
        dead = sum(1 for r in xs if not r[a + 'Won'])
        line += f"  -{sum(r[a] for r in xs) / len(xs):6.1f} dead {dead:3d}"
    print(line)
# The elites and bosses one by one (the fights that decide runs).
if '--list' in sys.argv:
    for r in sorted(rows, key=lambda r: (r['kind'], r['enc'])):
        if r['kind'] in ('ELITE', 'BOSS'):
            print(f"  {r['seed']} f{r['floor']:2d} {r['enc']:30s} hp {r['hp']:3d} human -{r['human']:3d}" + ''.join(f"  {a} -{r[a]:3d}{' DEAD' if not r[a + 'Won'] else '     '}" for a in arms))
by = collections.defaultdict(list)
for r in rows:
    if r['kind'] in ('ELITE', 'BOSS'):
        by[r['enc']].append(r)
print("\nBy elite / boss (n, human, arms; deaths):")
for enc, xs in sorted(by.items(), key=lambda kv: -len(kv[1])):
    print(f"  {enc:30s} n={len(xs):2d} human -{sum(r['human'] for r in xs) / len(xs):5.1f}" + ''.join(f"  {a} -{sum(r[a] for r in xs) / len(xs):5.1f} ({sum(1 for r in xs if not r[a + 'Won'])} dead)" for a in arms))
