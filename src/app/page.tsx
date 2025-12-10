"use client";

import { ChatInput, ChatInputState } from "@/components/chat-input";
import { AnimatedHeadline } from "@/components/animated-headline";
import { IconFull } from "@/components/logo";
import { SidebarInset } from "@/components/ui/sidebar";
import { GitHubStarButton } from "@/components/github-star-button";
import { useState } from "react";

export default function Home() {
  // Initialize with true since default agents are smooth and browser-use
  const [hasSmooth, setHasSmooth] = useState(true);
  const [hasBrowserUse, setHasBrowserUse] = useState(true);
  const [chatInputState, setChatInputState] = useState<ChatInputState | null>(null);

  const showPrivacyWarning = chatInputState?.isPrivate && (
    (chatInputState.agentConfigs.some(c => c.agent === "smooth") && !chatInputState.hasSmoothApiKey) ||
    (chatInputState.agentConfigs.some(c => c.agent === "browser-use-cloud") && !chatInputState.hasBrowserUseApiKey)
  );

  return (
    <SidebarInset className="flex flex-1 flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[url('/bg.jpeg')] bg-cover bg-center will-change-transform" />
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* GitHub Star Button - Top Right */}
      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <GitHubStarButton />
      </div>

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center px-4 text-center sm:px-6 md:px-12">
        {/* Main content area */}
        <div className="flex w-full flex-col items-center gap-4 py-8 sm:gap-6 sm:py-12 md:py-16">
          <div className="w-[120px] sm:w-[140px] md:w-[160px]">
            <IconFull dark={false} width={120} height={75} className="w-full h-auto" />
          </div>
          <div className="w-full max-w-2xl">
            <ChatInput
              onStateChange={setChatInputState}
              onAgentPresenceChange={(hasSmooth, hasBrowserUse) => {
                setHasSmooth(hasSmooth);
                setHasBrowserUse(hasBrowserUse);
              }}
            />
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
