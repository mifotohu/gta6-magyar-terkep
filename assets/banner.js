/* Forgó hirdetőhely. Ugyanez a fájl szolgálja ki a saját oldalt és a máshová
   beillesztett bannert is.

   Más oldalon egyetlen sor:
     <script src="https://<domain>/assets/banner.js" async></script>
   A script a saját helyére teszi a bannert. Szélesség: data-width="300".

   Mérés: a kattintás a /api/b/<id> átirányítón megy át, a megjelenést
   oldalbetöltésenként egyszer jelezzük. */
(function (w, d) {
  "use strict";
  var SELF = d.currentScript;
  var ORIGIN = (function () {
    try { return new URL(SELF.src).origin; } catch (e) { return w.location.origin; }
  })();

  var latott = {};

  function jelezMegjelenes(id) {
    if (latott[id]) return;
    latott[id] = 1;
    var url = ORIGIN + "/api/view";
    var test = JSON.stringify({ id: id });
    try {
      if (w.navigator && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([test], { type: "application/json" }));
        return;
      }
    } catch (e) { }
    try {
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: test, keepalive: true })
        .catch(function () { });
    } catch (e) { }
  }

  function mount(host, opts) {
    opts = opts || {};
    if (!host) return;
    return fetch(ORIGIN + "/api/banners")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var lista = (data.banners || []).filter(function (b) { return b && b.image; });
        if (!lista.length) { host.hidden = true; host.innerHTML = ""; return; }

        var delay = Math.max(1000, Number(data.delay) || 4000);
        host.hidden = false;
        host.innerHTML = "";

        var wrap = d.createElement("div");
        wrap.style.cssText = "position:relative;line-height:0;overflow:hidden;border-radius:12px";
        if (opts.width) wrap.style.maxWidth = opts.width + "px";

        var cimke = null;
        if (opts.label !== false) {
          cimke = d.createElement("div");
          cimke.textContent = "Hirdetés";
          cimke.style.cssText = "font:600 9.5px/1.6 ui-monospace,Consolas,monospace;letter-spacing:.18em;" +
            "text-transform:uppercase;opacity:.65;text-align:center;padding:4px 0";
        }

        var elemek = lista.map(function (b, i) {
          var img = d.createElement("img");
          img.src = b.image;
          img.alt = b.alt || "Hirdetés";
          img.loading = "lazy";
          img.style.cssText = "display:block;width:100%;height:auto";
          var node;
          if (b.url) {
            node = d.createElement("a");
            node.href = b.url;
            node.target = "_blank";
            node.rel = "noopener nofollow sponsored";
            node.style.cssText = "display:block;line-height:0";
            node.appendChild(img);
          } else {
            node = img;
          }
          node.style.transition = "opacity .35s";
          if (i > 0) { node.style.position = "absolute"; node.style.inset = "0"; node.style.opacity = "0"; }
          wrap.appendChild(node);
          return { node: node, id: b.id };
        });

        if (cimke) host.appendChild(cimke);
        host.appendChild(wrap);

        var akt = 0;
        jelezMegjelenes(elemek[0].id);

        if (elemek.length > 1) {
          setInterval(function () {
            if (d.hidden) return; /* háttérben nem pörgetünk feleslegesen */
            var kov = (akt + 1) % elemek.length;
            elemek[akt].node.style.opacity = "0";
            elemek[kov].node.style.opacity = "1";
            akt = kov;
            jelezMegjelenes(elemek[kov].id);
          }, delay);
        }
      })
      .catch(function () { host.hidden = true; });
  }

  w.GTABanner = { mount: mount, origin: ORIGIN };

  /* más oldalra beillesztve: a script a saját helyére teszi a bannert */
  if (SELF && SELF.getAttribute("data-auto") !== "false") {
    var host = d.createElement("div");
    host.className = "gta6-banner";
    var szel = SELF.getAttribute("data-width");
    if (szel) host.style.maxWidth = szel + "px";
    host.style.margin = "0 auto";
    if (SELF.parentNode) SELF.parentNode.insertBefore(host, SELF.nextSibling);
    mount(host, { width: szel ? Number(szel) : 0 });
  }
})(window, document);
