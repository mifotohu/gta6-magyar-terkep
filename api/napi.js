/* Napi futás a Vercel ütemezőjéből:
   1. hétfőnként mentést küld e-mailben az adatbázis tartalmáról,
   2. frissíti a Steamhez kötött óraszámokat (ha be van kapcsolva).
   Csak a Vercel hívhatja, a CRON_SECRET-tel. */
const L = require("./_lib.js");

const RESEND_KEY = process.env.RESEND_API_KEY;
const TO = process.env.NOTIFY_TO;
const FROM = process.env.NOTIFY_FROM || "GTA VI Magyar Terkep <onboarding@resend.dev>";

async function mentes(base) {
  if (!RESEND_KEY || !TO) return { skipped: "nincs_email" };

  let adat;
  try {
    adat = await L.rpc("backup_dump", { p_secret: L.LINK_SECRET });
  } catch (e) {
    return { error: "db" };
  }

  const szoveg = JSON.stringify(adat, null, 1);
  const base64 = Buffer.from(szoveg, "utf8").toString("base64");
  const nap = new Date().toISOString().slice(0, 10);
  const db = (adat && adat.fans ? adat.fans.length : 0);

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      subject: "gta6 értesítő — heti mentés (" + nap + ")",
      text:
        "Mellékelve a heti mentés a térkép adatairól.\n\n" +
        "Bejelölt rajongó: " + db + "\n" +
        "Méret: " + Math.round(szoveg.length / 1024) + " KB\n\n" +
        "A fájl JSON formátumú, bármikor visszatölthető. Képeket és titkos\n" +
        "azonosítókat nem tartalmaz.\n\n" + base + "/",
      attachments: [{ filename: "gta6-mentes-" + nap + ".json", content: base64 }]
    })
  });
  if (!r.ok) {
    const t = await r.text();
    return { error: "email", reszlet: t.slice(0, 200) };
  }
  return { ok: true, meret_kb: Math.round(szoveg.length / 1024), rajongok: db };
}

async function steamFrissites() {
  if (!L.steamConfigured()) return { skipped: "nincs_steam" };
  let rows = [];
  try {
    rows = await L.rpc("steam_accounts", { p_secret: L.LINK_SECRET }) || [];
  } catch (e) {
    return { error: "db" };
  }
  let frissitve = 0, hiba = 0;
  for (const acc of rows.slice(0, 300)) {
    try {
      const got = await L.steamHours(acc.steam_id);
      if (got.error) { hiba++; continue; }
      await L.rpc("steam_update", { p_secret: L.LINK_SECRET, p_fan_id: acc.fan_id, p_hours: got.hours });
      frissitve++;
    } catch (e) { hiba++; }
  }
  return { osszes: rows.length, frissitve: frissitve, hiba: hiba };
}

module.exports = async function (req, res) {
  const auth = req.headers.authorization || "";
  if (!process.env.CRON_SECRET || auth !== "Bearer " + process.env.CRON_SECRET) {
    res.status(401).json({ error: "nincs_jogosultsag" });
    return;
  }
  if (!L.configured()) { res.status(200).json({ ok: true, skipped: "nincs_beallitva" }); return; }

  const base = L.origin(req);
  const hetfo = new Date().getUTCDay() === 1;
  const ki = { hetfo: hetfo };

  if (hetfo || req.headers["x-mentes-most"]) {
    ki.mentes = await mentes(base);
  }
  ki.steam = await steamFrissites();

  res.status(200).json(ki);
};
