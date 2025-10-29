import { useId } from "react";

import { cn } from "@/lib/utils";

type JungleTreeProps = React.SVGProps<SVGSVGElement>;

export function JungleTree({ className, ...props }: JungleTreeProps) {
    const gradientId = useId();
    const canopyGradient = `${gradientId}-canopy`;
    const canopyGradient2 = `${gradientId}-canopy2`;
    const trunkGradient = `${gradientId}-trunk`;
    const highlightGradient = `${gradientId}-highlight`;
    const shadowGradient = `${gradientId}-shadow`;
    const leafGradient = `${gradientId}-leaf`;

    return (
        <svg
            viewBox="0 0 220 320"
            role="img"
            aria-hidden="true"
            className={cn("text-emerald-500 drop-shadow-[0_15px_50px_rgba(6,95,70,0.5)]", className)}
            {...props}
        >
            <defs>
                <linearGradient id={canopyGradient} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1a5c3e" />
                    <stop offset="30%" stopColor="#0f5132" />
                    <stop offset="70%" stopColor="#064e3b" />
                    <stop offset="100%" stopColor="#042f1f" />
                </linearGradient>
                <linearGradient id={canopyGradient2} x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#166534" />
                    <stop offset="50%" stopColor="#14532d" />
                    <stop offset="100%" stopColor="#052e16" />
                </linearGradient>
                <linearGradient id={trunkGradient} x1="30%" y1="0%" x2="70%" y2="100%">
                    <stop offset="0%" stopColor="#92400e" />
                    <stop offset="50%" stopColor="#78350f" />
                    <stop offset="100%" stopColor="#451a03" />
                </linearGradient>
                <radialGradient id={highlightGradient} cx="45%" cy="30%" r="55%">
                    <stop offset="0%" stopColor="rgba(134,239,172,0.5)" />
                    <stop offset="40%" stopColor="rgba(52,211,153,0.3)" />
                    <stop offset="80%" stopColor="rgba(16,185,129,0.15)" />
                    <stop offset="100%" stopColor="rgba(6,95,70,0)" />
                </radialGradient>
                <radialGradient id={shadowGradient} cx="50%" cy="80%" r="60%">
                    <stop offset="0%" stopColor="rgba(0,0,0,0)" />
                    <stop offset="60%" stopColor="rgba(0,0,0,0.3)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
                </radialGradient>
                <linearGradient id={leafGradient} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="50%" stopColor="#16a34a" />
                    <stop offset="100%" stopColor="#15803d" />
                </linearGradient>
            </defs>

            {/* Trunk with more detail */}
            <g opacity="0.95">
                {/* Main trunk */}
                <path
                    d="M110 240 C115 260 120 300 120 320 L100 320 C100 300 105 260 110 240 Z"
                    fill={`url(#${trunkGradient})`}
                />
                {/* Trunk texture lines */}
                <path
                    d="M108 250 C108 270 108 290 108 310"
                    stroke="#5a2a0a"
                    strokeWidth="1"
                    opacity="0.4"
                    fill="none"
                />
                <path
                    d="M112 255 C112 275 112 295 112 315"
                    stroke="#5a2a0a"
                    strokeWidth="0.8"
                    opacity="0.3"
                    fill="none"
                />
                {/* Branch structure */}
                <path
                    d="M112 235 C105 250 92 270 85 300 L70 300 C78 268 92 240 100 224 C102 220 118 220 120 224 C128 240 140 268 150 300 L135 300 C128 270 118 252 112 235 Z"
                    fill={`url(#${trunkGradient})`}
                    opacity="0.75"
                />
            </g>

            {/* Main canopy with layered depth */}
            <g>
                {/* Shadow layer */}
                <ellipse cx="110" cy="160" rx="85" ry="75" fill={`url(#${shadowGradient})`} />
                
                {/* Base canopy shape */}
                <path
                    d="M110 30 C90 20 68 20 50 40 C25 70 45 110 20 140 C10 152 15 170 30 175 C35 240 60 240 75 225 C90 230 120 230 135 225 C150 240 175 240 180 175 C195 170 200 150 190 135 C170 105 195 75 162 40 C140 20 120 20 110 30 Z"
                    fill={`url(#${canopyGradient})`}
                />
                
                {/* Secondary canopy layer for depth */}
                <path
                    d="M110 45 C95 40 75 45 62 60 C45 80 55 110 40 130 C35 138 38 150 48 155 C52 200 70 205 82 195 C92 200 115 200 125 195 C137 205 155 200 159 155 C169 150 172 138 167 130 C155 110 170 85 145 60 C130 45 115 40 110 45 Z"
                    fill={`url(#${canopyGradient2})`}
                    opacity="0.6"
                />
                
                {/* Bottom shadow of canopy */}
                <path
                    d="M60 170 C80 160 90 150 100 150 C110 150 125 160 140 170 C150 176 165 178 170 170 C152 210 135 220 110 220 C85 220 68 212 50 170 C55 178 65 176 75 172 Z"
                    fill="#042f1f"
                    opacity="0.7"
                />
                
                {/* Highlight for volume */}
                <ellipse cx="110" cy="130" rx="75" ry="65" fill={`url(#${highlightGradient})`} />
            </g>

            {/* Detailed leaf clusters */}
            <g opacity="0.5">
                <path
                    d="M40 50 C20 65 15 95 25 110 C30 118 40 122 40 135 C40 148 25 158 18 165 C10 173 24 178 32 168 C40 158 52 145 60 142 C80 134 90 114 90 100 C90 70 60 45 40 50 Z"
                    fill={`url(#${leafGradient})`}
                />
            </g>
            <g opacity="0.4">
                <path
                    d="M100 40 C80 50 65 80 70 100 C74 116 90 125 100 136 C110 147 106 165 95 170 C84 175 88 185 96 183 C104 181 126 160 136 148 C156 124 160 98 150 80 C140 62 120 38 100 40 Z"
                    fill={`url(#${leafGradient})`}
                />
            </g>
            <g opacity="0.35">
                <path
                    d="M150 60 C135 68 128 90 135 108 C140 120 152 126 158 135 C164 144 162 158 154 162 C146 166 149 174 155 172 C161 170 178 154 185 144 C198 126 200 106 193 92 C186 78 165 55 150 60 Z"
                    fill="#059669"
                />
            </g>
            
            {/* Small leaf details */}
            <g opacity="0.3">
                <ellipse cx="70" cy="90" rx="12" ry="18" fill="#22c55e" transform="rotate(-25 70 90)" />
                <ellipse cx="145" cy="85" rx="10" ry="16" fill="#16a34a" transform="rotate(30 145 85)" />
                <ellipse cx="55" cy="125" rx="14" ry="20" fill="#15803d" transform="rotate(-40 55 125)" />
                <ellipse cx="160" cy="120" rx="11" ry="17" fill="#10b981" transform="rotate(35 160 120)" />
            </g>
        </svg>
    );
}
