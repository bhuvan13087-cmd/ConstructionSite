import React from "react";

export default function CivilEngineerLogo({ size = 24, className = "", style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 64 64" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      style={style}
    >
      {/* Blueprint Circle Backdrop */}
      <circle cx="32" cy="32" r="30" fill="var(--accent-50, #f0f9ff)" stroke="var(--accent-100, #e0f2fe)" strokeWidth="1.5" />
      
      {/* Blueprint Grid Lines */}
      <path d="M14 32H50M32 14V50" stroke="var(--accent-200, #bae6fd)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
      
      {/* Drafting Triangle / Architect Scale / Blueprint concept */}
      <path d="M16 46L32 18L48 46H16Z" stroke="var(--accent-600, #0284c7)" strokeWidth="2" strokeLinejoin="round" fill="rgba(14, 165, 233, 0.05)" />
      
      {/* Engineer Head & Shoulders (wearing safety helmet) */}
      {/* Shoulders */}
      <path d="M20 50C20 44.4772 25.3726 40 32 40C38.6274 40 44 44.4772 44 50" fill="#334155" />
      
      {/* Neck */}
      <rect x="29" y="37" width="6" height="5" rx="1" fill="#fdbaf8" style={{ fill: "#ffedd5" }} />
      
      {/* Face */}
      <circle cx="32" cy="32" r="7" fill="#ffedd5" />
      
      {/* Safety Helmet / Hard Hat */}
      {/* Dome */}
      <path d="M24 28C24 21.3726 27.5817 18 32 18C36.4183 18 40 21.3726 40 28H24Z" fill="var(--warning-500, #f59e0b)" />
      {/* Brim */}
      <path d="M21 28C21 27.4477 21.4477 27 22 27H42C42.5523 27 43 27.4477 43 28C43 28.5523 42.5523 29 42 29H22C21.4477 29 21 28.5523 21 28Z" fill="var(--warning-500, #f59e0b)" />
      {/* Helmet Crest/Rib */}
      <path d="M30.5 18H33.5V24H30.5V18Z" fill="#d97706" />
    </svg>
  );
}
