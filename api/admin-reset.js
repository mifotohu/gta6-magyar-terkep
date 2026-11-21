/* Elfelejtett admin jelszó.
   1. lépés: kérés — a szerver kódot generál, és elküldi az üzemeltető
      e-mail-címére. A kódot soha nem adjuk vissza a böngészőnek.
   2. lépés: a kóddal új jelszó állítható be.
   A kód 20 percig él, 5 hibás próbálkozás után érvénytelen, és
   10 percen belül nem kérhető új. */
const L = require("./_lib.js");
const crypto = require("crypto");

const RESEND_KEY = process.env.RESEND_API_KEY;
const TO = process.env.NOTIFY_TO;
const FROM = process.env.NOTIFY_FROM || "GTA VI Magyar Terkep <onboarding@resend.dev>";

function sha(s) { return crypto.createHash("sha256").update(String(s), "utf8").digest("hex"); }

module.exports = async function (req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  if (!L.configured()) { res.status(503).json({ error: "nincs_beallitva", uzenet: "A szerver nincs beállítva." }); return; }

  const body = await L.readJson(req);

  /* --- 2. lépés: új jelszó beállítása a kóddal --- */
  if (body.kod) {
    const uj = String(body.jelszo || "");
    if (uj.length < 12) {
      res.status(400).json({ error: "rovid", uzenet: "Az új jelszó legalább 12 karakter legyen." });
      return;
    }
    try {
      await L.rpc("admin_reset_finish", {
        p_secret: L.LINK_SECRET,
        p_code_sha: sha(String(body.kod).trim().toUpperCase()),
        p_new_sha: sha(uj)
      });
    } catch (e) {
      const m = String(e.message || "");
      if (m.indexOf("ROSSZ_KOD") >= 0) { res.status(400).json({ error: "rossz_kod", uzenet: "Hibás vagy lejárt kód." }); return; }
      if (m.indexOf("NINCS_KERES") >= 0) { res.status(400).json({ error: "nincs_keres", uzenet: "Nincs folyamatban jelszóigénylés. Kérj újat." }); return; }
      if (m.indexOf("TUL_SOK") >= 0) { res.status(429).json({ error: "tul_sok", uzenet: "Túl sok hibás kód. Kérj újat." }); return; }
      res.status(500).json({ error: "db", uzenet: "Nem sikerült beállítani az új jelszót." });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  /* --- 1. lépés: kód kérése --- */
  if (!RESEND_KEY || !TO) {
    res.status(503).json({
      error: "nincs_email",
      uzenet: "Az e-mailes emlékeztető nincs bekapcsolva ezen a telepítésen."
    });
    return;
  }

  /* félreérthető karakterek nélkül */
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let kod = "";
  const b = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) kod += abc[b[i] % abc.length];

  try {
    await L.rpc("admin_reset_begin", { p_secret: L.LINK_SECRET, p_code_sha: sha(kod) });
  } catch (e) {
    const m = String(e.message || "");
    if (m.indexOf("TUL_GYAKORI") >= 0) {
      res.status(429).json({ error: "tul_gyakori", uzenet: "Tíz percen belül már kértél kódot. Nézd meg a postaládád." });
      return;
    }
    res.status(500).json({ error: "db", uzenet: "Nem sikerült elindítani a jelszócserét." });
    return;
  }

  const base = L.origin(req);
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM, to: [TO],
        subject: "gta6 értesítő — admin jelszó visszaállítása",
        text:
          "Valaki új admin jelszót kért a térképhez.\n\n" +
          "A kód:  " + kod + "\n\n" +
          "Írd be a moderációs oldalon, és adj meg egy új jelszót.\n" +
          "A kód 20 percig érvényes, és 5 hibás próbálkozás után lejár.\n\n" +
          base + "/admin.html\n\n" +
          "Ha nem te kérted, nincs teendőd: a kód nélkül a jelszó nem változik."
      })
    });
    if (!r.ok) {
      res.status(502).json({ error: "email", uzenet: "A levelet nem sikerült elküldeni." });
      return;
    }
  } catch (e) {
    res.status(502).json({ error: "email", uzenet: "A levelet nem sikerült elküldeni." });
    return;
  }

  res.status(200).json({ ok: true, elkuldve: true });
};
