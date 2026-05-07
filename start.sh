#!/bin/bash
# NexusID — Production startup script
# Seeds data on first run, then starts the server

set -e

echo "=== NexusID Startup ==="

# Check if database has records (if not, seed it)
RECORD_COUNT=$(python -c "
from backend.models import SessionLocal, BusinessRecordDB
db = SessionLocal()
count = db.query(BusinessRecordDB).count()
db.close()
print(count)
" 2>/dev/null || echo "0")

echo "Current record count: $RECORD_COUNT"

if [ "$RECORD_COUNT" = "0" ]; then
    echo "=== Empty database detected. Seeding synthetic data... ==="
    python tools/synthetic_data/generate.py
    echo "=== Data generated. Running pipeline... ==="
    python -c "
from backend.main import app
from fastapi.testclient import TestClient
c = TestClient(app)
r = c.post('/api/pipeline/run-all')
d = r.json()
print(f'Pipeline done: {d[\"elapsed_seconds\"]}s, {d[\"resolution\"][\"active_ubids\"]} UBIDs, {d[\"resolution\"][\"merges_performed\"]} merges')
"
    echo "=== Seeding complete ==="
else
    echo "=== Database already has $RECORD_COUNT records. Skipping seed. ==="
fi

echo "=== Starting Gunicorn ==="
exec gunicorn backend.main:app \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:${PORT:-8000} \
    --timeout 120
