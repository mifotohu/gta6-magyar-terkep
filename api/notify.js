/* Értesítő e-mail, ha teendő érkezik a moderációra.
   A levelet csak akkor küldjük, ha a szerver maga látja, hogy van nyitott
   teendő, és legalább 15 perc eltelt az előző levél óta — így hiába hívja
   bárki ezt a végpontot, nem lehet vele levélözönt indítani. */
const L = require("./_lib.js");

const RESEND_KEY = process.env.RESEND_API_KEY;
const TO = process.env.NOTIFY_TO;
const FROM = process.env.NOTIFY_FROM || "GTA VI Magyar Terkep <onboarding@resend.dev>";
const SUBJECT = process.env.NOTIFY_SUBJECT || "gta6 értesítő";

module.exports = async function (req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  if (!L.configured() || !RESEND_KEY || !TO) {
    res.status(200).json({ ok: true, skipped: "nincs_beallitva" });
    return;
  }

  let rows;
  try {
    rows = await L.rpc("notify_pending", { p_secret: L.LINK_SECRET });
  } catch (e) {
    res.status(200).json({ ok: true, skipped: "db" });
    return;
  }
  const s = Array.isArray(rows) ? rows[0] : null;
  if (!s) { res.status(200).json({ ok: true, skipped: "nincs_adat" }); return; }

  const jelentes = Number(s.jelentes || 0);
  const kep = Number(s.kep || 0);
  if (!s.kuldheto || (jelentes + kep) === 0) {
    res.status(200).json({ ok: true, skipped: "nincs_teendo_vagy_korai" });
    return;
  }

  const base = L.origin(req);
  const sorok = [];
  if (kep) sorok.push("Hitelesítésre váró képek: " + kep);
  if (jelentes) sorok.push("Nyitott jelentések: " + jelentes);
  const szoveg =
    "Teendő érkezett a GTA VI magyar térképre.\n\n" +
    sorok.join("\n") + "\n\n" +
    "Moderációs felület: " + base + "/admin.html\n" +
    "Térkép: " + base + "/\n\n" +
    "Ezt a levelet az oldal küldte automatikusan. Egy értesítés után 15 percig nem küld újat.";

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [TO], subject: SUBJECT, text: szoveg })
    });
    if (!r.ok) {
      const t = await r.text();
      res.status(200).json({ ok: false, error: "email", reszlet: t.slice(0, 200) });
      return;
    }
  } catch (e) {
    res.status(200).json({ ok: false, error: "email" });
    return;
  }

  try { await L.rpc("notify_sent", { p_secret: L.LINK_SECRET }); } catch (e) { }
  res.status(200).json({ ok: true, elkuldve: true, kep: kep, jelentes: jelentes });
};
