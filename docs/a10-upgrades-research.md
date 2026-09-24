# A10 upgrade (smith) and removal research: winning Ironclad runs (StS2)

Compiled 2026-09-24 for spire-jev (beta v0.111.0). Status: complete (first pass).

Scope: which cards winners upgrade and when, rest-site smith vs heal, and removal/transform habits. Card picks are in `a10-decks-research.md`. Guide-based upgrade notes (Untapped A7+ act 1 smith rates, cost-reduction list) are in `STRATEGY-research.md` §3.8 and are not repeated here.

Tags: `[data]` counts from run files or aggregate stats; `[several]` two or more independent StS2 sources agree; `[one]` one source; `[inference]` derived by me.

---

## 1. Sources

| Key | URL | Version | What I could read |
|---|---|---|---|
| cx-list | https://spire-codex.com/api/runs/list?character=ironclad&win=true&ascension=10&players=1&limit=100&page=1 | mixed | Page 1 of **10,000** solo A10 Ironclad wins (hash, uploader, build). The `winrate_min` filter timed out. |
| cx-run | `https://spire-codex.com/api/runs/shared/<hash>` | per run (`build_id`) | `map_point_history`: per floor `rest_site_choices`, `upgraded_cards`, `cards_removed`, `cards_transformed`, `gold_spent`, `current_hp/max_hp`, `hp_healed`. **66 winning runs read** (list in App. A). |
| cx-user | https://spire-codex.com/api/runs/stats?username=weird&character=ironclad&ascension=10 | mixed | "weird": **23/55 A10 Ironclad wins (41.8%)**. Antsa: 42/103 (40.8%, from the decks doc). These two are the strong-player subsample. |
| cx-smith | https://spire-codex.com/api/charts/smiths-vs-winrate | all versions | Win % by number of smiths (1.82M runs, **all characters and ascensions**; no filters accepted). |
| cx-metrics | https://spire-codex.com/api/runs/metrics/cards?bracket=a10&character=IRONCLAD, https://spire-codex.com/openapi.json | mixed | **No upgrade/removal aggregate exists.** Every metrics row has `upgraded:false`, and the OpenAPI has no smith, removal or transform endpoint. So all upgrade numbers here are my tallies. |
| decks | `a10-decks-research.md` §3.1 (23 A10 wins D1-D23) | 21 × v0.111, 1 × v0.110.1, 1 × v0.103.2 | Final decks with "+" markers, used for "share of held copies that ended upgraded" (all sources: rest, events, relics, pre-upgraded rewards). |
| patch | https://slaythetierlist.com/patch-notes, https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:V0.107.1_-_Major_Update_2, `.../V0.106.0_-_Beta_Patch`, STRATEGY §1.2 | v0.100-v0.111 | Upgrade-relevant card changes (§2.4). Card removal costs **100 gold +50 per earlier removal since v0.102.0**. |
| jsheet | Jorbs' sheet (gviz CSV; see decks doc) | v0.98-v0.107 | Notes only, no upgrade column. Relevant notes: "Pocketwatch + Armaments+ early", "Stone Armor+ Clone", "White Star + Tent ... upgraded Crimson Mantles". `[one]` |

Unreachable: bossdown.com upgrade guide (DNS failure), mobalytics Ironclad guide (403), Untapped v0.106 patch notes (403). Generic guides (gamestrategyhub) say only "upgrade cost reducers and energy first", with no data.

**Extraction method and error.** WebFetch summarises the JSON with a small model. My first pass used a filtered prompt, and it invented some rows (checked against a verbatim dump of one run, e042). So I re-read **38 runs with an every-floor table**, which was consistent floor by floor and is the quality used for the HP thresholds. The other 28 are filtered-quality (marked `f` in App. A). Expect ±1 smith or heal per filtered run. Floors are 1-49: act 1 ≈ f1-17, act 2 ≈ f18-33, act 3 ≈ f34-49 (each act starts at an Ancient).

**Version split.** **51 runs are v0.107.1 or later**: 5 × v0.107.1, 2 × v0.108, 4 × v0.109, 8 × v0.110.1, 32 × v0.111. **15 are older**: v0.99.1-v0.106.1. All the rules in §5 rest on the v0.107.1+ sample. The older sample is used only for contrast. It has no v0.107.0 runs and only 15 runs, 4 of them partial.

---

## 2. Upgrade frequency

### 2.1 Table (v0.107.1+ sample, 49 usable runs, about 300 smiths)

Columns:
- **Runs** = runs that smithed the card at least once (of 49).
- **Smiths** = total smiths, which is higher when several copies were upgraded.
- **A1/A2/A3** = the act of each run's first smith of that card.
- **1st** = number of runs where it was the run's first smith.
- **Held→+** = upgraded copies / copies held in the 23 final decks (the decks doc).
- **Old** = runs of 15 pre-v0.107.1 that smithed it.
- **Δv** = the card's upgrade changed between versions (§2.4).

