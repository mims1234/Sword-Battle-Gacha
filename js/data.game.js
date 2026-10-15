// ===================== GAME DATA (v4) =====================
window.G = window.G || {};
(function () {
  const G = window.G;

  G.WAVES = 10;

  G.EL = {
    fire: { label: "Fire", color: "#ff6a3c", counter: ["brute", "nature"], trait: "Strikes set foes burning" },
    ice: { label: "Ice", color: "#62dcff", counter: ["dragon"], trait: "Strikes can freeze foes" },
    lightning: { label: "Storm", color: "#ffe14a", counter: ["undead"], trait: "Strikes chain to a second foe" },
    holy: { label: "Holy", color: "#ffe9a8", counter: ["demon"], trait: "Kills mend the most wounded blade" },
    void: { label: "Void", color: "#b56bff", counter: ["holy"], trait: "Executes foes below 12% health" },
    poison: { label: "Venom", color: "#7dff8f", counter: ["beast", "nature"], trait: "+15% damage for the whole team" },
    steel: { label: "Steel", color: "#c3ccd9", counter: [], trait: "+30% health for the whole team" },
  };

  G.TIER = {
    common: { label: "Common", color: "#9aa0a8", rank: 0, affix: 1, scale: 0.5, salvage: 1 },
    rare: { label: "Rare", color: "#55c6f8", rank: 1, affix: 1, scale: 0.65, salvage: 3 },
    epic: { label: "Epic", color: "#b872ff", rank: 2, affix: 2, scale: 0.8, salvage: 10 },
    legendary: { label: "Legendary", color: "#ffab2e", rank: 3, affix: 3, scale: 0.95, salvage: 40 },
    mythic: { label: "Mythic", color: "#ff4558", rank: 4, affix: 4, scale: 1.1, salvage: 150 },
  };
  G.TIERS = ["common", "rare", "epic", "legendary", "mythic"];
  G.RATES = { common: 0.6, rare: 0.28, epic: 0.09, legendary: 0.027, mythic: 0.003 };
  G.PITY_SOFT = 45;
  G.PITY_HARD = 60;

  // Monster sprite index == index in MONSTERS_DATA. Family per index (drives element counters).
  const fam = {};
  const set = (cat, list) => list.forEach((i) => (fam[i] = cat));
  set("brute", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 32, 35, 42]);
  set("nature", [11, 12, 13, 14, 29, 30, 40, 44, 57, 58]);
  set("undead", [17, 18, 19, 20, 21, 22, 23, 24, 25]);
  set("beast", [28, 31, 33, 34, 36, 37, 38, 39, 41, 43, 46, 47, 48]);
  set("demon", [26, 27, 49, 60, 61, 62, 63]);
  set("dragon", [50, 51, 52, 53, 54, 55, 56]);
  set("holy", [15, 16, 45, 59]);
  G.FAM = fam;
  G.FAMLABEL = { brute: "Brutes", nature: "Wildlings", undead: "Undead", beast: "Beasts", demon: "Fiends", dragon: "Wyrmkin", holy: "Fallen" };

  G.BIOMES = [
    { id: "brute", name: "Goblin Warrens", boss: 9, sky: ["#0e0a08", "#261a10", "#0a0705"], torch: "#ff8a2a", weather: "embers" },
    { id: "undead", name: "The Ossuary", boss: 20, sky: ["#07090c", "#141c22", "#050607"], torch: "#7ad0ff", weather: "ash" },
    { id: "beast", name: "Wildwood Deep", boss: 31, sky: ["#070b07", "#14200f", "#040604"], torch: "#c8ff6a", weather: "fireflies" },
    { id: "nature", name: "The Drowned Mire", boss: 44, sky: ["#060b0b", "#0f2320", "#030606"], torch: "#5affc0", weather: "spores" },
    { id: "demon", name: "Cinder Pit", boss: 60, sky: ["#100606", "#2e0f0a", "#0a0303"], torch: "#ff4a2a", weather: "embers" },
    { id: "dragon", name: "Wyrmspine", boss: 52, sky: ["#080a10", "#1a2030", "#050609"], torch: "#9ab8ff", weather: "snow" },
    { id: "holy", name: "The Fallen Choir", boss: 59, sky: ["#0c0b08", "#2a2616", "#080705"], torch: "#fff0b0", weather: "motes" },
  ];
  G.biomeOf = (f) => G.BIOMES[Math.floor((f - 1) / 10) % G.BIOMES.length];
  G.loopOf = (f) => Math.floor((f - 1) / 70);

  // v: [min,max] at full scale. pre/suf feed the generated blade name.
  G.AFFIX = {
    atk: { pre: "Vicious", suf: "of Ruin", v: [8, 30], lab: (v) => `+${v}% attack` },
    hp: { pre: "Stalwart", suf: "of the Bulwark", v: [10, 40], lab: (v) => `+${v}% health` },
    crit: { pre: "Keen", suf: "of the Hawk", v: [5, 15], lab: (v) => `+${v}% critical chance` },
    cdmg: { pre: "Cruel", suf: "of Slaughter", v: [20, 60], lab: (v) => `+${v}% critical damage` },
    aspd: { pre: "Howling", suf: "of the Wolf", v: [5, 20], lab: (v) => `+${v}% attack speed` },
    rage: { pre: "Thirsting", suf: "of Fury", v: [10, 40], lab: (v) => `+${v}% rage gain` },
    soul: { pre: "Gravebound", suf: "of the Reaper", v: [3, 10], lab: (v) => `+${v}% gold from all kills` },
    cleave: { pre: "Sweeping", suf: "of the Reaping", v: [30, 60], lab: (v) => `Cleave: hits a second foe for ${v}%` },
    slay_brute: { pre: "Giantsbane", suf: "of the Goblin-Hunter", v: [15, 40], lab: (v) => `+${v}% damage to Brutes` },
    slay_undead: { pre: "Hallowed", suf: "of the Last Vigil", v: [15, 40], lab: (v) => `+${v}% damage to Undead` },
    slay_beast: { pre: "Hunter's", suf: "of the Chase", v: [15, 40], lab: (v) => `+${v}% damage to Beasts` },
    slay_nature: { pre: "Smoldering", suf: "of Embers", v: [15, 40], lab: (v) => `+${v}% damage to Wildlings` },
    slay_demon: { pre: "Exorcist's", suf: "of Banishing", v: [15, 40], lab: (v) => `+${v}% damage to Fiends` },
    slay_dragon: { pre: "Wyrmbane", suf: "of the Dragonslayer", v: [15, 40], lab: (v) => `+${v}% damage to Wyrmkin` },
    slay_holy: { pre: "Profane", suf: "of Ash", v: [15, 40], lab: (v) => `+${v}% damage to the Fallen` },
  };
  G.AFFIX_KEYS = Object.keys(G.AFFIX);

  G.RUNE = {
    might: { name: "Rune of Might", glyph: "ᚢ", v: [10, 20, 35], lab: (v) => `+${v}% attack` },
    ward: { name: "Rune of Warding", glyph: "ᚦ", v: [15, 30, 50], lab: (v) => `+${v}% health` },
    haste: { name: "Rune of Haste", glyph: "ᚱ", v: [6, 12, 20], lab: (v) => `+${v}% attack speed` },
    greed: { name: "Rune of Greed", glyph: "ᚠ", v: [5, 10, 18], lab: (v) => `+${v}% gold from all kills` },
    fury: { name: "Rune of Fury", glyph: "ᚲ", v: [15, 30, 50], lab: (v) => `+${v}% rage gain` },
  };
  G.RUNE_KEYS = Object.keys(G.RUNE);

  // Constellation: permanent, bought with Embers. cost(level) = base + step*level
  G.STARS = [
    { id: "might", name: "The Edge", desc: "+10% damage", max: 25, base: 1, step: 1, x: 150, y: 40 },
    { id: "vital", name: "The Bulwark", desc: "+10% health", max: 25, base: 1, step: 1, x: 70, y: 84 },
    { id: "avarice", name: "The Reaper", desc: "+10% gold", max: 25, base: 1, step: 1, x: 232, y: 84 },
    { id: "fortune", name: "The Hawk", desc: "+2% critical chance", max: 10, base: 2, step: 1, x: 150, y: 110 },
    { id: "vigil", name: "The Watchfire", desc: "+5% offline earnings, +1 h offline cap", max: 6, base: 2, step: 2, x: 52, y: 170 },
    { id: "momentum", name: "The Stair", desc: "Start each run 5 floors deeper", max: 8, base: 3, step: 2, x: 150, y: 184 },
    { id: "insight", name: "The Eye", desc: "Events arrive 10% more often", max: 5, base: 2, step: 2, x: 250, y: 170 },
  ];
  G.STAR_LINKS = [["might", "vital"], ["might", "avarice"], ["might", "fortune"], ["vital", "vigil"], ["avarice", "insight"], ["fortune", "momentum"], ["vigil", "momentum"], ["insight", "momentum"]];

  G.OMENS = [
    { id: "imp", name: "Treasure Imp", w: 40, sign: "Coins glint on the stones ahead.", color: "#ffd24a" },
    { id: "shrine", name: "Cursed Shrine", w: 25, sign: "The torches burn violet.", color: "#b56bff" },
    { id: "champion", name: "Champion Pack", w: 20, sign: "A horn sounds somewhere below.", color: "#ff8a2a" },
    { id: "smith", name: "Wandering Smith", w: 10, sign: "Hammer strikes echo from the gate.", color: "#ffb45a" },
    { id: "moon", name: "Blood Moon", w: 4, sign: "The light is turning red.", color: "#ff3b3b" },
    { id: "hollow", name: "The Hollow Blade", w: 1, sign: "Every torch gutters at once.", color: "#8fa3c8" },
  ];
  G.omenChance = (since) => (since >= 20 ? 1 : 0.04 + 0.03 * (since - 1));
  G.CHAMP_TRAITS = ["Molten", "Vampiric", "Stoneskin", "Frenzied", "Spectral"];

  G.PATHS = [
    { id: "vault", name: "Gilded Vault", desc: "+60% gold. Monsters have 25% more health.", color: "#ffd24a", souls: 1.6, ehp: 1.25 },
    { id: "rush", name: "Collapsed Stair", desc: "7 waves per floor. Monsters hit 20% harder.", color: "#62dcff", waves: 7, eatk: 1.2 },
    { id: "haunt", name: "Whispering Hall", desc: "Events come twice as often.", color: "#b56bff", omen: 2 },
    { id: "calm", name: "Pilgrim Road", desc: "Monsters hit 30% softer. 20% less gold.", color: "#7dff8f", eatk: 0.7, souls: 0.8 },
  ];

  G.UNLOCK = { slot4: 5, ult: 5, slot5: 10, ten: 10, runes: 20, ascend: 20, expedition: 30, bounty: 30, rift: 40, rebirth: 40 };
  G.UNLOCK_TEXT = [
    [5, "Fourth blade slot and ultimates"],
    [10, "Fifth slot and 10x summons"],
    [20, "Runes and merging duplicates"],
    [30, "Missions and daily quests"],
    [40, "Daily trial and rebirth"],
  ];

  G.BOUNTY_POOL = [
    { k: "kills", goal: 150, rew: 3, text: (g) => `Slay ${g} foes` },
    { k: "famkills", goal: 60, rew: 4, text: (g, f) => `Slay ${g} ${G.FAMLABEL[f]}` },
    { k: "floors", goal: 15, rew: 4, text: (g) => `Clear ${g} floors` },
    { k: "pulls", goal: 10, rew: 3, text: (g) => `Summon ${g} blades` },
    { k: "ults", goal: 30, rew: 3, text: (g) => `Cast ${g} ultimates` },
    { k: "boss", goal: 2, rew: 5, text: (g) => `Defeat ${g} bosses` },
    { k: "levels", goal: 40, rew: 3, text: (g) => `Raise slot levels ${g} times` },
  ];

  G.FEATS = [
    { id: "k1", name: "First Blood", text: "Slay 100 foes", get: (s) => s.kills, goal: 100, rew: 3 },
    { id: "k2", name: "Butcher", text: "Slay 2,500 foes", get: (s) => s.kills, goal: 2500, rew: 6 },
    { id: "k3", name: "Extinction", text: "Slay 25,000 foes", get: (s) => s.kills, goal: 25000, rew: 15 },
    { id: "f1", name: "Into the Dark", text: "Reach floor 10", get: (s) => s.best, goal: 10, rew: 3 },
    { id: "f2", name: "No Daylight", text: "Reach floor 30", get: (s) => s.best, goal: 30, rew: 6 },
    { id: "f3", name: "Deep Dweller", text: "Reach floor 70", get: (s) => s.best, goal: 70, rew: 12 },
    { id: "f4", name: "Second Descent", text: "Reach floor 120", get: (s) => s.best, goal: 120, rew: 25 },
    { id: "p1", name: "Collector", text: "Summon 50 blades", get: (s) => s.pulls, goal: 50, rew: 5 },
    { id: "p2", name: "Hoarder", text: "Summon 500 blades", get: (s) => s.pulls, goal: 500, rew: 20 },
    { id: "l1", name: "Forgeborn", text: "Summon a Legendary blade", get: (s) => s.stat.legend, goal: 1, rew: 5 },
    { id: "r1", name: "Phoenix", text: "Rebirth once", get: (s) => s.rebirths, goal: 1, rew: 5 },
    { id: "r2", name: "Wheel of Ash", text: "Rebirth 10 times", get: (s) => s.rebirths, goal: 10, rew: 20 },
    { id: "i1", name: "Sack Cutter", text: "Catch 10 treasure imps", get: (s) => s.stat.imps, goal: 10, rew: 5 },
    { id: "g1", name: "Gold Fever", text: "Slay a gilded foe", get: (s) => Object.keys(s.gild).length, goal: 1, rew: 3 },
    { id: "s1", name: "Something Watches", text: "Find 5 secrets", get: (s) => s.secrets, goal: 5, rew: 5 },
  ];

  G.WHISPERS = [
    "\"We were wielders once. Now we are only the edge.\"",
    "\"The gate at the bottom opens inward.\"",
    "\"It counts your floors. It has always counted.\"",
    "\"Gold does not rust. Neither do the things that wear it.\"",
    "\"The smith has no shadow. Look next time.\"",
    "\"When the torches go out, do not look at the blade. Look at what holds it.\"",
    "\"Seven choirs fell. You have only met one.\"",
    "\"Every rebirth, the stair is one step longer.\"",
  ];

  G.RIFT_MODS = [
    { id: "frail", name: "Glass Edge", desc: "Blades deal double damage and have half health." },
    { id: "swarm", name: "The Swarm", desc: "Five monsters in every wave, each with less health." },
    { id: "eclipse", name: "Eclipse", desc: "Only the featured element deals full damage." },
  ];
})();
