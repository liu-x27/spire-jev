# 中文社区铁甲战士研究（StS2 / 杀戮尖塔2，A10 目标）

Compiled 2026-09-24 for spire-jev (bot on beta v0.111.0). Status: complete (first pass). Main gap: the spoken video content is not readable (see §1).

Scope: Chinese-language sources only (bilibili, NGA, 小黑盒, 贴吧, 知乎 …). English research is in
`STRATEGY-research.md`, `a10-decks-research.md`, `a10-combat-research.md`; not repeated here.

Tags: `[several]` two or more independent Chinese sources agree; `[one]` one source; `[inference]` mine.

---

## 1. Sources

Version timeline used for tagging (from `STRATEGY-research.md`): v0.98 EA launch 03-05; v0.100 03-19; v0.103.2 main
~05-14; v0.107.1 main 06-19 (still main); beta v0.108 07-03, v0.109 07-17, v0.110 07-30, v0.111 08-13.
Chinese creators say "107/109/110/111" for these. Most serious streakers are on the beta (v0.109-v0.111).
**Count:** 8 source groups are v0.107+ (DS, ITX, XCZ, DJX, SZ, VD, CM, plus the zhs name data); 5 are older (HJ, YJ, TB, GS, VJ). Older sources are used only for reasoning or mechanics, and they are flagged where cards changed.

| Key | Source (URL) | Author, date | Version | What it gives | Trust |
|---|---|---|---|---|---|
| **DS** | 专栏 "最高胜率的杀戮尖塔2V1.11铁甲战士卡牌评表" https://www.bilibili.com/read/cv53046070 + 3h15m video https://www.bilibili.com/video/BV1a6eu6iEct | 大鼠爱大薯, 2026-09-16/17 | **v0.111** (title; a commenter reads EXPECT_A_FIGHT as the new 3-cost block card, so the list is post-v0.111. The card images in the picture still show v0.110 text) | Full Ironclad tier image SSS…D (82 cards). I read every card from the image. Stated method: tier = how much the card raises win rate when it shows up. B = pool median; above B helps, below B "pollutes" the pool. Rated for his nosl style | Medium-high. Posted a numbered nosl Ironclad series: 10 wins, 1 loss in games 1-11. Also analyses top nosl player 白夕Seal's games |
| **ITX** | 专栏 "《杀戮尖塔2》v0.110 全职业卡牌评级表 by ITX351" https://www.bilibili.com/read/cv52319968 | ITX351, 2026-08-13 | **v0.110** (image uses pre-v0.111 FORGOTTEN_RITUAL / EXPECT_A_FIGHT) | Full Ironclad tier image 夯 / 顶级 / 大众化 / NPC / 拉完了 / 永远不会抓. Text notes on disputed cards and the method: any card that *solves a problem* goes up a tier; "fine but doesn't solve anything" cards go down, because taking them costs the alternative | **High**: states Ironclad 33 wins 1 loss, 17-win streak (all five characters 29-42 wins with ≤4 losses) |
| **XCZ** | Video "保姆级战士连胜攻略之白卡篇（v107-v111）" https://www.bilibili.com/video/BV16oh86eEeM (tier image in the pinned comment); "完整思路篇（v107）" https://www.bilibili.com/video/BV1WrTR6EEkk (chapter titles only) | 鲜橙汁TheDragoon, 2026-09-20 / 07-06 | **v0.107-v0.111** | Tier image for the 20 Common cards; the 洁/均 (lean vs average deck) framework | High for streaks: titles claim a 160-win streak (ended, v0.107-v0.109) and a new 100-win streak on v0.111. These are SL streaks (one title mentions 50 minutes of save-loading), so they are weaker evidence of nosl win rate |
| **DJX** | Channel of 刀剑笑- (mid 1834058407), incl. "500连战士的统计数据…现版本全单卡定位" https://www.bilibili.com/video/BV1Mhh56TEaV (08-25) and ~50 "v107…v111 战士A10解说" videos | 刀剑笑-, 2026-08 to 09 | v0.107-v0.111, labelled per video | Only titles, descriptions and comments are readable: the content is spoken. Titles name each winning deck's engine (e.g. 凶恶放血破击主宰, 黑拥添柴双契约放血). I used them as a frequency signal for engines | High for play record (500-win and later "600连" streak; SL status not stated); low detail for us |
| **HJ** | 专栏 "杀戮尖塔2送死流战士攻略" https://www.bilibili.com/read/cv47067138 | 永远的红警2小白, 2026-03-22 | **v0.98-v0.100 (stale)** | Longest text source: reasoning for ~80 cards plus the elite-hunting plan (6-9 elites per run) | Medium: 30-win streak on stream (SL status not stated). **Stale** for DEMON_FORM (+2 then; +3 since v0.109), MANGLE (15 then, 20 since v0.110), FORGOTTEN_RITUAL and EXPECT_A_FIGHT (reworked v0.111), BLOODLETTING/TAUNT/CRUELTY/DOMINATE rarity (v0.109), COLOSSUS/CRIMSON_MANTLE (nerfed v0.108), PRIMAL_FORCE (buffed v0.109) |
| **CM** | Comments on the videos above (via the public reply API) | various, 2026-07 to 09 | v0.107+ | Small practical notes (deck size, finishers by act, Vantom) | Low-medium, one voice each |
| **GS** | Portal reprints: gamersky.com handbook 2104455 / 2105544 / 2103073, 17173 | 2026-03 | v0.98-v0.100 (stale) | Transcripts of March videos (e.g. 晓夫九 "战士A10连胜攻略" BV1hqwEzoECM, 700k views) | Low; stale |
| **SZ** | 专栏 "【杀戮尖塔2】长考流机器人" https://www.bilibili.com/read/cv53029978 | 菘522, 2026-09-16 | **v0.110-v0.111** | Defect guide (not Ironclad). Used only for general route/boss notes: Queen is the hardest act-3 boss, Aeonglass needs fast damage | High for that character (39 wins, 2 losses) |
| **VD** | Descriptions of v0.111-era Ironclad A10 run videos: 柚亿橘 BV1fMhx6DEry (states v0.111), 客小瞳 BV1NTaw6FEeH / BV1t7h46eEGe, 李扗赣神魔捏 BV1S8hq6KE9d | 2026-09-21 to 23 | v0.111 stated once; otherwise not stated (date suggests v0.107.1 main or v0.111) | One-paragraph run summaries (engine, elite count) | Low (single runs) |
| **YJ** | 一件绯红披风's A10 SL-streak videos, e.g. BV1uoDiBmEmo, BV15cQ7BTEon, BV1YL9fBREdf (descriptions) | 2026-03-21 to 05-03 | v0.98-v0.103 (older) | How to build an infinite, step by step; stopgap vs engine | Medium (41-win SL streak) |
| **TB** | 杀戮尖塔吧 guide by dilidili50, reprinted at https://www.gamersky.com/handbook/202603/2104455.shtml | 2026-03 | v0.98-v0.100 (stale) | Avoid-fights A10 plan; HP ≥70% | Low-medium (tieba only reached through the reprint) |
| **VJ** | 维吉尔游戏解说 "从夯到拉" rares / uncommons https://www.bilibili.com/video/BV1HnDTBSExw , BV1B997BUEbJ | 2026-04-01/04 | v0.100-v0.102 (stale) | Tier images (not transcribed: too old) | Medium (claims nosl 4-win streak) |

