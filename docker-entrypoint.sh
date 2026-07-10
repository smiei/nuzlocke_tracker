#!/bin/sh
set -e

# Ensure db directory exists and is writable (runs as root before USER switch)
mkdir -p /app/db
chown -R nextjs:nodejs /app/db

# Run migrations
npx prisma migrate deploy

# Switch to nextjs user and start the app
exec su -s /bin/sh nextjs -c "exec $*"
