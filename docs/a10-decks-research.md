# A10 deck-building research: statistics and winning Ironclad decks (StS2)

Compiled 2026-09-24 for spire-jev (beta v0.111.0). Status: complete (first pass).

Scope: deck building only. Combat is in `a10-combat-research.md`; archetype descriptions and tier lists are in `STRATEGY-research.md` §2-3 (not repeated here). Machine-readable stats: `planner/data/card-stats-a10.json`.

Tags: `[data]` aggregate statistics; `[several]` two or more independent StS2 sources/decks agree; `[one]` one source; `[inference]` derived by me.

---

## 1. Sources

| Key | URL | Date / patch | Gives | Reliability |
|---|---|---|---|---|
| cx-ic | https://spire-codex.com/api/runs/metrics/cards?bracket=a10&character=IRONCLAD | fetched 2026-09-24; runs from many builds (v0.98-v0.111), no patch filter | Per-card win rate and pick count, Ironclad A10 only (117,284 runs, 22,521 wins) | High for counts; win rates are observational |
| cx-all | https://spire-codex.com/api/runs/metrics/cards?bracket=a10 | same | Per-card pick rate when offered, **by act**, A10, all characters and player counts (490,656 runs) | High; not Ironclad-only (see §2.1) |
| cx-wr50 | https://spire-codex.com/api/runs/scores/cards?stat_filter=a10_wr50&character=IRONCLAD&include_skip=true | same | A10 Ironclad runs by uploaders with >=50% overall win rate (~19.5k runs): win rate + "Codex Elo" per card, and a SKIP pseudo-card | High for counts; Elo method undocumented beyond "pick vs alternative" |
| cx-runs | https://spire-codex.com/api/runs/list?character=ironclad&win=true&ascension=10&players=1 and `/api/runs/shared/{hash}` | fetched 2026-09-24 | Individual A10 Ironclad solo wins: final deck with floor each card was added, removals, relics, bosses | High (game-exported run files); the player skill is unknown except where the username repeats |
| cx-enc | https://spire-codex.com/api/runs/encounter-stats?act=2&room_type=boss, `/api/runs/community-stats?bracket=a10` | same | Per-boss fights, fatality, turns, damage (per character, all ascensions); A10 deadliest encounters | High |
| cx-user | `/api/runs/stats?username=Antsa&character=ironclad&ascension=10` (and Nomad) | same | One uploader's A10 Ironclad record and personal pick rates | High; n = 103 and 60 runs |
| cx-chart | `/api/charts/deck-growth`, `/api/charts/entity-copies?entity=…`, `/api/charts/winrate-by-stat?stat=deck_size…` | same | Deck growth for wins vs losses; copies vs WR (survivorship, not used for caps) | Medium |
| jsheet | https://docs.google.com/spreadsheets/d/197RwIxLuzSLubsWr6OLfhdHPRFgIWRnQyTp-RuZUveU (gviz CSV) | runs 2026-03-06 to 07-06 | Jorbs' per-run notes (one line per run; no deck lists) | A (top player), qualitative |
| steam | Steam StS2 threads listed in §6.2 | Apr-May 2026 | Player advice, no full lists | Low-medium |
| cx-doc | https://spire-codex.com/developers, https://spire-codex.com/openapi.json, https://github.com/ptrlrd/spire-codex | 2026 | Endpoint and parameter reference | High |

Unreachable / not useful: see §6 (Untapped 403, Reddit blocked, YouTube descriptions do not render, MetaBot numbers templated, sts2front has StS1 contamination).

---

## 2. Card statistics (A10)

### 2.1 How to read the numbers

- **Band:** A10 (the top ascension; there is no A10+). Spire Codex does not filter by patch here, so the pool mixes v0.98 to v0.111; most solo A10 wins in the run list are v0.107.1 and v0.111.0.
- **Pick% by act** (cx-all) is "taken when offered" in acts 1/2/3. It includes all characters (for Offering, 65% of picks are Ironclad players; the rest come from multiplayer and transforms), so treat it as a close proxy for Ironclad, not an exact figure.
- **A10 WR** (cx-ic) is the win rate of Ironclad A10 runs that picked the card at any time. **ΔWR** = WR − 25.8, where 25.8 is the site's pick-weighted baseline. The raw Ironclad A10 run win rate is only 19.2% (22,521/117,284), because runs that survive longer take more cards.
- **wr50 Elo−Skip**: in runs by uploaders with a >=50% win rate, the card's Codex Elo minus the Elo of SKIP (1,570.8). A negative value means strong players, when shown this card, on balance prefer the alternatives or skipping. This is the closest thing to "what good players think it is worth", and it is not survivorship-biased the way WR is.
- **wr50 ΔWR** = card WR in that bracket − 69.0 (pick-weighted baseline over Ironclad cards, my calculation).
- **No per-act win deltas exist** on Spire Codex (the `act` split only exists for relics). Untapped's per-act deltas (A7+) are already in `STRATEGY-research.md` §3.2 / §9c.8.
- **Biases:** survivorship (cards mostly taken in act 3, e.g. Barricade, Juggling, Havoc, Body Slam, Dark Embrace, look good on WR because the run already reached act 3); selection (strong players take engine cards, so the card gets credit for the player). Use Elo−Skip and the act-1 pick rate to cross-check.

### 2.2 Table (sorted by wr50 Elo−Skip)

Pick% from cx-all; A10 WR, n and ΔWR from cx-ic; last two columns from cx-wr50. BASH is not offered and is omitted. AGGRESSION, DRUM_OF_BATTLE, FEED, NOT_YET, ONE_TWO_PUNCH, DEMONIC_SHIELD and TANK (multiplayer) are Ironclad cards missing from the bot's id list (confirmed via `/api/cards?color=ironclad`).

