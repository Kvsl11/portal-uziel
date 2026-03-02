import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const { currentUser } = useAuth();

    useEffect(() => {
        // Check if iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        const isStandalone = ('standalone' in window.navigator) && (window.navigator as any).standalone;
        
        if (isIosDevice && !isStandalone) {
            setIsIOS(true);
        }

        // Listen for the beforeinstallprompt event (Android/Desktop Chrome)
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    useEffect(() => {
        // Only show prompt if user is logged in
        if (!currentUser) {
            setShowPrompt(false);
            return;
        }

        if (isIOS) {
            if (!localStorage.getItem('ios_install_prompt_dismissed')) {
                const timer = setTimeout(() => setShowPrompt(true), 3000);
                return () => clearTimeout(timer);
            }
        } else if (deferredPrompt) {
            if (!localStorage.getItem('install_prompt_dismissed')) {
                const timer = setTimeout(() => setShowPrompt(true), 3000);
                return () => clearTimeout(timer);
            }
        }
    }, [currentUser, isIOS, deferredPrompt]);

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            setDeferredPrompt(null);
            setShowPrompt(false);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        if (isIOS) {
            localStorage.setItem('ios_install_prompt_dismissed', 'true');
        } else {
            localStorage.setItem('install_prompt_dismissed', 'true');
        }
    };

    if (!showPrompt) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -50, opacity: 0 }}
                className="fixed top-20 left-4 right-4 md:top-24 md:left-0 md:right-0 md:mx-auto md:w-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-[9999] flex flex-col gap-3"
            >
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-brand-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 shadow-inner border border-brand-100 dark:border-slate-700 p-2">
                        <svg viewBox='0 0 100 100' fill='none' xmlns='http://www.w3.org/2000/svg' className="w-full h-full">
                            <line x1='50' y1='5' x2='50' y2='95' stroke='#29aae2' strokeWidth='8' strokeLinecap='round' />
                            <line x1='25' y1='28' x2='75' y2='28' stroke='#29aae2' strokeWidth='8' strokeLinecap='round' />
                            <line x1='35' y1='45' x2='35' y2='85' stroke='#29aae2' strokeWidth='8' strokeLinecap='round' />
                            <line x1='20' y1='55' x2='20' y2='75' stroke='#29aae2' strokeWidth='8' strokeLinecap='round' />
                            <line x1='65' y1='45' x2='65' y2='85' stroke='#29aae2' strokeWidth='8' strokeLinecap='round' />
                            <line x1='80' y1='55' x2='80' y2='75' stroke='#29aae2' strokeWidth='8' strokeLinecap='round' />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-900 dark:text-white">Instalar Portal Uziel</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {isIOS 
                                ? "Para instalar no iOS, toque em 'Compartilhar' e depois em 'Adicionar à Tela de Início'."
                                : "Instale o app no seu dispositivo para acesso rápido e melhor experiência."}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 mt-2">
                    <button 
                        onClick={handleDismiss}
                        className="flex-1 px-4 py-2 rounded-xl font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Agora não
                    </button>
                    {!isIOS && (
                        <button 
                            onClick={handleInstall}
                            className="flex-1 px-4 py-2 rounded-xl font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/30"
                        >
                            Instalar
                        </button>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
