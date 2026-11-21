/* Be van-e kapcsolva a Steam-hitelesítés ezen a telepítésen?
   Csak igen/nem; semmilyen kulcsot nem árul el. */
const L = require("../_lib.js");

module.exports = async function (req, res) {
  res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
  res.status(200).json({ enabled: L.configured() && L.steamConfigured() });
};
