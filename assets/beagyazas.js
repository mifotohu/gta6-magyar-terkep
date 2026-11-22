/* Beágyazó oldal: méretválasztó, kódgenerálás, másolás. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var origin = location.origin;
  var szel = 400;
  var embedUrl = origin + "/embed.html";
  var siteUrl = origin + "/";

  function kod() {
    return '<iframe src="' + embedUrl + '" width="' + szel + '" height="520" ' +
      'style="border:0;border-radius:16px;max-width:100%" ' +
      'title="GTA VI magyar rajongói térkép" loading="lazy"></iframe>';
  }
  function frissit() { $("code").textContent = kod(); }

  var MERETEK = [[300, "Keskeny (300)"], [400, "Normál (400)"], [600, "Széles (600)"], [0, "Teljes szélesség"]];
  $("sizes").innerHTML = MERETEK.map(function (m) {
    return '<button class="btn sm' + (m[0] === szel ? " on" : "") + '" data-w="' + m[0] + '" type="button">' + m[1] + "</button>";
  }).join("");
  $("sizes").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-w]");
    if (!b) return;
    var w = +b.getAttribute("data-w");
    szel = w === 0 ? "100%" : w;
    var all = $("sizes").querySelectorAll("button");
    for (var i = 0; i < all.length; i++) all[i].classList.toggle("on", all[i] === b);
    frissit();
  });

  /* ha a vágólap nem elérhető, kijelöljük a szöveget, hogy Ctrl+C elég legyen */
  function jelol(el) {
    try {
      var r = document.createRange();
      r.selectNodeContents(el);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    } catch (e) { }
  }
  function masol(text, btn, alap, selEl) {
    function kesz(ok) {
      if (!ok && selEl) jelol(selEl);
      btn.textContent = ok ? "Másolva!" : "Kijelöltük — Ctrl+C";
      btn.classList.toggle("ok", ok);
      setTimeout(function () { btn.textContent = alap; btn.classList.remove("ok"); }, 2800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { kesz(true); }, function () { kesz(false); });
    } else { kesz(false); }
  }
  $("copy").onclick = function () { masol(kod(), this, "Kód másolása", $("code")); };
  $("copyLink").onclick = function () { masol(siteUrl, this, "Oldal linkjének másolása"); };

  frissit();
})();
