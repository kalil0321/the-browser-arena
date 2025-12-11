import os
import sys
import tempfile
import time
import uuid
import logging
import shutil
import json
from contextlib import asynccontextmanager
from typing import Dict, Optional
import aiohttp

import uvicorn
import filetype
from convex import ConvexClient
from dotenv import load_dotenv
from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator

# Import agent functions
from browser_use_agent import run_browser_use
from notte_agent import run_notte
from instruction_validation import validate_instruction_field
from notte_sdk import NotteClient

from browser import create_browser_session, delete_browser_session, compute_browser_cost

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)

logger = logging.getLogger("agent-server")
logger.setLevel(logging.INFO)

# Load environment variables from project root
load_dotenv("../.env.local")

# Initialize Convex client
CONVEX_URL = os.getenv("CONVEX_URL")
if not CONVEX_URL:
    raise ValueError("CONVEX_URL environment variable is required")

# Create Convex client without authentication
# Backend mutations don't require auth
convex_client = ConvexClient(CONVEX_URL)

# Initialize Notte client (optional)
NOTTE_API_KEY = os.getenv("NOTTE_API_KEY")
if NOTTE_API_KEY:
    notte_client = NotteClient(api_key=NOTTE_API_KEY)
    logger.info("✅ Notte client initialized")
else:
    notte_client = None
    logger.warning("NOTTE_API_KEY not set - Notte agent endpoint disabled")

# Initialize API key for server authentication
AGENT_SERVER_API_KEY = os.getenv("AGENT_SERVER_API_KEY")
if not AGENT_SERVER_API_KEY:
    raise ValueError("AGENT_SERVER_API_KEY environment variable is required")

# Initialize backend API key for Convex recording uploads
BACKEND_API_KEY = os.getenv("BACKEND_API_KEY")
if not BACKEND_API_KEY:
    logger.warning("BACKEND_API_KEY not set - recording uploads to Convex will fail")

# Security scheme for API key authentication
security = HTTPBearer()

# File upload security constants
ALLOWED_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".txt",
    ".csv",
    ".json",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
CHUNK_SIZE = 8192  # 8KB chunks for streaming
MIN_DISK_SPACE = 100 * 1024 * 1024  # Require at least 100MB free disk space

# File identifier to path mapping
# Maps fileId (UUID string) -> filePath (server path)
file_id_to_path: Dict[str, str] = {}


async def verify_api_key(
    authorization: HTTPAuthorizationCredentials = Depends(security),
) -> None:
    """
    Verify that the provided API key matches the server's API key.
    """
    provided_key = authorization.credentials

    if not provided_key or provided_key != AGENT_SERVER_API_KEY:
        logger.warning("Invalid API key provided")
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key. Provide a valid API key in the Authorization header as 'Bearer <key>'",
        )


def validate_file_extension(filename: str) -> str:
    """
    Validate file extension against whitelist.
    Returns the extension if valid, raises HTTPException if invalid.
    """
    if not filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    file_extension = os.path.splitext(filename)[1].lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    return file_extension


def validate_file_content(content: bytes, expected_extension: str) -> None:
    """
    Validate file content using magic byte verification.
    Raises HTTPException if content doesn't match expected file type.
    """
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    expected_extension_lower = expected_extension.lower()

    # Text-based files need special handling since filetype may not detect them
    text_extensions = [".txt", ".csv", ".json"]
    if expected_extension_lower in text_extensions:
        # For text files, verify it's valid UTF-8
        try:
            decoded = content.decode("utf-8")
            # For JSON files, also validate JSON syntax
            if expected_extension_lower == ".json":
                json.loads(decoded)
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail="File content does not match claimed type (invalid text encoding)",
            )
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=400,
                detail="File content is not valid JSON",
            )
        # Text files are valid if they decode successfully
        return

    # For binary files, use filetype library to detect actual file type
    kind = filetype.guess(content)
    if not kind:
        # filetype couldn't detect the type - this is suspicious for binary files
        raise HTTPException(
            status_code=400,
            detail="File content type could not be determined. The file may be corrupted or not match the claimed type.",
        )

    # Map detected MIME type to expected extension
    detected_mime = kind.mime
    extension_mime_map = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }

    expected_mime = extension_mime_map.get(expected_extension_lower)
    if expected_mime and detected_mime != expected_mime:
        raise HTTPException(
            status_code=400,
            detail=f"File content does not match claimed type. Detected: {detected_mime}, expected: {expected_mime}",
        )


