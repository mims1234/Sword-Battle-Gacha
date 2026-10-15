// Generates the area music with Google Lyria 3 through OpenRouter, then turns each track
// into a seamless loop with ffmpeg.
//
//   1. Copy .env.example to .env and put your OpenRouter key in it.
//   2. node tools/make-music.mjs              (all tracks, Lyria 3 Pro, about $0.08 each)
//      node tools/make-music.mjs --clip       (30-second clips, about $0.04 each)
//      node tools/make-music.mjs --only beast,boss --force
//
// Output: assets/music/<area>.mp3 and assets/music/tracks.js (the list the game loads).
// Raw downloads are kept in tools/.music-raw/ (git-ignored) so you can reprocess without paying again:
//      node tools/make-music.mjs --reprocess
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const RAW = path.join(ROOT, "tools", ".music-raw");
const OUT = path.join(ROOT, "assets", "music");
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

// Shared direction for every track: these play for hours under an idle game.
const BASE = "Instrumental only, no vocals, no lyrics, no drums kit, no build-up, no intro, no outro, no fade-out. " +
  "Background music for a dark-fantasy pixel-art idle RPG. Calm and atmospheric with a quiet sense of suspense. " +
  "Steady texture from start to end so it can loop seamlessly. Warm, organic, real instruments, gentle mix, lo-fi warmth.";

const TRACKS = {
  brute: "Goblin mines deep underground: plucked acoustic guitar and kalimba over a soft low drone, distant pickaxe-like wooden knocks, D dorian, 72 bpm, cosy but wary.",
  undead: "Ancient catacombs full of skulls: slow felt piano, soft string pad, a distant church bell every few bars, C sharp minor, 56 bpm, hushed and mysterious.",
  beast: "Moonlit wild forest at night: breathy wooden flute and nylon guitar, light hand percussion, soft crickets texture, E minor, 76 bpm, adventurous and calm.",
  nature: "Misty drowned swamp: watery harp arpeggios with gentle echo, low cello sustain, soft rain ambience, F minor, 64 bpm, dreamy and eerie but soothing.",
  demon: "Volcanic cinder pit: deep low cello ostinato, slow taiko heartbeat, warm brass swells far away, B phrygian, 60 bpm, tense, smouldering, restrained.",
  dragon: "Frozen mountain ridge with dragon bones: airy choir pad without words, glass celesta, soft wind, A minor, 58 bpm, vast, cold and serene.",
  holy: "Ruined cathedral at dusk: soft pipe organ, solo violin, gentle bells, G minor, 54 bpm, sacred, melancholy and peaceful.",
  boss: "Boss battle that stays background music: driving low strings ostinato, steady taiko, dark brass hits, D minor, 96 bpm, tense and heroic but not loud or busy.",
};

