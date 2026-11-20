/* Térképkomponens: megyék, budapesti kerületek, pontok, hőtérkép, zoom és húzás.
   A főoldal és a beágyazható widget is ezt használja. */
(function (w) {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var Data = w.GTAData;

  var HU = { x: 8, y: 18, w: 1000, h: 618 };
  var BP = { x: 398, y: 221, w: 110, h: 68 };

  function create(opts) {
    var svg = opts.svg;
    var interactive = opts.interactive !== false;
    var gC, gD, gL, gP;
    var vb = { x: HU.x, y: HU.y, w: HU.w, h: HU.h };
    var fans = [], online = {}, mode = "pins", sel = null, myId = null;
    var countyCache = {};

    svg.innerHTML =
      '<defs>' +
      '<radialGradient id="pinGrad" cx="35%" cy="30%">' +
      '<stop offset="0%" stop-color="#ffd66e"/><stop offset="45%" stop-color="#ff9c2b"/><stop offset="100%" stop-color="#ff2d95"/>' +
      '</radialGradient>' +
      '<radialGradient id="mineGrad" cx="35%" cy="30%">' +
      '<stop offset="0%" stop-color="#d7fffe"/><stop offset="45%" stop-color="#2de2e6"/><stop offset="100%" stop-color="#1b7fd1"/>' +
      '</radialGradient>' +
      '</defs>' +
      '<g class="g-counties"></g><g class="g-districts"></g><g class="g-labels"></g><g class="g-pins"></g>';
    gC = svg.querySelector(".g-counties");
    gD = svg.querySelector(".g-districts");
    gL = svg.querySelector(".g-labels");
    gP = svg.querySelector(".g-pins");

    /* --- megyék --- */
    (w.COUNTY_PATHS || []).forEach(function (d, i) {
      var el = document.createElementNS(NS, "path");
      el.setAttribute("d", d);
      el.setAttribute("class", "county");
      el.setAttribute("data-county", Data.COUNTY_NAMES[i] || "");
      gC.appendChild(el);
    });
    /* --- kerületek --- */
    (w.BP_DISTRICTS || []).forEach(function (o) {
      var el = document.createElementNS(NS, "path");
      el.setAttribute("d", o.d);
      el.setAttribute("class", "district");
      el.setAttribute("data-id", "bp" + o.r);
      gD.appendChild(el);
    });
    /* --- kerületcímkék --- */
    Data.DISTRICTS.forEach(function (r) {
      var t = document.createElementNS(NS, "text");
      t.setAttribute("x", Data.px(r[2]).toFixed(1));
      t.setAttribute("data-by", Data.py(r[1]).toFixed(1));
      t.setAttribute("class", "dlabel");
      t.textContent = r[0].split(" ")[0];
      gL.appendChild(t);
    });

    /* --- melyik megyében van egy pont --- */
    function countyOf(placeId) {
      if (countyCache[placeId]) return countyCache[placeId];
      var p = Data.BY_ID[placeId];
      if (!p) return null;
      if (p.county) { countyCache[placeId] = p.county; return p.county; }
      var paths = gC.querySelectorAll(".county"), i, el, hit = null;
      try {
        var pt = svg.createSVGPoint ? svg.createSVGPoint() : null;
        for (i = 0; i < paths.length; i++) {
          el = paths[i];
          var ok;
          if (pt) { pt.x = p.x; pt.y = p.y; ok = el.isPointInFill(pt); }
          else { ok = el.isPointInFill(new DOMPoint(p.x, p.y)); }
          if (ok) { hit = el.getAttribute("data-county"); break; }
        }
      } catch (e) { hit = null; }
      if (!hit) { /* tartalék: legközelebbi megyeközép */
        var best = 1e9;
        for (i = 0; i < paths.length; i++) {
          try {
            var b = paths[i].getBBox();
            var dx = (b.x + b.width / 2) - p.x, dy = (b.y + b.height / 2) - p.y;
            var d2 = dx * dx + dy * dy;
            if (d2 < best) { best = d2; hit = paths[i].getAttribute("data-county"); }
          } catch (e2) { }
        }
      }
      if (hit === "Budapest" && p.kind !== "ker") hit = "Pest";
      countyCache[placeId] = hit;
      return hit;
    }

    /* --- csoportosítás --- */
    function groups() {
      var m = {};
      fans.forEach(function (f) {
        var pl = Data.BY_ID[f.place_id];
        if (!pl) return;
        var g = m[f.place_id] || (m[f.place_id] = { place: pl, fans: [], hours: 0 });
        g.fans.push(f);
        g.hours += f.hours;
      });
      return Object.keys(m).map(function (k) { return m[k]; });
    }

    function countyStats() {
      var m = {};
      Data.COUNTY_NAMES.forEach(function (n) { m[n] = { name: n, fans: 0, hours: 0, pop: Data.COUNTY_POP[n] || 0 }; });
      fans.forEach(function (f) {
        var c = countyOf(f.place_id);
        if (!c || !m[c]) return;
        m[c].fans++;
        m[c].hours += f.hours;
      });
      Data.COUNTY_NAMES.forEach(function (n) {
        m[n].per10k = m[n].pop ? (m[n].fans / m[n].pop) * 10000 : 0;
      });
      return m;
    }

    function districtStats() {
      var m = {};
      Data.DISTRICTS.forEach(function (r, i) {
        m["bp" + (i + 1)] = { fans: 0, hours: 0, pop: r[3], per10k: 0 };
      });
      fans.forEach(function (f) {
        if (!m[f.place_id]) return;
        m[f.place_id].fans++;
        m[f.place_id].hours += f.hours;
      });
      Object.keys(m).forEach(function (k) {
        m[k].per10k = m[k].pop ? (m[k].fans / m[k].pop) * 10000 : 0;
      });
      return m;
    }

    function heatColor(t) { /* t: 0..1 */
      if (t <= 0) return "";
      var a = 0.08 + 0.62 * Math.pow(t, 0.65);
      var r = Math.round(255), g = Math.round(45 + 110 * (1 - t)), b = Math.round(149 - 110 * t);
      return "rgba(" + r + "," + g + "," + Math.max(0, b) + "," + a.toFixed(3) + ")";
    }

    /* --- rajzolás --- */
    function sizePins() {
      var s = vb.w / HU.w;
      gL.querySelectorAll(".dlabel").forEach(function (t) {
        t.setAttribute("font-size", (10 * s).toFixed(2));
        t.setAttribute("y", (+t.getAttribute("data-by") - 12 * s).toFixed(2));
      });
      gP.querySelectorAll(".pin").forEach(function (g) {
        var n = +g.getAttribute("data-n");
        var r = (5 + Math.min(11, 2.7 * Math.sqrt(n))) * s;
        g.querySelector(".dot").setAttribute("r", r.toFixed(2));
        g.querySelector(".halo").setAttribute("r", (r * 2.1).toFixed(2));
        var t = g.querySelector(".cnt");
        if (t) {
          t.setAttribute("font-size", (r * 1.15).toFixed(2));
          t.setAttribute("y", (r * 0.42).toFixed(2));
          t.style.display = (n > 1 && r > 5) ? "" : "none";
        }
      });
    }

    function paint() {
      /* megyék / kerületek színezése */
      var cs = countyStats(), ds = districtStats();
      var maxC = 0, maxD = 0;
      Data.COUNTY_NAMES.forEach(function (n) { if (cs[n].per10k > maxC) maxC = cs[n].per10k; });
      Object.keys(ds).forEach(function (k) { if (ds[k].per10k > maxD) maxD = ds[k].per10k; });

      gC.querySelectorAll(".county").forEach(function (el) {
        var n = el.getAttribute("data-county");
        if (mode === "heat" && maxC > 0) {
          el.style.fill = heatColor(cs[n].per10k / maxC);
          el.classList.add("heat");
        } else {
          el.style.fill = "";
          el.classList.remove("heat");
        }
        el.classList.toggle("hl", n === "Budapest" && mode !== "heat");
      });

      gD.querySelectorAll(".district").forEach(function (el) {
        var id = el.getAttribute("data-id"), st = ds[id];
        if (mode === "heat" && maxD > 0) {
          el.style.setProperty("--f", heatColor(st.per10k / maxD));
        } else if (st && st.fans) {
          var m2 = 1;
          Object.keys(ds).forEach(function (k) { if (ds[k].fans > m2) m2 = ds[k].fans; });
          el.style.setProperty("--f", "rgba(255,45,149," + (0.1 + 0.45 * (st.fans / m2)).toFixed(3) + ")");
        } else {
          el.style.removeProperty("--f");
        }
        el.classList.toggle("sel", sel === id);
      });

      /* pontok */
      gP.textContent = "";
      if (mode === "pins") {
        groups().sort(function (a, b) { return a.fans.length - b.fans.length; }).forEach(function (g) {
          var mine = myId && g.fans.some(function (f) { return f.id === myId; });
          var live = g.fans.some(function (f) { return online[f.id]; });
          var el = document.createElementNS(NS, "g");
          el.setAttribute("class", "pin" + (mine ? " mine" : "") + (sel === g.place.id ? " sel" : "") + (live ? " live" : ""));
          el.setAttribute("transform", "translate(" + g.place.x.toFixed(1) + "," + g.place.y.toFixed(1) + ")");
          el.setAttribute("data-n", g.fans.length);
          el.setAttribute("data-id", g.place.id);
          if (interactive) el.setAttribute("tabindex", "0");
          el.innerHTML = '<circle class="halo" r="12"/><circle class="dot" r="6"/><text class="cnt">' + g.fans.length + "</text>";
          gP.appendChild(el);
        });
      }
      sizePins();
    }

    function applyVB() {
      svg.setAttribute("viewBox", vb.x.toFixed(2) + " " + vb.y.toFixed(2) + " " + vb.w.toFixed(2) + " " + vb.h.toFixed(2));
      gL.style.display = vb.w < 260 ? "" : "none";
      gD.style.display = vb.w < 430 ? "" : "none";
      sizePins();
    }

    /* --- interakció --- */
    function toSvg(ev) {
      var r = svg.getBoundingClientRect();
      var sc = Math.max(vb.w / r.width, vb.h / r.height);
      var ox = (r.width * sc - vb.w) / 2, oy = (r.height * sc - vb.h) / 2;
      return { x: vb.x - ox + (ev.clientX - r.left) * sc, y: vb.y - oy + (ev.clientY - r.top) * sc, sc: sc };
    }
    function zoomAt(f, cx, cy) {
      var nw = Math.min(HU.w * 1.1, Math.max(28, vb.w * f));
      var k = nw / vb.w;
      vb.x = cx - (cx - vb.x) * k;
      vb.y = cy - (cy - vb.y) * k;
      vb.w = nw;
      vb.h = vb.h * k;
      applyVB();
      if (opts.onView) opts.onView(vb.w);
    }

    if (interactive) {
      svg.addEventListener("wheel", function (e) {
        e.preventDefault();
        var p = toSvg(e);
        zoomAt(e.deltaY > 0 ? 1.18 : 0.85, p.x, p.y);
      }, { passive: false });

      var drag = null;
      svg.addEventListener("pointerdown", function (e) {
        if (e.target.closest(".pin")) return;
        drag = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y, sc: toSvg(e).sc, moved: false };
        svg.classList.add("drag");
        svg.setPointerCapture(e.pointerId);
      });
      svg.addEventListener("pointermove", function (e) {
        if (!drag) return;
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
        vb.x = drag.vx - (e.clientX - drag.x) * drag.sc;
        vb.y = drag.vy - (e.clientY - drag.y) * drag.sc;
        applyVB();
      });
      function endDrag() { drag = null; svg.classList.remove("drag"); }
      svg.addEventListener("pointerup", endDrag);
      svg.addEventListener("pointercancel", endDrag);

      function hover(e) {
        var el = e.target.closest(".pin") || e.target.closest(".district");
        if (el && opts.onHover) opts.onHover(el.getAttribute("data-id"), el);
        else if (!el && opts.onHover) opts.onHover(null, null);
      }
      svg.addEventListener("pointerover", hover);
      svg.addEventListener("pointerout", function (e) {
        if ((e.target.closest(".pin") || e.target.closest(".district")) && opts.onHover) opts.onHover(null, null);
      });
      svg.addEventListener("click", function (e) {
        var el = e.target.closest(".pin") || e.target.closest(".district");
        if (el && opts.onSelect) opts.onSelect(el.getAttribute("data-id"));
      });
      svg.addEventListener("keydown", function (e) {
        var el = e.target.closest(".pin");
        if (el && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          if (opts.onSelect) opts.onSelect(el.getAttribute("data-id"));
        }
      });
    }

    applyVB();
    paint();

    return {
      setFans: function (list, meId) { fans = list || []; if (meId !== undefined) myId = meId; paint(); },
      setOnline: function (map) { online = map || {}; paint(); },
      setMode: function (m) { mode = m; paint(); },
      getMode: function () { return mode; },
      select: function (id) { sel = id; paint(); },
      view: function (name) {
        var v = name === "bp" ? BP : HU;
        vb = { x: v.x, y: v.y, w: v.w, h: v.h };
        applyVB();
        if (opts.onView) opts.onView(vb.w);
      },
      zoom: function (f) { zoomAt(f, vb.x + vb.w / 2, vb.y + vb.h / 2); },
      width: function () { return vb.w; },
      countyOf: countyOf,
      countyStats: countyStats,
      districtStats: districtStats,
      groups: groups
    };
  }

  w.GTAMap = { create: create, HU: HU, BP: BP };
})(window);
