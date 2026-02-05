"use client";

import { ReactNode } from "react";
import { SidebarInset } from "@/components/ui/sidebar";
import { GitHubStarButton } from "@/components/github-star-button";
import { ModeToggle } from "@/components/mode-toggle";
import { IconFull } from "@/components/logo";

interface HomePageLayoutProps {
  children: ReactNode;
}

export function HomePageLayout({ children }: HomePageLayoutProps) {
  return (
    <SidebarInset className="flex flex-1 flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[url('/bg.jpeg')] bg-cover bg-center will-change-transform" />
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Mode Toggle - Top Left */}
      <div className="absolute top-4 left-4 z-20 sm:top-6 sm:left-6">
        <ModeToggle />
      </div>

      {/* GitHub Star Button - Top Right */}
      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <GitHubStarButton />
      </div>

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center px-4 text-center sm:px-6 md:px-12">
        {/* Main content area - consistent across all modes */}
        <div className="flex w-full flex-col items-center gap-4 py-8 sm:gap-6 sm:py-12 md:py-16">
          <div className="w-[120px] sm:w-[140px] md:w-[160px]">
            <IconFull dark={false} width={120} height={75} className="w-full h-auto" />
          </div>
          <div className="w-full max-w-2xl">
            {children}
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
