import { Sidebar } from "@/components/sidebar";
import { ChatInterface } from "@/components/chat-interface";

export default function Home() {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <Sidebar />
      <main className="flex flex-1 flex-col">
        <ChatInterface />
      </main>
    </div>
  );
}
