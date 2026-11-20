/* A főoldal logikája: betöltés, térkép, toplisták, űrlap, crew, ID-kártya, élő jelenlét. */
(function (w) {
  "use strict";
  var D = w.GTAData, C = w.GTACore, api = C.api;
  var $ = function (id) { return document.getElementById(id); };
  var esc = C.esc, nf = C.nf;

  var fans = [], crews = {}, weekly = {}, online = {}, me = null;
  var tab = "place", sel = null, map = null, channel = null;

  /* ---------------- térkép ---------------- */
  var tip = $("tip");
  map = w.GTAMap.create({
    svg: $("map"),
    onHover: function (id, el) {
      if (!id) { tip.style.opacity = "0"; return; }
      var pl = D.BY_ID[id];
      if (!pl) { tip.style.opacity = "0"; return; }
      var list = fans.filter(function (f) { return f.place_id === id; });
      var hours = list.reduce(function (s, f) { return s + f.hours; }, 0);
      var names = list.slice().sort(function (a, b) { return b.hours - a.hours; }).slice(0, 3)
        .map(function (f) { return esc(f.nick); }).join(", ");
      var line = list.length ? (list.length + " rajongó · " + nf(hours) + " óra") : "még senki";
      tip.innerHTML = "<b>" + esc(pl.label) + "</b><br><span>" + line + "</span>" +
        (names ? "<br><span>" + names + (list.length > 3 ? " +" + (list.length - 3) : "") + "</span>" : "");
      var host = $("map").parentNode.getBoundingClientRect(), b = el.getBoundingClientRect();
      tip.style.left = Math.max(70, Math.min(host.width - 70, b.left + b.width / 2 - host.left)) + "px";
      tip.style.top = Math.max(34, b.top - host.top) + "px";
      tip.style.opacity = "1";
    },
    onSelect: function (id) { openPlace(id); },
    onView: function (wdt) {
      $("vHu").classList.toggle("on", Math.abs(wdt - w.GTAMap.HU.w) < 1 && map.getMode() !== "heat");
      $("vBp").classList.toggle("on", Math.abs(wdt - w.GTAMap.BP.w) < 1 && map.getMode() !== "heat");
    }
  });

  $("vHu").onclick = function () { map.setMode("pins"); map.view("hu"); syncMapTabs(); };
  $("vBp").onclick = function () { map.setMode("pins"); map.view("bp"); syncMapTabs(); };
  $("vHeat").onclick = function () {
    map.setMode(map.getMode() === "heat" ? "pins" : "heat");
    syncMapTabs();
  };
  $("zIn").onclick = function () { map.zoom(0.72); };
  $("zOut").onclick = function () { map.zoom(1.38); };

  function syncMapTabs() {
    var heat = map.getMode() === "heat";
    $("vHeat").classList.toggle("on", heat);
    $("vHu").classList.toggle("on", !heat && Math.abs(map.width() - w.GTAMap.HU.w) < 1);
    $("vBp").classList.toggle("on", !heat && Math.abs(map.width() - w.GTAMap.BP.w) < 1);
    $("legend").innerHTML = heat
      ? '<span>kevés<span class="bar"></span>sok rajongó 10 000 lakosra</span><span>országos nézet = megyék · Budapesten kerületek</span>'
      : '<span><i style="background:linear-gradient(135deg,#ffd66e,#ff2d95)"></i>rajongók</span>' +
        '<span><i style="background:linear-gradient(135deg,#d7fffe,#2de2e6)"></i>te</span>' +
        '<span>a kör mérete = hány fő</span>';
  }

  /* ---------------- számolás ---------------- */
  function totals() {
    var h = 0, wk = 0;
    fans.forEach(function (f) { h += f.hours; wk += (weekly[f.id] || 0); });
    return { n: fans.length, hours: h, week: wk, avg: fans.length ? h / fans.length : 0 };
  }

  function placeGroups() {
    var m = {};
    fans.forEach(function (f) {
      var pl = D.BY_ID[f.place_id];
      if (!pl) return;
      var g = m[f.place_id] || (m[f.place_id] = { id: f.place_id, place: pl, fans: [], hours: 0, week: 0 });
      g.fans.push(f); g.hours += f.hours; g.week += (weekly[f.id] || 0);
    });
    return Object.keys(m).map(function (k) { return m[k]; });
  }

  function crewGroups() {
    var m = {};
    fans.forEach(function (f) {
      if (!f.crew_id || !crews[f.crew_id]) return;
      var g = m[f.crew_id] || (m[f.crew_id] = { crew: crews[f.crew_id], fans: [], hours: 0 });
      g.fans.push(f); g.hours += f.hours;
    });
    return Object.keys(m).map(function (k) { return m[k]; });
  }

  /* ---------------- megjelenítés ---------------- */
  function render() {
    var t = totals();
    $("sFans").textContent = nf(t.n);
    $("sHours").textContent = nf(t.hours);
    $("sWeek").textContent = "+" + nf(t.week);
    $("sAvg").innerHTML = nf(t.avg) + ' <small>óra</small>';
    var pg = placeGroups().sort(function (a, b) { return b.fans.length - a.fans.length || b.hours - a.hours; });
    $("sTop").textContent = pg.length ? pg[0].place.short : "—";

    map.setFans(fans, me ? me.id : null);
    map.setOnline(online);

    renderBoard(pg);
    renderMine();
    if (sel) openPlace(sel, true);
  }

  function rankTag(h) {
    var r = D.rankOf(h);
    return '<span class="rank" style="color:' + r.color + '">' + esc(r.name) + "</span>";
  }

  function renderBoard(pg) {
    var list = $("lbList"), empty = $("lbEmpty"), note = $("lbNote");
    if (!fans.length) { list.innerHTML = ""; empty.hidden = false; note.innerHTML = ""; return; }
    empty.hidden = true;
    var html = "", n = 0;

    if (tab === "place") {
      html = pg.slice(0, 12).map(function (g, i) {
        return '<li data-place="' + esc(g.id) + '"><span class="rk">' + (i + 1) + "</span>" +
          '<span class="nm">' + esc(g.place.short) + "<em>" + g.fans.length + " rajongó</em></span>" +
          '<span class="vl">' + nf(g.hours) + " ó" + (g.week ? "<em>+" + nf(g.week) + " a héten</em>" : "") + "</span></li>";
      }).join("");
      note.innerHTML = '<p class="note">Kattints egy sorra, és a térkép megmutatja, kik vannak ott.</p>';
    } else if (tab === "player") {
      html = fans.slice().sort(function (a, b) { return b.hours - a.hours; }).slice(0, 12)
        .map(function (f, i) {
          var pl = D.BY_ID[f.place_id];
          var cw = f.crew_id && crews[f.crew_id];
          return '<li data-place="' + esc(f.place_id) + '"><span class="rk">' + (i + 1) + "</span>" +
            '<span class="nm">' + (online[f.id] ? '<span class="crewdot" style="background:#5ad2a0"></span>' : "") +
            (cw ? '<span class="crewdot" style="background:' + esc(cw.color) + '"></span>' : "") +
            esc(f.nick) + " " + rankTag(f.hours) +
            "<em>" + (pl ? esc(pl.short) : "") + " · " + esc(C.platLabel(f.platform)) + "</em></span>" +
            '<span class="vl">' + nf(f.hours) + " ó" + (weekly[f.id] ? "<em>+" + nf(weekly[f.id]) + "</em>" : "") + "</span></li>";
        }).join("");
      note.innerHTML = '<p class="note">A rang az összes játszott órából jön: Újonc → Leonida Veterán.</p>';
    } else if (tab === "county") {
      var cs = map.countyStats();
      var rows = D.COUNTY_NAMES.map(function (nm) { return cs[nm]; })
        .filter(function (r) { return r.fans > 0; })
        .sort(function (a, b) { return b.per10k - a.per10k; });
      if (!rows.length) { list.innerHTML = ""; empty.hidden = false; note.innerHTML = ""; return; }
      html = rows.slice(0, 20).map(function (r, i) {
        return "<li><span class=\"rk\">" + (i + 1) + "</span>" +
          '<span class="nm">' + esc(r.name) + "<em>" + r.fans + " rajongó · " + nf(r.hours) + " óra</em></span>" +
          '<span class="vl">' + r.per10k.toFixed(2) + "<em>/ 10 000 fő</em></span></li>";
      }).join("");
      note.innerHTML = '<p class="note">A sorrendet a 10 000 lakosra jutó rajongószám adja, nem a nyers létszám — így nem automatikusan Budapest és Pest megye nyer.</p>';
    } else {
      var cg = crewGroups().sort(function (a, b) { return b.hours - a.hours; });
      if (!cg.length) {
        list.innerHTML = "";
        empty.hidden = true;
        note.innerHTML = '<p class="note">Még egy crew sincs. Jelöld be magad, utána a saját kártyádon tudsz alapítani egyet.</p>';
        return;
      }
      html = cg.slice(0, 12).map(function (g, i) {
        return "<li><span class=\"rk\">" + (i + 1) + "</span>" +
          '<span class="nm"><span class="crewdot" style="background:' + esc(g.crew.color) + '"></span>' +
          esc(g.crew.name) + "<em>" + g.fans.length + " tag</em></span>" +
          '<span class="vl">' + nf(g.hours) + " ó</span></li>";
      }).join("");
      note.innerHTML = '<p class="note">A crew-k összesített óraszám szerint állnak sorban.</p>';
    }
    list.innerHTML = html;
  }

  document.querySelectorAll("[data-tab]").forEach(function (b) {
    b.onclick = function () {
      tab = b.getAttribute("data-tab");
      document.querySelectorAll("[data-tab]").forEach(function (x) { x.classList.toggle("on", x === b); });
      render();
    };
  });
  $("lbList").addEventListener("click", function (e) {
    var li = e.target.closest("li[data-place]");
    if (li) openPlace(li.getAttribute("data-place"));
  });

  function openPlace(id, keep) {
    sel = id;
    map.select(id);
    var pl = D.BY_ID[id];
    var list = fans.filter(function (f) { return f.place_id === id; })
      .sort(function (a, b) { return b.hours - a.hours; });
    $("cityName").textContent = pl ? pl.label : "Hely";
    $("cityList").innerHTML = list.length ? list.map(function (f, i) {
      var cw = f.crew_id && crews[f.crew_id];
      return "<li><span class=\"rk\">" + (i + 1) + "</span>" +
        '<span class="nm">' + (online[f.id] ? '<span class="crewdot" style="background:#5ad2a0"></span>' : "") +
        esc(f.nick) + " " + rankTag(f.hours) + "<em>" + esc(C.platLabel(f.platform)) +
        (cw ? " · " + esc(cw.name) : "") + (f.note ? " · " + esc(f.note) : "") + "</em></span>" +
        '<span class="vl">' + nf(f.hours) + " ó</span></li>";
    }).join("") : '<li style="grid-template-columns:1fr"><span class="nm" style="font-weight:400;color:var(--muted)">Itt még nincs bejelölt rajongó.</span></li>';
    $("cityPanel").hidden = false;
    if (!keep) $("cityPanel").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  $("cityClose").onclick = function () { sel = null; map.select(null); $("cityPanel").hidden = true; };

  /* ---------------- saját kártya ---------------- */
  function renderMine() {
    var box = $("mineBox");
    if (!me) {
      box.innerHTML = '<p class="note">Még nem jelölted be magad. A becenevet, a helyet és az órákat bármikor módosíthatod — a szerkesztés jogát egy titkos azonosító adja, ami csak ebben a böngészőben van meg.</p>';
      $("openForm").textContent = "Bejelölöm magam";
      return;
    }
    var pl = D.BY_ID[me.place_id], r = D.rankOf(me.hours);
    var cw = me.crew_id && crews[me.crew_id];
    box.innerHTML = '<div class="mine"><div class="nm">' + esc(me.nick) + " " + rankTag(me.hours) + "</div>" +
      '<div class="meta">' + (pl ? esc(pl.label) : "") + " · " + nf(me.hours) + " óra · " + esc(C.platLabel(me.platform)) +
      (weekly[me.id] ? " · +" + nf(weekly[me.id]) + " a héten" : "") + "</div>" +
      (cw ? '<div class="meta"><span class="crewdot" style="background:' + esc(cw.color) + '"></span>' + esc(cw.name) + "</div>" : "") +
      (me.note ? '<div class="note" style="margin-top:7px">„' + esc(me.note) + "”</div>" : "") +
      '<div class="row"><button class="btn sm" id="bEdit" type="button">Módosítás</button>' +
      '<button class="btn sm" id="bCard" type="button">ID-kártya</button>' +
      (cw ? "" : '<button class="btn sm" id="bCrew" type="button">Crew alapítása</button>') +
      '<button class="btn sm ghost" id="bDel" type="button">Törlés</button></div></div>';
    $("openForm").textContent = "Óraszám frissítése";
    $("bEdit").onclick = openForm;
    $("bCard").onclick = showCard;
    $("bDel").onclick = removeMine;
    if ($("bCrew")) $("bCrew").onclick = function () { $("cErr").textContent = ""; $("crewDlg").showModal(); };
  }

  /* ---------------- űrlap ---------------- */
  var dlg = $("dlg");
  $("places").innerHTML = D.PLACES.map(function (p) {
    return '<option value="' + p.label.replace(/"/g, "&quot;") + '"></option>';
  }).join("");

  function placeByLabel(v) {
    v = (v || "").trim().toLowerCase();
    for (var i = 0; i < D.PLACES.length; i++) {
      if (D.PLACES[i].label.toLowerCase() === v) return D.PLACES[i];
    }
    var hits = D.PLACES.filter(function (p) { return p.label.toLowerCase().indexOf(v) === 0; });
    return hits.length === 1 ? hits[0] : null;
  }

  function fillCrewSelect() {
    var s = $("fCrew"), cur = me && me.crew_id ? me.crew_id : "";
    s.innerHTML = '<option value="">— nincs —</option>' + Object.keys(crews).map(function (id) {
      return '<option value="' + esc(id) + '">' + esc(crews[id].name) + "</option>";
    }).join("");
    s.value = cur;
  }

  function openForm() {
    $("fErr").textContent = "";
    $("dlgTitle").textContent = me ? "Adataim frissítése" : "Bejelölöm magam";
    fillCrewSelect();
    if (me) {
      $("fNick").value = me.nick;
      $("fHours").value = me.hours;
      $("fPlat").value = me.platform;
      $("fNote").value = me.note || "";
      var pl = D.BY_ID[me.place_id];
      $("fPlace").value = pl ? pl.label : "";
    }
    dlg.showModal();
    setTimeout(function () { $("fNick").focus(); }, 30);
  }
  $("openForm").onclick = openForm;
  $("fCancel").onclick = function () { dlg.close(); };

  $("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var nick = $("fNick").value.trim();
    var pl = placeByLabel($("fPlace").value);
    var h = Math.round(+$("fHours").value);
    function fail(msg) {
      $("fErr").textContent = msg;
      $("fErr").scrollIntoView({ block: "nearest" });
    }
    if (nick.length < 2) { fail("Adj meg egy becenevet (legalább 2 karakter)."); return; }
    if (nick.length > 22) { fail("A becenév legfeljebb 22 karakter lehet."); return; }
    if (!pl) { fail("Válassz helyet a listából (város vagy budapesti kerület)."); return; }
    if (!isFinite(h) || h < 0 || h > 5000) { fail("Az óraszám 0 és 5000 között legyen."); return; }

    var btn = $("fSave");
    btn.disabled = true;
    btn.textContent = "Mentés…";
    api.save({
      nick: nick, place_id: pl.id, hours: h,
      platform: $("fPlat").value, note: $("fNote").value.trim(), crew_id: $("fCrew").value || null
    }).then(function () {
      dlg.close();
      return reload();
    }).catch(function (err) {
      fail(C.humanError(err));
    }).then(function () {
      btn.disabled = false;
      btn.textContent = "Mentés";
    });
  });

  function removeMine() {
    if (!me) return;
    var b = $("bDel");
    if (b.getAttribute("data-armed") !== "1") {
      b.setAttribute("data-armed", "1");
      b.textContent = "Biztos? Kattints újra";
      setTimeout(function () {
        if (b.isConnected) { b.setAttribute("data-armed", "0"); b.textContent = "Törlés"; }
      }, 4000);
      return;
    }
    api.remove().then(reload).catch(function (err) { banner(C.humanError(err)); });
  }

  /* ---------------- crew ---------------- */
  $("cCancel").onclick = function () { $("crewDlg").close(); };
  $("crewForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var nm = $("cName").value.trim();
    if (nm.length < 2) { $("cErr").textContent = "A crew neve legalább 2 karakter legyen."; return; }
    api.createCrew(nm, $("cColor").value).then(function () {
      $("crewDlg").close();
      $("cName").value = "";
      return reload();
    }).catch(function (err) { $("cErr").textContent = C.humanError(err); });
  });

  /* ---------------- ID-kártya ---------------- */
  function showCard() {
    var cv = $("cardCanvas"), ctx = cv.getContext("2d");
    var W = cv.width, H = cv.height;
    var pl = D.BY_ID[me.place_id], r = D.rankOf(me.hours);

    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#1a0538"); g.addColorStop(0.55, "#2a0a4a"); g.addColorStop(1, "#07020f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    var sun = ctx.createRadialGradient(W / 2, H * 0.3, 10, W / 2, H * 0.3, W * 0.75);
    sun.addColorStop(0, "rgba(255,45,149,.55)");
    sun.addColorStop(0.45, "rgba(255,156,43,.22)");
    sun.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(45,226,230,.25)"; ctx.lineWidth = 3;
    for (var i = 1; i < 14; i++) {
      var yy = H * 0.62 + Math.pow(i, 2.1) * 3.2;
      if (yy > H) break;
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#2de2e6";
    ctx.font = "600 34px 'Space Mono', monospace";
    ctx.fillText("GTA VI · MAGYAR TÉRKÉP", W / 2, 150);

    var tg = ctx.createLinearGradient(W * 0.1, 0, W * 0.9, 0);
    tg.addColorStop(0, "#ff2d95"); tg.addColorStop(0.6, "#ff9c2b"); tg.addColorStop(1, "#ffd66e");
    /* a betűméretet a leghosszabb névhez igazítjuk, hogy ne lógjon ki */
    function fit(text, max, size, font, weight) {
      var s = size;
      ctx.font = (weight || "900") + " " + s + "px " + font;
      while (ctx.measureText(text).width > max && s > 28) {
        s -= 4;
        ctx.font = (weight || "900") + " " + s + "px " + font;
      }
      return s;
    }
    var inner = W * 0.86;

    ctx.fillStyle = tg;
    fit(me.nick.toUpperCase(), inner, 120, "'Archivo Black', sans-serif");
    ctx.fillText(me.nick.toUpperCase(), W / 2, 420);

    ctx.fillStyle = r.color;
    fit(r.name.toUpperCase(), inner, 46, "'Space Mono', monospace", "700");
    ctx.fillText(r.name.toUpperCase(), W / 2, 500);

    ctx.fillStyle = "#f8ecff";
    ctx.font = "900 190px 'Archivo Black', sans-serif";
    ctx.fillText(nf(me.hours), W / 2, 800);
    ctx.fillStyle = "#a98fd0";
    ctx.font = "400 46px 'Space Mono', monospace";
    ctx.fillText("JÁTSZOTT ÓRA", W / 2, 870);

    ctx.fillStyle = "#ffd9a0";
    fit(pl ? pl.label : "", inner, 52, "'Archivo', sans-serif", "600");
    ctx.fillText(pl ? pl.label : "", W / 2, 1010);
    ctx.fillStyle = "#a98fd0";
    ctx.font = "400 40px 'Space Mono', monospace";
    ctx.fillText(C.platLabel(me.platform), W / 2, 1075);

    var cw = me.crew_id && crews[me.crew_id];
    if (cw) {
      ctx.fillStyle = cw.color;
      fit(cw.name, inner, 44, "'Archivo', sans-serif", "700");
      ctx.fillText(cw.name, W / 2, 1150);
    }

    if (me.note) {
      ctx.fillStyle = "#f8ecff";
      var q = "„" + me.note + "”";
      fit(q, inner, 40, "'Archivo', sans-serif", "400");
      ctx.fillText(q, W / 2, 1260);
    }

    var t = totals();
    ctx.fillStyle = "#a98fd0";
    ctx.font = "400 36px 'Space Mono', monospace";
    ctx.fillText(nf(t.n) + " magyar rajongó a térképen", W / 2, 1700);
    ctx.fillStyle = "#2de2e6";
    ctx.font = "700 40px 'Space Mono', monospace";
    ctx.fillText(location.host || "gta6 magyar térkép", W / 2, 1770);

    try { $("cardDl").href = cv.toDataURL("image/png"); } catch (e) { }
    $("cardDlg").showModal();
  }
  $("cardClose").onclick = function () { $("cardDlg").close(); };

  /* ---------------- beágyazó kód ---------------- */
  (function () {
    var src = location.origin + location.pathname.replace(/[^/]*$/, "") + "embed.html";
    var code = '<iframe src="' + src + '" width="100%" height="520" style="border:0;border-radius:16px" ' +
      'title="GTA VI magyar rajongói térkép" loading="lazy"></iframe>';
    $("embedCode").textContent = code;
    $("copyEmbed").onclick = function () {
      var btn = this;
      function done(ok) { btn.textContent = ok ? "Másolva!" : "Jelöld ki és másold"; setTimeout(function () { btn.textContent = "Kód másolása"; }, 2500); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () { done(true); }, function () { done(false); });
      } else { done(false); }
    };
  })();

  /* ---------------- betöltés ---------------- */
  function banner(msg) {
    var b = $("banner");
    if (!msg) { b.hidden = true; return; }
    b.hidden = false;
    b.textContent = msg;
  }

  function reload() {
    return Promise.all([api.fans(), api.crews(), api.weekly(), api.mine()])
      .then(function (r) {
        fans = r[0];
        crews = {};
        r[1].forEach(function (c) { crews[c.id] = c; });
        weekly = {};
        r[2].forEach(function (x) { weekly[x.fan_id] = x.delta; });
        me = r[3];
        banner(null);
        render();
      })
      .catch(function (err) {
        banner(C.humanError(err));
        render();
      });
  }

  /* nap-számláló */
  (function () {
    var d = C.days(D.RELEASE);
    $("dayChip").textContent = d > 0 ? (d + ". nap a megjelenés óta") : "Hamarosan";
  })();

  if (!api.ready) {
    banner("Az adatbázis nem érhető el ebből a nézetből, ezért a térkép üresen marad.");
    render();
  } else {
    reload().then(function () {
      channel = api.channel(
        function () { reload(); },
        function (peers) {
          online = {};
          var n = 0;
          peers.forEach(function (p) { n++; if (p.fan) online[p.fan] = true; });
          $("liveChip").hidden = n < 1;
          $("liveN").textContent = n;
          map.setOnline(online);
        }
      );
      if (channel) {
        channel.subscribe(function (status) {
          if (status === "SUBSCRIBED") {
            channel.track({ fan: me ? me.id : null, at: Date.now() });
          }
        });
      }
    });
    setInterval(function () { if (!document.hidden) reload(); }, 60000);
  }
  syncMapTabs();
})(window);
