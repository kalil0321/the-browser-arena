import { NextRequest, NextResponse } from "next/server";
import { openapiSpec } from "@/lib/api/openapi-spec";

export async function GET(request: NextRequest) {
    const accept = request.headers.get("accept") || "";
    if (accept.includes("application/json") || !accept.includes("text/html")) {
        return NextResponse.json(openapiSpec);
    }

    const html = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The Browser Arena — API Reference</title>
    <style>
        body { margin: 0; }
        /* Hide the default Scalar top search bar for cleaner look */
        .scalar-app .t-app__header { display: none !important; }
    </style>
</head>
<body>
    <script
        id="api-reference"
        data-url="/api/v1/openapi.json"
        data-proxy-url=""
    ></script>
    <script>
        var configuration = {
            theme: 'saturn',
            hideModels: false,
            hideDownloadButton: false,
            hiddenClients: [],
            defaultHttpClient: { targetKey: 'javascript', clientKey: 'fetch' },
            authentication: {
                preferredSecurityScheme: 'BearerAuth',
            },
            metaData: {
                title: 'The Browser Arena API',
                description: 'Launch browser agents, compare frameworks, retrieve results.',
            },
        }
        document.getElementById('api-reference').dataset.configuration = JSON.stringify(configuration)
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.28.12"></script>
</body>
</html>`;

    return new NextResponse(html, {
        headers: { "Content-Type": "text/html" },
    });
}
