# A10 reference: monsters, map generation, ascension levels (Slay the Spire 2)

Compiled 2026-09-23 for spire-jev, which runs the **beta branch v0.111.0** (released 2026-08-13).
This file is a data reference. For strategy, see `STRATEGY-research.md`.
Everything here is StS2-specific unless a line says otherwise.

## 0. Sources and how to read the numbers

| Key | Source | Version / date | Used for |
|---|---|---|---|
| UT-enc | Untapped.gg encounter pages, e.g. [Queen][ut-queen] (index: [UT enemies][ut-enemies]), read 2026-09-23 via their **Default / Ascension 8 / Ascension 9+** toggles | main-branch data (v0.107.1); pages flag "Beta changes" | every HP, move, pattern and Ironclad death rate in §2 |
| wiki | slaythespire.wiki.gg monster, act, map and ascension pages, e.g. [Ascension][wiki-asc], [Map Locations][wiki-maploc], [Unknown Location][wiki-unknown], [Bosses][wiki-bosses], [Glory][wiki-glory] | updated to v0.111.0 (Aug–Sep 2026) | beta deltas, map rules, ascension text |
| codex | Spire Codex [Map Generation][codex-map] | "main" data | rooms and floors per act, room counts |
| UT-asc | Untapped [Ascensions guide][uasc], [map guide][umap] | 2026 | ascension explanations, fixed rows |
| jorbs | Jorbs' public run spreadsheet ([sheet][jsheet]) | runs 2026-03-05 to 05-31, v0.98–0.106.1 | where his A10 Ironclad runs died |
| steam | [Steam: A10 double boss, no heal][st-a10boss] | 2026 | double-boss details |

**Notation in §2:**

- `x{y/z}` means **Default (A0–A7) x, A8 y, A9+ z**. A bare number is the same at every level.
- `a-b` is an HP range.
- The **⟳** marker separates the one-time opening moves (before it) from the repeating cycle (after it).
- `50%`, `33%`, `?` are random weights among the moves that follow. "never / up to twice in a row" and "N turns cooldown" constrain the random picks.
- `Triggered by …` / `If …` / `Continues at …` describe phase changes.
- `A×B` means A damage, B hits.
- "Ironclad A7+ death" is Untapped's share of Ironclad fights at A7+ that ended in death.

### 0.1 Beta changes (v0.108–v0.111) that the main-branch UT numbers don't include

From the [wiki v0.111][wiki-111] and [v0.110][wiki-110] pages:

- **Axebot** (Glory, v0.111): Hammer Uppercut 12(14) → **14(18)**. It gains **+10 max HP per respawn**. The One-Two 9(10)×2 → **10(11)×2**.
- **Mecha Knight** (v0.111): Flamethrower now also deals **8(12)** damage.
- **Exoskeleton** A8 HP 24–28(25–29) → 24–28(**26–30**) (v0.111).
- **Entomancer** A8 HP 155 → **165** (v0.111).
- **Tough Egg** (Ovicopter minion) can have 1 more max HP (v0.110).
- **Aeonglass:** the wiki's current page lists Ebb as 22 (26 at A9) + 33 Block, versus UT's main-branch 26{26/32}. It "received damage nerfs … across subsequent beta patches" ([wiki Aeonglass][wiki-aeon]). Trust the game.

---

## 1. What A8 and A9 change, in general

- **A8, "Tough Enemies":** "All Enemies have more HP" ([wiki][wiki-asc]).
  - In the UT data, HP rises about 3–10%. Examples: Vantom 173→183, Queen 400→419, Knowledge Demon 379→399, Soul Nexus 234→254, Byrdonis 81–84→90.
  - A8 also raises many **defensive** numbers:
    - Vantom's Slippery 8→9
    - Frog Knight's Plating 15→19
    - Slumbering Beetle's Plating 15→18
    - Magi Knight's Block 5→9
    - Nibbit Block 5→6
    - Louse Progenitor's Curl Up 14→18
    - Terror Eel's Shriek threshold 70→75
    - Tunneler's Block 32→37
    - Lagavulin's Slash Block 12→14
    - Phantasmal Gardeners' Skittish 6→7
    - Living Shield HP 55→65
- **A9, "Deadly Enemies":** "All Enemies deal more damage" ([wiki][wiki-asc]).
  - Most attacks gain 1–3 per hit, roughly +10%. Examples: Dismember 26→30, Heavy Cleave 35→40, Magic Bomb 35→40, Laser 31→35, Big Pounce stays 45, Execution 15→18.
  - A9 also raises many **offensive buffs:** Strength per use (e.g. Kin +2→+3, Crush +3→+4, Dark Ritual +2→+3); status counts (Burning Growl 3→5 Burns, Increasing Intensity 1→2 Withers); Enrage 2→3; Vital Spark 2→3; Damp Cultist Ritual 5→6; Beeeees! hits 7→8.
- **Takeaway for a damage model:** at A10 use the A9+ column. It includes A8's HP. Steam players call A8→A9 a "huge difficulty jump" ([Steam][st-a10boss]).

---

## 2. Monsters by act (UT-enc; Default{A8/A9+})

### 2.0 Where A10 Ironclad runs actually die

Jorbs' 24 losses in 67 A10 Ironclad runs (v0.98.3–0.106.1) ([sheet][jsheet]):

- **Act 1: 13 losses.** Skulking Colony 2, Vantom 2, Soul Fysh 2, and one each to Byrdonis, Terror Eel, Phrog Parasite, Phantasmal Gardeners, the Punch Off event, Ruby Raiders and Waterfall Giant.
- **Act 2: 6 losses.** Decimillipede 4, Knowledge Demon 1, Slumber Party 1.
- **Act 3: 5 losses.** Test Subject 2, Doormaker 2 (the boss since replaced by Aeonglass), Fabricator 1.

For a strong player, **more than half of the A10 losses happen in Act 1**. Act 1 elites are the single biggest killer group. `[data]`

UT's Ironclad A7+ death rates per encounter are listed with each entry below.

### 2.1 Act 1a: Overgrowth

**Bosses:** Vantom, The Kin, Ceremonial Beast. **Elites:** Phrog Parasite, Bygone Effigy, Byrdonis. **Hard (strong) pool:** Overgrowth Crawlers, Ruby Raiders, A Pair of Nibbits, Overgrowth Flora, Shroom and Slime, Swarm of Slimes, Strangler and Friend, Inklets, Vine Shambler, Fogmog, Mawler, Cubex Construct. **Easy (weak) pool:** Group of Slimes, A Lone Nibbit, Fuzzy Wurm Crawler, Shrinker Beetle. **Event:** Wrigglers (from Dense Vegetation).

