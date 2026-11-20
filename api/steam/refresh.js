/* „Frissítés a Steamről" gomb: a saját tokenjével bárki újralekérheti a saját óráit. */
const L = require("../_lib.js");

module.exports = async function (req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method" });
    return;
  }
  if (!L.configured() || !L.steamConfigured()) {
    res.status(503).json({ error: "nincs_beallitva", uzenet: "A Steam-hitelesítés nincs bekapcsolva." });
    return;
  }

  const body = await L.readJson(req);
  const token = String(body.token || "");
  if (!L.UUID.test(token)) {
    res.status(400).json({ error: "rossz_token" });
    return;
  }

  let rows;
  try {
    rows = await L.rpc("steam_account_of", { p_secret: L.LINK_SECRET, p_token: token });
  } catch (e) {
    res.status(500).json({ error: "db" });
    return;
  }
  const acc = Array.isArray(rows) ? rows[0] : null;
  if (!acc) {
    res.status(404).json({ error: "nincs_osszekotve", uzenet: "Ehhez a bejegyzéshez nincs Steam-fiók kötve." });
    return;
  }

  const got = await L.steamHours(acc.steam_id);
  if (got.error) {
    res.status(400).json({ error: got.error, uzenet: hiba(got.error) });
    return;
  }

  try {
    await L.rpc("steam_update", { p_secret: L.LINK_SECRET, p_fan_id: acc.fan_id, p_hours: got.hours });
  } catch (e) {
    res.status(500).json({ error: "db" });
    return;
  }
  res.status(200).json({ ok: true, hours: got.hours });
};

function hiba(code) {
  if (code === "privat") return "A Steam-profilodon a játékidő nem publikus.";
  if (code === "nincs_jatek") return "Nem találjuk a GTA VI-ot a Steam-könyvtáradban.";
  return "A Steam most nem válaszol. Próbáld később.";
}
