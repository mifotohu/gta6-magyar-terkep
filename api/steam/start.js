/* A Steam-bejelentkezés indítása. A böngésző elküldi a saját titkos tokenjét,
   mi egy egyszer használatos azonosítót kötünk hozzá, és visszaadjuk a Steam URL-t. */
const L = require("../_lib.js");
const crypto = require("crypto");

module.exports = async function (req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method", uzenet: "Csak POST." });
    return;
  }
  if (!L.configured()) {
    res.status(503).json({ error: "nincs_beallitva", uzenet: "A szerver még nincs beállítva." });
    return;
  }
  if (!L.steamConfigured()) {
    res.status(503).json({
      error: "nincs_steam_kulcs",
      uzenet: "A Steam-hitelesítés még nincs bekapcsolva ezen az oldalon."
    });
    return;
  }

  const body = await L.readJson(req);
  const token = String(body.token || "");
  if (!L.UUID.test(token)) {
    res.status(400).json({ error: "rossz_token", uzenet: "Előbb jelöld be magad a térképen." });
    return;
  }

  const nonce = crypto.randomUUID();
  try {
    await L.rpc("steam_begin", { p_secret: L.LINK_SECRET, p_token: token, p_nonce: nonce });
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.indexOf("ELOBB_JELOLD_BE_MAGAD") >= 0) {
      res.status(400).json({ error: "nincs_fan", uzenet: "Előbb jelöld be magad a térképen." });
      return;
    }
    res.status(500).json({ error: "db", uzenet: "Nem sikerült elindítani a hitelesítést." });
    return;
  }

  const base = L.origin(req);
  const returnTo = base + "/api/steam/return?n=" + encodeURIComponent(nonce);
  const p = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": base,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select"
  });

  res.status(200).json({ url: "https://steamcommunity.com/openid/login?" + p.toString() });
};
