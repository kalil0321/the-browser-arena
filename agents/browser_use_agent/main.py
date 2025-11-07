from browser_use import (
    Agent,
    Browser,
    ChatBrowserUse,
    ChatOpenAI,
    ChatAnthropic,
    ChatGoogle,
)
from anchorbrowser import Anchorbrowser
import os
import time
from typing import Dict, Optional
from .tools import tools


def parse_provider_model(provider_model: str):
    if provider_model.startswith("openrouter/"):
        # Extract everything after "openrouter/" (e.g., "moonshotai/kimi-k2-thinking")
        return "openrouter", provider_model.split("/", 1)[1]
    if not provider_model:
        return "browser-use", "bu-1.0"
    provider, model = provider_model.split("/", 1)
    return provider, model


def get_llm(provider: str, model: str, user_api_keys: Dict = None):
    """Get LLM instance with user-provided or environment variable API keys

    Args:
        provider: LLM provider (openai, google, anthropic, browser-use)
        model: Model name
        user_api_keys: Dict with optional keys: openai_api_key, google_api_key, anthropic_api_key, browser_use_api_key

    Returns:
        LLM chat instance
    """
    if user_api_keys is None:
        user_api_keys = {}

    provider_lower = provider.lower()

    if provider_lower == "browser-use":
        api_key = user_api_keys.get("browser_use_api_key") or os.getenv(
            "BROWSER_USE_API_KEY"
        )
        if api_key:
            return ChatBrowserUse(api_key=api_key)
        # Fallback without explicit api_key if not provided
        return ChatBrowserUse()

    if provider_lower == "openai":
        api_key = user_api_keys.get("openai_api_key") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        return ChatOpenAI(model=model, api_key=api_key)

    if provider_lower == "google":
        api_key = user_api_keys.get("google_api_key") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable is required")
        return ChatGoogle(model=model, api_key=api_key)

    if provider_lower == "anthropic":
        api_key = user_api_keys.get("anthropic_api_key") or os.getenv(
            "ANTHROPIC_API_KEY"
        )
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")

        return ChatAnthropic(model=model, api_key=api_key)

    if provider_lower == "openrouter":
        api_key = user_api_keys.get("openrouter_api_key") or os.getenv(
            "OPENROUTER_API_KEY"
        )

        add_schema_to_system_prompt = model.startswith("moonshotai/")
        remove_min_items_from_schema = model.startswith("moonshotai/")
        remove_defaults_from_schema = model.startswith("moonshotai/")

        if not api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable is required")
        return ChatOpenAI(
            model=model, api_key=api_key, base_url="https://openrouter.ai/api/v1",
            add_schema_to_system_prompt=add_schema_to_system_prompt,
            remove_min_items_from_schema=remove_min_items_from_schema,
            remove_defaults_from_schema=remove_defaults_from_schema,
        )

    # Default to browser-use
    api_key = user_api_keys.get("browser_use_api_key") or os.getenv(
        "BROWSER_USE_API_KEY"
    )
    if api_key:
        return ChatBrowserUse(api_key=api_key)
    return ChatBrowserUse()


