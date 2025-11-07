import { cn } from "@/lib/utils";
import Image from "next/image";

export interface MoonshotLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
}

export function MoonshotLogo({ className, ...props }: MoonshotLogoProps) {
  return (
    <Image
      src="/moonshot.png"
      alt="Moonshot AI"
      width={16}
      height={16}
      className={cn("", className)}
      {...props}
    />
  );
}

