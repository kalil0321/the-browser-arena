"use client";

import { useState, useEffect } from "react";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogIn, LogOut, Loader2, Mail, AlertCircle } from "lucide-react";
import Link from "next/link";

export function UserInfo() {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const user = useQuery(
        api.auth.getCurrentUser,
        isAuthenticated ? {} : "skip"
    );

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeAuthTab, setActiveAuthTab] = useState<"signin" | "signup">("signin");

    // Clear errors when switching tabs
    useEffect(() => {
        setError(null);
    }, [activeAuthTab]);

    const handleSignIn = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            const { data, error } = await authClient.signIn.email({
                email,
                password,
            });

            if (error) {
                const errorMsg = error.message || "Sign in failed. Please check your credentials and try again.";
                setError(errorMsg);
                setIsSubmitting(false);
                return;
            }

            // Clear form on success
            setEmail("");
            setPassword("");
            setError(null);
        } catch (err: any) {
            console.error("Sign in error:", err);
            const errorMsg = err?.message || "Sign in failed. Please check your credentials and try again.";
            setError(errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignUp = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            const { data, error } = await authClient.signUp.email({
                email,
                password,
                name,
            });

            if (error) {
                const errorMsg = error.message || "Sign up failed. Please check your information and try again.";
                setError(errorMsg);
                setIsSubmitting(false);
                return;
            }

            // Clear form on success
            setEmail("");
            setPassword("");
            setName("");
            setError(null);
        } catch (err: any) {
            console.error("Sign up error:", err);
            const errorMsg = err?.message || "Sign up failed. Please check your information and try again.";
            setError(errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignOut = async () => {
        await authClient.signOut();
    };

    // Get user initials for avatar
    const getUserInitials = () => {
        if (user?.name) {
            return user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
        }
        if (user?.email) {
            return user.email[0].toUpperCase();
        }
        return "U";
    };

    // Trigger button content
    const getTriggerContent = () => {
        if (isLoading) {
            return (
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-auto min-h-[40px]" disabled>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span className="text-xs">Loading...</span>
                </Button>
            );
        }

        if (!isAuthenticated) {
            return (
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-auto min-h-[40px]">
                    <LogIn className="h-4 w-4 shrink-0" />
                    <span className="text-xs">Sign In</span>
                </Button>
            );
        }

        if (user) {
            return (
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-auto min-h-[40px]">
                    {user.image ? (
                        <img
                            src={user.image}
                            alt={user.name || "User"}
                            className="h-6 w-6 rounded-full shrink-0"
                        />
                    ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium shrink-0">
                            {getUserInitials()}
                        </div>
                    )}
                    <div className="flex flex-1 flex-col items-start overflow-hidden min-h-[32px] justify-center">
                        {user.name && (
                            <span className="truncate text-xs font-medium">{user.name}</span>
                        )}
                        {user.email && (
                            <span className="truncate text-[10px] text-muted-foreground">
                                {user.email}
                            </span>
                        )}
                        {!user.name && !user.email && (
                            <span className="text-xs text-muted-foreground">User</span>
                        )}
                    </div>
                </Button>
            );
        }

        return (
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-auto min-h-[40px]">
                <User className="h-4 w-4 shrink-0" />
                <span className="text-xs">No user data</span>
            </Button>
        );
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>{getTriggerContent()}</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm">
                {isLoading ? (
                    <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="ml-2 text-sm">Loading...</span>
                    </div>
                ) : !isAuthenticated ? (
                    <div className="p-1">
                        <DropdownMenuLabel className="px-2 py-1.5">Account</DropdownMenuLabel>
                        <div className="px-2 pb-2">
                            <div className="flex flex-col gap-2 mb-3">
                                <Button
                                    variant="outline"
                                    className="w-full h-10 sm:h-9 text-sm sm:text-xs touch-manipulation"
                                    disabled={isSubmitting}
                                    onClick={() => authClient.signIn.social({ provider: "google" })}
                                >
                                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                    Continue with Google
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full h-10 sm:h-9 text-sm sm:text-xs touch-manipulation"
                                    disabled={isSubmitting}
                                    onClick={() => authClient.signIn.social({ provider: "github" })}
                                >
                                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                                    Continue with GitHub
                                </Button>
                            </div>
                            <div className="relative mb-3">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-popover px-2 text-muted-foreground">or</span>
                                </div>
                            </div>
                            <Tabs
                                value={activeAuthTab}
                                onValueChange={(value) => setActiveAuthTab(value as "signin" | "signup")}
                                className="w-full"
                            >
                                <TabsList className="grid w-full grid-cols-2 mb-3">
                                    <TabsTrigger value="signin" className="text-xs touch-manipulation">
                                        Sign In
                                    </TabsTrigger>
                                    <TabsTrigger value="signup" className="text-xs touch-manipulation">
                                        Sign Up
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="signin" className="space-y-3 mt-0">
                                    {error && (
                                        <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 p-2 bg-red-500/10 border border-red-500/20 rounded">
                                            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                            <span className="flex-1">{error}</span>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Input
                                            type="email"
                                            placeholder="Email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && email && password && !isSubmitting) {
                                                    handleSignIn();
                                                }
                                            }}
                                            disabled={isSubmitting}
                                            autoComplete="email"
                                            className="h-10 sm:h-9 text-sm sm:text-xs"
                                        />
                                        <Input
                                            type="password"
                                            placeholder="Password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && email && password && !isSubmitting) {
                                                    handleSignIn();
                                                }
                                            }}
                                            disabled={isSubmitting}
                                            autoComplete="current-password"
                                            className="h-10 sm:h-9 text-sm sm:text-xs"
                                        />
                                    </div>
                                    <Button
                                        onClick={handleSignIn}
                                        disabled={isSubmitting || !email || !password}
                                        className="w-full h-10 sm:h-9 text-sm sm:text-xs touch-manipulation"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                Signing in...
                                            </>
                                        ) : (
                                            "Sign In"
                                        )}
                                    </Button>
                                </TabsContent>
                                <TabsContent value="signup" className="space-y-3 mt-0">
                                    {error && (
                                        <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 p-2 bg-red-500/10 border border-red-500/20 rounded">
                                            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                            <span className="flex-1">{error}</span>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Input
                                            type="text"
                                            placeholder="Name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && name && email && password && !isSubmitting) {
                                                    handleSignUp();
                                                }
                                            }}
                                            disabled={isSubmitting}
                                            autoComplete="name"
                                            className="h-10 sm:h-9 text-sm sm:text-xs"
                                        />
                                        <Input
                                            type="email"
                                            placeholder="Email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && name && email && password && !isSubmitting) {
                                                    handleSignUp();
                                                }
                                            }}
                                            disabled={isSubmitting}
                                            autoComplete="email"
                                            className="h-10 sm:h-9 text-sm sm:text-xs"
                                        />
                                        <Input
                                            type="password"
                                            placeholder="Password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && name && email && password && !isSubmitting) {
                                                    handleSignUp();
                                                }
                                            }}
                                            disabled={isSubmitting}
                                            autoComplete="new-password"
                                            className="h-10 sm:h-9 text-sm sm:text-xs"
                                        />
                                    </div>
                                    <Button
                                        onClick={handleSignUp}
                                        disabled={isSubmitting || !email || !password || !name}
                                        className="w-full h-10 sm:h-9 text-sm sm:text-xs touch-manipulation"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                Signing up...
                                            </>
                                        ) : (
                                            "Sign Up"
                                        )}
                                    </Button>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                ) : user ? (
                    <>
                        <DropdownMenuGroup>
                            <DropdownMenuLabel className="px-2 py-1.5">
                                <div className="flex items-center gap-2">
                                    {user.image ? (
                                        <img
                                            src={user.image}
                                            alt={user.name || "User"}
                                            className="h-8 w-8 rounded-full"
                                        />
                                    ) : (
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                                            {getUserInitials()}
                                        </div>
                                    )}
                                    <div className="flex flex-col overflow-hidden">
                                        {user.name && (
                                            <span className="truncate text-sm font-medium">
                                                {user.name}
                                            </span>
                                        )}
                                        {user.email && (
                                            <span className="truncate text-xs text-muted-foreground">
                                                {user.email}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {user.email && (
                                <DropdownMenuItem disabled className="px-2 py-1.5">
                                    <Mail className="mr-2 h-4 w-4" />
                                    <span className="text-xs">{user.email}</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild className="px-2 py-1.5">
                                <Link href="/privacy" className="text-xs w-full">
                                    Privacy
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="px-2 py-1.5">
                                <Link href="/terms" className="text-xs w-full">
                                    Terms
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={handleSignOut}
                                className="px-2 py-1.5 text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                <span className="text-xs">Sign Out</span>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </>
                ) : (
                    <div className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                            Authenticated but no user data
                        </p>
                        <Button
                            onClick={handleSignOut}
                            variant="outline"
                            size="sm"
                            className="mt-3"
                        >
                            <LogOut className="mr-2 h-3 w-3" />
                            Sign Out
                        </Button>
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

