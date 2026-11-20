/* Beágyazható mini-térkép: csak olvas, kattintásra a teljes oldalt nyitja. */
(function (w) {
  "use strict";
  var D = w.GTAData, C = w.GTACore, api = C.api;
  var $ = function (id) { return document.getElementById(id); };
  var fans = [], tip = $("tip");

  var map = w.GTAMap.create({
    svg: $("map"),
    onHover: function (id, el) {
      if (!id) { tip.style.opacity = "0"; return; }
      var pl = D.BY_ID[id];
      if (!pl) { tip.style.opacity = "0"; return; }
      var list = fans.filter(function (f) { return f.place_id === id; });
      var hours = list.reduce(function (s, f) { return s + f.hours; }, 0);
      tip.innerHTML = "<b>" + C.esc(pl.label) + "</b><br><span>" +
        (list.length ? list.length + " rajongó · " + C.nf(hours) + " óra" : "még senki") + "</span>";
      var host = $("map").parentNode.getBoundingClientRect(), b = el.getBoundingClientRect();
      tip.style.left = Math.max(70, Math.min(host.width - 70, b.left + b.width / 2 - host.left)) + "px";
      tip.style.top = Math.max(10, b.top - host.top) + "px";
      tip.style.opacity = "1";
    },
    onSelect: function () { w.open($("eCta").href, "_blank", "noopener"); }
  });

  function render() {
    var hours = 0;
    fans.forEach(function (f) { hours += f.hours; });
    $("eFans").textContent = C.nf(fans.length);
    $("eHours").textContent = C.nf(hours);
    var g = map.groups().sort(function (a, b) { return b.fans.length - a.fans.length; });
    if (g.length) {
      $("eTopWrap").hidden = false;
      $("eTop").textContent = g[0].place.short;
    }
    map.setFans(fans, null);
  }

  function load() {
    if (!api.ready) return;
    api.fans().then(function (list) { fans = list; render(); }).catch(function () { });
  }
  load();
  setInterval(function () { if (!document.hidden) load(); }, 60000);
})(window);
