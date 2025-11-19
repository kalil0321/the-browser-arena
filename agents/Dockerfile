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

# Install system dependencies (git required for browser-use from git)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install uv package manager
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Copy the rest of the application first (but we'll regenerate requirements.txt)
COPY . .

# Export dependencies from lock file to requirements.txt format
# This overwrites any local requirements.txt with a clean one from the lock file
# Filter out editable install (-e .) and status messages
RUN uv export --format requirements-txt --no-hashes 2>/dev/null | \
    grep -v "^-e" | \
    grep -v "^Resolved" | \
    grep -v "^$" > requirements.txt

# Install Python dependencies using uv from exported requirements file
# Using --system installs packages system-wide (no virtual environment in Docker)
# uv pip sync installs exact versions for reproducible builds
RUN uv pip sync --system requirements.txt

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
# Use asyncio loop instead of uvloop to avoid conflict with nest_asyncio used by notte-sdk
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080", "--log-level", "info", "--loop", "asyncio"]