- **Vantom** (`vantom-boss`) · Boss · Ironclad A7+ death 27% of 17,000
  - Vantom — HP 173{183/183}: Gains 8{9/9} Slippery (the next time it loses HP, it loses only 1); ⟳; Ink Blot 7{7/8} dmg; Inky Lance 6{6/7}×2; Dismember 26{26/30} dmg + 3 Wounds into your discard pile; Prepare: +2 Strength
- **The Kin** (`the-kin-boss`) · Boss · 24% of 17,000
  - Kin Follower (Power Dance) — HP 58{62/62}-59{63/63}: Minion (leaves if the leader dies); ⟳; Power Dance +2{2/3} Strength; Quick Slash 5 dmg; Boomerang 2×2
  - Kin Follower (Quick Slash) — HP 58{62/62}-59{63/63}: Minion; ⟳; Quick Slash 5 dmg; Boomerang 2×2; Power Dance +2{2/3} Strength
  - Kin Priest — HP 190{199/199}: ⟳; Orb of Frailty 8{8/9} dmg + 1 Frail; Orb of Weakness 8{8/9} dmg + 1 Weak; Soul Beam 3×3; Dark Ritual +2{2/3} Strength
- **Ceremonial Beast** (`ceremonial-beast-boss`) · Boss · 15% of 17,000
  - Ceremonial Beast — HP 252{262/262}: Stamp: gains 150{150/160} Plow; ⟳; Plow 18{18/20} dmg + 2 Strength. Triggered by Plow breaking: Stunned, Stunned; ⟳; Beast Cry (1 Ringing: you can play only 1 card that turn, per [UT bosses guide][ubosses]); Stomp 15{15/17} dmg; Crush 17{17/19} dmg + 3{3/4} Strength
- **Phrog Parasite** (`phrog-parasite-elite`) · Elite · 10% of 44,000
  - Phrog Parasite — HP 61{66/66}-64{68/68}: 4 Infested (on death, summons 4 Wrigglers); ⟳; Infect: 3 Infection into your discard pile; Lash 4{4/5}×4
  - Wriggler ×4 — HP 17{18/18}-21{22/22}: Spawned (Stunned); then alternates Nasty Bite 6{6/7} dmg / Wriggle (1 Infection into discard + 2 Strength). Odd-numbered Wrigglers bite first, even-numbered ones wriggle first.
- **Bygone Effigy** (`bygone-effigy-elite`) · Elite · 9% of 44,000
  - Bygone Effigy — HP 127{132/132}: 1 Slow (each card you play makes it take +10% Attack damage this turn); Sleep; Wake: +10 Strength; ⟳; Slashes 13{13/15} dmg
- **Byrdonis** (`byrdonis-elite`) · Elite · 7% of 44,000
  - Byrdonis — HP 81–84 (A8+: 90): Territorial 1 (gains 1 Strength at the end of each of its turns); ⟳; Swoop 17 dmg (A9+: 19); Peck 3×3 (A9+: 4×3)
- **Overgrowth Crawlers** · Hard · 5% of 11,000
  - Shrinker Beetle — HP 38{40/40}-40{42/42}: Shrinker (applies −1 Shrink); ⟳; Chomp 7{7/8}; Stomp 13{13/14}
  - Fuzzy Wurm Crawler — HP 55{58/58}-57{59/59}: ⟳; Aggressive 4{4/6}; Inhale +7 Strength; Acid Goop 4{4/6}
- **Ruby Raiders** · Hard · 4% of 13,000
  - Axe Raider — HP 20{21/21}-22{23/23}: ⟳; Aggressive 5{5/6} + 5{5/6} Block; Aggressive again; Big Swing 12{12/13}
  - Brute Raider — HP 30{31/31}-33{34/34}: ⟳; Beat 7{7/8}; Roar +3 Strength
  - Assassin Raider — HP 18{19/19}-23{24/24}: ⟳; Killshot 10{10/11}
  - Crossbow Raider — HP 18{19/19}-21{22/22}: ⟳; Reload +3 Block; Fire! 14{14/16}
  - Tracker Raider — HP 21{22/22}-25{26/26}: Track (2 Frail); ⟳; Unleash the Hounds 1×8{8/9}
- **A Pair of Nibbits** · Hard · 4% of 13,000
  - Nibbit (Front) — HP 42{44/44}-46{48/48}: ⟳; Aggressive 6{6/7} + 5{6/6} Block; Hiss +2{2/3} Strength; Butt 12{12/13}
  - Nibbit (Back): same moves, starting with Hiss
- **Overgrowth Flora** (`snapping-jaxfruit-normal`) · Hard · 4% of 12,000
  - Snapping Jaxfruit — HP 31{34/34}-33{36/36}: ⟳; Energy Orb 3{3/4} + 2 Strength
  - Flyconid — HP 47{51/51}-49{53/53}. It opens 50/50 with Frail Spores (8{8/9} + 2 Frail, 2-turn cooldown) or Smash 11{11/12}. The loop is 33% each: Vulnerable Spores (2 Vulnerable, 3-turn cooldown) / Frail Spores / Smash, never twice in a row.
- **Shroom and Slime** (`flyconid-normal`) · Hard · 3% of 10,000: Leaf Slime (M) + Flyconid + Twig Slime (M). See the Slimes entries.
- **Swarm of Slimes** (`slimes-normal`) · Hard · 2% of 11,000
  - Twig Slime (M) — HP 26{27/27}-28{29/29}: Sticky Shot (1 Slimed); ⟳; 50/50 Pokey Pounce 11{11/12} (up to twice in a row) / Sticky Shot (never twice in a row)
  - Leaf Slime (M) — HP 32{33/33}-35{36/36}: ⟳; Sticky Shot (2 Slimed); Clump Shot 8{8/9}
  - Twig Slime (S) — HP 7{8/8}-11{12/12}: ⟳; Tackle 4{4/5}
  - Leaf Slime (S) — HP 11{12/12}-15{16/16}: ⟳; 50/50 Tackle 3{3/4} / Goop (1 Slimed), never twice in a row
