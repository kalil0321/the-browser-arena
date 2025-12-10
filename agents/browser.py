from anchorbrowser import Anchorbrowser
import os

# Initialize Anchor Browser
ANCHOR_API_KEY = os.getenv("ANCHOR_API_KEY")
if not ANCHOR_API_KEY:
    raise ValueError("ANCHOR_API_KEY environment variable is required")

anchor_browser = Anchorbrowser(api_key=ANCHOR_API_KEY)


def delete_browser_session(session_id: str):
    anchor_browser.sessions.delete(session_id)

def create_browser_session(config):
    if config:
        return anchor_browser.sessions.create(config)
        
    return anchor_browser.sessions.create()