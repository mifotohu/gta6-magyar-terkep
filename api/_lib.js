/* Közös segédek a Steam-hitelesítéshez.
   A Steam API kulcs és a belső titok csak itt, a szerveren létezik. */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const LINK_SECRET = process.env.LINK_SECRET;
const STEAM_API_KEY = process.env.STEAM_API_KEY;
const GAME_NAME = (process.env.GTA6_GAME_NAME || "Grand Theft Auto VI").toLowerCase();
const GAME_APPID = process.env.GTA6_APPID ? String(process.env.GTA6_APPID) : null;

function configured() {
  return !!(SUPABASE_URL && SUPABASE_KEY && LINK_SECRET);
}
function steamConfigured() {
  return !!STEAM_API_KEY;
}

/* Supabase tárolt eljárás hívása */
async function rpc(name, args) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(args)
  });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error(text || ("Supabase hiba: " + r.status));
    err.status = r.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

/* egyszerű olvasás egy táblából */
async function select(table, cols) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + table + "?select=" + encodeURIComponent(cols), {
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
  });
  if (!r.ok) throw new Error("select " + r.status);
  return r.json();
}

function origin(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return proto + "://" + host;
}

/* Steam OpenID 2.0: a visszakapott állítás ellenőrzése a Steamnél */
async function verifyOpenId(query) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (k.startsWith("openid.")) body.append(k, Array.isArray(v) ? v[0] : v);
  }
  body.set("openid.mode", "check_authentication");

  const r = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  const text = await r.text();
  if (!/is_valid\s*:\s*true/i.test(text)) return null;

  const claimed = String(query["openid.claimed_id"] || "");
  const m = claimed.match(/\/openid\/id\/(\d{17})$/);
  return m ? m[1] : null;
}

/* Játékidő lekérése a Steamről. Visszatérés: {hours} vagy {error} */
async function steamHours(steamId) {
  const url = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=" +
    encodeURIComponent(STEAM_API_KEY) + "&steamid=" + encodeURIComponent(steamId) +
    "&include_appinfo=1&include_played_free_games=1";
  const r = await fetch(url);
  if (!r.ok) return { error: "steam_api" };
  const data = await r.json().catch(() => null);
  const games = data && data.response && data.response.games;
  if (!Array.isArray(games)) return { error: "privat" };

  const hit = games.find(function (g) {
    if (GAME_APPID) return String(g.appid) === GAME_APPID;
    return String(g.name || "").toLowerCase().trim() === GAME_NAME;
  });
  if (!hit) return { error: "nincs_jatek" };
  return { hours: Math.round((hit.playtime_forever || 0) / 60) };
}

async function steamPersona(steamId) {
  try {
    const r = await fetch("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=" +
      encodeURIComponent(STEAM_API_KEY) + "&steamids=" + encodeURIComponent(steamId));
    const d = await r.json();
    const p = d && d.response && d.response.players && d.response.players[0];
    return p ? String(p.personaname || "").slice(0, 64) : null;
  } catch (e) {
    return null;
  }
}

function readJson(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise(function (resolve) {
    let raw = "";
    req.on("data", function (c) { raw += c; });
    req.on("end", function () {
      try { resolve(JSON.parse(raw || "{}")); } catch (e) { resolve({}); }
    });
  });
}

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

module.exports = {
  SUPABASE_URL, SUPABASE_KEY, LINK_SECRET,
  configured, steamConfigured, rpc, select, origin,
  verifyOpenId, steamHours, steamPersona, readJson, UUID
};
