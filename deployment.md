# NexusID — Deployment with PostgreSQL

Give this entire document to your LLM (Claude Code / Cursor) along with the nexusid project folder.

---

## What We're Deploying

- **Backend:** Python/FastAPI on port 8000
- **Frontend:** React static build served via Nginx or FastAPI
- **Database:** PostgreSQL (not SQLite)
- **Single server deployment** — everything on one machine

---

## OPTION A: Deploy on Any VPS (AWS EC2 / DigitalOcean / Linode / Azure VM)

### Step 1: Server Setup

SSH into your server, then:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3.12
sudo apt install -y python3 python3-pip python3-venv

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install build tools (needed for bcrypt/psycopg2)
sudo apt install -y build-essential libpq-dev python3-dev
```

### Step 2: Setup PostgreSQL

```bash
# Switch to postgres user and create database
sudo -u postgres psql -c "CREATE USER nexusid WITH PASSWORD 'NexusID_Prod_2025!';"
sudo -u postgres psql -c "CREATE DATABASE nexusid OWNER nexusid;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE nexusid TO nexusid;"

# Verify it works
psql postgresql://nexusid:NexusID_Prod_2025!@localhost:5432/nexusid -c "SELECT version();"
```

You should see PostgreSQL version output. If this fails, check that PostgreSQL is running:
```bash
sudo systemctl status postgresql
```

### Step 3: Upload Project

Upload the nexusid folder to the server. You can use scp:
```bash
# From your local machine:
scp nexusid-project.zip ubuntu@YOUR_SERVER_IP:~/
```

Then on the server:
```bash
cd ~
unzip nexusid-project.zip
cd nexusid
```

### Step 4: Backend Setup

```bash
cd ~/nexusid

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
pip install psycopg2-binary gunicorn bcrypt==4.0.1

# Set environment variables
export DATABASE_URL=postgresql://nexusid:NexusID_Prod_2025!@localhost:5432/nexusid

# Generate synthetic data (goes into PostgreSQL now)
python tools/synthetic_data/generate.py

# Run the pipeline
python -c "
from backend.main import app
from fastapi.testclient import TestClient
c = TestClient(app)
r = c.post('/api/pipeline/run-all')
d = r.json()
print(f'Pipeline: {d[\"elapsed_seconds\"]}s, {d[\"resolution\"][\"active_ubids\"]} UBIDs')
"

# Train the model
python -c "
from backend.services.resolution.train_model import run_training
run_training()
"

# Verify PostgreSQL is being used
python -c "
from backend.main import app
from fastapi.testclient import TestClient
c = TestClient(app)
r = c.get('/api/infra/database/health')
print(r.json())
"
# Should show: "engine": "postgresql"

# Test everything works
python -c "
from backend.main import app
from fastapi.testclient import TestClient
c = TestClient(app)
print('Stats:', c.get('/api/stats').json().get('total_ubids'), 'UBIDs')
print('Ledger:', c.post('/api/ledger/verify').json().get('verified'))
print('DB:', c.get('/api/infra/database/health').json().get('engine'))
"
```

### Step 5: Build Frontend

```bash
cd ~/nexusid/frontend
npm install
npm run build
# Creates dist/ folder with static files
```

### Step 6: Create systemd Service (keeps backend running)

```bash
sudo tee /etc/systemd/system/nexusid.service << 'EOF'
[Unit]
Description=NexusID Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/nexusid
Environment=DATABASE_URL=postgresql://nexusid:NexusID_Prod_2025!@localhost:5432/nexusid
Environment=JWT_SECRET=nexusid-production-jwt-secret-change-this
ExecStart=/home/ubuntu/nexusid/venv/bin/gunicorn backend.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 127.0.0.1:8000 --access-logfile /var/log/nexusid-access.log --error-logfile /var/log/nexusid-error.log
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Start the service
sudo systemctl daemon-reload
sudo systemctl enable nexusid
sudo systemctl start nexusid

