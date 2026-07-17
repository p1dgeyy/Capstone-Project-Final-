#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== Capstone Portal Startup Script ==="

# Run the database migration and seeding script
echo "Running database migrations..."
npm run migrate

# Start the Express API server in the background
echo "Starting Express API server..."
node backend/server.js &

# Give the API server a moment to initialize
sleep 2

# Start Nginx in the foreground
echo "Starting Nginx web server..."
exec nginx -g "daemon off;"
