#!/bin/bash

# Agent Server Startup Script

echo "🚀 Starting Agent Server..."
echo ""

# Check if .env.local exists in parent directory
if [ ! -f "../.env.local" ]; then
    echo "⚠️  Warning: ../.env.local not found!"
    echo "📝 Please create it from env.example with your API keys"
    echo ""
fi

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "📦 Virtual environment not found. Creating with uv..."
    uv sync
    echo ""
fi

# Start the server
echo "🌐 Starting FastAPI server on http://localhost:8080"
echo "📚 API docs available at http://localhost:8080/docs"
echo ""

.venv/bin/python server.py