**Could read:** bilibili search and 专栏 APIs (`api.bilibili.com/x/web-interface/search/type`, `/x/article/view`),
video metadata (via WebFetch), comments (`/x/v2/reply`), chapter titles (`/x/player/wbi/v2` view_points), and tier
images linked from articles or pinned comments. Rate limits (HTTP 412 / -509) hit often.
**Could not read:** video speech. AI subtitles need login, and that is where most of the content is.
Also blocked: 动态 feeds (-352 risk control), NGA (login wall, ERROR:2048), 百度贴吧 (403 / 安全验证), 小黑盒 (no
indexed pages; app-only API), 知乎 (search found only StS1 or generic posts). So the evidence comes mainly from bilibili
text and images. Tier-image readings are mine (card art, cost and rules text matched to the zhs card data).

## 2. Card ratings from Chinese creators

Scales: **DS** SSS > SS > S > A > B (median) > C > D. **ITX** 夯 > 顶级 > 大众化 > NPC > 拉完了 > 永 (永远不会抓).
**XCZ** (Commons only): 神 (一锤定音的神卡) > 优 (优质) > 中 (中等，需配合) > 难 (很难配合/贬值快); 防 (一费小防，各有功能);
大防 (二费优质大防); 敲带 (运转兼烧牌，有敲位就带). **HJ** (v0.98-0.100, stale) is given only where it adds reasoning.
**Elo** = wr50 Elo−Skip from `a10-decks-research.md` §2.2 (strong English-data players; >0 means taken over skip). The Elo pool mixes v0.98-v0.111 runs, so it lags on every card in the "Changed" column.

