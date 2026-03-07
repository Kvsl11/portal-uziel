
import React from 'react';
import { createPortal } from 'react-dom';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isProcessing?: boolean;
  confirmText?: string;
  processingText?: string;
  iconClass?: string;
  colorTheme?: 'red' | 'brand' | 'green';
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  isProcessing = false,
  confirmText = "Confirmar",
  processingText = "Excluindo...",
  iconClass = "fas fa-exclamation-triangle",
  colorTheme = 'red'
}) => {
  if (!isOpen) return null;

  const themeColors = {
      red: {
          bg: 'bg-red-50 dark:bg-red-900/20',
          text: 'text-red-500 dark:text-red-400',
          border: 'border-red-100 dark:border-red-900/30',
          glow: 'bg-red-500/20',
          gradient: 'from-red-500/10',
          btn: 'bg-red-600 hover:bg-red-700 shadow-red-500/30',
          icon: 'fa-trash-alt'
      },
      brand: {
          bg: 'bg-brand-50 dark:bg-brand-900/20',
          text: 'text-brand-500 dark:text-brand-400',
          border: 'border-brand-100 dark:border-brand-900/30',
          glow: 'bg-brand-500/20',
          gradient: 'from-brand-500/10',
          btn: 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/30',
          icon: 'fa-check'
      },
      green: {
          bg: 'bg-green-50 dark:bg-green-900/20',
          text: 'text-green-500 dark:text-green-400',
          border: 'border-green-100 dark:border-green-900/30',
          glow: 'bg-green-500/20',
          gradient: 'from-green-500/10',
          btn: 'bg-green-600 hover:bg-green-700 shadow-green-500/30',
          icon: 'fa-check-double'
      }
  };

  const currentTheme = themeColors[colorTheme];

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop with blur and darken effect */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity animate-fade-in"
        onClick={!isProcessing ? onClose : undefined}
      ></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#0f172a] rounded-[2.5rem] p-8 shadow-2xl border border-white/20 dark:border-white/5 animate-scale-in flex flex-col items-center text-center overflow-hidden">
        
        {/* Background Decorative Glow */}
        <div className={`absolute top-0 inset-x-0 h-32 bg-gradient-to-b ${currentTheme.gradient} to-transparent pointer-events-none`}></div>
        <div className={`absolute -top-10 left-1/2 -translate-x-1/2 w-32 h-32 ${currentTheme.glow} rounded-full blur-3xl pointer-events-none`}></div>

        {/* Animated Icon */}
        <div className="relative mb-6 group">
            <div className={`absolute inset-0 ${currentTheme.glow} rounded-full blur-xl animate-pulse`}></div>
            <div className={`w-20 h-20 rounded-[2rem] ${currentTheme.bg} flex items-center justify-center ${currentTheme.text} text-3xl shadow-inner border ${currentTheme.border} relative z-10`}>
                <i className={`${iconClass} transform group-hover:scale-110 transition-transform duration-300`}></i>
            </div>
        </div>

        <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-3 relative z-10 leading-tight">
            {title}
        </h3>
        
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed relative z-10 font-medium">
            {description}
        </p>

        <div className="flex flex-col-reverse sm:grid sm:grid-cols-2 gap-3 sm:gap-4 w-full relative z-10">
            <button 
                onClick={onClose}
                disabled={isProcessing}
                className="py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px] sm:text-xs tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Cancelar
            </button>
            <button 
                onClick={onConfirm}
                disabled={isProcessing}
                className={`py-3.5 sm:py-4 px-2 rounded-xl sm:rounded-2xl text-white font-bold uppercase text-[11px] sm:text-xs tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group/btn ${currentTheme.btn} hover:scale-[1.02] active:scale-95`}
            >
                {isProcessing ? (
                    <>
                        <i className="fas fa-circle-notch fa-spin"></i> {processingText}
                    </>
                ) : (
                    <>
                        <i className={`fas ${currentTheme.icon} group-hover/btn:rotate-12 transition-transform`}></i> {confirmText}
                    </>
                )}
            </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DeleteConfirmationModal;
