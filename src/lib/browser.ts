import Browserbase from "@browserbasehq/sdk";
import AnchorBrowser from "anchorbrowser";

export const browserbase = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY as string,
});

export const anchorBrowser = new AnchorBrowser({
    apiKey: process.env.ANCHOR_API_KEY as string,
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
        projectId: process.env.BROWSERBASE_PROJECT_ID as string,
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
        projectId: process.env.BROWSERBASE_PROJECT_ID as string,
    });
};


export const computeBrowserCost = (duration: number): number => {
    const hours = Math.max(duration / 3600, 0);
    return 0.2 * hours;
};