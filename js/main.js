// ===================== BOOT + BINDINGS + INIT =====================
(function () {
  const G = Game;

  // ---------- BOOT ANIMATION (anime.js) ----------
  function runBoot() {
    const title = document.querySelectorAll(".boot-title span");
    if (typeof anime !== "undefined") {
      anime({
        targets: title,
        opacity: [0, 1],
        translateY: [22, 0],
        delay: anime.stagger(50, { from: "start" }),
        duration: 500,
        easing: "easeOutCubic",
      });
      anime({
        targets: document.querySelector(".boot-fill"),
        width: "100%",
        duration: 1300,
        easing: "easeInOutCubic",
        complete: finishBoot,
      });
      setTimeout(finishBoot, 2600);
    } else {
      setTimeout(finishBoot, 600);
    }
  }

  let booted = false;
  function finishBoot() {
    if (booted) return;
    booted = true;
    G.els.boot.classList.add("fade");
    setTimeout(() => {
      G.els.boot.style.display = "none";
      G.els.app.classList.remove("hidden");
      G.fx.spawnEmbers(14);
      G.fx.reveal(G.els.hud);
      G.fx.reveal(G.els.stage, 120);
      G.fx.reveal(G.els.tabbar, 240);
      maybeOffline();
    }, 500);
  }

  function maybeOffline() {
    setTimeout(() => {
      const off = G.computeOffline();
      if (off) G.showOfflineModal();
    }, 900);
  }

  // ---------- BINDINGS ----------
  function bind() {
    const $ = G.els;

    // pulls
    $.pullButton.addEventListener("click", () => G.doGachaPull(1));
    $.pullButtonX3.addEventListener("click", () => G.doGachaPull(3));

    // battle
    $.playPauseButton.addEventListener("click", G.toggleBattle);
    $.feedSkip.addEventListener("click", G.skipBattle);
    document.querySelectorAll(".speed-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        G.speed = parseInt(btn.dataset.speed, 10);
        document.querySelectorAll(".speed-btn").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    // tab nav
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const name = tab.dataset.tab;
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        if (name === "arena") {
          G.ui.closeDrawers();
          G.fx.pop($.arena);
        } else if (name === "forge") {
          G.ui.closeDrawers();
          G.openForgeModal();
        } else if (name === "armory") {
          G.ui.openDrawer("armory");
        } else if (name === "quests") {
          G.ui.openDrawer("quests");
        } else if (name === "feats") {
          G.ui.openDrawer("feats");
        }
      });
    });

    // drawers
    document.querySelectorAll(".drawer-close, [data-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.close;
        if (name) {
          document.querySelector(`.drawer[data-drawer="${name}"]`).classList.remove("open");
        }
        G.ui.closeDrawers();
      });
    });
    G.els.drawerScrim.addEventListener("click", G.ui.closeDrawers);
    G.els.sheetScrim.addEventListener("click", () => G.ui.toggleMenu(false));

    // menu
    $.menuButton.addEventListener("click", () => G.ui.toggleMenu(true));
    G.els.menuSheetClose.addEventListener("click", () => G.ui.toggleMenu(false));
    document.getElementById("armoryMenuButton").addEventListener("click", () => {
      G.ui.toggleMenu(false);
      G.ui.openDrawer("armory");
    });
    document.getElementById("bestiaryMenuButton").addEventListener("click", () => {
      G.ui.toggleMenu(false);
      G.ui.openDrawer("bestiary");
    });

    // armory
    document.querySelectorAll("#armoryFilters .filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#armoryFilters .filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        G.ui.currentFilter = btn.dataset.filter;
        G.ui.renderCollection();
        G.fx.staggerIn(G.els.collection, ".sword-item");
      });
    });

    // feats filter
    const featFilterRow = document.createElement("div");
    featFilterRow.className = "filter-row";
    featFilterRow.innerHTML = `
      <button class="filter-btn active" data-f="all">All</button>
      <button class="filter-btn" data-f="completed">Completed</button>`;
    G.els.featsList.parentElement.insertBefore(featFilterRow, G.els.featsList);
    featFilterRow.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        featFilterRow.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        G.ui.currentFeatFilter = btn.dataset.f;
        G.ui.renderFeats();
      });
    });

    // bestiary button → drawer
    $.bestiaryButton.addEventListener("click", () => G.ui.openDrawer("bestiary"));
    $.forgeShortcut.addEventListener("click", () => {
      G.ui.closeDrawers();
      G.openForgeModal();
    });

    // forge modal
    G.els.forgeClose.addEventListener("click", G.closeForgeModal);
    G.els.forgeModal.addEventListener("click", (e) => {
      if (e.target === G.els.forgeModal) G.closeForgeModal();
    });
    G.els.forgeExecute.addEventListener("click", G.executeForge);

    // preview modal
    G.els.previewClose.addEventListener("click", () => G.els.previewModal.classList.remove("show"));
    G.els.previewModal.addEventListener("click", (e) => {
      if (e.target === G.els.previewModal) G.els.previewModal.classList.remove("show");
    });

    // offline modal
    G.els.offlineModal.addEventListener("click", (e) => {
      if (e.target === G.els.offlineModal) G.els.offlineModal.classList.remove("show");
    });

    // chest/soul chips → actions
    $.chestChip.addEventListener("click", () => G.doGachaPull(1));
    $.soulChip.addEventListener("click", () => G.ui.openDrawer("armory"));

    // enchant
    $.enchantButton.addEventListener("click", () => {
      const cost = G.getEnchantCost();
      if (G.gameState.enchant >= G.ENCHANT_MAX) return;
      if (G.gameState.souls < cost) {
        G.toast("Not enough souls!", "#ff4d4d");
        return;
      }
      G.gameState.souls -= cost;
      G.gameState.enchant++;
      G.ui.updateStats();
      G.ui.updateHud();
      G.fx.burst($.enchantButton, "#b98aff", 16);
      G.fx.floatText($.enchantButton, `+5% dmg`, "#b98aff");
      G.toast(`⚒ Forge Mastery ${G.gameState.enchant} — all blades +5%`, "#b98aff");
      G.saveGame();
    });

    // save / reset / prestige
    $.saveButton.addEventListener("click", () => {
      G.saveGame();
      G.toast("💾 Game saved!", "#35c2ff");
    });
    $.resetButton.addEventListener("click", () => {
      if (!confirm("Reset ALL progress? This cannot be undone!")) return;
      localStorage.removeItem(G.SAVE_KEY);
      localStorage.removeItem(G.OLD_SAVE_KEY);
      location.reload();
    });
    $.prestigeButton.addEventListener("click", G.doPrestige);
  }

  // ---------- PRESTIGE ----------
  G.doPrestige = function () {
    if (!G.canPrestige()) return;
    if (!confirm(`Prestige to cycle ${G.gameState.prestige.count + 1}?\n\nResets level, kills, blades, chests.\nKeeps souls, mastery, pulls, prestige (+0.5% legendary rate).\nStart with 10 chests.`)) return;
    G.gameState.prestige.count++;
    G.gameState.prestige.bonus = G.gameState.prestige.count * 0.005;
    G.gameState.level = 1;
    G.gameState.levelProgress = 0;
    G.gameState.kills = 0;
    G.gameState.chests = 10;
    G.gameState.activeSwords = {};
    G.gameState.monsterKills = {};
    G.gameState.collection = { common: {}, rare: {}, epic: {}, legendary: {} };
    G.collection = G.gameState.collection;
    G.currentSwordIndex = null;
    G.comboStreak = 0;
    G.stopBattle();
    G.ui.updateAll();
    G.saveGame();
    G.fx.banner("♜", "PRESTIGE " + G.gameState.prestige.count, `Legendary rate +${(G.gameState.prestige.bonus * 100).toFixed(1)}%`, "#ffb347");
    G.toast(`♜ Prestige ${G.gameState.prestige.count}!`, "#ffb347");
  };

  // ---------- INIT ----------
  function init() {
    G.els.app.classList.add("hidden");
    const migrated = G.loadGame();
    G.quests.init();
    G.ui.updateAll();
    G.ui.closeDrawers();

    bind();
    runBoot();

    setInterval(G.saveGame, 30000);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) G.saveGame();
    });
    window.addEventListener("beforeunload", () => G.saveGame());

    // keyboard shortcut
    document.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.code === "Space") {
        e.preventDefault();
        G.toggleBattle();
      } else if (e.code === "KeyC") {
        G.doGachaPull(1);
      } else if (e.key.toLowerCase() === "s") {
        G.skipBattle();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
