window.Game = window.Game || {};
Game.VERSION = typeof APP_VERSION !== "undefined" ? APP_VERSION : "dev";

const G = Game;

// ===================== SPRITES =====================
G.spriteSheet = new Image();
G.spriteSheet.onload = () => {
  G.isImageLoaded = true;
  if (G.ui) {
    G.ui.updateBlade();
    G.ui.renderCollection();
  }
};
G.spriteWidth = 32;
G.spriteHeight = 32;
G.scale = 2;
G.scaledW = G.spriteWidth * G.scale;
G.scaledH = G.spriteHeight * G.scale;
G.spritesPerRow = 6;
G.spritesPerRowCounts = [8, 3, 4, 2, 6, 5, 12, 10, 5, 2, 2, 2, 3];

G.monsterSpriteSheet = new Image();
G.monsterSpriteSheet.onload = () => {
  G.isMonsterImageLoaded = true;
  if (G.monsterTypes.length) {
    G.ui && G.ui.updateBestiary();
  }
};
G.monsterSpriteSheet.src = "assets/monsters.png";
G.spriteSheet.src = "assets/sprite_swords.png";

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

// ===================== CONSTANTS =====================
G.PITY_EPIC_CAP = 50;
G.PITY_LEGENDARY_CAP = 200;
G.SAVE_KEY = "idle_blade_master_v3";
G.OLD_SAVE_KEY = "idle_blade_master_save";

G.ELEMENTS = {
  fire: { label: "Fire", ico: "🔥", color: "#ff5a36", counter: ["brute", "nature"] },
  ice: { label: "Ice", ico: "❄", color: "#52d8ff", counter: ["dragon"] },
  lightning: { label: "Storm", ico: "⚡", color: "#ffe14a", counter: ["undead"] },
  holy: { label: "Holy", ico: "✨", color: "#ffd76a", counter: ["demon"] },
  void: { label: "Void", ico: "🌑", color: "#b56bff", counter: ["holy"] },
  poison: { label: "Venom", ico: "☠", color: "#6bff8a", counter: ["beast", "nature"] },
  steel: { label: "Steel", ico: "🛡", color: "#aab4c4", counter: [] },
};

G.MONSTER_CATEGORY = {
  undead: /skeleton|zombie|ghoul|lich|reaper|wraith|banshee|death knight/,
  beast: /wendigo|lycanthrope|warg|wolf|spider|rat|centipede|satyr|centaur|harpy|bat|manticore|monk/,
  dragon: /dragon|drake|basilisk|cockatrice/,
  demon: /imp|devil|cultist|hag|witch|cardinal|mass|humanoid/,
  holy: /angel|archangel/,
  brute: /orc|goblin|troll|ettin|golem|kobold|ant/,
  nature: /slime|myconid|dryad|forest|vine|naga|lampreymander|earthworm|worm/,
};

G.SOUL_BASE = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 14 };

G.CHEST_SHARD_START = 60;
G.CHEST_SHARD_GROWTH = 1.35;
G.ENCHANT_START = 150;
G.ENCHANT_GROWTH = 1.65;
G.ENCHANT_MAX = 20;
G.ENCHANT_DMG = 0.05;

// ===================== STATE =====================
G.gameState = {
  v: 3,
  kills: 0,
  souls: 0,
  chests: 5,
  level: 1,
  levelProgress: 0,
  activeSwords: {},
  collection: { common: {}, rare: {}, epic: {}, legendary: {} },
  monsterKills: {},
  pity: { epic: 0, legendary: 0 },
  totalPulls: 0,
  totalLegendary: 0,
  prestige: { count: 0, bonus: 0 },
  bestStreak: 0,
  totalDmg: 0,
  enchant: 0,
  quests: null,
  lastSeen: Date.now(),
  startedAt: Date.now(),
};

G.collection = G.gameState.collection;
G.swordData = window.SWORDS_DATA || [];
G.monsterTypes = window.MONSTERS_DATA || [];
G.isImageLoaded = false;
G.isMonsterImageLoaded = false;
G.currentSwordIndex = null;
G.comboStreak = 0;
G.autoPlay = false;
G.speed = 1;
G.ui = null;

