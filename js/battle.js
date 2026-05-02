// ===================== BATTLE SYSTEM =====================
(function () {
  const G = Game;

  G.simulateBattle = function (sword) {
    if (!sword || !G.gameState.activeSwords[sword.index]) return;
    if (G.overlayQueue.isDisplaying && G.overlayQueue.queue.length > 0) return;

    const monster = G.monsterTypes[Math.floor(Math.random() * G.monsterTypes.length)];
    let monsterHp = monster ? monster.health : 50;

    let specialAbilityTriggered = false;
    let monstersDefeated = 1;
    let isCrit = false;

    G.updateCurrentMonsterDisplay(monster);
    G.updateOpenChestButtonState();

    if (sword.rarity === "legendary" || sword.rarity === "epic") {
      const chance = sword.rarity === "legendary" ? 0.15 : 0.08;
      specialAbilityTriggered = Math.random() < chance;
    }

    const baseDamage = sword.attack * (1 + (G.gameState.level - 1) * 0.1);
    const totalDamage = G.applyComboDamage(baseDamage);
    isCrit = G.rollCrit();
    const finalDamage = isCrit ? totalDamage * 2 : totalDamage;
    G.gameState.totalDamageDealt += finalDamage;

    const turnsToKill = Math.ceil(monsterHp / finalDamage);

    const battleMessage = document.createElement("div");
    battleMessage.className = "notification";
    const theme = G.difficultyThemes[monster.difficulty] || G.difficultyThemes[1];
    const critTag = isCrit ? "⚡CRIT!⚡ " : "";
    battleMessage.innerHTML = `⚔️ ${critTag}<span class="${sword.rarity}">${sword.name}</span> (${finalDamage.toFixed(1)} DMG) VS <span style="color: ${theme.color};">${monster.type}</span> (${monsterHp} HP)...`;
    G.els.notificationsDiv.prepend(battleMessage);
    G.checkNotificationsLimit();

    setTimeout(() => G.showFloatingDamage(finalDamage, isCrit), 200);

    G.comboStreak++;
    if (G.comboStreak > G.gameState.bestKillStreak) G.gameState.bestKillStreak = G.comboStreak;
    G.updateComboUI();

    if (specialAbilityTriggered) {
      monstersDefeated = sword.rarity === "legendary" ? 5 : 3;
      const overlay = document.createElement("div");
      overlay.className = `special-ability-overlay ${sword.rarity}`;
      overlay.innerHTML = `
        <div class="overlay-content-row">
          <canvas class="overlay-sprite overlay-sprite-normal" width="50" height="50"></canvas>
          <div class="overlay-text-container">
            <div class="overlay-title pulse-text" style="color:${sword.rarity === "legendary" ? "#f59e0b" : "#a855f7"}">${sword.specialPower}!</div>
            <div class="overlay-description">Defeated ${monstersDefeated} ${monster.type}s in one strike!</div>
          </div>
        </div>`;
      G.overlayQueue.add(overlay, 2000);
      setTimeout(() => {
        const cv = overlay.querySelector("canvas");
        if (cv) {
          const ctx = cv.getContext("2d");
          const row = Math.floor(sword.index / G.spritesPerRow);
          const col = sword.index % G.spritesPerRow;
          ctx.drawImage(G.spriteSheet, col * G.spriteWidth, row * G.spriteHeight, G.spriteWidth, G.spriteHeight, 0, 0, 50, 50);
        }
      }, 0);
    }

    setTimeout(() => {
      G.gameState.activeSwords[sword.index]--;
      if (G.gameState.activeSwords[sword.index] <= 0) {
        delete G.gameState.activeSwords[sword.index];
        G.currentSwordIndex = null;
        G.comboStreak = 0;
        G.updateComboUI();
        G.updatePlayButtonState();
      }

      G.gameState.monstersKilled += monstersDefeated;
      G.gameState.chests += monster.chestReward * monstersDefeated;

      if (!G.gameState.monsterKills[monster.type]) G.gameState.monsterKills[monster.type] = 0;
      const prevKills = G.gameState.monsterKills[monster.type];
      G.gameState.monsterKills[monster.type] += monstersDefeated;
      const newKills = G.gameState.monsterKills[monster.type];

      Object.entries(G.achievementTiers).forEach(([kills, tier]) => {
        if (prevKills < kills && newKills >= kills) {
          const achOverlay = document.createElement("div");
          achOverlay.className = "special-ability-overlay achievement";
          achOverlay.innerHTML = `
            <div class="overlay-content-row">
              <canvas class="overlay-sprite overlay-sprite-normal" width="50" height="50"></canvas>
              <div class="overlay-text-container">
                <div class="overlay-title pulse-text" style="color:${tier.shadowColor.replace("0.3", "1")}">${kills} Kill Achievement!</div>
                <div class="overlay-description">Defeated ${kills} ${monster.type}s!</div>
              </div>
            </div>`;
          G.overlayQueue.add(achOverlay, 3000);
          G.showNotification(`🏆 Achievement: ${kills} ${monster.type} kills!`, tier.shadowColor);
          G.saveGame();
        }
      });

      if (monster.chestReward > 0) {
        const crOverlay = document.createElement("div");
        crOverlay.className = "special-ability-overlay chest-reward";
        crOverlay.innerHTML = `
          <div class="overlay-content-row">
            <canvas class="overlay-sprite overlay-sprite-large" width="70" height="70"></canvas>
            <div class="overlay-text-container">
              <div class="overlay-title pulse-text" style="color:${theme.color}">Powerful Enemy Defeated!</div>
              <div class="overlay-description float-text">${monster.type} dropped ${monster.chestReward} chest${monster.chestReward > 1 ? "s" : ""}!</div>
            </div>
          </div>`;
        G.overlayQueue.add(crOverlay, 2500);
        setTimeout(() => {
          const mc = crOverlay.querySelector("canvas");
          if (mc && G.monsterSpriteMapping[monster.type.toLowerCase()] !== undefined) {
            const mctx = mc.getContext("2d");
            mctx.imageSmoothingEnabled = false;
            const idx = G.monsterSpriteMapping[monster.type.toLowerCase()];
            const { row, col } = G.getSpritePosition(idx);
            mctx.drawImage(G.monsterSpriteSheet, col * G.spriteWidth, row * G.spriteHeight, G.spriteWidth, G.spriteHeight, 0, 0, 70, 70);
          }
        }, 0);
      }

      G.checkLevelUp();
      G.updateTopBar();
      G.displayCollection();
      G.updateCurrentSwordDisplay(sword);
      G.updatePityUI();
      G.updatePrestigeUI();
      G.updateAchievementsList();
      G.updateBestiaryList();
      G.updateDPS();

      if (G.els.streakDisplay) {
        if (G.comboStreak > 0) G.els.streakDisplay.textContent = `Streak: ${G.comboStreak} (best: ${G.gameState.bestKillStreak})`;
        else G.els.streakDisplay.textContent = "No active streak";
      }
      G.saveGame();

      if (specialAbilityTriggered) {
        battleMessage.innerHTML = `⚔️ ${critTag}<span class="${sword.rarity}">${sword.name}</span> unleashed ${sword.specialPower}! Defeated ${monstersDefeated} ${monster.type}s!`;
        battleMessage.style.color = sword.rarity === "legendary" ? "#f59e0b" : "#a855f7";
        G.showNotification(`✨ ${sword.specialPower} activated! ${monstersDefeated}x rewards!`, sword.rarity === "legendary" ? "#f59e0b" : "#a855f7");
      } else {
        battleMessage.innerHTML = `⚔️ ${critTag}<span class="${sword.rarity}">${sword.name}</span> (${finalDamage.toFixed(1)} DMG) defeated <span style="color: ${theme.color}">${monster.type}</span> (${monsterHp} HP) in ${turnsToKill} turns!`;
      }
    }, turnsToKill * 400);

    if (G.autoPlay && G.currentSwordIndex !== null && G.gameState.activeSwords[sword.index] > 0) {
      const delays = { legendary: 1000, epic: 2000, rare: 3000, common: 4000 };
      const totalDelay = (delays[sword.rarity] || 3000) + turnsToKill * 400;
      setTimeout(() => G.simulateBattle(sword), totalDelay);
    } else {
      G.els.playPauseButton.textContent = "Battle";
      G.autoPlay = false;
    }
  };

  G.showFloatingDamage = function (damage, isCrit) {
    const display = G.els.currentMonsterDisplay;
    if (!display) return;
    const el = document.createElement("div");
    el.className = `floating-dmg ${isCrit ? "crit" : ""}`;
    el.textContent = isCrit ? `⚡${Math.round(damage)}!` : `-${Math.round(damage)}`;
    el.style.left = "50%";
    el.style.top = "10%";
    el.style.transform = "translateX(-50%)";
    el.style.color = isCrit ? "#ef4444" : "#f97316";
    display.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  };

  G.showMonsterHPBar = function (current, max) {
    const display = G.els.currentMonsterDisplay;
    if (!display) return;
    let bar = display.querySelector(".monster-hp-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "monster-hp-bar";
      display.appendChild(bar);
    }
    let fill = bar.querySelector(".monster-hp-fill");
    if (!fill) {
      fill = document.createElement("div");
      fill.className = "monster-hp-fill";
      bar.appendChild(fill);
    }
    fill.style.width = `${(current / max) * 100}%`;
  };
})();
