import os
from contextlib import asynccontextmanager
from typing import Optional
import aiohttp

import uvicorn
from anchorbrowser import Anchorbrowser
from convex import ConvexClient
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import agent functions
from skyvern_agent import run_skyvern
from browser_use_agent import run_browser_use


# Load environment variables from project root
load_dotenv("../.env.local")

# Initialize Convex client
CONVEX_URL = os.getenv("CONVEX_URL")
if not CONVEX_URL:
    raise ValueError("CONVEX_URL environment variable is required")

# Create Convex client without authentication
# Backend mutations don't require auth
convex_client = ConvexClient(CONVEX_URL)

# Initialize Anchor Browser
ANCHOR_API_KEY = os.getenv("ANCHOR_API_KEY")
if not ANCHOR_API_KEY:
    raise ValueError("ANCHOR_API_KEY environment variable is required")

anchor_browser = Anchorbrowser(api_key=ANCHOR_API_KEY)


# Pydantic models
class AgentRequest(BaseModel):
    sessionId: str  # Convex session ID
    instruction: str
    providerModel: Optional[str] = ""


class AgentResponse(BaseModel):
    sessionId: str
    agentId: str
    browserSessionId: str
    liveUrl: str


# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Agent server starting up...")
    print(f"📡 Connected to Convex: {CONVEX_URL}")
    yield
    # Shutdown
    print("👋 Agent server shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Agent Server",
    description="API for running browser automation agents (Skyvern, Browser-Use)",
    version="0.1.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pricing = {
    "browser-use/bu-1-0": {
        "in": 0.50 / 1_000_000,
        "out": 3.00 / 1_000_000,
        "cached": 0.10 / 1_000_000,
    },
    "google/gemini-2.5-flash": {
        "in": 0.3 / 1_000_000,
        "out": 2.5 / 1_000_000,
        "cached": 0.03 / 1_000_000,
    },
    "google/gemini-2.5-pro": {
        "in": 1.25 / 1_000_000,
        "out": 10.0 / 1_000_000,
        "cached": 0.3125 / 1_000_000,
    },
    "openai/gpt-4.1": {
        "in": 2.0 / 1_000_000,
        "out": 8.0 / 1_000_000,
        "cached": 0.5 / 1_000_000,
    },
    "anthropic/claude-4.5-haiku": {
        "in": 1.0 / 1_000_000,
        "out": 5.0 / 1_000_000,
        "cached": 0.1 / 1_000_000,
    },
}


def compute_cost(model: str, usage: dict) -> float:
    # total_prompt_tokens=17920  total_prompt_cached_tokens=0 total_completion_tokens=433 total_tokens=18353 total_cost=0.0 entry_count=4
    total_cost = usage.get("total_cost", 0)
    if total_cost == 0:
        price = pricing.get(
            model,
            {
                "in": 0.5 / 1_000_000,
                "out": 3.00 / 1_000_000,
                "cached": 0.10 / 1_000_000,
            },
        )
        cost = (
            usage.get("total_prompt_tokens", 0) * price["in"]
            + usage.get("total_completion_tokens", 0) * price["out"]
            + usage.get("total_prompt_cached_tokens", 0) * price["cached"]
        )
        return cost
    return total_cost


async def upload_recording_to_convex(
    agent_id: str, recording_content: bytes
) -> Optional[str]:
    """
    Upload recording to Convex storage via HTTP action.

    Args:
        agent_id: Convex agent ID
        recording_content: Raw bytes of the recording file

    Returns:
        Recording URL if successful, None otherwise
    """
    try:
        # Get the base URL for Convex HTTP actions
        # Convex URL format: https://xxx.convex.cloud (WebSocket URL)
        # HTTP endpoint format: https://xxx.convex.site/upload-recording
        # Extract deployment name from CONVEX_URL
        if ".convex.cloud" in CONVEX_URL:
            convex_http_url = (
                CONVEX_URL.replace(".convex.cloud", ".convex.site")
                + "/upload-recording"
            )
        elif ".convex.site" in CONVEX_URL:
            convex_http_url = CONVEX_URL + "/upload-recording"
        else:
            # Fallback: try to construct from deployment name
            # CONVEX_URL might be just the deployment name or full URL
            raise ValueError(f"Unsupported CONVEX_URL format: {CONVEX_URL}")

        # Create form data for multipart upload
        form_data = aiohttp.FormData()
        form_data.add_field("agentId", agent_id)
        form_data.add_field(
            "file",
            recording_content,
            filename=f"recording-{agent_id}.mp4",
            content_type="video/mp4",
        )

        async with aiohttp.ClientSession() as session:
            async with session.post(convex_http_url, data=form_data) as response:
                if response.status == 200:
                    result = await response.json()
                    recording_url = result.get("recordingUrl")
                    print(f"✅ Recording uploaded successfully: {recording_url}")
                    return recording_url
                else:
                    error_text = await response.text()
                    print(
                        f"⚠️  Failed to upload recording: {response.status} - {error_text}"
                    )
                    return None
    except Exception as e:
        print(f"⚠️  Error uploading recording: {str(e)}")
        import traceback

        traceback.print_exc()
        return None