- **Strangler and Friend** (`slithering-strangler-normal`) · Hard · 2% of 13,000
  - Slithering Strangler — HP 53{54/54}-55{56/56}: Constrict (3); ⟳; 50/50 Thwack 7{7/8} + 5 Block + Constrict 3 / Lash 12{12/13} + Constrict 3
  - Plus slimes and a Snapping Jaxfruit (as above)
- **Inklets** · Hard · 2% of 13,000
  - Inklet ×2 — HP 11{12/12}-17{18/18}: 1 Slippery. Moves: Jab 3{3/4}; Piercing Gaze 10{10/11}; Whirlwind 2{2/3}×3. The loop is 50/50 Piercing Gaze+Jab / Whirlwind+Jab.
- **Vine Shambler** · Hard · 2% of 13,000
  - Vine Shambler — HP 61{64/64}: ⟳; Swipe 6{6/7}×2; Grasping Vines 8{8/9} + 1 Tangled; Chomp 16{16/18}
- **Fogmog** · Hard · 1% of 13,000
  - Fogmog — HP 74{78/78}: Illusory Spores (summons Eye with Teeth); Thwack 8{8/9} + 1 Strength; ⟳; then 40%: Aggressive 8{8/9} + 1 Strength, Aggressive 14{14/16}, Thwack; or 60%: Aggressive 14{14/16}, Thwack
  - Eye with Teeth — HP 6: Illusion (revives next turn); ⟳; Distract (3 Dazed into discard)
- **Mawler** · Hard · 1% of 13,000
  - Mawler — HP 72{76/76}: Claw 4{4/5}×2; ⟳; 33% each: Rip and Tear 14{14/16} / Roar (3 Vulnerable, once per combat) / Claw
- **Cubex Construct** · Hard · 1% of 13,000
  - Cubex Construct — HP 65{70/70}: starts with 13 Block and 1 Artifact; Charge Up +2 Strength; ⟳; Repeater Blast 7{7/8} + 2 Strength; Repeater Blast; Expel 5{5/6}×2
- **Easy pool** (Ironclad A7+ death 0%, about 56,000 fights each):
  - Group of Slimes (the four slimes above)
  - A Lone Nibbit — HP 42{44/44}-46{48/48}: Butt 12{12/13}; Aggressive 6{6/7} + 5{6/6} Block; Hiss +2{2/3} Strength
  - Fuzzy Wurm Crawler — as above
  - Shrinker Beetle — as above
- **Wrigglers** (event encounter, Dense Vegetation) — 4 × Wriggler HP 17{18/18}-21{22/22}, as above

### 2.2 Act 1b: Underdocks

**Bosses:** Waterfall Giant, Lagavulin Matriarch, Soul Fysh. **Elites:** Terror Eel, Phantasmal Gardeners, Skulking Colony. **Hard pool:** Underdocks Wildlife, Cultists, Many Corpse Slugs, Two Gremlins in a Trenchcoat, Fossil Stalker, Two-Tailed Rats, Living Fog, Haunted Ship, Sewer Clam, Punch Construct. **Easy pool:** Corpse Slugs, Toadpoles, Seapunk, Sludge Spinner. **Event:** Punch Constructs (from Punch Off).

- **Waterfall Giant** · Boss · Ironclad A7+ death 31% of 16,000
  - HP 240{250/250}. Opens with Pressurize: gains 15{15/20} Steam Eruption.
  - ⟳ cycle, each move adding +3 Steam Eruption: Stomp 15{15/16} + 1 Weak; Ram 10{10/11}; Siphon (heals 10{15/15}); Pressure Gun 20{20/23}, +5 per use; Pressure Up 13{13/14}.
  - On death ("About to Blow"): stunned, then it Explodes for the accumulated Steam Eruption after a one-turn delay. Block or Weak reduces the explosion ([UT bosses guide][ubosses]).
- **Lagavulin Matriarch** · Boss · 22% of 16,000
  - HP 222{233/233}. Starts with 12 Plating and 3 Asleep; it wakes on losing HP or after 3 turns.
  - ⟳ Slash 19{19/21}; Disembowel 9{9/10}×2; Slash 12{12/14} + 12{14/14} Block; Soul Siphon (you get −2 Strength and −2 Dexterity; it gains +2 Strength).
- **Soul Fysh** · Boss · 19% of 16,000
  - HP 211{221/221}.
  - ⟳ Beckon (1 Beckon into your draw pile + 1 into discard); De-Gas 16{16/17}; Gaze 7{7/8} + 1 Beckon into discard; Fade (2 Intangible); Scream 13{13/15} + 3 Vulnerable.
  - Beckon costs 1 energy. If it is still in your hand at end of turn, you lose 6 HP ([UT bosses guide][ubosses]).
- **Terror Eel** · Elite · 11% of 42,000
  - HP 140{150/150}. Shriek 70{75/75}: the first time its HP falls to 50% or below, it is Stunned.
  - ⟳ Crash 16{16/18}; Thrash 3{3/4}×3 + 6 Vigor.
  - After the Shriek stun: Terrorize (**99 Vulnerable** on you), then it continues at Crash.
- **Phantasmal Gardeners** · Elite · 9% of 41,000
  - 4 × Gardener, HP 26{27/27}-31{32/32}, each with Skittish 6{7/7} (gains Block the first time it is hit each turn).
  - Moves: Flail 1×3; Enlarge +2{2/3} Strength; Bite 5; Lash 7. Each Gardener starts at a different point in the cycle.
- **Skulking Colony** · Elite · 10% of 41,000
  - HP 75{80/80}. Hardened Shell 20: it can't lose more than 20 HP per turn.
  - ⟳ Zoom 14{14/16}; Zoom 14{14/16}; Inertia 9{9/11} + 2{2/4} Strength; Piercing Stabs 7{7/8}×2.
- **Underdocks Wildlife** (`seapunk-normal`) · Hard · 4% of 13,000
  - Calcified Cultist — HP 38{39/39}-41{42/42}: Incantation (2 Ritual); ⟳; Dark Strike 9{9/11}
  - Seapunk — HP 44{47/47}-46{49/49}: ⟳; Sea Kick 11{11/13}; Spinning Kick 2×4; Bubble Burp 7{8/8} Block + 1{1/2} Strength
