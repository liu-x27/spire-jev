The fastest route to clears is to keep the one-turn search and fix what it rewards, what the rules buy and remove, and when potions are used. Several confirmed bugs undermine otherwise sensible decisions. Increasing search depth should come later.

This review covers the supplied logs and current code through `55c8a31`, which appeared during the review. I ran read-only aggregations and direct checks of pure functions; I changed no files and ran no new game evaluations. Seed references below mean `JEV000xx`.

**First, correct the interpretation of the data.**

| Result | A0 | A10 |
|---|---:|---:|
| Runs | 45 | 45 |
| Mean last fight floor | 29.7 | 15.6 |
| Reached / defeated Vantom | 43 / 38 | 21 / 11 |
| Reached / defeated The Insatiable | 21 / 10 | 5 / 0 |
| Reached / defeated Queen | 2 / 0 | 0 / 0 |
| Deaths in acts 1 / 2 / 3 | 7 / 28 / 9 | 34 / 11 / 0 |
| Other termination | 1 | 0 |

The digest’s “past floor 17” counts `floor >= 17`, including deaths at Vantom. **Eleven A10 runs cleared act 1, not 21.** Its “potions left” column is also mislabeled: `FightLog.potions` records inventory **at fight entry**. Among starting potion entries in fatal fights, 72/73 at A0 and 66/66 at A10 have a matching recorded use; the A0 exception is automatic Fairy in a Bottle. These logs do not establish widespread death with unused potions. They also count attempted potion actions without explicitly confirming consumption. [Digest implementation](D:/CODE/spire-jev/planner/src/digest.ts:37), [fight logging](D:/CODE/spire-jev/planner/src/run-fights.ts:243).

The final deck column is a pre-action room snapshot, not necessarily the deck entering the fatal fight. For example, A10 seed 33 selected Uppercut on floor 7, but its digest deck omits that last reward. Treat those lists as approximate unless checked against subsequent actions.

**Diagnosis, ranked by observed deaths.**

The counts below identify the largest failure groups, not counterfactual estimates of how many clears a fix would produce. Causes overlap.

| Fatal encounter | A0 deaths | A10 deaths | Main implicated problems |
|---|---:|---:|---|
| Byrdonis | 0 | 17 | Insufficient early damage, attrition, late potion use |
| The Insatiable | 11 | 5 | Insufficient sustained damage/block, engine underuse, Sandpit |
| Vantom | 5 | 10 | Slow kills, Wound accumulation, potion timing |
| Decimillipede | 4 | 3 | Entry HP, distributed damage, revival deadline |
| Entomancer | 4 | 0 | Attrition and hit-generated deck pollution |
| Queen + Torch Head | 2 | 0 | Target switching, weak defensive engine, entry HP |

These six encounters account for **59 of 89 combat deaths**. At A0, act 2 is the immediate bottleneck; at A10, act 1 prevents most decks from developing. [A0 deaths](D:/CODE/spire-jev/planner/runs/digest-crules5.md:6), [A10 deaths](D:/CODE/spire-jev/planner/runs/digest-a10r1.md:6).

**1. A10’s early damage race is failing before HP thresholds alone can save it.**

Byrdonis goes from **37/37 wins, 28.9 average HP lost at A0**, to **19/36 wins, 44.0 HP lost at A10**. Average logged end turns increase from 4.1 to 5.1. Eleven of the 17 fatal A10 fights finish with Byrdonis at **15 HP or less**.

Some entries are clearly too weak: seeds 27, 29 and 35 enter with 12, 21 and 21 HP. But seed 33 enters at **86/87 HP**, lasts nine turns and dies with Byrdonis at 6 HP. Seed 34 enters at 72 HP and also dies. Avoidance helps; HP alone is not a readiness test.

The reward rule implements “damage first” as only **+0.1**, which can lose to support-card ratings. A10 seed 7 takes Taunt on floors 1 and 2, Colossus over Anger on floor 4, and another Taunt over Sword Boomerang on floor 5. The new duplicate penalty addresses part of this sequence, but it does not make filling the first damage slots a priority.

A10 adds stronger enemies, an opening-hand curse, fewer resources and more elite nodes. Those changes magnify a slow first deck cycle. This is consistent with Inklet fights rising from roughly **11 to 22 HP lost**, before reaching the elite. The applicable changes are documented in [A10-reference §4](D:/CODE/spire-jev/docs/A10-reference.md:391).

