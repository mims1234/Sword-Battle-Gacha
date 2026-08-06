// ===================== GACHA / FORGE =====================
(function () {
  const G = Game;

  // ---------- result container injected into stage ----------
  let resultBox = null;
  function ensureResultBox() {
    if (resultBox) return resultBox;
    resultBox = document.createElement("div");
    resultBox.id = "gachaResult";
    resultBox.style.cssText = `
      display:flex; flex-wrap:wrap; justify-content:center; gap:12px;
      max-width:640px; margin:0 auto; perspective:800px; min-height:0;
    `;
    const stage = document.getElementById("stage");
    stage.insertBefore(resultBox, document.getElementById("stageActions"));
    return resultBox;
  }

  // ---------- grant a sword to the player ----------
  G.grantSword = function (sw, rarity) {
    const uses = G.getSwordUseLimit(rarity);
    G.gameState.activeSwords[sw.index] =
      (G.gameState.activeSwords[sw.index] || 0) + uses;
    if (!G.gameState.collection[rarity][sw.index])
      G.gameState.collection[rarity][sw.index] = 0;
    G.gameState.collection[rarity][sw.index]++;
    return uses;
  };

  // ---------- single roll ----------
  G.rollSword = function () {
    let rarity = G.getRandomRarity();
    rarity = G.getPityRarity(rarity);
    const sword = G.getRandomSword(rarity);
    G.applyPity(rarity);
    G.gameState.totalPulls++;
    G.grantSword(sword, rarity);
    return { sword, rarity };
  };

  // ---------- do a pull (1 or 3) ----------
  G.doGachaPull = function (count) {
    if (!G.isImageLoaded || !G.swordData.length) {
      G.toast("Loading blade data...", "#35c2ff");
      return;
    }
    count = count || 1;
    if (G.gameState.chests < count) {
      G.toast("Not enough chests! ⚔ Battle monsters for more.", "#ff4d4d");
      G.fx.pop(G.els.chestChip);
      return;
    }
    G.gameState.chests -= count;
    G.ui.updateHud();

    const results = [];
    let bestRank = 0;
    for (let i = 0; i < count; i++) {
      const r = G.rollSword();
      results.push(r);
      bestRank = Math.max(bestRank, G.rarityOrder.indexOf(r.rarity));
    }
    const bestRarity = G.rarityOrder[bestRank];

    const box = ensureResultBox();
    box.innerHTML = "";
    const cards = results.map((r) => {
      const card = document.createElement("div");
      card.className = `gacha-card rarity-${r.rarity}`;
      card.style.opacity = "0";
      card.innerHTML = `
        <canvas width="120" height="120"></canvas>
        <div class="gacha-rarity">${r.rarity.toUpperCase()}</div>
        <div class="gacha-name">${r.sword.name}</div>
        <div class="gacha-el el-pill el-${r.sword.element || "steel"}">${
          G.ELEMENTS[r.sword.element || "steel"].ico
        } ${G.ELEMENTS[r.sword.element || "steel"].label}</div>
        <div class="gacha-desc">${r.sword.description}</div>
        <div class="gacha-stats">⚔ <b>${r.sword.attack}</b> · 🛡 <b>${r.sword.defense}</b>${
          r.sword.specialPower ? ` · ✨ ${r.sword.specialPower}` : ""
        }</div>
        <div class="gacha-uses">Uses: ${G.gameState.activeSwords[r.sword.index]}</div>`;
      box.appendChild(card);
      G.drawSword(card.querySelector("canvas"), r.sword.index, 120);
      card.style.color = G.rarityColors[r.rarity];
      return card;
    });

    // stagger reveal
    cards.forEach((card, i) => {
      setTimeout(() => G.fx.cardIn(card), i * 140);
    });

    // celebration FX for best card
    const bestCard = cards[bestRank] || cards[0];
    setTimeout(() => {
      if (bestRank >= 2) {
        G.fx.rays(bestCard);
        G.fx.burst(bestCard, G.rarityColors[bestRarity], bestRank === 3 ? 30 : 20);
        if (bestRank === 3) {
          G.fx.shake(5);
          G.fx.banner("👑", bestRarity.toUpperCase() + " BLADE!", results[bestRank] ? results[bestRank].sword.name : "", G.rarityColors[bestRarity]);
        }
      }
    }, cards.length * 140 + 250);

    // cleanup box
    setTimeout(() => {
      anime({ targets: box.children, opacity: 0, translateY: -14, duration: 260, easing: "easeInCubic", complete: () => { box.innerHTML = ""; } });
    }, 3400);

    // auto-equip if none selected
    if (G.currentSwordIndex === null) {
      const first = results.find((rr) => rr.sword)?.sword;
      if (first) G.selectSword(first);
    }

    G.ui.updateAll();
    G.quests && G.quests.progress("pulls", count);
    G.toast(
      `🗡️ ${bestRarity.toUpperCase()}: ${results[bestRank] ? results[bestRank].sword.name : ""}`,
      G.rarityColors[bestRarity],
    );
    G.saveGame();
  };

  // ---------- select a sword ----------
  G.selectSword = function (sw) {
    if (!sw || !G.gameState.activeSwords[sw.index]) return;
    G.currentSwordIndex = sw.index;
    G.ui.updateBlade();
    G.ui.renderCollection();
    G.fx.pop(G.els.bladeSlot);
    G.closeModals();
    G.ui.closeDrawers();
  };

  // ---------- sword preview ----------
  G.showSwordPreview = function (sw) {
    const m = G.els.previewModal;
    const e = G.ELEMENTS[sw.element || "steel"];
    G.els.previewName.textContent = sw.name;
    G.els.previewRarity.textContent = sw.rarity.toUpperCase();
    G.els.previewRarity.className = "preview-rarity rarity-" + sw.rarity;
    G.els.previewDesc.textContent = sw.description;
    G.els.previewAtk.textContent = sw.attack;
    G.els.previewDef.textContent = sw.defense;
    G.els.previewElement.textContent = `${e.ico} ${e.label}`;
    G.els.previewElement.className = "el-pill el-" + sw.element;
    G.els.previewPower.innerHTML = sw.specialPower ? `✨ <b>${sw.specialPower}</b>` : "";
    const uses = G.gameState.activeSwords[sw.index] || 0;
    const can = uses > 0;
    G.els.previewUses.textContent = can
      ? `⚔ ${uses} uses remaining`
      : "❌ No uses left";
    G.els.previewUses.style.color = can ? "#ffb347" : "#ff4d4d";
    G.els.previewSelectBtn.disabled = !can;
    G.els.previewSelectBtn.textContent = can ? "Select for Battle" : "No Uses Left";
    G.els.previewSelectBtn.onclick = () => G.selectSword(sw);
    G.els.previewSprite.innerHTML = "";
    const cv = document.createElement("canvas");
    G.els.previewSprite.appendChild(cv);
    G.drawSword(cv, sw.index, 128);
    G.els.previewSprite.style.color = G.rarityColors[sw.rarity];
    G.fx.reveal(m.querySelector(".modal-card"));
    m.classList.add("show");
  };

  // ---------- modals ----------
  G.closeModals = function () {
    ["forgeModal", "previewModal"].forEach((id) => {
      const m = G.els[id];
      if (m) m.classList.remove("show");
    });
  };

  G.openForgeModal = function () {
    G.forgeSelectedSword = null;
    G.renderForgeSelection();
    G.els.forgeModal.classList.add("show");
    G.fx.reveal(G.els.forgeModal.querySelector(".modal-card"));
  };

  G.closeForgeModal = () => G.els.forgeModal.classList.remove("show");

  G.renderForgeSelection = function () {
    const grid = G.els.forgeSelectionGrid;
    const actionArea = G.els.forgeActionArea;
    const avail = G.getForgeableSwords();

    grid.innerHTML = "";
    if (avail.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#8a90a0;padding:18px">
        No blades ready to forge.<br>Need <b>5 Stone</b>, <b>10 Frost</b>, or <b>25 Arcane</b> copies.</div>`;
      actionArea.style.display = "none";
      return;
    }

    avail.forEach((sw) => {
      const req = G.getForgeRequirement(sw.rarity);
      const count = G.gameState.collection[sw.rarity][sw.index];
      const item = document.createElement("div");
      item.className = `sword-item ${sw.rarity} ${G.forgeSelectedSword === sw ? "selected" : ""}`;
      item.innerHTML = `<canvas width="64" height="64"></canvas>
        <div class="sword-uses-badge">${count}/${req}</div>`;
      G.drawSword(item.querySelector("canvas"), sw.index, 64);
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
      const count = G.gameState.collection[sw.rarity][sw.index];
      const next = G.getNextRarity(sw.rarity);
      G.els.forgeSelectedSlot.innerHTML = '<canvas width="40" height="40"></canvas>';
      G.drawSword(G.els.forgeSelectedSlot.querySelector("canvas"), sw.index, 40);
      G.els.forgeCostText.innerHTML =
        `Cost: <b style="color:#ff4d4d">${req}</b> ${sw.name} copies · You have <b>${count}</b>`;
      G.els.forgeExecute.disabled = count < req;
      G.els.forgeExecute.innerHTML = `Forge → ${G.ELEMENTS[sw.element || "steel"].ico} ${next.toUpperCase()}`;
    } else {
      actionArea.style.display = "none";
    }
  };

  G.executeForge = function () {
    if (!G.forgeSelectedSword) return;
    const src = G.forgeSelectedSword;
    const rarity = src.rarity;
    const next = G.getNextRarity(rarity);
    const req = G.getForgeRequirement(rarity);
    if (G.gameState.collection[rarity][src.index] < req) return;

    G.gameState.collection[rarity][src.index] -= req;
    if (G.gameState.collection[rarity][src.index] <= 0)
      delete G.gameState.collection[rarity][src.index];

    const newSword = G.getRandomSword(next);
    G.grantSword(newSword, next);

    G.fx.burst(G.els.forgeExecute, G.rarityColors[next], next === "legendary" ? 26 : 16);
    G.toast(`🔨 Forged ${newSword.name} (${next.toUpperCase()})!`, G.rarityColors[next]);
    if (next === "legendary") {
      G.fx.banner("👑", "LEGENDARY FORGED!", newSword.name, G.rarityColors.legendary);
      G.fx.shake(5);
    }

    G.forgeSelectedSword = null;
    G.renderForgeSelection();
    G.ui.updateAll();
    G.quests && G.quests.progress("forge", 1);
    G.saveGame();
  };
})();
