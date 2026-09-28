"""The human's turns against the planner's, on exact states (runs/replay-*/pairs.jsonl, export_pairs.mts).

For every exact turn where the two lines differ: which end the fixed look-ahead prefers (a turn on,
16 shared next hands, leaves in HP) and which the one-turn evaluation prefers, and how the two ends
differ: damage dealt, block against the incoming hit, power cards, potions, energy left, targets.
    python analyze_pairs.py [--json out.json]
"""
import glob, json, os, re, sys, collections

ROOT = 'D:/CODE/spire-jev-playlab/planner/runs'
SKIP = {'L1DZ6V72A4FG'}  # Ancient Affection (modded)
CAT = json.load(open('D:/CODE/spire-jev-playlab/planner/data/card-catalog.json', encoding='utf8'))
ctype = lambda cid: (CAT.get(cid.rstrip('+')) or {}).get('card_type', '?')
kind = lambda enc: (re.search(r'_(WEAK|NORMAL|ELITE|BOSS)$', enc or '') or [None, 'EVENT'])[1]


def strict_exact(d):
    """Exactness as export_pairs.mts now has it (for pairs exported before the draw check)."""
    dj = json.load(open(os.path.join(d, 'drive.json'), encoding='utf8'))
    bad = {}
    for n in dj.get('log', []):
        m = re.match(r'turn (\d+) draws', n['what']) if n['phase'] == 'combat' else None
        if m:
            bad[n['floor']] = min(bad.get(n['floor'], 99), int(m.group(1)))
    fdb = min(bad) if bad else 999
    return lambda p: p['exact'] and (p['floor'] < fdb or (p['floor'] == fdb and p['turn'] < bad[fdb]))


def enemies_obs(o):
    return [e for e in (o.get('combat') or {}).get('enemies', []) if e.get('is_alive')]


def enemy_total_obs(o):
    return sum(e['hp'] + e.get('block', 0) for e in enemies_obs(o))


def enemy_total_state(s):
    return sum(e['hp'] + e.get('block', 0) for e in s.get('enemies', []) if e.get('alive'))


def incoming(o):
    """The enemies' shown attack this turn (intent damage x hits), from the start observation."""
    tot = 0
    for e in enemies_obs(o):
        for it in e.get('intents') or []:
            if isinstance(it, dict) and it.get('damage'):
                tot += int(it.get('damage') or 0) * int(it.get('hits') or it.get('repeat') or 1)
    return tot


rows = []
for d in sorted(glob.glob(os.path.join(ROOT, 'replay-*'))):
    seed = os.path.basename(d)[7:]
    f = os.path.join(d, 'pairs.jsonl')
    if seed in SKIP or not os.path.exists(f) or not os.path.exists(os.path.join(d, 'drive.json')):
        continue
    ok = strict_exact(d)
    for line in open(f, encoding='utf8'):
        p = json.loads(line)
        if not ok(p):
            continue
        h, q = p['human'], p['planner']
        hl = [x for x in h['line']]
        ql = [x for x in q['line'] if x != 'END']
        same = sorted(hl) == sorted(ql)
        start = p['start']
        he, qe = h['end'], q['end']
        r = {
            'seed': seed, 'floor': p['floor'], 'turn': p['turn'], 'enc': p['encounter'], 'kind': kind(p['encounter']), 'same': same,
            'look_h': h['look'], 'look_q': q['look'], 'one_h': h['one'], 'one_q': q['one'],
            'dmg_h': enemy_total_obs(start) - enemy_total_obs(he), 'dmg_q': enemy_total_obs(start) - enemy_total_state(qe),
            'blk_h': (he.get('combat') or {}).get('player_block', he.get('player_block', 0)) or 0, 'blk_q': (qe.get('player') or {}).get('block', 0),
            'inc': incoming(start),
            'pow_h': sum(1 for x in hl if not x.startswith('potion:') and ctype(x.split('>')[0]) == 'Power'),
            'pow_q': sum(1 for x in ql if not x.startswith('potion:') and ctype(x.split('>')[0]) == 'Power'),
            'pot_h': sum(1 for x in hl if x.startswith('potion:')), 'pot_q': sum(1 for x in ql if x.startswith('potion:')),
            'tgt_h': len({x.split('>')[1] for x in hl if '>' in x}), 'tgt_q': len({x.split('>')[1] for x in ql if '>' in x}),
            'n_enemies': len(enemies_obs(start)),
            'h': hl, 'q': ql,
        }
        rows.append(r)

diff = [r for r in rows if not r['same']]
print(f"exact turns {len(rows)} in {len({r['seed'] for r in rows})} runs; the lines differ in {len(diff)} ({100 * len(diff) / max(1, len(rows)):.0f}%)")


def split(xs, key_h, key_q, margin=1.0):
    hb = sum(1 for r in xs if r[key_h] > r[key_q] + margin)
    qb = sum(1 for r in xs if r[key_q] > r[key_h] + margin)
    return hb, len(xs) - hb - qb, qb