**2. The Insatiable exposes decks that can play a good turn but cannot sustain a fight.**

At A0 it kills **11/21 entrants**, despite average entry HP of 68; at A10 it kills **all five entrants**, including seeds 9 and 45 starting at **87/87 and 94/94**. More resting cannot solve those full-health losses.

Separate two mechanisms:

- **Sandpit:** four A0 fatal states have Sandpit 1: seeds 4, 7, 16 and 40. Seeds 16 and 40 die with **40 and 37 player HP**, while the boss has **70 and 28 HP**. These are unmistakable deadline failures.
- **Ordinary damage:** all five A10 deaths occur with Sandpit still at **2–5**. Their immediate problem is surviving attacks while dealing enough damage, not failing to press Frantic Escape.

The current Sandpit term already exists; “add Sandpit awareness” would be redundant. Its damage-paced estimate is incomplete: it does not value preserving access to Escapes or account reliably for energy, exhaustion and draw restrictions. A0 seed 40 reaches a 28-HP boss but dies after exhausting nine cards and cycling into no usable Escape. A10 seed 9 plays twelve Angers, ends with 40 cards in discard, and dies with the boss at 34 HP. [Representative traces](D:/CODE/spire-jev/planner/runs/digest-crules5.md:120), [A10 seed 9](D:/CODE/spire-jev/planner/runs/digest-a10r1.md:134).

**3. Vantom remains too expensive, particularly at A10.**

Vantom wins are **38/43 at A0 versus 11/21 at A10**; average HP lost rises from **43 to 52.6**, while average entry HP falls from approximately 78 to 66.

Four of five A0 losses leave Vantom at only **14–23 HP**. At A10, seven of ten deaths occur on Dismember turns, identifiable from the fatal attack/status intent. Seeds 1, 20, 40, 41 and 44 finish with Vantom at 15–33 HP.

Slippery already has an explicit score in `evaluate`; recommending that feature again would miss the remaining problems:

- The deck-building multi-hit check is only a small bonus, and omits conditional Dismantle.
- Flame Barrier and player Thorns are not credited for their ensuing damage or Slippery removal.
- Wounds dilute decks that have lost useful exhaust cards or do not deploy their engines.
- Temporary defensive potions can be forced on turn 1 instead of Dismember.

A0 seed 2 spends Speed Potion on turn 1 and finishes with **33 block against a 7-damage attack**, then loses 14 HP on turn 3. That is a timing problem, not potion hoarding.

**Combat decisions: accurate prediction is being scored incorrectly.**

The most direct objective bug is in [search.ts `evaluate`](D:/CODE/spire-jev/planner/src/search.ts:181): the normal score charges `hpLoss(s)`, meaning damage **after ending the turn**, but does not charge HP already spent during simulated card plays. Player HP matters principally at the lethal boundary and on victory.

A direct check gives identical scores for otherwise identical safe states with **70 HP and 10 HP**. Thus Offering, Hemokinesis, Corrupted cards and attacks into Thorns can spend HP without the normal HP penalty.

This has substantial exposure. At A0, **1,262 of 12,794 logged HP loss** occurs outside positive end-turn losses. That is not all avoidable, but it is approximately 10% of recorded damage lying outside the ordinary score term. Seed 6 loses 51 HP to Spiny Toad on floor 25, including **26 outside end turns**, then dies to Chompers on floor 28 after entering with 9 HP.

There is a second objective mismatch: **the picker values persistent powers, while the planner often assigns their future benefit zero value**.

In A0 fights where an end-turn hand explicitly contains the card:

| Card | Such fights | No recorded play of that card during the fight |
|---|---:|---:|
| Crimson Mantle | 58 | 57 |
| Feel No Pain | 65 | 60 |
| Vicious | 66 | 57 |
| Dark Embrace | 14 | 12 |

These are exposure counts, not proof that every omitted play was affordable or correct. Nevertheless, the code explains the pattern: future-only benefits do not improve the score; Crimson Mantle can make it worse through its modeled self-damage. A0 seed 4 repeatedly carries Mantle through the Insatiable fight without deploying it.

