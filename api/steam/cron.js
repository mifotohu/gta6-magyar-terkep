/* Napi futás: minden összekötött fiók óraszámát frissíti a Steamről.
   Csak a Vercel ütemezője hívhatja, a CRON_SECRET-tel. */
const L = require("../_lib.js");

module.exports = async function (req, res) {
  const auth = req.headers.authorization || "";
  const expected = "Bearer " + (process.env.CRON_SECRET || "");
  if (!process.env.CRON_SECRET || auth !== expected) {
    res.status(401).json({ error: "nincs_jogosultsag" });
    return;
  }
  if (!L.configured() || !L.steamConfigured()) {
    res.status(200).json({ ok: true, skipped: "nincs_beallitva" });
    return;
  }

  let rows = [];
  try {
    rows = await L.rpc("steam_accounts", { p_secret: L.LINK_SECRET }) || [];
  } catch (e) {
    res.status(500).json({ error: "db" });
    return;
  }

  let frissitve = 0, hiba = 0;
  for (const acc of rows.slice(0, 300)) {
    try {
      const got = await L.steamHours(acc.steam_id);
      if (got.error) { hiba++; continue; }
      await L.rpc("steam_update", { p_secret: L.LINK_SECRET, p_fan_id: acc.fan_id, p_hours: got.hours });
      frissitve++;
    } catch (e) {
      hiba++;
    }
  }

  res.status(200).json({ ok: true, osszes: rows.length, frissitve: frissitve, hiba: hiba });
};
