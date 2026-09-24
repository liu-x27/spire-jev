# Relic value table: A10 Ironclad (Slay the Spire 2, beta v0.111.0)

Compiled 2026-09-23 for spire-jev's shop logic. Read-only web research, paraphrased.
Scope: every non-Ancient relic an Ironclad can get (shared pool + Ironclad pool + event/fake relics).
Other characters' relics are left out because they don't drop for Ironclad.
Ancient relics are covered elsewhere (`STRATEGY-research.md` §9b). Nine ids in the bot's run log are Ancients, so they are **not** in this table:
BLESSED_ANTLER, CROSSBOW, DELICATE_FROND, DIAMOND_DIADEM, FIDDLE, GLITTER, JEWELRY_BOX, LOOMING_FRUIT, WHISPERING_EARRING.

## 0. Sources

| Key | Source | Date / version | What it gives | Weight |
|---|---|---|---|---|
| **n1** | DoggertQBones, [The Complete Relic Tier List for Slay the Spire 2][n1] (Nat 1 Gaming) | 2026-05-19, around v0.105 | An expert S–F tier for every relic, with A10 remarks (Tent, Feather, Pantograph) | Primary |
| **JB** | Jorbs' public run sheet, "Relics" tab ([sheet][jsheet], read through its CSV view) | v0.98.0–0.106.1 (Mar–May 2026) | Per relic: wins / picks / win % and a "vs baseline" column (pp). The baseline differs by relic, so it seems to adjust for when the relic was picked up. **Small n.** | Data; trusted only when n ≥ 15 |
| **MB** | MetaBot.GG [Ironclad relic tier list][mb] | Sep 2026 | Ironclad win rate while holding the relic, blended with pick rate into S–F | Data, heavily survivorship-biased |
| **SC** | Spire Codex [relic tier list][sc-tier] (community-uploaded runs, Bayesian-shrunk "Codex Score" 0–100), plus the [relic pages][sc-relics] (effect text from game data) and the [merchant page][sc-merch] | "main" data; no patch shown | Effects, prices, and an overall score for all characters | Effects: high. Score: tie-breaker only |
| **wiki** | slaythespire.wiki.gg: [Relics][w-rel], [The Merchant][w-merch], [The Merchant???][w-fake], [Enchantments][w-ench], patch pages [v0.106][w106], [v0.109][w109], [v0.110][w110], [v0.111][w111] | updated through v0.111.0 | Rarity, shop rules, beta changes | High for facts |

**Not usable:**

- Untapped.gg returned HTTP 403 on every page. Search snippets gave the same buy-rate numbers ("41–42% bought, +6% act WR") for many different relics, so they are templated and I dropped them.
- Mobalytics: 403.
- Reddit: fetch blocked.
- Consulted but not used: slaythetierlist.com (anonymous, v0.107.1, e.g. Maw Bank in A tier) and Switchblade Gaming (lists StS1 relics such as Spoon and Busted Crown). SpireSpy is StS1 only.

**Why the data columns are biased.** Win rate while holding a relic rewards relics picked up late. Only runs that survive reach Act 3 events and late shops. So in SC/MB, Act-3 event relics and late shop buys (Forgotten Soul, Royal Poison, Chemical X, Cauldron) score near the top, and early commons and the eggs score low. The rare Sword of Stone scores ~0 because it turns into Sword of Jade. Treat SC/MB as direction hints within one rarity, never as a ranking. JB's per-relic baseline partly corrects for this, but most of its n are tiny.

**How I combined them.**

1. Start from the n1 tier.
2. Move one step up or down only when JB (n ≥ 15) and MB point the same way.
3. SC breaks ties.
4. Then adjust for Ironclad at A10 and for what the bot can execute. These adjustments are tagged `[inference]`.

Tier → value: S 0.85–1, A 0.70–0.84, B 0.58–0.69, C 0.45–0.57, D 0.30–0.44, F < 0.30. The value is how good the relic is if bought in Act 1–2. Rule 5 below discounts it by act.

**Tags:** `[data]` JB n ≥ 15 or MB agrees with the tier. `[several]` n1 and at least one data source are within one tier of each other. `[one]` only n1 has an informed view. `[disputed]` sources differ by two or more tiers. `[inference]` my reasoning, not yet checked in the simulator.

**Evidence shorthand in the last column:** `n1 A` is DoggertQBones' tier. `JB +9.8 (16)` is Jorbs' vs-baseline in pp, with his pick count in brackets (all characters unless it says IC). `MB C` is the MetaBot Ironclad tier. `SC 85` is the Codex Score.

### 0.1 Shop facts the rules depend on (StS2, [wiki][w-merch], [Spire Codex][sc-merch])

- There are 3 relic slots. The right slot is always a **Shop** relic. The other two roll Common 50%, Uncommon 33%, Rare 17%.
- Relic prices: Common 149–201, Shop 170–230, Uncommon 191–259, Rare 234–316 gold.
- Card removal at **A6+** costs **100, then +50 each** (100/150/200…), one per visit.
- Cards cost about 50/75/150 (Common/Uncommon/Rare).
- **Never sold in shops:** Amethyst Aubergine, Bowler Hat, Lucky Fysh, Old Coin, The Courier. Their values below are for chest, elite and event contexts.
- A10 run modifiers that change relic values: A1 more elites; A3 25% less gold; A4 one fewer potion slot; A6 dearer removal; A7 fewer rare and upgraded cards; A10 two Act 3 bosses ([STRATEGY-research §1][strat]).
- Relic changes since the n1 list:
  - Mummified Hand targets 1+ cost cards more reliably (v0.106, buff).
  - History Course repeats **Attacks only** (v0.109, nerf).
  - Nothing else changed for Ironclad-relevant non-Ancient relics in v0.104–v0.111.

## 1. Relic table

Sorted by rarity (Shop first), then value.

