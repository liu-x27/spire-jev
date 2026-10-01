"""Saves with a package swapped into the deck: to price cards in real fights from fixed states.

    python tools/edit_deck.py <library> <new library> --add FEEL_NO_PAIN,BURNING_PACT,TRUE_GRIT
                              [--remove STRIKE_IRONCLAD:3] [--match f32] [--upgrade]

Each save in runs/<library> matching --match has the --remove cards taken out of its deck (id:count, the
unupgraded copies first) and the --add cards put in (upgraded with --upgrade), and is written to
runs/<new library> with its <save>.choices.json beside it if it has one. A save without the cards to
remove is left out and named. The run's floor is the added cards' floor_added_to_deck. The same saves
with and without the package, played by the same pilot, price it; by two pilots, price the pilot too.
"""
import argparse, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("library")
    ap.add_argument("out")
    ap.add_argument("--add", required=True, help="card ids, comma-separated (CARD. prefix optional)")
    ap.add_argument("--remove", default="", help="id:count, comma-separated")
    ap.add_argument("--match", default="", help="a substring of the save's file name, e.g. f32")
    ap.add_argument("--upgrade", action="store_true", help="the added cards upgraded")
    args = ap.parse_args()
    runs = os.path.join(HERE, "..", "runs")
    src = args.library if os.path.isabs(args.library) else os.path.join(runs, args.library)
    dst = args.out if os.path.isabs(args.out) else os.path.join(runs, args.out)
    os.makedirs(dst, exist_ok=True)
    cid = lambda x: x if x.startswith("CARD.") else "CARD." + x
    add = [cid(x.strip()) for x in args.add.split(",") if x.strip()]
    remove = []
    for part in [p for p in args.remove.split(",") if p.strip()]:
        name, _, n = part.partition(":")
        remove.append((cid(name.strip()), int(n or 1)))
    written, skipped = 0, []
    for name in sorted(os.listdir(src)):
        if not name.endswith(".save") or args.match not in name:
            continue
        with open(os.path.join(src, name), encoding="utf8") as f:
            save = json.load(f)
        deck = save["players"][0]["deck"]
        ok = True
        for card, n in remove:
            # the unupgraded copies first
            idx = [i for i, c in enumerate(deck) if c.get("id") == card and not c.get("current_upgrade_level")]
            if len(idx) < n:
                ok = False
                break
            for i in sorted(idx[:n], reverse=True):
                deck.pop(i)
        if not ok:
            skipped.append(name)
            continue
        floor = max((c.get("floor_added_to_deck", 0) for c in deck), default=0)
        for card in add:
            entry = {"floor_added_to_deck": floor, "id": card}
            if args.upgrade:
                entry["current_upgrade_level"] = 1
            deck.append(entry)
        with open(os.path.join(dst, name), "w", encoding="utf8") as f:
            json.dump(save, f, indent=2, ensure_ascii=False)
        side = os.path.join(src, name + ".choices.json")
        if os.path.exists(side):
            shutil.copyfile(side, os.path.join(dst, name + ".choices.json"))
        written += 1
    print(f"{written} saves -> {dst}" + (f"; left out (not enough to remove): {len(skipped)}" if skipped else ""))
    for s in skipped[:20]:
        print("  ", s)


if __name__ == "__main__":
    main()
