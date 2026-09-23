# Ironclad in Slay the Spire 2: what strong players do (research notes)

Compiled 2026-09-23 for spire-jev, which runs on the **beta branch v0.111.0**
(shipped 2026-08-13). This is read-only web research, written up in my own words.
Every claim links to its source. The link definitions are at the end of the file,
and the source table (§12) gives each source's date, game version and quality.

**Support tags** (used in §10, and in the text where it matters):

- `[several]`: two or more independent StS2 sources agree.
- `[one]`: a single StS2 source.
- `[data]`: comes from aggregated run statistics (Untapped overlay, or Jorbs' own run spreadsheet), not from anyone's opinion.
- `[StS1 only]`: advice carried over from Slay the Spire 1, with no StS2 source that confirms it.
- `[inference]`: my own deduction from card or monster text as published. It has not been checked in play. Check it in the simulator.
- `[disputed]`: StS2 sources disagree.

**Version timeline.** Early access launched on 2026-03-05 with v0.98.0
([Jorbs: guidelines][jguide], [Jorbs' run sheet][jsheet]). Patches in the window that matters:
v0.100.0 on Mar 19; v0.103.2, "Major Update 1"; v0.107.1, "Major Update 2", merged
into main on 2026-06-19 ([wiki Parafright history][wiki-para]) and still the **main**
branch. The Untapped tier lists label it "v0.107.1 Main Branch". Then came the beta-only
patches: v0.108.0 on Jul 3, v0.109.0 on Jul 17, v0.110.0 on Jul 30 and v0.111.0 on
Aug 13 ([wiki patch list][wiki-pn], [v0.111.0 notes][wiki-111], [Untapped patch page][upn]).
**All the good tier lists are labelled v0.107.1.** They were written before the
Ironclad changes in v0.108 to v0.111 (§1.2), so read them with that in mind.

---

## 1. Ground truth that changes how old advice reads

### 1.1 Starting kit and base rules (StS2)

- The deck starts as 5 Strike, 4 Defend and 1 Bash. The starting relic, Burning Blood, heals 6 HP at the end of each combat ([wiki Ironclad][wiki-ic], [Untapped guide][ug]).
- Resting at a campfire heals 30% of max HP, rounded down. Since v0.103.2 Ascension no longer changes rest sites ([wiki Rest Site][wiki-rest]).
- You start with 3 potion slots, or 2 at A4+. After a combat the potion drop chance is 40%. It falls 10 points after a drop and rises 10 after a miss, and elites add 12.5% ([wiki Potions][wiki-pot]).
- Ascension list: A1 more elites; A2 Ancients heal only 80% of missing HP; A3 25% less gold; A4 one fewer potion slot; A5 Ascender's Bane; A6 dearer card removal; A7 fewer rare and upgraded cards; A8 tougher enemies; A9 deadlier enemies; A10 two Act 3 bosses ([Untapped ascension guide][uasc]).

### 1.2 Ironclad changes after the v0.107.1 tier lists

All of these are on the bot's branch ([v0.108][wiki-108], [v0.109][wiki-109], [v0.110][wiki-110], [v0.111][wiki-111], [Untapped v0.111 page][upn]):

| Patch | Change | Effect on the older ratings |
|---|---|---|
| v0.108.0 | Colossus block 5(8)→4(7); Crimson Mantle 8(10)→7(10); Howl from Beyond 16(21)→18(24); Setup Strike Strength 2(3)→3(4) | small nerfs and buffs |
| v0.109.0 | Demon Form 2(3)→**3(4)** Str per turn; Taunt Uncommon→**Common**, block 7(8)→6(7); Bloodletting Common→**Uncommon**; Cruelty Rare→**Uncommon**; Dominate Uncommon→**Rare**; Primal Force rocks 16(20)→20(24) | Demon Form was rated low (Jorbs C, Baalorlord D) at +2. Dominate now shows up less often. |
| v0.110.0 | Mangle 15(20)→**20(26)**; Pact's End 17(23)→18(24); Relax (an Ancient card) block 15(17)→16(18) | Mangle was rated D to C at 15 damage |
| v0.111.0 | **Forgotten Ritual**: no longer needs a card exhausted first. It is now 1 energy for 3(4) energy, Exhaust. **Expect a Fight** reworked into a 3-cost Skill: 15(16) Block plus 5(8) Block per Strength. Rampage 9→10 damage. | Every tier-list note on Expect a Fight describes the old energy card and is now invalid. Forgotten Ritual has been buffed well past its A/B ratings. |

### 1.3 StS1 contamination in "StS2 guides"

Several StS2-branded pages recommend cards that are not in the StS2 Ironclad pool:
Heavy Blade, Flex, Spot Weakness, Limit Break, Reaper and Blood for Blood. The
official StS2 card list has none of them ([wiki Ironclad cards][wiki-cards]).
**Treat these pages as StS1 lore:**

- [games.gg Ironclad guide][gg] (2026-03-05)
- [GamerSky strength build][gs-bd] (2026-03-09, Chinese)
- the StS1 Steam threads that search engines return for "StS2" queries

Shockwave, Finesse, Prolong, Panic Button and a few others do exist in StS2, but
only as colorless cards ([Baalorlord tier list][btl]).

---

## 2. Archetypes (what the community actually names)

Every serious source says the same thing first: **don't force one archetype.** The
best Ironclad decks mix packages, and many cards act as "bridges" between them
([Mobalytics guide by Japanese Export][mg], [Untapped guide][ug], [PCGamesN][pcg]).

The names people use:

- Vulnerable
- Exhaust
- Self-damage, also called Bloodletting
- Block / Body Slam
- Strength
- "Strike Slop", built around Hellraiser
- draw-and-energy loops, or "infinites"

Sources: [Untapped][ug], [Caleb Gannon video chapters][yt-caleb], [Chinese: GamerSky / aggregators][gs-all].

### 2.1 Vulnerable (new in StS2 as a full archetype) `[several]`

- **Enablers:** Bash, Tremble (3 Vulnerable for 1 energy, Exhaust), Taunt, Uppercut (also the Ironclad's only card-pool source of Weak), Thunderclap (AoE), Molten Fist (doubles Vulnerable), Dominate. Break (an Ancient card) applies 5 Vulnerable. Sources: [Untapped][ug], [Jorbs][jtl], [Baalorlord][btl], [Mobalytics][mg].
- **Payoffs:** Dismantle (8×2 on a Vulnerable target), Bully (0 cost, +2 per stack), Dominate (+1 Strength per Vulnerable stack, Exhaust), Cruelty (+25%/+50% damage to Vulnerable enemies), Colossus (defence: 50% less damage *from Vulnerable enemies*), Vicious (draw when you apply Vulnerable). Sources: [Untapped][ug], [PCGamesN][pcg].
- **Relics:** Paper Phrog (Vulnerable becomes 75%), Bag of Marbles, Red Skull, Self-Forming Clay, Ruined Helmet ([PCGamesN][pcg], [TheGamer][tg]).
- **Before it works:** you need 2 or 3 reliable Vulnerable sources besides Bash. Jorbs and Baalorlord both say Bash is quickly outclassed ([Jorbs][jtl], [Baalorlord][btl]). Jorbs: take "one or two" Tremble, not too many.
- **How it wins:** multiplied damage on Dismantle and Bully, Strength from Dominate, and Colossus halving incoming damage. PCGamesN warns that Vulnerable decks drift into all-attack hands, so keep some block.

### 2.2 Exhaust `[several]`

- **Enablers:** True Grit (random exhaust; exhausts a card of your choice once upgraded), Burning Pact, Second Wind, Fiend Fire, Stoke, Brand, Cinder, Thrash (exhausts an Attack), Havoc, and the self-exhausting cards (Tremble, Offering, Forgotten Ritual, Molten Fist). Sources: [Untapped][ug], [Baalorlord][btl].
- **Payoffs:** Feel No Pain, Dark Embrace, Ashen Strike, Pact's End, Evil Eye, Howl from Beyond (replays from the exhaust pile), Juggernaut combined with FNP. Corruption now exists only as an Ancient reward ([wiki][wiki-cards]).
- **Relics:** Charon's Ashes (3 AoE damage per exhaust), Joss Paper (draw after 5 exhausts), Toasty Mittens, Burning Sticks, Forgotten Soul ([PCGamesN][pcg], [Steam: Ironclad strategies][st-strat], [Untapped card page][ustat-off]).
- **Before it works:** Baalorlord says Feel No Pain becomes great once you have 3 or 4 exhaust sources ([Baalorlord][btl]). Untapped: pick the generally good cards that happen to exhaust first, then the payoff powers ([Untapped][ug]).
- **How it wins:** exhaust your way down to a small loop of strong cards. Mobalytics notes this works "even with decks that are 30+ cards" ([Mobalytics][mg]). Ashen Strike can hit for 50+ with Fiend Fire, Second Wind or Stoke ([Jorbs][jtl]).
- **Corruption and Dark Embrace in StS2:**
  - Jorbs: Corruption "doesn't feel very strong" because as an Ancient card you rarely get to build toward it, and Dark Embrace is too slow for this game ([Jorbs][jtl]).
  - Baalorlord rates Dark Embrace S ([Baalorlord][btl]), and so does Mobalytics ([Mobalytics TL][mtl]).
  - `[disputed]`

### 2.3 Self-damage / "Bloodletting" `[several]`

- **Cards:** Bloodletting, Offering, Blood Wall, Breakthrough, Hemokinesis, Brand, Crimson Mantle, Inferno (both an enabler and a payoff), Rupture, Tear Asunder, Spite ([Untapped][ug], [Steam A10][st-a10]).
- **Relic:** Self-Forming Clay ([games.gg][gg], [Baalorlord][btl]).
- **Key rule:** Inferno triggers on *any* HP loss during your turn, not only its own ([Jorbs][jtl]). So do Rupture and Spite (card text, [wiki][wiki-cards]).
- **Before it works:** Rupture is not good enough on its own. It needs several self-damage cards ([Untapped][ug]). With Inferno, expect to rest at campfires often ([Jorbs][jtl]).
- **How it wins:** Inferno's AoE pings, Rupture Strength, or Tear Asunder hit counts. One Steam A10 player reports Tear Asunder hitting 500+ ([Steam: help with A10][st-a10]). Jorbs, though, finds Tear Asunder slow and usually out-damaged ([Jorbs][jtl]). `[disputed]`

### 2.4 Strength (demoted in StS2) `[several]`

- **Cards:** Dominate (called the premium Strength source by [Mobalytics][mg] and [Baalorlord][btl]), Inflame, Setup Strike, Fight Me!, Demon Form, Brand, Rupture.
- **Payoffs:** multi-hit and repeat attacks: Twin Strike, Sword Boomerang, Thrash, Whirlwind, Conflagration, Anger.
- **Relics:** Vajra, Ruined Helmet, Sling of Courage, Molten Egg ([TheGamer][tg]).
- **The StS2 view:**
  - Untapped: Strength scaling is "more measured" than in StS1 ([Untapped][ug]).
  - Jorbs finds the Strength elements "underwhelming so far" and prefers Thrash or Ashen Strike to Demon Form or Inflame ([Jorbs][jtl]).
  - Baalorlord put Demon Form in D ([Baalorlord][btl]), rated at +2 Strength before the v0.109 buff to +3.
- **Takeaway:** as a scaling plan in StS2, take Dominate and Strength-scaling multi-hits rather than Inflame or Demon Form.

### 2.5 Block / Body Slam / Barricade `[several]`

- **Cards:** Unmovable (doubles the first block from a card each turn), Blood Wall, Impervious, Flame Barrier, Colossus, Crimson Mantle, Stone Armor (Plating), Rage, Barricade, Body Slam, Juggernaut. Colorless: Entrench, Prolong, Panic Button, The Gambit. Sources: [Untapped][ug], [Baalorlord][btl], [Mobalytics][mg].
- **Relics:** Pael's Legion, Vambrace ([Untapped][ug]); Gorget, Bronze Scales, Anchor, Horn Cleat, Captain's Wheel, Oddly Smooth Stone, Parrying Shield ([PCGamesN][pcg]).
- **Before it works:**
  - Body Slam is hard to take early because it does little damage until your block is big ([Baalorlord][btl], [Jorbs][jtl]).
  - Barricade needs burst block: Second Wind with FNP, Gambit, Panic Button, Prolong ([Jorbs][jtl], [Baalorlord][btl]).
  - Mobalytics: Barricade is hard to make work because the Ironclad lacks consistent Weak. It is often better to kill quickly ([Mobalytics][mg]).
- **Untapped data:** Body Slam and Barricade are rarely picked in Act 1 (9% and 36%), but in Act 3 they carry positive run-win deltas of +5 and +7 ([Untapped stats][ustat]). They are late payoffs.

### 2.6 "Strike Slop" (Hellraiser) `[several]`

Hellraiser plays every "Strike" card you draw against a random enemy. Pair it with
upgraded Pommel Strikes (draw 2) and Perfected Strike ([Untapped][ug]). The Soldier's
Stew potion (Ironclad rare) gives Strike cards Replay ([wiki potions][wiki-potlist]).

Top players rate it low: Jorbs D ("probably not usually worth"), Baalorlord C,
Mobalytics C ([Jorbs][jtl], [Baalorlord][btl], [Mobalytics TL][mtl]). nat1gaming rates
it A ([nat1][n1]).

### 2.7 Draw/energy loops ("infinites")

- **Cards:** Pommel Strike+, Bloodletting, Burning Pact, Battle Trance, Offering, Forgotten Ritual, Pyre, Cascade. Colorless: Flash of Steel, Finesse.
- **How it works:** exhaust the rest of the deck away until you replay a small loop ([Mobalytics][mg], [Jorbs][jtl], [Baalorlord][btl]).
- **Chinese sources:** 烧牌流 ("burn deck"), with Burning Pact as the hub card and a "small infinite loop" ([Sohu / 游戏机灵鬼][sohu]).
- **Warning:** the one-card "OP" loop on Steam (Pommel+, Pillage, Expect a Fight+) came from *Sealed Deck* mode, and it relied on the old Expect a Fight ([Steam: OP strategy][st-op]).

---

## 3. Card picks

### 3.1 Principles the StS2 sources agree on

1. **Act 1 wants frontloaded damage. Scaling comes later.** `[several]`
   - Steam A10 players: Ironclad "desires early power to overwhelm act 1 elites"; get damage early, then draw, energy and exhaust ([Steam: Ironclad Tips?][st-tips], [Steam: A10 act 1][st-act1]).
   - Mobalytics splits needs into frontload vs scaling damage and frontload vs scaling block ([Mobalytics][mg]).
   - Jorbs' "jobs" article suggests two or three frontloaded-damage cards at the start of each run. It was written before release and uses StS1 examples ([Jorbs: jobs][jjobs]).
2. **HP is a resource.** Burning Blood makes it cheap to trade HP for speed. `[several]` ([Steam: How tf][st-howtf], [Steam: What am I missing][st-missing], [Untapped map guide][umap])
3. **Draw and energy are premium.** Offering and Battle Trance top every list. Mobalytics calls Bloodletting perhaps the Ironclad's most important card. `[several]` ([Mobalytics][mg], [Jorbs][jtl], [Baalorlord][btl], [Steam A10][st-a10]).
4. **Energy gain needs card draw to go with it**, and vice versa ([Jorbs on Bloodletting][jtl], [Baalorlord on 0-cost cards][b2cost]). `[several]`
5. **2-cost "dense" cards are undervalued.** You see each card once per shuffle, so impact per card matters more than impact per energy ([Baalorlord: In Defense of 2-Cost Cards][b2cost], [Jorbs on Cinder][jtl]). `[several]`
6. **Build toward the enemies you will actually fight next**, not just your archetype ([Jorbs: guidelines][jguide], [Jorbs: jobs][jjobs], [Untapped map guide][umap]). `[several]`

### 3.2 Ratings for every card the bot has met

The columns:

- **Jorbs:** tier list, updated 2026-08-05, v0.107.1 ([link][jtl]).
- **Baal:** Baalorlord, updated 2026-08-21, v0.107.1 ([link][btl]).
- **Moba:** Mobalytics / Japanese Export, updated 2026-08-12 ([link][mtl]).
- **nat1:** DoggertQBones, 2026-08-17, "August 13th update", so probably v0.111.0 ([link][n1]).
- **UT pick %:** Untapped overlay data, A7+ single-player filter. It shows how often the card was taken when offered in Act 1 / Act 2 / Act 3 ([card pages][ustat], read 2026-09-23).
- **UT A1 ΔWR:** the Act 1 act-win-rate difference Untapped shows for picking the card.
- **Smith%:** how often the card was chosen at an Act 1 smith when it was in the deck.
- **Rarity:** C/U/R, taken from the current wiki.

Caveats:

- Untapped does not show its patch window.
- Pick rates depend on what the card was offered next to.
- The win deltas carry selection bias.

| Card (id) | R | Jorbs | Baal | Moba | nat1 | UT pick % A1/A2/A3 | UT A1 ΔWR | Smith% A1 | Notes |
|---|---|---|---|---|---|---|---|---|---|
| ANGER | C | B | A | A | C | 27/6/3 | +5 | 10 | A free 6 damage early. "Does not age well into Act 2 and 3" ([nat1][n1]). Baalorlord: can become an endgame plan with Strength and draw. |
| ARMAMENTS | C | A | B | C | B | 24/8/3 | −2 | 66 | Upgraded, it upgrades your whole hand. It is among the most-smithed cards. |
| ASHEN_STRIKE | U | S | A | B | C | 36/30/26 | −1 | 10 | Exhaust payoff that stays good in Act 3 |
| BARRICADE | R | C | B | D | C | 36/22/35 | −3 | 58 | Needs burst block. Upgrade cuts cost 3→2. |
| BASH | basic | C | C | – | D | – | – | 8 | Outclassed. Upgrade it in Act 1 only if you have no other Vulnerable ([Baal][btl], [Jorbs][jtl]). |
| BATTLE_TRANCE | U | A | A | S | A | 64/60/44 | +6 | 10 | Take the first copy; later copies are worth less. Jorbs' best decks drop it in Act 2+. |
| BLUDGEON | U | C | A | A | B | 38/11/7 | +5 | 26 | An Act 1 power spike, "excels especially in overgrowth" ([Moba][mg]) |
| BODY_SLAM | C | C | A | C | C | 9/8/9 | −10 | 50 | Late payoff. Upgrade cuts cost 1→0 ([UT card][ustat-bs]). |
| BREAKTHROUGH | C | C | B | B | C | 24/7/2 | −4 | 6 | Early AoE, and the cheapest self-damage enabler |
| BURNING_PACT | U | B | A | S | B | 35/40/37 | −8 | 9 | Engine card. Weak in Act 1, better later. |
| COLOSSUS | U | S | S | S | A | 63/65/56 | 0 | 4 | Only works if the *attacker* is Vulnerable. Nerfed to 4 block in v0.108. |
| CONFLAGRATION | R | C | B | D | A | 69/40/28 | +6 | 28 | 2×4 AoE. Scales with Strength and enchants. Strips Slippery. |
| DISMANTLE | U | S | B | B | B | 41/19/10 | +4 | 9 | 16 for 1 energy on a Vulnerable target. Falls off in Act 2+ without support. |
| EVIL_EYE | U | A | S | B | C | 38/36/30 | −4 | 5 | 16 block if you exhausted a card that turn |
| FEEL_NO_PAIN | U | A | A | A | B | 29/37/38 | −8 | 10 | Needs 3 or 4 exhaust sources. Its value rises by act. |
| FIEND_FIRE | R | S | S | S | A | 63/31/24 | +2 | 30 | Play the cards you want to keep first ([Baal][btl]) |
| FIGHT_ME | U | C | A | C | B | 44/19/11 | +7 | 35 | The enemy gains 1 Strength; "not particularly real" ([Jorbs][jtl]). Careful against multi-hitters ([Baal][btl]). |
| FLAME_BARRIER | U | S | A | A | B | 60/40/24 | 0 | 18 | Huge against multi-hit intents |
| FORGOTTEN_RITUAL | U | A | B | B | B | 21/30/31 | −3 | 2 | **Buffed in v0.111** (now unconditional). All ratings predate the buff. |
| HAVOC | C | D | D | C | F | 4/2/1 | −9 | 36 | Trap. Upgrade cuts cost to 0. |
| HEADBUTT | C | C | A | A | B | 21/11/6 | +1 | 1 | Put Break, Battle Trance or a key card back on top of the draw pile |
| HEMOKINESIS | U | B | A | A | C | 23/6/2 | −1 | 10 | 15 damage for 1 energy. An Act 1 card. |
| HOWL_FROM_BEYOND | U | B | B | C | B | 20/14/9 | −5 | 10 | 18 AoE now, and it replays from the exhaust pile |
| INFERNAL_BLADE | U | B | B | C | C | 29/13/8 | 0 | 32 | Upgrade cuts cost 1→0. Variance can be a comeback tool ([Jorbs][jtl]). |
| INFLAME | U | C | C | C | C | 31/13/9 | +2 | 25 | "Second-rate" scaling ([Jorbs][jtl]) |
| IRON_WAVE | C | B | B | B | D | 12/3/1 | −5 | 6 | Fine on floor 1, a weight later ([Jorbs][jtl]) |
| JUGGERNAUT | R | C | A | D | C | 42/17/18 | +6 | 34 | Pair with FNP, Plating or Gorget |
| JUGGLING | U | C | B | C | D | 6/7/7 | −6 | 15 | Awkward |
| MANGLE | R | B | C | D | B | 44/17/15 | 0 | 29 | **Buffed to 20(26) in v0.110.** Neuters multi-hit turns. |
| OFFERING | R | S | S | S | S | 91/75/73 | +7 | 19 | The best Ironclad card. Skip playing it if the fight is already won ([Baal][btl]). |
| PECK | event | – | – | – | – | – | – | – | Comes from the Wood Carvings event ("Bird": transform a starter card). 1 energy, 2×3 (2×4 upgraded) ([Untapped events][uev1]). A good Slippery stripper. |
| PERFECTED_STRIKE | C | B | B | C | C | 29/13/9 | +3 | 27 | 18 for 2 energy early. Don't chase a Strike deck ([Jorbs][jtl]). |
| POMMEL_STRIKE | C | S | S | S | A | 56/34/21 | 0 | 24 | Upgraded, it draws 2 and loops |
| RAGE | U | B | S | A | C | 41/32/24 | 0 | 21 | For attack-heavy decks. Dexterity doesn't boost it ([Jorbs][jtl]). |
| RELAX | ancient | – | – | – | – | – | – | – | From Pael's Horn (2 copies). 3 energy: 16 block, then next turn draw 2 and +2 energy, Exhaust ([wiki][wiki-relax]). |
| RUPTURE | U | B | B | C | B | 25/23/18 | −6 | 43 | Needs several self-damage cards. The upgrade gives 2 Strength per HP loss. |
| SECOND_WIND | U | A | B | A | C | 25/24/26 | −6 | 5 | Pair with FNP or Juggernaut. Strong against status-adders. |
| SETUP_STRIKE | C | B | C | C | C | 12/5/3 | −3 | 6 | Now 3 temporary Strength (v0.108) |
| SHRUG_IT_OFF | C | C | A | A | A | 45/29/16 | 0 | 4 | `[disputed]`: Jorbs calls it the Ironclad's "3rd or 4th best" block common |
| SPITE | U | C | B | B | C | 15/10/6 | 0 | 9 | Much better upgraded (up to 5×3 for 0 energy) |
| STOKE | R | B | S | A | A | 66/38/34 | +8 | 69 | Upgrade makes the generated cards upgraded. Doesn't exhaust itself. |
| SWORD_BOOMERANG | C | C | C | C | C | 12/7/5 | 0 | 16 | Scales with Strength. 3 hits (4 upgraded). |
| TAUNT | C | S | A | B | B | 59/33/18 | +1 | 29 | Now Common, 6 block. Jorbs: "SO MUCH BETTER than it might look". |
| THRASH | R | A | S | B | A | 74/43/33 | +10 | 13 | Scales with Strength and relics while it thins the deck |
| THUNDERCLAP | C | C | C | C | D | 12/4/2 | −5 | 3 | Weak unless combined with Vicious |
| TREMBLE | C | S | B | S | D | 40/26/17 | −1 | 3 | 1 or 2 copies at most |
| TRUE_GRIT | C | A | B | C | B | 26/14/8 | −7 | 48 | Upgrade lets you choose the exhausted card. It is a common smith target. |
| TWIN_STRIKE | C | C | C | B | C | 15/7/4 | +2 | 4 | A "working class" Act 1 card ([Jorbs][jtl]) |
| UNRELENTING | U | C | B | B | C | 38/12/6 | +11 | 13 | Act 1 only. Its free-next-Attack effect carries across turns ([Baal][btl]). |
| UPPERCUT | U | B | A | S | B | 57/32/20 | +4 | 54 | The only Weak source. Wants its upgrade. |
| VICIOUS | U | A | S | C | C | 27/33/25 | −10 | 20 | Slow in Act 1. Baalorlord: a must-upgrade. |
| WHIRLWIND | U | C | A | B | B | 33/15/6 | −4 | 34 | Needs its upgrade. Breakable with Vigor enchants. |

Older and weaker tier lists: [PCGamesN][pcg] (2026-04-08) rates Body Slam, Headbutt,
Barricade and Demon Form S and Pommel Strike, Tremble and Dominate B. That is out of
line with every later list, so it gets less weight here.

### 3.3 Act 1: front-loaded damage and AoE

- Mobalytics' frontload examples ([Mobalytics][mg]):
  - Pommel Strike
  - Whirlwind (much better with an early upgrade)
  - Breakthrough (AoE, and a bridge into self-damage)
  - Bludgeon (especially in Overgrowth)
  - Anger
  - Tremble
- Untapped's strong commons ([Untapped][ug]):
  - Anger, Breakthrough (for multi-enemy fights), Headbutt, Pommel Strike, Molten Fist, Perfected Strike
  - Iron Wave "saves HP in Act 1" but bloats the deck later
  - Bloodletting, Shrug It Off, Tremble, Blood Wall
  - Early uncommons worth taking: Bully, Spite, Dismantle, Hemokinesis, Uppercut, Whirlwind
- **Data.** The Act 1 picks with the largest positive act-win delta ([Untapped stats][ustat]):
  - Unrelenting +11
  - Thrash +10
  - Stoke +8
  - Fight Me! +7
  - Offering +7
  - Battle Trance +6
  - Conflagration +6
  - Juggernaut +6
  - Anger +5
  - Bludgeon +5

  Several of these turn negative in Act 2/3: Unrelenting −5/−9, Fight Me! −5/−6, Anger −8, Bludgeon −7. That is a clean signal of frontload-only cards.
- **Data.** The Act 1 picks with negative act deltas are the engine and support cards:
  - Vicious −10
  - Body Slam −10
  - Feel No Pain −8
  - Burning Pact −8
  - True Grit −7
  - Blood Wall −6
  - Rupture −6
  - Second Wind −6

  FNP, Burning Pact, Forgotten Ritual and Vicious get picked *more* in Acts 2 and 3.
- **AoE.** Jorbs' framework says AoE isn't mandatory if your single-target frontload is good enough, because you can kill one enemy fast to stabilise ([Jorbs: jobs][jjobs], StS1-derived). Jorbs and Baalorlord both call Conflagration and Breakthrough sensible AoE pickups for multi-enemy fights ([Jorbs][jtl], [Baalorlord][btl]). `[several]`

### 3.4 Scaling for bosses and elites

- **The scaling cards the top lists agree on:**
  - Dominate (Strength)
  - Ashen Strike and Thrash (self-scaling attacks)
  - Inferno (AoE pings)
  - Crimson Mantle and Unmovable (block per turn)
  - Colossus (defence against Vulnerable enemies)
  - Cruelty (multiplier)
  - Fiend Fire with the exhaust engine
  - Stoke

  Sources: [Jorbs][jtl], [Baalorlord][btl], [Mobalytics TL][mtl].
- Untapped's A10 advice: the two Act 3 bosses reset scaling, so you need an engine that re-establishes damage quickly, not one explosive turn ([Untapped ascension guide][uasc]).
- A Steam A10 player diagnosed a lost run as missing scaling: it needs "Demon Form or a rampage or a Barricade" ([Steam: Help A10][st-a10b]). That is one player's view.

### 3.5 Traps and low-value cards

- Near-unanimous traps: **Havoc** (D/D/C/F; picked 4% in Act 1) and **Juggling** (picked 6%). Also Tank, a multiplayer card. `[several]` `[data]`
- Low-value in the Ironclad data at every act: Thunderclap, Iron Wave, Twin Strike, Setup Strike and Sword Boomerang (Act 1 pick rate ≤15%). Anger, Hemokinesis, Breakthrough and Cinder fall to ≤7% after Act 1 ([Untapped stats][ustat]). `[data]`
- **Rampage:** Jorbs D, Baalorlord C, "gets weaker as deck size grows" ([nat1][n1]). It was buffed slightly in v0.111.
- **Hellraiser / Strike synergies:** "don't go overboard" ([Jorbs][jtl]).
- **Too many of one card:** Battle Trance copies ([Jorbs][jtl], [Untapped][ug]); more than 2 Tremble ([Jorbs][jtl]).
- **Too defensive:** Impervious-style turtling loses to enemies that scale each turn ([Jorbs][jtl]). Blocking needs a plan for how you close the fight ([Untapped micro guide][umicro]).
- **Strength payoffs with no Strength source.** Rupture on its own is not enough ([Untapped][ug]).

### 3.6 How often to take a card, and deck size

- **Data.** If each reward shows 3 Ironclad cards, Untapped's A7+ players take a card from about **86%** of Act 1 rewards, **61%** in Act 2 and **49%** in Act 3. I derived this myself from the per-card offer and pick counts, so it is rough ([Untapped stats][ustat]).
- **Data.** Jorbs' own runs (v0.98 to v0.106.1): 82 Ironclad runs; at A10, 67 runs with **43 wins (64%)**. He picked about 15.6 cards per A10 run, and his winning decks ended at about 40 cards ([Jorbs sheet][jsheet]). The final-deck column is undocumented, so treat the deck size as a rough figure.
- Steam advice: "keep decks around 25 cards" and avoid filler ([Steam: How tf][st-howtf]). Jorbs' data suggests strong decks are larger than that, because exhaust thins them inside the fight ([Mobalytics][mg]). `[disputed]` on deck size.
- A Steam thread suggests about one third of the deck be block cards ([Steam: What am I missing][st-missing]). `[one]`

### 3.7 Removing Strikes and Defends `[disputed]`

- **Against Strikes:** "strike is the worst card in the game"; remove all five ([Steam: Help A10][st-a10b]). Generic guides: remove Strikes first, then Defends, and stop at about 3 basics ([sts2front][front], low quality).
- **For keeping Strikes:**
  - Jorbs: Ironclad Strikes "can actually do quite well". They scale with Strength and enchants, and he rates Defend lower, at D ([Jorbs][jtl]).
  - Baalorlord: Strikes are useful all game; Defend is adequate in Act 1 ([Baalorlord][btl]).
- **Data.** Jorbs' Amalgamator choices (all characters): he combined Strikes 10 times and Defends 6 ([Jorbs sheet][jsheet]).
- **Resolution for an Ironclad bot:** remove curses and statuses first. Then remove **Defend** before Strike when the deck has other block cards, or has Strength or Strike payoffs. Remove Strikes first when the deck is short on block. Mark this as an inference from the conflicting sources.

### 3.8 Upgrade priorities

- **Data.** The Act 1 smith choice rates of A7+ players, among the bot's cards ([Untapped stats][ustat]):
  - Stoke 69%
  - Armaments 66%
  - Barricade 58%
  - Uppercut 54%
  - Body Slam 50%
  - True Grit 48%
  - Rupture 43%
  - Havoc 36%
  - Fight Me! 35%
  - Juggernaut 34%
  - Whirlwind 34%
  - Infernal Blade 32%
  - Fiend Fire 30%

  Outside the bot's list: Unmovable 71%, Hellraiser 71%, Stampede 66%, Cascade 63%, Pyre 61%, Dark Embrace 41%, Dominate 41%.

  The pattern is clear: **mechanical upgrades win.** That means cost reductions, "all cards" or "choose a card" effects, and extra Weak or Vulnerable.

  Cost reductions ([Untapped card pages][ustat]):
  - Body Slam 1→0
  - Barricade 3→2
  - Unmovable 2→1
  - Dark Embrace 2→1
  - Hellraiser 2→1
  - Stampede 2→1
  - Havoc 1→0
  - Infernal Blade 1→0
  - Corruption 3→2
  - Entrench 2→1

  Other mechanical upgrades:
  - Armaments: upgrades ALL cards in hand
  - True Grit: choose the exhausted card
  - Stoke: generates upgraded cards
  - Uppercut: 2 Weak and 2 Vulnerable
  - Rupture: 2 Strength per HP loss
  - Pyre: 2 energy
  - Cascade: X+1
  - Vicious: draw 2
  - Pommel Strike: draw 2
- **Low-value upgrades, rarely chosen:**
  - Strike and Defend: 0%
  - Shrug It Off 4%
  - Colossus 4%
  - Blood Wall 4%
  - Tremble 3%
  - Twin Strike 4%
  - Evil Eye 5%
  - Bash 8%

  Untapped's guide names Shrug It Off as the textbook tiny upgrade ([Untapped rest guide][urest]). `[data]` `[several]`
- **Comments from the top players:**
  - "Must-upgrade": Vicious, Pyre, Cascade ([Baal][btl]).
  - Whirlwind "needs an upgrade" ([Baal][btl]) and "often worth upgrading if it's worth taking at all" ([Jorbs][jtl]).
  - Pommel Strike wants its upgrade ([both][jtl]). Spite is much better upgraded ([Jorbs][jtl]).
  - Bash: upgrade in Act 1 only if you have no other Vulnerable ([Baal][btl], [Jorbs][jtl]).
  - Feed: "Don't upgrade this card" ([Baal][btl]).
- A generic guide lists "Demon Form, Bash, Whirlwind" as the Ironclad upgrades ([sts2front][front]). For Bash the data says otherwise. That list is StS1-flavoured.

---

## 4. Fight technique

### 4.1 General patterns (StS2 sources)

- **Full information.**
  - Intents show exact damage and multi-hit counts.
  - Separate icons mark a status shuffle or a summon.
  - Many StS2 monsters use fixed patterns, so you can plan several turns ahead ([Untapped intent guide][uintent], [Untapped micro guide][umicro]).
- **Block only with a plan.** Block if you are stalling for a better damage turn, or waiting for the enemy's off-turn. Otherwise trade blows ([Untapped micro guide][umicro]). Attack on turns when the enemy isn't attacking ([Jorbs: jobs][jjobs], a StS1-derived framework). `[several]`
- **Overkill is waste.** Plan the whole turn before you commit. The order of play matters because of modifiers ([Untapped micro guide][umicro]).
- **Reshuffle on purpose.** Drawing mid-turn to force a reshuffle leaves the cards in your hand out of the next cycle ([Untapped micro guide][umicro]).
- **Ironclad-specific.**
  - Trade HP for tempo, because Burning Blood refunds 6 after every fight ([Steam: What am I missing][st-missing], [Untapped map guide][umap]).
  - The Ironclad's block is weak, so either get engine cards or end fights fast ([Steam: How tf][st-howtf]).

### 4.2 Sequencing notes per card (top-player comments)

- **Fiend Fire:** play the cards you want to keep first, then Fiend Fire exhausts the rest ([Baal][btl]).
- **Cinder:** play it last, so its random exhaust can't hit something you still want ([Baal][btl]).
- **Offering:** "if you're already winning the fight, consider not playing this" ([Baal][btl]). With cards that care about hand size (Armaments+, Fiend Fire, Second Wind), Offering+'s draw 5 is huge ([Jorbs][jtl]).
- **Battle Trance:** you can't draw again that turn, so play other draw first. It combos with Fiend Fire and Armaments+ ([Jorbs][jtl]). With Headbutt you can redraw it every turn ([Baal][btl]).
- **Colossus:** it reads the *enemies'* Vulnerable, not yours. Against a Vulnerable enemy attacking for 40, it effectively blocks 25 for 1 energy ([Jorbs][jtl]). Reduced damage rounds down ([Baal][btl]).
- **Crimson Mantle:** gives no block on the turn you play it ([Jorbs][jtl]).
- **Unmovable:** doubles the first card-block of each turn, including the turn you play it ([Mobalytics][mg]). Use it on your biggest block card ([Baal][btl]).
- **Taunt:** use it to *extend* Vulnerable on defensive turns ([Baal][btl]).
- **Dominate:** beware enemies with Artifact ([Baal][btl]). Uppercut can break Artifact first ([Baal][btl]).
- **Unrelenting:** the "next Attack costs 0" effect can carry across turns, so save it for Bludgeon or Mangle ([Baal][btl]).
- **Mangle:** worth 3 energy when it negates a whole attack, especially a multi-hit ([Baal][btl], [Jorbs][jtl]).
- **Flame Barrier:** retaliates per hit. Against 8-hit attacks Flame Barrier+ deals 48 ([Jorbs][jtl]).
- **Fight Me!:** don't use it against enemies with multi-hit moves ([Baal][btl]).
- **Thrash:** adds the exhausted Attack's damage *including Strength, relics and enchants* ([Baal][btl]).
- **Rage:** Dexterity doesn't raise its block ([Jorbs][jtl]).
- **Stampede:** random targeting "may turn you in the Crab boss fight" ([Jorbs][jtl]).
- **Inferno and Rupture:** any HP loss on your turn triggers them, so play them before your self-damage cards ([Jorbs][jtl]; card text on the [wiki][wiki-cards]). `[inference]` for the ordering

### 4.3 Vantom (Act 1 boss, Overgrowth)

Chinese name: 墨影幽灵 ([GamerSky boss guide][gs-boss]).

**Stats** ([wiki Vantom][wiki-vantom]; move numbers match [Fextralife][fxl] and [STS2 Companion][comp-vantom]):

| | Value |
|---|---|
| HP | 173 (183 at A8+) |
| Powers | Slippery 9. Lowered to 8 at lower Ascensions in v0.104.0, when Dismember also dropped 27→26. |
| Turn 1: Ink Blot | 7 (8 at A8+) |
| Turn 2: Inky Lance | 6×2 (7×2) |
| Turn 3: Dismember | 26 at low Ascension (30 at A8+). Adds 3 Wounds to your discard pile. |
| Turn 4: Prepare | +2 Strength |
| Cycle | repeats |
| Slippery rule change | Since v0.106.0 a fully blocked hit no longer uses up a stack |

The bot's observations (171 HP, 26 damage) match the low-Ascension post-v0.104 values.
Read the stack count from the game.

- **Slippery:** "The next time this creature loses HP, it only loses 1 HP instead". Each stack absorbs one HP-loss instance ([Spire Codex power text][codex-slip]). Multi-hit attacks strip stacks fastest ([PC Gamer][pcgamer-vantom] (search snippet only; the page wouldn't load), [NoobFeed][noob], [STS2 Companion][comp-vantom], [GamerSky][gs-boss]). Steam: "you need either multi-hit attacks or a solid defensive gameplan" ([Steam: Is Vantom too strong][st-vantom]). `[several]`
- **Non-attack damage also counts** (the wording is "loses HP"). Poison, Inferno and Mercury Hourglass are all named as stack removers ([wiki][wiki-vantom]). So Flame Barrier reflection, Juggernaut pings and Thorns should each strip one stack too. `[inference]`: verify in the sim.
- **Ironclad multi-hit and cheap-hit tools, with hits per card:**

  | Card | Hits per play |
  |---|---|
  | Twin Strike | 2 |
  | Sword Boomerang | 3 (4 upgraded); all land on Vantom, the only enemy |
  | Peck | 3 |
  | Conflagration | 4 (5 upgraded) |
  | Whirlwind | X |
  | Thrash | 2 |
  | Fight Me! | 2 |
  | Dismantle on a Vulnerable target | 2 |
  | Anger, Spite | 1 each at 0 cost |
  | Inferno | 1 per trigger |
  | Flame Barrier | 1 per enemy hit (Inky Lance = 2) |

  Card text: [wiki][wiki-cards]. `[inference]` for the list itself.
- **Turn plan from the guides** ([NoobFeed][noob], [STS2 Companion][comp-vantom], [PC Gamer][pcgamer-vantom], search summary):
  - Turns 1 to 3: hit as many times as possible.
  - Block Dismember (turn 3, 7, …). Use an HP-saving potion there if needed.
  - Use Prepare (turn 4, …) for powers.
  - Burst once Slippery is gone, before the +2 Strength per cycle piles up.
  - A Chinese guide: an Act 1 deck "usually can't out-last the boss", so strip Slippery "the faster the better" ([GamerSky][gs-boss]).
- **Wounds:** Dismember adds them even through full block. Players complain about exactly this ([Steam: a10 vantom][st-vantom10]). Stoke is named for dealing with them ([wiki][wiki-vantom]). True Grit, Burning Pact, Second Wind with FNP, and Fiend Fire can all turn Wounds into value (card text). `[inference]`
- **Data.** Jorbs died to Vantom twice in 67 A10 Ironclad runs ([Jorbs sheet][jsheet]). His Ironclad encounter sheet has only 2 recent Vantom fights, too few to use.

### 4.4 Byrdonis (Act 1 elite, Overgrowth)

**Stats** ([wiki][wiki-byrd]):

- HP 81–84 (90 at A8). It was cut from 91–94 in v0.103.0.
- **Territorial:** gains Strength at the end of each of its turns.
- It alternates **Swoop** 17 (19) and **Peck** 3×3 (4×3), starting with Swoop. Each point of Strength adds 3 damage to Peck.

Tactics:

- It is a pure damage race. Bring about three solid attacks, or two plus a defensive card, and use potions to speed it up ([Steam: Byrdonis elite][st-byrd]). Block still matters; one reply lists Rage among the useful block cards there ([same thread][st-byrd]). `[several]`
- A guide-site summary: apply Vulnerable at once, use Weak (it cuts every Peck hit), and spend damage potions here. The source is a search summary of low-quality sites, so `[one]`.
- **Data.** Jorbs as Ironclad: 11 fights, average 24 damage taken, 4.1 turns, no deaths. Byrdonis killed him once at A10 ([Jorbs sheet][jsheet]).
- The bot's turn math: Peck on turns 2, 4, 6 hits for 3×(3+1), 3×(3+3), 3×(3+5), roughly 12, 18, 24 at base. So Flame Barrier, Weak or Mangle are worth most on the *later* Peck turns. `[inference]` from the wiki numbers.

### 4.5 Entomancer (Act 2 elite, Hive)

**Stats** ([wiki][wiki-ento]):

- HP 145 (**165 at A8 since v0.111.0**).
- **Personal Hive:** each attack *hit* on it adds X Dazed to your draw pile. It starts at 1.
- Fixed cycle: **Beeeees!** 3×7 (3×8 at A9), then **Spear!** 18 (20), then **Pheromone Spit**. Spit adds +1 Hive and +1 Strength, or +2 Strength once Hive reaches 3.

The wiki's own tips:

- Use single big hits.
- Thorns triggers on every Beeeees! hit.
- Indirect damage (Inferno) avoids Hive.
- Strength reduction blunts Beeeees!.
- Feel No Pain turns Dazed into value.

`[one]`, but the tips follow straight from the monster text.

- **Data.** Jorbs as Ironclad: 47 fights, average 22 damage taken, 5.1 turns, no deaths ([Jorbs sheet][jsheet]).
- For the bot: avoid Twin Strike, Sword Boomerang, Conflagration and Whirlwind here. Prefer Bludgeon, Hemokinesis, Uppercut, Body Slam, Headbutt and Fiend Fire, which is one hit for many cards. Flame Barrier on the Beeeees! turn is 7 reflections. `[inference]`

### 4.6 Hunter Killer (Act 2 hallway, Hive)

**Stats** ([wiki][wiki-hk]):

- HP 121 (126 at A8).
- It always opens with **Tenderizing Goop**, which applies 1 Tender.
- **Tender:** whenever you play a card, lose X Strength and X Dexterity for that turn. The loss applies after the card resolves.
- After the opener it picks **Bite** 17 (19) or **Puncture** 7×3 (8×3) at random. Puncture is twice as likely, and Bite never repeats.

Tactics:

- Your turn 1 comes before Tender exists. Spend it on maximum damage or powers. `[inference]`
- Under Tender, the first card you play each turn is at full strength and each later card is weaker. So:
  - Play Strength- and Dexterity-dependent cards first: attacks, especially multi-hits, and block cards.
  - Play the rest later: powers, draw, energy, and Vulnerable or Weak appliers.
  - Prefer a few big cards over many small ones. Avoid 0-cost spam.

  `[inference]` from the wiki text. A low-quality guide agrees on "burst it down, avoid long chains of cheap cards" ([slaythespire2.space][hk-space]); note that it also gets the HP wrong.
- Potions are not card plays, so they don't trigger Tender. `[inference]` from the wording.
- **Data.** Jorbs as Ironclad: 12 fights, average 18 damage taken, 5.2 turns ([Jorbs sheet][jsheet]).

### 4.7 The Obscura (Act 2 hallway, Hive)

**Stats** ([wiki][wiki-obs], [wiki Parafright][wiki-para], [OP.GG][opgg-obs]):

- HP 123 (129 at A8).
- It always opens with **Illusion**, which summons a **Parafright**.
- After that it picks at random, never repeating: **Piercing Gaze** 10 (11), **Wail** (all enemies +3 Strength), or **Hardening Strike** 6 damage plus 6 block.
- **Parafright:** 21 HP. **Slam** for 16 (17 at A9) every turn. When killed it revives the next turn at full HP and **stunned**. Strength it has gained carries over through revives (the wiki notes a bug fix in v0.103.3 on exactly this).

Tactics:

- Focus the Obscura; the minion is a distraction. If you do kill the Parafright, the Obscura spends a turn re-summoning ([Steam: Nerf The Obscura][st-obs]). By this point you should have cheap attacks or AoE ([Steam: The Obscura][st-obs2]). `[several]` (Steam replies).
- Claim: minions leave when the summoner dies. This comes from a search summary and is **not confirmed** on the wiki. Check it in the simulator.
- **Data.** Jorbs as Ironclad: 18 fights, average only 8.7 damage taken, 4.5 turns ([Jorbs sheet][jsheet]). Strong decks end it fast.
- AoE hits both targets: Breakthrough, Conflagration, Whirlwind, Howl, Inferno. If you can't burst the Obscura this turn, killing the 21-HP Parafright skips at least one 16+ Slam. `[inference]`

---

## 5. Shop (the Merchant)

### 5.1 Mechanics (StS2)

Sources: [wiki][wiki-merchant]; [Spire Codex][codex-merchant], data from v0.103.2.

- **Stock:**
  - 5 class cards: 2 Attacks, 2 Skills and 1 Power. One of them is 50% off.
  - 2 colorless cards: 1 Uncommon and 1 Rare.
  - 3 relics. The rightmost is always a Shop relic.
  - 3 potions.
  - 1 card removal. Only one removal per visit.
- **Card prices:** Common about 48–53, Uncommon about 71–79, Rare about 143–158. Colorless cards cost about 15% more.
- **Potion prices:** Common about 48–53, Uncommon about 71–79, Rare about 95–105.
- **Relic prices:** Common 149–201, Shop 170–230, Uncommon 191–259, Rare 234–316. Relics got 25 gold cheaper in v0.100.0.
- **Removal price:** 75 gold, +25 per removal bought. At A6+ (Inflation): 100 gold, +50 each.
- **Relic effects:** Membership Card halves all prices. The Courier restocks and takes 20% off.
- **Foul Potion:** can be thrown at the Merchant for 100 gold ([wiki potion list][wiki-potlist]).

### 5.2 What strong players buy

- Guide consensus: removal usually gives the most value per gold early. Then a relic that changes how the deck works, then a card that fixes a weakness. Potions only when cheap or when you need one ([sts2front][front], search summaries of [MetaBot][metabot] and similar, low quality). `[several]`, but these are low-quality sources, and removal-first is also StS1 lore.
- Untapped's A6 advice: the first removal is still worth buying; after that, removals get "into Relic territory" ([Untapped ascension guide][uasc]). `[one]`
- **Data.** Untapped's Act 1 shop buy rates (A7+):
  - Dominate 54%
  - Battle Trance 41%
  - Offering 39% (58% in Act 2)
  - Colossus 38%
  - Taunt 38%
  - Unmovable 35%
  - Pommel Strike 35%
  - Bloodletting 34%
  - Flame Barrier 32%
  - Crimson Mantle 31%
  - Tremble 29%
  - Uppercut 28%
  - Shrug It Off 28%

  Commons such as Iron Wave (5%), Twin Strike (9%) and Thunderclap (7%) are almost never bought ([Untapped stats][ustat]).
- **Data.** Potions are rarely bought in Act 1: mostly 1–8%, with the highest being Blood Potion 16%, Power Potion 12% and Fairy in a Bottle 10%. These potion pages appear to pool all characters, apart from class-only potions. More are bought in Act 3: Fairy in a Bottle 37%, Blood Potion 31%, Power Potion 30%, Entropic Brew 26%, Duplicator 24% ([Untapped potion pages][upot]). So strong players spend early gold on the deck and buy potions with late spare gold.
- **When to save gold:**
  - Route to shops when you have 150+ gold; skip shops if you have under 75 ([sts2front][front], low quality). `[one]`
  - Take a detour for a shop early in Act 1 ([Steam: How tf][st-howtf]).
  - The Spoils Map, from the event The Legends Were True, pays 600 gold in the next act ([Untapped map guide][umap]).

---

## 6. Events

**Sources for this section:**

- Event options, current as of 2026-09: Untapped's act pages ([Overgrowth][uev1], [Underdocks][uev1b], [Hive][uev2], [Glory][uev3]).
- **Jorbs %**: how often Jorbs chose that option in his own runs. That covers v0.98.0–0.106.1, **all characters**, with the sample size n ([Jorbs sheet][jsheet]). This is revealed preference from one strong player, not proof.
- Guide recommendations: [TheGamer][tg-ev] (2026-03-15) and [Switchblade][sb-ev] (2026-04-16). Both are older and partly wrong; Switchblade, for example, swaps the Morphic Grove options.
- Chinese names: from search-result summaries of [GamerSky and other aggregators][gs-ev]. They have not been checked in the game.
- **Top-player notes:** Untapped's event pages carry Jorbs and/or Baalorlord comments for 19 of the 56 events. I folded them into the "Guides" column, linked as "UT event". Read on 2026-09-23; the comments are undated, so they are from some time before v0.107.1.

**Acts:** Act 1 is Overgrowth or Underdocks. Act 2 is the Hive. Act 3 is Glory. Several events are shared across acts.

| Event (zh) | Acts | Options (short) | Jorbs % (n) | Guides | Suggested default (condition) |
|---|---|---|---|---|---|
| Aroma of Chaos (混沌芳香) | 1 | Let Go: transform 1 / Maintain Control: upgrade 1 | Let Go 93 (15) | – | Transform a Strike or Defend |
| Brain Leech (脑蛭) | shared | Rip it off: −5 HP, colorless card reward / Share Knowledge: pick 1 of 5 cards | Rip 68 (60) | Baalorlord: the colorless option is his default unless he can't afford the HP. Jorbs: the colorless reward can be skipped, but the 1-of-5 pick is forced ([UT event][uev-bl]). | Rip if HP is comfortable |
| Byrdonis Nest (多尼斯异鸟巢) | 1 | Eat: +7 max HP / Take the Egg: a quest card, hatch at a rest site for the Byrdpip pet and the Byrd Swoop card | Eat 84 (19) | Jorbs' written comment: "Hatch the Egg!". Baalorlord favours the egg (a 0-cost damage source) ([UT event][uev-bn]). TheGamer: egg early, HP late. Switchblade: egg for Ironclad. GamerSky: the egg beats eating. | `[disputed]`: Jorbs' own data says eat; the written comments say hatch. Take the Egg if a rest site is reachable before the Act 1 boss, and accept that the pet blocks Pael's Legion (§9b). Otherwise Eat. |
| Dense Vegetation | 1 | Rest: heal a rest's worth, then fight 4 Wrigglers / Trudge On: 61–99 gold, −8 HP (Baalorlord also mentions a removal option) | – | Baalorlord: the fight is dangerous in the first floors; take it only if you have AoE ([UT event][uev-dv]). TheGamer describes an older version. | No AoE: take the non-fight option. Trudge On if HP > 8 plus a buffer. `[one]` `[inference]` |
| Jungle Maze Adventure | 1 | Join Forces: 35–65 gold / Solo: 135–165 gold, −18 HP | Join 83 (12) | – | Join; Solo only at high HP |
| Luminous Choir | 1 | Pay 100–149 gold for a random relic / remove 2 cards and gain the Spore Mind curse (1 energy, Exhaust) | Reach in 100 (3) | – | Remove 2 if you have starters left. Small n. |
| Morphic Grove | 1 | Group: lose ALL gold, transform 2 / Loner: +5 max HP | Group 89 (9) | TheGamer: take the Max HP | Group when gold is low. `[inference]` on the gold condition. |
| Room Full of Cheese | 1, 2 | Gorge: pick 2 of 8 commons / Search: −14 HP, Chosen Cheese relic | Search 82 (71) | TheGamer: Search if healthy | Search if HP − 14 leaves a safe margin |
| Sapphire Seed (蓝宝石种子) | 1 | Consume: heal 9 + upgrade 1 / Plant: Sown enchant | Consume 60 (15) | TheGamer and GamerSky: Consume | Consume |
| Self-Help Book | shared | Enchant options (Swift 2 on a Power, and others) | Entire Book 42, The Back 35, Passage 23 (79) | TheGamer: Sharp/Nimble over Swift | Take an enchant. Pick by target card. |
| Slippery Bridge | shared | Overcome: the shown card is removed / Hold On: −3 HP to reroll the shown card | Overcome 100 (56) | Switchblade: don't chase rerolls. TheGamer: reroll while HP allows. | Accept if the shown card is a Strike, Defend or curse. Otherwise reroll once or twice while HP is high. |
| The Sunken Statue | 1 | Dive: 101–121 gold, −7 HP / Grab the Sword: Sword of Stone relic | Sword 77 (47) | TheGamer: Sword if you expect to beat about 5 elites | Sword |
| Tablet of Truth | 1 | Decipher: −3 max HP, upgrade a random card (the event text says once you start you are locked in; Jorbs' sheet logs several Decipher steps) / Smash: heal 20 | Smash 56 (16) | TheGamer: Decipher unless low. Baalorlord: two upgrades for 9 max HP is the efficient trade when you have max HP to spare ([UT event][uev-tt]). | Smash if missing ≥20 HP; otherwise Decipher twice |
| Tea Master | 1, 2 | Bone Tea: 50 gold, upgrade your starting hand next combat / Ember Tea: 150 gold, +2 Strength for 5 combats / one more | Discourtesy 46, Ember 31, Bone 23 (13) | – | Low stakes |
| The Future of Potions? | shared | Trade a potion for an upgraded card of the same rarity | Trade 100 (45) | – | Trade your worst potion |
| The Legends Were True | shared | Nab the Map (Spoils Map: 600 gold next act) / leave: −8 HP, gain a potion | Map 42 (50) | TheGamer: the Map, almost always | `[disputed]`. Take the Map when a next act exists. |
| This or That? (THIS_OR_THAT) | shared | That: Clumsy curse (Unplayable, Ethereal) + random relic / This: −6 HP, 41–68 gold ([UT event][uev-tot]) | "Plain" 61 / "Ornate" 39 (74). His sheet's labels can't be mapped reliably to the current options. | TheGamer: the relic ("can be much more expensive than 48 gold") | **That** (relic + Clumsy) by default. Clumsy is Ethereal, so it exhausts itself when held and costs little, and it even feeds FNP. Take **This** only for a small loop deck, or if HP > 6 and gold completes a planned purchase. `[one]` `[inference]` |
| Unrest Site | 1 | Kill the Trees: −8 max HP, relic / Rest Anyways: full heal + Poor Sleep curse | Kill 83 (6) | – | Take the relic unless HP is critical |
| Wellspring (甘泉) | 1 | Bathe: remove 1, gain the Guilty curse (removes itself after 5 combats) / Bottle: a potion | Bathe 85 (26) | TheGamer and Switchblade: Bathe | Bathe |
| Whispering Hollow | 1 | Pay 26–44 gold for 2 potions / Hug: −9 HP, transform a card | Hug 100 (12) | TheGamer: the potions unless your belt is full | Hug to transform a Strike or Defend |
| Wood Carvings | 1 | Bird: turn a starter card into Peck / Snake: Slither enchant / Torus: Toric Toughness | Bird 44, Torus 38, Snake 19 (16) | – | Bird, which also helps against Vantom |
| Abyssal Baths | 1 (Underdocks) | Abstain: heal 10 / Immerse repeatedly. The cumulative cost runs 1, 3, 6, 10, 15 HP for +2, +4, +6, +8, +10 max HP (Jorbs). | Abstain 73 (22) | Baalorlord: on high difficulty usually take the heal; bathe only if rest sites are coming soon ([UT event][uev-ab]) | Abstain unless a rest site is within about 2 nodes |
| Doors of Light and Dark (光暗之门) | 1 (Underdocks) | Dark: remove 1 / Light: upgrade 2 random | Dark 67 (24) | Jorbs: upgrade early in Act 1 and remove later. Baalorlord: remove if you can already beat the act boss, otherwise upgrade ([UT event][uev-dld]). Guides: removal. | **Light** in the first floors or if the deck can't yet beat the boss; **Dark** later |
| Drowning Beacon (溺亡灯塔) | 1 (Underdocks) | Bottle: Glowwater Potion / Climb: Fresnel Lens relic (block cards you add get Nimble 2), −13 max HP | Climb 89 (19) | Jorbs and Baalorlord: Fresnel Lens, unless you have energy gain or need a potion now ([UT event][uev-db]) | Climb |
| Endless Conveyor | 1 (Underdocks) | Buy dishes off the belt | – | Jorbs: nearly everything is underpriced except the colorless card; keep buying until the gold runs out, unless a shop is coming ([UT event][uev-ec]) | Buy, keeping enough gold for the next shop's removal |
| Spiraling Whirlpool | 1 (Underdocks) | Drink: heal 1/3 of max HP / Observe: Spiral enchant on a basic Strike or Defend | Observe 93 (28) | – | Observe unless HP is critical |
| Sunken Treasury | 1 (Underdocks) | First chest: 52–67 gold / Second: 303–363 gold + Greed curse | First 81 (26) | – | First |
| Trash Heap | 1 (Underdocks) | Dive In: −8 HP, a random "forgotten" relic / Grab: 100 gold + a forgotten card | Dive 53 (32) | – | Either |
| Waterlogged Scriptorium | 1 (Underdocks) | Pay 99 gold: Steady enchant on 2 cards / +6 max HP / one more | Sponge 93 (15) | – | Sponge if you can afford it |
| Amalgamator (融合者) | 2 | Combine 2 Strikes into Ultimate Strike, or 2 Defends into Ultimate Defend | Strikes 62, Defends 38 (16) | Both guides: Strikes. Jorbs: Ultimate Defend (removing the Defends) suits decks that rely on Strength or Perfected Strike, where Strikes are already fine ([UT event][uev-am]). | Ironclad: combine **Defends**, unless the deck is short on block. See §3.7. |
| Bugslayer | 2 | Exterminate or Squash card | Exterminate 89 (19) | Jorbs: Exterminate, a 4-hit AoE that is easy to make strong ([UT event][uev-bs]) | Exterminate |
| Colossal Flower (COLOSSAL_FLOWER) | 2 | Stage 1: Extract 35 gold, or Reach Deeper (−5 HP). Stage 2: 75 gold, or −6 HP. Stage 3: 135 gold, or Enter the Center (−7 HP): Pollinous Core relic (every 4 turns draw 2). Needs ≥19 HP ([UT event][uev-cf]). | Reached deeper 59 at stage 1. Took the Core in 41 of 27 visits; extracted at stage 3 in 15. | Jorbs: treat it as HP-for-gold. Going to stage 3 costs 11 HP for 135 gold, "not bad at all". The Core costs 18 HP total and often isn't strong. Switchblade: go all the way or stop at stage 1. | Go deeper while HP − next step ≥ 50% of max HP and ≥ the next fight's expected damage. Extract 135 at stage 3. Take the Core only with high HP and no use for the gold. `[one]` `[data]` |
| Crystal Sphere | 2, 3 | Payment Plan: Debt curse, Divine 6 times / pay 51–99 gold, Divine 3 times | 50/50 (24) | Jorbs: 6 Divines, but only if a shop can remove the Debt; reveal carefully and check the colour band before uncovering ([UT event][uev-cs]) | Payment Plan if a shop is ahead in this act |
| Doll Room (DOLL_ROOM, 玩偶房) | 2 | RANDOM: a random doll / TAKE_SOME_TIME: −5 HP, choose 1 of 2 / EXAMINE: −15 HP, choose 1 of 3. The dolls ([UT relics][ur-bing]): **Bing Bong**, every card you add to the deck gets an extra copy, curses included; **Mr. Struggles**, at the start of each of your turns deal damage equal to the turn number to ALL enemies; **Daughter of the Wind**, +1 Block per Attack played. | Take Some Time 64, Examine 30, Random 6 (33). Took Bing Bong 64, Mr. Struggles 27, Daughter 3. | Baalorlord: usually pay 5 HP for two choices so you aren't stuck with Bing Bong; pay 15 only when you want one specific doll; small cycle decks should avoid Bing Bong. Jorbs: "Bing Bong for life!" ([UT event][uev-dr]). | **TAKE_SOME_TIME** by default. Then Bing Bong unless the deck is a small exhaust loop or you expect curses; otherwise Mr. Struggles (good in long and multi-enemy fights). Daughter last for Ironclad. EXAMINE only if HP ≥ 60% and Bing Bong specifically is wanted. `[several]` |
| Field of Man-Sized Holes | 2 | Perfect Fit enchant / Resist: remove 2 + Normality curse | Resist 80 (20) | Jorbs: treat it as a "card-remove-with-extra-steps", and remove Normality as soon as possible ([UT event][uev-fh]) | Resist, then remove Normality at the next shop |
| Infested Automaton | 2 | a random Power / a random 0-cost card | Power 55 (31) | – | Either |
| The Lost Wisp | 2 | Capture: Decay curse + Lost Wisp relic / Search: 45–75 gold | Search 64 (22) | – | Search |
| Potion Courier | 2, 3 | 3 Foul Potions / 1 random Uncommon potion | Ransack 56 (55) | Switchblade: the Foul Potions (sell them to the Merchant, or use them in the Fake Merchant event) | Foul Potions if a shop is ahead |
| Spirit Grafter | 2 | Let It In: heal 25 + Metamorphosis card / Rejection: −10 HP, upgrade | Rejection 89 (19) | – | Rejection |
| Stone of All Time | 2 | Lose a potion for +10 max HP / −6 HP for a Vigorous 8 enchant on an Attack | Lift 57 (21) | – | Either |
| Symbiote | 2, 3 | Corrupted enchant on an Attack / transform a card | Transform 55 (40) | Switchblade: Corrupted if you have a strong attack | Either |
| The Lantern Key | 2 | Keep the key (fight for it) / Return it: 100 gold | Return 100 (10) | – | Return |
| Welcome to Wongo's | 2 | 100 gold: common relic / 200 gold: featured relic / … | Bargain Bin 67 (12) | Switchblade: skip unless 300+ gold | Buy only if gold is ≥ what the next shop needs |
| Zen Weaver | 2 | 250 gold: remove 2 / … | mixed (7) | – | Remove 2 if gold allows |
| Battleworn Dummy | 3 | Fight a dummy for rewards: 75 HP dummy for a potion, 150 HP for 2 random upgrades, a third, larger setting | – | Jorbs: losing costs you little; 300 damage in 3 turns is hard for all but the fastest decks; two upgrades are nearly as good as a relic ([UT event][uev-bd]) | The 150 HP setting, unless the deck clearly deals 100+ damage per turn |
| Grave of the Forgotten (遗忘之墓) | 3 | Forgotten Soul relic / Decay curse + Soul's Power enchant | Accept 72 (29) | – | Accept |
| Reflections | 3 | Shatter: duplicate your deck + Bad Luck / downgrade 2, upgrade 4 | Shatter 67 (33) | – | Shatter |
| The Round Tea Party | 3 | Royal Poison + full heal / Pick a Fight: −11 HP, relic | Fight 100 (26) | – | Fight unless HP is critical |
| War Historian, Repy | 3 | uses the Lantern Key | Cage 100 (18) | – | – |

Take-away principles from the guides: free card removal and enchantments are the most
valuable outcomes. Take risks for relics in Act 2, and refine in Act 3
([Switchblade][sb-ev]; the search summary of [sts2guides][sts2guides-ev]). `[several]`,
low quality.

---

## 7. Rest sites

- **Options** ([wiki][wiki-rest]):
  - Rest heals 30% of max HP.
  - Smith upgrades one card.
  - Relic-granted options: Train/Lift (Girya: +1 Strength, up to 3 times), Dig (Shovel: a relic), Cook (Meat Cleaver: remove 2 cards, +5 max HP), Kindle (Pumpkin Candle), and resting extras from Dream Catcher, Regal Pillow, Stone Humidifier and Tiny Mailbox.
  - Clone, if you have a Clone-enchanted card.
  - Hatch, for the Byrdonis Egg.
  - Miniature Tent lets you take more than one option.
- **HP thresholds:**
  - Untapped: rest below about 40–50% when an elite or boss is forced next; never rest at about 80%; lean toward smithing ([Untapped rest guide][urest]).
  - Steam A10 player: rest only below 25 HP before hallway fights, or below 35 HP before bosses ([Steam: How tf][st-howtf]).
  - Generic guide: smith at 65%+, rest at 40% or lower, and decide the middle case by the next fight ([gamestrategyhub / metabot search summary][rest-sum]).
  - `[several]`
- **Data.** Jorbs as Ironclad smithed 61% of the time in Act 1 (rested 39%), 55% in Act 2 (rested 35%, cloned 7%), and 42% in Act 3 (rested 47%) ([Jorbs sheet][jsheet]).
- A2+ Ancients heal only 80% of missing HP, so rest sites are worth more ([Untapped ascension guide][uasc]).
- Inferno decks: plan to rest regularly ([Jorbs][jtl]).
- Upgrade priorities are in §3.8.

---

## 8. Potions

### 8.1 List

From [wiki][wiki-potlist]. The numbers are the wiki's at the time of reading; the bot should read exact values from the game.

- **Common:**
  - Damage and debuffs: Fire (20 damage), Explosive Ampoule (10 to all), Vulnerable (3), Weak (3)
  - Card generation: Attack, Colorless, Power and Skill potions (choose 1 of 3; it is free this turn)
  - Stats: Strength (+2), Flex (+5 Strength this turn), Dexterity (+2), Speed (+5 Dexterity this turn)
  - Other: Block (12), Energy (+2), Swift (draw 3)
  - **Ironclad only:** **Blood Potion** heals 20% of max HP and can be drunk outside combat.
- **Uncommon:**
  - Blessing of the Forge (upgrade your hand for the combat)
  - Clarity Extract
  - Cure All (1 energy, draw 2)
  - Duplicator (your next card is played twice)
  - Fortifier (triples your block)
  - Fysh Oil
  - Gambler's Brew
  - Heart of Iron (7 Plating)
  - Liquid Bronze (3 Thorns)
  - Potion of Binding (1 Weak and 1 Vulnerable to all)
  - Powdered Demise (9 per turn)
  - Radiant Tincture
  - Regen (5)
  - Stable Serum
  - Touch of Insanity
  - **Ironclad only:** **Ashwater** exhausts any number of cards in your hand.
- **Rare:**
  - Beetle Juice (−30% enemy damage for 4 turns)
  - Bottled Potential
  - Distilled Chaos
  - Droplet of Precognition
  - Entropic Brew (can be used outside combat)
  - Fairy in a Bottle
  - Fruit Juice (+5 max HP, can be used outside combat)
  - Gigantification (next Attack deals ×3)
  - Liquid Memories
  - Lucky Tonic (Buffer)
  - Mazaleth's Gift (Ritual)
  - Orobic Acid
  - Shackling Potion (all enemies −7 Strength this turn)
  - Ship in a Bottle
  - Snecko Oil
  - **Ironclad only:** **Soldier's Stew** gives every "Strike" card Replay for the combat.
- **Special:**
  - Ambergris: heal 50%, and an extra turn if used in combat. New in beta, from the Neow's Sacrifice relic ([v0.109][wiki-109]).
  - Foul Potion: 12 damage to everyone, or 100 gold from the Merchant.
  - Glowwater: exhaust your hand, draw 10.
  - Potion-Shaped Rock: 15 damage.

### 8.2 How strong players rate and use them

- **Mobalytics / Japanese Export potion tiers** (2026-07-27, all characters; other classes' potions left out below) ([link][mpt]):
  - "Good Always": Orobic Acid, Touch of Insanity, Beetle Juice, Cure All, Distilled Chaos, Ship in a Bottle, Colorless/Power/Skill Potion, Snecko Oil, Potion of Binding, Duplicator, Gigantification, Heart of Iron, Lucky Tonic, Liquid Memories, Weak Potion, Shackling Potion, Fortifier, **Blood Potion**, Regen, Energy.
  - "Good Early": Attack, Fire, Explosive Ampoule, Potion-Shaped Rock, Blessing of the Forge, Liquid Bronze, Block, Vulnerable, Powdered Demise, Strength.
  - "Good Late": Droplet of Precognition, Gambler's Brew, Fairy in a Bottle, Swift, Stable Serum, Clarity.
  - "Niche/Average": Entropic Brew, Glowwater, **Soldier's Stew**, Bottled Potential, Radiant Tincture, Foul Potion, Mazaleth's Gift, Fysh Oil, Dexterity, Flex, Fruit Juice, **Ashwater**.
  - "Mediocre": Speed.
- **Ashwater:** burn statuses or starter cards in long fights, best in bosses. Swap it out if you have no exhaust synergy ([Baalorlord on the Untapped potion page][upot-ash]).
- **Use them proactively, don't hoard.** From A4 on, potions are tools to end fights a turn sooner and save HP, not bombs saved for the boss; for example, a Fire Potion in an elite ([Untapped ascension guide][uasc]). A potion guide's snippet makes the same point: hoarders reach the boss with full, unused slots ([sts2.gg][stsgg-pot], search snippet only). `[several]`
- **Data.** Jorbs as Ironclad was offered 1,329 potions, picked up 805 (61%), drank 591 of those (73%), and discarded 164 (20%) ([Jorbs sheet][jsheet]). So strong players drink most of what they carry, and throw potions away to make room for better ones.
- **Per monster:**
  - Byrdonis: damage potions (a search-summary guide, `[one]`).
  - Vantom: an HP-saving potion on Dismember ([NoobFeed][noob]).
  - Vantom, `[inference]`: while Slippery is up, **single-instance damage potions are wasted**. Fire, Potion-Shaped Rock and Explosive Ampoule each deal 1 per stack.
  - Hunter Killer, `[inference]`: potions don't trigger Tender.
  - Entomancer, `[inference]`: Shackling or Weak on the Beeeees! turn; Liquid Bronze triggers on each of the 7 hits.

---

## 9. StS2-specific vs carried over from StS1

| Idea | Status |
|---|---|
| A Vulnerable archetype (Tremble, Taunt, Dismantle, Bully, Dominate, Cruelty, Colossus, Break) | **StS2-specific** ([Untapped][ug]) |
| Offering / Battle Trance / Bloodletting / Pommel Strike as top acceleration | Carried over from StS1 and confirmed for StS2 by every top list |
| Strength as the Ironclad's main plan (Demon Form, Inflame, Heavy Blade, Limit Break) | **StS1.** In StS2 it is demoted ([Jorbs][jtl], [Untapped][ug]). Heavy Blade and Limit Break don't exist in StS2. |
| Corruption + Dark Embrace + FNP as the defining engine | StS1 core. In StS2 Corruption is Ancient-only, and Dark Embrace is `[disputed]`. |
| Barricade + Entrench + Body Slam | StS1 lore. In StS2 Entrench is colorless, and Barricade is rated B to D. Unmovable is the new block anchor. |
| "Fight 2–3 elites in Act 1" | StS1 lore, repeated by Untapped's StS2 map guide ([umap]) and Steam A10 players; tempered by "hard hallway fights can be deadlier" ([Steam][st-act1]) |
| Card removal first at shops | StS1 lore, repeated by StS2 guides. Only the prices are StS2-specific. |
| Rest heals 30% | Same as StS1; confirmed ([wiki][wiki-rest]) |
| Burning Blood heals 6 | Same as StS1 ([wiki][wiki-ic]) |
| Slippery, Tender, Personal Hive, Illusion revive, Territorial | **StS2-specific monsters** ([wiki][wiki-vantom]) |
| "Get Artifact / debuff immunity for debuff bosses" | **StS1 only.** In StS2 players cannot obtain Artifact ([wiki][wiki-artifact], [Steam][st-immunity]). See §9c.2. |
| Enchantments, Ancients, quest cards (Byrdonis Egg, Spoils Map) | **StS2-specific** ([umap], [wiki rest][wiki-rest]) |

---

## 9b. Ancients (the act-start events)

### 9b.1 Mechanics (StS2-specific; there is no StS1 equivalent beyond Neow's bonus)

- **Neow** opens every run. He is unlocked after the first run of a save file.
  - He shows 3 options: one relic from a "curse" pool (options with a downside) plus two from a positive pool.
  - Some positive relics appear only if their curse-pool counterpart wasn't drawn: Golden Pearl vs Cursed Pearl, Arcane Scroll vs Hefty Tablet, New Leaf vs Leafy Poultice, Precise Scissors vs Precarious Shears, and Phial Holster / Lost Coffer vs Neow's Sacrifice.
  - v0.109 added Dowsing Rod and Neow's Sacrifice. Sources: [wiki Neow][wiki-neow], [v0.109][wiki-109].
- **Act 2 start** (floor 18 in the bot's runs): one of **Orobas, Pael, Tezcatara**, with equal odds. **Darv** can also appear once unlocked.
- **Act 3 start:** one of **Nonupeipe, Tanx, Vakuu**, plus Darv.
- Each Ancient offers 3 relics, **one from each of its internal pools**. You must take one ([wiki Ancients][wiki-anc]).
- A2+ Ancients heal only 80% of missing HP ([Untapped ascension guide][uasc]).

### 9b.2 Evidence used

| Source | What it is |
|---|---|
| **UT** | Untapped "Ancient Choice Stats" on each relic page: pick % when offered, plus act and run win-rate deltas. A7+ single-player, **all characters pooled**, patch window not shown. The versions are main-branch where the beta text differs ([Untapped Ancient relic pages][ur-anc]). |
| **Jorbs** | The "Ancients" sheet of his spreadsheet: Elo, overall pick %, Ironclad pick %. v0.98–0.106.1, and the sample sizes are small and not shown ([sheet][jsheet]). |
| **nat1** | DoggertQBones relic tier list, 2026-05-19, before v0.110 ([link][n1-rel]) |
| **BB** | BrokenBuilds Act 2 Ancient guide, 2026-05-03, updated 2026-07-28, "Major Update 2" ([link][bb-anc]) |
| **DS** | DualShockers ranking of the Ancients, 2026-05-12 ([link][ds-anc]). Order: Nonupeipe > Tanx > Orobas > Pael > Darv > Vakuu > Tezcatara > Neow. |

**Beta changes that post-date most of this evidence:**

- v0.110.0: **Toasty Mittens** now exhausts 1 card *from your hand*; before, it was the top card of the draw pile ([wiki][wiki-mittens]). **Seal of Gold** costs 3 gold per activation, down from 5 ([wiki][wiki-seal]).
- v0.111.0: **Brightest Flame**, the card Storybook gives, now costs **2** max HP per play, up from 1 ([wiki][wiki-bf]).
- Beta: Toy Box gives 5 Wax relics instead of 4 ([UT][ur-anc]).
- The Pael relics show no beta changes.

### 9b.3 TEZCATARA (Act 2)

Pools: pool 1 is Nutritious Soup, Very Hot Cocoa or Yummy Cookie. Pool 2 is Biiig Hug, Storybook or Toasty Mittens. Pool 3 is Golden Compass, Pumpkin Candle, Toy Box or Seal of Gold ([wiki Tezcatara][wiki-tez]).

| Relic (id) | Pool | Effect (v0.111) | UT pick / act Δ / run Δ | Jorbs Elo, pick % (all / IC) | nat1 | BB |
|---|---|---|---|---|---|---|
| NUTRITIOUS_SOUP | 1 | All Strikes get Tezcatara's Ember: cost 0, +3 damage, **Eternal** (can't be removed) ([wiki enchant][wiki-ench]) | 45% / +7 / +1 | 1564 and 1551 (two rows), 22–17% / 50–100% | D | top for Ironclad "if Strikes remain" |
| VERY_HOT_COCOA | 1 | +4 energy at the start of each combat | 45% / −2 / −2 | 1692, 57% / **75%** | B | mid |
| YUMMY_COOKIE | 1 | Upgrade 4 cards | 56% / −4 / −4 | 1630, 41% / 17% | B | mid |
| TOASTY_MITTENS | 2 | Start of turn: exhaust 1 card from hand, +1 Strength | 21% / **+9 / +8** | 1468, 10% / 0% | D (pre-v0.110) | **top for Strength Ironclad** |
| STORYBOOK | 2 | Adds Brightest Flame: 0 cost, +2 energy, draw 2, lose 2 max HP (upgraded +3 / draw 3), no Exhaust | 38% / +3 / +2 | 1681, 62% / 50% | **S** | top ("highest ceiling") |
| BIIIG_HUG | 2 | Remove 4 cards now; add a Soot status every time you shuffle | 31% / +2 / +3 | 1631, 41% / 25% | C | mid; DS warns it can wreck a deck |
| SEAL_OF_GOLD | 3 | Start of turn: spend 3 gold to gain 1 energy | 18% / +8 / +3 | **1709** (top), 62% / 60%, at the 5-gold version | D (5-gold version) | – |
| PUMPKIN_CANDLE | 3 | +1 energy per turn; goes out after 5 combats; Kindle at a rest site (+5 combats) | 26% / +7 / +3 | 1618 and 1435, 50–12% / 100–0% | D | situational (needs campfires) |
| GOLDEN_COMPASS | 3 | Replace the Act 2 map with one special path | 23% / +2 / −2 | 1479, 11% / 0% | B | – |
| TOY_BOX (not yet met) | 3 | 5 Wax relics; one melts every 3 combats | 18% / +11 / +1 | 1541, 22% / 0% | F | – |

How the sources summarise Tezcatara:

- BB: "Ironclad with Strikes still in deck takes Toasty Mittens or Nutritious Soup".
- A search summary of guide sites calls Tezcatara the consensus-weakest Act 2 Ancient ([sts2front][front-anc] and others, `[one]`). DS agrees and ranks it 7th of 8.

**Ranked for Ironclad**, with conditions. One option comes from each pool, so compare the three offered. `[disputed]`: this is my synthesis of the sources above.

1. **TOASTY_MITTENS** if the deck has an exhaust payoff (Feel No Pain, Ashen Strike, Evil Eye, Dark Embrace, Pact's End, Juggernaut plus FNP) or at least 4 junk cards to burn (Strike, Defend, statuses, curses). Evidence: the best UT deltas, and BB's pick for Ironclad. The only low ratings came before the v0.110 change. Check in game whether you choose the exhausted card.
2. **STORYBOOK** if max HP ≥ about 60 and the deck has cards to spend the energy and draw on. It was weakened by the v0.111 max-HP cost, so drop it below Seal of Gold and Cocoa when max HP < 55.
3. **SEAL_OF_GOLD** if gold ≥ about 100 after reserving the next shop's removal. It is effectively a permanent +1 energy relic while gold lasts; 3 gold a turn is about 15–25 gold per fight. It is Jorbs' top Tezcatara pick, and it is cheaper since v0.110.
4. **VERY_HOT_COCOA** if the deck has 2 or more setup Powers or expensive openers: Demon Form, Barricade, Inferno, Crimson Mantle, Unmovable, Dark Embrace, Pyre. Jorbs picked it 75% of the time as Ironclad.
5. **NUTRITIOUS_SOUP** if at least 4 Strikes remain and the deck has Strength or Strike payoffs (Perfected Strike, Hellraiser, Soldier's Stew, Thrash) or is short on damage. Remember the Strikes become Eternal and can no longer be removed.
6. **PUMPKIN_CANDLE** if an elite-heavy stretch comes before the next rest site.
7. **BIIIG_HUG** if at least 6 starter cards remain and the deck has exhaust to burn the Soot.
8. **YUMMY_COOKIE** as the default filler. It is the most-picked option but has negative deltas.
9. **GOLDEN_COMPASS:** the bot can't plan the special path. Avoid it until tested.
10. **TOY_BOX:** last.

### 9b.4 PAEL (Act 2)

Pools, per [wiki Pael][wiki-pael]:

- **Pool 1:** Flesh, Horn or Tears.
- **Pool 2:** Wing, Claw, Tooth or Growth. Claw needs at least 3 enchantable Defends, Tooth needs at least 5 removable cards, and Growth is half as likely as the others.
- **Pool 3:** Blood, Eye or Legion. Legion is not offered if you already have a pet, such as Byrdpip.

| Relic (id) | Pool | Effect | UT pick / act Δ / run Δ | Jorbs Elo, pick % (all / IC) | nat1 | BB |
|---|---|---|---|---|---|---|
| PAELS_BLOOD | 3 | Draw 1 extra card each turn | **63% / +9 / +7** | 1422, 17% / 20% | A | "the safest top-tier pick" |
| PAELS_LEGION | 3 | Doubles the Block gained from a card, then sleeps 2 turns | 52% / +5 / +4 | 1533, 21% / 33% | A | – |
| PAELS_CLAW | 2 | All Defends get Goopy: they gain Exhaust, and each play permanently adds +1 Block ([wiki enchant][wiki-ench]) | 26% / −9 / −3 | **1741** (top), 89% / **80%** | C | strong (Defends grow to 20–25 in long fights) |
| PAELS_GROWTH | 2 | Enchant 1 card with Clone: it can be duplicated at rest sites, and copies double | 32% / −14 / 0 | 1710, 71% / 80% | **S** ("rarely wanted, run-winning when") | strong |
| PAELS_TOOTH | 2 | Remove 5 cards; after each combat, 1 comes back upgraded | 20% / −7 / −5 | 1653, 45% / 50% | F | – |
| PAELS_FLESH | 1 | +1 energy on turn 3 and every turn after | 44% / −3 / −3 | 1488, 21% / 14% | B | – |
| PAELS_TEARS | 1 | End your turn with unspent energy: +2 energy next turn | 35% / −5 / −2 | 1541, 27% / 29% | D | strong |
| PAELS_HORN | 1 | Add 2 Relax: 3 cost, 16 Block, next turn draw 2 and +2 energy, Exhaust ([wiki][wiki-relax]) | 14% / −7 / −5 | 1493, 17% / 0% | C | – |
| (PAELS_WING, not met) | 2 | Sacrifice card rewards; every 2 sacrifices gives a relic | 33% / −14 / −6 | 1685, 52% / 50% | B | – |
| (PAELS_EYE, not met) | 3 | The first turn each combat you play no cards: exhaust your hand and take an extra turn | 10% / −13 / −7 | 1414, 8% / 0% | D | – |

**The main disagreement.** The UT population and nat1 rate **Blood** and **Legion** highest. Jorbs rates pool 2 highest: Claw, then Growth, then Wing, then Tooth. He picks Blood only 17% of the time. The consensus points: Pael is the most consistent Act 2 Ancient ([BB][bb-anc]; the search summary; DS ranks it 4th of 8).

**Ranked for Ironclad.** `[disputed]`: my synthesis.

1. **PAELS_BLOOD**: +1 card every turn for the rest of the run. Best by population data and two guides.
2. **PAELS_CLAW** if at least 3 Defends remain *and* the deck has an exhaust payoff (FNP, Ashen Strike, Evil Eye, Juggernaut). The Defends turn into exhaust fuel that grows. It is Jorbs' top pick.
3. **PAELS_LEGION** if the deck has one or two big block cards (Blood Wall, Impervious, Flame Barrier, Colossus). It is unavailable if you have a pet.
4. **PAELS_GROWTH** only with a clear clone target and at least 2 rest sites ahead in the run. Good targets: Offering, Feed, Stone Armor (Jorbs: "keep an eye out for the opportunity to clone this"), or a key Power. Each duplication costs a rest-site action.
5. **PAELS_FLESH**: a solid long-fight energy relic; good for bosses.
6. **PAELS_TEARS**
7. **PAELS_HORN**
8. **PAELS_TOOTH:** avoid. It thins the deck only temporarily.

### 9b.5 The other Ancients, briefly

UT picks and deltas; Jorbs' top Elo; the relics the data favours.

| Ancient (act) | Relics (short) | Data-favoured / notes |
|---|---|---|
| **NEOW** (run start) | Silver Crucible (the first 3 card rewards are upgraded; the first chest is empty), Leafy Poultice (transform 1 Strike + 1 Defend, −12 max HP), Stone Humidifier (+5 max HP per Rest), Precarious Shears (remove 2, −16 HP), Neow's Bones (2 random Neow relics + a curse), New Leaf (transform 1), Silken Tress (lose all gold; your first card reward gets Glam), Large Capsule (2 relics + an extra Strike and Defend), Neow's Talisman (upgrade 1 Strike and 1 Defend), Fishing Rod, Scroll Boxes, Phial Holster, Small Capsule, Kaleidoscope, Precise Scissors (remove 1), Booming Conch (in elite fights: +2 draw, +1 energy), Arcane Scroll (a random rare), Lead Paperweight (1 of 2 colorless cards), Hefty Tablet (1 of 3 rares + an Injury), Pomander (upgrade 1), Nutritious Oyster (+11 max HP), Golden Pearl (+150 gold), Cursed Pearl (+333 gold + Greed), Lava Rock (the Act 1 boss drops 2 relics), Winged Boots, Neow's Torment (Neow's Fury card), Lost Coffer; beta: Dowsing Rod, Neow's Sacrifice (Ambergris potion + Guilty) | Jorbs' Elo order: **Silver Crucible 1829** (IC 64%), Leafy Poultice 1802, **Stone Humidifier 1779 (IC 86%)**, Precarious Shears 1772, Neow's Bones 1767. His bottom: Lost Coffer, Neow's Torment, Scroll Boxes, Cursed Pearl, Winged Boots, Lava Rock. UT best act deltas: Neow's Sacrifice +12/+5, Silver Crucible +11/+1, Neow's Talisman +10/+3, Stone Humidifier +7/+4, Neow's Torment +7/+4. UT worst: Arcane Scroll −10/−3, Hefty Tablet −9/−4, Neow's Bones −4/−1. Most-picked: Silken Tress 78%. |
| **OROBAS** (act 2) | Prismatic Gem (+1 energy per turn; card rewards include other colours), Archaic Tooth (transform a starter card into its Ancient version; for Ironclad presumably Bash → Break), Touch of Orobas (replace Burning Blood with its Ancient version, Black Blood per [wiki][wiki-ic]), Glass Eye (2 common + 2 uncommon + 1 rare cards), Electric Shrymp (Imbued enchant on a Skill), Sand Castle (upgrade 6 random), Radiant Pearl, Alchemical Coffer (+4 potion slots, filled), Sea Glass, Driftwood (reroll card rewards) | **Prismatic Gem**: UT 51%, +11/+8; Jorbs #1 (IC 100%). **Archaic Tooth**: BB calls it an "S-tier insta-pick on every character", but Jorbs' Elo is only 1499 (`[disputed]`). BB: Touch of Orobas is C-tier on Ironclad (Jorbs IC 0%). Glass Eye: Jorbs #2 (IC 100%), UT −14/−8 (`[disputed]`). |
| **DARV** (act 2 or 3, once unlocked) | Runic Pyramid (don't discard your hand), Pandora's Box (transform all Strikes and Defends), Astrolabe (transform 3 + upgrade), Snecko Eye, Philosopher's Stone, Empty Cage, Black Star, Calling Bell, Dusty Tome (an Ancient card), Ectoplasm, Velvet Choker, Sozu | **Runic Pyramid**: UT +9/+12; Jorbs #1 (IC 83%); BB "arguably strongest". **Pandora's Box**: UT +8/+8 in act 2; Jorbs #2. Snecko Eye: UT +18/+21 but rarely picked (19%). |
| **NONUPEIPE** (act 3) | Glitter (card rewards get Glam), Diamond Diadem (beta: start combat with 20 Block, kept into turn 2), Brilliant Scarf (the 5th card each turn is free), Beautiful Bracelet (Swift enchant), Jewelry Box (an Apotheosis), Signet Ring (888 gold in beta), Blessed Antler, Delicate Frond, Looming Fruit (+31 max HP), Fur Coat | UT run deltas: Beautiful Bracelet +7, Brilliant Scarf +4, Jewelry Box +4. Jorbs' Elo: Glitter #1, then Diamond Diadem (old version), then Brilliant Scarf. |
| **TANX** (act 3) | Sai (7 Block per turn), Crossbow (a free random Attack each turn), Iron Club (draw 1 every 4 cards), Tri-Boomerang, Throwing Axe, Meat Cleaver (Cook at rest sites), Spiked Gauntlets, War Hammer, Claws, Tanx's Whistle | UT: **Crossbow +15**, **Sai 65% / +12**, Iron Club +10. Jorbs: Meat Cleaver #1, Crossbow (IC 100%). |
| **VAKUU** (act 3) | Whispering Earring (+1 energy; Vakuu plays your first turn), Music Box (Ethereal copy of your first Attack each turn), Fiddle, Jeweled Mask, Choices Paradox, Preserved Fog, Lord's Parasol, Distinguished Cape, Sere Talon, Blood-Soaked Rose | Whispering Earring: Jorbs #1 (IC 89%) but UT −12 (`[disputed]`). UT: Music Box +5, Fiddle +6. Jeweled Mask is the most picked (74%) with a −4 delta. |

All relic effects in this table are from the [Untapped Ancient relic pages][ur-anc], v0.111 wording where beta differs.

---

## 9c. Act 3 (Glory): the fights that end runs

**Sources used:**

- **Untapped encounter pages:** moves and HP, readable at the Default / A8 / A9+ settings, plus Ironclad death rates at A7+ ([UT enemies][ut-enemies]). The numbers below are **Default**.
- **Wiki monster pages:** mechanics text and version history.
- **Flare's boss guide on Untapped** ([UT bosses guide][ubosses]). Undated, 2026. Written before Aeonglass replaced Doormaker, though it mentions the v0.102 beta.
- **Jorbs' encounter sheet:** Ironclad, v0.98–0.106.1, mostly A10 ([sheet][jsheet]).
- **Steam threads.**

### 9c.1 The act (current pool, v0.107.1 and later)

From [wiki Glory][wiki-glory]:

- 13 rooms in total.
- **First 2 fights** come from a weak pool: Devoted Sculptor, 3 Scrolls of Biting, or Living Shield + Turret Operator.
- **Hallways:** Axebot, Construct Menagerie, Fabricator, Frog Knight, Globe Head, Owl Magistrate, 4 Scrolls of Biting, Slimed Berserker, The Lost and Forgotten.
- **Elites:** Knight Gang, Mecha Knight, Soul Nexus.
- **Bosses:** **Queen, Test Subject, Aeonglass.** Aeonglass replaced Doormaker in v0.107.1.
- At A10 you fight two bosses, and scaling resets between them ([Untapped ascension guide][uasc]).

| Fight | Ironclad death rate, UT A7+ (fights) | Jorbs as Ironclad: fights / avg damage taken / avg turns / deaths |
|---|---|---|
| Aeonglass (boss) | **34%** (12,000) | 3 / 32 / 7.3 / 0 |
| Test Subject (boss) | **33%** (13,000) | 30 / 28.9 / 9.5 / 6.7% |
| Queen (boss) | **29%** (13,000) | 33 / 31.5 / 8.4 / 0 |
| Mecha Knight (elite) | 6% | 38 / 14.9 / 6.3 / 0 |
| Soul Nexus (elite) | 6% | 40 / 22.2 / 5.7 / 0 |
| Knight Gang (elite) | 5% | 40 / 16.2 / 4.5 / 0 |
| Owl Magistrate | 4% | 3 / 8.3 / 3.0 / 0 |
| Frog Knight / Slimed Berserker / Many Scrolls of Biting | 3% each | 8 / 11.1 / 4.8; 5 / 4.2 / 6.6; 2 / 5 / 3 |
| Axebot | 2% | 1 fight |

The Act 3 bosses are where Ironclad runs die, even for A7+ players `[data]`. Jorbs never lost to the Queen in 33 A10 fights, but his fights last 8 to 10 turns. That means you need a real engine, not a burst.

### 9c.2 Players cannot get Artifact in StS2

This is a major difference from StS1.

- The wiki's Artifact page (updated 2026-09-01) says only enemies can currently obtain it ([wiki Artifact][wiki-artifact]).
- A Steam thread confirms there is no player debuff immunity, and says this is deliberate, because "several bosses" apply 99 Weak and/or Vulnerable ([Steam: immunity][st-immunity]).
- I scanned all relic, card and potion texts on Untapped and found no player-side debuff removal.

So guide advice to "use Artifact charges" against the Queen ([STS2 Companion][comp-queen]; a search summary) is **StS1 lore. Ignore it.**

What does help:

- **Frail only reduces Block from cards.** Block from buffs and powers (Plating, Rage and others) and from relics is unaffected ([wiki Frail][wiki-frail]). For Ironclad that means Crimson Mantle, Feel No Pain, Stone Armor (Plating), Rage and block relics are Frail-proof. `[one]` + card text.
- **Weak** reduces your attack damage. Non-attack damage (Inferno pings, Juggernaut, Flame Barrier reflection) is presumably unaffected. `[inference]`: verify in the sim.
- **Enemies with Artifact:** Mecha Knight (3), Aeonglass (3), and the Constructs. Each debuff you apply uses up one stack, so strip them with cheap debuffs before Dominate, Uppercut or Tremble matter. Jorbs notes Vulnerable removes an Artifact charge ([UT event: Bugslayer][uev-bs]); Baalorlord says the same of Uppercut ([Baalorlord][btl]).

### 9c.3 THE QUEEN (Act 3 boss, floor 48)

Sources: [UT encounter][ut-queen]; [wiki Queen][wiki-queen]; [Flare][ubosses]; [Selphie, 2026-04-16][selphie-queen].

**Enemies:**

- **Queen:** 400 HP (419 at A8). Has no attack while the Torch Head lives.
- **Torch Head Amalgam:** 199 HP (211 at A8). It is a **Minion**: "Minions abandon combat without their leader". So **killing the Queen ends the fight**. No source lists a revive for the Torch Head, unlike the Parafright or Test Subject.

**The Queen's script:**

| Turn | Move | Effect |
|---|---|---|
| 1 | Malicious / "Puppet Strings" | 3 **Chains of Binding** on you. Each turn, the first 3 cards you draw are **Bound**, and only one Bound card can be played per turn. They are un-Bound at end of turn. Cards drawn *after* those three are free. |
| 2 | You Are Mine | **99 Frail, 99 Weak, 99 Vulnerable**, effectively permanent |
| 3+, while the Torch Head lives | Burn Bright for Me, every turn | Queen gains 20 Block; allies gain +1 Strength. Flare says this includes herself and the Torch Head. |
| After the Torch Head dies | cycle | Off with Your Head 3×5 (4×5 at A9) → Execution 15 (18) → Empower +2 Strength → repeat |

**The Torch Head's cycle:** Tackle 18 (19 at A8), then Tackle 18. Then it loops Beam 8×3 → Tackle 14 (15) → Tackle 14 (15). Its Strength grows +1 per turn, and your Vulnerable multiplies each hit by 1.5. That fits what the bot has seen: 18–26 single hits and 9–16×3.

**Timing, from the script:** your turn 1 is clean. Turn 2 has Bound. From turn 3 on you are Frail, Weak and Vulnerable.

**How strong players plan it:**

- **Plan A: kill the Torch Head first.** This is the consensus:
  - [Steam: Tips for Queen][st-queen-tips] and [Steam: Ironclad and the Queen][st-queen-ic]
  - [Steam: busted?][st-queen-busted]: "The minion does the majority of the damage"
  - [Selphie][selphie-queen]
  - [Duckie's Steam guide][steam-bossguide]: killing it resets the scaling, and the Queen then buffs only herself

  `[several]`
- **Plan B: race the Queen.**
  - Selphie: kill the minion first unless you can kill the Queen within about 5 turns.
  - One Steam reply: that means about 400 damage in 4 turns, into her +20 Block per turn.
  - Another reply: leave the minion low and hit the Queen while you can still block the minion.

  `[several]`
- **Card draw is the counter to Bound.**
  - "You really need card draw for her" ([Steam: busted?][st-queen-busted]); also [Steam: Tips][st-queen-tips] and Flare ("requires strong card draw").
  - Auto-play effects that bypass the hand limit are strong ([Steam][st-queen-busted]).
  - For Ironclad the draw cards are Pommel Strike, Battle Trance, Offering, Burning Pact, Dark Embrace and Pael's Blood. The likely auto-play cards are Havoc, Stampede, Hellraiser and Cascade. `[several]` for draw; `[inference]` for which Ironclad cards bypass Bound.
- **Winning Ironclad builds mentioned:** Body Slam, heavy block (Barricade, Demon Form), and a Barricade + Corruption + FNP + Demon Form scaling deck ([Steam: Ironclad and the Queen][st-queen-ic], [Steam: cheese][st-queen-cheese]). `[one]` each.

### 9c.4 TEST SUBJECT (Act 3 boss)

Sources: [UT][ut-ts], [wiki][wiki-ts], [Flare][ubosses].

The fight has three phases. Between phases it is **stunned for one turn**, which gives you a free setup turn. Its Strength and statuses reset each phase.

| Phase | HP | Power | Moves |
|---|---|---|---|
| 1 | 100 (111 at A8) | **Enrage 2** (3 at A9): +2 Strength whenever you play a **Skill** | Alternates Bite 20 (22) and Skull Bash 14 + 1 Vulnerable |
| 2 | revives with 200 | **Painful Stabs**: Wounds into your discard for each hit of unblocked damage | Multi-Claw 10×3, +1 hit each use |
| 3 | revives with 300 | **Nemesis**: Intangible every other turn | Lacerate 10×3 → Big Pounce 45 → Burning Growl (3 Burns, +2 Strength) |

Tactics:

- **Phase 1:** Ironclad's block cards are Skills, so every Defend or Shrug It Off feeds Enrage. Use attacks and Powers, and end phase 1 fast. `[inference]` from Enrage.
- **Phase 2:** block every Multi-Claw fully. Each unblocked hit adds Wounds. ([Flare][ubosses])
- **Phase 3:** save your burst, potions and debuffs for the non-Intangible turns. "Either end him in 3 turns or die" ([Steam: whats the play][st-ts]).
- Set up Powers during phases 1 and 2 and the stun turns ([same thread][st-ts]). One Ironclad win reported 20+ Strength via Rupture and Bloodletting.
- The +1 enemy Strength from Fight Me! doesn't carry between phases ([Steam: A10 Act 3][st-a3]).

`[several]`

### 9c.5 AEONGLASS (Act 3 boss, since v0.107.1)

Sources: [UT][ut-aeon], [wiki][wiki-aeon].

- 512 HP (535 at A8), with **3 Artifact**.
- **Withering Presence:** every **6** cards you play, a **Wither** goes into your hand. Wither is Unplayable, and deals 3 damage to you at the end of your turn if it is still in your hand. It gets worse as Withers are upgraded.
- Cycle: **Ebb** 22 (26) + 33 Block → **Eye Lasers** 11×2 → **Increasing Intensity**. That last move puts a Wither+X in your discard, gives it +2+X Strength, and upgrades every Wither.
- The Wither numbers changed across betas. An older Steam thread describes Withers every 4 non-status cards, costing 1 to play ([Steam: Aeonglass][st-aeon]).

Tactics:

- Exhaust Withers: the wiki names Stoke. True Grit, Burning Pact, Second Wind, Fiend Fire and Ashwater also work (card text).
- Prefer fewer, bigger cards, to slow the 6-card counter.
- Burst it down within 2–3 deck cycles, rather than turtling ([Steam][st-aeon]). A bigger deck reshuffles Withers less often.
- Strip the Artifact before your key debuffs.

`[several]` + `[inference]`. It has the highest Ironclad death rate of the three bosses (34%). The old **Doormaker** is described in [Flare's guide][ubosses] but is not in the v0.111 pool.

### 9c.6 Act 3 elites

- **Knight Gang** (Flail Knight 101, Spectral Knight 93, Magi Knight 82 HP; 276 total) ([UT][ut-knights], [wiki][wiki-kg]).
  - **Spectral Knight** opens with **Hex**: "While Spectral Knight is alive, ALL your cards are Ethereal", so any card still in hand at end of turn is exhausted. Then it alternates Soul Slash 15 and Soul Flame 3×3.
  - **Magi Knight** starts with Power Shield (6 damage + 5 Block), then **Dampen**: while it lives, all your upgraded cards are downgraded. Then it loops Ram 10 → Prep (5 Block) → **Magic Bomb 35**. The first Bomb lands on its **5th turn**.
  - **Flail Knight:** Ram 15 first, then random, never War Chant (+3 Strength) twice in a row: Flail 9×2 or Ram 15.
  - **Kill order is deck-dependent** ([Steam: Magi + Spectral][st-knights]):
    - Magi first if you rely on upgrades ("downgrades directly reduce your output"), or to dodge the Bomb.
    - Spectral first if you rely on keeping cards in hand.
    - Ironclad tolerates losing upgrades better than some classes. Under Hex, exhausting feeds FNP. `[inference]`
  - AoE helps. One Steam player advises skipping Act 3 elites unless your deck is well ahead.
- **Mecha Knight** (300 HP; **3 Artifact**) ([UT][ut-mecha], [wiki][wiki-mecha]).
  - Opens with Charge 25.
  - Then loops: Flamethrower (4 **Burns** into your *hand*; **since v0.111 it also deals 8 damage**, 12 at A9) → Windup (15 Block + 5 Strength) → Heavy Cleave 35 (plus accumulated Strength).
  - Burn: Unplayable, 2 damage at end of turn if it's in your hand.
  - Tactics: exhaust the Burns (True Grit, Burning Pact, Second Wind; FNP). Save Impervious, Flame Barrier or Mangle for Heavy Cleave. Strip the Artifact before Uppercut or Dominate. `[inference]` from mechanics.
- **Soul Nexus** (234 HP) ([UT][ut-soul]).
  - Random moves, never the same twice in a row: Soul Burn 29, Maelstrom 6×4, or Drain Life 18 + 2 Vulnerable + 2 Weak.
  - Tactics: race it. Block Soul Burn. Flame Barrier or Mangle against Maelstrom. Jorbs takes the most damage here of the three elites (22). `[inference]` + `[data]`

### 9c.7 Act 3 hallways the bot has met

Sources: [UT encounters][ut-enemies]; [wiki Owl][wiki-owl].

| Encounter | Key mechanics (Default numbers) | Tactics |
|---|---|---|
| **Owl Magistrate** (231 HP) | Fixed cycle: Scrutiny 16 → Peck Assault 4×6 → Judicial Flight (**Soar**: takes 50% less attack damage until it lands) → Verdict 33 + 4 Vulnerable, which ends the Soar | Flame Barrier or Mangle on Peck Assault. **Don't attack into Soar.** Use that turn to block or set up for Verdict. `[inference]` from the move text |
| **Frog Knight** (191 HP, **15 Plating**) | Tongue Lash 13 + 2 Frail → Strike Down Evil 21 → For the Queen +5 Strength. **Beetle Charge 35** the first time it drops below half HP. | Plating gives it Block every turn, so use Vulnerable and big hits. Time the half-HP crossing: either burst from above 50% straight to dead, or cross it on a turn when you can block 35+. `[inference]` |
| **Scrolls of Biting** (3 weak / 4 normal, 30–37 HP each) | **Paper Cuts**: unblocked attack damage costs you **max HP**. Chomp 14, More Teeth +2 Strength, Chew 5×2. | **AoE** (Conflagration, Whirlwind, Breakthrough, Howl). Block fully, since every unblocked hit costs max HP. `[inference]` |
| **Slimed Berserker** (261 HP) | Vomit Ichor (10 **Slimed** into your discard; Slimed costs 1: draw 1, Exhaust) → Furious Pummeling 4×4 → Leeching Hug (3 Weak on you, +3 Strength for it) → Aggressive 30 | Play Slimed when energy is spare: it cycles, and triggers FNP and Ashen Strike. Flame Barrier on Pummeling. Block the 30. `[inference]` |
| **Axebot** (70–78 HP, **Stock 2**) | When killed, a new Axebot replaces it (2 respawns). Each respawn opens with Boot Up: 10 Block + 3 / 6 Strength. Hammer Uppercut 12 + 2 Weak + 2 Frail; One-Two 9×2. **v0.111 buff:** Uppercut 14 (18), One-Two 10 (11)×2, +10 max HP per respawn ([wiki v0.111][wiki-111]). | Effectively about 3 bodies and 230+ HP. You need sustained damage; the respawns come with Block and extra Strength. `[inference]` |

### 9c.8 What an Ironclad deck needs by Act 3

1. **A scaling engine** that is running by turn 2–3 and **re-establishes itself** after the Test Subject's phase resets and between the A10 double bosses:
   - Dominate + Vulnerable (the most-cited A10 scaling)
   - Strength via Rupture and self-damage, or Demon Form (now +3)
   - Thrash / Ashen Strike
   - An exhaust engine: True Grit+, FNP, Burning Pact, Dark Embrace

   Sources: [Steam: A10 Act 3][st-a3], [Untapped ascension guide][uasc], [Jorbs][jtl]. `[several]`
2. **Card draw:** 2–3 or more draw effects, as the Queen's counter and in general.
   - Pommel Strike+, Battle Trance, Offering, Burning Pact, Dark Embrace; Pael's Blood.
   - `[several]`
3. **Big-hit mitigation.** Act 3 throws 25–45 single hits:
   - Mecha Knight 35 plus its Strength
   - Test Subject 45
   - Magic Bomb 35
   - Verdict 33
   - Beetle Charge 35
   - Aggressive 30
   - Soul Burn 29

   It also throws multi-hits: Peck Assault 4×6, Maelstrom 6×4, Multi-Claw 10×3+. Tools:
   - Impervious
   - Flame Barrier (for multi-hits)
   - **Mangle** ("Mangle blocks most multi-hit Act 3 attacks", [Steam: A10 Act 3][st-a3])
   - Unmovable
   - Weak via Uppercut
   - Frail-proof power block for the Queen: Crimson Mantle, FNP, Plating, Rage

   `[several]`
4. **Status handling:** Burns (Mecha Knight, Test Subject phase 3), Wounds (Test Subject phase 2), Withers (Aeonglass), Slimed (Berserker). Tools: True Grit+, Burning Pact, Second Wind, Fiend Fire, Stoke; FNP as the payoff; Ashwater. `[several]`
5. **AoE:** needed for Scrolls of Biting, Knight Gang, Construct Menagerie and Fabricator, and to hit both Queen targets: Conflagration, Whirlwind, Breakthrough, Howl, Inferno. `[inference]` + encounter lists.
6. **Artifact:** not obtainable, so plan the Queen around permanent debuffs (§9c.2). Against enemy Artifact, carry at least one cheap debuff (Tremble, Taunt, Thunderclap) to spend stacks.
7. **Act 3 card-reward data** (UT A7+, Act 3 run-win delta) `[data]`:
   - **Positive:** Barricade +7 (picked 35%), Body Slam +5, Offering +5, FNP +4, Dark Embrace +4, Stoke +3, Burning Pact +2, Forgotten Ritual +2, Uppercut +2, Stone Armor +2.
   - **Clearly negative:** Cinder −16, Primal Force −16, Breakthrough −14, Hemokinesis −14, Rampage −14, Stomp −13, Dismantle −11, Spite −11, Armaments −10, Infernal Blade −10, Iron Wave −10, Unrelenting −9, and Anger, Bludgeon, Inflame, Inferno, Flame Barrier, Howl, Stampede and Twin Strike at −8.

   In Act 3, **add engine and block-payoff cards, and stop adding frontload commons.** The Act 3 smith run-deltas are highest for Burning Pact +8, Drum of Battle +8, Bloodletting +6, Vicious +6, and Tremble, Spite and Rupture at +5 ([Untapped stats][ustat]).
8. **Potions for the Act 3 boss:** Act 3 shop buy rates are highest for Fairy in a Bottle 37%, Blood Potion 31%, Power Potion 30%, Entropic Brew 26% and Duplicator 24% ([UT potion pages][upot]). Jorbs uses 0.7–1 potion per Act 3 boss fight ([sheet][jsheet]).
   - For the Queen, potions are not cards, so Bound can't stop them. `[inference]`
   - Draw potions (Swift, Cure All, Gambler's Brew) add *unbound* cards. `[inference]`
   - Shackling (−7 Strength to all enemies) or Weak Potion on the Torch Head's big turns. `[inference]`

---

## 10. What this means for the bot (checkable rules)

The inputs are the bot's own state: act, floor, HP, max HP, gold, deck contents,
relics, potions, the map (including the visible act boss), and the enemy intents and
powers. Where a rule gives numbers, they come from sources on the main branch or
older; re-tune them on v0.111.0.

### 10.1 Card rewards

1. **Act 1 damage first.** In Act 1, until the deck has at least 2 non-starter damage cards, prefer the best damage card over engine or support cards. Damage cards include Thrash, Conflagration, Dismantle, Bludgeon, Pommel Strike, Twin Strike, Anger, Perfected Strike, Hemokinesis and Unrelenting. The cards to put off are FNP, Burning Pact, Vicious, Dark Embrace, Rupture, True Grit, Second Wind and Body Slam. `[several]` `[data]`
2. **Always take:** Offering; the first Battle Trance; Colossus; Unmovable; Crimson Mantle; Dominate; Break. Also take Fiend Fire, unless the deck depends on specific cards that it would burn. These are top-tier in all three good lists, and Untapped pick rates run 63–91%. `[several]` `[data]`
3. **AoE check.** If the deck has no AoE and the upcoming path includes a multi-enemy hallway or elite, favour Conflagration, Breakthrough or Whirlwind (upgrade Whirlwind soon). Howl from Beyond is fine too. Don't take Thunderclap for this unless you have Vicious. `[several]`
4. **Vantom check.** If Vantom is the Act 1 boss (visible on the map), make sure that before the boss the deck has **at least 3 multi-hit or cheap-hit sources**: Twin Strike, Sword Boomerang, Peck, Conflagration, Thrash, Whirlwind, Fight Me!, Dismantle with Vulnerable, Anger, or Inferno. `[several]` for multi-hits; the threshold of 3 is `[inference]`.
5. **Vulnerable package.** Once the deck holds any of Dismantle, Bully, Dominate, Colossus or Cruelty, keep at least 2 Vulnerable sources besides Bash (Tremble, Taunt, Uppercut, Thunderclap, Break, Molten Fist). Stop taking Tremble after 2 copies. `[several]`
6. **Never take:** Havoc, Juggling, Tank. Treat Hellraiser and Rampage as near-never. `[several]` `[data]`
7. **Frontload cards expire.** In Act 2 and later, skip Anger, Iron Wave, Breakthrough, Twin Strike, Setup Strike, Thunderclap, Hemokinesis, Headbutt, Bludgeon and Unrelenting unless they solve a specific upcoming fight. Their Act 2 pick rate is ≤12% and their Act 2 win delta is negative. `[data]`, plus [Jorbs][jtl] and [nat1][n1] on Anger.
8. **Engine cards get better later.** In Acts 2 and 3, raise the value of FNP (once the deck has 3 or more exhaust sources), Burning Pact, Forgotten Ritual, Vicious (once there are 2 or more Vulnerable sources) and Barricade (only with Unmovable, Impervious or other burst block). `[data]` `[several]`
9. **v0.111.0 re-ranks.** All of these are from the patch notes.
   - Treat Forgotten Ritual as a strong energy card: 1 energy for 3, no condition.
   - Treat Expect a Fight as a 3-cost block card that scales with Strength. Ignore every old "Expect a Fight energy" note.
   - Raise Demon Form one step (+3 Strength per turn now).
   - Raise Mangle (20 damage).
   - Expect Dominate less often; it is Rare now.
10. **Battle Trance:** value the first copy highly and the second at about half. From Act 2 on, if the deck relies on continuous draw (Dark Embrace, Vicious loops), a further Battle Trance may be negative. `[several]`
11. **Take-rate sanity check:** over a run, the bot should take a card from roughly 85% of Act 1 rewards, 60% in Act 2 and 50% in Act 3. If it deviates a lot, review its skip threshold. `[data]`, derived and rough.
12. **Strength scaling:** don't build around Inflame, Fight Me! or Setup Strike. Take Dominate as the Strength source, plus Strength-scaling multi-hits such as Thrash and Sword Boomerang. `[several]`

### 10.2 Deck and removal

1. **Removal order:** curses and statuses first (Injury, Clumsy, Spore Mind, Normality, Decay). Then **Defend** before Strike, if the deck has at least 3 non-starter block cards or has Strength or Strike payoffs (Perfected Strike, Hellraiser, Soldier's Stew). Otherwise remove Strike first. Bash comes last, and only once there are 2 or more better Vulnerable sources. `[disputed]`, resolved by `[inference]`.
2. **Don't fear a big deck** if it has exhaust or thinning: Burning Pact, True Grit+, Fiend Fire, Second Wind, Stoke. Jorbs' winning A10 decks were about 40 cards. `[data]` `[one]`

### 10.3 Shop

1. At a shop with gold ≥ the removal price and a Strike, Defend or curse in the deck: buy **removal**. The exception: an S-tier Ironclad card (Offering, Dominate, Battle Trance, Colossus, Unmovable, Crimson Mantle) or a clearly build-defining relic is for sale, and you can afford only one. Then buy that instead. `[several]` for removal-first; the exception is `[data]` (Untapped buy rates) plus `[inference]`.
2. At A6+, removal costs 100 and rises 50 each time. Buy the first. Compare later removals against relics costing 150–250. `[one]` plus [wiki][wiki-merchant].
3. Don't buy potions in Act 1 unless gold is left after removal and a good card, or a specific potion solves the next elite or boss. In Act 3, spend leftover gold on potions before the bosses: Fairy in a Bottle, Blood Potion, Power, Entropic Brew, Duplicator. `[data]`
4. Don't buy Act 1 filler commons in shops (Iron Wave, Twin Strike, Thunderclap, Sword Boomerang). Their buy rates are ≤9%. `[data]`
5. Sell a Foul Potion to the Merchant for 100 gold, unless you are about to fight with it. `[one]` ([wiki][wiki-potlist])
6. Path to a shop when gold ≥ 150. `[one]` (low quality)

### 10.4 Events

Use the "Suggested default" column in §6 as the rule table. The rules that are safest
to hard-code:

1. **Wellspring:** Bathe. `[several]`
2. **Doors of Light and Dark:** Light (upgrade 2) in Act 1 floors 1–6, or while the deck can't yet beat the act boss. Otherwise Dark (remove), while any Strike, Defend or curse remains. `[several]` (Jorbs, Baalorlord)
3. **Aroma of Chaos:** Let Go (transform). `[one]` `[data]`
4. **Room Full of Cheese:** Search if HP − 14 ≥ 50% of max HP; otherwise Gorge. `[several]`, with the HP threshold `[inference]`.
5. **Sunken Statue:** Grab the Sword. `[several]`
6. **Drowning Beacon:** Climb. `[data]`
7. **Spirit Grafter:** Rejection. `[data]`
8. **Field of Man-Sized Holes:** Resist. `[data]`
9. **Round Tea Party:** Pick a Fight. `[data]`
10. **Slippery Bridge:** accept if the shown card is a Strike, Defend or curse. Otherwise pay 3 HP per reroll, at most twice, while HP > 60%. `[several]`
11. **Byrdonis Nest:** Take the Egg if a rest site is reachable before the Act 1 boss, where the Hatch action replaces Rest or Smith. Otherwise Eat (+7 max HP). Note that the Byrdpip pet makes Pael's Legion unavailable (§9b). `[disputed]`: the written comments of both top players say hatch, but Jorbs ate 84% of the time.
12. **Anything that costs HP:** skip it if HP after the cost would be below the next unavoidable fight's expected damage plus a buffer. `[inference]`
13. **Colossal Flower (COLOSSAL_FLOWER):** keep choosing Reach Deeper while (HP − cost of the next step) ≥ 50% of max HP. Take the 135 gold at stage 3. Enter the Center (Pollinous Core, 18 HP in total) only if HP ≥ 80% and gold has no use. Otherwise take the gold at the current stage. `[one]` (Jorbs' comment), with the threshold `[inference]`.
14. **This or That? (THIS_OR_THAT):** "That" (random relic + Clumsy) by default. "This" (−6 HP, 41–68 gold) only for small loop decks, or when that gold completes a planned shop purchase. `[one]` `[inference]`
15. **Doll Room (DOLL_ROOM):** TAKE_SOME_TIME (−5 HP, 1 of 2) by default. RANDOM never. EXAMINE (−15 HP, 1 of 3) only if HP ≥ 60% and Bing Bong specifically is wanted. Doll priority for Ironclad: Bing Bong > Mr. Struggles > Daughter of the Wind. Drop Bing Bong below Mr. Struggles if the deck is a small exhaust loop, or if curses are likely (Guilty, Debt, event curses). `[several]` (Baalorlord, Jorbs, Jorbs' data)
16. **Amalgamator:** for Ironclad, combine Defends unless the deck has fewer than 3 non-starter block cards. `[one]` (Jorbs) and `[inference]`.

### 10.5 Rest sites

1. **Smith** if HP ≥ 65% of max HP.
2. **Rest** if HP ≤ 40% of max HP and the next unavoidable node is an elite or boss.
3. **Rest** if HP < 25 before hallway fights or < 35 before a boss.
4. Otherwise **Smith**, unless the expected damage of the next fight exceeds current HP minus a margin. `[several]`
5. The boss campfire: rest unless HP ≥ 65%, or unless one upgrade flips the boss fight, such as Body Slam+ or Whirlwind+. `[several]`
6. **Smith target order:**
   1. Cost reductions and mechanical upgrades: Body Slam, Barricade, Unmovable, Dark Embrace, Stampede, Havoc, Infernal Blade, Corruption.
   2. Stoke, Armaments, True Grit.
   3. Uppercut, Rupture, Pommel Strike, Whirlwind, Vicious, Pyre, Cascade.
   4. Big-number scalers: Thrash, Fiend Fire, Ashen Strike.
   5. Never pick Strike, Defend, Shrug It Off, Colossus, Tremble, Evil Eye or Blood Wall while better targets exist.
   6. Upgrade Bash only in Act 1 with no other Vulnerable source.
   7. Don't upgrade Feed.

   `[data]` for the order; the Feed rule is `[one]`.
7. If you hold a **Blood Potion** and HP is low at a campfire, drink it first (it works outside combat), then Smith instead of Resting if HP is now above the threshold. `[inference]` from [wiki][wiki-pot].

### 10.6 Combat, general

1. **Wasted damage and overkill.** Damage past an enemy's remaining HP is wasted. Damage into Slippery beyond 1 per hit is also wasted. The evaluation should score *effective* HP removed. `[several]`
2. **Block only with a plan.** On turns with no incoming attack, spend the energy on damage or setup, not block. Block only if the plan wins by stalling (for example, waiting for Strength or Vulnerable to fall off). `[several]`
3. **Order rules** (sources in §4.2):
   - Fiend Fire after the cards you want to keep. `[one]`
   - Cinder last. `[one]`
   - Battle Trance after other draw effects. `[one]`
   - Inferno and Rupture before self-damage cards. `[inference]`
   - Vulnerable before the big hits. `[several]`
   - Colossus only if every attacking enemy is Vulnerable. `[several]`
   - Don't play Offering if the fight is already won this turn. `[one]`
   - Taunt on defensive turns to extend Vulnerable. `[one]`
4. **Crimson Mantle** gives no block on the turn you play it. Don't count it for this turn. `[one]`
5. **Fight Me!** Avoid it against multi-hit attackers in long fights. `[one]`
6. **Mangle and Flame Barrier:** save them for the multi-hit intent turn. `[several]`
7. **Burning Blood:** accept up to about 6 extra HP lost in a hallway fight if it ends the fight a turn sooner. `[inference]` from "HP is a resource" `[several]`.

### 10.7 Monster-specific

**Vantom**

1. **V1.** While Slippery > 0, each damage instance is worth one stack. Within a turn, play multi-hits and cheap hits first. Hold big single hits (Bludgeon, Hemokinesis, Bash damage, Uppercut) until the stacks are 0, or skip them that turn. `[several]`
2. **V2.** Count Inferno ticks, Flame Barrier reflections, Juggernaut pings and Thorns as stack removers. `[inference]`: verify in the sim.
3. **V3.** Turn 3 of each 4-turn cycle (Dismember) is the block turn. Aim to fully block, and use Weak or a Block potion if needed. Turn 4 (Prepare) is free: play powers, or push damage once the stacks are 0. `[several]`
4. **V4.** After Dismember, prefer exhaust effects that target the Wounds. `[inference]`
5. **V5.** Don't use Fire Potion, Potion-Shaped Rock or Explosive Ampoule while stacks remain. `[inference]`
6. **V6.** Burst plan: once the stacks are 0, dump all damage. Each cycle adds 2 Strength to all 4 of its hits. `[several]`

**Byrdonis**

1. **B1.** Race. Apply Vulnerable on turn 1 and spend damage potions early. `[several]`
2. **B2.** Save Weak, Flame Barrier or Mangle for Peck turns (its 2nd, 4th, …) once it has 2+ Strength. `[inference]`

**Entomancer**

1. **E1.** Minimise hits: prefer single-hit attacks. Avoid Twin Strike, Sword Boomerang, Conflagration and Whirlwind. `[one]`, following from the monster text.
2. **E2.** Flame Barrier on the Beeeees! turn (turns 1, 4, …). Weak, Mangle or Shackling that turn as well. `[one]` `[inference]`
3. **E3.** Exhaust Dazed with True Grit, Burning Pact or Second Wind, especially with FNP. `[one]`
4. **E4.** Pheromone Spit (turns 3, 6, …) has no attack: it is a free damage turn. `[inference]` from the fixed pattern.

**Hunter Killer**

1. **H1.** Turn 1 comes before Tender: play the best damage and powers. `[inference]`
2. **H2.** Under Tender, play attacks and block cards first. Play draw, energy, powers and debuffs later. Prefer fewer, bigger cards. `[inference]`, one low-quality source agrees.
3. **H3.** Potions are free of Tender. `[inference]`
4. **H4.** After a Bite, the next move is Puncture (7×3). `[one]` ([wiki][wiki-hk])

**The Obscura**

1. **O1.** Target the Obscura. Hit the Parafright only with AoE, or kill it when that is the only way to avoid a lethal or very costly Slam that turn. It revives stunned. `[several]`
2. **O2.** Account for Wail (+3 Strength to both); the Parafright keeps it through revives. `[one]`
3. **O3.** Test in the simulator whether killing the Obscura ends the fight. `[unverified]`

### 10.8 Potions

1. **Drink rather than hoard.** In elites and bosses, drink any potion whose effect saves at least about 8 HP or a turn. Entering a boss with full slots is a failure signal. `[several]` `[data]`: Jorbs drinks 73% of his potions.
2. **Full belt at a reward.** If the offered potion is worth more than your least valuable one, first drink that one if it can be drunk outside combat (Blood Potion, Fruit Juice, Entropic Brew). Otherwise discard it, then take the new potion. `[data]`: Jorbs discards 20%.
3. **Fruit Juice:** drink it at once. **Blood Potion:** drink it out of combat when missing ≥20% of max HP and no free heal is coming. `[inference]` ([wiki][wiki-pot])
4. **Save for bosses:**
   - Save Fairy in a Bottle, Beetle Juice, Shackling, Duplicator and Gigantification for bosses and hard elites.
   - Use common damage potions freely in Act 1 elites.

   `[several]` ([Mobalytics tiers][mpt], [Untapped][uasc])
5. **Slots:** 3, or 2 at A4+. Don't pick up an Ashwater if the deck has no exhaust synergy and the belt is full. `[one]`
6. **Monster-specific potion rules** are in §10.7 (V5, B1, H3, E2).

### 10.9 Ancients

1. **Scoring.** Score each of the 3 offered relics by its condition in §9b; ties fall back to the default order below. `[disputed]` sources; the order is my synthesis.
2. **TEZCATARA default order:**
   1. TOASTY_MITTENS, if an exhaust payoff or ≥4 junk cards
   2. STORYBOOK, if max HP ≥ 55
   3. SEAL_OF_GOLD, if gold minus the next removal price ≥ 100
   4. VERY_HOT_COCOA, if ≥2 setup Powers or 3-cost cards
   5. NUTRITIOUS_SOUP, if ≥4 Strikes and a Strength or Strike payoff
   6. PUMPKIN_CANDLE
   7. BIIIG_HUG, if ≥6 starters
   8. YUMMY_COOKIE
   9. GOLDEN_COMPASS
   10. TOY_BOX

   Mittens `[several]` (UT data, BB). Storybook `[several]` (nat1, BB, Jorbs). Seal of Gold `[one]` `[data]` (Jorbs' Elo, UT).
3. **PAEL default order:**
   1. PAELS_BLOOD
   2. PAELS_CLAW, if ≥3 Defends and an exhaust payoff; otherwise below Legion
   3. PAELS_LEGION, if no pet
   4. PAELS_GROWTH, only with a named clone target and ≥2 rest sites ahead
   5. PAELS_FLESH
   6. PAELS_TEARS
   7. PAELS_HORN
   8. PAELS_TOOTH

   Blood `[several]` `[data]`. Claw is `[disputed]`: Jorbs' top pick, but its UT delta is negative.
4. **Pet conflict.** If the bot is considering the Byrdonis Egg in Act 1, it forfeits Pael's Legion. That is minor; don't let it drive the egg decision. `[one]` ([wiki Pael][wiki-pael])
5. **NEOW default order:**
   1. Silver Crucible
   2. Stone Humidifier (Ironclad rests often)
   3. Leafy Poultice, if max HP ≥ 70
   4. Neow's Talisman
   5. Precarious Shears, if HP ≥ 60
   6. Large Capsule
   7. Small Capsule
   8. New Leaf
   9. Neow's Sacrifice, then the others

   Avoid Arcane Scroll, Hefty Tablet and Lost Coffer. `[data]` (Jorbs' Elo, UT deltas) plus `[inference]`.
6. **OROBAS:** Prismatic Gem > Archaic Tooth > Glass Eye > Sand Castle > the rest. Touch of Orobas is low for Ironclad. `[several]`, with Archaic Tooth `[disputed]`.
7. **DARV:** Runic Pyramid > Pandora's Box, if ≥5 Strikes and Defends remain > Astrolabe > the rest. `[several]` `[data]`
8. **Act 3, TANX:** Crossbow or Sai first. **NONUPEIPE:** Brilliant Scarf, Beautiful Bracelet or Glitter. **VAKUU:** Music Box or Fiddle. Treat Whispering Earring as `[disputed]`. `[data]`

### 10.10 Act 3 (Glory)

1. **No Artifact.** Never plan on preventing the Queen's debuffs. There is no player Artifact or debuff removal in StS2. `[several]` ([wiki][wiki-artifact], [Steam][st-immunity])
2. **Queen: pick a target on turn 1.**
   - Estimate the damage you can deal to the Queen over the next 4 turns, net of her +20 Block per turn. If it is ≥ her HP, race the Queen; her death ends the fight because the Torch Head is a Minion.
   - Otherwise **kill the Torch Head first**.
   - Re-evaluate each turn: "Torch Head dead" switches the Queen to her own attack cycle.

   `[several]`
3. **Queen timing:**
   - Spend your turns 1–2 (before You Are Mine) on Powers and scaling: Demon Form, Inferno, Crimson Mantle, FNP, Rupture, Unmovable, Barricade. Also use the biggest attacks, which get no Weak penalty yet.
   - From turn 3 on, model incoming damage ×1.5, your attack damage ×0.75, and block from cards ×0.75. Block from powers and relics is unaffected.

   `[one]` for the Frail rule, `[inference]` for the timing.
4. **Bound modelling (simulator requirement).**
   - The first 3 cards drawn each turn are Bound, and only 1 Bound card can be played.
   - Cards drawn later in the turn are free, so play draw effects (Pommel Strike, Battle Trance, Offering, Burning Pact) early.
   - Rank Bound candidates by value and play the single best one.

   `[several]` (mechanics) + `[inference]` (the policy)
5. **Queen deck check at the Act 3 campfire / Act 3 card rewards.** If the Act 3 boss is the Queen (visible on the map), value draw and Frail-proof block (Crimson Mantle, FNP, Stone Armor, Rage) above other options of similar value. `[several]` (draw) / `[inference]` (block)
6. **Test Subject:**
   - Phase 1: don't play Skills unless forced (each gives +2 Strength), and use attacks and Powers.
   - Phase 2: fully block every Multi-Claw.
   - Phase 3: keep potions and burst for the non-Intangible turns.
   - Use the stun turns between phases for setup.

   `[several]`
7. **Aeonglass:**
   - Track the cards-played counter; every 6th card adds a Wither to your hand. Prefer fewer, higher-impact cards.
   - Exhaust Withers before ending the turn (True Grit+, Burning Pact, Second Wind, Fiend Fire, Stoke, Ashwater).
   - Spend its 3 Artifact with cheap debuffs before the important ones.

   `[several]` + `[inference]`
8. **Knight Gang:**
   - Kill **Magi Knight** (82 HP) before its 5th turn (Magic Bomb 35), or earlier if upgrades matter to the deck (Dampen).
   - If the deck relies on keeping cards in hand, kill **Spectral Knight** first (Hex makes all your cards Ethereal).
   - Flail Knight last. Use AoE.

   `[several]` (Steam, deck-dependent)
9. **Mecha Knight:**
   - Opening turn: block the Charge 25.
   - Flamethrower turn: expect 4 Burns in hand, plus 8 damage in v0.111; exhaust or play around the Burns.
   - Windup turn is the free damage turn.
   - Heavy Cleave (35 + Strength): Impervious, Mangle or Flame Barrier.
   - Strip the Artifact first.

   `[inference]` from mechanics
10. **Soul Nexus:** race. Keep 29+ block for Soul Burn, and use Flame Barrier or Mangle for Maelstrom (6×4). `[inference]`
11. **Owl Magistrate:**
    - On the turn after Judicial Flight (Soar active), don't attack. Block or set up for Verdict (33 + 4 Vulnerable).
    - Flame Barrier on Peck Assault (4×6).

    `[inference]` from move text
12. **Frog Knight:** don't cross 50% HP on a turn when you can't absorb Beetle Charge (35). Otherwise burst from above half to dead. `[inference]`
13. **Scrolls of Biting:** use AoE first, and prioritise full block, because unblocked hits cost max HP. `[inference]`
14. **Slimed Berserker:** play Slimed when energy is left over (1 energy: draw 1, Exhaust). Flame Barrier on Furious Pummeling. `[inference]`
15. **Axebot:** budget for 3 bodies. Don't spend burst potions on the first body. `[inference]`
16. **Act 3 card rewards:** prefer engine and payoff cards: Offering, FNP (with exhaust), Dark Embrace, Stoke, Burning Pact, Forgotten Ritual, Uppercut, Barricade / Body Slam (only with a block engine), Crimson Mantle, Impervious. Skip frontload commons: Breakthrough, Hemokinesis, Cinder, Anger, Iron Wave, Unrelenting, Dismantle, Spite, Stomp, Rampage, Twin Strike, Bludgeon. `[data]`
17. **Potions:** arrive at the Act 3 boss with at least 2 potions. For the Queen, draw potions add unbound cards, and potions themselves ignore Bound. `[inference]`

---

## 11. Gaps and caveats (honest assessment)

- **Reddit was unreachable.** reddit.com is blocked both for fetching and in the browser pane, and search engines returned almost no r/slaythespire StS2 threads. So community input here comes from **Steam discussions** (StS2 app 2868840) instead. Steam shows no year on current-year posts; they are from 2026, after the March 5 launch.
- **Videos weren't read.** No YouTube or bilibili transcripts. I read descriptions only (Jorbs, Baalorlord, Caleb Gannon, SuperAutoGaming, robdood; 晓夫九 and others on bilibili). They carry no strategy text beyond chapter titles.
- **Version lag.** Nothing I found is explicitly rated on v0.111.0 except probably nat1gaming. The most reliable lists (Jorbs, Baalorlord) are v0.107.1. Jorbs' spreadsheet covers v0.98–0.106.1. Untapped's stats don't state their patch window, and multiplayer-only cards appear in the "single-player" stats, so the filter isn't fully clear.
- **Selection bias.** Untapped win deltas show what good players pick and how their runs went, not what causes wins.
- **Low-quality sources.** Many "guide" sites (sts2front, sts2companion, slaythespire2.space, games.gg, switchblade, and others) contain wrong numbers or StS1 names. I used them only where they agree with the wiki or with the top players, and tagged them.
- **Monster data** is from slaythespire.wiki.gg. It is consistent with the bot's own observations of Vantom, but the bot should trust the game.
- **Chinese sources** (GamerSky, Sohu, 17173, bilibili) are mostly beginner overviews from March 2026, several with StS1 contamination. They agree on "multi-hits against Vantom" and "Burning Pact as the hub of the burn-deck loop". I found nothing deeper, such as NGA A10 write-ups.
- **Genuinely StS2-specific, high-quality material:**
  - two top-player tier lists with per-card commentary
  - Untapped per-card pick, buy and smith statistics
  - Jorbs' public run spreadsheet
  - the wiki's monster and patch data
  - a dozen Steam threads by A10 players

  That is enough for card valuation and monster tactics.

  Events are covered by Jorbs' choice data plus Jorbs/Baalorlord comments on 19 events. Ancients have Untapped pick data, but it pools all characters and uses main-branch versions of several relics that the beta changed. Jorbs' Ancient Elo and the Untapped population often disagree, especially on Pael.

  Shop and potion strategy is thin: data plus low-quality guides.
- **Act 3 unknowns to check in the simulator:**
  - that the Torch Head never revives
  - that Weak doesn't reduce non-attack damage (Inferno, Juggernaut, Flame Barrier)
  - which auto-play cards (Havoc, Stampede, Hellraiser, Cascade) bypass Bound
  - the exact Wither numbers on v0.111

  The Queen and Test Subject numbers come from Untapped's Default setting, which matches the wiki's base values. Glory hallways had no top-player commentary; their tactics are my inferences from move text.

---

## 12. Sources

| Key | Source | Date / version | Quality |
|---|---|---|---|
| jtl | Jorbs Ironclad Tier List, with per-card commentary, on Untapped | updated 2026-08-05, v0.107.1 | A (top player) |
| btl | Baalorlord Ironclad Tier List, with commentary, on Untapped (video 2026-05-26) | updated 2026-08-21, v0.107.1 | A (top player) |
| jsheet | Jorbs' "Spire 2" run spreadsheet (linked from his 2026-04-16 video) | runs 2026-03-05 to 05-31, v0.98–0.106.1 | A (data, one player) |
| ustat | Untapped.gg card pages: reward, shop and smith stats, A7+ | read 2026-09-23; window unknown | A− (aggregate data) |
| wiki-* | slaythespire.wiki.gg (official wiki) pages | current to v0.111.0 | A (mechanics) |
| mg / mtl / mpt | Mobalytics, by Japanese Export: Ironclad guide / card tiers / potion tiers | guide undated (site to Jun 2026) / 2026-08-12 / 2026-07-27 | B+ |
| ug, urest, uasc, umap, umicro, uintent, uev*, upot | Untapped.gg guides and act event pages | 2026-03 to 09 | B |
| jjobs, jguide, b2cost | Jorbs and Baalorlord articles on Untapped | 2026-03-06 / 03-06 / 03-09 (written before and at release) | B (StS1-derived framing) |
| n1 | nat1gaming Ironclad tier list, DoggertQBones | 2026-08-17, "Aug 13th update" | B− |
| st-* | Steam StS2 discussion threads | 2026-03 to 05 | B− (community, A10 players) |
| pcg, tg, gg | PCGamesN / TheGamer / games.gg Ironclad guides | 2026-04-08 / 03-16 / 03-05 | C (games.gg is StS1-contaminated) |
| tg-ev, sb-ev | TheGamer / Switchblade event guides | 2026-03-15 / 04-16 | C |
| noob, comp-*, fxl, opgg-obs, pcgamer-vantom, hk-space, front, codex-* | Various guide and database sites | 2026-03 to 07 | C (use with care) |
| ur-anc, uev-* | Untapped Ancient relic pages (Ancient Choice stats) and event pages (Jorbs and Baalorlord comments) | read 2026-09-23 | A− (data) / A (comments) |
| n1-rel, bb-anc, ds-anc, front-anc | nat1 relic tier list / BrokenBuilds Act 2 Ancient guide / DualShockers Ancient ranking / sts2front (search summary) | 2026-05-19 / 05-03, updated 07-28 / 05-12 / – | B− / C / C / C |
| ut-*, ubosses, wiki-glory/queen/ts/aeon/kg/mecha/owl/artifact/frail, st-queen-*, st-ts, st-a3, st-aeon, st-knights, st-immunity, steam-bossguide, selphie-queen, comp-queen | Act 3 sources: Untapped encounter pages and Flare's boss guide; wiki monster and mechanic pages; Steam threads and Duckie's guide; Selphie; STS2 Companion | 2026-03 to 09 (Steam threads Mar–May 2026) | A (UT/wiki data) / B (Flare) / B− (Steam) / C (Selphie, Companion: Companion's Artifact advice is StS1 lore) |
| gs-*, sohu | Chinese: GamerSky, Sohu | 2026-03-09 / 03-10 | C (partly StS1-contaminated) |

[jtl]: https://sts2.untapped.gg/en/tier-list/6b3390b7-bcbc-4ebc-ae78-ae9a400c66dc
[btl]: https://sts2.untapped.gg/en/tier-list/004de170-026a-4dd4-a280-3b904be0b5d6
[jsheet]: https://docs.google.com/spreadsheets/d/197RwIxLuzSLubsWr6OLfhdHPRFgIWRnQyTp-RuZUveU/htmlview
[ustat]: https://sts2.untapped.gg/en/cards/ironclad
[ustat-off]: https://sts2.untapped.gg/en/cards/ironclad/offering
[ustat-bs]: https://sts2.untapped.gg/en/cards/ironclad/body-slam
[ug]: https://sts2.untapped.gg/en/characters/ironclad
[urest]: https://sts2.untapped.gg/en/guides/rest-sites
[uasc]: https://sts2.untapped.gg/en/guides/ascensions-list-best-strategies
[umap]: https://sts2.untapped.gg/en/guides/how-to-make-the-best-map-choices-in-slay-the-spire-2
[umicro]: https://sts2.untapped.gg/en/guides/micro-combat-strategy-in-slay-the-spire-2
[uintent]: https://sts2.untapped.gg/en/guides/how-to-read-enemy-intent
[uev1]: https://sts2.untapped.gg/en/acts/overgrowth/events
[uev1b]: https://sts2.untapped.gg/en/acts/underdocks/events
[uev2]: https://sts2.untapped.gg/en/acts/hive/events
[uev3]: https://sts2.untapped.gg/en/acts/glory/events
[upot]: https://sts2.untapped.gg/en/potions
[upot-ash]: https://sts2.untapped.gg/en/potions/ashwater
[upn]: https://sts2.untapped.gg/en/patch-notes/v0.111.0
[jjobs]: https://sts2.untapped.gg/en/articles/slay-the-spire-deckbuilding-strategy-solving-the-spire-with-jobs
[jguide]: https://sts2.untapped.gg/en/articles/my-guidelines-for-starting-slay-the-spire-2
[b2cost]: https://sts2.untapped.gg/en/articles/in-defense-of-2-cost-cards
[mg]: https://mobalytics.gg/slay-the-spire-2/characters/ironclad-guide
[mtl]: https://mobalytics.gg/slay-the-spire-2/tier-lists/cards
[mpt]: https://mobalytics.gg/slay-the-spire-2/tier-lists/potions
[n1]: https://nat1gaming.com/sts2/tier-list/ironclad-card-tier-list/
[pcg]: https://www.pcgamesn.com/slay-the-spire-2/ironclad
[tg]: https://www.thegamer.com/slay-the-spire-2-best-builds-relics-cards-the-ironclad-strength-vulnerable-guide/
[gg]: https://games.gg/slay-the-spire-2/guides/slay-the-spire-2-ironclad-guide-builds-cards-and-strategy/
[yt-caleb]: https://www.youtube.com/watch?v=b_K0WRmNgwY
[wiki-cards]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ironclad_Cards
[wiki-ic]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ironclad
[wiki-vantom]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Vantom
[wiki-byrd]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Byrdonis
[wiki-ento]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Entomancer
[wiki-hk]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Hunter_Killer
[wiki-obs]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Obscura
[wiki-para]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Parafright
[wiki-merchant]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Merchant
[wiki-rest]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Rest_Site
[wiki-potlist]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Potions_List
[wiki-pot]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Potions
[wiki-relax]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Relax
[wiki-pn]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Patch_Notes
[wiki-108]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:V0.108.0_-_Beta_Patch
[wiki-109]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:V0.109.0_-_Beta_Patch
[wiki-110]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:V0.110.0_-_Beta_Patch
[wiki-111]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:V0.111.0_-_Beta_Patch
[codex-slip]: https://spire-codex.com/powers/slippery
[codex-merchant]: https://spire-codex.com/merchant
[fxl]: https://slaythespire2.wiki.fextralife.com/Vantom
[comp-vantom]: https://www.sts2companion.com/bosses/vantom
[pcgamer-vantom]: https://www.pcgamer.com/games/roguelike/slay-the-spire-2-vantom/
[noob]: https://www.noobfeed.com/articles/slay-the-spire-2-beat-vantom-boss
[opgg-obs]: https://op.gg/slay-the-spire2/monsters/TheObscura
[hk-space]: https://slaythespire2.space/guides/hunter-killer/
[front]: https://sts2front.com/tips/shop-campfire-strategy/
[metabot]: https://metabot.gg/en/slay-the-spire-2/guides/gold-economy-and-shopping
[rest-sum]: https://gamestrategyhub.com/games/slay-the-spire-2/rest-smith-remove/
[stsgg-pot]: https://sts2.gg/guides/potion-strategy-guide
[sts2guides-ev]: https://sts2guides.com/en/guides/events-guide.html
[tg-ev]: https://www.thegamer.com/slay-the-spire-2-events-guide-all-events-best-choices-strategy/
[sb-ev]: https://www.switchbladegaming.com/strategy-games/slay-the-spire-2-event-guide/
[st-strat]: https://steamcommunity.com/app/2868840/discussions/0/798966028860353769/
[st-tips]: https://steamcommunity.com/app/2868840/discussions/0/806845754928990077/
[st-a10]: https://steamcommunity.com/app/2868840/discussions/0/845132259930458497/
[st-a10b]: https://steamcommunity.com/app/2868840/discussions/0/798968342700468938/
[st-howtf]: https://steamcommunity.com/app/2868840/discussions/0/798967931812790583/
[st-act1]: https://steamcommunity.com/app/2868840/discussions/0/839501596191705877/
[st-missing]: https://steamcommunity.com/app/2868840/discussions/0/662737213850858906/
[st-op]: https://steamcommunity.com/app/2868840/discussions/0/806845754928928799/
[st-byrd]: https://steamcommunity.com/app/2868840/discussions/0/798967297092984812/
[st-vantom]: https://steamcommunity.com/app/2868840/discussions/0/802341195824210601/
[st-vantom10]: https://steamcommunity.com/app/2868840/discussions/0/798968152812794498/
[st-obs]: https://steamcommunity.com/app/2868840/discussions/0/802341528343212025/
[st-obs2]: https://steamcommunity.com/app/2868840/discussions/0/798967297092953216/
[gs-boss]: https://www.gamersky.com/handbook/202603/2103370.shtml
[gs-bd]: https://www.gamersky.com/handbook/202603/2102597.shtml
[gs-all]: https://www.gamersky.com/handbook/202603/2102448.shtml
[gs-ev]: https://www.gamersky.com/handbook/202603/2101886.shtml
[sohu]: https://www.sohu.com/a/994254718_122598898
[uev-bl]: https://sts2.untapped.gg/en/events/brain-leech
[uev-bn]: https://sts2.untapped.gg/en/events/byrdonis-nest
[uev-dv]: https://sts2.untapped.gg/en/events/dense-vegetation
[uev-tt]: https://sts2.untapped.gg/en/events/tablet-of-truth
[uev-tot]: https://sts2.untapped.gg/en/events/this-or-that
[uev-ab]: https://sts2.untapped.gg/en/events/abyssal-baths
[uev-dld]: https://sts2.untapped.gg/en/events/doors-of-light-and-dark
[uev-db]: https://sts2.untapped.gg/en/events/drowning-beacon
[uev-ec]: https://sts2.untapped.gg/en/events/endless-conveyor
[uev-am]: https://sts2.untapped.gg/en/events/amalgamator
[uev-bs]: https://sts2.untapped.gg/en/events/bugslayer
[uev-cf]: https://sts2.untapped.gg/en/events/colossal-flower
[uev-cs]: https://sts2.untapped.gg/en/events/crystal-sphere
[uev-dr]: https://sts2.untapped.gg/en/events/doll-room
[uev-fh]: https://sts2.untapped.gg/en/events/field-of-man-sized-holes
[uev-bd]: https://sts2.untapped.gg/en/events/battleworn-dummy
[ur-bing]: https://sts2.untapped.gg/en/relics/event/bing-bong
[ur-anc]: https://sts2.untapped.gg/en/relics
[wiki-anc]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ancients
[wiki-neow]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Neow
[wiki-tez]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Tezcatara
[wiki-pael]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Pael
[wiki-ench]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Enchantments
[wiki-mittens]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Toasty_Mittens
[wiki-seal]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Seal_of_Gold
[wiki-bf]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Brightest_Flame
[n1-rel]: https://nat1gaming.com/sts2/tier-list/relic-tier-list/
[bb-anc]: https://brokenbuilds.gg/slay-the-spire-2/guides/slay-the-spire-2-act-2-boss-relic-guide
[ds-anc]: https://www.dualshockers.com/slay-the-spire-2-best-ancients-ranked/
[front-anc]: https://sts2front.com/tips/ancients-blessings-guide/
[ut-enemies]: https://sts2.untapped.gg/en/enemies
[ut-queen]: https://sts2.untapped.gg/en/enemies/encounters/queen-boss
[ut-ts]: https://sts2.untapped.gg/en/enemies/encounters/test-subject-boss
[ut-aeon]: https://sts2.untapped.gg/en/enemies/encounters/aeonglass-boss
[ut-knights]: https://sts2.untapped.gg/en/enemies/encounters/knights-elite
[ut-mecha]: https://sts2.untapped.gg/en/enemies/encounters/mecha-knight-elite
[ut-soul]: https://sts2.untapped.gg/en/enemies/encounters/soul-nexus-elite
[ubosses]: https://sts2.untapped.gg/en/guides/bosses-intro
[wiki-glory]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Glory
[wiki-artifact]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Artifact
[wiki-frail]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Frail
[wiki-queen]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Queen
[wiki-ts]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Test_Subject
[wiki-aeon]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Aeonglass
[wiki-kg]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Knight_Gang
[wiki-mecha]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Mecha_Knight
[wiki-owl]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Owl_Magistrate
[st-immunity]: https://steamcommunity.com/app/2868840/discussions/0/832747471494980081/
[st-queen-tips]: https://steamcommunity.com/app/2868840/discussions/0/798964766335927637/
[st-queen-ic]: https://steamcommunity.com/app/2868840/discussions/0/802341195824203069/
[st-queen-busted]: https://steamcommunity.com/app/2868840/discussions/0/802341528343289945/
[st-queen-cheese]: https://steamcommunity.com/app/2868840/discussions/0/802341528343184436/
[st-ts]: https://steamcommunity.com/app/2868840/discussions/0/802341528343381513/
[st-a3]: https://steamcommunity.com/app/2868840/discussions/0/798966340582963322/
[st-aeon]: https://steamcommunity.com/app/2868840/discussions/0/839501596191800702/
[st-knights]: https://steamcommunity.com/app/2868840/discussions/0/798965575663544295/
[steam-bossguide]: https://steamcommunity.com/sharedfiles/filedetails/?id=3712603582
[selphie-queen]: https://selphie1999gaming.com/game-guides/slay-the-spire-2/slay-the-spire-2-bound-defeating-the-queen-boss/
[comp-queen]: https://www.sts2companion.com/bosses/queen