def to_jsonable(value):
    """Convert arbitrary values (including pydantic models) to Convex-serializable JSON types.

    Convex supports: null, boolean, number, string, Array, Object (with string keys),
    and nested combinations thereof. This function ensures no custom classes leak through.
    """
    # Primitives
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    # Bytes -> string
    if isinstance(value, (bytes, bytearray)):
        try:
            return value.decode("utf-8", errors="ignore")
        except Exception:
            return str(value)
    # Mapping -> dict
    try:
        if isinstance(value, dict):
            return {str(k): to_jsonable(v) for k, v in value.items()}
    except Exception:
        pass
    # Iterable -> list
    try:
        if isinstance(value, (list, tuple, set)):
            return [to_jsonable(v) for v in value]
    except Exception:
        pass
    # Pydantic v2 model -> model_dump
    try:
        if hasattr(value, "model_dump") and callable(getattr(value, "model_dump")):
            dumped = value.model_dump()
            return to_jsonable(dumped)
    except Exception:
        pass
    # Dataclass -> asdict-like via __dict__
    try:
        if hasattr(value, "__dict__"):
            return to_jsonable({k: v for k, v in value.__dict__.items()})
    except Exception:
        pass
    # Fallback to string
    return str(value)


# Background task functions
async def run_skyvern_task(
    agent_id: str,
    session_id: str,
    instruction: str,
    cdp_url: str,
    browser_session_id: str,
    provider_model: str,
):
    """Run Skyvern agent in background and update Convex"""
    try:
        # Update status to running
        print(f"🔄 Updating Skyvern agent {agent_id} status to running...")
        try:
            convex_client.mutation(
                "mutations:updateAgentStatusFromBackend",
                {"agentId": agent_id, "status": "running"},
            )
        except Exception as convex_error:
            print(f"⚠️  Warning: Could not update status to running: {convex_error}")

        # Run the agent
        print(f"🤖 Starting Skyvern execution for: {instruction}")
        result = await run_skyvern(
            prompt=instruction,
            cdp_url=cdp_url,
            browser=anchor_browser,
            session_id=browser_session_id,
            provider_model=provider_model,
        )

        # Fetch and upload recording before deleting session
        recording_url = None
        try:
            print(f"📹 Fetching recording for session {browser_session_id}...")
            recording = anchor_browser.sessions.recordings.primary.get(
                browser_session_id
            )

            # Get recording content as bytes
            # Anchor Browser SDK returns recording with .content property
            if hasattr(recording, "content"):
                recording_content = recording.content
            elif hasattr(recording, "read"):
                recording_content = recording.read()
            elif isinstance(recording, bytes):
                recording_content = recording
            else:
                # Try to get bytes directly
                recording_content = (
                    bytes(recording) if hasattr(recording, "__bytes__") else None
                )

            if recording_content:
                print(f"📦 Recording size: {len(recording_content)} bytes")
                recording_url = await upload_recording_to_convex(
                    agent_id, recording_content
                )
            else:
                print("⚠️  Could not extract recording content")
        except Exception as e:
            print(f"⚠️  Failed to fetch/upload recording: {str(e)}")
            import traceback

            traceback.print_exc()

        # Delete browser session (can happen anytime, doesn't affect recording)
        try:
            anchor_browser.sessions.delete(browser_session_id)
            print(f"🗑️  Deleted browser session {browser_session_id}")
        except Exception as e:
            print(f"⚠️  Failed to delete browser session: {str(e)}")

        # Update with result
        print("💾 Saving Skyvern results to Convex...")
        convex_client.mutation(
            "mutations:updateAgentResultFromBackend",
            {
                "agentId": agent_id,
                "result": {
                    "success": True,
                    "data": str(result),
                    "agent": "skyvern",
                },
                "status": "completed",
            },
        )

        if recording_url:
            print(f"✅ Recording saved: {recording_url}")

        print(f"✅ Skyvern agent {agent_id} completed successfully")

    except Exception as e:
        print(f"❌ Skyvern agent {agent_id} failed: {str(e)}")
        import traceback

        traceback.print_exc()

        # Update with error
        try:
            convex_client.mutation(
                "mutations:updateAgentStatusFromBackend",
                {
                    "agentId": agent_id,
                    "status": "failed",
                    "error": str(e),
                },
            )
        except Exception as convex_error:
            print(f"❌ Failed to update error status in Convex: {convex_error}")