// ---------- env ----------
function loadEnv() {
  const f = path.join(ROOT, ".env");
  if (fs.existsSync(f)) for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// ---------- OpenRouter ----------
async function generate(id, model) {
  const key = process.env.OPENROUTER_API_KEY;
  const body = {
    model, stream: true, modalities: ["text", "audio"], audio: { format: "mp3" },
    messages: [{ role: "user", content: `${TRACKS[id]} ${BASE}` }],
  };
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://github.com/mims1234/Sword-Battle-Gacha", "X-Title": "Idle Blade Master music" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const chunks = []; let buf = "", text = "";
  const dec = new TextDecoder();
  for await (const part of res.body) {
    buf += dec.decode(part, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim(); if (data === "[DONE]") continue;
      let j; try { j = JSON.parse(data); } catch { continue; }
      if (j.error) throw new Error("OpenRouter error: " + JSON.stringify(j.error).slice(0, 400));
      const d = j.choices && j.choices[0] && (j.choices[0].delta || j.choices[0].message);
      if (!d) continue;
      if (d.audio && d.audio.data) chunks.push(d.audio.data);
      if (typeof d.content === "string") text += d.content;
    }
  }
  if (!chunks.length) throw new Error("No audio came back. Model text: " + text.slice(0, 300));
  return Buffer.from(chunks.join(""), "base64");
}
function extOf(b) {
  const s = b.subarray(0, 4).toString("latin1");
  if (s === "RIFF") return "wav"; if (s === "OggS") return "ogg"; if (s === "fLaC") return "flac";
  if (s.startsWith("ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "mp3";
  return "bin";
}

// ---------- seamless loop ----------
const hasFfmpeg = () => spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
function probeSeconds(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  return parseFloat(r.stdout) || 0;
}
// Trim the edges, then cross-fade the end into the beginning: the file's last seconds blend
// into its first seconds, so when it restarts the music just keeps going.
function makeLoop(rawFile, outFile, clip) {
  const dur = probeSeconds(rawFile);
  const head = clip ? 0.5 : 2, tail = clip ? 1 : Math.max(4, dur * 0.06), xf = clip ? 3 : 6;
  const end = Math.max(head + xf * 3, dur - tail);
  const f = `[0:a]atrim=${head}:${end},asetpts=PTS-STARTPTS,asplit[a][b];` +
    `[a]atrim=start=${xf},asetpts=PTS-STARTPTS[body];[b]atrim=0:${xf},asetpts=PTS-STARTPTS[headx];` +
    `[body][headx]acrossfade=d=${xf}:c1=qsin:c2=qsin,loudnorm=I=-20:TP=-2:LRA=11`;
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", rawFile, "-filter_complex", f, "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "128k", outFile], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("ffmpeg failed: " + r.stderr.slice(0, 400));
  return probeSeconds(outFile);
}

function writeManifest() {
  const files = fs.readdirSync(OUT).filter((f) => /\.(mp3|ogg|wav)$/.test(f));
  const map = {}; files.forEach((f) => (map[f.replace(/\.\w+$/, "")] = "assets/music/" + f));
  fs.writeFileSync(path.join(OUT, "tracks.js"), "// Written by tools/make-music.mjs. Lists the music files the game can play.\nwindow.MUSIC_TRACKS = " + JSON.stringify(map, null, 2) + ";\n");
  return Object.keys(map);
}

async function main() {
  loadEnv();
  fs.mkdirSync(RAW, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
  const clip = flag("--clip"), model = clip ? "google/lyria-3-clip-preview" : "google/lyria-3-pro-preview";
  const only = opt("--only") ? opt("--only").split(",") : Object.keys(TRACKS);
  const ff = hasFfmpeg();
  if (!ff) console.warn("ffmpeg not found: raw files will be copied as-is (the game still cross-fades them).");
  if (!flag("--reprocess") && !process.env.OPENROUTER_API_KEY) { console.error("Missing OPENROUTER_API_KEY. Copy .env.example to .env and add your key."); process.exit(1); }
  for (const id of only) {
    if (!TRACKS[id]) { console.warn("Unknown track:", id); continue; }
    const rawPrev = fs.readdirSync(RAW).find((f) => f.startsWith(id + "."));
    let rawFile = rawPrev ? path.join(RAW, rawPrev) : null;
    if (!flag("--reprocess") && (!rawFile || flag("--force"))) {
      process.stdout.write(`Generating ${id} with ${model}... `);
      const t = Date.now(), audio = await generate(id, model);
      rawFile = path.join(RAW, `${id}.${extOf(audio)}`); fs.writeFileSync(rawFile, audio);
      console.log(`${(audio.length / 1e6).toFixed(1)} MB in ${((Date.now() - t) / 1000).toFixed(0)} s`);
    }
    if (!rawFile) { console.warn(`No raw file for ${id}; skipping.`); continue; }
    const out = path.join(OUT, `${id}.mp3`);
    if (ff) { const secs = makeLoop(rawFile, out, clip); console.log(`  looped ${id}: ${secs.toFixed(1)} s -> ${path.relative(ROOT, out)}`); }
    else fs.copyFileSync(rawFile, path.join(OUT, `${id}.${path.extname(rawFile).slice(1)}`));
  }
  console.log("Tracks in game:", writeManifest().join(", "));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
