// ===================== BOOT + MAIN LOOP =====================
(function () {
  const G = window.G;
  let last = 0, hiddenAt = 0, saveT = 0, secT = 0;

  function dispatch() {
    if (!G.ev.length) return;
    const evs = G.ev; G.ev = [];
    for (const e of evs) { G.render.on(e); G.ui.on(e); G.audio.on(e); }
  }

  function away(secs, quiet) {
    if (G.rift) { G.rift.t -= secs; return; } // the daily trial clock keeps running; no offline floors during it
    const r = G.offline(secs);
    G.recalc(); G.startFloor(); G.ui.dirty("all");
    if (!quiet || secs > 300) G.ui.offline(r);
  }

  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    G.frameEma = (G.frameEma || 16) * 0.97 + Math.min(100, dt * 1000) * 0.03; // smoothness check for the graphics suggestion
    if (G.render.stop > 0) G.render.stop -= dt;
    else { let t = dt * G.s.set.speed; while (t > 0) { const h = Math.min(0.05, t); G.step(h); t -= h; } }
    if (!G.paused) G.onlineTick(dt);
    dispatch();
    G.render.frame(dt); G.ui.frame(now);
    secT += dt; if (secT >= 1) { secT = 0; G.rollBounties(); G.ui.slowTick(); G.audio.music(); }
    saveT += dt; if (saveT >= 15) { saveT = 0; if (!G.noSave) G.save(); }
    requestAnimationFrame(loop);
  }

  function keys(e) {
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
    const A = G.ui.act, k = e.key.toLowerCase();
    if (k >= "1" && k <= "5") G.castUlt(+k - 1);
    else if (k === " ") { e.preventDefault(); A.pause(); }
    else if (k === "l") A.lvlAll();
    else if (k === "s" || k === "g") G.ui.open("forge");
    else if (k === "t" || k === "w") G.ui.open("warband");
    else if (k === "escape") { if (!document.getElementById("modal").hidden) { if (!G.paused || G.paused === "user") G.ui.closeModal(); } else { G.ui.closeSummon(); G.ui.close(); } }
  }

  function boot() {
    const had = G.load(), gone = (Date.now() - G.s.last) / 1000;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches && !had) G.s.set.calm = true;
    G.ui.init(); G.render.init(document.getElementById("stage"));
    if (had && gone > 60) away(gone, false); else G.startFloor();
    if (G.s.migrated) { delete G.s.migrated; G.ui.toast("Your old save was carried over. Every blade you owned is now yours to keep.", "#c9a24b"); }
    document.addEventListener("keydown", keys);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { hiddenAt = Date.now(); if (!G.noSave) G.save(); }
      else if (hiddenAt) { const s = (Date.now() - hiddenAt) / 1000; hiddenAt = 0; last = performance.now(); if (s > 20 && !G.paused) away(s, true); }
    });
    window.addEventListener("pagehide", () => { if (!G.noSave) G.save(); });
    // Browsers block sound until the player taps, clicks or presses a key, so the loading screen
    // waits for that first tap: it starts the music and effects at the same moment the game appears.
    const bootEl = document.getElementById("boot"), hint = document.getElementById("bootHint");
    const firstTrack = G.audio.preloadMusic();
    const q = G.s.set.gfx || "low", gfxNote = document.getElementById("bootGfx");
    if (gfxNote) gfxNote.textContent = q === "high" ? "Graphics: High. Lower it any time with the HI button in the arena." : "Graphics: " + (q === "low" ? "Low" : "Medium") + ". Try higher with the " + (q === "low" ? "LO" : "MED") + " button in the arena for richer visuals.";
    const ready = () => { if (bootEl.dataset.ready) return; bootEl.dataset.ready = 1; hint.textContent = "Tap anywhere to start"; bootEl.classList.add("ready"); };
    if (firstTrack) { firstTrack.addEventListener("canplaythrough", ready, { once: true }); setTimeout(ready, 2500); } else setTimeout(ready, 400);
    G.paused = "boot";
    const start = (e) => {
      if (e && e.type === "keydown" && (e.key === "Tab" || e.altKey || e.ctrlKey || e.metaKey)) return;
      ready(); if (e) { e.preventDefault(); e.stopPropagation(); } // the starting key should not also trigger a shortcut
      document.removeEventListener("keydown", start, true); bootEl.removeEventListener("pointerup", start);
      G.audio.unlock(); if (G.paused === "boot") G.paused = null; last = performance.now();
      bootEl.classList.add("out"); setTimeout(() => bootEl.remove(), 600);
    };
    bootEl.addEventListener("pointerup", start); document.addEventListener("keydown", start, true);
    // Safety net: any later tap or key anywhere also unlocks sound (for example after a refresh in the background).
    ["pointerdown", "keydown", "touchend"].forEach((t) => document.addEventListener(t, () => { if (!G.audio._unlocked) G.audio.unlock(); }, { capture: true, passive: true }));
    requestAnimationFrame((t) => { last = t; loop(t); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
