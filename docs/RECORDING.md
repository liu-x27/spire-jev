# Recording the bot on screen

## Seed 497: A10, floor 49 of 49, one fight from a win

![Floors 48 and 49: the bot beats Aeonglass, then dies to Test Subject (2×)](media/a10-497-floor48-49-2x.gif)

Ironclad, ascension 10, seed JEV00497, on the current rules (`--choices rules2 --flags
pathdp,restbudget,potions2,sleep,spar`, cd6305b with its Visual build): the furthest of the 90
confirmation seeds, and not a win. It beat act 3's first boss, Aeonglass, on floor 48 (120 HP
in, 48 after Burning Blood) and died on the fourth turn against the second, Test Subject, on
floor 49, after the Test Subject's revival. In the confirmation eval this run was given up at
floor 49 by the game's automated-play framework, before the second boss; recorded after the
bridge's fix (8243a80), the fights match the headless replay (`eval-clear497-a10`) 20 for 20.

- [`media/a10-497-run.mp4`](media/a10-497-run.mp4): the whole run, 3 min 37 s for 8.4 minutes of
  play, fights at game speed and the rest 4×. 960 wide, 33 MB.
- [`media/a10-497-floor49.webp`](media/a10-497-floor49.webp): the fight on floor 49 at game speed.

## Seed 707: A10, floor 48 of 49

