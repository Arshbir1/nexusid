# ── Stage 1: Build Frontend ──────────────────────────────────────────────────
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production Backend + Serve Frontend ────────────────────────────
FROM python:3.12-slim

# Install system dependencies for PostgreSQL client
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ backend/
COPY tools/ tools/
COPY infra/ infra/
COPY alembic.ini .
COPY saved_models/ saved_models/

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/dist frontend/dist

# Append static file serving to main.py so the backend serves the React frontend
RUN echo '\n\
import os as _os\n\
from starlette.responses import FileResponse as _FileResponse\n\
from starlette.staticfiles import StaticFiles as _StaticFiles\n\
_dist = _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), "frontend", "dist")\n\
if _os.path.exists(_dist):\n\
    app.mount("/assets", _StaticFiles(directory=_os.path.join(_dist, "assets")), name="static-assets")\n\
    @app.get("/{full_path:path}")\n\
    async def _serve_frontend(full_path: str):\n\
        fp = _os.path.join(_dist, full_path)\n\
        if _os.path.isfile(fp): return _FileResponse(fp)\n\
        return _FileResponse(_os.path.join(_dist, "index.html"))\n\
' >> backend/main.py

# Copy startup script
COPY start.sh .
RUN chmod +x start.sh

EXPOSE 8000
CMD ["./start.sh"]
