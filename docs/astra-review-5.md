**Keep s3f as the reference policy. Spar4 is unproven overall, with a credible act-1 regression; calling it neutral would overstate the evidence.** Card fidelity helped, but no configuration approaches dependable clearing.

I read review 4 first, then the requested PLAN section. Work remained read-only; no game or prohibited evaluator was launched.

All columns below represent the same **270 starts**. Boss cells show wins/entrants; other death counts exclude error endings. Sources: [run logs](../planner/runs), [reach.ts](../planner/src/reach.ts), [stages.ts](../planner/src/stages.ts).

| Outcome | hunt3 | s3 | s3f | s4g |
|---|---:|---:|---:|---:|
| Act-1 preboss deaths | 26 | 19 | 17 | 18 |
| Act-1 boss | 144/244 | 167/250 | 188/252 | 174/251 |
| Act-2 preboss deaths | 73 | 80 | 88 | 73 |
| Act-2 boss | 17/71 | 20/85 | 31/97 | 34/96 |
| Act-3 preboss deaths | 9 | 8 | 17 | 17 |
| First act-3 boss | 1/8 | 1/11 | 2/12 | 0/16 |
| Second boss | 0/1 | 0/1 | 0/2 | — |
| Error endings | 0 | 4 | 6 | 7 |

Thus act-1 completions/start are **53.3%, 61.9%, 69.6%, 64.4%**; act-2 completions/start are **6.3%, 7.4%, 11.5%, 12.6%**. Conditional act-2 boss rates are 24%, 24%, 32%, 35%.

The paired evidence:

- **hunt3→s3:** act 1 **+47/−24**, exact McNemar *p*=.009; act 2 **+15/−12**, *p*=.701.
- **s3→s3f:** act 1 **+40/−19**, *p*=.009; act 2 **+22/−11**, *p*=.080. Strong within-sample act-1 evidence; promising, inconclusive act-2 evidence. These rules also affect live combat, so this does not isolate better acquisition.
- **s3f→s4g:** act 1 **+23/−37**, *p*=.092; act 2 **+19/−16**, *p*=.736. Approximate paired 95% intervals are **−10.8 to +0.4 percentage points** and **−3.2 to +5.4 points**, respectively.
- First-boss winners change **712→722→681/708→none**. Under s4g, 681 loses at floor 33; 708 reaches but loses floor 48. The s3f successes leave only **11 and 22 HP**.

Censoring does not explain the act-1 findings. Errors occur in acts 1/2/3 as **1/2/1**, **1/3/2**, **1/5/1** for s3/s3f/s4g. Removing pairs unresolved at each milestone leaves s3→s3f discordance unchanged; s3f→s4g becomes **23/36** and **19/15**. This is sensitivity analysis, not unbiased correction. Seed **663** even has a logged combat loss before its error ending; preserve that distinction. `reach.ts` reports observed completion and counts errors separately—it cannot establish their eventual outcomes.

**Spar4’s components need separation.** In [choices.ts](../planner/src/choices.ts):

- **Rest is the strongest suspect.** Floor-16 heals fall **157/252→112/251**; boss-entry HP falls **91%→87%**. `chooseRest()` optimizes damage/wins without remaining HP and smiths ties. Removing the HP-loss penalty fixes one bias but leaves another.
- **Upgrade selection changes materially:** Bash **10→77**, Cinder **2→63**, Pommel Strike **63→26**, Battle Trance **24→8** across logged upgrades. These are diagnostics, not proof those upgrades are wrong. `sparUpgrade()` chooses the rest-site candidate at current HP, while the later selection normally evaluates at full HP; unknown upgraded offers can also trigger a different rules choice.
- **Removal is not “every legal removal.”** `removals()` restricts candidates to basics/junk. Act-1 removal attempts rise **36→103**, yet act-2 entrants still hold **7.1 basics** in both arms.
- **Shop fallback suppression is logically consistent, empirically unvalidated.** Act-1 card-buy actions fall **504→367**, act-2 **233→149**; act-2 draw≥2 falls **27%→19%**. `chooseShop()` still compares raw gain without pricing bundles or saving gold. Relics/potions remain separate heuristics.

Moreover, s4g’s act-2 wins are less healthy: **9 clean, 21 narrow, 4 revived**, versus **11/18/2**. Neither the Crab’s **6/31→11/30** nor shared-fight HP −1% establishes a better run policy.

Ranked adjustments:

