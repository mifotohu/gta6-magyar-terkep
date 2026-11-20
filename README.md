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

## Moderáció

A látogatók a térkép helyi listájából jelenthetnek egy bejegyzést (ok + opcionális
megjegyzés, névtelenül, hálózatonként egyszer bejegyzésenként, naponta 20 jelentésig).

Az `admin.html` jelszóval véd. **Az első megnyitáskor te állítod be a jelszót**, utána
a beállítás véglegesen lezárul. A szerver csak a jelszó SHA-256 lenyomatát tárolja, és
minden admin hívásnál külön ellenőrzi — a felület elrejtése önmagában semmit nem véd.
Hálózatonként óránként 10 hibás próbálkozás után zár.

Elfelejtett jelszó esetén a Supabase SQL-szerkesztőjéből törölhető az `admin_keys`
tábla egyetlen sora, utána újra beállítható.

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
