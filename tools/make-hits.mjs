// Designs the sword-strike sounds, one family per blade element, and renders them to
// assets/sfx/hit_<element>_<n>.mp3 (plus heavier crit_<element>_<n>.mp3).
// A music model cannot make clean one-shot foley, so these are built from physical recipes:
// an air swoosh (band-passed noise sweeping upward) into an impact whose ring comes from the
// inharmonic partials of a struck metal bar, then each element adds its own layer.
//
//   node tools/make-hits.mjs           (needs ffmpeg; no API key, no cost)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const OUT = path.join(ROOT, "assets", "sfx");
const SR = 44100, VARIANTS = 4;

// ---------- tiny DSP kit ----------
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const noise = () => rnd() * 2 - 1;
const buf = (secs) => new Float32Array(Math.ceil(secs * SR));
function mixInto(dst, src, at, gain) { const o = Math.floor(at * SR); for (let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] += src[i] * gain; }
// State-variable band-pass whose centre frequency follows f(t).
function bandpass(x, fOf, q) {
  const y = new Float32Array(x.length); let low = 0, band = 0;
  for (let i = 0; i < x.length; i++) {
    const f = 2 * Math.sin((Math.PI * Math.min(fOf(i / SR), SR / 6)) / SR);
    const high = x[i] - low - q * band; band += f * high; low += f * band; y[i] = band;
  }
  return y;
}
function lowpass(x, fc) { const y = new Float32Array(x.length), a = Math.exp((-2 * Math.PI * fc) / SR); let s = 0; for (let i = 0; i < x.length; i++) { s = (1 - a) * x[i] + a * s; y[i] = s; } return y; }
function highpass(x, fc) { const l = lowpass(x, fc), y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = x[i] - l[i]; return y; }

// Air swoosh: noise through a band-pass sweeping low to high, swelling and cutting off at the impact.
function swoosh(dur, f0, f1) {
  const n = buf(dur); for (let i = 0; i < n.length; i++) n[i] = noise();
  const y = bandpass(n, (t) => f0 * Math.pow(f1 / f0, t / dur), 0.9);
  for (let i = 0; i < y.length; i++) { const t = i / y.length; y[i] *= Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 2) * (0.6 + 0.4 * t); }
  return y;
}
// Struck metal: inharmonic partials (free bar modes), each with its own decay, plus a click transient.
function metal(f0, decay, bright, ratios) {
  const R = ratios || [1, 2.756, 5.404, 8.933, 13.34], dur = decay * 3, y = buf(dur);
  R.forEach((r, k) => {
    const f = f0 * r * (1 + (rnd() - 0.5) * 0.012), amp = Math.pow(bright, k) / (k + 1), d = decay / (1 + k * 0.7), ph = rnd() * 6.28;
    if (f > SR / 2.2) return;
    for (let i = 0; i < y.length; i++) { const t = i / SR; y[i] += amp * Math.sin(2 * Math.PI * f * t + ph) * Math.exp(-t / d); }
  });
  const click = buf(0.004); for (let i = 0; i < click.length; i++) click[i] = noise() * (1 - i / click.length);
  mixInto(y, highpass(click, 2500), 0, 0.9);
  return y;
}
function thud(f0, dur) { const y = buf(dur); let ph = 0; for (let i = 0; i < y.length; i++) { const t = i / SR, f = f0 * (1 - 0.5 * t / dur); ph += (2 * Math.PI * f) / SR; y[i] = Math.sin(ph) * Math.exp(-t / (dur / 4)); } return y; }

