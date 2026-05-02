window.Game = window.Game || {};
Game.VERSION = typeof APP_VERSION !== "undefined" ? APP_VERSION : "dev";

const G = Game;

// ===================== CONSTANTS =====================
G.spriteSheet = new Image();
G.spriteSheet.onload = () => {
  G.isImageLoaded = true;
};
G.spriteWidth = 32;
G.spriteHeight = 32;
G.scale = 2;
G.scaledW = G.spriteWidth * G.scale;
G.scaledH = G.spriteHeight * G.scale;
G.spritesPerRow = 6;

G.monsterSpriteSheet = new Image();
G.monsterSpriteSheet.onload = () => {
  G.isMonsterImageLoaded = true;
  if (G.monsterTypes.length) {
    G.updateBestiaryList();
    G.renderBestiaryGrid && G.renderBestiaryGrid();
  }
};
G.monsterSpriteSheet.src = "assets/monsters.png";
G.spriteSheet.src = "assets/sprite_swords.png";
G.spritesPerRowCounts = [8, 3, 4, 2, 6, 5, 12, 10, 5, 2, 2, 2, 3];

G.getSpritePosition = function (spriteIndex) {
  let start = 0;
  for (let i = 0; i < G.spritesPerRowCounts.length; i++) {
    if (spriteIndex < start + G.spritesPerRowCounts[i])
      return { row: i, col: spriteIndex - start };
    start += G.spritesPerRowCounts[i];
  }
  return { row: 0, col: 0 };
};

G.monsterSpriteMapping = {
  "death knight": 20,
  reaper: 24,
  manticore: 32,
  lycanthrope: 34,
  wendigo: 42,
  "rock golem": 43,
  naga: 45,
  minotaur: 48,
  "gorgon/medusa": 50,
  "drake / lesser dragon": 52,
  dragon: 53,
  basilisk: 55,
  "angel / archangel": 60,
  goblin: 0,
  "goblin archer": 0,
  "goblin mage": 0,
  "goblin brute": 0,
  orc: 1,
  "orc wizard": 1,
  "orc blademaster": 1,
  "orc warchief": 1,
  troll: 2,
  skeleton: 3,
  "skeleton archer": 3,
  zombie: 4,
  ghoul: 4,
  slime: 5,
  "small slime": 5,
  "big slime": 5,
  slimebody: 5,
  "merged slimebodies": 5,
  ettin: 6,
  "two headed ettin": 6,
  lich: 7,
  "imp / devil": 21,
};

G.achievementTiers = {
  10: { spriteOffset: 0, shadowColor: "rgba(0, 0, 0, 0.3)" },
  50: { spriteOffset: 1, shadowColor: "rgba(0, 0, 255, 0.3)" },
  100: { spriteOffset: 2, shadowColor: "rgba(0, 255, 0, 0.3)" },
  250: { spriteOffset: 3, shadowColor: "rgba(255, 0, 0, 0.3)" },
  500: { spriteOffset: 4, shadowColor: "rgba(255, 255, 0, 0.3)" },
  1000: { spriteOffset: 5, shadowColor: "rgba(0, 255, 255, 0.3)" },
  2500: { spriteOffset: 6, shadowColor: "rgba(255, 0, 255, 0.3)" },
  5000: { spriteOffset: 7, shadowColor: "rgba(255, 255, 255, 0.3)" },
  10000: { spriteOffset: 8, shadowColor: "rgba(128, 128, 128, 0.3)" },
};

G.difficultyThemes = {
  1: { color: "#ffffff", shadow: "#666666", glow: "#666666" },
  2: { color: "#2ecc71", shadow: "#006600", glow: "#2ecc71" },
  3: { color: "#00ffff", shadow: "#006666", glow: "#00ffff" },
  4: { color: "#ff00ff", shadow: "#660066", glow: "#ff00ff" },
  5: { color: "#ffd700", shadow: "#664400", glow: "#ffd700" },
};

G.PITY_EPIC_CAP = 50;
G.PITY_LEGENDARY_CAP = 200;
G.SAVE_KEY = "idle_blade_master_save";

// ===================== STATE =====================
G.gameState = {
  monstersKilled: 0,
  chests: 5,
  level: 1,
  currentBattle: null,
  activeSwords: {},
  monsterKills: {},
  totalPulls: 0,
  pullsSinceEpic: 0,
  pullsSinceLegendary: 0,
  totalLegendaryPulls: 0,
  prestigeCount: 0,
  prestigeBonus: 0,
  bestKillStreak: 0,
  totalDamageDealt: 0,
  settings: { autoForge: false },
};

G.collection = { common: {}, rare: {}, epic: {}, legendary: {} };
G.swordData = [];
G.monsterTypes = [];
G.isImageLoaded = false;
G.isMonsterImageLoaded = false;
G.currentSwordIndex = null;
G.autoPlay = false;
G.comboStreak = 0;
G.forgeSlots = [];

// ===================== DOM REFS =====================
G.els = {};
function el(id) {
  return document.getElementById(id);
}

