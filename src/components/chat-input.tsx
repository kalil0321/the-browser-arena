"use client";

import { useState } from "react";

export function ChatInput() {
    const [input, setInput] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [isAudioEnabled, setIsAudioEnabled] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            console.log("Submitting:", input);
            // TODO: Implement chat submission logic
            setInput("");
        }
    };

    const handleSearch = () => {
        console.log("Opening search");
        // TODO: Implement search logic
    };

    return (
        <div className="container mx-auto max-w-3xl px-4">
            <div className="bg-muted rounded-4xl w-full space-y-2 px-6 py-4">
                <form
                    onSubmit={handleSubmit}
                    className="relative mx-auto overflow-hidden transition duration-200 dark:bg-zinc-800 mb-4 h-12 w-full max-w-full bg-transparent shadow-none"
                >
                    <input
                        placeholder="Automate your tasks..."
                        type="text"
                        className="sm:text relative z-50 h-full w-full border-none bg-transparent pr-20 text-sm tracking-tight text-black focus:outline-none focus:ring-0 dark:text-white"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="absolute right-0 top-1/2 z-50 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black transition duration-200 disabled:bg-gray-100 dark:bg-zinc-900 dark:disabled:bg-zinc-800"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4 text-gray-300"
                        >
                            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                            <path d="M5 12l14 0" strokeDasharray="50%" strokeDashoffset="50%" />
                            <path d="M13 18l6 -6" />
                            <path d="M13 6l6 6" />
                        </svg>
                    </button>
                </form>

                <div className="flex h-10 w-full items-center justify-between">
                    {/* <div className="flex items-center gap-4">
                        <button
                            onClick={handleNewChat}
                            className="cursor-pointer"
                            aria-label="New chat"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="lucide lucide-plus size-4"
                                aria-hidden="true"
                            >
                                <path d="M5 12h14" />
                                <path d="M12 5v14" />
                            </svg>
                        </button>
                    </div> */}

                    <div className="flex items-center gap-4">
                    </div>
                </div>
            </div>
        </div>
    );
}