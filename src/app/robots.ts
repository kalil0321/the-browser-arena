import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://thebrowserarena.com";

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/api/", "/session/"],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}