The simulator also lacks some relevant engine triggers: `exhaustCard` grants FNP block but does not trigger Dark Embrace draw; Rupture is installed but its self-damage trigger is absent. Increasing engine picks must be paired with making those engines executable.

Search capacity is not the immediate bottleneck. There were **zero logged illegal actions**, only **8/1 truncated searches** at A0/A10, and planning p95 was approximately **1.84/0.98 ms**. End-turn prediction matched on **3,143/3,214 A0 turns and 1,850/1,855 A10 turns**. That is strong coverage of selected actions, not validation of unplayed powers, alternative sequences or future boss phases.

**Deck building: the bot buys throughput, duplicates support, and sometimes pays to destroy its engine.**

Two confirmed removal bugs are especially damaging:

- `worstCard` uses an unanchored status regex containing `BURN`, which matches **BURNING_PACT**.
- It reuses acquisition value for retention. When two Trembles exist, `cardValue` returns `-1` to reject a third; `worstCard` converts this into **−20**, making an existing Tremble worse than starters—and even worse than its curse score.

The logs contain **9 Burning Pact + 7 Tremble paid removals at A0**, and **4 + 4 at A10**: **16/67 and 8/31 purchases**, respectively. A0 seed 3, floor 8, removes Burning Pact while all five Strikes and four Defends remain; A10 seed 14 removes Pact on floor 14 and later dies to Vantom with a Wound-only fatal hand. Both behaviors remain reproducible in current code. [Removal rules](D:/CODE/spire-jev/planner/src/choices.ts:180).

Reward selection also lacks meaningful package evaluation:

- A0 takes **468/472 act 1 rewards: 99.2%**. A10 takes **329/333: 98.8%**. The research’s approximate sanity check is 85%.
- A0 act 2 takes **164/263: 62.4%**, already close to the research’s rough 60%. A blanket increase in act 2 skipping would target the wrong problem.
- A0 seed 9 reaches the Insatiable with five Pommel Strikes and four Taunts, but passed Vicious for another Pommel Strike on floor 24.
- Dark Embrace and Demon Form default to **0.3**, below either late-act skip threshold. A0 seed 12 skips a floor-33 reward containing **Cascade, Demon Form and Dark Embrace**.
- Body Slam is taken **0/83 offers**, Barricade **0/17**, Dark Embrace **1/12**. This does not mean every offer deserved a pick; it demonstrates that those packages are effectively inaccessible to the rules.

Likewise, counting three “block cards” is not equivalent to having three dependable defenses. Colossus requires Vulnerable; Evil Eye and Second Wind depend on exhaust context. Removing Defends based on an unconditional count can leave fragile hands.

**Pathing and HP management: many fatal encounters merely collect an earlier debt.**

Fourteen A0 deaths begin at **25 HP or less**, all outside boss fights. Examples include Mytes at 7 HP, Chompers at 9, Louse Progenitor at 11 and Knight Gang at 11. Six A10 deaths enter at 25 HP or less.

The current map rule has lookahead, so adding lookahead is not a new recommendation. Its weakness is the unit of measurement: it counts fights, treating a hallway and a dangerous elite as one each, then adds small distance bonuses. It does not budget likely HP expenditure along a feasible route.

The logs omit map decisions and reward screens entirely, so they cannot establish which dangerous encounters were avoidable. Record offered branches before attributing those deaths to a specific map choice.

Shop expenditure compounds the resource problem. A10 records **31 removals, eight card purchases, two relic purchases and no potion purchases**. Removal is expensive at A6+, yet the code keeps prioritizing it. `chooseShop` buys the cheapest affordable relic without assessing its effect; seed 13 reaches Queen with Brimstone and dies to an **11×5** attack. That supports reviewing the interaction, not declaring Brimstone universally bad.

**Rest and upgrades: largely an upstream HP problem, with one important fixed bug.**

The bot already rests aggressively:

- A0: **36/43** floor-16 campfires; **21/21** floor-32 campfires.
- A10: **21/21** floor-16 and **5/5** floor-32 campfires.

“Rest more before bosses” is therefore not a sufficient change. A10 seeds 6 and 32 reach floor 32 at **10 and 8 HP**; one rest gets them only to 36 and 28.

