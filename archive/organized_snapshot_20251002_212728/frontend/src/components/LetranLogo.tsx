import React, { useState } from 'react';

interface LetranLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const LetranLogo: React.FC<LetranLogoProps> = ({ size = 'md', className = '' }) => {
  const [showFallback, setShowFallback] = useState(false);
  
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  // Enhanced Letran Knights fallback logo
  const fallbackSVG = (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <defs>
        <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#dc143c" />
          <stop offset="100%" stopColor="#8b0000" />
        </linearGradient>
      </defs>
      {/* Shield Shape */}
      <path
        d="M50 5 L85 20 L85 45 Q85 70 50 95 Q15 70 15 45 L15 20 Z"
        fill="url(#shieldGradient)"
        stroke="#1e40af"
        strokeWidth="2"
      />
      {/* Knight's Cross */}
      <rect x="46" y="25" width="8" height="25" fill="white" />
      <rect x="35" y="33" width="30" height="8" fill="white" />
      {/* Text */}
      <text x="50" y="70" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">
        LETRAN
      </text>
      <text x="50" y="82" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold">
        KNIGHTS
      </text>
    </svg>
  );

  return (
    <div className={`${sizeClasses[size]} ${className} flex items-center justify-center`}>
      {!showFallback ? (
        <img
          src="/assets/images/letran-knights-logo.png"
          alt="Letran Knights Logo"
          className="w-full h-full object-contain"
          onError={() => setShowFallback(true)}
        />
      ) : (
        fallbackSVG
      )}
    </div>
  );
};

export default LetranLogo;
