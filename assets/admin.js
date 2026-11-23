/* Moderációs felület. A jelszót a szerver ellenőrzi minden egyes hívásnál;
   a böngésző csak tárolja. Óránként 10 hibás próbálkozás után a szerver zár. */
(function (w) {
  "use strict";
  var D = w.GTAData, C = w.GTACore, api = C.api;
  var $ = function (id) { return document.getElementById(id); };
  var esc = C.esc, nf = C.nf;

  var KEY = "gta6hu_admin";
  var key = null, setupMode = false, filter = "";

  /* a jelszót a böngésző megjegyzi, hogy ne kelljen minden alkalommal beírni;
     a Kijelentkezés gomb törli */
  function getKey() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setKey(v) {
    try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) { }
    try { sessionStorage.removeItem(KEY); } catch (e) { }
    key = v;
  }

  function showGate(msg) {
    $("panelWrap").hidden = true;
    $("gate").hidden = false;
    $("gateErr").textContent = msg || "";
    api.adminExists().then(function (exists) {
      setupMode = !exists;
      $("gateTitle").textContent = setupMode ? "Admin jelszó beállítása" : "Belépés";
      $("gateLede").textContent = setupMode
        ? "Még nincs admin jelszó. Az elsőként beállított jelszó lesz a végleges — add meg most, és mentsd el egy jelszókezelőbe."
        : "Add meg az admin jelszót a moderációs felülethez.";
      $("gateBtn").textContent = setupMode ? "Jelszó beállítása" : "Belépés";
      $("gateHint").textContent = setupMode
        ? "Legalább 12 karakter. A szerver csak a jelszó ellenőrizhetetlen lenyomatát tárolja, magát a jelszót nem."
        : "Óránként legfeljebb 10 hibás próbálkozás engedett hálózatonként.";
      $("pw").setAttribute("autocomplete", setupMode ? "new-password" : "current-password");
    }).catch(function (err) {
      $("gateErr").textContent = C.humanError(err);
    });
  }

  function enter() {
    $("gate").hidden = true;
    $("panelWrap").hidden = false;
    showSec(sec);
    load();
  }

  $("gateBtn").onclick = function () {
    var v = $("pw").value;
    $("gateErr").textContent = "";
    if (!v || v.length < 12) { $("gateErr").textContent = "A jelszó legalább 12 karakter legyen."; return; }
    var p = setupMode ? api.adminSetup(v) : api.adminOk(v);
    this.disabled = true;
    var btn = this;
    p.then(function () {
      setKey(v);
      $("pw").value = "";
      enter();
    }).catch(function (err) {
      $("gateErr").textContent = C.humanError(err);
    }).then(function () { btn.disabled = false; });
  };
  $("pw").addEventListener("keydown", function (e) { if (e.key === "Enter") $("gateBtn").click(); });

  /* --- elfelejtett jelszó --- */
  function api2(body) {
    return fetch("/api/admin-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.uzenet || "Hiba"); e.code = d.error; throw e; }
        return d;
      });
    });
  }
  $("forgot").onclick = function () {
    var b = this;
    $("gateErr").textContent = "";
    b.disabled = true;
    b.textContent = "Küldés…";
    api2({}).then(function () {
      $("resetWrap").hidden = false;
      $("gateHint").textContent = "Elküldtük a kódot az üzemeltető e-mail-címére. 20 percig érvényes.";
      b.textContent = "Kód újraküldése";
    }).catch(function (err) {
      $("gateErr").textContent = err.message || "Nem sikerült.";
      b.textContent = "Elfelejtettem a jelszót";
    }).then(function () { b.disabled = false; });
  };
  $("rSave").onclick = function () {
    var b = this;
    var kod = $("rkod").value.trim().toUpperCase();
    var pw = $("rpw").value;
    $("gateErr").textContent = "";
    if (kod.length < 4) { $("gateErr").textContent = "Írd be az e-mailben kapott kódot."; return; }
    if (pw.length < 12) { $("gateErr").textContent = "Az új jelszó legalább 12 karakter legyen."; return; }
    b.disabled = true;
    api2({ kod: kod, jelszo: pw }).then(function () {
      setKey(pw);
      $("rkod").value = "";
      $("rpw").value = "";
      $("resetWrap").hidden = true;
      enter();
    }).catch(function (err) {
      $("gateErr").textContent = err.message || "Nem sikerült.";
    }).then(function () { b.disabled = false; });
  };
  $("logout").onclick = function () { setKey(null); showGate(""); };
  $("refresh").onclick = function () { load(); };

  /* --- fülek a szekciók között --- */
  var sec = "teendok";
  try { sec = localStorage.getItem("gta6hu_admin_sec") || "teendok"; } catch (e) { }
  function showSec(s) {
    sec = s;
    try { localStorage.setItem("gta6hu_admin_sec", s); } catch (e) { }
    document.querySelectorAll(".tabbar button[data-sec]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-sec") === s);
    });
    document.querySelectorAll("section[data-sec]").forEach(function (p) {
      p.hidden = p.getAttribute("data-sec") !== s;
    });
  }
  document.querySelector(".tabbar").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-sec]");
    if (b) showSec(b.getAttribute("data-sec"));
  });
  $("search").addEventListener("input", function () { filter = this.value.trim().toLowerCase(); renderFans(); });

  function placeName(id) {
    var p = D.BY_ID[id];
    return p ? p.label : id;
  }
  function when(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    return d.toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  var REASONS = {
    becenev: "sértő becenév", uzenet: "sértő üzenet",
    hamis: "hamis adat", spam: "spam", egyeb: "egyéb"
  };
  function reasonText(s) {
    return String(s || "").split(", ").map(function (r) { return REASONS[r] || r; }).join(" · ");
  }

  var allFans = [], allCrews = [], allReports = [], allProofs = [], allBanners = [];
  var allTips = [], allCh = [], allFb = [];

  function banner(msg) {
    $("banner").hidden = !msg;
    if (msg) $("banner").textContent = msg;
  }

  function load() {
    if (!key) { showGate(""); return; }
    Promise.all([api.adminReports(key), api.adminFans(key), api.adminCrews(key),
                 api.adminProofs(key), api.adminConfig(key), api.adminBanners(key),
                 api.adminTips(key), api.adminChallenges(key), api.adminFeedback(key)])
      .then(function (r) {
        allReports = r[0]; allFans = r[1]; allCrews = r[2]; allProofs = r[3];
        allBanners = r[5]; allTips = r[6]; allCh = r[7]; allFb = r[8];
        fillConfig(r[4]);
        banner(null);
        render();
        renderBanners();
        renderTips();
        renderCh();
        renderFb();
      })
      .catch(function (err) {
        var m = String(err && err.message || "");
        if (m.indexOf("NINCS_JOGOSULTSAG") >= 0) { setKey(null); showGate("Hibás jelszó."); return; }
        banner(C.humanError(err));
      });
  }

  function render() {
    var varakozoTipp = allTips.filter(function (t) { return t.status === "varakozik"; }).length;
    var reszek = [];
    if (allProofs.length) reszek.push(allProofs.length + " kép");
    if (varakozoTipp) reszek.push(varakozoTipp + " tipp");
    if (allFb.length) reszek.push(allFb.length + " visszajelzés");
    if (allReports.length) reszek.push(allReports.length + " jelentés");
    $("sum").textContent = reszek.length ? reszek.join(" · ") + " vár rád" : "nincs nyitott teendő";
    var teendo = allProofs.length + varakozoTipp + allFb.length + allReports.length;
    $("secCount").textContent = teendo ? "(" + teendo + ")" : "";

    /* hitelesítésre váró képek */
    $("proofCount").textContent = allProofs.length ? "(" + allProofs.length + ")" : "";
    $("proofEmpty").hidden = allProofs.length > 0;
    $("proofList").innerHTML = allProofs.map(function (p) {
      var kep = (typeof p.image === "string" && p.image.indexOf("data:image/") === 0)
        ? '<img class="shot" src="' + p.image + '" alt="Beküldött képernyőkép">'
        : '<div class="why">A kép nem olvasható.</div>';
      return "<li>" +
        '<span class="nm" style="white-space:normal">' + esc(p.nick) +
        "<em>" + esc(placeName(p.place_id)) + " · " + esc(C.platLabel(p.platform)) + " · " + esc(when(p.created_at)) + "</em>" +
        '<div class="why">' + nf(p.mostani) + " óra → <b>" + nf(p.kert) + " óra</b></div>" +
        (p.note ? '<div class="said">„' + esc(p.note) + "”</div>" : "") +
        kep +
        "</span>" +
        '<span class="acts">' +
        '<button class="btn sm ok" data-proofok="' + esc(p.id) + '" type="button">Elfogadom</button>' +
        '<button class="btn sm danger" data-proofno="' + esc(p.id) + '" type="button">Elutasítom</button>' +
        "</span></li>";
    }).join("");
    $("repCount").textContent = allReports.length ? "(" + allReports.length + ")" : "";
    $("fanCount").textContent = "(" + allFans.length + ")";
    $("crewCount").textContent = "(" + allCrews.length + ")";

    $("repEmpty").hidden = allReports.length > 0;
    $("repList").innerHTML = allReports.map(function (r) {
      return "<li>" +
        '<span class="nm" style="white-space:normal">' + esc(r.nick) +
        '<em>' + esc(placeName(r.place_id)) + " · " + nf(r.hours) + " óra · " + esc(C.platLabel(r.platform)) + "</em>" +
        '<div class="why">' + r.db + " jelentés · " + esc(reasonText(r.okok)) + " · " + esc(when(r.utolso)) + "</div>" +
        (r.note ? '<div class="said">„' + esc(r.note) + "”</div>" : "") +
        "</span>" +
        '<span class="acts">' +
        '<button class="btn sm" data-clear="' + esc(r.fan_id) + '" type="button">Rendben van</button>' +
        '<button class="btn sm danger" data-del="' + esc(r.fan_id) + '" type="button">Törlés</button>' +
        "</span></li>";
    }).join("");

    renderFans();

    $("crewList").innerHTML = allCrews.length ? allCrews.map(function (c) {
      return "<li>" +
        '<span class="nm"><span class="crewdot" style="background:' + esc(c.color) + '"></span>' + esc(c.name) +
        "<em>" + c.tagok + " tag · " + esc(when(c.created_at)) + "</em></span>" +
        '<span class="acts"><button class="btn sm danger" data-delcrew="' + esc(c.id) + '" type="button">Törlés</button></span>' +
        "</li>";
    }).join("") : '<li><span class="nm" style="font-weight:400;color:var(--muted)">Még nincs crew.</span></li>';
  }

  function renderFans() {
    var list = allFans.filter(function (f) {
      return !filter || f.nick.toLowerCase().indexOf(filter) >= 0;
    }).slice(0, 100);
    $("fanList").innerHTML = list.length ? list.map(function (f) {
      return "<li>" +
        '<span class="nm" style="white-space:normal">' + esc(f.nick) +
        "<em>" + esc(placeName(f.place_id)) + " · " + nf(f.hours) + " óra" +
        (f.crew ? " · " + esc(f.crew) : "") + " · " + esc(when(f.created_at)) + "</em>" +
        (f.note ? '<div class="said">„' + esc(f.note) + "”</div>" : "") +
        (f.db > 0 ? '<div class="why">' + f.db + " jelentés</div>" : "") +
        "</span>" +
        '<span class="acts"><button class="btn sm danger" data-del="' + esc(f.id) + '" type="button">Törlés</button></span>' +
        "</li>";
    }).join("") : '<li><span class="nm" style="font-weight:400;color:var(--muted)">Nincs találat.</span></li>';
  }

  /* --- visszajelzések (ötlet / hiba) --- */
  function renderFb() {
    $("fbCount").textContent = allFb.length ? "(" + allFb.length + ")" : "";
    $("fbEmpty").hidden = allFb.length > 0;
    $("fbList").innerHTML = allFb.map(function (f) {
      var cimke = f.tipus === "hiba" ? "HIBA" : "ÖTLET";
      var szin = f.tipus === "hiba" ? "#ff6b8a" : "#8af0c0";
      return "<li>" +
        '<span class="nm" style="white-space:normal">' +
        '<span class="rank" style="color:' + szin + '">' + cimke + "</span> " +
        esc(f.nick || "névtelen") + "<em>" + esc(when(f.created_at)) + "</em>" +
        '<div class="said" style="white-space:pre-wrap">' + esc(f.szoveg) + "</div></span>" +
        '<span class="acts"><button class="btn sm danger" data-fbdel="' + esc(f.id) + '" type="button">Törlés</button></span>' +
        "</li>";
    }).join("");
  }

  /* --- beküldött tippek --- */
  var ALLAPOT = { varakozik: "vár", elfogadva: "kirakva", elutasitva: "elutasítva" };
  function renderTips() {
    var varak = allTips.filter(function (t) { return t.status === "varakozik"; });
    $("tipCount").textContent = varak.length ? "(" + varak.length + ")" : "";
    $("tipEmpty").hidden = allTips.length > 0;
    $("tipList").innerHTML = allTips.map(function (t) {
      var acts;
      if (t.status === "varakozik") {
        acts = '<button class="btn sm ok" data-tipok="' + esc(t.id) + '" type="button">Kirakom</button>' +
               '<button class="btn sm danger" data-tipno="' + esc(t.id) + '" type="button">Elutasítom</button>';
      } else {
        acts = '<button class="btn sm danger" data-tipdel="' + esc(t.id) + '" type="button">Törlés</button>';
      }
      var allapot = ALLAPOT[t.status] || t.status;
      return "<li>" +
        '<span class="nm" style="white-space:normal">' + esc(t.nick) +
        "<em>" + esc(C.katLabel(t.kategoria)) + " · " + allapot +
        (t.status === "elfogadva" ? " · " + nf(t.szavazat) + " szavazat" : "") +
        " · " + esc(when(t.created_at)) + "</em>" +
        '<div class="said" style="white-space:pre-wrap">' + esc(t.szoveg) + "</div>" +
        "</span>" +
        '<span class="acts">' + acts + "</span></li>";
    }).join("");
  }

  /* --- heti kihívás --- */
  function renderCh() {
    $("chList").innerHTML = allCh.slice(0, 8).map(function (c) {
      return "<li>" +
        '<span class="nm" style="white-space:normal">' + esc(c.cim) +
        "<em>" + (c.aktiv ? "AKTÍV" : "lezárt") + " · " + nf(c.teljesitve) + " teljesítés · " + esc(when(c.created_at)) + "</em></span>" +
        '<span class="acts"><button class="btn sm danger" data-chdel="' + esc(c.id) + '" type="button">Törlés</button></span>' +
        "</li>";
    }).join("");
  }
  $("chSave").onclick = function () {
    if (!key) return;
    var b = this;
    var cim = $("chCimIn").value.trim();
    $("chErr").textContent = "";
    if (cim.length < 3) { $("chErr").textContent = "A cím legalább 3 karakter legyen."; return; }
    b.disabled = true;
    api.adminChallengeSave(key, { cim: cim, szoveg: $("chSzovegIn").value.trim(), aktiv: true })
      .then(function () {
        $("chCimIn").value = "";
        $("chSzovegIn").value = "";
        return load();
      })
      .catch(function (err) { $("chErr").textContent = C.humanError(err); })
      .then(function () { b.disabled = false; });
  };

  /* --- hirdetések --- */
  function fillConfig(c) {
    c = c || {};
    $("bnDonate").value = c.donate_url || "";
    $("bnDelay").value = c.banner_delay_ms || 4000;
    $("bnCode").textContent = '<script src="' + location.origin + '/assets/banner.js" data-width="300" async><\/script>';
  }

  var szerkesztett = null;

  function ctr(b) {
    var m = Number(b.megjelenes || 0), k = Number(b.kattintas || 0);
    return m ? ((k / m) * 100).toFixed(1) + "%" : "—";
  }

  function renderBanners() {
    $("bnCount").textContent = allBanners.length ? "(" + allBanners.length + ")" : "";
    $("bnEmpty").hidden = allBanners.length > 0;
    $("bnList").innerHTML = allBanners.map(function (b) {
      return "<li>" +
        '<span class="nm" style="white-space:normal">' + esc(b.nev) +
        "<em>" + (b.aktiv ? "aktív" : "szünetel") + " · sorrend " + b.sorrend + "</em>" +
        '<div class="why">' + nf(b.megjelenes) + " megjelenés · " + nf(b.kattintas) + " kattintás · CTR " + ctr(b) + "</div>" +
        '<img class="shot" src="' + esc(b.image) + '" alt="" style="width:200px">' +
        "</span>" +
        '<span class="acts">' +
        '<button class="btn sm" data-bnedit="' + esc(b.id) + '" type="button">Szerkeszt</button>' +
        '<button class="btn sm ghost" data-bnreset="' + esc(b.id) + '" type="button">Számláló null</button>' +
        '<button class="btn sm danger" data-bndel="' + esc(b.id) + '" type="button">Törlés</button>' +
        "</span></li>";
    }).join("");
  }

  function openBanner(b) {
    szerkesztett = b ? b.id : null;
    $("bnErr").textContent = "";
    $("bnNev").value = b ? b.nev : "";
    $("bnImage").value = b ? b.image : "";
    $("bnLink").value = (b && b.link) || "";
    $("bnAlt").value = (b && b.alt) || "";
    $("bnSorrend").value = b ? b.sorrend : 0;
    $("bnAktiv").value = (!b || b.aktiv) ? "1" : "0";
    bnPreview();
    $("bnForm").hidden = false;
    $("bnNev").focus();
  }
  function bnPreview() {
    var v = $("bnImage").value.trim();
    if (v.indexOf("https://") === 0) { $("bnPrev").src = v; $("bnPrev").hidden = false; }
    else { $("bnPrev").hidden = true; }
  }
  $("bnImage").addEventListener("input", bnPreview);
  $("bnNew").onclick = function () { openBanner(null); };
  $("bnCancel").onclick = function () { $("bnForm").hidden = true; szerkesztett = null; };

  $("bnSave").onclick = function () {
    if (!key) return;
    var btn = this;
    $("bnErr").textContent = "";
    var rec = {
      id: szerkesztett,
      nev: $("bnNev").value.trim(),
      image: $("bnImage").value.trim(),
      link: $("bnLink").value.trim(),
      alt: $("bnAlt").value.trim(),
      aktiv: $("bnAktiv").value === "1",
      sorrend: Math.round(+$("bnSorrend").value) || 0
    };
    if (rec.nev.length < 1) { $("bnErr").textContent = "Adj nevet a hirdetésnek."; return; }
    if (rec.image.indexOf("https://") !== 0) { $("bnErr").textContent = "A kép címének https://-sel kell kezdődnie."; return; }
    btn.disabled = true;
    api.adminBannerSave(key, rec).then(function () {
      $("bnForm").hidden = true;
      szerkesztett = null;
      return load();
    }).catch(function (err) {
      $("bnErr").textContent = C.humanError(err);
    }).then(function () { btn.disabled = false; });
  };

  $("cbSave").onclick = function () {
    if (!key) return;
    var b = this;
    $("cbErr").textContent = "";
    b.disabled = true;
    b.textContent = "Mentés…";
    Promise.all([
      api.adminDelaySet(key, Math.round(+$("bnDelay").value) || 4000),
      api.adminConfigSet(key, { banner_on: false, donate_url: $("bnDonate").value.trim() })
    ]).then(function () {
      b.textContent = "Mentve";
      setTimeout(function () { b.textContent = "Beállítások mentése"; }, 2000);
    }).catch(function (err) {
      $("cbErr").textContent = C.humanError(err);
      b.textContent = "Beállítások mentése";
    }).then(function () { b.disabled = false; });
  };

  /* kétlépcsős megerősítés minden törlésnél */
  function arm(btn, run) {
    if (btn.getAttribute("data-armed") === "1") { run(); return; }
    var old = btn.textContent;
    btn.setAttribute("data-armed", "1");
    btn.textContent = "Biztos? Kattints újra";
    setTimeout(function () {
      if (btn.isConnected) { btn.setAttribute("data-armed", "0"); btn.textContent = old; }
    }, 4000);
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-del],button[data-delcrew],button[data-clear],button[data-proofok],button[data-proofno],button[data-bnedit],button[data-bnreset],button[data-bndel],button[data-tipok],button[data-tipno],button[data-tipdel],button[data-chdel],button[data-fbdel]");
    if (!b || !key) return;
    var id;
    if ((id = b.getAttribute("data-fbdel"))) {
      arm(b, function () {
        api.adminFeedbackDelete(key, id).then(load).catch(function (err) { banner(C.humanError(err)); });
      });
      return;
    }
    if ((id = b.getAttribute("data-tipok"))) {
      b.disabled = true;
      api.adminTipDecide(key, id, true).then(load).catch(function (err) { b.disabled = false; banner(C.humanError(err)); });
      return;
    }
    if ((id = b.getAttribute("data-tipno"))) {
      b.disabled = true;
      api.adminTipDecide(key, id, false).then(load).catch(function (err) { b.disabled = false; banner(C.humanError(err)); });
      return;
    }
    if ((id = b.getAttribute("data-tipdel"))) {
      arm(b, function () {
        api.adminTipDelete(key, id).then(load).catch(function (err) { banner(C.humanError(err)); });
      });
      return;
    }
    if ((id = b.getAttribute("data-chdel"))) {
      arm(b, function () {
        api.adminChallengeDelete(key, id).then(load).catch(function (err) { banner(C.humanError(err)); });
      });
      return;
    }
    if ((id = b.getAttribute("data-bnedit"))) {
      var rec = allBanners.filter(function (x) { return x.id === id; })[0];
      if (rec) openBanner(rec);
      return;
    }
    if ((id = b.getAttribute("data-bnreset"))) {
      api.adminBannerReset(key, id).then(load).catch(function (err) { banner(C.humanError(err)); });
      return;
    }
    if ((id = b.getAttribute("data-bndel"))) {
      arm(b, function () {
        api.adminBannerDelete(key, id).then(load).catch(function (err) { banner(C.humanError(err)); });
      });
      return;
    }
    if ((id = b.getAttribute("data-proofok"))) {
      b.disabled = true;
      api.adminProofDecide(key, id, true).then(load).catch(function (err) { b.disabled = false; banner(C.humanError(err)); });
      return;
    }
    if ((id = b.getAttribute("data-proofno"))) {
      b.disabled = true;
      api.adminProofDecide(key, id, false).then(load).catch(function (err) { b.disabled = false; banner(C.humanError(err)); });
      return;
    }
    if ((id = b.getAttribute("data-clear"))) {
      api.adminClearReports(key, id).then(load).catch(function (err) { banner(C.humanError(err)); });
      return;
    }
    if ((id = b.getAttribute("data-del"))) {
      arm(b, function () {
        api.adminDeleteFan(key, id).then(load).catch(function (err) { banner(C.humanError(err)); });
      });
      return;
    }
    if ((id = b.getAttribute("data-delcrew"))) {
      arm(b, function () {
        api.adminDeleteCrew(key, id).then(load).catch(function (err) { banner(C.humanError(err)); });
      });
    }
  });

  /* indulás */
  if (!api.ready) {
    $("gate").hidden = false;
    $("gateErr").textContent = "Nincs kapcsolat az adatbázissal.";
  } else {
    key = getKey();
    if (key) {
      api.adminOk(key).then(enter).catch(function () { setKey(null); showGate(""); });
    } else {
      showGate("");
    }
  }
})(window);
