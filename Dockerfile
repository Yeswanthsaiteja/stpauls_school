# ── St. Paul's ERP — Railway Backend Dockerfile ──────────────────────────────
FROM python:3.11-slim

# Set working directory inside container
WORKDIR /app

# Copy only the backend folder
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY backend/ .

# Expose port (Railway injects $PORT at runtime)
EXPOSE 8000

# Start the FastAPI server
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}
