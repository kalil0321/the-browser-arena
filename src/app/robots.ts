import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.thebrowserarena.com";

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/api/", "/settings/", "/profile/"],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}

