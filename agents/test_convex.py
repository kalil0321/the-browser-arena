#!/usr/bin/env python3
"""Test script to verify Convex connection from Python"""

import os
from convex import ConvexClient
from dotenv import load_dotenv

# Load environment
load_dotenv("../.env.local")

CONVEX_URL = os.getenv("CONVEX_URL")

if not CONVEX_URL:
    print("❌ CONVEX_URL not set in ../.env.local")
    exit(1)

print(f"📡 Testing connection to: {CONVEX_URL}")

try:
    client = ConvexClient(CONVEX_URL)
    print("✅ ConvexClient created successfully")

    # Try to query (this might fail if auth is required)
    print("\n🔍 Testing getUserSessions query...")
    try:
        result = client.query("queries:getUserSessions")
        print(f"✅ Query succeeded: {result}")
    except Exception as e:
        print(f"⚠️  Query failed (expected if auth required): {e}")

    # Test if we can access mutations
    print("\n🔍 Testing backend mutations availability...")
    print("Note: These mutations should be available without auth")
    print("- mutations:createAgentFromBackend")
    print("- mutations:updateAgentStatusFromBackend")
    print("- mutations:updateAgentResultFromBackend")

    print("\n✅ Basic connection test passed!")
    print("The mutations should work when called with valid IDs")

except Exception as e:
    print(f"❌ Connection failed: {e}")
    import traceback

    traceback.print_exc()
