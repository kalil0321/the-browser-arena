import { ChatInput } from "@/components/chat-input";
import { JungleTree } from "@/components/jungle/jungle-tree";
import { TarzanLeaves } from "@/components/jungle/tarzan-leaves";
import { IconFull } from "@/components/logo";
import { SidebarInset } from "@/components/ui/sidebar";

export default function Home() {
    return (
        <SidebarInset className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-transparent">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-900/95 to-green-950" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(74,222,128,0.18),transparent_60%)] mix-blend-screen" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_75%,rgba(16,185,129,0.22),transparent_55%)] mix-blend-screen" />
                <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(4,120,87,0.22),rgba(4,47,46,0.35))]" />
                <JungleTree className="absolute -left-24 bottom-[-96px] w-[320px] opacity-75 md:w-[360px]" />
                <TarzanLeaves className="absolute -right-28 -top-28 w-[340px] rotate-6 opacity-85 md:w-[380px]" />
                <TarzanLeaves className="absolute left-1/3 top-20 w-[240px] -rotate-12 opacity-45 blur-[1px]" />
                <TarzanLeaves className="absolute -left-12 top-[48%] w-[260px] rotate-[18deg] opacity-35 blur-sm" />
            </div>

            <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-4 px-6 py-12 text-center md:px-12 md:py-16">
                <IconFull dark={false} width={160} height={100} />
                <div className="w-full max-w-2xl">
                    <ChatInput />
                </div>
            </div>
        </SidebarInset>
    );
}
