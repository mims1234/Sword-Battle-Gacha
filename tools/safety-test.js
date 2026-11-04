// Headless safety checks, run before every commit:  node tools/safety-test.js
// 1. an old v3 save converts correctly; 2. a hostile save code is cleaned; 3. two hours of play keep sane values.
const path = require("path");
const root = path.resolve(__dirname, "..");
let store = {};
global.window = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
global.btoa = (s) => Buffer.from(s, "binary").toString("base64");
global.atob = (s) => Buffer.from(s, "base64").toString("binary");
for (const f of ["data.swords.js", "data.monsters.js", "data.game.js", "state.js", "data.blade-art.js", "data.realms.js", "art.blades.js", "sim.js", "shop.js"]) require(path.join(root, "js", f));
const G = window.G, fails = [];
let s2;
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

// 1. v3 migration
store.idle_blade_master_v3 = JSON.stringify({ gameState: { collection: { common: { 0: 3, 5: 1 }, legendary: { 25: 7 } }, souls: 500, chests: 4, kills: 1234, totalPulls: 40, prestige: { count: 2 }, enchant: 3, monsterKills: { goblin: 60, dragon: 2 } } });
G.load();
ok(G.s.blades.length === 3, "migrate blade count " + G.s.blades.length);
ok(G.s.blades.find((b) => b.i === 25).s === 5, "migrate stars capped");
ok(G.s.sigils === 14, "migrate gems");
ok(G.s.embers === 13, "migrate essence");
ok(G.s.mk[2] === 60, "migrate kills by monster index");
ok(G.party.filter(Boolean).length > 0, "migrate builds a team");

// 2. hostile save code
store = {};
const evil = {
  v: 4, souls: "NaN", sigils: -5, floor: "<b>", best: 1e99,
  blades: [{ u: 1, i: 999, t: "common", a: [] }, { u: 2, i: 3, t: "hax", a: [] }, { u: 3, i: 4, t: "rare", a: [["atk", 1e9], ["<script>", 5]], r: { k: "nope", t: 9 } }, { u: 3, i: 5, t: "epic", a: "x" }],
  party: [3, 3, 99, "x", null], runes: [{ k: "might", t: 99 }, { k: "bad" }],
  log: [{ t: "<img src=x onerror=alert(1)>", c: "red;background:url(x)" }], path: { id: "vault", name: "<script>alert(1)</script>" },
  items: { key: "9e999", elixir: -3, hax: 5 }, shop: { receipts: [{ sku: "<x>", usd: 1 }, { sku: "gems_1", usd: 1e9 }, 5], first: { "<b>": 1, gems_1: 1 }, passEnd: "x" }, gate: { dry: { 10: 99, 15: 2 } },
  con: { might: 999, bogus: 3 }, set: { speed: 99, gfx: "ultra", musicVol: 7 }, omen: { pend: { id: "evil", at: 1 } }, exp: [{ u: [3], end: "soon", h: 999 }], bounty: { day: "x", list: [{ k: "nope" }] },
};
ok(G.importSave(btoa(unescape(encodeURIComponent(JSON.stringify(evil))))), "import accepted");
G.load();
let s = G.s;
ok(s.souls === 0 && s.sigils === 0, "numbers coerced " + s.souls + " " + s.sigils);
ok(s.floor === 1, "floor coerced " + s.floor);
ok(s.best <= 3000, "best clamped " + s.best);
ok(s.blades.every((b) => G.SW[b.i] && G.TIER[b.t]), "blades valid");
ok(new Set(s.blades.map((b) => b.u)).size === s.blades.length, "unique blade ids");
ok(s.blades.every((b) => b.a.every((a) => G.AFFIX[a[0]] && a[1] <= 200)), "affixes valid");
ok(s.runes.every((r) => G.RUNE[r.k] && r.t <= 3), "runes valid");
ok(s.log[0].c === "", "log colour stripped");
ok(s.path.name === "Gilded Vault", "path name comes from game data");
ok(s.con.might === G.STARS[0].max && !s.con.bogus, "rebirth upgrades clamped");
// musicVol 7 is clamped to 1, then the one-time volume update (no volVer in this save) sets the 90% default
ok(s.set.speed === 3 && s.set.gfx === G.deviceGfx() && s.set.musicVol === 0.9 && s.set.sfxVol === 0.3, "settings clamped " + JSON.stringify([s.set.speed, s.set.gfx, s.set.musicVol, s.set.sfxVol]));
ok(s.omen.pend === null, "unknown event cleared");
ok(s.exp.length === 1 && s.exp[0].h === 1, "missions coerced");
ok(s.bounty === null || s.bounty.day === G.day(), "quests reset");
ok(s.items.key === 0 && s.items.elixir === 0 && !("hax" in s.items), "items coerced " + JSON.stringify(s.items));
ok(s.shop.receipts.length === 1 && s.shop.receipts[0].usd === 1000 && !s.shop.first["<b>"] && s.shop.first.gems_1 && s.shop.passEnd === 0, "shop coerced");
ok(s.gate.dry[10] === 10 && !(15 in s.gate.dry), "gate coerced");

