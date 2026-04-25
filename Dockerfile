# ── Stage 1: build ─────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app
COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt \
 && python -m spacy download en_core_web_sm

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY app.py .
COPY backend/ backend/
COPY frontend/ frontend/

# Cloud Run sets PORT; default to 8080
ENV PORT=8080
ENV GCP_PROJECT=historical-markup-tool-v2
ENV GCP_LOCATION=us-central1

EXPOSE 8080

CMD exec uvicorn app:app --host 0.0.0.0 --port $PORT
