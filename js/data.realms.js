// ===================== REALMS, BOSSES, BLADE CATALOG (generated) =====================
// The dungeon is 1000 floors: 10 realms of 100 floors. Each realm reuses the 7 areas with its own
// colours, a fresh set of 30 blades, and 10 bosses (one every 10 floors). Every boss has a
// signature blade that only it drops. All of this is generated from fixed seeds, so it costs no
// art and is identical on every device.
//
// SAVE SAFETY: a blade in a save is stored by its index in SWORDS_DATA. Never reorder or remove
// generated entries. To add content, append new entries at the end (new realms, events, skins).
window.G = window.G || {};
(function () {
  const G = window.G, SW = window.SWORDS_DATA;

  G.MAX_FLOOR = 1000;
  G.REALM_SIZE = 100;
  // Each realm's blades are this many times stronger than the realm before. Deeper floors
  // outgrow levels alone, so moving to a new realm means getting that realm's blades.
  G.REALM_POW = 20;

  G.REALMS = [
    { name: "The Upper Deep", adj: "Deep", mat: "Iron", tint: null, hue: 0 },
    { name: "The Ember Halls", adj: "Ember", mat: "Emberforged", tint: "#ff6a2a", hue: -28 },
    { name: "The Frostbound Vaults", adj: "Frost", mat: "Rimeglass", tint: "#8fd0ff", hue: 165 },
    { name: "The Sunless Sea", adj: "Tide", mat: "Tidebound", tint: "#2a9a9a", hue: 120 },
    { name: "The Bone Cathedral", adj: "Bone", mat: "Ossuary", tint: "#d8ccb0", hue: 45 },
    { name: "The Storm Abyss", adj: "Storm", mat: "Thunderwrought", tint: "#ffe14a", hue: 200 },
    { name: "The Verdant Rot", adj: "Rot", mat: "Blightwood", tint: "#7dff8f", hue: 80 },
    { name: "The Gilded Ruin", adj: "Gilded", mat: "Sunsteel", tint: "#ffd24a", hue: 25 },
    { name: "The Void Spiral", adj: "Void", mat: "Voidglass", tint: "#b56bff", hue: 255 },
    { name: "The Throne Below", adj: "Throne", mat: "Kingsbane", tint: "#ff3b3b", hue: 320 },
  ];
  G.ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  G.realmOf = (f) => Math.max(0, Math.min(G.REALMS.length - 1, Math.floor((f - 1) / G.REALM_SIZE)));
  G.realmHue = (f) => G.REALMS[G.realmOf(f)].hue;

  // ---------- blade catalog ----------
  const ELS = ["fire", "ice", "lightning", "holy", "void", "poison", "steel"];
  // What each of the 30 sprite shapes is called when a deeper realm reforges it.
  const NOUN = ["Sword", "Blade", "Edge", "Cutter", "Saber", "Trainer", "Shortsword", "Sword", "Brand", "Longsword",
    "Warblade", "Scimitar", "Spikeblade", "Broadsword", "Longsword", "Serpent", "Knightblade", "Gladius", "Bastard", "Flamberge",
    "Wyrmslayer", "Kingsblade", "Katana", "Muramasa", "Runeblade", "Soulreaver", "Corruptor", "Stormbrand", "Greatsword", "Godblade"];
  const SYL1 = ["Kael", "Vor", "Ith", "Mor", "Sael", "Dra", "Ul", "Zer", "Aen", "Thal", "Nyx", "Ghor", "Ves", "Cyr", "Oth", "Rhae"];
  const SYL2 = ["thir", "gal", "dris", "vane", "mor", "ion", "ash", "eth", "rak", "ul", "wyn", "oth", "is", "ar", "en", "ix"];
  const EPI = ["Fang", "Oath", "Wrath", "Requiem", "Dawn", "Verdict", "Hunger", "Lament", "Crown", "Promise", "Ruin", "Vigil"];
  const POWERS = {
    fire: ["Cinder Storm", "Pyre Lash", "Ashfall", "Inferno Bloom"], ice: ["Glacier Bite", "Hoarfrost", "Frozen Requiem", "Winter's Edge"],
    lightning: ["Thunderclap", "Arc Cascade", "Skybreaker", "Static Veil"], holy: ["Dawnbreak", "Seraph Wing", "Judgement", "Sacred Vow"],
    void: ["Unmaking", "Null Rift", "Eclipse", "Star Eater"], poison: ["Blight Bloom", "Venom Rain", "Rotting Kiss", "Plaguewind"],
    steel: ["Iron Tempest", "Bulwark Slam", "Thousand Cuts", "Anvil Fall"],
  };
  const ELWORD = { fire: "flame", ice: "frost", lightning: "storm", holy: "light", void: "the void", poison: "venom", steel: "cold iron" };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const coin = (seed) => G.rng(seed);
  const pickR = (r, a) => a[Math.floor(r() * a.length)];
  function forgeName(r) { return pickR(r, SYL1) + pickR(r, SYL2); }

  // Originals (realm 0) keep their hand-written names and stats.
  SW.forEach((w) => { w.realm = 0; w.spr = w.index; w.hue = 0; w.pow = 1; });
  const BASE = SW.slice(0, 30);

  // Realms 1-9: 30 reforged blades each.
  for (let r = 1; r < G.REALMS.length; r++) {
    const R = G.REALMS[r];
    BASE.forEach((b, j) => {
      const rnd = coin(r * 1000 + j * 7 + 1), el = ELS[(ELS.indexOf(b.element) + r) % ELS.length];
      let name, power = null;
      if (b.rarity === "common" || b.rarity === "rare") name = R.mat + " " + NOUN[j];
      else { name = forgeName(rnd) + ", " + R.adj + " " + pickR(rnd, EPI); power = pickR(rnd, POWERS[el]); }
      SW.push({
        name, rarity: b.rarity, attack: b.attack, defense: b.defense, element: el, specialPower: power,
        description: b.rarity === "legendary" ? `Forged in ${R.name} and quenched in ${ELWORD[el]}.` : `A ${b.rarity} blade of ${R.name}.`,
        index: SW.length, realm: r, spr: j, hue: 0, gen: 50000 + r * 1000 + j, pow: Math.pow(G.REALM_POW, r),
      });
    });
  }

  // ---------- bosses ----------
  const BOSS_EL = { brute: "steel", nature: "poison", undead: "void", beast: "lightning", demon: "fire", dragon: "ice", holy: "holy" };
  const BOSS_METAL = { brute: "iron", nature: "moss", undead: "bone", beast: "bronze", demon: "obsidian", dragon: "ice", holy: "gold" };
  const BOSS_NOUN = { brute: "Cleaver", nature: "Thornfang", undead: "Gravebrand", beast: "Clawblade", demon: "Hellbrand", dragon: "Wyrmfang", holy: "Fallen Halo" };
  const TITLE = ["the Unbowed", "the Hollow", "the Ashen", "the Devourer", "the Last", "the Pale", "the Undying", "the Starving", "the Crowned", "the Patient", "the Drowned", "the Sundered", "the Wretched", "the Silent"];
  // Boss mechanics. The sim reads these; the text tells the player how to beat them.
  G.BOSS_MECH = {
    armor: { name: "Ironhide", text: "Takes half damage until an ultimate cracks its armour" },
    regen: { name: "Undying", text: "Heals steadily. Burst it down" },
    brood: { name: "Broodmother", text: "Calls more monsters while it lives" },
    swift: { name: "Swift", text: "Attacks much faster" },
    wrath: { name: "Wrathful", text: "Hits harder as its health drops" },
    thorns: { name: "Thorned", text: "Hurts blades that strike it" },
  };
  const MECHS = Object.keys(G.BOSS_MECH);
  const MON = window.MONSTERS_DATA || [];
  const ROST = {};
  const rosterOf = (fam) => ROST[fam] || (ROST[fam] = Object.keys(G.FAM).map(Number).filter((i) => G.FAM[i] === fam).sort((a, b) => MON[b].health - MON[a].health));
  const BOSS = {};
  G.bossAt = function (f) {
    f = Math.floor(f);
    if (f % 10 !== 0 || f < 10 || f > G.MAX_FLOOR) return null;
    if (BOSS[f]) return BOSS[f];
    const r = G.realmOf(f), bio = G.biomeOf(f), rnd = coin(f * 31 + 7), top = rosterOf(bio.id);
    // Realm I keeps the hand-picked bosses; deeper realms promote other big monsters of the same area.
    const mi = r === 0 ? bio.boss : top[(Math.floor(f / 10) + r) % Math.max(1, Math.min(4, top.length))];
    const lord = f % G.REALM_SIZE === 0, final = f === G.MAX_FLOOR;
    const mech = r === 0 && f <= 30 ? [] : lord ? [pickR(rnd, MECHS)] : [MECHS[(f / 10 + r * 3) % MECHS.length]];
    if (lord) { let m2 = pickR(rnd, MECHS); if (m2 === mech[0]) m2 = MECHS[(MECHS.indexOf(m2) + 1) % MECHS.length]; mech.push(m2); }
    const nm = final ? "Nihl" : forgeName(rnd);
    const b = {
      f, mi, realm: r, fam: bio.id, lord, final, mech,
      name: final ? "Nihl, the Throne Below" : nm + " " + pickR(rnd, TITLE),
      kind: cap(MON[mi] ? MON[mi].type.split("/")[0].trim() : "monster"),
      hue: r === 0 ? 0 : G.REALMS[r].hue + Math.round((rnd() - 0.5) * 30),
      hp: final ? 3 : lord ? 1.8 : 1,
      sword: -1, short: nm,
    };
    BOSS[f] = b;
    return b;
  };

  // One signature blade per boss (100 in all). Only that boss drops it, in the Boss Gate.
  G.SIG = {};
  for (let f = 10; f <= G.MAX_FLOOR; f += 10) {
    const b = G.bossAt(f), r = b.realm, el = BOSS_EL[b.fam] || "steel", spr = 20 + ((f / 10) % 10);
    const idx = SW.length;
    SW.push({
      name: b.final ? "Nihl's Throneblade" : b.short + "'s " + BOSS_NOUN[b.fam], rarity: "legendary",
      attack: 34 + (b.lord ? 8 : 0) + (f / 10) % 5, defense: 22 + (b.lord ? 6 : 0) + (f / 20) % 4,
      element: el, specialPower: b.mech.length ? G.BOSS_MECH[b.mech[0]].name + " Strike" : "Guardian's Wrath",
      description: `Taken from ${b.name}, guardian of floor ${f}.`,
      index: idx, realm: r, spr, hue: 0, gen: 90000 + f, metal: BOSS_METAL[b.fam], pow: Math.pow(G.REALM_POW, r) * (b.final ? 2 : 1.25), sig: f,
    });
    b.sword = idx; G.SIG[f] = idx;
  }
  G.BOSS_FLOORS = Object.keys(G.SIG).map(Number);

  // ---------- v5.1: 40 more blades per realm, each with its own generated design ----------
  // 14 Common, 12 Rare, 8 Epic, 6 Legendary per realm: 400 new looks for the summon pool.
  const FORMS = ["Falchion", "Cutlass", "Claymore", "Estoc", "Rapier", "Kopis", "Khopesh", "Spatha", "Seax", "Tulwar", "Shamshir", "Dao",
    "Jian", "Nodachi", "Wakizashi", "Kriegsmesser", "Messer", "Backsword", "Sabre", "Arming Sword", "Hanger", "Dussack", "Schiavona", "Flyssa",
    "Kilij", "Yatagan", "Talwar", "Pata", "Machete", "Glaive-sword"];
  const MATS0 = ["Iron", "Steel", "Bronze", "Silver", "Copper", "Tin", "Blackened", "Polished", "Rune-etched", "Soldier's"];
  const REALM_WORDS = [["Iron", "Steel", "Bronze", "Silver"], ["Cinder", "Magma", "Ashen", "Forgefire"], ["Frost", "Glacial", "Rime", "Snowbound"], ["Tidal", "Coral", "Abyssal", "Brine"],
    ["Bone", "Ossuary", "Marrow", "Grave"], ["Storm", "Thunder", "Gale", "Tempest"], ["Thorn", "Blight", "Moss", "Sporeborn"], ["Gilded", "Sunsteel", "Regal", "Aurum"],
    ["Void", "Null", "Starless", "Eclipse"], ["Crown", "Throne", "Sovereign", "Kingsbane"]];
  const PROFILE_OF = { Rapier: "needle", Estoc: "needle", Claymore: "great", Nodachi: "curved", Wakizashi: "curved", Shamshir: "curved", Kilij: "curved", Tulwar: "curved", Talwar: "curved", Khopesh: "fang", Kopis: "fang", Machete: "cleaver", Falchion: "cleaver", Flyssa: "taper", Yatagan: "fang", Kriegsmesser: "great" };
  const NEWRAR = [].concat(Array(14).fill("common"), Array(12).fill("rare"), Array(8).fill("epic"), Array(6).fill("legendary"));
  const STAT = { common: [[4, 11], [1, 6]], rare: [[12, 18], [6, 9]], epic: [[22, 26], [14, 18]], legendary: [[34, 38], [22, 26]] };
  for (let r = 0; r < G.REALMS.length; r++) {
    const R = G.REALMS[r], words = REALM_WORDS[r];
    NEWRAR.forEach((rar, j) => {
      const rnd = coin(70000 + r * 100 + j), el = ELS[Math.floor(rnd() * ELS.length)], st = STAT[rar];
      const form = FORMS[(j + r * 7) % FORMS.length], word = r === 0 ? MATS0[j % MATS0.length] : words[j % words.length];
      let name, power = null;
      if (rar === "common" || rar === "rare") name = word + " " + form;
      else { name = forgeName(rnd) + ", " + (r === 0 ? "the" : R.adj) + " " + pickR(rnd, EPI); power = pickR(rnd, POWERS[el]); }
      SW.push({
        name, rarity: rar, attack: st[0][0] + Math.floor(rnd() * (st[0][1] - st[0][0] + 1)), defense: st[1][0] + Math.floor(rnd() * (st[1][1] - st[1][0] + 1)),
        element: el, specialPower: power, profile: rar === "common" || rar === "rare" ? PROFILE_OF[form] : undefined,
        description: rar === "legendary" ? `Forged in ${R.name} and quenched in ${ELWORD[el]}.` : `A ${rar} ${form.toLowerCase()} of ${R.name}.`,
        index: SW.length, realm: r, spr: 0, hue: 0, gen: 70000 + r * 100 + j, pow: Math.pow(G.REALM_POW, r),
      });
    });
  }

  // ---------- AI-drawn art (tools/make-blade-art.py) ----------
  // Each drawn blade takes its name, element, ultimate and lore from its picture, so how it looks is how it works.
  // Rarity, realm and stats stay with the catalog; blades without a drawing keep their generated design.
  const BA = window.BLADE_ART;
  G.BLADE_ART = BA || null;
  if (BA && BA.list) for (const k in BA.list) {
    const w = SW[+k], a = BA.list[k];
    if (!w || !Array.isArray(a)) continue;
    w.cell = a[0]; w.name = a[1]; if (G.EL[a[2]]) w.element = a[2];
    if (a[3] && (w.rarity === "epic" || w.rarity === "legendary")) w.specialPower = a[3];
    if (a[4]) w.description = a[4];
  }
})();
