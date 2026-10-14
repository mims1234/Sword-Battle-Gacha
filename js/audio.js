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
  A.unlock = function () { if (ensure() && ctx.state === "suspended") ctx.resume(); };

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
  A.buzz = function (ms) { if (!G.s.set.calm && navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) { try { navigator.vibrate(ms); } catch (e) { /* unsupported */ } } };
})();