| Card | Changed since v0.107.1 | DS v0.111 | ITX v0.110 | XCZ v107-111 | Elo | Reasoning given (paraphrased) |
|---|---|---|---|---|---|---|
| OFFERING | – | SSS | 夯 | – | +314 | Agreed. HJ: "the only daddy"; with removal and draw, one Offering can start the engine in one turn |
| UNMOVABLE | – | SSS | 夯 | – | +244 | HJ: the strongest "numbers solution"; StS2 enemies rarely scale, so doubled block keeps pace. Needs an upgrade |
| CRIMSON_MANTLE | v0.108 block 8→7 (upg. 10) | SSS | 顶级 | – | +164 | HJ: best stopgap block, also feeds Spite/Inferno |
| BATTLE_TRANCE | – | SS | 夯 | – | +130 | A commenter calls it the best Uncommon of any class. HJ: weaker after act 1; don't take a second copy |
| STOKE | – | SS | 夯 | – | +159 | Often a run's engine: "拿到添柴后就会转型为添柴战"; a commenter says upgrading Stoke "upgrades every card" |
| VICIOUS | – | SS | 顶级 | – | −25 | Main draw engine of Vulnerable decks, together with Thunderclap/Taunt/Molten Fist/Bully. HJ: draws 2 only when upgraded |
| AGGRESSION | – | SS | 大众化 | – | +50 | "1 card per turn, never weak" (comment). HJ: two turns to pay back; also saves upgrade slots |
| PRIMAL_FORCE | v0.109 rocks 16→20 | SS | 顶级 | – | −197 | Big disagreement with the data. Rocks buffed 16→20 in v0.109, after most of the English data. HJ (v0.98): overrated |
| BREAK (ancient) | – | SS | 顶级 | – | n/a | 20 dmg + 5 Vulnerable for 1. Many DJX v0.109-111 wins are "破击 + 凶恶/主宰" |
| DARK_EMBRACE | – | S | 夯 | – | +137 | HJ: plan as if you won't see it (rare); adjust when you do |
| BLOODLETTING | v0.109 →Uncommon | S | 夯 | 神 | +69 | Chinese sources rate it far above the data. XCZ: the single best Common. HJ: turns raw draw into damage; no upgrade needed; take one almost always. DJX titles flag "无放血" (no Bloodletting) runs as the hard ones |
| COLOSSUS | v0.108 block 5→4 | S | 顶级 | – | +216 | Agree. HJ (v0.98) disliked it; both current lists rate it high |
| FEEL_NO_PAIN | – | S | 顶级 | – | +21 | HJ: exhaust sources only grew in StS2; take it and survive |
| IMPERVIOUS | – | S | 大众化 | – | +96 | HJ: StS2 enemies front-load, so 30 block covers any elite turn in acts 1-3 |
| NOT_YET | – | S | 顶级 | – | +97 | Healing is scarce |
| BRAND | – | S | 顶级 | – | +128 | 0-cost exhaust + Str + self-damage trigger |
| PACTS_END | v0.110 17→18 | S | 大众化 | – | +26 | |
| FIEND_FIRE | – | S | 顶级 | – | −7 | |
| TEAR_ASUNDER | – | S | 大众化 | – | +21 | |
| FIGHT_ME | – | S | 大众化 | – | −254 | Big disagreement: DS rates it top; ITX mid; HJ (v0.98) "unrecyclable junk" |
| UPPERCUT | – | S | 顶级 | – | −62 | ITX: the only Weak in the Ironclad pool, and Weak matters. HJ: also a Vuln piece |
| UNRELENTING | – | S | NPC | – | −195 | HJ: next attack costs 0 → good with Uppercut/Stomp/Bludgeon |
| ASHEN_STRIKE | – | S | 顶级 | – | −49 | Boss killer in exhaust decks |
| INFLAME | – | S | 大众化 | – | −133 | HJ: last Strength card worth taking; Str is its own multiplier on Vuln |
| ARMAMENTS | – | S | 大众化 | 防 | −131 | HJ: upgrade slots are scarce in StS2 (fewer rests), so green Armaments is worth a lot |
| HEADBUTT | – | S | NPC | 优 | −128 | HJ: cheap recursion for 0-costs, finishers, Drum of Battle |
| HAVOC | – | S | 顶级 | 敲带 | −308 | Largest data disagreement. All three rate it good. XCZ: "draw + exhaust, bring it if you have an upgrade slot". Upgraded, it has no downside |
| CORRUPTION (ancient) | – | S | 大众化 | – | n/a | |
| PYRE | – | A | NPC | – | +238 | CN lower than data. HJ: "trap, Stampede is better". ITX: NPC |
| MANGLE | v0.110 15→20 | A | 拉完了 | – | +114 | DS is after the v0.110 buff (15→20 dmg); ITX's image may be older |
| INFERNO | – | A | 顶级 | – | −152 | HJ: best AoE in the pool with the self-damage cards; beats Whirlwind |
| SECOND_WIND | – | A | 夯 | – | −5 | ITX: back on top since v0.107. HJ: best vs status-card spam |
| BURNING_PACT | – | A | 夯 | – | +103 | HJ: the one Uncommon that changes fights; top pick after early act 1 |
| FORGOTTEN_RITUAL | v0.111 rework (no condition) | A | 拉完了 | – | −16 | Versions differ: ITX rated the pre-v0.111 conditional card; DS rated the v0.111 unconditional one (+3 energy) |
| RAMPAGE | v0.111 9→10 | A | NPC | – | −270 | |
| BULLY | – | A | NPC | – | +37 | HJ: 0-cost 12 dmg with Bash alone |
| TAUNT | v0.109 →Common, block 7→6 | A | 大众化 | 防 | +17 | HJ: "super Iron Wave"; Vuln coverage plus block; take one when short on block |
| SHRUG_IT_OFF | – | A | 大众化 | 防 | +0 | |
| EVIL_EYE | – | A | NPC | – | −25 | |
| FLAME_BARRIER | – | A | NPC | – | +12 | HJ: StS2 has many multi-hit and group fights |
| TRUE_GRIT | – | A | 大众化 | 防 | −86 | |
| DEMON_FORM | v0.109 +2→+3 Str | A | 拉完了 | – | +95 | Split. ITX: pure trap. DS: A after the v0.109 buff (+3 Str). HJ (+2 era): "why are you still here" |
| BARRICADE | – | A | 顶级 | – | +175 | HJ (v0.98): trap. Current lists: good |
| RUPTURE | – | A | 大众化 | – | −64 | |
| THRASH | – | A | 顶级 | – | +63 | HJ: great stopgap, often solo-kills act 1-2 bosses; slow as a final engine |
| DOMINATE | v0.109 →Rare | A | 大众化 | – | +275 | CN lower than data. HJ: "a Vuln-deck add-on; don't upgrade it" |
| CONFLAGRATION | – | B | NPC | – | +68 | |
| FEED | – | B | 顶级 | – | −145 | HJ: one copy in acts 1-2; max HP is the only sustain left |
| CRUELTY | v0.109 →Uncommon | B | 大众化 | – | +168 | CN lower than data |
| JUGGLING | – | B | 顶级 | – | −189 | Good only with Spite/Stomp/Bully; act 1-2 boss tool (HJ) |
| STAMPEDE | – | B | NPC | – | −59 | |
| RAGE | – | B | NPC | – | −24 | |
| DISMANTLE | – | B | 拉完了 | – | −124 | |
| BLUDGEON | – | B | NPC | – | −190 | HJ: never against Vantom (Slippery) |
| SPITE | – | B | 永 | – | −215 | Split. HJ (v0.98) rated it a top finisher; ITX never takes it |
| TREMBLE | – | B | 拉完了 | 优 | −27 | Split (XCZ good, ITX junk) |
| BODY_SLAM | – | B | 顶级 | 中 | −197 | ITX high. Others: only with Unmovable / Barricade / Impervious |
| BLOOD_WALL | – | B | NPC | 大防 | −119 | |
| EXPECT_A_FIGHT | v0.111 rework (3-cost block) | B | 大众化 | – | −93 | ITX/Elo are for the old energy card. DS rates the v0.111 3-cost block card; a commenter queries why it is only B |
| PERFECTED_STRIKE | – | C | 大众化 | 中 | −198 | ITX: StS2 counts Strikes in the exhaust pile and has more Strike synergies than StS1 |
| HEMOKINESIS | – | C | 大众化 | – | −306 | |
| STOMP | – | C | 大众化 | – | −224 | |
| BREAKTHROUGH | – | C | 拉完了 | 中 | −274 | |
| WHIRLWIND | – | C | 大众化 | – | −153 | Needs an upgrade. Enchanted (华彩/GLAM) Whirlwind is called a won run in two v0.111 videos |
| IRON_WAVE | – | C | 拉完了 | 难 | −265 | Agree: skip ("skipped ~700 times", comment on DJX) |
| HOWL_FROM_BEYOND | v0.108 16→18 | C | NPC | – | −201 | |
| MOLTEN_FIST | – | C | NPC | 中 | +6 | |
| STONE_ARMOR | – | C | 永 | – | −65 | |
| DRUM_OF_BATTLE | – | C | 拉完了 | – | −111 | |
| THUNDERCLAP | – | C | NPC | 中 | −224 | |
| POMMEL_STRIKE | – | **D** | 顶级 | 优 | +47 | Split. DS: grouped with Twin Strike as junk (needs upgrades and energy StS2 lacks). A comment: StS2 Pommel is "Strike+". ITX/XCZ: good |
| SETUP_STRIKE | v0.108 Str 2→3 | D | 拉完了 | 难 | −291 | Agree |
| TWIN_STRIKE | – | D | 拉完了 | 难 | −263 | Agree (one commenter: good with Sharp/Vigorous enchant) |
| CINDER | – | D | 永 | 中 | −403 | Agree |
| PILLAGE | – | D | 拉完了 | – | −119 | |
| INFERNAL_BLADE | – | D | 永 | – | −124 | |
| SWORD_BOOMERANG | – | D | 拉完了 | 难 | −274 | Agree |
| JUGGERNAUT | – | D | NPC | – | −32 | |
| HELLRAISER | – | D | 拉完了 | – | +49 | |
| CASCADE | – | D | 拉完了 | – | +115 | CN much lower than data |
| ONE_TWO_PUNCH | – | D | 拉完了 | – | +30 | |
| ANGER | – | A | 大众化 | 优 | −302 | **Big disagreement.** CN rate it playable-to-good. HJ: top act-1 damage and *the* Vantom counter (extra hits break Slippery, fights card clog) |
| BASH / STRIKE / DEFEND | – | – | 拉完了 / 永 / 永 | – | – | HJ: remove Strikes before Defends in StS2 |

