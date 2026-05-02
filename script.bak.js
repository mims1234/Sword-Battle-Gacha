// ===================== OVERLAY QUEUE =====================
const overlayQueue = {
  queue: [],
  isDisplaying: false,
  add(overlay, duration) {
    this.queue.push({ overlay, duration });
    if (!this.isDisplaying) this.displayNext();
  },
  displayNext() {
    if (this.queue.length === 0) {
      this.isDisplaying = false;
      const c = document.querySelector(".overlay-container");
      if (c) c.innerHTML = "";
      if (autoPlay && currentSwordIndex !== null && gameState.activeSwords[currentSwordIndex] > 0) {
        const sw = swordData.find(s => s.index === currentSwordIndex);
        if (sw) setTimeout(() => simulateBattle(sw), 150);
      }
      return;
    }
    this.isDisplaying = true;
    const { overlay, duration } = this.queue.shift();
    const c = document.querySelector(".overlay-container");
    if (!c) { this.displayNext(); return; }
    c.innerHTML = "";
    c.appendChild(overlay);
    setTimeout(() => { overlay.remove(); this.displayNext(); }, duration);
  }
};

// ===================== SPRITE CONFIG =====================
const spriteSheet = new Image();
const spriteWidth = 32, spriteHeight = 32, scale = 2;
const scaledW = spriteWidth * scale, scaledH = spriteHeight * scale;
const spritesPerRow = 6;

const monsterSpriteSheet = new Image();
monsterSpriteSheet.src = "assets/monsters.png";
const spritesPerRowCounts = [8, 3, 4, 2, 6, 5, 12, 10, 5, 2, 2, 2, 3];

function getSpritePosition(spriteIndex) {
  let start = 0;
  for (let i = 0; i < spritesPerRowCounts.length; i++) {
    if (spriteIndex < start + spritesPerRowCounts[i]) return { row: i, col: spriteIndex - start };
    start += spritesPerRowCounts[i];
  }
  return { row: 0, col: 0 };
}

const monsterSpriteMapping = {
  "death knight": 20, reaper: 24, manticore: 32, lycanthrope: 34, wendigo: 42,
  "rock golem": 43, naga: 45, minotaur: 48, "gorgon/medusa": 50,
  "drake / lesser dragon": 52, dragon: 53, basilisk: 55, "angel / archangel": 60,
  goblin: 0, "goblin archer": 0, "goblin mage": 0, "goblin brute": 0,
  orc: 1, "orc wizard": 1, "orc blademaster": 1, "orc warchief": 1,
  troll: 2, skeleton: 3, "skeleton archer": 3, zombie: 4, ghoul: 4,
  slime: 5, "small slime": 5, "big slime": 5, slimebody: 5, "merged slimebodies": 5,
  ettin: 6, "two headed ettin": 6, lich: 7, "imp / devil": 21
};

const achievementTiers = {
  10: { spriteOffset: 0, shadowColor: "rgba(0, 0, 0, 0.3)" },
  50: { spriteOffset: 1, shadowColor: "rgba(0, 0, 255, 0.3)" },
  100: { spriteOffset: 2, shadowColor: "rgba(0, 255, 0, 0.3)" },
  250: { spriteOffset: 3, shadowColor: "rgba(255, 0, 0, 0.3)" },
  500: { spriteOffset: 4, shadowColor: "rgba(255, 255, 0, 0.3)" },
  1000: { spriteOffset: 5, shadowColor: "rgba(0, 255, 255, 0.3)" },
  2500: { spriteOffset: 6, shadowColor: "rgba(255, 0, 255, 0.3)" },
  5000: { spriteOffset: 7, shadowColor: "rgba(255, 255, 255, 0.3)" },
  10000: { spriteOffset: 8, shadowColor: "rgba(128, 128, 128, 0.3)" }
};

// ===================== DOM REFS =====================
const pullButton = document.getElementById("pullButton");
const resultDiv = document.getElementById("result");
const menuButton = document.getElementById("menuButton");
const playPauseButton = document.getElementById("playPauseButton");
const notificationsDiv = document.getElementById("notifications");
const forgeButton = document.getElementById("forgeButton");
const bestiaryButton = document.getElementById("bestiaryButton");
const prestigeButton = document.getElementById("prestigeButton");
const saveButton = document.getElementById("saveButton");
const resetButton = document.getElementById("resetButton");
const pulMulti5 = document.getElementById("pullMulti5");
const pulMulti10 = document.getElementById("pullMulti10");
const pityFill = document.getElementById("pityFill");
const pityText = document.getElementById("pityText");
const comboDisplay = document.getElementById("comboDisplay");
const comboCount = document.getElementById("comboCount");
const comboBonus = document.getElementById("comboBonus");
const collectionCount = document.getElementById("collectionCount");
const streakDisplay = document.getElementById("streakDisplay");
const pullsDisplay = document.getElementById("pullsDisplay");
const dpsDisplay = document.getElementById("dpsDisplay");
const prestigeBlock = document.getElementById("prestigeBlock");
const prestigeCountEl = document.getElementById("prestigeCount");
const achievementsList = document.getElementById("achievementsList");
const bestiaryList = document.getElementById("bestiaryList");

// ===================== STATE =====================
let swordData = [];
let monsterTypes = [];
let isImageLoaded = false;
let collection = {};
let currentSwordIndex = null;
let autoPlay = false;
let comboStreak = 0;

let gameState = {
  monstersKilled: 0,
  chests: 5,
  level: 1,
  currentBattle: null,
  activeSwords: {},
  monsterKills: {},
  // New features
  totalPulls: 0,
  pullsSinceEpic: 0,
  pullsSinceLegendary: 0,
  totalLegendaryPulls: 0,
  prestigeCount: 0,
  prestigeBonus: 0, // +0.5% legendary rate per prestige
  bestKillStreak: 0,
  totalDamageDealt: 0,
  settings: {
    autoForge: false,
  }
};

