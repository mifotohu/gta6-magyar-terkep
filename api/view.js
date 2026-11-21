/* Megjelenés számolása. Oldalbetöltésenként és bannerenként egyszer hívja a kliens. */
const L = require("./_lib.js");

module.exports = async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  if (!L.configured()) { res.status(200).json({ ok: true }); return; }

  const body = await L.readJson(req);
  const id = String(body.id || "");
  if (!L.UUID.test(id)) { res.status(200).json({ ok: true }); return; }

  try {
    await L.rpc("banner_bump", { p_secret: L.LINK_SECRET, p_id: id, p_kind: "nezes" });
  } catch (e) { }
  res.status(200).json({ ok: true });
};