1. **Separate and repair spar4 before adopting it.** Highest-confidence opportunity to recover the observed act-1 loss; downstream effect unknown. Split rest, upgrades, removal selection, and shop rejection into independent flags. Start with **s4g minus simulated rest**, restoring the existing 85% preboss rule. Carry the exact scored upgrade into selection, with matching HP/objective and explicit unsupported-content fallback.

   Screen each component on **586–675, 90 paired development starts**, using identical Staging10/fidelity versions. Require the selected action actually matches the scored action. Advance one candidate; these screens cannot certify small gains.

2. **Change the acquisition objective, not merely its horizon.** Highest plausible act-2 upside. In [spar.ts](../planner/src/spar.ts), `sparScore()` still values eight-turn damage, and `bout()` remains potionless. A dead deck dealing 60 extra damage can offset the entire win bonus. More shuffles make that objective more precise, not more appropriate.

   Return separate victory/death/timeout results. Screen at **32 shuffles**, extend survivors to **20 turns**, and validate finalists on **128 independent shuffles**. Compare victory probability first, then remaining HP/resources; use normalized unresolved enemy burden when wins are absent. Replace the five-point threshold with uncertainty on paired outcome differences.

   Add act-2 encounter probes alongside the known boss: early damage/AoE for Prism, low-hit damage and exhaust/draw for Entomancer, sustained defense and accessible scaling for bosses. Test specific draw-plus-energy or exhaust-plus-payoff additions; avoid blanket card-count quotas.

   Use **all 104 seed-distinct f32 saves**, including losing decks, with three boss swaps and **four repeats per condition**, clustered by source deck. These test combat/rest and controlled substitutions; they cannot validate earlier acquisition decisions by themselves.

3. **Price act-2 route risk and target combat bottlenecks.** Moderate plausible gain. S3f loses **88 starts before the boss and 66 at it**. Prism kills **10/19**, Entomancer **16/36**, despite mean entry HP around **61%/67%**.

   [path.ts](../planner/src/path.ts)’s `planPath()` uses act-2 average loss **18.63**, elite loss **50.3**, fixed relic value **18**, upgrade **6**, and gold-only shop values. Its optional elite-death floor is **off in these arms**. Screen enabling the act-2 **30% floor, doubled below 60% HP**, while replacing generic boss value with deck-specific survival estimates. Track gold consumption so successive shops do not repeatedly value the same purchasing budget.

   Combat probes should isolate Crab facing/kill timing around **+6 Strength/99 block**, Demon curse choice and **30-HP healing**, and Insatiable escape timing. [search.ts](../planner/src/search.ts) already charges **3 per Entomancer Dazed** and accounts for infestation; test continuation/lookahead before inventing another penalty. Screen the route change on **676–765, 90 paired development starts**; promote only if act-2 completions improve, not merely elite avoidance.

4. **Make act-3 resource allocation phase-aware.** Potentially essential for clears, currently weakly identified. The reported **80–100 HP** requirement is a two-deck finding, not a universal threshold. HP alone cannot repair inadequate third-form burst.

   For Queen pairs, compare Queen focus versus Torch removal by HP retained. For Aeonglass, value rapid setup, efficient damage per card, and status handling. For Test Subject, measure damage available in its first two non-intangible windows; preserve the appropriate draw/energy/burst potion for those windows.

   `potsave` only protects floors 34–47. [run-fights.ts](../planner/src/run-fights.ts)’s `potionUrge()` still pushes potions during the first boss’s opening turns. Reserve by marginal pair-survival value, with an immediate-survival override. Permit spending on Queen when it preserves more useful HP than reserving it.

   Use **11 local f47 decks × six ordered pairs × four repeats** as the baseline screen, then targeted HP **60/80/100**, potion-allocation and card-substitution probes. Cluster by deck; include 712/722’s external provenance separately. `pairScore()` must carry actual relic counters, potions and all victory heals; currently it does not. Retain second-boss capability diagnostics when first-boss wins are zero—another averaged score will dilute the signal again.

**Confirmation:** retire 586–855 from confirmation: **1,080 completed executions**, plus the pending fifth arm, are repeated exposure to 270 starts. Freeze one candidate against s3f policy with identical infrastructure, then use **660 fresh paired seeds, 856–1515**. At roughly 13% discordance, this targets a four-point act-2 gain with approximately 80% power; five points needs roughly 410. Prespecify act-2 completion as primary, report act-1 regression and clear rate separately, and freeze error handling.

Stop bundled spar4 promotion, horizon-only sweeps, equal-weight boss averaging, survivor-only save selection, and treating repeated seeds or boss swaps as independent confirmation.