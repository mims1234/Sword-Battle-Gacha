// ===================== FX (anime.js) =====================
(function () {
  const G = Game;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reduced = () => prefersReduced;

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  G.fx = {
    reduced() { return reduced(); },

    // ---------- toast ----------
    toast(message, color) {
      const t = document.createElement("div");
      t.className = "toast";
      t.innerHTML = message;
      if (color) t.style.borderLeftColor = color;
      G.els.toastLayer.appendChild(t);
      if (reduced()) {
        setTimeout(() => t.remove(), 2500);
        return t;
      }
      anime({
        targets: t,
        translateY: [-24, 0],
        opacity: [0, 1],
        duration: 350,
        easing: "easeOutCubic",
      });
      setTimeout(() => {
        anime({
          targets: t,
          translateY: [-16, 0],
          opacity: 0,
          duration: 300,
          easing: "easeInCubic",
          complete: () => t.remove(),
        });
      }, 2300);
      return t;
    },

    // ---------- banner ----------
    banner(icon, title, sub, color) {
      const b = document.createElement("div");
      b.className = "banner";
      b.innerHTML = `
        <div class="banner-ico">${icon}</div>
        <div class="banner-title" style="${color ? `color:${color};` : ""}">${title}</div>
        ${sub ? `<div class="banner-sub">${sub}</div>` : ""}`;
      G.els.bannerLayer.appendChild(b);
      const scale = [0.6, 1.06, 1];
      if (reduced()) {
        setTimeout(() => b.remove(), 1600);
        return b;
      }
      anime({
        targets: b,
        scale,
        opacity: [0, 1, 1, 0],
        duration: 1600,
        easing: "easeOutCubic",
        complete: () => b.remove(),
      });
      return b;
    },

    // ---------- burst particles ----------
    burst(targetEl, color, count, spread) {
      const layer = G.els.burstLayer;
      const c = centerOf(targetEl);
      count = count || 14;
      spread = spread || 120;
      const parts = [];
      for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = "burst-particle";
        const s = G.rand(4, 10);
        p.style.width = s + "px";
        p.style.height = s + "px";
        p.style.left = c.x + "px";
        p.style.top = c.y + "px";
        p.style.background = color || G.pick(["#ffb347", "#ff7a1a", "#ffd76a"]);
        p.style.boxShadow = `0 0 8px ${color || "#ffb347"}`;
        layer.appendChild(p);
        parts.push(p);
      }
      if (reduced()) {
        parts.forEach((p, i) => setTimeout(() => p.remove(), 60));
        return;
      }
      const angle = -Math.PI / 2;
      anime({
        targets: parts,
        translateX: () => Math.cos(angle + G.rand(-Math.PI, Math.PI)) * G.rand(40, spread),
        translateY: () => Math.sin(angle + G.rand(-Math.PI, Math.PI)) * G.rand(40, spread),
        scale: [1, 0],
        opacity: [1, 0],
        duration: G.rand(500, 900),
        easing: "easeOutCubic",
        delay: anime.stagger(12),
        complete: () => parts.forEach((p) => p.remove()),
      });
    },

    // ---------- floating text over an element ----------
    floatText(targetEl, text, color) {
      const c = centerOf(targetEl);
      const s = document.createElement("div");
      s.className = "sparkle";
      s.textContent = text;
      s.style.left = c.x + "px";
      s.style.top = c.y + "px";
      s.style.color = color || "#fff";
      s.style.fontWeight = "700";
      s.style.fontSize = "18px";
      s.style.transform = "translate(-50%, -50%)";
      document.body.appendChild(s);
      if (reduced()) { setTimeout(() => s.remove(), 700); return; }
      anime({
        targets: s,
        translateY: { value: -46, delay: 0 },
        opacity: [1, 0],
        scale: [0.8, 1.15],
        duration: 900,
        easing: "easeOutCubic",
        complete: () => s.remove(),
      });
    },

    // ---------- big floating damage number ----------
    floatDmg(dmg, isCrit, x, y) {
      const s = document.createElement("div");
      s.className = "float-dmg " + (isCrit ? "crit" : "normal");
      s.textContent = (isCrit ? "⚡" : "-") + (dmg < 1000 ? dmg.toFixed(0) : G.formatNum(dmg));
      s.style.left = (x || window.innerWidth / 2) + "px";
      s.style.top = (y || window.innerHeight / 2.4) + "px";
      s.style.transform = "translate(-50%, -50%)";
      document.body.appendChild(s);
      if (reduced()) { setTimeout(() => s.remove(), 800); return; }
      anime({
        targets: s,
        translateY: { value: -70, delay: 0 },
        opacity: [1, 0],
        scale: isCrit ? [0.4, 1.2, 1] : [0.6, 1.05],
        rotate: isCrit ? G.rand(-8, 8) : 0,
        duration: isCrit ? 1100 : 800,
        easing: "easeOutCubic",
        complete: () => s.remove(),
      });
    },

    // ---------- quick pop ----------
    pop(el, scale) {
      if (reduced()) return;
      anime.remove(el);
      anime({
        targets: el,
        scale: [scale || 1.15, 1],
        duration: 300,
        easing: "easeOutBack",
      });
    },

    // ---------- screen shake ----------
    shake(strength) {
      const layer = G.els.shakeLayer;
      if (reduced()) return;
      anime.remove(layer);
      layer.style.opacity = "1";
      anime({
        targets: layer,
        opacity: [0.9, 0],
        duration: 450,
        easing: "easeOutQuad",
      });
      const shifts = [];
      for (let i = 0; i < 6; i++) {
        shifts.push({ x: G.rand(-strength, strength), y: G.rand(-strength, strength) });
      }
      shifts.push({ x: 0, y: 0 });
      anime({
        targets: G.els.app,
        translateX: shifts.map((s) => s.x),
        translateY: shifts.map((s) => s.y),
        duration: 420,
        easing: "easeOutCubic",
      });
    },

    // ---------- count up a number ----------
    countUp(el, to, format) {
      const obj = { v: 0 };
      const fn = format || G.formatNum;
      anime({
        targets: obj,
        v: to,
        duration: 900,
        easing: "easeOutCubic",
        update: () => { if (el) el.textContent = fn(obj.v); },
      });
    },

    // ---------- generic reveal ----------
    reveal(el, delay) {
      if (reduced()) { el.style.opacity = "1"; return; }
      anime({
        targets: el,
        opacity: [0, 1],
        translateY: [24, 0],
        scale: [0.92, 1],
        duration: 420,
        delay: delay || 0,
        easing: "easeOutCubic",
      });
    },

    // ---------- stagger children in ----------
    staggerIn(container, selector) {
      if (reduced()) return;
      const items = container.querySelectorAll(selector);
      anime({
        targets: items,
        opacity: [0, 1],
        translateY: [14, 0],
        scale: [0.9, 1],
        duration: 380,
        delay: anime.stagger(18),
        easing: "easeOutCubic",
      });
    },

    // ---------- foe hit / attack swing ----------
    swingFoe(el) {
      if (reduced()) return;
      anime.remove(el);
      anime({
        targets: el,
        translateX: [0, 18, -10, 0],
        duration: 320,
        easing: "easeOutCubic",
      });
    },

    defeatFoe(el) {
      if (reduced()) return;
      anime.remove(el);
      anime({
        targets: el,
        translateY: [0, 40],
        rotate: G.rand(-12, 12),
        opacity: [1, 0],
        scale: [1, 0.6],
        duration: 520,
        easing: "easeInCubic",
      });
    },

    // ---------- hp bar tween ----------
    hpTween(fillEl, toPct, duration) {
      if (reduced()) { fillEl.style.width = toPct + "%"; return; }
      const obj = { v: parseFloat(fillEl.style.width || "100") };
      anime({
        targets: obj,
        v: toPct,
        duration: duration || 400,
        easing: "easeOutQuad",
        update: () => { fillEl.style.width = obj.v + "%"; },
      });
    },

    // ---------- rarity rays behind an element ----------
    rays(el) {
      if (reduced()) return;
      const rays = document.createElement("div");
      rays.className = "rarity-rays";
      el.style.position = "relative";
      el.style.overflow = "visible";
      el.appendChild(rays);
      setTimeout(() => rays.remove(), 2600);
    },

    // ---------- pull reveal card ----------
    cardIn(el) {
      if (reduced()) { el.style.opacity = "1"; return; }
      anime.remove(el);
      anime({
        targets: el,
        scale: [0.5, 1.08, 1],
        opacity: [0, 1],
        rotateY: [60, 0],
        duration: 600,
        easing: "easeOutBack",
      });
    },

    // ---------- ember field ----------
    spawnEmbers(count) {
      const field = G.els.emberField;
      if (!field) return;
      if (window.innerWidth < 480) return;
      if (reduced()) return;
      for (let i = 0; i < count; i++) {
        const e = document.createElement("div");
        e.className = "ember-particle";
        const size = G.rand(2, 5);
        e.style.width = size + "px";
        e.style.height = size + "px";
        e.style.left = G.rand(0, 100) + "%";
        e.style.setProperty("--drift", G.rand(-60, 60) + "px");
        e.style.animationDuration = G.rand(6, 14) + "s";
        e.style.animationDelay = G.rand(0, 12) + "s";
        field.appendChild(e);
      }
    },
  };
})();
