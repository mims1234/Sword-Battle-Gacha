# Draws the game's blades with AI in the style of assets/sprite_swords.png, then turns them into
# game-ready 32x32 sprites. Every step saves its result in tools/.art-raw/ (git-ignored), so a
# stopped run picks up where it left off; delete a file there to redo that piece.
#
#   node tools/blade-slots.js                    list every catalog blade that needs art (slots.json)
#   python tools/make-blade-art.py concepts      write a unique idea, name, element and ultimate for every blade
#   python tools/make-blade-art.py sheets        draw every sheet (image model), 4 at a time
#   python tools/make-blade-art.py cut           cut every sheet into 32x32 sprites
#   python tools/make-blade-art.py match         an AI looks at the sprites and matches each to its idea
#   python tools/make-blade-art.py build         pack assets/blades.png + js/data.blade-art.js
#   python tools/make-blade-art.py all           everything above, in order
#   python tools/make-blade-art.py redo <sheet>  forget one sheet and draw it again
#
# Needs OPENROUTER_API_KEY in .env and Pillow.
import base64, collections, concurrent.futures as cf, io, json, os, re, sys, time, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "tools", ".art-raw")
IMAGE_MODEL = os.environ.get("ART_MODEL", "google/gemini-3-pro-image")
TEXT_MODEL = os.environ.get("TEXT_MODEL", "anthropic/claude-sonnet-5.5")
ELEMENTS = ["fire", "ice", "lightning", "holy", "void", "poison", "steel"]
REALM_THEME = [
    "The Upper Deep: goblin warrens, catacombs, wild forest, swamp, cinder pit, dragon peaks, ruined cathedral. Classic fantasy dungeon.",
    "The Ember Halls: a forge city of cooling lava, obsidian, magma, smiths, salamanders, ash.",
    "The Frostbound Vaults: ice, glaciers, snow, crystal, aurora, frozen beasts, silver and pale blue.",
    "The Sunless Sea: a drowned city under black water, coral, pearls, kelp, abyssal fish, tides, teal and deep blue.",
    "The Bone Cathedral: bone, skulls, reliquaries, candles, grave-iron, ivory, solemn holy relics.",
    "The Storm Abyss: lightning, thunderclouds, wind, storm-iron, sky creatures, yellow and dark slate.",
    "The Verdant Rot: overgrown fungal jungle, vines, spores, venom, insects, moss, toxic greens.",
    "The Gilded Ruin: a fallen golden empire, gold, jewels, royal regalia, sun motifs, faded splendour.",
    "The Void Spiral: the edge of reality, void, stars, eclipses, amethyst, impossible geometry, purple and black.",
    "The Throne Below: the last realm, crimson and black, crowns, thrones, kings' relics, doom.",
]
RARITY_LOOK = {
    "common": "plain and ordinary but full of character: worn, simple, everyday or improvised, two or three colours, no magic, no particles",
    "rare": "well made with one striking feature (unusual shape, material or ornament), at most a faint glow",
    "epic": "clearly magical: bold silhouette, glowing parts, a few element particles",
    "legendary": "spectacular and iconic: a wild unique idea, glowing, element particles, the kind of blade players screenshot",
}
STYLE = (
    "You are a pixel artist. The attached image is our game's sword sprite sheet. Draw a NEW sheet in exactly the same style: "
    "chunky 32x32-pixel pixel art shown enlarged with hard square pixels, every sword drawn diagonally with the tip at the top-left "
    "and the handle at the bottom-right, a dark 1-pixel outline, light from the top-right, bright saturated colours with strong highlights "
    "(never muddy or dull), small particle effects only around magical blades. Lay them out on an exact grid of {cols} columns by {rows} rows, "
    "each sword centred in its own cell and filling most of it, with clear empty space between swords so none touch. "
    "Background: flat pure magenta #FF00FF everywhere, no gradients, no shadows, no grid lines, no text, no numbers, no labels, no frames. "
    "Each sword must read clearly when shrunk to 32x32 pixels: one bold silhouette, big simple shapes, at most two or three details, "
    "no tiny painted detail and no busy textures. Every sword must have a completely different silhouette and idea. In reading order (left to right, top to bottom) the swords are: "
)
INK = (20, 12, 24, 255)


# ---------------------------------------------------------------- helpers
def env():
    f = os.path.join(ROOT, ".env")
    if os.path.exists(f):
        for line in open(f, encoding="utf-8"):
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k, v.strip().strip('"').strip("'"))


