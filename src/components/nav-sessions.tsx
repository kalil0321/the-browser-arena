"use client";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import React from "react";

export type Session = {
  id: string;
  title: string;
  date: string;
};

export function SessionsNav({ sessions }: { sessions?: Session[] }) {
  const { isMobile } = useSidebar();
  const isEmpty = !sessions || sessions.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="px-2 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Sessions
          </span>
          <button
            className="inline-flex items-center justify-center rounded-md p-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            title="New session"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-sidebar-border bg-sidebar-muted/30 px-4 py-6 mx-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sidebar-muted">
            <MessageSquare className="size-5 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">No sessions yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Start a new conversation to get going
            </p>
          </div>
          <button className="mt-2 inline-flex items-center justify-center rounded-md bg-sidebar-accent px-3 py-1.5 text-xs font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent/90 transition-colors">
            <Plus className="size-3 mr-1" />
            New Session
          </button>
        </div>
      ) : (
        <SidebarMenu className="px-2">
          {sessions.map((session) => (
            <SidebarMenuItem key={session.id}>
              <SidebarMenuButton tooltip={session.title} asChild>
                <Link
                  href={`/chat/${session.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-muted hover:text-foreground transition-colors truncate"
                  )}
                >
                  <MessageSquare className="size-4 shrink-0" />
                  <span className="truncate">{session.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      )}
    </div>
  );
}
