/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SavorLogo - Apple-inspired premium culinary brand identity component
 * Vector SVG emblem with cloche, stylized monogram, and refined typography.
 */

import React from 'react';

export interface SavorLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'badge';
  light?: boolean;
  className?: string;
  onClick?: () => void;
}

export const SavorLogo: React.FC<SavorLogoProps> = ({
  size = 'md',
  variant = 'full',
  light = false,
  className = '',
  onClick,
}) => {
  // Dimensions per size
  const iconDimensions = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }[size];

  const titleSizes = {
    sm: 'text-sm font-bold tracking-tight',
    md: 'text-lg font-bold tracking-tight',
    lg: 'text-2xl font-bold tracking-tight',
    xl: 'text-3xl font-extrabold tracking-tight',
  }[size];

  const subtitleSizes = {
    sm: 'text-[9px] tracking-wider',
    md: 'text-[10px] tracking-wider',
    lg: 'text-xs tracking-wider',
    xl: 'text-sm tracking-widest',
  }[size];

  const textColor = light ? 'text-white' : 'text-[#1D1D1F]';
  const subtextColor = light ? 'text-white/70' : 'text-[#6E6E73]';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center space-x-2.5 select-none ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
    >
      {/* Refined Vector Emblem */}
      <div
        className={`${iconDimensions} rounded-2xl relative flex items-center justify-center shrink-0 shadow-xs transition-transform duration-200 group-hover:scale-105 overflow-hidden ${
          light ? 'bg-white text-[#0071E3]' : 'bg-gradient-to-br from-[#0071E3] via-[#0062C4] to-[#004EA8] text-white'
        }`}
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1.5"
        >
          {/* Subtle background glow */}
          <circle cx="24" cy="24" r="20" fill="url(#savor-glow)" opacity="0.15" />

          {/* Cloche / Dining Dome Top Handle */}
          <circle cx="24" cy="11" r="2" fill="currentColor" />

          {/* Cloche Dome Arc */}
          <path
            d="M11 25C11 17.8203 16.8203 12 24 12C31.1797 12 37 17.8203 37 25"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Cloche Serving Platter Rim */}
          <path
            d="M8 28.5C8 27.6716 8.67157 27 9.5 27H38.5C39.3284 27 40 27.6716 40 28.5C40 29.3284 39.3284 30 38.5 30H9.5C8.67157 30 8 29.3284 8 28.5Z"
            fill="currentColor"
          />

          {/* Elegant Monogram 'S' within Serving Platter */}
          <path
            d="M27.5 17.5C26.5 16.5 25.2 16 23.8 16C21.1 16 19.5 17.6 19.5 19.5C19.5 23 28.5 21.5 28.5 25.5C28.5 27.8 26.5 29.5 23.8 29.5C21.8 29.5 20.2 28.6 19.2 27.2"
            stroke={light ? '#0071E3' : '#FFD782'}
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Dining Sparkle / Star accent */}
          <path
            d="M24 33L24.8 35.2L27 36L24.8 36.8L24 39L23.2 36.8L21 36L23.2 35.2L24 33Z"
            fill={light ? '#0071E3' : '#FFD782'}
            opacity="0.9"
          />

          {/* Gradient definitions */}
          <defs>
            <radialGradient
              id="savor-glow"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(24 24) rotate(90) scale(20)"
            >
              <stop stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* Typography for Full and Badge Variants */}
      {variant !== 'icon' && (
        <div className="flex flex-col">
          <div className="flex items-center space-x-1.5 leading-none">
            <span className={`${titleSizes} ${textColor} font-semibold font-sans`}>
              SAVOR
            </span>
            {variant === 'badge' && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#0071E3]/10 text-[#0071E3] uppercase tracking-wide">
                Smart Restro
              </span>
            )}
          </div>
          <span className={`${subtitleSizes} ${subtextColor} uppercase font-medium mt-0.5`}>
            Dine-In & Queue System
          </span>
        </div>
      )}
    </div>
  );
};