// ===================== DOM REFS =====================
G.els = {};
function el(id) { return document.getElementById(id); }
[
  "chestCount", "soulCount", "levelText", "levelProgText", "levelFill",
  "pityText", "pityFill", "killsStat", "streakStat", "dpsStat",
  "prestigeStatWrap", "prestigeStat", "foeSlot", "foeHpBar", "foeHpFill",
  "foeHpText", "bladeSlot", "bladeName", "bladeUses", "pullButton",
  "pullButtonLabel", "pullCost", "pullButtonX3", "playPauseButton",
  "feedLine", "feedSkip", "chestChip", "soulChip", "menuButton",
  "collection", "collectionCount", "bestiaryButton", "questList",
  "questBadge", "featsList", "bestiaryGrid", "bestiaryCount",
  "forgeSelectionGrid", "forgeActionArea", "forgeSelectedSlot",
  "forgeCostText", "forgeExecute", "forgeClose", "previewName",
  "previewSprite", "previewRarity", "previewDesc", "previewAtk",
  "previewDef", "previewElement", "previewPower", "previewUses",
  "previewSelectBtn", "previewClose",
  "forgeModal", "previewModal", "offlineModal", "offlineTime",
  "offlineRewards", "offlineClaim", "offlineClose", "toastLayer",
  "bannerLayer", "burstLayer", "shakeLayer", "emberField", "boot", "app",
  "drawerScrim", "sheetScrim", "menuSheet", "menuPulls", "menuLegendary",
  "menuDamage", "menuStreak", "menuPrestige", "enchantLevel",
  "enchantCost", "enchantButton", "saveButton", "prestigeButton",
  "resetButton", "hud", "stage", "tabbar", "menuSheetClose",
  "forgeShortcut",
].forEach((id) => { G.els[id] = el(id); });

G.els.arena = el("arena");
G.els.speedGroup = el("speedGroup");

// ===================== FX HELPERS =====================
G.toast = function (message, color) {
  if (G.fx) return G.fx.toast(message, color);
  return null;
};

G.showBanner = function (icon, title, sub, color) {
  if (G.fx) return G.fx.banner(icon, title, sub, color);
  return null;
};

// ===================== UTILITIES =====================
G.formatNum = function (n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.floor(n);
};

G.rand = (min, max) => Math.random() * (max - min) + min;
G.randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
G.clamp = (v, a, b) => Math.min(Math.max(v, a), b);

// ===================== SPRITES =====================
G.getSpritePosition = function (spriteIndex) {
  let start = 0;
  for (let i = 0; i < G.spritesPerRowCounts.length; i++) {
    if (spriteIndex < start + G.spritesPerRowCounts[i]) return { row: i, col: spriteIndex - start };
    start += G.spritesPerRowCounts[i];
  }
  return { row: 0, col: 0 };
};

G.drawSprite = function (ctx, sheet, spriteIndex, size) {
  const swordSheet = sheet === G.spriteSheet;
  const { row, col } = swordSheet
    ? { row: Math.floor(spriteIndex / 6), col: spriteIndex % 6 }
    : G.getSpritePosition(spriteIndex);
  const canvas = ctx.canvas;
  const cols = swordSheet ? 6 : 12;
  const rows = swordSheet ? 5 : G.spritesPerRowCounts.length;

  // CSS backgrounds avoid Brave's file:// canvas tainting while preserving pixel crops.
  canvas.style.imageRendering = "pixelated";
  canvas.style.backgroundImage = `url("${sheet.currentSrc || sheet.src}")`;
  canvas.style.backgroundRepeat = "no-repeat";
  canvas.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
  canvas.style.backgroundPosition = `${cols > 1 ? (col / (cols - 1)) * 100 : 0}% ${rows > 1 ? (row / (rows - 1)) * 100 : 0}%`;
};

G.drawSword = function (canvas, swordIndex, size) {
  const cv = typeof canvas === "string" ? el(canvas) : canvas;
  cv.width = size;
  cv.height = size;
  G.drawSprite(cv.getContext("2d"), G.spriteSheet, swordIndex, size);
};

