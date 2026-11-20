/* Helyek, megyék, lakosságszámok és a térképvetítés.
   Vetítés: x = (lon - 16.0) * 144.9 ; y = (48.70 - lat) * 212.5
   A lakosságszámok kerekített KSH-alapú becslések, a „10 000 lakosra" mutatóhoz. */
(function (w) {
  "use strict";

  var KX = 144.9, KY = 212.5, L0 = 16.0, T0 = 48.70;
  function px(lon) { return (lon - L0) * KX; }
  function py(lat) { return (T0 - lat) * KY; }

  var COUNTY_NAMES = ["Bács-Kiskun", "Baranya", "Békés", "Borsod-Abaúj-Zemplén", "Budapest",
    "Csongrád-Csanád", "Fejér", "Győr-Moson-Sopron", "Hajdú-Bihar", "Heves",
    "Jász-Nagykun-Szolnok", "Komárom-Esztergom", "Nógrád", "Pest", "Somogy",
    "Szabolcs-Szatmár-Bereg", "Tolna", "Vas", "Veszprém", "Zala"];

  var COUNTY_POP = {
    "Bács-Kiskun": 500000, "Baranya": 355000, "Békés": 330000, "Borsod-Abaúj-Zemplén": 615000,
    "Budapest": 1680000, "Csongrád-Csanád": 395000, "Fejér": 415000, "Győr-Moson-Sopron": 470000,
    "Hajdú-Bihar": 525000, "Heves": 290000, "Jász-Nagykun-Szolnok": 360000,
    "Komárom-Esztergom": 295000, "Nógrád": 185000, "Pest": 1320000, "Somogy": 295000,
    "Szabolcs-Szatmár-Bereg": 525000, "Tolna": 215000, "Vas": 250000, "Veszprém": 335000,
    "Zala": 260000
  };

  /* kerület: [név, lat, lon, lakosság] */
  var D = [
    ["I. kerület — Várkerület", 47.4969, 19.0353, 23000],
    ["II. kerület", 47.5390, 18.9860, 88000],
    ["III. kerület — Óbuda", 47.5800, 19.0400, 125000],
    ["IV. kerület — Újpest", 47.5690, 19.0900, 100000],
    ["V. kerület — Belváros", 47.4990, 19.0520, 24000],
    ["VI. kerület — Terézváros", 47.5070, 19.0660, 38000],
    ["VII. kerület — Erzsébetváros", 47.5020, 19.0730, 55000],
    ["VIII. kerület — Józsefváros", 47.4890, 19.0750, 73000],
    ["IX. kerület — Ferencváros", 47.4720, 19.0820, 58000],
    ["X. kerület — Kőbánya", 47.4800, 19.1500, 75000],
    ["XI. kerület — Újbuda", 47.4600, 19.0200, 140000],
    ["XII. kerület — Hegyvidék", 47.4950, 18.9900, 56000],
    ["XIII. kerület", 47.5350, 19.0800, 120000],
    ["XIV. kerület — Zugló", 47.5200, 19.1200, 123000],
    ["XV. kerület", 47.5600, 19.1200, 80000],
    ["XVI. kerület", 47.5200, 19.1800, 72000],
    ["XVII. kerület — Rákosmente", 47.4800, 19.2500, 83000],
    ["XVIII. kerület — Pestszentlőrinc", 47.4400, 19.1800, 98000],
    ["XIX. kerület — Kispest", 47.4500, 19.1400, 60000],
    ["XX. kerület — Pesterzsébet", 47.4300, 19.1200, 62000],
    ["XXI. kerület — Csepel", 47.4150, 19.0700, 73000],
    ["XXII. kerület — Budafok", 47.4200, 19.0300, 53000],
    ["XXIII. kerület — Soroksár", 47.3950, 19.1200, 22000]
  ];

  var C = [
    ["Debrecen", 47.5316, 21.6273], ["Szeged", 46.2530, 20.1414], ["Miskolc", 48.1035, 20.7784],
    ["Pécs", 46.0727, 18.2323], ["Győr", 47.6875, 17.6504], ["Nyíregyháza", 47.9554, 21.7167],
    ["Kecskemét", 46.9062, 19.6913], ["Székesfehérvár", 47.1860, 18.4221], ["Szombathely", 47.2307, 16.6218],
    ["Szolnok", 47.1747, 20.1986], ["Tatabánya", 47.5692, 18.3980], ["Kaposvár", 46.3594, 17.7968],
    ["Érd", 47.3833, 18.9167], ["Veszprém", 47.0933, 17.9115], ["Békéscsaba", 46.6790, 21.0914],
    ["Zalaegerszeg", 46.8417, 16.8416], ["Sopron", 47.6817, 16.5845], ["Eger", 47.9025, 20.3772],
    ["Nagykanizsa", 46.4590, 16.9897], ["Dunaújváros", 46.9619, 18.9355], ["Hódmezővásárhely", 46.4181, 20.3300],
    ["Szigetszentmiklós", 47.3433, 19.0450], ["Cegléd", 47.1726, 19.7997], ["Baja", 46.1803, 19.0000],
    ["Salgótarján", 48.0935, 19.8003], ["Ózd", 48.2208, 20.2975], ["Vác", 47.7757, 19.1312],
    ["Gödöllő", 47.5960, 19.3550], ["Mosonmagyaróvár", 47.8667, 17.2667], ["Gyöngyös", 47.7833, 19.9333],
    ["Kiskunfélegyháza", 46.7114, 19.8517], ["Ajka", 47.1000, 17.5667], ["Esztergom", 47.7928, 18.7405],
    ["Orosháza", 46.5667, 20.6667], ["Kazincbarcika", 48.2500, 20.6167], ["Szentes", 46.6533, 20.2667],
    ["Hajdúböszörmény", 47.6697, 21.5167], ["Dunakeszi", 47.6333, 19.1333], ["Jászberény", 47.5000, 19.9167],
    ["Gyula", 46.6500, 21.2833], ["Kiskunhalas", 46.4333, 19.4833], ["Pápa", 47.3300, 17.4667],
    ["Nagykőrös", 47.0333, 19.7833], ["Siófok", 46.9000, 18.0500], ["Várpalota", 47.2000, 18.1333],
    ["Mohács", 45.9939, 18.6833], ["Makó", 46.2167, 20.4833], ["Szigetvár", 46.0486, 17.8056],
    ["Keszthely", 46.7667, 17.2500], ["Balatonfüred", 46.9578, 17.8886], ["Hévíz", 46.7903, 17.1897],
    ["Tapolca", 46.8817, 17.4392], ["Marcali", 46.5833, 17.4167], ["Siklós", 45.8542, 18.3000],
    ["Komló", 46.1931, 18.2653], ["Paks", 46.6228, 18.8561], ["Szekszárd", 46.3500, 18.7000],
    ["Dombóvár", 46.3772, 18.1283], ["Bonyhád", 46.3000, 18.5333], ["Kalocsa", 46.5333, 18.9833],
    ["Tiszakécske", 46.9333, 20.1000], ["Törökszentmiklós", 47.1833, 20.4167], ["Karcag", 47.3167, 20.9333],
    ["Kisújszállás", 47.2167, 20.7667], ["Berettyóújfalu", 47.2167, 21.5333], ["Hajdúszoboszló", 47.4425, 21.3917],
    ["Balmazújváros", 47.6167, 21.3500], ["Nyírbátor", 47.8333, 22.1333], ["Kisvárda", 48.2225, 22.0831],
    ["Mátészalka", 47.9500, 22.3167], ["Fehérgyarmat", 47.9833, 22.5167], ["Vásárosnamény", 48.1333, 22.3167],
    ["Tiszavasvári", 47.9667, 21.3500], ["Mezőkövesd", 47.8167, 20.5667], ["Sátoraljaújhely", 48.3950, 21.6567],
    ["Sárospatak", 48.3167, 21.5667], ["Szerencs", 48.1667, 21.2000], ["Tiszaújváros", 47.9333, 21.0500],
    ["Füzesabony", 47.7500, 20.4167], ["Hatvan", 47.6667, 19.6833], ["Balassagyarmat", 48.0786, 19.2944],
    ["Pásztó", 47.9167, 19.7000], ["Bátonyterenye", 48.0000, 19.8167], ["Monor", 47.3500, 19.4500],
    ["Dabas", 47.1833, 19.3167], ["Nagykáta", 47.4167, 19.7333], ["Abony", 47.1833, 20.0000],
    ["Albertirsa", 47.2500, 19.6167], ["Pilisvörösvár", 47.6167, 18.9167], ["Budaörs", 47.4617, 18.9583],
    ["Százhalombatta", 47.3167, 18.9167], ["Ráckeve", 47.1667, 18.9333], ["Tököl", 47.3167, 18.9667],
    ["Fót", 47.6167, 19.1833], ["Veresegyház", 47.6500, 19.2833], ["Pomáz", 47.6500, 18.9833],
    ["Szentendre", 47.6667, 19.0833], ["Celldömölk", 47.2583, 17.1500], ["Sárvár", 47.2544, 16.9372],
    ["Körmend", 47.0167, 16.6000], ["Szentgotthárd", 46.9533, 16.2764], ["Csorna", 47.6167, 17.2500],
    ["Kapuvár", 47.5950, 17.0283], ["Kőszeg", 47.3889, 16.5417], ["Lenti", 46.6236, 16.5392],
    ["Fonyód", 46.7500, 17.5333], ["Barcs", 45.9594, 17.4600], ["Nagyatád", 46.2292, 17.3608],
    ["Mór", 47.3761, 18.2056], ["Bicske", 47.4906, 18.6350], ["Gárdony", 47.1961, 18.6128],
    ["Zirc", 47.2619, 17.8714], ["Balatonalmádi", 47.0333, 18.0167], ["Sümeg", 46.9769, 17.2811],
    ["Hajdúnánás", 47.8500, 21.4333], ["Püspökladány", 47.3167, 21.1167], ["Nagykálló", 47.8769, 21.8450],
    ["Újfehértó", 47.8000, 21.6833], ["Sarkad", 46.7500, 21.3833], ["Mezőtúr", 47.0167, 20.6333],
    ["Kunszentmárton", 46.8333, 20.2833], ["Szarvas", 46.8667, 20.5500], ["Gyomaendrőd", 46.9333, 20.8333],
    ["Mezőberény", 46.8167, 21.0333], ["Battonya", 46.2917, 21.0167], ["Csongrád", 46.7167, 20.1500],
    ["Kistelek", 46.4722, 19.9797], ["Mórahalom", 46.2167, 19.8833], ["Szentlőrinc", 46.0417, 17.9917],
    ["Pécsvárad", 46.1500, 18.4167], ["Villány", 45.8667, 18.4500], ["Tamási", 46.6333, 18.2833],
    ["Soltvadkert", 46.5833, 19.4000], ["Kiskunmajsa", 46.4919, 19.7375], ["Jánoshalma", 46.3000, 19.3167],
    ["Tiszafüred", 47.6167, 20.7667], ["Kunhegyes", 47.3667, 20.6333], ["Jászapáti", 47.5167, 20.1500]
  ];

  /* megyeszékhely-közeli pont a „megye, egyéb település" választáshoz */
  var CO = [["Bács-Kiskun", 46.55, 19.35], ["Baranya", 46.05, 18.25], ["Békés", 46.75, 21.00],
    ["Borsod-Abaúj-Zemplén", 48.20, 20.75], ["Csongrád-Csanád", 46.40, 20.25], ["Fejér", 47.15, 18.50],
    ["Győr-Moson-Sopron", 47.65, 17.25], ["Hajdú-Bihar", 47.50, 21.50], ["Heves", 47.80, 20.20],
    ["Jász-Nagykun-Szolnok", 47.25, 20.35], ["Komárom-Esztergom", 47.60, 18.30], ["Nógrád", 48.00, 19.50],
    ["Pest", 47.45, 19.45], ["Somogy", 46.50, 17.50], ["Szabolcs-Szatmár-Bereg", 48.00, 22.00],
    ["Tolna", 46.50, 18.50], ["Vas", 47.10, 16.70], ["Veszprém", 47.15, 17.70], ["Zala", 46.70, 16.95]];

  function slug(s) {
    return s.toLowerCase()
      .replace(/[áà]/g, "a").replace(/[éè]/g, "e").replace(/[íì]/g, "i")
      .replace(/[óöő]/g, "o").replace(/[úüű]/g, "u").replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "").slice(0, 40);
  }

  var PLACES = [], BY_ID = {};
  D.forEach(function (r, i) {
    PLACES.push({
      id: "bp" + (i + 1), label: "Budapest " + r[0], short: "Bp. " + r[0].split(" ")[0],
      lat: r[1], lon: r[2], kind: "ker", county: "Budapest", pop: r[3]
    });
  });
  C.forEach(function (r) {
    PLACES.push({ id: "v-" + slug(r[0]), label: r[0], short: r[0], lat: r[1], lon: r[2], kind: "varos", county: null });
  });
  CO.forEach(function (r) {
    PLACES.push({
      id: "m-" + slug(r[0]), label: r[0] + " megye (egyéb település)", short: r[0] + " megye",
      lat: r[1], lon: r[2], kind: "megye", county: r[0]
    });
  });
  PLACES.forEach(function (p) { p.x = px(p.lon); p.y = py(p.lat); BY_ID[p.id] = p; });

  /* rangok óraszám szerint */
  var RANKS = [
    { min: 0, name: "Újonc", color: "#8fa3c8" },
    { min: 10, name: "Utcai futó", color: "#2de2e6" },
    { min: 25, name: "Vice City turista", color: "#5ad2a0" },
    { min: 50, name: "Leonida lakos", color: "#ffd66e" },
    { min: 100, name: "Alvilági profi", color: "#ff9c2b" },
    { min: 200, name: "Nagymenő", color: "#ff6b5e" },
    { min: 350, name: "Hírhedt", color: "#ff2d95" },
    { min: 600, name: "Leonida Veterán", color: "#c04bff" }
  ];
  function rankOf(h) {
    var r = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) { if (h >= RANKS[i].min) r = RANKS[i]; }
    return r;
  }

  w.GTAData = {
    px: px, py: py, KX: KX, KY: KY, L0: L0, T0: T0,
    COUNTY_NAMES: COUNTY_NAMES, COUNTY_POP: COUNTY_POP,
    DISTRICTS: D, PLACES: PLACES, BY_ID: BY_ID,
    RANKS: RANKS, rankOf: rankOf,
    RELEASE: new Date(2026, 10, 19)
  };
})(window);
