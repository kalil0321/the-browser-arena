import { cn } from "@/lib/utils";

export interface StagehandLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> { }

export function StagehandLogo({ className, ...props }: StagehandLogoProps) {
    return (
        <img
            src="/stagehand.png"
            alt="Stagehand"
            className={cn("", className)}
            {...props}
        />
    );
}