// ---------- one strike per element ----------
function strike(el, crit) {
  const y = buf(2.2), sw = 0.09 + rnd() * 0.05, hitAt = sw * 0.92, heavy = crit ? 1 : 0;
  const lowSw = el === "void" ? [180, 900] : el === "fire" ? [350, 2400] : [500, 3800];
  mixInto(y, swoosh(sw, lowSw[0] * (1 - 0.15 * heavy), lowSw[1]), 0, 0.55);
  const p = 1 - 0.18 * heavy;
  switch (el) {
    case "steel": mixInto(y, metal((1250 + rnd() * 450) * p, 0.16 + 0.1 * heavy, 0.75), hitAt, 0.6); break;
    case "fire": {
      mixInto(y, metal((800 + rnd() * 250) * p, 0.1, 0.55), hitAt, 0.45);
      const c = buf(0.45); for (let i = 0; i < c.length; i++) { const t = i / SR; c[i] = (rnd() < 0.004 ? noise() * 3 : 0) + noise() * 0.12 * Math.exp(-t / 0.12); }
      mixInto(y, bandpass(c, () => 2200, 1.2), hitAt, 0.6); break;
    }
    case "ice": {
      mixInto(y, metal((2300 + rnd() * 500) * p, 0.2, 0.6, [1, 2.0, 3.01, 4.2, 5.43]), hitAt, 0.5);
      for (let k = 0; k < 4; k++) mixInto(y, metal(3400 + rnd() * 2200, 0.06, 0.3, [1, 2.7]), hitAt + 0.03 + k * 0.035 + rnd() * 0.02, 0.18);
      break;
    }
    case "lightning": {
      const z = buf(0.12); let ph = 0; for (let i = 0; i < z.length; i++) { const t = i / SR, f = 2400 * Math.pow(0.12, t / 0.12); ph += f / SR; z[i] = ((ph % 1) * 2 - 1) * (rnd() < 0.3 ? 1 : 0.4) * Math.exp(-t / 0.05); }
      mixInto(y, highpass(z, 400), hitAt, 0.45); mixInto(y, metal((1500 + rnd() * 400) * p, 0.09, 0.7), hitAt, 0.4); break;
    }
    case "holy": mixInto(y, metal((880 + rnd() * 200) * p, 0.26 + 0.06 * heavy, 0.65, [1, 2.0, 3.0, 4.16, 5.43]), hitAt, 0.5); break;
    case "void": {
      mixInto(y, metal((420 + rnd() * 120) * p, 0.2, 0.5), hitAt, 0.45);
      const s = buf(0.35); let ph = 0; for (let i = 0; i < s.length; i++) { const t = i / SR, f = 260 * Math.pow(0.3, t / 0.35); ph += (2 * Math.PI * f) / SR; s[i] = Math.sin(ph) * Math.exp(-t / 0.12); }
      mixInto(y, s, hitAt, 0.5); break;
    }
    case "poison": {
      mixInto(y, metal((1000 + rnd() * 300) * p, 0.08, 0.5), hitAt, 0.4);
      const h = buf(0.35); for (let i = 0; i < h.length; i++) h[i] = noise() * Math.exp(-(i / SR) / 0.1);
      mixInto(y, highpass(h, 3000), hitAt, 0.3);
      for (let k = 0; k < 3; k++) { const b = buf(0.05); let ph = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (2 * Math.PI * (300 + 900 * t / 0.05)) / SR; b[i] = Math.sin(ph) * Math.sin(Math.PI * t / 0.05); } mixInto(y, b, hitAt + 0.05 + k * 0.06 + rnd() * 0.03, 0.25); }
      break;
    }
  }
  if (heavy) mixInto(y, thud(110, 0.25), hitAt, 0.55);
  // trim the silent tail and normalise the peak
  let pk0 = 1e-9; for (const v of y) pk0 = Math.max(pk0, Math.abs(v));
  let end = y.length - 1; while (end > 0 && Math.abs(y[end]) < pk0 * 1e-3) end--;
  const out = y.subarray(0, Math.min(y.length, end + Math.floor(0.02 * SR)));
  let pk = 1e-9; for (const v of out) pk = Math.max(pk, Math.abs(v));
  const g = Math.pow(10, -9 / 20) / pk; for (let i = 0; i < out.length; i++) out[i] *= g;
  const fade = Math.min(out.length >> 2, Math.floor(0.08 * SR)); for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  return out;
}

function writeMp3(samples, file) {
  const wav = path.join(os.tmpdir(), "blade-hit.wav"), b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(wav, b);
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", wav, "-ac", "2", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "128k", file], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
}

const ELEMENTS = ["steel", "fire", "ice", "lightning", "holy", "void", "poison"];
fs.mkdirSync(OUT, { recursive: true });
fs.readdirSync(OUT).filter((f) => /^(hit|crit)_/.test(f)).forEach((f) => fs.unlinkSync(path.join(OUT, f)));
let n = 0;
ELEMENTS.forEach((el, e) => {
  for (let v = 0; v < VARIANTS; v++) {
    seed = 1000 + e * 97 + v * 13; writeMp3(strike(el, false), path.join(OUT, `hit_${el}_${v + 1}.mp3`));
    seed = 5000 + e * 97 + v * 13; writeMp3(strike(el, true), path.join(OUT, `crit_${el}_${v + 1}.mp3`)); n += 2;
  }
});
console.log(`Rendered ${n} strike sounds for ${ELEMENTS.length} elements. Run "node tools/make-music.mjs --reprocess --sfx" to refresh the effect list.`);
