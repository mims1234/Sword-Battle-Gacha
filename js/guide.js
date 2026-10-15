// ===================== GUIDES (tutorials) =====================
// A guide is a list of steps. A step can point at a part of the screen (target), run something
// first (before), and wait for the player to do it (wait). Guides start on their own the first
// time they become relevant, and every unlocked guide can be replayed from Menu > Guides.
(function () {
  const G = window.G;
  const $ = (s) => document.querySelector(s);
  const U = () => G.ui;
  const teamSize = () => G.party.filter(Boolean).length;

  G.GUIDES = [
    {
      id: "basics", name: "First steps", icon: "⚔", col: "#f2c14e", floor: 1, auto: (s) => s.pulls === 0,
      steps: [
        { title: "Welcome, Blade Master", text: "Monsters fill every floor of this dungeon. Magic blades fight them for you, even while you are away. Let's get you some blades." },
        { title: "Open Summon", text: "You have 10 gems. Tap Summon.", target: "#sumBtn", wait: () => !$("#summon").hidden },
        { title: "Summon 10 blades", text: "Tap Summon 10. Each blade is random and every one is different.", target: '[data-act="summon"][data-n="10"]', wait: () => G.s.pulls > 0 && U().pull && U().pull.phase === "show" && Date.now() > (U().pull.lockUntil || 0) },
        { title: "Your new blades", text: "The colour shows how rare a blade is: grey Common, blue Rare, purple Epic, orange Legendary, red Mythic. Tap any blade later to see its stats.", target: ".pulls" },
        { title: "Pick your team", text: "Now choose who fights. Tap blades to add them to your team. Pick 3.", before: () => { U().closeSummon(); U().open("warband"); }, target: "#left .tiles, #sheet .tiles", wait: () => teamSize() >= Math.min(3, G.slotCount(), G.s.blades.length) },
        { title: "Front and back", text: "Slots 1 and 2 are the front row and get hit first. Put Tanks (lots of health) in front and Attackers behind. Auto team does this for you.", target: "#left .formation, #sheet .formation" },
        { title: "Fight!", text: "Your team now fights on its own. Every monster drops gold.", before: () => U().close(), target: "#stageWrap" },
        { title: "Level up", text: "Spend gold here to make your team stronger. If you lose a fight, your team trains one floor back and you can try again.", target: "#lvlAll" },
        { title: "That's it!", text: "New features unlock as you go deeper, and a guide explains each one. Replay any guide from Menu > Guides." },
      ],
    },
    {
      id: "summon", name: "Summoning", icon: "◆", col: "#6fd6ff", floor: 1, auto: () => false,
      steps: [
        { title: "Summon", text: "Spend 1 gem for 1 blade, or 10 gems for 10 blades with at least one Epic or better.", before: () => U().openSummon(), target: ".sm-btns" },
        { title: "Bad luck protection", text: "This bar fills with every summon. When it is full, your next blade is Legendary or better.", target: ".pity" },
        { title: "Weekly bonus", text: "Each week one element shows up more often. Watch for falling stars too: they double your Legendary chance for 10 minutes.", target: ".banner" },
        { title: "Where gems come from", text: "Bosses, reaching new floors, treasure imps, quests, and time spent playing all give gems." },
      ],
    },
    {
      id: "team", name: "Your team", icon: "⛨", col: "#f2c14e", floor: 1, auto: () => false,
      steps: [
        { title: "Team", text: "Tap a slot, then tap a blade to put it there. Arrows on blades show if they are better (▲) or worse (▼) than the one in that slot.", before: () => U().open("warband"), target: "#left .formation, #sheet .formation" },
        { title: "Element bonus", text: "Two blades of the same element give +10% damage. Three give a special power, like burning or freezing monsters.", target: "#left .res, #sheet .res" },
        { title: "Tidy up", text: "Merge duplicates to add ★ ranks, and sell spare Common blades for gold.", target: "#left .rowbtns, #sheet .rowbtns" },
      ],
    },
    {
      id: "ultimate", name: "Ultimates", icon: "✦", col: "#ff8a2e", floor: 5, auto: (s) => s.best >= 5,
      steps: [
        { title: "Ultimates unlocked", text: "Each blade fills its orange bar while fighting. When it glows, its ultimate is ready. It fires on its own, or tap the blade yourself for 25% more damage.", target: "#bs0" },
        { title: "A 4th slot", text: "Your team can now hold 4 blades. Open Team and fill the new slot.", target: "#bs3" },
      ],
    },
    {
      id: "events", name: "Random events", icon: "🕯", col: "#ffd24a", floor: 5, auto: (s) => !!s.omen.pend,
      steps: [
        { title: "Something is coming", text: "The candle flared. A random event will happen within 2 floors. Watch the arena: it changes before each event.", target: "#omenBtn" },
        { title: "What can happen", text: "A treasure imp to catch, a cursed shrine that doubles loot, a champion monster, a smith with a free upgrade, a Blood Moon, or something very rare. Tap the candle anytime to see the list.", target: "#status" },
      ],
    },
    {
      id: "defeat", name: "When you lose", icon: "☠", col: "#e0503a", floor: 1, auto: (s) => s.stat.wipes > 0,
      steps: [
        { title: "Defeated", text: "Your team lost, so it is training one floor back. It earns gold there while you get stronger.", target: "#status" },
        { title: "How to win", text: "Level up, summon better blades, or use blades that are strong against these monsters. Then tap Try again.", target: "#lvlAll" },
      ],
    },
    {
      id: "boss", name: "Bosses and doors", icon: "♛", col: "#ff5a4a", floor: 10, auto: (s) => s.best >= 10,
      steps: [
        { title: "You beat a boss!", text: "Every 10th floor has a boss. Beating one gives gems and opens a new area with new monsters." },
        { title: "Pick a door", text: "After each boss you choose 1 of 3 doors. Each changes the next 10 floors: more gold, faster floors, more events, or easier fights." },
        { title: "New unlocks", text: "You now have a 5th team slot and Summon 10.", target: "#sumBtn" },
      ],
    },
    {
      id: "elements", name: "Elements", icon: "🔥", col: "#ff6a3c", floor: 10, auto: (s) => s.best >= 11,
      steps: [
        { title: "Strong against", text: "Each area's monsters are weak to certain elements. Blades of that element deal 50% more damage there. The text under your team tells you which.", target: "#info, #left .res" },
        { title: "Monster book", text: "Menu > Monsters lists every monster you have met. Defeat 50 of one kind for a permanent damage bonus." },
      ],
    },
    {
      id: "runes", name: "Runes and merging", icon: "ᚢ", col: "#55c6f8", floor: 20, auto: (s) => s.best >= 20,
      steps: [
        { title: "Runes", text: "Bosses and champion monsters now drop runes. Open a blade and tap Rune to put one in. Three of the same rune combine into a stronger one." },
        { title: "Merging", text: "Got the same blade twice? Merge them in Team: each copy adds a ★ rank, up to 5, and makes the blade much stronger." },
      ],
    },
    {
      id: "missions", name: "Missions and quests", icon: "✎", col: "#ffb45a", floor: 30, auto: (s) => s.best >= 30,
      steps: [
        { title: "Missions", text: "Blades that are not in your team can go on missions for 1, 4 or 8 hours and bring back gold, gems and runes. Find it in the Menu." },
        { title: "Daily quests", text: "Three new goals every day, each paying gems. Check Quests." },
      ],
    },
    {
      id: "rebirth", name: "Rebirth", icon: "✧", col: "#d08aff", floor: 40, auto: (s) => s.best >= 40,
      steps: [
        { title: "Rebirth", text: "When you get stuck, rebirth: go back to an early floor and earn Essence based on how deep you got. You keep every blade, ★ rank, rune and gem." },
        { title: "Upgrades", text: "Spend Essence on permanent upgrades like more damage, more gold, and starting deeper. Each rebirth takes you further than the last." },
        { title: "Daily Trial", text: "Also new: a 3-minute challenge once a day with a special rule. Every 2 floors you clear gives a gem." },
      ],
    },
  ];
  G.guideOpen = (g) => G.s.best >= g.floor || (g.id === "events" && G.s.best >= 5);
  const HELP = { warband: "team", forge: "summon", relics: "runes", stars: "rebirth", exp: "missions", rift: "rebirth", journal: "missions", bestiary: "elements" };
  G.helpFor = (panel) => HELP[panel] || "basics";

  // ---------- runner ----------
  let cur = null; // { g, i, replay, pausedHere }
  const tips = () => G.s.tips || (G.s.tips = {});
  G.guideActive = () => !!cur;

  G.startGuide = function (id, replay) {
    const g = G.GUIDES.find((x) => x.id === id); if (!g) return;
    if (cur) endGuide(true);
    // Start from a clean screen: open panels would sit under the spotlight on phones.
    // Steps that need a panel open it themselves.
    U().closeModal(); U().closeSummon(); U().close();
    cur = { g, i: -1, replay: !!replay, pausedHere: false };
    if (!G.paused) { G.paused = "guide"; cur.pausedHere = true; }
    next();
  };
  function endGuide(silent) {
    if (!cur) return;
    tips()["g_" + cur.g.id] = 1;
    if (cur.pausedHere && G.paused === "guide") G.paused = null;
    cur = null; const el = document.getElementById("guide"); el.hidden = true; el.innerHTML = "";
    if (!silent) U().dirty("all");
  }
  function next() {
    cur.i++;
    if (cur.i >= cur.g.steps.length) return endGuide();
    const st = cur.g.steps[cur.i];
    if (st.before) { try { U().closeModal(); st.before(); } catch (e) { /* panel may be locked */ } }
    // Steps that wait for the player leave the game running so the action can happen.
    if (st.wait && !cur.replay && G.paused === "guide" && cur.pausedHere) { G.paused = null; cur.pausedHere = false; }
    if ((!st.wait || cur.replay) && !G.paused) { G.paused = "guide"; cur.pausedHere = true; }
    cur.shownAt = performance.now();
    render(true);
  }
  // Scroll only the panel that holds the target (scrollIntoView would also shift the whole page).
  function reveal(t) {
    for (let p = t.parentElement; p && p !== document.body; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) { p.scrollTop += t.getBoundingClientRect().top - p.getBoundingClientRect().top - 8; break; }
    }
  }
  function findTarget(sel) {
    if (!sel) return null;
    for (const one of sel.split(",")) { const el = document.querySelector(one.trim()); if (el && el.offsetParent && el.getBoundingClientRect().width > 0) return el; }
    return null;
  }
  function render(fresh) {
    const root = document.getElementById("guide"), st = cur.g.steps[cur.i], waiting = st.wait && !cur.replay;
    if (fresh) {
      root.innerHTML = `<div class="gspot"></div><div class="gcard" style="--gc:${cur.g.col}">
        <div class="gh"><span class="gi">${cur.g.icon}</span><b>${st.title}</b><span class="gn">${cur.i + 1}/${cur.g.steps.length}</span></div>
        <p>${st.text}</p>
        <div class="gb">${waiting ? `<span class="gw">Do it now to continue</span>` : `<button class="btn gold" data-act="guideNext">${cur.i === cur.g.steps.length - 1 ? "Done" : "Next"}</button>`}<button class="gskip" data-act="guideSkip">${cur.replay ? "Close" : "Skip tutorial"}</button></div></div>`;
      root.hidden = false;
    }
    const t = findTarget(st.target);
    // Bring the target into view inside its scrolling panel before pointing at it.
    if (fresh) cur.revealed = false;
    if (t && !cur.revealed) { cur.revealed = true; reveal(t); } // panels render a moment later, so wait for the target
    place(root, t);
  }
  function place(root, t) {
    const spot = root.querySelector(".gspot"), card = root.querySelector(".gcard"), app = document.getElementById("app").getBoundingClientRect();
    if (!spot || !card) return;
    const cw = Math.min(340, app.width - 20); card.style.width = cw + "px";
    if (!t) {
      spot.style.cssText = `left:${app.width / 2}px;top:${app.height / 2}px;width:0;height:0`;
      card.style.left = (app.width - cw) / 2 + "px"; card.style.top = Math.max(10, (app.height - card.offsetHeight) / 2) + "px"; card.className = "gcard";
      return;
    }
    const r = t.getBoundingClientRect(), pad = 6;
    const x = r.left - app.left - pad, y = r.top - app.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
    spot.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    const below = y + h + card.offsetHeight + 14 < app.height, above = y - card.offsetHeight - 14 > 0;
    let top = below ? y + h + 12 : above ? y - card.offsetHeight - 12 : Math.max(10, app.height - card.offsetHeight - 10);
    card.style.top = top + "px"; card.style.left = Math.max(10, Math.min(app.width - cw - 10, x + w / 2 - cw / 2)) + "px";
    card.className = "gcard " + (below ? "pt-up" : above ? "pt-down" : "");
    card.style.setProperty("--ax", Math.max(16, Math.min(cw - 16, x + w / 2 - parseFloat(card.style.left))) + "px");
  }

  // Called every HUD tick: follow the target, advance waiting steps, start guides that just became relevant.
  G.guideTick = function () {
    if (cur) {
      const st = cur.g.steps[cur.i];
      if (st.wait && !cur.replay && performance.now() - cur.shownAt > 300) { let done = false; try { done = st.wait(); } catch (e) { done = false; } if (done) return next(); }
      return render(false);
    }
    const s = G.s, t = tips();
    if (!t.guidesInit) { // players from before this version: mark what is already behind them as seen
      t.guidesInit = 1;
      if (s.pulls > 0) G.GUIDES.forEach((g) => { if (g.id === "basics" || g.id === "summon" || g.id === "team" || s.best > g.floor) t["g_" + g.id] = 1; });
    }
    if (G.paused || !document.getElementById("modal").hidden) return;
    const g = G.GUIDES.find((x) => !t["g_" + x.id] && x.auto(s));
    if (g) G.startGuide(g.id, false);
  };
  G.guideNext = () => cur && next();
  G.guideSkip = () => {
    if (!cur) return;
    // Skipping the first guide still leaves the player with a team so the game can start.
    if (cur.g.id === "basics" && !cur.replay) { if (!G.s.blades.length && G.s.sigils >= 10) G.summon(10); if (!G.party.some(Boolean)) { G.autoParty(); G.refreshBlades(); } U().closeSummon(); U().close(); }
    endGuide();
  };
})();