The old floor-48 preboss check did cause a concrete mistake: A0 seed 45 smiths at floor 47 with **56/114 HP**, then enters Queen at 58. Current `f5a3ca6` corrects the floor to 47; the same snapshot now rests, worth roughly **34 additional HP**, subject to subsequent changes.

Upgrade selection is mostly a fixed global order. It should distinguish an urgently needed Whirlwind upgrade before an elite from an unsupported mechanical upgrade. The Bash comment also says “only with no other Vulnerable source,” but the implementation checks only the act.

**Potions: improve timing and acquisition, not blanket consumption.**

`potionUrge` is described as handling unmodeled potions, but its candidate filter includes **all legal potion uses**. When search chooses a card instead, the override can consume a modeled potion that search deliberately withheld.

A0 seed 4 uses Block Potion on the Insatiable’s opening **Buff+StatusCard** turn, ending with 34 block and no incoming attack. Seed 2’s wasted Speed Potion against Vantom is another clear example.

The new elite-under-half-HP rule helps avoid terminal-only use of unmodeled potions, but it retains this indiscriminate override. Permanent buffs and regeneration are often better before losing half the health bar; temporary block, damage and draw need an appropriate hand or intent.

Outside combat, immediate Fruit Juice use and full-belt replacement are absent. Shops consider potions only in act 3 and use a hardcoded three-slot condition instead of `potion_slots`.

**Queen and the A10 second boss need explicit preparation.**

There are only two Queen observations, so conclusions are narrower:

- **Seed 13:** kills Torch Head by turn 4, but dies turn 5 with Queen at 292 HP. Targeting Torch Head was insufficient; the deck still lacked sustainable defense against Queen, worsened by Brimstone.
- **Seed 45:** damages Torch Head initially, bursts Queen from 394 to 180 on turn 3, then returns to Torch Head. Queen remains at 174 from turn 4 through death, while Torch Head finishes at 28. The split damage never removes either threat. [Both Queen traces](D:/CODE/spire-jev/planner/runs/digest-crules5.md:153).

No A10 run reaches either act 3 boss. Any claim of demonstrated readiness for the second boss would be unsupported. Current simulation also has no explicit Bound allowance within a simulated sequence or Test Subject phase-transition handling. Replanning can mask some inaccuracies; it cannot make a false terminal-win evaluation valid.

A10 preparation must cover two separate fights, resetting powers, with no intervening rest. Use the current A10 reference for Enrage **3** and beta Aeonglass numbers rather than copying older strategy figures. [Boss mechanics and ascensions](D:/CODE/spire-jev/docs/A10-reference.md:260).

**Changes already present will alter the baseline.**

- **Duplicate penalty, `0dce9b7`:** replaying current reward selection against the recorded offer/deck snapshots changes **72/773 A0 choices**, including 38 to skip; **29/392 A10 choices**, including 12 to skip. This is a static sensitivity check, not a projected run outcome. It should reduce duplicate support, but does not supply synergy evaluation or fix removal scoring.
- **Map lookahead, `fd63d7b`:** can redirect low-HP routes. Its actual benefit requires new runs because the old logs lack branch choices.
- **Floor-47 rest and Ascender’s Bane removal eligibility, `f5a3ca6`:** are already fixed. Neither fixes Burning Pact/Tremble removal.
- **Elite caution and potion use, `55c8a31`:** A1+ elite scores now favor near-full HP, and potions can be urged below half HP in elites. Assess this version before claiming new gains from “avoid elites” or “use elite potions.”
- **Fake merchant fix, `193a683`:** addresses that stall. It does not explain away the remaining stopped run: A0 seed 43’s last fight is floor 35, but its final room records repeatedly choose `BATTLEWORN_DUMMY` setting 1 on **floor 37**, at 109/112 HP. That is a separate unresolved transition/stall, not a combat death.

**The ten changes below are ordered by expected gain per implementation effort.** Expected effects are hypotheses; the data does not justify numerical clear-rate promises.

