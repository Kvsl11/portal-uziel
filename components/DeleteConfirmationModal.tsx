
import React from 'react';
import { createPortal } from 'react-dom';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isProcessing?: boolean;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  isProcessing = false,
}) => {
  if (!isOpen) return null;

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
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-red-500/10 to-transparent pointer-events-none"></div>
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-32 h-32 bg-red-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Animated Icon */}
        <div className="relative mb-6 group">
            <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse"></div>
            <div className="w-20 h-20 rounded-[2rem] bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 dark:text-red-400 text-3xl shadow-inner border border-red-100 dark:border-red-900/30 relative z-10">
                <i className="fas fa-exclamation-triangle transform group-hover:scale-110 transition-transform duration-300"></i>
            </div>
        </div>

        <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-3 relative z-10 leading-tight">
            {title}
        </h3>
        
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed relative z-10 font-medium">
            {description}
        </p>

        <div className="grid grid-cols-2 gap-4 w-full relative z-10">
            <button 
                onClick={onClose}
                disabled={isProcessing}
                className="py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-xs tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Cancelar
            </button>
            <button 
                onClick={onConfirm}
                disabled={isProcessing}
                className="py-4 rounded-2xl bg-red-600 text-white font-bold uppercase text-xs tracking-wider hover:bg-red-700 hover:scale-[1.02] active:scale-95 shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group/btn"
            >
                {isProcessing ? (
                    <>
                        <i className="fas fa-circle-notch fa-spin"></i> Excluindo...
                    </>
                ) : (
                    <>
                        <i className="fas fa-trash-alt group-hover/btn:rotate-12 transition-transform"></i> Confirmar
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
