import type { Metadata } from "next";
import { SidebarInset } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Webhook, Key, UserCog, Shield, Wrench } from "lucide-react";

export const metadata: Metadata = {
    title: "Roadmap",
    description: "Upcoming features and improvements for The Browser Arena - See what's coming next.",
};

export default function RoadmapPage() {
    const features = [
        {
            icon: Webhook,
            title: "Webhooks",
            description: "Receive real-time notifications when browser automation tasks complete. Configure webhook endpoints to be called automatically when agents finish their work.",
            status: "upcoming",
            details: [
                "Webhook triggers on browser task completion",
                "Configurable webhook endpoints per user",
                "Retry logic for failed webhook deliveries",
                "Secure webhook signatures for verification",
            ],
        },
        {
            icon: Key,
            title: "Browser Arena API + API Keys",
            description: "Programmatic access to Browser Arena through a RESTful API. Manage API keys with granular permissions and usage tracking.",
            status: "upcoming",
            details: [
                "RESTful API with comprehensive endpoints",
                "API key management and rotation",
                "Usage analytics and rate limiting",
                "OpenAPI/Swagger documentation",
            ],
        },
        {
            icon: UserCog,
            title: "Browser Profiles",
            description: "Create and manage custom browser profiles with persistent settings, cookies, and user agents. Maintain separate identities across automation sessions.",
            status: "upcoming",
            details: [
                "Custom user agent strings",
                "Persistent cookies and storage",
                "Profile templates and presets",
                "Profile isolation and privacy",
            ],
        },
        {
            icon: Shield,
            title: "CAPTCHA Solving",
            description: "Automatic CAPTCHA solving integration to handle verification challenges during browser automation tasks.",
            status: "upcoming",
            details: [
                "Integration with major CAPTCHA solving services",
                "Automatic detection and solving",
                "Fallback strategies for unsolved CAPTCHAs",
                "Cost tracking and budget management",
            ],
        },
        {
            icon: Wrench,
            title: "Custom Tools for Browser-Use",
            description: "Extend browser-use agent capabilities with custom tools. Users can define their own functions and actions to be executed during automation.",
            status: "upcoming",
            details: [
                "User-defined custom tool functions",
                "Tool marketplace and sharing",
                "JavaScript and Python tool support",
                "Tool testing and debugging interface",
            ],
        },
    ];

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "upcoming":
                return <Badge variant="outline">Upcoming</Badge>;
            case "in-progress":
                return <Badge variant="info">In Progress</Badge>;
            case "released":
                return <Badge variant="success">Released</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-background text-foreground p-4">
            <div className="flex-1 overflow-y-auto">
                <div className="container py-8 space-y-8 mx-auto max-w-4xl font-default">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Roadmap</h1>
                        <p className="text-muted-foreground mt-2">
                            Upcoming features and improvements for Browser Arena
                        </p>
                    </div>

                    <Separator />

                    <div className="space-y-8">
                        {features.map((feature, index) => {
                            const IconComponent = feature.icon;
                            return (
                                <div
                                    key={index}
                                    className="rounded-lg border border-border bg-card p-6 space-y-4 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className="rounded-lg bg-primary/10 p-3 shrink-0">
                                                <IconComponent className="h-6 w-6 text-primary" />
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <h2 className="text-xl font-semibold">
                                                        {feature.title}
                                                    </h2>
                                                    {getStatusBadge(feature.status)}
                                                </div>
                                                <p className="text-foreground/90 leading-relaxed">
                                                    {feature.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {feature.details && feature.details.length > 0 && (
                                        <div className="pt-2">
                                            <ul className="space-y-2">
                                                {feature.details.map((detail, detailIndex) => (
                                                    <li
                                                        key={detailIndex}
                                                        className="flex items-start gap-2 text-sm text-muted-foreground"
                                                    >
                                                        <span className="text-primary mt-1.5 shrink-0">
                                                            •
                                                        </span>
                                                        <span>{detail}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <Separator />

                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
                        <h3 className="text-lg font-semibold mb-2">Have Suggestions?</h3>
                        <p className="text-foreground/80 text-sm leading-relaxed">
                            We're always looking to improve Browser Arena. If you have ideas
                            for new features or improvements, we'd love to hear from you.
                        </p>
                    </div>
                </div>
            </div>
        </SidebarInset>
    );
}

