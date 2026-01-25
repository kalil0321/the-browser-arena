"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ModeToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const currentMode = modeParam === "battle" ? "battle" : "session";

  const handleModeChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    params.set("mode", value);

    const newUrl = params.toString() ? `/?${params.toString()}` : "/";
    router.push(newUrl);
  };

  return (
    <Tabs value={currentMode} onValueChange={handleModeChange}>
      <TabsList className="bg-background/90 backdrop-blur-sm border border-border/50">
        <TabsTrigger value="battle">Battle</TabsTrigger>
        <TabsTrigger value="session">Session</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

