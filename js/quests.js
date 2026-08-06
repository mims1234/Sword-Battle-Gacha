// ===================== QUESTS + OFFLINE EARNINGS =====================
(function () {
  const G = Game;

  const POOL = [
    { type: "kills", target: 20, ico: "⚔" },
    { type: "kills", target: 50, ico: "⚔" },
    { type: "kills", target: 100, ico: "⚔" },
    { type: "pulls", target: 5, ico: "◆" },
    { type: "pulls", target: 10, ico: "◆" },
    { type: "pulls", target: 20, ico: "◆" },
    { type: "forge", target: 1, ico: "🔨" },
    { type: "forge", target: 3, ico: "🔨" },
    { type: "forge", target: 5, ico: "🔨" },
    { type: "levelUp", target: 2, ico: "⛨" },
    { type: "prestige", target: 1, ico: "♜" },
  ];

  function today() {
    return new Date().toLocaleDateString("en-CA");
  }

  function titleFor(q) {
    switch (q.type) {
      case "kills": return `${q.ico} Defeat ${q.target} monsters`;
      case "pulls": return `${q.ico} Open ${q.target} chests`;
      case "forge": return `${q.ico} Forge ${q.target} blade${q.target > 1 ? "s" : ""}`;
      case "levelUp": return `${q.ico} Reach level ${G.gameState.level + q.target}`;
      case "prestige": return `${q.ico} Prestige once`;
      default: return `${q.ico} Quest`;
    }
  }

  function rewardsFor() {
    const scale = 1 + Math.floor(G.gameState.level / 10) + G.gameState.prestige.count * 2;
    const chests = 2 + Math.floor(Math.random() * 3) + Math.floor(scale / 2);
    const souls = 15 + Math.floor(Math.random() * 20) + scale * 4;
    return { chests, souls };
  }

  function seedFor(date) {
    let h = 0;
    for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  G.quests = {
    init() {
      if (
        !G.gameState.quests ||
        G.gameState.quests.date !== today()
      ) {
        this.refresh();
      }
      this.render();
      this.updateBadge();
    },

    refresh() {
      const seed = seedFor(today());
      const picked = [];
      const used = new Set();
      while (picked.length < 3 && picked.length < POOL.length) {
        const i = seed % POOL.length;
        let n = 0;
        let idx = i;
        while (used.has(idx) && n < POOL.length) {
          idx = (idx + 1) % POOL.length;
          n++;
        }
        if (used.has(idx)) break;
        used.add(idx);
        const base = POOL[idx];
        const r = rewardsFor();
        picked.push({
          id: `${dateId()}${idx}`,
          type: base.type,
          target: base.target,
          ico: base.ico,
          chests: r.chests,
          souls: r.souls,
          progress: 0,
          claimed: false,
        });
      }
      G.gameState.quests = { date: today(), list: picked };
      G.toast("📜 New quests available!", "#ffb347");
    },

    progress(key, amount, monster) {
      if (!G.gameState.quests || G.gameState.quests.date !== today()) return;
      let anyDone = false;
      G.gameState.quests.list.forEach((q) => {
        if (q.claimed || q.type !== key) return;
        if (q.type === "kills" && monster) {
          // kills of specific type progress only "kills" quests
        }
        const before = q.progress;
        q.progress = Math.min(q.target, q.progress + amount);
        if (q.progress >= q.target && before < q.target) {
          anyDone = true;
          G.fx.toast(`✅ Quest complete: ${titleFor(q)}`, "#6bff8a");
          G.fx.burst(G.els.questBadge, "#ffb347", 10, 60);
        }
      });
      if (anyDone) {
        this.render();
        this.updateBadge();
        G.saveGame();
      }
    },

    claim(id) {
      const q = G.gameState.quests.list.find((x) => x.id === id);
      if (!q || q.claimed || q.progress < q.target) return;
      q.claimed = true;
      G.addChests(q.chests, true);
      G.addSouls(q.souls);
      G.fx.floatText(G.els.questBadge, `+${q.souls} ✦`, "#b98aff");
      G.toast(`📜 Reward claimed: +${q.chests} ◆ +${q.souls} ✦`, "#ffb347");
      this.render();
      this.updateBadge();
      G.saveGame();
    },

    updateBadge() {
      const count = this.pendingCount();
      const b = G.els.questBadge;
      b.style.display = count > 0 ? "grid" : "none";
      b.textContent = count;
    },

    pendingCount() {
      if (!G.gameState.quests) return 0;
      return G.gameState.quests.list.filter(
        (q) => !q.claimed && q.progress >= q.target,
      ).length;
    },

    render() {
      const box = G.els.questList;
      if (!box) return;
      box.innerHTML = "";
      const qs = (G.gameState.quests && G.gameState.quests.list) || [];
      if (!qs.length) {
        box.innerHTML = '<div style="color:#8a90a0;text-align:center;padding:20px">No quests today.</div>';
        return;
      }
      qs.forEach((q) => {
        const done = q.progress >= q.target;
        const card = document.createElement("div");
        card.className = `quest-card${done ? " done" : ""}${q.claimed ? " claimed" : ""}`;
        card.innerHTML = `
          <div class="quest-title">${titleFor(q)}</div>
          <div class="quest-reward">+${q.chests} ◆ &nbsp;+${q.souls} ✦</div>
          <div class="quest-progress-track"><div class="quest-progress-fill" style="width:${Math.min(100, (q.progress / q.target) * 100)}%"></div></div>
          <div style="font-size:12px;color:#8a90a0">${q.progress} / ${q.target}</div>`;
        if (done && !q.claimed) {
          const btn = document.createElement("button");
          btn.className = "quest-claim-btn quest-claim";
          btn.textContent = "Claim";
          btn.onclick = () => this.claim(q.id);
          card.appendChild(btn);
        }
        box.appendChild(card);
      });
    },
  };

  function dateId() {
    return today().replace(/-/g, "");
  }

  // ===================== OFFLINE EARNINGS =====================
  function getKillRate() {
    const sw = G.swordData.find((s) => s.index === G.currentSwordIndex);
    if (!sw || !G.gameState.activeSwords[sw.index]) return 0.2;
    const dmg = sw.attack * (1 + (G.gameState.level - 1) * 0.1) * G.getTotalDamageMult();
    const avgHp = 120;
    const turns = Math.max(1, Math.ceil(avgHp / dmg));
    const secPerKill = turns * 0.42 + (DELAY_SEC[sw.rarity] || 1.8);
    return 1 / secPerKill;
  }
  const DELAY_SEC = { legendary: 0.9, epic: 1.4, rare: 1.8, common: 2.2 };

  G.computeOffline = function () {
    const now = Date.now();
    const lastSeen = G.gameState.lastSeen || now;
    let seconds = (now - lastSeen) / 1000;
    if (seconds < 300) return null;
    seconds = Math.min(seconds, 8 * 3600);
    const rate = getKillRate();
    const kills = Math.floor(rate * seconds);
    const chests = Math.floor(kills * 0.05);
    const souls = Math.floor(kills * 0.4);
    return { seconds, kills, chests, souls };
  };

  G.showOfflineModal = function () {
    const off = G.computeOffline();
    if (!off) return;
    G.gameState.lastSeen = Date.now();
    G.els.offlineTime.textContent = `While you were away (${formatTime(off.seconds)}):`;
    G.els.offlineRewards.innerHTML = `
      <div class="offline-reward"><span class="or-ico">💀</span><span class="or-val" id="offKills">0</span><span class="or-label">Kills</span></div>
      <div class="offline-reward"><span class="or-ico">◆</span><span class="or-val" id="offChests">0</span><span class="or-label">Chests</span></div>
      <div class="offline-reward"><span class="or-ico">✦</span><span class="or-val" id="offSouls">0</span><span class="or-label">Souls</span></div>`;
    const m = G.els.offlineModal;
    m.classList.add("show");
    G.fx.reveal(m.querySelector(".modal-card"));
    const claim = () => {
      G.addKills(off.kills, null);
      G.addChests(off.chests, true);
      G.addSouls(off.souls);
      G.ui.updateAll();
      G.saveGame();
      m.classList.remove("show");
      G.toast(`⚔ Offline rewards claimed!`, "#ffb347");
    };
    G.els.offlineClaim.onclick = claim;
    G.els.offlineClose.onclick = claim;
    G.fx.countUp(G.els.offlineRewards.querySelector("#offKills"), off.kills);
    G.fx.countUp(G.els.offlineRewards.querySelector("#offChests"), off.chests);
    G.fx.countUp(G.els.offlineRewards.querySelector("#offSouls"), off.souls);
  };

  function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }
})();