// ===================== SAVE/LOAD =====================
const SAVE_KEY = "idle_blade_master_save";

function saveGame() {
  try {
    const data = { gameState, collection, currentSwordIndex, comboStreak };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Save failed:", e);
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    gameState = { ...gameState, ...data.gameState };
    collection = data.collection || {};
    currentSwordIndex = data.currentSwordIndex ?? null;
    comboStreak = data.comboStreak || 0;
    return true;
  } catch (e) {
    console.warn("Load failed:", e);
    return false;
  }
}

function resetGame() {
  if (!confirm("Reset all progress? This cannot be undone!")) return;
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}

saveButton.addEventListener("click", () => {
  saveGame();
  showNotification("💾 Game saved!", "#888");
});

resetButton.addEventListener("click", resetGame);

// Auto-save every 30 seconds
setInterval(saveGame, 30000);

// ===================== PITY SYSTEM =====================
const PITY_EPIC_CAP = 15;
const PITY_LEGENDARY_CAP = 50;

function updatePityUI() {
  const epicPity = Math.min(gameState.pullsSinceEpic, PITY_EPIC_CAP);
  const pityProgress = (epicPity / PITY_EPIC_CAP) * 100;
  if (pityFill) pityFill.style.width = `${pityProgress}%`;
  if (pityText) {
    const pulls = gameState.pullsSinceEpic;
    const remaining = PITY_EPIC_CAP - pulls;
    pityText.textContent = remaining > 0 ? `Epic in ${remaining}` : "Guaranteed Epic!";
  }
  if (pullsDisplay) {
    pullsDisplay.textContent = `Pulls: ${gameState.totalPulls}`;
  }
}

function getPityRarity(raw) {
  if (gameState.pullsSinceLegendary >= PITY_LEGENDARY_CAP) return "legendary";
  if (gameState.pullsSinceEpic >= PITY_EPIC_CAP) return "epic";
  return raw;
}

function applyPity(rarity) {
  gameState.pullsSinceEpic++;
  gameState.pullsSinceLegendary++;
  if (rarity === "epic") gameState.pullsSinceEpic = 0;
  if (rarity === "legendary") {
    gameState.pullsSinceLegendary = 0;
    gameState.pullsSinceEpic = 0;
    gameState.totalLegendaryPulls++;
  }
  updatePityUI();
}

// ===================== CRITICAL HITS =====================
function rollCrit() {
  const critChance = 0.05 + (gameState.level - 1) * 0.01;
  return Math.random() < Math.min(critChance, 0.5);
}

// ===================== COMBO STREAK =====================
function updateComboUI() {
  if (!comboDisplay) return;
  if (comboStreak > 0) {
    comboDisplay.style.display = "flex";
    comboCount.textContent = comboStreak;
    const bonus = Math.min(comboStreak * 0.05, 0.5);
    comboBonus.textContent = `(+${Math.round(bonus * 100)}%)`;
  } else {
    comboDisplay.style.display = "none";
  }
}

function applyComboDamage(baseDamage) {
  const bonus = Math.min(comboStreak * 0.05, 0.5);
  return baseDamage * (1 + bonus);
}

function resetCombo() {
  comboStreak = 0;
  updateComboUI();
}

// ===================== GET RARITY =====================
function getRandomRarity() {
  const legendaryRate = 0.05 + (gameState.prestigeCount * 0.005);
  const epicRate = 0.15;
  const rareRate = 0.25;
  const rand = Math.random();
  if (rand < legendaryRate) return "legendary";
  if (rand < legendaryRate + epicRate) return "epic";
  if (rand < legendaryRate + epicRate + rareRate) return "rare";
  return "common";
}

function getRandomSpriteIndex(rarity) {
  const filtered = swordData.filter(s => s.rarity === rarity);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function getSwordUseLimit(rarity) {
  switch (rarity) {
    case "legendary": return 48;
    case "epic": return 24;
    case "rare": return 12;
    default: return 4;
  }
}

function initializeCollection() {
  collection = { common: {}, rare: {}, epic: {}, legendary: {} };
}

// ===================== FORGE / FUSION =====================
let forgeSlots = [];

function openForgeModal() {
  forgeSlots = [];
  renderForgeSlots();
  document.getElementById("forgeModal").style.display = "flex";
}

function closeForgeModal() {
  document.getElementById("forgeModal").style.display = "none";
}

document.getElementById("forgeClose").addEventListener("click", closeForgeModal);
document.getElementById("forgeModal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeForgeModal();
});

function renderForgeSlots() {
  const slotsDiv = document.getElementById("forgeSlots");
  const executeBtn = document.getElementById("forgeExecute");
  slotsDiv.innerHTML = "";
  const avail = getForgeableSwords();

  for (let i = 0; i < 3; i++) {
    const slot = document.createElement("div");
    slot.className = `forge-slot ${forgeSlots[i] ? "filled" : ""}`;
    if (forgeSlots[i]) {
      const sw = forgeSlots[i];
      const c = document.createElement("canvas");
      c.width = scaledW; c.height = scaledH;
      const ctx = c.getContext("2d");
      const row = Math.floor(sw.index / spritesPerRow);
      const col = sw.index % spritesPerRow;
      ctx.drawImage(spriteSheet, col * spriteWidth, row * spriteHeight, spriteWidth, spriteHeight, 0, 0, scaledW, scaledH);
      slot.appendChild(c);
    } else {
      slot.textContent = "+";
    }
    if (!forgeSlots[i]) {
      slot.addEventListener("click", () => {
        if (avail.length === 0) { showNotification("No swords available to forge!", "#999"); return; }
        const pick = prompt(`Pick a sword to forge (0-${avail.length - 1}):\n${avail.map((s, i) => `${i}. ${s.rarity.toUpperCase()} ${s.name} (x${collection[s.rarity][s.index]})`).join("\n")}`);
        if (pick !== null && avail[pick]) {
          const chosen = avail[pick];
          forgeSlots[i] = chosen;
          renderForgeSlots();
        }
      });
    } else {
      slot.addEventListener("click", () => {
        forgeSlots[i] = null;
        renderForgeSlots();
      });
    }
    slotsDiv.appendChild(slot);
  }
  updateForgeButton();
}

