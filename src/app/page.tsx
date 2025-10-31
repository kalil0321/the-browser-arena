"use client";

import { ChatInput } from "@/components/chat-input";
import { useState } from "react";
import { AnimatedHeadline } from "@/components/animated-headline";
import { IconFull } from "@/components/logo";
import { SidebarInset } from "@/components/ui/sidebar";

export default function Home() {
  const [hasSmooth, setHasSmooth] = useState(false);
  const [hasBrowserUse, setHasBrowserUse] = useState(false);
  return (
    <SidebarInset className="flex flex-1 flex-col items-center justify-center overflow-hidden bg-[url('/bg.jpeg')] bg-cover bg-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-1 px-6 py-12 text-center md:px-12 md:py-16">
        <IconFull dark={false} width={160} height={100} />
        {/* <AnimatedHeadline
          phrases={["Compare agents", "Automate your tasks", "Coordinate workflows"]}
          className="text-2xl font-bold text-foreground font-default"
        /> */}
        <div className="w-full max-w-2xl">
          <ChatInput
            onAgentPresenceChange={(smooth, browserUse) => {
              setHasSmooth(smooth);
              setHasBrowserUse(browserUse);
            }}
          />
        </div>

        {/* Notes/Notices outside ChatInput */}
        {hasSmooth && (
          <div className="mt-3 w-full max-w-2xl rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-left">
            <p className="text-xs text-blue-900 dark:text-blue-100 font-default">
              <strong>Note:</strong> To use Smooth, please get your API key from <a href="https://app.smooth.sh" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">https://app.smooth.sh</a> and add it in your Settings. They give free credits on signup.
            </p>
          </div>
        )}
        {hasBrowserUse && (
          <div className="mt-2 w-full max-w-2xl rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-left">
            <p className="text-xs text-amber-900 dark:text-amber-100 font-default">
              <strong>Optional:</strong> You can configure API keys for LLM providers (OpenAI, Anthropic, Google) in the Settings page to use your own keys. To use Browser-Use, optionally add your own API key in the Settings. Get a Browser-Use API key at <a href="https://cloud.browser-use.com/new-api-key" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">https://cloud.browser-use.com/new-api-key</a>. They give free credits on signup.
            </p>
          </div>
        )}
      </div>
    </SidebarInset>
  );
}
