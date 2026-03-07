"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertCircle, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth/client";

interface AuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSignIn: (email: string, password: string) => Promise<void>;
    onSignUp: (email: string, password: string, name: string) => Promise<void>;
    authError: string | null;
    isSubmittingAuth: boolean;
}

export function AuthDialog({
    open,
    onOpenChange,
    onSignIn,
    onSignUp,
    authError: externalAuthError,
    isSubmittingAuth
}: AuthDialogProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [activeAuthTab, setActiveAuthTab] = useState<"signin" | "signup">("signin");

    // Clear form when dialog closes
    useEffect(() => {
        if (!open) {
            setEmail("");
            setPassword("");
            setName("");
            setActiveAuthTab("signin");
        }
    }, [open]);

    // Clear errors when switching tabs
    useEffect(() => {
        if (activeAuthTab) {
            // Error is managed by parent
        }
    }, [activeAuthTab]);

    const handleSignIn = async () => {
        if (email && password) {
            await onSignIn(email, password);
        }
    };

    const handleSignUp = async () => {
        if (email && password && name) {
            await onSignUp(email, password, name);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Sign In Required</DialogTitle>
                    <DialogDescription>
                        Please sign in or create an account to submit a query.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                    <Button
                        variant="outline"
                        className="w-full"
                        disabled={isSubmittingAuth}
                        onClick={() => authClient.signIn.social({ provider: "google" })}
                    >
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        Continue with Google
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full"
                        disabled={isSubmittingAuth}
                        onClick={() => authClient.signIn.social({ provider: "github" })}
                    >
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                        Continue with GitHub
                    </Button>
                </div>
                <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">or</span>
                    </div>
                </div>
                <Tabs
                    value={activeAuthTab}
                    onValueChange={(value) => setActiveAuthTab(value as "signin" | "signup")}
                    className="w-full"
                >
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="signin">Sign In</TabsTrigger>
                        <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>
                    <TabsContent value="signin" className="space-y-4 mt-4">
                        {externalAuthError && (
                            <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                <span className="flex-1">{externalAuthError}</span>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && email && password && !isSubmittingAuth) {
                                        handleSignIn();
                                    }
                                }}
                                disabled={isSubmittingAuth}
                                autoComplete="email"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && email && password && !isSubmittingAuth) {
                                        handleSignIn();
                                    }
                                }}
                                disabled={isSubmittingAuth}
                                autoComplete="current-password"
                            />
                        </div>
                        <Button
                            onClick={handleSignIn}
                            disabled={isSubmittingAuth || !email || !password}
                            className="w-full"
                        >
                            {isSubmittingAuth ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign In"
                            )}
                        </Button>
                    </TabsContent>
                    <TabsContent value="signup" className="space-y-4 mt-4">
                        {externalAuthError && (
                            <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                <span className="flex-1">{externalAuthError}</span>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="Enter your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && name && email && password && !isSubmittingAuth) {
                                        handleSignUp();
                                    }
                                }}
                                disabled={isSubmittingAuth}
                                autoComplete="name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="signup-email">Email</Label>
                            <Input
                                id="signup-email"
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && name && email && password && !isSubmittingAuth) {
                                        handleSignUp();
                                    }
                                }}
                                disabled={isSubmittingAuth}
                                autoComplete="email"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="signup-password">Password</Label>
                            <Input
                                id="signup-password"
                                type="password"
                                placeholder="Create a password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && name && email && password && !isSubmittingAuth) {
                                        handleSignUp();
                                    }
                                }}
                                disabled={isSubmittingAuth}
                                autoComplete="new-password"
                            />
                        </div>
                        <Button
                            onClick={handleSignUp}
                            disabled={isSubmittingAuth || !email || !password || !name}
                            className="w-full"
                        >
                            {isSubmittingAuth ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing up...
                                </>
                            ) : (
                                "Sign Up"
                            )}
                        </Button>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

