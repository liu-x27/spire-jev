"""
Spike: can the shipped game run headless on this build, driven by a bridge mod?

Launches SlayTheSpire2.exe --headless --force-steam=off inside a sandbox:
hardlinks to the exe and pck, junctions to the data folders, its own mods/,
and APPDATA/LOCALAPPDATA pointed into the sandbox, so the real install, saves,
settings and Steam are not touched. Then: hello, start an Ironclad run,
observe, list legal actions, play one card, observe again, close.

The bridge mod is mod/Bridge, derived from divine-sts2's FullAppBridge (MIT). The sandbox layout follows its full_app_client.py, except that
the settings file is written fresh rather than copied from the real profile.

Run: python tools/spike_fullapp.py
"""

import json
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

GAME = Path(r"D:\SteamLibrary\steamapps\common\Slay the Spire 2")
REPO = Path(__file__).resolve().parent.parent
SANDBOX = REPO / "sandbox" / "w0"
MOD_PACKAGE = REPO / "mod" / "Bridge" / "bin" / "Release" / "net9.0" / "package"
PORT = 47100


def prepare() -> None:
    SANDBOX.mkdir(parents=True, exist_ok=True)
    for item in GAME.iterdir():
        dest = SANDBOX / item.name
        if item.is_file() and not dest.exists():
            os.link(item, dest)  # same volume (D:), so a hardlink, not a copy
    for d in ("controller_config", "data_sts2_windows_x86_64"):
        dest = SANDBOX / d
        if (GAME / d).exists() and not dest.exists():
            subprocess.run(f'cmd /c mklink /J "{dest}" "{GAME / d}"', shell=True, check=True, stdout=subprocess.DEVNULL)

    # Only our bridge: an older copy left in mods/ would load beside it.
    shutil.rmtree(SANDBOX / "mods", ignore_errors=True)
    mod_dir = SANDBOX / "mods" / "spire-jev-bridge"
    mod_dir.mkdir(parents=True, exist_ok=True)
    for f in MOD_PACKAGE.glob("*"):
        shutil.copy2(f, mod_dir / f.name)

    # A run left over from the last launch makes start_run fail (the game
    # crashes on the unfinished save), so every launch starts without one.
    for save in (SANDBOX / "userdata").rglob("saves/*.save*"):
        save.unlink()

    settings_dir = SANDBOX / "userdata" / "SlayTheSpire2" / "default" / "1"
    settings_dir.mkdir(parents=True, exist_ok=True)
    settings = {"mod_settings": {"mods_enabled": True, "mod_list": []}, "fullscreen": False, "skip_intro_logo": True}
    (settings_dir / "settings.save").write_text(json.dumps(settings, indent=2), encoding="utf-8")
    (SANDBOX / "local_userdata").mkdir(exist_ok=True)


def kill_tree(pid: int) -> None:
    subprocess.run(["taskkill", "/PID", str(pid), "/F", "/T"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


class Bridge:
    def __init__(self, port: int) -> None:
        self.sock = socket.create_connection(("127.0.0.1", port), timeout=120)
        self.r = self.sock.makefile("r", encoding="utf-8-sig")
        self.w = self.sock.makefile("w", encoding="utf-8")
        self.n = 0

    def call(self, method: str, params: dict | None = None):
        self.n += 1
        t0 = time.perf_counter()
        self.w.write(json.dumps({"id": self.n, "method": method, "params": params or {}}) + "\n")
        self.w.flush()
        line = self.r.readline()
        ms = (time.perf_counter() - t0) * 1000
        if not line:
            raise EOFError(f"{method}: bridge closed the connection")
        reply = json.loads(line)
        if reply.get("error"):
            raise RuntimeError(f"{method}: {reply['error']}")
        print(f"  {method:<14} {ms:8.1f} ms")
        return reply.get("result")


def summarise(obs) -> str:
    text = json.dumps(obs)
    return text[:600] + ("…" if len(text) > 600 else "")


def main() -> int:
    prepare()
    port_file = SANDBOX / "userdata" / "bridge_port.txt"
    port_file.unlink(missing_ok=True)
    env = os.environ.copy()
    env.update(
        APPDATA=str(SANDBOX / "userdata"),
        LOCALAPPDATA=str(SANDBOX / "local_userdata"),
        STS2_FULL_APP_BRIDGE_PORT=str(PORT),
        STS2_FULL_APP_BRIDGE_PORT_FILE=str(port_file),
        STS2_FORCE_CHARACTER="IRONCLAD",
    )
    log = SANDBOX / "full_app.log"
    t0 = time.perf_counter()
    proc = subprocess.Popen(
        [str(SANDBOX / "SlayTheSpire2.exe"), "--headless", "--force-steam=off", f"--log-file={log}"],
        cwd=str(SANDBOX), env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    print(f"launched pid {proc.pid}")
    try:
        port = 0
        while time.perf_counter() - t0 < 90:
            if port_file.exists() and port_file.read_text(encoding="utf-8").strip():
                port = int(port_file.read_text(encoding="utf-8").strip())
                break
            if proc.poll() is not None:
                print(f"game exited early with code {proc.returncode}; see {log}")
                return 1
            time.sleep(0.1)
        if not port:
            print(f"no bridge port after 90 s; see {log}")
            return 1
        print(f"bridge up on {port} after {time.perf_counter() - t0:.1f} s")

        b = Bridge(port)
        hello = b.call("hello")
        print("  hello:", summarise(hello))
        b.call("start_run", {"seed": "SPIKE00001", "character": "IRONCLAD", "ascension": 0})
        obs = b.call("observe")
        print("  observe:", summarise(obs))
        # Walk forward: take the first map node, then in combat play the first
        # legal card until none is left, end the turn, and see the next turn.
        turns_ended = 0
        for _ in range(40):
            actions = b.call("legal_actions")
            ids = [a.get("id") or a.get("action_id") for a in actions]
            print("  legal:", ids[:12])
            if not ids:
                break
            play = next((i for i in ids if i.startswith("play")), None)
            choice = play or ("end_turn" if "end_turn" in ids else ids[0])
            result = b.call("step", {"action_id": choice})
            if turns_ended == 0 and choice.startswith("choose_map"):
                print("   step result keys:", list(result.keys()) if isinstance(result, dict) else type(result))
                full = b.call("observe")
                (REPO / "sandbox" / "combat_observation.json").write_text(json.dumps(full, indent=2), encoding="utf-8")
                print("   wrote sandbox/combat_observation.json")
            obs = result.get("observation", result) if isinstance(result, dict) else {}
            combat = obs.get("combat")
            if combat:
                print(f"  after {choice}: hp {obs.get('player_hp')} energy {obs.get('player_energy')} block {obs.get('player_block')}")
                print("   combat:", summarise(combat))
            else:
                print(f"  after {choice}: phase {obs.get('phase')}")
            if choice == "end_turn":
                turns_ended += 1
                if turns_ended >= 2:
                    break
        try:
            b.call("close")
        except Exception:
            pass
        return 0
    finally:
        if proc.poll() is None:
            kill_tree(proc.pid)
        time.sleep(1)
        alive = subprocess.run(["tasklist", "/FI", f"PID eq {proc.pid}"], capture_output=True, text=True).stdout
        print("game process stopped" if str(proc.pid) not in alive else f"WARNING: pid {proc.pid} still running")


if __name__ == "__main__":
    sys.exit(main())
