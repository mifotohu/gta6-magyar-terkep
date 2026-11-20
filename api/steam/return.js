/* A Steam ide irányít vissza. Ellenőrizzük az állítást a Steamnél, lekérjük a
   játékidőt, elmentjük, majd visszaküldjük a látogatót a térképre. */
const L = require("../_lib.js");

function back(res, base, code) {
  res.writeHead(302, { Location: base + "/?steam=" + code });
  res.end();
}

module.exports = async function (req, res) {
  const base = L.origin(req);
  const url = new URL(req.url, base);
  const query = {};
  url.searchParams.forEach(function (v, k) { query[k] = v; });

  if (!L.configured() || !L.steamConfigured()) return back(res, base, "nincs_beallitva");

  const nonce = String(query.n || "");
  if (!nonce) return back(res, base, "lejart");

  if (String(query["openid.mode"] || "") === "cancel") return back(res, base, "megszakitva");

  let steamId = null;
  try {
    steamId = await L.verifyOpenId(query);
  } catch (e) {
    return back(res, base, "steam_hiba");
  }
  if (!steamId) return back(res, base, "nem_hiteles");

  const got = await L.steamHours(steamId);
  if (got.error) return back(res, base, got.error);

  const persona = await L.steamPersona(steamId);

  try {
    await L.rpc("steam_finish", {
      p_secret: L.LINK_SECRET,
      p_nonce: nonce,
      p_steam_id: steamId,
      p_persona: persona,
      p_hours: got.hours
    });
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.indexOf("STEAM_MAR_FOGLALT") >= 0) return back(res, base, "mar_foglalt");
    if (msg.indexOf("LEJART_KERES") >= 0) return back(res, base, "lejart");
    return back(res, base, "db");
  }

  back(res, base, "ok");
};