G.els.pullButton = el("pullButton");
G.els.resultDiv = el("result");
G.els.menuButton = el("menuButton");
G.els.playPauseButton = el("playPauseButton");
G.els.notificationsDiv = el("notifications");
G.els.forgeButton = el("forgeButton");
G.els.bestiaryButton = el("bestiaryButton");
G.els.prestigeButton = el("prestigeButton");
G.els.saveButton = el("saveButton");
G.els.resetButton = el("resetButton");
G.els.pityFill = el("pityFill");
G.els.pityText = el("pityText");
G.els.comboDisplay = el("comboDisplay");
G.els.comboCount = el("comboCount");
G.els.comboBonus = el("comboBonus");
G.els.collectionCount = el("collectionCount");
G.els.streakDisplay = el("streakDisplay");
G.els.pullsDisplay = el("pullsDisplay");
G.els.dpsDisplay = el("dpsDisplay");
G.els.prestigeBlock = el("prestigeBlock");
G.els.prestigeCount = el("prestigeCount");
G.els.achievementsList = el("achievementsList");
G.els.bestiaryList = el("bestiaryList");
G.els.chestAnim = el("chestAnimation");
G.els.allCollection = el("allCollection");
G.els.emberContainer = el("emberContainer");
G.els.overlayContainer = document.querySelector(".overlay-container");
G.els.currentMonsterDisplay = document.querySelector(
  ".current-monster-display",
);
G.els.currentSword = document.querySelector(".current-sword");

// ===================== UTILITY FUNCTIONS =====================
G.formatNum = function (n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n;
};

G.showNotification = function (message, color) {
  const n = document.createElement("div");
  n.className = "notification";
  n.innerHTML = message;
  if (color) n.style.borderLeftColor = color;
  G.els.notificationsDiv.prepend(n);
  G.checkNotificationsLimit();
};

G.checkNotificationsLimit = function () {
  while (G.els.notificationsDiv.children.length > 15) {
    G.els.notificationsDiv.removeChild(G.els.notificationsDiv.lastChild);
  }
};

G.getRandomRarity = function () {
  const legendaryRate = 0.05 + G.gameState.prestigeCount * 0.005;
  const rand = Math.random();
  if (rand < legendaryRate) return "legendary";
  if (rand < legendaryRate + 0.15) return "epic";
  if (rand < legendaryRate + 0.15 + 0.25) return "rare";
  return "common";
};

G.getRandomSpriteIndex = function (rarity) {
  const filtered = G.swordData.filter((s) => s.rarity === rarity);
  return filtered[Math.floor(Math.random() * filtered.length)];
};

G.getSwordUseLimit = function (rarity) {
  switch (rarity) {
    case "legendary":
      return 48;
    case "epic":
      return 24;
    case "rare":
      return 12;
    default:
      return 4;
  }
};

G.initializeCollection = function () {
  G.collection = { common: {}, rare: {}, epic: {}, legendary: {} };
};

G.getPityRarity = function (raw) {
  if (G.gameState.pullsSinceLegendary >= G.PITY_LEGENDARY_CAP)
    return "legendary";
  if (G.gameState.pullsSinceEpic >= G.PITY_EPIC_CAP) return "epic";
  return raw;
};

G.applyPity = function (rarity) {
  G.gameState.pullsSinceEpic++;
  G.gameState.pullsSinceLegendary++;
  if (rarity === "epic") G.gameState.pullsSinceEpic = 0;
  if (rarity === "legendary") {
    G.gameState.pullsSinceLegendary = 0;
    G.gameState.pullsSinceEpic = 0;
    G.gameState.totalLegendaryPulls++;
  }
};

G.rollCrit = function () {
  const chance = 0.05 + (G.gameState.level - 1) * 0.01;
  return Math.random() < Math.min(chance, 0.5);
};

G.getComboBonus = function () {
  return Math.min(G.comboStreak * 0.05, 0.5);
};

G.applyComboDamage = function (baseDamage) {
  return baseDamage * (1 + G.getComboBonus());
};

G.getNextRarity = function (rarity) {
  const map = {
    common: "rare",
    rare: "epic",
    epic: "legendary",
    legendary: "legendary",
  };
  return map[rarity];
};

G.getForgeRequirement = function (rarity) {
  switch (rarity) {
    case "common":
      return 5;
    case "rare":
      return 10;
    case "epic":
      return 25;
    default:
      return 999;
  }
};

G.getForgeableSwords = function () {
  const result = [];
  for (const rarity of ["common", "rare", "epic"]) {
    const req = G.getForgeRequirement(rarity);
    for (const [idx, count] of Object.entries(G.collection[rarity] || {})) {
      if (count >= req) {
        const sw = G.swordData.find((s) => s.index === parseInt(idx));
        if (sw) result.push(sw);
      }
    }
  }
  return result;
};

G.canPrestige = function () {
  return G.gameState.level >= 50;
};

// ===================== SAVE/LOAD =====================
G.saveGame = function () {
  try {
    const data = {
      version: G.VERSION,
      gameState: G.gameState,
      collection: G.collection,
      currentSwordIndex: G.currentSwordIndex,
      comboStreak: G.comboStreak,
    };
    localStorage.setItem(G.SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Save failed:", e);
  }
};

G.loadGame = function () {
  try {
    const raw = localStorage.getItem(G.SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    Object.assign(G.gameState, data.gameState);
    G.collection = data.collection || {
      common: {},
      rare: {},
      epic: {},
      legendary: {},
    };
    G.currentSwordIndex = data.currentSwordIndex ?? null;
    G.comboStreak = data.comboStreak || 0;
    return true;
  } catch (e) {
    console.warn("Load failed:", e);
    return false;
  }
};
