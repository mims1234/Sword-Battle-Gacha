# Idle Blade Master: the 1000-floor plan

This explains how the game gets to 1000 floors without hand-making 1000 floors of content, and how it is set up for paid items later. Version 5.0 is the first step, and it is already built.

## 1. Making the game huge without making it by hand

The new content is generated from fixed seeds in `js/data.realms.js`. It is the same on every device and adds no art files.

| Layer | Count | How it is made |
|---|---|---|
| Floors | 1000 | 10 **realms** of 100 floors. Each realm reuses the 7 areas with its own colour tint, so 70 area looks in all. |
| Bosses | 100 | One every 10 floors. Each gets a generated name, a monster sprite recoloured for its realm, and 1–2 **mechanics** (Ironhide, Undying, Broodmother, Swift, Wrathful, Thorned). Floors 100, 200 … are **Realm Lords** with 2 mechanics and more health. Floor 1000 is **Nihl, the Throne Below**. |
| Summonable blades | 300 | The 30 original blades, plus 30 reforged blades per realm (recoloured sprites, new names, rotated elements). Each realm's blades are 20× stronger than the realm before. |
| Extra blades (v5.1) | 400 | 40 more per realm (14 Common, 12 Rare, 8 Epic, 6 Legendary). |
| Blade designs | 770 generated + 30 hand-drawn | `js/art.blades.js` draws a unique 32 px pixel-art sword from each blade's seed: 12 blade shapes, 8 guards, realm metals, element sparks, glowing cores on Legendaries. Preview them with `node tools/preview-blades.js out.png 64`. |
| Boss blades | 100 | One signature blade per boss. Only that boss drops it, in the Boss Gate. It is 1.25× a summoned Legendary of the same realm. |

**Save safety rule:** a blade is saved by its index in `SWORDS_DATA`. New content must always be **appended**, never reordered.

### Difficulty curve
- Floors 1–100 keep the original curve.
- After floor 100, monster health and attack grow 7% per floor. That is the same rate as gold, so levels alone keep up with roughly 40× per realm and the blades of each new realm cover the rest.
- `node tools/balance-check.js` prints where a team gets stuck in each realm. Today a team of Legendaries from the current realm stalls about 60–90% of the way through. A team from one realm behind stalls near the realm's first floors. That stall is what pushes players to summon and to use the Boss Gate.
- The long-term upgrades now go further: The Edge, The Bulwark and The Reaper go up to level 100 instead of 25, which gives Essence a use for the whole climb.

### How to grow it further (all data-only)
1. **More realms past 1000:** add entries to `G.REALMS` and raise `G.MAX_FLOOR`. Blades and bosses are generated for the new realms automatically, as long as they are appended.
2. **More boss mechanics:** add an entry to `G.BOSS_MECH` and one rule in `sim.js`.
3. **New sprite sheets:** add a sheet and a `sheet` field on catalog entries. Recolouring already works for any sprite.
4. **Seasonal events:** a time-limited realm built with the same generator and a featured element banner.

### Music
The area music is a dark-fantasy acoustic and chamber-orchestral RPG score: slow (50–80 bpm), warm and dark, in minor and modal keys, played on harp, felt piano, nylon guitar, cello, flute, low brass, wordless choir and taiko. Everything new is written for that same sound (`SCORE` in `tools/make-music.mjs`):
- **Music loops (Lyria 3 Pro, full songs, cut into seamless loops):** summon altar, shop, Boss Gate, Realm Lord, final boss, and one theme for each of realms II–X. In those realms the realm theme takes turns with the area themes, one 10-floor area each.
- **Short pieces (Lyria 3 Clip gives 30 seconds; the tool keeps the best opening gesture and cuts it on a breath):** one summon reveal per rarity (Common to Mythic), summon charge, level up, unlock, boss appears, boss down, rebirth, event, defeat, secret, plus the new victory (8–14 s), new realm, Boss Gate win and purchase.

## 2. Monetisation-ready design (simulated today)

### What is built now
- **Shop tab** (the `+` next to gems, or the Shop tab): a test store. Every purchase is simulated and free, and the screen says so.
- **Gem packs** at 5 price points. The first purchase of each pack gives double gems.
- **Offers:** Starter Pack (one-time), Moon Pass (30 days of daily gems and keys), and Realm Bundle (unlocks in Realm II).
- **Items bought with gems.** Each one has a real use in the game:
  - **Boss Key:** an extra Boss Gate fight. There is still one free fight per day.
  - **Gold Elixir:** double gold for 30 minutes.
  - **Fury Tonic:** +50% damage for 30 minutes.
  - **Time Warp:** 2 hours of progress at once.
  - **Lucky Charm:** double Legendary summon odds for 10 minutes.
- **Free routes to everything:** a daily gift of gems, the daily free Boss Gate fight, gems from quests, bosses and achievements, and a guaranteed boss blade on the 4th Boss Gate win without one. Nothing in the game needs money.

### Plugging in real payments later
`js/shop.js` has two layers:
- `G.shop`: the catalogue and what each item grants. This is game design.
- `G.store.purchase(sku) → Promise<receipt>`: the payment provider. Today it is `"sandbox"`.

To go live, swap in a provider: Google Play Billing (Android/TWA), StoreKit (iOS wrapper) or Stripe Checkout (web). Then:
1. Verify each receipt **on a server** before calling `G.shop.grant`. Right now the save is local and can be edited, so a server-side gem balance is required before taking real money.
2. Keep receipt ids (already stored in `s.shop.receipts`) for refunds and support.
3. Move the gem balance and purchases to an account so they survive a new device.

### Rules to plan for before charging money
- Publish summon odds in the game. The summon screen already shows them, and the pity counter is visible.
- Loot boxes are regulated or restricted in some regions (for example Belgium, and the Netherlands in some cases). Make sure paid gems can always be spent on direct purchases, which the item shop already allows.
- Store age ratings and parental spending limits.
- Avoid pay-to-skip pressure. Defeats show free advice first, and the shop is never forced on the player.

### Later monetisation ideas (not built)
- Cosmetic **blade skins** (hue and aura) and **arena themes**. They don't change balance and players accept them most easily.
- A season **Blade Pass** with free and premium tracks, built on the existing quests.
- **Element-selector banners** that let the player choose the featured element.
- Extra mission slots and offline time as a subscription perk.

## 3. Files
- `js/data.realms.js`: realms, bosses, generated blade catalogue
- `js/shop.js`: catalogue, item effects, store provider
- `js/sim.js`: boss mechanics, Boss Gate, realm-based summon pool, the floor 1000 ending
- `js/ui.js`: Shop and Boss Gate screens, test checkout, buff and gate status chips
- `tools/safety-test.js`: now also covers the catalogue, shop, Boss Gate and hostile save data
- `tools/balance-check.js`: where teams get stuck in each realm
