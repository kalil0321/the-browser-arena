"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertCircle, Loader2 } from "lucide-react";

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

