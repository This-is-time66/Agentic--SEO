# ── Base image ────────────────────────────────────────────────────────────────
FROM python:3.11-slim

# ── Hugging Face Spaces runs as a non-root user (uid 1000) ────────────────────
# Create the user first so we can own the app directory
RUN useradd -m -u 1000 appuser

# ── Set working directory ─────────────────────────────────────────────────────
WORKDIR /app

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# ── Install Python dependencies (cached layer) ───────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Copy project files ────────────────────────────────────────────────────────
COPY . .

# ── Fix permissions for non-root user ────────────────────────────────────────
RUN chown -R appuser:appuser /app

# ── Switch to non-root user ───────────────────────────────────────────────────
USER appuser

# ── Hugging Face Spaces requires port 7860 ───────────────────────────────────
EXPOSE 7860

# ── Start the app ─────────────────────────────────────────────────────────────
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
