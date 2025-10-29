import { useId } from "react";

import { cn } from "@/lib/utils";

type TarzanLeavesProps = React.SVGProps<SVGSVGElement>;

export function TarzanLeaves({ className, ...props }: TarzanLeavesProps) {
    const id = useId();
    const leafGradient1 = `${id}-leaf1`;
    const leafGradient2 = `${id}-leaf2`;
    const leafGradient3 = `${id}-leaf3`;
    const stemGradient = `${id}-stem`;
    const veinGradient = `${id}-vein`;
    const shadowGradient = `${id}-shadow`;

    return (
        <svg
            viewBox="0 0 280 200"
            role="img"
            aria-hidden="true"
            className={cn("text-emerald-400 drop-shadow-[0_15px_40px_rgba(5,122,85,0.4)]", className)}
            {...props}
        >
            <defs>
                <linearGradient id={leafGradient1} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6ee7b7" />
                    <stop offset="25%" stopColor="#34d399" />
                    <stop offset="60%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#047857" />
                </linearGradient>
                <linearGradient id={leafGradient2} x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#5eead4" />
                    <stop offset="30%" stopColor="#2dd4bf" />
                    <stop offset="70%" stopColor="#14b8a6" />
                    <stop offset="100%" stopColor="#0f766e" />
                </linearGradient>
                <linearGradient id={leafGradient3} x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor="#86efac" />
                    <stop offset="50%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#15803d" />
                </linearGradient>
                <linearGradient id={stemGradient} x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor="#059669" />
                    <stop offset="50%" stopColor="#047857" />
                    <stop offset="100%" stopColor="#064e3b" />
                </linearGradient>
                <linearGradient id={veinGradient} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(6,78,59,0.6)" />
                    <stop offset="50%" stopColor="rgba(4,120,87,0.4)" />
                    <stop offset="100%" stopColor="rgba(6,78,59,0.6)" />
                </linearGradient>
                <radialGradient id={shadowGradient} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(0,0,0,0)" />
                    <stop offset="70%" stopColor="rgba(0,0,0,0.15)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
                </radialGradient>
            </defs>

            {/* Main central stem */}
            <path
                d="M140 5 Q138 50 135 90 Q133 130 128 165"
                stroke={`url(#${stemGradient})`}
                strokeWidth="7"
                strokeLinecap="round"
                fill="none"
                opacity="0.95"
            />

            {/* Large right leaf */}
            <g>
                <ellipse
                    cx="200"
                    cy="55"
                    rx="65"
                    ry="38"
                    fill={`url(#${shadowGradient})`}
                    transform="rotate(15 200 55)"
                />
                <path
                    d="M140 30 Q165 28 190 32 Q215 36 235 45 Q255 54 260 65 Q262 72 258 78 Q250 88 230 95 Q205 104 180 108 Q160 111 145 108 Q138 106 136 100 Q134 92 138 82 Q142 68 140 30 Z"
                    fill={`url(#${leafGradient1})`}
                    opacity="0.92"
                />
                <path
                    d="M145 40 Q170 75 220 85"
                    stroke={`url(#${veinGradient})`}
                    strokeWidth="2"
                    fill="none"
                    opacity="0.5"
                />
                <path
                    d="M148 55 Q175 80 210 88"
                    stroke={`url(#${veinGradient})`}
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.4"
                />
            </g>

            {/* Large left leaf */}
            <g>
                <ellipse
                    cx="65"
                    cy="95"
                    rx="58"
                    ry="42"
                    fill={`url(#${shadowGradient})`}
                    transform="rotate(-25 65 95)"
                />
                <path
                    d="M135 65 Q110 70 85 78 Q60 86 40 98 Q25 108 20 118 Q18 125 22 132 Q28 142 45 148 Q65 155 85 157 Q105 159 120 155 Q128 153 132 147 Q136 138 134 125 Q132 105 135 65 Z"
                    fill={`url(#${leafGradient2})`}
                    opacity="0.88"
                />
                <path
                    d="M130 80 Q100 105 50 125"
                    stroke={`url(#${veinGradient})`}
                    strokeWidth="2"
                    fill="none"
                    opacity="0.5"
                />
                <path
                    d="M128 95 Q105 115 65 130"
                    stroke={`url(#${veinGradient})`}
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.4"
                />
            </g>

            {/* Medium top-right leaf */}
            <g>
                <ellipse
                    cx="185"
                    cy="25"
                    rx="45"
                    ry="28"
                    fill={`url(#${shadowGradient})`}
                    transform="rotate(25 185 25)"
                />
                <path
                    d="M138 15 Q155 12 172 15 Q188 18 200 25 Q210 32 212 40 Q213 45 210 49 Q205 55 192 58 Q175 62 160 62 Q148 61 142 57 Q138 54 137 48 Q136 40 138 30 Q138 22 138 15 Z"
                    fill={`url(#${leafGradient3})`}
                    opacity="0.85"
                />
                <path
                    d="M142 22 Q165 35 195 42"
                    stroke={`url(#${veinGradient})`}
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.45"
                />
            </g>

            {/* Small bottom leaf */}
            <g>
                <ellipse
                    cx="95"
                    cy="155"
                    rx="38"
                    ry="25"
                    fill={`url(#${shadowGradient})`}
                    transform="rotate(-35 95 155)"
                />
                <path
                    d="M130 140 Q115 143 100 148 Q85 153 75 160 Q68 166 68 172 Q68 177 72 181 Q78 186 90 188 Q105 190 118 187 Q126 185 130 180 Q133 175 132 168 Q131 158 130 140 Z"
                    fill={`url(#${leafGradient1})`}
                    opacity="0.8"
                />
                <path
                    d="M128 150 Q110 165 80 175"
                    stroke={`url(#${veinGradient})`}
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.4"
                />
            </g>

            {/* Secondary stems */}
            <path
                d="M140 30 Q165 35 200 48"
                stroke={`url(#${stemGradient})`}
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
                opacity="0.7"
            />
            <path
                d="M135 65 Q105 80 65 105"
                stroke={`url(#${stemGradient})`}
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
                opacity="0.7"
            />
            <path
                d="M138 15 Q160 18 185 28"
                stroke={`url(#${stemGradient})`}
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                opacity="0.65"
            />
            <path
                d="M130 140 Q115 150 90 165"
                stroke={`url(#${stemGradient})`}
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                opacity="0.65"
            />
        </svg>
    );
}
