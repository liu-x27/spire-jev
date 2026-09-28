"""The fork arms side by side on the same points (forks_be.json: the boss and elite ones): per arm, how
often the bot's own turn-t choice (branch B) falls behind the human's (branch A), each branch finished
by the arm's own policy. Arms: C (botlab, no look-ahead), lookdiverse and lookwide (botlab2).
    python fork_compare.py [--list forks_be.json]
"""
import json, os, sys, collections

S = os.path.dirname(os.path.abspath(__file__))
LIST = sys.argv[sys.argv.index('--list') + 1] if '--list' in sys.argv else os.path.join(S, 'forks_be.json')
ARMS = [('C', 'D:/CODE/spire-jev-botlab/planner/runs/forks', ''),
        ('lookfix', 'D:/CODE/spire-jev-botlab2/planner/runs/forks', '-lookfix'),
        ('lookfix+diverse', 'D:/CODE/spire-jev-botlab2/planner/runs/forks', '-lookdiverse'),
        ('+lookwide (K20)', 'D:/CODE/spire-jev-botlab2/planner/runs/forks', '-lookwide'),
        ('+hallwide (K20)', 'D:/CODE/spire-jev-botlab2/planner/runs/forks', '-hallwide'),
        ('+lookadapt', 'D:/CODE/spire-jev-botlab2/planner/runs/forks', '-lookadapt')]
points = json.load(open(LIST, encoding='utf8'))


def cost(x):
    return x['hpLost'] if x['won'] else x['hpTurnStart'] + 30


def load(d, tag, p):
    base = os.path.join(d, f"{p['seed']}-f{p['floor']}-t{p['turn']}")
    fa, fb = f'{base}-human{tag}.json', f'{base}-bot{tag}.json'
    if not (os.path.exists(fa) and os.path.exists(fb)):
        return None
    A, B = json.load(open(fa, encoding='utf8')), json.load(open(fb, encoding='utf8'))
    return (A, B) if A.get('exact') and B.get('exact') else None


res = {name: {} for name, _, _ in ARMS}
for name, d, tag in ARMS:
    for p in points:
        r = load(d, tag, p)
        if r:
            res[name][(p['seed'], p['floor'], p['turn'])] = (p, *r)
common = set.intersection(*[set(v) for v in res.values()]) if all(res.values()) else set()
print(f"points with both branches: " + ', '.join(f"{n} {len(v)}" for n, v in res.items()) + f"; in every arm: {len(common)}")
for scope, keys in (('every arm', common), ('each arm, all its points', None)):
    print(f"\n== {scope}")
    for kind in ('look-says-human', 'look-says-planner'):
        print(f"  {kind}:")
        for name, _, _ in ARMS:
            xs = [v for k, v in res[name].items() if (keys is None or k in keys) and v[0]['kind'] == kind]
            if not xs:
                continue
            a_better = sum(1 for p, A, B in xs if cost(A) < cost(B))
            b_better = sum(1 for p, A, B in xs if cost(B) < cost(A))
            deadA = sum(1 for p, A, B in xs if not A['won'])
            deadB = sum(1 for p, A, B in xs if not B['won'])
            both = [(A, B) for p, A, B in xs if A['won'] and B['won']]
            d = sum(B['hpLost'] - A['hpLost'] for A, B in both) / max(1, len(both))
            print(f"    {name:16s} n={len(xs):3d}  human's turn better {a_better:3d}, even {len(xs) - a_better - b_better:3d}, bot's better {b_better:3d}"
                  f"  | deaths: human's turn {deadA:2d}, bot's {deadB:2d} | both won: bot's turn {d:+.1f} HP")
