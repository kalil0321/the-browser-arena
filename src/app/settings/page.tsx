"use client";

import { useState, useEffect } from "react";
import { SidebarInset } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getApiKey, setApiKey, removeApiKey, hasApiKey, maskApiKey } from "@/lib/api-keys";
import { Eye, EyeOff, CheckCircle2, XCircle, Key } from "lucide-react";

export default function SettingsPage() {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(
    api.auth.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  // API Keys state
  const [smoothApiKey, setSmoothApiKey] = useState("");
  const [smoothKeyVisible, setSmoothKeyVisible] = useState(false);
  const [smoothKeyDisplay, setSmoothKeyDisplay] = useState<string | null>(null);
  const [smoothKeyFull, setSmoothKeyFull] = useState<string | null>(null); // Full decrypted key
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
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
          setSmoothKeyFull(key);
          setSmoothKeyDisplay(maskApiKey(key));
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
      setSaveMessage({ type: "error", text: "Please sign in to save API keys" });
      return;
    }

    if (!smoothApiKey.trim()) {
      setSaveMessage({ type: "error", text: "API key cannot be empty" });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      await setApiKey("smooth", smoothApiKey, user._id);
      setSmoothKeyFull(smoothApiKey);
      setSmoothKeyDisplay(maskApiKey(smoothApiKey));
      setSmoothApiKey("");
      setSmoothKeyVisible(false);
      console.log("✅ Smooth API key saved to localStorage (encrypted). Your key will be used for future Smooth API calls.");
      setSaveMessage({ type: "success", text: "Smooth API key saved successfully" });

      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save API key"
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
      setSmoothKeyFull(null);
      setSmoothApiKey("");
      setSmoothKeyVisible(false);
      setSaveMessage({ type: "success", text: "Smooth API key removed" });

      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: "Failed to remove API key"
      });
    }
  };

  const handleToggleSmoothKeyVisibility = async () => {
    if (!user?._id || !smoothKeyFull) return;

    if (smoothKeyVisible) {
      // Hide - show masked version
      setSmoothKeyDisplay(maskApiKey(smoothKeyFull));
      setSmoothKeyVisible(false);
    } else {
      // Show - display full key
      setSmoothKeyDisplay(smoothKeyFull);
      setSmoothKeyVisible(true);
    }
  };

  return (
    <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-background text-foreground p-4" >
      <div className="flex-1 overflow-y-auto">
        <div className="container py-8 space-y-8 mx-auto">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your account settings and preferences
            </p>
          </div>

          <Separator />

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="api-keys">API Keys</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Profile Information</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      defaultValue={user?.name || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      defaultValue={user?.email || ""}
                    />
                  </div>
                  <Button>Save Changes</Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="account" className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Account Settings</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input id="current-password" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input id="confirm-password" type="password" />
                  </div>
                  <Button>Update Password</Button>
                </div>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-destructive">Danger Zone</h3>
                  <div className="rounded-lg border border-destructive/50 p-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Once you delete your account, there is no going back. Please be certain.
                    </p>
                    <Button variant="destructive">Delete Account</Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="api-keys" className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">API Keys</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage your API keys for external services. Keys are encrypted and stored locally on this device.
                  </p>
                </div>

                <Separator />

                {/* Smooth API Key Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Smooth API Key</h3>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Your Smooth API key is used to authenticate requests to the Smooth service.
                    If not provided, the default server key will be used.
                  </p>

                  {/* Current Key Display */}
                  {isLoadingKey ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : smoothKeyDisplay ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-muted-foreground">Key is set</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={smoothKeyDisplay || ""}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleToggleSmoothKeyVisibility}
                          title={smoothKeyVisible ? "Hide key" : "Show key"}
                        >
                          {smoothKeyVisible ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="destructive"
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

                  {/* Save New/Update Key */}
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="smooth-api-key">
                        {smoothKeyDisplay ? "Update Smooth API Key" : "Add Smooth API Key"}
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
                      {isSaving ? "Saving..." : smoothKeyDisplay ? "Update Key" : "Save Key"}
                    </Button>
                  </div>

                  {/* Status Message */}
                  {saveMessage && (
                    <div
                      className={`rounded-lg border p-3 text-sm ${saveMessage.type === "success"
                        ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100"
                        : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        {saveMessage.type === "success" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <span>{saveMessage.text}</span>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
                    <p className="text-blue-900 dark:text-blue-100">
                      <strong>Note:</strong> Your API key is encrypted and stored locally on this device only.
                      It will not be synced across devices. If you clear your browser data, you will need to re-enter your key.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="appearance" className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Appearance</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <p className="text-sm text-muted-foreground">
                      Use the theme switcher in the sidebar to change your theme preference.
                    </p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="font-size">Font Size</Label>
                    <Input
                      id="font-size"
                      type="number"
                      placeholder="14"
                      min="12"
                      max="20"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Notification Preferences</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive email updates about your sessions
                      </p>
                    </div>
                    <input type="checkbox" className="h-4 w-4" />
                  </div>
                  <Separator />
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
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SidebarInset>
  );
}
