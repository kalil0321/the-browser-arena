"use client";

import { ChatInput, ChatInputState } from "@/components/chat-input";
import { AnimatedHeadline } from "@/components/animated-headline";
import { IconFull } from "@/components/logo";
import { SidebarInset } from "@/components/ui/sidebar";
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

          {/* Privacy Warning - Fixed height to prevent layout shift */}
          <div className="w-full max-w-2xl min-h-[88px] flex items-start">
            {showPrivacyWarning && (
              <div className="w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs sm:p-4 sm:text-sm">
                <p className="text-amber-900 dark:text-amber-100 leading-relaxed">
                  <strong>Privacy Notice:</strong> Private mode is enabled, but some agents are using server API keys.
                  For a fully private session, please add your own API keys in{" "}
                  <a href="/settings#api-keys" className="underline hover:text-amber-700 dark:hover:text-amber-300">Settings</a>.
                  {chatInputState.agentConfigs.some(c => c.agent === "smooth") && !chatInputState.hasSmoothApiKey && (
                    <span> (Smooth API missing)</span>
                  )}
                  {chatInputState.agentConfigs.some(c => c.agent === "browser-use-cloud") && !chatInputState.hasBrowserUseApiKey && (
                    <span> (Browser-Use API missing)</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Subtle info notes at the bottom - Fixed height to prevent layout shift */}
        <div className="mt-auto w-full max-w-4xl pb-4 pt-6 sm:pb-6 sm:pt-8">
          <div className="space-y-2 min-h-[60px] flex flex-col justify-start px-2">
            <p className="text-[12px] sm:text-xs text-muted-foreground font-default opacity-60 leading-relaxed">
              <strong>Note:</strong> To use Smooth, get your API key from <a href="https://app.smooth.sh" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">app.smooth.sh</a> and add it in Settings. Free credits on signup.
            </p>
            <p className="text-[12px] sm:text-xs text-muted-foreground font-default opacity-60 leading-relaxed">
              <strong>Optional:</strong> Configure API keys for LLM providers (OpenAI, Anthropic, Google) in Settings. Get a Browser-Use API key at <a href="https://cloud.browser-use.com/new-api-key" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">cloud.browser-use.com</a>. Free credits on signup.
            </p>
            <p className="text-[12px] sm:text-xs text-muted-foreground font-default opacity-60 leading-relaxed">
              <strong>GitHub:</strong> Check out the repo <a href="https://github.com/kalil0321/the-browser-arena" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">kalil0321/the-browser-arena</a> and give it a ⭐.
            </p>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