async def run_browser_use_task(
    agent_id: str,
    session_id: str,
    instruction: str,
    cdp_url: str,
    browser_session_id: str,
    provider_model: str,
):
    """Run Browser-Use agent in background and update Convex"""
    try:
        # Update status to running
        print(f"🔄 Updating Browser-Use agent {agent_id} status to running...")
        try:
            convex_client.mutation(
                "mutations:updateAgentStatusFromBackend",
                {"agentId": agent_id, "status": "running"},
            )
        except Exception as convex_error:
            print(f"⚠️  Warning: Could not update status to running: {convex_error}")

        # Run the agent
        print(f"🤖 Starting Browser-Use execution for: {instruction}")
        result, usage = await run_browser_use(
            prompt=instruction,
            cdp_url=cdp_url,
            provider_model=provider_model,
            browser=anchor_browser,
            session_id=browser_session_id,
        )

        # Fetch and upload recording before deleting session
        recording_url = None
        try:
            print(f"📹 Fetching recording for session {browser_session_id}...")
            recording = anchor_browser.sessions.recordings.primary.get(
                browser_session_id
            )

            # Get recording content as bytes
            # Anchor Browser SDK returns recording with .content property
            if hasattr(recording, "content"):
                recording_content = recording.content
            elif hasattr(recording, "read"):
                recording_content = recording.read()
            elif isinstance(recording, bytes):
                recording_content = recording
            else:
                # Try to get bytes directly
                recording_content = (
                    bytes(recording) if hasattr(recording, "__bytes__") else None
                )

            if recording_content:
                print(f"📦 Recording size: {len(recording_content)} bytes")
                recording_url = await upload_recording_to_convex(
                    agent_id, recording_content
                )
            else:
                print("⚠️  Could not extract recording content")
        except Exception as e:
            print(f"⚠️  Failed to fetch/upload recording: {str(e)}")
            import traceback

            traceback.print_exc()

        # Delete browser session (can happen anytime, doesn't affect recording)
        try:
            anchor_browser.sessions.delete(browser_session_id)
            print(f"🗑️  Deleted browser session {browser_session_id}")
        except Exception as e:
            print(f"⚠️  Failed to delete browser session: {str(e)}")

        # Debug logging
        print(f"📊 Result type: {type(result)}")
        print(f"📊 Usage type: {type(usage)}")
        if usage:
            print(f"📊 Usage contents: {usage}")

        # Update with result
        print("💾 Saving Browser-Use results to Convex...")

        # Extract result data safely - convert everything to JSON-serializable types
        try:
            final_result = (
                result.final_result()
                if hasattr(result, "final_result")
                else str(result)
            )
        except Exception as e:
            print(f"⚠️  Warning: Could not get final_result: {e}")
            final_result = "Result extraction failed"

        try:
            is_successful = (
                result.is_successful() if hasattr(result, "is_successful") else True
            )
        except Exception as e:
            print(f"⚠️  Warning: Could not get is_successful: {e}")
            is_successful = True

        try:
            # total_duration_seconds is a METHOD, not a property
            duration = (
                result.total_duration_seconds()
                if hasattr(result, "total_duration_seconds")
                else 0
            )
        except Exception as e:
            print(f"⚠️  Warning: Could not get duration: {e}")
            duration = 0

        # Convert usage to a simple dict with only JSON-serializable values
        usage_dict = {}
        if usage:
            try:
                # total_prompt_tokens=17920  total_prompt_cached_tokens=0 total_completion_tokens=433 total_tokens=18353 total_cost=0.0 entry_count=4
                # Extract only the serializable parts
                usage_data = {
                    "total_prompt_tokens": usage.total_prompt_tokens,
                    "total_completion_tokens": usage.total_completion_tokens,
                    "total_prompt_cached_tokens": usage.total_prompt_cached_tokens,
                    "total_cost": usage.total_cost
                    if hasattr(usage, "total_cost")
                    else 0,
                }

                usage_dict = {
                    "total_tokens": usage.total_tokens,
                    "in": usage.total_prompt_tokens,
                    "out": usage.total_completion_tokens,
                    "cached": usage.total_prompt_cached_tokens,
                    "total_cost": compute_cost(provider_model, usage_data),
                }
            except Exception as e:
                print(f"⚠️  Warning: Could not serialize usage: {e}")
                usage_dict = {"raw": str(usage)}

        extracted_content = result.extracted_content()
        action_results = result.action_results()
        action_names = result.action_names()

        print(f"📋 Extracted content: {extracted_content}")
        print(f"📋 Action results: {action_results}")
        print(f"📋 Action names: {action_names}")

        # Extract actions/history from result - ensure JSON serializable for Convex
        actions = []
        try:
            if (
                isinstance(action_names, (list, tuple))
                and isinstance(action_results, (list, tuple))
                and len(action_names) > 0
                and len(action_names) == len(action_results)
            ):
                for i in range(len(action_names)):
                    action_result = action_results[i]
                    action_entry = {
                        "name": to_jsonable(action_names[i]),
                        "result": to_jsonable(
                            {
                                "is_done": getattr(action_result, "is_done", None),
                                "success": getattr(action_result, "success", None),
                                "attachments": getattr(
                                    action_result, "attachments", None
                                ),
                                "error": getattr(action_result, "error", None),
                                "name": to_jsonable(action_names[i]),
                                "extractedContent": getattr(
                                    action_result, "extracted_content", None
                                ),
                                "metadata": getattr(action_result, "metadata", None),
                            }
                        ),
                    }
                    actions.append(to_jsonable(action_entry))
            else:
                print(
                    f"⚠️  Warning: Action names and results do not match: {action_names} != {action_results}"
                )
                actions = []
        except Exception as e:
            print(f"⚠️  Warning: Failed to serialize actions: {e}")
            actions = []

        convex_client.mutation(
            "mutations:updateAgentResultFromBackend",
            {
                "agentId": agent_id,
                "result": {
                    "success": bool(is_successful),
                    "finalResult": str(final_result),
                    "duration": float(duration)
                    if isinstance(duration, (int, float))
                    else 0.0,
                    "usage": usage_dict,
                    "actions": actions,
                    "agent": "browser-use",
                },
                "status": "completed",
            },
        )

        if recording_url:
            print(f"✅ Recording saved: {recording_url}")

        print(f"✅ Browser-Use agent {agent_id} completed successfully")

    except Exception as e:
        print(f"❌ Browser-Use agent {agent_id} failed: {str(e)}")
        import traceback

        traceback.print_exc()

        # Update with error
        try:
            convex_client.mutation(
                "mutations:updateAgentStatusFromBackend",
                {
                    "agentId": agent_id,
                    "status": "failed",
                    "error": str(e),
                },
            )
        except Exception as convex_error:
            print(f"❌ Failed to update error status in Convex: {convex_error}")