### 2.1 Where Chinese ratings agree / disagree with the English consensus and data

- **Agree** `[several]`:
  - Top cards: OFFERING, UNMOVABLE, CRIMSON_MANTLE, STOKE, BATTLE_TRANCE, DARK_EMBRACE, BURNING_PACT, COLOSSUS, BRAND.
  - Frontload Commons are bad: TWIN_STRIKE, SETUP_STRIKE, SWORD_BOOMERANG, IRON_WAVE, CINDER, BREAKTHROUGH.
  - Trap Rares: HELLRAISER, ONE_TWO_PUNCH, JUGGERNAUT, CASCADE, PILLAGE.
- **CN higher than data** `[several]`:
  - BLOODLETTING (神/夯/S vs +69) and HAVOC (S/顶级/敲带 vs −308).
  - VICIOUS (SS/顶级 vs −25) and UPPERCUT (S/顶级 vs −62): Chinese players run a *Vulnerable-draw* engine (Vicious + Break/Bash + Thunderclap/Taunt) that the English data barely credits.
  - PRIMAL_FORCE (SS/顶级 vs −197; buffed in v0.109, which may explain the gap), INFERNO, SECOND_WIND, FEEL_NO_PAIN, ARMAMENTS.
- **CN lower than data** `[several]`: PYRE (A/NPC vs +238), DOMINATE (A/大众化 vs +275), CRUELTY (B/大众化 vs +168), CASCADE (D/拉完了 vs +115).
- **Split among Chinese sources:** POMMEL_STRIKE (D vs 顶级), DEMON_FORM (A vs 拉完了), FIGHT_ME (S vs 大众化), SPITE (B vs 永), BODY_SLAM (B vs 顶级), TREMBLE.
- **ANGER, INFLAME, BODY_SLAM:** the data puts all three well below skip.
  - Chinese lists put ANGER at A/大众化/优 and INFLAME at S/大众化; BODY_SLAM is split (B/顶级/中).
  - So on ANGER and INFLAME the Chinese side disagrees with the data.
  - The stated reason is act-1 transition and Vantom. These are *early-act* picks, and the data has the same shape: Anger's act-1 pick rate is 16% and falls to 5% by act 3.

## 3. How high-ascension Chinese players build and run Ironclad

Caveat: the detailed v0.107+ material is spoken in videos that I could not read. §3 therefore rests on:
- the long HJ text (v0.98-v0.100; stale items are flagged);
- ITX's notes (v0.110) and DS's method (v0.111);
- XCZ's chapter titles and tier image (v0.107-v0.111);
- the engines named in ~50 DJX A10 win titles (v0.107-v0.111);
- comments.

### 3.1 The shared mental model: 过渡 → 运转 → 终端 / 数值解 `[several]`

- **Every source uses the same three roles.**
  - **过渡** (stopgap): front-loaded damage, AoE and block that keep HP up in act 1 and early act 2.
  - **运转** (engine): draw (过牌), energy (加费) and exhaust (烧).
  - The engine turns into either a **循环解** (a small loop or an infinite) or a **数值解** (a "numbers" win: Unmovable/Barricade block, Strength, Vulnerable multipliers).
  - Sources: HJ; 一件绯红披风 (41-win SL streak, v0.100-v0.103: "Ironclad only needs two kinds of cards, stopgap and engine"); XCZ chapter "后期思路 / 前中期过渡".
- **Take draw and energy almost on sight.** HJ's one-line summary: "没有加费可能蠕动，没有过牌可能会死". It means: with no energy the run crawls, with no draw it dies. 一件绯红披风 even takes Expect a Fight / Forgotten Ritual on spec (v0.100).
- **How an infinite is built** (一件绯红披风, v0.103; HJ):
  1. Get the whole deck into your hand by exhausting and drawing. Draw matters more than exhaust.
  2. Close the loop in one of two ways:
     - two 0-cost cards that draw each other: Instinct-enchanted (本能) Pommel Strike, Pillage, Spite, colourless Flash of Steel (亮剑) / Finesse (妙计);
     - small draw ↔ big draw plus an energy piece, e.g. Pommel draws Ritual/Shrug and Shrug draws Pommel.
  - HJ adds: Act 3 does not punish loops (Queen only adds a few Wounds). This is v0.98 information. Since then Aeonglass (v0.107) was added as a boss, and it punishes long turns ("沙漏版本对出伤速度有更高的要求", 菘522, v0.110-0.111 Defect article).
- **洁 vs 均** (XCZ v0.107; 菘522 v0.110-111):
  - 洁卡 = lean deck: skip and remove hard, aim for a loop.
  - 均卡 = "average" deck of ~25-30 cards with a numbers win.
  - Top comment (XCZ agreed): big decks brick more often, lean decks brick harder.
  - Deck size has grown since v0.99: "0.99 decks could stay at 20; now 30 cards is the starting point" (comment, v0.109). Another comment: "try to stay under 25".