def raw(name):
    return os.path.join(RAW, name)


def load(name, default=None):
    p = raw(name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else default


def save(name, data):
    json.dump(data, open(raw(name), "w", encoding="utf-8"), indent=1, ensure_ascii=False)


SPENT = [0.0]


def call(model, content, image_out=False, tries=4):
    env()
    body = {"model": model, "messages": [{"role": "user", "content": content}]}
    if image_out:
        body["modalities"] = ["image", "text"]
    for k in range(tries):
        try:
            req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(), headers={
                "Authorization": "Bearer " + os.environ["OPENROUTER_API_KEY"], "Content-Type": "application/json", "X-Title": "Idle Blade Master art"})
            d = json.load(urllib.request.urlopen(req, timeout=900))
            SPENT[0] += float((d.get("usage") or {}).get("cost") or 0)
            msg = d["choices"][0]["message"]
            if image_out:
                imgs = msg.get("images") or []
                if not imgs:
                    raise RuntimeError("no image: " + str(msg.get("content"))[:200])
                return base64.b64decode(imgs[0]["image_url"]["url"].split(",", 1)[1])
            return msg["content"] if isinstance(msg["content"], str) else "".join(p.get("text", "") for p in msg["content"])
        except Exception as e:  # network hiccups and empty answers: wait and try again
            print(f"  retry {k + 1}/{tries}: {str(e)[:160]}", flush=True)
            time.sleep(5 + 10 * k)
    raise RuntimeError("gave up after retries")


