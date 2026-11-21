/* Az iframe-es banner-oldal indítója: a linkek az iframe-ből kitörve,
   új lapon nyíljanak meg. */
(function (w, d) {
  "use strict";
  if (!w.GTABanner) return;
  var host = d.getElementById("host");
  w.GTABanner.mount(host).then(function () {
    var a = host.querySelectorAll("a");
    for (var i = 0; i < a.length; i++) {
      a[i].target = "_blank";
      a[i].rel = "noopener nofollow sponsored";
    }
  });
})(window, document);
