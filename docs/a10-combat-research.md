# A10 combat research: bosses, elites, and what the evaluation should know (StS2, Ironclad)

Compiled 2026-09-23 for spire-jev (beta branch v0.111.0).
This file covers **combat only**. Monster tables and map rules are in `A10-reference.md`, and deckbuilding and strategy are in `STRATEGY-research.md`. Anything already stated there is repeated here only when it is needed for a rule, or when a newer source changes it.

Tags:

- `[several]` means two or more independent StS2 sources agree.
- `[one]` means one source.
- `[inference]` is derived from the game text or the move scripts; test it in the simulator before relying on it.
- Numbers are **A8/A9+ values**, which is what A10 uses (HP rises at A8, damage at A9). "Pn" means your nth turn, and "En" means the enemies' nth turn.

---

## 1. Sources

| Key | Source | Date / patch | Reliability | Used for |
|---|---|---|---|---|
| wiki | slaythespire.wiki.gg StS2 pages: [The Insatiable](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Insatiable), [Frantic Escape](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Frantic_Escape), [Queen](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Queen), [Test Subject](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Test_Subject), [Aeonglass](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Aeonglass), [Vantom](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Vantom), [Byrdonis](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Byrdonis), [Knowledge Demon](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Knowledge_Demon), [Kaiser Crab](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Kaiser_Crab), [Ceremonial Beast](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ceremonial_Beast), [Waterfall Giant](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Waterfall_Giant), [The Kin](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Kin), [Soul Fysh](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Soul_Fysh), [Lagavulin Matriarch](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Lagavulin_Matriarch), [Ascension](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ascension), [Bosses](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Bosses) | Update histories run to **v0.111.0** (Aug 2026) | High for numbers and patch deltas | Numbers, beta changes, special rules |
| codex | Spire Codex API (decompiled game data): `/api/monsters/{ID}` for THE_INSATIABLE, QUEEN, TORCH_HEAD_AMALGAM, TEST_SUBJECT, AEONGLASS, VANTOM, BYRDONIS, plus the `?type=Boss` and `?type=Elite` lists; `/api/cards/FRANTIC_ESCAPE`; `/api/powers?search=` for Sandpit, Chains of Binding, Minion, Nemesis, Weak. Monster pages (e.g. [Queen](https://spire-codex.com/monsters/QUEEN)) carry community fight stats. | Main branch; **lags the beta** (see the Amalgam, Aeonglass and Soul Fysh deltas) | High for move state machines and power text | Exact scripts, fatality rates, average fight length |
| steam | Steam StS2 discussions: [Sandpit before Doom](https://steamcommunity.com/app/2868840/discussions/0/802341528343364437/) (Mar 2026), [Sandpit last-turn intent](https://steamcommunity.com/app/2868840/discussions/0/806845754929005283/), [Sandpit "glitch"](https://steamcommunity.com/app/2868840/discussions/0/839501159534196613/) (May 2026), [The INSATIABLE](https://steamcommunity.com/app/2868840/discussions/0/802341195824219873/), [The Insatiable Is Terrible](https://steamcommunity.com/app/2868840/discussions/0/802341528343178591/), [Tips for Queen](https://steamcommunity.com/app/2868840/discussions/0/798964766335927637/), [Ironclad and the Queen](https://steamcommunity.com/app/2868840/discussions/0/802341195824203069/), [Queen busted?](https://steamcommunity.com/app/2868840/discussions/0/802341528343289945/), [Queen cheese](https://steamcommunity.com/app/2868840/discussions/0/802341528343184436/), [Ironclad A10 Act 3 gauntlet](https://steamcommunity.com/app/2868840/discussions/0/798966340582963322/), [Is Vantom too strong](https://steamcommunity.com/app/2868840/discussions/0/802341195824210601/), [Byrdonis elite](https://steamcommunity.com/app/2868840/discussions/0/798967297092984812/), [help with A10 Ironclad](https://steamcommunity.com/app/2868840/discussions/0/845132259930458497/) | Mar–Sep 2026 | Medium; player reports | Timing details, how players play |
| guides | [slashskill boss guide](https://www.slashskill.com/slay-the-spire-2-boss-guide-every-boss-attack-patterns-and-how-to-beat-them/) (upd. 2026-07-28), [keengamer bosses](https://www.keengamer.com/articles/guides/slay-the-spire-2-bosses-and-how-to-beat-them/) (2026-03-21), [sts2front](https://sts2front.com/tips/boss-guide/) (v0.102), [solojugadores A10 Ironclad](https://www.solojugadores.com/en/slay-the-spire-2-ironclad-ascension-10-guide/) (2026-06-06), [nat1gaming Ironclad](https://nat1gaming.com/sts2/character-guide/the-ultimate-guide-to-ironclad-in-slay-the-spire-2/) (2026-04-01), [DualShockers A10 tips](https://www.dualshockers.com/slay-the-spire-2-tips-and-tricks-for-ascension-10/) (2026-05-29), [thegameslayer](https://thegameslayer.com/guides/slay-the-spire-2-insatiable-boss-fight/) (upd. 2026-09-11), [respawnindex](https://respawnindex.com/slay-the-spire-2-how-to-beat-insatiable-boss/), [neonlights](https://www.neonlightsmedia.com/blog/slay-the-spire-2-insatiable-boss-guide), [gamerblurb](https://gamerblurb.com/articles/slay-the-spire-2-insatiable-boss-guide-act-2), [games.gg Vantom](https://games.gg/slay-the-spire-2/guides/slay-the-spire-2-how-to-beat-vantom/), [sts2-hub Queen](https://sts2-hub.pages.dev/guides/bosses/queen), [sts2.wiki](https://sts2.wiki/enemies/the-insatiable/) | 2026 | Low to medium: generic, some numbers wrong | Consensus tactics only |
| low | [STS2 Companion](https://www.sts2companion.com/bosses/the-insatiable) (wrong move numbers), [Phrasemaker](https://thephrasemaker.com/2026/03/13/slay-the-spire-2-the-insatiable-boss-guide/) (says you die when Sandpit reaches 1), [Fextralife Queen](https://slaythespire2.wiki.fextralife.com/Queen_(Encounter)) (auto-generated) | 2026 | Low | Cross-checks only |

**Unreachable or empty:**

- **Untapped.gg:** 403 on both the guides and the encounter pages. The existing docs had read these earlier.
- **Mobalytics:** 403.
- **PC Gamer Vantom guide:** the article body didn't render.
- **YouTube:** descriptions didn't render. This includes "How I'm Winning 85% of My A10 Ironclad Runs" and "Stop Losing at Ascension 10 on Ironclad".
- **bossdown.com:** DNS failure.
- **Deltia's Gaming:** 405.
- **Steam "Boss Tips" guide:** 429.
- **Reddit:** no r/slaythespire StS2 thread surfaced in search.
- **Top players:** I found no written Insatiable, Queen or Test Subject combat notes from Jorbs or Baalorlord beyond what `STRATEGY-research.md` already cites.

**StS1 contamination I rejected:**

- Artifact potions against the Queen: players can't get Artifact in StS2 (see `STRATEGY-research.md` §9c.2).
- Time Eater, Donu/Deca and Awakened One, which appear in some "A10" guides.
- "Use potions on elites, not bosses."

---

## 2. Per boss and elite

### 2.0 Exact scripts for the lookahead

Every boss the bot meets is **scripted**, except for its branch points. Use these tables instead of learned guesses. The two-turn lookahead currently predicts the next turn exactly only 60% of the time (PLAN.md).

The scripts come from the codex state machines, with beta deltas from the wiki. `[several]`

| Boss | Opener | Loop (A9+ numbers) |
|---|---|---|
| The Insatiable | Liquify Ground (no attack) | Thrash 9×2 → Lunging Bite 31 → Salivate +3 Str → Thrash 9×2 → (repeat). So turns 5–6 and 9–10 are both Thrash. |
| Vantom | none | Ink Blot 8 → Inky Lance 7×2 → Dismember 30 + 3 Wounds (discard) → Prepare +2 Str |
| Byrdonis | Swoop 19 (the bot's logs and the wiki; the codex page lists Peck first) | Swoop 19 ↔ Peck 4×3. Territorial: +1 Str at the end of each of its turns. |
| Queen | Puppet Strings (3 Chains of Binding) → You Are Mine (99 Frail/Weak/Vuln) | While the Amalgam lives: Burn Bright for Me every turn (+20 Block, Amalgam +1 Str). Once it dies: Off with Your Head 4×5 → Execution 18 → Enrage +2 Str. If the Amalgam dies while her intent is Burn Bright, she Enrages instead. If it dies by turn 2, the first Enrage is skipped. |
| Torch Head Amalgam (**v0.109+**) | Strong Tackle 32 → Tackle 22 | Beam 8×3 → Weak Tackle 16 → Weak Tackle 16 → (repeat) |
| Test Subject | P1 (111 HP): Bite 22 ↔ Skull Bash 16 + 1 Vuln | Respawn (no attack) → P2 (212 HP): Multi-Claw 11×3, +1 hit each use → Respawn → P3 (313 HP): Lacerate 11×3 → Big Pounce 45 → Burning Growl (5 Burns into discard, +3 Str) |
| Aeonglass | none | Ebb 26 + 33 Block (v0.109; main branch 32) → Eye Lasers 12×2 → Increasing Intensity (+3+X Str, 2 Wither+X into discard, upgrade all Withers) |
| Kaiser Crab | none | Crusher: Thrash 14 → Enlarging Strike 4 → Bug Sting 7×2 + 2 Weak + 2 Frail → Adapt +3 → Guarded Strike 14 + 18 Block. Rocket: Targeting Reticle 4 → Precision Beam 20 → Charge Up +3 → Laser 35 → Recharge (nothing). |
| Knowledge Demon | none | Curse of Knowledge (choose a debuff) → Slap 18 → Knowledge Overwhelming 9×3 → Ponder 13 + heal 30 + 3 Str. After the 3rd curse the loop drops the curse. |
| Ceremonial Beast | Stamp (sets Plow 160) | Plow 20 + 2 Str every turn until its HP ≤ Plow. Then it is Stunned and loses all Str, then loops Beast Cry (Ringing: 1 card next turn) → Stomp 17 → Crush 19 + 4 Str. |
| Waterfall Giant | Pressurize (20 Steam Eruption) | Stomp 16 + 1 Weak → Ram 11 → Siphon (heal 15) → Pressure Gun (grows +5 per use) → Pressure Up 14. Each move adds +3 Steam. **On death: About to Blow, then it explodes for its Steam stacks at the end of your next turn.** |
| The Kin | Priest + 2 Followers (Minions: they leave when the Priest dies) | Priest: Orb of Frailty 9 + Frail → Orb of Weakness 9 + Weak → Soul Beam 3×3 → Dark Ritual +3. Followers (offset): Quick Slash 5 → Boomerang 2×2 → Power Dance +3. |
| Soul Fysh | Beckon (2 Beckon cards) | De-Gas 18 (A9 raised in **v0.111**) → Gaze 8 + 1 Beckon → Fade (2 Intangible) → Scream 15 + 3 Vuln → Beckon … |
| Lagavulin Matriarch | Asleep 3 turns, 12 Plating (it wakes early on unblocked damage) | Slash 21 → Disembowel 10×2 → Slash 14 + 14 Block → Soul Siphon (you −2 Str −2 Dex, it +2 Str) |

### 2.1 The Insatiable (Act 2 boss). The bot is 0/9 at A10.

**Numbers:**

- HP **341** at A8+ (321 below A8). `[several]` (wiki, codex, sts2.wiki)
- It has no block, and hasn't since v0.62. Community stats: fatal in 16.1% of 290k runs, 47.6 damage taken on average, **7.84 turns** on average ([codex](https://spire-codex.com/monsters/THE_INSATIABLE)). A fight that lasts about 8 turns means players extend the timer about 3 times.

**Sandpit (exact):**

- **Liquify Ground** (E1) gives **4 Sandpit**. The codex types it as a Buff on the Insatiable, counted separately per player.
- It also shuffles **6 Frantic Escape** into your deck: **3 into the draw pile and 3 into the discard pile**. `[several]`
- The power text says that in X turns you will be eaten and die. The counter drops by 1 each turn.
- **At 0 you are eaten at the start of the enemies' turn, before its intent resolves** (Steam, Mar 2026). Since v0.103, poison ticks before the eating.
- **Lizard Tail doesn't prevent it** (patched in v0.73). **Neither does Fairy in a Bottle**, which only triggers when HP reaches 0 (v0.103.2 wording). `[several]`
- Since v0.100 the power's text says so explicitly on the turn it will eat you. The attack intent is still shown that turn, although it never happens (Steam).

**Timeline** `[inference from the above; confirm against a logged Sandpit death]`:

| Turn | Sandpit during your turn | Intent (A9+) | Enemy Str |
|---|---|---|---|
| P1 | none yet | Liquify Ground (no attack) | 0 |
| P2 | 4 | Thrash 9×2 | 0 |
| P3 | 3 | Lunging Bite 31 | 0 |
| P4 | 2 | Salivate (no attack) | 0 → 3 |
| P5 | **1: you are eaten after this turn unless you play an Escape** | Thrash 12×2 | 3 |
| P6 | (+Escapes) | Thrash 12×2 | 3 |
| P7 | | Bite 34 | 3 |
| P8 | | Salivate | 3 → 6 |
| P9 / P10 / P11 | | 15×2 / 15×2 / Bite 37 | 6 |

With no Escapes you get **5 turns**, so 341 HP needs about 68 damage per turn. With 3 Escapes you get 8 turns (about 43 per turn), but take about 161 damage over P2–P9 if nothing is blocked.

**Frantic Escape (exact):** a Status card, cost 1. It says: get farther away, increase Sandpit by 1, and increase **this card's** cost by 1. `[several]`

- It has no Exhaust and no Ethereal. After you play it, it goes to the discard pile and comes back at +1 cost.
- The six copies track their costs separately, so all six can be played once at cost 1 before any costs 2.
- Exhaust effects **delete** Escapes. That makes them dangerous here, and the bot has already hit it (PLAN.md: in-fight exhaust took Escapes first).
- Havoc playing an Escape off the top still gains the Sandpit before it exhausts it `[inference]`.

**How players play it:**

- It's a damage race, not a defensive fight, and front-loaded burst beats slow scaling. `[several]`: keengamer, sts2front, respawnindex, slashskill, companion.
- **When to play Escapes is disputed:**
  - Some say only when the timer is 1–2 (companion, gamerblurb, a search summary of Untapped).
  - Others say always play them when drawn, because extending the timer matters more than almost anything else (slashskill, and a second search summary).
  - Draw order settles it. An Escape you don't play goes to discard and won't come back until the reshuffle. So play it when drawn, unless the kill fits inside the current timer. `[inference]`
- A deck of about 20 cards finds its Escapes reliably. At 30+ cards, runs die with Escapes still in the draw pile. `[several]` (Steam ×2, neonlights)
- Card draw and energy help: Offering, Bloodletting, Pommel Strike, Battle Trance, Burning Pact (but never on an Escape). `[several]`
- Use potions early for damage, not held for emergency defence (respawnindex). `[one]`
- **HP is cheap here.** The next Ancient heals 80% of missing HP at A2+ `[several]`, so of each HP point still missing at the end of the fight, you really lose only 0.2 going into Act 3 `[inference]`.

**Turn plan** `[inference from the script]`:

- **P1 and P4 have no incoming attack.** Put all energy into damage and powers. Here powers are worth it: Demon Form, Inflame, Rupture, Inferno and Feel No Pain all pay off over about 8 turns.
- **P3 (Bite 31) is the only big hit in the first 5 turns.** Block it only as far as the HP needed for the rest of the fight requires.
- **P2 and P5** (9×2 and 12×2) are cheap to take.
- **Don't let P5 end at Sandpit 1** unless the kill happens that turn.

### 2.2 Queen + Torch Head Amalgam (Act 3 boss)

**Numbers:**

- Queen **419**. Amalgam **211**, and it is a **Minion**: minions leave combat without their leader.
- **Killing the Queen ends the fight.** The v0.103 fix for "defeating her before the Amalgam" confirms it. `[several]`
- Community stats: fatal in 19%, 64 damage taken, **8.56 turns** ([codex](https://spire-codex.com/monsters/QUEEN)).
- **Beta deltas missing from `A10-reference.md`** (wiki update history):
  - v0.108: the Amalgam's A9 Tackle went 19 → **22** and its Weak Tackle 15 → **16**.
  - v0.109: it gained a **Strong Tackle 26(32) opener**.
  - The v0.111 Amalgam is therefore **32, 22**, then the loop Beam 8×3 → 16 → 16.
- Chains of Binding also Binds curses and statuses (v0.90).
- Hellraiser Strikes auto-play before Bound is applied (v0.93).
- Once one Bound card has been played, the other Bound cards can't be auto-played either (v0.81).

**Timeline** `[inference]`:

| Turn | State | Incoming |
|---|---|---|
| **P1** | Clean: no Bound, no debuffs, **Queen has no Block** | Strong Tackle 32 (the biggest pre-debuff hit) |
| **P2** | Bound (3 cards; play 1), no Weak yet, Queen has no Block | Tackle 22, which probably already lands ×1.5 if the Queen acts first in E2 |
| P3 | 99 Weak/Frail/Vuln from now on | Beam (8+1)×3 ×1.5 ≈ 40 (Fextralife: up to 44) |
| P4+ | **Queen has 20 Block on every turn of yours** | Amalgam 16–24 base, +1 Str per turn, ×1.5 |

**Target choice:**

- Most sources say kill the Amalgam first. `[several]`
- Steam's refinement: if your burst is good, focus the Queen; if not, kill the minion first. `[several]`
- Selphie (via `STRATEGY-research.md`): race the Queen only if she dies within about 5 turns.
- The arithmetic `[inference]`:
  - Queen-first needs 419 damage plus 20 per turn from P4 on.
  - Amalgam-first needs 211 + 419 = 630 in total.
  - While the Amalgam lives it deals about 35 per turn by P6 (with Vulnerable). Queen alone after it dies deals about 25 per turn, rising (45 / 30 / 0 per 3 turns at +2 Str).
  - So **if your post-Weak damage D is at least about 40 per turn, Queen-first ends the fight about 4 turns earlier and saves roughly 100+ HP. If D is about 30 or less, Queen-first mostly feeds her Block.**
- **Either way, dump P1–P2 damage** (no Weak, no Queen Block).
- AoE (Breakthrough, Thunderclap, Conflagration, Whirlwind, Howl from Beyond, Pact's End) hits the Amalgam fully, but the Queen's 20 Block eats it.

**Handling the debuffs** `[several]` + `[inference]`:

- There is no Artifact in StS2.
- **Colossus reads *enemy* Vulnerable** (Jorbs, cited in `STRATEGY-research.md`), so it does **not** offset the 99 Vulnerable on you.
- Frail doesn't touch block from powers or relics, so Feel No Pain, Crimson Mantle, Rage and Plating keep full value.
- Under Bound, draw first (cards drawn after the first 3 are free), then play the single best Bound card.

### 2.3 Test Subject (Act 3 boss)

**Numbers:**

- Phase HP 111 / 212 / 313. Community stats: fatal in 23.1%, 74.8 damage, **9.44 turns**.
- Each phase clears the boss's statuses and Strength, including any Vulnerable you applied. `[several]` (wiki, UT via the existing doc)
- On-kill effects (e.g. Feed) do trigger. `[one]` (wiki)
- **Phase 1:** Enrage **3** means +3 Str every time you play a **Skill**. `[several]`
- **Phase 2:** Painful Stabs adds a Wound to your discard for each unblocked attack hit. `[several]` Multi-Claw's hit count rises every use: 33, 44, 55 … damage.
- **Phase 3:** Nemesis gives Intangible 1 at the end of every other turn. **It enters phase 3 already Intangible**, and its first new gain is after phase-3 turn 2. `[one]` (wiki)
- **Between phases it Respawns**, which is not an attack. It "can't be targeted until it revives". `[several]`

**Plan:**

- **Phase 1:** attacks and Powers only. Each Skill costs about 3 × (the number of phase-1 attacks left). Kill it fast. `[several]`
- **The turn you kill a phase:** the next enemy move is Respawn, so **block is worthless for the rest of that turn**. Play powers and draw. Don't apply debuffs, because they get cleared. `[inference]` from the script and the status reset.
- **Phase 2:** block every hit fully, and kill it before Multi-Claw reaches 5+ hits. `[several]`
- **Phase 3:** with a 3-move loop against 2-turn Intangible, the pairing repeats every 6 turns `[inference]`:

| Phase-3 turn | Intangible? | Intent | Best use |
|---|---|---|---|
| 1 | yes | Lacerate 11×3 | Block and powers; apply Vulnerable (Bash / Tremble / Taunt) so it's active next turn |
| 2 | **no** | Big Pounce 45 | Burst, but you must also cover 45 (Impervious, Flame Barrier) |
| 3 | yes | Burning Growl (no attack) | Free setup; exhaust Burns |
| **4** | **no** | Lacerate 14×3 | Burst |
| 5 | yes | Big Pounce 48 | Full block |
| **6** | **no** | Growl (no attack) | **Best burst turn: tangible, and nothing incoming** |

- Multi-hits still deal 1 per hit into Intangible. `[several]`

### 2.4 Aeonglass (Act 3 boss; replaced Doormaker in v0.107.1)

**Numbers:**

- 535 HP, **3 Artifact**. Community stats: fatal in 24.9% (the worst of the three Act 3 bosses), 73.8 damage, **7.35 turns**.
- Ebb 22(26) since the v0.109 nerf; the codex still shows 26/32.
- **Withering Presence:** every 6 cards you play adds a Wither to your hand. Wither is Unplayable and deals 3 damage (more once upgraded) if it's still in hand at end of turn. `[several]`
- Increasing Intensity: +3+X Strength at A9, and 2 Wither+X into your discard.

**Timeline** `[inference from the 3-move loop]`:

- **Turns 3, 6, 9 (Increasing Intensity):** no attack, and it has no Block. **These are the burst turns.**
- **Turns 2, 5, 8:** it still holds the 33 Block from the previous turn's Ebb, and Eye Lasers are coming. Use them for block, powers and Artifact stripping.
- **Turns 1, 4, 7 (Ebb 26+Str):** a big hit, no enemy Block. Mix damage and block.
- Strength runs +4, +9, +15 … by the 3rd, 6th and 9th turn, so the fight has to end by about turn 8.

**Tactics:**

- Strip the 3 Artifact with the cheapest debuffs (Thunderclap, Taunt) before Bash, Tremble, Uppercut, Dominate or Mangle. Mangle's Strength loss is presumably also negated by Artifact. `[several]` for stripping, `[inference]` for Mangle.
- Exhaust Withers with Second Wind (block for each), Burning Pact, True Grit, Fiend Fire, Stoke or Brand.
- Keep the card count at 5 per 6-card cycle, unless the 6th card is worth more than the Wither damage or you have an exhaust ready. `[several]`

### 2.5 Vantom (Act 1 boss). The bot wins about 60%.

**Numbers:**

- HP 183, Slippery 9: the next 9 times it loses HP, it loses only 1. `[several]`
- Changed in v0.106: a hit that's fully blocked no longer uses a stack (Vantom never blocks). Poison and HP-loss effects do count. `[several]`
- Community stats: fatal in 16.1%, 48.8 damage, **8.92 turns**.
- The bot's own record: A10 losses came in at 55 HP on average and wins at 74. **The bot blocked for five turns while Slippery held** (PLAN.md). That is the evaluation failing to value stripping stacks, not a tactical choice.

**Plan:** `[several]` (PC Gamer snippet, games.gg, sts2front, keengamer, nat1gaming, Steam)

- Turns 1–2: strip the stacks with multi-hits and 0–1 cost hits: Twin Strike (2), Sword Boomerang (3), Thrash (2), Conflagration (4), Whirlwind (X), Anger, Breakthrough.
- Turn 3 (Dismember 30): the block turn.
- Turn 4 (Prepare): burst once the stacks are gone.
- Save strong block and potions for turn 3. Keep 1-damage-per-instance potions (Fire and similar) until the stacks are 0.
- Flame Barrier against Inky Lance's 2 hits removes 2 stacks. `[inference]`

### 2.6 Byrdonis (Act 1 elite)

- 90 HP. Swoop 19 ↔ Peck 4×3, +1 Str per turn.
- Community stats: fatal in 5.3%, 27.8 damage, **4.5 turns**.
- **Race it:**
  - Apply Vulnerable on turn 1, and use damage potions early. `[several]`
  - Blocking is viable when it avoids all damage. `[one]` (Steam)
  - Weak (Uppercut) has most value on Peck turns (3 hits) from Peck #2 on. `[inference]`
- It's an elite, so HP counts in full (only Burning Blood's 6 comes back).

### 2.7 Other bosses the bot can meet

- **Knowledge Demon** (399 HP):
  - Its curse offers are fixed: Disintegration 6/7/8 damage per turn, or in turn Mind Rot (draw −1), Sloth (max 3 cards), Waste Away (−1 energy). `[one]` (wiki)
  - slashskill: if the deck is fast, take Disintegration over Mind Rot. `[one]`
  - It's an Act 2 boss, so HP costs about 0.2 per point. Prefer **Disintegration** unless the remaining fight × damage exceeds what the HP buffer can absorb. `[inference]`
  - Knowledge Overwhelming 9×3 is the multi-hit turn for Flame Barrier. Ponder heals 30, so burst right after it rather than before.
- **Kaiser Crab:**
  - You are Surrounded, and face the claw you last targeted. The claw behind you deals +50%. **End each turn facing the claw with the bigger attack.** `[several]` (wiki, keengamer)
  - Crab Rage: when one claw dies, the other gains 5–6 Str and 99 Block. Enemy Block lasts until its own next turn, so **make the first kill the last damage of your turn**. Anything played into the survivor afterwards is wasted. `[inference]`
- **Waterfall Giant:**
  - Killing it doesn't end the fight. At the end of your next turn it explodes for its Steam stacks (20 + 3 per move). `[several]`
  - Weak (Uppercut) reduces the explosion. `[one]` (nat1gaming)
  - Delay the lethal hit a turn if you can't block the blast. `[one]` (keengamer)
- **Ceremonial Beast:**
  - Crossing 160 HP stuns it and wipes its Strength. It Plows every turn, so cross the threshold as early as you can. `[inference]`
  - Its next move (Beast Cry) Rings you for a turn: play your single highest-impact card that turn. `[several]`
- **The Kin:**
  - The Followers are Minions, so killing the Priest ends the fight. `[several]`
  - Use AoE, and effects that ignore Weak and Frail. `[one]`
- **Soul Fysh:**
  - Never end a turn holding Beckon (−6 HP each). `[several]`
  - Burst on turns 2–3 before Fade (2 Intangible). `[several]`
  - v0.111 raised De-Gas to 18.
- **Lagavulin Matriarch:**
  - While it sleeps (3 turns or until unblocked damage), play every Power. Wake it only with a burst. `[several]`
  - Soul Siphon costs you 2 Str and 2 Dex each loop. `[one]`

### 2.8 Elites at A10 (details in `A10-reference.md`)

- **Decimillipede** (Jorbs' most frequent A10 killer): a dead segment revives with 25 HP after 2 turns while any other segment lives. Bring all three segments down within one 2-turn window, and favour AoE. `[one]` + `[inference]`
- **Entomancer, Infested Prism:** covered in `STRATEGY-research.md` §4.5 / §10.7.
- **Knight Gang, Mecha Knight, Soul Nexus:** covered in `STRATEGY-research.md` §10.10 rules 8–10. Note Mecha Knight's v0.111 Flamethrower damage.

---

## 3. General A10 Ironclad heuristics a one-turn search can miss

1. **HP isn't worth the same in every fight.** `[several]` for the healing facts; `[inference]` for the weights.
   - After the Act 1 and Act 2 bosses, the Ancient restores 80% of missing HP, so HP still missing when those fights end costs only about 0.2 per point.
   - Elites and hallways cost about 1 per point (Burning Blood refunds 6).
   - Floor 48 costs about 1 per point, plus what floor 49 will need. HP carries over, there is no heal between the bosses, and Pantograph heals 25 at the start of each.
   - **Floor 49 has no value after the fight at all**; only survival counts.
   - Today's flat "HP lost ×1" makes the bot turtle in exactly the fights (Vantom, Insatiable) where racing wins.
   - During the fight, HP is still the buffer against dying. Weight it steeply only when the HP left after this turn is below the damage projected to arrive before the kill.
2. **Planning horizon.** Average fight lengths: Byrdonis 4.5, Aeonglass 7.4, Insatiable 7.8, Queen 8.6, Vantom 8.9, Test Subject 9.4 (codex; all characters). A Power that gains g per turn is worth about g × (turns left − 1).
   - The global "setup" weight didn't help (PLAN.md). The likely reason is that it was applied everywhere, hallways included.
   - Apply it only in boss and elite fights, and always on **turns with no incoming attack**: Insatiable P1/P4, Vantom Prepare, Test Subject phase-kill and Growl turns, Aeonglass Intensity turns, sleeping Lagavulin, Queen P1. `[inference]`
3. **Taking damage to race.** When the incoming attack is small next to what the energy would deal (Insatiable Thrash, Vantom Ink Blot, Byrdonis's early Pecks), spend the energy on damage. Block only if the plan wins by waiting for something: an off-turn, Vulnerable, or Intangible running out. `[several]` (Untapped micro guide, via STRATEGY-research §4.1)
4. **Keeping cards.** Ironclad has almost no Retain, so the lever is draw order.
   - A mid-turn draw that forces a reshuffle keeps the cards in your hand out of the next cycle (Untapped, via STRATEGY-research).
   - Against the Insatiable, forcing the reshuffle pulls the 3 discard-pile Escapes back into play sooner. `[inference]`
   - Unrelenting's "next Attack costs 0" can carry across turns (Baalorlord).
5. **Exhaust priorities**, first to last:
   - Wither, Beckon, Burn, Wound, Dazed, Slimed.
   - Then Strikes, then Defends.
   - **Never** a Frantic Escape, unless the kill is certain within the current Sandpit. `[several]`
   - Play Fiend Fire, Stoke and Second Wind *after* the cards you want to keep, and after any Escape. `[several]`
6. **Vulnerable and Weak timing:**
   - Apply Vulnerable before the big hits, and on Intangible or enemy-Block turns so it's live when damage lands. Don't apply it into Artifact, into Slippery stacks you can't clear this turn, or to a Test Subject phase you are about to kill. `[several]` + `[inference]`
   - Weak (Uppercut or a potion) has most value just before multi-hit turns: Peck, Thrash, Beam, Multi-Claw, Maelstrom.
7. **Strength-scaling enemies** make every extra turn cost more:
   - Byrdonis +1 per turn.
   - Insatiable +3 every 4 turns.
   - Vantom +2 every 4.
   - Amalgam +1 per turn.
   - Aeonglass +4, +5, +6 every 3.
   - Knowledge Demon +3 and heals 30 every 4.
   - Test Subject phase 1: +3 per Skill.
   - The evaluation's enemy-HP term should rise with the enemy's Strength growth over the turns left. For example, weight enemy HP by the projected turns to kill × the enemy's damage growth per turn. `[inference]`
8. **Status cards:**
   - Wounds (Vantom, Test Subject phase 2) clog future draws. Burns (Test Subject phase 3, Mecha Knight) and Withers (Aeonglass) hurt only while in hand at end of turn. Beckon costs 6 HP.
   - With Feel No Pain or Dark Embrace in play, each status is fuel for Second Wind or Burning Pact. `[several]`
9. **Double-boss finale** `[inference]`, with the facts `[several]`: floor 48 then 49, a different boss each, both visible on the map, no heal, and scaling resets.
   - Before floor 48, estimate what floor 49 will cost from the bot's own logs; community averages are Queen 64, Test Subject 75, Aeonglass 74. The HP target leaving floor 48 is that estimate plus a margin.
   - On floor 48, spend a potion only if it saves more than its value on floor 49, or if the floor-48 fight is at real risk.
   - On floor 49, drink everything by the turn it helps most. Lizard Tail and Fairy in a Bottle do work here (their death is HP 0). They do **not** work against Sandpit.

---

## 4. Checkable rules for the bot

Each rule is phrased so that one evaluation weight or one per-boss adjustment can express it.

| # | IF | THEN | Tag / source |
|---|---|---|---|
| 1 | Boss fight in Act 1 or 2, and HP after this turn > projected incoming damage until the kill + 10 | Weight HP lost at **0.25** instead of 1.0 (the 80% Ancient heal). Restore 1.0 below that margin. | [several] heal fact (wiki / Untapped / Steam); [inference] weight |
| 2 | Floor-49 boss (the last fight of the run) | HP has no value beyond not dying: weight it ≈0 above a safety margin, and drink every useful potion | [inference] from A10 rules [several] |
| 3 | Floor-48 boss | Keep HP lost at 1.0, and count held potions at their floor-49 value; drink one only if it saves more HP than that or the fight is at risk | [inference] |
| 4 | The Insatiable, and estimated turns to kill (enemy HP ÷ damage per turn so far, or deck estimate) > Sandpit left | Play every **cost-1** Frantic Escape drawn, first in the turn. Play a cost-2 one when Sandpit ≤ 2. Value +1 Sandpit at about one turn of damage × the enemy-HP weight. | [several] "always play" (slashskill) vs "only when low" (companion); [inference] resolution |
| 5 | The Insatiable, and the estimated kill fits within the Sandpit left | Skip Escapes and put all energy into damage | [several] companion, gamerblurb, Untapped snippet |
| 6 | Any exhaust effect (Second Wind, Fiend Fire, Stoke, Burning Pact, True Grit, Brand, Cinder) while a Frantic Escape is in hand | Play the Escape(s) first, or never choose an Escape as the exhaust target | [several] wiki Frantic Escape note, slashskill, PLAN.md fix |
| 7 | A death to Sandpit | Score it as a **real death**, even with Lizard Tail unused or Fairy in a Bottle held. The PLAN.md "revival" scoring must not apply here. | [several] wiki (v0.73, v0.103.2), Steam |
| 8 | The enemy's intent has no attack (Insatiable P1/P4/P8, Vantom Prepare, Aeonglass Increasing Intensity, Test Subject Respawn / Burning Growl, sleeping Lagavulin) | Block has zero value this turn: spend everything on damage and Powers. Count a Power at gain × (average fight length − turn). | [several] "attack on their off-turns" (Untapped, keengamer); [inference] valuation |
| 9 | Vantom with Slippery > 0 | Credit each damage instance with the average single-hit damage of the deck (about 7), not 1. Order: multi-hits and 0–1 cost hits first; big single hits only after the stacks reach 0 | [several] PC Gamer snippet, games.gg, sts2front, keengamer |
| 10 | Vantom with Slippery > 0, and the cards in hand can remove every remaining stack this turn | Apply Vulnerable (Bash) *after* the last stack falls, then the big hits. Otherwise hold Bash's damage. | [inference] |
| 11 | Vantom: Dismember turn (every 4th, starting turn 3) | Block toward 30+Str. Use Weak or a block potion here, not earlier. | [several] |
| 12 | Byrdonis | Race: Vulnerable on turn 1, damage potions early, and Weak (Uppercut) on Peck turns from the 2nd Peck on | [several] Steam, search guides; [inference] Weak |
| 13 | Queen, turns P1–P2 (no Weak, no Queen Block) | Maximise damage into the chosen target. Take P1's 32 only if HP allows; P1 is the last un-Frail block turn. | [inference] from the script (wiki v0.109) |
| 14 | Queen: post-Weak damage per turn D ≥ about 40 (or damage over the next 4 turns ≥ Queen HP + 20 × turns after P3) | Target the **Queen** (her death ends the fight). If D is about 30 or less, kill the Amalgam first. Recheck every turn. | [several] Steam "burst → Queen, else minion"; Minion text |
| 15 | Queen: Bound cards in hand | Play the draw cards first (later draws aren't Bound), then the single highest-value Bound card. Don't count Bound statuses as a lost play. | [several] Steam ×3; wiki v0.90 |
| 16 | Queen, from P3 on | Model incoming ×1.5, your attacks ×0.75, and card block ×0.75. Prefer Frail-proof block (Feel No Pain, Crimson Mantle, Rage, Plating). Colossus doesn't help (it reads enemy Vulnerable). | [several] / [one] Jorbs via STRATEGY-research |
| 17 | Test Subject phase 1 | Penalise each Skill by 3 × the number of phase-1 enemy attacks left; prefer attacks and Powers | [several] |
| 18 | Test Subject: the turn a phase dies | Remaining block is worthless, because the next move is Respawn. Play Powers and draw, no debuffs, and no further attacks (it can't be targeted). | [several] "stunned between phases"; [inference] use |
| 19 | Test Subject phase 2 | Value each unblocked hit at the HP lost + 1 Wound (about 3 HP each). Block fully before dealing damage. | [several] |
| 20 | Test Subject phase 3, Intangible up | Block and Powers; apply Vulnerable for next turn. Dump damage on tangible turns, above all a tangible turn with Growl intent. | [several] + [inference] timing table §2.3 |
| 21 | Aeonglass has Artifact > 0 and a key debuff is in hand | Spend the cheapest debuffs first (Thunderclap, Taunt) | [several] |
| 22 | Aeonglass: the card counter is at 5 of 6 and no exhaust is in hand | Play the 6th card only if it's worth more than the Wither's end-of-turn damage | [several] + [inference] |
| 23 | Aeonglass: the turn after Ebb (33 enemy Block) | Prefer block, Powers and Artifact stripping; save burst for the Increasing Intensity turn | [inference] |
| 24 | Kaiser Crab | End the turn facing (last-targeting) the claw with the larger attack. Deal the killing blow on the first claw as the last damage of the turn. | [several] facing; [inference] Crab Rage timing |
| 25 | Waterfall Giant: lethal is available | Take it only if next turn's block (and Weak) can cover the Steam stacks; otherwise build block first | [several] / [one] |

---

## 5. Where this contradicts or extends the bot's current assumptions

1. **The Insatiable's A10 HP is 341**, not about 300–330 (A8+ value). `[several]`
2. **A Sandpit death isn't revivable.** Lizard Tail has been blocked since v0.73 and Fairy in a Bottle doesn't apply, so the "death with Lizard Tail unused = revival" scoring is wrong for this fight. `[several]`
3. **The Insatiable loop has two Thrashes in a row** (turns 5–6, 9–10). Its Bites land on turns 3, 7 and 11. `[several]`
4. **Torch Head Amalgam, beta v0.108–0.109:** it opens with Strong Tackle 32, then Tackle 22, and its Weak Tackles hit 16. `A10-reference.md` still lists the main-branch 18/19 and 14/15. `[one]` (wiki update history)
5. The flat **HP-lost ×1** is too high in the Act 1 and 2 boss fights (80% heal afterwards) and on floor 49 (no future). It is probably why the bot blocked Vantom for five turns. `[several]` facts, `[inference]` cause
6. **Smaller beta deltas the codex lacks:**
   - Soul Fysh De-Gas 18 at A9 (v0.111).
   - Aeonglass Ebb 22(26) (v0.109).
   - Crab Rage's Strength: 5 per Untapped, 6 per the wiki.
   - Trust the game's intents.
