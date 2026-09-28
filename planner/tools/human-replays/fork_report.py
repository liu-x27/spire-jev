"""The forked branches priced (forkq.py): at each decision point, branch A (the human's turn, then the
bot) against branch B (the bot from that turn), by the fight's end in the game.
    python fork_report.py [--tag lookfix]
"""
import glob, json, os, sys, collections

FORKS = 'D:/CODE/spire-jev-botlab/planner/runs/forks'
LIST = sys.argv[sys.argv.index('--list') + 1] if '--list' in sys.argv else 'D:/CODE/spire-jev-playlab/planner/runs/forks-from-spire-jev.json'
tag = sys.argv[sys.argv.index('--tag') + 1] if '--tag' in sys.argv else ''
suffix = f'-{tag}' if tag else ''
points = json.load(open(LIST, encoding='utf8'))
rows = []
for p in points:
    base = os.path.join(FORKS, f"{p['seed']}-f{p['floor']}-t{p['turn']}")
    fa, fb = f'{base}-human{suffix}.json', f'{base}-bot{suffix}.json'
    if not (os.path.exists(fa) and os.path.exists(fb)):
        continue
    A, B = json.load(open(fa, encoding='utf8')), json.load(open(fb, encoding='utf8'))
    rows.append({**p, 'A': A, 'B': B, 'exact': bool(A.get('exact')) and bool(B.get('exact'))})


def cost(x):
    """What a branch cost: its HP lost, a death as all the HP the turn began with plus 30 (dead is worse than any win)."""
    return x['hpLost'] if x['won'] else x['hpTurnStart'] + 30


print(f"{len(rows)} of {len(points)} points with both branches ({sum(1 for r in rows if r['exact'])} exact)")
for kind in ('look-says-human', 'look-says-planner'):
    xs = [r for r in rows if r['kind'] == kind and r['exact']]
    if not xs:
        continue
    a_better = sum(1 for r in xs if cost(r['A']) < cost(r['B']))
    b_better = sum(1 for r in xs if cost(r['B']) < cost(r['A']))
    even = len(xs) - a_better - b_better
    wins_a = sum(1 for r in xs if r['A']['won'])
    wins_b = sum(1 for r in xs if r['B']['won'])
    both_won = [r for r in xs if r['A']['won'] and r['B']['won']]
    dmean = sum(r['B']['hpLost'] - r['A']['hpLost'] for r in both_won) / max(1, len(both_won))
    print(f"\n{kind}: n={len(xs)}")
    print(f"  human's turn better {a_better}, even {even}, bot's better {b_better}")
    print(f"  fights won: human's turn {wins_a}, bot's {wins_b}")
    print(f"  where both won (n={len(both_won)}): the bot's turn cost {dmean:+.1f} HP more on average")
    by = collections.defaultdict(lambda: [0, 0, 0])
    for r in xs:
        k = r['encounter'].rsplit('_', 1)[-1]
        by[k][0 if cost(r['A']) < cost(r['B']) else 2 if cost(r['B']) < cost(r['A']) else 1] += 1
    print('  by fight kind (human better / even / bot better):', ', '.join(f"{k} {v[0]}/{v[1]}/{v[2]}" for k, v in sorted(by.items())))

# By what the human did differently (analyze_pairs.py --json pairs_rows.json), exact look-says-human points.
if os.path.exists('pairs_rows.json'):
    reason = {(r['seed'], r['floor'], r['turn']): r.get('reason', '?') for r in json.load(open('pairs_rows.json', encoding='utf8'))}
    by = collections.defaultdict(lambda: [0, 0, 0])
    for r in rows:
        if not r['exact']:
            continue
        k = (r['kind'], reason.get((r['seed'], r['floor'], r['turn']), '?'))
        by[k][0 if cost(r['A']) < cost(r['B']) else 2 if cost(r['B']) < cost(r['A']) else 1] += 1
    print('\nBy what the human did differently (human better / even / bot better):')
    for (kind, why), v in sorted(by.items(), key=lambda kv: (kv[0][0], -sum(kv[1]))):
        print(f"  {kind:17s} {why:44s} {v[0]:3d} / {v[1]:3d} / {v[2]:3d}")
