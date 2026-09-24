**Measurement is substantially better, but the act replay is not yet a clean deck-policy experiment. packages2+shop2 has not demonstrated an improvement.** I worked read-only; no game or run generator was launched.

**The replay mechanism checks out; the surrounding accounting needs repairs.** All **81 Vantom and 26 Insatiable default replays** match `eval-cap0-a10.json` on end-turn traces, outcomes, HP remaining and HP lost. Original action sequences were not retained, so this verifies turn-boundary equivalence rather than every action.

Five issues remain:

- **The confirmation directory is mixed.** `runs/saves` currently contains **106 f16 saves**, including 25 from seeds 16–45, and **29 f32 saves**, including three from that development set. Existing confirmation JSONs contain the intended 81/26; a new substring-selected benchmark would include the old seeds. Use an explicit seed/save-hash manifest. [`bench.ts`](/D:/CODE/spire-jev/planner/src/bench.ts)
- **Deck flags change combat.** `combatSelect()` calls flag-dependent `cardValue()`. Comparing completed Vantom traces, packages2+shop2 changes **8 tuning fights and 3 confirmation fights** before act 2. Seed 188’s Attack Potion produces a different selected attack; seed 240’s Vantom finish changes from **42 HP to 11**. Freeze combat selection separately, or start from identical post-Vantom saves before its reward. [`run-fights.ts`](/D:/CODE/spire-jev/planner/src/run-fights.ts:211)
- **Failures are silently retained or dropped.** Tuning baseline seed **236 has zero fights**; seed **254 stops after a won floor-21 fight** in both baseline and packages2+shop2. The logs report connection/timeout failures. `bench.ts` ignores exit status and retains only `fights`. Record explicit completion/error status and rerun infrastructure failures. [`bench.ts:73`](/D:/CODE/spire-jev/planner/src/bench.ts:73)
- **The requested deck audit data were discarded.** `bench.ts` copies only fights, then deletes the child JSON containing `rooms`, offers, purchases and deck snapshots. Consequently, these act-replay files cannot establish which floor-32 deck changes caused their outcomes.
- **“Clean” remains approximate.** Bench uses HP alone, including post-victory healing. `stages.ts` fixes the boss-reward leakage, but `revivedIn()` infers revival from next-fight inventory or cumulative damage; neither is an exact event record. Log fight-entry decks and immediate exit relic/potion state. [`stages.ts`](/D:/CODE/spire-jev/planner/src/stages.ts:30)

Also, `--stop-floor 33` stops when the *next combat* begins, allowing intervening screens; it does not override bench’s default `--fights 1`. Make act replay an explicit mode with validated termination.

**The packages result is compatible with noise.**

| Library | Baseline Insatiable wins | packages2+shop2 | Saves gained / lost |
|---|---:|---:|---:|
| Tuning, 155 starts | 5; 46 reached | 9; 44 reached | 6 / 2 |
| Confirmation, 81 starts | 3; 26 reached | 2; 26 reached | 2 / 3 |

The tuning difference is **+2.6 percentage points per started replay**, with an exact paired discordance test of approximately **p=.29**, before accounting for screening several candidates and the defects above. Confirmation reverses direction. Conditional 9/44 versus 5/46 also compares different survivors. [Tuning results](/D:/CODE/spire-jev/planner/runs/bench-act2-pk2shop.json), [confirmation results](/D:/CODE/spire-jev/planner/runs/bench-cact2-pk2shop.json).

Seeds 46–135 have now informed exploration and potion policy; they are regression evidence, not untouched confirmation. Reserve fresh seeds beyond 315. For one frozen candidate, roughly **320–480 paired pre-Vantom starts** can detect a **five-point absolute improvement**, assuming 10–15% discordant outcomes, 80% power and two-sided 5% significance. Detecting 2.5 points requires approximately **1,300–1,900 pairs**. Recalculate using observed discordance; exploration repeats do not increase independent sample size.

**The wall is inadequate damage and defense operating together—not merely missing “scaling.”**

In tuning-baseline act replay, the **41 Insatiable losses** last **6.8 turns**, leaving **127 boss HP** on average. Twenty-four start at ≥80% player HP. Damage through the final pre-enemy snapshots averages approximately **31.5 per turn**. Only two final snapshots have Sandpit 1. Packages2+shop2’s losses still average **32 damage per turn**, leaving 120 HP. This is predominantly a survival/output failure, with some timer pressure. [`bench-act2-base.json`](/D:/CODE/spire-jev/planner/runs/bench-act2-base.json)