| Card | Pick% A1/A2/A3 | A10 WR (n) | ΔWR | wr50 Elo−Skip | wr50 ΔWR |
|---|---|---|---|---|---|
| OFFERING | 57.7/60.1/61.4 | 44.6 (16,230) | +18.8 | +314 | +7.8 |
| DOMINATE | 65.1/58.2/54.9 | 35.1 (26,917) | +9.3 | +275 | +3.1 |
| UNMOVABLE | 52.6/48.3/42.5 | 41.7 (13,484) | +15.9 | +244 | +4.1 |
| PYRE | 47.1/47.6/46.8 | 37.9 (12,021) | +12.1 | +238 | +6.6 |
| COLOSSUS | 56.9/54.7/48.9 | 33.8 (30,256) | +8.0 | +216 | +2.1 |
| BARRICADE | 32.9/36.7/33.1 | 43.1 (9,108) | +17.3 | +175 | +4.5 |
| CRUELTY | 45.1/42.2/37.7 | 35.2 (17,011) | +9.4 | +168 | +7.4 |
| CRIMSON_MANTLE | 47.1/39.6/40.6 | 39.1 (12,456) | +13.3 | +164 | +4.1 |
| STOKE | 35.7/32.7/29.5 | 46.1 (10,377) | +20.3 | +159 | +6.9 |
| DARK_EMBRACE | 26.4/31.8/32.3 | 47.6 (8,097) | +21.8 | +137 | +6.1 |
| BATTLE_TRANCE | 51.2/47.6/39.1 | 35.2 (30,220) | +9.4 | +130 | +3.6 |
| BRAND | 39.2/32.6/28.2 | 36.5 (10,701) | +10.7 | +128 | +2.8 |
| CASCADE | 28.7/27.4/25.7 | 39.8 (8,087) | +14.0 | +115 | +6.0 |
| MANGLE | 28.6/24.6/25.7 | 41.2 (7,761) | +15.4 | +114 | +7.8 |
| BURNING_PACT | 37.3/40.3/38 | 37.8 (23,176) | +12.0 | +103 | +2.3 |
| NOT_YET | 30.9/32.8/26.6 | 38.2 (8,723) | +12.4 | +97 | -0.3 |
| IMPERVIOUS | 29/33.8/38.4 | 40.7 (9,482) | +14.9 | +96 | +5.9 |
| DEMON_FORM | 30/27.1/27.6 | 34.1 (7,784) | +8.3 | +95 | +4.5 |
| BLOODLETTING | 41.4/34.8/31.2 | 29.9 (49,573) | +4.1 | +69 | -1.8 |
| CONFLAGRATION | 35.1/26.1/18.1 | 35.4 (9,552) | +9.6 | +68 | +2.2 |
| THRASH | 38.3/28.5/20.8 | 38.2 (10,319) | +12.4 | +63 | +3.0 |
| AGGRESSION | 26.3/23.7/21.1 | 39.7 (7,458) | +13.9 | +50 | +3.2 |
| HELLRAISER | 32.4/19.4/15.5 | 31.8 (7,848) | +6.0 | +49 | +3.6 |
| POMMEL_STRIKE | 42.5/31.3/26 | 28.9 (46,485) | +3.1 | +47 | -1.9 |
| BULLY | 35.6/28.5/25 | 32.3 (17,057) | +6.5 | +37 | +2.7 |
| ONE_TWO_PUNCH | 28.2/26.4/23.6 | 34.1 (8,099) | +8.3 | +30 | +0.0 |
| PACTS_END | 23.6/23.1/16.6 | 36.0 (7,203) | +10.2 | +26 | +3.0 |
| FEEL_NO_PAIN | 23/27.3/27.2 | 40.8 (20,684) | +15.0 | +21 | +6.5 |
| TEAR_ASUNDER | 26.2/21.6/22.3 | 37.1 (7,583) | +11.3 | +21 | +5.3 |
| TAUNT | 47.2/31.6/21.3 | 29.9 (34,519) | +4.1 | +17 | +0.7 |
| FLAME_BARRIER | 42/29.4/19.6 | 27.6 (21,612) | +1.8 | +12 | -3.4 |
| MOLTEN_FIST | 32.2/27/24.3 | 28.7 (33,766) | +2.9 | +6 | -0.3 |
| SHRUG_IT_OFF | 39.3/30.7/20.8 | 27.8 (51,235) | +2.0 | +0 | -2.7 |
| SECOND_WIND | 27.2/25.1/24.8 | 39.2 (17,275) | +13.4 | -5 | +5.3 |
| FIEND_FIRE | 23.9/20/20.4 | 40.0 (7,483) | +14.2 | -7 | +1.9 |
| FORGOTTEN_RITUAL | 19/25.3/25.9 | 37.9 (13,741) | +12.1 | -16 | +7.4 |
| RAGE | 29.9/24.6/19 | 27.9 (16,730) | +2.1 | -24 | -4.5 |
| EVIL_EYE | 26.3/27.1/23.6 | 33.1 (16,740) | +7.3 | -25 | -0.3 |
| VICIOUS | 22.4/23.3/20.8 | 38.0 (19,557) | +12.2 | -25 | +3.3 |
| TREMBLE | 33.9/22.6/17.7 | 28.0 (45,692) | +2.2 | -27 | -2.2 |
| JUGGERNAUT | 15.9/16.1/17.6 | 34.4 (4,872) | +8.6 | -32 | +0.8 |
| ASHEN_STRIKE | 25.8/24.4/21.6 | 35.5 (15,252) | +9.7 | -49 | +2.5 |
| STAMPEDE | 27.6/18.9/14.8 | 25.7 (18,669) | -0.1 | -59 | -5.0 |
| UPPERCUT | 38.3/20.1/15 | 32.1 (19,716) | +6.3 | -62 | +3.7 |
| RUPTURE | 23.3/20.6/19.1 | 29.1 (18,625) | +3.3 | -64 | -4.9 |
| STONE_ARMOR | 24.4/20.3/17.2 | 29.2 (16,706) | +3.4 | -65 | -0.6 |
| TRUE_GRIT | 23.9/18.2/13.7 | 30.3 (34,333) | +4.5 | -86 | -2.2 |
| EXPECT_A_FIGHT | 17.6/19.4/17.5 | 32.1 (12,328) | +6.3 | -93 | -2.0 |
| DEMONIC_SHIELD | 17.3/20.7/20 | 38.5 (6,141) | +12.7 | -93 | +1.9 |
| DRUM_OF_BATTLE | 14.8/19.5/21.1 | 39.1 (11,446) | +13.3 | -111 | +6.1 |
| PILLAGE | 17.7/15.9/13.4 | 32.6 (10,414) | +6.8 | -119 | +0.1 |
| BLOOD_WALL | 23.2/17.9/13.7 | 25.8 (33,679) | +0.0 | -119 | -6.5 |
| INFERNAL_BLADE | 23.6/16.2/13.1 | 25.8 (11,489) | +0.0 | -124 | -3.3 |
| DISMANTLE | 29.2/14.6/9.3 | 24.9 (13,271) | -0.9 | -124 | -4.0 |
| HEADBUTT | 19/14.6/12.3 | 30.3 (26,270) | +4.5 | -128 | +1.0 |
| ARMAMENTS | 25.3/13.1/7.6 | 25.8 (32,370) | +0.0 | -131 | -2.5 |
| INFLAME | 28.1/16.9/12.3 | 24.8 (17,304) | -1.0 | -133 | -6.7 |
| FEED | 21.8/10.4/4.1 | 29.7 (6,406) | +3.9 | -145 | -2.5 |
| INFERNO | 25.1/13.2/8 | 25.3 (16,546) | -0.5 | -152 | -3.8 |
| WHIRLWIND | 27.6/14.5/7.7 | 26.4 (13,350) | +0.6 | -153 | -6.7 |
| TANK | 4.8/6/8.6 | 48.2 (1,182) | +22.4 | -183 | +5.6 |
| JUGGLING | 9.9/11.3/11.6 | 36.2 (9,324) | +10.4 | -189 | +2.7 |
| BLUDGEON | 24.6/10.2/7.5 | 24.5 (11,568) | -1.3 | -190 | -2.0 |
| UNRELENTING | 24.7/11/7 | 25.6 (11,204) | -0.2 | -195 | -1.2 |
| BODY_SLAM | 12.2/12.2/12.6 | 33.3 (16,849) | +7.5 | -197 | +1.7 |
| PRIMAL_FORCE | 16/7.5/4.3 | 27.8 (4,866) | +2.0 | -197 | -9.4 |
| PERFECTED_STRIKE | 22.7/12.3/9.7 | 20.7 (21,145) | -5.1 | -198 | -7.7 |
| HOWL_FROM_BEYOND | 15.9/11.9/8 | 26.9 (8,872) | +1.1 | -201 | -5.1 |
| SPITE | 13.7/10.1/7.5 | 27.6 (8,136) | +1.8 | -215 | +0.0 |
| STOMP | 22.6/10.5/4.3 | 22.3 (10,825) | -3.5 | -224 | -8.6 |
| THUNDERCLAP | 18.2/8.7/5 | 25.6 (20,632) | -0.2 | -224 | -3.9 |
| FIGHT_ME | 22.7/11.6/7.4 | 23.8 (12,067) | -2.0 | -254 | -5.9 |
| TWIN_STRIKE | 14.5/8/6.5 | 21.6 (17,398) | -4.2 | -263 | -4.1 |
| IRON_WAVE | 12.7/6.6/4.2 | 21.8 (14,218) | -4.0 | -265 | -9.5 |
| RAMPAGE | 19.3/7.5/4.5 | 21.4 (8,125) | -4.4 | -270 | -3.2 |
| BREAKTHROUGH | 20.7/6.9/3 | 19.7 (24,754) | -6.1 | -274 | -9.4 |
| SWORD_BOOMERANG | 11.5/8/7.1 | 27.1 (16,295) | +1.3 | -274 | +0.2 |
| SETUP_STRIKE | 12.1/7.1/5.6 | 20.3 (14,304) | -5.5 | -291 | -6.1 |
| ANGER | 16.4/6.5/4.5 | 23.8 (20,281) | -2.0 | -302 | -5.6 |
| HEMOKINESIS | 16.6/5.9/4.3 | 21.0 (7,967) | -4.8 | -306 | -10.7 |
| HAVOC | 5.8/5.2/5.6 | 33.7 (10,716) | +7.9 | -308 | -1.0 |
| CINDER | 7.6/1.9/1.4 | 18.9 (9,138) | -6.9 | -403 | -9.5 |