G.drawMonster = function (canvas, monsterType, size) {
  const cv = typeof canvas === "string" ? el(canvas) : canvas;
  cv.width = size;
  cv.height = size;
  const idx = G.monsterSpriteMapping[monsterType.toLowerCase()];
  if (idx !== undefined && G.isMonsterImageLoaded) {
    G.drawSprite(cv.getContext("2d"), G.monsterSpriteSheet, idx, size);
  }
};

// ===================== ELEMENT SYSTEM =====================
G.getMonsterCategory = function (type) {
  const t = type.toLowerCase();
  for (const [cat, re] of Object.entries(G.MONSTER_CATEGORY)) {
    if (re.test(t)) return cat;
  }
  return "brute";
};

G.getMonsterElementLabel = function (monster) {
  const cat = G.getMonsterCategory(monster.type);
  const find = Object.values(G.ELEMENTS).find((e) => e.counter.includes(cat));
  return find ? find.label : null;
};

G.isCountered = function (sword, monster) {
  if (!sword || !sword.element) return false;
  const e = G.ELEMENTS[sword.element];
  if (!e) return false;
  return e.counter.includes(G.getMonsterCategory(monster.type));
};

// ===================== PROGRESSION =====================
G.getLevelKillsNeeded = function (level) {
  return level * 10;
};

G.getEnchantBonus = function () {
  return G.gameState.enchant * G.ENCHANT_DMG;
};

G.getBestiaryBonus = function () {
  const done = G.monsterTypes.filter(
    (m) => (G.gameState.monsterKills[m.type] || 0) >= 50,
  ).length;
  return Math.min(done * 0.01, 0.25);
};

G.getTotalDamageMult = function () {
  return 1 + G.getEnchantBonus() + G.getBestiaryBonus();
};

G.addKills = function (n, monster) {
  G.gameState.kills += n;
  G.gameState.levelProgress += n;
  while (G.gameState.levelProgress >= G.getLevelKillsNeeded(G.gameState.level)) {
    G.gameState.levelProgress -= G.getLevelKillsNeeded(G.gameState.level);
    G.gameState.level++;
    G.gameState.chests += 2;
    G.showBanner("Level Up!", `Level ${G.gameState.level} — +2 chests`);
    G.toast("⬆️ Level " + G.gameState.level + "! +2 chests", "#ffb347");
    G.fx && G.fx.burst(G.els.arena, "gold", 22);
  }
  if (monster) {
    G.gameState.monsterKills[monster.type] =
      (G.gameState.monsterKills[monster.type] || 0) + n;
  }
};

G.addSouls = function (n) {
  G.gameState.souls += n;
  if (G.ui) G.ui.updateHud();
};

G.addChests = function (n, fx) {
  G.gameState.chests += n;
  if (G.ui) G.ui.updateHud();
  if (fx && G.fx) {
    G.fx.floatText(G.els.chestChip, `+${n} ◆`, "#ffd76a");
    G.fx.pop(G.els.chestChip);
  }
};

// ===================== RARITY =====================
G.rarityColors = {
  common: "#8a8f98",
  rare: "#35c2ff",
  epic: "#c45bff",
  legendary: "#ffb020",
};

G.rarityOrder = ["common", "rare", "epic", "legendary"];

G.getRandomRarity = function () {
  const legendaryRate = 0.05 + G.gameState.prestige.bonus;
  const rand = Math.random();
  if (rand < legendaryRate) return "legendary";
  if (rand < legendaryRate + 0.15) return "epic";
  if (rand < legendaryRate + 0.15 + 0.25) return "rare";
  return "common";
};

