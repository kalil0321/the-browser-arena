"use client";

import { useState } from "react";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
        } catch (err: any) {
            setError(err?.message || "Sign up failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="px-2 py-2 space-y-2">
            <div className="text-xs font-semibold text-green-300">
                Auth Status
            </div>
            <div className="space-y-1 text-xs text-gray-400">
                {isLoading ? (
                    <div className="text-yellow-400">Loading...</div>
                ) : !isAuthenticated ? (
                    <div className="space-y-3">
                        <Tabs defaultValue="signin" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="signin">Sign In</TabsTrigger>
                                <TabsTrigger value="signup">Sign Up</TabsTrigger>
                            </TabsList>
                            <TabsContent value="signin" className="space-y-3 mt-3">
                                {error && (
                                    <div className="text-red-400 text-[10px] p-2 bg-red-500/10 rounded">
                                        {error}
                                    </div>
                                )}
                                <Input
                                    type="email"
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full h-8 text-xs"
                                />
                                <Input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-8 text-xs"
                                />
                                <Button
                                    onClick={handleSignIn}
                                    disabled={isSubmitting || !email || !password}
                                    className="w-full h-8 text-xs"
                                >
                                    {isSubmitting ? "Signing in..." : "Sign In"}
                                </Button>
                                <div className="text-center text-[10px] text-gray-500">
                                    or
                                </div>
                                <Button
                                    onClick={() => authClient.signIn.anonymous()}
                                    variant="outline"
                                    className="w-full h-8 text-xs"
                                >
                                    Continue as Guest
                                </Button>
                            </TabsContent>
                            <TabsContent value="signup" className="space-y-3 mt-3">
                                {error && (
                                    <div className="text-red-400 text-[10px] p-2 bg-red-500/10 rounded">
                                        {error}
                                    </div>
                                )}
                                <Input
                                    type="text"
                                    placeholder="Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full h-8 text-xs"
                                />
                                <Input
                                    type="email"
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full h-8 text-xs"
                                />
                                <Input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-8 text-xs"
                                />
                                <Button
                                    onClick={handleSignUp}
                                    disabled={isSubmitting || !email || !password || !name}
                                    className="w-full h-8 text-xs"
                                >
                                    {isSubmitting ? "Signing up..." : "Sign Up"}
                                </Button>
                            </TabsContent>
                        </Tabs>
                    </div>
                ) : user === null ? (
                    <div className="text-orange-400">Authenticated but no user data</div>
                ) : (
                    <>
                        <div className="truncate">
                            <span className="text-gray-500">ID:</span>{" "}
                            <span className="text-green-200 font-mono text-[10px]">
                                {user?._id}
                            </span>
                        </div>
                        {user?.name && (
                            <div className="truncate">
                                <span className="text-gray-500">Name:</span>{" "}
                                <span className="text-green-200">{user.name}</span>
                            </div>
                        )}
                        {user?.email && (
                            <div className="truncate">
                                <span className="text-gray-500">Email:</span>{" "}
                                <span className="text-green-200 text-[10px]">{user?.email}</span>
                            </div>
                        )}
                        {user?.image && (
                            <div className="truncate">
                                <span className="text-gray-500">Image:</span>{" "}
                                <span className="text-green-200 text-[10px]">{user?.image}</span>
                            </div>
                        )}
                        <Button
                            onClick={() => authClient.signOut()}
                            variant="outline"
                            className="w-full h-8 text-xs mt-3"
                        >
                            Sign Out
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}

