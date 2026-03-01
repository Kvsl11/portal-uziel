
import React from 'react';

type Variant = 'default' | 'holy' | 'music' | 'golden' | 'dark';

interface PremiumBackgroundProps {
  variant?: Variant;
  className?: string;
}

const PremiumBackground: React.FC<PremiumBackgroundProps> = ({ variant = 'default', className = '' }) => {
  
  // Cores mais vivas e profundas para evitar o "preto chapado"
  const getGradientClasses = () => {
    switch (variant) {
      case 'holy': // Login / Rota (Azul Profundo / Ciano / Violeta)
        return 'bg-gradient-to-br from-[#0c4a6e] via-[#1e1b4b] to-[#0f172a]'; // Sky-900 -> Indigo-950 -> Slate-900
      case 'music': // Playlists (Roxo Profundo / Rosa / Azul)
        return 'bg-gradient-to-br from-[#4c1d95] via-[#831843] to-[#1e1b4b]'; // Violet-900 -> Pink-900 -> Indigo-950
      case 'golden': // Repertório (Agora AZUL PROFUNDO conforme solicitado)
        return 'bg-gradient-to-br from-[#082f49] via-[#0369a1] to-[#172554]'; // Sky-950 -> Sky-700 -> Blue-950
      case 'dark': // Neutro (Slate rico)
        return 'bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-[#020617]';
      default: // Home (Brand Blue / Deep Ocean)
        return 'bg-gradient-to-br from-[#075985] via-[#1e3a8a] to-[#0f172a]'; // Sky-800 -> Blue-900 -> Slate-900
    }
  };

  // Cores dos orbes flutuantes para dar vida
  const getOrbColors = () => {
    switch (variant) {
      case 'music': return ['bg-pink-500', 'bg-purple-600'];
      case 'golden': return ['bg-brand-500', 'bg-cyan-400']; // Azul vibrante e Ciano
      case 'holy': return ['bg-cyan-500', 'bg-brand-600'];
      default: return ['bg-brand-500', 'bg-blue-600'];
    }
  };

  const orbs = getOrbColors();

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {/* 1. Base Gradient Layer (Moving) */}
      <div className={`absolute inset-0 ${getGradientClasses()} animate-gradient-x bg-[length:400%_400%] opacity-90`}></div>

      {/* 2. Floating Animated Orbs (Glow Effects) */}
      <div className={`absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-float ${orbs[0]}`}></div>
      <div className={`absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-pulse-slow ${orbs[1]}`}></div>

      {/* 3. Noise Texture Removed */}
      
      {/* 4. Diagonal Shimmer (Brilho suave passando) */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-20 transform -translate-x-full animate-shimmer"></div>

      {/* 5. Vignette (Escurece as bordas para foco no centro) */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/60"></div>
    </div>
  );
};

export default PremiumBackground;
