# from anchorbrowser import Anchorbrowser
import os
from browserbase import Browserbase

# ANCHOR_API_KEY = os.getenv("ANCHOR_API_KEY")
# if not ANCHOR_API_KEY:
#     raise ValueError("ANCHOR_API_KEY environment variable is required")

BROWSERBASE_API_KEY = os.getenv("BROWSERBASE_API_KEY")
if not BROWSERBASE_API_KEY:
    raise ValueError("BROWSERBASE_API_KEY environment variable is required")

# anchor_browser = Anchorbrowser(api_key=ANCHOR_API_KEY)
browserbase = Browserbase(api_key=BROWSERBASE_API_KEY)


# def delete_browser_session(session_id: str):
#     anchor_browser.sessions.delete(session_id)

# def create_browser_session(config):
#     if config:
#         return anchor_browser.sessions.create(config)

#     return anchor_browser.sessions.create()


def create_browser_session(config):
    return browserbase.sessions.create(
        {
            "projectId": os.getenv("BROWSERBASE_PROJECT_ID"),
        }
    )


def delete_browser_session(session_id: str):
    return browserbase.sessions.update(
        session_id,
        project_id=os.getenv("BROWSERBASE_PROJECT_ID"),
        status="REQUEST_RELEASE",
    )


def compute_browser_cost(duration: float):
    hours = max(duration / 3600, 0)
    return 0.2 * hours
