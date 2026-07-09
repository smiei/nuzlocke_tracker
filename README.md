# SoulLink Nuzlocke Tracker

Self-hosted Web-App zum Tracken eines Pokémon SoulLink Random Nuzlocke Runs für zwei Spieler. Läuft als Docker-Container, Daten liegen lokal in SQLite.

## Tech-Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Prisma 6 + SQLite
- Docker / Docker Compose

## Features

- **Tracker**: pro Route und Spieler ein Pokémon fangen, Status (Gefangen/Getötet/Geflohen), Species-Clause-Warnung inklusive Static-Ausnahme.
- **Links**: aktive SoulLinks als Kacheln, "Als tot markieren" (mit Rückgängig), Entwickeln/Zurückentwickeln (auch bei Verzweigungen wie Evoli).
- **Pokédex**: sortierbare Tabelle mit Rang (nach Gesamt-Statuswert, Standard-Wettkampf-Ranking), Suche mit Vorschlägen + Scroll-zu-Zeile.
- **Level Caps**: Gegner-Übersicht, per Klick als besiegt markierbar.
- **Mehrere Runs**: pro Run komplett getrennter Fortschritt, Wechsel/Anlegen/Löschen über das Dropdown im Header.

## Erste Einrichtung

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run download:sprites
npm run dev
```

Danach [http://localhost:3000](http://localhost:3000) öffnen.

### Die npm-Skripte

| Skript | Zweck |
| --- | --- |
| `npm run dev` | Dev-Server mit Hot Reload |
| `npm run build` / `npm run start` | Produktions-Build / -Start |
| `npm run download:sprites` | Lädt alle Pokémon-Sprites (Gen-3-Emerald-Stil) einmalig von der PokéAPI herunter und speichert sie lokal unter `public/pokemon-sprites/`. **Muss nach `npm install` einmal manuell laufen** – die Sprites sind bewusst nicht im Git-Repo (siehe `.gitignore`), damit keine 386 Bilddateien versioniert werden. Ohne diesen Schritt fehlen im UI überall die Pokémon-Bilder. Erneut ausführen, falls `data/pokemon.json` sich ändert (z. B. neue Einträge). |
| `npm run generate:evolutions` | Erzeugt `data/evolutions.json` (Entwicklungslinien) aus der PokéAPI. Ist bereits im Repo enthalten – nur nötig, wenn sich `data/pokemon.json` ändert und die Entwicklungsdaten neu abgeglichen werden müssen. |
| `npm run lint` | ESLint |

Beide Download-Skripte brauchen einmalig Internetzugriff (PokéAPI); die App selbst läuft danach komplett offline/lokal.

### Trainer-Sprites (optional, manuell)

Für die Level-Caps-Seite können eigene Trainer-Bilder unter `public/trainers/<name>.png` abgelegt werden (Kreis-Avatar neben dem Namen). Es gibt dafür keine automatisierte Quelle – fehlt eine Datei, wird stattdessen ein Anfangsbuchstaben-Platzhalter angezeigt. Erwartete Dateinamen stehen in `public/trainers/LIESMICH.txt`.

## Statische Daten

`data/routes.json`, `data/pokemon.json`, `data/levelcaps.json` und `data/evolutions.json` werden zur Laufzeit direkt von der Festplatte gelesen (nicht in die Datenbank kopiert). Änderungen daran wirken sofort, auch im laufenden Docker-Container, ohne Rebuild.

## Docker

```bash
docker compose up --build
```

- SQLite-Datenbank liegt in einem benannten Docker-Volume (`db-data`) und übersteht Rebuilds/Neustarts.
- `data/` wird read-only in den Container gemountet – Routen/Pokémon/Level-Caps/Entwicklungen lassen sich also editieren, ohne das Image neu zu bauen.
- Datenbank-Migrationen laufen automatisch beim Container-Start (`docker-entrypoint.sh`).
- Pokémon-Sprites sind fest im Image gebacken (kein Internetzugriff zur Laufzeit nötig).

## Datenbank-Migrationen

```bash
npx prisma migrate dev --name <beschreibung>
```

erzeugt und wendet eine neue Migration lokal an. In Docker werden ausstehende Migrationen beim Start automatisch angewendet (`prisma migrate deploy`).