| id | rarity | StS2 effect (short) | tier | value | conditions | evidence |
|---|---|---|---|---|---|---|
| MINIATURE_TENT (id guessed) | Shop | At rest sites, take any number of the options | S | 0.90 | Best at A10: heal *and* upgrade at every fire. Needs a bot handler for multi-option rests. Worth less once few fires remain. | `[several]` n1 S · SC 83 · JB +2.6 (10) · MB C |
| KIFUDA | Shop | On pickup, choose up to 3 cards to gain Adroit (extra Block when played) | A | 0.72 | Pick cards played every fight. Needs a card-choice handler. Jorbs' most-bought shop relic. | `[several]` `[data]` n1 B · JB +9.8 (16) · MB S · SC 95 |
| DOLLYS_MIRROR (id guessed) | Shop | On pickup, duplicate one card in your deck | B | 0.65 | Only as good as the best card to copy (Offering, Feel No Pain, Demon Form, Dominate). C if none. Needs a choice handler. | `[several]` n1 B · JB +2.7 (13) · MB C · SC 97 |
| MEMBERSHIP_CARD | Shop | All merchant prices halved | B | 0.64 | A (0.75) in Act 1 with 2+ shops still ahead. D (0.30) at the last shop. See rule 3. | `[disputed]` n1 A · JB −13.1 (10) · MB D · SC 73 |
| BURNING_STICKS (id guessed) | Shop | First Skill you Exhaust each combat returns a copy to hand | B | 0.64 | Needs exhausting Skills (Offering, Burning Pact, True Grit, Second Wind). C without them. | `[several]` n1 B · MB S · SC 100 · JB −5.5 (5) |
| LEES_WAFFLE (id guessed) | Shop | On pickup, +7 max HP and heal to full | B | 0.62 | 0.80 at ≤ 50% HP with a boss or elite ahead. 0.45 near full HP (rule 6). | `[several]` n1 B · JB +6 (12) · MB S · SC 73 |
| GNARLED_HAMMER | Shop | On pickup, up to 3 Attacks gain Sharp 3 (+3 damage) | B | 0.62 | Best on multi-hit or cheap repeat attacks (Twin Strike, Whirlwind, Pommel Strike). Needs a choice handler. | `[several]` n1 C · MB S · SC 87 · JB +19.8 (2) |
| ROYAL_STAMP (id guessed) | Shop | On pickup, one Attack or Skill becomes Innate + Retain | B | 0.60 | Put it on Offering, Bash or a key setup card. C if the deck has no standout card. | `[disputed]` n1 C · MB S · SC 96 · JB −0.5 (7) |
| DRAGON_FRUIT | Shop | Each time you gain gold, +1 max HP | B | 0.58 | Early buys only (about 1 HP per fight plus events). A3 trims gold events a little. | `[several]` n1 B · MB B · SC 63 · JB +2.8 (5) |
| TOOLBOX | Shop | At combat start, pick 1 of 3 random Colorless cards into hand | B | 0.58 | Needs a choice handler. Otherwise D. | `[several]` n1 C · MB B · SC 93 · JB +4 (8) |
| BREAD (id guessed) | Shop | Turn 1: −2 energy; every later turn: +1 energy | C | 0.55 | Good in long boss and elite fights. Bad in short Act 1 hallways. Lantern cancels the turn-1 hit. | `[disputed]` n1 C · SC 89 · MB C · JB −22.3 (11) |
| GHOST_SEED (id guessed) | Shop | Strikes and Defends gain Ethereal | C | 0.55 | Thins starters within a fight and feeds exhaust payoffs. Bad for Hellraiser or Strike-payoff decks. | `[disputed]` n1 C · SC 87 · MB B · JB −15.5 (5) |
| BRIMSTONE | Shop (Ironclad) | Each turn: you +2 Strength, all enemies +1 Strength | C | 0.52 | Better in short single-target fights with multi-hit attacks. D against 3-enemy hallways, long bosses, or a weak-block deck. | `[disputed]` n1 D · MB S · SC 58 · JB +15.7 (2) |
| ORRERY (id guessed) | Shop | On pickup, 5 card rewards | C | 0.52 | Act 1 best. Capped by the bot's card-pick quality. Weak in Act 3. | `[several]` n1 C · JB −8.6 (14) · MB C · SC 78 |
| RINGING_TRIANGLE | Shop | Keep your hand at the end of turn 1 | C | 0.50 | Helps setup Powers. n1 compares it to Bag of Preparation. | `[several]` n1 C · MB B · SC 100 · JB +18.4 (1) |
| THE_ABACUS | Shop | Gain 6 Block whenever your draw pile is shuffled | C | 0.50 | Needs no setup. Better with a thin deck or lots of draw. | `[several]` n1 C · MB D · SC 100 |
| SLING_OF_COURAGE (id guessed) | Shop | Start elite fights with 2 Strength | C | 0.48 | A1 means more elites. Worth more with many elites left on the route. | `[disputed]` n1 D · MB S · SC 84 · JB +37 (1) |
| WING_CHARM (id guessed) | Shop | One card in each card reward gets Swift 1 (draw on first play) | C | 0.48 | Needs many rewards still to come. Act 1 best. | `[several]` n1 C · MB D · SC 89 · JB +15.7 (2) |
| CHEMICAL_X (id guessed) | Shop | X-cost cards count X as 2 higher | C | 0.45 | A (0.75) with Whirlwind (Ironclad's X card) in the deck. F without an X card. | `[disputed]` n1 C · MB S · SC 98 · JB −40.5 (2) |
| PUNCH_DAGGER (id guessed) | Shop | On pickup, one Attack gains Momentum 5 (+5 damage per play that combat) | C | 0.45 | Put it on a cheap attack played every fight. Needs a choice handler. | `[disputed]` n1 C · MB F · SC 81 · JB −6.8 (8) |
| SCREAMING_FLAGON | Shop | End turn with an empty hand: 20 damage to all enemies | C | 0.45 | Needs a low-curve, high-draw deck that plays out its hand. | `[several]` n1 C · MB D · SC 79 · JB −10.4 (3) |
| BELT_BUCKLE (id guessed) | Shop | +2 Dexterity while you hold no potions | D | 0.40 | Conflicts with keeping potions (A4 already cuts a slot). | `[disputed]` n1 D · MB B · SC 88 |
| CAULDRON (id guessed) | Shop | On pickup, brew 5 random potions | D | 0.40 | Capped by potion slots. Better right before a boss or with Potion Belt. | `[disputed]` n1 D · SC 100 · JB −88.9 (1) |
| LAVA_LAMP (id guessed) | Shop | Take no damage in a fight and its card rewards are upgraded | D | 0.38 | A bot at A10 rarely takes zero damage outside easy hallways. | `[disputed]` n1 D · MB B · SC 93 · JB −62.8 (1) |
| MYSTIC_LIGHTER (id guessed) | Shop | Enchanted Attacks deal +9 damage | D | 0.35 | C–B only with 2+ enchanted Attacks (Gnarled Hammer, Punch Dagger, events). | `[disputed]` n1 C · MB F · SC 94 · JB −4.7 (6) |
| DINGY_RUG | Shop | Card rewards can include Colorless cards | F | 0.15 | Dilutes Ironclad rewards. Never buy. | `[several]` n1 F · MB F |
| ANCHOR | Common | Start each combat with 10 Block | B | 0.66 | Front-loaded. Best in Acts 1–2 hallways, fades by Act 3. | `[several]` n1 A · JB 0 (76) · MB C · SC 66 |
| GORGET | Common | Start each combat with 4 Plating | B | 0.62 | n1 calls it Anchor spread over turns. Better in long fights. | `[several]` `[data]` n1 B · JB +5.5 (79) · MB D · SC 67 |
| BAG_OF_PREPARATION | Common | Draw 2 extra cards on turn 1 | B | 0.62 | Good for any deck. | `[several]` n1 B · JB +0.3 (75) · MB C · SC 69 |
| ODDLY_SMOOTH_STONE | Common | Start each combat with 1 Dexterity | B | 0.60 | Block-heavy decks. | `[data]` n1 C · JB +10.3 (78) · MB C · SC 65 |
| RED_SKULL (id guessed) | Common (Ironclad) | +3 Strength while HP ≤ 50% | B | 0.60 | Good with self-damage (Bloodletting, Offering) and Meat on the Bone. | `[disputed]` n1 C · JB IC +22.8 (9) · MB D · SC 81 |
| REGAL_PILLOW | Common | Resting heals 15 more HP | B | 0.58 | A10 rests more often (double Act 3 boss). Stacks with Miniature Tent. | `[several]` n1 B · JB +3.2 (73) · MB C · SC 59 |
| CENTENNIAL_PUZZLE | Common | First HP loss each combat: draw 3 | C | 0.56 | B (0.62) with a self-damage card that triggers it at will. | `[several]` n1 C · JB −1.6 (86) · MB C · SC 69 · `[inference]` |
| HAPPY_FLOWER | Common | +1 energy every 3 turns | C | 0.55 | Better in long fights. | `[several]` n1 C · JB −1.6 (81) · MB B · SC 67 |
| RED_MASK | Common | Combat start: 1 Weak to all enemies | C | 0.52 | Good against multi-enemy and multi-hit fights. Useless against some bosses (n1). | `[several]` n1 C · JB +7.8 (53) · MB D · SC 65 |
| WAR_PAINT | Common | On pickup, upgrade 2 random Skills | C | 0.52 | A7 makes free upgrades scarcer. | `[several]` n1 C · JB +1.1 (76) · MB C · SC 65 |
| LANTERN | Common | +1 energy on turn 1 | C | 0.52 | Stacks well with Bread. | `[several]` n1 C · JB −1.6 (88) · MB C · SC 63 |
| PENDULUM | Common | Draw 1 extra card every 3 turns | C | 0.52 | Long fights. | `[disputed]` n1 D · JB +10.3 (61) · MB C · SC 67 |
| WHETSTONE | Common | On pickup, upgrade 2 random Attacks | C | 0.50 | A7 bump. | `[several]` n1 C · JB −5.6 (67) · MB D · SC 62 |
| VAJRA | Common | Start each combat with 1 Strength | C | 0.50 | Doubled by Ruined Helmet. Better with multi-hit attacks. | `[several]` n1 C · JB +2.6 (70) · MB D · SC 61 |
| FESTIVE_POPPER (id guessed) | Common | Combat start: 9 damage to all enemies | C | 0.50 | Act 1 multi-enemy hallways. | `[several]` n1 C · JB −4.5 (71) · MB C · SC 63 |
| POTION_BELT | Common | On pickup, +2 potion slots | C | 0.50 | Makes up for A4's lost slot. Better with White Beast Statue or Cauldron. | `[several]` n1 C · JB +1.1 (77) · MB D · SC 63 |
| BAG_OF_MARBLES | Common | Combat start: 1 Vulnerable to all enemies | C | 0.50 | Better with Paper Phrog. | `[several]` n1 C · JB −0.4 (48) · MB C · SC 63 |
| STRAWBERRY | Common | On pickup, +7 max HP | C | 0.45 | Flat value. | `[several]` n1 C · JB −1.3 (74) · MB C · SC 63 |
| BRONZE_SCALES | Common | Start each combat with 3 Thorns | C | 0.45 | Good against multi-hit enemies. | `[several]` n1 C · JB −5.4 (62) · MB D · SC 64 |
| VENERABLE_TEA_SET | Common | After a rest site, the next combat starts with +2 energy | C | 0.45 | Best when a rest site comes right before a boss. | `[several]` n1 C · JB −10.8 (66) · MB B · SC 63 |
| BOOK_OF_FIVE_RINGS (id guessed) | Common | Every 5 cards added to the deck: heal 20 | C | 0.45 | Pays off only with frequent card adds. | `[disputed]` n1 D · JB +14.5 (48) · MB D · SC 43 |
| STRIKE_DUMMY | Common | Cards named "Strike" deal +3 damage | C | 0.45 | B with Hellraiser / Perfected Strike. D once Strikes are removed. | `[several]` n1 D · JB IC +14.5 (13) · MB D · SC 60 |
| BLOOD_VIAL | Common | Combat start: heal 2 | D | 0.38 | Mostly redundant with Burning Blood. | `[several]` n1 D · JB −5.9 (70) · MB C · SC 59 |
| MEAL_TICKET | Common | Heal 15 when you enter a shop | D | 0.38 | Only as good as the number of shops ahead. | `[several]` n1 C · JB −1.6 (55) · MB D · SC 42 |
| AMETHYST_AUBERGINE | Common | Enemies drop 15 more gold | D | 0.35 | Never in shops. Early only. | `[several]` n1 C · JB −6.2 (26) · MB D · SC 41 |
| JUZU_BRACELET | Common | ? rooms no longer roll normal fights | F | 0.20 | Costs you rewards. | `[several]` n1 F · JB +0.6 (57) · MB F · SC 38 |
| PANTOGRAPH | Uncommon | Heal 25 at the start of each boss fight | A | 0.76 | A10 has 4 boss fights, including 2 back-to-back in Act 3. Keeps its value into Act 3. | `[several]` `[data]` n1 A · JB +14.5 (25) · MB C · SC 70 |
| HORN_CLEAT | Uncommon | Gain 14 Block at the start of turn 2 | B | 0.62 | Most enemies attack on turn 2 (n1). | `[disputed]` n1 A · JB −5.1 (43) · MB C · SC 75 |
| ETERNAL_FEATHER | Uncommon | Rest sites: heal 3 per 5 cards in the deck | B | 0.62 | A10 rests often. Scales with deck size. | `[several]` n1 A · JB +0.6 (30) · MB C · SC 69 |
| PAPER_PHROG (id guessed) | Uncommon (Ironclad) | Vulnerable enemies take 75% more damage (not 50%) | B | 0.60 | Needs 2+ Vulnerable sources (Bash, Bag of Marbles, Tremble, Uppercut). | `[disputed]` n1 D · JB IC +20.7 (7) · MB C · SC 82 |
| SELF_FORMING_CLAY (id guessed) | Uncommon (Ironclad) | When you lose HP in combat, gain 3 Block next turn | B | 0.60 | Self-damage decks. | `[disputed]` n1 C · MB B · SC 84 · JB +5.4 (4) |
| CANDELABRA | Uncommon | +2 energy at the start of turn 2 | C | 0.55 | Fits decks with expensive turn-2 plays. | `[disputed]` n1 B · JB −10.2 (42) · MB D · SC 72 |
| MERCURY_HOURGLASS | Uncommon | Start of your turn: 3 damage to all enemies | C | 0.52 | Good against swarms and against Slippery (it strips a stack each turn). | `[several]` n1 C · JB +2.7 (41) · MB D · SC 69 |
| SPARKLING_ROUGE | Uncommon | Start of turn 3: +1 Strength and +1 Dexterity | C | 0.50 | Long fights. | `[several]` n1 C · JB −0.8 (40) · MB D · SC 70 |
| PEAR | Uncommon | On pickup, +10 max HP | C | 0.50 | Flat value. | `[several]` n1 C · JB −1.1 (42) · MB D · SC 71 |
| PEN_NIB | Uncommon | Every 10th Attack deals double damage | C | 0.48 | Better with big single hits (Bludgeon-style) and Strength. | `[several]` n1 C · JB −2.5 (39) · MB B · SC 67 |
| STONE_CRACKER | Uncommon | Combat start: upgrade 2 random draw-pile cards for that fight | C | 0.48 | Better with a thin deck of un-upgraded cards. | `[several]` n1 C · JB −3.7 (33) · MB D · SC 65 |
| AKABEKO | Uncommon | Start each combat with 8 Vigor | C | 0.45 | Better if the first attack is multi-hit (n1). | `[several]` n1 C · JB −7.2 (40) · MB D · SC 65 |
| VAMBRACE | Uncommon | First Block from a card each combat is doubled | C | 0.45 | Block decks. | `[several]` n1 C · JB −6.4 (32) · MB C · SC 66 |
| ORICHALCUM | Uncommon | End turn with no Block: gain 6 Block | C | 0.45 | For aggressive decks that skip blocking. | `[several]` n1 C · JB −2.2 (31) · MB C · SC 66 |
| PERMAFROST | Uncommon | First Power each combat: gain 7 Block | C | 0.45 | Needs Powers. | `[several]` n1 C · JB +6.3 (25) · MB D · SC 69 |
| GREMLIN_HORN | Uncommon | When an enemy dies: +1 energy, draw 1 | C | 0.45 | Multi-enemy fights. | `[several]` n1 C · JB −5 (36) · MB D · SC 62 |
| JOSS_PAPER (id guessed) | Uncommon | Every 5 Exhausts: draw 1 | C | 0.45 | Exhaust decks. | `[several]` n1 C · JB +2.9 (34) · MB D · SC 67 |
| PETRIFIED_TOAD (id guessed) | Uncommon | Combat start: get a Potion-Shaped Rock potion | C | 0.45 | The bot must actually use potions. | `[several]` n1 C · JB −1 (37) · MB C · SC 63 |
| TINY_MAILBOX (id guessed) | Uncommon | Resting gives 2 random potions | C | 0.45 | A4 slot limit. Wasted with full slots. | `[disputed]` n1 D · JB +10.1 (29) · MB C · SC 68 |
| KUSARIGAMA (id guessed) | Uncommon | Every 3 Attacks in a turn: deal 6 damage | C | 0.45 | Cheap-attack decks. | `[several]` n1 D · JB +4 (30) · MB C · SC 64 |
| PLANISPHERE (id guessed) | Uncommon | Heal 5 on entering a ? room | C | 0.45 | Routes with many ? rooms. | `[several]` n1 C · JB +4.1 (26) · MB C · SC 44 |
| LUCKY_FYSH | Uncommon | Gain 15 gold whenever a card is added to the deck | D | 0.40 | Never in shops. Early only. | `[disputed]` n1 D · JB +20 (23) · MB D · SC 43 |
| NUNCHAKU | Uncommon | Every 10 Attacks played: +1 energy | D | 0.40 | Attack-spam decks. | `[several]` n1 D · JB −6 (27) · MB C · SC 66 |
| ORNAMENTAL_FAN | Uncommon | Every 3 Attacks in a turn: gain 4 Block | D | 0.40 | Cheap-attack decks. | `[several]` n1 D · JB +2 (38) · MB D · SC 68 |
| PARRYING_SHIELD | Uncommon | End turn with 10+ Block: deal 6 damage | D | 0.40 | Block decks. | `[several]` n1 D · JB −1 (43) · MB C · SC 67 |
| TUNING_FORK | Uncommon | Every 10 Skills played: gain 7 Block | D | 0.40 | Skill-heavy decks. | `[several]` n1 C · JB −8.6 (39) · MB D · SC 69 |
| REPTILE_TRINKET (id guessed) | Uncommon | Using a potion: +3 Strength this turn | D | 0.40 | Needs potion use. | `[several]` n1 D · JB +3.8 (35) · MB C · SC 61 |
| RIPPLE_BASIN (id guessed) | Uncommon | Turn with no Attacks played: gain 4 Block | D | 0.38 | Ironclad attacks most turns. | `[disputed]` n1 D · JB +10.6 (41) · MB D · SC 65 |
| MINIATURE_CANNON (id guessed) | Uncommon | Upgraded Attacks deal +3 damage | D | 0.38 | Needs many upgraded attacks (Molten Egg). | `[several]` n1 C · JB −17.7 (32) · MB D · SC 67 |
| LASTING_CANDY (id guessed) | Uncommon | Every other combat, card rewards add an extra Power option | D | 0.35 | Card-reward value only. | `[several]` n1 C · JB +0.5 (21) · MB D · SC 40 |
| LETTER_OPENER | Uncommon | Every 3 Skills in a turn: deal 5 damage | D | 0.35 | Skill-spam decks only. | `[several]` n1 D · JB −7.8 (27) · MB F · SC 65 |
| BOWLER_HAT | Uncommon | Gain 25% more gold | D | 0.33 | Never in shops. Worth more early. | `[several]` n1 C · JB −2.8 (22) · MB F · SC 40 |
| LIZARD_TAIL (id guessed) | Rare | Once per run, at 0 HP heal to 50% instead of dying | A | 0.80 | Insurance for the A10 double boss. Allows riskier lines. | `[several]` `[data]` n1 A · JB +22 (19) · MB B · SC 88 |
| MOLTEN_EGG | Rare | Attacks you add to the deck arrive upgraded | A | 0.78 | Best early. A7 makes upgraded cards scarce. Ironclad adds many attacks. | `[several]` n1 A · JB +17.5 (11) · MB S · SC 49 |
| ICE_CREAM (id guessed) | Rare | Unspent energy carries over to next turn | A | 0.76 | Strong with energy spikes (Offering, Bloodletting). Needs the bot to plan across turns. | `[several]` n1 A · JB +5.5 (24) · MB C · SC 80 |
| POCKETWATCH | Rare | Play ≤ 3 cards in a turn: draw 3 more next turn | A | 0.72 | Ironclad's dense 2-cost cards trigger it often. | `[several]` `[data]` n1 B · JB +15.3 (24) · MB B · SC 85 |
| GAMBLING_CHIP | Rare | Combat start: discard any cards and redraw that many | A | 0.70 | Needs a mulligan policy. Worth about 0.50 until the bot has one. | `[several]` n1 A · JB −2.3 (22) · MB B · SC 76 |
| CLOAK_CLASP | Rare | End of turn: 1 Block per card left in hand | B | 0.68 | Good with Retain or high draw. | `[several]` `[data]` n1 B · JB +9.6 (21) · MB B · SC 85 |
| STURDY_CLAMP | Rare | Up to 10 Block carries over between turns | B | 0.66 | Block decks. | `[several]` `[data]` n1 B · JB +1.9 (25) · MB B · SC 85 |
| CHANDELIER | Rare | +3 energy at the start of turn 3 | B | 0.66 | Big setup turn for bosses and elites. | `[several]` n1 B · JB −2.3 (13) · MB B · SC 79 |
| MUMMIFIED_HAND | Rare | Playing a Power makes a random 1+ cost card in hand free | B | 0.66 | Needs 2+ Powers. Buffed in v0.106. | `[several]` n1 B · JB −1.9 (16) · MB S · SC 83 |
| TOXIC_EGG (id guessed) | Rare | Skills you add to the deck arrive upgraded | B | 0.64 | Best early. | `[several]` n1 A · JB +16.6 (12) · MB D · SC 61 |
| RAINBOW_RING | Rare | Play an Attack, Skill and Power in one turn: +1 Strength, +1 Dexterity | B | 0.64 | Needs several Powers to trigger often. | `[several]` n1 B · JB +10.9 (14) · MB B · SC 79 |
| UNSETTLING_LAMP (id guessed) | Rare | First debuff card each combat has double effect | B | 0.62 | Bash applies 4 Vulnerable instead of 2. n1 calls it underrated. | `[several]` n1 B · JB +13.7 (12) · MB B · SC 71 |
| CAPTAINS_WHEEL | Rare | Gain 18 Block at the start of turn 3 | B | 0.62 | Pays off even when fights end early (n1). | `[several]` n1 B · JB +7.6 (15) · MB C · SC 77 |
| PRAYER_WHEEL (id guessed) | Rare | Normal fights give an extra card reward | B | 0.62 | Capped by the bot's pick and skip discipline. | `[several]` n1 A · JB +2.4 (13) · MB C · SC 69 |
| RUINED_HELMET (id guessed) | Rare (Ironclad) | First Strength gain each combat is doubled | B | 0.62 | Needs an early Strength source (Inflame, Vajra, Sword of Jade, Red Skull). | `[several]` n1 B · MB S · SC 83 · JB −1.2 (4) |
| FROZEN_EGG | Rare | Powers you add to the deck arrive upgraded | B | 0.60 | Fewer Powers than attacks are offered, so it's the weakest egg (n1). | `[disputed]` n1 A · JB +19.2 (8) · MB D · SC 52 |
| DEMON_TONGUE (id guessed) | Rare (Ironclad) | First HP loss on your turn each turn is healed back | B | 0.60 | Makes Bloodletting / Offering / Hemokinesis costless. C without self-damage. | `[several]` n1 B · MB D · SC 79 · JB +9.9 (2) |
| RAZOR_TOOTH (id guessed) | Rare | Attacks and Skills upgrade for the rest of combat when played | B | 0.60 | Better in long fights and with a thin deck. | `[disputed]` n1 C · JB +19.4 (16) · MB B · SC 77 |
| TUNGSTEN_ROD (id guessed) | Rare | Lose 1 less HP from each HP loss | B | 0.60 | Good against multi-hit attacks and your own self-damage. | `[disputed]` n1 B · JB +8.5 (21) · MB F · SC 76 |
| INTIMIDATING_HELMET (id guessed) | Rare | Playing a card that costs 2+: gain 4 Block | B | 0.60 | Ironclad has many 2-costs. | `[several]` n1 C · JB +10.9 (17) · MB B · SC 78 |
| MANGO | Rare | On pickup, +14 max HP | B | 0.58 | Flat value. | `[several]` n1 B · JB −3.1 (17) · MB B · SC 78 |
| BELLOWS | Rare | Your first hand each combat is upgraded | B | 0.58 | Better with a thin deck. | `[several]` n1 C · JB ≈+1 (22) · MB C · SC 82 |
| WHITE_STAR (id guessed) | Rare | Elites drop an extra Rare card reward | B | 0.58 | A1 means more elites, and A7 cuts rares. Early pickups only. | `[several]` n1 B · JB +19.1 (16) · MB D · SC 53 |
| WHITE_BEAST_STATUE (id guessed) | Rare | Every combat reward includes a potion | C | 0.55 | A4 slot cap. The bot must use potions freely. | `[disputed]` n1 A · JB +10 (10) · MB F · SC 51 |
| OLD_COIN | Rare | On pickup, gain 300 gold | C | 0.55 | Never in shops. B in Act 1 with shops ahead. | `[several]` n1 B · JB −14.7 (13) · MB C · SC 54 |
| GAME_PIECE | Rare | Playing a Power: draw 1 | C | 0.52 | Needs 3+ Powers. | `[several]` n1 C · JB −6.3 (17) · MB B · SC 80 |
| MEAT_ON_THE_BONE | Rare | End combat at ≤ 50% HP: heal 12 | C | 0.52 | Good with Red Skull and low-HP play. | `[several]` n1 C · JB +3 (13) · MB C · SC 71 |
| VEXING_PUZZLEBOX (id guessed) | Rare | Combat start: a random card, free this turn, enters your hand | C | 0.50 | Often gives an off-plan card (n1). | `[several]` n1 C · JB +6.5 (9) · MB B · SC 77 |
| ART_OF_WAR | Rare | Turn with no Attacks played: +1 energy next turn | C | 0.50 | Ironclad attacks most turns. Better for block / Barricade decks. | `[several]` n1 B · JB −1.8 (17) · MB C · SC 69 |
| SHURIKEN | Rare | Every 3 Attacks in a turn: +1 Strength | C | 0.50 | Cheap multi-attack Strength decks. | `[several]` n1 D · JB +8.4 (20) · MB C · SC 76 |
| CHARONS_ASHES (id guessed) | Rare (Ironclad) | Whenever you Exhaust a card: 3 damage to all enemies | C | 0.50 | B with 4+ exhaust sources. n1 says Ironclad exhausts less in StS2. | `[disputed]` n1 D · MB C · SC 79 · JB +20.5 (2) |
| UNCEASING_TOP | Rare | Draw a card whenever your hand is empty | C | 0.48 | Low-curve decks. | `[several]` n1 C · JB −4.3 (21) · MB C · SC 71 |
| STONE_CALENDAR | Rare | End of turn 7: 52 damage to all enemies | C | 0.48 | Only long fights (bosses) reach turn 7. | `[several]` n1 C · JB +10.5 (19) · MB D · SC 67 |
| THE_COURIER | Rare | Merchant restocks sold items, and prices drop 20% | C | 0.45 | Never in shops. Worth more with many shops ahead. | `[several]` n1 C · JB +2.2 (16) · MB D · SC 67 |
| BEATING_REMNANT (id guessed) | Rare | You lose at most 20 HP per turn | D | 0.40 | Rarely triggers (n1). | `[several]` n1 D · JB +5.9 (20) · MB C · SC 70 |
| KUNAI | Rare | Every 3 Attacks in a turn: +1 Dexterity | D | 0.38 | Cheap-attack decks. | `[several]` `[data]` n1 D · JB −26.6 (18) · MB C · SC 76 |
| SHOVEL | Rare | Rest sites gain a Dig option (random relic) | D | 0.35 | Competes with rest/upgrade at A10. Needs a rest-option handler. | `[several]` n1 C · JB −2.6 (9) · MB D · SC 48 |
| GIRYA | Rare | Rest sites gain Lift (+1 Strength, 3 times max) | D | 0.30 | Competes with rest/upgrade at A10. | `[several]` n1 D · JB −16.2 (5) · MB D · SC 47 |
| BURNING_BLOOD | Starter (Ironclad) | Heal 6 HP at the end of each combat | B | 0.60 | Not buyable. Listed for comparison only. | `[one]` n1 B |
| HISTORY_COURSE (id guessed) | Event | Start of turn: replay the last Attack you played (Attacks only since v0.109) | A | 0.85 | n1's S was before the nerf. Still top-tier for attack decks. | `[several]` n1 S · JB +4.4 (15) · MB S · SC 100 |
| SWORD_OF_JADE (id guessed) | Event | Start each combat with 3 Strength | A | 0.76 | Comes only from Sword of Stone. | `[several]` n1 B · JB +7.6 (22) · MB S · SC 100 |
| WONGOS_MYSTERY_TICKET (id guessed) | Event | After 5 more combats, receive 3 random relics | C | 0.55 | From Welcome to Wongo's (costs gold). Worse late in an act. | `[one]` n1 C · MB D · SC 58 |
| SWORD_OF_STONE | Event | Becomes Sword of Jade after 5 elite kills | C | 0.50 | A1 adds elites. Take it in Act 1 if you plan an elite route. | `[several]` n1 – · JB IC +9 (11) · SC/MB biased (it transforms) |
| POLLINOUS_CORE (id guessed) | Event | Every 4 turns: draw 2 extra cards | C | 0.50 | Long fights. | `[several]` n1 C · JB +13.8 (11) · MB B · SC 79 |
| MR_STRUGGLES | Event | Start of turn: damage equal to the turn number to all enemies | C | 0.48 | Grows in long fights. | `[several]` n1 C · JB +11.2 (10) · MB D · SC 46 |
| CHOSEN_CHEESE | Event | End of each combat: +1 max HP | C | 0.45 | Early is pure upside (n1). The event costs 14 HP. | `[several]` n1 C · JB +4 (58) · MB D · SC 17 |
| FRAGRANT_MUSHROOM (id guessed) | Event | On pickup, lose 15 HP and upgrade 2 random cards | C | 0.45 | Only when HP is comfortable. | `[several]` n1 C · JB +6.3 (23) · MB B · SC 100 |
| FORGOTTEN_SOUL (id guessed) | Event | Whenever you Exhaust: 1 damage to a random enemy | C | 0.45 | Exhaust decks. | `[disputed]` n1 F · JB +10.6 (21) · MB S · SC 100 |
| BIG_MUSHROOM | Event | +20 max HP; draw 2 fewer cards at combat start | D | 0.40 | The weaker opening hand hurts in Act 1. | `[disputed]` n1 D · JB −9.7 (10) · MB B · SC 89 |
| DAUGHTER_OF_THE_WIND | Event | Gain 1 Block whenever you play an Attack | D | 0.38 | Attack-spam decks. | `[several]` n1 D · MB D · SC 54 |
| BING_BONG | Event | Every card you add is added twice | D | 0.35 | Bloats the deck. Only good if the bot skips bad cards strictly. | `[disputed]` n1 C · JB +7.6 (22) · MB D · SC 40 |
| FRESNEL_LENS (id guessed) | Event | Block cards you add gain Nimble 2 (more Block) | D | 0.35 | The event also costs 13 max HP. | `[several]` n1 C · JB −15.8 (17) · MB F |
| LOST_WISP | Event | Playing a Power: 8 damage to all enemies | D | 0.35 | Comes with a Decay curse. | `[several]` n1 D · JB +22.9 (8) · MB F · SC 46 |
| DREAM_CATCHER (id guessed) | Event | Resting lets you add a card | D | 0.35 | Card-reward value only. | `[several]` n1 D · JB +10.4 (8) · MB F |
| EMBER_TEA (id guessed) | Event | Next 5 combats: start with 2 Strength | D | 0.30 | Temporary. | `[several]` n1 D · MB F · SC 3 |
| MAW_BANK (id guessed) | Event | +12 gold per floor climbed until you spend gold | D | 0.30 | Spending ends it. | `[several]` n1 D · MB F · SC 5 |
| HAND_DRILL (id guessed) | Event | Breaking enemy Block applies 2 Vulnerable | D | 0.30 | Niche. | `[several]` n1 F · MB D |
| DARKSTONE_PERIAPT (id guessed) | Event | Gain a curse: +6 max HP | F | 0.25 | Niche. | `[several]` n1 D · MB F |
| BYRDPIP (id guessed) | Event | Adds a Byrd Swoop card and a pet | F | 0.20 | Weak for Ironclad. | `[several]` n1 D · MB F |
| THE_BOOT (id guessed) | Event | Unblocked attack damage of 4 or less becomes 5 | F | 0.20 | Weak. | `[several]` n1 F · MB F |
| BONE_TEA | Event | Next combat only: starting hand upgraded | F | 0.15 | One-shot effect. | `[several]` n1 F · MB F · SC 4 |
| TEA_OF_DISCOURTESY | Event | Next combat only: 2 Dazed shuffled into the draw pile | F | 0.10 | Pure downside. | `[several]` n1 F · MB F · SC 21 |
| ROYAL_POISON | Event | Lose 4 HP at the start of every combat | F | 0.10 | Pure downside. Take it only for the full heal it comes with (Round Tea Party). | `[inference]` n1 D · MB/SC high = late-pickup bias |
| WONGO_CUSTOMER_APPRECIATION_BADGE (id guessed) | Event | Does nothing | F | 0.00 | – | `[one]` SC |
| FAKE_ANCHOR (id guessed) | Event (Merchant???) | Start each combat with 4 Block | D | 0.35 | About 50 gold. Stacks with the real Anchor. | `[several]` n1 D · JB −7.5 (10) · SC 51 |
| FAKE_VENERABLE_TEA_SET (id guessed) | Event (Merchant???) | After a rest site, the next combat has +1 energy | D | 0.35 | About 50 gold. | `[several]` n1 D · JB +13.3 (12) · SC 56 |
| FAKE_HAPPY_FLOWER (id guessed) | Event (Merchant???) | +1 energy every 5 turns | D | 0.35 | About 50 gold. | `[several]` n1 D · JB +2.4 (23) · SC 56 |
| FAKE_ORICHALCUM (id guessed) | Event (Merchant???) | End turn with no Block: gain 3 Block | D | 0.30 | About 50 gold. | `[several]` n1 D · SC 42 |
| FAKE_SNECKO_EYE (id guessed) | Event (Merchant???) | Start each combat Confused (random card costs) | D | 0.30 | No draw bonus, so it's pure variance. | `[disputed]` n1 C · `[inference]` |
| FAKE_MANGO (id guessed) | Event (Merchant???) | On pickup, +3 max HP | F | 0.20 | – | `[several]` n1 F · SC 42 |
| FAKE_LEES_WAFFLE (id guessed) | Event (Merchant???) | On pickup, heal 10% HP | F | 0.20 | – | `[several]` n1 F · SC 25 |
| FAKE_STRIKE_DUMMY (id guessed) | Event (Merchant???) | Cards named "Strike" deal +1 damage | F | 0.20 | – | `[several]` n1 F · SC 35 |
| FAKE_BLOOD_VIAL (id guessed) | Event (Merchant???) | Combat start: heal 1 | F | 0.15 | – | `[several]` n1 F · SC 34 |
| FAKE_MERCHANTS_RUG (id guessed) | Event (Merchant???) | Does nothing | F | 0.00 | Given as the reward for beating the fake merchant. | `[one]` SC |

## 2. Rules for the bot (shop relic buying)

All thresholds are starting calibrations. Tune them in the simulator.

1. **One gold scale for everything.** Score each item by surplus = gold-equivalent − price.
   - Relic gold-equivalent: `600 × (value_adj − 0.25)`. So 0.90 → 390, 0.72 → 282, 0.60 → 210, 0.50 → 150.
   - Removal of a Strike/Defend: 200 for the 1st and 2nd removal in Acts 1–2, 150 in Act 3, 300 for a curse.
   - Buy greedily by surplus while gold allows. Stop when the best surplus is negative (except rule 8). `[inference]`
2. **Removal comes before most relics.** In Acts 1–2 the first removal (100 gold at A6+) is bought before any relic except one whose surplus exceeds 100. Under rule 1 that means value ≥ 0.75 at Shop-band prices (in practice Miniature Tent), or Membership Card via rule 3. `[several]` (guide consensus and Untapped's A6 advice, `STRATEGY-research.md` §5.2)
3. **Membership Card.** Buy it first, before anything else in the shop, if both hold:
   - gold ≥ its price + 50;
   - 2 or more merchant visits are still likely (Act 1, or early Act 2).

   Then re-price the shop at 50%. In the last shop of the run, treat its value as 0.30. `[inference]` (n1: "sweep shops"; price mechanics `[several]`)
4. **Condition gates (skip even if the surplus looks positive).**
   - DINGY_RUG: always skip.
   - CHEMICAL_X: skip unless the deck has Whirlwind or another X-cost card.
   - MYSTIC_LIGHTER: skip with fewer than 2 enchanted Attacks.
   - BELT_BUCKLE, CAULDRON: skip when potion slots are ≥ half full.
   - Choice-creating relics: skip until the bot has a handler for the choice they add. This covers MINIATURE_TENT, TOOLBOX, GAMBLING_CHIP, KIFUDA, DOLLYS_MIRROR, ROYAL_STAMP, PUNCH_DAGGER, GNARLED_HAMMER, SHOVEL and GIRYA.

   `[inference]` (n1 F/D on the first group)
5. **Act multiplier (value_adj = value × m).**
   - Relics whose value builds over future pickups or fights (the three eggs, DRAGON_FRUIT, ORRERY, WING_CHARM, WHITE_STAR, PRAYER_WHEEL, CHOSEN_CHEESE, MEMBERSHIP_CARD): m = 1.0 in Act 1, 0.8 in Act 2, 0.5 in Act 3.
   - Boss and HP relics (PANTOGRAPH, LEES_WAFFLE, ETERNAL_FEATHER, REGAL_PILLOW, LIZARD_TAIL): m = 1.0 in every act, because A10 ends with two bosses.
   - Front-loaded combat relics (ANCHOR, BAG_OF_MARBLES, FESTIVE_POPPER, LANTERN): m = 1.0 / 0.95 / 0.85.
   - Everything else: m = 1.0 / 0.95 / 0.9.

   `[inference]`, from n1's "early pickup" notes on the eggs, Dragon Fruit and Chosen Cheese `[one]`
6. **HP-state swing.** LEES_WAFFLE becomes 0.80 when HP ≤ 50% and a boss or elite is ahead in this act. It is 0.45 at HP ≥ 90%. `[inference]`
7. **Keep removal money.** Suppose a removal is still wanted and another merchant is on the planned route this act. Then don't buy a relic with value_adj < 0.60 if it would leave gold below the next removal price (100 + 50 × removals bought). `[inference]`
8. **Last shop of the run: spend it all.** Gold is worth nothing at the end. Buy the highest-value affordable relic even at negative surplus, after any removal or card with positive surplus. `[inference]`
9. **Cards vs relics.** A shop card beats a relic of value ≥ 0.60 only if the card evaluator rates it a top pick for this deck. The most-bought examples are Dominate, Battle Trance, Offering and Colossus (`STRATEGY-research.md` §5.2). Otherwise take the relic. `[inference]` + `[data]` (Untapped buy rates quoted there)
10. **The Merchant??? event (Acts 2–3, relics 42–57 gold).**
    - Buy FAKE_ANCHOR, FAKE_VENERABLE_TEA_SET and FAKE_HAPPY_FLOWER only with gold above the next shop's removal reserve.
    - Never buy FAKE_MERCHANTS_RUG, FAKE_BLOOD_VIAL, FAKE_MANGO, FAKE_LEES_WAFFLE or FAKE_STRIKE_DUMMY.
    - Sanity check: OLD_COIN, BOWLER_HAT, LUCKY_FYSH, AMETHYST_AUBERGINE and THE_COURIER in a real shop slot means a parse error, since they are blacklisted from shops.

    `[several]` (wiki + Spire Codex effects)

[n1]: https://nat1gaming.com/sts2/tier-list/relic-tier-list/
[jsheet]: https://docs.google.com/spreadsheets/d/197RwIxLuzSLubsWr6OLfhdHPRFgIWRnQyTp-RuZUveU/htmlview
[mb]: https://metabot.gg/en/slay-the-spire-2/relics/tier-list/ironclad
[sc-tier]: https://spire-codex.com/tier-list/relics
[sc-relics]: https://spire-codex.com/relics
[sc-merch]: https://spire-codex.com/merchant
[w-rel]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Relics
[w-merch]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Merchant
[w-fake]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Merchant%3F%3F%3F
[w-ench]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Enchantments
[w106]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:V0.106.0_-_Beta_Patch
[w109]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:V0.109.0_-_Beta_Patch
[w110]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:V0.110.0_-_Beta_Patch
[w111]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:V0.111.0_-_Beta_Patch
[strat]: STRATEGY-research.md
