# GTA VI Magyar Térkép

Magyar GTA VI rajongói térkép. Bárki bejelölheti magát — **város, Budapesten kerület**
pontossággal, utcáig soha —, megadhatja, hány órát játszott, és láthatja az élő
toplistákat, a megye-versenyt és a hőtérképet.

Nem hivatalos rajongói oldal; nem áll kapcsolatban a Rockstar Games-szel vagy a
Take-Two Interactive-val.

## Mi van benne

| Oldal | Mit csinál |
|---|---|
| `index.html` | A térkép, a bejelölő űrlap, toplisták, crew-k, ID-kártya, beágyazó kód |
| `stats.html` | Napi összóra-görbe, hőtérkép, megye-verseny, platform- és rangmegoszlás |
| `embed.html` | Beágyazható mini-térkép `<iframe>`-be, csak olvas |
| `admin.html` | Moderáció: jelentések, rajongók, crew-k — admin jelszóval |

Funkciók: pontok városonként/kerületenként csoportosítva, zoom és húzás, Budapest-nagyítás
a 23 kerülethatárral, hőtérkép 10 000 lakosra vetítve, heti óraszám-változás,
rangok (Újonc → Leonida Veterán), crew-k saját színnel, élő jelenlét („ki nézi most"),
letölthető ID-kártya story-méretben.

## Felépítés

Statikus oldal, build nélkül. Nincs keretrendszer; egyetlen külső függőség a
`@supabase/supabase-js` CDN-ről.

```
index.html, stats.html, embed.html
assets/
  style.css      a teljes megjelenés
  data.js        települések, kerületek, lakosságszámok, rangok, vetítés
  counties.js    a 19 megye + Budapest körvonala (OpenStreetMap, ODbL)
  districts.js   a 23 budapesti kerület határa (OpenStreetMap, ODbL)
  map.js         térképkomponens (pontok, hőtérkép, zoom, megyebesorolás)
  core.js        Supabase-kapcsolat, eszköz-token, API-hívások
  app.js         a főoldal logikája
  stats.js       a statisztika-aloldal
  embed.js       a beágyazható térkép
```

## Adatbázis (Supabase)

Bejelentkezés nincs. Minden látogató kap egy titkos UUID-t a böngészőjében
(`localStorage`), és **minden írás szerveroldali függvényen megy át**, ami ezt
a tokent ellenőrzi. A táblákba közvetlenül senki nem írhat.

| Tábla | Tartalom |
|---|---|
| `fans` | egy sor rajongónként: becenév, hely, óraszám, platform, üzenet, crew |
| `fan_secrets` | a fan-hez tartozó titkos token és egy visszafejthetetlen IP-lenyomat (csak a visszaélés-szűréshez); **az API-n keresztül senki nem olvashatja** |
| `crews` | klánok névvel és színnel |
| `crew_secrets` | a crew alapítójának tokenje |
| `hour_log` | minden óraszám-változás, automatikus trigger írja |
| `reports` | jelentések (ok, megjegyzés, IP-lenyomat); az API-n át olvashatatlan |
| `admin_keys` | az admin jelszó SHA-256 lenyomata, egyetlen sor; olvashatatlan |
| `admin_attempts` | hibás admin próbálkozások a brute force szűréséhez |

Nézetek és függvények: `daily_totals` (napi összóra), `weekly_deltas()` (heti változás),
`save_fan()`, `delete_fan()`, `my_fan()`, `create_crew()`.

Védelem: RLS minden táblán, olvasás mindenkinek, írás kizárólag az RPC-ken át,
IP-nként legfeljebb 5 új bejelölés naponta, szerveroldali hossz- és
értékellenőrzés minden mezőre.

## Hitelesítés képernyőképpel

Steam-fiók nélkül, minden platformon működik. A játékos feltölt egy képernyőképet
a játékidejéről; a böngésző **kicsinyíti és JPEG-be tömöríti** (max 1280 px, ~20–200 KB),
majd a kép a privát `proofs` táblába kerül data URI-ként. Nincs tárhely-bucket,
nincs publikus képlink: a képet csak az admin felület látja, és **elbírálás után
azonnal töröljük** (a sor marad, a kép helye kiürül).

Elfogadáskor a bejegyzés óraszáma a képen látott értékre áll, és `✓ igazolt`
jelvényt kap. Ha a játékos utána kézzel átírja az óraszámát, a jelvény magától lekerül.

Korlátok: egyszerre egy függőben lévő kép játékosonként, hálózatonként napi 5 beküldés,
legfeljebb ~650 KB kép.

## Moderáció

A látogatók a térkép helyi listájából jelenthetnek egy bejegyzést (ok + opcionális
megjegyzés, névtelenül, hálózatonként egyszer bejegyzésenként, naponta 20 jelentésig).

Az `admin.html` jelszóval véd. **Az első megnyitáskor te állítod be a jelszót**, utána
a beállítás véglegesen lezárul. A szerver csak a jelszó SHA-256 lenyomatát tárolja, és
minden admin hívásnál külön ellenőrzi — a felület elrejtése önmagában semmit nem véd.
Hálózatonként óránként 10 hibás próbálkozás után zár.

Elfelejtett jelszó esetén a Supabase SQL-szerkesztőjéből törölhető az `admin_keys`
tábla egyetlen sora, utána újra beállítható.

## Steam-hitelesítés

PC-s játékos összekötheti a Steam-fiókját; onnantól a valódi játékideje látszik
`✓ Steam` jelvénnyel, és kézzel nem írható át. A folyamat **Steam OpenID** —
a játékos a Steamen lép be, így bizonyítja, hogy övé a fiók; profil-URL beírásával
nem lehet más óraszámát ellopni.

Szerverfüggvények (Vercel, `api/`):

| Végpont | Mit csinál |
|---|---|
| `POST /api/steam/start` | egyszer használatos azonosítót köt a látogató tokenjéhez, visszaadja a Steam belépő URL-t |
| `GET /api/steam/return` | a Steam ide tér vissza; ellenőrzi az állítást a Steamnél, lekéri a játékidőt, elmenti |
| `POST /api/steam/refresh` | a játékos kézi frissítése |
| `GET /api/steam/cron` | napi 04:00-kor minden összekötött fiókot frissít (`CRON_SECRET`) |

A SteamID a privát `fan_steam` táblában marad, az API-n át nem olvasható; kifelé
csak az óraszám és a hitelesítés ténye látszik. Egy Steam-fiók egy bejegyzéshez köthető.

Környezeti változók a Vercel projektben:

| Név | Mire kell |
|---|---|
| `STEAM_API_KEY` | **neked kell beállítani**, a steamcommunity.com/dev/apikey oldalról |
| `LINK_SECRET` | belső titok a szerverfüggvények és az adatbázis között |
| `CRON_SECRET` | a napi frissítés hitelesítése |
| `SUPABASE_URL`, `SUPABASE_KEY` | ugyanaz, mint a böngészőben |
| `GTA6_GAME_NAME` | a játék neve a Steam-könyvtárban (alapértelmezés: Grand Theft Auto VI) |
| `GTA6_APPID` | opcionális; ha meg van adva, név helyett ez alapján keresünk |

`STEAM_API_KEY` nélkül a gomb udvariasan jelzi, hogy a hitelesítés nincs bekapcsolva;
minden más működik.

## Beállítás

A Supabase URL és a publikus kulcs mindhárom HTML-ben, a `window.GTA_CONFIG`
blokkban van. A kulcs böngészőbe szánt publikus kulcs — nem titok, önmagában
semmit nem enged, amit az RLS nem engedne.

## Helyi futtatás

Bármilyen statikus kiszolgáló megteszi, pl.:

```
npx serve .
```

A `file://` megnyitás nem elég, mert a böngésző blokkolja a hálózati hívásokat.

## Adatforrások

- Megye- és kerülethatárok: © OpenStreetMap közreműködők, ODbL
- Lakosságszámok: kerekített KSH-alapú becslések a „10 000 lakosra" mutatóhoz
