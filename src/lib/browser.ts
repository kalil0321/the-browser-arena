import Browserbase from "@browserbasehq/sdk";
import AnchorBrowser from "anchorbrowser";

const requireEnv = (name: string): string => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not set`);
    }
    return value;
};

const BROWSERBASE_API_KEY = requireEnv("BROWSERBASE_API_KEY");
const ANCHOR_API_KEY = requireEnv("ANCHOR_API_KEY");
const BROWSERBASE_PROJECT_ID = requireEnv("BROWSERBASE_PROJECT_ID");
const BROWSER_PROVIDER = process.env.BROWSER_PROVIDER;

export const anchorBrowser = new AnchorBrowser({
    apiKey: ANCHOR_API_KEY,
});

export const browserbase = new Browserbase({
    apiKey: BROWSERBASE_API_KEY,
});


export interface BrowserSession {
    browserSessionId: string;
    cdpUrl: string;
    liveViewUrl: string;
}

// TODO: add recording support & save to convex storage


export const createBrowserSession = async (config?: any, options?: { navBar?: boolean }): Promise<BrowserSession> => {
    if (BROWSER_PROVIDER === "anchor") {
        const browserSession = await anchorBrowser.sessions.create(config)
        return {
            browserSessionId: browserSession.data?.id ?? "",
            cdpUrl: browserSession.data?.cdp_url ?? "",
            liveViewUrl: browserSession.data?.live_view_url ?? "",
        };
    } else {
        const browserSession = await browserbase.sessions.create({
            projectId: BROWSERBASE_PROJECT_ID,
            region: "eu-central-1"
        })

        const liveViewUrls = await browserbase.sessions.debug(browserSession.id)

        return {
            browserSessionId: browserSession.id,
            cdpUrl: browserSession.connectUrl,
            liveViewUrl: liveViewUrls.debuggerFullscreenUrl + "&navBar=false",
        };
    }
};


export const deleteBrowserSession = async (id: string) => {
    if (BROWSER_PROVIDER === "anchor") {
        await anchorBrowser.sessions.delete(id);
    } else {
        await browserbase.sessions.update(id, {
            status: "REQUEST_RELEASE",
            projectId: BROWSERBASE_PROJECT_ID,
        });
    }
};


export const computeBrowserCost = (duration: number): number => {
    const hours = Math.max(duration / 3600, 0);
    if (BROWSER_PROVIDER === "anchor") {
        return 0.1 + 0.05 * hours;
    } else {
        return 0.2 * hours;
    }
};