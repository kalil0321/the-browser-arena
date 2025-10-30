import type { Metadata } from "next";
import { Pixelify_Sans, JetBrains_Mono, Inter, Geist } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ConvexClientProvider } from "@/components/providers/convex";
import { DashboardSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";

const appSans = Pixelify_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const appMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const defaultFont = Geist({
  variable: "--font-default",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "The Browser Arena",
    template: "%s | The Browser Arena",
  },
  description:
    "The Browser Arena — test and compare browser agents easily.",
  keywords: [
    "The Browser Arena",
    "browser",
    "agents",
    "AI",
    "LLMs",
    "operator",
    "OpenAI",
    "Google",
    "Gemini",
    "AI agent arena",
    "AI agent comparison",
    "browser-use",
    "stagehand",
    "browser agents",
    "comet",
    "chatgpt atlas"
  ],
  openGraph: {
    title: "The Browser Arena",
    description:
      "Test and compare browser agents easily.",
    url: "thebrowserarena.com",
    siteName: "The Browser Arena",
    images: [
      {
        url: "/open-graph.jpeg",
        width: 1200,
        height: 630,
        alt: "The Browser Arena Open Graph",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Browser Arena",
    description:
      "Test and compare browser agents easily.",
    images: ["/open-graph.jpeg"],
  },
  icons: {
    icon: "/favicon.ico",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add verification codes here when available
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
    // yahoo: "your-yahoo-verification-code",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";
  return (
    <html lang="en">
      <body
        className={`${appSans.variable} ${appMono.variable} ${defaultFont.variable} antialiased relative min-h-screen`}
      >
        <ConvexClientProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <div className="relative flex h-screen w-full">
              <DashboardSidebar />
              {children}
            </div>
          </SidebarProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
