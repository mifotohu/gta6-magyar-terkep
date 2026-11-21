/* Az aktív bannerek listája. Bárhonnan hívható (más oldalról is),
   ezért nyitott CORS — csak nyilvános hirdetési adatot ad vissza. */
const L = require("./_lib.js");

module.exports = async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (!L.configured()) { res.status(200).json({ delay: 4000, banners: [] }); return; }

  const base = L.origin(req);
  let lista = [], delay = 4000;
  try {
    lista = await L.rpc("banners_public", {}) || [];
  } catch (e) {
    res.status(200).json({ delay: delay, banners: [] });
    return;
  }
  try {
    const cfg = await L.select("site_config", "banner_delay_ms");
    if (cfg && cfg[0] && cfg[0].banner_delay_ms) delay = Number(cfg[0].banner_delay_ms);
  } catch (e) { }

  res.status(200).json({
    delay: delay,
    banners: lista.map(function (b) {
      return {
        id: b.id,
        image: b.image,
        alt: b.alt || "Hirdetés",
        /* a kattintás a saját átirányítónkon megy át, így mérhető */
        url: b.link ? base + "/api/b/" + b.id : null
      };
    })
  });
};
