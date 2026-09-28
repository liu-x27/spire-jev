"""The bot on the human's exact fights, a queue over several game ports: every fight save of the replay
drives whose state is the human's (every fight before it ended at the replay's HP, and the run's hands
matched up to its first turn), bosses and elites first, each fought once per arm by run-fights.ts from
the botlab worktree (main with the act 1 IL scripts).
    python botq.py --ports 47150,47151 [--arms bot2,botfix2] [--kinds BOSS,ELITE,NORMAL,WEAK] [--limit N]
Writes <replay dir>/<arm>-f<floor>.json (run-fights' log); skips what is there already.
"""
import argparse, glob, json, os, re, subprocess, sys, threading, time, queue

ROOT = 'D:/CODE/spire-jev-playlab/planner/runs'
BOTLAB = 'D:/CODE/spire-jev-botlab/planner'
SKIP = {'L1DZ6V72A4FG'}
C = 'pathdp,restbudget,potions2,sleep,spar,spar3,spar5,spar4up,spar4shop,powbonus,spartake'
ARMS = {'bot2': C, 'botfix2': C + ',halllook,lookfix,bossroll8', 'hC': C, 'hlook': C + ',halllook,lookfix', 'hadapt': C + ',halllook,lookfix,hallwide,lookadapt', 'htie': C + ',halllook,lookfix,looktie'}
kind = lambda enc: (re.search(r'_(WEAK|NORMAL|ELITE|BOSS)$', enc or '') or [None, 'EVENT'])[1]

ap = argparse.ArgumentParser()
ap.add_argument('--ports', default='47150')
ap.add_argument('--arms', default='bot2,botfix2')
ap.add_argument('--kinds', default='BOSS,ELITE,NORMAL,WEAK,EVENT')
ap.add_argument('--limit', type=int, default=0)
ap.add_argument('--shard', default='0/1')
ap.add_argument('--reverse', action='store_true')
ap.add_argument('--botlab', default=BOTLAB)
ap.add_argument('--max-floor', type=int, default=99)
a = ap.parse_args()
BOTLAB = a.botlab
arms = a.arms.split(',')
kinds = a.kinds.split(',')


def exact_fights(d):
    dj = json.load(open(os.path.join(d, 'drive.json'), encoding='utf8'))
    bad = {}
    for n in dj.get('log', []):
        m = re.match(r'turn (\d+) draws', n['what']) if n['phase'] == 'combat' else None
        if m:
            bad[n['floor']] = min(bad.get(n['floor'], 99), int(m.group(1)))
    fdb = min(bad) if bad else 999
    out = []
    for f in dj['fights']:
        if f['floor'] > fdb or (f['floor'] == fdb and bad[fdb] <= 1):
            break
        if f.get('humanHpLost') is not None and os.path.exists(os.path.join(d, f['save'])):
            out.append(f)
        if f.get('gameHpAfter') is None or f.get('gameHpAfter') != f.get('replayHpAfter'):
            break
    return out


jobs = []
for d in sorted(glob.glob(os.path.join(ROOT, 'replay-*'))):
    seed = os.path.basename(d)[7:]
    if seed in SKIP or not os.path.exists(os.path.join(d, 'drive.json')):
        continue
    for f in exact_fights(d):
        k = kind(f['encounter'])
        if k not in kinds or f['floor'] > a.max_floor:
            continue
        for arm in arms:
            if not os.path.exists(os.path.join(d, f'{arm}-f{f["floor"]}.json')):
                jobs.append((kinds.index(k), f['floor'], seed, d, f, arm))
jobs.sort(key=lambda j: (0 if j[5] != arms[-1] or len(arms) < 3 else 1, j[0], j[2], j[1], arms.index(j[5])))
if a.limit:
    jobs = jobs[:a.limit]
si, sn = map(int, a.shard.split('/'))
jobs = jobs[si::sn]
if a.reverse:
    jobs.reverse()
print(f'{len(jobs)} fights to fight ({", ".join(f"{k} {sum(1 for j in jobs if kinds[j[0]] == k)}" for k in kinds)})', flush=True)
q = queue.Queue()
for j in jobs:
    q.put(j)
env = dict(os.environ, SPIRE_JEV_MOD='D:/CODE/spire-jev-playlab/mod/Bridge/bin/Replay2/net9.0/package', SPIRE_JEV_POW_BONUS='10')
lock = threading.Lock()


def worker(port):
    while True:
        try:
            _, floor, seed, d, f, arm = q.get_nowait()
        except queue.Empty:
            return
        out = os.path.join(d, f'{arm}-f{floor}.json')
        if os.path.exists(out):
            continue  # done meanwhile by another process on the same list
        tmp = out + '.tmp'
        t0 = time.time()
        subprocess.run([sys.executable if False else 'node', 'src/run-fights.ts', '--runs', '1', '--seed', '0', '--port', port, '--choices', 'rules2', '--ascension', '10',
                        '--flags', ARMS[arm], '--weights', '{}', '--resume', os.path.join(d, f['save']), '--max-fights', '1', '--stop-floor', str(floor),
                        '--cards', 'take', '--out', tmp], cwd=BOTLAB, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        res = '?'
        if os.path.exists(tmp):
            try:
                log = json.load(open(tmp, encoding='utf8'))
                fl = [x for x in log.get('fights', []) if x.get('floor') == floor]
                if fl:
                    res = f"-{fl[0]['hpLost']}{'' if fl[0].get('won') else ' LOST'}"
                os.replace(tmp, out)
            except Exception as e:
                res = f'bad log ({e})'
        with lock:
            print(f"{time.strftime('%H:%M')} {port} {seed} f{floor:2d} {f['encounter']:32s} {arm:8s} human -{f['humanHpLost']:3d} bot {res} ({time.time() - t0:.0f} s)", flush=True)


ts = [threading.Thread(target=worker, args=(p,)) for p in a.ports.split(',')]
for t in ts:
    t.start()
for t in ts:
    t.join()
print('botq done', time.strftime('%H:%M'), flush=True)
