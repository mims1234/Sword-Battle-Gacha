// Renders a contact sheet of generated blades to a PNG (needs ffmpeg):
//   node tools/preview-blades.js out.png [count] [realm]
const path = require("path"), fs = require("fs"), { spawnSync } = require("child_process");
global.window = {};
require(path.join(__dirname, "..", "js", "art.blades.js"));
const G = window.G, out = process.argv[2] || "blades.png", n = +(process.argv[3] || 64), realm = process.argv[4] == null ? null : +process.argv[4];
const R = ["common", "rare", "epic", "legendary"], E = ["fire", "ice", "lightning", "holy", "void", "poison", "steel"];
const cols = 16, rows = Math.ceil(n / cols), W = cols * 34, H = rows * 34, buf = Buffer.alloc(W * H * 3, 0);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = (x >> 4) + (y >> 4) & 1 ? 44 : 36; buf.fill(v, (y * W + x) * 3, (y * W + x) * 3 + 3); }
for (let k = 0; k < n; k++) {
  const S = G.bladeSpec(1000 + k * 37, { rarity: R[k % 4], realm: realm == null ? Math.floor(k / 4) % 10 : realm, element: E[k % 7] }), d = G.bladeRGBA(S);
  const ox = (k % cols) * 34 + 1, oy = Math.floor(k / cols) * 34 + 1;
  for (let i = 0; i < 1024; i++) if (d[i * 4 + 3]) { const p = ((oy + (i >> 5)) * W + ox + (i & 31)) * 3; buf[p] = d[i * 4]; buf[p + 1] = d[i * 4 + 1]; buf[p + 2] = d[i * 4 + 2]; }
}
const raw = out + ".rgb"; fs.writeFileSync(raw, buf);
spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W}x${H}`, "-i", raw, "-vf", "scale=iw*3:ih*3:flags=neighbor", out]);
fs.unlinkSync(raw); console.log("wrote", out);
