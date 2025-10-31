"use client";

import { ChatInput, ChatInputState } from "@/components/chat-input";
import { AnimatedHeadline } from "@/components/animated-headline";
import { IconFull } from "@/components/logo";
import { SidebarInset } from "@/components/ui/sidebar";
import { useState } from "react";

export default function Home() {
  const [chatInputState, setChatInputState] = useState<ChatInputState | null>(null);

  return (
    <SidebarInset className="flex flex-1 flex-col items-center justify-center overflow-hidden bg-[url('/bg.jpeg')] bg-cover bg-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-6 px-6 py-12 text-center md:px-12 md:py-16">
        <IconFull dark={false} width={160} height={100} />
        {/* <AnimatedHeadline
          phrases={["Compare agents", "Automate your tasks", "Coordinate workflows"]}
          className="text-2xl font-bold text-foreground font-default"
        /> */}
        <div className="w-full max-w-2xl">
          <ChatInput onStateChange={setChatInputState} />
        </div>

        {/* Privacy Warning - Moved outside of chat input */}
        {chatInputState && chatInputState.isPrivate && (
          (chatInputState.agentConfigs.some(c => c.agent === "smooth") && !chatInputState.hasSmoothApiKey) ||
          (chatInputState.agentConfigs.some(c => c.agent === "browser-use-cloud") && !chatInputState.hasBrowserUseApiKey)
        ) && (
          <div className="w-full max-w-2xl rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm">
            <p className="text-amber-900 dark:text-amber-100">
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
    </SidebarInset>
  );
}
