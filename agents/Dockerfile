# Dockerfile for Python Agent Server
# 
# Build: docker build -t agent-server -f agents/Dockerfile agents/
# Run: docker run -p 8080:8080 \
#      -e CONVEX_URL=your_convex_url \
#      -e ANCHOR_API_KEY=your_key \
#      -e AGENT_SERVER_API_KEY=your_api_key \
#      agent-server
#
# Note: Environment variables must be provided via -e flags or docker-compose
# AGENT_SERVER_API_KEY is required for API authentication
# Generate with: openssl rand -hex 32

# Use Python 3.12 slim image as base
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv package manager
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Copy the rest of the application
COPY . .

# Install Python dependencies using uv
# Using --system installs packages system-wide (no virtual environment in Docker)
# Install dependencies directly from pyproject.toml (without installing the package itself)
RUN uv pip install --system \
    "aiohttp>=3.9.0" \
    "anchorbrowser>=0.1.0" \
    "browser-use>=0.9.0" \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.32.0" \
    "convex>=0.5.0" \
    "python-dotenv>=1.0.0" \
    "pydantic>=2.10.0"

# Create directory for temporary file uploads
RUN mkdir -p /tmp/browser_arena_uploads

# Expose the port the app runs on
EXPOSE 8080

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/')"

# Run the server
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080", "--log-level", "info"]

