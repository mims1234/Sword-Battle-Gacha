// ===================== BATTLE SYSTEM =====================
(function () {
  const G = Game;

  let pending = null; // { timer, finish, done }

  const DELAYS = { legendary: 900, epic: 1400, rare: 1800, common: 2200 };

  G.isBattling = () => !!pending && !pending.done;

  function getDamage(sword, monster) {
    const levelMult = 1 + (G.gameState.level - 1) * 0.1;
    const enchantMult = G.getTotalDamageMult();
    let dmg = sword.attack * levelMult * enchantMult;
    dmg *= 1 + G.getComboBonus();
    const counter = G.isCountered(sword, monster);
    if (counter) dmg *= 1.5;
    const crit = G.rollCrit();
    if (crit) dmg *= 2;
    return { dmg, crit, counter };
  }

  G.rollCrit = function () {
    const chance = 0.05 + (G.gameState.level - 1) * 0.01;
    return Math.random() < Math.min(chance, 0.5);
  };

  G.getComboBonus = function () {
    return Math.min(G.comboStreak * 0.05, 0.5);
  };

  G.stopBattle = function () {
    if (pending) {
      clearTimeout(pending.timer);
      pending = null;
    }
    G.autoPlay = false;
    G.ui && G.ui.updatePlayButton();
  };

  G.simulateBattle = function (sword) {
    if (!sword || !G.gameState.activeSwords[sword.index]) return;
    if (G.isBattling()) return;

    if (pending) {
      clearTimeout(pending.timer);
      pending = null;
    }

    const monster = G.pick(G.monsterTypes);
    const { dmg, crit, counter } = getDamage(sword, monster);
    const special =
      (sword.rarity === "legendary" && Math.random() < 0.15) ||
      (sword.rarity === "epic" && Math.random() < 0.08);
    const defeated = special
      ? sword.rarity === "legendary"
        ? 5
        : 3
      : 1;

    G.ui.updateFoe(monster);
    G.ui.showFoeHp(monster.health);
    G.els.foeHpBar.style.display = "block";

    const turns = G.clamp(Math.ceil(monster.health / Math.max(dmg, 1)), 1, 8);
    const turnMs = 420 / G.speed;
    const battleMs = turns * turnMs;

    G.fx.swingFoe(G.els.foeSlot.querySelector("canvas") || G.els.foeSlot);
    setTimeout(() => {
      G.fx.floatDmg(dmg, crit, undefined, undefined);
    }, 140);

    const elementMsg = counter
      ? ` <span style="color:${G.ELEMENTS[sword.element].color}">[${G.ELEMENTS[sword.element].ico} advantage!]</span>`
      : "";
    G.ui.feed(
      `🗡️ ${crit ? "⚡CRIT⚡ " : ""}<b style="color:${G.rarityColors[sword.rarity]}">${sword.name}</b> vs ${monster.type}${elementMsg}`,
    );

    // animate hp draining
    G.fx.hpTween(G.els.foeHpFill, 100, 200);
    setTimeout(() => G.fx.hpTween(G.els.foeHpFill, 8, battleMs * 0.6), battleMs * 0.2);

    const finish = () => {
      if (!pending || pending.done) return;
      pending.done = true;
      pending = null;

      G.fx.defeatFoe(G.els.foeSlot.querySelector("canvas") || G.els.foeSlot);
      G.els.foeHpBar.style.display = "none";
      G.fx.burst(G.els.foeSlot, counter ? G.ELEMENTS[sword.element].color : "#ffb347", 12, 90);

      // uses
      G.gameState.activeSwords[sword.index]--;
      if (G.gameState.activeSwords[sword.index] <= 0) {
        delete G.gameState.activeSwords[sword.index];
        G.currentSwordIndex = null;
        G.comboStreak = 0;
        G.ui.updateBlade();
        G.ui.updatePlayButton();
        G.fx.toast(`${sword.name} is spent! Forge more blades.`, "#8a90a0");
      }

      // streak
      G.comboStreak++;
      if (G.comboStreak > G.gameState.bestStreak)
        G.gameState.bestStreak = G.comboStreak;

      // kills + level ups
      G.addKills(defeated, monster);

      // chests
      const chestGain = monster.chestReward * defeated;
      if (chestGain > 0) G.addChests(chestGain, true);

      // souls
      const soulVal = G.SOUL_BASE[monster.difficulty] || 1;
      if (monster.chestReward > 0 || Math.random() < 0.4) {
        const soulGain = soulVal * defeated;
        G.addSouls(soulGain);
        G.fx.floatText(G.els.soulChip, `+${soulGain} ✦`, "#b98aff");
      }

      G.gameState.totalDmg += dmg;

      G.ui.feed(
        special
          ? `✨ <b style="color:${G.rarityColors[sword.rarity]}">${sword.specialPower}</b> — ${sword.name} slew ${defeated} ${monster.type}s!`
          : `⚔ <b style="color:${G.rarityColors[sword.rarity]}">${sword.name}</b> felled ${monster.type} in ${turns} turn${turns > 1 ? "s" : ""} (${dmg.toFixed(0)} dmg)`,
      );

      G.ui.updateAll();
      G.quests && G.quests.progress("kills", defeated, monster);

      if (G.autoPlay && G.currentSwordIndex !== null) {
        const next = G.swordData.find((s) => s.index === G.currentSwordIndex);
        if (next && G.gameState.activeSwords[next.index] > 0) {
          const inter = (DELAYS[next.rarity] || 1800) / G.speed;
          pending = {
            timer: setTimeout(() => {
              pending = null;
              G.simulateBattle(next);
            }, inter),
            done: false,
          };
          return;
        }
      }
      G.autoPlay = false;
      G.ui.updatePlayButton();
    };

    pending = { timer: setTimeout(finish, battleMs), done: false, finish };

    G.saveGame();
  };

  // ---------- skip current battle ----------
  G.skipBattle = function () {
    if (pending && !pending.done) {
      clearTimeout(pending.timer);
      pending.done = true;
      const fn = pending.finish;
      pending = null;
      fn();
    }
  };

  // ---------- play / pause toggle ----------
  G.toggleBattle = function () {
    if (G.currentSwordIndex === null || !G.gameState.activeSwords[G.currentSwordIndex]) {
      G.toast("Select a blade first!", "#35c2ff");
      G.openDrawer("armory");
      return;
    }
    if (G.autoPlay || G.isBattling()) {
      G.stopBattle();
      return;
    }
    G.autoPlay = true;
    G.ui.updatePlayButton();
    const sw = G.swordData.find((s) => s.index === G.currentSwordIndex);
    if (sw) G.simulateBattle(sw);
  };
})();
