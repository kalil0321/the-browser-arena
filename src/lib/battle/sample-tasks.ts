export const SAMPLE_TASKS = [
    "Search Google for the current weather in San Francisco",
    "Go to Wikipedia and find the population of Tokyo",
    "Search for the latest iPhone on Amazon and find its price",
    "Go to Hacker News and find the top story title",
    "Search Google for 'best programming languages 2026' and list the first 3 results",
    "Go to GitHub trending and find the top repository name",
    "Search for flights from NYC to London on Google Flights",
    "Find the current Bitcoin price on CoinGecko",
    "Go to Reddit and find the top post on r/technology",
    "Search for a chocolate chip cookie recipe on AllRecipes",
    "Find the current #1 movie on IMDb",
    "Go to ESPN and find today's top sports headline",
    "Find the release date of the next Marvel movie on Google",
    "Go to YouTube and find the most viewed video this week",
    "Search for the tallest building in the world on Google",
];

export function getRandomTask(): string {
    return SAMPLE_TASKS[Math.floor(Math.random() * SAMPLE_TASKS.length)];
}
