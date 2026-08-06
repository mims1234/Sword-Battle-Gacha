# Idle Blade Master — v2 "Reforged" (Draft PR)

Branch: `v2` → `main` (9 feature commits, no push yet)

## What changed

### New UI / UX (mobile-first, full-viewport)
- Boot screen with anime.js intro (loading bar + title letters).
- New HUD: level/XP bar, pity progress, chest & soul chips, gold/stats row.
- Arena stage with animated monster + blade slots, floating damage, hp tween.
- Action group: Open Chest (x1/x3), Battle play/pause, speed selector 1x/2x/4x, Skip, Souls gain feed.
- Bottom tab bar (Brawl-Stars style) on mobile → collapsible side rails on desktop (≥900px).
- Side drawers: Armory, Quests, Feats, Bestiary with rarity/quality filters.
- Menus/sheets: Settings, Forge (craft/manage with grid), Offline-earnings modal, Sword Preview.
- Glassmorphism panels, dark abyssal "Reforged" theme, neon ember/orange accents + rarity glows, animated ember particle field.
- All FX via vendored anime.js v3.2.2 (`js/vendor/anime.min.js`): toasts, banners, bursts, reveal cards with rarity rays, card/foe animations, count-ups; honors `prefers-reduced-motion`.

### New gameplay
- **Sword elements** (fire/ice/lightning/holy/void/poison/steel) with +50% damage vs matching monster categories.
- **Souls currency** earned from kills; **Forge Mastery** enchant (+5% dmg/level, max 20).
- **Chest shards** via `getShardCost`; craft chests at forge.
- **x3 pull**, battle speed 1x/2x/4x, **skip battle**, daily quests (seeded by date), **offline earnings** (rate-based, 8h cap).
- **Prestige** cycles (+0.5% legendary rate per cycle), **bestiary** completion damage bonus.
- **Legacy save migration**: `idle_blade_master_save` (v1) → `idle_blade_master_v3`.

### Data
- `js/data.swords.js`: 30 swords, each with new `element` field (inlined as JS so the game runs from `file://` without a server).
- `js/data.monsters.js`: 64 monsters (unchanged content; category derived via regex map in `js/core.js`).
- Former `swords.json` / `monsters.json` replaced by the above script-loaded data to avoid CORS fetch failures when opening `index.html` directly.

## What was removed
- `js/overlay.js`, `script.bak.js`
- `css/effects.css`, `css/animations/*`, `css/components/*` (all consolidated into new `css/*.css` modules)
- Old topbar/footer layout (replaced by drawer + tabbar system)
- x5 pull and old battle loop

## Verified
- Playwright headless (Chromium) smoke tests, zero console/page errors:
  - Full flow: boot → data load → x1/x3 pull → battle → armory → preview → select → quests → menu → forge → save → reload.
  - Gameplay: autobattle, 4x speed, forge 5×common→rare, enchant, prestige, offline (2h), legacy migration.
  - Desktop layout: tabbar hidden, drawers as side rails, no horizontal overflow.
- All JS `node --check` clean; JSON valid; all `G.els` IDs exist in HTML.

## How to run
Serve the folder statically (`python -m http.server` or similar) and open `index.html`.

## Notes for review
- Offline earnings tuned conservatively (0.05 chests + 0.4 souls per kill-equivalent).
- Cache-busting query params on script/style tags to avoid stale v1 assets.
- Save version `v3`; legacy v1 save auto-migrates on first load.
