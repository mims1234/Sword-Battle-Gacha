// Generates the game's music AND sound effects with Google Lyria 3 through OpenRouter,
// then uses ffmpeg to make seamless music loops and short, clean sound-effect files.
//
//   1. Copy .env.example to .env and put your OpenRouter key in it.
//   2. node tools/make-music.mjs                 music (Lyria 3 Pro, ~$0.08 each) + effects (Lyria 3 Clip, ~$0.04 each)
//      node tools/make-music.mjs --music         music only          --sfx   effects only
//      node tools/make-music.mjs --only beast,boss --force           redo chosen items
//      node tools/make-music.mjs --reprocess     rebuild outputs from the saved downloads, no API calls
//
// Outputs: assets/music/*.mp3 + tracks.js, assets/sfx/*.mp3 + sfx.js (the lists the game loads).
// Downloads and the model's notes are kept in tools/.music-raw/ (git-ignored).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const RAW = path.join(ROOT, "tools", ".music-raw");
const MUSIC_OUT = path.join(ROOT, "assets", "music");
const SFX_OUT = path.join(ROOT, "assets", "sfx");
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

// ---------- what to make ----------
const MUSIC_BASE = "Instrumental only, absolutely no vocals, no singing, no lyrics, no spoken words. No intro, no outro, no fade-out, no big build-up. " +
  "Background music for a dark-fantasy pixel-art idle RPG, in the spirit of classic 16-bit adventure game soundtracks played on real instruments. " +
  "Calm and atmospheric with a quiet sense of suspense. One steady mood from start to end so it loops seamlessly. Warm, gentle, soft mix.";
