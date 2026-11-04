// ===================== PROCEDURAL BLADE ART =====================
// Draws 32x32 pixel-art blades in the style of assets/sprite_swords.png: diagonal, tip to the
// top-left, hilt to the bottom-right, a dark outline, light from the top-right, element sparks.
// Every catalog entry with a `gen` seed gets its own design, so the summon pool can hold
// hundreds of different-looking blades with no image files. Same seed = same picture everywhere.
// The drawing is plain math (no DOM), so tools can render previews in Node too.
window.G = window.G || {};
(function () {
  const G = window.G, N = 32;
  const rng = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const INK = [20, 12, 24];
  // Four-step colour ramp from one base colour: shadow, base, light, shine.
  function ramp(base) { const c = typeof base === "string" ? hex(base) : base; return [mix(c, INK, 0.55), c, mix(c, [255, 255, 255], 0.35), mix(c, [255, 255, 255], 0.75)]; }

  const METAL = {
    steel: "#9aa6b8", silver: "#c8d2e0", iron: "#6e7888", dark: "#4a5266", gold: "#e0b040", bronze: "#b87838", copper: "#d07848",
    obsidian: "#3c3250", ice: "#8fd8ff", crystal: "#b8a0ff", bone: "#ddd2b2", jade: "#58c090", crimson: "#c83838", teal: "#3aa8a0",
    rose: "#e070a0", ember: "#ff7a2a", amethyst: "#9a5ad8", ivory: "#f0e8d0", night: "#2c3a5c", moss: "#6a8a3a", sun: "#ffd860",
  };
  // Blade metals per realm (the realm's look), and hilt metals anyone can use.
  const REALM_METAL = [
    ["steel", "silver", "iron", "steel", "bronze", "dark"], ["obsidian", "ember", "copper", "crimson", "dark"], ["ice", "silver", "crystal", "ice", "steel"],
    ["teal", "jade", "silver", "night", "teal"], ["bone", "ivory", "bone", "iron"], ["night", "steel", "silver", "dark", "sun"],
    ["jade", "moss", "bronze", "bone", "teal"], ["gold", "sun", "gold", "silver", "bronze"], ["obsidian", "amethyst", "crystal", "night", "rose"],
    ["crimson", "obsidian", "gold", "dark", "crimson"],
  ];
  const HILT = ["gold", "silver", "bronze", "dark", "bone", "copper", "jade", "crimson", "obsidian", "ivory"];
  const GRIP = ["#6a3a20", "#3a2418", "#8a2020", "#20304a", "#2a2a2a", "#4a2a5a", "#2a5a3a", "#7a5a2a", "#1a3a5a"];
  const ELC = { fire: "#ff6a2a", ice: "#7ad8ff", lightning: "#ffe14a", holy: "#fff0a0", void: "#b56bff", poison: "#7dff6a", steel: "#e8f0ff" };
  const PROFILES = ["straight", "taper", "broad", "leaf", "wavy", "needle", "curved", "cleaver", "serrated", "crystal", "great", "fang"];
  const GUARDS = ["bar", "curve", "wing", "disc", "spike", "ring", "claw", "none"];
  const RANK = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };

  // ---------- design (what the blade looks like) ----------
  G.bladeSpec = function (seed, o) {
    const r = rng(seed), pick = (a) => a[Math.floor(r() * a.length)], rank = RANK[o.rarity] || 0, realm = o.realm || 0;
    const prof = o.profile || pick(rank === 0 ? ["straight", "taper", "broad", "straight", "cleaver", "needle", "curved", "leaf"] : PROFILES);
    const great = prof === "great" || prof === "cleaver";
    const metal = o.metal || pick(REALM_METAL[realm] || REALM_METAL[0]);
    let hilt = o.hilt || pick(HILT); if (hilt === metal || (METAL[hilt] && METAL[hilt] === METAL[metal])) hilt = HILT[(HILT.indexOf(hilt) + 3) % HILT.length];
    const S = {
      prof, guard: o.guard || (rank === 0 && r() < 0.4 ? "bar" : pick(GUARDS)),
      metal, hilt, grip: pick(GRIP),
      el: o.element || "steel", rank,
      len: 32 + Math.floor(r() * 3) + (rank >= 2 ? 1 : 0) + (great ? 1 : 0),
      w: (prof === "needle" ? 1.2 : great ? 3.3 : prof === "broad" ? 2.9 : 2.1) + r() * 0.7,
      grip_l: 3.5 + r() * 2.5 + (great ? 1.5 : 0), pr: 1.7 + r() * 0.7, gw: 4.5 + r() * 3 + (rank >= 3 ? 1 : 0), gt: 1.7 + r() * 1.2,
      curve: (r() < 0.5 ? -1 : 1) * (1.5 + r() * 2.5), freq: 3 + Math.floor(r() * 3), fuller: r() < 0.55, core: rank >= 3 || (rank === 2 && r() < 0.5),
      gem: rank >= 1 && r() < 0.4 + rank * 0.2, pgem: r() < 0.35, wrap: r() < 0.7, asym: 0.7 + r() * 0.6, tip: 0.1 + r() * 0.2,
      sparks: rank >= 2 ? 2 + rank * 2 : r() < 0.2 ? 1 : 0, seed,
    };
    // The guard always reaches past the blade so the hilt reads clearly at 32 px.
    const bw = S.w * (prof === "cleaver" ? 1.6 : prof === "broad" || prof === "fang" ? 1.3 : 1);
    S.gw = Math.max(S.gw, bw + 2.2);
    return S;
  };

  // ---------- drawing ----------
  // Work in blade space: t runs from the pommel (0) to the tip, u runs across (+ = lit side).
  const OX = 28.6, OY = 28.6, D = Math.SQRT1_2;
  G.bladePixels = function (S) {
    const r = rng(S.seed * 7 + 3), px = new Array(N * N).fill(null);
    const M = ramp(METAL[S.metal]), H = ramp(METAL[S.hilt]), GR = ramp(S.grip), E = hex(ELC[S.el] || ELC.steel);
    const pr = S.pr, gripEnd = pr * 2 + S.grip_l, tg = gripEnd, tb = tg + S.gt, L = S.len;
    const crystal = []; for (let i = 0; i < 12; i++) crystal.push(0.75 + r() * 0.6);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - OX, dy = y + 0.5 - OY, t = -(dx + dy) * D, u = (dx - dy) * D;
      let col = null;
      // blade
      if (t >= tb - 0.2 && t <= L) {
        const s = (t - tb) / (L - tb);
        let c = 0, hw = S.w, a = 1, b = 1;
        switch (S.prof) {
          case "taper": hw *= 1 - 0.5 * s; break;
          case "broad": a = 1.25; break;
          case "leaf": hw *= 0.65 + 0.7 * Math.sin(Math.PI * Math.min(1, 0.15 + s * 0.85)); break;
          case "wavy": hw += 0.7 * Math.sin(s * S.freq * 2 * Math.PI); break;
          case "needle": hw *= 1 - 0.3 * s; break;
          case "curved": c = S.curve * s * s; hw *= 1 - 0.25 * s; b = 0.7; break;
          case "cleaver": a = 1.6; b = 0.8; hw *= 0.9 + 0.3 * s; break;
          case "serrated": if (Math.floor(t) % 2 === 0) b += 0.6 / hw; break;
          case "crystal": hw *= crystal[Math.min(11, Math.floor(s * 12))]; break;
          case "great": hw *= 1.05 - 0.15 * s; break;
          case "fang": c = S.curve * 0.5 * s * s; hw *= 1.2 - 0.6 * s; a = 1.3; break;
        }
        const tipLen = S.prof === "cleaver" ? 0.06 : S.prof === "needle" ? 0.3 : S.tip;
        if (s > 1 - tipLen) hw *= Math.max(0, (1 - s) / tipLen);
        const ha = hw * a, hb = hw * b, v = u - c;
        if (hw > 0.15 && v <= ha && v >= -hb) {
          const q = (v + hb) / (ha + hb);
          // lit edge shines, shadow edge darkens, the middle carries the metal
          col = ha - v < 0.9 ? M[3] : v + hb < 0.9 ? mix(M[0], INK, 0.25) : q > 0.55 ? M[2] : q > 0.3 ? M[1] : M[0];
          if (S.fuller && Math.abs(v) < 0.5 && s > 0.06 && s < 0.72 && hw > 1.1) col = M[0];
          if (S.core && Math.abs(v - (ha - hb) / 2) < 0.55 && s > 0.04 && s < 0.85 && hw > 0.9) col = mix(E, [255, 255, 255], 0.25);
          if (S.prof === "crystal" && (Math.floor(t * 1.3) + Math.floor(v * 2)) % 5 === 0) col = M[3];
          // runes etched into rare-and-better blades
          if (S.rank >= 1 && S.fuller && !S.core && Math.abs(v) < 0.5 && s > 0.12 && s < 0.6 && Math.floor(t) % 3 === 0) col = mix(E, M[1], 0.35);
          // collar where the blade meets the guard
          if (s < 0.05 && S.guard !== "none") col = H[1];
        }
      }
      // guard
      if (!col && S.guard !== "none") {
        const gt = S.gt, gw = S.gw; let inG = false;
        switch (S.guard) {
          case "bar": inG = t >= tg && t <= tg + gt && Math.abs(u) <= gw; break;
          case "curve": { const tt = t - (u * u) / gw * 0.35 * Math.sign(S.curve); inG = tt >= tg && tt <= tg + gt && Math.abs(u) <= gw; break; }
          case "wing": inG = Math.abs(u) <= gw && t >= tg && t <= tg + gt + Math.abs(u) * 0.55 && t >= tg + Math.abs(u) * 0.25; break;
          case "disc": inG = Math.hypot(t - (tg + gt / 2), u) <= Math.max(S.w + 1.4, Math.min(gw * 0.55, 3.4)); break;
          case "spike": inG = (t >= tg && t <= tg + gt && Math.abs(u) <= gw) || (Math.abs(u) > gw - 1.1 && Math.abs(u) <= gw && t >= tg && t <= tg + gt + 2.2); break;
          case "ring": { const d = Math.hypot(t - (tg + gt / 2), u), R = S.w + 1.6; inG = (d <= R && d >= R - 1.2) || (t >= tg && t <= tg + gt && Math.abs(u) <= gw); break; }
          case "claw": inG = (t >= tg && t <= tg + gt && Math.abs(u) <= gw) || (Math.abs(u) > gw - 1.3 && Math.abs(u) <= gw + 0.3 && t >= tg - 2 && t <= tg); break;
        }
        if (inG) {
          col = u > 0.8 ? H[2] : u < -0.8 ? H[0] : H[1];
          if (Math.abs(u) < 0.7 && Math.abs(t - (tg + gt / 2)) < 0.8) col = S.gem ? E : H[3];
        }
      }
      // grip and pommel
      if (!col && t >= pr * 1.6 && t < tg && Math.abs(u) <= 1.25) col = S.wrap && Math.floor(t) % 2 ? GR[0] : u > 0.2 ? GR[2] : GR[1];
      if (!col && Math.hypot(t - pr, u) <= pr) col = S.pgem && Math.hypot(t - pr, u) < pr * 0.55 ? E : u > 0.3 ? H[2] : H[1];
      px[y * N + x] = col;
    }
    // outline: every empty pixel touching the blade gets the dark ink
    const out = px.slice();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x; if (px[i]) continue;
      if ((x > 0 && px[i - 1]) || (x < N - 1 && px[i + 1]) || (y > 0 && px[i - N]) || (y < N - 1 && px[i + N])) out[i] = INK;
    }
    // element sparks around the blade
    const free = (x, y) => x >= 0 && y >= 0 && x < N && y < N && !out[y * N + x];
    const put = (x, y, c) => { if (free(x, y)) out[y * N + x] = c; };
    const Eh = mix(E, [255, 255, 255], 0.55);
    for (let k = 0; k < S.sparks; k++) {
      const s = 0.25 + r() * 0.7, t = tb + s * (L - tb), off = (r() < 0.5 ? -1 : 1) * (S.w + 2 + r() * 2.5);
      const cx = Math.floor(OX + (off - t) * D), cy = Math.floor(OY - (t + off) * D);
      switch (S.el) {
        case "fire": put(cx, cy, E); put(cx, cy - 1, Eh); if (r() < 0.5) put(cx + 1, cy + 1, mix(E, INK, 0.3)); break;
        case "ice": put(cx, cy, Eh); put(cx - 1, cy, E); put(cx + 1, cy, E); put(cx, cy - 1, E); put(cx, cy + 1, E); break;
        case "lightning": put(cx, cy, Eh); put(cx + 1, cy + 1, E); put(cx, cy + 2, E); put(cx + 1, cy + 3, Eh); break;
        case "holy": put(cx, cy, [255, 255, 255]); put(cx - 1, cy, E); put(cx + 1, cy, E); put(cx, cy - 1, E); put(cx, cy + 1, E); break;
        case "void": put(cx, cy, E); put(cx + 1, cy, mix(E, INK, 0.5)); put(cx, cy - 1, Eh); break;
        case "poison": put(cx, cy, E); put(cx + 1, cy, E); put(cx, cy + 1, mix(E, INK, 0.4)); put(cx + 1, cy - 1, Eh); break;
        default: put(cx, cy, Eh); if (r() < 0.5) put(cx + 1, cy - 1, E);
      }
    }
    return out;
  };
  G.bladeRGBA = function (S) {
    const p = G.bladePixels(S), d = new Uint8ClampedArray(N * N * 4);
    p.forEach((c, i) => { if (c) { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; } });
    return d;
  };

  // ---------- atlas for the game (browser only) ----------
  // All generated blades go on one canvas: the arena draws from it and menus use it as a CSS image.
  G.ART = { cols: 32, canvas: null, url: "", slot: {} };
  G.buildBladeAtlas = function () {
    if (typeof document === "undefined") return;
    const list = (G.SW || window.SWORDS_DATA || []).filter((w) => w.gen != null && w.cell == null), cols = G.ART.cols, rows = Math.max(1, Math.ceil(list.length / cols));
    const cv = document.createElement("canvas"); cv.width = cols * N; cv.height = rows * N;
    const c = cv.getContext("2d"), img = c.createImageData(N, N);
    list.forEach((w, k) => {
      if (!w.art) w.art = G.bladeSpec(w.gen, { rarity: w.rarity, realm: w.realm, element: w.element, metal: w.metal, profile: w.profile });
      img.data.set(G.bladeRGBA(w.art)); c.putImageData(img, (k % cols) * N, Math.floor(k / cols) * N); G.ART.slot[w.index] = k;
    });
    G.ART.canvas = cv; G.ART.rows = rows;
    try { G.ART.url = cv.toDataURL("image/png"); document.documentElement.style.setProperty("--blades", `url(${G.ART.url})`); } catch (e) { /* ignore */ }
  };
  // Where a catalog blade's picture lives: { img, x, y } on the generated atlas or the hand-drawn sheet.
  // The AI-drawn sheet (assets/blades.png), loaded once.
  let drawn = null;
  if (typeof Image !== "undefined" && window.BLADE_ART) { drawn = new Image(); drawn.onload = () => G.ui && G.ui.dirty("all"); drawn.src = "assets/blades.png"; }
  G.swCell = function (i, sheet) {
    const w = (G.SW || [])[i] || {}, k = G.ART.slot[i], BA = window.BLADE_ART;
    if (w.cell != null && drawn && drawn.complete && drawn.naturalWidth) return { img: drawn, x: (w.cell % BA.cols) * N, y: Math.floor(w.cell / BA.cols) * N, gen: true };
    if (k != null && G.ART.canvas) return { img: G.ART.canvas, x: (k % G.ART.cols) * N, y: Math.floor(k / G.ART.cols) * N, gen: true };
    const sp = w.spr != null ? w.spr : i; return { img: sheet, x: (sp % 6) * N, y: Math.floor(sp / 6) * N, gen: false };
  };
  if (typeof document !== "undefined") G.buildBladeAtlas();
})();
