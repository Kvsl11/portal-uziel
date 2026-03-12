
import React from 'react';
import { createPortal } from 'react-dom';
import UzielLogo from './UzielLogo';

interface LoadingProps {
  fullScreen?: boolean;
  message?: string;
}

const Loading: React.FC<LoadingProps> = ({ fullScreen = true, message = "Inicializando..." }) => {
  const content = (
    <div className="flex flex-col items-center justify-center gap-8 animate-fade-in-up">
      <div className="relative w-24 h-24">
         {/* Spinner Rings */}
         <div className="absolute inset-0 border border-slate-200 dark:border-white/10 rounded-full"></div>
         <div className="absolute inset-0 border-t-2 border-brand-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
         <div className="absolute inset-2 border-b-2 border-brand-300 border-t-transparent border-r-transparent border-l-transparent rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
         
         {/* Center Logo */}
         <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-full p-3 shadow-lg border border-slate-200 dark:border-white/10">
                <UzielLogo className="text-slate-900 dark:text-white w-10 h-10" />
            </div>
         </div>
      </div>
      
      <div className="text-center space-y-3">
          <p className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-[0.3em] animate-pulse">{message}</p>
          <div className="flex gap-1.5 justify-center">
              <span className="w-1 h-1 rounded-full bg-brand-500 animate-bounce" style={{animationDelay: '0s'}}></span>
              <span className="w-1 h-1 rounded-full bg-brand-500 animate-bounce" style={{animationDelay: '0.1s'}}></span>
              <span className="w-1 h-1 rounded-full bg-brand-500 animate-bounce" style={{animationDelay: '0.2s'}}></span>
          </div>
      </div>
    </div>
  );

  if (fullScreen) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-slate-50 dark:bg-[#0f172a] flex items-center justify-center transition-colors duration-500">
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-white/60 dark:from-blue-900/10 dark:to-[#0f172a]/80 pointer-events-none"></div>
        <div className="relative z-10">
            {content}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="w-full min-h-[60vh] flex items-center justify-center">
      {content}
    </div>
  );
};

export default Loading;