async def run_browser_use(
    prompt: str,
    cdp_url: str,
    provider_model: str,
    browser: Anchorbrowser,
    session_id: str,
    secrets: Optional[Dict[str, str]] = None,
    openai_api_key: str = None,
    google_api_key: str = None,
    anthropic_api_key: str = None,
    browser_use_api_key: str = None,
    openrouter_api_key: str = None,
    file_path: Optional[str] = None,
):
    """
    Run Browser-Use agent with the given prompt

    Args:
        prompt: The instruction for the agent
        cdp_url: Chrome DevTools Protocol URL
        provider_model: Provider/model string (e.g., "openai/gpt-4", "browser-use/bu-1.0")
        browser: Anchorbrowser instance
        session_id: Browser session ID
        secrets: Optional dictionary of secrets to inject as sensitive data into the agent
        openai_api_key: Optional user-provided OpenAI API key
        google_api_key: Optional user-provided Google API key
        anthropic_api_key: Optional user-provided Anthropic API key
        browser_use_api_key: Optional user-provided Browser-Use API key
        openrouter_api_key: Optional user-provided OpenRouter API key
        file_path: Optional path to uploaded file to make available to the agent

    Returns:
        Tuple of (Browser-Use agent result, usage summary, timings dict)
    """
    timings: Dict[str, float] = {}
    overall_start = time.time()

    # Time LLM initialization
    llm_start = time.time()
    provider, model = parse_provider_model(provider_model)
    user_api_keys = {
        "openai_api_key": openai_api_key,
        "google_api_key": google_api_key,
        "anthropic_api_key": anthropic_api_key,
        "browser_use_api_key": browser_use_api_key,
        "openrouter_api_key": openrouter_api_key,
    }
    llm = get_llm(provider, model, user_api_keys)
    timings["llm_initialization"] = time.time() - llm_start
    print(f"⏱️  LLM initialization: {timings['llm_initialization']:.2f}s")

    # Time Browser initialization
    browser_start = time.time()
    automation_browser = Browser(
        headless=False,
        cdp_url=cdp_url,
    )
    timings["browser_initialization"] = time.time() - browser_start
    print(f"⏱️  Browser initialization: {timings['browser_initialization']:.2f}s")

    # Prepare available file paths if file was uploaded
    available_file_paths = []
    if file_path:
        # Verify file exists
        if os.path.exists(file_path):
            available_file_paths = [file_path]
            print(f"📎 File available for agent: {file_path}")
        else:
            print(
                f"⚠️  Warning: File path provided but file does not exist: {file_path}"
            )

    # Time Agent initialization
    agent_start = time.time()
    agent = Agent(
        task=prompt,
        llm=llm,
        browser=automation_browser,
        calculate_cost=True,
        sensitive_data=secrets,
        tools=tools,
        available_file_paths=available_file_paths if available_file_paths else None,
    )
    timings["agent_initialization"] = time.time() - agent_start
    print(f"⏱️  Agent initialization: {timings['agent_initialization']:.2f}s")

    # Time Agent execution (this is typically the longest part)
    agent_run_start = time.time()
    result = await agent.run()
    timings["agent_execution"] = time.time() - agent_run_start
    print(f"⏱️  Agent execution: {timings['agent_execution']:.2f}s")

    # Time usage summary retrieval
    usage_start = time.time()
    usage = await agent.token_cost_service.get_usage_summary()
    timings["usage_summary"] = time.time() - usage_start
    print(f"⏱️  Usage summary retrieval: {timings['usage_summary']:.2f}s")

    # Calculate total time
    timings["total"] = time.time() - overall_start
    print(f"⏱️  Total time: {timings['total']:.2f}s")

    # Log timing breakdown
    print("\n📊 Timing Breakdown:")
    print(
        f"  LLM Init:       {timings['llm_initialization']:.2f}s ({timings['llm_initialization'] / timings['total'] * 100:.1f}%)"
    )
    print(
        f"  Browser Init:   {timings['browser_initialization']:.2f}s ({timings['browser_initialization'] / timings['total'] * 100:.1f}%)"
    )
    print(
        f"  Agent Init:     {timings['agent_initialization']:.2f}s ({timings['agent_initialization'] / timings['total'] * 100:.1f}%)"
    )
    print(
        f"  Agent Execution: {timings['agent_execution']:.2f}s ({timings['agent_execution'] / timings['total'] * 100:.1f}%)"
    )
    print(
        f"  Usage Summary:  {timings['usage_summary']:.2f}s ({timings['usage_summary'] / timings['total'] * 100:.1f}%)"
    )
    print("  ───────────────────────────────")
    print(f"  Total:          {timings['total']:.2f}s\n")

    # Session deletion is handled in server.py after recording is saved
    return result, usage, timings


async def main():
    browser = Anchorbrowser(api_key=os.getenv("ANCHOR_API_KEY"))
    session = browser.sessions.create()

    result, usage, timings = await run_browser_use(
        prompt="Find companies that raised more than $10M in the US this month",
        cdp_url=session.data.cdp_url,
        provider_model="",
        browser=browser,
        session_id=session.data.id,
    )

    browser.sessions.delete(session.data.id)


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
