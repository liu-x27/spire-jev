/**
 * The Silent's own rules: see characters/index.ts for the hooks.
 *
 * Card rewards (choices.ts cardValue reads `cards` as it reads the Ironclad's CARDS): no tier lists
 * like Jorbs' and Baalorlord's for the Silent in v0.111, so the four tiers are one, from strong A10
 * players' Elo over skipping (data/silent/card-stats-a10.json: S from +250, A +120, B 0, C -150,
 * D -300, F below), and the pick % is how often v0.111 A10 players took the card when offered, by
 * act (data/silent/take-rates-a10.json, 2127 runs; an act with fewer than 30 offers takes the
 * card's overall rate). Left out: Blade Symphony, Concoct, Fade, Flanking and Sneaky, never offered
 * as a reward in those runs; Suppress and Wraith Form, too rarely picked to be rated.
 */

import type { CharacterRules } from "./index.ts";

export const SILENT: CharacterRules = {
  cards: {
    ABRASIVE: { tiers: "AAAA", pick: [54, 44, 50] }, // Elo +149, offered 213/124/18
    ACCELERANT: { tiers: "BBBB", pick: [34, 33, 26] }, // Elo +45, offered 456/266/165
    ACCURACY: { tiers: "BBBB", pick: [47, 49, 46] }, // Elo +80, offered 472/252/144
    ACROBATICS: { tiers: "AAAA", pick: [49, 51, 51] }, // Elo +182, offered 428/236/131
    ADRENALINE: { tiers: "SSSS", pick: [73, 79, 77] }, // Elo +367, offered 193/126/27
    AFTERIMAGE: { tiers: "SSSS", pick: [70, 70, 70] }, // Elo +344, offered 207/115/16
    ANTICIPATE: { tiers: "DDDD", pick: [7, 6, 8] }, // Elo -299, offered 1273/712/431
    ASSASSINATE: { tiers: "BBBB", pick: [33, 21, 28] }, // Elo +31, offered 213/147/27
    BACKFLIP: { tiers: "BBBB", pick: [45, 45, 43] }, // Elo +43, offered 1327/711/403
    BACKSTAB: { tiers: "DDDD", pick: [43, 15, 5] }, // Elo -168, offered 465/249/133
    BLADE_DANCE: { tiers: "CCCC", pick: [33, 19, 18] }, // Elo -30, offered 1352/673/424
    BLADE_OF_INK: { tiers: "AAAA", pick: [57, 45, 52] }, // Elo +165, offered 194/138/22
    BLUR: { tiers: "BBBB", pick: [43, 53, 59] }, // Elo +87, offered 426/230/140
    BOUNCING_FLASK: { tiers: "CCCC", pick: [35, 19, 15] }, // Elo -136, offered 469/260/144
    BUBBLE_BUBBLE: { tiers: "CCCC", pick: [32, 33, 28] }, // Elo -77, offered 468/240/137
    BULLET_TIME: { tiers: "BBBB", pick: [33, 31, 32] }, // Elo +57, offered 214/127/16
    BURST: { tiers: "AAAA", pick: [39, 37, 38] }, // Elo +157, offered 202/133/16
    CALCULATED_GAMBLE: { tiers: "AAAA", pick: [45, 57, 57] }, // Elo +134, offered 446/254/155
    CLOAK_AND_DAGGER: { tiers: "CCCC", pick: [36, 24, 16] }, // Elo -46, offered 1314/707/452
    CORROSIVE_WAVE: { tiers: "BBBB", pick: [21, 15, 19] }, // Elo +14, offered 201/137/19
    DAGGER_SPRAY: { tiers: "FFFF", pick: [20, 3, 1] }, // Elo -328, offered 1291/704/457
    DAGGER_THROW: { tiers: "DDDD", pick: [20, 4, 3] }, // Elo -188, offered 1289/730/445
    DASH: { tiers: "DDDD", pick: [34, 13, 6] }, // Elo -171, offered 485/233/124
    DEADLY_POISON: { tiers: "DDDD", pick: [31, 12, 6] }, // Elo -240, offered 1303/747/410
    DEFLECT: { tiers: "CCCC", pick: [20, 23, 19] }, // Elo -138, offered 1325/733/381
    DODGE_AND_ROLL: { tiers: "DDDD", pick: [17, 20, 19] }, // Elo -192, offered 1261/747/443
    ECHOING_SLASH: { tiers: "DDDD", pick: [56, 21, 1] }, // Elo -226, offered 435/244/147
    ENVENOM: { tiers: "BBBB", pick: [32, 26, 30] }, // Elo +71, offered 211/134/27
    ESCAPE_PLAN: { tiers: "AAAA", pick: [48, 51, 45] }, // Elo +130, offered 402/257/150
    EXPERTISE: { tiers: "DDDD", pick: [12, 18, 17] }, // Elo -162, offered 449/254/137
    EXPOSE: { tiers: "AAAA", pick: [48, 55, 40] }, // Elo +187, offered 483/274/148
    FAN_OF_KNIVES: { tiers: "AAAA", pick: [46, 33, 41] }, // Elo +151, offered 229/117/21
    FINISHER: { tiers: "CCCC", pick: [16, 10, 8] }, // Elo -127, offered 439/258/150
    FLECHETTES: { tiers: "DDDD", pick: [22, 11, 6] }, // Elo -224, offered 469/240/149
    FLICK_FLACK: { tiers: "FFFF", pick: [18, 5, 1] }, // Elo -301, offered 1275/715/455
    FOOTWORK: { tiers: "AAAA", pick: [83, 78, 71] }, // Elo +160, offered 458/268/169
    GRAND_FINALE: { tiers: "DDDD", pick: [6, 6, 7] }, // Elo -212, offered 190/112/20
    HAND_TRICK: { tiers: "CCCC", pick: [20, 19, 18] }, // Elo -150, offered 474/262/147
    HAZE: { tiers: "CCCC", pick: [34, 24, 11] }, // Elo -78, offered 458/263/145
    HIDDEN_DAGGERS: { tiers: "BBBB", pick: [64, 53, 42] }, // Elo +117, offered 424/244/135
    INFINITE_BLADES: { tiers: "CCCC", pick: [42, 24, 20] }, // Elo -10, offered 467/261/160
    KNIFE_TRAP: { tiers: "AAAA", pick: [43, 47, 45] }, // Elo +184, offered 214/135/15
    LEADING_STRIKE: { tiers: "CCCC", pick: [40, 24, 12] }, // Elo -63, offered 1329/735/445
    LEG_SWEEP: { tiers: "BBBB", pick: [59, 50, 37] }, // Elo +17, offered 454/251/152
    MALAISE: { tiers: "BBBB", pick: [47, 28, 41] }, // Elo +106, offered 213/128/12
    MASTER_PLANNER: { tiers: "BBBB", pick: [17, 17, 17] }, // Elo +64, offered 222/126/13
    MEMENTO_MORI: { tiers: "FFFF", pick: [5, 2, 3] }, // Elo -356, offered 495/252/133
    MIRAGE: { tiers: "DDDD", pick: [17, 25, 25] }, // Elo -174, offered 471/242/142
    MURDER: { tiers: "DDDD", pick: [7, 8, 8] }, // Elo -153, offered 188/110/14
    NIGHTMARE: { tiers: "BBBB", pick: [14, 24, 17] }, // Elo +77, offered 194/107/16
    NOXIOUS_FUMES: { tiers: "BBBB", pick: [68, 43, 30] }, // Elo +14, offered 474/293/174
    OUTBREAK: { tiers: "DDDD", pick: [46, 24, 37] }, // Elo -168, offered 202/120/22
    PHANTOM_BLADES: { tiers: "CCCC", pick: [40, 28, 26] }, // Elo -68, offered 489/270/174
    PIERCING_WAIL: { tiers: "BBBB", pick: [39, 42, 36] }, // Elo +108, offered 1233/721/455
    PINPOINT: { tiers: "DDDD", pick: [20, 4, 1] }, // Elo -238, offered 429/250/140
    POISONED_STAB: { tiers: "FFFF", pick: [15, 3, 1] }, // Elo -331, offered 1251/750/437
    POUNCE: { tiers: "DDDD", pick: [29, 17, 9] }, // Elo -252, offered 459/247/163
    PRECISE_CUT: { tiers: "FFFF", pick: [20, 6, 1] }, // Elo -363, offered 422/248/142
    PREDATOR: { tiers: "FFFF", pick: [12, 2, 3] }, // Elo -376, offered 1321/750/401
    PREPARED: { tiers: "BBBB", pick: [39, 41, 37] }, // Elo +106, offered 1328/720/388
    REFLEX: { tiers: "BBBB", pick: [15, 30, 33] }, // Elo +4, offered 430/235/136
    RICOCHET: { tiers: "DDDD", pick: [18, 8, 5] }, // Elo -221, offered 1313/737/440
    SERPENT_FORM: { tiers: "BBBB", pick: [47, 36, 44] }, // Elo +58, offered 226/118/18
    SHADOWMELD: { tiers: "BBBB", pick: [30, 32, 30] }, // Elo +14, offered 212/110/22
    SHADOW_STEP: { tiers: "CCCC", pick: [18, 10, 16] }, // Elo -2, offered 200/135/10
    SIDESTEP: { tiers: "BBBB", pick: [33, 37, 37] }, // Elo +15, offered 501/240/146
    SKEWER: { tiers: "FFFF", pick: [8, 3, 4] }, // Elo -447, offered 439/237/144
    SLICE: { tiers: "FFFF", pick: [7, 2, 1] }, // Elo -427, offered 1338/741/412
    SNAKEBITE: { tiers: "DDDD", pick: [39, 14, 11] }, // Elo -176, offered 1313/707/429
    SPEEDSTER: { tiers: "DDDD", pick: [6, 7, 5] }, // Elo -242, offered 464/245/178
    STORM_OF_STEEL: { tiers: "CCCC", pick: [17, 15, 16] }, // Elo -12, offered 212/131/19
    STRANGLE: { tiers: "DDDD", pick: [19, 6, 4] }, // Elo -193, offered 453/217/134
    SUCKER_PUNCH: { tiers: "FFFF", pick: [13, 6, 4] }, // Elo -338, offered 1324/748/407
    TACTICIAN: { tiers: "BBBB", pick: [26, 33, 35] }, // Elo +43, offered 455/240/169
    THE_HUNT: { tiers: "DDDD", pick: [31, 16, 25] }, // Elo -191, offered 221/131/12
    TOOLS_OF_THE_TRADE: { tiers: "AAAA", pick: [52, 46, 51] }, // Elo +187, offered 214/136/18
    TRACKING: { tiers: "AAAA", pick: [35, 27, 33] }, // Elo +183, offered 219/140/21
    UNTOUCHABLE: { tiers: "DDDD", pick: [13, 17, 18] }, // Elo -164, offered 1342/791/438
    UP_MY_SLEEVE: { tiers: "CCCC", pick: [23, 11, 8] }, // Elo -5, offered 494/262/144
    WELL_LAID_PLANS: { tiers: "AAAA", pick: [51, 50, 50] }, // Elo +177, offered 232/150/22
  },
};
