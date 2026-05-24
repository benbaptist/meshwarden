FROM python:3.11-slim

WORKDIR /app

# Install dependencies first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN adduser --disabled-password --no-create-home meshwarden && \
    mkdir -p /data && chown meshwarden:meshwarden /data

USER meshwarden

EXPOSE 5000

CMD ["python", "run.py"]
