/* Supabase kapcsolat, eszköz-token és API-hívások.
   Bejelentkezés nincs: minden látogató kap egy titkos UUID-t a böngészőjében,
   és minden írás egy szerveroldali függvényen megy át, ami ezt a tokent ellenőrzi. */
(function (w) {
  "use strict";

  var CFG = w.GTA_CONFIG || {};
  var URL_ = CFG.supabaseUrl;
  var KEY = CFG.supabaseKey;

  var sb = (w.supabase && URL_ && KEY)
    ? w.supabase.createClient(URL_, KEY, { auth: { persistSession: false } })
    : null;

  /* ---------- token ---------- */
  var TKEY = "gta6hu_token";
  function uuid() {
    if (w.crypto && w.crypto.randomUUID) return w.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function token() {
    var t = null;
    try { t = localStorage.getItem(TKEY); } catch (e) { }
    if (!t) {
      t = uuid();
      try { localStorage.setItem(TKEY, t); } catch (e) { }
    }
    return t;
  }
  function savedFanId() { try { return localStorage.getItem("gta6hu_fan"); } catch (e) { return null; } }
  function rememberFan(id) { try { id ? localStorage.setItem("gta6hu_fan", id) : localStorage.removeItem("gta6hu_fan"); } catch (e) { } }

  /* ---------- hibaüzenetek ---------- */
  var MSG = {
    ROSSZ_BECENEV: "A becenév 2 és 22 karakter között legyen.",
    ROSSZ_HELY: "Válassz helyet a listából.",
    ROSSZ_ORASZAM: "Az óraszám 0 és 5000 között legyen.",
    TUL_SOK_PROBALKOZAS: "Erről a hálózatról ma már öt bejelölés érkezett. Holnap újra megy.",
    ELOBB_JELOLD_BE_MAGAD: "Előbb jelöld be magad a térképen, utána alapíthatsz crew-t.",
    FOGLALT_CREW_NEV: "Ez a crew-név már foglalt.",
    ROSSZ_CREW_NEV: "A crew neve 2 és 24 karakter között legyen.",
    HIANYZO_TOKEN: "A böngésződ nem engedi a helyi tárolást, így a bejelölés nem menthető.",
    TUL_SOK_JELENTES: "Erről a hálózatról ma már sok jelentés érkezett. Holnap újra megy.",
    MAR_VAN_FOLYAMATBAN: "Már vár elbírálásra egy képed. Előbb azt nézzük át.",
    ROSSZ_KEP: "Ez nem kép. Válassz egy képernyőképet (PNG vagy JPG).",
    TUL_NAGY_KEP: "A kép még kicsinyítve is túl nagy. Próbálj egy egyszerűbb képernyőképet.",
    NINCS_ILYEN: "Ez a bejegyzés már nincs meg.",
    NINCS_JOGOSULTSAG: "Hibás jelszó.",
    MAR_VAN_ADMIN: "Az admin jelszó már be van állítva.",
    ROVID_JELSZO: "A jelszó legalább 12 karakter legyen.",
    CSAK_HTTPS: "A címeknek https://-sel kell kezdődniük.",
    TUL_SOK_TIPP: "Erről a hálózatról ma már három tipp érkezett. Holnap jöhet a következő.",
    TUL_SOK_VISSZAJELZES: "Erről a hálózatról ma már sok visszajelzés jött. Holnap újra megy.",
    ROVID_UZENET: "Írj legalább pár szót, hogy értelmezni tudjuk.",
    ROVID_TIPP: "A tipp legalább 10 karakter legyen — írd le pár szóval, miről van szó.",
    ROVID_CIM: "A cím legalább 3 karakter legyen.",
    KELL_NEV: "Adj nevet a hirdetésnek."
  };

  /* játékmódok */
  var MODES = { story: "Story", online: "Online", szabad: "Szabad barangolás" };
  function modeLabel(m) { return MODES[m] || ""; }

  /* tipp-kategóriák */
  var KATEGORIAK = [
    ["beallitasok", "Beállítások"],
    ["penz", "Pénz és üzletek"],
    ["kuldetesek", "Küldetések"],
    ["jarmuvek", "Járművek"],
    ["online", "Online"],
    ["egyeb", "Egyéb"]
  ];
  function katLabel(k) {
    for (var i = 0; i < KATEGORIAK.length; i++) { if (KATEGORIAK[i][0] === k) return KATEGORIAK[i][1]; }
    return k;
  }
  function humanError(err) {
    if (!err) return "Ismeretlen hiba.";
    var m = String(err.message || err);
    for (var k in MSG) { if (m.indexOf(k) >= 0) return MSG[k]; }
    if (m.indexOf("Failed to fetch") >= 0 || m.indexOf("NetworkError") >= 0) {
      return "Nincs kapcsolat a szerverrel. Nézd meg a netkapcsolatot, és próbáld újra.";
    }
    return "A mentés nem sikerült. Próbáld újra kicsit később.";
  }

  /* ---------- API ---------- */
  function need() { if (!sb) throw new Error("Nincs adatbázis-kapcsolat."); }

  /* saját szerverfüggvény hívása a böngésző tokenjével */
  function callApi(path) {
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token() })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) {
          var e = new Error(d.uzenet || d.error || ("Hiba: " + r.status));
          e.code = d.error;
          throw e;
        }
        return d;
      });
    });
  }

  var api = {
    ready: !!sb,

    fans: function () {
      need();
      return sb.from("fans")
        .select("id,nick,place_id,hours,platform,note,crew_id,created_at,updated_at,steam_hours,steam_verified_at,proof_verified_at,mode")
        .order("hours", { ascending: false })
        .limit(5000)
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },

    crews: function () {
      need();
      return sb.from("crews").select("id,name,color,created_at").limit(500)
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },

    weekly: function () {
      need();
      return sb.rpc("weekly_deltas")
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },

    daily: function () {
      need();
      return sb.from("daily_totals").select("day,total_hours").order("day")
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },

    hourLog: function () {
      need();
      return sb.from("hour_log").select("fan_id,hours,logged_at").order("logged_at").limit(10000)
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },

    mine: function () {
      need();
      return sb.rpc("my_fan", { p_token: token() })
        .then(function (r) {
          if (r.error) throw r.error;
          var row = (r.data || [])[0] || null;
          rememberFan(row ? row.id : null);
          return row;
        });
    },

    save: function (rec) {
      need();
      return sb.rpc("save_fan", {
        p_token: token(),
        p_nick: rec.nick,
        p_place_id: rec.place_id,
        p_hours: rec.hours,
        p_platform: rec.platform,
        p_note: rec.note || null,
        p_crew_id: rec.crew_id || null,
        p_mode: rec.mode || null
      }).then(function (r) {
        if (r.error) throw r.error;
        rememberFan(r.data);
        return r.data;
      });
    },

    remove: function () {
      need();
      return sb.rpc("delete_fan", { p_token: token() })
        .then(function (r) { if (r.error) throw r.error; rememberFan(null); return r.data; });
    },

    createCrew: function (name, color) {
      need();
      return sb.rpc("create_crew", { p_token: token(), p_name: name, p_color: color })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },

    /* --- Steam-hitelesítés (szerveroldali végpontok) --- */
    steamEnabled: function () {
      return fetch("/api/steam/status")
        .then(function (r) { return r.json(); })
        .then(function (d) { return !!(d && d.enabled); })
        .catch(function () { return false; });
    },
    steamStart: function () { return callApi("/api/steam/start"); },
    steamRefresh: function () { return callApi("/api/steam/refresh"); },
    steamUnlink: function () {
      need();
      return sb.rpc("steam_unlink", { p_token: token() })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },

    report: function (fanId, reason, note) {
      need();
      return sb.rpc("report_fan", { p_fan_id: fanId, p_reason: reason, p_note: note || null })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },

    /* --- tippek --- */
    tips: function (kat) {
      need();
      return sb.rpc("tips_public", { p_kategoria: kat || null })
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },
    tipSubmit: function (nick, kat, szoveg) {
      need();
      return sb.rpc("tip_submit", { p_token: token(), p_nick: nick || null, p_kategoria: kat, p_szoveg: szoveg })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    tipVote: function (id) {
      need();
      return sb.rpc("tip_vote", { p_tip_id: id })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    tipsMine: function () {
      need();
      return sb.rpc("tips_mine", { p_token: token() })
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },
    adminTips: function (key) {
      need();
      return sb.rpc("admin_tips", { p_key: key })
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },
    adminTipDecide: function (key, id, ok) {
      need();
      return sb.rpc("admin_tip_decide", { p_key: key, p_id: id, p_ok: ok })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    adminTipDelete: function (key, id) {
      need();
      return sb.rpc("admin_tip_delete", { p_key: key, p_id: id })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },

    /* --- heti kihívás --- */
    challenge: function () {
      need();
      return sb.rpc("challenge_now")
        .then(function (r) { if (r.error) throw r.error; return (r.data || [])[0] || null; });
    },
    challengeDo: function (id) {
      need();
      return sb.rpc("challenge_do", { p_id: id })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    adminChallenges: function (key) {
      need();
      return sb.rpc("admin_challenges", { p_key: key })
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },
    adminChallengeSave: function (key, c) {
      need();
      return sb.rpc("admin_challenge_save", {
        p_key: key, p_id: c.id || null, p_cim: c.cim, p_szoveg: c.szoveg || null, p_aktiv: !!c.aktiv
      }).then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    adminChallengeDelete: function (key, id) {
      need();
      return sb.rpc("admin_challenge_delete", { p_key: key, p_id: id })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },

    /* --- visszajelzés (ötlet / hiba) --- */
    feedbackSubmit: function (tipus, szoveg, nick) {
      need();
      return sb.rpc("feedback_submit", { p_token: token(), p_tipus: tipus, p_szoveg: szoveg, p_nick: nick || null })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    adminFeedback: function (key) {
      need();
      return sb.rpc("admin_feedback", { p_key: key })
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },
    adminFeedbackDelete: function (key, id) {
      need();
      return sb.rpc("admin_feedback_delete", { p_key: key, p_id: id })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },

    /* --- oldalbeállítások (banner, támogatás) --- */
    config: function () {
      need();
      return sb.from("site_config").select("donate_url,banner_delay_ms").limit(1)
        .then(function (r) { if (r.error) throw r.error; return (r.data || [])[0] || null; });
    },
    adminConfig: function (key) {
      need();
      return sb.rpc("admin_config", { p_key: key })
        .then(function (r) { if (r.error) throw r.error; return (r.data || [])[0] || null; });
    },
    adminConfigSet: function (key, c) {
      need();
      return sb.rpc("admin_config_set", {
        p_key: key, p_on: !!c.banner_on, p_image: c.banner_image || null,
        p_link: c.banner_link || null, p_alt: c.banner_alt || null, p_donate: c.donate_url || null
      }).then(function (r) { if (r.error) throw r.error; return r.data; });
    },

    /* --- hirdetések (admin) --- */
    adminBanners: function (key) {
      need();
      return sb.rpc("admin_banners", { p_key: key })
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },
    adminBannerSave: function (key, b) {
      need();
      return sb.rpc("admin_banner_save", {
        p_key: key, p_id: b.id || null, p_nev: b.nev, p_image: b.image,
        p_link: b.link || null, p_alt: b.alt || null,
        p_aktiv: !!b.aktiv, p_sorrend: b.sorrend || 0
      }).then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    adminBannerDelete: function (key, id) {
      need();
      return sb.rpc("admin_banner_delete", { p_key: key, p_id: id })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    adminBannerReset: function (key, id) {
      need();
      return sb.rpc("admin_banner_reset", { p_key: key, p_id: id })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    adminDelaySet: function (key, ms) {
      need();
      return sb.rpc("admin_delay_set", { p_key: key, p_ms: ms })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },

    /* értesítés a moderátornak; ha nincs beállítva, csendben nem csinál semmit */
    notify: function () {
      return fetch("/api/notify", { method: "POST" }).catch(function () { });
    },

    /* --- hitelesítés képpel --- */
    proofSubmit: function (hours, platform, image, note) {
      need();
      return sb.rpc("proof_submit", {
        p_token: token(), p_hours: hours, p_platform: platform, p_image: image, p_note: note || null
      }).then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    proofMine: function () {
      need();
      return sb.rpc("proof_mine", { p_token: token() })
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },
    adminProofs: function (key) {
      need();
      return sb.rpc("admin_proofs", { p_key: key }).then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },
    adminProofDecide: function (key, id, ok) {
      need();
      return sb.rpc("admin_proof_decide", { p_key: key, p_proof_id: id, p_ok: ok })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },

    /* --- moderáció --- */
    adminExists: function () {
      need();
      return sb.rpc("admin_exists").then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    adminSetup: function (key) {
      need();
      return sb.rpc("admin_setup", { p_key: key }).then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    adminOk: function (key) {
      need();
      return sb.rpc("admin_ok", { p_key: key }).then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    adminReports: function (key) {
      need();
      return sb.rpc("admin_reports", { p_key: key }).then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },
    adminFans: function (key) {
      need();
      return sb.rpc("admin_fans", { p_key: key }).then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },
    adminCrews: function (key) {
      need();
      return sb.rpc("admin_crews", { p_key: key }).then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },
    adminDeleteFan: function (key, id) {
      need();
      return sb.rpc("admin_delete_fan", { p_key: key, p_fan_id: id }).then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    adminDeleteCrew: function (key, id) {
      need();
      return sb.rpc("admin_delete_crew", { p_key: key, p_crew_id: id }).then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    adminClearReports: function (key, id) {
      need();
      return sb.rpc("admin_clear_reports", { p_key: key, p_fan_id: id }).then(function (r) { if (r.error) throw r.error; return r.data; });
    },

    /* élő csatorna: jelenlét + változás-értesítés */
    channel: function (onChange, onPeers) {
      if (!sb) return null;
      var ch = sb.channel("gta6hu-lobby", { config: { presence: { key: token() } } });
      ch.on("postgres_changes", { event: "*", schema: "public", table: "fans" }, function () {
        if (onChange) onChange();
      });
      if (onPeers) {
        ch.on("presence", { event: "sync" }, function () {
          var st = ch.presenceState(), out = [];
          Object.keys(st).forEach(function (k) {
            (st[k] || []).forEach(function (m) { out.push(m); });
          });
          onPeers(out);
        });
      }
      return ch;
    }
  };

  /* ---------- formázók ---------- */
  var ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return ENT[c]; }); }
  function nf(n) { return (Math.round(n) || 0).toLocaleString("hu-HU"); }
  function platLabel(p) { return p === "Egyeb" ? "Egyéb" : p; }
  function days(from) { return Math.floor((Date.now() - from.getTime()) / 86400000) + 1; }

  w.GTACore = {
    sb: sb, api: api, token: token, savedFanId: savedFanId,
    esc: esc, nf: nf, platLabel: platLabel, days: days, humanError: humanError,
    MODES: MODES, modeLabel: modeLabel, KATEGORIAK: KATEGORIAK, katLabel: katLabel
  };

  /* Diszkrét moderációs gyorslink: csak azon a gépen jelenik meg, ahol
     korábban bejelentkeztél az adminba (a jelszó a localStorage-ban van).
     Így oda-vissza tudsz lépkedni, de kívülálló nem látja. */
  (function () {
    var van = false;
    try { van = !!localStorage.getItem("gta6hu_admin"); } catch (e) { }
    if (!van) return;
    var itt = /\/admin\.html$/.test(location.pathname);
    function mount() {
      if (document.getElementById("gta6hu-adminlink")) return;
      var a = document.createElement("a");
      a.id = "gta6hu-adminlink";
      a.href = itt ? "index.html" : "admin.html";
      a.textContent = itt ? "↩ Vissza a térképre" : "⚙ Moderáció";
      a.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:60;" +
        "font:600 12px/1 system-ui,sans-serif;text-decoration:none;color:#f8ecff;" +
        "background:rgba(26,10,56,.92);border:1px solid rgba(255,45,149,.5);" +
        "border-radius:999px;padding:9px 14px;box-shadow:0 8px 22px -10px #000;backdrop-filter:blur(4px)";
      document.body.appendChild(a);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
    else mount();
  })();
})(window);
