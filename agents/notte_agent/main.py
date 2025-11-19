import asyncio
import logging
import time
from typing import Dict
from notte_sdk import NotteClient

logger = logging.getLogger("notte-agent")


def get_debug_info_with_polling(
    session,
    session_id: str,
    max_retries: int = 10,
    initial_delay: float = 1.0,
    max_delay: float = 5.0,
):
    """
    Poll for debug_info with exponential backoff until session is ready.

    Args:
        session: Notte session object
        session_id: Session ID for logging
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds before first retry
        max_delay: Maximum delay between retries in seconds

    Returns:
        debug_info object or None if all retries failed
    """
    start_time = time.time()
    delay = initial_delay

    for attempt in range(max_retries):
        try:
            debug_info = session.debug_info()
            elapsed = time.time() - start_time
            logger.info(
                f"[Session {session_id[:8]}] Successfully got debug_info after {elapsed:.2f}s (attempt {attempt + 1}/{max_retries})"
            )
            # Print debug_info attributes for debugging
            logger.info(
                f"[Session {session_id[:8]}] Debug info attributes: {dir(debug_info)}"
            )
            if hasattr(debug_info, "__dict__"):
                logger.info(
                    f"[Session {session_id[:8]}] Debug info dict: {debug_info.__dict__}"
                )
            if hasattr(debug_info, "debug_url"):
                logger.info(
                    f"[Session {session_id[:8]}] Debug URL: {debug_info.debug_url}"
                )
            if hasattr(debug_info, "ws"):
                ws_attr = getattr(debug_info, "ws", None)
                if ws_attr:
                    logger.info(f"[Session {session_id[:8]}] Debug info ws: {ws_attr}")
                    if hasattr(ws_attr, "recording"):
                        logger.info(
                            f"[Session {session_id[:8]}] Debug info ws.recording: {ws_attr.recording}"
                        )
            return debug_info
        except Exception as e:
            elapsed = time.time() - start_time
            if attempt < max_retries - 1:
                logger.debug(
                    f"[Session {session_id[:8]}] Debug info not ready after {elapsed:.2f}s (attempt {attempt + 1}/{max_retries}), retrying in {delay:.1f}s..."
                )
                time.sleep(delay)
                delay = min(delay * 1.5, max_delay)  # Exponential backoff with cap
            else:
                logger.warning(
                    f"[Session {session_id[:8]}] Failed to get debug_info after {elapsed:.2f}s and {max_retries} attempts: {e}"
                )
                return None

    return None


def filter_selectors_from_data(data):
    """
    Recursively filter out selector fields from data to reduce payload size.
    Removes 'selector', 'css_selector', 'xpath_selector', 'python_selector',
    'playwright_selector', 'notte_selector', and 'iframe_parent_css_selectors' fields.
    """
    if data is None:
        return None

    if isinstance(data, dict):
        filtered = {}
        for key, value in data.items():
            # Skip selector-related keys
            if key in [
                "selector",
                "css_selector",
                "xpath_selector",
                "python_selector",
                "playwright_selector",
                "notte_selector",
                "iframe_parent_css_selectors",
            ]:
                continue
            # Recursively filter nested structures
            filtered[key] = filter_selectors_from_data(value)
        return filtered
    elif isinstance(data, list):
        return [filter_selectors_from_data(item) for item in data]
    else:
        return data


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


