"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { SidebarInset } from "@/components/ui/sidebar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
// Removed Select imports as visibility setting is hidden for now
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getApiKey, setApiKey, removeApiKey, hasApiKey, maskApiKey } from "@/lib/api-keys";
import { CheckCircle2, XCircle, Key, DollarSign, Zap, Smartphone, Eye, EyeOff } from "lucide-react";

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
  const [smoothKeyVisible, setSmoothKeyVisible] = useState(false);
  const [smoothKeyFull, setSmoothKeyFull] = useState<string | null>(null);

  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiKeyVisible, setOpenaiKeyVisible] = useState(false);
  const [openaiKeyDisplay, setOpenaiKeyDisplay] = useState<string | null>(null);
  const [openaiKeyFull, setOpenaiKeyFull] = useState<string | null>(null);

  const [googleApiKey, setGoogleApiKey] = useState("");
  const [googleKeyVisible, setGoogleKeyVisible] = useState(false);
  const [googleKeyDisplay, setGoogleKeyDisplay] = useState<string | null>(null);
  const [googleKeyFull, setGoogleKeyFull] = useState<string | null>(null);

  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [anthropicKeyVisible, setAnthropicKeyVisible] = useState(false);
  const [anthropicKeyDisplay, setAnthropicKeyDisplay] = useState<string | null>(null);
  const [anthropicKeyFull, setAnthropicKeyFull] = useState<string | null>(null);

  const [browserUseApiKey, setBrowserUseApiKey] = useState("");
  const [browserUseKeyVisible, setBrowserUseKeyVisible] = useState(false);
  const [browserUseKeyDisplay, setBrowserUseKeyDisplay] = useState<string | null>(null);
  const [browserUseKeyFull, setBrowserUseKeyFull] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingKey, setIsLoadingKey] = useState(true);

  // App theme (Arena default vs Pro)
  const [appTheme, setAppTheme] = useState<"default" | "pro">("default");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("appTheme");
      if (stored === "pro") {
        setAppTheme("pro");
        document.documentElement.setAttribute("data-theme", "pro");
      } else {
        setAppTheme("default");
        document.documentElement.removeAttribute("data-theme");
      }
    } catch {
      // no-op
    }
  }, []);
  const handleChangeAppTheme = (value: "default" | "pro") => {
    setAppTheme(value);
    try {
      localStorage.setItem("appTheme", value);
      // Mirror to cookie so server can SSR the same attribute and avoid hydration mismatch
      const maxAge = 60 * 60 * 24 * 365; // 1 year
      document.cookie = `appTheme=${value}; path=/; max-age=${maxAge}`;
    } catch {
      // no-op
    }
    if (value === "pro") {
      document.documentElement.setAttribute("data-theme", "pro");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  };

  // Load existing key on mount
  useEffect(() => {
    if (user?._id) {
      loadAllKeys();
    } else {
      setIsLoadingKey(false);
    }
  }, [user?._id]);

  const loadAllKeys = async () => {
    if (!user?._id) return;
    setIsLoadingKey(true);
    try {
      // Load Smooth key
      if (hasApiKey("smooth")) {
        const key = await getApiKey("smooth", user._id);
        if (key) {
          setSmoothKeyFull(key);
          setSmoothKeyDisplay("***"); // Just indicate key exists, don't show it
          console.log("🔑 Loaded user's Smooth API key from localStorage");
        }
      }

      // Load OpenAI key
      if (hasApiKey("openai")) {
        const key = await getApiKey("openai", user._id);
        if (key) {
          setOpenaiKeyFull(key);
          setOpenaiKeyDisplay(maskApiKey(key));
          console.log("🔑 Loaded user's OpenAI API key from localStorage");
        }
      }

      // Load Google key
      if (hasApiKey("google")) {
        const key = await getApiKey("google", user._id);
        if (key) {
          setGoogleKeyFull(key);
          setGoogleKeyDisplay(maskApiKey(key));
          console.log("🔑 Loaded user's Google API key from localStorage");
        }
      }

      // Load Anthropic key
      if (hasApiKey("anthropic")) {
        const key = await getApiKey("anthropic", user._id);
        if (key) {
          setAnthropicKeyFull(key);
          setAnthropicKeyDisplay(maskApiKey(key));
          console.log("🔑 Loaded user's Anthropic API key from localStorage");
        }
      }

      // Load Browser-Use key
      if (hasApiKey("browser-use")) {
        const key = await getApiKey("browser-use", user._id);
        if (key) {
          setBrowserUseKeyFull(key);
          setBrowserUseKeyDisplay(maskApiKey(key));
          console.log("🔑 Loaded user's Browser-Use API key from localStorage");
        }
      }
    } catch (error) {
      console.error("❌ Failed to load API keys:", error);
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

  // OpenAI handlers
  const handleSaveOpenaiKey = async () => {
    if (!user?._id) {
      toast.error("Please sign in to save API keys", {
        duration: 5000,
      });
      return;
    }
    if (!openaiApiKey.trim()) {
      toast.error("API key cannot be empty", {
        duration: 5000,
      });
      return;
    }
    setIsSaving(true);
    const isReplacing = !!openaiKeyDisplay;
    try {
      await setApiKey("openai", openaiApiKey, user._id);
      setOpenaiKeyFull(openaiApiKey);
      setOpenaiKeyDisplay(maskApiKey(openaiApiKey));
      setOpenaiApiKey("");
      setOpenaiKeyVisible(false);
      toast.success(isReplacing ? "OpenAI API key replaced successfully" : "OpenAI API key saved successfully", {
        duration: 3000,
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

  const handleRemoveOpenaiKey = async () => {
    if (!user?._id) return;
    try {
      removeApiKey("openai");
      setOpenaiKeyDisplay(null);
      setOpenaiKeyFull(null);
      setOpenaiApiKey("");
      setOpenaiKeyVisible(false);
      toast.success("OpenAI API key removed", {
        duration: 3000,
      });
    } catch (error) {
      toast.error("Failed to remove API key", {
        duration: 5000,
      });
    }
  };

  const handleToggleOpenaiKeyVisibility = async () => {
    if (!user?._id || !openaiKeyFull) return;
    if (openaiKeyVisible) {
      setOpenaiKeyDisplay(maskApiKey(openaiKeyFull));
      setOpenaiKeyVisible(false);
    } else {
      setOpenaiKeyDisplay(openaiKeyFull);
      setOpenaiKeyVisible(true);
    }
  };

  // Google handlers
  const handleSaveGoogleKey = async () => {
    if (!user?._id) {
      toast.error("Please sign in to save API keys", {
        duration: 5000,
      });
      return;
    }
    if (!googleApiKey.trim()) {
      toast.error("API key cannot be empty", {
        duration: 5000,
      });
      return;
    }
    setIsSaving(true);
    const isReplacing = !!googleKeyDisplay;
    try {
      await setApiKey("google", googleApiKey, user._id);
      setGoogleKeyFull(googleApiKey);
      setGoogleKeyDisplay(maskApiKey(googleApiKey));
      setGoogleApiKey("");
      setGoogleKeyVisible(false);
      toast.success(isReplacing ? "Google API key replaced successfully" : "Google API key saved successfully", {
        duration: 3000,
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

  const handleRemoveGoogleKey = async () => {
    if (!user?._id) return;
    try {
      removeApiKey("google");
      setGoogleKeyDisplay(null);
      setGoogleKeyFull(null);
      setGoogleApiKey("");
      setGoogleKeyVisible(false);
      toast.success("Google API key removed", {
        duration: 3000,
      });
    } catch (error) {
      toast.error("Failed to remove API key", {
        duration: 5000,
      });
    }
  };

  const handleToggleGoogleKeyVisibility = async () => {
    if (!user?._id || !googleKeyFull) return;
    if (googleKeyVisible) {
      setGoogleKeyDisplay(maskApiKey(googleKeyFull));
      setGoogleKeyVisible(false);
    } else {
      setGoogleKeyDisplay(googleKeyFull);
      setGoogleKeyVisible(true);
    }
  };

  // Anthropic handlers
  const handleSaveAnthropicKey = async () => {
    if (!user?._id) {
      toast.error("Please sign in to save API keys", {
        duration: 5000,
      });
      return;
    }
    if (!anthropicApiKey.trim()) {
      toast.error("API key cannot be empty", {
        duration: 5000,
      });
      return;
    }
    setIsSaving(true);
    const isReplacing = !!anthropicKeyDisplay;
    try {
      await setApiKey("anthropic", anthropicApiKey, user._id);
      setAnthropicKeyFull(anthropicApiKey);
      setAnthropicKeyDisplay(maskApiKey(anthropicApiKey));
      setAnthropicApiKey("");
      setAnthropicKeyVisible(false);
      toast.success(isReplacing ? "Anthropic API key replaced successfully" : "Anthropic API key saved successfully", {
        duration: 3000,
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

  const handleRemoveAnthropicKey = async () => {
    if (!user?._id) return;
    try {
      removeApiKey("anthropic");
      setAnthropicKeyDisplay(null);
      setAnthropicKeyFull(null);
      setAnthropicApiKey("");
      setAnthropicKeyVisible(false);
      toast.success("Anthropic API key removed", {
        duration: 3000,
      });
    } catch (error) {
      toast.error("Failed to remove API key", {
        duration: 5000,
      });
    }
  };

  const handleToggleAnthropicKeyVisibility = async () => {
    if (!user?._id || !anthropicKeyFull) return;
    if (anthropicKeyVisible) {
      setAnthropicKeyDisplay(maskApiKey(anthropicKeyFull));
      setAnthropicKeyVisible(false);
    } else {
      setAnthropicKeyDisplay(anthropicKeyFull);
      setAnthropicKeyVisible(true);
    }
  };

  // Browser-Use handlers
  const handleSaveBrowserUseKey = async () => {
    if (!user?._id) {
      toast.error("Please sign in to save API keys", {
        duration: 5000,
      });
      return;
    }
    if (!browserUseApiKey.trim()) {
      toast.error("API key cannot be empty", {
        duration: 5000,
      });
      return;
    }
    setIsSaving(true);
    const isReplacing = !!browserUseKeyDisplay;
    try {
      await setApiKey("browser-use", browserUseApiKey, user._id);
      setBrowserUseKeyFull(browserUseApiKey);
      setBrowserUseKeyDisplay(maskApiKey(browserUseApiKey));
      setBrowserUseApiKey("");
      setBrowserUseKeyVisible(false);
      toast.success(isReplacing ? "Browser-Use API key replaced successfully" : "Browser-Use API key saved successfully", {
        duration: 3000,
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

  const handleRemoveBrowserUseKey = async () => {
    if (!user?._id) return;
    try {
      removeApiKey("browser-use");
      setBrowserUseKeyDisplay(null);
      setBrowserUseKeyFull(null);
      setBrowserUseApiKey("");
      setBrowserUseKeyVisible(false);
      toast.success("Browser-Use API key removed", {
        duration: 3000,
      });
    } catch (error) {
      toast.error("Failed to remove API key", {
        duration: 5000,
      });
    }
  };

  const handleToggleBrowserUseKeyVisibility = async () => {
    if (!user?._id || !browserUseKeyFull) return;
    if (browserUseKeyVisible) {
      setBrowserUseKeyDisplay(maskApiKey(browserUseKeyFull));
      setBrowserUseKeyVisible(false);
    } else {
      setBrowserUseKeyDisplay(browserUseKeyFull);
      setBrowserUseKeyVisible(true);
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
            {/* Application Theme Section */}
            <div id="app-theme" className="grid grid-cols-12 gap-8">
              <div className="col-span-4 space-y-2">
                <h2 className="text-xl font-semibold">Application theme</h2>
                <p className="text-sm text-muted-foreground">
                  Choose between the Arena default styling and a more professional look.
                </p>
              </div>
              <div className="col-span-1 flex justify-center">
                <div className="w-px h-full border-l border-dashed border-border"></div>
              </div>
              <div className="col-span-7 space-y-4">
                <div className="flex items-center gap-4">
                  <button
                    className={`px-3 py-2 rounded-md border text-sm ${appTheme === "default" ? "bg-primary text-primary-foreground border-transparent" : "bg-background text-foreground border-border"}`}
                    onClick={() => handleChangeAppTheme("default")}
                    aria-pressed={appTheme === "default"}
                  >
                    Default (Arena)
                  </button>
                  <button
                    className={`px-3 py-2 rounded-md border text-sm ${appTheme === "pro" ? "bg-primary text-primary-foreground border-transparent" : "bg-background text-foreground border-border"}`}
                    onClick={() => handleChangeAppTheme("pro")}
                    aria-pressed={appTheme === "pro"}
                  >
                    Pro
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This preference is stored on this device only.
                </p>
              </div>
            </div>

            <Separator />
            {/* Personal Information Section */}
            <div id="personal-info" className="grid grid-cols-12 gap-8">
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
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="emma@company.com"
                    defaultValue={user?.email || ""}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Workspace Settings Section */}
            <div id="api-keys" className="grid grid-cols-12 gap-8">
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
                {/* Workspace name, visibility, and description hidden for now */}

                {/* API Keys Section */}
                <div id="smooth-api-section" className="space-y-4 pt-4 border-t">
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
                </div>

                {/* OpenAI API Key Section */}
                <div id="openai-api-section" className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">OpenAI API Key</h3>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Your OpenAI API key is used to authenticate requests to OpenAI services.
                    If not provided, the default server key will be used.
                  </p>

                  {/* Current Key Display */}
                  {isLoadingKey ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : openaiKeyDisplay ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-muted-foreground">Key is set</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={openaiKeyDisplay || ""}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleToggleOpenaiKeyVisibility}
                          title={openaiKeyVisible ? "Hide key" : "Show key"}
                        >
                          {openaiKeyVisible ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleRemoveOpenaiKey}
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
                      <Label htmlFor="openai-api-key">
                        {openaiKeyDisplay ? "Update OpenAI API Key" : "Add OpenAI API Key"}
                      </Label>
                      <Input
                        id="openai-api-key"
                        type="password"
                        placeholder="Enter your OpenAI API key"
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <Button
                      onClick={handleSaveOpenaiKey}
                      disabled={isSaving || !openaiApiKey.trim() || !user?._id}
                    >
                      {isSaving ? "Saving..." : openaiKeyDisplay ? "Update Key" : "Save Key"}
                    </Button>
                  </div>
                </div>

                {/* Google API Key Section */}
                <div id="google-api-section" className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Google API Key</h3>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Your Google API key is used to authenticate requests to Google AI services (Gemini).
                    If not provided, the default server key will be used.
                  </p>

                  {/* Current Key Display */}
                  {isLoadingKey ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : googleKeyDisplay ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-muted-foreground">Key is set</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={googleKeyDisplay || ""}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleToggleGoogleKeyVisibility}
                          title={googleKeyVisible ? "Hide key" : "Show key"}
                        >
                          {googleKeyVisible ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleRemoveGoogleKey}
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
                      <Label htmlFor="google-api-key">
                        {googleKeyDisplay ? "Update Google API Key" : "Add Google API Key"}
                      </Label>
                      <Input
                        id="google-api-key"
                        type="password"
                        placeholder="Enter your Google API key"
                        value={googleApiKey}
                        onChange={(e) => setGoogleApiKey(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <Button
                      onClick={handleSaveGoogleKey}
                      disabled={isSaving || !googleApiKey.trim() || !user?._id}
                    >
                      {isSaving ? "Saving..." : googleKeyDisplay ? "Update Key" : "Save Key"}
                    </Button>
                  </div>
                </div>

                {/* Anthropic API Key Section */}
                <div id="anthropic-api-section" className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Anthropic API Key</h3>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Your Anthropic API key is used to authenticate requests to Anthropic services (Claude).
                    If not provided, the default server key will be used.
                  </p>

                  {/* Current Key Display */}
                  {isLoadingKey ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : anthropicKeyDisplay ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-muted-foreground">Key is set</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={anthropicKeyDisplay || ""}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleToggleAnthropicKeyVisibility}
                          title={anthropicKeyVisible ? "Hide key" : "Show key"}
                        >
                          {anthropicKeyVisible ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleRemoveAnthropicKey}
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
                      <Label htmlFor="anthropic-api-key">
                        {anthropicKeyDisplay ? "Update Anthropic API Key" : "Add Anthropic API Key"}
                      </Label>
                      <Input
                        id="anthropic-api-key"
                        type="password"
                        placeholder="Enter your Anthropic API key"
                        value={anthropicApiKey}
                        onChange={(e) => setAnthropicApiKey(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <Button
                      onClick={handleSaveAnthropicKey}
                      disabled={isSaving || !anthropicApiKey.trim() || !user?._id}
                    >
                      {isSaving ? "Saving..." : anthropicKeyDisplay ? "Update Key" : "Save Key"}
                    </Button>
                  </div>
                </div>

                {/* Browser-Use API Key Section */}
                <div id="browser-use-api-section" className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Browser-Use API Key</h3>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Your Browser-Use API key is used to authenticate requests to Browser-Use Cloud services.
                    If not provided, the default server key will be used.
                  </p>

                  {/* Current Key Display */}
                  {isLoadingKey ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : browserUseKeyDisplay ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-muted-foreground">Key is set</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={browserUseKeyDisplay || ""}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleToggleBrowserUseKeyVisibility}
                          title={browserUseKeyVisible ? "Hide key" : "Show key"}
                        >
                          {browserUseKeyVisible ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleRemoveBrowserUseKey}
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
                      <Label htmlFor="browser-use-api-key">
                        {browserUseKeyDisplay ? "Update Browser-Use API Key" : "Add Browser-Use API Key"}
                      </Label>
                      <Input
                        id="browser-use-api-key"
                        type="password"
                        placeholder="Enter your Browser-Use API key"
                        value={browserUseApiKey}
                        onChange={(e) => setBrowserUseApiKey(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <Button
                      onClick={handleSaveBrowserUseKey}
                      disabled={isSaving || !browserUseApiKey.trim() || !user?._id}
                    >
                      {isSaving ? "Saving..." : browserUseKeyDisplay ? "Update Key" : "Save Key"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
                  <p className="text-blue-900 dark:text-blue-100">
                    <strong>Note:</strong> All your API keys are encrypted and stored locally on this device only.
                    They will not be synced across devices. If you clear your browser data, you will need to re-enter your keys.
                  </p>
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


          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