# API Endpoints
@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "agent-server",
        "version": "0.1.0",
        "agents": ["skyvern", "browser-use"],
    }


@app.get("/health/convex")
async def health_convex():
    """Test Convex connection"""
    try:
        # Try to query sessions (read-only, shouldn't need auth)
        sessions = convex_client.query("queries:getUserSessions")
        return {
            "status": "connected",
            "convex_url": CONVEX_URL,
            "sessions_count": len(sessions) if sessions else 0,
        }
    except Exception as e:
        return {
            "status": "error",
            "convex_url": CONVEX_URL,
            "error": str(e),
        }


@app.post("/agent/skyvern", response_model=AgentResponse)
async def run_skyvern_agent(request: AgentRequest, background_tasks: BackgroundTasks):
    """
    Start a Skyvern agent task in the background

    NOTE: Skyvern is currently disabled due to dependency conflicts.
    Use Browser-Use, Stagehand, or Smooth instead.

    Returns immediately with session info and browser URL
    """
    raise HTTPException(
        status_code=501,
        detail="Skyvern agent is currently disabled due to dependency conflicts. Please use Browser-Use, Stagehand, or Smooth instead.",
    )


@app.post("/agent/browser-use", response_model=AgentResponse)
async def run_browser_use_agent(
    request: AgentRequest, background_tasks: BackgroundTasks
):
    """
    Start a Browser-Use agent task in the background

    Returns immediately with session info and browser URL
    """
    try:
        # Create browser session
        browser_session = anchor_browser.sessions.create()
        browser_session_id = browser_session.data.id
        cdp_url = browser_session.data.cdp_url
        live_view_url = browser_session.data.live_view_url

        if not live_view_url:
            raise ValueError("Failed to create browser session - no live_view_url")

        if not cdp_url:
            raise ValueError("Failed to create browser session - no cdp_url")

        # Create agent in Convex
        agent_id = convex_client.mutation(
            "mutations:createAgentFromBackend",
            {
                "sessionId": request.sessionId,
                "name": "browser-use",
                "model": request.providerModel,
                "browser": {
                    "sessionId": browser_session_id,
                    "url": live_view_url,
                },
            },
        )

        # Schedule background task
        background_tasks.add_task(
            run_browser_use_task,
            agent_id=agent_id,
            session_id=request.sessionId,
            instruction=request.instruction,
            cdp_url=cdp_url,
            browser_session_id=browser_session_id,
            provider_model=request.providerModel,
        )

        return AgentResponse(
            sessionId=request.sessionId,
            agentId=agent_id,
            browserSessionId=browser_session_id,
            liveUrl=live_view_url,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to start Browser-Use agent: {str(e)}"
        )


if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8080,
        reload=True,
        log_level="info",
    )
