// Act 2's ordinary fights from our own game logs (every eval and bench since the veteran profile):
// by encounter (its monster set), how often it came, each monster's HP (the most seen at turn 1's end:
// its full HP where turn 1 left it alone), its powers then, and its shown intent turn by turn (the
// commonest at each turn). node tools/hallways.cjs > data/hallways-a2.json (spar.ts hallways, --flags sparhall)
const fs = require("fs");
const path = require("path");
const R = path.resolve(__dirname, "..", "runs");
const ELITE = /ENTOMANCER|DECIMILLIPEDE|INFESTED_PRISM|OVICOPTER|SPECTRAL|FLAIL|MAGI|MECHA|SOUL_NEXUS|BYRDONIS|TERROR_EEL|PHANTASMAL|SKULKING|PHROG|BYGONE/;
const BOSS = /CRUSHER|ROCKET|KNOWLEDGE_DEMON|THE_INSATIABLE/;
const PLAYER_MADE = /^(VULNERABLE|WEAK|STRENGTH|MANGLE|DARK_SHACKLES|SHACKLING_POTION|DEBILITATE|STRANGLE|POISON|SHRINK|DOOM|CHAINS|TANGLED|SLOW|CONSTRICT|DEMISE|TENDER|GIGANTIFICATION|FRAIL)$/;
const enc = new Map();
const seen = new Set();
for (const f of fs.readdirSync(R).filter((x) => /^(eval|bench)-.*\.json$/.test(x))) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(R, f), "utf8")); } catch { continue; }
  const fights = j.fights ?? (j.results ?? []).flatMap((r) => r.fights ?? []);
  for (const x of fights) {
    if (!(x.floor > 17 && x.floor < 33) || !x.endTurn?.length) continue;
    if (x.enemies.some((e) => ELITE.test(e) || BOSS.test(e))) continue;
    const id = `${x.seed}:${x.floor}:${x.hpStart}:${x.turns}`;
    if (seen.has(id)) continue; // the same fight replayed in another bench
    seen.add(id);
    const key = [...x.enemies].sort().join("+");
    const e = enc.get(key) ?? { key, n: 0, slots: {} };
    e.n++;
    for (const t of x.endTurn) {
      for (const m of t.before.matchAll(/E(\d+) (\S+) (\d+)hp \d+blk \[([^\]]*)\] (\S+)/g)) {
        const [, slot, model, hp, powers, intent] = m;
        const s = (e.slots[slot] ??= { model, hp: 0, powers: {}, byTurn: {} });
        if (t.turn === 1) {
          s.hp = Math.max(s.hp, Number(hp));
          for (const p of powers.split(",").filter(Boolean)) {
            const pm = p.match(/^([A-Z_]+?)_POWER(-?\d+)/);
            // The monster's own powers, not what the player put on it by turn 1's end.
            if (pm && !PLAYER_MADE.test(pm[1])) s.powers[pm[1]] = Math.max(s.powers[pm[1]] ?? 0, Number(pm[2]));
          }
        }
        // Its own move: not a Stun the player caused, nor an attack cut by Weak or Shrink, nor one grown by Vulnerable... on the player (the shown number is the game's, with the player's Vulnerable in it).
        if (intent === "Stun" || /WEAK_POWER|SHRINK_POWER|STRENGTH_POWER-/.test(powers)) continue;
        if (/VULNERABLE_POWER/.test(t.before.split("|")[0])) continue;
        const bt = (s.byTurn[t.turn] ??= {});
        bt[intent] = (bt[intent] ?? 0) + 1;
      }
    }
    enc.set(key, e);
  }
}
const out = [...enc.values()].filter((e) => e.n >= 8).sort((a, b) => b.n - a.n).map((e) => ({
  key: e.key, n: e.n,
  monsters: Object.entries(e.slots).sort((a, b) => Number(a[0]) - Number(b[0])).map(([, s]) => ({
    model: s.model, hp: s.hp, powers: s.powers,
    // Turn by turn, the commonest intent shown ("Attack9x1+Buff"), to turn 8.
    turns: Object.keys(s.byTurn).map(Number).sort((a, b) => a - b).filter((t) => t <= 8)
      .map((t) => Object.entries(s.byTurn[t]).sort((a, b) => b[1] - a[1])[0][0]),
  })),
}));
console.log(JSON.stringify(out, null, 1));