- **Cultists** · Hard · 4% of 15,000
  - Calcified Cultist (as above) + Damp Cultist — HP 51{52/52}-53{54/54}: Incantation 5{5/6} Ritual; ⟳; Dark Strike 1{1/3}
- **Many Corpse Slugs** · Hard · 2% of 13,000
  - 3 × Corpse Slug — HP 25{27/27}-27{29/29}, Ravenous 4{4/5}: when an enemy dies, the slug eats it, becoming Stunned and gaining 1 Strength.
  - Cycle, each starting at a different point: Goop (2 Frail) → Whip Slap 3×2 → Glomp 8{8/9}.
- **Two Gremlins in a Trenchcoat** · Hard · 2% of 15,000
  - Gremlin Merc — HP 47{51/51}-49{53/53}: Surprise; Thievery 20 (steals gold when attacking); ⟳; Gimme 7{8/8}×2, steal 20; Double Smash 6{7/7}×2 + 2 Weak, steal 20; Hehe 8{9/9} + 2 Strength, steal 20
  - Fat Gremlin — HP 13{14/14}-17{18/18}: Wake Up (Stunned); ⟳; Flee
  - Sneaky Gremlin — HP 10{11/11}-14{15/15}: Wake Up (Stunned); ⟳; Tackle 9{9/10}
- **Fossil Stalker** · Hard · 3% of 15,000
  - HP 51{54/54}-53{56/56}. Suck 3: gains 1 Strength per hit of unblocked attack damage it deals.
  - Opens with Latch 12{12/14}. ⟳ 33% each (up to twice in a row): Latch 12{12/14} / Tackle 9{9/11} + 1 Frail / Lash 3{3/4}×2.
- **Two-Tailed Rats** · Hard · 2% of 15,000
  - 3 × Rat — HP 17{18/18}-21{22/22}. Random moves: Scratch 8{8/9}; Disease Bite 6{6/7}; Screech (1 Frail, 3-turn cooldown); Call for Backup (summons a Rat, once per combat).
- **Living Fog** · Hard · 1% of 15,000
  - Living Fog — HP 80{82/82}: Advanced Gas 8{8/9} + 1 Smoggy; ⟳; Bloat (summons a Gas Bomb) + 5{5/6}; Super Gas Blast 8{8/9}
  - Gas Bomb — HP 7{8/8}, Minion: Explode 8{8/9}
- **Haunted Ship** · Hard · 2% of 15,000
  - HP 63{67/67}: Haunt (3 Weak + 5 Dazed into discard); ⟳; Swipe 13{13/14}; Stomp 4{4/5}×3
- **Sewer Clam** · Hard · 1% of 15,000
  - HP 56{58/58}, Plating 8{9/9}: ⟳; Jet 10{10/11}; Pressurize +4 Strength
- **Punch Construct** · Hard · 1% of 15,000
  - HP 55{60/60}, 1 Artifact: ⟳; READY (10 Block); Fast Punch 5{5/6}×2 + 1 Frail; Strong Punch 14{14/16}
- **Easy pool** (0% deaths):
  - Corpse Slugs: 3 slugs, as above
  - Toadpoles: 2 × Toadpole, HP 21{22/22}-25{26/26}. Spiken (+2 Thorns); Spike Spit (−2 Thorns, 3{3/4}×3); Whirl 7{7/8}.
  - Seapunk (as above)
  - Sludge Spinner: HP 37{41/41}-39{42/42}. Opens with Oil Spray 8{8/9} + 1 Weak. ⟳ 33% each, never twice in a row: Oil Spray / Slam 11{11/12} / Rage 6{6/7} + 3 Strength.
- **Punch Constructs** (the Punch Off event fight) · 14% of 1,600: 2 × Punch Construct, as above, starting at different points

### 2.3 Act 2: Hive

**Bosses:** Knowledge Demon, Kaiser Crab, The Insatiable. **Elites:** Decimillipede, Infested Prism, Entomancer. **Hard pool:** Slumber Party, Hunter Killer, Bowlbug Swarm, Ovicopter, The Obscura, Mass of Mytes, An Automaton Pair, Spiny Toad, Many Exoskeletons, Louse Progenitor. **Easy pool:** Thieving Hopper, Bowlbugs, Tunneler, Exoskeletons. **Events:** Mysterious Knight (from the Lantern Key event), The Merchant??? (the fake merchant).

- **Knowledge Demon** · Boss · Ironclad A7+ death 23% of 16,000
  - HP 379{399/399}.
  - Each cycle: Curse of Knowledge → Slap 17{17/18} → Knowledge Overwhelming 8{8/9}×3 → Ponder 11{11/13}, heals 30 HP, +2{2/3} Strength.
  - The curse is your choice each time:
    - Use 1: Disintegration (6 damage at end of turn) or Mind Rot (draw 1 fewer)
    - Use 2: Disintegration (7) or Sloth (at most 3 cards per turn)
    - Use 3: Disintegration (8) or Waste Away (lose 1 energy per turn)
  - After the third curse, the cycle continues without curses.
- **Kaiser Crab** · Boss · 31% of 16,000
  - Crusher — HP 209{219/219}: Back Attack (+50% damage from behind); Crab Rage (when its ally dies, it gains 5 Strength and 99 Block); ⟳; Thrash 12{12/14}; Enlarging Strike 4; Bug Sting 6{6/7}×2 + 2 Weak + 2 Frail; Adapt +2{2/3} Strength; Guarded Strike 12{12/14} + 18 Block
  - Rocket — HP 199{209/209}: puts Surrounded on you (you take +50% from behind; you face whichever claw you last targeted); Back Attack; Crab Rage; ⟳; Targeting Reticle 3{3/4}; Precision Beam 18{18/20}; Charge Up +2{2/3} Strength; Laser 31{31/35}; Recharge (does nothing)
- **The Insatiable** · Boss · 18% of 16,000
  - HP 321{341/341}.
  - Opens with Liquify Ground: 4 Sandpit (when it reaches 0 you die), plus 3 Frantic Escape into your draw pile and 3 into your discard.
  - ⟳ Thrash 8{8/9}×2; Lunging Bite 28{28/31}; Salivate +2{2/3} Strength; Thrash.
  - Mechanics per [UT bosses guide][ubosses]: Sandpit falls by 1 each turn. Playing a Frantic Escape adds 1 Sandpit but costs 1 energy, and the cost rises by 1 each play.