| Card | Runs | Smiths | A1/A2/A3 | 1st | Held→+ | Old | Δv |
|---|---|---|---|---|---|---|---|
| TRUE_GRIT | **19** | 24 | 12/5/2 | **6** | 12/14 (86%) | 4 | |
| UNMOVABLE | **14** | 16 | 1/7/6 | 0 | 10/11 (91%) | 1 | |
| POMMEL_STRIKE | 13 | 14 | 5/6/2 | 2 | 7/8 (88%) | 3 | |
| BASH | 11 | 11 | 7/3/1 | 4 | ~4 of 23 decks | 2 | |
| UPPERCUT | 11 | 11 | 7/3/1 | 2 | 4/5 | 1 | |
| TAUNT | 11 | 11 | **9**/1/1 | 2 | 9/15 (60%) | 2 | v0.109 |
| OFFERING | 8 | 9 | 2/3/3 | 1 | 1/2 | 3 | |
| BURNING_PACT | 8 | 10 | 0/6/2 | 0 | 6/10 (60%) | 0 | |
| VICIOUS | 8 | 9 | 0/4/4 | 0 | 3/7 | 3 | |
| BODY_SLAM | 8 | 8 | **6**/2/0 | 1 | 9/10 (90%) | 1 | |
| DARK_EMBRACE | 8 | 8 | 0/2/6 | 0 | 2/2 | 1 | |
| CRIMSON_MANTLE | 6 | 6 | 0/2/4 | 0 | 5/8 | 3 | v0.108 |
| PYRE | 6 | 6 | 1/2/3 | 0 | 4/4 | 3 | |
| BATTLE_TRANCE | 6 | 6 | 1/1/4 | 0 | **2/12 (17%)** | 3 | |
| WHIRLWIND | 6 | 7 | 3/2/1 | 1 | 2/3 | 2 | |
| RAGE | 6 | 6 | 2/2/2 | 1 | 1/1 | 0 | |
| ARMAMENTS | 5 | 5 | **5**/0/0 | **4** | 9/13 (69%; unupgraded copies were late adds) | 2 | |
| DOMINATE | 5 | 5 | 1/3/1 | 0 | 4/8 (50%) | 1 | v0.100 |
| FEEL_NO_PAIN | 5 | 8 | 0/5/0 | 0 | 6/11 (55%) | 3 | |
| STOKE | 5 | 5 | 2/3/0 | 0 | 2/4 | 2 | |
| BLOODLETTING | 5 | 5 | 2/2/1 | 0 | 8/12 | **6** | v0.109 rarity |
| CRUELTY | 5 | 5 | 2/0/3 | 1 | 2/6 | 1 | |
| CONFLAGRATION | 5 | 5 | 1/3/1 | 0 | 4/6 | 0 | v0.107.1 |
| HAVOC | 4 | 6 | 3/1/0 | 2 | 4/4 | 1 | |
| FIGHT_ME | 4 | 4 | 4/0/0 | 3 | 6/7 (86%) | 2 | |
| SHRUG_IT_OFF | 4 | 5 | 1/1/2 | 1 | 9/16 (mostly event/relic upgrades) | 4 | |
| RUPTURE / STONE_ARMOR | 3 / 3 | 4 / 4 | mixed | 0 | 4/6 / 5/7 | 1 / 0 | |
| FORGOTTEN_RITUAL | 3 | 3 | 0/0/3 | 0 | 7/13 | 0 | v0.111 |
| INFLAME | 3 | 3 | 1/1/1 | 0 | 6/9 (67%) | 1 | |
| BARRICADE | 2 | 2 | 0/1/1 | 0 | **4/4** | 1 | |
| DEMON_FORM | 1 | 1 | 0/1/0 | 0 | 1/2 | 0 | v0.109 |
| BLOOD_WALL | 1 | 3 | 1/0/0 | 0 | 6/8 | 1 | |
| COLOSSUS | 1 | 1 | 0/1/0 | 0 | **5/14 (36%)** | 0 | v0.108 |
| EVIL_EYE / IMPERVIOUS / DRUM_OF_BATTLE / TREMBLE | 0 / 0 / 0 / 2 | | | 0 | 7/11, 3/7, 3/7, 8/15 | 2/0/1/0 | DRUM v0.107.1 |
| STRIKE_IRONCLAD / DEFEND_IRONCLAD | **0 / 1** | of about 300 smiths | | 0 | | 0 / 0 | |

