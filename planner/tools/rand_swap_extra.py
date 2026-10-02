"""Two checks on a random swap test beside rand_swap.py's per-card fit, for each outcome:
the arms' mean rand - R (what the three cards put in do together, against the deck without them),
and whether the cards differ at all (chi-square of the fit's coefficients about their weighted mean,
one fewer degree of freedom than cards; its 95% point and upper tail by Wilson and Hilferty).

    python tools/rand_swap_extra.py <manifest> R=<bench R>[,…] rand1=<bench>[,…] …
"""
import json, math, os, sys


def chi_tail(x, k):
    """P(chi-square on k df > x), Wilson-Hilferty."""
    z = ((x / k) ** (1 / 3) - (1 - 2 / (9 * k))) / math.sqrt(2 / (9 * k))
    return 0.5 * math.erfc(z / math.sqrt(2))


def chi95(k):
    return k * (1 - 2 / (9 * k) + 1.6449 * math.sqrt(2 / (9 * k))) ** 3


sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rand_swap import outcomes, ols  # noqa: E402

manifest = json.load(open(sys.argv[1], encoding="utf8"))
pool = manifest["pool"]
arms = dict(a.split("=", 1) for a in sys.argv[2:] if "=" in a)
R = outcomes(arms.pop("R"))
data = {k: outcomes(v) for k, v in arms.items()}
for y, label, scale in (("done", "act 2 finished", 100), ("hall", "act 2 hallway cost a fight", 1), ("boss1", "act 1 boss beaten", 100)):
    print(f"\n{label}:")
    rows = []
    for k, res in data.items():
        d = [res[s][y] - R[s][y] for s, m in manifest["saves"].items()
             if m.get(k) and s in res and s in R and res[s][y] is not None and R[s][y] is not None]
        mean = sum(d) / len(d)
        se = math.sqrt(sum((x - mean) ** 2 for x in d) / (len(d) - 1) / len(d))
        print(f"  {k}: rand - R {scale * mean:+.2f} ± {scale * se:.2f} ({len(d)} saves)")
        rows += [(m[k], res[s][y] - R[s][y]) for s, m in manifest["saves"].items()
                 if m.get(k) and s in res and s in R and res[s][y] is not None and R[s][y] is not None]
    b, se = ols(rows, pool)
    w = [1 / s ** 2 for s in se]
    mean = sum(wi * bi for wi, bi in zip(w, b)) / sum(w)
    chi = sum(((bi - mean) / si) ** 2 for bi, si in zip(b, se))
    k = len(pool) - 1
    print(f"  cards differ? chi-square {chi:.1f} on {k} df, p {chi_tail(chi, k):.2f} (no difference: mean {k}, 95% under {chi95(k):.1f})")