- **The Decimillipede** · Elite · 14% of 39,000
  - 3 segments, HP 40{46/46}-46{52/52} each. Reattach 25: while any other segment lives, a dead segment revives in 2 turns with 25 HP.
  - Cycle, each segment starting at a different point: Bulk 6{6/7} + 2 Strength; Writhe 5{5/6}×2; Constrict 8{8/9} + 1 Weak.
  - **Jorbs' most frequent A10 killer**: 4 of his 24 losses.
- **Infested Prism** · Elite · 9% of 39,000
  - HP 161{171/171}. Vital Spark 2{2/3}: ALL your Skills are Tainted 2.
  - ⟳ Jab 15{15/17}; Radiate 11{11/13} + 11{11/13} Block; Whirlwind 5{5/6}×3; Pulsate 8{8/10} + 20{22/22} Block + 2{2/3} Vital Spark.
- **Entomancer** · Elite · 9% of 38,000
  - HP 145{155/155}; **165 at A8 in beta**. Personal Hive 1: each Attack hit on it adds Dazed to your draw pile.
  - Uses 1–2: Beeeees! 3×7{7/8}; Spear! 18{18/20}; Pheromone Spit (+1 Personal Hive, +1 Strength).
  - From use 3: the same, but Spit gives +2 Strength.
- **Slumber Party** · Hard · 9% of 14,000
  - Bowlbug (Rock) — HP 45{46/46}-48{49/49}: Imbalanced (Stunned if its attack is fully blocked); ⟳; Headbutt 15{15/16}
  - Bowlbug (Silk) — HP 40{41/41}-43{44/44}: ⟳; Toxic Spit (1 Weak); Thrash 4{4/5}×2
  - Slumbering Beetle — HP 86{89/89}: Plating 15{18/18}; Slumber 3 (wakes after turns pass or after losing HP 3 times); ⟳; Roll Out 16{16/18} + 2 Strength
- **Hunter Killer** · Hard · 6% of 17,000
  - HP 121{126/126}: Tenderizing Goop (1 Tender: every card you play costs you Strength and Dexterity for the rest of that turn); ⟳; 50/50 Bite 17{17/19} (never twice in a row) / Puncture 7{7/8}×3 (up to twice in a row)
- **Bowlbug Swarm** · Hard · 5% of 14,000
  - Rock, Silk (as above)
  - Egg — HP 21{23/23}-22{24/24}: ⟳; Bite 7{7/8} + 7{7/8} Block
  - Nectar — HP 35{36/36}-38{39/39}: Thrash 3; Buff **+15{15/16} Strength**; ⟳; Thrash 3
- **Ovicopter** · Hard · 4% of 17,000
  - Ovicopter — HP 124{126/126}-130{132/132}: Lay Eggs (3 Tough Eggs); ⟳; Smash 16{16/17}; Tenderizer 7{7/8} + 2 Vulnerable; then Lay Eggs again if it has ≤2 allies, otherwise Nutritional Paste (+3{3/4} Strength)
  - Tough Egg — HP 14{15/15}-18{19/19}; hatches after X turns into a Hatchling (HP 19{20/20}-21{22/22}: Nibble 4{4/5})
- **The Obscura** · Hard · 4% of 17,000
  - The Obscura — HP 123{129/129}: Illusion (summons a Parafright); ⟳; 33% each, never twice in a row: Piercing Gaze 10{10/11} / Sail (+3 Strength) / Hardening Strike 6{6/7} + 6{6/7} Block
  - Parafright — HP 21: Illusion (revives next turn at full HP, stunned); ⟳; Slam 16{16/17}
- **Mass of Mytes** · Hard · 4% of 17,000
  - 2 × Myte, HP 61{64/64}-67{69/69}. Cycle: Toxic Cornucopia (2 Toxic into your hand); Bite 13{13/15}; Suck 4{4/6} + 2{2/3} Strength. Staggered start.
- **An Automaton Pair** (`chompers-normal`) · Hard · 4% of 17,000
  - 2 × Chomper, HP 60{63/63}-64{67/67}, 2 Artifact. They alternate Clamp 8{8/9}×2 and Screech (3 Dazed into discard), one starting on each.
- **Spiny Toad** · Hard · 5% of 17,000
  - HP 116{121/121}-119{124/124}: ⟳; Protruding Spikes (+5 Thorns); Spike Explosion 23{23/25} (then −5 Thorns); Tongue Lash 17{17/19}
- **Many Exoskeletons** · Hard · 4% of 15,000
  - 4 × Exoskeleton, HP 24{25/25}-28{29/29} (beta A8: 26–30). Hard to Kill 9: it loses at most 9 HP per hit.
  - Moves: Skitter 1×3{3/4}; Mandibles 8{8/9}; Enrage +2 Strength. The loop is 50/50 Skitter / Mandibles+Enrage.
- **Louse Progenitor** · Hard · 3% of 17,000
  - HP 134{138/138}-136{141/141}. Curl Up 14{18/18}: once per combat, when damaged, it gains that much Block.
  - ⟳ Web Cannon 9{9/10} + 2 Frail; Curl and Grow 14{18/18} Block + 5 Strength; Pounce 14{14/16}.
- **Easy pool** (0% deaths, about 37,000 fights each):
  - **Thieving Hopper:** HP 79{84/84}, Escape Artist 5 (it leaves after 4 turns). Thievery (steals a card) 17{17/19}; Flutter (5 Flutter); Hat Trick 21{21/23}; Nab 14{14/16}; ⟳; Escape.
  - **Bowlbugs:** Rock, Egg and Nectar, as above.
  - **Tunneler:** HP 87{92/92}. Bite 13{13/15}; Burrow (Burrowed + 32{37/37} Block); ⟳; Attack from Below 23{23/26}. It is stunned when Burrowed is broken, then continues at Bite.
  - **Exoskeletons:** 3 Exoskeletons, as above.
- **Mysterious Knight** (Lantern Key event) · 3% of 2,700
  - HP 101{108/108}, +6 Strength, 6 Plating: Ram 15{15/17}; ⟳; War Chant +3 Strength (never twice in a row) / Flail 9{9/10}×2 / Ram
- **The Merchant???** (fake-merchant event)
  - HP 165{175/175}: Swipe 13{13/15}; ⟳ random Swipe / Spew Coins 2×8 / Throw Relic 9{9/10} + 1 Frail; Enrage +2 Strength (3-turn cooldown)

### 2.4 Act 3: Glory

