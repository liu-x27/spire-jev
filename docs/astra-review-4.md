**`spar` has improved act-1 survival, but dependable clearing remains far away.** Act 2 is the largest remaining source of attrition; act 3 is barely tested. The floor-49 cap prevented a clear, but removing it does not explain away the deck weakness.

I worked read-only and launched none of the prohibited tools.

Pooling the current [development](/D:/CODE/spire-jev/planner/runs/eval-vet-dev4s-a10.json) and [confirmation](/D:/CODE/spire-jev/planner/runs/eval-vet-conf4s-a10.json) runs gives **270 starts**:

| Where the run ends | Runs | Share of starts |
|---|---:|---:|
| Act 1 ordinary combat, including `?` fights | 12 | 4.4% |
| Act 1 elites | 23 | 8.5% |
| Act 1 boss | 80 | 29.6% |
| Act 2 ordinary combat | 37 | 13.7% |
| Act 2 elites | 30 | 11.1% |
| Act 2 boss | 69 | 25.6% |
| Act 3 before bosses: combat deaths | 6 | 2.2% |
| Act 3 first boss | 8 | 3.0% |
| Act 3 infrastructure failures before bosses | 4 | 1.5% |
| First boss won; floor-49 continuation blocked | 1 | 0.4% |

Thus **155/270 beat act 1**. Of those, **67/155 die before the act-2 boss**; only **19/88 boss entrants win**. Act 2 consumes **136/270 starts**, including **88% of act-1 survivors**. Its problem extends well beyond boss tactics.

Those 19 survivors yield nine floor-48 entrants, six combat deaths and four censored runs. The four are seeds **374, 413, 545 and 580**, each ending with `ECONNRESET` after a *won* fight. Calling all ten missing entrants act-3 deaths would be wrong.

The [497 replay](/D:/CODE/spire-jev/planner/runs/eval-clear497-a10.json) supplies the only observed second-boss attempt: **0/1**. Aeonglass costs 79 HP; logged post-victory HP is **48**, which becomes Test Subject’s starting HP. “No heal” means no inter-boss reset: Burning Blood/Chosen Cheese still account for the difference from 41 combat-exit HP. Test Subject kills it in four turns.

**The measurement supports adopting `spar`, not claiming the deck problem solved.** On confirmation, act-1 completions improve **41→56**, with **26 gained seeds versus 11 lost**. Act-2 completions improve only **4→7**, with **5 gained versus 2 lost**. The latter is seven discordant observations, insufficient evidence of a dependable improvement.

Conditional boss rates compare different survivors. Use completions **per original start**, alongside conditional diagnostics. Paired seeds remain useful despite divergent routes; [compare.ts](/D:/CODE/spire-jev/planner/src/compare.ts)’s shared-fight HP totals are neither identical-state experiments nor unbiased summaries of whole-run improvement. It also warns that older confirmation HP accounting omitted damage on winning enemy turns.

Seeds 316–495 are heavily exposed. Seeds 496–585 have now informed repeated checks—and appear in `path.ts`’s elite-risk calibration—so retire them as final confirmation. Roughly 900 executions across changing policies and repeated seeds are not 900 independent trials of today’s policy. Preserve seed manifests, commit/profile/catalog hashes, explicit termination reasons and original-start denominators. `plainCardValue()` now fixes the earlier combat-selection flag contamination.

**`spar`’s principal weakness is the experiment it asks the simulator to perform.** In [spar.ts](/D:/CODE/spire-jev/planner/src/spar.ts), `bout()` creates an **80/80-HP, three-energy, five-card-opening, relicless, potionless** player. That is increasingly unlike an actual late-game deck.

Concrete changes:

- **Fix encounter/state fidelity first.** `BOSSES` omits **Queen**; `bossFor("QUEEN_BOSS", 2)` silently substitutes **Insatiable**. Use actual relics/counters, energy, opening draw, max HP and potion inventory, with plausible boss-entry HP scenarios. Reject unsupported encounters explicitly.
- **Use actual card instances.** Existing `+` IDs can resolve upgraded catalog entries, but reward candidates pass bare `card_id`; seed 497’s floor-19 upgraded offers demonstrate this. `cardFromId()` silently substitutes unupgraded cards, while `sparScore()` silently drops unknown cards. Preserve upgrades/enchantments and report unsupported rules instead of valuing an incomplete deck.
- **Replace raw progress as the main objective.** `damage + 60·won − 0.7·hpLost` optimizes an arbitrary tradeoff across shuffles. It does not directly optimize surviving the run. Prefer completion probability, then remaining resources; use normalized remaining enemy burden to distinguish losing candidates. Keep death, horizon timeout and victory separate.
- **Finish fights when possible.** Eight turns undervalues slow setup and delayed resolutions. However, `spar2`’s **2 gained/3 lost act-1 wins and 1/1 act-2 exchange** show that twelve turns alone is inadequate. Use adaptive continuation with a safety cap and report unresolved bouts. Longer simulation still uses `planTurn(TURN_WEIGHTS, 3000)`, versus the live planner’s default 20,000-node budget.
- **Include continuation value.** Evaluate immediate hallway/elite survival and future boss scenarios alongside the known boss. Otherwise act-1 specialization can discard the draw, energy and defense needed later. Test supported two-card combinations or card-plus-upgrade opportunities; greedy marginal gain cannot discover combinations whose first component scores poorly alone.

