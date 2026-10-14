// ===================== CANVAS RENDERER =====================
(function () {
  const G = window.G, R = (G.render = {});
  let cv, c, W = 480, H = 270, k = 1, T = 0, sc = 1;
  const imgS = new Image(), imgM = new Image();
  R.ready = 0;
  imgS.onload = imgM.onload = () => { R.ready++; G.ui && G.ui.dirty("all"); };
  imgS.src = "assets/sprite_swords.png"; imgM.src = "assets/monsters.png";
  const fl = document.createElement("canvas"); fl.width = fl.height = 32; const fc = fl.getContext("2d");

  // monster index -> sheet cell
  const ROWS = [8, 3, 4, 2, 6, 5, 12, 10, 5, 2, 2, 2, 3], CELL = [];
  ROWS.forEach((n, r) => { for (let i = 0; i < n; i++) CELL.push([i * 32, r * 32, r, i]); });
  G.moCell = (i) => CELL[i] || CELL[0];
  G.swCss = (i) => `background-position:${((i % 6) / 5) * 100}% ${(Math.floor(i / 6) / 4) * 100}%`;
  G.moCss = (i) => { const p = G.moCell(i); return `background-position:${(p[3] / 11) * 100}% ${(p[2] / 12) * 100}%`; };

  const rnd = G.rand;
  let parts = [], nums = [], orbs = [], slashes = [], beams = [], rings = [], weather = [];
  let bv = [], ev = new Map(), dress = null, scroll = 0, scrollV = 0, shake = 0, flash = 0, flashCol = "#fff", dim = 0, banner = null;
  let eyes = null, eyesT = rnd(50, 110), star = null, starT = rnd(200, 420);
  R.stop = 0;
  const calm = () => G.s.set.calm;

  // ---------- layout ----------
  R.resize = function () {
    if (!cv) return;
    const w = cv.clientWidth, h = cv.clientHeight, d = Math.min(window.devicePixelRatio || 1, 2);
    if (!w || !h) return;
    const asp = w / h; if (asp >= 1.11) { H = 270; W = Math.round(270 * asp); } else { W = 300; H = Math.min(560, Math.round(300 / asp)); } sc = W < 400 ? 0.88 : 1;
    cv.width = Math.round(w * d); cv.height = Math.round(h * d); k = cv.width / W;
    for (let i = 0; i < 5; i++) { const p = bpos(i); if (bv[i]) { bv[i].bx = p[0]; bv[i].by = p[1]; } }
  };
  const FY = () => H - 135;
  function bpos(i) { const fy = FY(); return i < 2 ? [W * 0.29, fy + 38 + i * 56] : [W * 0.12 + (i === 3 ? -6 : 4), fy + 20 + (i - 2) * 44]; }
  function epos(j, n, big) {
    const fy = FY();
    if (big) return [W * 0.74, fy + 58];
    const span = 96, y = n <= 1 ? fy + 60 : fy + 22 + (span * j) / (n - 1);
    return [W * (0.62 + (j % 2) * 0.15 + (j > 2 ? 0.07 : 0)), y];
  }

  // ---------- fx helpers ----------
  function burst(x, y, col, n, sp, g) { if (parts.length > 320) return; for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(0.3, 1) * sp; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, l: rnd(0.3, 0.8), col, g: g == null ? 160 : g, s: 2 }); } }
  function num(x, y, text, col, big) { nums.push({ x: x + rnd(-8, 8), y, t: 0, s: text, col, big }); if (nums.length > 40) nums.shift(); }
  function glow(x, y, r, col, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "transparent"); c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1; }
  function sprite(img, sx, sy, x, y, s, rot, a, flip) { c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (flip) c.scale(-1, 1); c.globalAlpha = a; c.drawImage(img, sx, sy, 32, 32, -16 * s, -16 * s, 32 * s, 32 * s); c.restore(); }
  function tinted(img, sx, sy, col, a) { fc.globalCompositeOperation = "source-over"; fc.globalAlpha = 1; fc.clearRect(0, 0, 32, 32); fc.drawImage(img, sx, sy, 32, 32, 0, 0, 32, 32); fc.globalCompositeOperation = "source-atop"; fc.globalAlpha = a; fc.fillStyle = col; fc.fillRect(0, 0, 32, 32); return fl; }
  R.banner = function (text, col, sub) { banner = { text, col: col || "#f3e6c8", sub, t: 0 }; };
  R.flash = function (col, a) { if (calm()) a *= 0.3; flash = a; flashCol = col; };

  // ---------- seeded dressing: every floor looks a little different ----------
  function makeDress(f) {
    const r = G.rng(f * 7919 + 13), b = G.biomeOf(f), props = [];
    const style = Math.floor(r() * 3);
    if (r() < 0.55) for (let i = 0; i < 3; i++) props.push({ t: "chain", x: r() * 700, len: 30 + r() * 60 });
    if (r() < 0.45) for (let i = 0; i < 2; i++) props.push({ t: "banner", x: r() * 700, h: 40 + r() * 30 });
    if (r() < 0.3) props.push({ t: "statue", x: r() * 700 });
    if (r() < 0.16) props.push({ t: "window", x: 80 + r() * 500 });
    if (r() < 0.14) props.push({ t: "cage", x: r() * 700, len: 20 + r() * 40 });
    if (r() < 0.08) props.push({ t: "skull", x: 100 + r() * 500 });
    return { f, b, style, props };
  }
  function makeWeather(type) {
    weather = [];
    for (let i = 0; i < 34; i++) weather.push({ x: rnd(0, 640), y: rnd(0, H), v: rnd(6, 20), p: rnd(0, 6) });
    weather.type = type;
  }

  // ---------- sim events ----------
  const EL = () => G.EL;
  R.on = function (e) {
    const C = G.combat;
    switch (e.t) {
      case "floorStart":
        dress = makeDress(e.f); if (weather.type !== dress.b.weather) makeWeather(dress.b.weather);
        ev.forEach((v) => { if (!v.dying) v.dying = 0.6; });
        scrollV = 160;
        break;
      case "wave": {
        const live = C.enemies, n = live.length;
        live.forEach((en, j) => {
          const big = en.kind === "boss" || en.kind === "hollow", p = epos(big ? 0 : j - (C.boss && C.wave === C.waves ? 0 : 0), n, big);
          if (!big && C.boss && C.wave === C.waves) { p[0] = W * (0.6 + (j - 1) * 0.26); p[1] = FY() + (j === 1 ? 22 : 112); }
          const base = en.kind === "boss" ? 3.1 : en.kind === "hollow" ? 2.6 : en.kind === "champ" ? 2.5 : 1.7 + G.MON[en.mi].difficulty * 0.14;
          ev.set(en.id, { id: en.id, mi: en.mi, kind: en.kind, sw: en.sw, name: en.name, trait: en.trait, x: W + 30 + j * 16, tx: p[0], y: p[1], s: base * sc, hit: 0, dying: 0, hp: 1, bump: 0, age: 0 });
        });
        if (e.boss) { R.banner(C.enemies[0].name.toUpperCase(), "#ff5a4a", "Guardian of " + G.biomeOf(C.floor).name); if (!calm()) shake = 5; }
        break;
      }
      case "waveClear": scrollV = 120; break;
      case "strike": { const b = bv[e.slot], v = ev.get(e.eid); if (b && v) { b.t = 0; b.tx = v.x - 26 * v.s * 0.5 - 8; b.ty = v.y; } break; }
      case "hit": {
        const v = ev.get(e.eid); if (!v) break;
        const col = EL()[e.el] ? EL()[e.el].color : "#fff";
        v.hit = 1;
        if (!e.sub) slashes.push({ x: v.x - 8, y: v.y, a: rnd(-0.9, 0.9), l: 0.22, col });
        burst(v.x - 6, v.y, col, e.crit ? 10 : 5, 90);
        num(v.x, v.y - 14 * v.s, G.fmt(e.dmg), e.crit ? "#ffd866" : e.counter ? col : "#f3e6c8", e.crit);
        if (e.crit && !calm()) { shake = Math.max(shake, 4); R.stop = 0.04; }
        break;
      }
      case "miss": { const v = ev.get(e.eid); if (v) num(v.x, v.y - 20, "miss", "#8fa3c8"); break; }
      case "freeze": { const v = ev.get(e.eid); if (v) burst(v.x, v.y, "#bff3ff", 8, 60, 20); break; }
      case "kill": {
        const v = ev.get(e.eid); if (!v) break;
        v.dying = 0.001; v.el = e.el;
        const col = EL()[e.el] ? EL()[e.el].color : "#ff9a4a";
        if (e.el === "ice") burst(v.x, v.y, "#d8f6ff", 18, 150, 420);
        else if (e.el === "void") { for (let i = 0; i < 14; i++) { const a = rnd(0, 6.28); parts.push({ x: v.x + Math.cos(a) * 40, y: v.y + Math.sin(a) * 40, vx: -Math.cos(a) * 90, vy: -Math.sin(a) * 90, l: 0.42, col, g: 0, s: 2 }); } }
        else if (e.el === "holy") rings.push({ x: v.x, y: v.y, t: 0, col, max: 60, d: 0.5 });
        else if (e.el === "poison") burst(v.x, v.y, col, 14, 60, -60);
        else burst(v.x, v.y, e.el === "fire" ? "#ff9a4a" : col, 16, 130);
        const n = e.kind === "boss" ? 9 : e.kind ? 5 : 2;
        for (let i = 0; i < n && orbs.length < 40; i++) orbs.push({ x: v.x, y: v.y, vx: rnd(-90, 90), vy: rnd(-150, -40), t: 0 });
        if (e.kind === "boss" || e.kind === "hollow") { rings.push({ x: v.x, y: v.y, t: 0, col: "#fff", max: 500, d: 0.8 }); R.flash("#fff", 0.5); if (!calm()) { shake = 10; R.stop = 0.12; } }
        break;
      }
      case "ehit": {
        const v = ev.get(e.eid), b = bv[e.slot]; if (v) v.bump = 1;
        if (b) { b.hitT = 1; num(b.x, b.y - 22, "-" + G.fmt(e.dmg), "#ff6a5a"); burst(b.x + 8, b.y, "#ff6a5a", 3, 60); }
        break;
      }
      case "break": { const b = bv[e.slot]; if (b) burst(b.x, b.y, "#c3ccd9", 14, 110); break; }
      case "ult": { const b = bv[e.slot]; if (b) b.cast = 1.5; dim = 1.5; R.banner(e.name.toUpperCase(), EL()[e.el].color); break; }
      case "ultHit": { const b = bv[e.slot]; if (b) rings.push({ x: b.x, y: b.y, t: 0, col: EL()[e.el].color, max: e.named ? 640 : 160, d: 0.7 }); if (!calm()) shake = e.named ? 8 : 4; break; }
      case "drop": {
        const v = e.eid && ev.get(e.eid), x = v ? v.x : W * rnd(0.45, 0.6), y = v ? v.y + 12 : FY() + rnd(40, 100);
        beams.push({ x, y, l: 2.6, col: e.kind === "rune" ? "#55c6f8" : "#ffd24a", glyph: e.kind === "rune" ? G.RUNE[e.rune.k].glyph : "◆" });
        break;
      }
      case "impFled": { const v = ev.get(e.eid); if (v) { burst(v.x, v.y, "#ffd24a", 10, 80); v.dying = 0.7; } break; }
      case "rebirth": R.flash("#ffb45a", 1); rings.push({ x: W / 2, y: H / 2, t: 0, col: "#ffb45a", max: 700, d: 1.2 }); ev.clear(); break;
      case "wipe": R.flash("#7a0c08", 0.7); break;
      case "star": star = { t: 0, x: rnd(W * 0.2, W * 0.6), y: rnd(10, 50) }; break;
    }
  };

  // ---------- canvas click: secrets ----------
  R.click = function (px, py) {
    const r = cv.getBoundingClientRect(), x = ((px - r.left) / r.width) * W, y = ((py - r.top) / r.height) * H;
    if (eyes && eyes.t < eyes.d && Math.hypot(x - eyes.x, y - eyes.y) < 30) {
      const res = G.secret(); burst(eyes.x, eyes.y, "#b56bff", 22, 120, 0); eyes = null;
      G.ui.toast(`Something was watching. +${G.fmt(res.souls)} souls${res.extra}`, "#b56bff"); G.ui.toast(res.line, "#a39279");
      G.audio && G.audio.play("secret");
      return true;
    }
    return false;
  };

  // ---------- frame ----------
  function update(dt) {
    T += dt;
    const C = G.combat, s = G.s;
    scrollV *= Math.pow(0.02, dt); scroll += (6 + scrollV) * dt;
    shake *= Math.pow(0.001, dt); flash = Math.max(0, flash - dt * 2.2); dim = Math.max(0, dim - dt);
    if (banner && (banner.t += dt) > 1.7) banner = null;
    // blades
    for (let i = 0; i < 5; i++) {
      const p = G.party && G.party[i];
      if (!p) { bv[i] = null; continue; }
      const pos = bpos(i);
      const b = bv[i] || (bv[i] = { bx: pos[0], by: pos[1], x: pos[0], y: pos[1], t: -1, tx: 0, ty: 0, hitT: 0, cast: 0, ph: i * 1.7, go: 0 });
      b.bx = pos[0]; b.by = pos[1];
      if (b.t >= 0) { b.t += dt / 0.3; if (b.t >= 1) b.t = -1; }
      b.hitT = Math.max(0, b.hitT - dt * 4); b.cast = Math.max(0, b.cast - dt);
      let go = 0; if (b.t >= 0) go = b.t < 0.45 ? 1 - Math.pow(1 - b.t / 0.45, 3) : 1 - Math.pow((b.t - 0.45) / 0.55, 2);
      b.go = go;
      const bob = Math.sin(T * 2.2 + b.ph) * 3;
      b.x = b.bx + (b.tx - b.bx) * go; b.y = b.by + bob * (1 - go) + (b.ty - b.by) * go;
      const cb = C && C.blades[i]; b.dead = !!(cb && cb.dead); b.hp = cb ? cb.hp / cb.max : 1;
    }
    // enemies
    const live = new Map(); if (C) C.enemies.forEach((e) => live.set(e.id, e));
    ev.forEach((v, id) => {
      const e = live.get(id);
      v.age += dt; v.hit = Math.max(0, v.hit - dt * 5); v.bump = Math.max(0, v.bump - dt * 5);
      if (v.x > v.tx) v.x = Math.max(v.tx, v.x - 240 * dt);
      if (e) { v.hp = Math.max(0, e.hp / e.max); v.frz = e.frz > 0; v.burn = e.burn > 0; v.life = e.life; }
      if (v.kind === "imp" && !v.dying) v.x = v.tx + Math.sin(v.age * 3.2) * 46;
      if (v.dying) { v.dying += dt * 2.4; if (v.dying >= 1) ev.delete(id); }
      else if (!e) v.dying = 0.5;
    });
    parts = parts.filter((p) => { p.l -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; return p.l > 0; });
    nums = nums.filter((n) => (n.t += dt) < 0.9);
    slashes = slashes.filter((x) => (x.l -= dt) > 0);
    rings = rings.filter((r) => (r.t += dt) < r.d);
    beams = beams.filter((b) => (b.l -= dt) > 0);
    orbs = orbs.filter((o) => {
      o.t += dt; const dx = 26 - o.x, dy = 14 - o.y, d = Math.hypot(dx, dy) || 1, h = Math.min(1, o.t * 1.6);
      o.vx += ((dx / d) * 520 * h - o.vx * 2 * h) * dt * 4; o.vy += ((dy / d) * 520 * h - o.vy * 2 * h) * dt * 4; o.x += o.vx * dt; o.y += o.vy * dt;
      return d > 12 && o.t < 2.2;
    });
    const wt = weather.type;
    weather.forEach((e) => {
      if (wt === "ash" || wt === "snow") { e.y += e.v * (wt === "snow" ? 1.6 : 0.8) * dt; e.x += Math.sin(T + e.p) * 8 * dt; if (e.y > H + 4) { e.y = -4; e.x = rnd(0, W); } }
      else if (wt === "fireflies" || wt === "motes") { e.x += Math.cos(T * 0.6 + e.p) * 10 * dt; e.y += Math.sin(T * 0.8 + e.p * 2) * 8 * dt; }
      else { e.y -= e.v * dt; e.x += Math.sin(T + e.p) * 6 * dt; if (e.y < -4) { e.y = H + 4; e.x = rnd(0, W); } }
      if (e.x > W + 10) e.x -= W + 20;
    });
    // curiosities
    if (!G.paused) {
      eyesT -= dt;
      if (eyesT <= 0 && !eyes) { eyes = { x: rnd(W * 0.25, W * 0.9), y: rnd(42, FY() - 16), t: 0, d: 7 }; eyesT = rnd(90, 240); }
      if (eyes && (eyes.t += dt) > eyes.d) eyes = null;
      starT -= dt;
      if (starT <= 0 && s.best >= 10) { starT = rnd(360, 780); G.starfall(); }
      if (star && (star.t += dt) > 1.4) star = null;
    }
  }

  function drawDress() {
    const d = dress, fy = 135, col = "#000";
    const wrap = (x, f) => (((x - scroll * f) % 760) + 760) % 760 - 80;
    // far wall shapes
    c.fillStyle = "rgba(0,0,0,.38)";
    for (let i = 0; i < 5; i++) {
      const x = wrap(i * 152, 0.3);
      if (d.style === 0) { c.fillRect(x, 30, 28, fy - 26); c.beginPath(); c.arc(x + 76, 58, 62, Math.PI, 0); c.lineTo(x + 138, 30); c.lineTo(x + 14, 30); c.fill(); }
      else if (d.style === 1) { c.fillRect(x, 8, 22, fy - 4); c.fillRect(x - 5, 8, 32, 8); c.fillRect(x - 5, fy - 6, 32, 8); }
      else { const h = 40 + ((i * 53) % 70); c.fillRect(x, fy - h, 26, h + 4); c.beginPath(); c.moveTo(x, fy - h); c.lineTo(x + 9, fy - h - 12); c.lineTo(x + 17, fy - h - 3); c.lineTo(x + 26, fy - h - 9); c.lineTo(x + 26, fy - h); c.fill(); }
    }
    d.props.forEach((p) => {
      const x = wrap(p.x, 0.3);
      if (p.t === "chain") { c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 2; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x, 0); c.lineTo(x + Math.sin(T + p.x) * 2, p.len); c.stroke(); c.setLineDash([]); }
      else if (p.t === "banner") { c.fillStyle = "rgba(0,0,0,.5)"; c.beginPath(); c.moveTo(x, 14); c.lineTo(x + 20, 14); c.lineTo(x + 20, 14 + p.h); c.lineTo(x + 10, 6 + p.h); c.lineTo(x, 14 + p.h); c.fill(); c.globalAlpha = 0.25; c.fillStyle = d.b.torch; c.fillRect(x + 8, 24, 4, p.h - 22); c.globalAlpha = 1; }
      else if (p.t === "statue") { c.fillStyle = "rgba(0,0,0,.55)"; c.fillRect(x, fy - 12, 34, 14); c.fillRect(x + 9, fy - 62, 16, 52); c.beginPath(); c.arc(x + 17, fy - 70, 9, 0, 6.3); c.fill(); c.fillRect(x + 15, fy - 96, 4, 40); }
      else if (p.t === "window") { c.globalCompositeOperation = "lighter"; glow(x + 14, 50, 60, "#9ab8ff", 0.16); c.globalCompositeOperation = "source-over"; c.fillStyle = "rgba(170,200,255,.2)"; c.beginPath(); c.arc(x + 14, 44, 14, Math.PI, 0); c.lineTo(x + 28, 80); c.lineTo(x, 80); c.fill(); c.fillStyle = "rgba(230,240,255,.6)"; c.beginPath(); c.arc(x + 17, 46, 6, 0, 6.3); c.fill(); }
      else if (p.t === "cage") { c.strokeStyle = "rgba(0,0,0,.65)"; c.lineWidth = 1.5; const sw = Math.sin(T * 0.8 + p.x) * 3; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + sw, p.len); c.stroke(); c.strokeRect(x + sw - 8, p.len, 16, 22); c.beginPath(); c.moveTo(x + sw - 3, p.len); c.lineTo(x + sw - 3, p.len + 22); c.moveTo(x + sw + 3, p.len); c.lineTo(x + sw + 3, p.len + 22); c.stroke(); }
      else if (p.t === "skull") { c.fillStyle = "rgba(0,0,0,.5)"; c.beginPath(); c.arc(x, fy - 26, 30, Math.PI, 0); c.lineTo(x + 22, fy); c.lineTo(x - 22, fy); c.fill(); c.fillStyle = d.b.torch; c.globalAlpha = 0.25 + Math.sin(T * 2) * 0.1; c.beginPath(); c.arc(x - 11, fy - 26, 6, 0, 6.3); c.arc(x + 11, fy - 26, 6, 0, 6.3); c.fill(); c.globalAlpha = 1; }
    });
    return col;
  }

  function draw() {
    const C = G.combat, s = G.s; if (!dress) dress = makeDress(G.curFloor());
    const b = dress.b, fy = FY(), pend = s.omen.pend && s.omen.pend.id, hollow = (C && C.hollow) || pend === "hollow";
    c.setTransform(k, 0, 0, k, 0, 0); c.imageSmoothingEnabled = false;
    const sx = shake > 0.3 ? rnd(-shake, shake) : 0, sy = shake > 0.3 ? rnd(-shake, shake) * 0.6 : 0;
    let g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, b.sky[0]); g.addColorStop(0.49, b.sky[1]); g.addColorStop(0.52, b.sky[1]); g.addColorStop(1, b.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.translate(sx, sy);
    if (!hollow) { c.globalCompositeOperation = "lighter"; glow(W * 0.55, fy - 10, W * 0.7, b.torch, 0.13); c.globalCompositeOperation = "source-over"; }
    if (s.moon > 0 || pend === "moon") { c.globalCompositeOperation = "lighter"; glow(W * 0.78, 34, 46, "#ff2a2a", s.moon > 0 ? 0.7 : 0.3); c.globalCompositeOperation = "source-over"; c.fillStyle = s.moon > 0 ? "#c81e1e" : "#5a1414"; c.beginPath(); c.arc(W * 0.78, 34, 13, 0, 6.3); c.fill(); }
    if (star) { const p = star.t / 1.4; c.globalCompositeOperation = "lighter"; c.strokeStyle = "#fff6d0"; c.globalAlpha = 1 - p; c.lineWidth = 2; c.beginPath(); c.moveTo(star.x + p * 170, star.y + p * 50); c.lineTo(star.x + p * 170 - 46, star.y + p * 50 - 14); c.stroke(); glow(star.x + p * 170, star.y + p * 50, 12, "#fff6d0", 1 - p); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; }
    c.save(); c.translate(0, fy - 135); drawDress(); c.restore();
    if (pend === "champion") { c.fillStyle = "rgba(0,0,0,.4)"; for (let i = 0; i < 2; i++) { const x = W * (0.6 + i * 0.22) + Math.sin(T * 0.7 + i) * 10; c.beginPath(); c.ellipse(x, fy - 34, 30, 52 + Math.sin(T * 1.3 + i) * 5, 0, 0, 6.3); c.fill(); } }
    // torches
    const tcol = hollow ? "#31405a" : pend === "shrine" || s.curse > 0 ? "#b56bff" : s.moon > 0 ? "#ff3b3b" : b.torch;
    const tA = hollow ? 0.07 : 0.26;
    const tor = [];
    c.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) { const x = (((i * 260 - scroll) % 780) + 780) % 780 - 120; tor.push(x); glow(x + 17, fy - 50, 95, tcol, tA + Math.sin(T * 9 + i * 2) * 0.04 + Math.sin(T * 23 + i) * 0.03); }
    c.globalCompositeOperation = "source-over";
    tor.forEach((x) => { c.fillStyle = "#070505"; c.fillRect(x, 0, 34, fy + 10); if (!hollow) { c.fillStyle = tcol; c.fillRect(x + 15, fy - 55 + Math.sin(T * 18 + x) * 1.2, 4, 6); } c.fillStyle = "#2a1a14"; c.fillRect(x + 13, fy - 48, 8, 3); });
    // floor seams
    c.strokeStyle = "rgba(255,200,150,.05)"; c.lineWidth = 1;
    [14, 30, 54, 88, 126].forEach((d) => { c.beginPath(); c.moveTo(-10, fy + d); c.lineTo(W + 10, fy + d); c.stroke(); });
    for (let i = 0; i < 10; i++) { const x = (((i * 70 - scroll) % 700) + 700) % 700 - 40; c.beginPath(); c.moveTo(x, fy + 10); c.lineTo(x - (W / 2 - x) * 0.25 - 20, H); c.stroke(); }
    if (pend === "imp") { c.fillStyle = "#ffd24a"; for (let i = 0; i < 7; i++) { const a = Math.sin(T * 4 + i * 1.9); if (a > 0.5) c.fillRect(W * 0.5 + ((i * 37) % (W * 0.45)), fy + 30 + ((i * 53) % 90), 2, 2); } }
    if (pend === "smith") { c.fillStyle = "#ffb45a"; for (let i = 0; i < 9; i++) { const p = (T * 0.4 + i * 0.11) % 1; c.globalAlpha = 1 - p; c.fillRect(W - p * 120 - (i % 3) * 8, fy + 20 - p * 40 + Math.sin(i * 9 + T * 3) * 10, 2, 2); } c.globalAlpha = 1; }
    if (eyes) { const a = Math.sin(Math.min(1, eyes.t / 0.6) * 1.57) * (eyes.t > eyes.d - 0.6 ? (eyes.d - eyes.t) / 0.6 : 1), blink = Math.sin(eyes.t * 2.1) > 0.94 ? 0.2 : 1; c.globalCompositeOperation = "lighter"; glow(eyes.x, eyes.y, 16, "#b56bff", 0.5 * a); c.globalCompositeOperation = "source-over"; c.fillStyle = `rgba(230,200,255,${a})`; c.fillRect(eyes.x - 6, eyes.y - 1, 3, 3 * blink); c.fillRect(eyes.x + 3, eyes.y - 1, 3, 3 * blink); }
    if (dim > 0) { c.fillStyle = `rgba(0,0,0,${0.45 * Math.sin((Math.min(1.5, dim) / 1.5) * Math.PI)})`; c.fillRect(-20, -20, W + 40, H + 40); }

    beams.forEach((bm) => {
      const a = Math.min(1, bm.l) * (0.75 + Math.sin(T * 10) * 0.15); c.globalCompositeOperation = "lighter";
      g = c.createLinearGradient(0, bm.y, 0, bm.y - 150); g.addColorStop(0, bm.col); g.addColorStop(1, "transparent");
      c.globalAlpha = a; c.fillStyle = g; c.fillRect(bm.x - 2.5, bm.y - 150, 5, 150); c.globalAlpha = a * 0.3; c.fillRect(bm.x - 8, bm.y - 150, 16, 150); c.globalAlpha = 1;
      glow(bm.x, bm.y, 26, bm.col, a * 0.8); c.globalCompositeOperation = "source-over";
      c.globalAlpha = Math.min(1, bm.l); c.font = "700 13px Cinzel,Georgia,serif"; c.textAlign = "center"; c.fillStyle = "#fff"; c.fillText(bm.glyph, bm.x, bm.y - 6 + Math.sin(T * 3) * 2); c.globalAlpha = 1;
    });

    // entities, painter-sorted
    const ents = [];
    bv.forEach((bl, i) => bl && ents.push({ y: bl.by, bl, i }));
    ev.forEach((v) => ents.push({ y: v.y, v }));
    ents.sort((a, z) => a.y - z.y).forEach((e) => {
      if (e.bl) {
        const bl = e.bl, p = G.party[e.i]; if (!p) return;
        const col = G.EL[p.st.el].color, casting = bl.cast > 0, idx = p.b.i, qx = (idx % 6) * 32, qy = Math.floor(idx / 6) * 32, S = 1.35 * sc;
        c.fillStyle = "rgba(0,0,0,.4)"; c.beginPath(); c.ellipse(bl.x, bl.by + 22, 10, 3, 0, 0, 6.3); c.fill();
        if (bl.dead) { sprite(tinted(imgS, qx, qy, "#000", 0.6), 0, 0, bl.bx, bl.by + 12, S, 2.2, 0.7); return; }
        const ready = G.rage[e.i] >= 100;
        c.globalCompositeOperation = "lighter"; glow(bl.x, bl.y, casting ? 46 : ready ? 30 + Math.sin(T * 8) * 4 : 24, col, casting ? 0.7 : ready ? 0.55 : 0.3 + bl.go * 0.25);
        if (p.b.t === "mythic") glow(bl.x, bl.y, 34, "#ff4558", 0.22 + Math.sin(T * 3 + e.i) * 0.08);
        c.globalCompositeOperation = "source-over";
        const rot = Math.PI / 4 - 0.35 * (1 - bl.go) + Math.sin(T * 1.7 + bl.ph) * 0.05 + (bl.t >= 0 ? Math.sin(bl.t * Math.PI) * 0.7 : 0) + (casting ? Math.sin(bl.cast * 20) * 0.15 : 0);
        const ox = bl.hitT * rnd(-2, 2);
        if (bl.go > 0.1) { sprite(imgS, qx, qy, bl.x - (bl.x - bl.bx) * 0.18, bl.y, S, rot, 0.22); sprite(imgS, qx, qy, bl.x - (bl.x - bl.bx) * 0.36, bl.y, S, rot, 0.1); }
        sprite(bl.hitT > 0.5 ? tinted(imgS, qx, qy, "#ff5a4a", 0.7) : imgS, bl.hitT > 0.5 ? 0 : qx, bl.hitT > 0.5 ? 0 : qy, bl.x + ox, bl.y - (casting ? 8 : 0), casting ? S * 1.25 : S, rot, 1);
        if (p.b.s > 0 && Math.sin(T * 2 + e.i * 2) > 0.7) { c.fillStyle = "#fff"; c.fillRect(bl.x + rnd(-10, 10), bl.y + rnd(-12, 12), 1.5, 1.5); }
        if (bl.hp < 0.999) { c.fillStyle = "#000"; c.fillRect(bl.bx - 13, bl.by + 27, 26, 3); c.fillStyle = bl.hp > 0.35 ? "#5fd08a" : "#e0503a"; c.fillRect(bl.bx - 12.5, bl.by + 27.5, 25 * bl.hp, 2); }
      } else {
        const v = e.v, a = v.dying ? Math.max(0, 1 - v.dying) : 1, S = v.s, h = 16 * S;
        c.globalCompositeOperation = "lighter"; glow(v.x, v.y, h * 1.5, b.torch, 0.12 * a); c.globalCompositeOperation = "source-over";
        c.fillStyle = `rgba(0,0,0,${0.45 * a})`; c.beginPath(); c.ellipse(v.x, v.y + h - 2, h * 0.6, 4, 0, 0, 6.3); c.fill();
        if (v.kind === "champ" || v.kind === "boss") { c.globalCompositeOperation = "lighter"; glow(v.x, v.y, h * 1.5, v.kind === "boss" ? "#ff3a2a" : "#ff8a2a", (0.22 + Math.sin(T * 5) * 0.06) * a); c.globalCompositeOperation = "source-over"; }
        if (v.kind === "gild" || v.kind === "imp") { c.globalCompositeOperation = "lighter"; glow(v.x, v.y, h * 1.3, "#ffd24a", 0.35 * a); c.globalCompositeOperation = "source-over"; if (Math.random() < 0.2) parts.push({ x: v.x + rnd(-h, h) * 0.6, y: v.y + rnd(-h, h) * 0.6, vx: 0, vy: -10, l: 0.5, col: "#fff2a8", g: 0, s: 1.5 }); }
        c.save(); c.translate(v.x + v.hit * 4 - v.bump * 9, v.y - (v.dying ? v.dying * 10 : 0)); c.scale(1 - v.hit * 0.14, 1 + v.hit * 0.08); c.globalAlpha = a;
        if (v.kind === "hollow") {
          const i = v.sw, qx = (i % 6) * 32, qy = Math.floor(i / 6) * 32;
          c.globalCompositeOperation = "lighter"; glow(0, 0, 60, "#8fa3c8", 0.35); c.globalCompositeOperation = "source-over";
          c.rotate(-Math.PI / 4 - Math.PI / 2 + Math.sin(T * 2) * 0.1);
          const src = tinted(imgS, qx, qy, v.hit > 0.45 ? "#fff" : "#05070c", v.hit > 0.45 ? 1 : 0.72); c.drawImage(src, 0, 0, 32, 32, -h, -h, h * 2, h * 2);
        } else {
          const cell = G.moCell(v.mi); let src = imgM, qx = cell[0], qy = cell[1];
          if (v.dying) { src = tinted(imgM, qx, qy, v.el === "ice" ? "#bff3ff" : v.el === "void" ? "#3a1060" : "#ff8a3a", 1); qx = qy = 0; }
          else if (v.hit > 0.45) { src = tinted(imgM, qx, qy, "#fff", 1); qx = qy = 0; }
          else if (v.frz) { src = tinted(imgM, qx, qy, "#7fdcff", 0.6); qx = qy = 0; }
          else if (v.kind === "gild" || v.kind === "imp") { src = tinted(imgM, qx, qy, "#ffc830", 0.55); qx = qy = 0; }
          else if (v.kind === "champ") { src = tinted(imgM, qx, qy, "#ff7a20", 0.28); qx = qy = 0; }
          c.drawImage(src, qx, qy, 32, 32, -h, -h, h * 2, h * 2);
        }
        c.restore();
        if (!v.dying && v.kind !== "boss" && v.kind !== "hollow") {
          if (v.hp < 0.999) { c.fillStyle = "#000"; c.fillRect(v.x - 15, v.y - h - 6, 30, 3.5); c.fillStyle = "#b3261c"; c.fillRect(v.x - 14.5, v.y - h - 5.5, 29 * v.hp, 2.5); }
          if (v.kind === "champ") { c.font = "700 8px Cinzel,Georgia,serif"; c.textAlign = "center"; c.fillStyle = "#ffb45a"; c.fillText(v.trait.toUpperCase(), v.x, v.y - h - 10); }
          if (v.kind === "imp" && v.life != null) { c.fillStyle = "#000"; c.fillRect(v.x - 15, v.y - h - 12, 30, 3); c.fillStyle = "#ffd24a"; c.fillRect(v.x - 14.5, v.y - h - 11.5, 29 * Math.max(0, v.life / 8), 2); }
        }
        if (v.burn && !v.dying && Math.random() < 0.3) parts.push({ x: v.x + rnd(-8, 8), y: v.y + rnd(-6, 10), vx: 0, vy: -40, l: 0.4, col: "#ff8a3a", g: -30, s: 2 });
      }
    });

    c.globalCompositeOperation = "lighter";
    slashes.forEach((x) => { c.save(); c.translate(x.x, x.y); c.rotate(x.a); c.strokeStyle = x.col; c.globalAlpha = x.l / 0.22; c.lineWidth = (4 * x.l) / 0.22; c.beginPath(); c.arc(-14, 0, 26, -0.9, 0.9); c.stroke(); c.strokeStyle = "#fff"; c.lineWidth = 1.2; c.stroke(); c.restore(); });
    rings.forEach((r) => { const p = r.t / r.d; c.strokeStyle = r.col; c.globalAlpha = 1 - p; c.lineWidth = 10 * (1 - p); c.beginPath(); c.arc(r.x, r.y, p * r.max, 0, 6.3); c.stroke(); });
    c.globalAlpha = 1;
    parts.forEach((p) => { c.globalAlpha = Math.min(1, p.l * 2.5); c.fillStyle = p.col; c.fillRect(p.x, p.y, p.s, p.s); }); c.globalAlpha = 1;
    orbs.forEach((o) => { glow(o.x, o.y, 9, "#b99cff", 0.9); c.fillStyle = "#fff"; c.fillRect(o.x - 1, o.y - 1, 2, 2); });
    const wt = weather.type, wcol = s.moon > 0 ? "#ff5a4a" : wt === "ash" ? "#8a8f98" : wt === "snow" ? "#e8f4ff" : wt === "fireflies" ? "#d8ff7a" : wt === "spores" ? "#5affc0" : wt === "motes" ? "#fff0b0" : "#ff8a3a";
    weather.forEach((e) => { if (e.x > W) return; c.globalAlpha = wt === "fireflies" ? Math.max(0, Math.sin(T * 2 + e.p * 3)) * 0.8 : 0.3 + Math.sin(T * 3 + e.p) * 0.25; c.fillStyle = wcol; c.fillRect(e.x, e.y, 1.5, 1.5); }); c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over"; c.textAlign = "center";
    nums.forEach((n) => { const p = n.t / 0.9, y = n.y - 30 * (1 - Math.pow(1 - p, 2)), z = n.big ? 1 + Math.max(0, 0.2 - n.t) * 4 : 1; c.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1; c.font = "700 " + (n.big ? 14 : 10) * z + "px Cinzel,Georgia,serif"; c.lineWidth = 3; c.strokeStyle = "#120807"; c.strokeText(n.s, n.x, y); c.fillStyle = n.col; c.fillText(n.s, n.x, y); }); c.globalAlpha = 1;
    c.restore();

    // overlays
    if (s.moon > 0 || pend === "moon") { c.fillStyle = `rgba(160,10,10,${s.moon > 0 ? 0.16 : 0.07})`; c.fillRect(0, 0, W, H); }
    if (G.rift) { g = c.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.6); g.addColorStop(0, "transparent"); g.addColorStop(1, "rgba(120,40,200,.4)"); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62); g.addColorStop(0, "transparent"); g.addColorStop(1, s.curse > 0 ? "rgba(40,0,70,.8)" : `rgba(0,0,0,${hollow ? 0.92 : 0.55})`); c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (banner) { const a = Math.sin(Math.min(1, banner.t / 1.7) * Math.PI); c.textAlign = "center"; c.globalAlpha = Math.min(1, a * 1.6); c.font = "900 " + (W < 400 ? 17 : 21) + "px Cinzel,Georgia,serif"; c.fillStyle = banner.col; c.shadowColor = banner.col; c.shadowBlur = 14 * k; c.fillText(banner.text, W / 2 + (1 - a) * -24, 50); c.shadowBlur = 0; if (banner.sub) { c.font = "500 10px Cinzel,Georgia,serif"; c.fillStyle = "#e2d5ba"; c.fillText(banner.sub, W / 2, 66); } c.globalAlpha = 1; }
    if (flash > 0) { c.globalAlpha = Math.min(1, flash); c.fillStyle = flashCol; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    if (G.paused === "user") { c.fillStyle = "rgba(0,0,0,.5)"; c.fillRect(0, 0, W, H); c.font = "900 20px Cinzel,Georgia,serif"; c.textAlign = "center"; c.fillStyle = "#e2d5ba"; c.fillText("PAUSED", W / 2, H / 2); }
  }

  R.init = function (canvas) {
    cv = canvas; c = cv.getContext("2d"); R.resize();
    makeWeather(G.biomeOf(G.curFloor()).weather);
    cv.addEventListener("pointerdown", (e) => R.click(e.clientX, e.clientY));
    window.addEventListener("resize", R.resize);
    if (window.ResizeObserver) new ResizeObserver(R.resize).observe(cv);
  };
  R.frame = function (dt) { if (!cv || R.ready < 2) return; update(dt); draw(); };
})();