G.getRandomSword = function (rarity) {
  const pool = G.swordData.filter((s) => s.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
};

G.getSwordUseLimit = function (rarity) {
  return { legendary: 48, epic: 24, rare: 12, common: 4 }[rarity] || 4;
};

G.applyPity = function (rarity) {
  G.gameState.pity.epic++;
  G.gameState.pity.legendary++;
  if (rarity === "epic") G.gameState.pity.epic = 0;
  if (rarity === "legendary") {
    G.gameState.pity.legendary = 0;
    G.gameState.pity.epic = 0;
    G.gameState.totalLegendary++;
  }
};

G.getPityRarity = function (raw) {
  if (G.gameState.pity.legendary >= G.PITY_LEGENDARY_CAP) return "legendary";
  if (G.gameState.pity.epic >= G.PITY_EPIC_CAP) return "epic";
  return raw;
};

G.getNextRarity = function (rarity) {
  return { common: "rare", rare: "epic", epic: "legendary", legendary: "legendary" }[rarity];
};

G.getForgeRequirement = function (rarity) {
  return { common: 5, rare: 10, epic: 25, legendary: 999 }[rarity] || 999;
};

G.getForgeableSwords = function () {
  const result = [];
  for (const rarity of ["common", "rare", "epic"]) {
    const req = G.getForgeRequirement(rarity);
    for (const [idx, count] of Object.entries(G.gameState.collection[rarity] || {})) {
      if (count >= req) {
        const sw = G.swordData.find((s) => s.index === parseInt(idx));
        if (sw) result.push(sw);
      }
    }
  }
  return result;
};

G.canPrestige = () => G.gameState.level >= 50;

// ===================== SOUL SHOP =====================
G.getShardCost = function () {
  const bought = G.gameState.shardPacks || 0;
  return Math.floor(G.CHEST_SHARD_START * Math.pow(G.CHEST_SHARD_GROWTH, bought));
};

G.getEnchantCost = function () {
  const lvl = G.gameState.enchant;
  return Math.floor(G.ENCHANT_START * Math.pow(G.ENCHANT_GROWTH, lvl));
};

// ===================== SAVE / LOAD =====================
G.saveGame = function () {
  try {
    G.gameState.lastSeen = Date.now();
    const data = {
      version: G.VERSION,
      gameState: G.gameState,
      currentSwordIndex: G.currentSwordIndex,
    };
    localStorage.setItem(G.SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Save failed:", e);
  }
};

G.migrateLegacy = function () {
  try {
    const raw = localStorage.getItem(G.OLD_SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    const s = data.gameState;
    if (!s) return false;
    G.gameState.kills = s.monstersKilled || 0;
    G.gameState.chests = s.chests || 5;
    G.gameState.level = s.level || 1;
    G.gameState.levelProgress = 0;
    G.gameState.activeSwords = s.activeSwords || {};
    G.gameState.monsterKills = s.monsterKills || {};
    G.gameState.collection = data.collection || {
      common: {}, rare: {}, epic: {}, legendary: {},
    };
    G.collection = G.gameState.collection;
    G.gameState.pity = {
      epic: s.pullsSinceEpic || 0,
      legendary: s.pullsSinceLegendary || 0,
    };
    G.gameState.totalPulls = s.totalPulls || 0;
    G.gameState.totalLegendary = s.totalLegendaryPulls || 0;
    G.gameState.prestige = {
      count: s.prestigeCount || 0,
      bonus: s.prestigeBonus || 0,
    };
    G.gameState.bestStreak = s.bestKillStreak || 0;
    G.gameState.totalDmg = s.totalDamageDealt || 0;
    G.currentSwordIndex = data.currentSwordIndex ?? null;
    G.comboStreak = 0;
    localStorage.removeItem(G.OLD_SAVE_KEY);
    G.toast("Legacy save migrated", "#35c2ff");
    return true;
  } catch (e) {
    console.warn("Migration failed:", e);
    return false;
  }
};

G.loadGame = function () {
  try {
    const raw = localStorage.getItem(G.SAVE_KEY);
    if (!raw) {
      return G.migrateLegacy();
    }
    const data = JSON.parse(raw);
    Object.assign(G.gameState, data.gameState);
    G.gameState.prestige = Object.assign(
      { count: 0, bonus: 0 }, data.gameState.prestige || {},
    );
    G.gameState.pity = Object.assign(
      { epic: 0, legendary: 0 }, data.gameState.pity || {},
    );
    G.gameState.collection = data.gameState.collection || {
      common: {}, rare: {}, epic: {}, legendary: {},
    };
    G.collection = G.gameState.collection;
    G.currentSwordIndex = data.currentSwordIndex ?? null;
    return true;
  } catch (e) {
    console.warn("Load failed:", e);
    return false;
  }
};
