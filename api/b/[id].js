/* Kattintás-átirányító: /api/b/<banner id> megszámolja a kattintást,
   majd továbbküld a hirdető oldalára. Így a mérés akkor is működik,
   ha a banner egy másik weboldalon van kirakva. */
const L = require("../_lib.js");

module.exports = async function (req, res) {
  const base = L.origin(req);
  const id = (req.query && req.query.id) ? String(req.query.id) : "";

  if (!L.configured() || !L.UUID.test(id)) {
    res.writeHead(302, { Location: base + "/" });
    res.end();
    return;
  }

  let cel = null;
  try {
    cel = await L.rpc("banner_target", { p_secret: L.LINK_SECRET, p_id: id });
  } catch (e) {
    cel = null;
  }

  /* csak https címre irányítunk tovább, hogy ne lehessen nyitott átirányítót csinálni belőle */
  if (typeof cel === "string" && cel.indexOf("https://") === 0) {
    res.writeHead(302, { Location: cel, "Cache-Control": "no-store" });
  } else {
    res.writeHead(302, { Location: base + "/", "Cache-Control": "no-store" });
  }
  res.end();
};