1. **Fix removal classification and separate “add” from “keep” value. — Very high gain / very low effort.**  
   In `choices.ts::worstCard`, replace substring classification with exact IDs or supplied card types. Use a separate retention score, or evaluate removal against a deck with that candidate excluded. Never feed the “third Tremble forbidden” sentinel into retention. Preserve upgrade/enchantment information when comparing otherwise identical cards.  
   **Evidence/effect:** corrects 24 observed paid selections across the two batches and preserves draw/exhaust while actually reducing starters.  
   **Measure:** zero Pact-as-Burn removals; inspect every paid removal; compare Vantom loss and status-heavy fight loss on shared encounters.

2. **Charge all HP expenditure in `evaluate`. — Very high gain / low effort.**  
   Replace the normal `-w.hpLoss * hpLoss(s)` term with `w.hpLoss * (s.player.hp - hpLoss(s))`, or the equivalent loss relative to the search root. Root HP is constant within one search. Check self-death before awarding victory. Give permanent max-HP loss a separate, small tested cost.  
   **Evidence/effect:** fixes the verified 70-HP/10-HP score equality, values healing, and makes Thorns/self-damage decisions honest.  
   **Measure:** Spiny Toad and self-damage-heavy shared fights first; total HP lost and wins together, ensuring the change does not simply suppress useful Offering plays.

3. **Restrict potion overrides and give unmodeled potions effect-specific triggers. — High gain / low–medium effort.**  
   In `run-fights.ts::potionUrge`, leave modeled tactical potions to search except genuine emergency fallback. Use permanent buffs/regeneration early in a difficult fight; use draw with hand space and playable resources; preserve temporary block for meaningful incoming damage. Apply the existing Slippery restriction to single-instance damage potions. Drink Fruit Juice outside combat and support belt replacement.  
   **Evidence/effect:** prevents the observed Block/Speed waste while moving useful elite buffs earlier than hopelessness or half HP.  
   **Measure:** log turn, intent, potion and inventory before/after; count potion-attributable excess block, Vantom turn-3 damage and Byrdonis survival.

4. **Make early deck deficits override marginal tier differences. — High A10 gain / low effort.**  
   In `chooseCardReward`, before generic ranking, fill two genuine nonstarter damage slots when a reasonable attack is offered; require approximately three effective attack sources before voluntarily taking an early elite. Retain the duplicate penalty. Add conditional Dismantle to Vantom hit coverage. Require a specific deficit or useful marginal contribution for further support copies.  
   **Evidence/effect:** addresses 17 Byrdonis deaths and approximately 99% act 1 take rates without prescribing blanket skipping.  
   **Measure:** first-elite damage coverage, Byrdonis turns/HP loss, act 1 completion; audit examples where the override passes a strong defensive card.

5. **Budget HP through the next recovery point, including shop and rest decisions. — High gain / medium effort.**  
   Extend `chooseMap` beyond unweighted fight counts: estimate route cost from encounter-class loss distributions, account for Burning Blood and known recovery, and penalize routes whose estimated cost plus a **10-HP starting buffer** exceeds available HP. Retain current elite caution, but add deck readiness. At shops, allow a relevant potion/card to beat removal when it changes the next difficult encounter; compare later A6+ removals against alternatives. Use the same budget in `chooseRest` and HP-cost events.  
   **Evidence/effect:** targets 20 low-entry-HP fatal fights and campfires that cannot recover accumulated losses.  
   **Measure:** log branches and route estimates; reduce deaths entered below 25 HP while monitoring relic count and later boss performance so avoidance does not merely postpone failure.

6. **Make persistent powers work, then assign a bounded setup value. — High A0 gain / medium effort.**  
   Add missing engine triggers in `sim.ts`, notably Dark Embrace on exhaust and Rupture on relevant HP loss. In `evaluate`, add **marginal** value for future useful block/damage/draw from deployed powers. An initial experiment can use a two-turn horizon, discount 0.7, and a capped bonus, subtracting self-damage and excluding effects already credited this turn. Zero the benefit when the fight is expected to end immediately.  
   **Evidence/effect:** turns frequently dead hand slots into functioning engines; especially relevant to Insatiable and Queen.  
   **Measure:** power deployment on safe turns, ensuing benefits, shared-fight HP loss and boss wins. Validate each trigger before changing its reward priority.

