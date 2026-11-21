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
  $("logout").onclick = function () { setKey(null); showGate(""); };
  $("refresh").onclick = function () { load(); };
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

  var allFans = [], allCrews = [], allReports = [], allProofs = [];

  function banner(msg) {
    $("banner").hidden = !msg;
    if (msg) $("banner").textContent = msg;
  }

  function load() {
    if (!key) { showGate(""); return; }
    Promise.all([api.adminReports(key), api.adminFans(key), api.adminCrews(key),
                 api.adminProofs(key), api.adminConfig(key)])
      .then(function (r) {
        allReports = r[0]; allFans = r[1]; allCrews = r[2]; allProofs = r[3];
        fillConfig(r[4]);
        banner(null);
        render();
      })
      .catch(function (err) {
        var m = String(err && err.message || "");
        if (m.indexOf("NINCS_JOGOSULTSAG") >= 0) { setKey(null); showGate("Hibás jelszó."); return; }
        banner(C.humanError(err));
      });
  }

  function render() {
    var tenni = allReports.length + allProofs.length;
    $("sum").textContent = tenni
      ? (allProofs.length ? allProofs.length + " kép vár, " : "") +
        allReports.length + " jelentett bejegyzés"
      : "nincs nyitott teendő";

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

  /* --- hirdetőhely és támogatás --- */
  function fillConfig(c) {
    c = c || {};
    $("cbOn").checked = !!c.banner_on;
    $("cbImage").value = c.banner_image || "";
    $("cbLink").value = c.banner_link || "";
    $("cbAlt").value = c.banner_alt || "";
    $("cbDonate").value = c.donate_url || "";
    showCode();
  }
  function showCode() {
    var img = $("cbImage").value.trim();
    var link = $("cbLink").value.trim();
    var alt = $("cbAlt").value.trim() || "Hirdetés";
    if (!img) { $("cbCodeWrap").hidden = true; return; }
    var tag = '<img src="' + img + '" alt="' + alt + '" style="max-width:100%;height:auto">';
    $("cbCode").textContent = link
      ? '<a href="' + link + '" target="_blank" rel="noopener nofollow sponsored">' + tag + "</a>"
      : tag;
    $("cbCodeWrap").hidden = false;
  }
  ["cbImage", "cbLink", "cbAlt"].forEach(function (id) {
    $(id).addEventListener("input", showCode);
  });
  $("cbSave").onclick = function () {
    if (!key) return;
    var b = this;
    $("cbErr").textContent = "";
    b.disabled = true;
    b.textContent = "Mentés…";
    api.adminConfigSet(key, {
      banner_on: $("cbOn").checked,
      banner_image: $("cbImage").value.trim(),
      banner_link: $("cbLink").value.trim(),
      banner_alt: $("cbAlt").value.trim(),
      donate_url: $("cbDonate").value.trim()
    }).then(function () {
      b.textContent = "Mentve";
      setTimeout(function () { b.textContent = "Mentés"; }, 2000);
    }).catch(function (err) {
      $("cbErr").textContent = C.humanError(err);
      b.textContent = "Mentés";
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
    var b = e.target.closest("button[data-del],button[data-delcrew],button[data-clear],button[data-proofok],button[data-proofno]");
    if (!b || !key) return;
    var id;
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
