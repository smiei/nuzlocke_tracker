# SoulLink Nuzlocke Tracker

Self-hosted web app for tracking Pokémon Nuzlocke runs – as a two-player SoulLink or solo (Classic). Runs as a Docker container, all data is stored locally in SQLite.

> **Disclaimer:** This is an unofficial fan project and is not affiliated with, endorsed by, or connected to Nintendo, Game Freak, Creatures Inc., or The Pokémon Company in any way. Pokémon names, game data, and artwork are the property of their respective owners. This repository and the published Docker image deliberately contain **no** copyrighted artwork: Pokémon sprites are fetched from [PokeAPI](https://github.com/PokeAPI/sprites) at setup time, trainer images are provided by the user. This project is strictly non-commercial.

## Tech stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Prisma 6 + SQLite
- Docker / Docker Compose

## Features (tabs)

- **Encounter**: catch one Pokémon per route (and player), with the catch-time status (Caught/Killed/Fled) and an optional nickname. Static locations are pre-marked from the data files. Species Clause conflicts show a warning without ever blocking a save; post-game areas are collapsed by default; an "open only" toggle hides completed routes and SoulLink rows missing one player's entry are tinted as a reminder.
- **Pokémon**: the active 6-slot team plus all links/catches as cards, "mark as dead" (with undo; the catch-time status stays untouched), evolve/devolve incl. evolution methods, a glowing evolve button when a level evolution is reachable within the earned level cap, an "evolvable only" filter, sorting by encounter order or BST (dead links always sink to the end).
- **Type Effectiveness**: weaknesses/resistances of any Pokémon (defender's perspective) plus the full Gen 3 type matrix.
- **Catchrate**: catch chance calculator (Gen 3 formula) with ball, HP, level, and status condition inputs.
- **Pokédex**: sortable table with rank (by base-stat total, standard competition ranking), search with suggestions and scroll-to-row.
- **Journey**: boss battles (gym leaders, rival, Team Rocket, Elite Four) with level caps, click to mark as defeated.
- **Rules**: per-run rule toggles (Species Clause on/off, nicknames, ROM/randomizer evolution overrides, static encounters and their clause exemption) plus a markdown section for house rules & notes, editable right in the browser; new runs inherit both from the most recent run. All toggles are informational/UI-level – the server never rejects a save because of them.
- **Multiple runs**: fully separate progress per run (SoulLink or solo); switch and create via the header, rename/delete plus backup and settings behind the header gear menu.
- **Backup & import**: export the current run or all runs as a JSON file; import adds the contained runs (including team assignments, rules, rule settings, and nicknames) without ever overwriting existing data.
- **Bilingual**: UI, Pokémon, route, and trainer names switchable between German and English (top right).

## First-time setup (local development)

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run download:sprites
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### npm scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` / `npm run start` | Production build / start |
| `npm run download:sprites` | Downloads all Pokémon sprites (Gen 3 Emerald style) once from PokeAPI into `public/pokemon-sprites/`. **Must be run once after `npm install`** – the sprites are deliberately not part of this repo (copyrighted artwork, see `.gitignore`). Without this step, Pokémon images are missing across the UI. Re-run if `data/pokemon.json` changes. |
| `npm run generate:evolutions` | Regenerates `data/evolutions.json` (evolution lines incl. evolution methods: level/item/trade/friendship) from PokeAPI. Already included in the repo – only needed when `data/pokemon.json` changes. ROM-specific evolution changes (e.g. from a randomizer's "change impossible evolutions") live in `data/evolution-overrides.json` and are merged at runtime, so they survive regeneration. |
| `npm run download:catchrates` | Regenerates `data/catchrates.json` (base catch rates for the Catchrate tab) from PokeAPI. Already included in the repo – only needed when `data/pokemon.json` changes. |
| `npm run lint` | ESLint |

The download scripts need internet access once (PokeAPI); after that the app runs fully offline.

### Trainer sprites (optional, manual)

The Journey page can show trainer avatars from `public/trainers/<slug>.png` (circular avatar next to the name). There is no automated, legally clean source for these – if a file is missing, an initial-letter placeholder is shown instead. The expected file names are listed in `public/trainers/README.txt`. These images are not part of the repo or the Docker image; provide them yourself.

## Static data

`data/routes.json`, `data/pokemon.json`, `data/levelcaps.json`, `data/evolutions.json`, `data/evolution-overrides.json`, `data/effectiveness.json`, and `data/catchrates.json` are read straight from disk at runtime (not copied into the database). Edits take effect immediately, even inside a running Docker container, without a rebuild. (Exception: the statically pre-rendered Pokédex/Type Effectiveness pages bake their data in at build time.)

Route entries carry a `type` (`"route"` = regular wild encounter, `"static"` = fixed encounter such as gifts, fossils, Snorlax, legendaries – exempt from the Species Clause) and an optional `"postgame": true` flag (collapsed by default on the Encounter tab).

## Docker

```bash
docker compose up --build
```

- The SQLite database lives in a named volume (`db-data`) and survives rebuilds/restarts.
- `data/` is mounted read-only into the container – routes/Pokémon/milestones/evolutions can be edited without rebuilding the image.
- Database migrations run automatically on container start (`docker-entrypoint.sh`).
- **Sprites are not part of the image** (copyrighted artwork, public registry). On first start the entrypoint downloads the Pokémon sprites from PokeAPI into `/app/public/pokemon-sprites` (one-time internet access needed; a volume mount persists them across updates). Trainer sprites are user-provided via the `/app/public/trainers` mount.

### Volume layout (e.g. Unraid)

| Container path | Purpose |
| --- | --- |
| `/app/db` | SQLite database (required) |
| `/app/public/pokemon-sprites` | Pokémon sprites – auto-filled on first start, persists across image updates (recommended) |
| `/app/public/ball-sprites` | Poké Ball item sprites – auto-filled on first start (optional; simply re-downloaded when missing) |
| `/app/public/trainers` | Trainer avatars – place your own `<slug>.png` files here (optional) |
| `/app/data` | Static reference data override (optional; omit to use the data baked into the image) |

Required environment variable: `DATABASE_URL=file:/app/db/nuzlocke.db`. The app listens on container port `3000`.

## Database migrations

```bash
npx prisma migrate dev --name <description>
```

creates and applies a new migration locally. In Docker, pending migrations are applied automatically on container start (`prisma migrate deploy`).
