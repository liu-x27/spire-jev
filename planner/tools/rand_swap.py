"""The random swap test for the Regent (the analysis session's rand1/rand2 design for the Ironclad, with
a smaller pool for the Regent's fewer saves): each f16 save with three unupgraded Strikes gets, in each
arm, the three taken out and three distinct cards of the pool put in, the cards balanced over the saves
(each arm: every card as often as can be), seeded. rand<k> decks are the R deck plus the three.

    python tools/rand_swap.py <library> --arms 3 --seed 1 [--pool A,B,...]   (writes the manifest and
                                                                             runs/<library>-rand<k>/)
    python tools/rand_swap.py --analyse <manifest> R=<bench R>[,…] rand1=<bench>[,…] …

The analysis, as registered for the Ironclad: per save and arm, y_rand - y_R regressed on the 20 (here
the pool's) indicators of the cards put in, no intercept (the difference takes the save's own effect
out); three outcomes: act 2 finished (floor 33 beaten), act 2's hallway cost a fight (HP lost + 10 a
potion, floors 18-32, not elites), act 1's boss beaten.
"""
import argparse, json, math, os, random, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
RUNS = os.path.join(HERE, "..", "runs")
POOL = ["GLITTERSTREAM", "KNOW_THY_PLACE", "GATHER_LIGHT", "GLOW", "HIDDEN_CACHE", "PATTER",
        "WROUGHT_IN_WAR", "PHOTON_CUT", "COLLISION_COURSE", "ASTRAL_PULSE"]


def strikes(deck):
    return [i for i, c in enumerate(deck) if c.get("id") == "CARD.STRIKE_REGENT" and not c.get("current_upgrade_level")]


def balanced(names, pool, rng):
    """Three distinct cards a save, each card as often as can be over the saves."""
    for _ in range(1000):
        stream = []
        while len(stream) < 3 * len(names):
            p = pool[:]
            rng.shuffle(p)
            stream += p
        out, ok = {}, True
        for i, n in enumerate(names):
            three = stream[3 * i: 3 * i + 3]
            if len(set(three)) < 3:
                ok = False
                break
            out[n] = three
        if ok:
            return out
    raise SystemExit("no balanced draw found")


def make(args):
    src = os.path.join(RUNS, args.library)
    pool = args.pool.split(",") if args.pool else POOL
    names = []
    for n in sorted(os.listdir(src)):
        if not n.endswith(".save"):
            continue
        with open(os.path.join(src, n), encoding="utf8") as f:
            if len(strikes(json.load(f)["players"][0]["deck"])) >= 3:
                names.append(n)
    rng = random.Random(args.seed)
    manifest = {"pool": pool, "removed": "STRIKE_REGENT x3 (unupgraded)", "saves": {n: {} for n in names}}
    for k in range(1, args.arms + 1):
        draw = balanced(names, pool, rng)
        dst = os.path.join(RUNS, f"{args.library}-rand{k}")
        os.makedirs(dst, exist_ok=True)
        for n in names:
            with open(os.path.join(src, n), encoding="utf8") as f:
                save = json.load(f)
            deck = save["players"][0]["deck"]
            for i in sorted(strikes(deck)[:3], reverse=True):
                deck.pop(i)
            floor = max((c.get("floor_added_to_deck", 0) for c in deck), default=0)
            for c in draw[n]:
                deck.append({"floor_added_to_deck": floor, "id": "CARD." + c})
            with open(os.path.join(dst, n), "w", encoding="utf8") as f:
                json.dump(save, f, indent=2, ensure_ascii=False)
            side = os.path.join(src, n + ".choices.json")
            if os.path.exists(side):
                shutil.copyfile(side, os.path.join(dst, n + ".choices.json"))
            manifest["saves"][n][f"rand{k}"] = draw[n]
        counts = {c: sum(c in draw[n] for n in names) for c in pool}
        print(f"rand{k}: {len(names)} saves -> {dst}; each card {min(counts.values())}-{max(counts.values())} times")
    out = os.path.join(RUNS, f"{args.library}-rand-manifest.json")
    with open(out, "w", encoding="utf8") as f:
        json.dump(manifest, f, indent=1)
    print("manifest", out)


ELITE = re.compile(r"^(DECIMILLIPEDE_SEGMENT_\w+|INFESTED_PRISM|ENTOMANCER|FLAIL_KNIGHT|SPECTRAL_KNIGHT|MAGI_KNIGHT|MECHA_KNIGHT|SOUL_NEXUS)$")


def outcomes(paths):
    res = {}
    for p in paths.split(","):
        for r in json.load(open(p, encoding="utf8"))["results"]:
            fs = r.get("fights") or []
            pots = lambda f: sum(1 for s in f.get("sequence") or [] if ":POTION:" in s)
            cost = [(f["hpLost"] if f["won"] else f["hpStart"]) + 10 * pots(f) for f in fs
                    if 17 < f["floor"] < 33 and not any(ELITE.match(e) for e in f["enemies"])]
            res.setdefault(r["save"], {
                "done": float(any(f["floor"] == 33 and f["won"] for f in fs)),
                "hall": sum(cost) / len(cost) if cost else None,
                "boss1": float(any(f["floor"] == 17 and f["won"] for f in fs)),
            })
    return res


def ols(rows, pool):
    """y = X b, no intercept; b and its classical SE."""
    import numpy as np
    X = np.array([[1.0 if c in cards else 0.0 for c in pool] for cards, _ in rows])
    y = np.array([v for _, v in rows])
    b, *_ = np.linalg.lstsq(X, y, rcond=None)
    resid = y - X @ b
    dof = max(1, len(y) - len(pool))
    s2 = float(resid @ resid) / dof
    cov = s2 * np.linalg.pinv(X.T @ X)
    return b, np.sqrt(np.diag(cov))


def analyse(args, rest):
    manifest = json.load(open(args.analyse, encoding="utf8"))
    pool = manifest["pool"]
    arms = dict(a.split("=", 1) for a in sys.argv[1:] if "=" in a and not a.startswith("--"))
    R = outcomes(arms.pop("R"))
    data = {k: outcomes(v) for k, v in arms.items()}
    for y, label, scale in (("done", "act 2 finished", 100), ("hall", "act 2 hallway cost a fight", 1), ("boss1", "act 1 boss beaten", 100)):
        rows = []
        for k, res in data.items():
            for save, cards in ((s, m.get(k)) for s, m in manifest["saves"].items()):
                if not cards or save not in res or save not in R:
                    continue
                a, b = res[save][y], R[save][y]
                if a is None or b is None:
                    continue
                rows.append((cards, a - b))
        b, se = ols(rows, pool)
        print(f"\n{label} (rand - R, {len(rows)} rows; {'points' if scale == 100 else 'HP'}):")
        for c, bi, si in sorted(zip(pool, b, se), key=lambda t: -t[1] * (1 if y != "hall" else -1)):
            print(f"  {c:20s} {scale * bi:+7.2f} ± {scale * si:5.2f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("library", nargs="?")
    ap.add_argument("--arms", type=int, default=3)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--pool", default="")
    ap.add_argument("--analyse")
    args, rest = ap.parse_known_args()
    if args.analyse:
        analyse(args, rest)
    else:
        make(args)
