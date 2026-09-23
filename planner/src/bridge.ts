/**
 * Launching the game headless in a sandbox, and talking to mod/Bridge.
 *
 * The sandbox holds hardlinks to the game's exe and pck and junctions to its
 * data folders, its own mods/ with only our bridge, and its own APPDATA and
 * LOCALAPPDATA — so the real install, saves, settings and Steam are never
 * touched (the same layout as tools/spike_fullapp.py, and as divine-sts2's
 * full_app_client.py before it).
 */

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import readline from "node:readline";
import type { LegalAction, Observation } from "./obs.ts";

export const GAME = process.env["STS2_GAME_ROOT"] ?? "D:\\SteamLibrary\\steamapps\\common\\Slay the Spire 2";
const REPO = path.resolve(import.meta.dirname, "..", "..");
const MOD_PACKAGE = path.join(REPO, "mod", "Bridge", "bin", "Release", "net9.0", "package");

function prepare(sandbox: string): void {
  fs.mkdirSync(sandbox, { recursive: true });
  for (const name of fs.readdirSync(GAME)) {
    const src = path.join(GAME, name);
    const dest = path.join(sandbox, name);
    if (fs.statSync(src).isFile() && !fs.existsSync(dest)) fs.linkSync(src, dest);
  }
  for (const dir of ["controller_config", "data_sts2_windows_x86_64"]) {
    const dest = path.join(sandbox, dir);
    if (fs.existsSync(path.join(GAME, dir)) && !fs.existsSync(dest)) fs.symlinkSync(path.join(GAME, dir), dest, "junction");
  }
  // Only our bridge: an older copy left in mods/ would load beside it. Windows
  // holds the last game's copy of the dll for a moment after it exits.
  fs.rmSync(path.join(sandbox, "mods"), { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  const modDir = path.join(sandbox, "mods", "spire-jev-bridge");
  fs.mkdirSync(modDir, { recursive: true });
  for (const f of fs.readdirSync(MOD_PACKAGE)) fs.copyFileSync(path.join(MOD_PACKAGE, f), path.join(modDir, f));

  // A run left over from the last launch crashes the next start_run.
  const saves = path.join(sandbox, "userdata", "SlayTheSpire2", "default", "1", "modded", "profile1", "saves");
  if (fs.existsSync(saves)) for (const f of fs.readdirSync(saves)) if (f.includes(".save")) fs.rmSync(path.join(saves, f));

  const settingsDir = path.join(sandbox, "userdata", "SlayTheSpire2", "default", "1");
  fs.mkdirSync(settingsDir, { recursive: true });
  const settings = { mod_settings: { mods_enabled: true, mod_list: [] }, fullscreen: false, skip_intro_logo: true };
  fs.writeFileSync(path.join(settingsDir, "settings.save"), JSON.stringify(settings, null, 2));
  fs.mkdirSync(path.join(sandbox, "local_userdata"), { recursive: true });
}

export interface StepResult {
  observation: Observation;
  legal_actions: LegalAction[];
}

export class Game {
  private socket: net.Socket | undefined;
  private lines: AsyncIterator<string> | undefined;
  private next = 0;
  readonly process: ChildProcess;
  readonly sandbox: string;

  private constructor(child: ChildProcess, sandbox: string) {
    this.process = child;
    this.sandbox = sandbox;
  }

  /** Start a headless game in `sandbox` and connect to its bridge. */
  static async launch(sandbox: string, port: number): Promise<Game> {
    prepare(sandbox);
    const portFile = path.join(sandbox, "userdata", "bridge_port.txt");
    fs.rmSync(portFile, { force: true });
    const child = spawn(
      path.join(sandbox, "SlayTheSpire2.exe"),
      ["--headless", "--force-steam=off", `--log-file=${path.join(sandbox, "full_app.log")}`],
      {
        cwd: sandbox,
        stdio: "ignore",
        env: {
          ...process.env,
          APPDATA: path.join(sandbox, "userdata"),
          LOCALAPPDATA: path.join(sandbox, "local_userdata"),
          STS2_FULL_APP_BRIDGE_PORT: String(port),
          STS2_FULL_APP_BRIDGE_PORT_FILE: portFile,
          STS2_FORCE_CHARACTER: "IRONCLAD",
        },
      },
    );
    const game = new Game(child, sandbox);
    const deadline = Date.now() + 90_000;
    let bound = 0;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`game exited early (${child.exitCode})`);
      if (fs.existsSync(portFile)) {
        bound = Number(fs.readFileSync(portFile, "utf8").trim());
        if (bound) break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!bound) {
      await game.kill();
      throw new Error("no bridge port after 90 s");
    }
    await game.connect(bound);
    return game;
  }

  private async connect(port: number): Promise<void> {
    const socket = net.connect(port, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("error", reject);
    });
    socket.setNoDelay(true);
    this.socket = socket;
    this.lines = readline.createInterface({ input: socket, crlfDelay: Infinity })[Symbol.asyncIterator]();
  }

  /** One request, one reply line. The bridge answers `step` only at the next decision, so a game that hangs would hang this: it times out instead. */
  async call<T>(method: string, params: Record<string, unknown> = {}, timeoutMs = 120_000): Promise<T> {
    if (!this.socket || !this.lines) throw new Error("not connected");
    this.next++;
    this.socket.write(`${JSON.stringify({ id: this.next, method, params })}\n`);
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${method}: no reply in ${timeoutMs / 1000} s`)), timeoutMs);
    });
    const line = await Promise.race([this.lines.next(), timeout]).finally(() => clearTimeout(timer));
    if (line.done) throw new Error(`${method}: the bridge closed the connection`);
    const reply = JSON.parse(line.value.replace(/^\uFEFF/, "")) as { result?: T; error?: unknown };
    if (reply.error) throw new Error(`${method}: ${JSON.stringify(reply.error)}`);
    return reply.result as T;
  }

  startRun(seed: string, ascension = 0) {
    return this.call<StepResult>("start_run", { seed, character: "IRONCLAD", ascension });
  }
  observe() {
    return this.call<Observation>("observe");
  }
  legalActions() {
    return this.call<LegalAction[]>("legal_actions");
  }
  step(actionId: string) {
    return this.call<StepResult>("step", { action_id: actionId });
  }

  /** Close the bridge and make sure the game process, and anything it started, is gone before this returns. */
  async kill(): Promise<void> {
    try {
      this.socket?.destroy();
    } catch {}
    const child = this.process;
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    try {
      execFileSync("taskkill", ["/PID", String(child.pid), "/F", "/T"], { stdio: "ignore" });
    } catch {}
    await Promise.race([exited, new Promise((r) => setTimeout(r, 10_000).unref())]);
  }
}
