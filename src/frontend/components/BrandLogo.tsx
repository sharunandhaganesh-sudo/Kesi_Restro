/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BrandLogo — Displays the official Treat & Taste Family Restaurant logo
 * from central BRAND_CONFIG across all headers, login screens, receipts, and standees.
 */

import React from 'react';
import { BRAND_CONFIG } from '../../config/branding';

export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'badge';
  light?: boolean;
  className?: string;
  onClick?: () => void;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  variant = 'full',
  light = false,
  className = '',
  onClick,
}) => {
  const iconDimensions = {
    sm: 'w-8 h-8',
    md: 'w-8 h-8 sm:w-10 sm:h-10',
    lg: 'w-10 h-10 sm:w-14 sm:h-14',
    xl: 'w-14 h-14 sm:w-20 sm:h-20',
  }[size];

  const titleSizes = {
    sm: 'text-xs sm:text-sm font-bold tracking-tight',
    md: 'text-sm sm:text-base lg:text-lg font-extrabold tracking-tight',
    lg: 'text-lg sm:text-xl lg:text-2xl font-extrabold tracking-tight',
    xl: 'text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight',
  }[size];

  const subtitleSizes = {
    sm: 'text-[8px] sm:text-[9px] tracking-widest',
    md: 'text-[8px] sm:text-[10px] tracking-widest',
    lg: 'text-[10px] sm:text-xs tracking-widest',
    xl: 'text-xs sm:text-sm tracking-widest',
  }[size];

  const titleColor = light ? 'text-[#FFF9F0]' : 'text-[#3B1A08]';
  const subtitleColor = light ? 'text-[#F4B41A]' : 'text-[#F56A00]';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center space-x-2.5 select-none ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
    >
      <div
        className={`${iconDimensions} rounded-2xl bg-white border border-[#E6D5C3] p-0.5 flex items-center justify-center shrink-0 shadow-xs transition-transform duration-200 group-hover:scale-105 overflow-hidden`}
      >
        <img
          src={BRAND_CONFIG.logoUrl}
          alt={BRAND_CONFIG.fullName}
          className="w-full h-full object-contain rounded-xl"
        />
      </div>

      {variant !== 'icon' && (
        <div className="flex flex-col leading-none">
          <span className={`${titleSizes} ${titleColor}`}>
            Treat <span className="text-[#F56A00]">&amp;</span> Taste
          </span>
          <span className={`${subtitleSizes} uppercase font-bold mt-0.5 ${subtitleColor}`}>
            {BRAND_CONFIG.subtitle}
          </span>
        </div>
      )}
    </div>
  );
};
