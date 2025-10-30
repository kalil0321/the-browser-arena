import { ChatInput } from "@/components/chat-input";
import { AnimatedHeadline } from "@/components/animated-headline";
import { IconFull } from "@/components/logo";
import { SidebarInset } from "@/components/ui/sidebar";

export default function Home() {
  return (
    <SidebarInset className="flex flex-1 flex-col items-center justify-center overflow-hidden bg-[url('/bg.jpeg')] bg-cover bg-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-1 px-6 py-12 text-center md:px-12 md:py-16">
        <IconFull dark={false} width={160} height={100} />
        {/* <AnimatedHeadline
          phrases={["Compare agents", "Automate your tasks", "Coordinate workflows"]}
          className="text-2xl font-bold text-foreground font-default"
        /> */}
        <div className="w-full max-w-2xl">
          <ChatInput />
        </div>
      </div>
    </SidebarInset>
  );
}
