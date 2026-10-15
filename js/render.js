// ===================== PIXEL-ART RENDERER =====================
// The whole scene is drawn at a low internal resolution (about 260 px wide) and scaled up
// with nearest-neighbour, so the painted dungeon and the sprites share one pixel grid.
(function () {
  const G = window.G, R = (G.render = {});
  let cv, c, W = 260, H = 180, YG = 110, T = 0;
  const imgS = new Image(), imgM = new Image();
  R.ready = 0;
  imgS.onload = imgM.onload = () => { R.ready++; G.ui && G.ui.dirty("all"); };
  imgS.src = "assets/sprite_swords.png"; imgM.src = "assets/monsters.png";
  const mk = (w, h) => { const x = document.createElement("canvas"); x.width = w; x.height = h; return x; };
  const fl = mk(32, 32), fc = fl.getContext("2d");

  // monster index -> sheet cell
  const ROWS = [8, 3, 4, 2, 6, 5, 12, 10, 5, 2, 2, 2, 3], CELL = [];
  ROWS.forEach((n, r) => { for (let i = 0; i < n; i++) CELL.push([i * 32, r * 32, r, i]); });
  G.moCell = (i) => CELL[i] || CELL[0];
  G.swCss = (i) => `background-position:${((i % 6) / 5) * 100}% ${(Math.floor(i / 6) / 4) * 100}%`;
  G.moCss = (i) => { const p = G.moCell(i); return `background-position:${(p[3] / 11) * 100}% ${(p[2] / 12) * 100}%`; };

  const rnd = G.rand, rd = Math.round;
  const calm = () => G.s.set.calm;

  // ---------- colour helpers ----------
  function rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function hex(a) { return "#" + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); }
  const shade = (h, f) => hex(rgb(h).map((v) => v * f));
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
  const rgba = (h, a) => { const x = rgb(h); return `rgba(${x[0]},${x[1]},${x[2]},${a})`; };

  // ---------- area palettes ----------
  const PAL = {
    brute: { indoor: 1, sky: ["#0d0907", "#1d130d"], wall: "#4b3727", floor: "#5c4330", floor2: "#47331f", wood: "#71492a", acc: "#a3301f", bone: "#d8ccb0", light: "#ffa040", fg: "#120b07", weather: "dust" },
    undead: { indoor: 1, sky: ["#06080b", "#121821"], wall: "#4a5260", floor: "#4c4f58", floor2: "#3b3d46", bone: "#ddd5bf", acc: "#7d8ca3", light: "#9fdcff", fg: "#07090c", weather: "ash" },
    beast: { sky: ["#0a1426", "#22344a"], far: "#13261f", trunk: "#3e2c1f", leaf: "#1d3a22", floor: "#33502a", floor2: "#283f21", grass: "#5a8a38", acc: "#c8e070", bone: "#d8ccb0", light: "#d8ff8a", fg: "#07100a", weather: "fireflies" },
    nature: { sky: ["#0d1c1c", "#2a4640"], far: "#1c312c", wall: "#56604e", moss: "#4f7a3a", floor: "#3b3a26", floor2: "#2e2e1e", water: "#1f4848", acc: "#7affc8", bone: "#c8c0a0", light: "#7affc0", fg: "#060d0a", weather: "spores" },
    demon: { indoor: 1, sky: ["#1c0605", "#420f08"], far: "#2a0a07", wall: "#30232a", floor: "#271c1f", floor2: "#1c1416", lava: "#ff6a1a", lava2: "#ffd040", acc: "#ff4a20", bone: "#cbb9a0", light: "#ff6a2a", fg: "#0a0405", weather: "embers" },
    dragon: { sky: ["#091022", "#28385a"], far: "#3b4c6c", snow: "#e6f0ff", ice: "#8fc8ff", floor: "#cbd9ee", floor2: "#a7bbd7", bone: "#e8e0cc", acc: "#bfe8ff", light: "#9ac0ff", fg: "#0a1022", weather: "snow" },
    holy: { indoor: 1, sky: ["#0d0b07", "#2a2414"], wall: "#a99e86", floor: "#d6ccb4", floor2: "#8f8670", gold: "#e0b850", acc: "#ffe9a8", bone: "#e8e0cc", light: "#fff0b0", fg: "#120f08", weather: "motes", glass: ["#d84a4a", "#4a7ad8", "#e0c040", "#5ac07a", "#a05ad8"] },
  };
  const VARIANT = {
    frozen: { name: "Frozen", tint: "#9fd8ff", t: 0.35, weather: "snow", light: "#bfe8ff" },
    burning: { name: "Burning", tint: "#ff6a2a", t: 0.25, weather: "embers", light: "#ff7a2a" },
    flooded: { name: "Flooded", tint: "#2a8a8a", t: 0.3, weather: "spores", light: "#7affd8" },
  };
  function variantPal(p, v) {
    const o = Object.assign({}, p), V = VARIANT[v];
    for (const k in o) if (typeof o[k] === "string" && o[k][0] === "#" && k !== "light") o[k] = mix(o[k], V.tint, V.t);
    o.sky = p.sky.map((x) => mix(x, V.tint, V.t * 0.6)); o.weather = V.weather; o.light = V.light;
    if (v === "flooded") o.flood = 1;
    return o;
  }

  // ---------- scene generation (tileable strips) ----------
  const SW = 480;
  let g = null;
  function box(x, y, w, h, col) {
    if (w <= 0 || h <= 0) return;
    g.fillStyle = col; x = rd(x); y = rd(y); w = rd(w); h = rd(h);
    g.fillRect(x, y, w, h); if (x + w > SW) g.fillRect(x - SW, y, w, h); if (x < 0) g.fillRect(x + SW, y, w, h);
  }
  const dot = (x, y, col) => box(x, y, 1, 1, col);
  function bands(y0, y1, c0, c1, n) { const h = (y1 - y0) / n; for (let i = 0; i < n; i++) box(0, y0 + i * h, SW, Math.ceil(h) + 1, mix(c0, c1, i / Math.max(1, n - 1))); }
  function disc(cx, cy, r, col) { for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); box(cx - w, cy + y, w * 2 + 1, 1, col); } }
  function blob(cx, cy, rx, ry, col, hi, lo) {
    for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01))); box(cx - w, cy + y, w * 2 + 1, 1, col); if (lo && y > ry * 0.4) box(cx - w, cy + y, w * 2 + 1, 1, lo); }
    if (hi) { box(cx - rx * 0.5, cy - ry + 1, rx * 0.7, 1, hi); }
  }
  function arch(x, y, w, h, col) { const r = w / 2; for (let yy = 0; yy < h; yy++) { const dy = r - yy; const ww = dy > 0 ? Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)) * 2) : w; box(x + (w - ww) / 2, y + yy, ww, 1, col); } }
  function bricks(x0, y0, w, h, bw, bh, base, rng, mortar) {
    box(x0, y0, w, h, mortar);
    for (let r = 0; r * bh < h; r++) {
      const off = r % 2 ? bw / 2 : 0;
      for (let x = -bw; x < w + bw; x += bw) {
        const v = 0.86 + rng() * 0.24, col = shade(base, v), bx = x0 + x + off, by = y0 + r * bh;
        if (bx + bw < x0 || bx > x0 + w) continue;
        box(Math.max(x0, bx), by, Math.min(bw - 1, x0 + w - Math.max(x0, bx)), Math.min(bh - 1, y0 + h - by), col);
        box(Math.max(x0, bx), by, Math.min(bw - 1, x0 + w - Math.max(x0, bx)), 1, shade(col, 1.18));
        if (rng() < 0.12) box(bx + 2 + rng() * (bw - 5), by + 2, 1, bh - 3, shade(col, 0.7));
      }
    }
  }
  function floorTiles(y0, rowsH, base, alt, line, rng, checker) {
    let y = y0;
    rowsH.forEach((rh, r) => {
      const tw = 14 + r * 5, off = rng() * tw;
      for (let x = -tw; x < SW + tw; x += tw) {
        const i = Math.round((x + off) / tw);
        const col = checker ? ((i + r) % 2 ? base : alt) : shade(rng() < 0.5 ? base : alt, 0.9 + rng() * 0.2);
        box(x + off, y, tw - 1, rh - 1, col); box(x + off, y, tw - 1, 1, shade(col, 1.15));
        if (!checker && rng() < 0.15) { const cx = x + off + 3 + rng() * (tw - 6); box(cx, y + 2, 1, rh - 4, line); }
      }
      box(0, y + rh - 1, SW, 1, line);
      y += rh;
    });
  }
  function speckle(y0, y1, cols, n, rng) { for (let i = 0; i < n; i++) dot(rng() * SW, y0 + rng() * (y1 - y0), cols[Math.floor(rng() * cols.length)]); }
  function skull(x, y, bone) { box(x, y, 3, 2, bone); box(x, y + 2, 1, 1, bone); box(x + 2, y + 2, 1, 1, bone); dot(x + 1, y + 1, "#000"); }

  // --- props (drawn sitting on y = base line) ---
  const PROPS = {
    barrel(x, y, p) { box(x, y - 9, 7, 9, p.wood || "#71492a"); box(x, y - 7, 7, 1, "#2a1a10"); box(x, y - 3, 7, 1, "#2a1a10"); box(x + 1, y - 9, 1, 9, shade(p.wood || "#71492a", 1.25)); },
    crate(x, y, p) { const w = p.wood || "#71492a"; box(x, y - 8, 9, 8, w); box(x, y - 8, 9, 1, shade(w, 1.3)); box(x, y - 8, 1, 8, shade(w, 0.6)); box(x + 8, y - 8, 1, 8, shade(w, 0.6)); for (let i = 0; i < 7; i++) dot(x + 1 + i, y - 7 + i, shade(w, 0.6)); },
    bones(x, y, p) { box(x, y - 1, 6, 1, p.bone); box(x + 4, y - 2, 4, 1, p.bone); skull(x + 7, y - 3, p.bone); },
    skulls(x, y, p) { for (let i = 0; i < 4; i++) skull(x + i * 3, y - 3, p.bone); skull(x + 2, y - 6, p.bone); skull(x + 5, y - 6, p.bone); },
    rock(x, y, p) { blob(x + 4, y - 3, 5, 3, shade(p.wall || p.floor2, 0.85), shade(p.wall || p.floor2, 1.2)); },
    tomb(x, y, p) { const s = shade(p.wall || "#666", 1.1); box(x, y - 10, 7, 10, s); box(x + 1, y - 11, 5, 1, s); box(x + 3, y - 8, 1, 4, shade(s, 0.6)); box(x + 2, y - 7, 3, 1, shade(s, 0.6)); },
    mush(x, y, p) { box(x + 2, y - 3, 1, 3, "#d8ccb0"); box(x, y - 5, 5, 2, p.acc); dot(x + 1, y - 5, "#fff"); },
    fern(x, y, p) { for (let i = 0; i < 5; i++) box(x + i * 2, y - 3 - (i % 3) * 2, 1, 3 + (i % 3) * 2, shade(p.grass || p.moss, 1.1)); },
    reeds(x, y, p) { for (let i = 0; i < 4; i++) { box(x + i * 2, y - 8 - i, 1, 8 + i, shade(p.moss || "#4f7a3a", 0.9)); box(x + i * 2, y - 11 - i, 1, 3, "#6a4a2a"); } },
    spikes(x, y, p) { for (let i = 0; i < 4; i++) { box(x + i * 3 + 1, y - 6, 1, 6, "#3a3a40"); dot(x + i * 3 + 1, y - 7, "#9a9aa8"); } },
    crystal(x, y, p) { const c1 = p.ice || p.acc; box(x + 2, y - 10, 3, 10, c1); box(x + 3, y - 12, 1, 2, c1); box(x, y - 6, 2, 6, shade(c1, 0.8)); box(x + 5, y - 7, 2, 7, shade(c1, 0.75)); box(x + 2, y - 10, 1, 9, "#ffffff"); },
    candles(x, y, p) { box(x, y - 4, 1, 4, "#e8e0cc"); box(x + 2, y - 6, 1, 6, "#e8e0cc"); box(x + 4, y - 3, 1, 3, "#e8e0cc"); },
    statue(x, y, p) { const s = shade(p.wall || "#999", 1.05); box(x, y - 4, 10, 4, shade(s, 0.8)); box(x + 2, y - 18, 6, 14, s); box(x + 3, y - 22, 4, 4, s); box(x + 2, y - 18, 1, 14, shade(s, 1.2)); box(x + 8, y - 20, 1, 6, s); },
    brazier(x, y, p) { box(x + 1, y - 7, 1, 7, "#2a2020"); box(x + 6, y - 7, 1, 7, "#2a2020"); box(x, y - 9, 8, 2, "#4a3a3a"); },
    flag(x, y, p) { box(x, y - 16, 1, 16, p.wood || "#71492a"); box(x + 1, y - 16, 6, 5, p.acc); box(x + 1, y - 11, 3, 2, p.acc); },
  };
  const BACKPROPS = {
    brute: ["barrel", "crate", "bones", "rock", "spikes", "flag"], undead: ["bones", "skulls", "tomb", "candles", "rock"],
    beast: ["mush", "fern", "rock", "bones", "fern"], nature: ["reeds", "mush", "rock", "reeds", "bones"],
    demon: ["spikes", "bones", "skulls", "brazier", "rock"], dragon: ["crystal", "bones", "rock", "crystal"], holy: ["candles", "statue", "rock", "candles"],
  };

  let scene = null;
  function buildScene(f) {
    const b = G.biomeOf(f), rng = G.rng(f * 7919 + 13);
    const vr = rng(), variant = vr < 1 / 12 ? ["frozen", "burning", "flooded"][Math.floor(rng() * 3)] : null;
    const p = variant ? variantPal(PAL[b.id], variant) : PAL[b.id];
    const S = { f, b, p, variant, lights: [], cracks: [], windows: [], strips: {}, name: (variant ? VARIANT[variant].name + " " : "") + b.name.replace(/^The /, variant ? "" : "The ") };
    if (!variant) S.name = b.name;
    const yg = YG;
    // far layer: sky, distant shapes
    S.strips.far = mk(SW, H); g = S.strips.far.getContext("2d");
    bands(0, yg + 4, p.sky[0], p.sky[1], 8);
    if (!p.indoor) for (let i = 0; i < 40; i++) dot(rng() * SW, rng() * yg * 0.6, rng() < 0.3 ? "#ffffff" : "#8fa0c0");
    if (b.id === "beast" || b.id === "dragon") { const mx = 60 + rng() * 300; disc(mx, 18, 7, "#e8e6d0"); disc(mx + 3, 16, 6, mix(p.sky[0], "#e8e6d0", 0.25)); }
    if (b.id === "beast") for (let x = 0; x < SW; x += 2) { const h = 18 + Math.sin(x * 0.07) * 6 + Math.sin(x * 0.23 + 1) * 4 + rng() * 3; box(x, yg - h, 2, h + 4, p.far); }
    if (b.id === "nature") { for (let i = 0; i < 6; i++) { const x = rng() * SW, h = 26 + rng() * 22; box(x, yg - h, 2, h, p.far); box(x - 5, yg - h + 6, 6, 1, p.far); box(x + 2, yg - h + 10, 7, 1, p.far); box(x - 4, yg - h + 5, 1, 3, p.far); } bands(yg - 16, yg + 4, mix(p.sky[1], "#c8e8e0", 0.15), p.sky[1], 4); }
    if (b.id === "dragon") for (let i = 0; i < 5; i++) { const x = i * 96 + rng() * 40, h = 30 + rng() * 30, w = 50 + rng() * 40; for (let y = 0; y < h; y++) { const ww = (w * y) / h; box(x - ww / 2, yg - h + y, ww, 1, y < h * 0.3 ? p.snow : p.far); } }
    if (b.id === "demon") { for (let i = 0; i < 4; i++) { const x = i * 120 + rng() * 60, h = 30 + rng() * 24, w = 70; for (let y = 0; y < h; y++) box(x - (w * y) / h / 2, yg - h + y, (w * y) / h, 1, p.far); box(x - 1, yg - h - 30, 3, 30 + h, p.lava); box(x, yg - h - 30, 1, 30 + h, p.lava2); } }

    // mid layer: the wall or the treeline the fight happens in front of
    S.strips.mid = mk(SW, H); g = S.strips.mid.getContext("2d");
    const light = (x, y, col, r, kind) => { S.lights.push({ x, y, col: col || p.light, r: r || 34, kind: kind || "torch" }); if (x + 40 > SW) S.lights.push({ x: x - SW, y, col: col || p.light, r: r || 34, kind: kind || "torch" }); };
    if (b.id === "brute") {
      box(0, 0, SW, yg, p.wall);
      for (let i = 0; i < 180; i++) { const x = rng() * SW, y = rng() * yg, r = 3 + rng() * 6; blob(x, y, r, r * 0.7, shade(p.wall, 0.8 + rng() * 0.35), shade(p.wall, 1.3), shade(p.wall, 0.7)); }
      for (let x = 20 + rng() * 40; x < SW; x += 110 + rng() * 40) {
        const w = p.wood; box(x, 16, 5, yg - 16, w); box(x + 56, 16, 5, yg - 16, w); box(x - 3, 14, 67, 5, shade(w, 1.05));
        box(x, 16, 1, yg - 16, shade(w, 1.3)); box(x + 56, 16, 1, yg - 16, shade(w, 1.3)); box(x - 3, 18, 67, 1, shade(w, 0.5));
        if (rng() < 0.7) { box(x + 18, 19, 14, 7, p.acc); box(x + 20, 26, 4, 3, p.acc); box(x + 27, 26, 3, 2, p.acc); }
        box(x + 5, yg - 40, 3, 2, "#2a2a2a"); light(x + 9, yg - 44);
      }
    } else if (b.id === "undead") {
      bricks(0, 0, SW, yg, 12, 6, p.wall, rng, shade(p.wall, 0.45));
      for (let x = 10 + rng() * 30; x < SW; x += 70 + rng() * 30) {
        arch(x, 14, 28, 44, "#0a0c10"); for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) if (rng() < 0.85) skull(x + 3 + k * 4, 28 + r * 6, shade(p.bone, 0.75 + rng() * 0.25));
        box(x - 2, 58, 32, 3, shade(p.wall, 1.15)); box(x + 4, 54, 1, 4, "#e8e0cc"); light(x + 4, 52, "#ffd08a", 22, "candle");
        if (rng() < 0.6) light(x + 40, yg - 40);
      }
      for (let i = 0; i < 3; i++) { const x = rng() * SW; for (let k = 0; k < 10; k++) { dot(x + k, k, "#9aa0aa"); dot(x + k * 0.5, k * 1.5, "#7a808a"); } }
    } else if (b.id === "beast") {
      for (let x = rng() * 40; x < SW; x += 50 + rng() * 50) {
        const w = 12 + rng() * 12, tx = x, col = shade(p.trunk, 0.85 + rng() * 0.3);
        box(tx, 0, w, yg + 2, col); box(tx, 0, 2, yg + 2, shade(col, 1.35)); box(tx + w - 2, 0, 2, yg + 2, shade(col, 0.6));
        for (let k = 0; k < 6; k++) box(tx + 3 + rng() * (w - 6), rng() * yg, 1, 6 + rng() * 10, shade(col, 0.65));
        for (let k = 0; k < 4; k++) { const rw = 4 + rng() * 8; box(tx - rw * (k % 2 ? 1 : 0) + (k % 2 ? 0 : w), yg - 2 - k, rw, 3, col); }
        if (rng() < 0.3) { box(tx + w / 2 - 3, yg - 30, 6, 8, "#0b0806"); }
        if (rng() < 0.5) light(tx + w + 2, yg - 6, p.acc, 14, "wisp");
      }
      for (let i = 0; i < 70; i++) blob(rng() * SW, rng() * 22, 6 + rng() * 10, 4 + rng() * 6, shade(p.leaf, 0.8 + rng() * 0.4), shade(p.leaf, 1.3));
      for (let i = 0; i < 18; i++) { const x = rng() * SW, l = 8 + rng() * 28; box(x, 10, 1, l, shade(p.leaf, 1.5)); dot(x + 1, 10 + l * 0.5, p.grass); }
    } else if (b.id === "nature") {
      for (let x = rng() * 30; x < SW; x += 64 + rng() * 40) {
        const h = 40 + rng() * 40, w = 14, col = shade(p.wall, 0.9 + rng() * 0.2), top = yg - h;
        box(x, top, w, h, col); box(x, top, 2, h, shade(col, 1.3)); box(x + w - 2, top, 2, h, shade(col, 0.6));
        for (let k = 0; k < 5; k++) box(x + rng() * 10, top - 2 + rng() * 3, 3 + rng() * 4, 3, col);
        for (let k = 0; k < 14; k++) dot(x + rng() * w, top + rng() * h * 0.5, p.moss);
        for (let k = 0; k < 3; k++) { const vx = x + rng() * w, l = 10 + rng() * 26; box(vx, top, 1, l, p.moss); dot(vx - 1, top + l * 0.6, shade(p.moss, 1.3)); }
        if (rng() < 0.6) light(x + w + 8 + rng() * 20, top + 10 + rng() * 20, p.acc, 16, "wisp");
      }
      for (let i = 0; i < 12; i++) { const x = rng() * SW, l = 14 + rng() * 30; for (let k = 0; k < l; k++) dot(x + Math.sin(k * 0.3) * 1.5, k, k % 4 ? shade(p.moss, 0.8) : p.moss); }
    } else if (b.id === "demon") {
      for (let x = 0; x < SW; x += 9 + Math.floor(rng() * 6)) { const w = 9 + rng() * 6, col = shade(p.wall, 0.8 + rng() * 0.35), top = rng() * 14; box(x, top, w, yg - top, col); box(x, top, 1, yg - top, shade(col, 1.3)); box(x, top, w, 1, shade(col, 1.4)); }
      for (let x = 30 + rng() * 60; x < SW; x += 150 + rng() * 60) { arch(x, 20, 46, yg - 18, "#000000"); g.globalAlpha = 1; }
      for (let i = 0; i < 7; i++) { let x = rng() * SW, y = 6 + rng() * (yg - 30); const pts = []; for (let k = 0; k < 9; k++) { pts.push([x, y]); box(x, y, 1, 2, p.lava); x += rng() * 3 - 1; y += 2; } S.cracks.push(pts); }
      for (let x = 40 + rng() * 40; x < SW; x += 120 + rng() * 50) { box(x, yg - 12, 8, 2, "#4a3a3a"); box(x + 1, yg - 10, 1, 10, "#2a2020"); box(x + 6, yg - 10, 1, 10, "#2a2020"); light(x + 4, yg - 15, p.light, 40, "fire"); }
      for (let i = 0; i < 4; i++) { const x = rng() * SW, l = 20 + rng() * 30; for (let k = 0; k < l; k += 2) box(x, k, 2, 1, "#3a3a44"); }
    } else if (b.id === "dragon") {
      for (let x = rng() * 40; x < SW; x += 70 + rng() * 30) { const h = 44 + rng() * 20; for (let k = 0; k < h; k++) { const dx = Math.round(Math.sin((k / h) * 1.4) * 22); box(x + dx, yg - k, 4, 1, k % 6 ? p.bone : shade(p.bone, 0.75)); } }
      for (let i = 0; i < 10; i++) { const x = rng() * SW, h = 10 + rng() * 22, col = shade(p.ice, 0.75 + rng() * 0.4); box(x, yg - h, 4, h, col); box(x + 1, yg - h - 3, 2, 3, col); box(x, yg - h, 1, h, "#ffffff"); if (rng() < 0.4) light(x + 2, yg - h, p.acc, 16, "crystal"); }
      for (let i = 0; i < 30; i++) { const x = rng() * SW, l = 3 + rng() * 10; for (let k = 0; k < l; k++) box(x + k * 0.1, k, Math.max(1, 3 - k / 3), 1, p.ice); }
    } else if (b.id === "holy") {
      bricks(0, 0, SW, yg, 24, 10, p.wall, rng, shade(p.wall, 0.7));
      for (let x = 20 + rng() * 30; x < SW; x += 96 + rng() * 30) {
        arch(x - 2, 8, 30, 64, "#2a2418"); arch(x, 10, 26, 60, "#0e0c08");
        const gl = p.glass; for (let yy = 0; yy < 56; yy += 5) for (let xx = 0; xx < 24; xx += 5) if (yy > 6 || (xx > 4 && xx < 18)) box(x + 1 + xx, 13 + yy, 4, 4, gl[Math.floor(rng() * gl.length)]);
        box(x + 12, 10, 2, 60, "#2a2418"); box(x, 40, 26, 2, "#2a2418");
        S.windows.push({ x: x + 13, y: 40 }); if (x + 40 > SW) S.windows.push({ x: x + 13 - SW, y: 40 });
        const cx = x + 44; box(cx, 0, 10, yg, shade(p.wall, 1.15)); box(cx, 0, 2, yg, "#ffffff"); box(cx + 8, 0, 2, yg, shade(p.wall, 0.75)); box(cx - 2, 20, 14, 4, p.gold); box(cx - 2, yg - 6, 14, 6, shade(p.wall, 0.85));
        if (rng() < 0.5) box(cx + 1, 50 + rng() * 20, 7, 3, "#2a2418");
      }
    }
    if (p.indoor || b.id === "nature") {
      const ceil = shade(p.wall || p.far, 0.55);
      box(0, 0, SW, 5, ceil); box(0, 5, SW, 1, shade(ceil, 0.6));
      for (let x = rng() * 8; x < SW; x += 5 + rng() * 14) { const l = 3 + rng() * (b.id === "demon" ? 14 : 9), w = 2 + Math.floor(rng() * 3); for (let k = 0; k < l; k++) box(x + k * 0.15, 5 + k, Math.max(1, w - Math.floor(k / 3)), 1, k > l - 2 && b.id === "demon" ? p.lava : ceil); }
      if (b.id === "brute") for (let i = 0; i < 6; i++) { const x = rng() * SW, l = 6 + rng() * 18; for (let k = 0; k < l; k++) dot(x + Math.sin(k * 0.5), 5 + k, "#3a2a1a"); }
    }
    // floor layer (+ back props on the wall line)
    S.strips.floor = mk(SW, H); g = S.strips.floor.getContext("2d");
    const fh = H - yg;
    box(0, yg - 1, SW, 2, shade(p.floor2, 0.4));
    const rows = []; let acc = 0, rh = 5; while (acc < fh) { rows.push(Math.min(rh, fh - acc)); acc += rh; rh += 2; }
    if (b.id === "brute") { box(0, yg, SW, fh, p.floor); speckle(yg, H, [p.floor2, shade(p.floor, 1.2), "#2a1c12"], 900, rng); for (let i = 0; i < 6; i++) { const x = rng() * SW, y = yg + 10 + rng() * (fh - 16); box(x, y, 28, 4, p.wood); box(x, y, 28, 1, shade(p.wood, 1.3)); box(x + 9, y, 1, 4, shade(p.wood, 0.5)); box(x + 19, y, 1, 4, shade(p.wood, 0.5)); } }
    else if (b.id === "undead") floorTiles(yg, rows, p.floor, p.floor2, shade(p.floor2, 0.5), rng, false);
    else if (b.id === "beast") { box(0, yg, SW, fh, p.floor); speckle(yg, H, [p.floor2, shade(p.floor, 1.15)], 700, rng); for (let x = 0; x < SW; x++) { const h = 1 + Math.floor(rng() * 4); box(x, yg - h + 2, 1, h, rng() < 0.5 ? p.grass : shade(p.grass, 1.25)); } for (let i = 0; i < 25; i++) { const x = rng() * SW, y = yg + 4 + rng() * (fh - 6); dot(x, y, rng() < 0.5 ? "#e8d860" : "#d870a0"); dot(x, y + 1, p.grass); } }
    else if (b.id === "nature") { const mud = Math.round(fh * 0.4); box(0, yg, SW, mud, p.floor); speckle(yg, yg + mud, [p.floor2, p.moss], 500, rng); box(0, yg + mud, SW, fh - mud, p.water); for (let i = 0; i < 40; i++) box(rng() * SW, yg + mud + 2 + rng() * (fh - mud - 4), 3 + rng() * 10, 1, shade(p.water, 1.35)); for (let i = 0; i < 8; i++) { const x = rng() * SW, y = yg + mud + 4 + rng() * (fh - mud - 8); box(x, y, 6, 2, p.moss); dot(x + 2, y, "#e8a0c0"); } S.water = yg + mud; }
    else if (b.id === "demon") { floorTiles(yg, rows, p.floor, p.floor2, p.lava, rng, false); }
    else if (b.id === "dragon") { box(0, yg, SW, fh, p.floor); speckle(yg, H, [p.floor2, "#ffffff"], 600, rng); for (let i = 0; i < 7; i++) { const x = rng() * SW, y = yg + 6 + rng() * (fh - 12), w = 20 + rng() * 30; box(x, y, w, 3, p.ice); box(x + 2, y, w - 6, 1, "#ffffff"); } }
    else if (b.id === "holy") floorTiles(yg, rows, p.floor, p.floor2, shade(p.floor2, 0.6), rng, true);
    if (p.flood && b.id !== "nature") { box(0, yg + fh * 0.55, SW, fh, rgba("#1f5a5a", 0.6)); S.water = yg + fh * 0.55; }
    const bp = BACKPROPS[b.id];
    for (let x = rng() * 30; x < SW; x += 26 + rng() * 40) PROPS[bp[Math.floor(rng() * bp.length)]](x, yg + 1, p);
    // foreground silhouettes along the bottom edge
    S.strips.fg = mk(SW, H); g = S.strips.fg.getContext("2d");
    for (let x = rng() * 20; x < SW; x += 18 + rng() * 46) {
      const k = rng(), col = p.fg;
      if (b.id === "beast" || b.id === "nature") for (let i = 0; i < 6; i++) box(x + i * 2, H - 4 - rng() * 10, 1, 14, col);
      else if (b.id === "dragon") { box(x, H - 12, 4, 12, col); box(x + 1, H - 15, 2, 3, col); box(x + 5, H - 8, 3, 8, col); }
      else blob(x, H + 1, 6 + k * 8, 4 + k * 5, col);
    }
    g = null;
    return S;
  }

  // ---------- state ----------
  let parts = [], nums = [], orbs = [], slashes = [], beams = [], rings = [], weather = [];
  let bv = [], ev = new Map(), scroll = 0, scrollV = 0, shake = 0, flash = 0, flashCol = "#fff", dim = 0, banner = null;
  let eyes = null, eyesT = rnd(50, 110), star = null, starT = rnd(240, 480), auraT = 0;
  R.stop = 0;
  R.areaName = () => (scene ? scene.name : G.biomeOf(G.curFloor()).name);

  // ---------- layout ----------
  R.resize = function () {
    if (!cv) return;
    const w = cv.clientWidth, h = cv.clientHeight, d = window.devicePixelRatio || 1;
    if (!w || !h) return;
    const px = Math.max(1, Math.min((h * d) / 150, (w * d) / 250));
    const nW = Math.max(200, Math.round((w * d) / px)), nH = Math.max(130, Math.round((h * d) / px));
    if (nW === W && nH === H && cv.width === W) return;
    W = nW; H = nH; cv.width = W; cv.height = H; YG = Math.round(H - Math.max(62, H * 0.42));
    c.imageSmoothingEnabled = false;
    scene = null;
    for (let i = 0; i < 5; i++) if (bv[i]) { const p = bpos(i); bv[i].bx = p[0]; bv[i].by = p[1]; }
    ev.forEach((v) => { const p = epos(v.j, v.n, v.big, v.bossWave); v.tx = p[0]; v.y = p[1]; if (v.x < W) v.x = Math.min(v.x, v.tx + 40); });
    makeWeather();
  };
  function bpos(i) { const fh = H - YG; return i < 2 ? [rd(W * 0.31), rd(YG + fh * (i ? 0.66 : 0.3))] : [rd(W * 0.12 + (i === 3 ? -4 : 3)), rd(YG + fh * (0.18 + (i - 2) * 0.3))]; }
  function epos(j, n, big, bossWave) {
    const fh = H - YG;
    if (big) return [rd(W * 0.76), rd(YG + fh * 0.42)];
    if (bossWave) return [rd(W * (j === 1 ? 0.6 : 0.92)), rd(YG + fh * (j === 1 ? 0.22 : 0.74))];
    const t = n <= 1 ? 0.5 : j / (n - 1);
    return [rd(W * (0.6 + (j % 2) * 0.15 + (j > 2 ? 0.08 : 0))), rd(YG + fh * (0.16 + t * 0.62))];
  }

  // ---------- fx ----------
  function burst(x, y, col, n, sp, gr) { if (parts.length > 300) return; for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(0.3, 1) * sp; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 14, l: rnd(0.3, 0.8), col, g: gr == null ? 120 : gr }); } }
  function num(x, y, text, col, big) { nums.push({ x: x + rnd(-6, 6), y, t: 0, s: text, col, big }); if (nums.length > 36) nums.shift(); }
  function glow(x, y, r, col, a) { if (a <= 0.01) return; const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)"); c.globalAlpha = Math.min(1, a); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1; }
  function tinted(img, sx, sy, col, a) { fc.globalCompositeOperation = "source-over"; fc.globalAlpha = 1; fc.clearRect(0, 0, 32, 32); fc.drawImage(img, sx, sy, 32, 32, 0, 0, 32, 32); fc.globalCompositeOperation = "source-atop"; fc.globalAlpha = a; fc.fillStyle = col; fc.fillRect(0, 0, 32, 32); return fl; }
  function sprite(img, sx, sy, x, y, s, a, flip) { const w = 32 * s; c.globalAlpha = a == null ? 1 : a; if (flip) { c.save(); c.translate(rd(x), 0); c.scale(-1, 1); c.drawImage(img, sx, sy, 32, 32, rd(-w / 2), rd(y - w / 2), w, w); c.restore(); } else c.drawImage(img, sx, sy, 32, 32, rd(x - w / 2), rd(y - w / 2), w, w); c.globalAlpha = 1; }
  function text(s, x, y, col, size, align) {
    c.font = (size || 8) + "px Silkscreen, 'Pixelify Sans', monospace"; c.textAlign = align || "center"; c.textBaseline = "alphabetic";
    c.fillStyle = "#0a0505"; c.fillText(s, x + 1, y); c.fillText(s, x - 1, y); c.fillText(s, x, y + 1); c.fillText(s, x, y - 1);
    c.fillStyle = col; c.fillText(s, x, y);
  }
  function shadow(x, y, w) { c.fillStyle = "rgba(0,0,0,.45)"; c.fillRect(rd(x - w / 2), rd(y), rd(w), 2); c.fillRect(rd(x - w / 2 + 2), rd(y - 1), rd(w - 4), 1); }
  R.banner = function (t, col, sub) { banner = { text: t, col: col || "#f3e6c8", sub, t: 0 }; };
  R.flash = function (col, a) { flash = calm() ? a * 0.3 : a; flashCol = col; };
  function makeWeather() { weather = []; for (let i = 0; i < 30; i++) weather.push({ x: rnd(0, W), y: rnd(0, H), v: rnd(5, 16), p: rnd(0, 6) }); }

  const AURA = { atk: "#ff5a4a", cdmg: "#ff5a4a", crit: "#ffe14a", aspd: "#e8f4ff", rage: "#ff8a2a", soul: "#c9a0ff", hp: "#c3ccd9", cleave: "#dfe6f0" };
  function auraOf(b) { if (G.TIER[b.t].rank < 2 || !b.a[0]) return null; const k = b.a[0][0]; return AURA[k] || (k.indexOf("slay_") === 0 ? "#8fe0a0" : null); }

  // ---------- sim events ----------
  R.on = function (e) {
    const C = G.combat;
    switch (e.t) {
      case "floorStart": if (!scene || scene.f !== e.f) scene = null; ev.forEach((v) => { if (!v.dying) v.dying = 0.6; }); scrollV = 70; break;
      case "wave": {
        const n = C.enemies.length, bossWave = C.boss && C.wave === C.waves;
        C.enemies.forEach((en, j) => {
          const big = en.kind === "boss" || en.kind === "hollow", p = epos(j, n, big, bossWave && !big);
          ev.set(en.id, { id: en.id, mi: en.mi, kind: en.kind, sw: en.sw, trait: en.trait, j, n, big, bossWave: bossWave && !big, x: W + 20 + j * 12, tx: p[0], y: p[1], s: big ? 2 : 1, hit: 0, dying: 0, hp: 1, bump: 0, age: 0, flip: Math.random() < 0.5 });
        });
        if (e.boss) { R.banner(C.enemies[0].name.toUpperCase(), "#ff5a4a", "Guardian of " + R.areaName()); if (!calm()) shake = 3; }
        break;
      }
      case "waveClear": scrollV = 50; break;
      case "strike": { const b = bv[e.slot], v = ev.get(e.eid); if (b && v) { b.t = 0; b.tx = v.x - 16 * v.s - 6; b.ty = v.y; } break; }
      case "hit": {
        const v = ev.get(e.eid); if (!v) break;
        const col = G.EL[e.el] ? G.EL[e.el].color : "#fff";
        v.hit = 1;
        if (!e.sub) slashes.push({ x: v.x - 6, y: v.y, a: rnd(-0.8, 0.8), l: 0.2, col });
        burst(v.x - 4, v.y, col, e.crit ? 8 : 4, 60);
        num(v.x, v.y - 12 * v.s - 4, G.fmt(e.dmg), e.crit ? "#ffd866" : e.counter ? col : "#f3e6c8", e.crit);
        if (e.crit && !calm()) { shake = Math.max(shake, 2); R.stop = 0.04; }
        break;
      }
      case "miss": { const v = ev.get(e.eid); if (v) num(v.x, v.y - 16, "MISS", "#8fa3c8"); break; }
      case "freeze": { const v = ev.get(e.eid); if (v) burst(v.x, v.y, "#bff3ff", 6, 40, 20); break; }
      case "kill": {
        const v = ev.get(e.eid); if (!v) break;
        v.dying = 0.001; v.el = e.el;
        const col = G.EL[e.el] ? G.EL[e.el].color : "#ff9a4a";
        if (e.el === "ice") burst(v.x, v.y, "#d8f6ff", 14, 100, 260);
        else if (e.el === "void") for (let i = 0; i < 12; i++) { const a = rnd(0, 6.28); parts.push({ x: v.x + Math.cos(a) * 26, y: v.y + Math.sin(a) * 26, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 60, l: 0.42, col, g: 0 }); }
        else if (e.el === "holy") rings.push({ x: v.x, y: v.y, t: 0, col, max: 40, d: 0.5 });
        else if (e.el === "poison") burst(v.x, v.y, col, 12, 40, -40);
        else burst(v.x, v.y, e.el === "fire" ? "#ff9a4a" : col, 12, 90);
        const n = e.kind === "boss" ? 8 : e.kind ? 4 : 2;
        for (let i = 0; i < n && orbs.length < 40; i++) orbs.push({ x: v.x, y: v.y, vx: rnd(-60, 60), vy: rnd(-100, -30), t: 0 });
        if (e.kind === "boss" || e.kind === "hollow") { rings.push({ x: v.x, y: v.y, t: 0, col: "#fff", max: 300, d: 0.8 }); R.flash("#fff", 0.5); if (!calm()) { shake = 6; R.stop = 0.12; } }
        break;
      }
      case "ehit": { const v = ev.get(e.eid), b = bv[e.slot]; if (v) v.bump = 1; if (b) { b.hitT = 1; num(b.x, b.y - 16, "-" + G.fmt(e.dmg), "#ff6a5a"); burst(b.x + 6, b.y, "#ff6a5a", 3, 40); } break; }
      case "break": { const b = bv[e.slot]; if (b) burst(b.x, b.y, "#c3ccd9", 12, 70); break; }
      case "ult": { const b = bv[e.slot]; if (b) { b.cast = 1.5; if (!e.named) num(b.x, b.y - 22, "HEAVY STRIKE", G.EL[e.el].color); } if (e.named) { dim = 1.5; R.banner(e.name.toUpperCase(), G.EL[e.el].color); } break; }
      case "ultHit": { const b = bv[e.slot]; if (b) rings.push({ x: b.x, y: b.y, t: 0, col: G.EL[e.el].color, max: e.named ? 360 : 90, d: 0.7 }); if (!calm()) shake = e.named ? 4 : 2; break; }
      case "drop": { const v = e.eid && ev.get(e.eid), x = v ? v.x : W * rnd(0.45, 0.6), y = v ? v.y + 10 : YG + rnd(20, H - YG - 10); beams.push({ x: rd(x), y: rd(y), l: 2.6, col: e.kind === "rune" ? "#55c6f8" : "#6fd6ff", glyph: e.kind === "rune" ? G.RUNE[e.rune.k].glyph : "◆" }); break; }
      case "impFled": { const v = ev.get(e.eid); if (v) { burst(v.x, v.y, "#ffd24a", 8, 60); v.dying = 0.7; } break; }
      case "rebirth": R.flash("#ffb45a", 1); rings.push({ x: W / 2, y: H / 2, t: 0, col: "#ffb45a", max: 400, d: 1.2 }); ev.clear(); break;
      case "wipe": R.flash("#7a0c08", 0.7); break;
      case "star": star = { t: 0, x: rnd(W * 0.1, W * 0.5), y: rnd(6, 24) }; break;
    }
  };

  // ---------- secrets ----------
  R.click = function (px, py) {
    const r = cv.getBoundingClientRect(), x = ((px - r.left) / r.width) * W, y = ((py - r.top) / r.height) * H;
    if (eyes && eyes.t < eyes.d && Math.hypot(x - eyes.x, y - eyes.y) < 18) {
      const res = G.secret(); burst(eyes.x, eyes.y, "#b56bff", 18, 80, 0); eyes = null;
      G.ui.toast(`Something was watching. +${G.fmt(res.souls)} gold${res.extra}`, "#b56bff"); G.ui.toast(res.line, "#a39279");
      G.audio && G.audio.play("secret");
      return true;
    }
    return false;
  };

  // ---------- update ----------
  function update(dt) {
    T += dt;
    const C = G.combat, s = G.s;
    scrollV *= Math.pow(0.03, dt); scroll += (3 + scrollV) * dt;
    shake *= Math.pow(0.001, dt); flash = Math.max(0, flash - dt * 2.2); dim = Math.max(0, dim - dt);
    if (banner && (banner.t += dt) > 1.8) banner = null;
    auraT -= dt;
    for (let i = 0; i < 5; i++) {
      const p = G.party && G.party[i];
      if (!p) { bv[i] = null; continue; }
      const pos = bpos(i);
      const b = bv[i] || (bv[i] = { x: pos[0], y: pos[1], t: -1, tx: 0, ty: 0, hitT: 0, cast: 0, ph: i * 1.7, go: 0 });
      b.bx = pos[0]; b.by = pos[1];
      if (b.t >= 0) { b.t += dt / 0.3; if (b.t >= 1) b.t = -1; }
      b.hitT = Math.max(0, b.hitT - dt * 4); b.cast = Math.max(0, b.cast - dt);
      let go = 0; if (b.t >= 0) go = b.t < 0.45 ? 1 - Math.pow(1 - b.t / 0.45, 3) : 1 - Math.pow((b.t - 0.45) / 0.55, 2);
      b.go = go;
      const bob = Math.round(Math.sin(T * 2.2 + b.ph) * 2);
      b.x = b.bx + (b.tx - b.bx) * go; b.y = b.by + bob * (1 - go) + (b.ty - b.by) * go;
      const cb = C && C.blades[i]; b.dead = !!(cb && cb.dead); b.hp = cb ? cb.hp / cb.max : 1;
      const au = auraT <= 0 && !b.dead && auraOf(p.b);
      if (au && parts.length < 260) parts.push({ x: b.x + rnd(-6, 6), y: b.y + rnd(-8, 8), vx: -8, vy: -10, l: 0.6, col: au, g: -10 });
    }
    if (auraT <= 0) auraT = 0.12;
    const live = new Map(); if (C) C.enemies.forEach((e) => live.set(e.id, e));
    ev.forEach((v, id) => {
      const e = live.get(id);
      v.age += dt; v.hit = Math.max(0, v.hit - dt * 5); v.bump = Math.max(0, v.bump - dt * 5);
      if (v.x > v.tx) v.x = Math.max(v.tx, v.x - 150 * dt);
      if (e) { v.hp = Math.max(0, e.hp / e.max); v.frz = e.frz > 0; v.burn = e.burn > 0; v.life = e.life; }
      if (v.kind === "imp" && !v.dying) v.x = v.tx + Math.sin(v.age * 3.2) * 28;
      if (v.dying) { v.dying += dt * 2.4; if (v.dying >= 1) ev.delete(id); }
      else if (!e) v.dying = 0.5;
    });
    parts = parts.filter((p) => { p.l -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; return p.l > 0; });
    nums = nums.filter((n) => (n.t += dt) < 0.9);
    slashes = slashes.filter((x) => (x.l -= dt) > 0);
    rings = rings.filter((r) => (r.t += dt) < r.d);
    beams = beams.filter((b) => (b.l -= dt) > 0);
    orbs = orbs.filter((o) => {
      o.t += dt; const dx = 6 - o.x, dy = 6 - o.y, d = Math.hypot(dx, dy) || 1, h = Math.min(1, o.t * 1.6);
      o.vx += ((dx / d) * 360 * h - o.vx * 2 * h) * dt * 4; o.vy += ((dy / d) * 360 * h - o.vy * 2 * h) * dt * 4; o.x += o.vx * dt; o.y += o.vy * dt;
      return d > 8 && o.t < 2.2;
    });
    const wt = scene ? scene.p.weather : "dust";
    weather.forEach((e) => {
      if (wt === "ash" || wt === "snow") { e.y += e.v * (wt === "snow" ? 1.4 : 0.7) * dt; e.x += Math.sin(T + e.p) * 6 * dt; if (e.y > H) { e.y = -2; e.x = rnd(0, W); } }
      else if (wt === "fireflies" || wt === "motes" || wt === "dust") { e.x += Math.cos(T * 0.6 + e.p) * 7 * dt; e.y += Math.sin(T * 0.8 + e.p * 2) * 5 * dt; }
      else { e.y -= e.v * dt; e.x += Math.sin(T + e.p) * 4 * dt; if (e.y < -2) { e.y = H + 2; e.x = rnd(0, W); } }
      if (e.x > W + 4) e.x -= W + 8; if (e.x < -4) e.x += W + 8;
    });
    if (!G.paused) {
      eyesT -= dt;
      if (eyesT <= 0 && !eyes) { eyes = { x: rnd(W * 0.3, W * 0.9), y: rnd(14, YG - 14), t: 0, d: 7 }; eyesT = rnd(90, 240); }
      if (eyes && (eyes.t += dt) > eyes.d) eyes = null;
      starT -= dt;
      if (starT <= 0 && s.best >= 10) { starT = rnd(360, 780); G.starfall(); }
      if (star && (star.t += dt) > 1.4) star = null;
    }
  }

  // ---------- draw ----------
  function strip(cv2, f) { const o = -Math.round(((scroll * f) % SW + SW) % SW); c.drawImage(cv2, o, 0); c.drawImage(cv2, o + SW, 0); }
  function flame(x, y, col, t, big) {
    const k = Math.floor(t * 12) % 3, h = (big ? 6 : 4) + k;
    c.fillStyle = "#ff3a1a"; c.fillRect(x - 1, y - h + 1, 3, h - 1);
    c.fillStyle = col; c.fillRect(x - 1, y - h + 2 + (k === 1 ? 1 : 0), 3, h - 2);
    c.fillStyle = "#fff6c8"; c.fillRect(x, y - 2, 1, 2);
    if (k === 2) { c.fillStyle = "#ffcf5a"; c.fillRect(x + (k % 2 ? 1 : -1), y - h - 1, 1, 1); }
  }
  function draw() {
    const C = G.combat, s = G.s;
    if (!scene) scene = buildScene(G.curFloor());
    const p = scene.p, pend = s.omen.pend && s.omen.pend.id, hollow = (C && C.hollow) || pend === "hollow";
    const sx = shake > 0.4 ? rd(rnd(-shake, shake)) : 0, sy = shake > 0.4 ? rd(rnd(-shake, shake) * 0.5) : 0;
    c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false; c.globalCompositeOperation = "source-over"; c.globalAlpha = 1;
    c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
    c.translate(sx, sy);
    strip(scene.strips.far, 0.15);
    if (s.moon > 0 || pend === "moon") { c.fillStyle = s.moon > 0 ? "#c81e1e" : "#5a1414"; c.beginPath(); c.arc(rd(W * 0.82), 16, 7, 0, 6.3); c.fill(); c.globalCompositeOperation = "lighter"; glow(W * 0.82, 16, 26, "#ff2a2a", s.moon > 0 ? 0.6 : 0.25); c.globalCompositeOperation = "source-over"; }
    if (star) { const q = star.t / 1.4; c.fillStyle = "#fff6d0"; for (let i = 0; i < 8; i++) { c.globalAlpha = (1 - q) * (1 - i / 8); c.fillRect(rd(star.x + q * 120 - i * 3), rd(star.y + q * 34 - i), 1, 1); } c.globalAlpha = 1; }
    // a guardian's shadow crosses the far wall two floors before it arrives
    if (!G.rift && C && (C.floor % 10 === 8 || C.floor % 10 === 9)) { const bi = scene.b.boss, cell = G.moCell(bi), q = ((T * 0.05) % 1.3) - 0.15; sprite(tinted(imgM, cell[0], cell[1], "#000", 1), 0, 0, W * (1 - q), YG - 34, 3, 0.35); }
    strip(scene.strips.mid, 0.45);
    strip(scene.strips.floor, 1);
    // living environment
    const tcol = hollow ? "#31405a" : pend === "shrine" || s.curse > 0 ? "#b56bff" : s.moon > 0 ? "#ff3b3b" : p.light;
    const off = (f) => -Math.round(((scroll * f) % SW + SW) % SW);
    const o45 = off(0.45);
    const dk = c.createLinearGradient(0, 0, 0, YG); dk.addColorStop(0, "rgba(0,0,0,.35)"); dk.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = dk; c.fillRect(0, 0, W, YG);
    c.globalCompositeOperation = "lighter";
    scene.lights.forEach((L) => { for (const base of [o45, o45 + SW]) { const x = L.x + base; if (x < -40 || x > W + 40) continue; const fl2 = 0.8 + Math.sin(T * 9 + L.x) * 0.1 + Math.sin(T * 23 + L.y) * 0.08; glow(x, L.y, L.r, L.kind === "torch" || L.kind === "fire" ? tcol : L.col, (hollow ? 0.06 : L.kind === "wisp" ? 0.35 + Math.sin(T * 2 + L.x) * 0.2 : 0.3) * fl2); } });
    if (scene.cracks.length) { const a = 0.35 + Math.sin(T * 2) * 0.25; c.fillStyle = rgba(p.lava2, a); scene.cracks.forEach((pts) => pts.forEach((q) => { for (const base of [o45, o45 + SW]) c.fillRect(rd(q[0] + base), q[1], 1, 2); })); }
    scene.windows.forEach((wn) => { for (const base of [o45, o45 + SW]) { const x = wn.x + base; if (x < -60 || x > W + 60) continue; glow(x, wn.y, 34, "#ffe9b0", 0.22); c.fillStyle = "rgba(255,240,190,.06)"; c.beginPath(); c.moveTo(x - 10, wn.y - 26); c.lineTo(x + 10, wn.y - 26); c.lineTo(x + 40, H); c.lineTo(x + 6, H); c.fill(); } });
    c.globalCompositeOperation = "source-over";
    scene.lights.forEach((L) => { if (L.kind !== "torch" && L.kind !== "fire" && L.kind !== "candle") return; for (const base of [o45, o45 + SW]) { const x = rd(L.x + base); if (x < -4 || x > W + 4 || hollow) continue; flame(x, L.y + (L.kind === "candle" ? 2 : 4), L.kind === "candle" ? "#ffd08a" : tcol, T + L.x, L.kind === "fire"); } });
    if (scene.water) { c.fillStyle = "rgba(190,255,240,.18)"; for (let i = 0; i < 6; i++) { const y = rd(scene.water + 3 + i * ((H - scene.water) / 6)), x = rd(((T * 12 + i * 47) % (W + 30)) - 15); c.fillRect(x, y, 8 + (i % 3) * 4, 1); } }
    if (pend === "champion") { c.fillStyle = "rgba(0,0,0,.35)"; for (let i = 0; i < 2; i++) { const x = rd(W * (0.62 + i * 0.2) + Math.sin(T * 0.7 + i) * 6); c.fillRect(x - 12, YG - 46, 24, 46); c.fillRect(x - 8, YG - 54, 16, 8); } }
    if (pend === "imp") { c.fillStyle = "#ffd24a"; for (let i = 0; i < 7; i++) if (Math.sin(T * 4 + i * 1.9) > 0.6) c.fillRect(rd(W * 0.5 + ((i * 37) % (W * 0.45))), rd(YG + 8 + ((i * 23) % (H - YG - 12))), 1, 1); }
    if (pend === "smith") { c.fillStyle = "#ffb45a"; for (let i = 0; i < 9; i++) { const q = (T * 0.4 + i * 0.11) % 1; c.globalAlpha = 1 - q; c.fillRect(rd(W - q * 80 - (i % 3) * 6), rd(YG + 10 - q * 30 + Math.sin(i * 9 + T * 3) * 6), 1, 1); } c.globalAlpha = 1; }
    if (eyes) { const a = Math.sin(Math.min(1, eyes.t / 0.6) * 1.57) * (eyes.t > eyes.d - 0.6 ? (eyes.d - eyes.t) / 0.6 : 1), blink = Math.sin(eyes.t * 2.1) > 0.94; c.globalCompositeOperation = "lighter"; glow(eyes.x, eyes.y, 10, "#b56bff", 0.5 * a); c.globalCompositeOperation = "source-over"; if (!blink) { c.fillStyle = `rgba(240,210,255,${a})`; c.fillRect(rd(eyes.x - 4), rd(eyes.y), 2, 1); c.fillRect(rd(eyes.x + 2), rd(eyes.y), 2, 1); } }
    if (dim > 0) { c.fillStyle = `rgba(0,0,0,${0.45 * Math.sin((Math.min(1.5, dim) / 1.5) * Math.PI)})`; c.fillRect(-10, -10, W + 20, H + 20); }

    beams.forEach((bm) => {
      const a = Math.min(1, bm.l) * (0.75 + Math.sin(T * 10) * 0.15);
      c.globalCompositeOperation = "lighter"; c.globalAlpha = a * 0.35; c.fillStyle = bm.col; c.fillRect(bm.x - 3, 0, 7, bm.y); c.globalAlpha = a; c.fillRect(bm.x - 1, 0, 3, bm.y); c.globalAlpha = 1; glow(bm.x, bm.y, 16, bm.col, a * 0.8); c.globalCompositeOperation = "source-over";
      text(bm.glyph, bm.x, bm.y - 2 + rd(Math.sin(T * 3) * 2), "#ffffff", 8);
    });

    const ents = [];
    bv.forEach((bl, i) => bl && ents.push({ y: bl.by, bl, i }));
    ev.forEach((v) => ents.push({ y: v.y, v }));
    ents.sort((a, z) => a.y - z.y).forEach((e) => {
      if (e.bl) {
        const bl = e.bl, pp = G.party[e.i]; if (!pp) return;
        const col = G.EL[pp.st.el].color, casting = bl.cast > 0, idx = pp.b.i, qx = (idx % 6) * 32, qy = Math.floor(idx / 6) * 32;
        shadow(bl.bx, bl.by + 15, 14);
        if (bl.dead) { sprite(tinted(imgS, qx, qy, "#000", 0.65), 0, 0, bl.bx, bl.by + 6, 1, 0.8); return; }
        const ready = G.rage[e.i] >= 100;
        c.globalCompositeOperation = "lighter"; glow(bl.x, bl.y, casting ? 30 : ready ? 20 + Math.sin(T * 8) * 3 : 15, col, casting ? 0.7 : ready ? 0.55 : 0.28 + bl.go * 0.25); if (pp.b.t === "mythic") glow(bl.x, bl.y, 22, "#ff4558", 0.25 + Math.sin(T * 3 + e.i) * 0.08); c.globalCompositeOperation = "source-over";
        if (bl.go > 0.1) { sprite(imgS, qx, qy, bl.x - (bl.x - bl.bx) * 0.25, bl.y, 1, 0.25); }
        const hit = bl.hitT > 0.5;
        sprite(hit ? tinted(imgS, qx, qy, "#ff5a4a", 0.7) : imgS, hit ? 0 : qx, hit ? 0 : qy, bl.x + (hit ? rd(rnd(-1, 1)) : 0), bl.y - (casting ? 4 : 0), 1, 1);
        if (pp.b.s > 0 && Math.sin(T * 2 + e.i * 2) > 0.8) { c.fillStyle = "#fff"; c.fillRect(rd(bl.x + rnd(-8, 8)), rd(bl.y + rnd(-10, 10)), 1, 1); }
        if (bl.hp < 0.999) { c.fillStyle = "#000"; c.fillRect(bl.bx - 9, bl.by + 18, 18, 3); c.fillStyle = bl.hp > 0.35 ? "#5fd08a" : "#e0503a"; c.fillRect(bl.bx - 8, bl.by + 19, Math.max(0, rd(16 * bl.hp)), 1); }
        if (ready && !casting) { c.fillStyle = Math.sin(T * 10) > 0 ? "#ffe14a" : "#ff8a2a"; c.fillRect(bl.bx - 1, bl.by - 22, 2, 4); c.fillRect(bl.bx - 1, bl.by - 16, 2, 1); }
      } else {
        const v = e.v, a = v.dying ? Math.max(0, 1 - v.dying) : 1, S2 = v.s, h = 16 * S2, x = rd(v.x + v.hit * 2 - v.bump * 5), y = rd(v.y - (v.dying ? v.dying * 6 : 0) + (v.age % 1 < 0.5 ? 0 : 1));
        shadow(v.x, v.y + h - 2, h * 1.1);
        if (v.kind === "champ" || v.kind === "boss") { c.globalCompositeOperation = "lighter"; glow(v.x, v.y, h * 1.4, v.kind === "boss" ? "#ff3a2a" : "#ff8a2a", (0.25 + Math.sin(T * 5) * 0.06) * a); c.globalCompositeOperation = "source-over"; }
        if (v.kind === "gild" || v.kind === "imp") { c.globalCompositeOperation = "lighter"; glow(v.x, v.y, h * 1.3, "#ffd24a", 0.35 * a); c.globalCompositeOperation = "source-over"; if (Math.random() < 0.2) parts.push({ x: v.x + rnd(-h, h) * 0.6, y: v.y + rnd(-h, h) * 0.6, vx: 0, vy: -8, l: 0.5, col: "#fff2a8", g: 0 }); }
        if (v.kind === "hollow") {
          const i = v.sw, qx = (i % 6) * 32, qy = Math.floor(i / 6) * 32;
          c.globalCompositeOperation = "lighter"; glow(x, y, 40, "#8fa3c8", 0.35); c.globalCompositeOperation = "source-over";
          sprite(tinted(imgS, qx, qy, v.hit > 0.45 ? "#fff" : "#05070c", v.hit > 0.45 ? 1 : 0.75), 0, 0, x, y, 2, a, true);
        } else {
          const cell = G.moCell(v.mi); let src = imgM, qx = cell[0], qy = cell[1];
          if (v.dying) { src = tinted(imgM, qx, qy, v.el === "ice" ? "#bff3ff" : v.el === "void" ? "#3a1060" : "#ff8a3a", 1); qx = qy = 0; }
          else if (v.hit > 0.45) { src = tinted(imgM, qx, qy, "#fff", 1); qx = qy = 0; }
          else if (v.frz) { src = tinted(imgM, qx, qy, "#7fdcff", 0.6); qx = qy = 0; }
          else if (v.kind === "gild" || v.kind === "imp") { src = tinted(imgM, qx, qy, "#ffc830", 0.55); qx = qy = 0; }
          else if (v.kind === "champ") { src = tinted(imgM, qx, qy, "#ff7a20", 0.25); qx = qy = 0; }
          sprite(src, qx, qy, x, y, S2, a, v.flip);
        }
        if (!v.dying && !v.big) {
          if (v.hp < 0.999) { c.fillStyle = "#000"; c.fillRect(rd(v.x - 10), rd(v.y - h - 4), 20, 3); c.fillStyle = "#d0342a"; c.fillRect(rd(v.x - 9), rd(v.y - h - 3), Math.max(0, rd(18 * v.hp)), 1); }
          if (v.kind === "champ") text(v.trait.toUpperCase(), v.x, v.y - h - 6, "#ffb45a", 8);
          if (v.kind === "imp" && v.life != null) { c.fillStyle = "#000"; c.fillRect(rd(v.x - 10), rd(v.y - h - 8), 20, 3); c.fillStyle = "#ffd24a"; c.fillRect(rd(v.x - 9), rd(v.y - h - 7), Math.max(0, rd(18 * v.life / 8)), 1); }
        }
        if (v.burn && !v.dying && Math.random() < 0.3) parts.push({ x: v.x + rnd(-6, 6), y: v.y + rnd(-4, 8), vx: 0, vy: -30, l: 0.4, col: "#ff8a3a", g: -20 });
      }
    });

    c.globalCompositeOperation = "lighter";
    slashes.forEach((q) => { c.save(); c.translate(rd(q.x), rd(q.y)); c.rotate(q.a); c.strokeStyle = q.col; c.globalAlpha = q.l / 0.2; c.lineWidth = 2; c.beginPath(); c.arc(-10, 0, 16, -0.9, 0.9); c.stroke(); c.strokeStyle = "#fff"; c.lineWidth = 1; c.stroke(); c.restore(); });
    rings.forEach((r) => { const q = r.t / r.d; c.strokeStyle = r.col; c.globalAlpha = 1 - q; c.lineWidth = Math.max(1, 5 * (1 - q)); c.beginPath(); c.arc(r.x, r.y, q * r.max, 0, 6.3); c.stroke(); });
    c.globalAlpha = 1;
    parts.forEach((q) => { c.globalAlpha = Math.min(1, q.l * 2.5); c.fillStyle = q.col; c.fillRect(rd(q.x), rd(q.y), 1, 1); });
    c.globalAlpha = 1;
    orbs.forEach((o) => { glow(o.x, o.y, 5, "#ffd24a", 0.8); c.fillStyle = "#fff6c8"; c.fillRect(rd(o.x), rd(o.y), 1, 1); });
    c.globalCompositeOperation = "source-over";
    strip(scene.strips.fg, 1.3);
    const wt = p.weather, wcol = s.moon > 0 ? "#ff5a4a" : wt === "ash" ? "#9aa0a8" : wt === "snow" ? "#f0f8ff" : wt === "fireflies" ? "#e0ff8a" : wt === "spores" ? "#7affc8" : wt === "motes" ? "#fff0b0" : wt === "dust" ? "#c8a878" : "#ff9a4a";
    c.fillStyle = wcol;
    weather.forEach((e) => { c.globalAlpha = wt === "fireflies" ? Math.max(0, Math.sin(T * 2 + e.p * 3)) : wt === "dust" ? 0.25 : 0.35 + Math.sin(T * 3 + e.p) * 0.25; c.fillRect(rd(e.x), rd(e.y), 1, 1); });
    c.globalAlpha = 1;
    nums.forEach((n) => { const q = n.t / 0.9, y = n.y - 18 * (1 - Math.pow(1 - q, 2)); c.globalAlpha = q > 0.7 ? (1 - q) / 0.3 : 1; text(n.s, rd(n.x), rd(y), n.col, n.big ? 16 : 8); });
    c.globalAlpha = 1;
    c.setTransform(1, 0, 0, 1, 0, 0);

    if (s.moon > 0 || pend === "moon") { c.fillStyle = `rgba(160,10,10,${s.moon > 0 ? 0.16 : 0.07})`; c.fillRect(0, 0, W, H); }
    if (G.rift) { c.fillStyle = "rgba(90,30,160,.18)"; c.fillRect(0, 0, W, H); }
    const vg = c.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, W * 0.75); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, s.curse > 0 ? "rgba(40,0,70,.75)" : `rgba(0,0,0,${hollow ? 0.9 : 0.38})`); c.fillStyle = vg; c.fillRect(0, 0, W, H);
    if (banner) { const a = Math.sin(Math.min(1, banner.t / 1.8) * Math.PI); c.globalAlpha = Math.min(1, a * 1.6); text(banner.text, rd(W / 2), 30, banner.col, 16); if (banner.sub) text(banner.sub, rd(W / 2), 42, "#e2d5ba", 8); c.globalAlpha = 1; }
    if (flash > 0) { c.globalAlpha = Math.min(1, flash); c.fillStyle = flashCol; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    if (G.paused === "user") { c.fillStyle = "rgba(0,0,0,.5)"; c.fillRect(0, 0, W, H); text("PAUSED", rd(W / 2), rd(H / 2), "#e2d5ba", 16); }
  }

  R.init = function (canvas) {
    cv = canvas; c = cv.getContext("2d", { alpha: false }); R.resize();
    cv.addEventListener("pointerdown", (e) => R.click(e.clientX, e.clientY));
    window.addEventListener("resize", R.resize);
    if (window.ResizeObserver) new ResizeObserver(R.resize).observe(cv);
  };
  R.frame = function (dt) { if (!cv || R.ready < 2) return; update(dt); draw(); };
})();
