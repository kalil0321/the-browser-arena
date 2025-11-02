"use client";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export type Session = {
  _id: Id<"sessions">;
  _creationTime: number;
  userId: string;
  instruction: string;
  createdAt: number;
  updatedAt: number;
};

export function SessionsNav({ sessions, isDemo = false }: { sessions?: Session[]; isDemo?: boolean }) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const isEmpty = !sessions || sessions.length === 0;
  const deleteSession = useMutation(api.mutations.deleteSession);

  const handleDelete = async (e: React.MouseEvent, sessionId: Id<"sessions">) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this session?")) {
      await deleteSession({ sessionId });
    }
  };

  const handleNewSession = () => {
    router.push("/");
  };

  // Determine session URL based on whether it's a demo session
  const getSessionUrl = (session: Session) => {
    // Check if it's a demo session (userId is "demo-user")
    if (session.userId === "demo-user" || isDemo) {
      return `/demo/session/${session._id}`;
    }
    return `/session/${session._id}`;
  };

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
            onClick={handleNewSession}
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
          <button
            className="mt-2 inline-flex items-center justify-center rounded-md bg-sidebar-accent px-3 py-1.5 text-xs font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent/90 transition-colors"
            onClick={handleNewSession}
          >
            <Plus className="size-3 mr-1" />
            New Session
          </button>
        </div>
      ) : (
        <SidebarMenu className="px-2">
          {sessions.map((session) => (
            <SidebarMenuItem key={session._id} className="px-0">
              <SidebarMenuButton tooltip={session.instruction} asChild>
                <div className="flex items-center gap-1 group">
                  <Link
                    href={getSessionUrl(session)}
                    prefetch={true}
                    className={cn(
                      "flex items-center gap-2 rounded-lg py-1.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-muted hover:text-foreground transition-colors truncate flex-1"
                    )}
                  >
                    <MessageSquare className="size-4 shrink-0" />
                    <span className="truncate">{session.instruction}</span>
                  </Link>
                  {!isDemo && (
                    <button
                      onClick={(e) => handleDelete(e, session._id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      title="Delete session"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      )}
    </div>
  );
}
