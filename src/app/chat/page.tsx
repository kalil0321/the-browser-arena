"use client";

import { useState } from "react";

export default function ChatPage() {
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

  const handleNewChat = () => {
    console.log("Starting new chat");
    // TODO: Implement new chat logic
  };

  const handleSearch = () => {
    console.log("Opening search");
    // TODO: Implement search logic
  };

  const handleMicToggle = () => {
    setIsRecording((prev) => !prev);
    console.log("Microphone toggled:", !isRecording);
    // TODO: Implement microphone recording logic
  };

  const handleAudioToggle = () => {
    setIsAudioEnabled((prev) => !prev);
    console.log("Audio toggled:", !isAudioEnabled);
    // TODO: Implement audio playback logic
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="bg-muted/50 backdrop-blur-sm rounded-3xl w-full space-y-3 px-6 py-5 shadow-lg border border-border/50">
          <form 
            onSubmit={handleSubmit}
            className="relative mx-auto overflow-hidden transition duration-200 dark:bg-zinc-800/50 mb-4 h-14 w-full max-w-full bg-transparent shadow-sm rounded-2xl border border-border/30"
          >
            <canvas 
              className="pointer-events-none absolute -left-2 top-2 origin-top-left scale-50 transform pr-20 text-base invert filter dark:invert-0 opacity-0" 
              width="800" 
              height="800"
            />
            <input 
              placeholder="How can I help you today?" 
              type="text" 
              className="sm:text relative z-50 h-full w-full border-none bg-transparent pr-20 pl-4 text-sm tracking-tight text-foreground focus:outline-none focus:ring-0 placeholder:text-muted-foreground" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button 
              type="submit" 
              disabled={!input.trim()}
              className="absolute right-2 top-1/2 z-50 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-primary transition-all duration-200 hover:scale-105 disabled:bg-muted disabled:opacity-50 dark:bg-primary"
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
                className="h-4 w-4 text-primary-foreground"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M5 12l14 0" strokeDasharray="50%" strokeDashoffset="50%" />
                <path d="M13 18l6 -6" />
                <path d="M13 6l6 6" />
              </svg>
            </button>
          </form>
          
          <div className="flex h-12 w-full items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleNewChat}
                className="cursor-pointer p-2 rounded-lg hover:bg-accent transition-colors"
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
                  className="lucide lucide-plus size-5 text-muted-foreground" 
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
              </button>
              <button
                onClick={handleSearch}
                className="flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm bg-accent/50 text-accent-foreground hover:bg-accent transition-colors border border-border/30"
                aria-label="Search"
              >
                <span style={{ transform: 'rotate(90deg)' }}>
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
                    className="lucide lucide-globe size-4" 
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                    <path d="M2 12h20" />
                  </svg>
                </span>
                Search
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleMicToggle}
                className={`cursor-pointer p-2 rounded-lg transition-all ${isRecording ? 'text-destructive bg-destructive/10' : 'hover:bg-accent text-muted-foreground'}`}
                aria-label="Toggle microphone"
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
                  className="lucide lucide-mic size-5" 
                  aria-hidden="true"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </button>
              <button
                onClick={handleAudioToggle}
                className={`flex size-9 cursor-pointer items-center justify-center rounded-lg text-sm transition-all ${isAudioEnabled ? 'bg-accent text-accent-foreground' : 'hover:bg-accent text-muted-foreground'}`}
                aria-label="Toggle audio"
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
                  className="lucide lucide-audio-lines size-5" 
                  aria-hidden="true"
                >
                  <path d="M2 10v3" />
                  <path d="M6 6v11" />
                  <path d="M10 3v18" />
                  <path d="M14 8v7" />
                  <path d="M18 5v13" />
                  <path d="M22 10v3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}