### 2.3 Headline readings `[data]`

- **Frontload commons lose value by act, and strong players rate them below SKIP.**
  - Pick rates by act: Anger 16/7/5%, Breakthrough 21/7/3%, Hemokinesis 17/6/4%, Twin Strike 15/8/7%.
  - Elo−Skip: Anger −302, Breakthrough −274, Hemokinesis −306, Twin Strike −263.
  - The bot's favourites are mid-table at best: Pommel Strike +47 (pick 43/31/26%), Taunt +17 (47/32/21%), Tremble −27 (34/23/18%). They are fine as a first copy and neutral after that.
- **The top of the strong-player list is power block, Strength and energy:** Offering, Dominate, Unmovable, Pyre, Colossus, Barricade, Cruelty, Crimson Mantle, Stoke, Dark Embrace.
  - All of them are taken 26-65% of the time in act 1 at A10.
  - All of them carry A10 ΔWR of +8 to +22.
- **Engine cards whose pick rate *rises* by act:** Dark Embrace, Feel No Pain, Forgotten Ritual, Impervious, Drum of Battle, Juggernaut. (Juggling also rises, but it is a trap at −189.) Burning Pact and Barricade stay at about 35-40%.
- **Strength scaling is not dead at A10.** Dominate +275, Brand +128 and Demon Form +95 are all above SKIP.
  - Inflame (−133) and Fight Me (−254) are below it: they are the "second-rate" Strength sources, taken only when nothing better has come.
  - Rupture (−64) needs support.
- **The strong-player numbers match one strong uploader's personal data.** Antsa, 42/103 A10 Ironclad wins, picks Offering 84%, Dominate 72%, Colossus 70%, Unmovable 67%, Dark Embrace 63%, Burning Pact 59% and Flame Barrier 57% when offered (cx-user).

---

## 3. Winning A10 Ironclad decks

### 3.1 Concrete decks (Spire Codex uploaded solo runs, A10, won)

Format: run hash (uploader, build), final size, bosses (act 1 / act 2 / act 3 pair). Basics as S (Strike), D (Defend); "+" = upgraded in the final deck; "fN" = floor the card was added. AB = Ascender's Bane (the A10 curse). Act 1 boss is floor 17 and the act 2 boss is floor 33. A card listed at f33 is usually that boss's reward, so "f<=32" means "in the deck at the act 2 boss". Non-Ironclad cards (colorless, event, Ancient, other-class) are marked *. Full JSON: `https://spire-codex.com/api/runs/shared/<hash>`.

