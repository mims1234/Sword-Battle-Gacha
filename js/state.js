// ===================== STATE, SAVE, DERIVED STATS =====================
(function () {
  const G = window.G;
  G.VERSION = "4.0";
  G.SAVE_KEY = "idle_blade_master_v4";
  G.V3_KEY = "idle_blade_master_v3";
  G.SW = window.SWORDS_DATA || [];
  G.MON = window.MONSTERS_DATA || [];

  // ---------- utilities ----------
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.randInt = (a, b) => Math.floor(G.rand(a, b + 1));
  G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  G.clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  G.rng = function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  G.hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
  const UNITS = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  G.fmt = function (n) {
    if (!isFinite(n)) return "∞";
    if (n < 1000) return String(Math.floor(n));
    const e = Math.min(UNITS.length - 1, Math.floor(Math.log10(n) / 3));
    const v = n / Math.pow(1000, e);
    return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + UNITS[e];
  };
  G.fmtTime = function (sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}h ${String(m).padStart(2, "0")}m` : m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
  };
  G.day = function () { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  G.bannerEl = function () { return ["fire", "ice", "lightning", "holy", "void", "poison"][Math.floor(Date.now() / 6048e5) % 6]; };

  // ---------- state ----------
  G.fresh = function () {
    return {
      v: 4, souls: 0, sigils: 10, embers: 0, runes: [], blades: [], party: [null, null, null, null, null], lv: [0, 0, 0, 0, 0],
      floor: 1, best: 1, runBest: 1, runSig: 0, hold: false, wall: 0, pity: 0, pulls: 0, kills: 0, mk: {}, gild: {}, con: {}, rebirths: 0,
      bounty: null, feats: {}, exp: [], rift: { day: "", best: 0 }, omen: { since: 0, pend: null, sealed: 0 }, moon: 0, curse: 0, path: null,
      boon: false, star: 0, secrets: 0, uid: 1, log: [],
      set: { sound: true, calm: false, autoUlt: true, speed: 1 },
      stat: { dmg: 0, ults: 0, legend: 0, wipes: 0, imps: 0, floors: 0, online: 0 },
      last: Date.now(), born: Date.now(),
    };
  };
  G.s = G.fresh();

  G.newBlade = function (idx, tier) {
    const sw = G.SW[idx], T = G.TIER[tier || sw.rarity];
    let n = T.affix + (tier === "rare" || (!tier && sw.rarity === "rare") ? (Math.random() < 0.5 ? 1 : 0) : 0);
    const keys = G.AFFIX_KEYS.slice().sort(() => Math.random() - 0.5).slice(0, n);
    const a = keys.map((k) => { const d = G.AFFIX[k].v; return [k, Math.round((d[0] + (d[1] - d[0]) * (0.2 + 0.8 * Math.random())) * T.scale)]; });
    return { u: G.s.uid++, i: idx, t: tier || sw.rarity, s: 0, a, r: null, lock: false };
  };
  G.bladeName = function (b) {
    const base = G.SW[b.i].name;
    if (b.t === "mythic") return base + ", Unbound";
    const p = b.a[0] && b.t !== "common" ? G.AFFIX[b.a[0][0]].pre + " " : "";
    const s = b.a[1] ? " " + G.AFFIX[b.a[1][0]].suf : "";
    return p + base + s;
  };
  G.blade = (u) => (u == null ? null : G.s.blades.find((b) => b.u === u) || null);
  G.inParty = (u) => G.s.party.indexOf(u) >= 0;
  G.onExpedition = (u) => G.s.exp.some((e) => e.u.indexOf(u) >= 0);
  G.slotCount = () => (G.s.best >= G.UNLOCK.slot5 ? 5 : G.s.best >= G.UNLOCK.slot4 ? 4 : 3);
  G.unlocked = (k) => G.s.best >= G.UNLOCK[k];
  G.con = (id) => G.s.con[id] || 0;
  G.starCost = (st) => st.base + st.step * G.con(st.id);

  // ---------- scaling ----------
  G.slotCost = (L) => Math.floor(8 * Math.pow(1.15, L));
  G.slotMult = (L) => Math.pow(1.08, L);
  G.ehp = (f) => 48 * Math.pow(1.125, f - 1);
  G.eatk = (f) => 2.2 * Math.pow(1.11, f - 1);
  G.soulBase = (f) => 1.0 * Math.pow(1.07, f - 1);
  G.emberGain = (f) => Math.floor(Math.pow(Math.max(0, f) / 10, 1.6));

  // ---------- derived ----------
  G.bladeStat = function (b, lv) {
    const sw = G.SW[b.i], tm = b.t === "mythic" ? 1.6 : 1, star = 1 + 0.25 * b.s, L = G.slotMult(lv || 0);
    const A = {}; b.a.forEach((x) => (A[x[0]] = (A[x[0]] || 0) + x[1]));
    const R = b.r ? { [b.r.k]: G.RUNE[b.r.k].v[b.r.t - 1] } : {};
    const st = {
      el: sw.element || "steel", role: sw.attack > sw.defense * 1.6 ? "Striker" : "Warden",
      atk: sw.attack * tm * star * L * (1 + ((A.atk || 0) + (R.might || 0)) / 100),
      hp: (20 + sw.defense * 10) * tm * star * L * (1 + ((A.hp || 0) + (R.ward || 0)) / 100),
      int: 1.2 / (1 + ((A.aspd || 0) + (R.haste || 0)) / 100),
      crit: (A.crit || 0) / 100, cdmg: 2 + (A.cdmg || 0) / 100,
      rage: 1 + ((A.rage || 0) + (R.fury || 0)) / 100,
      soul: ((A.soul || 0) + (R.greed || 0)) / 100, cleave: (A.cleave || 0) / 100, slay: {},
      ult: sw.specialPower || "Heavy Strike", named: !!sw.specialPower,
      ultMul: !sw.specialPower ? 4 : b.t === "mythic" ? 9 : sw.rarity === "legendary" ? 7 : 5,
    };
    for (const k in A) if (k.indexOf("slay_") === 0) st.slay[k.slice(5)] = A[k] / 100;
    return st;
  };
  // Rough single number for sorting and compare arrows.
  G.power = function (b, lv) {
    const st = G.bladeStat(b, lv || 0);
    return (st.atk / st.int) * (1 + (0.1 + st.crit) * (st.cdmg - 1)) + st.hp * 0.08;
  };

  G.recalc = function () {
    const s = G.s, n = G.slotCount();
    for (let i = 0; i < 5; i++) if (i >= n || !G.blade(s.party[i])) s.party[i] = null;
    G.party = s.party.map((u, i) => { const b = G.blade(u); return b ? { slot: i, b, st: G.bladeStat(b, s.lv[i]) } : null; });
    const cnt = {}; G.party.forEach((p) => p && (cnt[p.st.el] = (cnt[p.st.el] || 0) + 1));
    const res = { dmg: 1, traits: {}, list: [] };
    for (const el in cnt) if (cnt[el] >= 2) { const full = cnt[el] >= 3; res.dmg += full ? 0.25 : 0.1; if (full) res.traits[el] = true; res.list.push({ el, n: cnt[el], full }); }
    G.res = res;
    const mastered = Object.keys(s.mk).filter((k) => s.mk[k] >= 50).length;
    G.bestiaryBonus = Math.min(0.25, mastered * 0.01);
    let soul = 0; G.party.forEach((p) => p && (soul += p.st.soul));
    G.mod = {
      dmg: (1 + 0.1 * G.con("might")) * res.dmg * (1 + G.bestiaryBonus) * (res.traits.poison ? 1.15 : 1),
      hp: (1 + 0.1 * G.con("vital")) * (res.traits.steel ? 1.3 : 1),
      souls: (1 + 0.1 * G.con("avarice")) * (1 + soul),
      crit: 0.1 + 0.02 * G.con("fortune"),
      offRate: 0.3 + 0.05 * G.con("vigil"), offCap: 8 + G.con("vigil"),
      omen: 1 + 0.1 * G.con("insight"),
    };
  };

  G.partyDps = function () {
    let d = 0;
    G.party.forEach((p) => { if (p) d += (p.st.atk / p.st.int) * (1 + (G.mod.crit + p.st.crit) * (p.st.cdmg - 1)); });
    return d * G.mod.dmg * 1.15;
  };
  G.partyHp = function () { let h = 0; G.party.forEach((p) => p && (h += p.st.hp)); return h * G.mod.hp; };

  G.log = function (text, color) {
    G.s.log.unshift({ t: text, c: color || "" });
    if (G.s.log.length > 40) G.s.log.length = 40;
    G.ui && G.ui.dirty("journal");
  };

  // ---------- bounties ----------
  G.rollBounties = function () {
    const day = G.day(), s = G.s;
    if (s.bounty && s.bounty.day === day) return;
    const r = G.rng(G.hash(day)), pool = G.BOUNTY_POOL.slice(), list = [];
    const fam = G.BIOMES[Math.floor(r() * G.BIOMES.length)].id;
    for (let i = 0; i < 3; i++) { const t = pool.splice(Math.floor(r() * pool.length), 1)[0]; list.push({ k: t.k, goal: t.goal, rew: t.rew, n: 0, done: false, fam }); }
    s.bounty = { day, list };
  };
  G.bountyText = function (b) { const t = G.BOUNTY_POOL.find((x) => x.k === b.k); return t.text(b.goal, b.fam); };
  G.track = function (k, n, fam) {
    const s = G.s;
    if (!s.bounty || !G.unlocked("bounty")) return;
    s.bounty.list.forEach((b) => {
      if (b.done || b.n >= b.goal) return;
      if (b.k === k || (b.k === "famkills" && k === "kills" && fam === b.fam)) { b.n = Math.min(b.goal, b.n + n); if (b.n >= b.goal) G.ui && G.ui.toast("Bounty complete: " + G.bountyText(b), "#c9a24b"); }
    });
  };

  // ---------- save / load ----------
  G.save = function () {
    try { G.s.last = Date.now(); localStorage.setItem(G.SAVE_KEY, JSON.stringify(G.s)); } catch (e) { /* storage unavailable */ }
  };
  function migrateV3(raw) {
    const old = JSON.parse(raw).gameState; if (!old) return false;
    const s = G.fresh(); G.s = s;
    for (const rarity of ["common", "rare", "epic", "legendary"]) {
      const col = (old.collection && old.collection[rarity]) || {};
      for (const idx in col) { if (!G.SW[idx]) continue; const b = G.newBlade(+idx); b.s = Math.min(5, Math.max(0, col[idx] - 1)); s.blades.push(b); }
    }
    s.souls = old.souls || 0; s.sigils = 10 + (old.chests || 0); s.kills = old.kills || 0; s.pulls = old.totalPulls || 0;
    s.embers = ((old.prestige && old.prestige.count) || 0) * 5 + (old.enchant || 0);
    s.stat.legend = old.totalLegendary || 0;
    const byName = {}; G.MON.forEach((m, i) => (byName[m.type] = i));
    for (const t in old.monsterKills || {}) if (byName[t] != null) s.mk[byName[t]] = old.monsterKills[t];
    s.migrated = true;
    return true;
  }
  function starter() {
    const s = G.s;
    [0, 6, 9].forEach((i, n) => { const b = G.newBlade(i); s.blades.push(b); s.party[n] = b.u; });
  }
  G.load = function () {
    let ok = false;
    try {
      const raw = localStorage.getItem(G.SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw), f = G.fresh();
        G.s = Object.assign(f, d);
        G.s.set = Object.assign(G.fresh().set, d.set || {});
        G.s.stat = Object.assign(G.fresh().stat, d.stat || {});
        G.s.omen = Object.assign({ since: 0, pend: null, sealed: 0 }, d.omen || {});
        ok = true;
      } else {
        const v3 = localStorage.getItem(G.V3_KEY);
        if (v3) ok = migrateV3(v3);
      }
    } catch (e) { ok = false; }
    if (!ok) G.s = G.fresh();
    if (!G.s.blades.length) starter();
    if (!G.s.party.some((u) => G.blade(u))) G.autoParty();
    G.rollBounties();
    G.recalc();
    return ok;
  };
  G.autoParty = function () {
    const s = G.s, n = G.slotCount();
    const free = s.blades.filter((b) => !G.onExpedition(b.u)).sort((a, b) => G.power(b) - G.power(a)).slice(0, n);
    // Wardens to the front two slots.
    free.sort((a, b) => G.bladeStat(b).hp - G.bladeStat(a).hp);
    s.party = [null, null, null, null, null];
    free.forEach((b, i) => (s.party[i] = b.u));
  };
  G.exportSave = () => btoa(unescape(encodeURIComponent(JSON.stringify(G.s))));
  G.importSave = function (str) {
    try { const d = JSON.parse(decodeURIComponent(escape(atob(str.trim())))); if (d.v !== 4) return false; localStorage.setItem(G.SAVE_KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
  };
  G.wipeSave = function () { try { localStorage.removeItem(G.SAVE_KEY); localStorage.removeItem(G.V3_KEY); } catch (e) { /* ignore */ } };
})();