const MUSIC = {
  brute: "Goblin mines deep underground: plucked acoustic guitar and kalimba over a soft low drone, light wooden knocks, D dorian, 72 bpm, cosy but wary.",
  undead: "Ancient catacombs full of skulls: slow felt piano, soft string pad, a distant church bell every few bars, C sharp minor, 56 bpm, hushed and mysterious.",
  beast: "Moonlit wild forest at night: breathy wooden flute and nylon guitar, light hand percussion, E minor, 76 bpm, adventurous and calm.",
  nature: "Misty drowned swamp: watery harp arpeggios with gentle echo, low cello sustain, F minor, 64 bpm, dreamy and a little eerie but soothing.",
  demon: "Volcanic cinder pit: deep low cello ostinato, slow soft taiko heartbeat, warm distant brass swells, B phrygian, 60 bpm, tense and smouldering but restrained.",
  dragon: "Frozen mountain ridge with dragon bones: airy wordless string pad, glass celesta, soft wind, A minor, 58 bpm, vast, cold and serene.",
  holy: "Ruined cathedral at dusk: soft pipe organ, solo violin, gentle bells, G minor, 54 bpm, sacred, melancholy and peaceful.",
  boss: "Boss fight that still sits in the background: driving low strings ostinato, steady taiko, dark brass stabs, D minor, 96 bpm, tense and heroic, not loud or busy.",
  // ---- v5: screens and fights ----
  summon: "Summoning altar in a hidden shrine: shimmering harp arpeggios and celesta over a soft wordless choir pad and a low cello drone, slow rising anticipation that never fully resolves, E minor, 70 bpm, magical, hopeful and mysterious.",
  shop: "A travelling merchant's lantern-lit stall deep in the dungeon: warm nylon guitar and lute, soft reed organ, light hand drum, D dorian, 84 bpm, cosy, friendly and a little sly.",
  gate: "Arena of fallen champions behind a great iron gate: steady low string ostinato, taiko, solemn horns and a distant wordless choir, E phrygian, 92 bpm, determined and grim but restrained.",
  lord: "Realm Lord battle: relentless cello and double-bass ostinato, heavy taiko, dark brass calls answered by a wordless choir, C minor, 104 bpm, epic and dangerous but still sitting under gameplay.",
  throne: "Final battle against the king beneath the world: slow massive wordless choir chords, pipe organ, low brass, timpani rolls and a mournful solo violin, B minor, 88 bpm, apocalyptic, sorrowful and heroic.",
  // ---- v5: one theme per deeper realm (played in turn with the area themes) ----
  realm_1: "The Ember Halls, a forge city of cooling lava: low cello and bowed bass, soft anvil-like metallic percussion, warm French horn swells, A phrygian, 66 bpm, smouldering and proud.",
  realm_2: "The Frostbound Vaults: music-box celesta, bowed crystal glasses, airy strings, soft harp, B minor, 60 bpm, crystalline, lonely and beautiful.",
  realm_3: "The Sunless Sea, a drowned city under black water: slow harp and felt piano with long echoes, low cello glissandi, soft frame drum, F sharp minor, 58 bpm, deep, slow and hypnotic.",
  realm_4: "The Bone Cathedral: slow low wordless choir, soft pipe organ, dry wooden clicks, viola drone, D minor, 52 bpm, solemn, ancient and haunting.",
  realm_5: "The Storm Abyss, a chasm of endless lightning: tremolo strings, distant timpani like thunder, wooden flute melody over rumbling low brass, G minor, 80 bpm, restless and windswept but not loud.",
  realm_6: "The Verdant Rot, an overgrown fungal jungle: kalimba, marimba and nylon guitar, breathy low flute, light shakers, C dorian, 74 bpm, lush, strange and humid.",
  realm_7: "The Gilded Ruin, a fallen golden empire: elegant harp and plucked strings, soft muted trumpet melody, gentle timpani, E flat lydian, 68 bpm, regal, faded and melancholy.",
  realm_8: "The Void Spiral at the edge of reality: slow bowed strings that swell and vanish, sparse celesta notes, deep low drone, airy wordless choir pad, A minor, 50 bpm, alien, weightless and unsettling but calm.",
  realm_9: "The Throne Below, the last realm: low string choir, slow funeral drum, solo cello lament, distant bells, E minor, 56 bpm, grand, tragic and dark.",
};
const SFX_BASE = "No vocals, no singing. Clean studio recording, dry, no reverb tail, no background music.";
// Musical moments (summons, victories, level ups) must sound like the same score as the area music.
const SCORE = "Same world and sound as the game's background score: a dark-fantasy acoustic and chamber-orchestral RPG soundtrack in the spirit of classic 16-bit adventure games, played on real instruments: harp, felt piano, nylon guitar, cello and low strings, wooden flute, celesta and bells, soft low brass, wordless choir, taiko. Warm, dark, intimate mix with soft highs, a short natural room reverb. Instrumental, no lyrics, no spoken words, no synths, no electronic drums, no chiptune, no rock, no pop.";
// kind "sting": keep the first musical gesture (up to max seconds). kind "hits": slice the separate hits into one-shots.
const SFX = {
  // Summon reveals, one per rarity: each rarer one is bigger, all in the score's instruments.
  reveal_1: { kind: "sting", max: 1.8, base: "score", prompt: "One single soft plucked harp chord in E minor with a faint celesta shimmer, then complete silence." },
  reveal_2: { kind: "sting", max: 2.4, base: "score", prompt: "One short rising harp arpeggio in E minor that lands on a warm bell note, then complete silence." },
  reveal_3: { kind: "sting", max: 3.2, base: "score", prompt: "One short magical reveal: rising celesta and harp into a soft wordless choir swell in E minor, then complete silence." },
  reveal_4: { kind: "sting", max: 4.8, base: "score", prompt: "One short epic reveal for finding a legendary blade: a wordless choir and low horns swell from E minor and resolve to E major with one warm taiko hit and bells, then complete silence." },
  reveal_5: { kind: "sting", max: 6.5, base: "score", prompt: "One short awe-struck reveal for the rarest mythic blade: a deep taiko and timpani hit, then full wordless choir and horns rise and resolve gloriously to a radiant major chord with bells, then complete silence." },
  summon_charge: { kind: "sting", max: 1.7, base: "score", prompt: "A short rising tension swell: low cello tremolo with a rising shimmering harp glissando, building up, then complete silence." },
  level: { kind: "sting", max: 1.0, base: "score", prompt: "Two soft quick ascending celesta notes, a gentle level-up chime, then complete silence." },
  unlock: { kind: "sting", max: 2.6, base: "score", prompt: "A short warm horn call over a harp flourish, a new ability unlocked, then complete silence." },
  boss: { kind: "sting", max: 3.6, base: "score", prompt: "An ominous low war horn with one huge taiko hit and a low choir breath: a boss appears. Then complete silence." },
  boss_down: { kind: "sting", max: 4.2, base: "score", prompt: "A short triumphant cadence after beating a boss: horns and taiko move from D minor to a bright D major chord, then complete silence." },
  rebirth: { kind: "sting", max: 5.5, base: "score", prompt: "An ethereal rising wordless choir with bells and a soft orchestral bloom, a phoenix reborn from ashes, then complete silence." },
  omen: { kind: "sting", max: 3, base: "score", prompt: "A short mysterious sting: dark harp notes over a low string tremolo, something is coming. Then complete silence." },
  wipe: { kind: "sting", max: 3, base: "score", prompt: "A short sad defeat sting: low cello falling notes and one soft taiko, then complete silence." },
  secret: { kind: "sting", max: 2.2, base: "score", prompt: "A short magical discovery: twinkling celesta and a soft harp flourish, then complete silence." },
  // v5 moments
  victory: { kind: "sting", max: 14, min: 8, base: "score", prompt: "A complete short victory theme for conquering the whole dungeon: a heroic horn melody over strings, wordless choir and taiko, starting in D minor and ending on a radiant held D major chord. It lasts about twelve seconds, then complete silence." },
  realm: { kind: "sting", max: 7, min: 4, base: "score", prompt: "A solemn new-chapter fanfare: low horns and a wordless choir rise as a great stone gate opens, ending on a held open chord, then complete silence." },
  gate_win: { kind: "sting", max: 5, base: "score", prompt: "A short heroic cadence after winning a duel: horns and taiko, triumphant, ending on a major chord, then complete silence." },
  purchase: { kind: "sting", max: 2.6, base: "score", prompt: "A short warm thank-you flourish: a harp glissando with a bell sparkle and soft coin chimes, then complete silence." },
  drop: { kind: "sting", max: 1, prompt: "A single glittering coin and gem pickup chime, very short, then complete silence." },
  ult: { kind: "sting", max: 1.8, prompt: "A powerful magical blast: a whoosh into a deep boom with a cymbal crash, then complete silence." },
  // Sword strikes are designed per element by tools/make-hits.mjs: a music model only makes rhythmic beats, not one-shot foley.
  kill: { kind: "hits", max: 0.8, prompt: "Isolated heavy impact thuds like a body hitting a wooden floor, eight separate hits, each followed by one full second of silence. Percussion only, no melody." },
  click: { kind: "hits", max: 0.15, prompt: "Isolated soft wooden button clicks, eight separate clicks, each followed by one full second of silence. No music." },
};