print("\nWhich end is better, where the lines differ (margin 1 HP-point):")
for name, xs in [('all', diff)] + [(k, [r for r in diff if r['kind'] == k]) for k in ('WEAK', 'NORMAL', 'ELITE', 'BOSS', 'EVENT')]:
    if not xs:
        continue
    lh, le, lq = split(xs, 'look_h', 'look_q')
    oh, oe, oq = split(xs, 'one_h', 'one_q')
    both = sum(1 for r in xs if r['look_h'] > r['look_q'] + 1 and r['one_q'] > r['one_h'] + 1)
    print(f"  {name:6s} n={len(xs):4d}  look-ahead: human {lh:4d} / even {le:4d} / planner {lq:4d}   one-turn: human {oh:4d} / even {oe:4d} / planner {oq:4d}"
          f"   one-turn picks the planner but the look-ahead the human: {both}")

print("\nHow the two ends differ (means over the differing turns):")
def mean(xs, k):
    return sum(r[k] for r in xs) / max(1, len(xs))
for name, xs in [('all', diff)] + [(k, [r for r in diff if r['kind'] == k]) for k in ('NORMAL', 'ELITE', 'BOSS')]:
    if not xs:
        continue
    print(f"  {name:6s} damage dealt human {mean(xs, 'dmg_h'):5.1f} planner {mean(xs, 'dmg_q'):5.1f} | block human {mean(xs, 'blk_h'):5.1f} planner {mean(xs, 'blk_q'):5.1f} (incoming {mean(xs, 'inc'):5.1f})"
          f" | powers human {mean(xs, 'pow_h'):.2f} planner {mean(xs, 'pow_q'):.2f} | potions human {mean(xs, 'pot_h'):.2f} planner {mean(xs, 'pot_q'):.2f}")
multi = [r for r in diff if r['n_enemies'] >= 2]
if multi:
    print(f"  several enemies (n={len(multi)}): distinct targets human {mean(multi, 'tgt_h'):.2f} planner {mean(multi, 'tgt_q'):.2f}")

# The cards the human played and the planner did not (and back), over the differing turns.
cnt_h, cnt_q = collections.Counter(), collections.Counter()
for r in diff:
    ch, cq = collections.Counter(x.split('>')[0] for x in r['h']), collections.Counter(x.split('>')[0] for x in r['q'])
    for k, v in (ch - cq).items():
        cnt_h[k] += v
    for k, v in (cq - ch).items():
        cnt_q[k] += v
print("\nPlayed by the human, not the planner (most):", ', '.join(f"{k} {v}" for k, v in cnt_h.most_common(14)))
print("Played by the planner, not the human (most):", ', '.join(f"{k} {v}" for k, v in cnt_q.most_common(14)))

# Each differing turn by what the human did differently (first matching reason), and the look-ahead's verdict.
SETUP = {'ARMAMENTS', 'BURNING_PACT', 'HAVOC', 'BATTLE_TRANCE', 'OFFERING', 'SEEING_RED', 'BLOODLETTING'}
def reason(r):
    hb = [x.split('>')[0].rstrip('+') for x in r['h'] if not x.startswith('potion:')]
    qb = [x.split('>')[0].rstrip('+') for x in r['q'] if not x.startswith('potion:')]
    if r['pow_h'] > r['pow_q']:
        return 'human plays a power'
    if r['pow_q'] > r['pow_h']:
        return 'planner plays a power'
    if r['pot_q'] > r['pot_h']:
        return 'planner drinks a potion'
    if r['pot_h'] > r['pot_q']:
        return 'human drinks a potion'
    if any(c in SETUP for c in hb) and not any(c in SETUP for c in qb):
        return 'human plays setup (Armaments, Havoc, draw)'
    if r['inc'] > 0 and r['blk_h'] >= r['blk_q'] + 4:
        return 'human blocks more (attack coming)'
    if r['inc'] > 0 and r['blk_q'] >= r['blk_h'] + 4:
        return 'planner blocks more (attack coming)'
    if r['dmg_h'] >= r['dmg_q'] + 4:
        return 'human deals more damage'
    if r['dmg_q'] >= r['dmg_h'] + 4:
        return 'planner deals more damage'
    if r['n_enemies'] >= 2 and sorted(x for x in r['h'] if '>' in x) != sorted(x for x in r['q'] if '>' in x):
        return 'other targets'
    return 'other (order, small)'
cats = collections.defaultdict(list)
for r in diff:
    cats[reason(r)].append(r)
print("\nWhat the human did differently, and which end the look-ahead prefers (human / even / planner):")
for c, xs in sorted(cats.items(), key=lambda kv: -len(kv[1])):
    lh, le, lq = split(xs, 'look_h', 'look_q')
    print(f"  {c:44s} n={len(xs):4d}   {lh:4d} / {le:4d} / {lq:4d}")

if '--json' in sys.argv:
    for r in rows:
        r['reason'] = reason(r) if not r['same'] else 'same'
    json.dump(rows, open(sys.argv[sys.argv.index('--json') + 1], 'w'), indent=0)