def check_disk_space(directory: str, required_space: int) -> None:
    """
    Check if there's sufficient disk space available.
    Raises HTTPException if insufficient disk space.
    """
    stat = shutil.disk_usage(directory)
    free_space = stat.free

    if free_space < required_space:
        raise HTTPException(
            status_code=507,  # Insufficient Storage
            detail=f"Insufficient disk space. Required: {required_space / (1024 * 1024):.1f}MB, Available: {free_space / (1024 * 1024):.1f}MB",
        )


# Pydantic models
class AgentRequest(BaseModel):
    sessionId: str  # Convex session ID
    instruction: str = Field(
        ...,
        description="User instruction for the agent",
        min_length=1,
        max_length=5000,
    )
    providerModel: Optional[str] = ""
    # Optional browser session info (if provided, skip browser session creation)
    browserSessionId: Optional[str] = None
    cdpUrl: Optional[str] = None
    liveViewUrl: Optional[str] = None
    # Optional user ID for browser profile
    userId: Optional[str] = None
    # Optional agent ID (if provided, skip agent creation - used for demo sessions)
    agentId: Optional[str] = None
    # Optional user-provided API keys (BYOK - Bring Your Own Key)
    openaiApiKey: Optional[str] = None
    googleApiKey: Optional[str] = None
    anthropicApiKey: Optional[str] = None
    browserUseApiKey: Optional[str] = None
    openrouterApiKey: Optional[str] = None
    secrets: Optional[Dict[str, str]] = None
    fileId: Optional[str] = None

    @field_validator("instruction")
    @classmethod
    def validate_instruction(cls, v: str) -> str:
        """Validate instruction for prompt injection attempts"""
        return validate_instruction_field(v)


class AgentResponse(BaseModel):
    sessionId: str
    agentId: str
    browserSessionId: str
    liveUrl: str


class NotteAgentRequest(BaseModel):
    sessionId: str
    instruction: str = Field(
        ...,
        description="User instruction for the Notte agent",
        min_length=1,
        max_length=5000,
    )
    agentId: Optional[str] = None

    @field_validator("instruction")
    @classmethod
    def validate_instruction(cls, v: str) -> str:
        return validate_instruction_field(v)


# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Agent server starting up...")
    logger.info(f"📡 Connected to Convex: {CONVEX_URL}")
    logger.info(
        f"🔑 API key authentication: {'enabled' if AGENT_SERVER_API_KEY else 'disabled'}"
    )
    yield
    # Shutdown
    logger.info("👋 Agent server shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Agent Server",
    description="API for running browser automation agents (Browser-Use)",
    version="0.1.0",
    lifespan=lifespan,
)