function getForgeableSwords() {
  const result = [];
  for (const rarity of ["common", "rare", "epic", "legendary"]) {
    for (const [idx, count] of Object.entries(collection[rarity] || {})) {
      if (count >= 3) {
        const sw = swordData.find(s => s.index === parseInt(idx));
        if (sw) result.push(sw);
      }
    }
  }
  return result;
}

function updateForgeButton() {
  const executeBtn = document.getElementById("forgeExecute");
  const canForge = forgeSlots.length === 3 && forgeSlots.every(Boolean);
  if (forgeSlots.length === 3 && forgeSlots.every(Boolean)) {
    const first = forgeSlots[0];
    const same = forgeSlots.every(s => s.index === first.index);
    executeBtn.disabled = !same;
    if (!same) {
      executeBtn.textContent = "Swords must match!";
    } else {
      executeBtn.disabled = false;
      executeBtn.textContent = `Forge → ${getNextRarity(first.rarity)}`;
    }
  } else {
    executeBtn.disabled = true;
    executeBtn.textContent = "Select 3 matching swords";
  }
}

function getNextRarity(rarity) {
  const map = { common: "rare", rare: "epic", epic: "legendary", legendary: "legendary" };
  return map[rarity];
}

function executeForge() {
  const first = forgeSlots[0];
  const rarity = first.rarity;
  const nextRarity = getNextRarity(rarity);

  // Remove 3 copies
  collection[rarity][first.index] -= 3;
  if (collection[rarity][first.index] <= 0) delete collection[rarity][first.index];

  // Grant 1 random sword of next rarity
  const newSword = getRandomSpriteIndex(nextRarity);
  const useLimit = getSwordUseLimit(nextRarity);
  if (!collection[nextRarity][newSword.index]) {
    collection[nextRarity][newSword.index] = 1;
    gameState.activeSwords[newSword.index] = (gameState.activeSwords[newSword.index] || 0) + useLimit;
  } else {
    collection[nextRarity][newSword.index]++;
    gameState.activeSwords[newSword.index] = (gameState.activeSwords[newSword.index] || 0) + useLimit;
  }

  showNotification(`🔨 Forged ${newSword.name} (${nextRarity.toUpperCase()})!`, nextRarity === "legendary" ? "#f59e0b" : nextRarity === "epic" ? "#a855f7" : "#06b6d4");
  forgeSlots = [];
  renderForgeSlots();
  displayCollection();
  updateTopBar();
  saveGame();
}

document.getElementById("forgeExecute").addEventListener("click", executeForge);

// ===================== BESTIARY =====================
function openBestiaryModal() {
  renderBestiaryGrid();
  document.getElementById("bestiaryModal").style.display = "flex";
}

function closeBestiaryModal() {
  document.getElementById("bestiaryModal").style.display = "none";
}

document.getElementById("bestiaryClose").addEventListener("click", closeBestiaryModal);
document.getElementById("bestiaryModal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeBestiaryModal();
});

function renderBestiaryGrid() {
  const grid = document.getElementById("bestiaryGrid");
  grid.innerHTML = "";
  monsterTypes.forEach(mon => {
    const kills = gameState.monsterKills[mon.type] || 0;
    const entry = document.createElement("div");
    entry.className = "bestiary-entry";
    const c = document.createElement("canvas");
    c.width = scaledW; c.height = scaledH;
    const ctx = c.getContext("2d");
    const idx = monsterSpriteMapping[mon.type.toLowerCase()];
    if (idx !== undefined) {
      const { row, col } = getSpritePosition(idx);
      ctx.drawImage(monsterSpriteSheet, col * spriteWidth, row * spriteHeight, spriteWidth, spriteHeight, 0, 0, scaledW, scaledH);
    }
    entry.appendChild(c);
    entry.innerHTML += `<div class="bestiary-name">${mon.type}</div>`;
    entry.innerHTML += `<div class="bestiary-kills">💀 ${kills}</div>`;
    const tierColors = { 1: "#666", 2: "#2ecc71", 3: "#00ffff", 4: "#ff00ff", 5: "#ffd700" };
    entry.innerHTML += `<div class="bestiary-tier" style="background: ${tierColors[mon.difficulty]}22; color: ${tierColors[mon.difficulty]}">T${mon.difficulty}</div>`;
    grid.appendChild(entry);
  });
}

// ===================== PRESTIGE =====================
function canPrestige() {
  return gameState.level >= 50;
}

function doPrestige() {
  if (!canPrestige()) return;
  if (!confirm(`Prestige to level ${gameState.prestigeCount + 1}?\n\nResets: Level, kills, swords, chests\nKeeps: Prestige count (+0.5% legendary rate), total pulls\nStart with 10 chests`)) return;

  gameState.prestigeCount++;
  gameState.prestigeBonus = gameState.prestigeCount * 0.005;
  gameState.level = 1;
  gameState.monstersKilled = 0;
  gameState.chests = 10;
  gameState.activeSwords = {};
  gameState.monsterKills = {};
  currentSwordIndex = null;
  comboStreak = 0;
  initializeCollection();

  updatePrestigeUI();
  updateTopBar();
  displayCollection();
  updatePlayButtonState();
  updateOpenChestButtonState();
  saveGame();
  showNotification(`♜ Prestige ${gameState.prestigeCount}! Legendary rate: +${(gameState.prestigeBonus * 100).toFixed(1)}%`, "#f97316");
}

