"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GitHubStarButton() {
  const handleClick = () => {
    window.open("https://github.com/kalil0321/the-browser-arena", "_blank");
  };

  return (
    <Button
      onClick={handleClick}
      variant="outline"
      className="group relative overflow-hidden border-2 border-primary/20 bg-background/80 backdrop-blur-sm hover:border-primary/40 hover:bg-primary/5 transition-all duration-300"
    >
      {/* Use a div instead of span and put as first element, ensure GPU acceleration for opacity transition */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-yellow-400/10 to-orange-400/10 transition-opacity duration-300 group-hover:opacity-100 opacity-0 will-change-[opacity]"
        aria-hidden="true"
      />
      <div className="flex items-center gap-2 relative z-10">
        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 group-hover:scale-110 transition-transform duration-300" />
        <span className="font-semibold group-hover:text-white transition-colors duration-300">Star on GitHub</span>
      </div>
    </Button>
  );
}