async def run_notte(
    prompt: str,
    notte_client: NotteClient,
    session_id: str,
    notte_session_id: str = None,
    agent_id: str = None,
    convex_client=None,
):
    """
    Run Notte agent with the given prompt

    Args:
        prompt: The instruction for the agent
        notte_client: NotteClient instance
        session_id: Convex session ID (for logging)
        notte_session_id: Notte session ID (if None, will create a new session)
        agent_id: Agent ID for updating Convex (optional)
        convex_client: Convex client for updating browser URL (optional)

    Returns:
        Tuple of (Notte agent result, usage summary, timings dict, browser_url)
    """
    timings: Dict[str, float] = {}
    overall_start = time.time()

    # Time agent execution
    agent_run_start = time.time()

    async def execute_notte_agent():
        def _run_agent(notte_client_ref, agent_id_ref, convex_client_ref):
            # Use existing session if provided, otherwise create new one
            if notte_session_id:
                session = notte_client_ref.Session(session_id=notte_session_id)
                # Get browser URL for existing session
                debug_info = get_debug_info_with_polling(session, notte_session_id)
                browser_url = ""
                if debug_info:
                    browser_url = getattr(debug_info, "debug_url", "") or ""
                    logger.info(
                        f"[Session {session_id[:8]}] Initial browser_url from debug_url: {browser_url}"
                    )
                    if not browser_url:
                        # Construct viewer URL from debug_info
                        ws_recording = getattr(debug_info, "ws", None)
                        logger.info(
                            f"[Session {session_id[:8]}] ws_recording: {ws_recording}"
                        )
                        if ws_recording and hasattr(ws_recording, "recording"):
                            recording = getattr(ws_recording, "recording", None)
                            logger.info(
                                f"[Session {session_id[:8]}] ws_recording.recording: {recording}"
                            )
                            if recording:
                                browser_url = f"https://api.notte.cc/sessions/viewer/index.html?ws={recording}"
                        else:
                            # Fallback: construct from cdp_url
                            try:
                                cdp_url = session.cdp_url()
                                logger.info(
                                    f"[Session {session_id[:8]}] cdp_url: {cdp_url}"
                                )
                                if cdp_url:
                                    browser_url = f"https://api.notte.cc/sessions/viewer/index.html?ws={cdp_url.split('?')[0]}/recording{cdp_url.split('?')[1] if '?' in cdp_url else ''}"
                            except Exception as cdp_error:
                                logger.warning(
                                    f"[Session {session_id[:8]}] Failed to get cdp_url: {cdp_error}",
                                    exc_info=True,
                                )
                logger.info(
                    f"[Session {session_id[:8]}] Final browser_url: {browser_url}"
                )
                # Update Convex with browser URL as soon as it's available
                if browser_url and agent_id_ref and convex_client_ref:
                    try:
                        convex_client_ref.mutation(
                            "mutations:updateAgentBrowserUrlFromBackend",
                            {
                                "agentId": agent_id_ref,
                                "url": browser_url,
                            },
                        )
                        logger.info(
                            f"[Session {session_id[:8]}] Updated browser URL in Convex immediately"
                        )
                    except Exception as url_update_error:
                        logger.warning(
                            f"[Session {session_id[:8]}] Failed to update browser URL in Convex: {url_update_error}",
                            exc_info=True,
                        )
                if not browser_url:
                    logger.warning(
                        f"[Session {session_id[:8]}] Could not get browser URL for existing session"
                    )
            else:
                session = notte_client_ref.Session(open_viewer=False)
                session.start()
                notte_session_id_actual = session.session_id
                # Get browser URL for new session with polling
                debug_info = get_debug_info_with_polling(
                    session, notte_session_id_actual
                )
                browser_url = ""
                if debug_info:
                    browser_url = getattr(debug_info, "debug_url", "") or ""
                    logger.info(
                        f"[Session {session_id[:8]}] Initial browser_url from debug_url: {browser_url}"
                    )
                    if not browser_url:
                        # Construct viewer URL from debug_info
                        ws_recording = getattr(debug_info, "ws", None)
                        logger.info(
                            f"[Session {session_id[:8]}] ws_recording: {ws_recording}"
                        )
                        if ws_recording and hasattr(ws_recording, "recording"):
                            recording = getattr(ws_recording, "recording", None)
                            logger.info(
                                f"[Session {session_id[:8]}] ws_recording.recording: {recording}"
                            )
                            if recording:
                                browser_url = f"https://api.notte.cc/sessions/viewer/index.html?ws={recording}"
                        else:
                            # Fallback: construct from cdp_url
                            try:
                                cdp_url = session.cdp_url()
                                logger.info(
                                    f"[Session {session_id[:8]}] cdp_url: {cdp_url}"
                                )
                                if cdp_url:
                                    browser_url = f"https://api.notte.cc/sessions/viewer/index.html?ws={cdp_url.split('?')[0]}/recording{cdp_url.split('?')[1] if '?' in cdp_url else ''}"
                            except Exception as cdp_error:
                                logger.warning(
                                    f"[Session {session_id[:8]}] Failed to get cdp_url: {cdp_error}",
                                    exc_info=True,
                                )
                logger.info(
                    f"[Session {session_id[:8]}] Final browser_url: {browser_url}"
                )
                # Update Convex with browser URL as soon as it's available
                if browser_url and agent_id_ref and convex_client_ref:
                    try:
                        convex_client_ref.mutation(
                            "mutations:updateAgentBrowserUrlFromBackend",
                            {
                                "agentId": agent_id_ref,
                                "url": browser_url,
                            },
                        )
                        logger.info(
                            f"[Session {session_id[:8]}] Updated browser URL in Convex immediately"
                        )
                    except Exception as url_update_error:
                        logger.warning(
                            f"[Session {session_id[:8]}] Failed to update browser URL in Convex: {url_update_error}",
                            exc_info=True,
                        )
                if not browser_url:
                    logger.warning(
                        f"[Session {session_id[:8]}] Could not get browser URL for new session"
                    )

            agent = notte_client_ref.Agent(
                session=session,
            )
            try:
                logger.info(f"[Session {session_id[:8]}] Executing Notte agent")
                response = agent.run(task=prompt)

                # Log response details
                logger.info(f"[Session {session_id[:8]}] Agent run completed")
                logger.info(
                    f"[Session {session_id[:8]}] Response type: {type(response)}"
                )
                logger.info(
                    f"[Session {session_id[:8]}] Response is None: {response is None}"
                )

                if response is not None:
                    logger.info(
                        f"[Session {session_id[:8]}] Response attributes: {dir(response)}"
                    )
                    if hasattr(response, "__dict__"):
                        logger.info(
                            f"[Session {session_id[:8]}] Response dict keys: {list(response.__dict__.keys())}"
                        )
                    # Log key attributes
                    for attr in [
                        "success",
                        "status",
                        "answer",
                        "task",
                        "url",
                        "agent_id",
                        "session_id",
                        "created_at",
                        "closed_at",
                        "credit_usage",
                        "steps",
                    ]:
                        if hasattr(response, attr):
                            value = getattr(response, attr)
                            logger.info(
                                f"[Session {session_id[:8]}] Response.{attr}: {value}"
                            )
                else:
                    logger.warning(
                        f"[Session {session_id[:8]}] Response is None! Attempting to get result from agent..."
                    )
                    # Try to get the result from the agent if response is None
                    try:
                        # Get agent_id from the agent
                        agent_id = None
                        if hasattr(agent, "agent_id"):
                            agent_id = agent.agent_id
                            logger.info(
                                f"[Session {session_id[:8]}] Agent ID: {agent_id}"
                            )

                        # Try to get status from the agent client
                        if agent_id and hasattr(notte_client_ref, "agents"):
                            logger.info(
                                f"[Session {session_id[:8]}] Polling agent status..."
                            )
                            # Poll for status with retries
                            for poll_attempt in range(10):
                                try:
                                    status_response = notte_client_ref.agents.status(
                                        agent_id=agent_id
                                    )
                                    logger.info(
                                        f"[Session {session_id[:8]}] Got status response on attempt {poll_attempt + 1}: {type(status_response)}"
                                    )
                                    if status_response:
                                        response = status_response
                                        logger.info(
                                            f"[Session {session_id[:8]}] Successfully retrieved response from status"
                                        )
                                        break
                                except Exception as status_error:
                                    logger.debug(
                                        f"[Session {session_id[:8]}] Status poll attempt {poll_attempt + 1} failed: {status_error}"
                                    )
                                    if poll_attempt < 9:
                                        time.sleep(1.0)
                    except Exception as result_error:
                        logger.warning(
                            f"[Session {session_id[:8]}] Failed to get result from agent: {result_error}",
                            exc_info=True,
                        )

                return response, session.session_id, browser_url
            finally:
                try:
                    session.stop()
                    logger.info(
                        f"[Session {session_id[:8]}] Notte session {session.session_id[:8]} stopped"
                    )
                except Exception as stop_error:
                    logger.warning(
                        f"[Session {session_id[:8]}] Failed to stop Notte session: {stop_error}",
                        exc_info=True,
                    )

        return await asyncio.to_thread(
            _run_agent, notte_client, agent_id, convex_client
        )

    try:
        response, actual_session_id, browser_url = await execute_notte_agent()
        timings["agent_execution"] = time.time() - agent_run_start

        # Handle None response - poll for result if needed
        if response is None:
            logger.warning(
                f"[Session {session_id[:8]}] Response is None, attempting to poll for result..."
            )
            # Try to get result from the agent client
            try:
                # Poll the agent status to get the result
                max_poll_retries = 20
                poll_delay = 1.0
                for poll_attempt in range(max_poll_retries):
                    try:
                        # Try to get agent by ID if we have it
                        if hasattr(notte_client, "agents"):
                            # Get the agent status
                            # Note: We'd need the agent_id which we might not have here
                            # For now, log and continue with None response handling
                            logger.info(
                                f"[Session {session_id[:8]}] Polling attempt {poll_attempt + 1}/{max_poll_retries}"
                            )
                            time.sleep(poll_delay)
                            # If we can't get the response, we'll create a minimal result
                    except Exception as poll_error:
                        logger.debug(
                            f"[Session {session_id[:8]}] Poll attempt {poll_attempt + 1} failed: {poll_error}"
                        )
                        if poll_attempt < max_poll_retries - 1:
                            time.sleep(poll_delay)
                            poll_delay = min(poll_delay * 1.2, 3.0)
                logger.warning(
                    f"[Session {session_id[:8]}] Could not retrieve response after polling"
                )
            except Exception as poll_error:
                logger.warning(
                    f"[Session {session_id[:8]}] Polling failed: {poll_error}",
                    exc_info=True,
                )

        # Calculate duration and convert timestamps to Convex-compatible format
        duration = 0.0
        created_at_value = None
        closed_at_value = None

        if (
            response is not None
            and hasattr(response, "created_at")
            and hasattr(response, "closed_at")
            and response.created_at
            and response.closed_at
        ):
            try:
                # Convert to float if they're numbers, or parse ISO strings
                created_at_raw = response.created_at
                closed_at_raw = response.closed_at

                # If they're already numbers, use them directly
                if isinstance(created_at_raw, (int, float)):
                    created_at_value = float(created_at_raw)
                elif isinstance(created_at_raw, str):
                    # Try to parse ISO string to timestamp
                    from datetime import datetime

                    try:
                        dt = datetime.fromisoformat(
                            created_at_raw.replace("Z", "+00:00")
                        )
                        created_at_value = dt.timestamp()
                    except Exception:
                        created_at_value = None

                if isinstance(closed_at_raw, (int, float)):
                    closed_at_value = float(closed_at_raw)
                elif isinstance(closed_at_raw, str):
                    # Try to parse ISO string to timestamp
                    from datetime import datetime

                    try:
                        dt = datetime.fromisoformat(
                            closed_at_raw.replace("Z", "+00:00")
                        )
                        closed_at_value = dt.timestamp()
                    except Exception:
                        closed_at_value = None

                if created_at_value is not None and closed_at_value is not None:
                    duration = max(0.0, closed_at_value - created_at_value)
            except Exception:
                duration = 0.0

        # Extract usage information
        if response is not None:
            credit_usage = getattr(response, "credit_usage", None) or 0.0
            steps = getattr(response, "steps", None)
            steps_serializable = to_jsonable(steps) if steps else []
            # Filter out selectors from steps to reduce payload size
            steps_serializable = filter_selectors_from_data(steps_serializable)

            # Try to get answer directly from response first
            answer = getattr(response, "answer", None)
            success = getattr(response, "success", False)
            status = getattr(response, "status", "unknown")

            # If answer is not directly on response, try to extract it from steps
            # Look for completion action in steps (check both raw and serialized steps)
            if not answer:
                # First check raw steps before filtering
                if steps:
                    for step in steps:
                        try:
                            step_dict = to_jsonable(step)
                            if isinstance(step_dict, dict):
                                step_type = step_dict.get("type", "")
                                if step_type == "agent_completion":
                                    value = step_dict.get("value", {})
                                    if isinstance(value, dict):
                                        action = value.get("action", {})
                                        if (
                                            isinstance(action, dict)
                                            and action.get("type") == "completion"
                                        ):
                                            extracted_answer = action.get("answer")
                                            if extracted_answer:
                                                answer = extracted_answer
                                                # Also update success if available
                                                if "success" in action:
                                                    success = action.get(
                                                        "success", False
                                                    )
                                                logger.info(
                                                    f"[Session {session_id[:8]}] ✅ Extracted answer from completion step (length: {len(answer)})"
                                                )
                                                break
                        except Exception as step_error:
                            logger.debug(
                                f"[Session {session_id[:8]}] Error processing step: {step_error}"
                            )

                # If still no answer, check filtered steps as fallback
                if not answer and steps_serializable:
                    for step in steps_serializable:
                        if isinstance(step, dict):
                            step_type = step.get("type", "")
                            if step_type == "agent_completion":
                                value = step.get("value", {})
                                if isinstance(value, dict):
                                    action = value.get("action", {})
                                    if (
                                        isinstance(action, dict)
                                        and action.get("type") == "completion"
                                    ):
                                        extracted_answer = action.get("answer")
                                        if extracted_answer:
                                            answer = extracted_answer
                                            if "success" in action:
                                                success = action.get("success", False)
                                            logger.info(
                                                f"[Session {session_id[:8]}] ✅ Extracted answer from filtered steps (length: {len(answer)})"
                                            )
                                            break
        else:
            # Create minimal response if None
            logger.warning(
                f"[Session {session_id[:8]}] Response is None, creating minimal result payload"
            )
            credit_usage = 0.0
            steps_serializable = []
            answer = None
            success = False
            status = "unknown"

        # Log if answer is null/empty
        if not answer:
            logger.warning(
                f"[Session {session_id[:8]}] Answer is null/empty - will skip Convex result update"
            )

        usage_dict = {
            "total_cost": float(credit_usage) * 0.01,
            "credits": float(credit_usage),
            "steps": len(steps_serializable)
            if isinstance(steps_serializable, list)
            else 0,
        }

        # Calculate total time
        timings["total"] = time.time() - overall_start

        # Log timing breakdown
        logger.info(
            f"[Session {session_id[:8]}] Timing Summary - "
            f"Total: {timings.get('total', 0):.2f}s | "
            f"Execution: {timings.get('agent_execution', 0):.2f}s"
        )

        # Prepare result payload
        metadata = {
            "agentId": getattr(response, "agent_id", None)
            if response is not None
            else None,
            "sessionId": getattr(response, "session_id", actual_session_id)
            if response is not None
            else actual_session_id,
            "createdAt": created_at_value if created_at_value is not None else None,
            "closedAt": closed_at_value if closed_at_value is not None else None,
            "replayStartOffset": getattr(response, "replay_start_offset", None)
            if response is not None
            else None,
            "replayStopOffset": getattr(response, "replay_stop_offset", None)
            if response is not None
            else None,
            "saved": getattr(response, "saved", None) if response is not None else None,
        }

        # Filter out selectors from metadata
        metadata = filter_selectors_from_data(metadata)

        result_payload = {
            "agent": "notte",
            "success": success,
            "status": status,
            "answer": answer,
            "task": getattr(response, "task", prompt)
            if response is not None
            else prompt,
            "url": getattr(response, "url", None) if response is not None else None,
            "duration": duration,
            "usage": usage_dict,
            "steps": steps_serializable,
            "metadata": metadata,
        }

        logger.info(
            f"[Session {session_id[:8]}] Final result_payload: success={success}, status={status}, answer={answer}, steps={len(steps_serializable)}"
        )

        return result_payload, usage_dict, timings, browser_url

    except Exception as e:
        timings["total"] = time.time() - overall_start
        logger.error(
            f"[Session {session_id[:8]}] ❌ Notte agent failed after {timings.get('total', 0):.2f}s: {e}",
            exc_info=True,
        )
        raise


async def main():
    """Example usage of the Notte agent"""
    import os
    from dotenv import load_dotenv
    from notte_sdk import NotteClient

    load_dotenv("../.env.local")

    notte_api_key = os.getenv("NOTTE_API_KEY")
    if not notte_api_key:
        raise ValueError("NOTTE_API_KEY environment variable is required")

    notte_client = NotteClient(api_key=notte_api_key)

    # This is just an example - in practice, session_id comes from the API
    result, usage, timings = await run_notte(
        prompt="Find the best italian restaurant in SF and book a table for 2 at 7pm today",
        notte_client=notte_client,
        session_id="example-session-id",
        provider_model="google/gemini-2.5-flash",
    )

    print(f"Result: {result}")
    print(f"Usage: {usage}")
    print(f"Timings: {timings}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
