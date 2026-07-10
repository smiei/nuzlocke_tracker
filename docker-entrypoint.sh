#!/bin/sh
set -e

mkdir -p /app/db

# The public image ships without Pokémon sprites (copyrighted artwork).
# Download them once from PokeAPI on first start; mount a volume at
# /app/public/pokemon-sprites to persist them across container updates.
# A failed download is not fatal - the app runs, images show a "?" fallback,
# and the next container start retries.
mkdir -p /app/public/pokemon-sprites /app/public/ball-sprites /app/public/trainers
if [ -z "$(ls -A /app/public/pokemon-sprites 2>/dev/null)" ] || [ -z "$(ls -A /app/public/ball-sprites 2>/dev/null)" ]; then
  echo "Pokémon sprites missing - downloading from PokeAPI (one-time)..."
  node scripts/download-sprites.mjs || echo "WARNING: sprite download failed; Pokémon images will be missing until the next container start."
fi

# Run migrations (as root - may CREATE the db file on a fresh volume)
npx prisma migrate deploy

# Hand the db over to the app user only AFTER migrate deploy: on a fresh
# volume the migration creates nuzlocke.db as root, and chowning earlier
# would leave the app with a file it can read but not write
# ("attempt to write a readonly database").
chown -R nextjs:nodejs /app/db

# Switch to nextjs user and start the app
exec su -s /bin/sh nextjs -c "exec $*"