function updatePrestigeUI() {
  if (prestigeBlock) {
    prestigeBlock.style.display = gameState.prestigeCount > 0 ? "flex" : "none";
  }
  if (prestigeCountEl) prestigeCountEl.textContent = gameState.prestigeCount;
  if (prestigeButton) prestigeButton.disabled = !canPrestige();
}

// ===================== NOTIFICATION =====================
function showNotification(message, color = "#888") {
  const n = document.createElement("div");
  n.className = "notification";
  n.innerHTML = message;
  if (color) n.style.borderLeftColor = color;
  notificationsDiv.prepend(n);
  checkNotificationsLimit();
}

function checkNotificationsLimit() {
  while (notificationsDiv.children.length > 15) {
    notificationsDiv.removeChild(notificationsDiv.lastChild);
  }
}

// ===================== BATTLE =====================
const difficultyThemes = {
  1: { color: "#ffffff", shadow: "#666666", glow: "#666666" },
  2: { color: "#2ecc71", shadow: "#006600", glow: "#2ecc71" },
  3: { color: "#00ffff", shadow: "#006666", glow: "#00ffff" },
  4: { color: "#ff00ff", shadow: "#660066", glow: "#ff00ff" },
  5: { color: "#ffd700", shadow: "#664400", glow: "#ffd700" }
};

function simulateBattle(sword) {
  if (!sword || !gameState.activeSwords[sword.index]) return;
  if (overlayQueue.isDisplaying && overlayQueue.queue.length > 0) return;

  const monster = monsterTypes[Math.floor(Math.random() * monsterTypes.length)];
  let monsterHp = monster ? monster.health : 50;

  let specialAbilityTriggered = false;
  let monstersDefeated = 1;
  let isCrit = false;

  updateCurrentMonsterDisplay(monster);
  updateOpenChestButtonState();

  // Special ability
  if (sword.rarity === "legendary" || sword.rarity === "epic") {
    const chance = sword.rarity === "legendary" ? 0.15 : 0.08;
    specialAbilityTriggered = Math.random() < chance;
  }

  const baseDamage = sword.attack * (1 + (gameState.level - 1) * 0.1);
  const totalDamage = applyComboDamage(baseDamage);
  isCrit = rollCrit();
  const finalDamage = isCrit ? totalDamage * 2 : totalDamage;
  gameState.totalDamageDealt += finalDamage;

  const turnsToKill = Math.ceil(monsterHp / finalDamage);

  // Battle notification
  const battleMessage = document.createElement("div");
  battleMessage.className = "notification";
  const theme = difficultyThemes[monster.difficulty] || difficultyThemes[1];
  const critTag = isCrit ? "⚡CRIT!⚡ " : "";
  battleMessage.innerHTML = `⚔️ ${critTag}<span class="${sword.rarity}">${sword.name}</span> (${finalDamage.toFixed(1)} DMG) VS <span style="color: ${theme.color};">${monster.type}</span> (${monsterHp} HP)...`;
  notificationsDiv.prepend(battleMessage);
  checkNotificationsLimit();

  // Floating damage on monster display
  setTimeout(() => showFloatingDamage(finalDamage, isCrit), 200);

  // Combo streak
  comboStreak++;
  if (comboStreak > gameState.bestKillStreak) gameState.bestKillStreak = comboStreak;
  updateComboUI();

  // Special ability
  if (specialAbilityTriggered) {
    monstersDefeated = sword.rarity === "legendary" ? 5 : 3;
    const overlay = document.createElement("div");
    overlay.className = `special-ability-overlay ${sword.rarity}`;
    overlay.innerHTML = `
      <div class="overlay-content-row">
        <canvas class="overlay-sprite overlay-sprite-normal" width="50" height="50"></canvas>
        <div class="overlay-text-container">
          <div class="overlay-title pulse-text" style="color: ${sword.rarity === "legendary" ? "#f59e0b" : "#a855f7"}">${sword.specialPower}!</div>
          <div class="overlay-description">Defeated ${monstersDefeated} ${monster.type}s in one strike!</div>
        </div>
      </div>`;
    overlayQueue.add(overlay, 2000);
    setTimeout(() => {
      const cv = overlay.querySelector("canvas");
      if (cv) {
        const ctx = cv.getContext("2d");
        const row = Math.floor(sword.index / spritesPerRow);
        const col = sword.index % spritesPerRow;
        ctx.drawImage(spriteSheet, col * spriteWidth, row * spriteHeight, spriteWidth, spriteHeight, 0, 0, 50, 50);
      }
    }, 0);
  }

  setTimeout(() => {
    gameState.activeSwords[sword.index]--;
    if (gameState.activeSwords[sword.index] <= 0) {
      delete gameState.activeSwords[sword.index];
      currentSwordIndex = null;
      resetCombo();
      updatePlayButtonState();
    }

    gameState.monstersKilled += monstersDefeated;
    gameState.chests += monster.chestReward * monstersDefeated;

    // Monster kill tracking
    if (!gameState.monsterKills[monster.type]) gameState.monsterKills[monster.type] = 0;
    const prevKills = gameState.monsterKills[monster.type];
    gameState.monsterKills[monster.type] += monstersDefeated;
    const newKills = gameState.monsterKills[monster.type];

    // Achievement check
    Object.entries(achievementTiers).forEach(([kills, tier]) => {
      if (prevKills < kills && newKills >= kills) {
        const achOverlay = document.createElement("div");
        achOverlay.className = "special-ability-overlay achievement";
        achOverlay.innerHTML = `
          <div class="overlay-content-row">
            <canvas class="overlay-sprite overlay-sprite-normal" width="50" height="50"></canvas>
            <div class="overlay-text-container">
              <div class="overlay-title pulse-text" style="color: ${tier.shadowColor.replace("0.3", "1")}">${kills} Kill Achievement!</div>
              <div class="overlay-description">Defeated ${kills} ${monster.type}s!</div>
            </div>
          </div>`;
        overlayQueue.add(achOverlay, 3000);
        showNotification(`🏆 Achievement: ${kills} ${monster.type} kills!`, tier.shadowColor);
        saveGame();
      }
    });

    // Chest reward
    if (monster.chestReward > 0) {
      const crOverlay = document.createElement("div");
      crOverlay.className = "special-ability-overlay chest-reward";
      crOverlay.innerHTML = `
        <div class="overlay-content-row">
          <canvas class="overlay-sprite overlay-sprite-large" width="70" height="70"></canvas>
          <div class="overlay-text-container">
            <div class="overlay-title pulse-text" style="color: ${theme.color}">Powerful Enemy Defeated!</div>
            <div class="overlay-description float-text">${monster.type} dropped ${monster.chestReward} chest${monster.chestReward > 1 ? "s" : ""}!</div>
          </div>
        </div>`;
      overlayQueue.add(crOverlay, 2500);
      setTimeout(() => {
        const mc = crOverlay.querySelector("canvas");
        if (mc && monsterSpriteMapping[monster.type.toLowerCase()] !== undefined) {
          const mctx = mc.getContext("2d");
          mctx.imageSmoothingEnabled = false;
          const idx = monsterSpriteMapping[monster.type.toLowerCase()];
          const { row, col } = getSpritePosition(idx);
          mctx.drawImage(monsterSpriteSheet, col * spriteWidth, row * spriteHeight, spriteWidth, spriteHeight, 0, 0, 70, 70);
        }
      }, 0);
    }

    checkLevelUp();
    updateTopBar();
    displayCollection();
    updateCurrentSwordDisplay(sword);
    updatePityUI();
    updatePrestigeUI();
    updateAchievementsList();
    updateBestiaryList();
  updateDPS();
  if (streakDisplay) {
    if (comboStreak > 0) streakDisplay.textContent = `Streak: ${comboStreak} (best: ${gameState.bestKillStreak})`;
    else streakDisplay.textContent = "No active streak";
  }
  saveGame();

    // Update battle message
    if (specialAbilityTriggered) {
      battleMessage.innerHTML = `⚔️ ${critTag}<span class="${sword.rarity}">${sword.name}</span> unleashed ${sword.specialPower}! Defeated ${monstersDefeated} ${monster.type}s!`;
      battleMessage.style.color = sword.rarity === "legendary" ? "#f59e0b" : "#a855f7";
      showNotification(`✨ ${sword.specialPower} activated! ${monstersDefeated}x rewards!`, sword.rarity === "legendary" ? "#f59e0b" : "#a855f7");
    } else {
      battleMessage.innerHTML = `⚔️ ${critTag}<span class="${sword.rarity}">${sword.name}</span> (${finalDamage.toFixed(1)} DMG) defeated <span style="color: ${theme.color}">${monster.type}</span> (${monsterHp} HP) in ${turnsToKill} turns!`;
    }
  }, turnsToKill * 400);

  if (autoPlay && currentSwordIndex !== null && gameState.activeSwords[sword.index] > 0) {
    const delays = { legendary: 1000, epic: 2000, rare: 3000, common: 4000 };
    const totalDelay = (delays[sword.rarity] || 3000) + turnsToKill * 400;
    setTimeout(() => simulateBattle(sword), totalDelay);
  } else {
    playPauseButton.textContent = "Battle";
    autoPlay = false;
  }
}