# Request ID middleware (must be after app creation)
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add request ID for tracking"""
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id

    start_time = time.time()

    # Log request
    logger.info(
        f"[{request_id}] {request.method} {request.url.path} "
        f"from {request.client.host if request.client else 'unknown'}"
    )

    try:
        response = await call_next(request)
        process_time = time.time() - start_time

        # Log response
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} "
            f"-> {response.status_code} ({process_time:.3f}s)"
        )

        response.headers["X-Request-ID"] = request_id
        return response
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(
            f"[{request_id}] {request.method} {request.url.path} "
            f"-> ERROR ({process_time:.3f}s): {str(e)}",
            exc_info=True,
        )
        raise


# Exception handler for unhandled errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"[{request_id}] Unhandled exception: {str(exc)}", exc_info=True)
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "request_id": request_id,
            "detail": str(exc)
            if os.getenv("ENVIRONMENT") == "development"
            else "An error occurred",
        },
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
    "google/gemini-3-pro-preview": {
        "in": 2 / 1_000_000,
        "out": 12.0 / 1_000_000,
        "cached": 0.2 / 1_000_000,
    },
    "openai/gpt-4.1": {
        "in": 2.0 / 1_000_000,
        "out": 8.0 / 1_000_000,
        "cached": 0.5 / 1_000_000,
    },
    "anthropic/claude-haiku-4.5": {
        "in": 1.0 / 1_000_000,
        "out": 5.0 / 1_000_000,
        "cached": 0.1 / 1_000_000,
    },
    "openrouter/moonshotai/kimi-k2-thinking": {
        "in": 0.6 / 1_000_000,
        "out": 2.5 / 1_000_000,
        "cached": 0.06 / 1_000_000,
    },
}


def compute_cost(model: str, usage: dict) -> float:
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

        # Add API key authentication header
        headers = {}
        if BACKEND_API_KEY:
            headers["X-API-Key"] = BACKEND_API_KEY
        else:
            logger.warning(
                "BACKEND_API_KEY not configured - recording upload may fail authentication"
            )

        async with aiohttp.ClientSession() as session:
            async with session.post(
                convex_http_url, data=form_data, headers=headers
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    recording_url = result.get("recordingUrl")
                    logger.info(f"✅ Recording uploaded successfully: {recording_url}")
                    return recording_url
                else:
                    error_text = await response.text()
                    logger.warning(
                        f"Failed to upload recording: HTTP {response.status} - {error_text}"
                    )
                    return None
    except Exception as e:
        logger.error(f"Error uploading recording: {str(e)}", exc_info=True)
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
async def run_browser_use_task(
    agent_id: str,
    session_id: str,
    instruction: str,
    cdp_url: str,
    browser_session_id: str,
    provider_model: str,
    secrets: Optional[Dict[str, str]] = None,
    openai_api_key: Optional[str] = None,
    google_api_key: Optional[str] = None,
    anthropic_api_key: Optional[str] = None,
    browser_use_api_key: Optional[str] = None,
    openrouter_api_key: Optional[str] = None,
    file_path: Optional[str] = None,
):
    """Run Browser-Use agent in background and update Convex"""
    task_start_time = time.time()
    logger.info(
        f"[Agent {agent_id[:8]}] Starting Browser-Use task for session {session_id[:8]}"
    )

    try:
        # Update status to running
        logger.info(f"[Agent {agent_id[:8]}] Updating status to 'running'")
        try:
            convex_client.mutation(
                "mutations:updateAgentStatusFromBackend",
                {"agentId": agent_id, "status": "running"},
            )
        except Exception as convex_error:
            logger.warning(
                f"[Agent {agent_id[:8]}] Could not update status to running: {convex_error}",
                exc_info=True,
            )
            raise convex_error

        # Run the agent
        logger.info(
            f"[Agent {agent_id[:8]}] Starting execution - Instruction: {instruction[:100]}..."
        )
        if secrets:
            # Log secrets count without exposing key names for security
            logger.info(
                f"[Agent {agent_id[:8]}] Passing {len(secrets)} secrets to Browser-Use agent"
            )
        if file_path:
            logger.info(f"[Agent {agent_id[:8]}] File provided: {file_path}")

        result, usage, timings = await run_browser_use(
            prompt=instruction,
            cdp_url=cdp_url,
            provider_model=provider_model,
            secrets=secrets,
            openai_api_key=openai_api_key,
            google_api_key=google_api_key,
            anthropic_api_key=anthropic_api_key,
            browser_use_api_key=browser_use_api_key,
            openrouter_api_key=openrouter_api_key,
            file_path=file_path,
        )

        # Log timing information
        if timings:
            logger.info(
                f"[Agent {agent_id[:8]}] Timing Summary - "
                f"Total: {timings.get('total', 0):.2f}s | "
                f"LLM Init: {timings.get('llm_initialization', 0):.2f}s | "
                f"Browser Init: {timings.get('browser_initialization', 0):.2f}s | "
                f"Agent Init: {timings.get('agent_initialization', 0):.2f}s | "
                f"Execution: {timings.get('agent_execution', 0):.2f}s"
            )

        # Fetch and upload recording before deleting session
        recording_url = None
        # try:
        #     logger.info(
        #         f"[Agent {agent_id[:8]}] Fetching recording for session {browser_session_id[:8]}..."
        #     )
        #     recording = anchor_browser.sessions.recordings.primary.get(
        #         browser_session_id
        #     )

        #     # Get recording content as bytes
        #     # Anchor Browser SDK returns recording with .content property
        #     if hasattr(recording, "content"):
        #         recording_content = recording.content
        #     elif hasattr(recording, "read"):
        #         recording_content = recording.read()
        #     elif isinstance(recording, bytes):
        #         recording_content = recording
        #     else:
        #         # Try to get bytes directly
        #         recording_content = (
        #             bytes(recording) if hasattr(recording, "__bytes__") else None
        #         )

        #     if recording_content:
        #         logger.info(
        #             f"[Agent {agent_id[:8]}] Recording size: {len(recording_content)} bytes"
        #         )
        #         recording_url = await upload_recording_to_convex(
        #             agent_id, recording_content
        #         )
        #     else:
        #         logger.warning(
        #             f"[Agent {agent_id[:8]}] Could not extract recording content"
        #         )
        # except Exception as e:
        #     logger.warning(
        #         f"[Agent {agent_id[:8]}] Failed to fetch/upload recording: {str(e)}",
        #         exc_info=True,
        #     )

        # Debug logging
        logger.debug(
            f"[Agent {agent_id[:8]}] Result type: {type(result)}, Usage type: {type(usage)}"
        )
        if usage:
            logger.debug(f"[Agent {agent_id[:8]}] Usage: {usage}")

        # Update with result
        logger.info(f"[Agent {agent_id[:8]}] Saving results to Convex...")

        # Extract result data safely - convert everything to JSON-serializable types
        try:
            final_result = (
                result.final_result()
                if hasattr(result, "final_result")
                else str(result)
            )
        except Exception as e:
            logger.warning(
                f"[Agent {agent_id[:8]}] Could not get final_result: {e}", exc_info=True
            )
            final_result = "Result extraction failed"

        try:
            is_successful = (
                result.is_successful() if hasattr(result, "is_successful") else True
            )
        except Exception as e:
            logger.warning(
                f"[Agent {agent_id[:8]}] Could not get is_successful: {e}",
                exc_info=True,
            )
            is_successful = True

        try:
            # total_duration_seconds is a METHOD, not a property
            duration = (
                result.total_duration_seconds()
                if hasattr(result, "total_duration_seconds")
                else 0
            )
        except Exception as e:
            logger.warning(
                f"[Agent {agent_id[:8]}] Could not get duration: {e}", exc_info=True
            )
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

                llm_cost = compute_cost(provider_model, usage_data)

                total_seconds = float(timings.get("total", 0))
                browser_cost = compute_browser_cost(total_seconds)

                usage_dict = {
                    "total_tokens": usage.total_tokens,
                    "in": usage.total_prompt_tokens,
                    "out": usage.total_completion_tokens,
                    "cached": usage.total_prompt_cached_tokens,
                    "total_cost": llm_cost + browser_cost,
                    "llm_cost": llm_cost,
                    "browser_cost": browser_cost,
                }
            except Exception as e:
                logger.warning(
                    f"[Agent {agent_id[:8]}] Could not serialize usage: {e}",
                    exc_info=True,
                )
                usage_dict = {"raw": str(usage)}

        extracted_content = result.extracted_content()
        action_results = result.action_results()
        action_names = result.action_names()

        logger.debug(
            f"[Agent {agent_id[:8]}] Extracted content length: {len(extracted_content) if extracted_content else 0}"
        )
        logger.debug(
            f"[Agent {agent_id[:8]}] Actions count: {len(action_names) if action_names else 0}"
        )

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
                logger.warning(
                    f"[Agent {agent_id[:8]}] Action names and results do not match: "
                    f"names={len(action_names) if action_names else 0}, "
                    f"results={len(action_results) if action_results else 0}"
                )
                actions = []
        except Exception as e:
            logger.warning(
                f"[Agent {agent_id[:8]}] Failed to serialize actions: {e}",
                exc_info=True,
            )
            actions = []

        # Send payload to backend first
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
            logger.info(f"[Agent {agent_id[:8]}] Recording saved: {recording_url}")

        task_duration = time.time() - task_start_time
        logger.info(
            f"[Agent {agent_id[:8]}] ✅ Completed successfully in {task_duration:.2f}s - "
            f"Session: {session_id[:8]}, Success: {is_successful}"
        )

        # Delete browser session after payload is sent to backend
        try:
            delete_browser_session(browser_session_id)
            logger.info(
                f"[Agent {agent_id[:8]}] Deleted browser session {browser_session_id[:8]}"
            )
        except Exception as e:
            logger.warning(
                f"[Agent {agent_id[:8]}] Failed to delete browser session: {str(e)}",
                exc_info=True,
            )

    except Exception as e:
        task_duration = time.time() - task_start_time
        logger.error(
            f"[Agent {agent_id[:8]}] ❌ Failed after {task_duration:.2f}s: {str(e)}",
            exc_info=True,
        )

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
            logger.info(f"[Agent {agent_id[:8]}] Updated Convex with error status")
        except Exception as convex_error:
            logger.error(
                f"[Agent {agent_id[:8]}] Failed to update error status in Convex: {convex_error}",
                exc_info=True,
            )


async def run_notte_task(
    agent_id: str,
    session_id: str,
    instruction: str,
    notte_session_id: str,
):
    """Run Notte agent in background and update Convex"""
    task_start_time = time.time()
    logger.info(
        f"[Agent {agent_id[:8]}] Starting Notte task for session {session_id[:8]}"
    )

    if notte_client is None:
        logger.error("Notte client is not configured. Cannot run Notte agent.")
        try:
            convex_client.mutation(
                "mutations:updateAgentStatusFromBackend",
                {
                    "agentId": agent_id,
                    "status": "failed",
                    "error": "Notte client is not configured",
                },
            )
        except Exception as convex_error:
            logger.error(
                f"[Agent {agent_id[:8]}] Failed to update error status in Convex: {convex_error}",
                exc_info=True,
            )
        return

    try:
        # Update status to running
        logger.info(f"[Agent {agent_id[:8]}] Updating status to 'running'")
        try:
            convex_client.mutation(
                "mutations:updateAgentStatusFromBackend",
                {"agentId": agent_id, "status": "running"},
            )
        except Exception as convex_error:
            logger.warning(
                f"[Agent {agent_id[:8]}] Could not update status to running: {convex_error}",
                exc_info=True,
            )

        result_payload, usage_dict, timings, browser_url = await run_notte(
            prompt=instruction,
            notte_client=notte_client,
            session_id=session_id,
            notte_session_id=notte_session_id,
            agent_id=agent_id,
            convex_client=convex_client,
        )

        # Update browser URL in Convex if available
        if browser_url:
            try:
                convex_client.mutation(
                    "mutations:updateAgentBrowserUrlFromBackend",
                    {
                        "agentId": agent_id,
                        "url": browser_url,
                    },
                )
                logger.info(f"[Agent {agent_id[:8]}] Updated browser URL in Convex")
            except Exception as url_update_error:
                logger.warning(
                    f"[Agent {agent_id[:8]}] Failed to update browser URL in Convex: {url_update_error}",
                    exc_info=True,
                )

        # Only update Convex with result if answer is not null/empty
        answer = result_payload.get("answer")
        if answer:
            try:
                convex_client.mutation(
                    "mutations:updateAgentResultFromBackend",
                    {
                        "agentId": agent_id,
                        "result": result_payload,
                        "status": "completed",
                    },
                )
                logger.info(
                    f"[Agent {agent_id[:8]}] Updated Convex with result (answer present)"
                )
            except Exception as result_error:
                logger.warning(
                    f"[Agent {agent_id[:8]}] Failed to update result in Convex: {result_error}",
                    exc_info=True,
                )
        else:
            logger.warning(
                f"[Agent {agent_id[:8]}] Skipping Convex update - answer is null/empty"
            )
            # Still update status to completed even if answer is missing
            try:
                convex_client.mutation(
                    "mutations:updateAgentStatusFromBackend",
                    {
                        "agentId": agent_id,
                        "status": "completed",
                    },
                )
            except Exception as status_error:
                logger.warning(
                    f"[Agent {agent_id[:8]}] Failed to update status in Convex: {status_error}",
                    exc_info=True,
                )

        task_duration = time.time() - task_start_time
        logger.info(
            f"[Agent {agent_id[:8]}] ✅ Notte agent completed in {task_duration:.2f}s"
        )
    except Exception as e:
        task_duration = time.time() - task_start_time
        logger.error(
            f"[Agent {agent_id[:8]}] ❌ Notte agent failed after {task_duration:.2f}s: {e}",
            exc_info=True,
        )
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
            logger.error(
                f"[Agent {agent_id[:8]}] Failed to update Notte agent status in Convex: {convex_error}",
                exc_info=True,
            )


# API Endpoints
@app.get("/")
async def root():
    """Health check endpoint"""
    available_agents = ["browser-use"]
    if notte_client:
        available_agents.append("notte")
    return {
        "status": "healthy",
        "service": "agent-server",
        "version": "0.1.0",
        "agents": available_agents,
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


@app.post("/agent/browser-use", response_model=AgentResponse)
async def run_browser_use_agent(
    request: AgentRequest,
    background_tasks: BackgroundTasks,
    _: None = Depends(verify_api_key),
):
    """
    Start a Browser-Use agent task in the background

    Returns immediately with session info and browser URL

    If browserSessionId, cdpUrl, and liveViewUrl are provided, uses those instead of creating a new session.
    This allows the Next.js API to create the browser session in parallel, saving 3-5 seconds.
    """
    request_id = uuid.uuid4().hex[:8]
    logger.info(
        f"[Request {request_id}] Browser-Use agent request - "
        f"Session: {request.sessionId[:8]}, Model: {request.providerModel}, "
        f"Has browser session: {bool(request.browserSessionId)}"
    )

    try:
        # Use provided browser session if available, otherwise create new one
        if request.browserSessionId and request.cdpUrl and request.liveViewUrl:
            # Browser session already created by Next.js API (parallelized for performance)
            browser_session_id = request.browserSessionId
            cdp_url = request.cdpUrl
            live_view_url = request.liveViewUrl
        else:
            # Fallback: create browser session here (slower path)
            # Create browser profile configuration using user_id if provided
            browser_config = {}
            if request.userId:
                browser_config = {
                    "browser": {
                        "profile": {
                            "name": f"profile-{request.userId}",
                            "persist": True,
                        }
                    }
                }
                browser_session_id, cdp_url, live_view_url = create_browser_session(browser_config)
            else:
                browser_session_id, cdp_url, live_view_url = create_browser_session()

        file_path = None
        if request.fileId:
            if request.fileId in file_id_to_path:
                file_path = file_id_to_path[request.fileId]
            else:
                raise HTTPException(
                    status_code=404,
                    detail="File not found. The file may have been cleaned up or the fileId is invalid.",
                )

        # Create agent in Convex (unless agentId is provided, e.g., for demo sessions)
        agent_id = request.agentId
        if not agent_id:
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
            secrets=request.secrets,
            openai_api_key=request.openaiApiKey,
            google_api_key=request.googleApiKey,
            anthropic_api_key=request.anthropicApiKey,
            browser_use_api_key=request.browserUseApiKey,
            openrouter_api_key=request.openrouterApiKey,
            file_path=file_path,
        )

        logger.info(
            f"[Request {request_id}] Browser-Use agent started - "
            f"Agent ID: {agent_id[:8]}, Browser Session: {browser_session_id[:8]}"
        )

        return AgentResponse(
            sessionId=request.sessionId,
            agentId=agent_id,
            browserSessionId=browser_session_id,
            liveUrl=live_view_url,
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(
            f"[Request {request_id}] Failed to start Browser-Use agent: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail=f"Failed to start Browser-Use agent: {str(e)}"
        )


@app.post("/agent/notte", response_model=AgentResponse)
async def run_notte_agent(
    request: NotteAgentRequest,
    background_tasks: BackgroundTasks,
    _: None = Depends(verify_api_key),
):
    """
    Start a Notte agent task in the background
    """
    if notte_client is None:
        raise HTTPException(
            status_code=503,
            detail="Notte agent is not configured on this server",
        )

    request_id = uuid.uuid4().hex[:8]
    logger.info(
        f"[Request {request_id}] Notte agent request - Session: {request.sessionId[:8]}"
    )

    try:
        # Create agent in Convex with placeholder browser URL (will be updated after agent runs)
        agent_id = request.agentId
        if not agent_id:
            agent_id = convex_client.mutation(
                "mutations:createAgentFromBackend",
                {
                    "sessionId": request.sessionId,
                    "name": "notte",
                    "model": "",
                    "browser": {
                        "sessionId": "",
                        "url": "",
                    },
                },
            )

        # Pass notte_session_id=None so Notte handles session creation internally
        background_tasks.add_task(
            run_notte_task,
            agent_id=agent_id,
            session_id=request.sessionId,
            instruction=request.instruction,
            notte_session_id=None,
        )

        logger.info(
            f"[Request {request_id}] Notte agent started - Agent ID: {agent_id[:8]}"
        )

        return AgentResponse(
            sessionId=request.sessionId,
            agentId=agent_id,
            browserSessionId="",
            liveUrl="",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"[Request {request_id}] Failed to start Notte agent: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail=f"Failed to start Notte agent: {str(e)}"
        )


@app.post("/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    _: None = Depends(verify_api_key),
):
    """
    Upload a file to be used by browser-use agent tasks.

    Validates file type, size, and content before saving.
    Returns an opaque file identifier (fileId) instead of server path for security.
    The file will be cleaned up after the task completes (or can be cleaned up manually).
    """
    try:
        # Validate filename and extension
        if not file.filename:
            raise HTTPException(status_code=400, detail="Filename is required")

        file_extension = validate_file_extension(file.filename)

        # Check Content-Length header if available
        content_length = None
        if hasattr(file, "size") and file.size:
            content_length = file.size
        elif hasattr(file, "headers"):
            content_length_header = file.headers.get("content-length")
            if content_length_header:
                try:
                    content_length = int(content_length_header)
                except ValueError:
                    pass

        if content_length and content_length > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE / (1024 * 1024):.1f}MB",
            )

        # Create temp directory if it doesn't exist
        temp_dir = os.path.join(tempfile.gettempdir(), "browser_arena_uploads")
        os.makedirs(temp_dir, exist_ok=True)

        # Check disk space before proceeding
        check_disk_space(temp_dir, MAX_FILE_SIZE + MIN_DISK_SPACE)

        # Generate unique filename and file identifier
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(temp_dir, unique_filename)
        file_id = str(uuid.uuid4())

        # Stream file content in chunks, writing directly to disk and collecting for validation
        total_size = 0
        content_buffer = b""  # Buffer for magic byte verification
        MAGIC_BYTE_BUFFER_SIZE = 8192  # Read first 8KB for magic byte verification

        with open(file_path, "wb") as f:
            async for chunk in file.stream():
                total_size += len(chunk)

                # Check size during streaming to fail fast
                if total_size > MAX_FILE_SIZE:
                    # Clean up partial file
                    try:
                        os.remove(file_path)
                    except Exception:
                        pass
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum size: {MAX_FILE_SIZE / (1024 * 1024):.1f}MB",
                    )

                # Write chunk to disk immediately
                f.write(chunk)

                # Collect first bytes for magic byte verification
                if len(content_buffer) < MAGIC_BYTE_BUFFER_SIZE:
                    content_buffer += chunk
                    if len(content_buffer) > MAGIC_BYTE_BUFFER_SIZE:
                        content_buffer = content_buffer[:MAGIC_BYTE_BUFFER_SIZE]

        # For small files, read entire file for validation
        # For larger files, validate based on first bytes (less secure but more memory efficient)
        if total_size <= MAGIC_BYTE_BUFFER_SIZE:
            # Small file - read entire content for full validation
            with open(file_path, "rb") as f:
                content = f.read()
            validate_file_content(content, file_extension)
        else:
            # Large file - validate based on first bytes
            # This is a trade-off: we validate the file type but not the entire content
            # For text files, we need to read more to validate encoding
            if file_extension.lower() in [".txt", ".csv", ".json"]:
                # For text files, read entire file to validate encoding and JSON syntax
                with open(file_path, "rb") as f:
                    content = f.read()
                validate_file_content(content, file_extension)
            else:
                # For binary files, validate based on first bytes
                validate_file_content(content_buffer, file_extension)

        file_id_to_path[file_id] = file_path

        logger.info(
            f"File uploaded: {file.filename} (fileId: {file_id[:8]}...) -> {file_path} ({total_size} bytes)"
        )

        return {
            "fileId": file_id,
            "filename": file.filename,
            "size": total_size,
        }

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}", exc_info=True)
        # Don't expose internal error details to client
        raise HTTPException(status_code=500, detail="Failed to upload file")


if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8080,
        reload=True,
        log_level="info",
        loop="asyncio",  # Use asyncio loop instead of uvloop for nest_asyncio compatibility
    )
