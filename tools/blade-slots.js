// Lists every catalog blade that gets AI-drawn art (everything except the 30 hand-drawn originals)
// into tools/.art-raw/slots.json for tools/make-blade-art.py.   node tools/blade-slots.js
const path = require("path"), fs = require("fs");
global.window = {}; global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
for (const f of ["data.swords.js", "data.monsters.js", "data.game.js", "state.js", "data.realms.js"]) require(path.join(__dirname, "..", "js", f));
const G = window.G, out = [];
for (let r = 0; r < G.REALMS.length; r++) {
  const summon = G.SW.filter((w) => w.realm === r && !w.sig && w.gen != null).sort((a, b) => G.TIER[a.rarity].rank - G.TIER[b.rarity].rank || a.index - b.index);
  const boss = G.SW.filter((w) => w.realm === r && w.sig).map((w) => { const b = G.bossAt(w.sig); return { index: w.index, rarity: "legendary", boss: { floor: w.sig, name: b.name, kind: b.kind, fam: b.fam, mech: b.mech.map((k) => G.BOSS_MECH[k].name), lord: b.lord, final: b.final } }; });
  out.push({ realm: r, name: G.REALMS[r].name, summon: summon.map((w) => ({ index: w.index, rarity: w.rarity })), boss });
}
fs.mkdirSync(path.join(__dirname, ".art-raw"), { recursive: true });
fs.writeFileSync(path.join(__dirname, ".art-raw", "slots.json"), JSON.stringify(out, null, 1));
console.log("slots:", out.reduce((a, o) => a + o.summon.length + o.boss.length, 0));