**Uploader skill** (from `/api/runs/stats?username=`): Antsa 42/103 A10 Ironclad wins (40.8%); Nomad 10/60 (16.7%, below the site mean, so Nomad's decks are "wins", not "strong-player" decks). Others unknown.

**Decks that beat The Insatiable (act 2 boss):**

- **D1 `1963a346e33f63ad`** (777, v0.111.0), 22 cards. Bosses: Lagavulin Matriarch / **Insatiable** / Aeonglass + Test Subject. 4S (1+) 3D (1+) Bash AB; Neow transformed a Strike into THRASH f1 and a Defend into FIEND_FIRE+ f1; TAUNT+ f3, SHRUG_IT_OFF f5, POMMEL_STRIKE+ f9, BLOOD_WALL+ f14, BARRICADE+ f17, INFLAME f20, BODY_SLAM+ f21, UNMOVABLE+ f22, BLOOD_WALL+ f28, SHRUG_IT_OFF f30, CRIMSON_MANTLE+ f37. Relics include Pael's Legion, Vambrace, Self-Forming Clay, Akabeko, Nunchaku. **Archetype: Barricade/Body Slam block.** At the Insatiable: 21 cards, 12 non-basic; engine = Barricade + Unmovable + 2 Blood Wall + Body Slam, plus Inflame and Thrash.
- **D2 `d0a879a9a590b70f`** (Nomad, v0.111.0), 26. Waterfall Giant / **Insatiable** / Test Subject + Queen. 3S+ 4D+ Bash+ AB; EVIL_EYE+ f1, INFLAME+ f2, BRAND+ f7, DRUM_OF_BATTLE f9, EXPECT_A_FIGHT+ f14, EVIL_EYE+ f12, UNMOVABLE+ f17, CRUELTY f20, STOMP+ f21 (from a transformed Strike), WHIRLWIND f22, THRASH+ f25, BODY_SLAM+ f30, SHRUG_IT_OFF+ f31, BARRICADE+ f33, TREMBLE+ f42, COLOSSUS f45, BATTLE_TRANCE f46. Relics: Chemical X, Pen Nib, Molten Egg, Orichalcum, Ruined Helmet. **Block + Strength hybrid.** At the Insatiable: ~22 cards; Strength from Inflame + Brand, Thrash, Body Slam + Unmovable.
- **D3 `dc626a513e5a2c69`** (Nomad, v0.111.0), 25. The Kin / **Insatiable** (f34) / Aeonglass + Test Subject. **0 Strikes**, 4D Bash+ AB; INFERNAL_BLADE+ f2, EVIL_EYE f6, THE_BOMB+* f7, DARK_SHACKLES+* f9, ABUNDANCE* f11, UNRELENTING f13, SHRUG_IT_OFF f14, UNMOVABLE+ f17, NOSTALGIA+* f27, FISTICUFFS* f27, BODY_SLAM+ f29, STONE_ARMOR+ f31, UNMOVABLE+ f33, COLOSSUS f36, THE_GAMBIT+* f40, INFLAME f40, JUGGERNAUT f43, STONE_ARMOR+ f45, SCRAWL+* f45. Removed Hemokinesis f7. Relics: Dowsing Rod (removed the Strikes), Pen Nib, Vajra, Captain's Wheel, Paper Phrog. **Body Slam block.**
- **D4 `8c88f9c8da61aee9`** (RRROCKETS, v0.111.0), 30. The Kin / **Insatiable** / Aeonglass + Test Subject. 4S 4D Bash AB; PRIMAL_FORCE+ f1, POMMEL_STRIKE+ f2, UPPERCUT+ f3, CINDER+ f5, BREAKTHROUGH f6, ARMAMENTS+ f8, ONE_TWO_PUNCH f9, TAUNT f12, VICIOUS+ f14, TRUE_GRIT+ f15, CRIMSON_MANTLE f17, FORGOTTEN_RITUAL+ f19, EVIL_EYE+ f23, RUPTURE+ f24, BLOODLETTING+ f27, BATTLE_TRANCE f29, STONE_ARMOR f30, RUPTURE+ f31, UNMOVABLE+ f33, SHRUG_IT_OFF f36. Removed Decay f1, Injury f34, Strike f39. Relics: Vajra, Ruined Helmet, Pael's Blood, Gorget, Self-Forming Clay. **Self-damage Strength (2 Rupture + Crimson Mantle + Bloodletting).** Note the act 1 was all frontload commons (7 of them), but act 2 added 9 engine cards; at the Insatiable 29 cards.
- **D5 `fa5d183df9a2c556`** (Antsa, v0.111.0), 37. Lagavulin Matriarch / **Insatiable** / Test Subject + Queen. 4S+ 5D Bash AB Greed; ANGER f2, TAUNT f3, SHOCKWAVE+* f6, FIGHT_ME f6, ARMAMENTS+ f6, DISMANTLE f8, BURNING_PACT+ f11, UNMOVABLE+ f13, POMMEL_STRIKE+ f14, OFFERING+ f17, five Defect cards* f18 (SUPERCRITICAL, BOOT_SEQUENCE, TURBO, BUFFER, REBOOT: an act 2 Ancient reward), TRUE_GRIT+ f22, BLOODLETTING f23, EVIL_EYE+ f25, NOT_YET f31, CONFLAGRATION f33, MOLTEN_FIST f35, INFLAME+ f38, SECOND_WIND+ f42, FORGOTTEN_RITUAL+ f46. **Draw/energy "good stuff" (Offering, Burning Pact, Bloodletting, Pommel, Turbo) with Vulnerable.**
- **D6 `fd6c981931a8efc9`** (kedus, v0.103.2), 31. Waterfall Giant / **Insatiable** / Doormaker + Test Subject. 5S (enchanted) 1D Bash AB; SHOCKWAVE+* f2, DOMINATE f2, BLOODLETTING f5, TREMBLE+ f7, TRUE_GRIT f8, IMPERVIOUS f14, BLUDGEON f15, IMPERVIOUS f17, VICIOUS f20, ASHEN_STRIKE+ f20, EXTERMINATE* f21, BURNING_PACT f30, BATTLE_TRANCE f31, DARK_EMBRACE+ f33, 3 APPARITION* f34, BATTLE_TRANCE f35, UNMOVABLE+ f39, DOMINATE+ f44, FORGOTTEN_RITUAL+ f45, TREMBLE f46. Relics: Bag of Marbles, Red Skull, Vajra, Horn Cleat. **Vulnerable + Dominate.** The reward log shows several act 1-2 rewards skipped that offered Anger, Havoc, Infernal Blade, Breakthrough, Bully (the floor labels in the log looked garbled, so treat as `[one]`).
- **D21 `24df85e7635acd94`** (Antsa, v0.111.0), 33. Lagavulin Matriarch / **Insatiable** / Aeonglass + Test Subject. 3S 4D Bash AB + Debt; CLOAK_AND_DAGGER* f1, FURNACE* f1, ARMAMENTS+ f6, COLOSSUS+ f8, TAUNT f12, SHRUG_IT_OFF f13, MANGLE f17, BLOOD_WALL+ f19, UPPERCUT+ f20, FORGOTTEN_RITUAL f20, BURNING_PACT+ f22, BLOODLETTING+ f23, EVIL_EYE f25, SHOCKWAVE+* f25, INFLAME+ f28, FEEL_NO_PAIN f29, TRUE_GRIT+ f30, SECOND_WIND f31, DOMINATE f33, BATTLE_TRANCE f35, VICIOUS+ f36, FEEL_NO_PAIN+ f37, FLAME_BARRIER f44, DRUM_OF_BATTLE f45, SECOND_WIND+ f45. **Exhaust (FNP, True Grit+, Second Wind, Burning Pact) + Inflame/Dominate.**
- **D22 `ee3eb4c141a6e5d1`** (Antsa, v0.111.0), 31. The Kin / **Insatiable** / Test Subject + Aeonglass. 1S+ 2D+ Bash AB; STOMP f2, WHIRLWIND+ f5, JACKPOT+* f6, TREMBLE f6 and f18, BLOODLETTING+ f7 and f25, TAUNT f8, DISMANTLE f9, SHRUG_IT_OFF+ f11, STAMPEDE+ f13, SECOND_WIND+ f14, CRIMSON_MANTLE f17, STONE_ARMOR+ f18, CINDER+ f18, BURNING_PACT f21, CRUELTY f21, DRUM_OF_BATTLE f22, PYRE+ f27, ARMAMENTS f31, TEAR_ASUNDER+ f33, RUPTURE+ f35, VICIOUS f37, MOLTEN_FIST+ f38, DOMINATE f39, COLOSSUS f42, FORGOTTEN_RITUAL f43. **Vulnerable + Cruelty with power block (Crimson Mantle, Stone Armor); no Strength until act 3.**
- **D23 `ba340d6546d2dcb8`** (Antsa, v0.110.1), 34. Soul Fysh / **Insatiable** / Queen + Aeonglass. 3S+ 4D Bash AB + Clumsy; RAMPAGE f2, HEADBUTT+ f4, TRUE_GRIT+ f5, f12, f19 (three copies), ARMAMENTS+ f8, HOWL+ f14, OFFERING f15, TEAR_ASUNDER f15, PACTS_END+ f17, SQUASH+* f21, SHRUG_IT_OFF+ f22, EVIL_EYE+ f24, BRAND f24, UNMOVABLE f29, FEEL_NO_PAIN f30, STOKE f31, CONFLAGRATION+ f33, FLAME_BARRIER+ f35, TAUNT+ f35, UNRELENTING f36, BLUDGEON+ f38, CRUELTY+ f39, FIGHT_ME+ f39, DRUM_OF_BATTLE+ f44, TREMBLE+ f45. **Exhaust (3 True Grit+, FNP, Stoke, Pact's End, Evil Eye) + Brand.**

**Other A10 wins (act 2 boss was Kaiser Crab or Knowledge Demon):**

- **D7 `b1917ad608d15757`** (anon, v0.111.0), 27. Kin / Kaiser Crab / Queen + Aeonglass. 3S 4D Bash AB; BLUDGEON f2, INFERNO f3, RUPTURE f5, BLOODLETTING f6, ARMAMENTS+ f8, HEMOKINESIS f13, BREAKTHROUGH f15, TEAR_ASUNDER f17, UPPERCUT f19, ROYALTIES* f21, VICIOUS f28, RUPTURE f30, ARMAMENTS+ f31, JUGGERNAUT f33, EXPECT_A_FIGHT f36, BLOODLETTING+ f37, BLOOD_WALL f37, STAMPEDE f40. Relics: Demon Tongue, Beating Remnant, Centennial Puzzle, Red Mask. **Self-damage (Inferno, 2 Rupture, Tear Asunder).**
- **D8 `988f6826593579e5`** (wuxiatux, v0.111.0), 27. Soul Fysh / Kaiser Crab / Test Subject + Queen. 4S 3D Bash AB; BREAKTHROUGH f1, BRAND f1, FIGHT_ME+ f2, BLOODLETTING+ f5, BLOOD_WALL f6, FEEL_NO_PAIN f11, AGGRESSION f12, ARMAMENTS+ f15, CONFLAGRATION f17, SUPERCRITICAL+* f20, MOMENTUM_STRIKE* f20, PYRE+ f22, INFERNO f24, INFERNO f25, TEAR_ASUNDER f33, BODY_SLAM f44 (+ Regret, Decay). Relics: Brimstone, Self-Forming Clay, Captain's Wheel. **Self-damage (2 Inferno, Tear Asunder) + Brand.**
- **D9 `ae25c79227a4b45b`** (Mokuou, v0.111.0), 28. Soul Fysh / Knowledge Demon / Aeonglass + Test Subject. 5S 4D Bash+ AB; SECOND_WIND f2, POMMEL_STRIKE+ f4, INFERNO f6, BURNING_PACT+ f12, BLOOD_WALL+ f14, IMPERVIOUS+ f17, BRAND f18, RUPTURE+ f18, HAVOC+ f18, BREAKTHROUGH+ f18, SECOND_WIND f18, ARMAMENTS f25, BARRICADE+ f33, FLAME_BARRIER+ f35, BODY_SLAM+ f37, VICIOUS f42, BLOODLETTING+ f46. Relics: Joss Paper, Akabeko, Vajra, Horn Cleat. **Exhaust + self-damage, Barricade late.**
- **D10 `958e77192e745691`** (Big T, v0.111.0), 31. Vantom / Knowledge Demon / Test Subject + Queen. 4S 4D Bash AB; ANGER f2, CINDER f3, POMMEL_STRIKE f4, DISMANTLE+ f5, EVIL_EYE+ f6, TREMBLE f8, MOLTEN_FIST f12, SHRUG_IT_OFF+ f13, CRUELTY+ f14, STOKE+ f15, AGGRESSION+ f17, TAUNT+ f19, COLOSSUS f20, PILLAGE+ f21, COLOSSUS f24, TAUNT+ f25, BATTLE_TRANCE+ f30, FLAME_BARRIER+ f31, DOMINATE f33, MAD_SCIENCE* f38, DRUM_OF_BATTLE f39. Relics: Red Skull, Gorget, Lizard Tail. **Vulnerable (Dismantle, Molten Fist, Tremble, 2 Taunt, Cruelty, 2 Colossus, Dominate).**
- **D11 `19f9bca9bfbe513a`** (Ace Ryo, v0.111.0), 32. Kin / Kaiser Crab / Queen + Aeonglass. 3S 4D Bash AB; THUNDERCLAP f2, SHRUG_IT_OFF+ f3, HAVOC+ f7, POMMEL_STRIKE+ f9, SECOND_WIND+ f12, HEADBUTT f14, TREMBLE f14, TAUNT+ f15, DOMINATE+ f17, TRUE_GRIT+ f19, EXPECT_A_FIGHT+ f22, INFERNO+ f22, DRUM_OF_BATTLE+ f24, ASHEN_STRIKE f27, FIGHT_ME+ f31, CONFLAGRATION+ f33, 3 WISH* f34, EVIL_EYE f37, FIGHT_ME+ f45, MAD_SCIENCE* f46. Relics: Joss Paper, Anchor, Mercury Hourglass, Bag of Marbles. **Strength (Dominate, 2 Fight Me) + Vulnerable, exhaust support.**
- **D12 `965321ab5c910f1b`** (Dimensquare, v0.111.0), 29. Lagavulin Matriarch / Kaiser Crab / Test Subject + Aeonglass. 4S 2D+ Bash AB; ASHEN_STRIKE+ f2, VOLLEY+* f3, TREMBLE+ f5, PROWESS+* f6, SHRUG_IT_OFF f8, TRUE_GRIT+ f11, BARRICADE+ f12, FEEL_NO_PAIN+ f15, BODY_SLAM+ f15, IMPERVIOUS+ f17, HEADBUTT f19, ULTIMATE_DEFEND* f20, BODY_SLAM+ f23, FORGOTTEN_RITUAL+ f25, HIDDEN_GEM+* f30, ULTIMATE_DEFEND* f30, UNMOVABLE+ f33, HOWL_FROM_BEYOND f38, BATTLE_TRANCE f39, CASCADE+ f42, EVIL_EYE f45. Relics: Toasty Mittens, Oddly Smooth Stone, Anchor, Kusarigama. **Barricade/Body Slam + exhaust (FNP, True Grit+).** Barricade taken in act 1 (f12).
- **D13 `ffe07b49c0078e26`** (Nomad, v0.111.0), 38 (floors not captured). Ceremonial Beast / Kaiser Crab / Queen + Aeonglass. 4S 4D Bash AB + COLOSSUS+, BLOOD_WALL+ x2, STONE_ARMOR+, UPPERCUT+, BATTLE_TRANCE x2, RAMPAGE, CRIMSON_MANTLE, ARMAMENTS, INFLAME+ x2, UNMOVABLE+, FORGOTTEN_RITUAL, SPITE+, BODY_SLAM+ x2, CRUELTY, EXPECT_A_FIGHT, SHRUG_IT_OFF+, HEADBUTT, TREMBLE+ and six non-Ironclad cards. **Block/Body Slam + Inflame.**
- **D14 `5f120f88d0f5d480`** (Nomad, v0.111.0), 27. Waterfall Giant / Knowledge Demon / Test Subject + Queen. 3S+ 2D+ Bash AB; CONFLAGRATION+ f1, THUNDERCLAP+ f2, HEADBUTT f3, INFLAME+ f4, BATTLE_TRANCE f5, EXPECT_A_FIGHT f7, TAUNT f11, ARMAMENTS f14, BURNING_PACT f15, PRIMAL_FORCE+ f17, ONE_TWO_PUNCH+ f20 and f24, COLOSSUS f22, UNMOVABLE+ f31, MANGLE f33, ANOINTED* f36, SHRUG_IT_OFF+ f37, THUNDERCLAP+ f45, STONE_ARMOR f46. Relics: Vajra, Paper Phrog, Tungsten Rod, Kunai.
- **D15 `c343ddb1e3899e22`** (Nomad, v0.111.0), 35. Soul Fysh / Kaiser Crab / Aeonglass + Queen. 3S+ 2D+ Bash AB; DISMANTLE f2, HOWL f3, MOLTEN_FIST f4, CRUELTY f6, HAVOC+ f7, BATTLE_TRANCE+ f9, FORGOTTEN_RITUAL f12, PYRE+ f15, DEMON_FORM+ f17, COLOSSUS f19, FLAME_BARRIER f19, UNRELENTING f25, FEEL_NO_PAIN f28, HAVOC+ f28, CRIMSON_MANTLE+ f31, STOKE f33, 3 WISH* f34, BLOODLETTING f36, BURNING_PACT f40, FORGOTTEN_RITUAL f43, IMPERVIOUS f46 (+4 more). **Demon Form + Vulnerable + exhaust.**
- **D16 `c30a544daea36970`** (Nomad, v0.111.0), 34. Vantom / Kaiser Crab / Aeonglass + Test Subject. 3S 4D Bash AB; STOKE+ f2, EVIL_EYE+ f2, SETUP_STRIKE f3, INFLAME f4, BRAND f4 (both from transformed Strikes), SPITE f6, IMPERVIOUS f7, TRUE_GRIT f9, TAUNT+ f13, DEMON_FORM f17, DRUM_OF_BATTLE+ f19, FORGOTTEN_RITUAL+ f21, COLOSSUS+ f23, EXPECT_A_FIGHT+ f25, BLOOD_WALL+ f28, HIDDEN_GEM+* f31, EXPECT_A_FIGHT+ f31, CRIMSON_MANTLE+ f33, SECOND_WIND+ f35, MOLTEN_FIST+ f37, MANGLE f40, COLOSSUS+ f42, PILLAGE f46, TREMBLE+ f46 (+Nostalgia*). **Strength (Inflame, Brand, Demon Form) + power block.**
- **D17 `83525610c7f2cacb`** (Antsa, v0.111.0), 30. Lagavulin Matriarch / Kaiser Crab / Queen + Test Subject. 4S 3D Bash AB; THUNDERCLAP f1, TREMBLE f2, DRAMATIC_ENTRANCE* f3, FEEL_NO_PAIN+ f4, HEMOKINESIS f5, ARMAMENTS+ f6, ANGER f8, ASHEN_STRIKE f9, FIGHT_ME+ f12, BURNING_PACT+ f14, DOMINATE+ f17, VICIOUS+ f19, MOLTEN_FIST f20, TRUE_GRIT+ f22, SECOND_WIND f27, DARK_EMBRACE+ f33, SHRUG_IT_OFF+ f35, TREMBLE f36, BURNING_PACT+ f37, FEEL_NO_PAIN+ f43, TAUNT+ f39. **Exhaust (FNP x2, Burning Pact x2, Dark Embrace, True Grit+, Second Wind) + Dominate/Vulnerable.**
- **D18 `735e3caf46c33cd6`** (Antsa, v0.111.0), 19. Lagavulin Matriarch / Kaiser Crab / Queen + Aeonglass. 3S 2D Bash AB; BATTLE_TRANCE f5, ANGER+ f8, FLAME_BARRIER f11, CONFLAGRATION+ f17, WHIRLWIND+ f20, TAUNT f20, FEEL_NO_PAIN f22, TREMBLE+ f24, TRUE_GRIT+ f29, PYRE+ f33, COLOSSUS f38, PILLAGE f46. **Small deck (only 12 cards added in 46 floors): AoE + Vulnerable + light exhaust.**
- **D19 `cf31d11adfd5892f`** (Antsa, v0.111.0), 35. Ceremonial Beast / Kaiser Crab / Queen + Aeonglass. 4S+ 1D Bash AB; AGGRESSION+ f1, HELLRAISER+ f1, PERFECTED_STRIKE f3 and f7, TAUNT+ f4, UNRELENTING f5, BURNING_PACT+ f11, UPPERCUT+ f14, ASHEN_STRIKE+ f15, MANGLE f17, SHRUG_IT_OFF f19, FLAME_BARRIER+ f20, COLOSSUS f21, ECHO_FORM+* f22, FEEL_NO_PAIN+ f23 and f28, SCRAWL+* f23, FORGOTTEN_RITUAL f24, BLOODLETTING+ f27, CRIMSON_MANTLE+ f33, 3 WISH* f34, POMMEL_STRIKE+ f35 and f43 (+Mad Science*, 2 curses). **Hellraiser "Strike" deck + FNP.**
- **D20 `5193785a0467fad0`** (Antsa, v0.111.0), 34. Lagavulin Matriarch / Kaiser Crab / Aeonglass + Queen. 2S 2D Bash+ AB; BODY_SLAM+ f1, HEADBUTT f1, RAGE+ f2, UNRELENTING f3, RAMPAGE+ f8, FIGHT_ME+ f9, IMPERVIOUS+ f12, TRUE_GRIT+ f14 and f22, ARMAMENTS+ f15, FEED f17, 2 RELAX* f18 (Pael's Horn), HOWL_FROM_BEYOND+ f19, EXTERMINATE+* f20, TAUNT+ f21, ASHEN_STRIKE+ f22, STONE_ARMOR+ f23, EXPECT_A_FIGHT+ f24, DOMINATE+ f27, COLOSSUS+ f30, SHRUG_IT_OFF+ f31, THRASH+ f33, FORGOTTEN_RITUAL+ f35 and f42, TREMBLE+ f38, CRIMSON_MANTLE+ f40. **Strength (Dominate, Fight Me) + Body Slam/block + exhaust.**

**Losses to The Insatiable (contrast; A10 solo Ironclad):**

- **L1 `f55d12876b8279e7`** (anon, v0.111.0), 28 cards, died on turn 7 from 44 HP. 4S 4D Bash+ AB + Greed + Clumsy (3 curses); POMMEL_STRIKE f2 and f6, CRUELTY f4 and f28, TAUNT f6, ANGER+ f7, SHRUG_IT_OFF f9, JUGGLING f11, TREMBLE f12 and f22, PACTS_END f17, MOLTEN_FIST f19, COLOSSUS f20, FLAME_BARRIER+ f21, UNMOVABLE f24. **No Strength source, no energy, only Pommel for draw; Vulnerable enablers and multipliers but little base damage.**
- **L2 `61362848063b8dd6`** (kedus, v0.103.2), 25 cards, died on turn 8 from 54 HP. 1S 3D Bash AB + Injury; NOT_YET f1, CRIMSON_MANTLE+ f1, INFERNAL_BLADE+ f1, IRON_WAVE f4, PROLONG+* f6, POMMEL_STRIKE f9 and f24, BURNING_PACT f11, TREMBLE f14, SHRUG_IT_OFF f14, PACTS_END f17, EVIL_EYE f19, UPPERCUT+ f19, WHIRLWIND+ f22, CONFLAGRATION f23, ULTIMATE_STRIKE* f27, FORGOTTEN_RITUAL f30 (pre-v0.111 version), STAMPEDE f30. **No Strength or other damage scaling; every attack is flat.** The same player's win (D6) had Dominate from f2.

### 3.2 Synthesis (23 wins, 7 Insatiable losses)

Counts come from my tally of the decks above (`[data]` for the tally, but n is small; "at the act 2 boss" = cards added on floors <=32; D13 has no floors and is left out of the timing numbers). The category sets I used:

- **Strength sources:** Dominate, Inflame, Demon Form, Rupture, Brand, Fight Me.
- **Power-block engines:** Barricade, Unmovable, Stone Armor, Crimson Mantle, Feel No Pain, Juggernaut.
- **Engine pieces:** both of the above, plus Body Slam, Thrash, Ashen Strike, Inferno, Tear Asunder, Cruelty, Hellraiser and Dark Embrace.
- **Flat-damage attacks:** Anger, Pommel Strike, Twin Strike, Iron Wave, Breakthrough, Cinder, Hemokinesis, Perfected Strike, Setup Strike, Sword Boomerang, Thunderclap, Headbutt, Bludgeon, Unrelenting, Stomp, Dismantle, Uppercut, Molten Fist, Rampage, Whirlwind and Infernal Blade.

**Primary archetype** (each deck labelled once; most are hybrids):

| Archetype | Decks | Core cards seen in those decks |
|---|---|---|
| Strength + power block ("good stuff") | D2, D11, D14, D16, D20 (5) | Inflame / Dominate / Demon Form / Fight Me / Brand, plus Unmovable, Colossus, Crimson Mantle, Expect a Fight, Drum of Battle |
| Vulnerable (+ Dominate or Cruelty) | D6, D10, D15, D18, D22 (5) | Tremble, Taunt, Bash, Dismantle, Molten Fist, Cruelty, Dominate, Colossus |
| Block / Body Slam / Barricade | D1, D3, D12, D13 (4) | Unmovable, Barricade, Body Slam (1-2), Blood Wall, Stone Armor, Shrug It Off, Impervious |
| Exhaust | D9, D17, D21, D23 (4) | True Grit+ (up to 3), Feel No Pain, Burning Pact, Second Wind, Dark Embrace, Stoke, Evil Eye |
| Self-damage Strength | D4, D7, D8 (3) | Rupture (1-2), Inferno (1-2), Tear Asunder, Bloodletting, Crimson Mantle, Brand, Blood Wall |
| Draw/energy good stuff | D5 (1) | Offering, Burning Pact, Bloodletting, Pommel+ |
| Hellraiser strikes | D19 (1) | Hellraiser, 2 Perfected Strike, 2 Pommel+, FNP x2 |

**Most common non-basic cards** (winning decks containing it, of 23 / how many had it by floor 17 / by floor 32 / in the 7 Insatiable losses): Shrug It Off 15/7/11/5; Taunt 14/9/12/4; Tremble 12/6/7/3; Colossus 12/1/7/3; Armaments 12/9/11/1; **True Grit 11/6/11/0**; Forgotten Ritual 11/1/6/3; Unmovable 10/3/6/2; Battle Trance 10/3/6/3; Evil Eye 10/4/8/2; Bloodletting 10/4/8/2; Burning Pact 9/5/8/2; Body Slam, Inflame, Crimson Mantle and FNP 8 each; **Dominate 7/3/4/0**; Drum of Battle 7/1/4/0; Ashen Strike 6/3/6/0. Cards over-represented in the losses: Twin Strike, Sword Boomerang, Juggling, Whirlwind, Uppercut, Stomp, Stampede, Pact's End and Primal Force (each in 2-3 of 7 losses, rare in wins).

**Deck shape:**

- **Final size:** median 21 non-basic cards (range 12-27). With the basics that is about **29-31 cards**. Across the first 100 solo A10 Ironclad wins in the run list, final deck sizes were mostly 25-39, median about 30 `[data]`.
- **Basics kept:** final **Strikes median 4** (range 0-5) and **Defends median 3-4** (range 1-5). Winners remove about 1 Strike, sometimes 1 Defend, often via Neow or event transforms. They do not strip the starter deck; they out-grow it.
- **Card types:** attacks / skills / powers averaged **9.5 / 12.9 / 4.0**, basics included. That is more skills than attacks, and 3-7 powers.
- **Draw and energy:** a median of 2 draw cards and 2 energy cards in the final deck.
- **At the act 2 boss:** a median of 16 non-basic cards (range 9-22), so the deck is about 25 cards. It holds a median of 4 engine pieces (range 1-6), 1 Strength source (16 of 22 decks had at least one), and 1 power-block engine (16 of 22). There were only 2 flat-damage attacks (range 1-5) and 1 card from {Anger, Pommel, Taunt, Tremble}.
- **When engine pieces arrive:**
  - The first engine piece came at a median floor of 5: 14 of 22 decks had one by floor 6, and 20 of 22 by the act 1 boss.
  - By floor 17, 11 of 22 winners had 2 or more engine pieces (median 1.5), and 11 of 22 had a Strength source.
  - So act 1 is not "frontload only". Most winners pick up 1-2 scaling or block-engine cards in act 1 next to their damage.

**Frontload-heavy vs winning, at the same point** (the 7 decks that died to the Insatiable vs the 9 decks that beat it, both measured at the act 2 boss; the 9 are D1-D6 and D21-D23):

| Measure | 9 Insatiable winners (at f<=32) | 7 Insatiable losses (deck at death) |
|---|---|---|
| Non-basic cards | 12-20 (median 17) | 14-27 (median 18); size did not separate them |
| Had a Strength source, or Body Slam + Barricade/Unmovable/Stone Armor | **8 of 9** | **3 of 7** |
| Strength sources | median 1 | median 0 |
| Flat-damage attacks | median 2 | median 4 |
| Anger/Pommel/Taunt/Tremble copies | median 1 | median 2 (L1 had 6) |
| HP entering the fight | 33-104 (median ~55) | 32-62 (median 44) |
| Turns | 6-11 (median 9; one "2" looks like bad data) | 5-8 |
| Damage taken | 8-67 (median 24) | equal to their entire HP |

`[one]`-level caution: these are 16 decks. The pattern still matches the aggregate data in §2: Strength and power-block cards sit at the top of the strong-player Elo, and flat commons sit below SKIP.

---

## 4. What winning decks have that frontload-heavy decks lack (checkable rules)

The inputs are the bot's deck, the act, the floor and the reward options. Card ids are as in the brief, plus AGGRESSION, DRUM_OF_BATTLE, NOT_YET and ONE_TWO_PUNCH (all Ironclad cards).

1. **Act-2-boss scaling check.** Before the act 2 boss (floor 33), the deck must hold **at least 1 Strength source** {DOMINATE, INFLAME, DEMON_FORM, BRAND, FIGHT_ME, or RUPTURE with at least 2 self-damage cards}, **or** BODY_SLAM plus at least 1 of {BARRICADE, UNMOVABLE, STONE_ARMOR}.
   - It must also hold **at least 2 engine pieces** in total (the §3.2 set).
   - Evidence: 8 of 9 Insatiable winners met this, against 3 of 7 Insatiable losses. 20 of 22 winners had at least 2 engine pieces by the act 2 boss. `[several]` + `[data]` (small n)
   - From floor 18 on, while the check fails, add a large bonus to any card that fixes it. `[inference]`
2. **Get the first engine piece in act 1.** From floor 1, when a reward offers an engine piece next to a flat-damage common, take the engine piece. The pieces here are {DOMINATE, UNMOVABLE, COLOSSUS, CRIMSON_MANTLE, PYRE, STOKE, BARRICADE, INFLAME, DEMON_FORM, BRAND, THRASH, ASHEN_STRIKE, CRUELTY, AGGRESSION}: the §3.2 engine set plus the four premium non-engine cards COLOSSUS, PYRE, STOKE and AGGRESSION.
   - The exception: the deck has fewer than 2 non-starter damage cards and an elite is the next fight.
   - Target 1-2 engine pieces by the act 1 boss.
   - Evidence: winners' median first engine piece came on floor 5; 20 of 22 had one by floor 17, and half had 2. Act 1 pick rates at A10 are Dominate 65%, Colossus 57%, Unmovable 53% and Crimson Mantle / Pyre 47%. That is higher than Pommel (43%), Anger (16%) or Tremble (34%). `[data]`
3. **Cap flat-damage commons.**
   - Hold at most **3 flat-damage attacks** by the end of act 1 and at most **4** in total (winners: median 2, max 5, at the act 2 boss; losses: median 4).
   - Hold at most **2 copies in total** of {ANGER, POMMEL_STRIKE, TAUNT, TREMBLE}. Winners had a median of 1 at the act 2 boss and 2 at the end, and L1 died with 6.
   - Stop taking **ANGER** after the first copy, and take none after act 1. Its A10 pick rate falls 16% → 6.5% → 4.5% by act, its strong-player Elo is 302 below SKIP, and its run win rate is −2.0.
   - `[data]` + `[several]`
4. **Use SKIP.** SKIP's pick share in cx-wr50 is 28.4%, which I read as strong A10 players skipping about 28% of card rewards. That is consistent with the Untapped take rates in STRATEGY §3.6. The following cards all sit **more than 150 Elo below SKIP** for strong players: CINDER, HAVOC, HEMOKINESIS, ANGER, SETUP_STRIKE, SWORD_BOOMERANG, BREAKTHROUGH, RAMPAGE, IRON_WAVE, TWIN_STRIKE, FIGHT_ME, THUNDERCLAP, STOMP, SPITE, HOWL_FROM_BEYOND, PERFECTED_STRIKE, PRIMAL_FORCE, UNRELENTING, BLUDGEON, JUGGLING, INFERNO and WHIRLWIND.
   - When the best option in a reward is one of these, and it fills no specific need (see rule 9 for AoE), **skip**. `[data]`
   - Two cards in that list are wanted only as payoffs: BODY_SLAM (−197) belongs with rule 1's block engine, and FIGHT_ME (−254) is a Strength source only when nothing better has come.
5. **Always take these (strong-player Elo well above SKIP, top 10):** OFFERING +314, DOMINATE +275, UNMOVABLE +244, PYRE +238, COLOSSUS +216, BARRICADE +175, CRUELTY +168, CRIMSON_MANTLE +164, STOKE +159, DARK_EMBRACE +137.
   - The next group is BATTLE_TRANCE +130, BRAND +128, CASCADE +115, MANGLE +114, BURNING_PACT +103, NOT_YET +97, IMPERVIOUS +96 and DEMON_FORM +95.
   - This matches Antsa's personal A10 pick rates (40.8% win rate): Offering 84%, Dominate 72%, Colossus 70%, Unmovable 67%, Dark Embrace 63%, Burning Pact 59%. `[data]`
6. **Hold a power-block engine by the act 2 boss.** Have at least 1 of {UNMOVABLE, CRIMSON_MANTLE, STONE_ARMOR, BARRICADE, FEEL_NO_PAIN, JUGGERNAUT} (16 of 22 winners did) and at least 1 COLOSSUS or IMPERVIOUS.
   - Shrug It Off, Colossus, Unmovable and Evil Eye are among the five most common non-basic cards in winning decks. `[data]` (small n)
7. **Engine cards gain value in later acts.** Their A10 pick rates rise from act 1 to act 3: Dark Embrace 26→32%, FNP 23→27%, Forgotten Ritual 19→26%, Impervious 29→38%, Drum of Battle 15→21%, Juggernaut 16→18%. Burning Pact and Barricade stay flat at about 35-40%.
   - Flat commons fall 1.6-7× (Anger 16→4.5%, Breakthrough 21→3%, Stomp 23→4%, Pommel 43→26%).
   - The bot's act-dependent weights should move the same way (value engine more in acts 2-3, frontload less). `[data]`
8. **Deck size.**
   - Aim for about **25 cards at the act 2 boss and about 30 at the end**. Wins also had about 1-1.5 fewer cards than losses at every floor through floor 25 (deck-growth chart, all runs).
   - For the Insatiable specifically, decks under about 25 cards find their Escapes (see the combat doc). `[data]` + `[several]`
9. **AoE exception.** One AoE card (CONFLAGRATION, WHIRLWIND, BREAKTHROUGH, THUNDERCLAP) is justified. 6 of 23 winners had Conflagration, and several had Thunderclap or Whirlwind. A second AoE card is not justified unless the path demands it. `[several]`
10. **Removal is low priority.** Winners end with a median of 4 Strikes and 3-4 Defends.
    - Spend shop gold on engine cards or relics before a third removal. Remove curses first. `[data]` (small n)
    - This refines STRATEGY §3.7: at A10, removal is a tie-breaker, not a plan.
11. **Draw and energy.** By the end, have at least 2 draw sources {OFFERING, BATTLE_TRANCE, BURNING_PACT, POMMEL_STRIKE+, DARK_EMBRACE, VICIOUS, DRUM_OF_BATTLE} and at least 2 energy sources {OFFERING, BLOODLETTING, FORGOTTEN_RITUAL, PYRE, EXPECT_A_FIGHT, DRUM_OF_BATTLE}.
    - Winners had medians of 2 and 2. Take only one Battle Trance before act 3. `[data]` + `[several]`
12. **Exhaust packages are real at A10.** True Grit appears in 11 of 23 wins (all taken by floor 32) and in 0 of 7 losses. Upgrade it (upgraded, it exhausts the card you choose).
    - Once the deck has 2 or more exhaust sources, raise the value of FEEL_NO_PAIN, EVIL_EYE, DARK_EMBRACE and ASHEN_STRIKE. `[data]` (small n) + `[several]`
    - In Insatiable fights, never exhaust Frantic Escapes (combat doc).

---

## 5. The Insatiable at A10: deck composition

- **How often it kills:**
  - All ascensions, Ironclad: 68,475 fights, **15.7% fatal, 7.29 turns** on average, 55.8 damage taken. The other act 2 bosses are harder for Ironclad: Kaiser Crab is 24.0% fatal and Knowledge Demon 19.5% ([encounter-stats](https://spire-codex.com/api/runs/encounter-stats?act=2&room_type=boss)).
  - At A10, only **10 of 300** sampled solo Ironclad losses (3.3%) were to the Insatiable. In the same pages, Queen killed 18, the Kin at least 17, Kaiser Crab at least 10, and the Decimillipede elite 20.
  - So the bot's 0 wins in about 60 attempts is an outlier. Human A10 decks usually pass this fight. `[data]`
- **Winners' fight numbers** (9 A10 wins; HP before → turns / damage taken):
  - D1 53 → 11 / 8; D2 33 → 8 / 19 (used a Powdered Demise potion); D3 65 → 10 / 44; D4 58 → 7 / 40; D5 104 → 10 / 67.
  - D6 49 → 6 / 23; D21 63 → 10 / 24; D22 35 → "2" / 22 (suspect); D23 ? → 8 / 29.
  - Losses: HP before 44, 54, 62, 37, 53, 32, 35; they died on turns 7, 8, 8, 5, 6, 5, 7.
  - Median **9 turns** (6-11) and median **24 damage taken**, which is less than half the all-ascension Ironclad average.
  - The most defensive decks were the slowest and the safest. D1 took 11 turns and 8 damage; D3 took 10 turns and 44; D21 took 10 turns and 24.
  - With a median of 9 turns, the damage needed is **about 38 per turn** (341/9), not 68. Getting 9 turns means playing about 4 Frantic Escapes (5 base turns + 1 per Escape). `[data]` + `[inference]`
- **What the winning decks had at the fight** (D1-D6, D21-D23):
  - A Strength source or a Body Slam block engine (8 of 9): Inflame (D1, D2, D21), Dominate (D6), 2 Rupture + Crimson Mantle (D4), Fight Me (D5), Brand (D2, D23), or Body Slam + Unmovable / Barricade / Stone Armor (D1, D3).
  - At least 1 power-block engine or Impervious (9 of 9). Examples: Unmovable in D1, D2, D3, D5, D23; Crimson Mantle in D4, D22; Barricade in D1; Impervious x2 in D6; FNP in D21, D23.
  - 12-20 non-basic cards (about 21-29 in total). This did not separate winners from losers.
  - At least one draw or energy card in 8 of 9 (D3 had none).
- **What the losing decks had:**
  - Mostly flat attacks: 4 of 7 had no Strength source.
  - Multipliers without base damage: Cruelty in L1, L6, L7. Cruelty was in 3 of 7 losses and only 4 of 22 winners at the same point.
  - Big or messy decks: L3 was 38 cards with 8 non-Ironclad cards; L5 still had 6 Strikes; L1 had 3 curses.
  - Low HP: median 44 entering, and 3 of 7 were under 40.
  - Deaths on turn 5-6 (L4, L5, L6) match a Sandpit timeout or near-timeout, where the Escapes were never played. `[inference]`: the run file does not say whether the player was eaten or killed.
- **Deck-composition takeaways for this fight:**
  1. By floor 32 the deck needs rule 1 of §4, plus at least 2 block cards that are not basic Defends.
  2. The deck should be about 25 cards or fewer.
  3. Prefer Strength (Inflame, Dominate, Rupture + self-damage, Demon Form) over flat damage. The fight is long (9 turns), so the P1/P4 powers pay off, as the combat doc's turn plan also notes.
  4. A block engine (Unmovable / Barricade / Crimson Mantle / Stone Armor) lets the deck spend energy on Escapes. Each copy costs 1 the first time and 1 more each time it is replayed. That is how the slow block decks won in 10-11 turns while taking under 45 damage.
  5. Enter with 55+ HP if the path allows it. Winners' median was about 55, losers' 44. `[data]` (small n)

---

## 6. Gaps and caveats

- **No per-act win deltas at A10 anywhere reachable.** Spire Codex has per-act *pick* rates only (the `act` filter on `/api/runs/scores` applies to relics only). Untapped's per-act deltas (A7+) are in STRATEGY §3.2 / §9c.8. `winDelta` in the JSON is therefore null throughout. I added `winDeltaRun` (whole-run, A10, Ironclad) and `wr50.eloVsSkip` as the usable signals.
- **Pick% by act is all characters** (Ironclad cards are offered mostly to Ironclad players, but multiplayer and transforms add others). The win rates and Elo are Ironclad-only.
- **Spire Codex's card list and texts are main branch** (e.g. Demon Form still +2 there, while beta v0.111 gives +3). Its run data mixes patches v0.98-v0.111.
- **Survivorship:** late-picked cards (Barricade, Juggling, Havoc, Tank, Dark Embrace) have inflated WR. The "copies in deck vs win rate" charts (e.g. Pommel 1→5 copies: 39→73%) are pure survivorship and were not used for caps.
- **Deck sample:** 23 wins and 7 losses, read by an LLM summariser from JSON. I cross-checked the floor numbers, but a few look off: D22's Insatiable "2 turns" and D23's "HP before 306" are probably garbled. D13's floors are missing. Nomad (10/60) is not a strong player; Antsa (42/103) is.
- **Jorbs' sheet** has run notes only, no decks. It adds qualitative support, below.
- **Unreachable / not useful:** Untapped.gg (403; used only via the sister doc), Reddit (blocked for the fetch tool), YouTube (descriptions don't render), MetaBot (numbers look templated per tier, no Ironclad or A10 filter visible), sts2front card analysis (cites no data, and lists Heavy Blade, which is StS1 contamination), Steam "5 streak" / "I DID IT" threads (no deck contents).

### 6.1 Jorbs' sheet (A10 Ironclad win notes, v0.98-v0.107, Mar-Jul 2026) `[one]`

Of his A10 Ironclad win notes, the themes recur in about this order:

- Vulnerable → Strength (Dominate or Break, Molten Fist, Mangle) in about 9 wins.
- Inferno / Rupture self-damage in about 7 ("Inferno won Act 2").
- Unmovable / Barricade / Stone Armor block in about 8.
- Ashen Strike / FNP exhaust in about 6.
- Draw loops (Pommels + Forgotten Ritual, Flash + Finesse) in about 5.

His loss notes include "took bad cards with low damage", "no scaling stuff" (vs Lagavulin) and "a deck that was trying to find a Stampede" (lost to Knowledge Demon). ([gviz CSV](https://docs.google.com/spreadsheets/d/197RwIxLuzSLubsWr6OLfhdHPRFgIWRnQyTp-RuZUveU/gviz/tq?tqx=out:csv))

### 6.2 Steam threads `[several]`, low detail

- [Help required for Ironclad A10](https://steamcommunity.com/app/2868840/discussions/0/798968342700468938/) (May 2026). Replies say a deck needs a scaling power (Demon Form, Rampage or Barricade), draw and energy. The winner used draw/energy + exhaust/self-damage and treated HP as a resource.
- [a10 ironclad - how do you approach act 1?](https://steamcommunity.com/app/2868840/discussions/0/839501596191705877/) (May 2026). Take block (Blood Wall, Shrug, True Grit, FNP) in act 1 because the common pool lacks it. Scale with Rupture or Brand plus multi-hits.
- [note.com koni_pu3](https://note.com/koni_pu3/n/n9e83b58d795a?hl=en-US) (2026-04-10, Japanese). The A10 clear came with a block build after self-damage attempts failed. No list given.
