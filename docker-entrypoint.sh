#!/bin/sh
set -e

echo "Starting JellyTulli Server..."

# Run Prisma schema push. Note: Using `db push` to force schema creation without migrations folder.
echo "Running Prisma db push..."
npx prisma db push --accept-data-loss

echo "Prisma schema pushed successfully."

# Start the Next.js standalone application
echo "Launching Next.js Standalone server..."
exec node server.js
