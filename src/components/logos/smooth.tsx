import { cn } from "@/lib/utils";

export interface SmoothLogoProps extends React.SVGProps<SVGSVGElement> { }

export function SmoothLogo({ className, ...props }: SmoothLogoProps) {
    return (
        <svg
            viewBox="0 0 471 333"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("", className)}
            {...props}
        >
            <defs>
                <pattern
                    id="smooth-gradient-pattern"
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    patternUnits="userSpaceOnUse"
                >
                    <image
                        href="https://www.circlemind.co/blue-gradient-bg.gif"
                        x="0"
                        y="0"
                        width="471"
                        height="333"
                        preserveAspectRatio="xMidYMid slice"
                    />
                </pattern>
                <mask id="smooth-logo-mask">
                    <path
                        d="M471 333H466.768C402.098 302.849 321.884 285 235 285C148.116 285 67.9019 302.849 3.23242 333H0V0.475586C65.2201 31.5477 146.662 50 235 50C323.789 50 405.612 31.3601 470.998 0H471V333Z"
                        fill="white"
                    />
                </mask>
            </defs>
            <rect
                width="471"
                height="333"
                fill="url(#smooth-gradient-pattern)"
                mask="url(#smooth-logo-mask)"
            />
        </svg>
    );
}

