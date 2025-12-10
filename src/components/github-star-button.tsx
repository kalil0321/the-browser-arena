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
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 group-hover:scale-110 transition-transform duration-300" />
        <span className="font-semibold">Star on GitHub</span>
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-yellow-400/10 to-orange-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </Button>
  );
}
