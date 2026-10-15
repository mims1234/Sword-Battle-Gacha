// ===================== SYNTHESIZED AUDIO (no files) =====================
(function () {
  const G = window.G, A = (G.audio = {});
  let ctx = null, master = null, lastHit = 0;

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.22; master.connect(ctx.destination); } catch (e) { ctx = null; }
    return !!ctx;
  }
  A.unlock = function () { if (ensure() && ctx.state === "suspended") ctx.resume().then(() => A.music()); else A.music(); };

  function tone(freq, dur, type, vol, slide, delay) {
    const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq, delay) {
    const t = ctx.currentTime + (delay || 0), n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = freq || 1800; g.gain.value = vol || 0.2;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }

  const S = {
    hit() { noise(0.05, 0.12, 2400); },
    crit() { noise(0.08, 0.25, 3200); tone(880, 0.09, "square", 0.08, 440); },
    kill() { tone(160, 0.14, "triangle", 0.2, 60); },
    boss() { tone(110, 0.9, "sawtooth", 0.16, 82); tone(165, 0.9, "sawtooth", 0.1, 123, 0.05); },
    bossDown() { tone(220, 0.5, "triangle", 0.3, 55); noise(0.4, 0.3, 500); [440, 554, 659, 880].forEach((f, i) => tone(f, 0.3, "triangle", 0.16, 0, 0.25 + i * 0.09)); },
    ult() { tone(200, 0.5, "sawtooth", 0.13, 900); noise(0.3, 0.2, 900, 0.45); },
    drop() { tone(1320, 0.18, "sine", 0.18); tone(1760, 0.25, "sine", 0.14, 0, 0.08); },
    level() { tone(520, 0.07, "square", 0.07, 780); },
    click() { tone(700, 0.03, "square", 0.04); },
    wipe() { tone(180, 0.7, "sawtooth", 0.2, 50); },
    omen() { tone(330, 0.6, "sine", 0.15, 311); tone(466, 0.6, "sine", 0.1, 440, 0.1); },
    secret() { [660, 990, 1320].forEach((f, i) => tone(f, 0.3, "sine", 0.12, 0, i * 0.07)); },
    charge() { tone(120, 0.9, "sawtooth", 0.1, 520); },
    rebirth() { noise(0.9, 0.3, 400); [220, 277, 330, 440, 554].forEach((f, i) => tone(f, 0.6, "triangle", 0.14, 0, i * 0.11)); },
    reveal(rank) { const base = [392, 440, 523, 659, 784][rank] || 392; for (let i = 0; i <= rank; i++) tone(base * Math.pow(1.26, i), 0.35, "triangle", 0.16, 0, i * 0.08); if (rank >= 3) noise(0.5, 0.2, 5000); },
  };

  A.play = function (name, arg) {
    if (!G.s.set.sound || !ensure() || ctx.state !== "running") return;
    if (name === "hit" || name === "crit") { const n = performance.now(); if (n - lastHit < 70) return; lastHit = n; }
    try { S[name] && S[name](arg); } catch (e) { /* ignore audio errors */ }
  };

  A.on = function (e) {
    switch (e.t) {
      case "hit": if (!e.sub) A.play(e.crit ? "crit" : "hit"); break;
      case "kill": A.play(e.kind === "boss" || e.kind === "hollow" ? "bossDown" : "kill"); break;
      case "wave": if (e.boss) A.play("boss"); break;
      case "ult": A.play("ult"); break;
      case "drop": A.play("drop"); break;
      case "wipe": A.play("wipe"); break;
      case "omen": case "champion": A.play("omen"); break;
      case "rebirth": A.play("rebirth"); break;
    }
  };
  // ---------- area music: slow, calm, a little tense ----------
  // Each area gets its own key, scale, tempo and instrument; boss floors and blood moons add a heartbeat.
  const THEMES = {
    brute: { root: 50, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 72, pad: "triangle", cut: 900, lead: "pluck", density: 0.42 },
    undead: { root: 49, scale: [0, 1, 3, 5, 7, 8, 10], bpm: 56, pad: "sawtooth", cut: 520, lead: "bell", density: 0.22 },
    beast: { root: 52, scale: [0, 3, 5, 7, 10], bpm: 76, pad: "sine", cut: 1400, lead: "flute", density: 0.36 },
    nature: { root: 53, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 64, pad: "sine", cut: 1100, lead: "drop", density: 0.3 },
    demon: { root: 47, scale: [0, 1, 3, 5, 6, 8, 10], bpm: 60, pad: "sawtooth", cut: 420, lead: "pluck", density: 0.2, pulse: true },
    dragon: { root: 57, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 58, pad: "triangle", cut: 1800, lead: "bell", density: 0.26 },
    holy: { root: 55, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 54, pad: "square", cut: 700, lead: "bell", density: 0.24 },
  };
  const PROG = [0, 5, 3, 4]; // i, VI, iv, v in scale steps
  let mus = null, musT = null;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const deg = (th, d) => { const n = th.scale.length; return th.root + th.scale[((d % n) + n) % n] + 12 * Math.floor(d / n); };

  function voice(th, midi, t, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(); let o2 = null;
    const kind = th.lead;
    o.type = kind === "flute" ? "sine" : kind === "bell" ? "sine" : "triangle";
    o.frequency.setValueAtTime(hz(midi), t);
    if (kind === "flute") { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5; lg.gain.value = 4; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.1); }
    if (kind === "bell") { o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.setValueAtTime(hz(midi) * 2.76, t); const g2 = ctx.createGain(); g2.gain.setValueAtTime(vol * 0.25, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.5); o2.connect(g2); g2.connect(mus.bus); o2.start(t); o2.stop(t + dur); }
    if (kind === "drop") o.frequency.exponentialRampToValueAtTime(hz(midi) * 0.98, t + dur);
    const atk = kind === "flute" ? 0.12 : 0.005;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(mus.bus); o.start(t); o.stop(t + dur + 0.05);
  }
  function thump(t, vol) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(mus.bus); o.start(t); o.stop(t + 0.35); }

  function makePad(th) {
    const out = ctx.createGain(), f = ctx.createBiquadFilter(), oscs = [];
    f.type = "lowpass"; f.frequency.value = th.cut; f.Q.value = 2;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = th.cut * 0.35; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    [0, 7, 12].forEach((iv, i) => { for (const det of [-6, 6]) { const o = ctx.createOscillator(); o.type = th.pad; o.detune.value = det; o.frequency.value = hz(th.root - 12 + iv); o.connect(f); o.start(); oscs.push({ o, iv }); } });
    out.gain.value = 0.0001; f.connect(out); out.connect(mus.bus);
    out.gain.setTargetAtTime(th.pad === "sawtooth" || th.pad === "square" ? 0.05 : 0.09, ctx.currentTime, 1.5);
    return { out, oscs, lfo, f };
  }
  function killPad(p) { if (!p) return; const t = ctx.currentTime; p.out.gain.setTargetAtTime(0.0001, t, 0.8); setTimeout(() => { p.oscs.forEach((x) => { try { x.o.stop(); } catch (e) { /* stopped */ } }); try { p.lfo.stop(); } catch (e) { /* stopped */ } p.out.disconnect(); }, 4000); }

  function schedule() {
    if (!mus || !mus.th) return;
    const th = mus.th, spb = 60 / th.bpm, now = ctx.currentTime;
    while (mus.next < now + 0.4) {
      const t = mus.next, beat = mus.beat;
      if (beat % 8 === 0) { const step = PROG[(beat / 8) % PROG.length]; mus.chord = step; mus.pad.oscs.forEach((x) => x.o.frequency.setTargetAtTime(hz(deg(th, step) - 12 + x.iv), t, 0.6)); }
      if (Math.random() < th.density) { mus.walk = G.clamp(mus.walk + G.pick([-2, -1, 1, 1, 2, 3, -3]), 4, 13); voice(th, deg(th, mus.walk + mus.chord) , t, th.lead === "bell" ? 2.4 : th.lead === "flute" ? spb * 1.6 : 0.9, th.lead === "bell" ? 0.05 : 0.07); }
      if (beat % 16 === 12 && Math.random() < 0.5) voice(th, deg(th, mus.chord) - 12, t, spb * 3, 0.05);
      if ((th.pulse || mus.tense) && beat % 2 === 0) thump(t, mus.tense ? 0.16 : 0.08);
      mus.next += spb; mus.beat++;
    }
  }
  // ---------- recorded music (assets/music, made by tools/make-music.mjs) ----------
  // Two <audio> players take turns: a few seconds before one ends, the other starts from the top
  // and they cross-fade, so the loop never clicks or gaps. Works from file:// too.
  const XF = 2.5, REC_VOL = 0.5;
  let rec = null, recT = null;
  function fade(el, to, secs) { el._f = { from: el.volume, to, t0: performance.now(), d: Math.max(1, secs * 1000) }; }
  function recTick() {
    const now = performance.now(), all = rec ? rec.els.concat(rec.old || []) : [];
    all.forEach((el) => { const f = el._f; if (!f) return; const k = Math.min(1, (now - f.t0) / f.d); el.volume = Math.max(0, Math.min(1, f.from + (f.to - f.from) * k)); if (k >= 1) { el._f = null; if (f.to === 0) el.pause(); } });
    if (rec && rec.old && rec.old.every((el) => el.paused)) rec.old = null;
    if (!rec) return;
    const a = rec.els[rec.i], b = rec.els[1 - rec.i];
    if (a.paused && !a._f && rec.on) a.play().catch(() => {});
    if (a.duration && a.currentTime > a.duration - XF && !b._f && b.paused) {
      b.currentTime = 0; b.volume = 0; b.play().catch(() => {}); fade(b, REC_VOL, XF); fade(a, 0, XF); rec.i = 1 - rec.i;
    }
  }
  function playRec(id, src) {
    if (rec && rec.id === id) { rec.on = true; return; }
    const old = rec ? rec.els : [];
    old.forEach((el) => fade(el, 0, 1.5));
    const mk = () => { const el = new Audio(src); el.preload = "auto"; el.volume = 0; return el; };
    rec = { id, els: [mk(), mk()], i: 0, on: true, old };
    rec.els[0].play().catch(() => {}); fade(rec.els[0], REC_VOL, 2.5);
    if (!recT) recT = setInterval(recTick, 80);
  }
  function stopRec() { if (!rec) return; rec.els.forEach((el) => fade(el, 0, 0.8)); rec.on = false; const r = rec; setTimeout(() => { if (rec === r && !r.on) { r.els.forEach((el) => el.pause()); rec = null; } }, 1200); }
  function stopSynth() { if (!mus) return; killPad(mus.pad); mus.bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4); const m = mus; setTimeout(() => m.bus.disconnect(), 2000); mus = null; clearInterval(musT); musT = null; }

  // Called about once a second: start, switch or stop the music to match the current area.
  A.music = function () {
    const want = G.s.set.sound && G.s.set.music !== false && ctx && ctx.state === "running";
    const tracks = window.MUSIC_TRACKS || {}, C0 = G.combat;
    const area = G.rift ? "demon" : G.biomeOf(G.curFloor()).id, tense0 = !!((C0 && C0.boss) || G.s.moon > 0 || (C0 && C0.hollow) || G.rift);
    const recId = tense0 && tracks.boss ? "boss" : tracks[area] ? area : null;
    if (want && recId) { stopSynth(); playRec(recId, tracks[recId]); return; }
    stopRec();
    if (!want) { if (mus) { killPad(mus.pad); mus.bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4); const m = mus; setTimeout(() => m.bus.disconnect(), 2000); mus = null; clearInterval(musT); musT = null; } return; }
    const f = G.curFloor(), id = G.rift ? "demon" : G.biomeOf(f).id, th = THEMES[id], C = G.combat;
    const tense = !!((C && C.boss) || G.s.moon > 0 || (C && C.hollow) || G.rift);
    if (!mus) {
      const bus = ctx.createGain(), dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
      dl.delayTime.value = 0.38; fb.gain.value = 0.35; wet.gain.value = 0.35;
      bus.connect(master); bus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(master);
      bus.gain.value = 0.55;
      mus = { bus, th: null, id: null, next: ctx.currentTime + 0.2, beat: 0, walk: 7, chord: 0, tense: false, pad: null };
      musT = setInterval(schedule, 120);
    }
    mus.tense = tense;
    if (mus.id !== id) { killPad(mus.pad); mus.id = id; mus.th = th; mus.pad = makePad(th); mus.beat = 0; mus.next = Math.max(mus.next, ctx.currentTime + 0.1); }
  };

  A.buzz = function (ms) { if (!G.s.set.calm && navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) { try { navigator.vibrate(ms); } catch (e) { /* unsupported */ } } };
})();
