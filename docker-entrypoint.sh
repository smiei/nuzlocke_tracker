#!/bin/sh
set -e

# Ensure db directory exists and is writable (runs as root before USER switch)
mkdir -p /app/db
chown -R nextjs:nodejs /app/db

# The public image ships without Pokémon sprites (copyrighted artwork).
# Download them once from PokeAPI on first start; mount a volume at
# /app/public/pokemon-sprites to persist them across container updates.
# A failed download is not fatal - the app runs, images show a "?" fallback,
# and the next container start retries.
mkdir -p /app/public/pokemon-sprites /app/public/trainers
if [ -z "$(ls -A /app/public/pokemon-sprites 2>/dev/null)" ]; then
  echo "Pokémon sprites missing - downloading from PokeAPI (one-time)..."
  node scripts/download-sprites.mjs || echo "WARNING: sprite download failed; Pokémon images will be missing until the next container start."
fi

# Run migrations
npx prisma migrate deploy

# Switch to nextjs user and start the app
exec su -s /bin/sh nextjs -c "exec $*"