Thirty-two shuffles are a screening budget, not precision. One additional simulated win contributes **1.875 points from the win bonus alone**, against a five-point acceptance threshold. Shared RNG seeds help, but changing deck length changes Fisher–Yates permutations and subsequent RNG consumption; these are not literally identical draws. Use stable card-instance random priorities, separate RNG streams, and expand close decisions to 128–256 shuffles, with independent validation shuffles.

The resulting decks warrant investigation: development act-2 entrants’ `draw>=2` classification falls **68%→24%**, while basics rise **5.6→6.7**. These crude classifications do not prove causality, but contradict assuming `spar` reliably builds complete engines.

**The surrounding policies undermine a consistent marginal-value approach.** In [choices.ts](/D:/CODE/spire-jev/planner/src/choices.ts):

- `chooseCardReward()` bypasses normal skip thresholds under `spar`; `cardValue()` only supplies negative vetoes, including the third-Tremble rule. Tuning `SKIP_BELOW` cannot fix these rewards.
- `chooseShop()` buys a `cardValue>=0.85` card **before** sparring. If no gain reaches five, it falls through to legacy removal/card/relic purchases. Prices affect affordability, not marginal utility; potion choice remains late and price-ranked.
- Removal evaluates only `worstCard()`’s heuristic nominee, not every legal removal.
- `chooseUpgrade()` remains a static ranking; `chooseRest()` remains HP thresholds plus `healCarried()`.

Use one evaluator for **skip, purchase bundles, every legal removal, actual upgrade, and healing**. Include saving gold explicitly. A rejected purchase must not reappear through fallback rules. Separate unsupported-content fallback from ordinary rejection.

**Act 3 needs a two-fight resource objective.** Optimize completing both bosses with carried HP, consumed potions and persistent relic counters; reset ordinary combat state correctly. `act_second_boss` exists in [obs.ts](/D:/CODE/spire-jev/planner/src/obs.ts), but choices do not use it.

The deck needs repeatable defense and damage, reliable access to both, and affordable setup **again** at the second fight’s reduced HP. Pathing should value shops, targeted upgrades and healing by pair-completion probability. [planPath()](/D:/CODE/spire-jev/planner/src/path.ts) currently ends at a generic HP-based boss value. Combat should price HP and potions against the second encounter; preserving a potion blindly can still lose the first.

The existing [act-3 swap results](/D:/CODE/spire-jev-bound/planner/runs/boss-bench/bench-act3-AT.json) contain four decks, all losing against every first boss. Six ordered pairs provide only **12 distinct first-boss tests**, not 24 independent observations. Use these for mechanics, rest-versus-smith, potion timing and controlled card substitutions—not win-rate claims. Additional f47 saves for **593 and 614** exist; keep their provenance separate.

My ranked next steps:

1. **Repair scorer fidelity and censoring.** Highest confidence of correcting wrong decisions. Audit all **32 veteran f32 saves**, all available f47 saves, upgraded offers and every boss mapping; require correct terminal mechanics and resource transitions.
2. **Test a coherent acquisition/shop/upgrade evaluator.** Highest plausible gameplay gain. Screen on 316–495, isolate components, then freeze one candidate. Target act-2 completions per start. Approximately **320–480 fresh paired act starts** detect a five-point gain if discordance is 10–15%; recalculate from pilot discordance.
3. **Build the double-boss evaluator and collect representative act-3 starts.** Current saves support diagnosis only. Seek **30–50 independent decks** before comparing policies broadly; boss swaps remain clustered by deck.
4. **Validate whole-run reliability after the floor fix.** Use **300 fresh paired seeds**, a prespecified clear-rate target and confidence intervals. At today’s nine-in-270 boss reach rate, this produces only about ten first-boss entrants; upstream improvement must precede a credible reliability claim.

Stop global weight sweeps, horizon-only tuning, repeated “confirmation,” counting swapped bosses as independent decks, and interpreting one rescued clear as dependable play.