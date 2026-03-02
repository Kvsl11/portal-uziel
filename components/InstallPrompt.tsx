import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        const isStandalone = ('standalone' in window.navigator) && (window.navigator as any).standalone;
        
        if (isIosDevice && !isStandalone) {
            setIsIOS(true);
            // Show prompt for iOS if not dismissed
            if (!localStorage.getItem('ios_install_prompt_dismissed')) {
                setTimeout(() => setShowPrompt(true), 3000);
            }
        }

        // Listen for the beforeinstallprompt event (Android/Desktop Chrome)
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            if (!localStorage.getItem('install_prompt_dismissed')) {
                setTimeout(() => setShowPrompt(true), 3000);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

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
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-[9999] flex flex-col gap-3"
            >
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-brand-500 rounded-xl flex items-center justify-center shrink-0 text-white text-xl shadow-lg">
                        <i className="fas fa-download"></i>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-900 dark:text-white">Instalar Aplicativo</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {isIOS 
                                ? "Para instalar no iOS, toque em 'Compartilhar' e depois em 'Adicionar à Tela de Início'."
                                : "Instale o Portal Uziel no seu dispositivo para acesso rápido e experiência de aplicativo nativo."}
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