// ===================== FLOATING DAMAGE =====================
function showFloatingDamage(damage, isCrit) {
  const monsterDisplay = document.querySelector(".current-monster-display");
  if (!monsterDisplay) return;
  const el = document.createElement("div");
  el.className = `floating-dmg ${isCrit ? "crit" : ""}`;
  el.textContent = isCrit ? `⚡${Math.round(damage)}!` : `-${Math.round(damage)}`;
  el.style.left = "50%";
  el.style.top = "10%";
  el.style.transform = "translateX(-50%)";
  el.style.color = isCrit ? "#ef4444" : "#f97316";
  monsterDisplay.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// ===================== MONSTER HP BAR =====================
function showMonsterHPBar(current, max) {
  const monsterDisplay = document.querySelector(".current-monster-display");
  if (!monsterDisplay) return;
  let bar = monsterDisplay.querySelector(".monster-hp-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "monster-hp-bar";
    monsterDisplay.appendChild(bar);
  }
  let fill = bar.querySelector(".monster-hp-fill") || (() => {
    const f = document.createElement("div");
    f.className = "monster-hp-fill";
    bar.appendChild(f);
    return f;
  })();
  fill.style.width = `${(current / max) * 100}%`;
}

// ===================== UI UPDATES =====================
function updateTopBar() {
  document.querySelector(".monsters-killed").textContent = formatNum(gameState.monstersKilled);
  document.querySelector(".chests").textContent = gameState.chests;
  document.querySelector(".level-text").textContent = `Level ${gameState.level}`;

  const fill = document.querySelector(".progress-fill");
  const nextKills = gameState.level * 10;
  const curKills = (gameState.level - 1) * 10;
  const progress = ((gameState.monstersKilled - curKills) / (nextKills - curKills)) * 100;
  fill.style.width = `${Math.min(progress, 100)}%`;

  updateCollectionCount();
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n;
}

function updateCollectionCount() {
  if (!collectionCount) return;
  let total = 0;
  Object.values(collection).forEach(r => { total += Object.keys(r).length; });
  collectionCount.textContent = `${total}/${swordData.length}`;
}

function updateDPS() {
  if (!dpsDisplay) return;
  if (currentSwordIndex !== null) {
    const sw = swordData.find(s => s.index === currentSwordIndex);
    if (sw && gameState.activeSwords[sw.index]) {
      const dmg = sw.attack * (1 + (gameState.level - 1) * 0.1);
      const delays = { legendary: 1400, epic: 2400, rare: 3400, common: 4400 };
      const delay = (delays[sw.rarity] || 3400) / 1000;
      const dps = dmg / delay;
      dpsDisplay.textContent = `DPS: ${dps.toFixed(1)}`;
      return;
    }
  }
  dpsDisplay.textContent = "DPS: 0";
}

function checkLevelUp() {
  const needed = gameState.level * 10;
  if (gameState.monstersKilled >= needed) levelUp();
}

function levelUp() {
  gameState.level++;

  const overlay = document.createElement("div");
  overlay.className = "special-ability-overlay level-up";
  overlay.innerHTML = `
    <div class="overlay-content-row">
      <div style="font-size:2em;color:#f59e0b;margin-right:12px">🏆</div>
      <div class="overlay-text-container">
        <div class="overlay-title pulse-text" style="color:#f59e0b">Level Up!</div>
        <div class="overlay-description">Advanced to Level ${gameState.level}!</div>
        <div class="overlay-description float-text" style="color:#f59e0b;margin-top:4px">+2 Bonus Chests</div>
      </div>
    </div>`;
  overlayQueue.add(overlay, 3000);

  document.body.style.animation = "shake 0.5s cubic-bezier(.36,.07,.19,.97) both";
  setTimeout(() => { document.body.style.animation = ""; }, 500);

  showNotification(`⬆️ Level ${gameState.level}! +2 bonus chests!`, "#f59e0b");
  gameState.chests += 2;
  updateTopBar();
  updateOpenChestButtonState();
  updatePrestigeUI();
  saveGame();
}

// ===================== SWORD COLLECTION =====================
function displayCollection(filter = "all") {
  const container = document.getElementById("allCollection");
  if (!container) return;

  let swords = swordData;
  if (filter !== "all") swords = swordData.filter(s => s.rarity === filter);

  container.innerHTML = swords.map((sword, i) => {
    const isActive = gameState.activeSwords[sword.index] > 0;
    const isSelected = currentSwordIndex === sword.index;
    return `<div class="sword-item ${sword.rarity} ${isActive ? "" : "locked"} ${isSelected ? "active" : ""}"
              data-index="${sword.index}" style="--i:${i}">
        <canvas width="${scaledW}" height="${scaledH}"></canvas>
        ${isActive ? `<div class="sword-uses-badge">${gameState.activeSwords[sword.index]}</div>` : ""}
      </div>`;
  }).join("");

  container.querySelectorAll(".sword-item").forEach(item => {
    const sw = swordData.find(s => s.index === parseInt(item.dataset.index));
    if (!sw) return;
    const cv = item.querySelector("canvas");
    const ctx = cv.getContext("2d");
    const row = Math.floor(sw.index / spritesPerRow);
    const col = sw.index % spritesPerRow;
    ctx.drawImage(spriteSheet, col * spriteWidth, row * spriteHeight, spriteWidth, spriteHeight, 0, 0, scaledW, scaledH);

    const tooltip = document.getElementById("sword-tooltip");
    item.addEventListener("mouseover", () => {
      if (!tooltip) return;
      tooltip.innerHTML = `
        <div class="rarity-text ${sw.rarity}">${sw.rarity.toUpperCase()}</div>
        <div class="sword-name">${sw.name}</div>
        <canvas width="${scaledW}" height="${scaledH}"></canvas>
        <div class="sword-description">${sw.description}</div>
        <div class="sword-stats">⚔ ${sw.attack}, 🛡 ${sw.defense}${sw.specialPower ? `, ✨ ${sw.specialPower}` : ""}</div>
        ${gameState.activeSwords[sw.index] ? `<div class="uses-left">Uses: ${gameState.activeSwords[sw.index]}</div>` : ""}`;
      const tc = tooltip.querySelector("canvas");
      if (tc) {
        const tctx = tc.getContext("2d");
        const tr = Math.floor(sw.index / spritesPerRow);
        const tc2 = sw.index % spritesPerRow;
        tctx.drawImage(spriteSheet, tc2 * spriteWidth, tr * spriteHeight, spriteWidth, spriteHeight, 0, 0, scaledW, scaledH);
      }
      tooltip.style.display = "block";
    });
    item.addEventListener("mouseout", () => { if (tooltip) tooltip.style.display = "none"; });
    item.addEventListener("click", () => {
      currentSwordIndex = sw.index;
      updateCurrentSwordDisplay(sw);
      updatePlayButtonState();
      displayCollection(document.querySelector(".filter-btn.active")?.dataset?.filter || "all");
      if (autoPlay && gameState.activeSwords[sw.index]) simulateBattle(sw);
    });
  });
}

// ===================== GACHA / PULL =====================
function doGachaPull() {
  if (!isImageLoaded || !swordData.length) {
    resultDiv.innerHTML = `<div class="gacha-result">Loading...</div>`;
    return;
  }
  if (gameState.chests <= 0) {
    resultDiv.innerHTML = `<div class="gacha-result">No chests available!</div>`;
    return;
  }
  gameState.chests--;
  updateOpenChestButtonState();

  // Chest animation
  const chestAnim = document.getElementById("chestAnimation");
  if (chestAnim) {
    chestAnim.style.display = "block";
    chestAnim.className = "chest-animation";
    setTimeout(() => { chestAnim.style.display = "none"; }, 2500);
  }

  let rawRarity = getRandomRarity();
  rawRarity = getPityRarity(rawRarity);
  const sword = getRandomSpriteIndex(rawRarity);
  const rarity = rawRarity;

  applyPity(rarity);
  gameState.totalPulls++;
  updatePityUI();

  // Add to collection
  const useLimit = getSwordUseLimit(rarity);
  if (!collection[rarity][sword.index]) {
    collection[rarity][sword.index] = 1;
    gameState.activeSwords[sword.index] = (gameState.activeSwords[sword.index] || 0) + useLimit;
    updatePlayButtonState();
  } else {
    collection[rarity][sword.index]++;
    gameState.activeSwords[sword.index] = (gameState.activeSwords[sword.index] || 0) + useLimit;
    updatePlayButtonState();
  }

  // Reset combo on pull
  resetCombo();

  // Display result
  const row = Math.floor(sword.index / spritesPerRow);
  const col = sword.index % spritesPerRow;

  resultDiv.innerHTML = `
    <div class="gacha-result ${rarity}">
      <canvas width="${scaledW}" height="${scaledH}"></canvas>
      <div class="rarity-text">${rarity.toUpperCase()}</div>
      <div class="sword-name">${sword.name}</div>
      <div class="sword-description">${sword.description}</div>
      <div class="sword-stats">⚔ ${sword.attack}, 🛡 ${sword.defense}${sword.specialPower ? `, ✨ ${sword.specialPower}` : ""}</div>
      <div class="uses-left">Uses: ${gameState.activeSwords[sword.index]}</div>
    </div>`;

  const cv = resultDiv.querySelector("canvas");
  if (cv) {
    const ctx = cv.getContext("2d");
    ctx.drawImage(spriteSheet, col * spriteWidth, row * spriteHeight, spriteWidth, spriteHeight, 0, 0, scaledW, scaledH);
  }

  displayCollection();
  updateTopBar();
  showNotification(`🗡️ ${rarity.toUpperCase()}: ${sword.name}!`, rarity === "legendary" ? "#f59e0b" : rarity === "epic" ? "#a855f7" : rarity === "rare" ? "#06b6d4" : "#78716c");

  if (rarity === "legendary") applyLegendaryEffect();
  saveGame();
}

function doMultiPull(count) {
  if (gameState.chests < count) {
    showNotification(`Need ${count} chests, have ${gameState.chests}`, "#ef4444");
    return;
  }
  for (let i = 0; i < count; i++) doGachaPull();
}

function applyLegendaryEffect() {
  const overlay = document.createElement("div");
  overlay.className = "legendary-overlay compact-overlay";
  const container = document.querySelector(".overlay-container");
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
}

// ===================== SWORD DISPLAY =====================
function updateCurrentSwordDisplay(sword) {
  const div = document.querySelector(".current-sword");
  if (!div) return;
  if (sword) {
    const row = Math.floor(sword.index / spritesPerRow);
    const col = sword.index % spritesPerRow;
    div.innerHTML = `<canvas width="${scaledW}" height="${scaledH}"></canvas>${gameState.activeSwords[sword.index] ? `<div class="uses-badge" style="position:absolute;bottom:-2px;right:-2px;background:rgba(0,0,0,0.8);padding:1px 4px;font-size:12px;border-radius:3px;color:var(--accent-copper)">${gameState.activeSwords[sword.index]}</div>` : ""}`;
    const cv = div.querySelector("canvas");
    if (cv) {
      const ctx = cv.getContext("2d");
      ctx.drawImage(spriteSheet, col * spriteWidth, row * spriteHeight, spriteWidth, spriteHeight, 0, 0, scaledW, scaledH);
    }
    div.className = `arena-slot current-sword`;
  } else {
    div.innerHTML = '<div class="slot-label">Blade</div>';
    div.className = "arena-slot current-sword";
  }
}

function updateCurrentMonsterDisplay(monster) {
  const div = document.querySelector(".current-monster-display");
  if (!div) return;
  div.innerHTML = '<div class="slot-label">Foe</div>';
  div.className = "arena-slot current-monster-display";
  if (!monster) return;

  const cv = document.createElement("canvas");
  cv.width = scaledW; cv.height = scaledH;
  const ctx = cv.getContext("2d");
  div.prepend(cv);

  const idx = monsterSpriteMapping[monster.type.toLowerCase()];
  if (idx !== undefined) {
    const { row, col } = getSpritePosition(idx);
    ctx.drawImage(monsterSpriteSheet, col * spriteWidth, row * spriteHeight, spriteWidth, spriteHeight, 0, 0, scaledW, scaledH);
  }

  div.classList.add(`difficulty-${monster.difficulty}`);
  if (gameState.monsterKills[monster.type] > 0) div.classList.add("defeated");
}

// ===================== BUTTON STATE =====================
function updatePlayButtonState() {
  const canBattle = currentSwordIndex !== null && gameState.activeSwords[currentSwordIndex] > 0;
  playPauseButton.disabled = !canBattle;
  if (!canBattle) {
    autoPlay = false;
    playPauseButton.textContent = "Battle";
  }
}

function updateOpenChestButtonState() {
  pullButton.disabled = gameState.chests <= 0;
  pulMulti5.disabled = gameState.chests < 5;
  pulMulti10.disabled = gameState.chests < 10;
  forgeButton.disabled = getForgeableSwords().length === 0;
}

// ===================== ACHIEVEMENTS LIST =====================
function updateAchievementsList() {
  if (!achievementsList) return;
  const monsters = Object.keys(gameState.monsterKills);
  if (monsters.length === 0) {
    achievementsList.innerHTML = '<div style="color:#666;padding:8px;font-size:12px">Battle monsters to unlock achievements</div>';
    return;
  }

  achievementsList.innerHTML = "";
  monsters.forEach(type => {
    const kills = gameState.monsterKills[type];
    const tiers = Object.keys(achievementTiers).map(Number).sort((a, b) => a - b);
    tiers.forEach(tier => {
      const data = achievementTiers[tier];
      const complete = kills >= tier;
      const progress = Math.min((kills / tier) * 100, 100);
      const card = document.createElement("div");
      card.className = "achievement-card";
      card.innerHTML = `
        <div class="ach-icon">${complete ? "🏆" : "🔒"}</div>
        <div class="ach-info">
          <div class="ach-name" style="color:${complete ? "#f59e0b" : "#777"}">${tier} ${type} kills</div>
          <div class="ach-progress">${kills}/${tier} (${Math.round(progress)}%)</div>
        </div>
        <div class="ach-status ${complete ? "complete" : "pending"}">${complete ? "✓" : `${tier - kills} left`}</div>`;
      achievementsList.appendChild(card);
    });
  });
}

// ===================== BESTIARY LIST =====================
function updateBestiaryList() {
  if (!bestiaryList) return;
  bestiaryList.innerHTML = "";
  const sorted = [...monsterTypes].sort((a, b) => {
    const ka = gameState.monsterKills[a.type] || 0;
    const kb = gameState.monsterKills[b.type] || 0;
    return kb - ka;
  });
  sorted.slice(0, 30).forEach(mon => {
    const kills = gameState.monsterKills[mon.type] || 0;
    const entry = document.createElement("div");
    entry.className = "bestiary-mini";
    const cv = document.createElement("canvas");
    cv.width = scaledW; cv.height = scaledH;
    const ctx = cv.getContext("2d");
    const idx = monsterSpriteMapping[mon.type.toLowerCase()];
    if (idx !== undefined) {
      const { row, col } = getSpritePosition(idx);
      ctx.drawImage(monsterSpriteSheet, col * spriteWidth, row * spriteHeight, spriteWidth, spriteHeight, 0, 0, scaledW, scaledH);
    }
    entry.appendChild(cv);
    entry.innerHTML += `<span class="bm-name">${mon.type}</span>`;
    entry.innerHTML += `<span class="bm-kills">💀 ${kills}</span>`;
    bestiaryList.appendChild(entry);
  });
}

// ===================== EVENT BINDING =====================

// Filter buttons
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    displayCollection(btn.dataset.filter);
  });
});