### 3.2 Archetypes seen in current (v0.107-v0.111) wins

Counts are from DJX's A10 win titles (v0.107-v0.111, ~50 videos); `[one]` creator, with other sources where noted.

1. **Exhaust engine (烧牌运转).**
   - Pieces: Stoke / Dark Embrace / Burning Pact ("双契约", "三契约") / Havoc ("三破灭") / Brand, with Feel No Pain and Offering.
   - Finishers: Ashen Strike, Pact's End, Fiend Fire, Thrash.
   - "添柴黑拥" appears in ≥5 titles. A title (南隅笙箫, 09-19, version not stated) says any Ironclad turns into a Stoke deck once it finds Stoke. Another (客小瞳, 09-22, version not stated): Stoke + Feel No Pain alone won with no other finisher.
2. **Vulnerable draw (易伤/凶恶运转).**
   - Pieces: Vicious + Break (the Ancient Bash upgrade) or Bash, plus Thunderclap / Taunt / Uppercut / Molten Fist / Bully, with Dominate or Cruelty as damage.
   - Titles: "凶恶放血破击主宰", "凶恶破击", "破击主宰欺凌", "两把破击运转局，终端？战士要什么终端" (two Break engine runs: "what finisher? Ironclad doesn't need one").
   - HJ (v0.98) already called Vulnerable the best stopgap archetype, because its pieces feed each other.
   - DS (SS) and ITX (顶级) both put Vicious near the top.
3. **Block / turtle (龟).** Unmovable, Crimson Mantle, Barricade, Impervious, Colossus, Body Slam.
   - Titles: "披风坚定龟住", "壁垒披风", "全靠壁垒孤注一掷", XCZ "孤注一掷肚皮是输不了的游戏" (v0.111 100th win).
   - A new-player article (04-28, v0.100-0.103) says most of their A10 clears were Barricade (堡垒) decks.
   - One DJX v0.111 title mocks "招笑龟龟" (laughable turtling). So this archetype is `[disputed]`.
4. **Self-damage (卖血).** Inferno, Crimson Mantle, Rupture, Brand, Bloodletting, Spite, Tear Asunder. Title: "无放血撕裂狱火披风壁垒" (v0.111).
5. **Attack-heavy / Strength (攻哈).**
   - XCZ's early seasons, then "109版本龙涎香初试 攻哈战士死灰复燃 20卡小卡组" (v0.109).
   - Juggling-copies decks ("三杂耍痛殴局").
   - Primal Force + Juggling, noted as very high numbers in a Sep 2026 run description (version not stated).
   - A 客小瞳 run (09-23, version not stated) won on Demon Form + Conflagration.
6. **Missing Bloodletting is the hard case.** DJX flags "无放血" (no Bloodletting) in 8 titles. Examples: "无放血？四张雷霆大破灭不需要费用", "没有放血的两局…COS加费".
   - So Bloodletting is the *assumed* energy source, and a run without it is remarked on. `[one]`
