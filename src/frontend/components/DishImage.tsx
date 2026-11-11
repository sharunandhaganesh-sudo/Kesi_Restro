import React, { useState } from 'react';
import { Utensils, Coffee, CakeSlice, Sparkles, Flame, Soup } from 'lucide-react';

interface DishImageProps {
  src?: string;
  alt: string;
  className?: string;
  category?: string;
}

/**
 * Renders an Apple-aesthetic vector illustration based on dish category or keywords
 */
function renderCategoryIllustration(category: string, alt: string) {
  const name = (alt + ' ' + category).toLowerCase();

  if (name.includes('fry') || name.includes('starter') || name.includes('bruschetta')) {
    return (
      <svg className="w-16 h-16 text-[#0071E3]" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="24" width="40" height="32" rx="6" fill="#F5F5F7" stroke="#D2D2D7" strokeWidth="2" />
        <path d="M20 12L24 24" stroke="#0071E3" strokeWidth="3" strokeLinecap="round" />
        <path d="M28 8L30 24" stroke="#B76E00" strokeWidth="3" strokeLinecap="round" />
        <path d="M36 10L36 24" stroke="#0071E3" strokeWidth="3" strokeLinecap="round" />
        <path d="M44 14L42 24" stroke="#B76E00" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="40" r="8" fill="#FFFFFF" stroke="#0071E3" strokeWidth="2" />
      </svg>
    );
  }

  if (name.includes('cake') || name.includes('dessert') || name.includes('tiramisu')) {
    return (
      <svg className="w-16 h-16 text-[#0071E3]" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 44L50 44L44 26L20 26L14 44Z" fill="#F5F5F7" stroke="#D2D2D7" strokeWidth="2" />
        <path d="M10 44C10 41 54 41 54 44L52 52C52 54 12 54 12 52L10 44Z" fill="#FFFFFF" stroke="#D2D2D7" strokeWidth="2" />
        <circle cx="32" cy="18" r="4" fill="#D70015" />
        <path d="M32 14C32 10 35 9 35 9" stroke="#248A3D" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (name.includes('drink') || name.includes('lassi') || name.includes('tonic') || name.includes('beverage') || name.includes('brew')) {
    return (
      <svg className="w-16 h-16 text-[#0071E3]" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 16L24 50C24.5 53 39.5 53 40 50L44 16Z" fill="#F5F5F7" stroke="#D2D2D7" strokeWidth="2" />
        <ellipse cx="32" cy="16" rx="12" ry="3" fill="#FFFFFF" stroke="#D2D2D7" strokeWidth="2" />
        <path d="M36 8L28 32" stroke="#0071E3" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="30" cy="38" r="2" fill="#0A84FF" />
        <circle cx="34" cy="44" r="1.5" fill="#0A84FF" />
      </svg>
    );
  }

  // Mains / Signature
  return (
    <svg className="w-16 h-16 text-[#0071E3]" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="42" rx="24" ry="10" fill="#F5F5F7" stroke="#D2D2D7" strokeWidth="2" />
      <ellipse cx="32" cy="38" rx="18" ry="7" fill="#FFFFFF" stroke="#0071E3" strokeWidth="1.5" />
      <path d="M24 28C24 20 40 20 40 28" stroke="#D2D2D7" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 3" />
      <path d="M28 22C28 16 36 16 36 22" stroke="#B76E00" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * DishImage:
 * Apple-inspired media presentation with zero-shift fallback and vector graphics.
 */
export const DishImage: React.FC<DishImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  category = 'Specialty',
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#F5F5F7] to-[#E5E5EA] text-[#1D1D1F] p-4 text-center select-none relative overflow-hidden ${className}`}
      >
        <div className="mb-2 p-3 rounded-2xl bg-white shadow-xs border border-[#D2D2D7]/60">
          {renderCategoryIllustration(category, alt)}
        </div>
        <span className="text-[11px] font-semibold tracking-wide uppercase text-[#0071E3] block mb-0.5">
          {category}
        </span>
        <span className="text-xs font-semibold text-[#1D1D1F] line-clamp-1 max-w-[90%]">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#F5F5F7]">
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#F5F5F7] animate-pulse">
          <Utensils className="w-5 h-5 text-[#6E6E73]/40" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`${className} transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
