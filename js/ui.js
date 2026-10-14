// ===================== DOM UI =====================
(function () {
  const G = window.G, U = (G.ui = {});
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const sw = (i, cls) => `<span class="sw ${cls || ""}" style="${G.swCss(i)}"></span>`;
  const mo = (i, cls) => `<span class="mo ${cls || ""}" style="${G.moCss(i)}"></span>`;
  const tcol = (b) => G.TIER[b.t].color;
  const starsOf = (b) => (b.s ? `<span class="stars">${"★".repeat(b.s)}</span>` : "");
  const SLOTNAME = ["Front 1", "Front 2", "Back 1", "Back 2", "Back 3"];
  const SLOTUNLOCK = [0, 0, 0, G.UNLOCK.slot4, G.UNLOCK.slot5];

  let dirty = { all: 1 }, open = null, pickSlot = null, wide = false, lastHud = 0, lastPanel = 0, statusKey = "", feedKey = "", modalTimer = null;
  U.pull = null;
  U.dirty = (n) => { dirty[n] = 1; };

  const PANELS = {
    warband: { title: "Warband", fn: pWarband },
    forge: { title: "Soulforge", fn: pForge },
    relics: { title: "Runes", fn: pRelics, lock: "runes" },
    stars: { title: "Constellation", fn: pStars, lock: "rebirth" },
    journal: { title: "Journal", fn: pJournal },
    bestiary: { title: "Bestiary", fn: pBestiary },
    exp: { title: "Expeditions", fn: pExp, lock: "expedition" },
    rift: { title: "Daily Rift", fn: pRift, lock: "rift" },
    more: { title: "Menu", fn: pMore },
    settings: { title: "Settings", fn: pSettings },
  };
  const NAV = ["forge", "relics", "stars", "bestiary", "exp", "rift", "settings"];

  // ---------- toasts / modal ----------
  U.toast = function (text, color) {
    const box = $("toasts"), d = document.createElement("div");
    d.className = "toast"; d.textContent = text; if (color) d.style.setProperty("--tc", color);
    box.appendChild(d); while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => d.classList.add("out"), 3000); setTimeout(() => d.remove(), 3500);
  };
  U.modal = function (html, cls) {
    clearInterval(modalTimer); modalTimer = null;
    $("modalCard").className = "modal-card " + (cls || ""); $("modalCard").innerHTML = html; $("modal").hidden = false;
  };
  U.closeModal = function () { clearInterval(modalTimer); modalTimer = null; $("modal").hidden = true; U.inspectU = null; };
  // Auto-resolve choice modals so an idle game never stalls.
  function countdown(secs, fn) {
    let n = secs; const tick = () => { const el = $("mCount"); if (el) el.textContent = n; if (n-- <= 0) { clearInterval(modalTimer); modalTimer = null; fn(); } };
    tick(); modalTimer = setInterval(tick, 1000);
  }

  // ---------- panels ----------
  U.open = function (p) {
    if (wide && (p === "warband" || p === "journal")) { const d = p === "warband" ? $("left") : $("right"); d.classList.remove("pulse"); void d.offsetWidth; d.classList.add("pulse"); return; }
    const P = PANELS[p]; if (!P) return;
    if (P.lock && !G.unlocked(P.lock)) { U.toast(`${P.title} unlocks at floor ${G.UNLOCK[P.lock]}`, "#a39279"); return; }
    open = p; $("center").classList.add("sheetopen"); $("sheet").hidden = false; $("sheet").dataset.p = p; $("sheetTitle").textContent = P.title; dirty[p] = 1; tabs();
    $("sheetBody").scrollTop = 0;
  };
  U.close = function () { open = null; pickSlot = null; $("center").classList.remove("sheetopen"); $("sheet").hidden = true; tabs(); dirty.warband = 1; };
  function tabs() { document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === (open || "descent") || (b.dataset.tab === "more" && open && !["warband", "forge", "journal"].includes(open)))); }

  function renderPanels() {
    const all = dirty.all;
    if (wide) { if (all || dirty.warband) $("left").innerHTML = `<h2 class="dock-h">Warband</h2>` + pWarband(); if (all || dirty.journal) $("right").innerHTML = `<h2 class="dock-h">Journal</h2>` + pJournal(); }
    if (open && (all || dirty[open])) { const body = $("sheetBody"), y = body.scrollTop; body.innerHTML = PANELS[open].fn(); body.scrollTop = y; }
    if (all || dirty.band) { buildBand(); lastHud = 0; }
    if (all || dirty.nav) $("deskNav").innerHTML = NAV.map((p) => { const P = PANELS[p], lock = P.lock && !G.unlocked(P.lock); return `<button data-act="open" data-p="${p}" class="${lock ? "locked" : ""}">${P.title}</button>`; }).join("");
    dirty = {};
  }

  // ----- blade bits -----
  function tile(b, extra) {
    const cls = (G.inParty(b.u) ? " inparty" : "") + (G.onExpedition(b.u) ? " away" : "") + (b.lock ? " locked" : "");
    return `<button class="tile${cls}" draggable="true" data-act="tile" data-u="${b.u}" style="--tc:${tcol(b)}" title="${esc(G.bladeName(b))}">${sw(b.i)}${starsOf(b)}${b.r ? '<span class="rn">' + G.RUNE[b.r.k].glyph + "</span>" : ""}${extra || ""}</button>`;
  }
  function slotLv(b) { const i = G.s.party.indexOf(b.u); return i >= 0 ? G.s.lv[i] : 0; }
  function bladeCard(b) {
    const st = G.bladeStat(b, slotLv(b)), T = G.TIER[b.t], sword = G.SW[b.i];
    return `<div class="bcard" style="--tc:${T.color}">
      ${sw(b.i, "big")}
      <div class="rar">${T.label}${b.s ? " · " + "★".repeat(b.s) : ""}</div>
      <div class="nm">${esc(G.bladeName(b))}</div>
      <div class="ty"><i class="eldot" style="background:${G.EL[st.el].color}"></i>${G.EL[st.el].label} · ${st.role}</div>
      <div class="st">${G.fmt(st.atk)} attack · ${G.fmt(st.hp)} guard · strikes every ${st.int.toFixed(2)}s</div>
      ${b.a.map((a) => `<div class="af">${G.AFFIX[a[0]].lab(a[1])}</div>`).join("")}
      ${b.r ? `<div class="af rune">${G.RUNE[b.r.k].glyph} ${G.runeText(b.r)}</div>` : ""}
      <div class="ul">Ultimate: <b>${esc(st.ult)}</b> ${st.named ? "strikes every foe" : "one heavy blow"} for ${st.ultMul}× attack</div>
      <div class="fl">${esc(sword.description)}</div>
    </div>`;
  }
  U.inspect = function (u, mode) {
    const b = G.blade(u); if (!b) return U.closeModal();
    U.inspectU = u;
    const s = G.s, inP = G.inParty(u), away = G.onExpedition(u), fod = G.fodderFor(b).length;
    let body = "";
    if (mode === "equip") {
      body = `<p class="hint">Choose a slot. Front blades take the hits.</p><div class="slotpick">` + SLOTNAME.map((n, i) => {
        if (i >= G.slotCount()) return `<button disabled>${n}<small>Floor ${SLOTUNLOCK[i]}</small></button>`;
        const cur = G.blade(s.party[i]); let d = "";
        if (cur && cur.u !== u) { const a = G.power(b, s.lv[i]), z = G.power(cur, s.lv[i]), pc = Math.round((a / z - 1) * 100); d = `<small class="${pc >= 0 ? "up" : "down"}">${pc >= 0 ? "▲ +" : "▼ "}${pc}%</small>`; }
        else if (!cur) d = "<small>empty</small>"; else d = "<small>here</small>";
        return `<button data-act="equip" data-u="${u}" data-i="${i}">${cur ? sw(cur.i) : ""}${n}${d}</button>`;
      }).join("") + `</div><button class="btn ghost" data-act="inspect" data-u="${u}">Back</button>`;
    } else if (mode === "rune") {
      const groups = {}; s.runes.forEach((r, i) => { const k = r.k + r.t; if (!groups[k]) groups[k] = { r, i, n: 0 }; groups[k].n++; });
      const list = Object.values(groups).sort((a, z) => z.r.t - a.r.t);
      body = `<div class="runelist">` + (list.length ? list.map((g) => `<button data-act="socket" data-u="${u}" data-i="${g.i}"><b>${G.RUNE[g.r.k].glyph}</b>${G.runeName(g.r)}<small>${G.runeText(g.r)} · ×${g.n}</small></button>`).join("") : `<p class="hint">No loose runes. Bosses and champion packs drop them.</p>`) + `</div>
        ${b.r ? `<button class="btn ghost" data-act="unsocket" data-u="${u}">Remove ${G.runeName(b.r)}</button>` : ""}<button class="btn ghost" data-act="inspect" data-u="${u}">Back</button>`;
    } else {
      body = `<div class="acts">
        <button class="btn gold" data-act="inspect" data-u="${u}" data-m="equip" ${away ? "disabled" : ""}>${inP ? "Move" : "Equip"}</button>
        ${G.unlocked("ascend") ? `<button class="btn" data-act="ascend" data-u="${u}" ${fod && b.s < 5 ? "" : "disabled"}>Ascend${fod ? " (" + fod + ")" : ""}</button>` : ""}
        ${G.unlocked("runes") ? `<button class="btn" data-act="inspect" data-u="${u}" data-m="rune">Rune</button>` : ""}
        <button class="btn" data-act="lock" data-u="${u}">${b.lock ? "Unlock" : "Lock"}</button>
        ${inP || away ? "" : `<button class="btn danger" data-act="salvage" data-u="${u}" ${b.lock ? "disabled" : ""}>Salvage +${G.fmt(G.salvageValue(b))} ✦</button>`}
      </div>${away ? `<p class="hint">Away on an expedition.</p>` : ""}`;
    }
    U.modal(`<button class="iconbtn mclose" data-act="modalClose" aria-label="Close">✕</button>${bladeCard(b)}${body}`, "inspect");
  };

  // ----- band (the five slots under the stage) -----
  function buildBand() {
    const n = G.slotCount(); let h = "";
    for (let i = 0; i < 5; i++) {
      const p = G.party[i], locked = i >= n;
      h += `<div class="bslot${locked ? " locked" : ""}">
        <button class="slot" data-act="slot" data-i="${i}" data-drop="${i}" id="bs${i}" style="--tc:${p ? tcol(p.b) : "#3b2a22"};--ec:${p ? G.EL[p.st.el].color : "#3b2a22"}" title="${p ? esc(G.bladeName(p.b)) : SLOTNAME[i]}">
          ${p ? sw(p.b.i) : locked ? `<span class="lk">Floor<br>${SLOTUNLOCK[i]}</span>` : `<span class="plus">+</span>`}
          <span class="pos">${i < 2 ? "F" : "B"}</span><span class="lv" id="blv${i}"></span>
          <span class="hpb"><i id="bhp${i}"></i></span><span class="rgb"><i id="brg${i}"></i></span>
        </button>
        <button class="lvl" data-act="lvl" data-i="${i}" id="bup${i}" ${p ? "" : "disabled"}>▲<b id="bco${i}"></b></button>
      </div>`;
    }
    $("band").innerHTML = h;
    $("ctl").innerHTML = `<button class="btn gold" data-act="lvlAll" id="lvlAll">Level all</button>
      <button class="btn" data-act="speed" id="spdBtn"></button>
      <button class="btn" data-act="auto" id="autoBtn"></button>
      <button class="btn" data-act="pause" id="pauseBtn" aria-label="Pause">❚❚</button>`;
  }

  function pWarband() {
    const s = G.s, n = G.slotCount();
    const slot = (i) => {
      const b = G.blade(s.party[i]);
      if (i >= n) return `<div class="fslot locked"><span class="lk">Floor ${SLOTUNLOCK[i]}</span><small>${SLOTNAME[i]}</small></div>`;
      if (!b) return `<button class="fslot empty${pickSlot === i ? " picking" : ""}" data-act="pick" data-i="${i}" data-drop="${i}"><span class="plus">+</span><small>${SLOTNAME[i]}</small></button>`;
      const st = G.bladeStat(b, s.lv[i]);
      return `<button class="fslot${pickSlot === i ? " picking" : ""}" data-act="pick" data-i="${i}" data-drop="${i}" style="--tc:${tcol(b)}">${sw(b.i)}<span class="fn">${esc(G.SW[b.i].name)}${starsOf(b)}</span><small><i class="eldot" style="background:${G.EL[st.el].color}"></i>${st.role} · Lv ${s.lv[i]}</small></button>`;
    };
    const res = G.res.list.length ? G.res.list.map((r) => `<div class="res"><i class="eldot" style="background:${G.EL[r.el].color}"></i><b>${G.EL[r.el].label} ×${r.n}</b> ${r.full ? "+25% damage. " + G.EL[r.el].trait + "." : "+10% damage. One more for its trait."}</div>`).join("") : `<div class="res dim">No resonance. Field two blades of one element for +10% damage, three for its trait.</div>`;
    const fam = G.biomeOf(G.curFloor()).id, weak = Object.keys(G.EL).filter((e) => G.EL[e].counter.includes(fam));
    const bench = s.blades.slice().sort((a, z) => G.TIER[z.t].rank - G.TIER[a.t].rank || G.power(z) - G.power(a));
    const cur = pickSlot != null ? G.blade(s.party[pickSlot]) : null;
    const tiles = bench.slice(0, 150).map((b) => {
      let x = "";
      if (pickSlot != null && cur && cur.u !== b.u) { const up = G.power(b, s.lv[pickSlot]) >= G.power(cur, s.lv[pickSlot]); x = `<span class="cmp ${up ? "up" : "down"}">${up ? "▲" : "▼"}</span>`; }
      return tile(b, x);
    }).join("");
    return `<div class="formation"><div class="frow"><span class="rowl">Front</span>${slot(0)}${slot(1)}</div><div class="frow"><span class="rowl">Back</span>${slot(2)}${slot(3)}${slot(4)}</div></div>
      ${res}
      <div class="res dim">${G.biomeOf(G.curFloor()).name}: ${G.FAMLABEL[fam]}${weak.length ? ", weak to " + weak.map((w) => `<b style="color:${G.EL[w].color}">${G.EL[w].label}</b>`).join(" and ") : ""}.</div>
      <div class="rowbtns"><button class="btn" data-act="autofill">Field the strongest</button>${G.unlocked("ascend") ? `<button class="btn" data-act="ascendAll">Ascend duplicates</button>` : ""}<button class="btn" data-act="salvageStone">Salvage spare Stone</button></div>
      <h3>${pickSlot != null ? "Choose a blade for " + SLOTNAME[pickSlot] : "Armory"} <small>${s.blades.length} blades</small></h3>
      <div class="tiles">${tiles}</div>${bench.length > 150 ? `<p class="hint">Showing the best 150. Salvage or ascend to tidy up.</p>` : ""}`;
  }

  function pForge() {
    const s = G.s, ten = G.unlocked("ten"), el = G.bannerEl(), top = G.topChance(), blessed = Date.now() < s.star;
    let stage;
    if (U.pull && U.pull.phase === "charge") stage = `<div class="fstage charging" data-act="skipPull" style="--rc:${U.pull.tell ? G.TIER[U.pull.best].color : "#c9a24b"}"><div class="ring"></div><div class="rune-big">ᛟ</div></div>`;
    else if (U.pull) stage = `<div class="fstage shown" style="--rc:${G.TIER[U.pull.best].color}"><div class="rays${G.TIER[U.pull.best].rank >= 3 ? " on" : ""}"></div><div class="pulls n${U.pull.list.length}">` + U.pull.list.map((b, i) => `<button class="pcard" data-act="tile" data-u="${b.u}" style="--tc:${tcol(b)};animation-delay:${U.pull.fresh ? i * 80 : 0}ms">${sw(b.i)}<span class="rar">${G.TIER[b.t].label}</span><span class="nm">${esc(G.bladeName(b))}</span>${U.pull.list.length === 1 ? b.a.map((a) => `<span class="af">${G.AFFIX[a[0]].lab(a[1])}</span>`).join("") : ""}</button>`).join("") + `</div></div>`;
    else stage = `<div class="fstage idle" style="--rc:#c9a24b"><div class="ring"></div><div class="rune-big">ᛟ</div></div>`;
    if (U.pull) U.pull.fresh = false;
    return `<div class="banner" style="--ec:${G.EL[el].color}"><b>This week: ${G.EL[el].label} blades favoured</b><span>Half of all summons draw from the ${G.EL[el].label} pool when one exists.</span></div>
      ${stage}
      <div class="rowbtns center"><button class="btn gold big" data-act="summon" data-n="1" ${s.sigils >= 1 ? "" : "disabled"}>Summon ×1<small>◆ 1</small></button>
      <button class="btn gold big" data-act="summon" data-n="10" ${ten && s.sigils >= 10 ? "" : "disabled"}>${ten ? "Summon ×10" : "×10 at floor 10"}<small>${ten ? "◆ 10 · Arcane or better guaranteed" : "locked"}</small></button></div>
      <div class="pity"><div class="bar"><i style="width:${(s.pity / G.PITY_HARD) * 100}%"></i></div><span>${s.boon ? "The Hollow Blade's boon: next summon is Forge tier or better." : `Forge tier guaranteed within ${G.PITY_HARD - s.pity} summons. Current odds ${(top * 100).toFixed(1)}%.`}</span></div>
      ${blessed ? `<div class="res" style="color:#ffe9a8">Star-blessed: top-tier odds doubled for ${G.fmtTime((s.star - Date.now()) / 1000)}.</div>` : ""}
      <div class="rates"><i style="color:${G.TIER.common.color}">Stone 60%</i><i style="color:${G.TIER.rare.color}">Frost 28%</i><i style="color:${G.TIER.epic.color}">Arcane 9%</i><i style="color:${G.TIER.legendary.color}">Forge 2.7%</i><i style="color:${G.TIER.mythic.color}">Mythic 0.3%</i></div>
      <p class="hint">Every blade rolls its own affixes. Odds climb from summon ${G.PITY_SOFT}. Sigils come from bosses, new depths, imps, bounties and time in the dungeon.</p>`;
  }

  function pRelics() {
    const s = G.s, groups = {};
    s.runes.forEach((r) => { const k = r.k + r.t; if (!groups[k]) groups[k] = { r, n: 0 }; groups[k].n++; });
    const list = Object.values(groups).sort((a, z) => z.r.t - a.r.t || a.r.k.localeCompare(z.r.k));
    const worn = s.blades.filter((b) => b.r);
    return `<p class="hint">Each blade holds one rune. Socket from a blade's card. Three of a kind fuse into the next rank.</p>
      <div class="runelist">${list.length ? list.map((g) => `<div class="runerow"><b>${G.RUNE[g.r.k].glyph}</b><span>${G.runeName(g.r)}<small>${G.runeText(g.r)} · ×${g.n}</small></span>${g.r.t < 3 ? `<button class="btn" data-act="fuse" data-k="${g.r.k}" data-t="${g.r.t}" ${g.n >= 3 ? "" : "disabled"}>Fuse 3</button>` : ""}</div>`).join("") : `<p class="hint">No loose runes yet. Bosses and champion packs drop them.</p>`}</div>
      ${worn.length ? `<h3>Socketed</h3><div class="tiles">${worn.map((b) => tile(b)).join("")}</div>` : ""}`;
  }

  function pStars() {
    const s = G.s, gain = G.emberGain(s.runBest), pos = {}; G.STARS.forEach((st) => (pos[st.id] = st));
    const svg = `<svg class="starmap" viewBox="0 0 300 215" role="img" aria-label="Constellation map">` +
      G.STAR_LINKS.map((l) => `<line x1="${pos[l[0]].x}" y1="${pos[l[0]].y}" x2="${pos[l[1]].x}" y2="${pos[l[1]].y}" class="${G.con(l[0]) && G.con(l[1]) ? "lit" : ""}"/>`).join("") +
      G.STARS.map((st) => { const L = G.con(st.id); return `<g class="${L ? "lit" : ""}"><circle cx="${st.x}" cy="${st.y}" r="${5 + Math.min(7, L * 0.5)}"/><text x="${st.x}" y="${st.y + 24}">${st.name}${L ? " " + L : ""}</text></g>`; }).join("") + `</svg>`;
    const next = 1 + 5 * G.con("momentum");
    return `<div class="rebirth"><div><b>Rebirth</b><span>Deepest this run: floor ${s.runBest}. Returns you to floor ${Math.max(1, Math.min(next, s.best - 10))} with slot levels and souls reset. Blades, stars, runes and this constellation stay.</span></div>
      <button class="btn gold big" data-act="rebirthAsk" ${gain > 0 ? "" : "disabled"}>Rebirth<small>+${gain} ✹</small></button></div>
      ${svg}
      <div class="starlist">${G.STARS.map((st) => { const L = G.con(st.id), c = G.starCost(st), max = L >= st.max; return `<div class="starrow"><span><b>${st.name}</b> <em>${L}/${st.max}</em><small>${st.desc} per rank</small></span><button class="btn" data-act="buyStar" data-id="${st.id}" ${!max && s.embers >= c ? "" : "disabled"}>${max ? "Max" : "✹ " + c}</button></div>`; }).join("")}</div>`;
  }

  function pJournal() {
    const s = G.s, nextU = G.UNLOCK_TEXT.find((u) => s.best < u[0]);
    let h = nextU ? `<div class="res"><b>Next unlock, floor ${nextU[0]}:</b> ${nextU[1]}</div>` : "";
    if (s.omen.sealed > 0) h += `<div class="claimrow"><span><b>Sealed omens ×${s.omen.sealed}</b><small>Found while you were away</small></span><button class="btn gold" data-act="openSealed">Open</button></div>`;
    if (G.unlocked("bounty") && s.bounty) h += `<h3>Bounties <small>reset daily</small></h3>` + s.bounty.list.map((b, i) => `<div class="claimrow"><span>${G.bountyText(b)}<div class="bar"><i style="width:${(b.n / b.goal) * 100}%"></i></div></span><button class="btn${b.n >= b.goal && !b.done ? " gold" : ""}" data-act="claimBounty" data-i="${i}" ${b.n >= b.goal && !b.done ? "" : "disabled"}>${b.done ? "Done" : "◆ " + b.rew}</button></div>`).join("");
    else h += `<div class="res dim">Bounties unlock at floor ${G.UNLOCK.bounty}.</div>`;
    const feats = G.FEATS.filter((f) => !s.feats[f.id]).sort((a, z) => z.get(s) / z.goal - a.get(s) / a.goal).slice(0, 5);
    h += `<h3>Feats <small>${Object.keys(s.feats).length}/${G.FEATS.length}</small></h3>` + feats.map((f) => { const v = Math.min(f.goal, f.get(s)), ok = v >= f.goal; return `<div class="claimrow"><span><b>${f.name}</b> ${f.text}<div class="bar"><i style="width:${(v / f.goal) * 100}%"></i></div></span><button class="btn${ok ? " gold" : ""}" data-act="claimFeat" data-id="${f.id}" ${ok ? "" : "disabled"}>◆ ${f.rew}</button></div>`; }).join("");
    h += `<h3>Loot log</h3><div class="log">${s.log.length ? s.log.slice(0, 14).map((l) => `<p style="color:${l.c || "inherit"}">${esc(l.t)}</p>`).join("") : `<p class="dim">Nothing yet.</p>`}</div>`;
    return h;
  }

  function pBestiary() {
    const s = G.s; let h = `<div class="res">Slay 50 of a kind to master it. Each mastered kind adds 1% damage. Now <b>+${Math.round(G.bestiaryBonus * 100)}%</b> of 25%.</div>`;
    G.BIOMES.forEach((b, bi) => {
      const ids = Object.keys(G.FAM).map(Number).filter((i) => G.FAM[i] === b.id), weak = Object.keys(G.EL).filter((e) => G.EL[e].counter.includes(b.id));
      const seen = s.best > bi * 10;
      h += `<h3>${seen ? b.name : "???"} <small>${G.FAMLABEL[b.id]}${weak.length ? " · weak to " + weak.map((w) => G.EL[w].label).join(", ") : ""}</small></h3><div class="beasts">` + ids.map((i) => {
        const k = s.mk[i] || 0;
        return `<div class="beast${k ? "" : " unseen"}${k >= 50 ? " master" : ""}">${mo(i)}${s.gild[i] ? '<em title="Gilded variant slain">★</em>' : ""}<span>${k ? esc(G.MON[i].type) : "???"}</span><small>${k ? G.fmt(k) : ""}</small></div>`;
      }).join("") + `</div>`;
    });
    return h;
  }

  function pExp() {
    const s = G.s, now = Date.now();
    const bench = s.blades.filter((b) => !G.inParty(b.u) && !G.onExpedition(b.u)).sort((a, z) => G.TIER[z.t].rank - G.TIER[a.t].rank || z.s - a.s).slice(0, 3);
    let h = `<p class="hint">Benched blades can scout on their own. Higher tiers and stars bring back more.</p>`;
    s.exp.forEach((e, i) => { const done = now >= e.end; h += `<div class="claimrow"><span><span class="minis">${e.u.map((u) => { const b = G.blade(u); return b ? sw(b.i) : ""; }).join("")}</span><small>${done ? "Returned" : "Back in " + G.fmtTime((e.end - now) / 1000)}</small></span><button class="btn${done ? " gold" : ""}" data-act="claimExp" data-i="${i}" ${done ? "" : "disabled"}>Claim</button></div>`; });
    if (s.exp.length < G.EXP_SLOTS) h += bench.length ? `<h3>Send out <small>${G.EXP_SLOTS - s.exp.length} party free</small></h3><div class="minis big">${bench.map((b) => tile(b)).join("")}</div><div class="rowbtns">${[1, 4, 8].map((n) => `<button class="btn" data-act="sendExp" data-h="${n}">${n} hour${n > 1 ? "s" : ""}</button>`).join("")}</div><p class="hint">Sends your three best benched blades.</p>` : `<p class="hint">No benched blades to send. Summon more at the Soulforge.</p>`;
    return h;
  }

  function pRift() {
    const s = G.s, m = G.riftMod(), used = s.rift.day === G.day();
    return `<div class="banner" style="--ec:#b56bff"><b>Today: ${m.name}</b><span>${m.desc}</span></div>
      <p class="hint">Three minutes. Starts at 60% of your deepest floor. No souls, but every two floors of depth is a sigil.</p>
      <div class="res">Best depth: <b>${s.rift.best || 0}</b></div>
      <div class="rowbtns center"><button class="btn gold big" data-act="startRift" ${used || G.rift ? "disabled" : ""}>${G.rift ? "In the rift" : used ? "Sealed until tomorrow" : "Enter the rift"}</button></div>`;
  }

  function pMore() {
    return `<div class="menu">` + ["warband", "forge", "journal"].concat(NAV).filter((p) => !(wide && (p === "warband" || p === "journal"))).map((p) => { const P = PANELS[p], lock = P.lock && !G.unlocked(P.lock); return `<button data-act="open" data-p="${p}" class="${lock ? "locked" : ""}">${P.title}${lock ? `<small>Floor ${G.UNLOCK[P.lock]}</small>` : ""}</button>`; }).join("") + `</div>`;
  }

  function pSettings() {
    const s = G.s, t = (k, label, hint) => `<div class="claimrow"><span><b>${label}</b><small>${hint}</small></span><button class="btn${s.set[k] ? " gold" : ""}" data-act="set" data-k="${k}">${s.set[k] ? "On" : "Off"}</button></div>`;
    return t("sound", "Sound", "Synthesized, no downloads") + t("calm", "Calm mode", "No screen shake, flashes or vibration") + t("autoUlt", "Auto-cast ultimates", "Manual casts hit 25% harder") +
      `<h3>Record</h3><div class="log"><p>Deepest floor ${s.best} · ${G.fmt(s.kills)} kills · ${s.pulls} summons</p><p>${s.rebirths} rebirths · ${s.stat.wipes} wipes · ${s.secrets} secrets found</p><p>${G.fmt(s.stat.dmg)} damage dealt · ${G.fmtTime(s.stat.online)} in the dungeon</p></div>
      <h3>Save</h3><div class="rowbtns"><button class="btn" data-act="export">Copy save code</button><button class="btn" data-act="importAsk">Load save code</button><button class="btn danger" data-act="resetAsk">Erase everything</button></div>
      <p class="hint">Idle Blade Master ${G.VERSION}. Keys: 1 to 5 cast, Space pauses, L levels, G opens the forge.</p>`;
  }

  // ---------- HUD (fast path, no innerHTML) ----------
  function setText(id, v) { const e = $(id); if (e && e.textContent !== v) e.textContent = v; }
  function hud() {
    const s = G.s, C = G.combat, f = G.curFloor(), b = G.biomeOf(f);
    setText("souls", G.fmt(s.souls)); setText("sigils", G.fmt(s.sigils)); setText("embers", G.fmt(s.embers));
    $("embWrap").hidden = !(s.embers > 0 || s.rebirths > 0);
    setText("floorNo", (G.rift ? "Rift " : "Floor ") + f); setText("biome", G.rift ? G.rift.mod.name : b.name + (G.loopOf(f) ? " " + "I".repeat(Math.min(3, G.loopOf(f)) + 1) : ""));
    if (C) { const pips = $("pips"); if (pips.children.length !== C.waves) pips.innerHTML = "<i></i>".repeat(C.waves); for (let i = 0; i < C.waves; i++) pips.children[i].className = i < (C.state === "gap" ? C.wave : C.wave - 1) ? "on" : i === C.wave - 1 ? "cur" : ""; }
    let cheapest = Infinity;
    for (let i = 0; i < 5; i++) {
      const p = G.party[i], cb = C && C.blades[i], el = $("bs" + i); if (!el) continue;
      if (!p) continue;
      const cost = G.slotCost(s.lv[i]); cheapest = Math.min(cheapest, cost);
      $("bhp" + i).style.width = (cb ? Math.max(0, cb.hp / cb.max) * 100 : 100) + "%"; $("brg" + i).style.width = G.rage[i] + "%";
      el.classList.toggle("ready", G.rage[i] >= 100); el.classList.toggle("dead", !!(cb && cb.dead));
      setText("blv" + i, "Lv " + s.lv[i]); setText("bco" + i, G.fmt(cost)); $("bup" + i).classList.toggle("can", s.souls >= cost);
    }
    const la = $("lvlAll"); if (la) { la.classList.toggle("dimmed", s.souls < cheapest); setText("spdBtn", s.set.speed + "×"); const ab = $("autoBtn"); ab.textContent = s.set.autoUlt ? "Auto ult" : "Manual ult"; ab.classList.toggle("gold", s.set.autoUlt); $("pauseBtn").textContent = G.paused === "user" ? "▶" : "❚❚"; }
    // boss bar
    const boss = C && C.state === "fight" && C.enemies.find((e) => (e.kind === "boss" || e.kind === "hollow") && e.hp > 0);
    $("bossBar").hidden = !boss; if (boss) { setText("bossName", boss.name); $("bossFill").style.width = (boss.hp / boss.max) * 100 + "%"; }
    // status chips
    const chips = [];
    if (G.rift) chips.push(["#b56bff", "Rift closes in " + G.fmtTime(G.rift.t)]);
    if (s.hold && !G.rift) chips.push(["#ffab2e", `Farming floor ${s.floor}`, "push", "Push on"]);
    if (s.path && !G.rift) chips.push(["#c9a24b", s.path.name]);
    if (s.curse > 0) chips.push(["#b56bff", `Cursed: ${s.curse} floors, double loot`]);
    if (s.moon > 0) chips.push(["#ff3b3b", `Blood moon: ${s.moon} floors`]);
    if (Date.now() < s.star) chips.push(["#ffe9a8", "Star-blessed " + G.fmtTime((s.star - Date.now()) / 1000)]);
    if (s.boon) chips.push(["#ffab2e", "Hollow boon ready"]);
    if (s.omen.pend) { const o = G.OMENS.find((x) => x.id === s.omen.pend.id); chips.push([o.color, o.sign]); }
    const key = chips.map((c) => c[1]).join("|");
    if (key !== statusKey) { statusKey = key; $("status").innerHTML = chips.map((c) => `<span class="chip" style="--tc:${c[0]}">${esc(c[1])}${c[2] ? `<button data-act="${c[2]}">${c[3]}</button>` : ""}</span>`).join(""); }
    // omen candle
    const fl = $("flame"), heat = s.best < 5 ? 0 : s.omen.pend ? 1 : Math.min(1, s.omen.since / 14);
    fl.style.transform = `translateX(-50%) scale(${0.45 + heat * 0.9})`; fl.style.opacity = s.best < 5 ? 0.25 : 0.6 + heat * 0.4;
    $("omenBtn").classList.toggle("lit", !!s.omen.pend);
    // feed under the controls (phone)
    const nextU = G.UNLOCK_TEXT.find((u) => s.best < u[0]), fam = b.id, weak = Object.keys(G.EL).filter((x) => G.EL[x].counter.includes(fam));
    const feed = [nextU ? `<p><b>Floor ${nextU[0]}:</b> ${nextU[1]}</p>` : "", `<p>${G.FAMLABEL[fam]} here${weak.length ? ", weak to " + weak.map((w) => `<b style="color:${G.EL[w].color}">${G.EL[w].label}</b>`).join(" and ") : ""}. Warband deals ${G.fmt(G.partyDps())} a second.</p>`].concat(s.log.slice(0, 3).map((l) => `<p class="dim">${esc(l.t)}</p>`)).join("");
    if (feed !== feedKey) { feedKey = feed; $("info").innerHTML = feed; }
    // dots
    $("forgeDot").hidden = s.sigils < (G.unlocked("ten") ? 10 : 1);
    $("journalDot").hidden = !(s.omen.sealed > 0 || (G.unlocked("bounty") && s.bounty && s.bounty.list.some((x) => x.n >= x.goal && !x.done)) || G.FEATS.some((x) => !s.feats[x.id] && x.get(s) >= x.goal));
  }

  U.frame = function (now) {
    if (now - lastHud > 90) { lastHud = now; hud(); }
    if (now - lastPanel > 220 && Object.keys(dirty).length) { lastPanel = now; renderPanels(); }
  };
  let slow = 0;
  U.slowTick = function () { // once a second: things that change with the clock
    if (open === "exp" || open === "rift" || open === "forge") { if (!(open === "forge" && U.pull)) dirty[open] = 1; }
    if (++slow % 3 === 0) { dirty.journal = 1; if (wide) dirty.warband = 1; }
  };

  // ---------- sim events ----------
  function advice(a) {
    const act = { swap: ["open", "warband", "Open warband"], level: ["lvlAll", "", "Level all"], summon: ["open", "forge", "To the forge"], rebirth: ["open", "stars", "Constellation"] }[a.k];
    const el = $("advice"); el.hidden = false;
    el.innerHTML = `<span>${esc(a.text)}</span>${act ? `<button class="btn gold" data-act="${act[0]}" data-p="${act[1]}">${act[2]}</button>` : ""}<button class="iconbtn" data-act="hideAdvice" aria-label="Dismiss">✕</button>`;
    clearTimeout(advice.t); advice.t = setTimeout(() => (el.hidden = true), 14000);
  }
  U.on = function (e) {
    const s = G.s;
    switch (e.t) {
      case "floor": if (e.boss) { U.toast(`Floor ${e.f} guardian slain`, "#ffab2e"); dirty.all = 1; } break;
      case "unlock": U.toast(`Floor ${e.floor} reached: ${e.text}`, "#c9a24b"); G.render.banner("UNLOCKED", "#c9a24b", e.text); dirty.all = 1; G.recalc(); break;
      case "wipe": advice(e.advice); dirty.warband = 1; break;
      case "omen": { const o = G.OMENS.find((x) => x.id === e.id); U.toast("Omen: " + o.sign, o.color); break; }
      case "imp": U.toast("A treasure imp! Cut it down before it escapes.", "#ffd24a"); G.render.banner("TREASURE IMP", "#ffd24a"); break;
      case "impFled": U.toast("The imp got away.", "#a39279"); break;
      case "champion": G.render.banner("CHAMPION PACK", "#ff8a2a", "A named elite walks this floor"); break;
      case "moon": G.render.banner("BLOOD MOON", "#ff3b3b", "Ten floors of champions and double souls"); U.toast("Blood moon rises.", "#ff3b3b"); break;
      case "moonEnd": U.toast("The moon sets. +10 sigils", "#ffd24a"); break;
      case "curse": U.toast("Cursed for 5 floors. Double loot.", "#b56bff"); break;
      case "curseEnd": U.toast("The curse lifts.", "#b56bff"); break;
      case "hollowStart": G.render.banner("THE HOLLOW BLADE", "#8fa3c8", "It waits at the end of this floor"); break;
      case "hollowWin": U.toast("Your next summon is Forge tier or better.", "#ffab2e"); break;
      case "star": U.toast("A falling star. Top-tier odds doubled for 10 minutes.", "#ffe9a8"); dirty.forge = 1; break;
      case "drop": if (e.kind === "rune") { U.toast("Found " + G.runeName(e.rune), "#55c6f8"); dirty.relics = 1; } G.audio.buzz(20); break;
      case "kill": if (e.kind === "gild") U.toast("Gilded foe slain! +1 sigil", "#ffd24a"); break;
      case "rebirth": dirty.all = 1; U.toast(`Reborn with ${e.gain} Embers.`, "#ff8a2a"); break;
      case "riftStart": G.render.banner("THE RIFT", "#b56bff", G.rift.mod.name); dirty.all = 1; break;
      case "riftEnd": U.modal(`<h2>Rift sealed</h2><p class="hint">${e.wiped ? "Your warband fell." : "Time ran out."}</p><div class="report"><div><b>${e.depth}</b><span>floors deep</span></div><div><b>+${e.rew}</b><span>sigils</span></div></div><button class="btn gold big" data-act="modalClose">Return</button>`); dirty.all = 1; break;
      case "shrine":
        U.modal(`<h2 style="color:#b56bff">Cursed Shrine</h2><p>The violet flame offers a bargain. For five floors foes strike 50% harder, and everything they drop is doubled.</p><div class="rowbtns center"><button class="btn gold big" data-act="shrine" data-v="1">Take the curse</button><button class="btn big" data-act="shrine" data-v="0">Walk past <small>auto in <span id="mCount"></span>s</small></button></div>`, "event");
        countdown(20, () => A.shrine({ v: "0" })); break;
      case "smith":
        U.smithOffers = e.offers;
        U.modal(`<h2 style="color:#ffb45a">The Wandering Smith</h2><p>He sets down his anvil without a word and holds up three fingers. Choose one.</p><div class="choices">${e.offers.map((o, i) => `<button class="btn big" data-act="smith" data-i="${i}">${esc(o.text)}</button>`).join("")}</div><p class="hint">Takes the last offer in <span id="mCount"></span>s.</p>`, "event");
        countdown(25, () => A.smith({ i: String(e.offers.length - 1) })); break;
      case "paths":
        U.pathOffers = e.offers;
        U.modal(`<h2>Three doors</h2><p class="hint">The guardian is dead. Each door shapes the next ten floors.</p><div class="doors">${e.offers.map((o, i) => `<button class="door" data-act="path" data-i="${i}" style="--dc:${o.hidden ? "#8fa3c8" : o.color}"><span class="arch">${o.hidden ? "?" : ""}</span><b>${o.hidden ? "Unmarked door" : o.name}</b><small>${o.hidden ? "Unknown path. +1 sigil for your nerve." : o.desc}</small></button>`).join("")}</div><p class="hint">Takes the left door in <span id="mCount"></span>s.</p>`, "event");
        countdown(15, () => A.path({ i: "0" })); break;
    }
  };

  // ---------- actions ----------
  function afterPower() { dirty.warband = 1; dirty.band = 1; }
  const A = {
    open: (d) => U.open(d.p), close: () => U.close(), modalClose: () => U.closeModal(), hideAdvice: () => ($("advice").hidden = true),
    slot(d) { const i = +d.i, p = G.party[i]; if (!p) { if (i < G.slotCount()) { pickSlot = i; U.open("warband"); dirty.warband = 1; } return; } if (!G.castUlt(i)) U.inspect(p.b.u); },
    lvl(d) { if (G.levelSlot(+d.i)) { G.refreshBlades(); G.audio.play("level"); dirty.warband = 1; } },
    lvlAll() { const n = G.levelAll(); if (n) { G.audio.play("level"); dirty.warband = 1; $("advice").hidden = true; } else U.toast("Not enough souls yet.", "#a39279"); },
    speed() { G.s.set.speed = (G.s.set.speed % 3) + 1; },
    auto() { G.s.set.autoUlt = !G.s.set.autoUlt; dirty.settings = 1; },
    pause() { if (G.paused === "user") G.paused = null; else if (!G.paused) G.paused = "user"; },
    push() { G.pushOn(); U.toast("Pushing on at the next clear.", "#ffab2e"); },
    pick(d) { const i = +d.i; pickSlot = pickSlot === i ? null : i; dirty.warband = 1; },
    tile(d) { const u = +d.u; if (pickSlot != null && (open === "warband" || wide) && $("modal").hidden && G.blade(u) && !G.onExpedition(u)) { G.equip(u, pickSlot); pickSlot = null; afterPower(); G.audio.play("click"); } else U.inspect(u); },
    inspect(d) { U.inspect(+d.u, d.m); },
    equip(d) { if (G.equip(+d.u, +d.i)) { afterPower(); U.closeModal(); G.audio.play("click"); } },
    autofill() { G.autoParty(); G.refreshBlades(); afterPower(); U.toast("Strongest blades fielded, toughest in front.", "#c9a24b"); },
    ascendAll() { const n = G.ascendAll(); afterPower(); U.toast(n ? `${n} duplicate${n > 1 ? "s" : ""} ascended.` : "No duplicates to ascend.", "#c9a24b"); },
    salvageStone() { const r = G.salvageStone(); afterPower(); U.toast(r.n ? `Salvaged ${r.n} Stone blades for ${G.fmt(r.v)} souls.` : "No spare Stone blades.", "#c9a24b"); },
    ascend(d) { const b = G.blade(+d.u), f = G.fodderFor(b).sort((a, z) => a.s - z.s)[0]; if (b && f && G.ascend(b, f)) { afterPower(); U.inspect(b.u); G.audio.play("drop"); } },
    lock(d) { const b = G.blade(+d.u); if (b) { b.lock = !b.lock; dirty.warband = 1; U.inspect(b.u); } },
    salvage(d) { const b = G.blade(+d.u); if (b) { const v = G.salvage(b); if (v) { U.closeModal(); afterPower(); U.toast(`Salvaged for ${G.fmt(v)} souls.`, "#c9a24b"); } } },
    socket(d) { const b = G.blade(+d.u); if (b && G.socket(b, +d.i)) { dirty.relics = 1; afterPower(); U.inspect(b.u); } },
    unsocket(d) { const b = G.blade(+d.u); if (b && G.unsocket(b)) { dirty.relics = 1; afterPower(); U.inspect(b.u); } },
    fuse(d) { if (G.fuseRunes(d.k, +d.t)) { dirty.relics = 1; G.audio.play("drop"); } },
    summon(d) {
      const n = +d.n, list = G.summon(n); if (!list) return U.toast("Not enough sigils.", "#a39279");
      const best = list.reduce((a, b) => (G.TIER[b.t].rank > G.TIER[a].rank ? b.t : a), "common");
      // New players: drop fresh blades straight into empty slots.
      list.forEach((b) => { const i = G.s.party.findIndex((u, k) => u == null && k < G.slotCount()); if (i >= 0) G.equip(b.u, i); });
      afterPower();
      const quick = G.s.set.calm;
      U.pull = { list, best, phase: quick ? "show" : "charge", tell: false, fresh: true }; dirty.forge = 1;
      clearTimeout(U.pullT); clearTimeout(U.pullT2);
      if (quick) return G.audio.play("reveal", G.TIER[best].rank);
      G.audio.play("charge");
      U.pullT2 = setTimeout(() => { if (U.pull) { U.pull.tell = true; dirty.forge = 1; } }, 600);
      U.pullT = setTimeout(() => A.skipPull(), 1150);
    },
    skipPull() { if (!U.pull || U.pull.phase !== "charge") return; clearTimeout(U.pullT); clearTimeout(U.pullT2); U.pull.phase = "show"; U.pull.fresh = true; dirty.forge = 1; const r = G.TIER[U.pull.best].rank; G.audio.play("reveal", r); if (r >= 3) { G.render.flash(G.TIER[U.pull.best].color, 0.5); G.audio.buzz(60); } },
    buyStar(d) { if (G.buyStar(d.id)) { dirty.stars = 1; afterPower(); G.audio.play("drop"); } },
    rebirthAsk() {
      const s = G.s, gain = G.emberGain(s.runBest);
      U.modal(`<h2 style="color:#ff8a2a">Rebirth</h2><div class="report"><div><b>+${gain}</b><span>Embers</span></div><div><b>${s.runBest}</b><span>deepest this run</span></div></div><p><b>Kept:</b> every blade, star, affix and rune, your constellation, sigils.</p><p><b>Lost:</b> souls, slot levels, your place on the stair.</p><div class="rowbtns center"><button class="btn gold big" data-act="rebirthDo">Burn the run</button><button class="btn big" data-act="modalClose">Not yet</button></div>`, "event");
    },
    rebirthDo() { U.closeModal(); G.rebirth(); },
    claimBounty(d) { const b = G.s.bounty.list[+d.i]; if (b && b.n >= b.goal && !b.done) { b.done = true; G.s.sigils += b.rew; dirty.journal = 1; G.audio.play("drop"); } },
    claimFeat(d) { const f = G.FEATS.find((x) => x.id === d.id); if (f && !G.s.feats[f.id] && f.get(G.s) >= f.goal) { G.s.feats[f.id] = 1; G.s.sigils += f.rew; dirty.journal = 1; G.audio.play("drop"); U.toast(`Feat: ${f.name}. +${f.rew} sigils`, "#c9a24b"); } },
    openSealed() { const r = G.openSealed(); if (r) { U.toast("The seal breaks: " + r, "#ffd24a"); dirty.journal = 1; G.audio.play("secret"); } },
    sendExp(d) { const s = G.s, u = s.blades.filter((b) => !G.inParty(b.u) && !G.onExpedition(b.u)).sort((a, z) => G.TIER[z.t].rank - G.TIER[a.t].rank || z.s - a.s).slice(0, 3).map((b) => b.u); if (G.sendExp(u, +d.h)) { dirty.exp = 1; dirty.warband = 1; } },
    claimExp(d) { const r = G.claimExp(+d.i); if (r) { U.toast(`Expedition: +${G.fmt(r.souls)} souls, +${r.sig} sigils${r.rune ? ", " + G.runeName(r.rune) : ""}`, "#c9a24b"); dirty.exp = 1; dirty.warband = 1; G.audio.play("drop"); } },
    startRift() { if (G.startRift()) U.close(); },
    set(d) { G.s.set[d.k] = !G.s.set[d.k]; dirty.settings = 1; if (d.k === "sound") G.audio.unlock(); },
    export() { const code = G.exportSave(); U.modal(`<h2>Save code</h2><textarea class="code" id="saveCode" readonly>${code}</textarea><div class="rowbtns center"><button class="btn gold" data-act="copyCode">Copy</button><button class="btn" data-act="modalClose">Close</button></div>`); },
    copyCode() { const t = $("saveCode"); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => U.toast("Copied.", "#c9a24b")).catch(() => { try { document.execCommand("copy"); U.toast("Copied.", "#c9a24b"); } catch (e) { U.toast("Select the text and copy it by hand.", "#a39279"); } }); },
    importAsk() { U.modal(`<h2>Load a save code</h2><p class="hint">This replaces your current progress.</p><textarea class="code" id="loadCode" placeholder="Paste the code here"></textarea><div class="rowbtns center"><button class="btn gold" data-act="importDo">Load</button><button class="btn" data-act="modalClose">Cancel</button></div>`); },
    importDo() { if (G.importSave($("loadCode").value)) { G.noSave = true; location.reload(); } else U.toast("That code did not load.", "#e0503a"); },
    resetAsk() { U.modal(`<h2 style="color:#e0503a">Erase everything?</h2><p>All blades, floors and Embers will be gone. This cannot be undone.</p><div class="rowbtns center"><button class="btn danger big" data-act="resetDo">Erase</button><button class="btn big" data-act="modalClose">Keep playing</button></div>`); },
    resetDo() { G.noSave = true; G.wipeSave(); location.reload(); },
    shrine(d) { U.closeModal(); G.shrine(d.v === "1"); },
    smith(d) { const o = U.smithOffers && U.smithOffers[+d.i]; U.closeModal(); if (o) { G.smith(o); afterPower(); U.toast("The smith nods and is gone.", "#ffb45a"); } else G.paused = null; },
    path(d) { const o = U.pathOffers && U.pathOffers[+d.i]; U.closeModal(); G.choosePath(o || null); if (o) U.toast(`${o.name}: ${o.desc}${o.hidden ? " +1 sigil" : ""}`, o.color); },
    omenInfo() {
      const s = G.s, p = s.omen.pend && G.OMENS.find((x) => x.id === s.omen.pend.id);
      U.modal(`<button class="iconbtn mclose" data-act="modalClose" aria-label="Close">✕</button><h2>The Omen candle</h2><p>${s.best < 5 ? "It is unlit. Reach floor 5." : p ? `<b style="color:${p.color}">${p.sign}</b> Something arrives within two floors.` : `It burns brighter with every floor since the last omen. ${s.omen.since} floors so far; one is certain by 20.`}</p><div class="log">${G.OMENS.map((o) => `<p><b style="color:${o.color}">${o.name}</b> <span class="dim">${o.sign}</span></p>`).join("")}</div>`);
    },
    offlineOk() { U.closeModal(); },
  };
  U.act = A;

  U.offline = function (r) {
    U.modal(`<h2>The fire is still warm</h2><p class="hint">Away for ${G.fmtTime(r.secs)}${r.capped ? `, capped at ${G.mod.offCap} hours` : ""}. The warband fought on at ${Math.round(G.mod.offRate * 100)}% pace.</p>
      <div class="report"><div><b>+${G.fmt(r.souls)}</b><span>souls</span></div><div><b>+${r.floors}</b><span>floors</span></div><div><b>+${r.sig}</b><span>sigils</span></div>${r.sealed ? `<div><b>${r.sealed}</b><span>sealed omens</span></div>` : ""}</div>
      <button class="btn gold big" data-act="offlineOk">Back to the descent</button>`, "event");
  };

  // ---------- wiring ----------
  U.init = function () {
    const mq = window.matchMedia("(min-width: 1000px)");
    const setWide = () => { wide = mq.matches; document.body.classList.toggle("wide", wide); if (wide && (open === "warband" || open === "journal")) U.close(); dirty.all = 1; };
    mq.addEventListener ? mq.addEventListener("change", setWide) : mq.addListener(setWide); setWide();
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-act]"); if (!t || t.disabled) return;
      G.audio.unlock();
      const fn = A[t.dataset.act]; if (fn) { fn(t.dataset, t); if (t.classList.contains("btn") && !["lvl", "lvlAll"].includes(t.dataset.act)) G.audio.play("click"); }
    });
    $("modal").addEventListener("click", (e) => { if (e.target === $("modal") && !G.paused) U.closeModal(); });
    // desktop drag and drop: bench tile onto a slot
    document.addEventListener("dragstart", (e) => { const t = e.target.closest && e.target.closest(".tile"); if (t) e.dataTransfer.setData("text/plain", t.dataset.u); });
    document.addEventListener("dragover", (e) => { if (e.target.closest && e.target.closest("[data-drop]")) e.preventDefault(); });
    document.addEventListener("drop", (e) => { const t = e.target.closest && e.target.closest("[data-drop]"); if (!t) return; e.preventDefault(); const u = +e.dataTransfer.getData("text/plain"); if (u && G.equip(u, +t.dataset.drop)) afterPower(); });
    tabs();
  };
})();