// ---------- env ----------
function loadEnv() {
  const f = path.join(ROOT, ".env");
  if (fs.existsSync(f)) for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// ---------- OpenRouter ----------
async function generate(prompt, model) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://github.com/mims1234/Sword-Battle-Gacha", "X-Title": "Idle Blade Master audio" },
    body: JSON.stringify({ model, stream: true, modalities: ["text", "audio"], audio: { format: "mp3" }, messages: [{ role: "user", content: prompt }] }),
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
      if (d.audio && d.audio.transcript) text += d.audio.transcript;
      if (typeof d.content === "string") text += d.content;
    }
  }
  if (!chunks.length) throw new Error("No audio came back. Model text: " + text.slice(0, 300));
  return { audio: Buffer.from(chunks.join(""), "base64"), text };
}
function extOf(b) {
  const s = b.subarray(0, 4).toString("latin1");
  if (s === "RIFF") return "wav"; if (s === "OggS") return "ogg"; if (s === "fLaC") return "flac";
  if (s.startsWith("ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "mp3";
  return "bin";
}

// ---------- analysis ----------
const SR = 22050;
function decodeMono(file) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error("ffmpeg decode failed for " + file);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
}
// Loudness envelope in dB, one value per `win` seconds.
function envelope(x, win) {
  const n = Math.max(1, Math.floor(SR * win)), out = [];
  for (let i = 0; i + n <= x.length; i += n) { let s = 0; for (let k = i; k < i + n; k++) s += x[k] * x[k]; out.push(10 * Math.log10(s / n + 1e-12)); }
  return out;
}
const median = (a) => { const b = a.slice().sort((p, q) => p - q); return b[Math.floor(b.length / 2)] || -90; };
function ff(argv) { const r = spawnSync("ffmpeg", ["-y", "-v", "error", ...argv], { encoding: "utf8" }); if (r.status !== 0) throw new Error("ffmpeg: " + r.stderr.slice(0, 400)); }
// 112 kbps keeps all eight 2-3 minute loops under ~20 MB while staying clean for background music.
const enc = ["-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "112k"];

// Music: find where the steady part starts and ends, then cross-fade the end into the start.
function makeLoop(raw, out) {
  const x = decodeMono(raw), env = envelope(x, 0.25), dur = x.length / SR, med = median(env);
  let a = env.findIndex((v) => v > med - 6), b = env.length - 1 - env.slice().reverse().findIndex((v) => v > med - 6);
  const start = Math.max(0, a * 0.25 + 0.5), end = Math.min(dur, (b + 1) * 0.25 - 2.5);
  const xf = Math.min(6, (end - start) / 6);
  const gaps = []; let run = 0; env.forEach((v, i) => { const t = i * 0.25; if (t < start || t > end) return; if (v < med - 18) { run++; if (run === 8) gaps.push(t.toFixed(0) + "s"); } else run = 0; });
  ff(["-i", raw, "-filter_complex",
    `[0:a]atrim=${start}:${end},asetpts=PTS-STARTPTS,asplit[a][b];[a]atrim=start=${xf},asetpts=PTS-STARTPTS[body];[b]atrim=0:${xf},asetpts=PTS-STARTPTS[h];[body][h]acrossfade=d=${xf}:c1=qsin:c2=qsin,loudnorm=I=-20:TP=-2:LRA=11`,
    ...enc, out]);
  // Seam check: loudness just before the loop point vs. just after it.
  const y = decodeMono(out), e2 = envelope(y, 0.5), seam = Math.abs(e2[e2.length - 1] - e2[0]);
  return { secs: y.length / SR, trimmed: [start.toFixed(1), (dur - end).toFixed(1)], seam: seam.toFixed(1), gaps };
}
// One sting: from the first sound until it fades (or `max` seconds), with a short fade-out.
function makeSting(raw, out, max, min) {
  const x = decodeMono(raw), env = envelope(x, 0.01), peak = Math.max(...env), thr = Math.max(-50, peak - 34);
  // start at the first strong sound, not a faint lead-in
  const on = env.findIndex((v) => v > peak - 18); if (on < 0) throw new Error("silent");
  let end = on, quiet = 0, broke = false;
  const least = min || max * 0.4;
  for (let i = on; i < env.length && (i - on) * 0.01 < max; i++) { if (env[i] < thr) { if (++quiet > 35 && (i - on) * 0.01 > least) { broke = true; break; } } else { quiet = 0; end = i; } }
  // If the model kept playing instead of stopping, cut at the quietest moment late in the window
  // (usually the gap between two notes) so the effect ends on a natural breath, not mid-note.
  if (!broke) { let lo = Infinity; for (let i = on + Math.floor((min || max * 0.55) * 100); i < Math.min(env.length, on + max * 100); i++) if (env[i] < lo) { lo = env[i]; end = i; } }
  const s = Math.max(0, on * 0.01 - 0.01), len = Math.min(max, (end - on) * 0.01 + (broke ? 0.25 : 0.05)), fo = Math.min(broke ? 0.4 : max >= 6 ? 1.2 : 0.15, len * 0.3);
  ff(["-i", raw, "-af", `atrim=${s}:${s + len},asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=${Math.max(0, len - fo)}:d=${fo},volume=${peakGain(x, s, s + len, -9)}`, ...enc, out]);
  return { secs: len };
}
// Hits: find each separate hit and save up to 6 of them as one-shots.
function sliceHits(raw, outBase, max) {
  const x = decodeMono(raw), env = envelope(x, 0.005), peak = Math.max(...env), thr = Math.max(-48, peak - 30), hits = [];
  let i = 0;
  while (i < env.length && hits.length < 6) {
    if (env[i] > thr) {
      const hp = Math.max(...env.slice(i, Math.min(env.length, i + 20))), floor = Math.max(-75, hp - 45);
      let j = i, quiet = 0; while (j < env.length && (j - i) * 0.005 < max) { if (env[j] < floor) { if (++quiet > 6) break; } else { quiet = 0; if (j > i + 30 && env[j] > env[j - 1] + 12) break; } j++; } // stop at silence or at the next separate sound
      const loud = Math.max(...env.slice(i, j));
      if ((j - i) * 0.005 > 0.03 && loud > peak - 14) hits.push([i * 0.005, Math.min(max, (j - i) * 0.005 + 0.03)]);
      i = j + 40;
    } else i++;
  }
  hits.forEach(([s, len], k) => ff(["-i", raw, "-af", `atrim=${Math.max(0, s - 0.004)}:${s + len},asetpts=PTS-STARTPTS,afade=t=in:d=0.003,afade=t=out:st=${Math.max(0, len - 0.06)}:d=0.06,volume=${peakGain(x, s, s + len, -12)}`, ...enc, `${outBase}_${k + 1}.mp3`]));
  return { count: hits.length };
}
// The seam figure compares the half-seconds either side of the loop point. The join itself is
// sample-continuous by construction; a few dB just means a note was dying away when the next began.
// Short clips are too brief for loudness matching, so effects are levelled by their peak instead.
function peakGain(x, from, to, targetDb) { let p = 1e-9; for (let i = Math.floor(from * SR); i < Math.min(x.length, to * SR); i++) p = Math.max(p, Math.abs(x[i])); return Math.pow(10, (targetDb - 20 * Math.log10(p)) / 20).toFixed(3); }
const vocalHint = (t) => (t && /[a-z]{3,}\s+[a-z]{3,}/i.test(t.replace(/\[[^\]]*\]/g, "")) ? t.slice(0, 120).replace(/\s+/g, " ") : "");

function writeLists() {
  const mus = {}; fs.readdirSync(MUSIC_OUT).filter((f) => f.endsWith(".mp3")).forEach((f) => (mus[f.slice(0, -4)] = "assets/music/" + f));
  fs.writeFileSync(path.join(MUSIC_OUT, "tracks.js"), "// Written by tools/make-music.mjs. Lists the music files the game can play.\nwindow.MUSIC_TRACKS = " + JSON.stringify(mus, null, 2) + ";\n");
  const sfx = {}; fs.readdirSync(SFX_OUT).filter((f) => f.endsWith(".mp3")).sort().forEach((f) => { const id = f.slice(0, -4).replace(/_\d+$/, (m) => (SFX[f.slice(0, -4)] ? m : "")); (sfx[id] = sfx[id] || []).push("assets/sfx/" + f); });
  fs.writeFileSync(path.join(SFX_OUT, "sfx.js"), "// Written by tools/make-music.mjs. Lists the sound-effect files the game can play.\nwindow.SFX_FILES = " + JSON.stringify(sfx, null, 2) + ";\n");
  return { music: Object.keys(mus), sfx: Object.keys(sfx) };
}

async function main() {
  loadEnv();
  [RAW, MUSIC_OUT, SFX_OUT].forEach((d) => fs.mkdirSync(d, { recursive: true }));
  const reprocess = flag("--reprocess"), only = opt("--only") ? opt("--only").split(",") : null;
  if (!reprocess && !process.env.OPENROUTER_API_KEY) { console.error("Missing OPENROUTER_API_KEY. Copy .env.example to .env and add your key."); process.exit(1); }
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0) { console.error("ffmpeg is required."); process.exit(1); }
  const jobs = [];
  if (!flag("--sfx")) Object.keys(MUSIC).forEach((id) => jobs.push({ id, type: "music", model: "google/lyria-3-pro-preview", prompt: `${MUSIC[id]} ${MUSIC_BASE}` }));
  if (!flag("--music")) Object.keys(SFX).forEach((id) => jobs.push({ id, type: "sfx", model: "google/lyria-3-clip-preview", prompt: `${SFX[id].prompt} ${SFX[id].base === "score" ? SCORE : SFX_BASE}` }));
  const report = [];
  for (const j of jobs) {
    if (only && !only.includes(j.id)) continue;
    const key = `${j.type}-${j.id}`, prev = fs.readdirSync(RAW).find((f) => f.startsWith(key + ".") && !f.endsWith(".txt"));
    let raw = prev ? path.join(RAW, prev) : null;
    if (!reprocess && (!raw || flag("--force"))) {
      process.stdout.write(`Generating ${key}... `);
      const t = Date.now(), r = await generate(j.prompt, j.model);
      raw = path.join(RAW, `${key}.${extOf(r.audio)}`); fs.writeFileSync(raw, r.audio); fs.writeFileSync(path.join(RAW, key + ".txt"), r.text || "");
      console.log(`${(r.audio.length / 1e6).toFixed(1)} MB, ${((Date.now() - t) / 1000).toFixed(0)} s`);
    }
    if (!raw) continue;
    const note = fs.existsSync(path.join(RAW, key + ".txt")) ? fs.readFileSync(path.join(RAW, key + ".txt"), "utf8") : "";
    try {
      if (j.type === "music") {
        const r = makeLoop(raw, path.join(MUSIC_OUT, j.id + ".mp3"));
        report.push(`music ${j.id.padEnd(8)} ${r.secs.toFixed(0)} s loop, trimmed ${r.trimmed[0]} s / ${r.trimmed[1]} s, seam ${r.seam} dB${r.gaps.length ? ", quiet gaps at " + r.gaps.join(" ") : ""}${vocalHint(note) ? ", MODEL TEXT: " + vocalHint(note) : ""}`);
      } else {
        fs.readdirSync(SFX_OUT).filter((f) => f === j.id + ".mp3" || new RegExp("^" + j.id + "_\\d+\\.mp3$").test(f)).forEach((f) => fs.unlinkSync(path.join(SFX_OUT, f)));
        const s = SFX[j.id];
        if (s.kind === "sting") { const r = makeSting(raw, path.join(SFX_OUT, j.id + ".mp3"), s.max, s.min); report.push(`sfx   ${j.id.padEnd(14)} ${r.secs.toFixed(2)} s`); }
        else { const r = sliceHits(raw, path.join(SFX_OUT, j.id), s.max); report.push(`sfx   ${j.id.padEnd(14)} ${r.count} one-shots`); }
      }
    } catch (e) { report.push(`FAILED ${key}: ${e.message}`); }
  }
  console.log("\n" + report.join("\n"));
  const l = writeLists(); console.log(`\nIn game: ${l.music.length} music tracks, ${l.sfx.length} effects`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