**Bosses:** Queen, Test Subject, Aeonglass (Aeonglass replaced Doormaker in v0.107.1). **Elites:** Knight Gang, Mecha Knight, Soul Nexus. **Hard pool:** Construct Menagerie, Many Scrolls of Biting, Fabricator, Owl Magistrate, Slimed Berserker, Lost and Forgotten, Frog Knight, A Lone Globe Head, Axebot. **Easy pool:** Devoted Sculptor, Scrolls of Biting, Turret Operator (Living Shield + Turret Operator). **Event:** Battleworn Dummy. Source for the pools: [wiki Glory][wiki-glory].

- **Aeonglass** · Boss · Ironclad A7+ death 34% of 12,000
  - HP 512{535/535}. Withering Presence 6: every 6 cards you play adds a Wither to your hand. Wither is Unplayable, and deals 3 damage to you if it's in your hand at end of turn. It starts with 3 Artifact.
  - ⟳ Ebb 26{26/32} + 33 Block (wiki beta: 22/26); Eye Lasers 11{11/12}×2; Increasing Intensity: upgrades every Wither, adds 1{1/2} Wither+N to your discard, and gains 3{3/4} Strength, +1 more each use.
- **Test Subject** · Boss · 33% of 13,000
  - **Phase 1:** HP 100{111/111}. Adaptable (revives stronger instead of dying). Enrage 2{2/3}: +2 Strength each time you play a Skill. ⟳ Bite 20{20/22}; Skull Bash 14{14/16} + 1 Vulnerable.
  - **Phase 2:** heals 200{212/212}. Painful Stabs: Wounds into your discard per hit of unblocked damage. ⟳ Multi-Claw 10{10/11}×3, +1 hit per use.
  - **Phase 3:** heals 300{313/313}. Nemesis: Intangible every other turn. ⟳ Lacerate 10{10/11}×3; Big Pounce 45; Burning Growl (3{3/5} Burns into discard, +2{2/3} Strength).
  - It is stunned for one turn between phases, and its Strength and statuses reset each phase ([wiki][wiki-ts], [UT bosses guide][ubosses]).
- **Queen** · Boss · 29% of 13,000
  - Torch Head Amalgam — HP 199{211/211}, Minion (leaves when the Queen dies): Tackle 18{18/19}; Tackle 18{18/19}; ⟳; Beam 8×3; Tackle 14{14/15}; Tackle 14{14/15}
  - Queen — HP 400{419/419}: Malicious (3 Chains of Binding: each turn, only 1 of the first 3 cards you draw can be played); You Are Mine (99 Frail, 99 Weak, 99 Vulnerable); then, while the Torch Head lives, every turn: Burn Bright for Me (+20 Block, allies +1 Strength). Once it dies: ⟳ Off with Your Head 3{3/4}×5; Execution 15{15/18}; Empower +2 Strength.
- **Knight Gang** · Elite · 5% of 18,000
  - Flail Knight — HP 101{108/108}: Ram 15{15/17}; ⟳; 33% each: War Chant +3 Strength (never twice in a row) / Flail 9{9/10}×2 / Ram (both up to twice in a row)
  - Spectral Knight — HP 93{97/97}: Hex (while it lives, ALL your cards are Ethereal); Soul Slash 15{15/17}; ⟳; 50/50 Soul Slash (up to twice in a row) / Soul Flame 3{3/4}×3 (never twice in a row)
  - Magi Knight — HP 82{89/89}: Power Shield 6{6/7} + 5{9/9} Block; Dampen (while it lives, your upgraded cards count as unupgraded); ⟳; Ram 10{10/11}; Defensive (5{9/9} Block); Magic Bomb 35{35/40}
- **Mecha Knight** · Elite · 6% of 18,000
  - HP 300{320/320}, 3 Artifact.
  - Opens with Charge 25{25/30}.
  - ⟳ Flamethrower: 4 Burns into your **hand** (beta v0.111: +8{8/12} damage); Windup (15 Block + 5 Strength); Heavy Cleave 35{35/40}.
- **Soul Nexus** · Elite · 6% of 18,000
  - HP 234{254/254}. Opens with Soul Burn 29{29/31}.
  - ⟳ 33% each, never twice in a row: Soul Burn / Maelstrom 6{6/7}×4 / Drain Life 18{18/19} + 2 Vulnerable + 2 Weak.
- **Construct Menagerie** · Hard · 4% of 8,300: Punch Construct + Cubex Construct (both as in §2.1–2.2)
- **Many Scrolls of Biting** · Hard · 3% of 7,200 (4 scrolls; the Easy version has 3)
  - Scroll of Biting — HP 30{33/33}-37{39/39}. Paper Cuts 2: unblocked attack damage costs you 1 max HP.
  - Opening varies by scroll: More Teeth / Chomp / Chew.
  - ⟳ 50%: Chomp 14{14/16} → More Teeth (+2 Strength) → Chew 5{5/6}×2; or 50%: Chew (up to twice in a row).
- **Fabricator** · Hard · 3% of 8,300
  - Fabricator — HP 150{155/155}. ⟳ If it has ≤2 allies: 50% Fabricate (summons Zapbot or Stabbot, and Guardbot or Noisebot) / 50% Fabricating Strike 18{18/21} + summons Zapbot or Stabbot. Otherwise: Disintegrate 11{11/13}.
  - Guardbot — HP 16{17/17}-20{21/21}: Guard (15 Block)
  - Noisebot — HP 18{19/19}-23{24/24}: Noise (a Dazed into your discard and one into your draw pile)
  - Stabbot — HP 18{19/19}-23{24/24}: Stab 11{11/12} + 1 Frail
  - Zapbot — HP 18{19/19}-23{24/24}: High Voltage 2 (+2 Strength at the end of each of its turns); Zap 14{14/15}
- **Owl Magistrate** · Hard · 4% of 8,500
  - HP 231{247/247}. ⟳ Magistrate Scrutiny 16{16/17}; Peck Assault 4×6; Judicial Flight (Soar: takes 50% less attack damage until it lands); Verdict 33{33/36} + 4 Vulnerable.
- **Slimed Berserker** · Hard · 3% of 8,300
  - HP 261{281/281}. ⟳ Vomit Ichor (10 Slimed into your discard); Furious Pummeling 4{4/5}×4; Leeching Hug (3 Weak on you, +3 Strength for it); Aggressive 30{30/33}.
