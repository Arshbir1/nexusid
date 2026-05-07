# Instructions to Run — NexusID

The project zip contains a folder named `nexusid`. Two options: SQLite (zero setup) or PostgreSQL (production).

---

## Prerequisites
- Python 3.10 or higher
- Node.js 18 or higher
- pip and npm

---

## Option 1 — SQLite (Quickest, Zero Setup)

```bash
# 1. Unzip and enter the project
unzip nexusid.zip
cd nexusid

# 2. Install backend dependencies
pip install -r backend/requirements.txt

# 3. Generate synthetic data
python tools/synthetic_data/generate.py

# 4. Start backend (keep this terminal open)
python backend/main.py
```

Open a second terminal:
```bash
# 5. Install and start frontend
cd nexusid/frontend
npm install
npm run dev
```

Open browser: **http://localhost:5173**

---

## Option 2 — PostgreSQL (Production)

Requires Docker Desktop installed.

```bash
# 1. Start PostgreSQL container
docker run -d --name nexusid-pg \
  -e POSTGRES_USER=nexusid \
  -e POSTGRES_PASSWORD=nexusid123 \
  -e POSTGRES_DB=nexusid \
  -p 5432:5432 \
  postgres:16

# 2. Unzip and enter the project
unzip nexusid.zip
cd nexusid

# 3. Install backend dependencies
pip install -r backend/requirements.txt
pip install psycopg2-binary

# 4. Set database URL
export DATABASE_URL=postgresql://nexusid:nexusid123@localhost:5432/nexusid

# 5. Generate synthetic data
python tools/synthetic_data/generate.py

# 6. Start backend (keep this terminal open)
python backend/main.py
```

Open a second terminal:
```bash
# 7. Install and start frontend
cd nexusid/frontend
npm install
npm run dev
```

Open browser: **http://localhost:5173**

Verify PostgreSQL is active: http://localhost:8000/api/infra/database/health
Should show: `"engine": "postgresql"`

---

## Login Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Full access |
| reviewer1 | review123 | Reviewer |
| analyst | analyst123 | Read-only |

---

## First Steps After Login

1. Click **"Run Full Pipeline"** on the dashboard — wait ~13 seconds
2. (Optional) Train the ML model:
   ```bash
   curl -X POST http://localhost:8000/api/model/train
   ```

---

## Key Pages

| Page | URL | What to test |
|------|-----|--------------|
| Dashboard | / | KPIs, pipeline status, activity feed |
| Reviewer | /review | Open a pair, confirm or reject |
| Identity Explorer | /identity | Search "560058", click a business |
| Query Console | /query | Run the flagship query |
| Compliance | /compliance | Adapter health, model metrics |
| Event Ledger | /ledger | Click "Verify Chain Integrity" |

---

## API Docs
Interactive Swagger UI: **http://localhost:8000/docs**

## Guided Tour
Visit **http://localhost:5173/?demo=1** for a 10-step guided walkthrough.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Dashboard shows zeros | Click "Run Full Pipeline" on the dashboard |
| Login fails | Delete `nexusid.db`, re-run `generate.py`, restart backend |
| Port 8000 in use | `lsof -ti:8000 \| xargs kill` |
| Port 5173 in use | `lsof -ti:5173 \| xargs kill` |
| PostgreSQL container conflict | `docker start nexusid-pg` (already exists) |
| `ModuleNotFoundError` | Re-run `pip install -r backend/requirements.txt` |
