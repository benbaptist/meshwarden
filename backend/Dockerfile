FROM python:3.11-slim

WORKDIR /app

# Install dependencies first for layer caching
COPY requirements.txt .
RUN apt-get update && apt-get install -y --no-install-recommends su-exec && \
    rm -rf /var/lib/apt/lists/* && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user and data directory
RUN adduser --disabled-password --no-create-home meshwarden && \
    mkdir -p /data && chown meshwarden:meshwarden /data && \
    chmod +x /app/entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/app/entrypoint.sh"]
