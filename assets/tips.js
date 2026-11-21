/* Tippek oldal: lista kategóriánként, szavazás, beküldés. */
(function (w) {
  "use strict";
  var C = w.GTACore, api = C.api;
  var $ = function (id) { return document.getElementById(id); };
  var esc = C.esc, nf = C.nf;

  var kat = "";
  var tips = [];

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
    load();
  });

  function datum(s) {
    try { return new Date(s).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }); }
    catch (e) { return ""; }
  }

  function render() {
    $("empty").hidden = tips.length > 0;
    $("list").innerHTML = tips.map(function (t) {
      var volt = !!szavazott[t.id];
      return '<article class="tip">' +
        '<div class="vote">' +
        '<button class="vbtn' + (volt ? " done" : "") + '" data-vote="' + esc(t.id) + '" type="button" ' +
        'title="' + (volt ? "Már szavaztál erre" : "Ez bevált nekem") + '">▲</button>' +
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
    if (!b) return;
    var id = b.getAttribute("data-vote");
    if (szavazott[id]) return;
    b.disabled = true;
    api.tipVote(id).then(function (uj) {
      jegyez(id);
      b.classList.add("done");
      b.title = "Már szavaztál erre";
      if (uj) {
        var el = $("v-" + id);
        if (el) el.textContent = nf((Number(el.textContent.replace(/\s/g, "")) || 0) + 1);
      }
    }).catch(function (err) {
      banner(C.humanError(err));
    }).then(function () { b.disabled = false; });
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
  load();
  sajatok();
})(window);
