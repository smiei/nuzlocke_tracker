#!/bin/sh
set -e

mkdir -p /app/db

# The public image ships without Pokémon sprites (copyrighted artwork).
# Download them once from PokeAPI on first start; mount a volume at
# /app/public/pokemon-sprites to persist them across container updates.
# A failed download is not fatal - the app runs, images show a "?" fallback,
# and the next container start retries.
mkdir -p /app/public/pokemon-sprites /app/public/ball-sprites /app/public/trainers /app/public/badges
# The script skips files that already exist, migrates the old flat layout
# into pokemon-sprites/emerald/, and only fetches sprite sets that a game
# pack actually references - so running it on every start is cheap once the
# volume is filled.
echo "Checking Pokémon sprites (downloads only what's missing)..."
node scripts/download-sprites.mjs || echo "WARNING: sprite download failed; missing Pokémon images will show a '?' until the next container start."

# Same policy for gym badge icons (see scripts/download-badges.mjs) - cropped
# from a third-party SVG sheet, never baked into the image.
echo "Checking badge icons (downloads only what's missing)..."
node scripts/download-badges.mjs || echo "WARNING: badge download failed; badges will be missing until the next container start."

# Run migrations (as root - may CREATE the db file on a fresh volume)
npx prisma migrate deploy

# Hand the db over to the app user only AFTER migrate deploy: on a fresh
# volume the migration creates nuzlocke.db as root, and chowning earlier
# would leave the app with a file it can read but not write
# ("attempt to write a readonly database").
chown -R nextjs:nodejs /app/db

# Switch to nextjs user and start the app
exec su -s /bin/sh nextjs -c "exec $*"
