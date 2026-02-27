#!/bin/sh
set -e

echo "Starting JellyTulli Server..."

# Run Prisma schema migrations. Note: Using `migrate deploy` is safer for production.
echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Prisma migrations applied successfully."

# Start the Next.js standalone application
echo "Launching Next.js Standalone server..."
exec node server.js
