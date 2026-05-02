// ===================== OVERLAY QUEUE =====================
(function () {
  const G = Game;

  G.overlayQueue = {
    queue: [],
    isDisplaying: false,

    add(overlay, duration) {
      this.queue.push({ overlay, duration });
      if (!this.isDisplaying) this.displayNext();
    },

    displayNext() {
      if (this.queue.length === 0) {
        this.isDisplaying = false;
        const c = G.els.overlayContainer;
        if (c) c.innerHTML = "";
        if (G.autoPlay && G.currentSwordIndex !== null && G.gameState.activeSwords[G.currentSwordIndex] > 0) {
          const sw = G.swordData.find(s => s.index === G.currentSwordIndex);
          if (sw) setTimeout(() => G.simulateBattle(sw), 150);
        }
        return;
      }

      this.isDisplaying = true;
      const { overlay, duration } = this.queue.shift();
      const c = G.els.overlayContainer;
      if (!c) { this.displayNext(); return; }
      c.innerHTML = "";
      c.appendChild(overlay);

      setTimeout(() => {
        overlay.remove();
        this.displayNext();
      }, duration);
    }
  };
})();