// 2b. generated content is stable and complete
ok(G.SW.length === 30 + 9 * 30 + 100 + 10 * 40, "blade catalog size " + G.SW.length);
ok(G.SW.filter((w) => w.gen != null).every((w) => { const d = G.bladeRGBA(G.bladeSpec(w.gen, { rarity: w.rarity, realm: w.realm, element: w.element, metal: w.metal, profile: w.profile })); let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n > 60; }), "every generated blade draws a picture");
ok(G.SW.every((w, i) => w.index === i && G.EL[w.element] && G.TIER[w.rarity] && w.spr >= 0 && w.spr < 30), "catalog entries valid");
ok(G.BOSS_FLOORS.length === 100 && G.BOSS_FLOORS.every((f) => G.SW[G.SIG[f]].sig === f && G.MON[G.bossAt(f).mi]), "every boss has a blade and a sprite");
ok(G.bossAt(1000).final && G.bossAt(100).lord && G.bossAt(100).mech.length === 2, "lords and final boss");
ok(G.SW.every((w) => typeof w.name === "string" && w.name.length > 1 && w.name.length < 60), "every blade has a sensible name");
ok(isFinite(G.ehp(1000)) && isFinite(G.eatk(1000)) && G.fmt(G.ehp(1000)).length < 9, "floor 1000 numbers " + G.fmt(G.ehp(1000)));

// 2c. shop and boss gate
store = {}; G.load(); s2 = G.s; s2.sigils = 0;
G.shop.grant("gems_1"); ok(s2.sigils === 30, "first pack doubled " + s2.sigils);
G.shop.grant("gems_1"); ok(s2.sigils === 45, "second pack normal " + s2.sigils);
G.shop.grant("starter"); ok(s2.items.key === 3 && s2.blades.some((b) => b.t === "epic") && G.shop.owned("starter"), "starter pack");
ok(G.shop.buyItem("tonic") && s2.items.tonic === 1 && G.shop.useItem("tonic") && G.buffOn("dmg"), "tonic buff");
s2.sigils += 10; G.summon(10); G.autoParty(); G.refreshBlades(); s2.best = 25; s2.floor = 25;
ok(!G.gateOpen(30) && G.gateOpen(20), "gate only for beaten bosses");
ok(G.startGate(20) && G.gate && G.curFloor() === 20 && G.combat.waves === 1, "gate starts");
ok(G.startGate(10) === false, "one gate at a time");
G.leaveGate(); ok(!G.gate && G.gateFree(), "leaving the free try gives it back");
s2.gate.day = G.day(); s2.items.key = 1; ok(G.startGate(10) && s2.items.key === 0, "gate uses a key");
s2.gate.dry[10] = G.GATE_PITY - 1; for (const e of G.combat.blades) if (e) e.hp = e.max = 1e300; G.party.forEach((p) => p && (p.st.atk = 1e300));
let n = 0; while (G.gate && n++ < 4000) { G.step(0.05); }
ok(!G.gate && s2.blades.some((b) => G.SW[b.i].sig === 10), "gate pity drops the boss blade");
// play from a fresh save for the long run
store = {}; G.load(); s = G.s;

// 3. two hours of play
if (!G.party.some(Boolean)) { s.sigils += 10; G.summon(10); G.autoParty(); G.refreshBlades(); }
G.startFloor();
for (let t = 0; t < 2 * 3600; t += 0.05) {
  G.step(0.05); G.onlineTick(0.05); G.ev.length = 0;
  if (G.paused === "paths") G.choosePath(G.PATHS[1]);
  if (G.paused === "shrine") G.shrine(true);
  if (G.paused === "smith") G.smith({ k: "sigils" });
  if (Math.floor(t * 20) % 20 === 0) { G.levelAll(); if (s.sigils >= 10 && G.unlocked("ten")) { G.summon(10); G.ascendAll(); G.autoParty(); G.refreshBlades(); } }
}
ok(isFinite(s.souls) && s.souls >= 0, "gold stays finite");
ok(s.blades.every((b) => b.s <= 5), "stars stay capped");
ok(G.party.some(Boolean), "team never empty");
ok(JSON.stringify(s).length < 2e6, "save size " + JSON.stringify(s).length);
const r = G.offline(48 * 3600);
ok(r.used <= G.mod.offCap * 3600, "away time capped");
ok(isFinite(r.souls), "away rewards finite");

console.log(fails.length ? "FAIL\n" + fails.join("\n") : "all safety checks passed (best floor " + s.best + ", save " + JSON.stringify(s).length + " bytes)");
process.exit(fails.length ? 1 : 0);
