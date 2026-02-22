#!/bin/sh
set -e

echo "[entrypoint] Waiting for database..."
python - <<'EOF'
import os, sys, time
import psycopg2

url = os.environ["DATABASE_URL"]
for i in range(30):
    try:
        conn = psycopg2.connect(url)
        conn.close()
        print("[entrypoint] Database is ready.")
        sys.exit(0)
    except psycopg2.OperationalError as e:
        print(f"[entrypoint] Attempt {i+1}/30: {e}")
        time.sleep(1)

print("[entrypoint] Database not ready after 30s. Exiting.")
sys.exit(1)
EOF

echo "[entrypoint] Running Alembic migrations..."
alembic upgrade head

echo "[entrypoint] Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir /app/app
