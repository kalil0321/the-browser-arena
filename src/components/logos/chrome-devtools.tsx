import { cn } from "@/lib/utils";

export interface ChromeDevtoolsLogoProps extends React.SVGProps<SVGSVGElement> {}

export function ChromeDevtoolsLogo({ className, ...props }: ChromeDevtoolsLogoProps) {
  return (
    <svg
      viewBox="0 0 2560 2560"
      fill="#1a73e8"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("", className)}
      {...props}
    >
      <title>Chrome DevTools</title>
      <rect width="2560" height="2560" rx="560"/>
      <g fill="none" strokeWidth="30" stroke="#fff">
        <path d="M1280 2274a994 994 0 1 0 0-1988 994 994 0 0 0 0 1988z"/>
        <path d="M1280 1785a505 505 0 1 0 0-1010 505 505 0 0 0 0 1010z"/>
        <path d="M1280 1676a396 396 0 1 0 0-792 396 396 0 0 0 0 792zm437-143l-427 740m-448-740L415 793m865-18h855"/>
      </g>
    </svg>
  );
}
