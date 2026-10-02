"""Two checks on a random swap test beside rand_swap.py's per-card fit, for each outcome, as the
experiment session reads the Ironclad's (so the two characters' numbers are one reading):

- the arms' mean rand - R (what the three cards put in do together, against the deck without them);
- whether the cards differ at all: the fit with standard errors clustered by save (a save's arms share
  its y_R), the Wald statistic that every coefficient is the same (k - 1 contrasts against their mean),
  and its randomization p — the 3-card draws shuffled among the saves within each arm (the cards were
  given at random, so under "every card the same" any shuffle is as likely), the Wald statistic and the
  largest |t| about the mean recomputed each time.

    python tools/rand_swap_extra.py <manifest> R=<bench R>[,…] rand1=<bench>[,…] … [--shuffles 2000]
"""
import json, math, os, random, sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rand_swap import outcomes  # noqa: E402


def fit(rows, pool, draws):
    """b, the clustered covariance, the Wald statistic for equal coefficients, the largest |t| about the mean."""
    k = len(pool)
    X = np.zeros((len(rows), k))
    for i, key in enumerate(rows):
        for c in draws[key]:
            X[i, pool.index(c)] = 1
    Y = np.array([rows[key] for key in rows])
    XtXi = np.linalg.inv(X.T @ X)
    b = XtXi @ X.T @ Y
    e = Y - X @ b
    groups = {}
    for i, (_, save) in enumerate(rows):
        groups.setdefault(save, []).append(i)
    meat = sum(np.outer(X[ix].T @ e[ix], X[ix].T @ e[ix]) for ix in groups.values())
    V = XtXi @ meat @ XtXi * (len(groups) / (len(groups) - 1)) * ((len(Y) - 1) / (len(Y) - k))
    C = (np.eye(k) - np.ones((k, k)) / k)[:-1]
    d = C @ b
    wald = float(d @ np.linalg.pinv(C @ V @ C.T) @ d)
    t = float(np.max(np.abs((b - b.mean()) / np.sqrt(np.diag(V)))))
    return b, V, wald, t


args = [a for a in sys.argv[2:] if not a.startswith("--")]
shuffles = int(sys.argv[sys.argv.index("--shuffles") + 1]) if "--shuffles" in sys.argv else 2000
manifest = json.load(open(sys.argv[1], encoding="utf8"))
pool = manifest["pool"]
arms = dict(a.split("=", 1) for a in args if "=" in a)
R = outcomes(arms.pop("R"))
data = {k: outcomes(v) for k, v in arms.items()}
for y, label, scale in (("done", "act 2 finished", 100), ("hall", "act 2 hallway cost a fight", 1), ("boss1", "act 1 boss beaten", 100)):
    print(f"\n{label}:")
    rows = {}
    for k, res in data.items():
        d = [scale * (res[s][y] - R[s][y]) for s, m in manifest["saves"].items()
             if m.get(k) and s in res and s in R and res[s][y] is not None and R[s][y] is not None]
        mean = sum(d) / len(d)
        se = math.sqrt(sum((x - mean) ** 2 for x in d) / (len(d) - 1) / len(d))
        print(f"  {k}: rand - R {mean:+.2f} ± {se:.2f} ({len(d)} saves)")
        for s, m in manifest["saves"].items():
            if m.get(k) and s in res and s in R and res[s][y] is not None and R[s][y] is not None:
                rows[(k, s)] = scale * (res[s][y] - R[s][y])
    real = {(k, s): manifest["saves"][s][k] for k, s in rows}
    b, V, wald, t = fit(rows, pool, real)
    se = np.sqrt(np.diag(V))
    for i in np.argsort(-b if y != "hall" else b):
        print(f"    {pool[i]:20s} {b[i]:+7.2f} ± {se[i]:5.2f} (clustered)")
    rng = random.Random(1002)
    ge_w = ge_t = 0
    for _ in range(shuffles):
        perm = {}
        for arm in data:
            keys = [key for key in rows if key[0] == arm]
            picks = [real[key] for key in keys]
            rng.shuffle(picks)
            perm.update(zip(keys, picks))
        _, _, w, tt = fit(rows, pool, perm)
        ge_w += w >= wald
        ge_t += tt >= t
    print(f"  cards differ? Wald {wald:.1f} on {len(pool) - 1} df, randomization p {(ge_w + 1) / (shuffles + 1):.3f}; "
          f"largest |t| about the mean {t:.2f}, randomization p {(ge_t + 1) / (shuffles + 1):.3f} ({shuffles} shuffles)")