// Play/Pause
playPauseButton.addEventListener("click", () => {
  if (currentSwordIndex === null || !gameState.activeSwords[currentSwordIndex]) {
    playPauseButton.textContent = "Battle";
    return;
  }
  if (overlayQueue.isDisplaying && overlayQueue.queue.length > 0) return;
  autoPlay = !autoPlay;
  playPauseButton.textContent = autoPlay ? "Stop" : "Battle";
  if (autoPlay) {
    const sw = swordData.find(s => s.index === currentSwordIndex);
    if (sw && gameState.activeSwords[sw.index]) simulateBattle(sw);
  }
});

// Menu toggle
menuButton.addEventListener("click", () => {
  document.querySelector(".sidebar-left").classList.toggle("open");
});

// Pull
pullButton.addEventListener("click", doGachaPull);

// Multi-pull
pulMulti5.addEventListener("click", () => doMultiPull(5));
pulMulti10.addEventListener("click", () => doMultiPull(10));

// Forge
forgeButton.addEventListener("click", openForgeModal);

// Bestiary
bestiaryButton.addEventListener("click", openBestiaryModal);

// Prestige
prestigeButton.addEventListener("click", doPrestige);

// Tab switching
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    const tab = document.getElementById(`tab${btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)}`);
    if (tab) tab.classList.add("active");
  });
});

