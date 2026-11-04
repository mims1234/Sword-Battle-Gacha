// ===================== SHOP + STORE (no DOM in this file) =====================
// Two layers:
//  1. The catalog and what each item does in the game (grant / use). This is the game design.
//  2. G.store: the payment provider. Today it is "sandbox": every purchase is free and only
//     simulated. A real build swaps in a provider (Google Play Billing, App Store, Stripe...)
//     with the same purchase(sku) -> Promise<receipt> shape, and verifies receipts on a server
//     before calling G.shop.grant. Nothing else in the game needs to change.
(function () {
  const G = window.G, SH = (G.shop = {});

  // ---------- catalog ----------
  // Real-money items. usd is the planned price; the sandbox never charges it.
  SH.PACKS = [
    { sku: "gems_1", name: "Handful of Gems", gems: 15, usd: 0.99, art: 1 },
    { sku: "gems_2", name: "Pouch of Gems", gems: 80, usd: 4.99, art: 2, tag: "+7%" },
    { sku: "gems_3", name: "Chest of Gems", gems: 170, usd: 9.99, art: 3, tag: "Popular" },
    { sku: "gems_4", name: "Vault of Gems", gems: 360, usd: 19.99, art: 4, tag: "+20%" },
    { sku: "gems_5", name: "Dragon Hoard", gems: 1000, usd: 49.99, art: 5, tag: "Best value" },
  ];
  SH.OFFERS = [
    { sku: "starter", name: "Starter Pack", usd: 2.99, once: true, desc: "60 gems, 3 Boss Keys, 1 Lucky Charm and an Epic blade of your deepest realm", gives: { gems: 60, key: 3, charm: 1, epic: 1 }, col: "#7dff8f" },
    { sku: "moonpass", name: "Moon Pass (30 days)", usd: 4.99, desc: "50 gems now, then 8 gems and 1 Boss Key every day you claim them for 30 days", gives: { gems: 50, pass: 30 }, col: "#b56bff" },
    { sku: "realm_bundle", name: "Realm Bundle", usd: 9.99, desc: "120 gems, 5 Boss Keys, 2 Time Warps and a Legendary blade of your deepest realm", gives: { gems: 120, key: 5, warp: 2, legend: 1 }, col: "#ffab2e", needRealm: 1 },
  ];
  // Items bought with gems. These are the things a player uses; gems are how they get them.
  SH.ITEMS = {
    key: { name: "Boss Key", icon: "⚿", gems: 5, col: "#ffab2e", desc: "One extra fight in the Boss Gate. Bosses drop their own blades there." },
    elixir: { name: "Gold Elixir", icon: "⚱", gems: 4, col: "#ffd24a", desc: "Double gold from every monster for 30 minutes." },
    tonic: { name: "Fury Tonic", icon: "✦", gems: 4, col: "#ff5a4a", desc: "+50% damage for your whole team for 30 minutes." },
    warp: { name: "Time Warp", icon: "⧗", gems: 8, col: "#62dcff", desc: "Instantly get 2 hours of fighting at full speed." },
    charm: { name: "Lucky Charm", icon: "☘", gems: 10, col: "#7dff8f", desc: "Doubles Legendary summon odds for 10 minutes." },
  };
  SH.ITEM_KEYS = Object.keys(SH.ITEMS);
  SH.BUFF_MIN = 30;
  SH.PASS_DAILY = { gems: 8, key: 1 };
  SH.FREE_DAILY = { gems: 2 };

  const today = () => G.day();
  SH.passDays = () => Math.max(0, Math.ceil((G.s.shop.passEnd - Date.now()) / 864e5));
  SH.passReady = () => Date.now() < G.s.shop.passEnd && G.s.shop.passDay !== today();
  SH.freeReady = () => G.s.shop.freeDay !== today();
  SH.isFirst = (sku) => !G.s.shop.first[sku];
  SH.owned = (sku) => !!G.s.shop.once[sku];
  SH.findSku = (sku) => SH.PACKS.find((p) => p.sku === sku) || SH.OFFERS.find((o) => o.sku === sku);
  SH.ready = () => SH.freeReady() || SH.passReady();

  // A blade of the deepest realm reached, at a given tier. Used by bundles.
  function realmBlade(tier) {
    const r = G.realmOf(G.s.best), pool = G.SW.filter((w) => w.rarity === tier && !w.sig && w.realm === r);
    const b = G.newBlade(G.pick(pool).index, tier); G.s.blades.push(b); return b;
  }

  // ---------- granting (called only after the store confirms payment) ----------
  SH.grant = function (sku) {
    const s = G.s, it = SH.findSku(sku), out = { gems: 0, items: {}, blades: [] };
    if (!it) return null;
    if (it.gems) { out.gems = it.gems * (SH.isFirst(sku) ? 2 : 1); s.shop.first[sku] = 1; }
    const g = it.gives || {};
    if (g.gems) out.gems += g.gems;
    SH.ITEM_KEYS.forEach((k) => { if (g[k]) { s.items[k] += g[k]; out.items[k] = g[k]; } });
    if (g.epic) out.blades.push(realmBlade("epic"));
    if (g.legend) out.blades.push(realmBlade("legendary"));
    if (g.pass) s.shop.passEnd = Math.max(Date.now(), s.shop.passEnd) + g.pass * 864e5;
    if (it.once) s.shop.once[sku] = 1;
    s.sigils += out.gems;
    G.log(`Bought ${it.name}${out.gems ? ": +" + out.gems + " gems" : ""}`, "#6fd6ff");
    G.refreshBlades && G.refreshBlades();
    return out;
  };

  // ---------- gem purchases and item use ----------
  SH.buyItem = function (k, n) {
    const s = G.s, it = SH.ITEMS[k], cost = it.gems * (n || 1);
    if (!it || s.sigils < cost) return false;
    s.sigils -= cost; s.items[k] += n || 1; return true;
  };
  SH.useItem = function (k) {
    const s = G.s;
    if (!s.items[k] || k === "key") return null;
    s.items[k]--;
    if (k === "elixir" || k === "tonic") { const b = k === "elixir" ? "gold" : "dmg"; s.buff[b] = Math.max(Date.now(), s.buff[b]) + SH.BUFF_MIN * 60e3; return { k }; }
    if (k === "charm") { G.starfall(); return { k }; }
    if (k === "warp") { if (G.rift || G.gate) { s.items[k]++; return null; } const r = G.offline(2 * 3600, true); G.recalc(); G.startFloor(); return { k, r }; }
    return null;
  };
  SH.claimFree = function () { if (!SH.freeReady()) return null; G.s.shop.freeDay = today(); G.s.sigils += SH.FREE_DAILY.gems; return SH.FREE_DAILY; };
  SH.claimPass = function () { if (!SH.passReady()) return null; const s = G.s; s.shop.passDay = today(); s.sigils += SH.PASS_DAILY.gems; s.items.key += SH.PASS_DAILY.key; return SH.PASS_DAILY; };

  // ---------- store provider ----------
  G.store = {
    provider: "sandbox",
    // Returns a Promise of a receipt. A real provider opens the platform checkout here.
    purchase(sku) {
      const it = SH.findSku(sku);
      if (!it) return Promise.reject(new Error("unknown item"));
      if (it.once && SH.owned(sku)) return Promise.reject(new Error("already owned"));
      return Promise.resolve({ sku, usd: it.usd, t: Date.now(), id: "test_" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36) });
    },
  };
  // Full flow used by the UI: pay, record the receipt, grant.
  SH.checkout = function (sku) {
    return G.store.purchase(sku).then((rc) => {
      G.s.shop.receipts.push({ sku: rc.sku, t: rc.t, usd: rc.usd, id: rc.id });
      if (G.s.shop.receipts.length > 50) G.s.shop.receipts.shift();
      return SH.grant(sku);
    });
  };
  SH.spent = () => G.s.shop.receipts.reduce((a, r) => a + (r.usd || 0), 0);
})();
