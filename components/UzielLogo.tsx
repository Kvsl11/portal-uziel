
import React from 'react';

interface UzielLogoProps {
  className?: string;
}

const UzielLogo: React.FC<UzielLogoProps> = ({ className = "w-10 h-10" }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <line x1="50" y1="5" x2="50" y2="95" stroke="#29aae2" strokeWidth="8" strokeLinecap="round" />
      <line x1="25" y1="28" x2="75" y2="28" stroke="#29aae2" strokeWidth="8" strokeLinecap="round" />
      <line x1="35" y1="45" x2="35" y2="85" stroke="#29aae2" strokeWidth="8" strokeLinecap="round" />
      <line x1="20" y1="55" x2="20" y2="75" stroke="#29aae2" strokeWidth="8" strokeLinecap="round" />
      <line x1="65" y1="45" x2="65" y2="85" stroke="#29aae2" strokeWidth="8" strokeLinecap="round" />
      <line x1="80" y1="55" x2="80" y2="75" stroke="#29aae2" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
};

export default UzielLogo;
