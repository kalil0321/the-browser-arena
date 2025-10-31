"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { SidebarInset } from "@/components/ui/sidebar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getApiKey, setApiKey, removeApiKey, hasApiKey } from "@/lib/api-keys";
import { CheckCircle2, XCircle, Key, DollarSign, Zap, Smartphone } from "lucide-react";

export default function SettingsPage() {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(
    api.auth.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  // Fetch usage stats
  const usageStats = useQuery(
    api.queries.getUserUsageStats,
    isAuthenticated ? {} : "skip"
  );

  const costBreakdown = useQuery(
    api.queries.getUserCostBreakdown,
    isAuthenticated ? {} : "skip"
  );

  // API Keys state
  const [smoothApiKey, setSmoothApiKey] = useState("");
  const [smoothKeyDisplay, setSmoothKeyDisplay] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingKey, setIsLoadingKey] = useState(true);

  // Load existing key on mount
  useEffect(() => {
    if (user?._id) {
      loadSmoothKey();
    } else {
      setIsLoadingKey(false);
    }
  }, [user?._id]);

  const loadSmoothKey = async () => {
    if (!user?._id) return;
    setIsLoadingKey(true);
    try {
      if (hasApiKey("smooth")) {
        const key = await getApiKey("smooth", user._id);
        if (key) {
          setSmoothKeyDisplay("***"); // Just indicate key exists, don't show it
          console.log("🔑 Loaded user's Smooth API key from localStorage");
        }
      } else {
        console.log("ℹ️ No Smooth API key found in localStorage");
      }
    } catch (error) {
      console.error("❌ Failed to load Smooth API key:", error);
    } finally {
      setIsLoadingKey(false);
    }
  };

  const handleSaveSmoothKey = async () => {
    if (!user?._id) {
      toast.error("Please sign in to save API keys", {
        duration: 5000,
      });
      return;
    }

    if (!smoothApiKey.trim()) {
      toast.error("API key cannot be empty", {
        duration: 5000,
      });
      return;
    }

    setIsSaving(true);

    const isReplacing = !!smoothKeyDisplay;
    try {
      await setApiKey("smooth", smoothApiKey, user._id);
      setSmoothKeyDisplay("***"); // Just indicate key exists
      setSmoothApiKey("");
      console.log("✅ Smooth API key saved to localStorage (encrypted). Your key will be used for future Smooth API calls.");
      toast.success(isReplacing ? "Smooth API key replaced successfully" : "Smooth API key saved successfully", {
        duration: 3000,
        description: "Your key will be used for future Smooth API calls."
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to save API key";
      toast.error("Failed to save API key", {
        description: errorMsg,
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveSmoothKey = async () => {
    if (!user?._id) return;

    try {
      removeApiKey("smooth");
      setSmoothKeyDisplay(null);
      setSmoothApiKey("");
      toast.success("Smooth API key removed", {
        duration: 3000,
      });
    } catch (error) {
      toast.error("Failed to remove API key", {
        duration: 5000,
      });
    }
  };


  return (
    <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      <div className="flex-1 overflow-y-auto">
        <div className="container py-8 mx-auto max-w-6xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your account settings and preferences
            </p>
          </div>

          <div className="space-y-16">
            {/* Personal Information Section */}
            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-4 space-y-2">
                <h2 className="text-xl font-semibold">Personal information</h2>
                <p className="text-sm text-muted-foreground">
                  Update your personal details and account information.
                </p>
              </div>
              <div className="col-span-1 flex justify-center">
                <div className="w-px h-full border-l border-dashed border-border"></div>
              </div>
              <div className="col-span-7 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First name</Label>
                  <Input
                    id="first-name"
                    placeholder="Emma"
                    defaultValue={user?.name?.split(" ")[0] || ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last name</Label>
                  <Input
                    id="last-name"
                    placeholder="Crown"
                    defaultValue={user?.name?.split(" ").slice(1).join(" ") || ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="emma@company.com"
                    defaultValue={user?.email || ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birth-year">Birth year</Label>
                  <Input
                    id="birth-year"
                    type="number"
                    placeholder="1990"
                    min="1900"
                    max={new Date().getFullYear()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    placeholder="Senior Manager"
                  />
                  <p className="text-xs text-muted-foreground">
                    Roles can only be changed by system admin.
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Workspace Settings Section */}
            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-4 space-y-2">
                <h2 className="text-xl font-semibold">Workspace settings</h2>
                <p className="text-sm text-muted-foreground">
                  Manage your API keys and workspace configuration.
                </p>
              </div>
              <div className="col-span-1 flex justify-center">
                <div className="w-px h-full border-l border-dashed border-border"></div>
              </div>
              <div className="col-span-7 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="workspace-name">Workspace name</Label>
                  <Input
                    id="workspace-name"
                    placeholder="Test workspace"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visibility">Visibility</Label>
                  <Select defaultValue="private">
                    <SelectTrigger id="visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workspace-description">Workspace description</Label>
                  <textarea
                    id="workspace-description"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-input/30 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter a description for your workspace"
                  />
                  <p className="text-xs text-muted-foreground">
                    Note: description provided will not be displayed externally.
                  </p>
                </div>

                {/* API Keys Section */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Smooth API Key</h3>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Your Smooth API key is used to authenticate requests to the Smooth service.
                    If not provided, the default server key will be used.
                  </p>

                  {/* Current Key Status */}
                  {isLoadingKey ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : smoothKeyDisplay ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-muted-foreground">Key is set</span>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleRemoveSmoothKey}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">No key set</span>
                    </div>
                  )}

                  {/* Add New Key */}
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="smooth-api-key">
                        {smoothKeyDisplay ? "Replace Smooth API Key" : "Add Smooth API Key"}
                      </Label>
                      <Input
                        id="smooth-api-key"
                        type="password"
                        placeholder="Enter your Smooth API key"
                        value={smoothApiKey}
                        onChange={(e) => setSmoothApiKey(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <Button
                      onClick={handleSaveSmoothKey}
                      disabled={isSaving || !smoothApiKey.trim() || !user?._id}
                    >
                      {isSaving ? "Saving..." : smoothKeyDisplay ? "Replace Key" : "Save Key"}
                    </Button>
                  </div>

                  <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
                    <p className="text-blue-900 dark:text-blue-100">
                      <strong>Note:</strong> Your API key is encrypted and stored locally on this device only.
                      It will not be synced across devices. If you clear your browser data, you will need to re-enter your key.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Usage & Billing Section */}
            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-4 space-y-2">
                <h2 className="text-xl font-semibold">Usage & Billing</h2>
                <p className="text-sm text-muted-foreground">
                  Track your API usage and costs across all agent sessions.
                </p>
              </div>
              <div className="col-span-1 flex justify-center">
                <div className="w-px h-full border-l border-dashed border-border"></div>
              </div>
              <div className="col-span-7 space-y-6">
                {/* Cost Summary Cards */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Total Cost Card */}
                  <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Total Cost</p>
                      <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-2xl font-bold font-default">
                      ${typeof usageStats?.totalCost === "number" ? usageStats.totalCost.toFixed(2) : "0.00"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">USD</p>
                  </div>

                  {/* Sessions Card */}
                  <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Sessions</p>
                      <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-2xl font-bold font-default">
                      {usageStats?.totalSessions ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">total sessions</p>
                  </div>

                  {/* Agents Card */}
                  <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Agents Run</p>
                      <Smartphone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <p className="text-2xl font-bold font-default">
                      {usageStats?.totalAgents ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">total agents</p>
                  </div>
                </div>

                {/* Cost Breakdown */}
                {(costBreakdown?.byAgent && Object.keys(costBreakdown.byAgent).length > 0) && (
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-medium">Cost Breakdown</h3>

                    {/* By Agent Type */}
                    <div>
                      <p className="text-sm font-medium mb-3">By Agent Type</p>
                      <div className="space-y-2">
                        {Object.entries(costBreakdown.byAgent).map(([agent, cost]) => (
                          <div
                            key={agent}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <span className="text-sm capitalize">{agent}</span>
                            <span className="font-default font-semibold">
                              ${(cost as number).toFixed(4)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* By Model */}
                    {costBreakdown?.byModel && Object.keys(costBreakdown.byModel).length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-3">By Model</p>
                        <div className="space-y-2">
                          {Object.entries(costBreakdown.byModel).map(([model, cost]) => (
                            <div
                              key={model}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                            >
                              <span className="text-sm truncate">{model}</span>
                              <span className="font-default font-semibold">
                                ${(cost as number).toFixed(4)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty State */}
                {(!costBreakdown?.byAgent || Object.keys(costBreakdown.byAgent).length === 0) && (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      No agents have been run yet
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Agent costs will appear here once you run your first session
                    </p>
                  </div>
                )}

                {/* Last Session Info */}
                {usageStats?.lastSessionAt && (
                  <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
                    <p className="text-blue-900 dark:text-blue-100 font-default">
                      <strong>Last Session:</strong>{" "}
                      {new Date(usageStats.lastSessionAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Notification Settings Section */}
            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-4 space-y-2">
                <h2 className="text-xl font-semibold">Notification settings</h2>
                <p className="text-sm text-muted-foreground">
                  Configure how and when you receive notifications.
                </p>
              </div>
              <div className="col-span-1 flex justify-center">
                <div className="w-px h-full border-l border-dashed border-border"></div>
              </div>
              <div className="col-span-7 space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-medium mb-1">Newsletter</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Change how often you want to receive updates from our newsletter.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="newsletter-weekly"
                          name="newsletter"
                          value="weekly"
                          className="h-4 w-4"
                        />
                        <Label htmlFor="newsletter-weekly" className="font-normal cursor-pointer">
                          Every week
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="newsletter-monthly"
                          name="newsletter"
                          value="monthly"
                          className="h-4 w-4"
                        />
                        <Label htmlFor="newsletter-monthly" className="font-normal cursor-pointer">
                          Every month
                        </Label>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive email updates about your sessions
                      </p>
                    </div>
                    <input type="checkbox" className="h-4 w-4" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Session Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when agents complete tasks
                      </p>
                    </div>
                    <input type="checkbox" className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