// ===================== INIT =====================
spriteSheet.onload = () => { isImageLoaded = true; };
spriteSheet.src = "assets/sprite_swords.png";

initializeCollection();

// Load save
const loaded = loadGame();
if (loaded) {
  updateTopBar();
  updatePlayButtonState();
  updateOpenChestButtonState();
  updatePityUI();
  updateComboUI();
  updatePrestigeUI();
  updateAchievementsList();
  updateBestiaryList();
  updateDPS();
}

// Fetch data
fetch("swords.json")
  .then(r => r.json())
  .then(data => {
    swordData = data;
    displayCollection();
    updateCollectionCount();
    if (!loaded) updateTopBar();
  })
  .catch(e => console.error("Error loading swords:", e));

fetch("monsters.json")
  .then(r => r.json())
  .then(data => {
    monsterTypes = data;
    updateBestiaryList();
  })
  .catch(e => console.error("Error loading monsters:", e));

// Ember particles
(function spawnEmbers() {
  const container = document.getElementById("emberContainer");
  if (!container || window.innerWidth < 480) return;
  for (let i = 0; i < 12; i++) {
    const el = document.createElement("div");
    el.className = "ember-particle";
    el.style.left = `${Math.random() * 100}%`;
    el.style.animationDuration = `${4 + Math.random() * 6}s`;
    el.style.animationDelay = `${Math.random() * 8}s`;
    el.style.width = `${1.5 + Math.random() * 2.5}px`;
    el.style.height = el.style.width;
    el.style.opacity = `${0.2 + Math.random() * 0.4}`;
    container.appendChild(el);
  }
})();

updatePityUI();
updatePrestigeUI();
updateOpenChestButtonState();
updatePlayButtonState();
