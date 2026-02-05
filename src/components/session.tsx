"use client";

import { ChatInput, ChatInputState } from "@/components/chat-input";
import { HomePageLayout } from "@/components/home-page-layout";
import { useState } from "react";

export function Session() {
  // Initialize with true since default agents are smooth and browser-use
  const [hasSmooth, setHasSmooth] = useState(true);
  const [hasBrowserUse, setHasBrowserUse] = useState(true);
  const [chatInputState, setChatInputState] = useState<ChatInputState | null>(null);

  const showPrivacyWarning = chatInputState?.isPrivate && (
    (chatInputState.agentConfigs.some(c => c.agent === "smooth") && !chatInputState.hasSmoothApiKey) ||
    (chatInputState.agentConfigs.some(c => c.agent === "browser-use-cloud") && !chatInputState.hasBrowserUseApiKey)
  );

  return (
    <HomePageLayout>
      <ChatInput
        onStateChange={setChatInputState}
        onAgentPresenceChange={(hasSmooth, hasBrowserUse) => {
          setHasSmooth(hasSmooth);
          setHasBrowserUse(hasBrowserUse);
        }}
      />
    </HomePageLayout>
  );
}
