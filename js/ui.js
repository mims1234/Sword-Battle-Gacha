// ===================== DOM UI =====================
(function () {
  const G = window.G, U = (G.ui = {});
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const sw = (i, cls) => `<span class="sw ${cls || ""}" style="${G.swCss(i)}"></span>`;
  const mo = (i, cls) => `<span class="mo ${cls || ""}" style="${G.moCss(i)}"></span>`;
  const tcol = (b) => G.TIER[b.t].color;
  const starsOf = (b) => (b.s ? `<span class="stars">${"★".repeat(b.s)}</span>` : "");
  const GOLD = `<i class="ic gold"></i>`, GEM = `<i class="ic gem"></i>`, ESS = `<i class="ic ess"></i>`;
  const guideOpen = (g) => G.guideOpen(g);
  const pullLocked = () => !!U.pull && (U.pull.phase === "charge" || Date.now() < (U.pull.lockUntil || 0));
  const SLOTNAME = ["Front 1", "Front 2", "Back 1", "Back 2", "Back 3"];
  const SLOTUNLOCK = [0, 0, 0, G.UNLOCK.slot4, G.UNLOCK.slot5];

  let dirty = { all: 1 }, open = null, pickSlot = null, wide = false, lastHud = 0, lastPanel = 0, statusKey = "", feedKey = "", modalTimer = null, coachKey = "";
  U.pull = null;
  U.dirty = (n) => { dirty[n] = 1; };

  const PANELS = {
    warband: { title: "Team", fn: pTeam },
    relics: { title: "Runes", fn: pRunes, lock: "runes" },
    stars: { title: "Rebirth", fn: pRebirth, lock: "rebirth" },
    journal: { title: "Quests", fn: pQuests },
    bestiary: { title: "Monsters", fn: pMonsters },
    exp: { title: "Missions", fn: pMissions, lock: "expedition" },
    rift: { title: "Daily Trial", fn: pTrial, lock: "rift" },
    more: { title: "Menu", fn: pMenu },
    settings: { title: "Settings", fn: pSettings },
    guides: { title: "Guides", fn: pGuides },
  };
  const NAV = ["forge", "relics", "stars", "bestiary", "exp", "rift", "settings"];
  const navTitle = (p) => (p === "forge" ? "Summon" : PANELS[p].title);
  const navLock = (p) => p !== "forge" && PANELS[p].lock && !G.unlocked(PANELS[p].lock);

  // ---------- toasts / modal ----------
  U.toast = function (text, color) {
    const box = $("toasts"), d = document.createElement("div");
    d.className = "toast"; d.textContent = text; if (color) d.style.setProperty("--tc", color);
    box.appendChild(d); while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => d.classList.add("out"), 3000); setTimeout(() => d.remove(), 3500);
  };
  U.modal = function (html, cls) {
    clearInterval(modalTimer); modalTimer = null;
    $("modalCard").className = "modal-card " + (cls || ""); $("modalCard").innerHTML = html; $("modal").hidden = false;
  };
  U.closeModal = function () { clearInterval(modalTimer); modalTimer = null; $("modal").hidden = true; U.inspectU = null; };
  // Choice popups pick a default on their own so an idle game never stalls.
  function countdown(secs, fn) {
    let n = secs; const tick = () => { const el = $("mCount"); if (el) el.textContent = n; if (n-- <= 0) { clearInterval(modalTimer); modalTimer = null; fn(); } };
    tick(); modalTimer = setInterval(tick, 1000);
  }

  // ---------- panels ----------
  U.open = function (p) {
    if (p === "forge") return U.openSummon();
    if (wide && (p === "warband" || p === "journal")) { const d = p === "warband" ? $("left") : $("right"); d.classList.remove("pulse"); void d.offsetWidth; d.classList.add("pulse"); return; }
    const P = PANELS[p]; if (!P) return;
    if (P.lock && !G.unlocked(P.lock)) { U.toast(`${P.title} unlocks at floor ${G.UNLOCK[P.lock]}`, "#a39279"); return; }
    U.closeSummon(true);
    open = p; $("center").classList.add("sheetopen"); $("sheet").hidden = false; $("sheetTitle").textContent = P.title; dirty[p] = 1; tabs();
    $("sheetBody").scrollTop = 0;
  };
  U.close = function () { open = null; pickSlot = null; $("center").classList.remove("sheetopen"); $("sheet").hidden = true; U.closeSummon(true); tabs(); dirty.warband = 1; };
  U.openSummon = function () { U.close(); $("summon").hidden = false; dirty.summon = 1; tabs("forge"); };
  U.closeSummon = function (quiet) { if ($("summon").hidden) return; $("summon").hidden = true; if (U.pull && U.pull.phase === "show") U.pull = null; if (!quiet) tabs(); };
  function tabs(force) {
    const cur = force || (!$("summon").hidden ? "forge" : open || "descent");
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === cur || (b.dataset.tab === "more" && !["descent", "warband", "forge", "journal"].includes(cur))));
  }

  function renderPanels() {
    const all = dirty.all;
    if (wide) { if (all || dirty.warband) $("left").innerHTML = `<h2 class="dock-h">Team</h2>` + pTeam(); if (all || dirty.journal) $("right").innerHTML = `<h2 class="dock-h">Quests</h2>` + pQuests(); }
    if (open && (all || dirty[open])) { const body = $("sheetBody"), y = body.scrollTop; body.innerHTML = PANELS[open].fn(); body.scrollTop = y; }
    if (!$("summon").hidden && (all || dirty.summon)) renderSummon();
    if (all || dirty.band) { buildBand(); lastHud = 0; }
    if (all || dirty.nav) $("deskNav").innerHTML = NAV.map((p) => `<button data-act="open" data-p="${p}" class="${navLock(p) ? "locked" : ""}">${navTitle(p)}</button>`).join("");
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
      <div class="bc-art">${sw(b.i, "big")}</div>
      <div class="rar">${T.label}${b.s ? " · " + "★".repeat(b.s) : ""}</div>
      <div class="nm">${esc(G.bladeName(b))}</div>
      <div class="ty"><i class="eldot" style="background:${G.EL[st.el].color}"></i>${G.EL[st.el].label} · ${st.role}</div>
      <div class="stats"><span><b>${G.fmt(st.atk)}</b>Attack</span><span><b>${G.fmt(st.hp)}</b>Health</span><span><b>${st.int.toFixed(2)}s</b>Speed</span></div>
      ${b.a.map((a) => `<div class="af">${G.AFFIX[a[0]].lab(a[1])}</div>`).join("")}
      ${b.r ? `<div class="af rune">${G.RUNE[b.r.k].glyph} ${G.runeText(b.r)}</div>` : ""}
      <div class="ul">Ultimate: <b>${esc(st.ult)}</b>, ${st.named ? "hits every monster" : "one big hit"} for ${st.ultMul}× attack</div>
      <div class="fl">${esc(sword.description)}</div>
    </div>`;
  }
  U.inspect = function (u, mode) {
    const b = G.blade(u); if (!b) return U.closeModal();
    U.inspectU = u;
    const s = G.s, inP = G.inParty(u), away = G.onExpedition(u), fod = G.fodderFor(b).length;
    let body = "";
    if (mode === "equip") {
      body = `<p class="hint">Pick a slot. Front blades get hit first.</p><div class="slotpick">` + SLOTNAME.map((n, i) => {
        if (i >= G.slotCount()) return `<button disabled>${n}<small>Floor ${SLOTUNLOCK[i]}</small></button>`;
        const cur = G.blade(s.party[i]); let d = "";
        if (cur && cur.u !== u) { const a = G.power(b, s.lv[i]), z = G.power(cur, s.lv[i]), pc = Math.round((a / z - 1) * 100); d = `<small class="${pc >= 0 ? "up" : "down"}">${pc >= 0 ? "▲ +" : "▼ "}${pc}%</small>`; }
        else if (!cur) d = "<small>empty</small>"; else d = "<small>here now</small>";
        return `<button data-act="equip" data-u="${u}" data-i="${i}">${cur ? sw(cur.i) : ""}${n}${d}</button>`;
      }).join("") + `</div><button class="btn ghost" data-act="inspect" data-u="${u}">Back</button>`;
    } else if (mode === "rune") {
      const groups = {}; s.runes.forEach((r, i) => { const k = r.k + r.t; if (!groups[k]) groups[k] = { r, i, n: 0 }; groups[k].n++; });
      const list = Object.values(groups).sort((a, z) => z.r.t - a.r.t);
      body = `<div class="runelist">` + (list.length ? list.map((g) => `<button data-act="socket" data-u="${u}" data-i="${g.i}"><b>${G.RUNE[g.r.k].glyph}</b><span>${G.runeName(g.r)}<small>${G.runeText(g.r)} · you have ${g.n}</small></span></button>`).join("") : `<p class="hint">No spare runes. Bosses and champion monsters drop them.</p>`) + `</div>
        ${b.r ? `<button class="btn ghost" data-act="unsocket" data-u="${u}">Take out ${G.runeName(b.r)}</button>` : ""}<button class="btn ghost" data-act="inspect" data-u="${u}">Back</button>`;
    } else {
      body = `<div class="acts">
        <button class="btn gold" data-act="inspect" data-u="${u}" data-m="equip" ${away ? "disabled" : ""}>${inP ? "Move" : "Use in team"}</button>
        ${G.unlocked("ascend") ? `<button class="btn" data-act="ascend" data-u="${u}" ${fod && b.s < 5 ? "" : "disabled"}>Merge${fod ? " (" + fod + " copies)" : ""}</button>` : ""}
        ${G.unlocked("runes") ? `<button class="btn" data-act="inspect" data-u="${u}" data-m="rune">Rune</button>` : ""}
        <button class="btn" data-act="lock" data-u="${u}">${b.lock ? "Unlock" : "Lock"}</button>
        ${inP || away ? "" : `<button class="btn danger" data-act="salvage" data-u="${u}" ${b.lock ? "disabled" : ""}>Sell +${G.fmt(G.salvageValue(b))} gold</button>`}
      </div>${away ? `<p class="hint">Away on a mission.</p>` : ""}${G.unlocked("ascend") && !fod && b.s < 5 ? `<p class="hint">Merge a copy of this blade into it for +1 ★.</p>` : ""}`;
    }
    U.modal(`<button class="iconbtn mclose" data-act="modalClose" aria-label="Close">✕</button>${bladeCard(b)}${body}`, "inspect");
  };

  // ----- band: the five slots and the controls under the arena -----
  function buildBand() {
    const n = G.slotCount(); let h = "";
    for (let i = 0; i < 5; i++) {
      const p = G.party[i], locked = i >= n;
      h += `<div class="bslot${locked ? " locked" : ""}">
        <button class="slot" data-act="slot" data-i="${i}" data-drop="${i}" id="bs${i}" style="--tc:${p ? tcol(p.b) : "#3b2a22"};--ec:${p ? G.EL[p.st.el].color : "#3b2a22"}" title="${p ? esc(G.bladeName(p.b)) : SLOTNAME[i]}">
          ${p ? sw(p.b.i) : locked ? `<span class="lk">Floor ${SLOTUNLOCK[i]}</span>` : `<span class="plus">+</span>`}
          <span class="pos">${i + 1}</span><span class="lv" id="blv${i}"></span>
          <span class="hpb"><i id="bhp${i}"></i></span><span class="rgb"><i id="brg${i}"></i></span>
        </button>
        <button class="lvl" data-act="lvl" data-i="${i}" id="bup${i}" ${p ? "" : "disabled"} aria-label="Level up slot ${i + 1}">${GOLD}<b id="bco${i}"></b></button>
      </div>`;
    }
    $("band").innerHTML = h;
    $("ctl").innerHTML = `<button class="btn green" data-act="lvlAll" id="lvlAll">Level up</button>
      <button class="btn summon" data-act="open" data-p="forge" id="sumBtn">Summon <span class="badge">${GEM}<b id="sumGems">0</b></span></button>
      <button class="btn sq" data-act="speed" id="spdBtn" aria-label="Game speed"></button>
      <button class="btn sq" data-act="pause" id="pauseBtn" aria-label="Pause">❚❚</button>`;
  }

  function pTeam() {
    const s = G.s, n = G.slotCount();
    const slot = (i) => {
      const b = G.blade(s.party[i]);
      if (i >= n) return `<div class="fslot locked"><span class="lk">Floor ${SLOTUNLOCK[i]}</span><small>${SLOTNAME[i]}</small></div>`;
      if (!b) return `<button class="fslot empty${pickSlot === i ? " picking" : ""}" data-act="pick" data-i="${i}" data-drop="${i}"><span class="plus">+</span><small>${SLOTNAME[i]}</small></button>`;
      const st = G.bladeStat(b, s.lv[i]);
      return `<button class="fslot${pickSlot === i ? " picking" : ""}" data-act="pick" data-i="${i}" data-drop="${i}" style="--tc:${tcol(b)}">${sw(b.i)}<span class="fn">${esc(G.SW[b.i].name)}${starsOf(b)}</span><small><i class="eldot" style="background:${G.EL[st.el].color}"></i>${st.role} · Lv ${s.lv[i]}</small></button>`;
    };
    const res = G.res.list.length ? G.res.list.map((r) => `<div class="res"><i class="eldot" style="background:${G.EL[r.el].color}"></i><b>${G.EL[r.el].label} ×${r.n}:</b> ${r.full ? "+25% damage. " + G.EL[r.el].trait + "." : "+10% damage. Add one more for a bonus power."}</div>`).join("") : `<div class="res dim">Element bonus: use 2 blades of the same element for +10% damage, 3 for a special power.</div>`;
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
      <div class="res dim">Monsters here: ${G.FAMLABEL[fam]}${weak.length ? ". Strong against them: " + weak.map((w) => `<b style="color:${G.EL[w].color}">${G.EL[w].label}</b>`).join(" and ") : ""}.</div>
      <div class="rowbtns"><button class="btn" data-act="autofill">Auto team</button>${G.unlocked("ascend") ? `<button class="btn" data-act="ascendAll">Merge duplicates</button>` : ""}<button class="btn" data-act="salvageStone">Sell spare Commons</button></div>
      <h3>${pickSlot != null ? "Pick a blade for " + SLOTNAME[pickSlot] : "All blades"} <small>${s.blades.length}</small></h3>
      <div class="tiles">${tiles}</div>${bench.length > 150 ? `<p class="hint">Showing the best 150. Sell or merge to tidy up.</p>` : ""}`;
  }

  // ----- summon screen -----
  function renderSummon() {
    const s = G.s, ten = G.unlocked("ten"), el = G.bannerEl(), top = G.topChance(), blessed = Date.now() < s.star;
    let stage;
    if (U.pull && U.pull.phase === "charge") stage = `<div class="sm-stage charging" data-act="skipPull" style="--rc:${U.pull.tell ? G.TIER[U.pull.best].color : "#6fd6ff"}"><div class="altar"><div class="ring"></div><div class="gemfloat"></div><div class="plinth"></div></div><p class="tap">Tap to skip</p></div>`;
    else if (U.pull) {
      const one = U.pull.list.length === 1;
      stage = `<div class="sm-stage shown" style="--rc:${G.TIER[U.pull.best].color}"><div class="rays${G.TIER[U.pull.best].rank >= 3 ? " on" : ""}"></div><div class="pulls ${one ? "n1" : "n10"}">` + U.pull.list.map((b, i) => `<button class="pcard${U.pull.fresh ? " anim" : ""}" data-act="tile" data-u="${b.u}" style="--tc:${tcol(b)};animation-delay:${i * 90}ms">${U.pull.isNew[i] ? '<em class="new">NEW</em>' : ""}${sw(b.i)}<span class="rar">${G.TIER[b.t].label}</span><span class="nm">${esc(one ? G.bladeName(b) : G.SW[b.i].name)}</span>${one ? b.a.map((a) => `<span class="af">${G.AFFIX[a[0]].lab(a[1])}</span>`).join("") : ""}</button>`).join("") + `</div><p class="tap">Tap a blade to see it</p></div>`;
      U.pull.fresh = false;
    } else stage = `<div class="sm-stage idle"><div class="altar"><div class="ring"></div><div class="gemfloat"></div><div class="plinth"></div></div></div>`;
    // Summon 10 is open for the very first summon so new players start with a full choice of blades.
    const busy = pullLocked(), ten10 = ten || s.pulls === 0;
    $("summon").innerHTML = `<div class="sm-head"><button class="iconbtn" data-act="closeSummon" aria-label="Back">←</button><h2>Summon</h2><span class="sm-gems">${GEM}<b>${G.fmt(s.sigils)}</b></span><button class="iconbtn help" data-act="help" data-p="forge" aria-label="How summoning works">?</button></div>
      <div class="sm-body">
        <div class="banner" style="--ec:${G.EL[el].color}"><b>This week: more ${G.EL[el].label} blades</b><span>Half of your summons come from the ${G.EL[el].label} pool.</span></div>
        ${stage}
        <div class="sm-btns">
          <button class="btn gold big" data-act="summon" data-n="1" ${s.sigils >= 1 && !busy ? "" : "disabled"}>Summon 1<small>${GEM} 1</small></button>
          <button class="btn gold big" data-act="summon" data-n="10" ${ten10 && s.sigils >= 10 && !busy ? "" : "disabled"}>Summon 10<small>${ten10 ? GEM + " 10 · 1 Epic or better guaranteed" : "Unlocks at floor 10"}</small></button>
        </div>
        <div class="pity"><div class="bar"><i style="width:${(s.pity / G.PITY_HARD) * 100}%"></i></div><span>${s.boon ? "Hollow Blade reward: your next summon is Legendary or better." : `Legendary guaranteed within <b>${G.PITY_HARD - s.pity}</b> summons. Chance right now: ${(top * 100).toFixed(1)}%.`}</span></div>
        ${blessed ? `<div class="res" style="color:#ffe9a8">Falling star: Legendary chance doubled for ${G.fmtTime((s.star - Date.now()) / 1000)}.</div>` : ""}
        <div class="rates">${G.TIERS.map((t) => `<i style="color:${G.TIER[t].color}">${G.TIER[t].label} ${+(G.RATES[t] * 100).toFixed(1)}%</i>`).join("")}</div>
        <p class="hint">Get gems from bosses, reaching new floors, treasure imps, quests and time spent playing. ${s.sigils < 1 ? "<b>You are out of gems.</b>" : ""}</p>
      </div>`;
  }

  function pRunes() {
    const s = G.s, groups = {};
    s.runes.forEach((r) => { const k = r.k + r.t; if (!groups[k]) groups[k] = { r, n: 0 }; groups[k].n++; });
    const list = Object.values(groups).sort((a, z) => z.r.t - a.r.t || a.r.k.localeCompare(z.r.k));
    const worn = s.blades.filter((b) => b.r);
    return `<p class="hint">Each blade can hold one rune. Open a blade and press Rune to put one in. Three of the same rune combine into a stronger one.</p>
      <div class="runelist">${list.length ? list.map((g) => `<div class="runerow"><b>${G.RUNE[g.r.k].glyph}</b><span>${G.runeName(g.r)}<small>${G.runeText(g.r)} · you have ${g.n}</small></span>${g.r.t < 3 ? `<button class="btn" data-act="fuse" data-k="${g.r.k}" data-t="${g.r.t}" ${g.n >= 3 ? "" : "disabled"}>Combine 3</button>` : ""}</div>`).join("") : `<p class="hint">No spare runes yet. Bosses and champion monsters drop them.</p>`}</div>
      ${worn.length ? `<h3>In use</h3><div class="tiles">${worn.map((b) => tile(b)).join("")}</div>` : ""}`;
  }

  function pRebirth() {
    const s = G.s, gain = G.emberGain(s.runBest), pos = {}; G.STARS.forEach((st) => (pos[st.id] = st));
    const svg = `<svg class="starmap" viewBox="0 0 300 215" role="img" aria-label="Rebirth upgrades map">` +
      G.STAR_LINKS.map((l) => `<line x1="${pos[l[0]].x}" y1="${pos[l[0]].y}" x2="${pos[l[1]].x}" y2="${pos[l[1]].y}" class="${G.con(l[0]) && G.con(l[1]) ? "lit" : ""}"/>`).join("") +
      G.STARS.map((st) => { const L = G.con(st.id); return `<g class="${L ? "lit" : ""}"><rect x="${st.x - 6}" y="${st.y - 6}" width="12" height="12" transform="rotate(45 ${st.x} ${st.y})"/><text x="${st.x}" y="${st.y + 22}">${st.name}${L ? " " + L : ""}</text></g>`; }).join("") + `</svg>`;
    const next = 1 + 5 * G.con("momentum");
    return `<div class="rebirth"><div><b>Rebirth</b><span>Best this run: floor ${s.runBest}. Start again from floor ${Math.max(1, Math.min(next, s.best - 10))} and earn Essence for permanent upgrades. You keep all blades, ★ ranks, runes and gems. Gold and levels reset.</span></div>
      <button class="btn gold big" data-act="rebirthAsk" ${gain > 0 ? "" : "disabled"}>Rebirth<small>+${gain} Essence</small></button></div>
      ${svg}
      <div class="starlist">${G.STARS.map((st) => { const L = G.con(st.id), c = G.starCost(st), max = L >= st.max; return `<div class="starrow"><span><b>${st.name}</b> <em>${L}/${st.max}</em><small>${st.desc} per level</small></span><button class="btn" data-act="buyStar" data-id="${st.id}" ${!max && s.embers >= c ? "" : "disabled"}>${max ? "Max" : ESS + " " + c}</button></div>`; }).join("")}</div>`;
  }

  function pQuests() {
    const s = G.s, nextU = G.UNLOCK_TEXT.find((u) => s.best < u[0]);
    let h = nextU ? `<div class="res"><b>Next unlock at floor ${nextU[0]}:</b> ${nextU[1]}</div>` : "";
    if (s.omen.sealed > 0) h += `<div class="claimrow"><span><b>Mystery chests ×${s.omen.sealed}</b><small>Found while you were away</small></span><button class="btn gold" data-act="openSealed">Open</button></div>`;
    if (G.unlocked("bounty") && s.bounty) h += `<h3>Daily quests <small>new ones every day</small></h3>` + s.bounty.list.map((b, i) => `<div class="claimrow"><span>${G.bountyText(b)} <small>${b.n}/${b.goal}</small><div class="bar"><i style="width:${(b.n / b.goal) * 100}%"></i></div></span><button class="btn${b.n >= b.goal && !b.done ? " gold" : ""}" data-act="claimBounty" data-i="${i}" ${b.n >= b.goal && !b.done ? "" : "disabled"}>${b.done ? "Done" : GEM + " " + b.rew}</button></div>`).join("");
    else h += `<div class="res dim">Daily quests unlock at floor ${G.UNLOCK.bounty}.</div>`;
    const feats = G.FEATS.filter((f) => !s.feats[f.id]).sort((a, z) => z.get(s) / z.goal - a.get(s) / a.goal).slice(0, 5);
    h += `<h3>Achievements <small>${Object.keys(s.feats).length}/${G.FEATS.length}</small></h3>` + feats.map((f) => { const v = Math.min(f.goal, f.get(s)), ok = v >= f.goal; return `<div class="claimrow"><span><b>${f.name}</b> ${f.text}<div class="bar"><i style="width:${(v / f.goal) * 100}%"></i></div></span><button class="btn${ok ? " gold" : ""}" data-act="claimFeat" data-id="${f.id}" ${ok ? "" : "disabled"}>${GEM} ${f.rew}</button></div>`; }).join("");
    h += `<h3>Recent loot</h3><div class="log">${s.log.length ? s.log.slice(0, 14).map((l) => `<p style="color:${/^#[0-9a-f]{3,8}$/i.test(l.c) ? l.c : "inherit"}">${esc(l.t)}</p>`).join("") : `<p class="dim">Nothing yet.</p>`}</div>`;
    return h;
  }

  function pMonsters() {
    const s = G.s; let h = `<div class="res">Defeat 50 of a monster to master it. Each mastered monster gives +1% damage, up to 25%. You have <b>+${Math.round(G.bestiaryBonus * 100)}%</b>.</div>`;
    G.BIOMES.forEach((b, bi) => {
      const ids = Object.keys(G.FAM).map(Number).filter((i) => G.FAM[i] === b.id), weak = Object.keys(G.EL).filter((e) => G.EL[e].counter.includes(b.id));
      const seen = s.best > bi * 10;
      h += `<h3>${seen ? b.name : "???"} <small>floors ${bi * 10 + 1}–${bi * 10 + 10}${seen && weak.length ? " · weak to " + weak.map((w) => G.EL[w].label).join(", ") : ""}</small></h3><div class="beasts">` + ids.map((i) => {
        const k = s.mk[i] || 0;
        return `<div class="beast${k ? "" : " unseen"}${k >= 50 ? " master" : ""}">${mo(i)}${s.gild[i] ? '<em title="Golden version defeated">★</em>' : ""}<span>${k ? esc(G.MON[i].type) : "???"}</span><small>${k ? G.fmt(k) : ""}</small></div>`;
      }).join("") + `</div>`;
    });
    return h;
  }

  function pMissions() {
    const s = G.s, now = Date.now();
    const bench = s.blades.filter((b) => !G.inParty(b.u) && !G.onExpedition(b.u)).sort((a, z) => G.TIER[z.t].rank - G.TIER[a.t].rank || z.s - a.s).slice(0, 3);
    let h = `<p class="hint">Blades that are not in your team can go on missions and bring back gold, gems and runes. Better blades bring back more.</p>`;
    s.exp.forEach((e, i) => { const done = now >= e.end; h += `<div class="claimrow"><span><span class="minis">${e.u.map((u) => { const b = G.blade(u); return b ? sw(b.i) : ""; }).join("")}</span><small>${done ? "Back home" : "Back in " + G.fmtTime((e.end - now) / 1000)}</small></span><button class="btn${done ? " gold" : ""}" data-act="claimExp" data-i="${i}" ${done ? "" : "disabled"}>Collect</button></div>`; });
    if (s.exp.length < G.EXP_SLOTS) h += bench.length ? `<h3>Send a mission <small>${G.EXP_SLOTS - s.exp.length} free</small></h3><div class="minis big">${bench.map((b) => tile(b)).join("")}</div><div class="rowbtns">${[1, 4, 8].map((n) => `<button class="btn" data-act="sendExp" data-h="${n}">${n} hour${n > 1 ? "s" : ""}</button>`).join("")}</div><p class="hint">Sends your 3 best blades that are not in the team.</p>` : `<p class="hint">No spare blades to send. Summon more first.</p>`;
    return h;
  }

  function pTrial() {
    const s = G.s, m = G.riftMod(), used = s.rift.day === G.day();
    return `<div class="banner" style="--ec:#b56bff"><b>Today's rule: ${m.name}</b><span>${m.desc}</span></div>
      <p class="hint">A 3-minute challenge, once a day. It starts at 60% of your best floor. Every 2 floors you clear gives 1 gem.</p>
      <div class="res">Your best: <b>${s.rift.best || 0}</b> floors</div>
      <div class="rowbtns center"><button class="btn gold big" data-act="startRift" ${used || G.rift ? "disabled" : ""}>${G.rift ? "In progress" : used ? "Come back tomorrow" : "Start the trial"}</button></div>`;
  }

  // Each entry: a picture, what it is in a few words, and a live status so the player knows where to go.
  function menuInfo(p) {
    const s = G.s, now = Date.now();
    switch (p) {
      case "warband": { const b = G.party.find(Boolean); return { icon: b ? sw(b.b.i, "mi-sprite") : "⛨", col: "#f2c14e", desc: "Choose which blades fight", badge: G.party.filter(Boolean).length + "/" + G.slotCount() + " in team", hot: !G.party.some(Boolean) }; }
      case "forge": return { icon: '<i class="mi-gem"></i>', col: "#6fd6ff", desc: "Spend gems on new blades", badge: GEM + G.fmt(s.sigils), hot: s.sigils >= 1 };
      case "journal": { const n = (s.bounty ? s.bounty.list.filter((x) => x.n >= x.goal && !x.done).length : 0) + G.FEATS.filter((x) => !s.feats[x.id] && x.get(s) >= x.goal).length + s.omen.sealed; return { icon: "✎", col: "#e8d8a8", desc: "Goals and rewards", badge: n ? n + " to collect" : "Nothing to collect", hot: n > 0 }; }
      case "relics": { const g = {}; s.runes.forEach((r) => (g[r.k + r.t] = (g[r.k + r.t] || 0) + 1)); const fuse = Object.keys(g).some((k) => g[k] >= 3 && k.slice(-1) !== "3"); return { icon: "ᚢ", col: "#55c6f8", desc: "Power up blades with runes", badge: fuse ? "Can combine" : s.runes.length + " spare", hot: fuse }; }
      case "stars": { const gain = G.emberGain(s.runBest); return { icon: '<i class="mi-ess"></i>', col: "#d08aff", desc: "Restart stronger, buy upgrades", badge: gain > 0 ? "+" + gain + " Essence ready" : ESS + G.fmt(s.embers), hot: gain > 0 && (s.wallHits || 0) >= 2 }; }
      case "bestiary": return { icon: mo(52, "mi-sprite"), col: "#7affc8", desc: "Every monster you have met", badge: Object.keys(s.mk).length + "/" + G.MON.length + " found" };
      case "exp": { const done = s.exp.filter((e) => now >= e.end).length, away = s.exp.length - done; return { icon: sw(13, "mi-sprite"), col: "#ffb45a", desc: "Spare blades bring back loot", badge: done ? done + " back home" : away ? away + " away" : G.EXP_SLOTS + " free", hot: done > 0 }; }
      case "rift": { const used = s.rift.day === G.day(); return { icon: "⧗", col: "#b56bff", desc: "3-minute challenge, once a day", badge: used ? "Done today" : "Ready", hot: !used }; }
      case "guides": return { icon: "?", col: "#9fe870", desc: "Replay any tutorial", badge: G.GUIDES.filter((g) => guideOpen(g)).length + " guides" };
      case "settings": return { icon: "⚙", col: "#a8977d", desc: "Sound, save code, stats", badge: "" };
    }
    return { icon: "?", col: "#888", desc: "", badge: "" };
  }
  function pMenu() {
    const list = ["warband", "forge", "journal"].concat(NAV).concat(["guides"]).filter((p, i, a) => a.indexOf(p) === i && !(wide && (p === "warband" || p === "journal")));
    return `<div class="menu">` + list.map((p) => {
      const t = p === "forge" ? "Summon" : PANELS[p].title, lock = navLock(p), m = menuInfo(p);
      const need = lock ? G.UNLOCK[PANELS[p].lock] : 0;
      const status = lock ? `<span class="mb lockb">🔒 Floor ${need}<i class="bar"><i style="width:${Math.min(100, (G.s.best / need) * 100)}%"></i></i></span>` : m.badge ? `<span class="mb${m.hot ? " hot" : ""}">${m.badge}</span>` : "";
      return `<button class="mcard${lock ? " locked" : ""}" data-act="open" data-p="${p}" style="--mc:${m.col}"><span class="mi">${m.icon}</span><span class="mt"><b>${t}</b><small>${lock ? "Unlocks at floor " + need : m.desc}</small>${status}</span>${m.hot && !lock ? '<em class="mdot"></em>' : ""}</button>`;
    }).join("") + `</div>`;
  }

  function pGuides() {
    return `<p class="hint">Tap a guide to replay it. New guides appear as you go deeper.</p><div class="menu">` + G.GUIDES.map((g) => {
      const ok = guideOpen(g), seen = G.s.tips && G.s.tips["g_" + g.id];
      return `<button class="mcard${ok ? "" : " locked"}" data-act="${ok ? "guide" : "noop"}" data-id="${g.id}" style="--mc:${g.col}"><span class="mi">${g.icon}</span><span class="mt"><b>${g.name}</b><small>${ok ? g.steps.length + " steps" : "Unlocks at floor " + g.floor}</small>${ok ? `<span class="mb${seen ? "" : " hot"}">${seen ? "Replay" : "New"}</span>` : ""}</span></button>`;
    }).join("") + `</div>`;
  }

  function slider(k, label) { const v = Math.round((k === "musicVol" ? G.audio.musicVol() : G.audio.sfxVol()) * 100); return `<label class="volrow" for="vol_${k}"><span>${label}</span><input type="range" min="0" max="100" step="5" id="vol_${k}" data-vol="${k}" value="${v}"><b id="volv_${k}">${v}%</b></label>`; }
  function pSettings() {
    const s = G.s, t = (k, label, hint) => `<div class="claimrow"><span><b>${label}</b><small>${hint}</small></span><button class="btn${s.set[k] ? " gold" : ""}" data-act="set" data-k="${k}">${s.set[k] ? "On" : "Off"}</button></div>`;
    return t("music", "Music", "Background music for each area. Also the ♪ button in the arena") + slider("musicVol", "Music volume") + t("sound", "Sound effects", "Hits, summons and rewards. Also the FX button in the arena") + slider("sfxVol", "Effects volume") + `<p class="hint">By default music is about 40% louder than effects, so effects only tell you something happened.</p>` + t("calm", "Calm mode", "No screen shake, flashes or vibration") + t("autoUlt", "Auto ultimates", "Blades use their ultimate on their own. Tapping a glowing blade yourself hits 25% harder.") +
      `<h3>Stats</h3><div class="log"><p>Best floor ${s.best} · ${G.fmt(s.kills)} monsters defeated · ${s.pulls} summons</p><p>${s.rebirths} rebirths · ${s.stat.wipes} defeats · ${s.secrets} secrets found</p><p>${G.fmt(s.stat.dmg)} total damage · ${G.fmtTime(s.stat.online)} played</p></div>
      <h3>Save</h3><div class="rowbtns"><button class="btn" data-act="export">Copy save code</button><button class="btn" data-act="importAsk">Load save code</button><button class="btn danger" data-act="resetAsk">Delete save</button></div>
      <p class="hint">Idle Blade Master ${G.VERSION}. Keyboard: 1–5 cast ultimates, Space pauses, L levels up, S opens Summon.</p>`;
  }

  // ---------- onboarding tips ----------
  function coach() {
    const s = G.s, tips = s.tips || (s.tips = {}), el = $("coach");
    let target = null, text = "", key = "";
    const blocked = !$("modal").hidden || !$("summon").hidden || (open && !wide);
    if (!blocked) {
      const cheapest = Math.min.apply(null, G.party.map((p, i) => (p ? G.slotCost(s.lv[i]) : Infinity)));
      if (!tips.summon && s.sigils >= 1 && s.pulls === 0) { key = "summon"; target = $("sumBtn"); text = `You have ${s.sigils} gems! Tap Summon to get new blades.`; }
      else if (!tips.level && s.pulls > 0 && s.souls >= cheapest) { key = "level"; target = $("lvlAll"); text = "You have gold. Level up to make your team stronger."; }
      else if (!tips.ult && G.rage.some((r) => r >= 100)) { const i = G.rage.findIndex((r) => r >= 100); key = "ult"; target = $("bs" + i); text = "This blade is glowing: its ultimate is ready. Tap it!"; }
      else if (!tips.event && s.omen.pend) { key = "event"; target = $("omenBtn"); text = "The candle flared. A random event is coming!"; }
    }
    if (!target || !target.offsetParent) { el.hidden = true; coachKey = ""; return; }
    const r = target.getBoundingClientRect(), app = $("app").getBoundingClientRect();
    if (key !== coachKey) { coachKey = key; el.innerHTML = `<span>${text}</span><button data-act="tipOk" data-k="${key}">Got it</button>`; el.dataset.k = key; }
    el.hidden = false;
    const bw = Math.min(260, app.width - 16), above = r.top - app.top > 90;
    el.style.width = bw + "px";
    el.style.left = Math.max(8, Math.min(app.width - bw - 8, r.left - app.left + r.width / 2 - bw / 2)) + "px";
    el.style.top = (above ? r.top - app.top - el.offsetHeight - 10 : r.bottom - app.top + 10) + "px";
    el.classList.toggle("below", !above);
    el.style.setProperty("--ax", r.left - app.left + r.width / 2 - parseFloat(el.style.left) + "px");
    target.classList.add("coached");
    document.querySelectorAll(".coached").forEach((n) => { if (n !== target) n.classList.remove("coached"); });
  }
  function tipDone(k) { if (!G.s.tips) G.s.tips = {}; G.s.tips[k] = 1; $("coach").hidden = true; coachKey = ""; document.querySelectorAll(".coached").forEach((n) => n.classList.remove("coached")); }

  // ---------- HUD (fast path, no innerHTML) ----------
  function setText(id, v) { const e = $(id); if (e && e.textContent !== v) e.textContent = v; }
  function hud() {
    const s = G.s, C = G.combat, f = G.curFloor(), b = G.biomeOf(f);
    setText("souls", G.fmt(s.souls)); setText("sigils", G.fmt(s.sigils)); setText("embers", G.fmt(s.embers));
    $("embWrap").hidden = !(s.embers > 0 || s.rebirths > 0);
    setText("floorNo", (G.rift ? "Trial " : "Floor ") + f); setText("biome", G.rift ? G.rift.mod.name : G.render.areaName() + (G.loopOf(f) ? " " + "I".repeat(Math.min(3, G.loopOf(f)) + 1) : ""));
    if (C) { const pips = $("pips"); if (pips.children.length !== C.waves) pips.innerHTML = "<i></i>".repeat(C.waves); for (let i = 0; i < C.waves; i++) pips.children[i].className = i < (C.state === "gap" ? C.wave : C.wave - 1) ? "on" : i === C.wave - 1 ? "cur" : ""; }
    let cheapest = Infinity;
    for (let i = 0; i < 5; i++) {
      const p = G.party[i], cb = C && C.blades[i], el = $("bs" + i); if (!el || !p) continue;
      const cost = G.slotCost(s.lv[i]); cheapest = Math.min(cheapest, cost);
      $("bhp" + i).style.width = (cb ? Math.max(0, cb.hp / cb.max) * 100 : 100) + "%"; $("brg" + i).style.width = G.rage[i] + "%";
      el.classList.toggle("ready", G.rage[i] >= 100); el.classList.toggle("dead", !!(cb && cb.dead));
      setText("blv" + i, "Lv" + s.lv[i]); setText("bco" + i, G.fmt(cost)); $("bup" + i).classList.toggle("can", s.souls >= cost);
    }
    const la = $("lvlAll");
    if (la) {
      la.classList.toggle("dimmed", s.souls < cheapest); setText("spdBtn", s.set.speed + "x"); setText("pauseBtn", G.paused === "user" ? "▶" : "❚❚");
      setText("sumGems", G.fmt(s.sigils)); $("sumBtn").classList.toggle("glow", s.sigils >= 1);
    }
    const boss = C && C.state === "fight" && C.enemies.find((e) => (e.kind === "boss" || e.kind === "hollow") && e.hp > 0);
    $("bossBar").hidden = !boss; if (boss) { setText("bossName", boss.name); $("bossFill").style.width = (boss.hp / boss.max) * 100 + "%"; }
    const chips = [];
    if (!G.party.some(Boolean)) chips.push(["#f2c14e", s.blades.length ? "Your team is empty" : "Summon blades to start", s.blades.length ? "openTeam" : "openSummon", s.blades.length ? "Pick team" : "Summon"]);
    if (G.rift) chips.push(["#b56bff", "Trial ends in " + G.fmtTime(G.rift.t)]);
    if (s.hold && !G.rift) chips.push(["#ffab2e", `Lost on floor ${s.wall || s.floor + 1}. Training on floor ${s.floor}`, "push", "Try again"]);
    if (s.path && !G.rift) chips.push(["#c9a24b", s.path.name]);
    if (s.curse > 0) chips.push(["#b56bff", `Cursed ${s.curse} floors: double loot`]);
    if (s.moon > 0) chips.push(["#ff3b3b", `Blood Moon: ${s.moon} floors`]);
    if (Date.now() < s.star) chips.push(["#ffe9a8", "Lucky star " + G.fmtTime((s.star - Date.now()) / 1000)]);
    if (s.boon) chips.push(["#ffab2e", "Next summon: Legendary+"]);
    if (s.omen.pend) { const o = G.OMENS.find((x) => x.id === s.omen.pend.id); chips.push([o.color, o.sign]); }
    const key = chips.map((c) => c[1]).join("|");
    if (key !== statusKey) { statusKey = key; $("status").innerHTML = chips.map((c) => `<span class="chip" style="--tc:${c[0]}">${esc(c[1])}${c[2] ? `<button data-act="${c[2]}">${c[3]}</button>` : ""}</span>`).join(""); }
    const fl = $("flame"), heat = s.best < 5 ? 0 : s.omen.pend ? 1 : Math.min(1, s.omen.since / 14);
    fl.style.transform = `translateX(-50%) scale(${0.45 + heat * 0.9})`; fl.style.opacity = s.best < 5 ? 0.25 : 0.6 + heat * 0.4;
    $("omenBtn").classList.toggle("lit", !!s.omen.pend);
    const nextU = G.UNLOCK_TEXT.find((u) => s.best < u[0]), fam = b.id, weak = Object.keys(G.EL).filter((x) => G.EL[x].counter.includes(fam));
    const feed = [nextU ? `<p><b>Floor ${nextU[0]}:</b> ${nextU[1]}</p>` : "", `<p>${G.FAMLABEL[fam]} live here${weak.length ? ". " + weak.map((w) => `<b style="color:${G.EL[w].color}">${G.EL[w].label}</b>`).join(" and ") + " blades are strong against them" : ""}.</p>`, `<p class="dim">Team damage: ${G.fmt(G.partyDps())} per second</p>`].concat(s.log.slice(0, 2).map((l) => `<p class="dim">${esc(l.t)}</p>`)).join("");
    if (feed !== feedKey) { feedKey = feed; $("info").innerHTML = feed; }
    $("forgeDot").hidden = s.sigils < 1;
    $("journalDot").hidden = !(s.omen.sealed > 0 || (G.unlocked("bounty") && s.bounty && s.bounty.list.some((x) => x.n >= x.goal && !x.done)) || G.FEATS.some((x) => !s.feats[x.id] && x.get(s) >= x.goal));
    $("coach").hidden = true; // replaced by the guides
    $("musicBtn").classList.toggle("off", s.set.music === false); $("sfxBtn").classList.toggle("off", !s.set.sound);
    G.guideTick();
  }

  U.frame = function (now) {
    if (now - lastHud > 90) { lastHud = now; hud(); }
    if (now - lastPanel > 220 && Object.keys(dirty).length) { lastPanel = now; renderPanels(); }
  };
  let slow = 0;
  U.slowTick = function () {
    if (open === "exp" || open === "rift") dirty[open] = 1;
    if (!$("summon").hidden && !U.pull) dirty.summon = 1;
    if (++slow % 3 === 0) { dirty.journal = 1; if (wide) dirty.warband = 1; }
  };

  // ---------- sim events ----------
  function advice(a) {
    const act = { swap: ["open", "warband", "Open team"], level: ["lvlAll", "", "Level up"], summon: ["open", "forge", "Summon"], rebirth: ["open", "stars", "Rebirth"] }[a.k];
    const el = $("advice"); el.hidden = false;
    el.innerHTML = `<span><b>Defeated!</b> ${esc(a.text)}</span>${act ? `<button class="btn gold" data-act="${act[0]}" data-p="${act[1]}">${act[2]}</button>` : ""}<button class="iconbtn" data-act="hideAdvice" aria-label="Dismiss">✕</button>`;
    clearTimeout(advice.t); advice.t = setTimeout(() => (el.hidden = true), 14000);
  }
  U.on = function (e) {
    switch (e.t) {
      case "floor": if (e.boss) { U.toast(`Boss of floor ${e.f} defeated!`, "#ffab2e"); dirty.all = 1; } break;
      case "unlock": U.toast(`Floor ${e.floor}: ${e.text} unlocked`, "#c9a24b"); G.render.banner("UNLOCKED", "#c9a24b", e.text); dirty.all = 1; G.recalc(); break;
      case "wipe": advice(e.advice); dirty.warband = 1; break;
      case "omen": { const o = G.OMENS.find((x) => x.id === e.id); U.toast("Something is coming: " + o.sign, o.color); break; }
      case "imp": U.toast("A treasure imp! Defeat it before it runs away.", "#ffd24a"); G.render.banner("TREASURE IMP", "#ffd24a"); break;
      case "impFled": U.toast("The imp got away.", "#a39279"); break;
      case "champion": G.render.banner("CHAMPION", "#ff8a2a", "A strong monster is on this floor"); break;
      case "moon": G.render.banner("BLOOD MOON", "#ff3b3b", "10 floors of champions and double gold"); break;
      case "moonEnd": U.toast("The Blood Moon is over. +10 gems", "#6fd6ff"); break;
      case "curse": U.toast("Cursed for 5 floors: monsters hit harder, loot is doubled.", "#b56bff"); break;
      case "curseEnd": U.toast("The curse is gone.", "#b56bff"); break;
      case "hollowStart": G.render.banner("THE HOLLOW BLADE", "#8fa3c8", "It waits at the end of this floor"); break;
      case "hollowWin": U.toast("Your next summon is Legendary or better!", "#ffab2e"); break;
      case "star": U.toast("A falling star! Legendary chance doubled for 10 minutes.", "#ffe9a8"); dirty.summon = 1; break;
      case "drop": if (e.kind === "rune") { U.toast("Found " + G.runeName(e.rune), "#55c6f8"); dirty.relics = 1; } G.audio.buzz(20); break;
      case "kill": if (e.kind === "gild") U.toast("Golden monster defeated! +1 gem", "#ffd24a"); break;
      case "rebirth": dirty.all = 1; U.toast(`Reborn with ${e.gain} Essence.`, "#ff8a2a"); break;
      case "riftStart": G.render.banner("DAILY TRIAL", "#b56bff", G.rift.mod.name); dirty.all = 1; break;
      case "riftEnd": U.modal(`<h2>Trial over</h2><p class="hint">${e.wiped ? "Your team was defeated." : "Time is up."}</p><div class="report"><div><b>${e.depth}</b><span>floors</span></div><div><b>+${e.rew}</b><span>gems</span></div></div><button class="btn gold big" data-act="modalClose">Continue</button>`); dirty.all = 1; break;
      case "shrine":
        U.modal(`<h2 style="color:#b56bff">Cursed Shrine</h2><p>For the next 5 floors, monsters hit 50% harder, but everything they drop is doubled.</p><div class="rowbtns center"><button class="btn gold big" data-act="shrine" data-v="1">Accept the curse</button><button class="btn big" data-act="shrine" data-v="0">No thanks <small>auto in <span id="mCount"></span>s</small></button></div>`, "event");
        countdown(20, () => A.shrine({ v: "0" })); break;
      case "smith":
        U.smithOffers = e.offers;
        U.modal(`<h2 style="color:#ffb45a">Wandering Smith</h2><p>A smith offers you one free upgrade. Pick one.</p><div class="choices">${e.offers.map((o, i) => `<button class="btn big" data-act="smith" data-i="${i}">${esc(o.text)}</button>`).join("")}</div><p class="hint">Takes the last one in <span id="mCount"></span>s.</p>`, "event");
        countdown(25, () => A.smith({ i: String(e.offers.length - 1) })); break;
      case "paths":
        U.pathOffers = e.offers;
        U.modal(`<h2>Pick a door</h2><p class="hint">The boss is down. Your choice changes the next 10 floors.</p><div class="doors">${e.offers.map((o, i) => `<button class="door" data-act="path" data-i="${i}" style="--dc:${o.hidden ? "#8fa3c8" : o.color}"><span class="arch">${o.hidden ? "?" : ""}</span><b>${o.hidden ? "Mystery door" : o.name}</b><small>${o.hidden ? "Unknown effect. +1 gem for being brave." : o.desc}</small></button>`).join("")}</div><p class="hint">Picks the left door in <span id="mCount"></span>s.</p>`, "event");
        countdown(15, () => A.path({ i: "0" })); break;
    }
  };

  // ---------- actions ----------
  function afterPower() { dirty.warband = 1; dirty.band = 1; }
  const A = {
    open: (d) => U.open(d.p), close: () => U.close(), modalClose: () => U.closeModal(), hideAdvice: () => ($("advice").hidden = true),
    closeSummon: () => U.closeSummon(),
    tipOk: (d) => tipDone(d.k),
    slot(d) { const i = +d.i, p = G.party[i]; if (!p) { if (i < G.slotCount()) { pickSlot = i; U.open("warband"); dirty.warband = 1; } return; } if (G.castUlt(i)) { tipDone("ult"); return; } U.inspect(p.b.u); },
    lvl(d) { if (G.levelSlot(+d.i)) { G.refreshBlades(); G.audio.play("level"); dirty.warband = 1; tipDone("level"); } else U.toast("Not enough gold yet.", "#a39279"); },
    lvlAll() { const n = G.levelAll(); if (n) { G.audio.play("level"); dirty.warband = 1; $("advice").hidden = true; tipDone("level"); } else U.toast("Not enough gold yet. Defeat monsters to earn more.", "#a39279"); },
    speed() { G.s.set.speed = (G.s.set.speed % 3) + 1; },
    auto() { G.s.set.autoUlt = !G.s.set.autoUlt; dirty.settings = 1; },
    pause() { if (G.paused === "user") G.paused = null; else if (!G.paused) G.paused = "user"; },
    push() { G.pushOn(); U.toast("Your team will try the next floor again.", "#ffab2e"); },
    pick(d) { const i = +d.i; pickSlot = pickSlot === i ? null : i; dirty.warband = 1; },
    tile(d) {
      const u = +d.u, inTeamView = (open === "warband" || wide) && $("modal").hidden && $("summon").hidden && G.blade(u) && !G.onExpedition(u);
      if (inTeamView && pickSlot != null) { G.equip(u, pickSlot); pickSlot = null; afterPower(); G.audio.play("click"); return; }
      // With a free slot, tapping a blade that is not in the team adds it straight away.
      const free = G.s.party.findIndex((x, k) => x == null && k < G.slotCount());
      if (inTeamView && free >= 0 && !G.inParty(u)) { G.equip(u, free); afterPower(); G.audio.play("click"); U.toast(`${G.SW[G.blade(u).i].name} joins the team`, "#f2c14e"); return; }
      U.inspect(u);
    },
    guide: (d) => { U.close(); G.startGuide(d.id, true); },
    help: (d) => G.startGuide(G.helpFor(d.p || open), true),
    guideNext: () => G.guideNext(), guideSkip: () => G.guideSkip(), noop: () => {},
    muteMusic() { G.s.set.music = G.s.set.music === false; G.audio.unlock(); G.audio.music(); dirty.settings = 1; U.toast(G.s.set.music ? "Music on" : "Music off", "#a8977d"); },
    muteSfx() { G.s.set.sound = !G.s.set.sound; G.audio.unlock(); dirty.settings = 1; U.toast(G.s.set.sound ? "Sound effects on" : "Sound effects off", "#a8977d"); },
    inspect(d) { U.inspect(+d.u, d.m); },
    equip(d) { if (G.equip(+d.u, +d.i)) { afterPower(); U.closeModal(); G.audio.play("click"); } },
    autofill() { G.autoParty(); G.refreshBlades(); afterPower(); U.toast("Best blades added. Tanks go in front.", "#c9a24b"); },
    ascendAll() { const n = G.ascendAll(); afterPower(); U.toast(n ? `Merged ${n} duplicate${n > 1 ? "s" : ""}.` : "No duplicates to merge.", "#c9a24b"); },
    salvageStone() { const r = G.salvageStone(); afterPower(); U.toast(r.n ? `Sold ${r.n} Common blades for ${G.fmt(r.v)} gold.` : "No spare Common blades.", "#c9a24b"); },
    ascend(d) { const b = G.blade(+d.u), f = b && G.fodderFor(b).sort((a, z) => a.s - z.s)[0]; if (b && f && G.ascend(b, f)) { afterPower(); U.inspect(b.u); G.audio.play("drop"); } },
    lock(d) { const b = G.blade(+d.u); if (b) { b.lock = !b.lock; dirty.warband = 1; U.inspect(b.u); } },
    salvage(d) { const b = G.blade(+d.u); if (b) { const v = G.salvage(b); if (v) { U.closeModal(); afterPower(); U.toast(`Sold for ${G.fmt(v)} gold.`, "#c9a24b"); } } },
    socket(d) { const b = G.blade(+d.u); if (b && G.socket(b, +d.i)) { dirty.relics = 1; afterPower(); U.inspect(b.u); } },
    unsocket(d) { const b = G.blade(+d.u); if (b && G.unsocket(b)) { dirty.relics = 1; afterPower(); U.inspect(b.u); } },
    fuse(d) { if (G.fuseRunes(d.k, +d.t)) { dirty.relics = 1; G.audio.play("drop"); } },
    summon(d) {
      const n = +d.n, first = G.s.pulls === 0;
      if (pullLocked()) return;
      if (n === 10 && !G.unlocked("ten") && !first) return U.toast("Summon 10 unlocks at floor 10.", "#a39279");
      const owned = new Set(G.s.blades.map((b) => b.i));
      const list = G.summon(n); if (!list) return U.toast("Not enough gems.", "#a39279");
      tipDone("summon");
      const isNew = list.map((b) => { const fresh = !owned.has(b.i); owned.add(b.i); return fresh; });
      const best = list.reduce((a, b) => (G.TIER[b.t].rank > G.TIER[a].rank ? b.t : a), "common");
      // Later summons drop straight into empty slots; the first one is left for the player to pick.
      if (!first && G.party.some(Boolean)) list.forEach((b) => { const i = G.s.party.findIndex((u, k) => u == null && k < G.slotCount()); if (i >= 0) G.equip(b.u, i); });
      afterPower();
      U.pull = { list, best, isNew, phase: G.s.set.calm ? "show" : "charge", tell: false, fresh: true }; dirty.summon = 1;
      clearTimeout(U.pullT); clearTimeout(U.pullT2);
      if (G.s.set.calm) return G.audio.play("reveal", G.TIER[best].rank);
      G.audio.play("charge");
      U.pullT2 = setTimeout(() => { if (U.pull && U.pull.phase === "charge") { U.pull.tell = true; dirty.summon = 1; } }, 650);
      U.pullT = setTimeout(() => A.skipPull(), 1300);
    },
    skipPull() {
      if (!U.pull || U.pull.phase !== "charge") return; clearTimeout(U.pullT); clearTimeout(U.pullT2); U.pull.phase = "show"; U.pull.fresh = true; dirty.summon = 1;
      // Keep the buttons locked until every card has flipped in.
      const wait = G.s.set.calm ? 0 : 450 + 90 * U.pull.list.length; U.pull.lockUntil = Date.now() + wait; setTimeout(() => { dirty.summon = 1; }, wait + 30); const r = G.TIER[U.pull.best].rank; G.audio.play("reveal", r); if (r >= 3) G.audio.buzz(60); },
    buyStar(d) { if (G.buyStar(d.id)) { dirty.stars = 1; afterPower(); G.audio.play("drop"); } },
    rebirthAsk() {
      const s = G.s, gain = G.emberGain(s.runBest);
      U.modal(`<h2 style="color:#ff8a2a">Rebirth?</h2><div class="report"><div><b>+${gain}</b><span>Essence</span></div><div><b>${s.runBest}</b><span>best floor this run</span></div></div><p><b>You keep:</b> all blades, ★ ranks, runes, gems and upgrades.</p><p><b>You lose:</b> gold, team levels and your current floor.</p><div class="rowbtns center"><button class="btn gold big" data-act="rebirthDo">Rebirth</button><button class="btn big" data-act="modalClose">Not yet</button></div>`, "event");
    },
    rebirthDo() { U.closeModal(); G.rebirth(); },
    claimBounty(d) { const b = G.s.bounty && G.s.bounty.list[+d.i]; if (b && b.n >= b.goal && !b.done) { b.done = true; G.s.sigils += b.rew; dirty.journal = 1; G.audio.play("drop"); } },
    claimFeat(d) { const f = G.FEATS.find((x) => x.id === d.id); if (f && !G.s.feats[f.id] && f.get(G.s) >= f.goal) { G.s.feats[f.id] = 1; G.s.sigils += f.rew; dirty.journal = 1; G.audio.play("drop"); U.toast(`Achievement: ${f.name}. +${f.rew} gems`, "#6fd6ff"); } },
    openSealed() { const r = G.openSealed(); if (r) { U.toast("Mystery chest: " + r, "#ffd24a"); dirty.journal = 1; G.audio.play("secret"); } },
    sendExp(d) { const s = G.s, u = s.blades.filter((b) => !G.inParty(b.u) && !G.onExpedition(b.u)).sort((a, z) => G.TIER[z.t].rank - G.TIER[a.t].rank || z.s - a.s).slice(0, 3).map((b) => b.u); if (G.sendExp(u, +d.h)) { dirty.exp = 1; dirty.warband = 1; } },
    claimExp(d) { const r = G.claimExp(+d.i); if (r) { U.toast(`Mission done: +${G.fmt(r.souls)} gold, +${r.sig} gems${r.rune ? ", " + G.runeName(r.rune) : ""}`, "#c9a24b"); dirty.exp = 1; dirty.warband = 1; G.audio.play("drop"); } },
    startRift() { if (G.startRift()) U.close(); },
    set(d) { G.s.set[d.k] = !G.s.set[d.k]; dirty.settings = 1; if (d.k === "sound" || d.k === "music") { G.audio.unlock(); G.audio.music(); } },
    export() { const code = G.exportSave(); U.modal(`<h2>Save code</h2><p class="hint">Keep this somewhere safe to move your progress to another device.</p><textarea class="code" id="saveCode" readonly>${esc(code)}</textarea><div class="rowbtns center"><button class="btn gold" data-act="copyCode">Copy</button><button class="btn" data-act="modalClose">Close</button></div>`); },
    copyCode() { const t = $("saveCode"); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => U.toast("Copied.", "#c9a24b")).catch(() => { try { document.execCommand("copy"); U.toast("Copied.", "#c9a24b"); } catch (e) { U.toast("Select the text and copy it by hand.", "#a39279"); } }); },
    importAsk() { U.modal(`<h2>Load a save code</h2><p class="hint">This replaces your current progress.</p><textarea class="code" id="loadCode" placeholder="Paste the code here"></textarea><div class="rowbtns center"><button class="btn gold" data-act="importDo">Load</button><button class="btn" data-act="modalClose">Cancel</button></div>`); },
    importDo() { if (G.importSave($("loadCode").value)) { G.noSave = true; location.reload(); } else U.toast("That code did not work.", "#e0503a"); },
    resetAsk() { U.modal(`<h2 style="color:#e0503a">Delete your save?</h2><p>All blades, floors and upgrades will be gone. This cannot be undone.</p><div class="rowbtns center"><button class="btn danger big" data-act="resetDo">Delete</button><button class="btn big" data-act="modalClose">Keep playing</button></div>`); },
    resetDo() { G.noSave = true; G.wipeSave(); location.reload(); },
    shrine(d) { U.closeModal(); G.shrine(d.v === "1"); },
    smith(d) { const o = U.smithOffers && U.smithOffers[+d.i]; U.closeModal(); if (o) { G.smith(o); afterPower(); U.toast("The smith nods and leaves.", "#ffb45a"); } else G.paused = null; },
    path(d) { const o = U.pathOffers && U.pathOffers[+d.i]; U.closeModal(); G.choosePath(o || null); if (o) U.toast(`${o.name}: ${o.desc}${o.hidden ? " +1 gem" : ""}`, o.color); },
    omenInfo() {
      const s = G.s, p = s.omen.pend && G.OMENS.find((x) => x.id === s.omen.pend.id);
      tipDone("event");
      U.modal(`<button class="iconbtn mclose" data-act="modalClose" aria-label="Close">✕</button><h2>Event candle</h2><p>${s.best < 5 ? "Lights up at floor 5." : p ? `<b style="color:${p.color}">${p.sign}</b> Something arrives within 2 floors.` : `Burns brighter with every floor. ${s.omen.since} floors since the last event; one is certain within 20.`}</p><div class="log">${G.OMENS.map((o) => `<p><b style="color:${o.color}">${o.name}</b> <span class="dim">${o.sign}</span></p>`).join("")}</div>`);
    },
    offlineOk() { U.closeModal(); },
    openTeam: () => U.open("warband"), openSummon: () => U.openSummon(),
  };
  U.act = A;

  U.offline = function (r) {
    U.modal(`<h2>Welcome back!</h2><p class="hint">You were away for ${G.fmtTime(r.secs)}${r.capped ? ` (max ${G.mod.offCap} hours)` : ""}. Your team kept fighting at ${Math.round(G.mod.offRate * 100)}% speed.</p>
      <div class="report"><div><b>+${G.fmt(r.souls)}</b><span>gold</span></div><div><b>+${r.floors}</b><span>floors</span></div><div><b>+${r.sig}</b><span>gems</span></div>${r.sealed ? `<div><b>${r.sealed}</b><span>mystery chests</span></div>` : ""}</div>
      <button class="btn gold big" data-act="offlineOk">Continue</button>`, "event");
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
    // Volume sliders update live; the panel is not re-rendered while dragging.
    document.addEventListener("input", (e) => {
      const k = e.target.dataset && e.target.dataset.vol; if (!k) return;
      G.s.set[k] = +e.target.value / 100; const out = $("volv_" + k); if (out) out.textContent = e.target.value + "%";
      G.audio.unlock(); G.audio.applyVolumes(); if (k === "sfxVol") { clearTimeout(U.volT); U.volT = setTimeout(() => G.audio.play("drop"), 150); }
    });
    $("modal").addEventListener("click", (e) => { if (e.target === $("modal") && !G.paused) U.closeModal(); });
    // Touch screens have no drag-and-drop: press and hold a blade, then drag it onto a slot.
    let drag = null, suppressClick = 0;
    const endDrag = () => { if (!drag) return; clearTimeout(drag.timer); if (drag.ghost) drag.ghost.remove(); document.querySelectorAll(".dropover").forEach((n) => n.classList.remove("dropover")); drag = null; };
    const dropAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest("[data-drop]"); };
    document.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      const t = e.target.closest && e.target.closest(".tile"); if (!t) return;
      drag = { u: +t.dataset.u, x: e.clientX, y: e.clientY, on: false };
      drag.timer = setTimeout(() => {
        if (!drag) return;
        drag.on = true; const g = document.createElement("div"); g.className = "dragghost"; g.innerHTML = t.innerHTML; g.style.setProperty("--tc", t.style.getPropertyValue("--tc"));
        g.style.left = drag.x + "px"; g.style.top = drag.y + "px"; document.body.appendChild(g); drag.ghost = g;
        G.audio.buzz(15); G.audio.play("click");
      }, 260);
    });
    document.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (!drag.on) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) endDrag(); return; } // it was a scroll
      drag.ghost.style.left = e.clientX + "px"; drag.ghost.style.top = e.clientY + "px";
      const d = dropAt(e.clientX, e.clientY); document.querySelectorAll(".dropover").forEach((n) => n !== d && n.classList.remove("dropover")); if (d) d.classList.add("dropover");
    });
    document.addEventListener("touchmove", (e) => { if (drag && drag.on) e.preventDefault(); }, { passive: false });
    document.addEventListener("pointerup", (e) => {
      if (!drag) return;
      if (drag.on) { suppressClick = Date.now(); const d = dropAt(e.clientX, e.clientY); if (d && G.equip(drag.u, +d.dataset.drop)) { afterPower(); G.audio.play("click"); U.toast(`${G.SW[G.blade(drag.u).i].name} joins the team`, "#f2c14e"); } }
      endDrag();
    });
    document.addEventListener("pointercancel", endDrag);
    document.addEventListener("click", (e) => { if (Date.now() - suppressClick < 450) { e.stopPropagation(); e.preventDefault(); } }, true);
    document.addEventListener("dragstart", (e) => { const t = e.target.closest && e.target.closest(".tile"); if (t) e.dataTransfer.setData("text/plain", t.dataset.u); });
    document.addEventListener("dragover", (e) => { if (e.target.closest && e.target.closest("[data-drop]")) e.preventDefault(); });
    document.addEventListener("drop", (e) => { const t = e.target.closest && e.target.closest("[data-drop]"); if (!t) return; e.preventDefault(); const u = +e.dataTransfer.getData("text/plain"); if (u && G.equip(u, +t.dataset.drop)) afterPower(); });
    tabs();
  };
})();
