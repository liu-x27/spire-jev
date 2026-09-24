Your diagnosis is directionally right: **insufficient sustained deck output is the main act-2 problem.** But “combat evaluation is solved” and “remove more basics” do not follow. The bot still fails to deploy engines, while removals already dominate shop spending.

I read the first review and ran only read-only analyses. `eval-conf1-a10.json` was absent at my final check; the deck research was still being populated.

Two corrections materially change the evidence:

- **Insatiable is not literally unbeaten.** Available A10 files contain **2/96 wins across 16 distinct seeds**: seed 31 in `restbudget` and `combolook`, finishing at **8 and 9 HP**, then dying in act 3. These correlated attempts do not establish reliability. [Restbudget log](D:/CODE/spire-jev/planner/runs/eval-restbudget-a10.json), [lookahead log](D:/CODE/spire-jev/planner/runs/eval-combolook-a10.json).
- **The scaling correlation leaks the outcome.** `stages.ts` selects the last room at `floor <= bossFloor`, including the map screen **after taking the boss reward**. Using pre-boss snapshots changes combination Vantom results from **10/11 versus 7/17** to **4/5 with scaling versus 13/23 without**. Packages changes to **5/6 versus 12/20**. Scaling remains plausible, but the headline evidence was substantially inflated. [Faulty snapshot selection](D:/CODE/spire-jev/planner/src/stages.ts:45).

The combination’s failures break down as follows:

| Stage | Result | Interpretation |
|---|---:|---|
| Before Vantom | 2/30 die | Path/HP improvements worked |
| Vantom | 11/28 die | Still a major deck/combat bottleneck |
| Act 2 before boss | 10/17 die | Attrition remains substantial |
| Insatiable | 7/7 die | Neither damage nor defense lasts sufficiently |

Vantom entrants average **82 HP, 94% of maximum**; losers average **77 HP**. More healing alone has little headroom. Winners average **8.6 turns**, losers **10.2**; seven of seventeen wins are narrow. Before Vantom, decks average **18.5 cards with 8.1 Strikes/Defends**. The bot takes **219/221 pre-boss rewards**. It has solved reaching the boss much better than beating it efficiently. [Combination log](D:/CODE/spire-jev/planner/runs/eval-combo-a10.json).

Act-2 nonboss fights cost **24 HP on average**, versus 14 before Vantom. Five of the ten intervening deaths involve Bowlbug groups; three enter their fatal fight at ≤25 HP. AoE, repeatable defense and recovery still matter alongside single-target boss damage.

Insatiable entrants average **74 HP**, **21.1 cards**, and **6.7 basics**. All seven die with **Sandpit 2–6**: these are HP deaths, not timer deaths. Final pre-enemy snapshots account for **1,440 damage over 48 turns: 30 per turn**, leaving **74–201 boss HP**. Seven-turn damage requires approximately **49 per turn**, while also funding defense and Escapes.

Seed 17 illustrates both weaknesses. Its successive boss-HP reductions are **7, 31, 23, 24, 45, 10**; end-turn HP losses are **0, 15, 27, 0, 22, 5**. Feel No Pain remains unplayed, appearing in the ending hand on turns 1 and 6. Seed 21 survives ten turns but leaves **135 HP**: extending survival without sufficient damage is also inadequate. Packages seed 34 reaches **35 boss HP**, but dies with Sandpit 1 and only 5 player HP—both constraints bind.

The offered cards distinguish scarcity from bad selection. In combination rewards:

- Demon Form appears once; Inferno, Cruelty and Dominate never appear.
- Inflame is taken **0/6**, Ashen Strike **3/6**, Feel No Pain **5/11**, Vicious **6/11**.
- Pommel Strike is taken **34/38**, Taunt **23/34**, Anger **19/28**.

A strategy requiring a particular rare is therefore unrealistic. However, shops offer **eight affordable Inflames**, all declined. Seed 35 buys a **150-gold removal**, then leaves with **64 gold** while Inflame costs **38**. Across the combination, removals consume **3,800/5,826 gold spent—65%**. Basics persist despite aggressive removal spending, not because removal is ignored.

Packages increases floor-33 deck size to **23.1**, versus 21.1, without winning. Its profile calls **8/9 decks “scaling”**; that clearly is not an adequate readiness criterion. Newly available research also contains winning decks retaining seven or eight basics. Those selected examples cannot establish optimal composition, but they refute treating “still has basics” as sufficient diagnosis. [Deck research](D:/CODE/spire-jev/docs/a10-decks-research.md).

**The executable strategy should prioritize a functioning first cycle and a stronger second cycle.**

Act 1: retain DP pathing and conservative recovery. Initially acquire **two or three efficient attacks**, including cheap/multiple hits; obtain one useful AoE before optional elite exposure. Once those jobs are filled, stop automatically adding another Anger, Taunt or marginal attack. Take an immediately supported engine component when offered, including before Vantom; do not require “act 2” first. Seek repeatable Vulnerable, Dismember defense, and cycling/exhaust against Wounds.

Upgrade the card that changes the next important fight: Pommel+ for actual net draw, True Grit+ for controlled exhaustion, Uppercut+ for debuff coverage, or the deck’s principal damage source. Rest when needed for route survival; otherwise compare the specific upgrade against the heal, rather than assigning every upgrade the same worth.

Act 2: the most draftable foundation is **Vulnerable + draw/energy + selective exhaust**, with two realistic damage branches:

