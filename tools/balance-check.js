// Rough balance check for the 1000-floor curve:  node tools/balance-check.js
// For each realm, builds a team of that realm's blades (and one realm behind), gives it the slot
// levels gold would buy by then, and finds the deepest floor G.estimate says it can clear.
const path = require("path");
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
for (const f of ["data.swords.js", "data.monsters.js", "data.game.js", "state.js", "data.realms.js", "sim.js", "shop.js"]) require(path.join(__dirname, "..", "js", f));
const G = window.G;
G.load();

// Slot level a player can afford around floor f: total gold ~ a few hundred kills' worth of that floor.
const levelAt = (f) => { let L = 0, gold = G.soulBase(f) * 2500 * (1 + 0.1 * G.con("avarice")); while (G.slotCost(L) * 5 < gold) { gold -= G.slotCost(L) * 5; L++; } return L; };

function wall(realm, tier, stars, upg) {
  const s = G.s;
  s.con = { might: upg, vital: upg, avarice: upg, fortune: 5 };
  s.blades = []; s.party = [null, null, null, null, null];
  const pool = G.SW.filter((w) => w.realm === realm && w.rarity === tier && !w.sig);
  for (let i = 0; i < 5; i++) { const b = G.newBlade(pool[i % pool.length].index, tier); b.s = stars; s.blades.push(b); s.party[i] = b.u; }
  s.best = 1000; G.recalc();
  let f = Math.max(1, realm * 100 - 50);
  for (; f < 1000; f++) { s.lv = [0, 1, 2, 3, 4].map(() => levelAt(f)); G.recalc(); if (!G.estimate(f).ok) break; }
  return f;
}
console.log("realm | legendary 3* (current realm) | legendary 3* (one realm behind) | epic 1*");
for (let r = 0; r < 10; r++) {
  const upg = Math.min(100, 10 + r * 10);
  console.log(`${String(r + 1).padStart(5)} | wall at floor ${String(wall(r, "legendary", 3, upg)).padStart(4)}            | ${r ? String(wall(r - 1, "legendary", 3, upg)).padStart(4) : "   -"}                          | ${wall(r, "epic", 1, upg)}`);
}
