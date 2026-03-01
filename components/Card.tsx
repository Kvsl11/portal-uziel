
import React, { useRef, useState } from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  hover?: boolean;
  variant?: 'default' | 'gradient' | 'glass' | 'outline' | 'tech' | 'custom';
  noPadding?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hover = true,
  variant = 'default',
  noPadding = false,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [transform, setTransform] = useState('');
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current || !hover) return;
    
    const rect = divRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setPosition({ x, y });

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Rotation Strength (Degrees) - Adjusted for premium feel
    const rotateX = ((y - centerY) / centerY) * -4; // Negative to tilt towards mouse vertically
    const rotateY = ((x - centerX) / centerX) * 4;  // Positive to tilt towards mouse horizontally

    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`);
  };

  const handleMouseEnter = () => {
      if(hover) setIsHovering(true);
  };

  const handleMouseLeave = () => {
      if(hover) {
          setIsHovering(false);
          // Reset to flat position smoothly
          setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
      }
  };

  // Variants Mapping
  const variants = {
    default: "bg-white dark:bg-[#0f172a] shadow-premium dark:shadow-premium-dark border border-slate-100 dark:border-white/5",
    tech: "bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/5 shadow-lg",
    gradient: "bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-glow", 
    glass: "glass-panel shadow-xl",
    outline: "bg-transparent border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-brand-500 text-slate-400",
    custom: "" // Allows full control via className
  };

  const paddingStyles = noPadding ? "" : "p-6 md:p-8";

  return (
    <div 
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ 
          transform: isHovering ? transform : undefined,
          // Instant transform during hover for responsiveness, smooth transition for rest
          transition: isHovering ? 'none' : 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
          willChange: 'transform'
      }}
      className={`
        relative rounded-[2rem] overflow-hidden
        ${variants[variant]} 
        ${hover ? 'cursor-pointer z-0 md:hover:z-10' : ''}
        ${className}
      `}
    >
      {/* Spotlight / Glow Effect */}
      {hover && (
        <div
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"
          style={{
            background: `radial-gradient(800px circle at ${position.x}px ${position.y}px, rgba(255, 255, 255, 0.08), transparent 40%)`,
            mixBlendMode: 'overlay'
          }}
        />
      )}

      {/* Content Wrapper */}
      <div className={`relative z-[3] h-full ${paddingStyles}`}>
        {children}
      </div>
    </div>
  );
};

export default Card;
