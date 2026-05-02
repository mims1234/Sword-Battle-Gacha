// ===================== EVENT BINDINGS & INIT =====================
(function () {
  const G = Game;
  const $ = G.els;

  // ---------- FILTER BUTTONS ----------
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      G.displayCollection(btn.dataset.filter);
    });
  });

  // ---------- PLAY/PAUSE ----------
  $.playPauseButton.addEventListener("click", () => {
    if (
      G.currentSwordIndex === null ||
      !G.gameState.activeSwords[G.currentSwordIndex]
    ) {
      $.playPauseButton.textContent = "Battle";
      return;
    }
    if (G.overlayQueue.isDisplaying && G.overlayQueue.queue.length > 0) return;
    G.autoPlay = !G.autoPlay;
    $.playPauseButton.textContent = G.autoPlay ? "Stop" : "Battle";
    if (G.autoPlay) {
      const sw = G.swordData.find((s) => s.index === G.currentSwordIndex);
      if (sw && G.gameState.activeSwords[sw.index]) G.simulateBattle(sw);
    }
  });

  // ---------- MENU TOGGLE ----------
  $.menuButton.addEventListener("click", () => {
    document.querySelector(".sidebar-left").classList.toggle("open");
  });

  // ---------- GACHA PULL ----------
  $.pullButton.addEventListener("click", G.doGachaPull);

  // ---------- FORGE ----------
  $.forgeButton.addEventListener("click", G.openForgeModal);
  document
    .getElementById("forgeClose")
    .addEventListener("click", G.closeForgeModal);
  document.getElementById("forgeModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) G.closeForgeModal();
  });
  document
    .getElementById("forgeExecute")
    .addEventListener("click", G.executeForge);

  // ---------- BESTIARY ----------
  $.bestiaryButton.addEventListener("click", G.openBestiaryModal);
  document.getElementById("bestiaryClose").addEventListener("click", () => {
    document.getElementById("bestiaryModal").style.display = "none";
  });
  document.getElementById("bestiaryModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget)
      document.getElementById("bestiaryModal").style.display = "none";
  });

  // ---------- PRESTIGE ----------
  $.prestigeButton.addEventListener("click", G.doPrestige);

  // ---------- SAVE / RESET ----------
  $.saveButton.addEventListener("click", () => {
    G.saveGame();
    G.showNotification("💾 Game saved!", "#888");
  });
  $.resetButton.addEventListener("click", () => {
    if (!confirm("Reset all progress? This cannot be undone!")) return;
    localStorage.removeItem(G.SAVE_KEY);
    location.reload();
  });

  // ---------- TABS ----------
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      const tabId = `tab${btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)}`;
      const tab = document.getElementById(tabId);
      if (tab) tab.classList.add("active");
    });
  });

  // ---------- INIT ----------
  G.initializeCollection();

  const loaded = G.loadGame();
  if (loaded) {
    G.updateTopBar();
    G.updatePlayButtonState();
    G.updateOpenChestButtonState();
    G.updatePityUI();
    G.updateComboUI();
    G.updatePrestigeUI();
    G.updateAchievementsList();
    G.updateBestiaryList();
    G.updateDPS();
  }

  // ---------- FETCH DATA ----------
  fetch("swords.json")
    .then((r) => r.json())
    .then((data) => {
      G.swordData = data;
      G.displayCollection();
      G.updateCollectionCount();
      if (!loaded) G.updateTopBar();
    })
    .catch((e) => console.error("Error loading swords:", e));

  fetch("monsters.json")
    .then((r) => r.json())
    .then((data) => {
      G.monsterTypes = data;
      G.updateBestiaryList();
    })
    .catch((e) => console.error("Error loading monsters:", e));

  // ---------- AUTO-SAVE ----------
  setInterval(G.saveGame, 30000);

  // ---------- EMBER PARTICLES ----------
  (function spawnEmbers() {
    const container = G.els.emberContainer;
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

  // ---------- INITIAL UI UPDATE ----------
  G.updatePityUI();
  G.updatePrestigeUI();
  G.updateOpenChestButtonState();
  G.updatePlayButtonState();
})();