![Act 3's boss, floor 48: the bot kills the Torch Head Amalgam, then dies to the Queen (2×)](media/a10-707-floor48-2x.gif)

Ironclad, ascension 10, seed JEV00707, every decision by the bot (the planner in fights, choices.ts
outside them). **It is the furthest of 102 A10 seeds and it is not a win**: no seed was won. Its
bosses and act 3's elite, HP going in → left at the end (of 80; Burning Blood heals 6 after):
Ceremonial Beast 72 → 13, Knowledge Demon 80 → 5, Mecha Knight 75 → 23 (the game's own
`damage_taken` agrees). It reached act 3's boss with 53 HP, killed the Torch Head Amalgam and died
on turn 8 with the Queen still at 279 HP; at A10 a second boss would have followed on floor 49.

These runs were asked for at ascension 0 and played at 10 (the game's history of each says so):
the veteran profile's preferred ascension is 10, and the bridge applies the ascension asked for
only when it is above 0. record.ts now takes the ascension from the game's history.

- [`media/a10-707-run.mp4`](media/a10-707-run.mp4): the whole run, 3 min 26 s, fights at game speed
  and the rest 4× (7.5 minutes of play). 960 wide, 33 MB.
- [`media/a10-707-floor33-2x.gif`](media/a10-707-floor33-2x.gif): act 2's boss, Knowledge Demon, won
  with 5 HP left (2×).
- [`media/a10-707-floor48.webp`](media/a10-707-floor48.webp): act 3's boss at game speed, as an
  animated WebP (browsers play it; a third of a GIF's size).

The videos show the game's own art and UI: kept in this private repository, not published.

## How to record one

Every evaluation runs the game headless. To show the bot playing, `planner/src/record.ts` plays one
run with the game drawn and records it, and `planner/src/demo-media.ts` makes the recording into a
sped-up MP4 and a GIF (plus an animated WebP), with a caption bar under the game.

```
cd planner
node src/record.ts --seed 707 [--ascension 0] [--name a10-707] [--no-media]
node src/demo-media.ts ../recordings/a10-707 --mp4-width 960 --crf 28 --gif-floors 48 --gif-speed 2 --gif-calm 2 \
  --outro 'Floor 48 of 49 · lost to act 3'"'"'s boss, the Queen still at 279 HP\nThe furthest of 102 A10 seeds tried; none of them was won'
```

Everything goes to `recordings/<name>/` (gitignored; `a<ascension>-<seed>`, the ascension the
game's history says it played): `raw.avi`, `timeline.jsonl`, `run.json` (run-fights' log),
`meta.json` (with `ascension` played and `asked`), and the media.

## The cut

The bot plays fast even on screen (game setting `fast`; two frames between cards, a 12-turn boss
fight in 14 s of play), and most of a run is not fighting: seed 675 was 94 s of fights and 193 s
of maps, rewards, events, shops and room entrances. So the MP4 plays fights at game speed
(`--speed 1`) and everything else 4× (`--calm 4`): seed 707's 7.5 minutes to floor 48 are
3 min 23 s, and 3 s of the card after. The GIF is one floor (`--gif-floors`), from the map where its room was picked.
The MP4 ends on its last frame held 3 s under a card (`--outro`, or what the timeline says the run
came to). Captions are timed through the same cut (`stretches`, `timeIn`).

## How it works

- **`SPIRE_JEV_VISUAL=1`** (bridge.ts and the bridge mod): the game starts without `--headless`, in a
  1280x720 window (`SPIRE_JEV_WINDOW`), in English (`SPIRE_JEV_LANGUAGE`), and the bridge leaves
  the animations, effects and sounds on (PresentationSuppression returns early). Headless runs are
  unchanged.
- **Godot's Movie Maker** (`--write-movie raw.avi --fixed-fps 30`): every engine frame is written
  from the renderer, 30 frames per second of *game* time. What covers the window does not matter,
  and the game runs faster than real time (about 2.5×: 107 s of play in 42 s). MJPEG at about
  2.3 MB per second of play. The game is killed as soon as the run ends, so the AVI has no index
  (ffmpeg reads it; its frames are counted once with ffprobe into meta.json) and no game over screen.
- **Frame numbers**: the observation carries `frame` (`Engine.GetProcessFrames()`, one per movie
  frame), and `SPIRE_JEV_TIMELINE` makes bridge.ts append every request's observation to
  `timeline.jsonl`. demo-media.ts cuts by floor with it and writes the captions (ASS, burned in by
  ffmpeg's libass).
- The recording uses the `Visual` build of the mod (`dotnet build -c Visual` in `mod/Bridge`), so a
  rebuild never touches the package headless evals are copying.

## The recorded run is the headless run

The same seed and settings play the same run on screen as headless (A10 as played, rules2,
`pathdp,restbudget,potions2,sleep`, main at 9b700c8 with the recording changes): seeds 620 (8 fights),
625 (12), 675 (16), 684 (16) and 707 (23) met the same fights with the same HP, turns and result both
ways. So seeds are picked from a headless eval and recorded afterwards — with the same code: another
commit is another run (main's later rules, spar among them, play other runs on these seeds).

## The A10 runs (2026-09-24, veteran profile)

The evals `demo-a0`, `demo-a0b`, `demo-a0c`, `demo-a0d` asked for A0 and played A10 (above). No win
in 102 seeds (600–603, 620–718; 681 stopped on a bridge error): most runs end at act 1's boss
(floor 17), 18 at act 2's (floor 33), two reached act 3's last floors. Seed 684 was second: it
beat The Insatiable with 1 HP left and act 3's Knights elite with 8, then the path took it into a
second elite, Mecha Knight on floor 46, at 17 HP, and it died in one turn. Seed 707 is the
showcase above. Whatever is shown from these runs has to say so: the showcase run is the best of
102, not a typical one.

Seen in the recordings: on floor 39 of seed 707 the bot asked the shop for the same potion over
and over (a dozen `shop_buy:6:MerchantPotionEntry`, the screen unchanged) until run-fights gave up
on the screen and left — its potion belt of two was full. Fixed on branch `fix-shop-potion`
(ca646a2: a potion is bought only into a free slot).

## Sizes (1280x720 recording)

| Output | Settings | Size |
|---|---|---|
| MP4 | fights 1×, rest 4×, CRF 24, 1280 wide | 0.43 MB per second of video (684: 68.6 MB) |
| MP4 | same, CRF 28, 960 wide | 0.15 MB per second (684: 22.9 MB) |
| GIF | 12 fps, 640 wide, 128 colours, no dither | 0.9 MB per second in a fight (684's floor 33 at 2×: 7.2 MB, 7.7 s) |
| WebP | same clip, 800 wide, q 55 | a third of the GIF |

A dithered GIF was 15–20 % larger and looked no better on the game's art.

## Caveats

- A window opens on the desktop for the length of the run; it counts as one of the machine's eight
  games (about 1 GB each).
- Captions change at the bridge's observations: a fight's caption shows from the moment its room is
  picked on the map; HP inside a turn is the HP at the last decision.
- The early-access ending: after act 3's boss, THE_ARCHITECT event takes the HP to 0 and the game
  over screen follows; the run's history says `win`. The captions should say the run was won.
- The videos show the game's art and UI: kept in the private repository (docs/media); publishing
  them anywhere is a separate decision.
