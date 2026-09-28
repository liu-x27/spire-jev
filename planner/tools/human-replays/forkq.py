"""Forked branches on the human's exact fights (the experiment session's list): from each fight save,
the human's turns to turn t, then branch "human" (the human's turn t, the bot from t+1) or branch "bot"
(the bot from turn t), the fight played out in the game by the bot with the confirmed flags.
    python forkq.py --ports 47153[,..] [--list forks.json] [--flags C|lookfix]
Writes D:/CODE/spire-jev-botlab/planner/runs/forks/<seed>-f<floor>-t<turn>-<branch>[-<tag>].json; skips what is there.
"""
import argparse, glob, json, os, re, subprocess, threading, time, queue

S = os.environ.get('REPLAY_WORK')
if not S:
    raise SystemExit('REPLAY_WORK: the work dir holding replays/ and out/ (see README.md)')
BOTLAB = 'D:/CODE/spire-jev-botlab/planner'
RUNS = 'D:/CODE/spire-jev-playlab/planner/runs'
C = 'pathdp,restbudget,potions2,sleep,spar,spar3,spar5,spar4up,spar4shop,powbonus,spartake'
FLAGS = {'C': C, 'lookfix': C + ',halllook,lookfix,bossroll8', 'lookdiverse': C + ',halllook,lookfix,bossroll8,lookdiverse', 'lookwide': C + ',halllook,lookfix,bossroll8,lookdiverse,lookwide', 'hallwide': C + ',halllook,lookfix,hallwide', 'lookadapt': C + ',halllook,lookfix,hallwide,lookadapt'}

ap = argparse.ArgumentParser()
ap.add_argument('--ports', default='47153')
ap.add_argument('--list', default=os.path.join(RUNS, 'forks-from-spire-jev.json'))
ap.add_argument('--flags', default='C')
ap.add_argument('--shard', default='0/1')
ap.add_argument('--botlab', default=BOTLAB)
ap.add_argument('--reverse', action='store_true')
a = ap.parse_args()
BOTLAB = a.botlab
tag = '' if a.flags == 'C' else f'-{a.flags}'
seed_of = {}
for f in glob.glob(os.path.join(S, 'replays', '*.ndjson')):
    m = re.search(r'"seed": *"([A-Z0-9]*)"', open(f, encoding='utf8').read(400))
    if m:
        seed_of[m.group(1)] = f
out_dir = os.path.join(BOTLAB, 'runs', 'forks')
os.makedirs(out_dir, exist_ok=True)
points = json.load(open(a.list, encoding='utf8'))
si, sn = map(int, a.shard.split('/'))
points = points[si::sn]
if a.reverse:
    points.reverse()
q = queue.Queue()
n = 0
for p in points:
    for br in ('human', 'bot'):
        out = os.path.join(out_dir, f"{p['seed']}-f{p['floor']}-t{p['turn']}-{br}{tag}.json")
        if not os.path.exists(out):
            q.put((p, br, out))
            n += 1
print(f'{n} branches to play ({len(points)} points)', flush=True)
env = dict(os.environ, SPIRE_JEV_MOD='D:/CODE/spire-jev-playlab/mod/Bridge/bin/Replay2/net9.0/package', SPIRE_JEV_POW_BONUS='10')
lock = threading.Lock()
retry = []


def worker(port):
    while True:
        try:
            p, br, out = q.get_nowait()
        except queue.Empty:
            return
        if os.path.exists(out):
            continue  # done meanwhile by another process on the same list
        save = os.path.join(RUNS, f"replay-{p['seed']}", f"f{p['floor']}.save")
        if not os.path.exists(save) or not os.path.exists(os.path.join(RUNS, f"replay-{p['seed']}", 'drive.json')):
            with lock:
                retry.append((p, br, out))
                print(f"{time.strftime('%H:%M')} {port} {p['seed']} f{p['floor']} t{p['turn']} {br}: no save yet (being driven?)", flush=True)
            continue
        t0 = time.time()
        work = os.path.join(out_dir, 'work', f"{p['seed']}-f{p['floor']}-t{p['turn']}-{br}{tag}")
        r = subprocess.run(['node', 'src/replay-drive.ts', '--replay', seed_of[p['seed']], '--port', port, '--out', work, '--resume', save,
                            '--fork-turn', str(p['turn']), '--branch', br, '--flags', FLAGS[a.flags], '--fork-out', out],
                           cwd=BOTLAB, env=env, capture_output=True, text=True, encoding='utf8', errors='replace')
        res = '?'
        if os.path.exists(out):
            x = json.load(open(out, encoding='utf8'))
            res = f"-{x['hpLost']}{'' if x['won'] else ' LOST'}{'' if x.get('exact') else ' (not exact)'}"
        else:
            tail = [l for l in r.stdout.splitlines() if l.startswith('stopped')]
            res = f"no result ({tail[-1] if tail else r.returncode})"
        with lock:
            print(f"{time.strftime('%H:%M')} {port} {p['seed']} f{p['floor']:2d} t{p['turn']} {p['kind']:17s} {br:5s} {res} ({time.time() - t0:.0f} s)", flush=True)


ts = [threading.Thread(target=worker, args=(port,)) for port in a.ports.split(',')]
for t in ts:
    t.start()
for t in ts:
    t.join()
if retry:
    json.dump([r[0] for r in retry], open(os.path.join(out_dir, f'retry{tag}.json'), 'w'), indent=0)
print('forkq done', time.strftime('%H:%M'), f'({len(retry)} without a save yet)', flush=True)
