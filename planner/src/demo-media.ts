/**
 * A recorded run (record.ts) made into something to show: the whole run sped up as an MP4, and one
 * stretch of it as a GIF (and an animated WebP), all with a caption bar under the game (the act,
 * floor, HP and foe).
 *
 *   node src/demo-media.ts recordings/<name> [--speed 1] [--calm 4] [--mp4-width 1280] [--crf 24]
 *                          [--gif-floors 16-17] [--gif-speed 1] [--gif-calm 3] [--gif-width 640] [--gif-fps 12] [--no-mp4]
 *                          [--outro "Floor 33 · lost to …\nsecond line" | none]
 *
 * Fights play at --speed; what lies between them (maps, rewards, events, a room's entrance) --calm
 * times faster again (stretches()), so the video is mostly fights.
 *
 * The recording is Godot Movie Maker's raw.avi (a frame per engine frame, 30 fps of game time) and
 * timeline.jsonl, the frame of every observation the bridge sent back; so a floor starts at the
 * frame of its first observation. --gif-floors takes floors (the last fight when left out), or
 * frames as f<from>-f<to>. ffmpeg (with libass) has to be on the PATH.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

export interface TimelineLine {
  frame: number;
  t: number;
  method: string;
  action?: string;
  phase: string;
  /** The ascension the game is playing (from 2026-09-24 night's recordings on). */
  ascension?: number;
  act: number;
  /** The act's boss encounter (from 2026-09-24 evening's recordings on). */
  boss?: string;
  floor: number;
  hp: number;
  max_hp: number;
  gold: number;
  terminal: boolean;
  turn?: number;
  enemies?: string[];
}

interface Meta {
  seed: string;
  ascension: number;
  victory?: boolean;
  fps: number;
  /** The recording's frames, once counted. */
  frames?: number;
}

const FPS = 30;

/**
 * The caption bar under the 1280x720 game, in the recording's pixels: taller, in bigger type and
 * with less said (no gold), for a GIF shown at half size.
 */
interface Bar {
  height: number;
  state: number;
  label: number;
  compact?: boolean;
}
const MP4_BAR: Bar = { height: 52, state: 24, label: 20 };
const GIF_BAR: Bar = { height: 76, state: 34, label: 30, compact: true };

export function readTimeline(file: string): TimelineLine[] {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as TimelineLine)
    .filter((l) => typeof l.frame === "number")
    .sort((a, b) => a.frame - b.frame);
}

/** "WATERFALL_GIANT_BOSS:212" → "Waterfall Giant". */
export function foeName(enemy: string): string {
  const id = enemy.split(":")[0]!.replace(/_(BOSS|ELITE|NORMAL|WEAK|STRONG)$/, "");
  return id
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/** The foes of a fight, "Nibbit ×2 and Shrinker Beetle", from the enemies alive at its first look. */
export function foes(enemies: string[]): string {
  const counts = new Map<string, number>();
  for (const e of enemies) counts.set(foeName(e), (counts.get(foeName(e)) ?? 0) + 1);
  const names = [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n));
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
}

const ROOM: Record<string, string> = {
  map: "map", rewards: "rewards", card_reward: "card reward", rest_site: "rest site", shop: "shop", event: "event",
  treasure: "treasure", deck_upgrade: "upgrade", deck_card_select: "choosing a card", simple_card_select: "choosing a card",
  card_select: "choosing a card", victory: "victory", game_over: "run over",
};

/** What the caption bar says at a line: where the run is, and what is in front of it. */
export function caption(line: TimelineLine, fightFoes: string | undefined, compact = false): string {
  const where = `Act ${line.act} · Floor ${line.floor} · HP ${line.hp}/${line.max_hp}${compact ? "" : ` · ${line.gold} gold`}`;
  const gap = compact ? "  —  " : "   —   ";
  if (line.phase === "combat") return `${where}${gap}vs ${fightFoes ?? "?"}${line.turn ? `, turn ${line.turn}` : ""}`;
  return `${where}${gap}${ROOM[line.phase] ?? line.phase.replace(/_/g, " ")}`;
}