The surviving **original-run** telemetry supplies useful examples, but must not be substituted for missing replay rooms:

- `eval-dev0-a10` entrants average **21.1 cards and 6.3 basics**; 84% satisfy the current “draw ≥2” classification.
- Across floor-17–32 rewards, Bloodletting is taken **20/21**, Burning Pact **12/15**, but Inflame **0/16** and Stoke **6/16**; Dominate is never offered.
- Seed **138** reaches floor 32 with Mantle/FNP but little growing damage. On floor 30 it leaves with **88 gold**, declining **Burning Pact and Inflame at 74 each**.
- Seed **299** leaves a shop with **158 gold**, declining **37-gold Inflame**, then spends 150 on another removal two floors later. [`eval-dev0-a10.json`](/D:/CODE/spire-jev/planner/runs/eval-dev0-a10.json)

Thus “take energy” alone is insufficient, and “wait for Dominate” is impractical. Human winning decks illustrate functioning combinations, not a validated target composition. The 23 selected wins do **not** measure strong players’ Insatiable loss rate; the research also mixes patches and save-loading practices. [`a10-decks-research.md`](/D:/CODE/spire-jev/docs/a10-decks-research.md), [`cn-research.md`](/D:/CODE/spire-jev/docs/cn-research.md)

I would test these concrete policy changes:

- In **`packages.ts`**, replace binary `damageScaling()==0` and card-count sufficiency with estimated contributions over the first two cycles: damage, reliable block, net draw, usable energy and repeatable triggers. One Inflame currently switches off the damage deficit entirely; two unupgraded cantrips satisfy draw; one recurring Mantle cannot satisfy Rupture’s two-source requirement. Brand is omitted from `damageScaling()`, while Stoke counts unconditionally. Distinguish self-exhausting cards from reusable thinning. [`packages.ts:132`](/D:/CODE/spire-jev/planner/src/packages.ts:132)
- In **`chooseCardReward()`**, score the actual offered upgrade, cost and effects. Prioritize the current bottleneck: supported Strength/multihits, exhaust/Ashen output, or surplus-block/Body Slam; acquire draw/energy when they enable those cards. Charge additions for cycle dilution and setup energy. Skip redundant frontload only when its marginal contribution is low—not whenever an archetype counter trips. [`choices.ts:182`](/D:/CODE/spire-jev/planner/src/choices.ts:182)
- In **`chooseShop()`**, compare affordable purchase bundles against removal and saving. `shop2` still uses a threshold cascade: `fillsNeed()` omits energy and defensive deficits, and potions come after removals/relics. Evaluate actual useful potion/card combinations, not the most expensive potion. [`choices.ts:352`](/D:/CODE/spire-jev/planner/src/choices.ts:352)

These are hypotheses. Test acquisition and shops separately on fixed act starts, retaining every offer and score explanation; then test their combination.

**Vantom exploration should identify causal decisions, not average card timings.** `planTurnExplore()` samples among close alternatives from four retained endpoints, within five score points, at each replanning step. Failure to rescue Insatiable therefore does not prove its deck unwinnable. `explored.ts` selects the first winning exploration and averages only observed plays; it does not control for when cards were available. [`search.ts:497`](/D:/CODE/spire-jev/planner/src/search.ts:497)

The post-potions2 rescues suggest testing **setup deployment, True Grit/Stoke thinning, and debuff timing**. Seed 203 deploys Mantle on turn 1; seed 193 wins despite initially dealing less damage. Replay each rescued prefix, change **one decision**, then return to default. Record full state, selections and targets; test both rescued losses and baseline wins. Four Colossus pairs and two Mantle appearances cannot justify another global engine bonus. [`bench-dev-van-explore.json`](/D:/CODE/spire-jev/planner/runs/bench-dev-van-explore.json)

My ranked next cycle:

1. **Repair experiment isolation and telemetry.** Expected effect: trustworthy attribution. Require complete manifests, matched initial combat, retained rooms and explicit errors.
2. **Test marginal deck contribution and shop allocation.** Highest plausible act-2 gain. Decide by Insatiable completions per started replay, with attrition and deployment diagnostics.
3. **Extract one narrowly supported Vantom rule.** Expect modest gains; require fresh paired wins without clean-win regression. Audit repeatable simulator block mismatches alongside it.
4. **Confirm the frozen combination in whole runs through floor 49.** Act replay cannot validate act-1 acquisition or dependable clears.

Stop global weight sweeps, winner-shaped deck quotas, repeated “confirmation” on exposed seeds, and treating one successful exploration as a deployable policy.