- **Lost and Forgotten** · Hard · 2% of 8,500
  - The Lost — HP 93{99/99}, Possess Strength (returns the stolen Strength when killed): ⟳; Debilitating Smog (you −2 Strength, it +2); Eye Lasers 4{4/5}×2
  - The Forgotten — HP 106{111/111}, Possess Speed (returns stolen Dexterity when killed): ⟳; Miasma (you −2 Dexterity; it gains 8 Block and +2 Dexterity); Dread 15{15/17}, +2 per use
- **Frog Knight** · Hard · 3% of 8,400
  - HP 191{199/199}, Plating 15{19/19}.
  - ⟳ Tongue Lash 13{13/14} + 2 Frail; Strike Down Evil 21{21/23}; For the Queen +5 Strength.
  - The first time it drops below half HP: Beetle Charge 35{35/40}, then it continues at Tongue Lash.
- **A Lone Globe Head** · Hard · 2% of 8,300
  - HP 148{158/158}. Galvanic 6: your Powers are afflicted with Galvanized.
  - ⟳ Shocking Slap 13{13/14} + 2 Frail; Channel Lightning 6{6/7}×3; Aggressive 16{16/17} + 2 Strength.
- **Axebot** · Hard · 2% of 8,300 (**buffed in beta v0.111**, see §0.1)
  - Axebot — HP 70{76/76}-78{86/86}, Stock 2 (when killed, a new Axebot replaces it): ⟳; Hammer Uppercut 12{12/14} + 2 Weak + 2 Frail; The One-Two 9{9/10}×2
  - First respawn: Stock 1; Boot Up 10{10/15} Block + 3{3/4} Strength; then the same cycle
  - Second respawn: Boot Up 10{10/15} Block + 6{6/8} Strength; then the same cycle
- **Easy pool** (0–1% deaths):
  - **Devoted Sculptor:** HP 162{172/172}. Forbidden Incantation (9 Ritual); ⟳; Savage 12{12/15}.
  - **Scrolls of Biting:** 3 scrolls, as above.
  - **Turret Operator** pair:
    - Living Shield — HP 55{65/65}, Rampart 25 (at the start of your turn, the Turret Operator gains 25 Block). While its ally lives: Shield Slam 6. Then ⟳ Smash 16{16/18} + 3 Strength.
    - Turret Operator — HP 41{51/51}: ⟳ Unload! 3{3/4}×5; Unload!; Reload (+1 Strength).
- **Battleworn Dummy** (event): 75, 150 or 300 HP, 3-turn Time Limit, does nothing

---

## 3. Map generation

### 3.1 Structure per act

Sources: [Spire Codex map generation][codex-map], [wiki Map Locations][wiki-maploc], [wiki Bosses][wiki-bosses], [wiki Glory][wiki-glory], [Untapped map guide][umap].

| Act | Rooms (map rows) | Floors (rooms + Ancient + boss) | Weak-pool fights at start | Boss floor |
|---|---|---|---|---|
| Act 1: Overgrowth **or** Underdocks (random) | 15 | 17 | first **3** | 17 |
| Act 2: Hive | 14 | 16 | first **2** | 33 |
| Act 3: Glory | 13 | 15 | first **2** | 48; **49** is the second boss at A10 |

- Absolute floors, derived from the counts and consistent with the bot's own runs (Ancient at floor 18, Queen at floor 48):
  - Act 1: Neow on floor 1, rooms on floors 2–16, boss on 17.
  - Act 2: Ancient on 18, rooms 19–32, boss 33.
  - Act 3: Ancient on 34, rooms 35–47, boss 48.
  - The bot should confirm the floor numbers from the live map. An older description (17 floors in every act, boss floors 33 and 50) matches earlier builds, before acts 2 and 3 were shortened.
- **The grid** has 7 columns, with up to about 6 rooms per row.
- **Fixed rows:**
  - The **first row is always fights**.
  - The row **7 rows from the end is always a Treasure room**. This is the "halfway" chest ([UT][umap]); a guide notes it can be replaced by an elite. By the derivation above that is floor 10 in Act 1, floor 26 in Act 2 and floor 41 in Act 3.
  - The **last row before the boss is always a Rest Site**: floors 16, 32 and 47.
  - After the Act 1 and Act 2 bosses, the next floor is always an Ancient ([wiki Map Locations][wiki-maploc]).
- **No elites and no rest sites in the first 5 rows** ([codex][codex-map]).
- **Room counts per map** ([codex][codex-map]):
  - **Elites 5, or 8 at A1+.** The wiki phrases A1 as "~60% more Elites".
  - **Shops 3.**
  - **Unknown (?):** 10–14 in Act 1 (Gaussian, about 12 on average); 9–13 in Acts 2 and 3 (about 11).
  - **Rest sites:** 6–7 in Acts 1 and 2; 5–6 in Act 3.
  - Fights fill the remaining rooms.
  - The unknown and rest counts don't depend on ascension.
- **Elites** can't be the same encounter twice in a row ([wiki][wiki-maploc]).
- **Unknown (?) rooms** are resolved when you enter them ([wiki Unknown Location][wiki-unknown]):
  - Base odds: Monster 10%, Treasure 2%, Merchant 3%, otherwise **Event (85%)**.
  - Each type that *doesn't* occur gains its base amount; for example, Monster goes 10% → 20% → 30%. When a type occurs, it resets to its base.
  - All odds reset at the start of each act.
  - Relics: Juzu Bracelet removes the Monster chance. Golden Compass (Tezcatara) makes Act 2 unknowns always Events.
- **Rewards** ([wiki Map Locations][wiki-maploc], [wiki Bosses][wiki-bosses]):
  - Hallway fights: 10–20 gold (8–15 at A3), 3 cards, sometimes a potion.
  - Elites: 35–45 gold (26–34 at A3), a relic, a potion chance, and 3 cards with better rare and uncommon odds.
  - Treasure chest: 42–53 gold (32–40 at A3) plus a relic.
  - Act 1 and 2 bosses: 100 gold, a choice of 3 rare cards, and a potion. Then the next Ancient heals you (100%, or 80% of missing HP at A2+) and offers its relics.
  - Potion drop chance: 40% after a fight, −10% after a drop, +10% after a miss, +12.5% in elites ([wiki Potions][wiki-pot]).

### 3.2 Encounter pools per act