def img_part(png_bytes):
    return {"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(png_bytes).decode()}}


def json_from(text):
    """The first JSON array or object in a reply, ignoring any text after it."""
    i = min([k for k in (text.find("["), text.find("{")) if k >= 0])
    return json.JSONDecoder().raw_decode(text[i:])[0]


# ---------------------------------------------------------------- 1. concepts
def concepts():
    slots = load("slots.json")
    allc = load("concepts.json", {})
    used = ["rusty sword", "flaming blade", "frost sword", "vine-wrapped branch sword", "rainbow crystal sword", "feather blade", "rose-stem blade", "bone saw"]
    for c in allc.values():
        used += [x["idea"][:60] for x in c]
    for s in slots:
        key = str(s["realm"])
        if key in allc:
            continue
        counts = {}
        for x in s["summon"]:
            counts[x["rarity"]] = counts.get(x["rarity"], 0) + 1
        bosses = "\n".join(f'- floor {b["boss"]["floor"]}: {b["boss"]["name"]}, a {b["boss"]["kind"]} ({b["boss"]["fam"]}){", REALM LORD" if b["boss"]["lord"] else ""}{", FINAL BOSS of the game" if b["boss"]["final"] else ""}; powers: {", ".join(b["boss"]["mech"]) or "none"}' for b in s["boss"])
        prompt = f"""You design swords for a dark-fantasy pixel-art gacha game. Players summon swords and love collecting them, so every sword must be a different, memorable IDEA with its own silhouette (not the same sword in another colour). Think: a sword made of a feather, a meat cleaver, a sword frozen in an ice block, a snake coiled round a blade, a lantern hanging from the hilt, a crescent moon, a chained blade, a broken blade re-forged, a sword growing mushrooms, a tuning-fork blade, a key-shaped blade...

Realm: {s["name"]}. Theme: {REALM_THEME[s["realm"]]}
About half the swords should clearly show this realm's theme; the rest can be anything that fits a dark-fantasy dungeon, with a touch of the realm.

Write {len(s["summon"])} summonable swords, in this order: {", ".join(f"{n} {r}" for r, n in counts.items())}.
How each rarity should look: {json.dumps(RARITY_LOOK)}
Then write {len(s["boss"])} boss swords, one per boss below, in the same order. Each is a trophy that clearly shows its boss (its body, a part of it, or its power) and looks legendary:
{bosses}

Do NOT reuse any of these ideas already in the game: {"; ".join(used[-400:])}

Return only JSON: an array of {len(s["summon"]) + len(s["boss"])} objects in order, each:
{{"idea": "what to draw, one vivid visual sentence under 25 words (shape, material, colours, details)", "name": "2-4 word item name, evocative, no rarity words", "element": one of {ELEMENTS} that fits how it looks, "ult": "2-3 word ultimate attack name (null for common and rare)", "flavor": "one short line of lore under 14 words"}}
Use every element several times across the list."""
        print(f"concepts realm {s['realm']}...", flush=True)
        for attempt in range(3):
            try:
                arr = json_from(call(TEXT_MODEL, prompt))
                if len(arr) != len(s["summon"]) + len(s["boss"]):
                    raise ValueError(f"got {len(arr)} ideas")
                break
            except Exception as e:
                print("  bad answer:", e, flush=True)
        else:
            raise SystemExit("could not get concepts for realm " + key)
        for x in arr:
            if x.get("element") not in ELEMENTS:
                x["element"] = "steel"
        allc[key] = arr
        save("concepts.json", allc)
        used += [x["idea"][:60] for x in arr]
    print("concepts done, spent so far $%.2f" % SPENT[0], flush=True)


# ---------------------------------------------------------------- 2. sheets
def sheet_plan():
    """Which ideas go on which sheet: summon blades in sheets of up to 35, boss blades two realms per sheet."""
    slots, allc = load("slots.json"), load("concepts.json")
    plan = []
    for s in slots:
        if str(s["realm"]) not in allc:
            continue  # ideas for this realm are not written yet
        c = allc[str(s["realm"])]
        items = [{"index": x["index"], "rarity": x["rarity"], **c[i]} for i, x in enumerate(s["summon"])]
        size = 20 if len(items) <= 40 else 35
        for k in range(0, len(items), size):
            plan.append({"id": f"r{s['realm']}-{k // size + 1}", "items": items[k:k + size]})
    # Boss blades: two realms (20 blades) per sheet. Fewer per sheet makes each one too detailed to read at 32 px.
    for r in range(0, len(slots), 2):
        pair = slots[r:r + 2]
        if any(str(x["realm"]) not in allc for x in pair):
            continue
        items = []
        for s in pair:
            c, n = allc[str(s["realm"])], len(s["summon"])
            items += [{"index": b["index"], "rarity": "legendary", **c[n + i]} for i, b in enumerate(s["boss"])]
        plan.append({"id": f"bossp{r}", "items": items})
    # Fill-in sheets for blades a first sheet missed (see "fill"); they come last so a first drawing wins.
    plan += load("fills.json", [])
    return plan


def fill():
    """Gather every idea that has no drawing yet (from sheets already drawn) onto new sheets of up to 20."""
    fills, done = load("fills.json", []), set()
    plan = [s for s in sheet_plan() if not s["id"].startswith("fill")]
    for sh in plan + fills:
        m = matches(sh["id"])
        for e in m:
            k = e.get("idea")
            if not e.get("bad") and isinstance(k, int) and 1 <= k <= len(sh["items"]):
                done.add(sh["items"][k - 1]["index"])
    todo = [x for sh in plan if os.path.exists(raw(f"match-{sh['id']}.json")) for x in sh["items"] if x["index"] not in done]
    todo = [x for x in todo if not any(x["index"] == y["index"] for f in fills for y in f["items"] if not os.path.exists(raw(f"match-{f['id']}.json")))]
    for k in range(0, len(todo), 20):
        fills.append({"id": f"fill{len(fills) + 1}", "items": todo[k:k + 20]})
    save("fills.json", fills)
    print(f"fill: {len(todo)} blades on {(len(todo) + 19) // 20} new sheets")


def grid_for(n):
    return {35: (7, 5), 20: (5, 4), 30: (6, 5), 10: (5, 2)}.get(n) or (min(5, n), (n + 4) // 5)


def draw_sheet(sh):
    out = raw(f"sheet-{sh['id']}.png")
    if os.path.exists(out):
        return
    cols, rows = grid_for(len(sh["items"]))
    ref = open(os.path.join(ROOT, "assets", "sprite_swords.png"), "rb").read()
    text = STYLE.format(cols=cols, rows=rows) + " ".join(f"{i + 1}. ({x['rarity']}) {x['idea']}" for i, x in enumerate(sh["items"]))
    print(f"drawing {sh['id']} ({len(sh['items'])} swords, {cols}x{rows})", flush=True)
    png = call(IMAGE_MODEL, [img_part(ref), {"type": "text", "text": text}], image_out=True)
    open(out, "wb").write(png)
    print(f"  drew {sh['id']}", flush=True)


def sheets():
    plan = sheet_plan()
    with cf.ThreadPoolExecutor(4) as ex:
        for f in [ex.submit(draw_sheet, s) for s in plan]:
            try:
                f.result()
            except Exception as e:
                print("  sheet failed:", e, flush=True)
    print("sheets done, spent so far $%.2f" % SPENT[0], flush=True)


# ---------------------------------------------------------------- 3. cut
def is_bg(p):
    r, g, b = p[:3]
    if len(p) > 3 and p[3] < 20:
        return True
    return r > 110 and b > 110 and g < 0.62 * min(r, b) and abs(r - b) < 90  # magenta and its blended fringe


def components(mask, W, H):
    seen = bytearray(W * H)
    out = []
    for start in range(W * H):
        if not mask[start] or seen[start]:
            continue
        stack, comp = [start], []
        seen[start] = 1
        while stack:
            i = stack.pop(); comp.append(i)
            x, y = i % W, i // W
            for dy in (-1, 0, 1):
                yy = y + dy
                if yy < 0 or yy >= H: continue
                for dx in (-1, 0, 1):
                    xx = x + dx
                    if 0 <= xx < W:
                        j = yy * W + xx
                        if mask[j] and not seen[j]:
                            seen[j] = 1; stack.append(j)
        out.append(comp)
    return out


def pick_grid(mask, W, H, want, comps=None):
    """The model does not always use the grid it is asked for. Count the swords actually drawn (big pieces of art),
    then pick, among grids of about that size, the one whose cell borders cut the least art."""
    count = want
    if comps:
        sizes = sorted((len(c) for c in comps), reverse=True)
        big = sizes[min(len(sizes) - 1, max(0, min(len(sizes), want) // 2))] if sizes else 0
        count = sum(1 for n in sizes if n > 0.35 * big) or want
    best = None
    for cols, rows in [(5, 2), (4, 3), (5, 3), (3, 3), (7, 5), (9, 5), (9, 4), (5, 4), (6, 5), (8, 4), (5, 6), (7, 4), (6, 4), (8, 5), (5, 5), (6, 6), (4, 5), (4, 4), (7, 6), (8, 6), (6, 3), (4, 6)]:
        cut = 0
        for c in range(1, cols):
            x = c * W // cols
            cut += sum(mask[y * W + xx] for y in range(0, H, 2) for xx in (x - 2, x, x + 2))
        for r in range(1, rows):
            y = r * H // rows
            cut += sum(mask[yy * W + x] for x in range(0, W, 2) for yy in (y - 2, y, y + 2))
        score = cut / max(1, (cols - 1) * H + (rows - 1) * W) + 0.08 * abs(cols * rows - count) / max(1, count)
        filled = sum(1 for r in range(rows) for c in range(cols) if any(mask[(r * H // rows + (H // rows) // 2) * W + c * W // cols + k] for k in range(W // cols)))
        if filled < cols * rows * 0.75:
            continue
        if best is None or score < best[0]:
            best = (score, cols, rows)
    return best[1], best[2]


def finish(sp):
    """Sharpen the shrunk sprite: a little more colour, fewer colours (crisp pixels), no lone pixels, dark outline."""
    alpha = sp.getchannel("A")
    rgb = ImageEnhance.Contrast(ImageEnhance.Color(sp.convert("RGB")).enhance(1.15)).enhance(1.08)
    q = rgb.quantize(colors=18, method=Image.Quantize.MEDIANCUT).convert("RGBA")
    q.putalpha(alpha)
    p = q.load()
    solid = lambda x, y: 0 <= x < 32 and 0 <= y < 32 and p[x, y][3] > 0
    for y in range(32):
        for x in range(32):
            if p[x, y][3] and sum(solid(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)) <= 1:
                p[x, y] = (0, 0, 0, 0)
    for x, y in [(x, y) for y in range(32) for x in range(32) if not p[x, y][3] and (solid(x - 1, y) or solid(x + 1, y) or solid(x, y - 1) or solid(x, y + 1))]:
        p[x, y] = INK
    return q


def shrink(cell):
    s = max(cell.size)
    sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sq.paste(cell, ((s - cell.size[0]) // 2, (s - cell.size[1]) // 2))
    small = sq.resize((30, 30), Image.BOX)
    out = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    sp = small.load()
    for y in range(30):
        for x in range(30):
            p = sp[x, y]
            if p[3] > 100:
                k = 255 / p[3] if p[3] < 255 else 1  # undo darkening from averaging with transparent pixels
                out.putpixel((x + 1, y + 1), (min(255, int(p[0] * k)), min(255, int(p[1] * k)), min(255, int(p[2] * k)), 255))
    return finish(out)


def find_swords(mask2d, want):
    """Find each sword without assuming a grid: shrink the art until touching swords come apart, take the big
    pieces as seeds, then grow them back over the art. Sparkles join the nearest sword. Returns a label image."""
    H, W = mask2d.shape
    best = None
    for r in (2, 4, 6, 9, 12):
        e = mask2d.copy()
        for _ in range(r):  # erosion by one pixel, r times
            e = e & np.roll(e, 1, 0) & np.roll(e, -1, 0) & np.roll(e, 1, 1) & np.roll(e, -1, 1)
        comps = components(bytearray(e.astype(np.uint8).ravel().tolist()), W, H)
        sizes = sorted((len(c) for c in comps), reverse=True)
        if not sizes:
            continue
        ref = sizes[min(len(sizes) - 1, max(0, min(len(sizes), want) // 3))]
        seeds = [c for c in comps if len(c) > 0.18 * ref]
        score = abs(len(seeds) - want)
        if best is None or score < best[0] or (score == best[0] and r < best[1]):
            best = (score, r, seeds)
    seeds = best[2]
    lab = np.zeros(H * W, np.int32)
    q = collections.deque()
    for k, c in enumerate(seeds, 1):
        for i in c:
            lab[i] = k; q.append(i)
    m = mask2d.ravel()
    while q:  # grow every seed back over the art, one pixel ring at a time
        i = q.popleft(); x, y = i % W, i // W
        for j in (i - 1 if x else -1, i + 1 if x < W - 1 else -1, i - W, i + W):
            if 0 <= j < W * H and m[j] and not lab[j]:
                lab[j] = lab[i]; q.append(j)
    cents = np.array([[np.mean([i % W for i in c]), np.mean([i // W for i in c])] for c in seeds])
    for c in components(bytearray((m & (lab == 0)).astype(np.uint8).tolist()), W, H):  # loose sparkles
        cx, cy = np.mean([i % W for i in c]), np.mean([i // W for i in c])
        d = np.hypot(cents[:, 0] - cx, cents[:, 1] - cy)
        if d.min() < 0.12 * max(W, H):
            lab[c] = int(d.argmin()) + 1
    return lab.reshape(H, W), len(seeds)


def cut_sheet(sid, want):
    out = raw(f"cut-{sid}.png")
    if os.path.exists(out):
        return
    im = Image.open(raw(f"sheet-{sid}.png")).convert("RGBA")
    if max(im.size) > 1600:
        im = im.resize((im.size[0] * 1400 // max(im.size), im.size[1] * 1400 // max(im.size)), Image.NEAREST)
    a = np.array(im)
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    bg = (a[..., 3] < 20) | ((r > 110) & (b > 110) & (g < 0.62 * np.minimum(r, b)) & (np.abs(r - b) < 90))
    # The model does not always use magenta: also key out whatever flat colour fills the sheet's border.
    edge = np.concatenate([a[:4].reshape(-1, 4), a[-4:].reshape(-1, 4), a[:, :4].reshape(-1, 4), a[:, -4:].reshape(-1, 4)])[:, :3].astype(int)
    vals, counts = np.unique((edge // 8) * 8, axis=0, return_counts=True)
    key = vals[counts.argmax()] + 4
    if counts.max() > 0.4 * len(edge):
        bg |= np.sqrt(((a[..., :3].astype(int) - key) ** 2).sum(-1)) < 46
    a[bg] = 0
    lab, n = find_swords(~bg, want)
    H, W = lab.shape
    found = []
    for k in range(1, n + 1):
        ys, xs = np.nonzero(lab == k)
        if len(xs) < 150:
            continue
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        piece = a[y0:y1, x0:x1].copy()
        piece[lab[y0:y1, x0:x1] != k] = 0
        cell = Image.fromarray(piece, "RGBA")
        mx, my = xs.mean(), ys.mean()
        if ((xs - mx) * (ys - my)).sum() < 0:  # drawn as "/": mirror to our "\"
            cell = cell.transpose(Image.FLIP_LEFT_RIGHT)
        found.append((my, mx, shrink(cell)))
    # reading order: group into rows by centre height, then left to right
    found.sort()
    rows, cur = [], []
    rowh = H / max(1, round(len(found) ** 0.5 * H / W * 1.3) or 1)
    for f in found:
        if cur and f[0] - cur[0][0] > rowh * 0.5:
            rows.append(cur); cur = []
        cur.append(f)
    if cur:
        rows.append(cur)
    sprites = [f[2] for row in rows for f in sorted(row, key=lambda f: f[1])]
    strip = Image.new("RGBA", (32 * max(1, len(sprites)), 32), (0, 0, 0, 0))
    for i, sp in enumerate(sprites):
        strip.paste(sp, (i * 32, 0))
    strip.save(out)
    print(f"cut {sid}: {len(sprites)} sprites (asked {want})", flush=True)


def cut():
    plan = [s for s in sheet_plan() if os.path.exists(raw(f"sheet-{s['id']}.png"))]
    with cf.ProcessPoolExecutor(4) as ex:
        list(ex.map(cut_sheet, [s["id"] for s in plan], [len(s["items"]) for s in plan]))


# ---------------------------------------------------------------- 4. match
def contact(strip, scale=4):
    n = strip.size[0] // 32
    cols = 8
    rows = (n + cols - 1) // cols
    cw = 32 * scale + 8
    im = Image.new("RGB", (cols * cw, rows * (cw + 14)), (40, 34, 40))
    d = ImageDraw.Draw(im)
    for i in range(n):
        sp = strip.crop((i * 32, 0, i * 32 + 32, 32)).resize((32 * scale, 32 * scale), Image.NEAREST)
        x, y = (i % cols) * cw, (i // cols) * (cw + 14)
        im.paste(sp, (x + 4, y + 16), sp)
        d.text((x + 4, y + 2), f"#{i + 1}", fill=(255, 230, 120))
    b = io.BytesIO(); im.save(b, "PNG")
    return b.getvalue()


def matches(sid):
    """A sheet's sprite-to-idea list (replies sometimes wrap it in an object)."""
    m = load(f"match-{sid}.json") or []
    if isinstance(m, dict):
        m = next((v for v in m.values() if isinstance(v, list)), [])
    return [e for e in m if isinstance(e, dict)]


def match_sheet(sh):
    out = f"match-{sh['id']}.json"
    if load(out) is not None or not os.path.exists(raw(f"cut-{sh['id']}.png")):
        return
    strip = Image.open(raw(f"cut-{sh['id']}.png")).convert("RGBA")
    n = strip.size[0] // 32
    ideas = "\n".join(f"{i + 1}. [{x['rarity']}] {x['name']}: {x['idea']}" for i, x in enumerate(sh["items"]))
    prompt = f"""The image shows {n} numbered pixel-art swords (#1..#{n}) cut from a sheet that was drawn from this numbered list of ideas:
{ideas}

Match each sword to the idea it shows. The artist mostly kept the order, but may have skipped, merged, added or reordered some.
Rules: every idea is used at most once. If a sword is broken (cut in half, two swords merged, mostly empty, unreadable) mark it bad.
Return only JSON: an array with one object per sword in image order: {{"sprite": n, "idea": idea number or null, "bad": true/false, "element": one of {ELEMENTS} that fits how it LOOKS}}"""
    print(f"matching {sh['id']}...", flush=True)
    arr = json_from(call(TEXT_MODEL, [img_part(contact(strip)), {"type": "text", "text": prompt}]))
    save(out, arr)


def match():
    plan = sheet_plan()
    with cf.ThreadPoolExecutor(4) as ex:
        for f in [ex.submit(match_sheet, s) for s in plan]:
            try:
                f.result()
            except Exception as e:
                print("  match failed:", e, flush=True)
    print("match done, spent so far $%.2f" % SPENT[0], flush=True)


# ---------------------------------------------------------------- 5. build
def build():
    plan, art, missing = sheet_plan(), {}, []
    tiles = []
    for sh in plan:
        m = matches(sh["id"])
        strip = Image.open(raw(f"cut-{sh['id']}.png")).convert("RGBA") if os.path.exists(raw(f"cut-{sh['id']}.png")) else None
        got = set()
        for e in m:
            k = e.get("idea")
            if e.get("bad") or not isinstance(k, int) or k in got or not (1 <= k <= len(sh["items"])) or strip is None:
                continue
            s = e["sprite"] - 1
            if s < 0 or s >= strip.size[0] // 32:
                continue
            x = sh["items"][k - 1]
            got.add(k)
            if x["index"] in art:
                continue
            el = e.get("element") if e.get("element") in ELEMENTS else x["element"]
            art[x["index"]] = {"cell": len(tiles), "name": x["name"], "element": el, "ult": x.get("ult"), "flavor": x.get("flavor", "")}
            tiles.append(strip.crop((s * 32, 0, s * 32 + 32, 32)))
        missing += [(f"{sh['id']}:{i + 1}", sh["items"][i]["index"]) for i in range(len(sh["items"])) if i + 1 not in got]
    missing = [m for m, idx in missing if idx not in art]  # a later fill-in sheet may have drawn it
    cols = 32
    atlas = Image.new("RGBA", (cols * 32, max(1, (len(tiles) + cols - 1) // cols) * 32), (0, 0, 0, 0))
    for i, t in enumerate(tiles):
        atlas.paste(t, ((i % cols) * 32, (i // cols) * 32))
    atlas.save(os.path.join(ROOT, "assets", "blades.png"), optimize=True)
    rows = {str(k): [v["cell"], v["name"], v["element"], v["ult"], v["flavor"]] for k, v in sorted(art.items())}
    js = ("// Written by tools/make-blade-art.py: the AI-drawn blades in assets/blades.png.\n"
          "// catalog index -> [atlas cell, name, element, ultimate, lore]. Blades missing here use the procedural designs.\n"
          f"window.BLADE_ART = {{ cols: {cols}, rows: {atlas.size[1] // 32}, list: " + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + " };\n")
    open(os.path.join(ROOT, "js", "data.blade-art.js"), "w", encoding="utf-8").write(js)
    print(f"built: {len(tiles)} blades drawn, {len(missing)} still missing" + (": " + ", ".join(missing[:60]) if missing else ""), flush=True)
    save("missing.json", missing)


def redo(sid):
    for n in (f"sheet-{sid}.png", f"cut-{sid}.png", f"match-{sid}.json"):
        if os.path.exists(raw(n)):
            os.remove(raw(n))
    sh = next(s for s in sheet_plan() if s["id"] == sid)
    draw_sheet(sh)
    cut_sheet(sid, len(sh["items"]))
    match_sheet(sh)


def review():
    """One preview per realm (tools/.art-raw/review-*.png): every drawn blade at 4x with its name, for checking by eye."""
    plan = sheet_plan()
    for sh in plan:
        m = matches(sh["id"])
        if not os.path.exists(raw(f"cut-{sh['id']}.png")):
            continue
        strip = Image.open(raw(f"cut-{sh['id']}.png")).convert("RGBA")
        n = strip.size[0] // 32
        cols, cw, chh = 7, 140, 160
        im = Image.new("RGB", (cols * cw, ((n + cols - 1) // cols) * chh), (36, 30, 36))
        d = ImageDraw.Draw(im)
        for i in range(n):
            sp = strip.crop((i * 32, 0, i * 32 + 32, 32)).resize((128, 128), Image.NEAREST)
            x, y = (i % cols) * cw + 6, (i // cols) * chh
            im.paste(sp, (x, y + 4), sp)
            e = next((q for q in m if q.get("sprite") == i + 1), {})
            k = e.get("idea")
            label = ("BAD " if e.get("bad") else "") + (sh["items"][k - 1]["name"] if isinstance(k, int) and 1 <= k <= len(sh["items"]) else "(no match)")
            d.text((x, y + 134), label[:22], fill=(255, 120, 120) if e.get("bad") or not k else (240, 225, 190))
            if isinstance(k, int) and 1 <= k <= len(sh["items"]):
                d.text((x, y + 146), sh["items"][k - 1]["rarity"] + " " + str(e.get("element")), fill=(150, 140, 120))
        im.save(raw(f"review-{sh['id']}.png"))
    print("review images written")


if __name__ == "__main__":
    os.makedirs(RAW, exist_ok=True)
    cmd = sys.argv[1]
    if cmd == "all":
        concepts(); sheets(); cut(); match(); build()
    elif cmd == "redo":
        redo(sys.argv[2])
    else:
        {"concepts": concepts, "sheets": sheets, "cut": cut, "match": match, "build": build, "review": review, "fill": fill}[cmd]()
    print("spent this run: $%.2f" % SPENT[0], flush=True)