Other cards smithed 1-3 times, mostly as the only target at an act 1 rest:
- Flat commons: BLUDGEON 3, STAMPEDE 3 (cost 2→1), TWIN_STRIKE 2, PERFECTED_STRIKE 2, ANGER 2, DISMANTLE 2, PRIMAL_FORCE 2, BULLY 2, IRON_WAVE 1, UNRELENTING 1.
- Engine or Ancient cards: AGGRESSION 2, FIEND_FIRE 2, SECOND_WIND 3, BREAK (Orobas's Bash transform) 3 of the 4 runs that had it.

`[data]`

### 2.2 How the order works

- **Act 1** (2.6 smiths per run): the first smith goes to whatever mechanical card is already in the deck:
  - True Grit (6 runs), Armaments (4), Bash (4), Fight Me (3), then Havoc, Uppercut, Pommel, Stampede, Primal Force, Flame Barrier, Taunt and Bludgeon (2 each).
  - When the deck has no engine card yet, winners smith a **cheap act 1 attack or Taunt** instead of skipping: 9 of 11 Taunt smiths and 7 of 11 Uppercut and Bash smiths were in act 1.
  - They do not smith Strike or Defend.
- **Act 2**: the engine arrives and gets smithed promptly:
  - Unmovable 7, Burning Pact 6, Feel No Pain 5, Vicious 4, Dominate 3, Stoke 3.
  - Example: run 1963 added Unmovable on f22 and smithed it at the next rest (f27).
- **Act 3**: late engines and second copies. Dark Embrace 6, Crimson Mantle 4, Battle Trance 4, Forgotten Ritual 3, Unmovable (another 6).
- **Copies**: winners upgrade every copy of a key card:
  - True Grit ×3 in 2 runs, and ×2 in one more.
  - Havoc ×3, Feel No Pain ×2-3, Unmovable ×2, Whirlwind ×2, Offering ×2, Burning Pact ×2.
- **Strong players:**
  - weird: 15 runs; first smith was True Grit in 5.
  - Antsa: 8 runs; first smith was Armaments in 3 of 8. Every time Antsa held Armaments on floors 1-7, it was the first smith.
  - `[data]`

### 2.3 Ranked "upgrade this first when held" list

This list merges the §2.1 counts with the mechanical-upgrade rule from STRATEGY §3.8. **Pick the highest-ranked held card that is not yet upgraded.**

1. **ARMAMENTS**, acts 1-2. Upgraded, it upgrades your whole hand each fight. It was the first smith in 4/4 runs where it was held early. `[data]`
2. **TRUE_GRIT**, every copy. Upgraded, it exhausts the card you choose. It is the most-smithed card: 19/49 runs, 12 in act 1, and 86% of held copies ended upgraded. `[data]`
3. **BARRICADE** (3→2) and **BODY_SLAM** (1→0), in block decks. Barricade ended upgraded in 4/4 decks and Body Slam in 90%; Body Slam's smiths were 6/8 in act 1. `[data]`
4. **UNMOVABLE** (2→1), at the first rest after you take it. It ended upgraded in 91% of held copies; 14 runs smithed it. `[data]`
5. Cost reducers and energy cards:
   - The group is **DARK_EMBRACE** (2→1), **HAVOC** (1→0), **STAMPEDE** (2→1), **PYRE**, **OFFERING**, **STOKE** and **CASCADE**.
   - Held copies ended upgraded in 100% of cases for Pyre, Havoc and Dark Embrace, and 50% for Offering and Stoke. `[data]` + `[several]` (Untapped rates)
6. **BURNING_PACT**, **POMMEL_STRIKE** and **VICIOUS** (draw).
   - Pommel ended upgraded in 88% of held copies; it is often smithed in act 1-2.
   - Burning Pact and Vicious are smithed in acts 2-3. `[data]`
7. **FIGHT_ME** (86%), **UPPERCUT** (2 Weak and 2 Vulnerable), **DOMINATE**, **RUPTURE** (2 Strength per HP loss), **CRIMSON_MANTLE**, **FEEL_NO_PAIN**, **INFLAME** and **STONE_ARMOR**. These are mid-priority scaling cards. `[data]`
8. **DEMON_FORM**. There is only one run (smithed at the first rest after it was taken). Since v0.109 the upgrade is 3→4 Strength per turn. `[one]`
9. **TAUNT**, then **BASH**. These are act 1 fillers when nothing above is held. Bash was often the f16 pre-boss smith in decks without an engine card. `[data]`
10. **Low priority** (smith only when nothing else is left):
    - BATTLE_TRANCE: 17% of held copies ended upgraded.
    - COLOSSUS: 36%.
    - SHRUG_IT_OFF, TREMBLE, EVIL_EYE (0 smiths), IMPERVIOUS (0), HEADBUTT (0) and flat commons.
    - `[data]`
11. **Never**: STRIKE_IRONCLAD (0 of about 300 smiths) and DEFEND_IRONCLAD (1). `[data]`

### 2.4 Upgrade-relevant version changes (why pre-v0.107.1 advice can be stale)

- **CONFLAGRATION** was reworked in v0.107.1 to 2 damage to ALL enemies 4 (5) times.
- **DRUM_OF_BATTLE** was reworked in v0.107.1 into a 1-cost Skill: draw 2, and 2 (3) energy when exhausted.
- **EXPECT_A_FIGHT**:
  - v0.100: cost 2 (1).
  - v0.109: its energy restriction was removed.
  - v0.111: rebuilt as 3 cost, 15 (16) Block + 5 (8) Block per Strength. The upgrade is now mostly the per-Strength term.
- **FORGOTTEN_RITUAL** (v0.111): 1 energy for 3 (4) energy, Exhaust. Every smith of it in the sample is from v0.110.1-v0.111, all in act 3.
- **DEMON_FORM** (v0.109): 3 (4) Strength per turn, was 2 (3).
- **CRIMSON_MANTLE** (v0.108): 7 (10), was 8 (10), so the upgrade is now worth +3.
- **COLOSSUS** (v0.108): 4 (7).
- **TAUNT** (v0.109): 6 (7) Block, and now Common.
- **MANGLE** (v0.110): 20 (26).
- **UNRELENTING** (v0.106): 14 (20).
- **DOMINATE** (v0.100): 1 (2) Vulnerable.
- **SPITE** (v0.100): cost 0, 2 (3) times.
- **BLOODLETTING** became Uncommon in v0.109. The older sample smithed it far more (6/15 runs vs 5/49), probably because it was offered more.
- Sources: patch, STRATEGY §1.2.

**Old vs new smith targets** (15 vs 49 runs):
- Older runs smithed Bloodletting (40% vs 10%), Perfected Strike (20% vs 4%) and Shrug It Off (27% vs 8%) more.
- They smithed Unmovable (7% vs 29%), True Grit (27% vs 39%) and Uppercut (7% vs 22%) less.
- Any of these may be player mix and not patch effects: 6 of the 15 older runs are weird's, and 4 are Dayton_360's, a player who heals a lot.
- **Treat old-sample differences as possibly stale.** `[data]`, small n

---

## 3. Rest site behaviour

### 3.1 Smith vs heal by act (v0.107.1+, 43 runs with a clean act split)

| Act | Smiths | Heals | Smith share | Runs with 0 heals in the act |
|---|---|---|---|---|
| 1 | 111 | 23 | **83%** | 23 of 43 |
| 2 | 102 | 23 | **82%** | |
| 3 | 82 | 24 | **77%** | |
| Total | 295 | 70 | **81%** (about 6.9 smiths and 1.6 heals per run; range 2-11 smiths) | |

- By player: weird 86 smiths / 21 heals (80%); Antsa 41 / 13 (76%). Big T (2 / 3), e418 (3 / 6) and Nomad (6 / 4) healed far more and still won.
- Older sample (10 complete runs): 65 / 24 (73%). The gap comes from the players, not the patch: weird's 3 older runs were 24 / 2 (92%), while Dayton_360 and kedus rested a lot.
- Jorbs' all-run act shares (61/55/42% smith, STRATEGY §7) are lower. Those are all his runs at all ascensions, losses included.
- The smiths-vs-winrate chart (all characters and ascensions) shows win rate rising from 1.9% at 0 smiths to 52% at 7 and 58% at 10, then 84% in the top "15" bucket. This is confounded: longer runs visit more rest sites. `[data]`
- Relic options:
  - LIFT (Girya): weird took it 3 times in one run, and another run took it once.
  - HATCH (Byrdonis Egg): 1 run. KINDLE: 1 run.
  - With Miniature Tent, Antsa smithed and healed at every rest (2 runs). `[data]`

### 3.2 HP thresholds, from the every-floor tables (HP shown is HP on arrival)

- **Act 1 pre-boss rest** (f15/16): **25 smiths, 7 heals**.
  - All 7 heals were at **≤39% HP** (13-32 of about 80).
  - Smiths went as low as 34-36% (27/80, 24/67); most were at 40-85%.
  - The earlier act 1 rests follow the same pattern. Heals were at 25-46% (Antsa healed at 46% right before an elite).
  - weird smithed at 20-25% HP (f11 and f13, 16-20/80) when the next nodes were fights he expected to pass.
- **Act 2 pre-boss rest** (about f32): the heals were mostly at **<50%** (12-35/80, 18/80, 23/80, 24/97).
  - There were two exceptions: 47/80 (59%) and 55/100.
  - Smiths were at 48-100%; the lowest were 38/80, 42/80 and 53/101. **The threshold is about 50%.** It is higher than in act 1: the act 2 boss is harder, and the act 3 Ancient heals only 80% of missing HP at A2+.
- **Act 3 last rest before the double boss** (f46/47): a near-perfect split, **14 smiths all at ≥84% HP** (lowest 67/80, 70/80, 69/69) and **13 heals all at ≤84%** (39/71 up to 73/87, 77/99). So **heal unless HP ≥ ~85%**. The other act 3 rests (f40-44) were mostly smiths at high HP.
- `[data]` (38 every-floor runs)

---

## 4. Removal and transform

- **Count**: winners removed a **median of 2 cards per run** (mean 1.96; range 0-7; 92 removals in 47 v0.107.1+ runs).
  - 3 runs removed nothing.
  - Older sample: 2.1 per run, so no version difference.
  - `[data]`
- **What** (92 removals):

  | Removed | Count | Share |
  |---|---|---|
  | STRIKE_IRONCLAD | 59 | **64%** |
  | Curses (Debt, Decay, Injury, Regret, Doubt, Clumsy, Normality) | 15 | 16% |
  | DEFEND_IRONCLAD | 12 | 13% |
  | BASH | 3 | 3% |
  | Other (Setup Strike ×2, Dismantle) | 3 | 3% |

  - 68% of runs removed at least one Strike; only 19% removed a Defend.
  - weird removed only Strikes and curses (plus Bash once). Antsa removed Defends in 4 of 8 runs, all of them decks with a block engine or Strike payoffs.
  - `[data]`
- **Curses go at once.** Every curse in the sample was removed at the next shop that had spare gold: Neow's Bones Debt on f6, Decay on f4/f37/f39/f41, Regret on f38/f45. `[data]`
- **How**:
  - Shops: about 68% of removals. Cost 100, then 150, then 200 (seen as 100, 148-151, 202 with discounts).
  - Events: about 25% (for example events that remove 2 Strikes, or Thieving Hopper-type losses).
  - Ancient or Neow: about 8%. Precarious Shears removes 2 cards for 16 HP. Vakuu removed a curse plus 2 Strikes in one run.
  - Neow transforms of basics: 8 of 51 runs, usually Strike + Defend with Leafy Poultice (-12 max HP) or a single Strike.
  - `[data]`
- **When**: the first shop removal came at a **median of about f20 (the first act 2 shop)**. Act 1 shop removals (f4-f15) happened in 6 runs, usually a curse or with gold to spare. `[data]`
- **Gold**:
  - In 12 runs with complete shop lines, winners spent a median of about 800-850 gold in shops per run. Removals took about a fifth of that (about 1.3 shop removals × about 130).
  - The rest went to relics and 1-3 cards. The big spends (400-800 in one visit) were relics.
  - `[data]`, n = 12
- **Basics kept**: final decks still hold 3-4 Strikes (decks doc). Winners do 1-2 Strike removals and then stop (4 in one run). They out-grow the starter deck rather than strip it. `[several]` (decks doc agrees)

---

## 5. Checkable rules for the bot

1. **Smith by default.** Choose SMITH at every rest unless an HP rule (2-4) says HEAL.
   - Winners smith at 81% of rests (83/82/77% by act) and make about 7 smiths per run. `[data]`
2. **Act 1 heal rule.** HEAL only if HP < 35% of max. Also HEAL at 35-40% when the next node is an elite or the boss.
   - All 7 act 1 pre-boss heals were at ≤39%, and winners smithed at 34% and above. `[data]`
3. **Act 2 pre-boss heal rule.** At the last rest before the act 2 boss, HEAL if HP < 50% of max. Otherwise SMITH. `[data]`
4. **Act 3 final rest.** At the last rest before the double boss, HEAL unless HP ≥ 85% of max. The split was 14 smiths at ≥84% and 13 heals at ≤84%.
   - This replaces any "never rest above 80%" rule. `[data]`
5. **Target order.** Use §2.3: ARMAMENTS > TRUE_GRIT > BARRICADE = BODY_SLAM > UNMOVABLE > {DARK_EMBRACE, HAVOC, STAMPEDE, PYRE, OFFERING, STOKE, CASCADE} > {BURNING_PACT, POMMEL_STRIKE, VICIOUS} > {FIGHT_ME, UPPERCUT, DOMINATE, RUPTURE, CRIMSON_MANTLE, FEEL_NO_PAIN, INFLAME, STONE_ARMOR, DEMON_FORM} > TAUNT > BASH > the rest. `[data]` + `[several]`
6. **Never smith** STRIKE_IRONCLAD or DEFEND_IRONCLAD while any other un-upgraded card exists: 1 of about 300 smiths. `[data]`
7. **Deprioritise** BATTLE_TRANCE (17% of held copies ended upgraded), COLOSSUS (36%), SHRUG_IT_OFF, EVIL_EYE, IMPERVIOUS, TREMBLE and HEADBUTT. Smith them only when nothing from rule 5 is left. `[data]`
8. **Smith new key cards at the next rest.** The key cards are UNMOVABLE, BARRICADE, BODY_SLAM, TRUE_GRIT and DARK_EMBRACE. Winners smithed them at the first or second rest after taking them. `[several]` (runs 1963, 22a6, 71c0 and others)
9. **Upgrade every copy.** For a second or third True Grit, Unmovable, Havoc, Feel No Pain or Burning Pact, the copy keeps its rule 5 rank. Two runs upgraded 3 of 3 True Grits. `[data]`
10. **Removal target: 2 per run.**
    - Always remove a curse first, at the next affordable shop.
    - Then remove STRIKE_IRONCLAD (64% of all removals), up to 2 Strikes in total. After that, spend on cards and relics.
    - `[data]`
11. **Defend instead of Strike** only if the deck has at least 2 non-basic block cards (e.g. Unmovable, Barricade, Stone Armor, Crimson Mantle) *and* Strength or Strike payoffs. This is Antsa's pattern. `[one]` + `[inference]`
12. **Timing.** Plan the first paid removal for the first act 2 shop (median f20).
    - In act 1, remove at a shop only a curse, or when you can still afford a planned card or relic.
    - Removal is about a fifth of shop spending. `[data]`
13. **Accept free Strike removal or transform.** This covers Neow transform options, Precarious Shears (when HP allows) and events that remove Strikes: 8 Neow transforms and about 23 non-shop removals across 51 wins. `[data]`
14. **Ancient-card upgrades.** If Orobas turns Bash into BREAK, smith BREAK at the first act 2 rest (3 of 4 runs did). `[data]`, small n
15. **Relic rest options.** With Miniature Tent, always take both. With Girya, LIFT only while HP is safe and no rule 5 target from the top four tiers is un-upgraded. `[one]` (weird, 1 run) + `[inference]`

**Single most actionable rule:** smith, don't heal, unless an HP rule fires (act 1 <35-40%, act 2 pre-boss <50%, act 3 final rest <85%). Always point the smith at a mechanical upgrade (Armaments / True Grit / cost reducers), never at a basic.

---

## A. Run log

`f` = filtered extraction (±1 row error). Everything else is an every-floor table or verbatim. S = smiths, H = heals. rm = removed (shop unless noted).

**v0.107.1+**
- 1963a346e33f63ad (777, .111): A1 TAUNT, POMMEL_STRIKE, BLOOD_WALL | A2 BARRICADE, UNMOVABLE, BODY_SLAM, BLOOD_WALL | A3 CRIMSON_MANTLE, BLOOD_WALL. 9S/0H. rm CLUMSY. Neow tf S→THRASH, D→FIEND_FIRE.
- fa5d183df9a2c556 (Antsa, .111): ARMAMENTS, H(25/80), UNMOVABLE | BURNING_PACT, OFFERING, POMMEL_STRIKE | SHOCKWAVE, H. 6S/2H. rm DEBT, STRIKE ×2.
- 6c51e2ce3b5b09b5 f (anon, .111): PRIMAL_FORCE, TAUNT, OFFERING, BODY_SLAM | DARK_EMBRACE, SHOCKWAVE, HAVOC | TRUE_GRIT, FORGOTTEN_RITUAL, TREMBLE. 10S. rm 4 STRIKE at an Ancient, INJURY, STRIKE, BASH.
- 41c3de7442df4e18 (weird, .111): UNRELENTING, H(15/80) | H, H(12/80) | VICIOUS, TRUE_GRIT, BURNING_PACT. 4S/3H. rm STRIKE ×2.
- 4fce7c7f947bcb88 (weird, .111): HATCH, H, TRUE_GRIT | BLOODLETTING, H, COLOSSUS | RAGE, FORGOTTEN_RITUAL, POMMEL_STRIKE. 6S/2H. rm STRIKE ×2 (Neow Shears), ×2 event, ×1.
- 2b4242be628a6df2 f (weird, .111): FIGHT_ME, PYRE, TRUE_GRIT, IRON_WAVE (29/80) | BASH, H, UNMOVABLE | UNMOVABLE, DARK_EMBRACE, H. 8S/2H. rm DECAY.
- 377f2a519182359b (weird, .110.1): SHRUG_IT_OFF, STOKE, PERFECTED_STRIKE | H, DOMINATE | BURNING_PACT, OFFERING, BURNING_PACT, H(65/99). 7S/2H. rm STRIKE.
- f0477febc1bcb079 (weird, .110.1): TWIN_STRIKE, INFLAME, WHIRLWIND | STOKE, BLOODLETTING, H(14/80) | THRASH. 6S/1H. rm STRIKE ×2.
- b0c2c014ee48b0db (weird, .110.1): BODY_SLAM, TAUNT(20/80), UPPERCUT(16/80), H(16/80) | DOMINATE, POMMEL_STRIKE, TRUE_GRIT | OFFERING, DARK_EMBRACE. 8S/1H.
- 97d0c5a722756ecf (weird, .110.1): TRUE_GRIT, TREMBLE, CRUELTY | DOMINATE, H, H(20/80) | UPPERCUT, TAUNT, BATTLE_TRANCE. 7S/2H. rm BASH, STRIKE.
- 71c0cd62d27801da (weird, .110.1): TRUE_GRIT, BODY_SLAM, BASH | STOKE, OFFERING, ULTIMATE_DEFEND, H | DARK_EMBRACE, UNMOVABLE. 7S/1H. rm STRIKE ×2. Event tf 2 DEFEND.
- a7e9638a2498213b f (weird, .110.1; partial): TRUE_GRIT | CRIMSON_MANTLE, SECOND_WIND. rm STRIKE ×2.
- 390d6a938712501a (weird, .109): ARMAMENTS, BODY_SLAM, EQUILIBRIUM | RUPTURE, H | CRIMSON_MANTLE, RUPTURE. 5S/1H. rm STRIKE ×2.
- 582147e46919772f (weird, .109): FLAME_BARRIER, CONFLAGRATION, PERFECTED_STRIKE | BREAK, UNMOVABLE | H(73/87). 5S/1H. rm STRIKE, DOUBT (event).
- fb9c35965e455e68 f (weird, .109): TRUE_GRIT, BODY_SLAM, H, SHOCKWAVE | BATTLE_TRANCE, EQUILIBRIUM, CRIMSON_MANTLE | BARRICADE, H. 7S/2H. rm NORMALITY + STRIKE ×2 (Vakuu), DECAY.
- 1da1d8ecc314a2e9 (weird, .109): BLUDGEON, TAUNT, WHIRLWIND | BRIGHTEST_FLAME, PYRE, UPPERCUT | BATTLE_TRANCE, UNMOVABLE. 8S/0H. rm DEBT, REGRET.
- 09c67818dd4483b6 f (weird, .108; Girya, partial): FIGHT_ME, LIFT, LIFT | LIFT, POMMEL_STRIKE, EQUILIBRIUM. rm STRIKE.
- 4cf6fa470cf9aede (weird, .108): BLUDGEON, H, BATTLE_TRANCE, CASCADE | CONFLAGRATION, EQUILIBRIUM, H, RAGE | H(77/96). 6S/3H. rm DECAY.
- 83525610c7f2cacb (Antsa, .111; Tent): ARMAMENTS, H(10/80), FIGHT_ME | TRUE_GRIT, FEEL_NO_PAIN, BURNING_PACT | DARK_EMBRACE, BURNING_PACT, DOMINATE. rm DEFEND (event).
- 735e3caf46c33cd6 (Antsa, .111): H(25/81), WHIRLWIND, ANGER | CONFLAGRATION, TRUE_GRIT | PYRE, H(48/106). 5S/2H. rm STRIKE + DEFEND (Neow), STRIKE (event), DEFEND.
- cf31d11adfd5892f (Antsa, .111): H(31/68), TAUNT, UPPERCUT | BURNING_PACT, AGGRESSION | ASHEN_STRIKE, POMMEL_STRIKE, H(39/71). 6S/2H. rm DEFEND ×2. Neow tf S, D.
- 5193785a0467fad0 (Antsa, .111): RAGE, BODY_SLAM, H(26/74) | STONE_ARMOR, BASH, H(55/100) | CRIMSON_MANTLE, H. 5S/3H. rm STRIKE, DEFEND. Neow tf S, D.
- 24df85e7635acd94 (Antsa, .111; Tent from f15): ARMAMENTS, FURNACE, UPPERCUT | BURNING_PACT, SHOCKWAVE, TRUE_GRIT | VICIOUS, INFLAME. 7S. rm STRIKE.
- ee3eb4c141a6e5d1 f (Antsa, .111; sparse): JACKPOT | PYRE | H, H. rm STRIKE. Darv tf 3 basics.
- ba340d6546d2dcb8 f (Antsa, .110.1): TRUE_GRIT, H, TRUE_GRIT | TRUE_GRIT, H(12/80) | CRUELTY, H. 4S/3H. rm STRIKE.
- d0a879a9a590b70f f (Nomad, .111): H, EXPECT_A_FIGHT, ? | UNMOVABLE, H, BASH, H(9/80) | SHRUG_IT_OFF + INFLAME, BRAND, H. No removals.
- 8c88f9c8da61aee9 f (RRROCKETS, .111): PRIMAL_FORCE, ARMAMENTS, UPPERCUT, TRUE_GRIT | RUPTURE, VICIOUS | UNMOVABLE. 7S/0H. rm DECAY, INJURY.
- 958e77192e745691 f (Big T, .111): DISMANTLE, H, STOKE | H | H. 2S/3H. rm STRIKE.
- dea9f6363d42f888 f (anon, .111): HAVOC, ?, TAUNT, BLOODLETTING | VICIOUS, UNMOVABLE, ?, ? | DARK_EMBRACE, FORGOTTEN_RITUAL. About 10S. rm STRIKE.
- adcf8acdd4c017c0 f (anon, .111; Pandora's Box): CRUELTY, POMMEL_STRIKE | BREAK | MAD_SCIENCE, AUTOMATION. rm STRIKE.
- 1acb3d740e15e3e3 f (anon, .111): ANGER, H | TRUE_GRIT, TAUNT, H, VICIOUS, PYRE, VICIOUS. rm DEFEND, SETUP_STRIKE ×2.
- 3a5fd56d850ebfe9 f (anon, .111): STONE_ARMOR, FLAME_BARRIER, RAGE | BURNING_PACT, FEEL_NO_PAIN ×2 | DARK_EMBRACE, SECOND_WIND, BLOODLETTING, SHRUG_IT_OFF. 10S/0H. rm STRIKE, BASH + STRIKE (event).
- ceb0addbebe3017f f (anon, .111): FIGHT_ME, FASTEN, UPPERCUT | BREAK, STAMPEDE, H | SHRUG_IT_OFF, UNMOVABLE, SHRUG_IT_OFF. rm STRIKE.
- c02d3730b375489e (anon, .111): H(20/80), STAMPEDE, PALE_BLUE_DOT | VICIOUS, POMMEL_STRIKE, H(23/80) | APOTHEOSIS, H, H, H. 5S/5H.
- e0426323b01d18f8 (anon, .111; verbatim): FLAME_BARRIER, BASH | BURNING_PACT, UPPERCUT | OFFERING, SECOND_WIND, VICIOUS. rm DEFEND.
- 1fb08fe3efecccdd (anon, .111): POMMEL_STRIKE, H, H(13/80) | UPPERCUT, FEEL_NO_PAIN, ADRENALINE, H(24/97) | UNMOVABLE ×2. rm STRIKE (event).
- 3e14d122cbbfd648 (anon, .111): UPPERCUT, TAUNT, BASH | VICIOUS, FEEL_NO_PAIN ×2 | UNMOVABLE, FEEL_NO_PAIN, BULLY. 9S/0H. rm STRIKE, STRIKE (event).
- e4d31d783019872a (anon, .111): H(20/80) | HELLRAISER(7/74), H, POMMEL_STRIKE | POMMEL_STRIKE, BRIGHTEST_FLAME, BASH. rm DEFEND, DISMANTLE.
- 170a7eee94bf8b56 (anon, .111): BASH, H, POMMEL_STRIKE, H(32/87) | LIFT, SHOCKWAVE, INFERNAL_BLADE, CONFLAGRATION | SHOCKWAVE, DARK_EMBRACE, H(78/101). rm STRIKE, DEBT.
- 2e9d9ba740cd46ce (anon, .111): DEFEND, TAUNT, ABUNDANCE | UNMOVABLE, JACKPOT, BODY_SLAM, OFFERING | BATTLE_TRANCE, H(57/80). rm STRIKE (event), STRIKE.
- b7a69f69c752b189 (anon, .111): UPPERCUT, DISMANTLE, TWIN_STRIKE, TRUE_GRIT | ULTIMATE_DEFEND, BRAND, CONFLAGRATION | RUPTURE, H(77/99). rm STRIKE ×2.
- ad4e5a2b721ff122 (anon, .111): SHOCKWAVE(24/80), HOWL_FROM_BEYOND, TRUE_GRIT(27/80) | DARK_EMBRACE, VOLLEY | PYRE, TRUE_GRIT, CRUELTY. 8S/0H. rm STRIKE (event), STRIKE ×3.
- 1ad5c794d1aee623 / cafd683a8d3cd857 / a9c7b601e32e5a8f / 4121ce3cc608fcbd: partial or garbled extractions, used for removals only.
- 22a672733f75373a (anon, .107.1): HAVOC, TAUNT, TRUE_GRIT(20/67), HAVOC | DEMON_FORM, FEEL_NO_PAIN, TRUE_GRIT, TRUE_GRIT | HAVOC, H(56/82). 10S/1H. rm STRIKE ×3 (events).
- 11894204f3fe26ed (anon, .107.1): POMMEL_STRIKE, BLOODLETTING, DOMINATE | RAGE, WHIRLWIND, STOKE | H, FIEND_FIRE, H(68/107). rm STRIKE, DEBT.
- 632f40a5c5af97bc (Getting me mallet, .107.1): INFERNO, STONE_ARMOR, H(31/80) | AGGRESSION, STONE_ARMOR, MANGLE, POMMEL_STRIKE | BATTLE_TRANCE, RAGE, CRIMSON_MANTLE, WHIRLWIND. 11S/1H. rm DEFEND ×2 (event), REGRET.
- e4188d1f2a7e139e (anon, .107.1): H, H, STAMPEDE | H, WHIRLWIND, H, WHIRLWIND | H(12/80), H. 3S/6H. No removals.
- c4e46d793f80fdd2 (anon, .107.1): OFFERING, H(20/80), HAVOC, BASH | BULLY, OFFERING, H(18/80) | CRUELTY, BULLY. rm STRIKE (event), STRIKE ×2.

**Pre-v0.107.1 (possibly stale)**
- weird: 39dda0c7146be27f (.106.1) f, 61c43df564e74914 (.106.1) f, bacb9dc35b0d6a90 (.105.1) f, 3f8737851740d541 (.105.1) f (11S/0H), 3d4434bc21e079fc (.105.1) f, 1f64176688d47a2a (.103.2) f. Targets included PERFECTED_STRIKE, BLOODLETTING ×3, TRUE_GRIT ×3, SHRUG_IT_OFF ×2, WHIRLWIND ×2, BREAK ×2, CRIMSON_MANTLE ×2. All removals were Strikes except 1 Defend and 1 Bash.
- Dayton_360: 0d0dd7b770d4a30a (.103.2) f, 7bcc262946a7786e (.103.2) f (4S/3H), f12c3c0e7fc35c6e (.99.1) f (6S/4H), 942fcf69fc71869e (.99.1) f, 2a1619df78aeba4d (.99.1): ARMAMENTS, POMMEL_STRIKE, SHRUG_IT_OFF, H | BARRICADE, TRUE_GRIT, VICIOUS | OFFERING, TAUNT, H.
- fd6c981931a8efc9 (kedus, .103.2): H, H, H | H, H | UNMOVABLE, APPARITION, ASHEN_STRIKE. 3S/5H. rm DEFEND ×3.
- 1aa160081c141465 (Horlen, .99.1): TEAR_ASUNDER, RUPTURE, BLOODLETTING, INFLAME | BRIGHTEST_FLAME, PYRE, H | BLOODLETTING, BLOOD_WALL. rm STRIKE ×2, CLUMSY, SHAME.
- 98a9c5ccbee9d93e (anon, .104): STAMPEDE, H | PYRE(10/72), H | DARK_EMBRACE, DRUM_OF_BATTLE. rm STRIKE ×4.
- 776007fdc875f3d4 (anon, .105.1): DOMINATE, BASH, H, H(8/80) | CRIMSON_MANTLE, FEEL_NO_PAIN, SHRUG_IT_OFF, H | PYRE, VICIOUS, H, HAVOC. 8S/5H.
