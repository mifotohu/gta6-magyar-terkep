/* Statisztika-aloldal: napi összóra, hőtérkép, megye-verseny, platform- és rangmegoszlás. */
(function (w) {
  "use strict";
  var D = w.GTAData, C = w.GTACore, api = C.api;
  var $ = function (id) { return document.getElementById(id); };
  var esc = C.esc, nf = C.nf;
  var fans = [], weekly = {};

  var map = w.GTAMap.create({ svg: $("map"), interactive: false });
  map.setMode("heat");

  (function () {
    var d = C.days(D.RELEASE);
    $("dayChip").textContent = d > 0 ? (d + ". nap a megjelenés óta") : "Hamarosan";
  })();

  /* ---- kis diagramkönyvtár ---- */
  function areaChart(host, rows) {
    var W = 560, H = 230, P = { l: 48, r: 12, t: 14, b: 30 };
    if (!rows.length) {
      host.innerHTML = '<p class="note">Még nincs adat — az első bejelölés után itt indul a görbe.</p>';
      return;
    }
    var max = 0;
    rows.forEach(function (r) { if (+r.total_hours > max) max = +r.total_hours; });
    max = Math.max(max, 1);
    var iw = W - P.l - P.r, ih = H - P.t - P.b;
    var step = rows.length > 1 ? iw / (rows.length - 1) : 0;
    function X(i) { return P.l + i * step; }
    function Y(v) { return P.t + ih - (v / max) * ih; }

    var line = rows.map(function (r, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(+r.total_hours).toFixed(1); }).join("");
    var area = line + "L" + X(rows.length - 1).toFixed(1) + " " + (P.t + ih) + "L" + P.l + " " + (P.t + ih) + "Z";

    var grid = "", labels = "";
    for (var k = 0; k <= 3; k++) {
      var v = max * k / 3, y = Y(v);
      grid += '<line class="gl" x1="' + P.l + '" y1="' + y.toFixed(1) + '" x2="' + (W - P.r) + '" y2="' + y.toFixed(1) + '"/>';
      labels += '<text x="' + (P.l - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + nf(v) + "</text>";
    }
    var first = rows[0].day, last = rows[rows.length - 1].day;
    labels += '<text x="' + P.l + '" y="' + (H - 8) + '">' + esc(first) + "</text>";
    if (rows.length > 1) labels += '<text x="' + (W - P.r) + '" y="' + (H - 8) + '" text-anchor="end">' + esc(last) + "</text>";

    host.innerHTML = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet">' +
      '<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="rgba(255,45,149,.55)"/><stop offset="100%" stop-color="rgba(255,45,149,0)"/>' +
      "</linearGradient></defs>" + grid +
      '<path d="' + area + '" fill="url(#ag)"/>' +
      '<path d="' + line + '" fill="none" stroke="#ff9c2b" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<circle cx="' + X(rows.length - 1).toFixed(1) + '" cy="' + Y(+rows[rows.length - 1].total_hours).toFixed(1) + '" r="4.5" fill="#ffd66e"/>' +
      '<line class="ax" x1="' + P.l + '" y1="' + (P.t + ih) + '" x2="' + (W - P.r) + '" y2="' + (P.t + ih) + '"/>' +
      labels + "</svg>";
  }

  function barChart(host, rows) {
    if (!rows.length) { host.innerHTML = '<p class="note">Még nincs adat.</p>'; return; }
    var max = 0;
    rows.forEach(function (r) { if (r.v > max) max = r.v; });
    max = Math.max(max, 1);
    host.innerHTML = rows.map(function (r) {
      return '<div style="margin-bottom:9px">' +
        '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">' +
        "<span>" + esc(r.k) + '</span><span style="font-family:var(--mono);color:var(--muted)">' + nf(r.v) + "</span></div>" +
        '<div style="height:9px;border-radius:5px;background:rgba(255,255,255,.07);overflow:hidden">' +
        '<div style="height:100%;width:' + ((r.v / max) * 100).toFixed(1) + '%;background:' + (r.c || "linear-gradient(90deg,#ff2d95,#ff9c2b)") + '"></div>' +
        "</div></div>";
    }).join("");
  }

  /* ---- megjelenítés ---- */
  function render() {
    var h = 0, wk = 0;
    fans.forEach(function (f) { h += f.hours; wk += (weekly[f.id] || 0); });
    $("sFans").textContent = nf(fans.length);
    $("sHours").textContent = nf(h);
    $("sWeek").textContent = "+" + nf(wk);
    $("sAvg").innerHTML = nf(fans.length ? h / fans.length : 0) + ' <small>óra</small>';

    map.setFans(fans, null);

    /* megye-verseny */
    var cs = map.countyStats();
    var rows = D.COUNTY_NAMES.map(function (n) { return cs[n]; })
      .sort(function (a, b) { return b.per10k - a.per10k || b.fans - a.fans; });
    $("countyList").innerHTML = rows.map(function (r, i) {
      return "<li><span class=\"rk\">" + (i + 1) + "</span>" +
        '<span class="nm">' + esc(r.name) + "<em>" + r.fans + " rajongó · " + nf(r.hours) + " óra</em></span>" +
        '<span class="vl">' + r.per10k.toFixed(2) + "<em>/ 10 000 fő</em></span></li>";
    }).join("");

    /* platformok */
    var plat = {};
    fans.forEach(function (f) { var k = C.platLabel(f.platform); plat[k] = (plat[k] || 0) + 1; });
    barChart($("platChart"), Object.keys(plat).map(function (k) { return { k: k, v: plat[k] }; })
      .sort(function (a, b) { return b.v - a.v; }));

    /* rangok */
    var rank = {};
    fans.forEach(function (f) { var r = D.rankOf(f.hours); rank[r.name] = rank[r.name] || { v: 0, c: r.color }; rank[r.name].v++; });
    barChart($("rankChart"), D.RANKS.filter(function (r) { return rank[r.name]; }).map(function (r) {
      return { k: r.name, v: rank[r.name].v, c: r.color };
    }));

    /* a hét hajtósai */
    var top = fans.slice().filter(function (f) { return weekly[f.id]; })
      .sort(function (a, b) { return (weekly[b.id] || 0) - (weekly[a.id] || 0); }).slice(0, 10);
    $("weekList").innerHTML = top.length ? top.map(function (f, i) {
      var pl = D.BY_ID[f.place_id];
      return "<li><span class=\"rk\">" + (i + 1) + "</span>" +
        '<span class="nm">' + esc(f.nick) + "<em>" + (pl ? esc(pl.short) : "") + "</em></span>" +
        '<span class="vl">+' + nf(weekly[f.id]) + " ó</span></li>";
    }).join("") : '<li style="grid-template-columns:1fr"><span class="nm" style="font-weight:400;color:var(--muted)">Még nincs heti mozgás.</span></li>';
  }

  function load() {
    if (!api.ready) {
      $("banner").hidden = false;
      $("banner").textContent = "Az adatbázis nem érhető el, ezért a statisztikák üresek.";
      render();
      return;
    }
    Promise.all([api.fans(), api.weekly(), api.daily()]).then(function (r) {
      fans = r[0];
      weekly = {};
      r[1].forEach(function (x) { weekly[x.fan_id] = x.delta; });
      $("banner").hidden = true;
      areaChart($("dailyChart"), r[2] || []);
      $("dailyNote").textContent = (r[2] && r[2].length) ? (r[2].length + " nap adata") : "a megjelenés óta";
      render();
    }).catch(function (err) {
      $("banner").hidden = false;
      $("banner").textContent = C.humanError(err);
      render();
    });
  }
  load();
  setInterval(function () { if (!document.hidden) load(); }, 60000);
})(window);