# Check it's running
sudo systemctl status nexusid
curl -s http://localhost:8000/api/stats | python3 -m json.tool
```

### Step 7: Configure Nginx

```bash
sudo tee /etc/nginx/sites-available/nexusid << 'EOF'
server {
    listen 80;
    server_name _;

    # Frontend (static files from Vite build)
    location / {
        root /home/ubuntu/nexusid/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    # Swagger docs
    location /docs {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }
    location /openapi.json {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/nexusid /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart
sudo nginx -t
sudo systemctl restart nginx
```

### Step 8: Verify Deployment

```bash
# From the server
curl -s http://localhost/api/stats | python3 -m json.tool
curl -s http://localhost/api/infra/database/health | python3 -m json.tool
curl -s http://localhost/ | head -5

# From your local machine (replace with your server IP)
echo "Open in browser: http://YOUR_SERVER_IP"
```

---

## OPTION B: Deploy with Docker + PostgreSQL

### Step 1: Create Dockerfile

Save this as `Dockerfile` in the nexusid root:

```dockerfile
FROM python:3.12-slim

RUN apt-get update && apt-get install -y nodejs npm libpq-dev build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Backend
RUN pip install --no-cache-dir -r backend/requirements.txt psycopg2-binary gunicorn bcrypt==4.0.1

# Frontend
RUN cd frontend && npm install && npm run build

# Add static file serving to backend
RUN echo '\n\
import os\n\
from starlette.responses import FileResponse\n\
_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")\n\
if os.path.exists(_dist):\n\
    @app.get("/{full_path:path}")\n\
    async def _serve_fe(full_path: str):\n\
        fp = os.path.join(_dist, full_path)\n\
        if os.path.isfile(fp): return FileResponse(fp)\n\
        return FileResponse(os.path.join(_dist, "index.html"))\n\
' >> backend/main.py

EXPOSE 8000
CMD ["gunicorn", "backend.main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

### Step 2: Create docker-compose.prod.yml

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: nexusid
      POSTGRES_USER: nexusid
      POSTGRES_PASSWORD: NexusID_Prod_2025!
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nexusid"]
      interval: 5s
      timeout: 3s
      retries: 10

  app:
    build: .
    ports:
      - "80:8000"
    environment:
      DATABASE_URL: postgresql://nexusid:NexusID_Prod_2025!@postgres:5432/nexusid
      JWT_SECRET: nexusid-production-jwt-secret-change-this
    depends_on:
      postgres:
        condition: service_healthy
    restart: always

volumes:
  pgdata:
```

### Step 3: Create init script

Save as `init_data.sh`:

```bash
#!/bin/bash
# Wait for app to be ready
echo "Waiting for app..."
sleep 10

# Generate data
docker exec -it $(docker ps -q -f name=app) python tools/synthetic_data/generate.py

# Run pipeline
docker exec -it $(docker ps -q -f name=app) python -c "
from backend.main import app
from fastapi.testclient import TestClient
c = TestClient(app)
r = c.post('/api/pipeline/run-all')
print(f'Pipeline done: {r.json()[\"elapsed_seconds\"]}s')
"

# Train model
docker exec -it $(docker ps -q -f name=app) python -c "
from backend.services.resolution.train_model import run_training
run_training()
"

echo "Done! Open http://localhost in browser"
```

### Step 4: Deploy

```bash
# Build and start
docker compose -f docker-compose.prod.yml up -d --build

# Wait for containers to be healthy
docker compose -f docker-compose.prod.yml ps

# Initialize data
chmod +x init_data.sh
./init_data.sh

# Verify
curl -s http://localhost/api/infra/database/health | python3 -m json.tool
# Should show "engine": "postgresql"

echo "Open http://YOUR_SERVER_IP in browser"
```

---

## OPTION C: Deploy on Railway (Easiest)

### Step 1: Add these files to project root

**Procfile:**
```
web: gunicorn backend.main:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
```

**runtime.txt:**
```
python-3.12
```

### Step 2: Push to GitHub

```bash
cd nexusid
git init
git add -A
git commit -m "NexusID initial commit"
gh repo create nexusid --public --push
```

### Step 3: Deploy on Railway

1. Go to https://railway.app → New Project
2. Click "Deploy from GitHub Repo" → select your repo
3. Add a PostgreSQL plugin (click "+ New" → "Database" → "PostgreSQL")
4. Railway auto-sets DATABASE_URL. Add these env vars:
   - `JWT_SECRET` = `nexusid-production-jwt-secret`
   - `PORT` = `8000`
5. Deploy

### Step 4: Initialize data

Open Railway shell and run:
```bash
python tools/synthetic_data/generate.py
python -c "
from backend.main import app
from fastapi.testclient import TestClient
c = TestClient(app)
c.post('/api/pipeline/run-all')
"
python -c "
from backend.services.resolution.train_model import run_training
run_training()
"
```

---

## POST-DEPLOYMENT CHECKLIST

Run these to verify everything works:

```bash
URL="http://YOUR_DEPLOYED_URL"

# 1. Frontend loads
curl -s $URL | grep -o "NexusID" && echo "✅ Frontend OK" || echo "❌ Frontend FAIL"

# 2. Backend responds
curl -s $URL/api/stats | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'✅ Backend OK: {d[\"total_ubids\"]} UBIDs, {d[\"total_records\"]} records')
" || echo "❌ Backend FAIL"

# 3. PostgreSQL confirmed
curl -s $URL/api/infra/database/health | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'✅ DB: {d[\"engine\"]} {d[\"status\"]}')
" || echo "❌ DB FAIL"

# 4. Ledger integrity
curl -s -X POST $URL/api/ledger/verify | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'✅ Ledger: verified={d[\"verified\"]}, entries={d[\"entries\"]}')
" || echo "❌ Ledger FAIL"

# 5. Auth works
curl -s -X POST $URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'✅ Auth: {d[\"full_name\"]} ({d[\"role\"]})')
" || echo "❌ Auth FAIL"

# 6. Model trained
curl -s $URL/api/model/metrics | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'✅ Model: {d.get(\"model_version\",\"NOT TRAINED\")} PR-AUC={d.get(\"pr_auc\",\"N/A\")}')
" || echo "❌ Model FAIL"
```

All 6 should show ✅. Share the URL with your team.

---

## TROUBLESHOOTING

| Problem | Fix |
|---------|-----|
| `ModuleNotFoundError: psycopg2` | Run `pip install psycopg2-binary` |
| `bcrypt` error | Run `pip install bcrypt==4.0.1` |
| `FATAL: password authentication failed` | Check DATABASE_URL password matches what you set in PostgreSQL |
| Dashboard shows zeros | Pipeline hasn't been run. Click "Run Full Pipeline" or run the curl command |
| Can't access from outside | Check firewall: `sudo ufw allow 80` and `sudo ufw allow 443` |
| Nginx 502 Bad Gateway | Backend not running. Check `sudo systemctl status nexusid` |
| Frontend shows blank | Frontend not built. Run `cd frontend && npm run build` |
| Login fails | Users not seeded. Delete DB, regenerate data, restart backend |
| Docker can't connect to postgres | Postgres not ready yet. Wait 10s, try `init_data.sh` again |

---

## SECURITY NOTES (for production)

1. Change `JWT_SECRET` to a random string: `openssl rand -hex 32`
2. Change PostgreSQL password to something strong
3. Add HTTPS with Let's Encrypt:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```
4. Change default user passwords after first login
5. Set `WEBHOOK_SECRET` to a strong random value
