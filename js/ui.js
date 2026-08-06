// ===================== UI RENDERING =====================
(function () {
  const G = Game;

  const CAT_LABEL = {
    undead: { label: "Undead", color: "#9ab886" },
    beast: { label: "Beast", color: "#ff8a5a" },
    dragon: { label: "Dragon", color: "#ff5a5a" },
    demon: { label: "Demon", color: "#ff6ab5" },
    holy: { label: "Holy", color: "#ffd76a" },
    brute: { label: "Brute", color: "#b88a5a" },
    nature: { label: "Nature", color: "#6bff8a" },
  };

  const ACH_TIERS = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

  G.ui = {
    currentFeatFilter: "all",
    currentFilter: "all",

    // ---------- HUD ----------
    updateHud() {
      if (G.els.chestCount) G.els.chestCount.textContent = G.formatNum(G.gameState.chests);
      if (G.els.soulCount) G.els.soulCount.textContent = G.formatNum(G.gameState.souls);
      if (G.els.pullButton) {
        G.els.pullButton.disabled = G.gameState.chests <= 0;
        G.els.pullButtonX3.disabled = G.gameState.chests < 3;
        G.els.pullCost.textContent = G.gameState.chests <= 0 ? "Empty" : "x1";
      }
    },

    updateLevel() {
      const lvl = G.gameState.level;
      const needed = G.getLevelKillsNeeded(lvl);
      const pct = G.clamp((G.gameState.levelProgress / needed) * 100, 0, 100);
      if (G.els.levelText) G.els.levelText.textContent = lvl;
      if (G.els.levelProgText) G.els.levelProgText.textContent = `${G.formatNum(G.gameState.levelProgress)} / ${G.formatNum(needed)}`;
      if (G.els.levelFill) G.els.levelFill.style.width = pct + "%";
    },

    updatePity() {
      const e = Math.min(G.gameState.pity.epic, G.PITY_EPIC_CAP);
      const pct = (e / G.PITY_EPIC_CAP) * 100;
      if (G.els.pityFill) G.els.pityFill.style.width = pct + "%";
      if (G.els.pityText) {
        const rem = G.PITY_EPIC_CAP - G.gameState.pity.epic;
        G.els.pityText.textContent = rem > 0 ? `Epic in ${rem}` : "Guaranteed Epic!";
      }
    },

    updateStats() {
      if (G.els.killsStat) G.els.killsStat.textContent = G.formatNum(G.gameState.kills);
      if (G.els.streakStat) G.els.streakStat.textContent = G.comboStreak;
      const dps = this.getDPS();
      if (G.els.dpsStat) G.els.dpsStat.textContent = G.formatNum(dps) + "/s";
      const pw = G.els.prestigeStatWrap;
      if (pw) pw.style.display = G.gameState.prestige.count > 0 ? "flex" : "none";
      if (G.els.prestigeStat) G.els.prestigeStat.textContent = G.gameState.prestige.count;
      if (G.els.menuPulls) G.els.menuPulls.textContent = G.formatNum(G.gameState.totalPulls);
      if (G.els.menuLegendary) G.els.menuLegendary.textContent = G.formatNum(G.gameState.totalLegendary);
      if (G.els.menuDamage) G.els.menuDamage.textContent = G.formatNum(G.gameState.totalDmg);
      if (G.els.menuStreak) G.els.menuStreak.textContent = G.formatNum(G.gameState.bestStreak);
      if (G.els.menuPrestige) G.els.menuPrestige.textContent = G.gameState.prestige.count;
      const canPre = G.canPrestige();
      if (G.els.prestigeButton) {
        G.els.prestigeButton.disabled = !canPre;
        G.els.prestigeButton.textContent = canPre
          ? `♜ Prestige (to ${G.gameState.prestige.count + 1})`
          : `♜ Prestige (Level ${G.gameState.level}/50)`;
      }
      if (G.els.enchantLevel) {
        G.els.enchantLevel.textContent = `Lv ${G.gameState.enchant}/${G.ENCHANT_MAX}`;
        G.els.enchantCost.textContent = `✦ ${G.formatNum(G.getEnchantCost())}`;
        G.els.enchantButton.disabled =
          G.gameState.enchant >= G.ENCHANT_MAX ||
          G.gameState.souls < G.getEnchantCost();
      }
    },

    getDPS() {
      const sw = G.swordData.find((s) => s.index === G.currentSwordIndex);
      if (!sw || !G.gameState.activeSwords[sw.index]) return 0;
      const dmg = sw.attack * (1 + (G.gameState.level - 1) * 0.1) * G.getTotalDamageMult();
      const avgHp = 120;
      const turns = Math.max(1, Math.ceil(avgHp / dmg));
      const sec = turns * 0.42 + (DELAYS[sw.rarity] || 1.8);
      return dmg / sec;
    },

    // ---------- BLADE ----------
    updateBlade() {
      const slot = G.els.bladeSlot;
      if (!slot) return;
      const sw = G.swordData.find((s) => s.index === G.currentSwordIndex);
      slot.innerHTML = "";
      slot.className = "arena-slot";
      if (sw && G.gameState.activeSwords[sw.index]) {
        const cv = document.createElement("canvas");
        slot.appendChild(cv);
        G.drawSword(cv, sw.index, 96);
        const e = G.ELEMENTS[sw.element || "steel"];
        const chip = document.createElement("div");
        chip.className = "el-chip el-" + (sw.element || "steel");
        chip.textContent = `${e.ico} ${e.label}`;
        slot.appendChild(chip);
        slot.classList.add("selected");
        if (G.els.bladeName) {
          G.els.bladeName.textContent = sw.name;
          G.els.bladeName.style.color = G.rarityColors[sw.rarity];
        }
        if (G.els.bladeUses)
          G.els.bladeUses.textContent = `${G.gameState.activeSwords[sw.index]} uses`;
      } else {
        slot.innerHTML = '<div class="slot-label">Blade</div>';
        if (G.els.bladeName) G.els.bladeName.textContent = "—";
        if (G.els.bladeUses) G.els.bladeUses.textContent = "—";
      }
    },

    // ---------- FOE ----------
    updateFoe(monster) {
      const slot = G.els.foeSlot;
      if (!slot) return;
      slot.innerHTML = "";
      const cv = document.createElement("canvas");
      slot.appendChild(cv);
      G.drawMonster(cv, monster.type, 96);
      const cat = G.getMonsterCategory(monster.type);
      const info = CAT_LABEL[cat] || { label: "Foe", color: "#888" };
      const chip = document.createElement("div");
      chip.className = "el-chip el-steel";
      chip.style.background = info.color;
      chip.textContent = info.label;
      slot.appendChild(chip);
    },

    showFoeHp(hp) {
      G.els.foeHpFill.style.width = "100%";
      G.els.foeHpText.textContent = `${hp} HP`;
    },

    // ---------- FEED ----------
    feed(msg) {
      if (G.els.feedLine) G.els.feedLine.innerHTML = msg;
    },

    // ---------- PLAY BUTTON ----------
    updatePlayButton() {
      const b = G.els.playPauseButton;
      if (!b) return;
      const can =
        G.currentSwordIndex !== null &&
        G.gameState.activeSwords[G.currentSwordIndex] > 0;
      b.disabled = !can;
      b.classList.toggle("active-battle", G.autoPlay);
      b.textContent = G.autoPlay ? "■ Stop" : "⚔ Battle";
    },

    // ---------- COLLECTION ----------
    renderCollection(filter) {
      const container = G.els.collection;
      if (!container) return;
      filter = filter || this.currentFilter || "all";
      this.currentFilter = filter;
      let swords = G.swordData;
      if (filter !== "all") swords = swords.filter((s) => s.rarity === filter);

      container.innerHTML = swords
        .map((sw) => {
          const has = G.gameState.activeSwords[sw.index] > 0;
          const selected = G.currentSwordIndex === sw.index;
          const e = G.ELEMENTS[sw.element || "steel"];
          return `<div class="sword-item ${sw.rarity} ${has ? "owned" : "locked"} ${selected ? "selected" : ""}" data-index="${sw.index}" data-name="${sw.name}">
            <canvas width="64" height="64"></canvas>
            <span class="el-dot el-${sw.element || "steel"}"></span>
            ${has ? `<div class="sword-uses-badge">${G.gameState.activeSwords[sw.index]}</div>` : ""}
          </div>`;
        })
        .join("");

      container.querySelectorAll(".sword-item").forEach((item) => {
        const sw = G.swordData.find((s) => s.index === parseInt(item.dataset.index));
        if (!sw) return;
        G.drawSword(item.querySelector("canvas"), sw.index, 64);
        item.addEventListener("click", () => G.showSwordPreview(sw));
      });

      const total = Object.keys(G.collection).reduce(
        (a, k) => a + Object.keys(G.collection[k] || {}).length, 0,
      );
      if (G.els.collectionCount)
        G.els.collectionCount.textContent = `${total}/${G.swordData.length}`;
    },

    // ---------- BESTIARY ----------
    updateBestiary() {
      const grid = G.els.bestiaryGrid;
      if (!grid) return;
      grid.innerHTML = "";
      let doneCount = 0;
      G.monsterTypes.forEach((mon) => {
        const kills = G.gameState.monsterKills[mon.type] || 0;
        const done = kills >= 50;
        if (done) doneCount++;
        const cat = G.getMonsterCategory(mon.type);
        const catLabel = CAT_LABEL[cat] ? CAT_LABEL[cat].label : "Foe";
        const catColor = CAT_LABEL[cat] ? CAT_LABEL[cat].color : "#888";
        const entry = document.createElement("div");
        entry.className = "bestiary-entry" + (done ? " done" : "");
        entry.innerHTML = `<canvas width="64" height="64"></canvas>`;
        const c = entry.querySelector("canvas");
        G.drawMonster(c, mon.type, 64);
        const name = document.createElement("div");
        name.className = "bestiary-name";
        name.textContent = mon.type;
        entry.appendChild(name);
        const meta = document.createElement("div");
        meta.className = "bestiary-meta";
        meta.innerHTML = `
          <span class="bestiary-tier" style="background:${catColor}22;color:${catColor}">${catLabel}</span>
          <span class="bestiary-kills">💀 ${kills}</span>`;
        entry.appendChild(meta);
        grid.appendChild(entry);
      });
      if (G.els.bestiaryCount)
        G.els.bestiaryCount.textContent = `${doneCount}/${G.monsterTypes.length} complete`;
      this.updateBestiaryBonusHint();
    },

    updateBestiaryBonusHint() {
      // show hint in bestiary drawer header
      const bonus = Math.round(G.getBestiaryBonus() * 100);
      if (G.els.bestiaryCount && bonus > 0)
        G.els.bestiaryCount.textContent += ` · +${bonus}% dmg`;
    },

    // ---------- FEATS ----------
    renderFeats() {
      const box = G.els.featsList;
      if (!box) return;
      box.innerHTML = "";

      const cards = [];

      // global feats
      const globalFeats = [
        { label: "Total Monsters Slain", tiers: [100, 1000, 10000, 100000], cur: G.gameState.kills },
        { label: "Chests Opened", tiers: [10, 100, 500, 2000], cur: G.gameState.totalPulls },
        { label: "Blades Collected", tiers: [10, 20, 30], cur: Object.keys(G.collection).reduce((a, k) => a + Object.keys(G.collection[k] || {}).length, 0) },
        { label: "Best Kill Streak", tiers: [10, 25, 50, 100], cur: G.gameState.bestStreak },
      ];
      globalFeats.forEach((f) => {
        f.tiers.forEach((tier) => {
          const complete = f.cur >= tier;
          if (this.currentFeatFilter === "completed" && !complete) return;
          if (!complete && f.cur <= 0) return;
          cards.push(this.featCard(`${f.label} (${tier})`, f.cur, tier, complete));
        });
      });

      // per-monster feats
      Object.entries(G.gameState.monsterKills).forEach(([type, kills]) => {
        ACH_TIERS.forEach((tier) => {
          const complete = kills >= tier;
          if (this.currentFeatFilter === "completed" && !complete) return;
          cards.push(this.featCard(`Slay ${tier} ${type}s`, kills, tier, complete));
        });
      });

      if (cards.length === 0) {
        box.innerHTML = '<div style="color:#8a90a0;text-align:center;padding:20px">Battle to unlock feats.</div>';
        return;
      }
      cards.forEach((c) => box.appendChild(c));
      G.fx.staggerIn(box, ".achievement-card");
    },

    featCard(name, cur, target, complete) {
      const card = document.createElement("div");
      card.className = "achievement-card" + (complete ? " complete" : "");
      const pct = Math.min(100, (cur / target) * 100);
      card.innerHTML = `
        <div class="ach-icon">${complete ? "🏆" : "🔒"}</div>
        <div class="ach-info">
          <div class="ach-name" style="color:${complete ? "#ffb020" : "#c4c8d4"}">${name}</div>
          <div class="ach-progress">${G.formatNum(cur)}/${G.formatNum(target)}</div>
        </div>
        <div class="ach-status ${complete ? "complete" : "pending"}">${complete ? "✓" : G.formatNum(target - cur)}</div>`;
      return card;
    },

    // ---------- FULL UPDATE ----------
    updateAll() {
      this.updateHud();
      this.updateLevel();
      this.updatePity();
      this.updateStats();
      this.updateBlade();
      this.renderCollection();
      this.updateBestiary();
      this.renderFeats();
      this.updatePlayButton();
      G.quests && G.quests.render();
      G.quests && G.quests.updateBadge();
    },

    // ---------- DRAWERS / SHEET ----------
    openDrawer(name) {
      const d = document.querySelector(`.drawer[data-drawer="${name}"]`);
      if (!d) return;
      if (name === "armory") this.renderCollection();
      if (name === "bestiary") this.updateBestiary();
      if (name === "quests") G.quests && G.quests.render();
      if (name === "feats") this.renderFeats();
      G.els.drawerScrim.classList.add("show");
      d.classList.add("open");
      G.fx.staggerIn(d, ".sword-item");
    },

    closeDrawers() {
      document.querySelectorAll(".drawer.open").forEach((d) => d.classList.remove("open"));
      G.els.drawerScrim.classList.remove("show");
    },

    toggleMenu(open) {
      const on = open !== undefined ? open : !G.els.menuSheet.classList.contains("open");
      G.els.sheetScrim.classList.toggle("show", on);
      G.els.menuSheet.classList.toggle("open", on);
      if (on) this.updateStats();
    },
  };

  const DELAYS = { legendary: 0.9, epic: 1.4, rare: 1.8, common: 2.2 };
})();