Summary of §2. "Weak" is the first 3 (Act 1) or first 2 (Acts 2–3) hallway fights; "Hard" is every hallway fight after that.

| Act | Bosses | Elites | Weak pool | Hard pool |
|---|---|---|---|---|
| Overgrowth | Vantom, The Kin, Ceremonial Beast | Phrog Parasite, Bygone Effigy, Byrdonis | Group of Slimes, A Lone Nibbit, Fuzzy Wurm Crawler, Shrinker Beetle | Overgrowth Crawlers, Ruby Raiders, A Pair of Nibbits, Overgrowth Flora, Shroom and Slime, Swarm of Slimes, Strangler and Friend, Inklets, Vine Shambler, Fogmog, Mawler, Cubex Construct |
| Underdocks | Waterfall Giant, Lagavulin Matriarch, Soul Fysh | Terror Eel, Phantasmal Gardeners, Skulking Colony | Corpse Slugs, Toadpoles, Seapunk, Sludge Spinner | Underdocks Wildlife, Cultists, Many Corpse Slugs, Two Gremlins in a Trenchcoat, Fossil Stalker, Two-Tailed Rats, Living Fog, Haunted Ship, Sewer Clam, Punch Construct |
| Hive | Knowledge Demon, Kaiser Crab, The Insatiable | Decimillipede, Infested Prism, Entomancer | Thieving Hopper, Bowlbugs, Tunneler, Exoskeletons | Slumber Party, Hunter Killer, Bowlbug Swarm, Ovicopter, The Obscura, Mass of Mytes, An Automaton Pair, Spiny Toad, Many Exoskeletons, Louse Progenitor |
| Glory | Queen, Test Subject, Aeonglass | Knight Gang, Mecha Knight, Soul Nexus | Devoted Sculptor, Scrolls of Biting, Turret Operator | Construct Menagerie, Many Scrolls of Biting, Fabricator, Owl Magistrate, Slimed Berserker, Lost and Forgotten, Frog Knight, A Lone Globe Head, Axebot |

- **Event fights:** Wrigglers (Dense Vegetation, Act 1); Punch Constructs (Punch Off, Underdocks); Mysterious Knight (the Lantern Key, Act 2); The Merchant??? (Potion Courier / fake merchant, Acts 2–3); Battleworn Dummy (Act 3).
- The act's boss is shown on the map from the start. At A10 the second Act 3 boss is shown too ([wiki Bosses][wiki-bosses]).

---

## 4. Ascension levels A1–A10

Sources: [wiki Ascension][wiki-asc], [Untapped ascension guide][uasc], [wiki Map Locations][wiki-maploc], [Spire Codex][codex-map], [wiki Merchant][wiki-merchant]. Each level includes all the levels below it.

| Level | Name | Exact effect |
|---|---|---|
| A1 | Swarming Elites | Elites per map 5 → **8** ([codex][codex-map]); the wiki says "~60% more Elites" |
| A2 | Weary Traveler | Ancients heal **80%** of your missing HP instead of 100%, Neow included |
| A3 | Poverty | Enemies and chests drop **25% less gold**: hallways 10–20 → 8–15, elites 35–45 → 26–34, chests 42–53 → 32–40 |
| A4 | Tight Belt | **One fewer potion slot:** 3 → 2 ([wiki Potions][wiki-pot]) |
| A5 | Ascender's Bane | Start the run with the **Ascender's Bane** curse: Unplayable, Ethereal, **Eternal** (it can't be removed) |
| A6 | Inflation | Card removal at the Merchant costs **100** and rises by **+50** each time (normally 75, +25) |
| A7 | Scarcity | Rare and upgraded cards appear **half as often**, in combat rewards and in the Merchant's stock |
| A8 | Tough Enemies | All enemies have more HP, plus some defensive values; see §1 and the `{A8}` column |
| A9 | Deadly Enemies | All enemies deal more damage, plus some offensive buffs; see §1 and the `{A9+}` column |
| A10 | Double Boss | **Two bosses at the end of Act 3:** the first on floor 48, a **different** second boss on floor **49**. Both are shown on the map. There is **no healing between them** unless a relic provides it; Pantograph heals 25 at the start of each boss fight ([Steam][st-a10boss], [wiki Bosses][wiki-bosses]). Scaling resets between the two fights ([UT][uasc]). |

- **Which bosses pair at A10:** the Act 3 pool is Queen, Test Subject and Aeonglass, and the second boss differs from the first. So any two of the three can pair, in either order. `[inference]`: no source states a rule beyond "different". With Doormaker gone, the three possible pairs are Queen + Test Subject, Queen + Aeonglass, and Test Subject + Aeonglass.
- **Version history:**
  - A6 was "Gloom" (fewer rest sites) until v0.102.0. Since v0.103.2 rest sites are unaffected by ascension.
  - A10 was "Ascender's Scorn" before v0.90.0 ([wiki Ascension][wiki-asc]).
- **StS1 carry-over flag:** A20's double boss in StS1 is the model for A10 here, but StS2's ascension list is its own. There is no StS2 equivalent of StS1's A11–A19 modifiers.

[ut-queen]: https://sts2.untapped.gg/en/enemies/encounters/queen-boss
[ut-enemies]: https://sts2.untapped.gg/en/enemies
[ubosses]: https://sts2.untapped.gg/en/guides/bosses-intro
[uasc]: https://sts2.untapped.gg/en/guides/ascensions-list-best-strategies
[umap]: https://sts2.untapped.gg/en/guides/how-to-make-the-best-map-choices-in-slay-the-spire-2
[wiki-asc]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ascension
[wiki-maploc]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Map_Locations
[wiki-unknown]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Unknown_Location
[wiki-bosses]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Bosses
[wiki-glory]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Glory
[wiki-aeon]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Aeonglass
[wiki-ts]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Test_Subject
[wiki-111]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:V0.111.0_-_Beta_Patch
[wiki-110]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:V0.110.0_-_Beta_Patch
[wiki-pot]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Potions
[wiki-merchant]: https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Merchant
[codex-map]: https://spire-codex.com/mechanics/map-generation
[jsheet]: https://docs.google.com/spreadsheets/d/197RwIxLuzSLubsWr6OLfhdHPRFgIWRnQyTp-RuZUveU/htmlview
[st-a10boss]: https://steamcommunity.com/app/2868840/discussions/0/572666383658130622/
