"use client";

import { useState } from "react";
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
import { User, LogIn, LogOut, Loader2, Mail } from "lucide-react";
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

    const handleSignIn = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            await authClient.signIn.email({
                email,
                password,
            });
            // Clear form on success
            setEmail("");
            setPassword("");
        } catch (err: any) {
            setError(err?.message || "Sign in failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignUp = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            await authClient.signUp.email({
                email,
                password,
                name,
            });
            // Clear form on success
            setEmail("");
            setPassword("");
            setName("");
        } catch (err: any) {
            setError(err?.message || "Sign up failed");
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
                            <span className="truncate text-xs font-medium">Kalil</span>

                        )}
                        {user.email && (
                            // 
                            <span className="truncate text-xs font-medium">The Browser Arena</span>
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
            <DropdownMenuContent align="end" className="w-80">
                {isLoading ? (
                    <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="ml-2 text-sm">Loading...</span>
                    </div>
                ) : !isAuthenticated ? (
                    <div className="p-1">
                        <DropdownMenuLabel className="px-2 py-1.5">Account</DropdownMenuLabel>
                        <div className="px-2 pb-2">
                            <Tabs defaultValue="signin" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-3">
                                    <TabsTrigger value="signin" className="text-xs">
                                        Sign In
                                    </TabsTrigger>
                                    <TabsTrigger value="signup" className="text-xs">
                                        Sign Up
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="signin" className="space-y-3 mt-0">
                                    {error && (
                                        <div className="text-xs text-red-600 dark:text-red-400 p-2 bg-red-500/10 rounded">
                                            {error}
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Input
                                            type="email"
                                            placeholder="Email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="h-9 text-xs"
                                        />
                                        <Input
                                            type="password"
                                            placeholder="Password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="h-9 text-xs"
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && email && password) {
                                                    handleSignIn();
                                                }
                                            }}
                                        />
                                    </div>
                                    <Button
                                        onClick={handleSignIn}
                                        disabled={isSubmitting || !email || !password}
                                        className="w-full h-9 text-xs"
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
                                        <div className="text-xs text-red-600 dark:text-red-400 p-2 bg-red-500/10 rounded">
                                            {error}
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Input
                                            type="text"
                                            placeholder="Name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="h-9 text-xs"
                                        />
                                        <Input
                                            type="email"
                                            placeholder="Email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="h-9 text-xs"
                                        />
                                        <Input
                                            type="password"
                                            placeholder="Password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="h-9 text-xs"
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && email && password && name) {
                                                    handleSignUp();
                                                }
                                            }}
                                        />
                                    </div>
                                    <Button
                                        onClick={handleSignUp}
                                        disabled={isSubmitting || !email || !password || !name}
                                        className="w-full h-9 text-xs"
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

