/* Tippek oldal: lista kategóriánként, szavazás, beküldés. */
(function (w) {
  "use strict";
  var C = w.GTACore, api = C.api;
  var $ = function (id) { return document.getElementById(id); };
  var esc = C.esc, nf = C.nf;

  /* kategória a ?kat= paraméterből, hogy minden kategória külön, megosztható URL legyen */
  var ervenyesKat = C.KATEGORIAK.map(function (k) { return k[0]; });
  var kat = (function () {
    try {
      var p = new URLSearchParams(location.search).get("kat");
      return (p && ervenyesKat.indexOf(p) >= 0) ? p : "";
    } catch (e) { return ""; }
  })();
  var tips = [];
  var kereses = "";

  /* a böngésző címét és a főcímet a kategóriához igazítjuk (SEO + megoszthatóság) */
  function cimFrissit() {
    var nev = C.katLabel(kat);
    if (kat) {
      document.title = "GTA VI tippek – " + nev + " | Magyar térkép";
      $("tipTitle").textContent = nev + " — GTA VI tippek";
      $("tipLede").innerHTML = "A magyar közösség <strong>" + esc(nev.toLowerCase()) +
        "</strong> tippjei. Szavazz arra, ami bevált, vagy küldd be a sajátodat.";
    } else {
      document.title = "Tippek — GTA VI Magyar Térkép";
      $("tipTitle").textContent = "Tippek a játékosoktól";
      $("tipLede").innerHTML = "Amit a magyar közösség összeszedett — <strong>nem a kiadó, nem egy szerkesztőség</strong>, hanem azok, akik tolják. Szavazz arra, ami bevált, és küldd be a sajátodat.";
    }
    try {
      var u = kat ? (location.pathname + "?kat=" + kat) : location.pathname;
      history.replaceState(null, "", u);
    } catch (e) { }
  }

  /* amire már szavaztam ebből a böngészőből */
  var szavazott = (function () {
    try { return JSON.parse(localStorage.getItem("gta6hu_votes") || "{}"); } catch (e) { return {}; }
  })();
  function jegyez(id) {
    szavazott[id] = 1;
    try { localStorage.setItem("gta6hu_votes", JSON.stringify(szavazott)); } catch (e) { }
  }

  function banner(msg) {
    $("banner").hidden = !msg;
    if (msg) $("banner").textContent = msg;
  }

  /* kategória-csempék */
  function renderChips() {
    var all = [["", "Mind"]].concat(C.KATEGORIAK);
    $("chips").innerHTML = all.map(function (k) {
      return '<button class="btn sm' + (k[0] === kat ? " on" : "") + '" data-kat="' + esc(k[0]) + '" type="button">' +
        esc(k[1]) + "</button>";
    }).join("");
  }
  $("chips").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-kat]");
    if (!b) return;
    kat = b.getAttribute("data-kat");
    renderChips();
    cimFrissit();
    load();
  });

  /* keresés a betöltött tippek közt */
  $("tipSearch").addEventListener("input", function () {
    kereses = this.value.trim().toLowerCase();
    render();
  });
  function szurt() {
    if (!kereses) return tips;
    return tips.filter(function (t) {
      return (t.szoveg + " " + t.nick + " " + C.katLabel(t.kategoria)).toLowerCase().indexOf(kereses) >= 0;
    });
  }

  function datum(s) {
    try { return new Date(s).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }); }
    catch (e) { return ""; }
  }

  var THUMB = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
    '<path fill="currentColor" d="M2 9.6h3.2V21H2zM22 11c0-1.1-.9-2-2-2h-5.4l.8-3.9v-.2c0-.4-.2-.8-.5-1.1l-.9-.9-5.3 5.3c-.4.4-.6.9-.6 1.4v8c0 1.1.9 2 2 2h7.3c.8 0 1.5-.5 1.8-1.2l2.4-5.7c.1-.2.1-.4.1-.6z"/></svg>';
  function render() {
    var lista = szurt();
    $("empty").hidden = lista.length > 0;
    $("list").innerHTML = lista.map(function (t) {
      var volt = !!szavazott[t.id];
      return '<article class="tipcard">' +
        '<div class="vote">' +
        '<button class="vbtn' + (volt ? " done" : "") + '" data-vote="' + esc(t.id) + '" type="button" ' +
        'aria-label="Hasznos tipp" title="Ez bevált nekem">' + THUMB + "</button>" +
        '<span class="vnum" id="v-' + esc(t.id) + '">' + nf(t.szavazat) + "</span>" +
        "</div>" +
        '<div><div class="txt">' + esc(t.szoveg) + "</div>" +
        '<div class="meta"><span class="kat">' + esc(C.katLabel(t.kategoria)) + "</span> · " +
        esc(t.nick) + " · " + esc(datum(t.created_at)) + "</div></div>" +
        "</article>";
    }).join("");
  }

  $("list").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-vote]");
    if (!b || b.classList.contains("done")) return;
    var id = b.getAttribute("data-vote");
    b.disabled = true;
    /* mindig a szerver dönt: ő enged hálózatonként egy szavazatot */
    api.tipVote(id).then(function (uj) {
      jegyez(id);
      b.classList.add("done");
      b.title = uj ? "Köszönjük a szavazatod!" : "Erről a hálózatról már szavaztak erre";
      if (uj) {
        var el = $("v-" + id);
        if (el) el.textContent = nf((Number(el.textContent.replace(/\s/g, "")) || 0) + 1);
      }
    }).catch(function (err) {
      banner(C.humanError(err));
      b.disabled = false;
    });
  });

  function load() {
    if (!api.ready) { banner("Az adatbázis nem érhető el, ezért a tippek nem látszanak."); return; }
    api.tips(kat).then(function (rows) {
      tips = rows;
      banner(null);
      render();
    }).catch(function (err) { banner(C.humanError(err)); });
  }

  /* --- beküldés --- */
  $("tKat").innerHTML = C.KATEGORIAK.map(function (k) {
    return '<option value="' + esc(k[0]) + '">' + esc(k[1]) + "</option>";
  }).join("");

  $("tSzoveg").addEventListener("input", function () {
    $("tCount").textContent = this.value.length;
  });

  $("tSend").onclick = function () {
    var b = this;
    var szoveg = $("tSzoveg").value.trim();
    var nick = $("tNick").value.trim();
    $("tErr").textContent = "";
    if (szoveg.length < 10) { $("tErr").textContent = "A tipp legalább 10 karakter legyen."; return; }
    b.disabled = true;
    b.textContent = "Küldés…";
    api.tipSubmit(nick, $("tKat").value, szoveg).then(function () {
      $("tSzoveg").value = "";
      $("tCount").textContent = "0";
      $("tErr").textContent = "";
      $("tMine").innerHTML = '<p class="note" style="color:#8af0c0">Köszönjük! A tipped átnézésre vár, utána megjelenik a listában.</p>';
      api.notify();
      return sajatok();
    }).catch(function (err) {
      $("tErr").textContent = C.humanError(err);
    }).then(function () {
      b.disabled = false;
      b.textContent = "Beküldöm";
    });
  };

  var ALLAPOT = { varakozik: "elbírálásra vár", elfogadva: "kikerült", elutasitva: "elutasítva" };
  function sajatok() {
    if (!api.ready) return Promise.resolve();
    return api.tipsMine().then(function (rows) {
      if (!rows.length) return;
      $("tMine").innerHTML = '<p class="hint" style="margin-top:4px"><b style="color:var(--fg)">A beküldéseid:</b><br>' +
        rows.map(function (t) {
          return esc(C.katLabel(t.kategoria)) + " — " + esc(ALLAPOT[t.status] || t.status);
        }).join("<br>") + "</p>";
    }).catch(function () { });
  }

  /* ha már be van jelölve a térképen, a nevet onnan vesszük */
  if (api.ready) {
    api.mine().then(function (f) {
      if (f && f.nick) {
        $("tNick").value = f.nick;
        $("tNick").readOnly = true;
        $("nickWrap").querySelector(".hint").textContent = "A térképen használt becenevedet vesszük.";
      }
    }).catch(function () { });
  }

  renderChips();
  cimFrissit();
  load();
  sajatok();
})(window);
