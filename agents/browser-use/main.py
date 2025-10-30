from browser_use import Agent
from browser_use import Browser
from browser_use import Agent, ChatBrowserUse
from anchorbrowser import Anchorbrowser
import os


def parse_provider_model(provider_model: str):
    if not provider_model:
        return "browser-use", "bu-1.0"
    provider, model = provider_model.split("/", 1)
    return provider, model


def get_llm(provider: str, model: str):
    # if provider.lower() == "openai":
    #     return ChatOpenAI(model=model, api_key=os.getenv("OPENAI_API_KEY"))
    # if provider.lower() == "google":
    #     return ChatGoogle(model=model, api_key=os.getenv("GOOGLE_API_KEY"))
    # if provider.lower() == "anthropic":
    #     return ChatAnthropic(model=model, api_key=os.getenv("ANTHROPIC_API_KEY"))

    return ChatBrowserUse(api_key=os.getenv("BROWSER_USE_API_KEY"))


async def run_browser_use(
    prompt: str,
    cdp_url: str,
    provider_model: str,
    browser: Anchorbrowser,
    session_id: str,
):
    """
    Run Browser-Use agent with the given prompt

    Args:
        prompt: The instruction for the agent
        cdp_url: Chrome DevTools Protocol URL
        provider_model: Provider/model string (e.g., "openai/gpt-4", "browser-use/bu-1.0")
        browser: Anchorbrowser instance
        session_id: Browser session ID

    Returns:
        Browser-Use agent result
    """
    provider, model = parse_provider_model(provider_model)
    llm = get_llm(provider, model)

    automation_browser = Browser(
        headless=False,
        cdp_url=cdp_url,
    )

    agent = Agent(
        task=prompt,
        llm=llm,
        browser=automation_browser,
        calculate_cost=True,
    )

    result = await agent.run()

    print("USAGE", result.usage)
    browser.sessions.delete(session_id)
    return result


async def main():
    browser = Anchorbrowser(api_key=os.getenv("ANCHOR_API_KEY"))
    session = browser.sessions.create()

    result = await run_browser_use(
        prompt="Find companies that raised more than $10M in the US this month",
        cdp_url=session.data.cdp_url,
        provider_model="",
        browser=browser,
        session_id=session.data.id,
    )

    browser.sessions.delete(session.data.id)

    print(result.final_result())


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
