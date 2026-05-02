// ===================== UI RENDERING =====================
(function () {
  const G = Game;

  // ---------- TOPBAR ----------
  G.updateTopBar = function () {
    document.querySelector(".monsters-killed").textContent = G.formatNum(
      G.gameState.monstersKilled,
    );
    document.querySelector(".chests").textContent = G.gameState.chests;
    document.querySelector(".level-text").textContent =
      `Level ${G.gameState.level}`;

    const fill = document.querySelector(".progress-fill");
    const nextKills = G.gameState.level * 10;
    const curKills = (G.gameState.level - 1) * 10;
    const progress =
      ((G.gameState.monstersKilled - curKills) / (nextKills - curKills)) * 100;
    fill.style.width = `${Math.min(progress, 100)}%`;

    G.updateCollectionCount();
  };

  G.updateCollectionCount = function () {
    if (!G.els.collectionCount) return;
    let total = 0;
    Object.values(G.collection).forEach((r) => {
      total += Object.keys(r).length;
    });
    G.els.collectionCount.textContent = `${total}/${G.swordData.length}`;
  };

  G.updateDPS = function () {
    if (!G.els.dpsDisplay) return;
    if (G.currentSwordIndex !== null) {
      const sw = G.swordData.find((s) => s.index === G.currentSwordIndex);
      if (sw && G.gameState.activeSwords[sw.index]) {
        const dmg = sw.attack * (1 + (G.gameState.level - 1) * 0.1);
        const delays = {
          legendary: 1400,
          epic: 2400,
          rare: 3400,
          common: 4400,
        };
        const delay = (delays[sw.rarity] || 3400) / 1000;
        G.els.dpsDisplay.textContent = `DPS: ${(dmg / delay).toFixed(1)}`;
        return;
      }
    }
    G.els.dpsDisplay.textContent = "DPS: 0";
  };

  G.updatePityUI = function () {
    const epicPity = Math.min(G.gameState.pullsSinceEpic, G.PITY_EPIC_CAP);
    const progress = (epicPity / G.PITY_EPIC_CAP) * 100;
    if (G.els.pityFill) G.els.pityFill.style.width = `${progress}%`;
    if (G.els.pityText) {
      const remaining = G.PITY_EPIC_CAP - G.gameState.pullsSinceEpic;
      G.els.pityText.textContent =
        remaining > 0 ? `Epic in ${remaining}` : "Guaranteed Epic!";
    }
    if (G.els.pullsDisplay)
      G.els.pullsDisplay.textContent = `Pulls: ${G.gameState.totalPulls}`;
  };

  G.updateComboUI = function () {
    if (!G.els.comboDisplay) return;
    if (G.comboStreak > 0) {
      G.els.comboDisplay.style.display = "flex";
      G.els.comboCount.textContent = G.comboStreak;
      G.els.comboBonus.textContent = `(+${Math.round(G.getComboBonus() * 100)}%)`;
    } else {
      G.els.comboDisplay.style.display = "none";
    }
  };

  G.updatePlayButtonState = function () {
    const canBattle =
      G.currentSwordIndex !== null &&
      G.gameState.activeSwords[G.currentSwordIndex] > 0;
    G.els.playPauseButton.disabled = !canBattle;
    if (!canBattle) {
      G.autoPlay = false;
      G.els.playPauseButton.textContent = "Battle";
    }
  };

  G.updateOpenChestButtonState = function () {
    if (G.els.pullButton) G.els.pullButton.disabled = G.gameState.chests <= 0;
    if (G.els.forgeButton)
      G.els.forgeButton.disabled = G.getForgeableSwords().length === 0;
  };

  G.updatePrestigeUI = function () {
    if (G.els.prestigeBlock)
      G.els.prestigeBlock.style.display =
        G.gameState.prestigeCount > 0 ? "flex" : "none";
    if (G.els.prestigeCount)
      G.els.prestigeCount.textContent = G.gameState.prestigeCount;
    if (G.els.prestigeButton) G.els.prestigeButton.disabled = !G.canPrestige();
  };

  // ---------- SWORD DISPLAYS ----------
  G.updateCurrentSwordDisplay = function (sword) {
    const div = G.els.currentSword;
    if (!div) return;
    if (sword) {
      const row = Math.floor(sword.index / G.spritesPerRow);
      const col = sword.index % G.spritesPerRow;
      const uses = G.gameState.activeSwords[sword.index];
      div.innerHTML = `<canvas width="${G.scaledW}" height="${G.scaledH}"></canvas>${uses ? `<div class="uses-badge" style="position:absolute;bottom:-2px;right:-2px;background:rgba(0,0,0,0.8);padding:1px 4px;font-size:12px;border-radius:3px;color:var(--accent-copper)">${uses}</div>` : ""}`;
      const cv = div.querySelector("canvas");
      if (cv) {
        const ctx = cv.getContext("2d");
        ctx.drawImage(
          G.spriteSheet,
          col * G.spriteWidth,
          row * G.spriteHeight,
          G.spriteWidth,
          G.spriteHeight,
          0,
          0,
          G.scaledW,
          G.scaledH,
        );
      }
      div.className = "arena-slot current-sword";
    } else {
      div.innerHTML = '<div class="slot-label">Blade</div>';
      div.className = "arena-slot current-sword";
    }
  };

  G.updateCurrentMonsterDisplay = function (monster) {
    const div = G.els.currentMonsterDisplay;
    if (!div) return;
    div.innerHTML = '<div class="slot-label">Foe</div>';
    div.className = "arena-slot current-monster-display";
    if (!monster) return;

    const cv = document.createElement("canvas");
    cv.width = G.scaledW;
    cv.height = G.scaledH;
    const ctx = cv.getContext("2d");
    div.prepend(cv);

    const idx = G.monsterSpriteMapping[monster.type.toLowerCase()];
    if (idx !== undefined && G.isMonsterImageLoaded) {
      const { row, col } = G.getSpritePosition(idx);
      ctx.drawImage(
        G.monsterSpriteSheet,
        col * G.spriteWidth,
        row * G.spriteHeight,
        G.spriteWidth,
        G.spriteHeight,
        0,
        0,
        G.scaledW,
        G.scaledH,
      );
    }
    div.classList.add(`difficulty-${monster.difficulty}`);
    if (G.gameState.monsterKills[monster.type] > 0)
      div.classList.add("defeated");
  };

  // ---------- COLLECTION ----------
  G.displayCollection = function (filter) {
    filter = filter || "all";
    const container = G.els.allCollection;
    if (!container) return;

    let swords = G.swordData;
    if (filter !== "all")
      swords = G.swordData.filter((s) => s.rarity === filter);

    container.innerHTML = swords
      .map((sword, i) => {
        const isActive = G.gameState.activeSwords[sword.index] > 0;
        const isSelected = G.currentSwordIndex === sword.index;
        return `<div class="sword-item ${sword.rarity} ${isActive ? "" : "locked"} ${isSelected ? "active" : ""}" data-index="${sword.index}" style="--i:${i}">
        <canvas width="${G.scaledW}" height="${G.scaledH}"></canvas>
        ${isActive ? `<div class="sword-uses-badge">${G.gameState.activeSwords[sword.index]}</div>` : ""}
      </div>`;
      })
      .join("");

    container.querySelectorAll(".sword-item").forEach((item) => {
      const sw = G.swordData.find(
        (s) => s.index === parseInt(item.dataset.index),
      );
      if (!sw) return;
      const cv = item.querySelector("canvas");
      const ctx = cv.getContext("2d");
      const row = Math.floor(sw.index / G.spritesPerRow);
      const col = sw.index % G.spritesPerRow;
      ctx.drawImage(
        G.spriteSheet,
        col * G.spriteWidth,
        row * G.spriteHeight,
        G.spriteWidth,
        G.spriteHeight,
        0,
        0,
        G.scaledW,
        G.scaledH,
      );

      item.addEventListener("click", () => G.showSwordPreview(sw));
    });
  };

  // ---------- SWORD PREVIEW MODAL ----------
  G.showSwordPreview = function (sw) {
    // Remove any existing preview
    const old = document.querySelector(".preview-overlay");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.className = "preview-overlay";
    overlay.innerHTML = `
      <div class="preview-card">
        <div class="preview-card-header">
          <span class="preview-card-name">${sw.name}</span>
          <button class="preview-close-btn">✕</button>
        </div>
        <canvas width="128" height="128" class="preview-card-sprite"></canvas>
        <div class="preview-card-rarity ${sw.rarity}">${sw.rarity.toUpperCase()}</div>
        <p class="preview-card-desc">${sw.description}</p>
        <div class="preview-card-stats">
          <span>⚔ ATK <strong>${sw.attack}</strong></span>
          <span>🛡 DEF <strong>${sw.defense}</strong></span>
        </div>
        ${sw.specialPower ? `<div class="preview-card-power">✨ ${sw.specialPower}</div>` : ""}
        <div class="preview-card-uses" style="color:${G.gameState.activeSwords[sw.index] ? "var(--accent-copper)" : "#ef4444"}">
          ${G.gameState.activeSwords[sw.index] ? `⚔ ${G.gameState.activeSwords[sw.index]} uses remaining` : "❌ No uses left"}
        </div>
        <button class="preview-select-btn">${G.gameState.activeSwords[sw.index] ? "Select for Battle" : "No Uses Left"}</button>
      </div>`;
    document.body.appendChild(overlay);

    // Draw sprite
    const cv = overlay.querySelector("canvas");
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const row = Math.floor(sw.index / G.spritesPerRow);
    const col = sw.index % G.spritesPerRow;
    ctx.drawImage(
      G.spriteSheet,
      col * G.spriteWidth,
      row * G.spriteHeight,
      G.spriteWidth,
      G.spriteHeight,
      0,
      0,
      128,
      128,
    );

    // Close on backdrop click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // Close button
    overlay
      .querySelector(".preview-close-btn")
      .addEventListener("click", () => overlay.remove());

    // Select button
    const selectBtn = overlay.querySelector(".preview-select-btn");
    if (G.gameState.activeSwords[sw.index]) {
      selectBtn.addEventListener("click", () => {
        G.currentSwordIndex = sw.index;
        G.updateCurrentSwordDisplay(sw);
        G.updatePlayButtonState();
        G.displayCollection(
          document.querySelector(".filter-btn.active")?.dataset?.filter ||
            "all",
        );
        overlay.remove();
        if (G.autoPlay && G.gameState.activeSwords[sw.index])
          G.simulateBattle(sw);
      });
    } else {
      selectBtn.disabled = true;
    }
  };

  // ---------- GACHA ----------
  G.doGachaPull = function () {
    if (!G.isImageLoaded || !G.swordData.length) {
      G.els.resultDiv.innerHTML = '<div class="gacha-result">Loading...</div>';
      return;
    }
    if (G.gameState.chests <= 0) {
      G.els.resultDiv.innerHTML =
        '<div class="gacha-result">No chests available!</div>';
      return;
    }
    G.gameState.chests--;
    G.updateOpenChestButtonState();

    if (G.els.chestAnim) {
      G.els.chestAnim.style.display = "block";
      G.els.chestAnim.className = "chest-animation";
      setTimeout(() => {
        G.els.chestAnim.style.display = "none";
      }, 2500);
    }

    let rawRarity = G.getRandomRarity();
    rawRarity = G.getPityRarity(rawRarity);
    const sword = G.getRandomSpriteIndex(rawRarity);
    const rarity = rawRarity;

    G.applyPity(rarity);
    G.gameState.totalPulls++;
    G.updatePityUI();

    const useLimit = G.getSwordUseLimit(rarity);
    if (!G.collection[rarity][sword.index]) {
      G.collection[rarity][sword.index] = 1;
      G.gameState.activeSwords[sword.index] =
        (G.gameState.activeSwords[sword.index] || 0) + useLimit;
      G.updatePlayButtonState();
    } else {
      G.collection[rarity][sword.index]++;
      G.gameState.activeSwords[sword.index] =
        (G.gameState.activeSwords[sword.index] || 0) + useLimit;
      G.updatePlayButtonState();
    }

    G.comboStreak = 0;
    G.updateComboUI();

    const row = Math.floor(sword.index / G.spritesPerRow);
    const col = sword.index % G.spritesPerRow;

    G.els.resultDiv.innerHTML = `
      <div class="gacha-result ${rarity}">
        <canvas width="${G.scaledW}" height="${G.scaledH}"></canvas>
        <div class="rarity-text">${rarity.toUpperCase()}</div>
        <div class="sword-name">${sword.name}</div>
        <div class="sword-description">${sword.description}</div>
        <div class="sword-stats">⚔ ${sword.attack}, 🛡 ${sword.defense}${sword.specialPower ? `, ✨ ${sword.specialPower}` : ""}</div>
        <div class="uses-left">Uses: ${G.gameState.activeSwords[sword.index]}</div>
      </div>`;

    const cv = G.els.resultDiv.querySelector("canvas");
    if (cv) {
      const ctx = cv.getContext("2d");
      ctx.drawImage(
        G.spriteSheet,
        col * G.spriteWidth,
        row * G.spriteHeight,
        G.spriteWidth,
        G.spriteHeight,
        0,
        0,
        G.scaledW,
        G.scaledH,
      );
    }

    G.displayCollection();
    G.updateTopBar();
    G.showNotification(
      `🗡️ ${rarity.toUpperCase()}: ${sword.name}!`,
      rarity === "legendary"
        ? "#f59e0b"
        : rarity === "epic"
          ? "#a855f7"
          : rarity === "rare"
            ? "#06b6d4"
            : "#78716c",
    );

    if (rarity === "legendary") G.applyLegendaryEffect();
    G.saveGame();
  };

  G.applyLegendaryEffect = function () {
    const overlay = document.createElement("div");
    overlay.className = "legendary-overlay compact-overlay";
    const container = G.els.overlayContainer;
    if (!container) return;
    container.innerHTML = "";
    container.appendChild(overlay);
    for (let i = 0; i < 3; i++) {
      const l = document.createElement("div");
      l.className = "lightning";
      overlay.appendChild(l);
    }
    container.style.animation = "shake 0.3s cubic-bezier(.36,.07,.19,.97) both";
    setTimeout(() => {
      overlay.remove();
      container.style.animation = "";
    }, 2000);
  };

  // ---------- LEVEL UP ----------
  G.checkLevelUp = function () {
    const needed = G.gameState.level * 10;
    if (G.gameState.monstersKilled >= needed) G.levelUp();
  };

  G.levelUp = function () {
    G.gameState.level++;

    const overlay = document.createElement("div");
    overlay.className = "special-ability-overlay level-up";
    overlay.innerHTML = `
      <div class="overlay-content-row">
        <div style="font-size:2em;color:#f59e0b;margin-right:12px">🏆</div>
        <div class="overlay-text-container">
          <div class="overlay-title pulse-text" style="color:#f59e0b">Level Up!</div>
          <div class="overlay-description">Advanced to Level ${G.gameState.level}!</div>
          <div class="overlay-description float-text" style="color:#f59e0b;margin-top:4px">+2 Bonus Chests</div>
        </div>
      </div>`;
    G.overlayQueue.add(overlay, 3000);

    document.body.style.animation =
      "shake 0.5s cubic-bezier(.36,.07,.19,.97) both";
    setTimeout(() => {
      document.body.style.animation = "";
    }, 500);

    G.showNotification(
      `⬆️ Level ${G.gameState.level}! +2 bonus chests!`,
      "#f59e0b",
    );
    G.gameState.chests += 2;
    G.updateTopBar();
    G.updateOpenChestButtonState();
    G.updatePrestigeUI();
    G.saveGame();
  };

  // ---------- ACHIEVEMENTS ----------
  G.updateAchievementsList = function () {
    if (!G.els.achievementsList) return;
    const monsters = Object.keys(G.gameState.monsterKills);
    if (monsters.length === 0) {
      G.els.achievementsList.innerHTML =
        '<div style="color:#666;padding:8px;font-size:12px">Battle monsters to unlock achievements</div>';
      return;
    }
    G.els.achievementsList.innerHTML = "";
    G.currentFeatFilter = G.currentFeatFilter || "all";

    monsters.forEach((type) => {
      const kills = G.gameState.monsterKills[type];
      const tiers = Object.keys(G.achievementTiers)
        .map(Number)
        .sort((a, b) => a - b);
      tiers.forEach((tier) => {
        const data = G.achievementTiers[tier];
        const complete = kills >= tier;

        if (G.currentFeatFilter === "completed" && !complete) return;

        const progress = Math.min((kills / tier) * 100, 100);
        const card = document.createElement("div");
        card.className = "achievement-card";
        card.innerHTML = `
          <div class="ach-icon">${complete ? "🏆" : "🔒"}</div>
          <div class="ach-info">
            <div class="ach-name" style="color:${complete ? "#f59e0b" : "#777"}">${tier} ${type} kills</div>
            <div class="ach-progress">${kills}/${tier} (${Math.round(progress)}%)</div>
          </div>
          <div class="ach-status ${complete ? "complete" : "pending"}">${complete ? "✓" : tier - kills + " left"}</div>`;
        G.els.achievementsList.appendChild(card);
      });
    });
  };

  // ---------- BESTIARY ----------
  G.updateBestiaryList = function () {
    if (!G.els.bestiaryList) return;
    G.els.bestiaryList.innerHTML = "";
    const sorted = [...G.monsterTypes].sort((a, b) => {
      return (
        (G.gameState.monsterKills[b.type] || 0) -
        (G.gameState.monsterKills[a.type] || 0)
      );
    });
    sorted.slice(0, 30).forEach((mon) => {
      const kills = G.gameState.monsterKills[mon.type] || 0;
      const entry = document.createElement("div");
      entry.className = "bestiary-mini";
      const cv = document.createElement("canvas");
      cv.width = G.scaledW;
      cv.height = G.scaledH;
      const ctx = cv.getContext("2d");
      const idx = G.monsterSpriteMapping[mon.type.toLowerCase()];
      if (idx !== undefined && G.isMonsterImageLoaded) {
        const { row, col } = G.getSpritePosition(idx);
        ctx.drawImage(
          G.monsterSpriteSheet,
          col * G.spriteWidth,
          row * G.spriteHeight,
          G.spriteWidth,
          G.spriteHeight,
          0,
          0,
          G.scaledW,
          G.scaledH,
        );
      }
      entry.appendChild(cv);

      const nameSpan = document.createElement("span");
      nameSpan.className = "bm-name";
      nameSpan.textContent = mon.type;
      entry.appendChild(nameSpan);

      const killsSpan = document.createElement("span");
      killsSpan.className = "bm-kills";
      killsSpan.textContent = `💀 ${kills}`;
      entry.appendChild(killsSpan);

      G.els.bestiaryList.appendChild(entry);
    });
  };

  // ---------- FORGE ----------
  G.openForgeModal = function () {
    G.forgeSelectedSword = null;
    G.renderForgeSelection();
    document.getElementById("forgeModal").style.display = "flex";
  };

  G.closeForgeModal = function () {
    document.getElementById("forgeModal").style.display = "none";
  };

  G.renderForgeSelection = function () {
    const grid = document.getElementById("forgeSelectionGrid");
    const actionArea = document.getElementById("forgeActionArea");
    const avail = G.getForgeableSwords();

    grid.innerHTML = "";
    if (avail.length === 0) {
      grid.innerHTML =
        '<div style="grid-column: 1 / -1; text-align: center; color: #666; padding: 20px;">No swords available to forge.<br>Need 5 Common, 10 Rare, or 25 Epic copies.</div>';
      actionArea.style.display = "none";
      return;
    }

    avail.forEach((sw) => {
      const req = G.getForgeRequirement(sw.rarity);
      const count = G.collection[sw.rarity][sw.index];
      const item = document.createElement("div");
      item.className = `sword-item ${sw.rarity} ${G.forgeSelectedSword === sw ? "active" : ""}`;
      item.innerHTML = `<canvas width="${G.scaledW}" height="${G.scaledH}"></canvas><div class="sword-uses-badge" style="position:absolute;bottom:-2px;right:-2px;background:rgba(0,0,0,0.8);padding:1px 4px;font-size:10px;border-radius:3px;color:var(--accent-copper);border:1px solid rgba(249,115,22,0.3);">${count}/${req}</div>`;

      const cv = item.querySelector("canvas");
      const ctx = cv.getContext("2d");
      const row = Math.floor(sw.index / G.spritesPerRow);
      const col = sw.index % G.spritesPerRow;
      ctx.drawImage(
        G.spriteSheet,
        col * G.spriteWidth,
        row * G.spriteHeight,
        G.spriteWidth,
        G.spriteHeight,
        0,
        0,
        G.scaledW,
        G.scaledH,
      );

      item.addEventListener("click", () => {
        G.forgeSelectedSword = sw;
        G.renderForgeSelection();
      });
      grid.appendChild(item);
    });

    if (G.forgeSelectedSword) {
      actionArea.style.display = "flex";
      const sw = G.forgeSelectedSword;
      const req = G.getForgeRequirement(sw.rarity);
      const count = G.collection[sw.rarity][sw.index];
      const nextRarity = G.getNextRarity(sw.rarity);

      const slot = document.getElementById("forgeSelectedSlot");
      slot.className = `sword-item ${sw.rarity} active`;
      slot.innerHTML = `<canvas width="${G.scaledW}" height="${G.scaledH}"></canvas>`;
      const ctx = slot.querySelector("canvas").getContext("2d");
      const row = Math.floor(sw.index / G.spritesPerRow);
      const col = sw.index % G.spritesPerRow;
      ctx.drawImage(
        G.spriteSheet,
        col * G.spriteWidth,
        row * G.spriteHeight,
        G.spriteWidth,
        G.spriteHeight,
        0,
        0,
        G.scaledW,
        G.scaledH,
      );

      document.getElementById("forgeCostText").innerHTML =
        `Cost: <strong style="color:#ef4444">${req}</strong> ${sw.name} copies<br>You have: ${count}`;
      const executeBtn = document.getElementById("forgeExecute");
      executeBtn.disabled = count < req;
      executeBtn.textContent = `Forge → ${nextRarity.toUpperCase()}`;
    } else {
      actionArea.style.display = "none";
    }
  };

  G.executeForge = function () {
    if (!G.forgeSelectedSword) return;
    const first = G.forgeSelectedSword;
    const rarity = first.rarity;
    const nextRarity = G.getNextRarity(rarity);
    const req = G.getForgeRequirement(rarity);

    if (G.collection[rarity][first.index] < req) return;

    G.collection[rarity][first.index] -= req;
    if (G.collection[rarity][first.index] <= 0)
      delete G.collection[rarity][first.index];

    const newSword = G.getRandomSpriteIndex(nextRarity);
    const useLimit = G.getSwordUseLimit(nextRarity);
    if (!G.collection[nextRarity][newSword.index]) {
      G.collection[nextRarity][newSword.index] = 1;
      G.gameState.activeSwords[newSword.index] =
        (G.gameState.activeSwords[newSword.index] || 0) + useLimit;
    } else {
      G.collection[nextRarity][newSword.index]++;
      G.gameState.activeSwords[newSword.index] =
        (G.gameState.activeSwords[newSword.index] || 0) + useLimit;
    }

    G.showNotification(
      `🔨 Forged ${newSword.name} (${nextRarity.toUpperCase()})!`,
      nextRarity === "legendary"
        ? "#f59e0b"
        : nextRarity === "epic"
          ? "#a855f7"
          : "#06b6d4",
    );

    G.forgeSelectedSword = null;
    G.renderForgeSelection();
    G.displayCollection();
    G.updateTopBar();
    G.updateOpenChestButtonState();
    G.saveGame();
  };

  // ---------- BESTIARY MODAL ----------
  G.openBestiaryModal = function () {
    G.renderBestiaryGrid();
    document.getElementById("bestiaryModal").style.display = "flex";
  };

  G.renderBestiaryGrid = function () {
    const grid = document.getElementById("bestiaryGrid");
    grid.innerHTML = "";
    G.monsterTypes.forEach((mon) => {
      const kills = G.gameState.monsterKills[mon.type] || 0;
      const entry = document.createElement("div");
      entry.className = "bestiary-entry";
      const c = document.createElement("canvas");
      c.width = G.scaledW;
      c.height = G.scaledH;
      const ctx = c.getContext("2d");
      const idx = G.monsterSpriteMapping[mon.type.toLowerCase()];
      if (idx !== undefined && G.isMonsterImageLoaded) {
        const { row, col } = G.getSpritePosition(idx);
        ctx.drawImage(
          G.monsterSpriteSheet,
          col * G.spriteWidth,
          row * G.spriteHeight,
          G.spriteWidth,
          G.spriteHeight,
          0,
          0,
          G.scaledW,
          G.scaledH,
        );
      }
      entry.appendChild(c);

      const nameDiv = document.createElement("div");
      nameDiv.className = "bestiary-name";
      nameDiv.textContent = mon.type;
      entry.appendChild(nameDiv);

      const killsDiv = document.createElement("div");
      killsDiv.className = "bestiary-kills";
      killsDiv.textContent = `💀 ${kills}`;
      entry.appendChild(killsDiv);

      const tierColors = {
        1: "#666",
        2: "#2ecc71",
        3: "#00ffff",
        4: "#ff00ff",
        5: "#ffd700",
      };
      const tierDiv = document.createElement("div");
      tierDiv.className = "bestiary-tier";
      tierDiv.style.background = `${tierColors[mon.difficulty]}22`;
      tierDiv.style.color = tierColors[mon.difficulty];
      tierDiv.textContent = `T${mon.difficulty}`;
      entry.appendChild(tierDiv);

      grid.appendChild(entry);
    });
  };

  // ---------- PRESTIGE ----------
  G.doPrestige = function () {
    if (!G.canPrestige()) return;
    if (
      !confirm(
        `Prestige to level ${G.gameState.prestigeCount + 1}?\n\nResets: Level, kills, swords, chests\nKeeps: Prestige count (+0.5% legendary rate), total pulls\nStart with 10 chests`,
      )
    )
      return;

    G.gameState.prestigeCount++;
    G.gameState.prestigeBonus = G.gameState.prestigeCount * 0.005;
    G.gameState.level = 1;
    G.gameState.monstersKilled = 0;
    G.gameState.chests = 10;
    G.gameState.activeSwords = {};
    G.gameState.monsterKills = {};
    G.currentSwordIndex = null;
    G.comboStreak = 0;
    G.initializeCollection();

    G.updatePrestigeUI();
    G.updateTopBar();
    G.displayCollection();
    G.updatePlayButtonState();
    G.updateOpenChestButtonState();
    G.saveGame();
    G.showNotification(
      `♜ Prestige ${G.gameState.prestigeCount}! Legendary rate: +${(G.gameState.prestigeBonus * 100).toFixed(1)}%`,
      "#f97316",
    );
  };
})();
