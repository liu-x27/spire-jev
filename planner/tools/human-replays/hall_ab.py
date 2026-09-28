"""The hallway whole-fight A/B on the human's exact fight saves (botq.py --arms hC,hlook,hadapt): per
arm, HP lost as % of max HP (a death counts the HP the fight began with) and deaths, paired by save
against hC; and the arms as bench files (runs/bench-hall-<arm>.json: results[] of {save, fights[]}).
    python hall_ab.py [--arms hC,hlook,hadapt] [--bench]
"""
import glob, json, math, os, re, sys, collections

ROOT = 'D:/CODE/spire-jev-playlab/planner/runs'
SKIP = {'L1DZ6V72A4FG'}
arms = (sys.argv[sys.argv.index('--arms') + 1] if '--arms' in sys.argv else 'hC,hlook,hadapt').split(',')
kind = lambda enc: (re.search(r'_(WEAK|NORMAL|ELITE|BOSS)$', enc or '') or [None, 'EVENT'])[1]
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'botq.py'), encoding='utf8').read()
exec(src[src.index('def exact_fights'):src.index('jobs = []')])

rows, bench = [], collections.defaultdict(list)
for d in sorted(glob.glob(os.path.join(ROOT, 'replay-*'))):
    seed = os.path.basename(d)[7:]
    if seed in SKIP or not os.path.exists(os.path.join(d, 'drive.json')):
        continue
    for f in exact_fights(d):
        k = kind(f['encounter'])
        if k in ('ELITE', 'BOSS') or f['floor'] > 33:
            continue
        r = {'seed': seed, 'floor': f['floor'], 'enc': f['encounter'], 'kind': k, 'act': 1 if f['floor'] <= 17 else 2, 'human': f.get('humanHpLost')}
        for arm in arms:
            p = os.path.join(d, f'{arm}-f{f["floor"]}.json')
            if not os.path.exists(p):
                continue
            try:
                log = json.load(open(p, encoding='utf8'))
            except Exception:
                continue
            fl = [x for x in log.get('fights', []) if x.get('floor') == f['floor']]
            if not fl:
                continue
            x = fl[0]
            lost = x['hpLost'] if x.get('won') else x['hpStart']
            r[arm] = 100.0 * lost / max(1, x.get('maxHp') or 80)
            r[arm + 'Won'] = bool(x.get('won'))
            r[arm + 'Turns'] = x.get('turns')
            bench[arm].append({'save': f"{seed}-f{f['floor']}.save", 'explore': 0, 'status': 'ok', 'rooms': log.get('rooms', []), 'ends': log.get('ends', []), 'fights': [dict(x, seed=seed)]})
        rows.append(r)

base = arms[0]
print(f"{len(rows)} exact hallway saves (acts 1-2); fought: " + ', '.join(f"{a} {sum(1 for r in rows if a in r)}" for a in arms))
for a in arms:
    xs = [r for r in rows if a in r]
    if xs:
        print(f"  {a:7s} n={len(xs):4d}  HP lost {sum(r[a] for r in xs) / len(xs):5.2f}% of max  deaths {sum(1 for r in xs if not r[a + 'Won']):3d}")


def paired(a, b, xs, label):
    d = [r[b] - r[a] for r in xs]
    if len(d) < 2:
        return
    m = sum(d) / len(d)
    se = math.sqrt(sum((x - m) ** 2 for x in d) / (len(d) - 1) / len(d))
    better = sum(1 for x in d if x < -0.01)
    worse = sum(1 for x in d if x > 0.01)
    da = sum(1 for r in xs if not r[a + 'Won'] and r[b + 'Won'])
    db = sum(1 for r in xs if r[a + 'Won'] and not r[b + 'Won'])
    print(f"  {label:10s} {b} - {a}: {m:+.2f} ± {se:.2f} HP% (n={len(d)}; {b} better {better}, worse {worse}; deaths only {a} {da}, only {b} {db})")


print("\nPaired against", base)
for b in arms[1:]:
    both = [r for r in rows if base in r and b in r]
    paired(base, b, both, 'all')
    for k in ('WEAK', 'NORMAL'):
        paired(base, b, [r for r in both if r['kind'] == k], k)
    for act in (1, 2):
        paired(base, b, [r for r in both if r['act'] == act], f'act {act}')
if '--bench' in sys.argv:
    for a, res in bench.items():
        out = os.path.join(ROOT, f'bench-hall-{a}.json')
        json.dump({'tag': f'hall-{a}', 'results': res}, open(out, 'w'), indent=1)
        print(out, len(res), 'fights')

# By encounter (act 2 especially: the monsters with RANDOM move guesses against the fixed cycles).
if '--by-enc' in sys.argv:
    b = arms[1]
    both = [r for r in rows if base in r and b in r]
    by = collections.defaultdict(list)
    for r in both:
        by[(r['act'], r['enc'])].append(r[b] - r[base])
    print(f"\n{b} - {base} by encounter (HP%, n):")
    for (act, enc), d in sorted(by.items(), key=lambda kv: (kv[0][0], -len(kv[1]))):
        m = sum(d) / len(d)
        print(f"  act {act} {enc:32s} n={len(d):3d}  {m:+6.2f}  better {sum(1 for x in d if x < -0.01):3d} worse {sum(1 for x in d if x > 0.01):3d}")
