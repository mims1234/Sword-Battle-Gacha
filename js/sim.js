// ===================== SIMULATION (no DOM in this file) =====================
(function () {
  const G = window.G;
  G.ev = [];
  const emit = (t, d) => { const e = d || {}; e.t = t; G.ev.push(e); return e; };
  G.emit = emit;
  let EID = 1;
  G.rage = [0, 0, 0, 0, 0];
  G.paused = null; // null | "user" | "shrine" | "smith" | "paths" | "modal"
  G.rift = null;

  G.curFloor = () => (G.rift ? G.rift.floor : G.s.floor);
  const pm = (k, def) => { const p = G.rift ? null : G.s.path; return p && p[k] != null ? p[k] : def; };
  const hm = (mi) => G.clamp(G.MON[mi].health / 90, 0.5, 1.8);

  const ROSTER = {};
  function roster(id) {
    if (!ROSTER[id]) ROSTER[id] = Object.keys(G.FAM).map(Number).filter((i) => G.FAM[i] === id).sort((a, b) => G.MON[a].health - G.MON[b].health);
    return ROSTER[id];
  }

  // ---------- enemies ----------
  function makeEnemy(mi, f, kind) {
    const m = G.MON[mi], s = G.s, swarm = G.rift && G.rift.mod.id === "swarm";
    const e = {
      id: EID++, mi, name: m.type, cat: G.FAM[mi] || "brute", kind: kind || "", age: 0, cd: G.rand(0.9, 1.9), int: 1.6, frz: 0, burn: 0, bdps: 0,
      max: G.ehp(f) * hm(mi) * pm("ehp", 1) * (swarm ? 0.6 : 1),
      atk: G.eatk(f) * (0.8 + m.difficulty * 0.1) * pm("eatk", 1) * (!G.rift && s.curse > 0 ? 1.5 : 1),
    };
    if (kind === "boss") { e.max *= 9; e.atk *= 1.6; e.int = 1.3; }
    else if (kind === "champ") {
      e.trait = G.pick(G.CHAMP_TRAITS); e.max *= 4; e.atk *= 1.3; e.name = e.trait + " " + m.type;
      if (e.trait === "Molten") e.atk *= 1.5; if (e.trait === "Stoneskin") e.max *= 1.6; if (e.trait === "Frenzied") e.int = 0.95;
    } else if (kind === "gild") { e.max *= 3; e.name = "Gilded " + m.type; }
    else if (kind === "imp") { e.max = G.ehp(f) * 3; e.atk = 0; e.life = 8; e.name = "Treasure Imp"; }
    else if (kind === "hollow") { e.max = G.ehp(f) * 14; e.atk = G.eatk(f) * 2.4; e.int = 1.1; e.name = "The Hollow Blade"; e.cat = "holy"; e.sw = 25 + Math.floor(Math.random() * 5); }
    e.hp = e.max;
    return e;
  }

  function makeWave(C) {
    const f = C.floor, w = C.wave, last = w === C.waves, biome = G.biomeOf(f), list = roster(biome.id).filter((i) => i !== 60 || biome.id !== "demon" || true);
    if (C.hollow && last) return [makeEnemy(59, f, "hollow")];
    if (C.boss && last) {
      const adds = list.slice(0, Math.max(2, Math.floor(list.length / 2)));
      return [makeEnemy(biome.boss, f, "boss"), makeEnemy(G.pick(adds), f), makeEnemy(G.pick(adds), f)];
    }
    const swarm = G.rift && G.rift.mod.id === "swarm";
    const n = swarm ? 5 : 3 + (w % 5 === 0 ? 1 : 0), out = [];
    // Later waves in a floor reach further up the roster.
    const reach = Math.max(2, Math.ceil(list.length * (0.35 + 0.65 * (w / C.waves))));
    for (let i = 0; i < n; i++) {
      const mi = list[Math.floor(Math.pow(Math.random(), 1.4) * reach)];
      const gild = !G.rift && G.s.best >= 3 && Math.random() < 1 / 600;
      out.push(makeEnemy(mi, f, gild ? "gild" : ""));
    }
    if ((C.event === "champion" || (!G.rift && G.s.moon > 0)) && w === Math.ceil(C.waves / 2)) out[0] = makeEnemy(G.pick(list.slice(Math.floor(list.length / 2))), f, "champ");
    if (C.event === "imp" && w === C.impWave) { out.push(makeEnemy(60, f, "imp")); emit("imp"); }
    return out;
  }

  // ---------- blades in combat ----------
  function bladeMax(p) { return p.st.hp * G.mod.hp * (G.rift && G.rift.mod.id === "frail" ? 0.5 : 1); }
  function buildBlades(prev) {
    return G.party.map((p, i) => {
      if (!p) return null;
      const max = bladeMax(p), old = prev && prev[i];
      const keep = old && old.u === p.b.u;
      return { slot: i, u: p.b.u, p, max, hp: keep ? (old.dead ? 0 : max * (old.hp / old.max)) : max, dead: keep ? old.dead : false, cd: keep ? old.cd : G.rand(0.2, p.st.int) };
    });
  }
  G.refreshBlades = function () { G.recalc(); if (G.combat) G.combat.blades = buildBlades(G.combat.blades); };

  // ---------- floors ----------
  G.startFloor = function (delay) {
    const s = G.s, f = G.curFloor();
    const C = { floor: f, wave: 0, waves: G.rift ? 5 : pm("waves", G.WAVES), enemies: [], blades: buildBlades(null), state: "gap", timer: delay || 0.9, t: 0, ft: 0, pend: [], event: null, impWave: 0, hollow: false, boss: f % 10 === 0 && !G.rift };
    G.combat = C;
    if (!G.rift && s.omen.pend && s.omen.pend.at <= f) {
      const id = s.omen.pend.id; s.omen.pend = null;
      if (id === "imp") { C.event = "imp"; C.impWave = G.randInt(2, C.waves - 1); }
      else if (id === "champion") { C.event = "champion"; emit("champion"); }
      else if (id === "shrine") { G.paused = "shrine"; emit("shrine"); }
      else if (id === "smith") { G.paused = "smith"; emit("smith", { offers: smithOffers() }); }
      else if (id === "moon") { s.moon = 10; emit("moon"); }
      else if (id === "hollow") { C.hollow = true; emit("hollowStart"); }
    }
    emit("floorStart", { f });
  };

  function unlockCheck(old, now) {
    G.UNLOCK_TEXT.forEach((u) => { if (old < u[0] && now >= u[0]) emit("unlock", { floor: u[0], text: u[1] }); });
  }

  function rollOmen() {
    const s = G.s;
    if (s.best < 5 || s.omen.pend || s.moon > 0) return;
    s.omen.since++;
    const p = Math.min(1, G.omenChance(s.omen.since) * G.mod.omen * pm("omen", 1));
    if (Math.random() >= p) return;
    let r = Math.random() * 100, pick = G.OMENS[0];
    for (const o of G.OMENS) { if (r < o.w) { pick = o; break; } r -= o.w; }
    s.omen.pend = { id: pick.id, at: s.floor + 2 }; s.omen.since = 0;
    emit("omen", { id: pick.id });
  }

  function pathOffers() {
    const a = G.PATHS.slice().sort(() => Math.random() - 0.5);
    return [a[0], a[1], Object.assign({}, a[2], { hidden: true })];
  }

  function floorCleared() {
    const s = G.s;
    if (G.rift) { G.rift.floor++; emit("floor", { f: G.rift.floor - 1, rift: true }); G.startFloor(0.6); return; }
    const f = s.floor, boss = f % 10 === 0;
    s.stat.floors++; G.track("floors", 1);
    if (f > s.runSig) {
      s.runSig = f;
      const fresh = f >= s.best; // first time this deep, ever
      if (f % 5 === 0 && fresh) { s.sigils += 1; emit("drop", { kind: "sigil", n: 1 }); }
      if (boss) { const n = fresh ? 3 : 1; s.sigils += n; emit("drop", { kind: "sigil", n }); if (G.unlocked("runes") && Math.random() < 0.5) G.dropRune(); }
    }
    if (boss) G.track("boss", 1);
    if (s.curse > 0 && --s.curse === 0) emit("curseEnd");
    if (s.moon > 0 && --s.moon === 0) { s.sigils += 10; emit("moonEnd"); }
    emit("floor", { f, boss });
    if (!s.hold) {
      s.floor = f + 1;
      if (s.floor > s.runBest) s.runBest = s.floor;
      if (s.floor > s.best) { unlockCheck(s.best, s.floor); s.best = s.floor; }
      if (boss) { rollOmen(); G.paused = "paths"; emit("paths", { offers: pathOffers() }); return; }
    }
    rollOmen();
    G.startFloor(1.0);
  }

  function wipe() {
    const s = G.s;
    s.stat.wipes++;
    if (G.rift) { endRift(true); return; }
    const f = s.floor;
    s.wallHits = s.wall === f ? (s.wallHits || 0) + 1 : 1;
    s.wall = f; s.hold = true; s.floor = Math.max(1, f - 1);
    emit("wipe", { f, advice: G.advice(f) });
    G.startFloor(1.8);
  }

  // What should the player do after a wipe? Cheapest fix first.
  G.advice = function (f) {
    const s = G.s, fam = G.biomeOf(f).id;
    const counters = Object.keys(G.EL).filter((el) => G.EL[el].counter.indexOf(fam) >= 0);
    const has = G.party.some((p) => p && counters.indexOf(p.st.el) >= 0);
    const bench = s.blades.some((b) => !G.inParty(b.u) && counters.indexOf(G.SW[b.i].element) >= 0);
    if (counters.length && !has && bench) return { k: "swap", text: `${G.FAMLABEL[fam]} are weak to ${counters.map((c) => G.EL[c].label).join(" and ")}. You have one on the bench.` };
    const cheapest = Math.min.apply(null, G.party.map((p, i) => (p ? G.slotCost(s.lv[i]) : Infinity)));
    if (s.souls >= cheapest) return { k: "level", text: "You have gold to spend. Level up your team." };
    if (s.sigils >= 1) return { k: "summon", text: "You have gems. Summon new blades." };
    if (G.unlocked("rebirth") && (s.wallHits || 0) >= 2 && G.emberGain(s.runBest) > 0) return { k: "rebirth", text: `You keep hitting this floor. Rebirth now for ${G.emberGain(s.runBest)} Essence.` };
    return { k: "farm", text: "Farming one floor back. Souls will carry you through." };
  };
  G.pushOn = function () { G.s.hold = false; };

  // ---------- combat ----------
  function aliveEnemies(C) { return C.enemies.filter((e) => e.hp > 0 && !e.gone); }
  function pickTarget(C) {
    const live = aliveEnemies(C).filter((e) => e.age > 0.45);
    if (!live.length) return null;
    const imp = live.find((e) => e.kind === "imp"); if (imp) return imp;
    return Math.random() < 0.7 ? live[0] : G.pick(live);
  }
  function riftMul(st) {
    if (!G.rift) return 1;
    let m = 1;
    if (G.rift.mod.id === "frail") m *= 2;
    if (G.rift.mod.id === "eclipse" && st.el !== G.bannerEl()) m *= 0.4;
    return m;
  }

  function hurt(C, e, dmg, h) {
    if (e.hp <= 0) return;
    if (e.trait === "Spectral" && !h.dot && Math.random() < 0.25) { emit("miss", { eid: e.id }); return; }
    e.hp -= dmg; G.s.stat.dmg += dmg;
    if (!h.dot) emit("hit", { eid: e.id, dmg, crit: h.crit, counter: h.counter, el: h.el, sub: h.sub });
    if (e.hp <= 0) kill(C, e, h);
  }

  function kill(C, e, h) {
    const s = G.s, f = C.floor;
    e.hp = 0;
    let souls = 0;
    if (!G.rift) {
      const mul = e.kind === "boss" ? 10 : e.kind === "champ" ? 4 : e.kind === "gild" ? 10 : e.kind === "imp" ? 6 : e.kind === "hollow" ? 20 : 1;
      souls = G.soulBase(f) * hm(e.mi) * G.mod.souls * pm("souls", 1) * (s.moon > 0 ? 2 : 1) * (s.curse > 0 ? 2 : 1) * mul;
      s.souls += souls; s.kills++;
      if (e.kind !== "imp" && e.kind !== "hollow") { s.mk[e.mi] = (s.mk[e.mi] || 0) + 1; G.track("kills", 1, e.cat); }
      if (e.kind === "gild") { s.gild[e.mi] = 1; s.sigils += 1; emit("drop", { kind: "sigil", n: 1, eid: e.id }); G.log("Gilded " + G.MON[e.mi].type + " slain: +1 gem", "#ffd24a"); }
      if (e.kind === "imp") { const n = e.life > 5 ? 3 : e.life > 2 ? 2 : 1; s.sigils += n; s.stat.imps++; emit("drop", { kind: "sigil", n, eid: e.id }); G.log(`Treasure imp caught: +${n} gems`, "#ffd24a"); }
      if (e.kind === "champ") { if (G.unlocked("runes")) G.dropRune(e.id); else { s.sigils += 1; emit("drop", { kind: "sigil", n: 1, eid: e.id }); } }
      if (e.kind === "hollow") { s.boon = true; emit("hollowWin"); G.log("The Hollow Blade falls. Your next summon is Legendary or better.", "#ffab2e"); }
    }
    if (G.res.traits.holy) { const low = C.blades.filter((b) => b && !b.dead).sort((a, b) => a.hp / a.max - b.hp / b.max)[0]; if (low) low.hp = Math.min(low.max, low.hp + low.max * 0.04); }
    emit("kill", { eid: e.id, el: h.el, souls, kind: e.kind });
  }

  function strike(C, bl) {
    const st = bl.p.st, tg = pickTarget(C);
    if (!tg) return;
    const crit = Math.random() < G.mod.crit + st.crit, counter = G.EL[st.el].counter.indexOf(tg.cat) >= 0;
    const dmg = st.atk * G.mod.dmg * (crit ? st.cdmg : 1) * (counter ? 1.5 : 1) * (1 + (st.slay[tg.cat] || 0)) * riftMul(st);
    emit("strike", { slot: bl.slot, eid: tg.id, crit, el: st.el });
    C.pend.push({ d: 0.14, eid: tg.id, dmg, crit, counter, slot: bl.slot, el: st.el, main: true });
    if (G.unlocked("ult")) G.rage[bl.slot] = Math.min(100, G.rage[bl.slot] + 14 * st.rage);
    bl.cd = st.int;
  }

  function castUlt(C, bl, manual) {
    G.rage[bl.slot] = 0; G.s.stat.ults++; G.track("ults", 1);
    emit("ult", { slot: bl.slot, name: bl.p.st.ult, el: bl.p.st.el, named: bl.p.st.named });
    C.pend.push({ d: 0.5, ult: true, slot: bl.slot, manual });
    bl.cd = Math.max(bl.cd, 0.7);
  }
  G.castUlt = function (slot) {
    const C = G.combat; if (!C || G.paused || C.state !== "fight") return false;
    const bl = C.blades[slot]; if (!bl || bl.dead || G.rage[slot] < 100) return false;
    castUlt(C, bl, true); return true;
  };

  function applyUlt(C, h) {
    const bl = C.blades[h.slot]; if (!bl) return;
    const st = bl.p.st, el = st.el;
    const base = st.atk * G.mod.dmg * st.ultMul * (h.manual ? 1.25 : 1) * riftMul(st) * (el === "lightning" ? 1.3 : el === "poison" ? 1.15 : 1);
    emit("ultHit", { slot: h.slot, el, named: st.named });
    const tgs = st.named ? aliveEnemies(C) : [pickTarget(C)].filter(Boolean);
    tgs.forEach((e) => {
      const counter = G.EL[el].counter.indexOf(e.cat) >= 0;
      let d = base * (counter ? 1.5 : 1) * (1 + (st.slay[e.cat] || 0));
      if (el === "void" && e.kind !== "boss" && e.kind !== "hollow" && e.hp / e.max < 0.2) d = e.hp;
      if (el === "ice") e.frz = e.kind === "boss" || e.kind === "hollow" ? 0.8 : 2;
      if (el === "fire") { e.burn = 3; e.bdps = Math.max(e.bdps, (base * 0.3) / 3); }
      hurt(C, e, d, { crit: true, counter, el });
    });
    if (el === "holy" || el === "steel") C.blades.forEach((b) => { if (b && !b.dead) b.hp = Math.min(b.max, b.hp + b.max * (el === "holy" ? 0.15 : 0.1)); });
  }

  function applyHit(C, h) {
    if (h.ult) return applyUlt(C, h);
    const e = C.enemies.find((x) => x.id === h.eid);
    if (!e || e.hp <= 0 || e.gone) return;
    let dmg = h.dmg;
    const T = G.res.traits, bl = C.blades[h.slot], st = bl && bl.p.st;
    if (T.void && e.kind !== "boss" && e.kind !== "hollow" && e.hp / e.max < 0.12) dmg = Math.max(dmg, e.hp);
    hurt(C, e, dmg, h);
    if (!st) return;
    const others = aliveEnemies(C).filter((o) => o !== e);
    if (st.cleave && others.length) hurt(C, others[0], dmg * st.cleave, { el: h.el, sub: true });
    if (T.lightning && others.length && Math.random() < 0.25) hurt(C, G.pick(others), dmg * 0.5, { el: "lightning", sub: true });
    if (T.fire && e.hp > 0) { e.burn = 3; e.bdps = Math.max(e.bdps, (dmg * 0.2) / 3); }
    if (T.ice && e.hp > 0 && Math.random() < 0.12) { e.frz = e.kind === "boss" || e.kind === "hollow" ? 0.4 : 1.2; emit("freeze", { eid: e.id }); }
  }

  function enemyAttack(C, e) {
    let pool = C.blades.filter((b) => b && !b.dead && b.slot < 2);
    if (!pool.length) pool = C.blades.filter((b) => b && !b.dead);
    if (!pool.length) return;
    const bl = G.pick(pool), enrage = 1 + Math.max(0, C.ft - 25) * 0.08;
    const dmg = e.atk * enrage;
    bl.hp -= dmg;
    if (G.unlocked("ult")) G.rage[bl.slot] = Math.min(100, G.rage[bl.slot] + 5);
    emit("ehit", { eid: e.id, slot: bl.slot, dmg });
    if (bl.hp <= 0) { bl.hp = 0; bl.dead = true; emit("break", { slot: bl.slot }); }
  }

  function waveCleared(C) {
    C.blades.forEach((b) => { if (b) { b.dead = false; b.hp = Math.min(b.max, b.hp + b.max * 0.35); } });
    C.ft = 0; C.enemies = [];
    if (C.wave >= C.waves) floorCleared();
    else { C.state = "gap"; C.timer = 0.55; emit("waveClear", { w: C.wave }); }
  }

  G.step = function (dt) {
    const C = G.combat;
    if (!C || G.paused) return;
    if (!G.party || !G.party.some(Boolean)) return; // nothing fights until the player has a team
    C.t += dt;
    if (G.rift) { G.rift.t -= dt; if (G.rift.t <= 0) { endRift(false); return; } }
    if (C.state === "gap") {
      C.timer -= dt;
      if (C.timer <= 0) { C.wave++; C.enemies = makeWave(C); C.state = "fight"; C.ft = 0; emit("wave", { w: C.wave, boss: C.boss && C.wave === C.waves }); }
      return;
    }
    C.ft += dt;
    for (let i = C.pend.length - 1; i >= 0; i--) { const h = C.pend[i]; h.d -= dt; if (h.d <= 0) { C.pend.splice(i, 1); applyHit(C, h); } }
    for (const e of C.enemies) {
      if (e.hp <= 0 || e.gone) continue;
      e.age += dt;
      if (e.burn > 0) { e.burn -= dt; hurt(C, e, e.bdps * dt, { dot: true, el: "fire" }); if (e.hp <= 0) continue; }
      if (e.trait === "Vampiric") e.hp = Math.min(e.max, e.hp + e.max * 0.015 * dt);
      if (e.kind === "imp") { e.life -= dt; if (e.life <= 0) { e.gone = true; emit("impFled", { eid: e.id }); } continue; }
      if (e.frz > 0) { e.frz -= dt; continue; }
      if (e.age > 0.7) { e.cd -= dt; if (e.cd <= 0) { e.cd = e.int; enemyAttack(C, e); } }
    }
    let anyBlade = false;
    for (const bl of C.blades) {
      if (!bl || bl.dead) continue;
      anyBlade = true;
      bl.cd -= dt;
      if (G.rage[bl.slot] >= 100 && G.s.set.autoUlt && pickTarget(C)) castUlt(C, bl, false);
      else if (bl.cd <= 0) strike(C, bl);
    }
    if (!aliveEnemies(C).length && !C.pend.length) return waveCleared(C);
    if (!anyBlade) wipe();
  };

  // One sigil for every 15 minutes the game is open.
  G.onlineTick = function (dt) {
    const s = G.s, before = Math.floor(s.stat.online / 900);
    s.stat.online += dt;
    if (Math.floor(s.stat.online / 900) > before) { s.sigils += 1; emit("drop", { kind: "sigil", n: 1 }); }
  };

  // ---------- upgrades ----------
  G.levelSlot = function (i) {
    const s = G.s, c = G.slotCost(s.lv[i]);
    if (!G.party[i] || s.souls < c) return false;
    s.souls -= c; s.lv[i]++; s.hold = false; G.track("levels", 1);
    return true;
  };
  G.levelAll = function () {
    const s = G.s; let n = 0;
    for (;;) {
      let best = -1, cost = Infinity;
      for (let i = 0; i < 5; i++) if (G.party[i]) { const c = G.slotCost(s.lv[i]); if (c < cost) { cost = c; best = i; } }
      if (best < 0 || s.souls < cost || n > 2000) break;
      s.souls -= cost; s.lv[best]++; n++;
    }
    if (n) { s.hold = false; G.track("levels", n); G.refreshBlades(); }
    return n;
  };
  G.equip = function (u, slot) {
    const s = G.s, cur = s.party.indexOf(u);
    if (slot >= G.slotCount() || G.onExpedition(u)) return false;
    if (cur >= 0) s.party[cur] = s.party[slot];
    s.party[slot] = u; s.hold = false;
    G.refreshBlades(); return true;
  };
  G.unequip = function (slot) {
    if (G.s.party.filter((u) => u != null).length <= 1) return false;
    G.s.party[slot] = null; G.refreshBlades(); return true;
  };

  G.rebirth = function () {
    const s = G.s, gain = G.emberGain(s.runBest);
    if (!G.unlocked("rebirth") || gain <= 0) return 0;
    s.embers += gain; s.rebirths++; s.souls = 0; s.lv = [0, 0, 0, 0, 0];
    s.floor = Math.max(1, Math.min(1 + 5 * G.con("momentum"), s.best - 10));
    s.runBest = s.floor; s.runSig = s.floor - 1; s.hold = false; s.wall = 0; s.wallHits = 0; s.path = null; s.curse = 0; s.moon = 0; s.omen.pend = null;
    G.rage = [0, 0, 0, 0, 0]; G.rift = null; G.paused = null;
    G.recalc(); G.startFloor(1.5);
    emit("rebirth", { gain });
    G.log(`Rebirth: +${gain} Essence`, "#ff8a2a");
    return gain;
  };
  G.buyStar = function (id) {
    const st = G.STARS.find((x) => x.id === id), s = G.s, c = G.starCost(st);
    if (G.con(id) >= st.max || s.embers < c) return false;
    s.embers -= c; s.con[id] = G.con(id) + 1; G.refreshBlades(); return true;
  };

  // ---------- gacha ----------
  G.topChance = function () {
    const s = G.s, p = s.pity + 1;
    if (s.boon) return 1;
    let c = G.RATES.legendary + G.RATES.mythic;
    if (Date.now() < s.star) c *= 2;
    if (p >= G.PITY_SOFT) c = c + (1 - c) * ((p - G.PITY_SOFT + 1) / (G.PITY_HARD - G.PITY_SOFT + 1));
    return Math.min(1, c);
  };
  function rollTier() {
    const top = G.topChance(), r = Math.random();
    if (r < top) return Math.random() < 0.1 ? "mythic" : "legendary";
    const q = Math.random() * (G.RATES.common + G.RATES.rare + G.RATES.epic);
    return q < G.RATES.epic ? "epic" : q < G.RATES.epic + G.RATES.rare ? "rare" : "common";
  }
  function forgeOne(tier) {
    const s = G.s, base = tier === "mythic" ? "legendary" : tier;
    let pool = G.SW.filter((w) => w.rarity === base);
    const feat = pool.filter((w) => w.element === G.bannerEl());
    if (feat.length && Math.random() < 0.5) pool = feat;
    const b = G.newBlade(G.pick(pool).index, tier);
    s.blades.push(b); s.pulls++;
    if (G.TIER[tier].rank >= 3) { s.pity = 0; s.boon = false; s.stat.legend++; G.log("Summoned " + G.bladeName(b), G.TIER[tier].color); } else s.pity++;
    return b;
  }
  G.summon = function (n) {
    const s = G.s;
    if (s.sigils < n) return null;
    s.sigils -= n;
    const tiers = []; for (let i = 0; i < n; i++) tiers.push(rollTier());
    if (n >= 10 && !tiers.some((t) => G.TIER[t].rank >= 2)) tiers[n - 1] = "epic";
    const out = tiers.map(forgeOne);
    G.track("pulls", n);
    return out;
  };
  G.ascend = function (target, fodder) {
    if (!G.unlocked("ascend") || target.u === fodder.u || target.i !== fodder.i || target.t !== fodder.t || target.s >= 5 || fodder.lock || G.inParty(fodder.u) || G.onExpedition(fodder.u)) return false;
    target.s = Math.min(5, target.s + 1 + fodder.s);
    if (fodder.r) G.s.runes.push(fodder.r);
    G.s.blades = G.s.blades.filter((b) => b.u !== fodder.u);
    G.refreshBlades(); return true;
  };
  G.fodderFor = (b) => G.s.blades.filter((o) => o.u !== b.u && o.i === b.i && o.t === b.t && !o.lock && !G.inParty(o.u) && !G.onExpedition(o.u));
  G.ascendAll = function () {
    if (!G.unlocked("ascend")) return 0;
    const groups = {}; let n = 0;
    G.s.blades.forEach((b) => { const k = b.i + b.t; (groups[k] = groups[k] || []).push(b); });
    for (const k in groups) {
      const g = groups[k]; if (g.length < 2) continue;
      g.sort((a, b) => (G.inParty(b.u) ? 1 : 0) - (G.inParty(a.u) ? 1 : 0) || b.s - a.s || G.power(b) - G.power(a));
      const keep = g[0];
      for (let i = g.length - 1; i > 0 && keep.s < 5; i--) if (G.ascend(keep, g[i])) n++;
    }
    return n;
  };
  G.salvageValue = (b) => Math.ceil(G.soulBase(G.s.best) * 25 * G.TIER[b.t].salvage * (1 + b.s));
  G.salvage = function (b) {
    if (b.lock || G.inParty(b.u) || G.onExpedition(b.u)) return 0;
    const v = G.salvageValue(b);
    if (b.r) G.s.runes.push(b.r);
    G.s.souls += v; G.s.blades = G.s.blades.filter((x) => x.u !== b.u); return v;
  };
  G.salvageStone = function () {
    let n = 0, v = 0;
    G.s.blades.slice().forEach((b) => { if (b.t === "common" && b.s === 0) { const x = G.salvage(b); if (x) { n++; v += x; } } });
    return { n, v };
  };

  // ---------- runes ----------
  G.dropRune = function (eid) {
    const t = G.s.best >= 80 && Math.random() < 0.1 ? 3 : G.s.best >= 50 && Math.random() < 0.2 ? 2 : 1;
    const r = { k: G.pick(G.RUNE_KEYS), t };
    G.s.runes.push(r); emit("drop", { kind: "rune", eid, rune: r });
    G.log("Found " + G.runeName(r), "#55c6f8");
    return r;
  };
  G.runeName = (r) => G.RUNE[r.k].name + " " + ["I", "II", "III"][r.t - 1];
  G.runeText = (r) => G.RUNE[r.k].lab(G.RUNE[r.k].v[r.t - 1]);
  G.socket = function (b, idx) {
    const s = G.s, r = s.runes.splice(idx, 1)[0]; if (!r) return false;
    if (b.r) s.runes.push(b.r);
    b.r = r; G.refreshBlades(); return true;
  };
  G.unsocket = function (b) { if (!b.r) return false; G.s.runes.push(b.r); b.r = null; G.refreshBlades(); return true; };
  G.fuseRunes = function (k, t) {
    const s = G.s; if (t >= 3) return false;
    const idx = []; s.runes.forEach((r, i) => { if (r.k === k && r.t === t && idx.length < 3) idx.push(i); });
    if (idx.length < 3) return false;
    idx.reverse().forEach((i) => s.runes.splice(i, 1));
    s.runes.push({ k, t: t + 1 }); return true;
  };

  // ---------- events ----------
  function smithOffers() {
    const s = G.s, mine = G.party.filter(Boolean).map((p) => p.b);
    const low = mine.slice().sort((a, b) => a.s - b.s)[0], any = G.pick(mine);
    const offers = [{ k: "reroll", u: any.u, text: "Reforge the affixes on " + G.bladeName(any) }];
    if (low.s < 5) offers.push({ k: "star", u: low.u, text: "Add a ★ rank to " + G.bladeName(low) }); else offers.push({ k: "sigils", text: "Take 3 gems" });
    offers.push(G.unlocked("runes") ? { k: "rune", text: "Take a rune from the smith's pack" } : { k: "sigils", text: "Take 3 gems" });
    return offers;
  }
  G.smith = function (o) {
    const s = G.s, b = G.blade(o.u);
    if (o.k === "reroll" && b) { const nb = G.newBlade(b.i, b.t); s.uid--; b.a = nb.a; }
    else if (o.k === "star" && b) b.s = Math.min(5, b.s + 1);
    else if (o.k === "rune") G.dropRune();
    else s.sigils += 3;
    G.paused = null; G.refreshBlades();
  };
  G.shrine = function (accept) { if (accept) { G.s.curse = 5; emit("curse"); } G.paused = null; };
  G.choosePath = function (p) {
    const s = G.s;
    s.path = p ? { id: p.id, name: p.name, souls: p.souls, ehp: p.ehp, eatk: p.eatk, waves: p.waves, omen: p.omen } : null;
    if (p && p.hidden) { s.sigils += 1; }
    G.paused = null;
    // The floor was built before the choice; rebuild so the path applies now.
    G.startFloor(0.8);
  };
  G.openSealed = function () {
    const s = G.s; if (s.omen.sealed <= 0) return null;
    s.omen.sealed--;
    const r = Math.random();
    if (r < 0.6) { const n = G.randInt(2, 4); s.sigils += n; return `+${n} gems`; }
    if (r < 0.85 && G.unlocked("runes")) return G.runeName(G.dropRune());
    const v = Math.ceil(G.soulBase(s.best) * 400 * G.mod.souls); s.souls += v; return `+${G.fmt(v)} gold`;
  };
  G.secret = function () {
    const s = G.s; s.secrets++;
    const v = Math.ceil(G.soulBase(s.best) * 150 * G.mod.souls); s.souls += v;
    let extra = ""; if (s.secrets % 5 === 0) { s.sigils += 1; extra = " +1 gem"; }
    const line = G.WHISPERS[(s.secrets - 1) % G.WHISPERS.length];
    G.log("A whisper: " + line, "#b56bff");
    return { souls: v, line, extra };
  };
  G.starfall = function () { G.s.star = Date.now() + 10 * 60 * 1000; emit("star"); G.log("A falling star: Legendary odds doubled for 10 minutes", "#ffe9a8"); };

  // ---------- expeditions ----------
  G.EXP_SLOTS = 2;
  G.sendExp = function (uids, hours) {
    const s = G.s;
    if (!G.unlocked("expedition") || s.exp.length >= G.EXP_SLOTS || !uids.length || uids.some((u) => G.inParty(u) || G.onExpedition(u))) return false;
    s.exp.push({ u: uids.slice(0, 3), end: Date.now() + hours * 3600e3, h: hours }); return true;
  };
  G.claimExp = function (i) {
    const s = G.s, e = s.exp[i];
    if (!e || Date.now() < e.end) return null;
    let rank = 0; e.u.forEach((u) => { const b = G.blade(u); if (b) rank += 1 + G.TIER[b.t].rank + b.s * 0.5; });
    const souls = Math.ceil(G.soulBase(s.best) * 120 * e.h * rank * G.mod.souls), sig = { 1: 1, 4: 3, 8: 5 }[e.h] || 1;
    s.souls += souls; s.sigils += sig;
    let rune = null; if (G.unlocked("runes") && Math.random() < Math.min(0.9, 0.08 * e.h * (1 + rank / 6))) rune = G.dropRune();
    s.exp.splice(i, 1);
    return { souls, sig, rune };
  };

  // ---------- rift ----------
  G.riftMod = () => G.RIFT_MODS[G.hash(G.day()) % G.RIFT_MODS.length];
  G.startRift = function () {
    const s = G.s;
    if (!G.unlocked("rift") || s.rift.day === G.day() || G.rift) return false;
    const start = Math.max(1, Math.floor(s.best * 0.6));
    s.rift.day = G.day(); G.rift = { t: 180, floor: start, start, mod: G.riftMod() };
    G.startFloor(1.2); emit("riftStart"); return true;
  };
  function endRift(wiped) {
    const s = G.s, depth = G.rift.floor - G.rift.start, rew = 2 + Math.floor(depth / 2);
    s.sigils += rew; s.rift.best = Math.max(s.rift.best || 0, depth); G.rift = null;
    emit("riftEnd", { depth, rew, wiped }); G.log(`Daily trial over at depth ${depth}: +${rew} gems`, "#b56bff");
    G.startFloor(1.5);
  }

  // ---------- away time ----------
  G.estimate = function (f) {
    const dps = Math.max(0.01, G.partyDps()), hpAll = G.partyHp();
    const tKill = (G.ehp(f) * 3.2 * pm("ehp", 1)) / dps, inc = (3 * G.eatk(f) * pm("eatk", 1)) / 1.6;
    let ok = inc * tKill < hpAll * 0.9;
    if (f % 10 === 0) { const tb = (G.ehp(f) * 11) / dps; ok = ok && tb < 40 && (G.eatk(f) * 1.6 / 1.3 + (2 * G.eatk(f)) / 1.6) * tb < hpAll; }
    const waves = pm("waves", G.WAVES);
    return { ok, t: waves * (tKill + 1.4) + 1, souls: G.soulBase(f) * waves * 3.2 * G.mod.souls * pm("souls", 1) };
  };
  G.offline = function (secs) {
    const s = G.s, cap = G.mod.offCap * 3600, used = Math.min(secs, cap);
    let left = used * G.mod.offRate, f = s.floor, souls = 0, sig = 0, cleared = 0, guard = 0;
    while (left > 0 && guard++ < 400) {
      const e = G.estimate(f);
      if (s.hold || !e.ok || f - s.floor >= 40) {
        const g = G.estimate(Math.max(1, e.ok ? f : f - 1)); const n = left / g.t; souls += n * g.souls; cleared += n; left = 0; break;
      }
      if (left < e.t) { souls += (left / e.t) * e.souls; left = 0; break; }
      left -= e.t; souls += e.souls; cleared++;
      if (f > s.runSig) { s.runSig = f; const fresh = f >= s.best; if (f % 5 === 0 && fresh) sig++; if (f % 10 === 0) sig += fresh ? 3 : 1; }
      f++;
    }
    const gained = f - s.floor;
    s.floor = f; if (f > s.runBest) s.runBest = f; if (f > s.best) { unlockCheck(s.best, f); s.best = f; }
    souls = Math.floor(souls); s.souls += souls; s.sigils += sig; s.stat.floors += Math.floor(cleared);
    const sealed = s.best >= 5 ? Math.min(3 - s.omen.sealed, Math.floor(cleared / 20)) : 0;
    s.omen.sealed += Math.max(0, sealed);
    return { secs, used, souls, floors: gained, sig, sealed: Math.max(0, sealed), capped: secs > cap };
  };
})();