const assTime = (s: number) => {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const sec = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
const assText = (s: string) => s.replace(/\\/g, "\\\\").replace(/[{}]/g, "");

/**
 * A stretch of the recording at one speed: of frames [start, end), every `step`th is kept, so the
 * stretch plays `step` times faster than it was played.
 */
export interface Stretch {
  start: number;
  end: number;
  step: number;
}

/**
 * Frames [from, to) cut to show the fights: fights at `speed`, and what lies between them (the map,
 * rewards, events, shops, a room's entrance) `calm` times faster than that. A fight runs from its
 * first turn to the next look outside it (its last blows and the rewards coming up).
 */
export function stretches(lines: TimelineLine[], from: number, to: number, speed: number, calm: number): Stretch[] {
  const out: Stretch[] = [];
  const add = (start: number, end: number, step: number) => {
    const [a, b] = [Math.max(start, from), Math.min(end, to)];
    if (b <= a) return;
    const last = out[out.length - 1];
    if (last && last.step === step && last.end === a) last.end = b;
    else out.push({ start: a, end: b, step });
  };
  add(from, lines[0]?.frame ?? to, speed * calm);
  lines.forEach((line, i) => add(line.frame, lines[i + 1]?.frame ?? to, line.phase === "combat" ? speed : speed * calm));
  return out;
}

/** The time in the cut video (seconds) at which frame `f` of the recording shows. */
export function timeIn(cut: Stretch[], f: number): number {
  let kept = 0;
  for (const s of cut) {
    if (f < s.end) return (kept + Math.max(0, Math.ceil((f - s.start) / s.step))) / FPS;
    kept += Math.ceil((s.end - s.start) / s.step);
  }
  return kept / FPS;
}

/** ffmpeg's filters for a cut, after `trim` to its frames: keep each stretch's every step-th frame, then 30 fps of what is left. */
export function cutFilter(cut: Stretch[]): string {
  const from = cut[0]?.start ?? 0;
  const terms = cut.map((s) => `between(n\\,${s.start - from}\\,${s.end - from - 1})*not(mod(n-${s.start - from}\\,${s.step}))`);
  return `trim=start_frame=${from}:end_frame=${cut[cut.length - 1]?.end ?? from},select='${terms.join("+")}',setpts=N/(${FPS}*TB)`;
}

/** How long the last frame is held under the outro, in seconds. */
export const OUTRO = 3;

/** What a run came to, for the card over its last frame: "Floor 33 · lost to The Insatiable, act 2's boss". */
export function outro(lines: TimelineLine[], won: boolean | undefined): string {
  const last = lines[lines.length - 1]!;
  if (won) return `Run won · floor ${last.floor}`;
  const fight = [...lines].reverse().find((l) => l.phase === "combat" && l.enemies?.length);
  if (!fight) return `Run over on floor ${last.floor}`;
  // The first look of that fight names all its foes; a boss is the act's boss (or, before the timeline had it, a boss floor at A0).
  const first = lines.find((l) => l.phase === "combat" && l.floor === fight.floor && l.enemies?.length) ?? fight;
  const boss = first.boss ? first.enemies!.some((e) => first.boss!.startsWith(e.split(":")[0]!)) : [17, 33, 48].includes(first.floor);
  return `Floor ${first.floor} · lost to ${foes(first.enemies!)}${boss ? `, act ${first.act}'s boss` : ""}`;
}

/**
 * The captions of frames [from, to), shown at the times `time` gives, as an ASS script for the game
 * with `bar` under it: the run's state at the bottom left of the bar, a label at its right, and an
 * `end` card over the last frame held for OUTRO seconds after.
 */
export function captions(lines: TimelineLine[], from: number, to: number, time: (frame: number) => number, label: string, bar: Bar = MP4_BAR, end?: string): string {
  const width = 1280;
  const height = 720 + bar.height;
  const events: { start: number; end: number; text: string }[] = [];
  let fightFoes: string | undefined;
  let fightFloor = -1;
  const inRange = lines.filter((l) => l.frame < to);
  for (let i = 0; i < inRange.length; i++) {
    let line = inRange[i]!;
    const after = inRange[i + 1];
    // A room is picked on the map the moment the map is offered, and the next look comes only once
    // that room asks something (a fight's first turn, after its entrance): show that room already.
    if (line.phase === "map" && after && after.floor > line.floor) {
      const { turn: _, ...room } = after;
      line = { ...room, hp: line.hp, max_hp: line.max_hp, gold: line.gold, frame: line.frame };
    }
    if (line.phase === "combat" && line.floor !== fightFloor && line.enemies?.length) {
      fightFloor = line.floor;
      fightFoes = foes(line.enemies);
    }
    const next = after?.frame ?? to;
    const start = Math.max(line.frame, from);
    const end = Math.min(next, to);
    if (end <= start) continue;
    const text = caption(line, fightFoes, bar.compact);
    const last = events[events.length - 1];
    const [t0, t1] = [time(start), time(end)];
    if (t1 <= t0) continue;
    if (last && last.text === text && Math.abs(last.end - t0) < 1e-6) last.end = t1;
    else events.push({ start: t0, end: t1, text });
  }
  const shown = time(to);
  const total = shown + (end ? OUTRO : 0);
  const header = [
    "[Script Info]", "ScriptType: v4.00+", `PlayResX: ${width}`, `PlayResY: ${height}`, "WrapStyle: 2", "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: State,Bahnschrift,${bar.state},&H00F2F2F2,&H00F2F2F2,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,1,18,18,${Math.round((bar.height - bar.state) / 2)},1`,
    `Style: Label,Bahnschrift,${bar.label},&H0078C8F0,&H0078C8F0,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,3,18,18,${Math.round((bar.height - bar.label) / 2)},1`,
    // Over the middle of the game (not the bar): a dark box, the result in the game's gold.
    `Style: Outro,Bahnschrift,${Math.round(bar.state * 2)},&H0078C8F0,&H0078C8F0,&H40101010,&H40101010,1,0,0,0,100,100,0,0,3,24,0,5,40,40,0,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const body = events.map((e) => `Dialogue: 0,${assTime(e.start)},${assTime(e.end)},State,,0,0,0,,${assText(e.text)}`);
  body.push(`Dialogue: 0,${assTime(0)},${assTime(total)},Label,,0,0,0,,${assText(label)}`);
  if (end) {
    const [head, ...rest] = end.split("\n");
    const small = rest.length ? `\\N{\\b0\\fs${bar.state}\\c&HF2F2F2&}${rest.map(assText).join("\\N")}` : "";
    body.push(`Dialogue: 1,${assTime(shown)},${assTime(total)},Outro,,0,0,${Math.round(bar.height / 2)},,${assText(head!)}${small}`);
  }
  return `${[...header, ...body].join("\n")}\n`;
}

/**
 * The frames a recorded run spans: from just before its first observation to a few seconds past its
 * end, or to the recording's last frame (`frames`) if it stopped before that — the game is closed
 * as soon as the run is over.
 */
export function runSpan(lines: TimelineLine[], frames = Infinity): [number, number] {
  const first = lines[0]!.frame;
  const end = lines.find((l) => l.terminal) ?? lines[lines.length - 1]!;
  return [Math.max(0, first - FPS), Math.min(end.frame + 6 * FPS, frames)];
}

/** The frames in a Movie Maker AVI (it has no index, the game being killed): its video packets, counted once and kept in meta.json. */
function aviFrames(raw: string, metaFile: string): number {
  const meta = JSON.parse(fs.readFileSync(metaFile, "utf8")) as Meta;
  if (meta.frames) return meta.frames;
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", raw], { encoding: "utf8" });
  const frames = Number(out.trim());
  fs.writeFileSync(metaFile, JSON.stringify({ ...meta, frames }, null, 1));
  return frames;
}

/**
 * The frames of floors [a, b]: from the map where floor a's room was picked (so its entrance is in)
 * to the first observation past floor b (or the end).
 */
export function floorSpan(lines: TimelineLine[], a: number, b: number, frames = Infinity): [number, number] {
  const i = lines.findIndex((l) => l.floor >= a);
  if (i < 0) throw new Error(`no floor ${a} in the timeline`);
  const picked = lines[i - 1]?.phase === "map" ? lines[i - 1]!.frame : lines[i]!.frame - FPS / 2;
  const after = lines.find((l) => l.floor > b);
  return [Math.max(0, picked), after ? after.frame : runSpan(lines, frames)[1]];
}

/** Escape a path for an ffmpeg filter argument (the drive's colon, backslashes). */
const filterPath = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:");

function ffmpeg(args: string[]): void {
  execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-stats", "-y", ...args], { stdio: "inherit" });
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      speed: { type: "string", default: "1" },
      calm: { type: "string", default: "4" },
      "mp4-width": { type: "string", default: "1280" },
      crf: { type: "string", default: "24" },
      "gif-floors": { type: "string" },
      "gif-speed": { type: "string", default: "1" },
      "gif-calm": { type: "string", default: "3" },
      "gif-width": { type: "string", default: "640" },
      "gif-fps": { type: "string", default: "12" },
      "no-mp4": { type: "boolean", default: false },
      // The card over the MP4's last frame ("\n" for a smaller second line); what the run came to, or "none".
      outro: { type: "string" },
    },
  });
  const dir = path.resolve(positionals[0] ?? "");
  const raw = path.join(dir, "raw.avi");
  if (!fs.existsSync(raw)) throw new Error(`no ${raw}`);
  const lines = readTimeline(path.join(dir, "timeline.jsonl"));
  if (!lines.length) throw new Error("the timeline has no frames (a bridge from before the frame field?)");
  const metaFile = path.join(dir, "meta.json");
  const meta = JSON.parse(fs.readFileSync(metaFile, "utf8")) as Meta;
  const frames = aviFrames(raw, metaFile);
  // What the game played, not what was asked for (a profile's preferred ascension can stand: record.ts).
  const ascension = lines.find((l) => l.ascension !== undefined)?.ascension ?? meta.ascension;
  const who = `spire-jev · Ironclad A${ascension} · ${meta.seed} · no human input`;

  // The filter graphs go in files: a run's cut is a few hundred stretches, past what a command line holds.
  const graph = (name: string, filters: string) => {
    const file = path.join(dir, `${name}.filter`);
    fs.writeFileSync(file, filters);
    return file;
  };

  const speed = Number(values.speed);
  const calm = Number(values.calm);
  if (!values["no-mp4"]) {
    const [from, to] = runSpan(lines, frames);
    const cut = stretches(lines, from, to, speed, calm);
    const width = Number(values["mp4-width"]);
    const name = `run-${speed}x${calm > 1 ? `-calm${calm}` : ""}${width !== 1280 ? `-${width}` : ""}`;
    const ass = path.join(dir, `${name}.ass`);
    const fights = speed === 1 ? "fights at game speed" : `fights ${speed}×`;
    const label = calm > 1 ? `${who} · ${fights}, the rest ${speed * calm}×` : `${who} · ${speed}× speed`;
    const end = values.outro === "none" ? undefined : (values.outro ?? outro(lines, meta.victory)).replace(/\\n/g, "\n");
    fs.writeFileSync(ass, captions(lines, from, to, (f) => timeIn(cut, f), label, MP4_BAR, end));
    const out = path.join(dir, `${name}.mp4`);
    console.log(`run: frames ${from}–${to} (${((to - from) / FPS / 60).toFixed(1)} min of play) → ${timeIn(cut, to).toFixed(0)} s at ${speed}× (calm ${calm}×) → ${out}`);
    const filters =
      `[0:v]${cutFilter(cut)}${end ? `,tpad=stop_mode=clone:stop_duration=${OUTRO}` : ""},pad=1280:${720 + MP4_BAR.height}:0:0:color=0x15171c,` +
      `subtitles='${filterPath(ass)}'${width !== 1280 ? `,scale=${width}:-2:flags=lanczos` : ""}[v]`;
    ffmpeg([
      "-i", raw, "-/filter_complex", graph(name, filters), "-map", "[v]", "-an",
      "-c:v", "libx264", "-preset", "slow", "-crf", values.crf, "-pix_fmt", "yuv420p", "-r", String(FPS), "-movflags", "+faststart", out,
    ]);
    console.log(`${path.basename(out)}: ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
  }

  // The GIF: the floors asked for, or the run's last fight and its end.
  let span: [number, number];
  const g = values["gif-floors"];
  if (g?.startsWith("f")) span = g.slice(1).split("-f").map(Number) as [number, number];
  else if (g) {
    const [a, b] = g.split("-").map(Number) as [number, number];
    span = floorSpan(lines, a, b ?? a, frames);
  } else {
    const lastFight = [...lines].reverse().find((l) => l.phase === "combat");
    span = floorSpan(lines, lastFight?.floor ?? lines[lines.length - 1]!.floor, lastFight?.floor ?? 999, frames);
  }
  const gifSpeed = Number(values["gif-speed"]);
  const gifCalm = Number(values["gif-calm"]);
  const width = Number(values["gif-width"]);
  const gifFps = Number(values["gif-fps"]);
  const tag = `${g ? g.replace(/[^0-9f-]/g, "") : "last"}-${gifSpeed}x${gifCalm > 1 ? `-calm${gifCalm}` : ""}`;
  const cut = stretches(lines, span[0], span[1], gifSpeed, gifCalm);
  const ass = path.join(dir, `floors-${tag}.ass`);
  fs.writeFileSync(ass, captions(lines, span[0], span[1], (f) => timeIn(cut, f), `spire-jev bot · A${ascension}${gifSpeed === 1 ? "" : ` · ${gifSpeed}×`}`, GIF_BAR));
  const clip = (w: number) =>
    `[0:v]${cutFilter(cut)},fps=${gifFps},pad=1280:${720 + GIF_BAR.height}:0:0:color=0x15171c,subtitles='${filterPath(ass)}',scale=${w}:-1:flags=lanczos`;
  const gif = path.join(dir, `floors-${tag}.gif`);
  console.log(`gif: frames ${span[0]}–${span[1]} (${((span[1] - span[0]) / FPS).toFixed(0)} s of play) → ${timeIn(cut, span[1]).toFixed(1)} s → ${gif}`);
  // Game art is noisy: 128 colours without dithering is half the size of a dithered GIF and looks as good.
  const palette = `${clip(width)},split[a][b];[a]palettegen=stats_mode=diff:max_colors=128[p];[b][p]paletteuse=dither=none:diff_mode=rectangle[v]`;
  ffmpeg(["-i", raw, "-/filter_complex", graph(`floors-${tag}-gif`, palette), "-map", "[v]", "-an", "-loop", "0", gif]);
  // The same as an animated WebP, which browsers (and GitHub's <img>) play: under half the size, full colour.
  const webp = gif.replace(/\.gif$/, ".webp");
  ffmpeg([
    "-i", raw, "-/filter_complex", graph(`floors-${tag}-webp`, `${clip(Math.round(width * 1.25))}[v]`), "-map", "[v]", "-an",
    "-c:v", "libwebp_anim", "-q:v", "55", "-compression_level", "5", "-loop", "0", webp,
  ]);
  for (const f of [gif, webp]) console.log(`${path.basename(f)}: ${(fs.statSync(f).size / 1e6).toFixed(1)} MB`);
}

if (import.meta.main) await main();
