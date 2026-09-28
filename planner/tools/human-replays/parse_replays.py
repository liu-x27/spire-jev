"""Human replays (Spire Codex, v0.111.0 A10 Ironclad) -> one record per combat attempt.

A replay is NDJSON: a header (seed, reloads so far), then events. Quitting and continuing writes an
`end` (left_run) and a new header + `resume`; continuing inside a fight restarts it (a new
combat_start with attempt_id + 1). Per attempt: floor, encounter, room kind, HP in/out, turns,
the draws in order, the plays by turn, the enemies' moves, and whether it was the one that stood.
"""
import glob, json, os, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))


def load(path):
    return [json.loads(l) for l in open(path, encoding="utf8") if l.strip()]


def fights_of(path):
    ev = load(path)
    run = os.path.basename(path).split(".")[0]
    seed = next((x["seed"] for x in ev if x["t"] == "header"), None)
    room_kind = {}
    out = []
    cur = None
    hp = None
    max_hp = None
    deck = None
    relics = []
    potions = []
    last_room = None
    for x in ev:
        t = x["t"]
        if t == "header":
            max_hp = x.get("starting_max_hp", max_hp)
            if relics == []:
                relics = list(x.get("starting_relics", []))
        elif t == "resume":
            hp = x.get("hp", hp)
            if cur is not None:
                cur["interrupted"] = True
                out.append(cur)
                cur = None
        elif t == "hp":
            hp = x["hp"]
        elif t == "deck":
            deck = x["cards"]
        elif t == "relic":
            relics.append(x["id"])
        elif t == "potion_got":
            potions.append(x["id"])
        elif t in ("potion_used", "potion_dropped"):
            if x["id"] in potions:
                potions.remove(x["id"])
        elif t == "room":
            last_room = x
        elif t == "combat_start":
            if cur is not None:
                cur["interrupted"] = True
                out.append(cur)
            kind = (last_room or {}).get("kind", "?")
            cur = {
                "run": run, "seed": seed, "floor": x["floor"], "act": x["act"], "combat_id": x["combat_id"].split("#")[0],
                "attempt": x["attempt_id"], "encounter": x["encounter"], "kind": kind,
                "enemies": x["enemies"], "hp_start": hp, "max_hp": max_hp, "deck": deck, "relics": list(relics),
                "potions": list(potions), "draws": [], "plays": [], "moves": [], "turns": 0, "shuffles": 0,
                "potions_used": [], "result": None, "hp_lost": None, "interrupted": False,
            }
        elif cur is not None:
            if t == "draw":
                cur["draws"].append((x.get("deck_c"), x["id"], x["c"]))
            elif t == "play":
                cur["plays"].append((x.get("turn"), x["id"], x.get("up", 0), x.get("target"), x.get("auto", False)))
            elif t == "move":
                cur["moves"].append((x["src"], x["id"], tuple(x.get("intents") or [])))
            elif t == "turn" and x.get("side") == "player":
                cur["turns"] = x["n"]
            elif t == "shuffle":
                cur["shuffles"] += 1
            elif t == "potion_used":
                cur["potions_used"].append(x["id"])
            elif t == "combat_end":
                cur["result"] = x["result"]
                cur["hp_lost"] = x.get("hp_lost_total")
                cur["turns"] = x.get("turns", cur["turns"])
                cur["hp_end"] = hp
                out.append(cur)
                cur = None
            elif t == "end" and cur is not None:
                cur["interrupted"] = True
                out.append(cur)
                cur = None
    if cur is not None:
        cur["interrupted"] = True
        out.append(cur)
    # Which attempt stood: the last one of each combat_id.
    last = {}
    for i, f in enumerate(out):
        last[f["combat_id"]] = i
    n_att = collections.Counter(f["combat_id"] for f in out)
    for i, f in enumerate(out):
        f["final"] = last[f["combat_id"]] == i
        f["n_attempts"] = n_att[f["combat_id"]]
    return out


if __name__ == "__main__":
    files = sorted(glob.glob(os.path.join(HERE, "replays", "*.ndjson")))
    lst = {r["run_hash"]: r for r in json.load(open(os.path.join(HERE, "replay_list_ic_a10_111.json")))}
    allf = []
    for p in files:
        run = os.path.basename(p).split(".")[0]
        if run not in lst or not lst[run]["win"]:
            continue
        for f in fights_of(p):
            f["user"] = lst[run].get("username")
            allf.append(f)
    json.dump(allf, open(os.path.join(HERE, "human_fights.json"), "w"))
    print(len(allf), "combat attempts in", len({f['run'] for f in allf}), "winning runs")
