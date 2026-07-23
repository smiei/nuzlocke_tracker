# SoulLink Nuzlocke Tracker

Self-hosted web app for tracking Pokémon Nuzlocke runs – as a two-player SoulLink or solo (Classic). Runs as a Docker container, all data is stored locally in SQLite.

> **Disclaimer:** This is an unofficial fan project and is not affiliated with, endorsed by, or connected to Nintendo, Game Freak, Creatures Inc., or The Pokémon Company in any way. Pokémon names, game data, and artwork are the property of their respective owners. This repository and the published Docker image deliberately contain **no** copyrighted artwork: Pokémon sprites are fetched from [PokeAPI](https://github.com/PokeAPI/sprites) at setup time, trainer images are provided by the user. This project is strictly non-commercial.

## Tech stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Prisma 6 + SQLite
- Docker / Docker Compose

## Features (tabs)

- **Encounter**: catch one Pokémon per route (and player), with the catch-time status (Caught/Killed/Fled) and an optional nickname. Static locations are pre-marked from the data files. Species Clause conflicts show a warning without ever blocking a save; post-game areas are collapsed by default; an "open only" toggle hides completed routes and SoulLink rows missing one player's entry are tinted as a reminder. A 🗑 button clears a mistaken entry outright, an ℹ button opens the Pokémon detail card for the current pick, and a ✨ button marks a catch as shiny (Shiny Clause, when the rule is on) — a shiny is then exempt from the Species Clause and doesn't lock its family for others.
- **Pokémon**: the active 6-slot team plus all links/catches as cards, "mark as dead" (in SoulLink you pick which player lost their Pokémon; with undo; the catch-time status stays untouched), evolve/devolve incl. evolution methods, a glowing evolve button when a level evolution is reachable within the earned level cap, an "evolvable only" filter, sorting by encounter order, current BST, or fully-evolved **max** BST (dead links always sink to the end). New links and solo catches drop into a free team slot automatically while the team isn't full. Within a link card Player 1 is always shown above Player 2. A broken pair – one player caught, the other Fled/Killed – never appears here (the pair never formed); the surviving catch stays on the Encounter tab. Each card shows the link's combined BST now → fully-evolved max, and marking a link dead can record an optional cause of death (shown in the Memorial).
- **Battle & Catch**: enter a Pokémon once per card, then toggle between **Wild** and **Trainer**. *Wild* is the catch-chance calculator — ball, HP, level and status-condition inputs using the run's generation formula (Gen 1, Gen 2, Gen 3/4) and ball list; conditional balls (Repeat, Dusk, Dive, Fast, Love, Moon, …) have a "condition met?" checkbox with an explanation so the bonus only counts when it applies, and a "Pokémon caught?" dropdown records the pick as caught on an open route (dropping it into a free team slot), one per player in SoulLink. *Trainer* is the battle scout — the opponent's types, its damaging attack types by level, the full type matrix (Gen 1 chart included), and a team-matchup table showing how well each of your team's Pokémon resists that opponent's attacks, with a ⚠ flag for Self-Destruct/Explosion learners (from which level). Both views show the selected Pokémon's type weaknesses and an ℹ detail-card button, and a **+** adds another independent card. Uses the run's game (chart, dex, catch mechanics, level-up movesets, sprites).
- **TMs**: pick a move **by name** (not TM number – those are randomized) and see which of your living caught Pokémon can learn it via TM/HM or a move tutor, per the **official** game data. Because a randomizer re-rolls TM/tutor compatibility (the 90/50/25 rule), this is a clean reference / house rule ("TM compatibility follows the original games"), not the ROM's actual mapping. Split per player in SoulLink; TM vs HM vs tutor is labelled, and moves that aren't machine/tutor moves in the original game are flagged (with a level-up hint).
- **Pokédex**: sortable table with rank (by base-stat total, standard competition ranking), search with suggestions and scroll-to-row, and a filter to show only available or only locked (Species-Clause) Pokémon; click a row for a detail card with types, base stats, its rank, its type weaknesses (grouped 4×/2×/½×/¼×/0×), evolutions with their conditions (click any family member to jump to its own card), and the full level-up move list (real localized move names with their type). Reflects the current run's game (dex scope + sprites).
- **Journey**: boss battles (gym leaders, rival, Team Rocket, Elite Four) with level caps, click to mark as defeated.
- **Overview**: a per-run dashboard (total deaths, team BST now → fully-evolved max, current & next level cap; and per player: caught, missed encounters — your own fled/killed catches, so a partner catching on the same route never counts against you — link deaths this player caused, and that player's own team BST now → fully-evolved max), the team's type coverage — defensive weaknesses **and** offensive gaps (types the team can't hit super-effectively) — and a **Memorial** listing every fallen Pokémon by its **nickname** (species in parentheses) with who lost it and an optional cause of death. Broken pairs are excluded from both the death count and the Memorial. (The former Team-Weaknesses tab lives here now; `/weaknesses` redirects to it.)
- **Rules**: per-run rule toggles (Species Clause on/off, Shiny Clause, nicknames, the two PokeRandoZX randomizer evolution options – "impossible evolutions changed" and "evolutions made easier" – separately, static encounters and their clause exemption) plus, for SoulLink runs, custom player names that replace "Player 1 / Player 2" everywhere, and a markdown section for house rules & notes, editable right in the browser; new runs inherit both from the most recent run. All toggles are informational/UI-level – the server never rejects a save because of them.
- **Multiple runs & games**: fully separate progress per run (SoulLink or solo); each run plays one game data pack. Built-in packs: Red/Blue/Yellow (Gen 1), Gold/Silver/Crystal (Gen 2), FireRed/LeafGreen and Emerald (Gen 3), Platinum, HeartGold and SoulSilver (Gen 4) – more can be added as data under `data/games/<gameId>/` without code changes. Generation-aware mechanics per game: type chart (incl. the Gen 1 oddities), catch formula and ball selection (Gen 1/2/3/4), obtainable Pokémon (dex limit filters pick lists, evolutions, and rankings), and era-appropriate battle sprites.
- **Backup & import**: export the current run or all runs as a JSON file; import adds the contained runs (including team assignments, rules, rule settings, player names, death attribution, and nicknames) without ever overwriting existing data.
- **Multilingual**: UI, Pokémon, route, trainer, and badge names switchable between German, English, French, Spanish, and Italian (language picker in the header gear menu). German and English are hand-curated; the other languages are generated from PokeAPI plus curated tables (`npm run generate:names`) and fall back to English where no official translation exists (a few obscure Sevii-Island areas).

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
| `npm run download:sprites` | Downloads the Pokémon battle sprites for every sprite set referenced by a game pack (red-blue, crystal, emerald, platinum, ...) from PokeAPI into `public/pokemon-sprites/<set>/`, skipping files that already exist. **Must be run once after `npm install`** – the sprites are deliberately not part of this repo (copyrighted artwork, see `.gitignore`). Re-run after adding a game pack with a new sprite set. |
| `npm run generate:evolutions` | Regenerates `data/evolutions.json` (evolution lines incl. evolution methods: level/item/trade/friendship) from PokeAPI. Already included in the repo – only needed when `data/pokemon.json` changes. ROM-specific evolution changes (e.g. from a randomizer's "change impossible evolutions") live in `data/evolution-overrides.json` and are merged at runtime, so they survive regeneration. |
| `npm run download:catchrates` | Regenerates `data/catchrates.json` (base catch rates for the Wild catch calculator) from PokeAPI. Already included in the repo – only needed when `data/pokemon.json` changes. |
| `npm run generate:names` | Regenerates the localized display names (`names` objects keyed by language) in `data/pokemon.json` and every game pack's `routes.json`/`levelcaps.json` from PokeAPI plus hand-curated tables (trainers, badges, es/it locations). German/English values are never overwritten. |
| `npm run generate:learnsets` | Regenerates the level-up move data from PokeAPI: `data/learnsets/<versionGroup>.json` (damaging attack types per Pokémon, for the Battle tab), `data/movesets/<versionGroup>.json` (every level-up move as `[level, slug]`, for the detail card's move list and the Explosion warning), `data/tm-compat/<versionGroup>.json` (which Pokémon can learn a move via machine (`kind` = `tm`/`hm`) or tutor, for the TMs tab) and `data/moves.json` (per-move localized names, type, and whether it deals damage). Needed when a game pack's `versionGroup` changes or `data/pokemon.json` grows. |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) for the pure logic – catch formulas, type effectiveness, learnsets/TM compat, ranking, evolution BST, settings parsing. |

The download scripts need internet access once (PokeAPI); after that the app runs fully offline.

### Trainer sprites (optional, manual)

The Journey page can show trainer avatars from `public/trainers/<slug>.png` (circular avatar next to the name). There is no automated, legally clean source for these – if a file is missing, an initial-letter placeholder is shown instead. The expected file names are listed in `public/trainers/README.txt`. These images are not part of the repo or the Docker image; provide them yourself.

## Static data

All reference data is read straight from disk at runtime (not copied into the database). Edits take effect immediately, even inside a running Docker container, without a rebuild.

- **Game-independent** (`data/`): `pokemon.json` (national dex 1-493), `evolutions.json`, `effectiveness.json` (Gen 2-5 chart), `effectiveness-gen1.json`, `catchrates.json`, `learnsets/<versionGroup>.json` (damaging level-up move types per Pokémon), `movesets/<versionGroup>.json` (full level-up move lists per Pokémon), `tm-compat/<versionGroup>.json` (official TM/HM/tutor learners per move), and `moves.json` (per-move localized names, type, damage flag).
- **Per game pack** (`data/games/<gameId>/`): `game.json` (id, display names, generation, dexLimit, spriteSet, picker order), `routes.json`, `levelcaps.json`, and optionally `evolution-overrides.json` (ROM/randomizer changes). Each run is bound to one pack (chosen at creation); a run whose pack goes missing falls back to the default pack instead of crashing. Adding another game of a supported generation (1-4) = adding a new folder, no code changes.

Route entries carry a `type` (`"route"` = regular wild encounter, `"static"` = fixed encounter such as gifts, fossils, Snorlax, legendaries – exempt from the Species Clause) and an optional `"postgame": true` flag (collapsed by default on the Encounter tab). Route IDs are referenced by the database and must never be renumbered within a pack.

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
| `/app/public/pokemon-sprites` | Pokémon sprites (one subfolder per sprite set) – auto-filled on start with whatever the installed game packs need, persists across image updates (recommended). Old flat layouts are migrated into `emerald/` automatically. |
| `/app/public/ball-sprites` | Poké Ball item sprites – auto-filled on first start (optional; simply re-downloaded when missing) |
| `/app/public/trainers` | Trainer avatars – place your own `<slug>.png` files here (optional) |
| `/app/data` | Static reference data override (optional; omit to use the data baked into the image) |

Required environment variable: `DATABASE_URL=file:/app/db/nuzlocke.db`. The app listens on container port `3000`.

## Database migrations

```bash
npx prisma migrate dev --name <description>
```

creates and applies a new migration locally. In Docker, pending migrations are applied automatically on container start (`prisma migrate deploy`).