7. **Event and Ancient pieces show up in winning titles.**
   - Break (破击), Corruption (腐化).
   - **Brightest Flame (至亮之焰, from Storybook)** is in ≥5 v0.111 titles, even after its v0.111 cost increase.
   - Enchanted cards: GLAM (华彩) Whirlwind / Anger = "爽局预定" (a run you've basically won); GLAM Iron Wave (v0.109).

### 3.3 Startup order and when to commit `[several]`

- **Act 1:**
  - Take 过渡 first: an AoE card plus a block card.
  - Take the first draw/energy piece when offered: Bloodletting, Battle Trance, Burning Pact, Offering.
  - Take engine-only Rares without a starter (Dark Embrace, Barricade) only if the deck can survive (HJ; XCZ 洁 chapter; 七彩蓓蕾 comment).
- **Don't plan around Rares.** HJ: "默认黑拥不存在" (assume you won't see Dark Embrace); build from Commons and Uncommons and pivot when a Rare arrives.
- **Act 2:**
  - Add AoE and block.
  - Kill fast; be more careful than in act 1.
  - Before the act-2 boss, get a finisher: multi-hit + Strength, exhaust + Ashen Strike, Thrash / Stoke loops, or Instinct/Corruption + Break. Failing all of those, turtle and use Body Slam. (七彩蓓蕾, comment on XCZ's v0.107 video.)
- **ITX's rule:** a card that *solves the current problem* is worth a tier more than it looks, and a "fine but solves nothing" card costs you the card beside it. Example: Uppercut is the only Weak in the pool.
- **Frontload cards lose value fast.** DS and ITX put Twin/Setup Strike, Sword Boomerang, Iron Wave and Cinder at the bottom. Even Pommel Strike is D for DS: in StS2 it needs an upgrade and energy, so it is "Strike+".

### 3.4 Upgrades, rests, removal

- **Upgrade slots are scarce.** A6 cuts rest sites; HJ calls this "阴郁", the fewer-campfires effect. So cards that are dead unupgraded lose pick value.
  - HJ's list of cards that need the upgrade: Whirlwind, Stampede, Vicious (draws 2 only when upgraded), Aggression, Unmovable, Armaments, Havoc, Taunt.
  - HJ also says **don't upgrade Dominate**.
  - Comment (v0.111): "敲了添柴等于敲了所有牌" (upgrading Stoke upgrades every card it makes).
  - XCZ puts Havoc as "take it if you have an upgrade slot".
- **Rest vs smith:**
  - Tieba guide (dilidili50 via gamersky, v0.98): keep HP ≥70% in the hallway, rest when low, and "don't die on the road because you got greedy for an upgrade".
  - 客小瞳 (Sep 2026): with Regal Pillow (皇家枕头) and similar relics, rest more.
  - Vantom: enter nearly full HP (comment on DJX, Aug).
- **Removal:**
  - HJ: remove Strikes, keep Defends. StS2 hits are front-loaded, so Defends are "junk stopgap" while Strikes are "unrecyclable junk".
  - 17173 guide (v0.98, conditional): don't remove early if the gold buys a card or relic. If Second Wind / Hellraiser came first, remove Strikes; if Rage / Pillage came first, remove Defends.
  - 李日月轩 made a video on "what to remove first" (Aug 2026, 74k views); the content is not readable.

### 3.5 Route and elites `[disputed]`

- **Two camps:**
  - *Avoid fights*: A10 tieba guide (v0.98), "almost always avoid fights, even avoid elites if you can go infinite; HP is Ironclad's key resource; walk ? and campfires".
  - *Elite-hunting*:
    - HJ (v0.98): 6-9 elites a run, ≥2 in act 1.
    - 香芋侠 (v0.103, 96k views): "how to charge elites from floor 1".
    - 客小瞳 (09-23, version not stated, 9 elites): "Ironclad must not turtle; pick the elite fights for relics; high HP plus 6 heal per fight lets you take the damage".
- **Middle ground:** a much-liked comment on XCZ's v0.107 video says "act 1 elites are easier than strong hallway fights; be more careful in act 2".
- DJX's 500-win video covers "冲多少精英" (how many elites to fight), but the answer is spoken only.
- For the bot this stays disputed: tie it to deck strength and HP (rule R12).

### 3.6 Boss plans (thin in Chinese text; mostly agrees with `a10-combat-research.md`)

- **Vantom (墨影幻灵, "小黑/墨灵"):**
  - HJ (v0.98, Slippery 9 then) calls it the ceiling of act-1 bosses: card clog plus Slippery plus growing heavy hits. Rest before it. Take one **Anger** even if the deck is full: it answers the clog and the extra hits break Slippery. Never Bludgeon.
  - Comment (Aug, on v0.107+): heavy hit and multi-hit are both hard to block, and Slippery punishes racing. Runs that kill it before the second heavy hit are the easy ones; go in near full HP.
  - A title (09-17, version not stated): a Thrash deck entered at 75 HP and died to two heavy hits in 7 turns.
- **The Insatiable (无厌沙虫, "沙虫"):**
  - Two March videos (200k and 9k views) show devour ignores Fairy in a Bottle. This agrees with English §2.1.
  - 菘522 (Defect, v0.110-111): Strike-heavy low-scaling decks lose to Knowledge Demon and the Insatiable.
  - Comment (v0.109): losing to Kaiser Crab (帝皇蟹) means the engine starts too slowly.
- **Queen (女王):**
  - 菘522 (v0.110-111) calls it the hardest act-3 boss. It locks key cards, so keep more than one draw source.
  - Kill order is disputed in anecdotes: "hit the minion first" (v0.98) vs "killing the Queen first is the only way" (June 2026).
- **A10 double boss:** "It's all luck unless relics give survival; the second boss finds you without HP" (comment, v0.107). Aeonglass punishes slow damage (菘522).

### 3.7 Potions (little direct material)

- **HJ:**
  - Vicious turns a Vulnerable Potion into draw 2.
  - A Power Potion can be the finisher in a weak act 3.
- **菘522 (general):** two potions in act 1 cut early-elite losses; Fire/Attack potions for the first elite.
- Nothing contradicts `STRATEGY-research.md` §8.

## 4. Checkable rules for the bot

Tags: `[several]` / `[one]` / `[inference]`; version in brackets. **CN** marks rules that differ from or extend the English research.

1. **R1 Bloodletting is a core pick** `[several: DS S, ITX 夯, XCZ 神, DJX titles; v0.107-v0.111]` **CN**.
   - Take the first BLOODLETTING over any Common and most Uncommons; a second copy only in loop decks.
   - Check: pick rate of the first copy offered ≥ 80%.
   - The English data (+69) supports taking it, but less strongly.
2. **R2 No draw or no energy by the act-1 boss → prioritise it** `[several: HJ, 一件绯红披风, CM]`. When the deck has 0 draw cards (Battle Trance, Burning Pact, Pommel Strike, Vicious, Offering) or 0 energy cards (Bloodletting, Offering, Pyre, Forgotten Ritual), raise the best available one above any stopgap card.
3. **R3 Battle Trance: first copy yes, second copy no** `[several: DS SS, ITX 夯, HJ]`. Matches the English data.
4. **R4 Vulnerable-draw package** `[several: DS, ITX, DJX titles; v0.109-v0.111]` **CN**.
   - Once VICIOUS is owned, raise Thunderclap, Taunt, Uppercut, Bully, Molten Fist and Dominate one tier each.
   - Take BREAK when an Ancient offers it; upgrade Vicious early.
   - Check: in runs with Vicious, count of Vulnerable sources ≥ 3.
5. **R5 Havoc is playable in exhaust decks** `[several: DS S, ITX 顶级, XCZ; v0.107-v0.111]` **CN**.
   - Strong disagreement with the data (−308).
   - Compromise `[inference]`: take one Havoc only if the deck already has an exhaust payoff (Feel No Pain, Dark Embrace, Ashen Strike, Pact's End, Forgotten Ritual) and a free upgrade slot is likely. Never take two.
6. **R6 Vantom counter** `[one: HJ v0.98 + CM Aug]` **CN**.
   - When the act-1 boss is VANTOM, one ANGER (or another cheap multi-hit such as an enchanted Whirlwind) is worth taking even at −302.
   - Avoid Bludgeon and other single big hits for that act.
   - Rest before the boss unless HP ≥ 90%.
7. **R7 The skip list is shared** `[several: DS D, ITX 拉完了/永, XCZ 难; v0.110-v0.111]`.
   - Never take: TWIN_STRIKE, SETUP_STRIKE, SWORD_BOOMERANG, IRON_WAVE, CINDER, INFERNAL_BLADE, PILLAGE, HELLRAISER, ONE_TWO_PUNCH, JUGGERNAUT.
   - Exception: an enchantment is on the card or will be put on it.
   - CASCADE is also rated D/拉完了 against the data's +115. Treat it as neutral.
8. **R8 Pommel Strike and Anger are act-1 only** `[several: DS D vs ITX 顶级; data]`. At most one each, and only in act 1 (Anger also for Vantom, R6). Stop taking them in acts 2-3.
9. **R9 Remove Strikes before Defends** `[several: HJ, ITX; 17173 conditional]`. After Strikes, remove Bash only if the deck has other Vulnerable. Keep Defends until the deck has ≥ 4 better block cards.
10. **R10 Upgrade the cards that need it** `[one: HJ + CM v0.111]`.
    - Upgrade Unmovable, Vicious, Whirlwind, Stampede, Aggression, Armaments, Havoc, Stoke and Taunt before generic damage cards.
    - Never upgrade Dominate.
    - Don't take Whirlwind unless an upgrade is likely before the next elite.
11. **R11 "Solves a problem" bonus** `[one: ITX v0.110, 33-1]`. Before scoring, name the deck's gap: AoE, Weak, single-target burst, block, draw or energy. Cards that fill it get +1 tier; generic "fine" cards get −1. UPPERCUT counts as solving "Weak" (the only Weak in the pool).
12. **R12 Elite policy follows deck state** `[disputed; HJ/客小瞳 vs tieba]`. Proposal `[inference]`:
    - In act 1, path through ≥ 2 elites when the deck has an AoE card plus 2 good stopgap cards and HP ≥ 65%.
    - In act 2, take elites only with a started engine (≥ 2 draw and ≥ 1 energy).
    - Two sources (a comment and 菘522) say act-1 elites cost less HP than act-1 strong hallway fights.
13. **R13 Deck size: ~25-30 cards is normal on v0.109+** `[several: CM ×2, 菘522]`. Don't force a 20-card lean deck unless a loop is live. Keep skipping frontload after act 1, not all cards.
14. **R14 Take Brightest Flame (Storybook) and Break when offered** `[one: DJX titles v0.111]` **CN**. Both appear in many v0.110-v0.111 wins. Brightest Flame still gives +2 energy and draw 2 at 2 max HP per play.
15. **R15 Enchant multi-hit or 0-cost draw** `[several: ITX, two Sep 2026 videos (one states v0.111), comment]` **CN**.
    - When choosing an enchant target, rank: GLAM/VIGOROUS/SHARP on Whirlwind > Thrash > Twin Strike; INSTINCT on Pommel Strike. ITX: multi-hit cards gain the most from Vigorous, Sharp and Mystic Lighter.
    - An enchanted Whirlwind or Anger is "a won run".
16. **R16 Don't plan around Rares** `[one: HJ]`. Score engine Commons/Uncommons (Burning Pact, Bloodletting, Battle Trance, Havoc, Brand) as if Dark Embrace will not come. Switch to Dark Embrace / Stoke plans only when they are in the deck.
17. **R17 Insatiable: Fairy doesn't count** `[several: two CN videos + English §2.1]`. Don't count Fairy in a Bottle as an extra life against The Insatiable's devour. Agrees with English research.
18. **R18 Kaiser Crab / Insatiable losses mean a slow engine** `[one: CM v0.109; 菘522]`. By the end of act 2 the deck needs a started engine or a scaling finisher (Ashen Strike + exhaust, Thrash, Demon Form, Stoke, Unmovable). A pile of Strike-type attacks is not enough.
19. **R19 Pyre, Cruelty and Dominate are below what the data says** `[several: DS, ITX]` **CN**.
    - The English data rates all three highly (+238, +168, +275). Chinese streakers rate them B-A / NPC-大众化.
    - `[inference]`: keep the data ranking, but don't take them over draw/energy when R2 applies.
20. **R20 Queen locks cards** `[one: 菘522 v0.110-111]`. Going into act 3, have ≥ 2 independent draw sources so one lock doesn't stall the engine.

## 5. 中英名称对照 (Chinese ↔ English)

Official Simplified Chinese names from the game localisation, via Spire Codex
(`https://spire-codex.com/api/cards?color=ironclad&lang=zhs`, `/api/encounters?lang=zhs`, fetched 2026-09-24).
Rarity is as Spire Codex lists it (it still shows v0.107.1 rarities, e.g. TAUNT Uncommon, BLOODLETTING Common;
on v0.109+ TAUNT is Common, BLOODLETTING Uncommon, CRUELTY Uncommon, DOMINATE Rare).

### 5.1 Cards (official names)

- **Basic**: BASH=痛击; DEFEND_IRONCLAD=防御; STRIKE_IRONCLAD=打击
- **Common**: ANGER=愤怒; ARMAMENTS=武装; BLOODLETTING=放血; BLOOD_WALL=血墙; BODY_SLAM=全身撞击; BREAKTHROUGH=突破; CINDER=余烬; HAVOC=破灭; HEADBUTT=头槌; IRON_WAVE=铁斩波; MOLTEN_FIST=熔融之拳; PERFECTED_STRIKE=完美打击; POMMEL_STRIKE=剑柄打击; SETUP_STRIKE=预备打击; SHRUG_IT_OFF=耸肩无视; SWORD_BOOMERANG=飞剑回旋镖; THUNDERCLAP=闪电霹雳; TREMBLE=战栗; TRUE_GRIT=坚毅; TWIN_STRIKE=双重打击
- **Uncommon**: ASHEN_STRIKE=灰烬打击; BATTLE_TRANCE=战斗专注; BLUDGEON=重锤; BULLY=欺凌; BURNING_PACT=燃烧契约; COLOSSUS=巨像; DEMONIC_SHIELD=恶魔护盾; DISMANTLE=拆卸; DOMINATE=主宰; DRUM_OF_BATTLE=战鼓; EVIL_EYE=邪眼; EXPECT_A_FIGHT=跃跃欲试; FEEL_NO_PAIN=无惧疼痛; FIGHT_ME=与我一战！; FLAME_BARRIER=火焰屏障; FORGOTTEN_RITUAL=被遗忘的仪式; HEMOKINESIS=御血术; HOWL_FROM_BEYOND=彼岸咆哮; INFERNAL_BLADE=地狱之刃; INFERNO=狱火; INFLAME=燃烧; JUGGLING=杂耍; PILLAGE=劫掠; RAGE=狂怒; RAMPAGE=暴走; RUPTURE=撕裂; SECOND_WIND=重振精神; SPITE=怨恨; STAMPEDE=惊逃; STOMP=踩踏; STONE_ARMOR=岩石铠甲; TAUNT=挑衅; UNRELENTING=无情猛攻; UPPERCUT=上勾拳; VICIOUS=凶恶; WHIRLWIND=旋风斩
- **Rare**: AGGRESSION=好勇斗狠; BARRICADE=壁垒; BRAND=烙印; CASCADE=倾泻; CONFLAGRATION=焚烧; CRIMSON_MANTLE=绯红披风; CRUELTY=残酷; DARK_EMBRACE=黑暗之拥; DEMON_FORM=恶魔形态; FEED=狂宴; FIEND_FIRE=恶魔之焰; HELLRAISER=地狱狂徒; IMPERVIOUS=岿然不动; JUGGERNAUT=势不可当; MANGLE=凌虐; NOT_YET=时候未到; OFFERING=祭品; ONE_TWO_PUNCH=连环拳; PACTS_END=契约终结; PRIMAL_FORCE=原始力量; PYRE=薪火之源; STOKE=添柴; TANK=肉盾; TEAR_ASUNDER=扯碎; THRASH=痛殴; UNMOVABLE=坚定不移
- **Ancient**: BREAK=破击; CORRUPTION=腐化

### 5.2 Bosses and elites (official names)

- Act 1 bosses: VANTOM=墨影幻灵 (not 墨影幽灵); CEREMONIAL_BEAST=仪式兽; THE_KIN=同族小队 (KIN_PRIEST=同族神官, KIN_FOLLOWER=同族信徒); LAGAVULIN_MATRIARCH=乐加维林族母; SOUL_FYSH=灵魂异鱼; WATERFALL_GIANT=瀑布巨兽
- Act 2 bosses: THE_INSATIABLE=无厌沙虫; KAISER_CRAB=帝皇蟹 (CRUSHER=碾碎爪, ROCKET=火箭); KNOWLEDGE_DEMON=知识恶魔
- Act 3 bosses: QUEEN=女王 (TORCH_HEAD_AMALGAM=火炬头聚合体); TEST_SUBJECT=实验体; AEONGLASS=永世沙漏
- Act 1 elites: BYGONE_EFFIGY=旧日雕像; BYRDONIS=多尼斯异鸟; PHANTASMAL_GARDENERS=花园幽灵鳗; PHROG_PARASITE=异蛙寄生虫; SKULKING_COLONY=鬼祟珊瑚群; TERROR_EEL=骇鳗
- Act 2 elites: DECIMILLIPEDE=残杀千足虫; ENTOMANCER=蜂群术士; INFESTED_PRISMS=感染棱柱
- Act 3 elites: KNIGHTS=骑士团伙 (连枷/魔法/幽灵骑士); MECHA_KNIGHT=机甲骑士; SOUL_NEXUS=灵魂枢纽
- Enchantments seen in titles: GLAM=华彩 (e.g. "华彩旋风斩"), VIGOROUS=活力, SHARP=锋利, GOOPY=黏糊, SWIFT=迅速, STEADY=稳定, CORRUPTED=腐化
- Keywords: EXHAUST=消耗, ETHEREAL=虚无, INNATE=固有, RETAIN=保留, ETERNAL=永恒, SLY=奇巧

### 5.3 Community slang (玩家黑话) met in the sources

| Slang | Meaning | Confidence |
|---|---|---|
| 煎饼 / 剑柄 | POMMEL_STRIKE | high (context) |
| 肚皮 | BODY_SLAM | high (article gives 肚皮（全身撞击）) |
| 金人 / 小金人 | IMPERVIOUS | high (article gives 小金人（岿然不动）) |
| 黑拥 | DARK_EMBRACE | high |
| 振 / 重振 | SECOND_WIND | high |
| 战专 | BATTLE_TRANCE | high |
| 无惧 | FEEL_NO_PAIN | high |
| 吃人 | FEED | high |
| 恶魔火 | FIEND_FIRE | high |
| 逃哥 | STAMPEDE | high |
| 仪式 | FORGOTTEN_RITUAL | high |
| 小黑 / 墨灵 | VANTOM | high (article gives 小黑（墨影幻灵）) |
| 沙虫 / 虫子 | THE_INSATIABLE | medium |
| 珊瑚爹 / 瀑布 / 灵魂鱼 / 养蜂人 / 千足虫 / 棱柱 / 沙漏 | SKULKING_COLONY / WATERFALL_GIANT / SOUL_FYSH / ENTOMANCER / DECIMILLIPEDE / INFESTED_PRISMS / AEONGLASS | high |
| 大头 | Overgrowth path-blocking elite that uses Slow; probably BYGONE_EFFIGY | inference |
| 密林 / 暗港 | Overgrowth / Underdocks (the two act-1 maps) | high |
| 白X / 绿X | unupgraded / upgraded X | high |
| 敲 (敲位) / 睡觉 | Smith at a rest site (upgrade slot) / Rest | high |
| 烧 / 点烧 / 大烧 | Exhaust / single-target exhaust (Burning Pact, Havoc…) / mass exhaust (Fiend Fire, Second Wind) | high |
| 过渡 / 终端 / 上限 | early-fight stopgap cards / win-condition (finisher) / scaling ceiling | high |
| 运转 / 过牌 / 加费 | engine / card draw / energy gain | high |
| 无限 / 小循环 | infinite loop / small deck loop (reshuffle every turn or two) | high |
| 攻杀 / 防杀 | win by out-damaging / win by out-blocking | high |
| 塞牌 | enemy adds status/junk cards | high |
| SL / nosl | save-load abuse allowed / not allowed (nosl = honest runs) | high |
| 至亮 | Brightest Flame (至亮之焰, event card from Storybook) | high (codex zhs) |
| 大抱抱 | relic BIIIG_HUG (大～抱抱) | high (codex zhs) |
| 本能 / 华彩 / 活力 / 锋利 | enchantments INSTINCT / GLAM / VIGOROUS / SHARP | high |
| 亮剑 / 妙计 / 勒紧 / 急躁 | colourless FLASH_OF_STEEL / FINESSE / FASTEN / IMPATIENCE | high (codex zhs) |
| 堡垒 | Barricade (壁垒), informal | medium |
| 攻哈 / 防哈 | attack-heavy / block-heavy play | high |
| 鬼抽 | bad draw order (brick) | high |
| 爽种 / 毒种 / 天胡 | easy seed / cursed seed / god start | high |
| 蠕动 | crawling through a weak run | high |