7. **Choose complete packages and useful relics instead of isolated ratings. — High gain / medium effort.**  
   Add explicit entries for missing engine cards in `cardValue`; apply conditional bonuses for FNP with at least three credible exhaust sources, Vicious with at least two reusable Vulnerable sources, and block payoffs with actual burst/sustained block. Score energy alongside draw. Replace cheapest-relic purchasing with effect-aware value; penalize Brimstone when multi-hit boss defense is inadequate. Count conditional defenses conditionally before removing Defends.  
   **Evidence/effect:** addresses inaccessible engines, repeated support without payoff, and blind relic purchases.  
   **Measure:** engine completion and deployment, boss fight length, repeat-cycle block, and gold spent per useful addition. Do not judge success by merely taking more rare cards.

8. **Plan the actual mid-fight card selection. — Medium–high gain / medium effort.**  
   Pass the originating card/potion into `combatSelect`. For True Grit+, Burning Pact and similar choices, evaluate each offered removal in the current hand; preserve necessary damage, defense, draw and Frantic Escape. For Headbutt/Liquid Memories, choose the useful recovery target rather than defaulting to the first offer. Handle discard multiplicity and upgrade choices explicitly. Match this selection policy inside the simulator.  
   **Evidence/effect:** current `FromHand` logic chooses junk or the last offer; several other purposes fall through to index 0. That undermines exact sequencing whenever a choice determines the result.  
   **Measure:** log origin, options and selection; inspect avoidable loss of Escapes/engines; compare exhaust-heavy shared fights.

9. **Extend exact local consequences before extending the search horizon. — Medium–high gain / medium effort.**  
   Add enemy-turn reflection/Thorns damage and resulting kills/Slippery removal. Represent relevant on-hit status generation and boss constraints, including Bound’s one-card allowance. Fix `actions`/`stateKey` identity to distinguish enchanted cards and mechanically distinct states. Remove hidden-order sensitivity from unknown draws.  
   **Evidence/effect:** makes Flame Barrier and targeted sequencing worth what they actually accomplish; avoids merging distinct cards or promising impossible sequences.  
   **Measure:** differential checks of enemy HP, powers and generated statuses, plus draw-pile permutation invariance and shared-fight HP loss. This is deterministic modeling work, not a generic future-damage heuristic.

10. **Add small boss-specific progress and resource checks. — High eventual clear value / higher effort.**  
    For Insatiable, track Escape availability, escalation in its energy cost and time to recycle; reserve sufficient access before the deadline rather than relying only on `hp / deckPace`. For Queen, choose Torch Head unless a conservative Queen kill plan is credible; resist switching merely because one target is temporarily Vulnerable. Preserve terminal-kill and immediate-survival exceptions. For A10, model Test Subject phase transitions and Aeonglass card-count/status consequences, and plan HP/potions across both bosses.  
    **Evidence/effect:** addresses four observed A0 Sandpit endings and the seed-45 split-target failure, while removing foreseeable blockers to A10 completion.  
    **Measure:** deadline deaths, time to first Queen-side kill, HP remaining after each boss, and actual floor-49 victories.

**Additional confirmed bugs and suspicious behavior to track.**

- **Hidden draw order affects an existing score despite unknown draws.** `takeFromDraw` pops a concrete hidden card; `deckPace` then evaluates the remaining cards. In a direct check with the same two-card draw multiset in reversed order, one unknown draw produced Slippery-state scores of **−72 versus −144.8**. The planner does not explicitly play the unseen card, but its estimate is order-sensitive. Use an order-independent representation/expectation. [Draw implementation](D:/CODE/spire-jev/planner/src/sim.ts:276).
- **Distinct cards are merged.** `actions` and `stateKey` use ID/upgrade/cost but omit enchantments and other differing card data. I verified an ordinary Strike and Corrupted Strike produce the same state key. Pile contents and `unmovableUsed` are also omitted despite affecting successors. [State key](D:/CODE/spire-jev/planner/src/sim.ts:858).
- **“All numeric variables understood” is not adequate potion validation.** `drinkable` accepts arbitrary `*Power` variables; that does not prove the resulting mechanics are modeled. Distilled Chaos appears in differential mismatches despite this classification.
- **Acquisition value is reused for upgrades/enchantments.** The new duplicate penalty can lower the apparent upgrade value of a card because several copies exist. Upgrade value should be the marginal improvement to that copy.
- **Generic selection semantics are too broad.** `FromDeckGeneric` always means “worst” and may select the maximum count. Confirm the originating operation rather than assuming every generic selection is removal.
- **Telemetry hides important failures.** Add actual terminal victory, final floor, exit/stall reason, final inventory/deck and action-level potion confirmation. Record map offers. Seed 43 demonstrates why “last won fight” is not a complete termination diagnosis.

