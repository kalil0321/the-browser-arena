import type { Metadata } from "next";
import { Pixelify_Sans, JetBrains_Mono, Inter, Geist } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ConvexClientProvider } from "@/components/providers/convex";
import { DashboardSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AppThemeApplier } from "../components/app-theme-applier";
import { Analytics } from "@vercel/analytics/react";

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

const interFont = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.thebrowserarena.com.com"),
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
  const appThemeCookie = cookieStore.get("appTheme")?.value;
  return (
    <html lang="en" suppressHydrationWarning data-theme={appThemeCookie === "pro" ? "pro" : undefined}>
      <head>
        <meta property="og:image" content="<generated>" />
        <meta property="og:image:type" content="<generated>" />
        <meta property="og:image:width" content="<generated>" />
        <meta property="og:image:height" content="<generated>" />
        <meta name="twitter:image" content="<generated>" />
        <meta name="twitter:image:type" content="<generated>" />
        <meta name="twitter:image:width" content="<generated>" />
        <meta name="twitter:image:height" content="<generated>" />
      </head>
      <body
        className={`${appSans.variable} ${appMono.variable} ${defaultFont.variable} ${interFont.variable} antialiased relative min-h-screen`}
      >
        {/* @ts-ignore */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem suppressHydrationWarning>
          <AppThemeApplier />
          <ConvexClientProvider>
            <SidebarProvider defaultOpen={true}>
              <div className="relative flex h-screen w-full">
                <DashboardSidebar />
                {children}
              </div>
            </SidebarProvider>
            <Toaster position="bottom-right" richColors />
          </ConvexClientProvider>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
