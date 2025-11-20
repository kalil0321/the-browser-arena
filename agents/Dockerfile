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
    git \
    && rm -rf /var/lib/apt/lists/*

# Install uv package manager
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Copy the rest of the application first (but we'll regenerate requirements.txt)
COPY . .

# Install Python dependencies using uv pip install
# Install aiohttp first, then all notte-core and notte-sdk dependencies, then notte packages with --no-deps
# Then install browser-use (which requires aiohttp==3.12.15)
# Using --system installs packages system-wide (no virtual environment in Docker)
RUN uv pip install --system "aiohttp==3.12.15" && \
    uv pip install --system \
    "cryptography>=43.0.3" \
    "loguru>=0.7.3" \
    "nest-asyncio>=1.6.0" \
    "opentelemetry-sdk>=1.34.1" \
    "packaging>=25.0" \
    "pillow>=11.1.0" \
    "posthog>=3.0.1" \
    "pydantic-settings>=2.8.1" \
    "pydantic>=2.10.6" \
    "pyotp>=2.9.0" \
    "python-dotenv>=1.0.1" \
    "requests>=2.32.3" \
    "restrictedpython>=8.0" \
    "scarf-sdk>=0.1.2" \
    "tldextract>=5.3.0" \
    "toml>=0.10.2" \
    "halo>=0.0.28" \
    "websockets>=13.1" && \
    uv pip install --system "notte-core>=1.7.11" --no-deps && \
    uv pip install --system "notte-sdk>=1.7.11" --no-deps && \
    uv pip install --system "browser-use @ git+https://github.com/browser-use/browser-use.git" && \
    uv pip install --system \
    "anchorbrowser>=0.1.0" \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.32.0" \
    "convex>=0.5.0" \
    "filetype>=1.2.0"

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