Several rules also diverge from the research they cite: the two-source Vulnerable package is absent; late engine bonuses are absent; later removal purchases are not compared economically; Fruit Juice/full-belt rules are absent; and conditional block is treated as unconditional. Those are implementation gaps, not reasons to treat every research threshold as proven.

**How to test without repeating the `futureDamage` failure.**

Keep `future=0` for the baseline. Phase 1.4 already found that a whole-fight estimate improved tuning floors but gave **no held-out floor gain and 7–10% more shared-fight HP loss**. The proposed setup value is narrower: verified power effects, short horizon, bounded influence and an explicit ablation. Do not combine it with reward, pathing and potion changes in the first comparison. [Measured negative result](D:/CODE/spire-jev/docs/PLAN.md).

Freeze the reviewed revision and evaluate it first. From `planner/`:

```text
node src/eval.ts --tag review-base-a0 --choices rules --seeds 16-45 --sandboxes 4
node src/eval.ts --tag review-base-a10 --choices rules --ascension 10 --seeds 16-45 --sandboxes 4

node src/eval.ts --tag X-a0 --choices rules --seeds 16-45 --sandboxes 4
node src/eval.ts --tag X-a10 --choices rules --ascension 10 --seeds 16-45 --sandboxes 4

node src/compare.ts runs/eval-review-base-a0.json runs/eval-X-a0.json
node src/compare.ts runs/eval-review-base-a10.json runs/eval-X-a10.json
```

For every change, examine actual clears, boss reach **and conditional boss wins**, shared-fight HP lost, and the specific metric listed above. Report how many fights remain shared after path divergence. Shared fights can have different decks and entry HP; they are valuable comparisons, not identical-state counterfactuals.

Seeds 16–45 remain useful regression seeds, but this review has now inspected them. Reserve new seeds—such as **46–105**—for confirmation without further tuning. Reliable A10 performance also needs coverage beyond the single observed Vantom → Insatiable → Queen sequence.

For speed, track **successful clears per wall-clock hour**, combat turns and p95 planning time. Current search is already fast enough that reducing attrition and long fights is likely more valuable than shaving its sub-2-ms p95.

**An A10-clearing deck and run plan, expressed as checkable conditions.**

The target should be a deck with a working first cycle and repeatable output, not a fixed card count or mandatory rare-card list. The following are initial gates to validate:

| Stage | Checkable requirement |
|---|---|
| Before an optional act 1 elite | Approximately three effective attack sources, sufficient projected HP, and a useful potion when available |
| Before Vantom | Three cheap/multi-hit sources, dependable Vulnerable, a Dismember defense plan, and access to Wound removal/cycling |
| By mid-act 2 | One coherent engine: exhaust + payoff, Vulnerable + payoff, or sustained block + damage payoff |
| Engine support | At least two practical draw effects, usable energy support, and defenses whose conditions the deck can actually satisfy |
| Before Insatiable | Ability to block heavy turns while progressing damage; Escape access and energy included in the cycle estimate |
| Before Queen | Draw beyond the Bound cards, repeatable Frail-resistant block, and a clear initial target |
| Before A10 floor 48 | Both visible bosses considered; high entry HP, relevant consumables, and sufficient permanent deck strength to set up again on floor 49 |

A practical common/uncommon foundation is early efficient attacks and one AoE, followed by Pommel Strike+/Shrug It Off, targeted exhaust, Vulnerable support and either FNP or Vicious when supported. Add energy when draw is constrained by energy. Add further support only when it increases actual throughput or fills a defensive gap. Retain enough attacks and reusable block after Fiend Fire/Stoke/Second Wind; do not exhaust the means of finishing the fight.

For the first A0 clear, the immediate sequence is **removal correctness → full HP accounting → potion timing → usable engines**, while retaining the corrected floor-47 rest. For reliable A10 clears, add **early damage readiness and route budgeting**, then validate both act 3 boss fights as a resource sequence.