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

# Install system dependencies (git required for VCS deps)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install uv package manager
RUN pip install uv

# Copy dependency files first for better layer caching
COPY pyproject.toml uv.lock ./

# Copy the full application so packages are present for editable install
COPY . .

# Sync dependencies into a local venv using the lockfile (installs project)
RUN uv sync --frozen --no-dev --python /usr/local/bin/python

# Ensure the virtual environment is on PATH
ENV PATH="/app/.venv/bin:${PATH}"

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
# Use --loop asyncio to avoid uvloop compatibility issues with nest_asyncio (required by notte_sdk)
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080", "--log-level", "info", "--loop", "asyncio"]

