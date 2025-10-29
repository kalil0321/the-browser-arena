from skyvern import Skyvern
import os
from anchorbrowser import Anchorbrowser


async def run_skyvern(
    prompt: str,
    cdp_url: str,
    browser: Anchorbrowser,
    session_id: str,
    provider_model: str,
):
    """
    Run Skyvern agent with the given prompt

    Args:
        prompt: The instruction for the agent
        cdp_url: Chrome DevTools Protocol URL
        browser: Anchorbrowser instance
        session_id: Browser session ID
        provider_model: Provider/model string (not used by Skyvern currently)

    Returns:
        Skyvern task result
    """
    skyvern_client = Skyvern(cdp_url=cdp_url)
    task = await skyvern_client.run_task(prompt=prompt)
    browser.sessions.delete(session_id)
    return task


async def main():
    """Example usage of the Skyvern agent"""
    browser = Anchorbrowser(api_key=os.getenv("ANCHOR_API_KEY"))
    session = browser.sessions.create()

    print(session)

    task = await run_skyvern(
        prompt="Find the top post on hackernews today",
        cdp_url=session.data.cdp_url,
        browser=browser,
        session_id=session.data.id,
        provider_model="",
    )

    print(task)


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
