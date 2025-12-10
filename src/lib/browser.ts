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

export const browserbase = new Browserbase({
    apiKey: BROWSERBASE_API_KEY,
});

export const anchorBrowser = new AnchorBrowser({
    apiKey: ANCHOR_API_KEY,
});


export interface BrowserSession {
    browserSessionId: string;
    cdpUrl: string;
    liveViewUrl: string;
}

// TODO: add recording support & save to convex storage




// export const createBrowserSession = async (config?: any, options?: { navBar?: boolean }): Promise<BrowserSession> => {
//     const browserSession = await anchorBrowser.sessions.create(config)

//     return {
//         browserSessionId: browserSession.data?.id ?? "",
//         cdpUrl: browserSession.data?.cdp_url ?? "",
//         liveViewUrl: browserSession.data?.live_view_url ?? "",
//     };
// };

export const createBrowserSession = async (config?: any, options?: { navBar?: boolean }): Promise<BrowserSession> => {
    const browserSession = await browserbase.sessions.create({
        projectId: BROWSERBASE_PROJECT_ID,
    })

    const liveViewUrls = await browserbase.sessions.debug(browserSession.id)

    return {
        browserSessionId: browserSession.id,
        cdpUrl: browserSession.connectUrl,
        liveViewUrl: liveViewUrls.debuggerFullscreenUrl + "&navBar=false",
    };
};


// export const deleteBrowserSession = async (id: string) => {
//     await anchorBrowser.sessions.delete(id);
// };

export const deleteBrowserSession = async (id: string) => {
    await browserbase.sessions.update(id, {
        status: "REQUEST_RELEASE",
        projectId: BROWSERBASE_PROJECT_ID,
    });
};


export const computeBrowserCost = (duration: number): number => {
    const hours = Math.max(duration / 3600, 0);
    return 0.2 * hours;
};