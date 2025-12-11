"use client";

import { Battle } from "@/components/battle";
import { Session } from "@/components/session";
import { useSearchParams } from "next/navigation";

export default function Home() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");

  if (mode === "session") {
    return <Session />
  }

  return <Battle />
}