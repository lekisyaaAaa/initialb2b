#!/usr/bin/env bash
set -euo pipefail

echo "Starting containers (if not already)..."
docker-compose -f docker-compose.prod.yml up -d --build

echo "Waiting for backend to be healthy..."
until curl -sS http://127.0.0.1:5000/api/health >/dev/null 2>&1; do
  sleep 1
done

echo "Seeding admin user inside backend container..."
BACKEND_CID=$(docker-compose -f docker-compose.prod.yml ps -q backend)
docker exec -it $BACKEND_CID node scripts/seed-admin.js || echo "Seed script finished or failed (check logs)"

echo "Done. Check backend logs with: docker logs -f $BACKEND_CID"