- **Strength/multiple hits:** Inflame or supported Rupture; Fight Me only when the added enemy Strength is affordable. Add Vicious, Pommel+, Bloodletting/Forgotten Ritual as offered.
- **Exhaust damage:** Burning Pact/True Grit+/Second Wind with Ashen Strike, adding Feel No Pain and stronger exhaust tools when available.

These can overlap. Rupture requires repeatable self-damage; Body Slam requires actual surplus block. Barricade, Demon Form and rare engines are opportunities, not mandatory destinations.

Stop adding redundant frontload once throughput is the deficit. Remove or transform basics opportunistically, and exhaust them during combat while preserving finishing damage and Escapes. Assess **cumulative damage by turn 7–8**, block on attack turns, and energy spent on Escapes—not a binary scaling count. Seven turns is a benchmark, not a hard deadline; a slower engine is acceptable only with demonstrated survival.

Act 3 preparation remains unvalidated. Build repeatable defense and status clearance, then reserve resources for **both bosses, resetting powers between them**. Queen needs a consistent target and Bound-aware draw; Test Subject needs phase-aware planning; Aeonglass needs Artifact stripping and Wither handling. Floor 48 must leave enough HP/potions to set up again on 49. Use the documented mechanics as test requirements, not as evidence the bot already handles them. [Combat research](D:/CODE/spire-jev/docs/a10-combat-research.md).

The changes below are ranked by expected strategic impact; **repair telemetry before measuring any of them**.

1. **Replace package counts with marginal, executable deck contributions.** In [`packages.ts::profile/packageBonus`](D:/CODE/spire-jev/planner/src/packages.ts:62) and [`choices.ts::cardValue/chooseCardReward`](D:/CODE/spire-jev/planner/src/choices.ts:172), separately track damage, defense, net draw, energy and repeatable triggers. Bloodletting is incorrectly classified as **draw** despite its logged variables being HP loss and energy; Shrug is omitted. Defensive “scaling” currently suppresses damage acquisition. Packages selects Rupture on seed 25, floor 30, with **zero self-damage sources**, because multiple-hit synergy raises its score. Require support before rewarding conditional payoffs. Expected effect: more usable second-cycle output and fewer dead additions. Measure boss cumulative damage, deployment and unconditional act-2 completion.

2. **Allocate shop gold across purchases instead of removal-first thresholds.** In [`chooseShop`](D:/CODE/spire-jev/planner/src/choices.ts:310), compare affordable card/potion/removal combinations against current deficits. Permit supported damage or energy to beat removal; permit relevant potions before act 3. Do not blindly raise Inflame’s tier—the eight missed offers justify contextual evaluation. Expected effect: improved floor-33 damage and survival with the same economy. Audit seeds **17, 34, 35, 42**, spending and remaining gold.

3. **Make acquired engines execute.** In [`search.ts::evaluate/setupValue`](D:/CODE/spire-jev/planner/src/search.ts:220), replace generic trigger-rate guesses with bounded value from the actual deck and boss schedule. Default `setup=0` still leaves future-only powers undervalued. Across combination fights where they remain in an ending hand, FNP is never played in **14/17**, Vicious **25/32**, Mantle **9/11**. These are exposure signals, not proof every omission was wrong. Verify supported setup turns and ensuing benefit, particularly seeds **17 and 21**. Fix `run-fights.ts::combatSelect` and matching simulator selections before relying on precise exhaust/recovery engines.

4. **Make path/rest/upgrade decisions share deck readiness.** [`path.ts::planPath`](D:/CODE/spire-jev/planner/src/path.ts) receives no deck; consequently DP bypasses the attack-readiness restriction in `chooseMap`. `chooseRest` uses average attrition while DP assumes optimal future rest choices. `chooseUpgrade` ranks Body Slam above everything regardless of support; its fallback reuses acquisition value. Pass specific upgrade value and deck-conditioned risk into both policies. Expected effect: fewer act-2 hallway deaths without sacrificing Vantom reach.

Additional correctness work matters. `worstCard` still counts conditional block as dependable defense. Reward scoring ignores offered upgrades, and bridge deck IDs omit upgrade information. `safetyMargin` projects gross incoming damage without block and often saturates at maximum HP, making `stakes` inert; its weak result does not disprove differentiated HP value. The earlier Burning Pact removal and missing exhaust/Rupture-trigger bugs are fixed. Preserve those fixes.

**Testing should stop treating reused seeds as fresh evidence.** Thirty paired seeds are useful screening, but repeated tuning on 16–45 makes them a development set. Use them for regression, with seed 31’s two narrow wins retained. Freeze code, flags and adoption criteria before confirmation.

Run both baseline and candidate on **46–135** for paired confirmation; a candidate-only batch estimates performance but not improvement. If those seeds inform tuning, reserve **136–225** next. Compare unconditional boss completions per started run, conditional boss wins, actual floor-49 victories, and HP/potion margins. Bootstrap differences **by seed**, not fight. Report paired encounter coverage; shared-fight HP is secondary and survivor-conditioned.

Fix `stages.ts` to log true entering decks and actual revival events—`hpLost > hpStart` also detects ordinary healing. Extend `compare.ts` to report these metrics. Adopt substantial, repeatable gains on unseen seeds without stage regressions, not +0.3 mean floors or one surviving seed.

Do not spend the next cycle on broader lookahead, another global weight sweep, matching human pick percentages, or mandatory rare archetypes. Establish useful acquisition, execution and trustworthy measurement first.