"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { SidebarInset } from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { BrowserUseLogo } from "@/components/logos/bu";
import { SmoothLogo } from "@/components/logos/smooth";
import { StagehandLogo } from "@/components/logos/stagehand";

type SessionRow = {
  _id: Id<"sessions">;
  instruction: string;
  createdAt: number;
};

export default function SessionsPage() {
  const sessions = useQuery(api.queries.getUserSessions);

  const hasSessions = (sessions?.length ?? 0) > 0;

  return (
    <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-background">
      <header className="flex items-center justify-between border-b px-4 py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Review the instructions you&apos;ve submitted and the agents that ran.
          </p>
        </div>
        <Button asChild>
          <Link href="/" prefetch={true}>New Session</Link>
        </Button>
      </header>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="rounded-xl border bg-card shadow-sm">
          <Table data-slot="frame">
            <TableCaption>Your latest sessions appear here.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Session ID</TableHead>
                <TableHead>Instruction</TableHead>
                <TableHead>Agents</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!sessions && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                      Loading sessions…
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {sessions && sessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                      <p className="text-sm font-medium text-foreground">
                        No sessions yet
                      </p>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Start a new session to see it listed here once agents finish running.
                      </p>
                      <Button asChild size="sm">
                        <Link href="/" prefetch={true}>Create session</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {hasSessions &&
                sessions!.map((session: SessionRow) => (
                  <TableRow key={session._id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/session/${session._id}`}
                        prefetch={true}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {session._id}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-xl truncate">
                      <Link
                        href={`/session/${session._id}`}
                        prefetch={true}
                        className="text-foreground hover:text-primary transition-colors"
                      >
                        {session.instruction}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <SessionAgents sessionId={session._id} />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </SidebarInset>
  );
}

function SessionAgents({ sessionId }: { sessionId: Id<"sessions"> }) {
  const agents = useQuery(api.queries.getSessionAgents, {
    sessionId,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500";
      case "running":
        return "bg-sky-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-muted-foreground/60";
    }
  };

  if (agents === undefined) {
    return <span className="text-xs text-muted-foreground">Loading…</span>;
  }

  if (!agents || agents.length === 0) {
    return <span className="text-xs text-muted-foreground">No agents</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {agents.map((agent) => (
        <Badge key={agent._id} variant="outline" className="flex items-center gap-1 capitalize">
          <span
            className={`size-1.5 rounded-full ${getStatusColor(agent.status)}`}
            aria-hidden="true"
          />
          {(agent.name === "browser-use" || agent.name === "browser_use" || agent.name === "browser-use-cloud") && (
            <BrowserUseLogo className="h-3 w-3" />
          )}
          {agent.name === "smooth" && (
            <SmoothLogo className="h-3 w-3" />
          )}
          {agent.name === "stagehand" && (
            <StagehandLogo className="h-3 w-3" />
          )}
          {agent.name}
        </Badge>
      ))}
    </div>
  );
}
