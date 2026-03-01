
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import UzielLogo from '../components/UzielLogo';
import { generateTimeBasedBackground } from '../services/geminiService';
import PremiumBackground from '../components/PremiumBackground';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, currentUser } = useAuth(); 
  const navigate = useNavigate();
  const location = useLocation();
  
  // Estado inicial de carregamento da página (Splash Screen)
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState("Inicializando...");
  const [bgImage, setBgImage] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  const getContextKey = () => {
      const hour = new Date().getHours();
      let period = 'morning';
      if (hour >= 12 && hour < 18) period = 'afternoon';
      else if (hour >= 18 || hour < 5) period = 'night';
      return `login_${period}`;
  };

  // --- REDIRECIONAMENTO AUTOMÁTICO ---
  useEffect(() => {
    if (currentUser) {
      navigate(from, { replace: true });
    }
  }, [currentUser, navigate, from]);

  // Listen for real-time background updates
  useEffect(() => {
      const handleBackgroundUpdate = (e: Event) => {
          const detail = (e as CustomEvent).detail;
          if (detail && detail.contextKey === getContextKey() && detail.imageUrl) {
              setBgImage(detail.imageUrl);
          }
      };
      
      window.addEventListener('background-update', handleBackgroundUpdate);
      return () => window.removeEventListener('background-update', handleBackgroundUpdate);
  }, []);

  // --- LOGICA DE CARREGAMENTO ROBUSTA ---
  useEffect(() => {
    const initPage = async () => {
        // 1. Detectar Horário
        const hour = new Date().getHours();
        let currentPeriod: 'morning' | 'afternoon' | 'night' = 'morning';
        
        if (hour >= 5 && hour < 12) currentPeriod = 'morning';
        else if (hour >= 12 && hour < 18) currentPeriod = 'afternoon';
        else currentPeriod = 'night';

        // Inicia carregamento da imagem em background
        generateTimeBasedBackground(currentPeriod).then(imgUrl => {
            if (imgUrl) {
                const img = new Image();
                img.src = imgUrl;
                img.onload = () => setBgImage(imgUrl);
            }
        }).catch(console.error);

        // Simulador de Progresso "Cinematográfico"
        const startTime = Date.now();
        const duration = 3500; // 3.5 segundos de intro

        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const rawProgress = Math.min((elapsed / duration) * 100, 100);
            
            // Curva de progresso não linear para sensação de "processamento"
            const easeProgress = 100 * (1 - Math.pow(1 - (rawProgress / 100), 3)); 
            
            setLoadingProgress(easeProgress);

            // Atualiza textos de status baseados no progresso
            if (rawProgress < 20) setLoadingStatus("Conectando ao Santuário...");
            else if (rawProgress < 40) setLoadingStatus("Sincronizando Liturgia...");
            else if (rawProgress < 60) setLoadingStatus("Carregando Harpas...");
            else if (rawProgress < 80) setLoadingStatus("Autenticando Acesso...");
            else setLoadingStatus("Bem-vindo ao Uziel.");

            if (rawProgress >= 100) {
                clearInterval(interval);
                setTimeout(() => setIsPageLoading(false), 500);
            }
        }, 30);

        return () => clearInterval(interval);
    };

    initPage();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    try {
        await login(username, password);
    } catch (e: any) {
        let detailedError = 'Erro ao conectar. Tente novamente.';
        if (e.code === 'auth/invalid-email' || e.code === 'auth/user-not-found') {
            detailedError = 'Usuário não encontrado.';
        } else if (e.code === 'auth/wrong-password') {
            detailedError = 'Senha incorreta.';
        } else if (e.code === 'auth/too-many-requests') {
            detailedError = 'Muitas tentativas. Aguarde um momento.';
        } else if (e.code === 'auth/network-request-failed') {
            detailedError = 'Erro de conexão. Verifique sua internet.';
        }
        setError(detailedError);
        setIsSubmitting(false);
    }
  };

  // --- ADAPTIVE CINEMATIC BACKGROUND ---
  const CinematicBackground = () => (
      <>
        {/* Layer 1: Adaptive Atmosphere Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-50 via-slate-100 to-slate-200 dark:from-[#0f172a] dark:via-[#020617] dark:to-black z-0 transition-colors duration-1000"></div>
        
        {/* Texture: Ajustada para ser muito sutil e espaçada (Pontinhos brancos) */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.08] pointer-events-none" 
             style={{ 
                 backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', 
                 backgroundSize: '120px 120px', // Aumentado para espaçar os pontos
                 color: 'inherit'
             }}>
        </div>
        
        <PremiumBackground variant="holy" className="opacity-10 dark:opacity-30 mix-blend-overlay dark:mix-blend-screen pointer-events-none" />
        
        {/* Layer 2: Divine Ray (Top Light) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-[60%] bg-gradient-to-b from-brand-400/0 via-brand-400/30 to-transparent blur-[4px] z-0 animate-pulse-slow pointer-events-none"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[40%] bg-brand-500/10 blur-[100px] rounded-full pointer-events-none"></div>
      </>
  );

  // --- SPLASH SCREEN (REFORMULATED) ---
  if (isPageLoading) {
      return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-slate-50 dark:bg-[#020617] transition-colors duration-500">
            <style>{`
                @keyframes ken-burns {
                    0% { transform: scale(1.1); }
                    50% { transform: scale(1.25); }
                    100% { transform: scale(1.1); }
                }
                .animate-ken-burns {
                    animation: ken-burns 20s ease-in-out infinite;
                }
                .animate-ken-burns-slow {
                    animation: ken-burns 60s ease-in-out infinite;
                }
            `}</style>
            {/* Background Image with Ken Burns effect for Splash */}
            <div className="absolute inset-0 z-0">
                {bgImage && (
                    <div 
                        className="absolute inset-0 bg-cover bg-center animate-ken-burns opacity-20 dark:opacity-40"
                        style={{ backgroundImage: `url('${bgImage}')` }}
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/80 to-white dark:from-[#020617]/60 dark:via-[#020617]/80 dark:to-[#020617]" />
            </div>

            <div className="relative z-10 flex flex-col items-center w-full max-w-md px-6">
                {/* Logo Animation */}
                <div className="relative mb-12">
                    <div className="absolute inset-0 bg-brand-500/20 blur-[60px] rounded-full animate-pulse-slow"></div>
                    <UzielLogo className="w-32 h-32 text-slate-900 dark:text-white drop-shadow-[0_0_30px_rgba(41,170,226,0.6)] relative z-10 animate-[float_6s_ease-in-out_infinite]" />
                </div>

                {/* Typography */}
                <div className="text-center space-y-4 mb-16">
                    <h1 className="text-6xl font-display font-bold text-slate-900 dark:text-white tracking-[0.15em] drop-shadow-sm dark:drop-shadow-2xl animate-[fade-in-up_1s_ease-out_forwards]">
                        UZIEL
                    </h1>
                    <div className="flex items-center justify-center gap-4 opacity-0 animate-[fade-in_1s_ease-out_0.5s_forwards]">
                        <div className="h-[1px] w-8 bg-brand-500/50"></div>
                        <p className="font-sacred text-xs text-brand-600 dark:text-brand-400 uppercase tracking-[0.5em] font-bold">
                            Portal Ministerial
                        </p>
                        <div className="h-[1px] w-8 bg-brand-500/50"></div>
                    </div>
                </div>

                {/* Minimalist Progress Bar */}
                <div className="w-64 opacity-0 animate-[fade-in_1s_ease-out_0.8s_forwards]">
                    <div className="flex justify-between text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                        <span>{loadingStatus}</span>
                        <span className="text-brand-600 dark:text-brand-400">{Math.round(loadingProgress)}%</span>
                    </div>
                    <div className="h-[2px] w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-brand-500 shadow-[0_0_10px_#29aae2]"
                            style={{ width: `${loadingProgress}%`, transition: 'width 0.1s linear' }}
                        ></div>
                    </div>
                </div>
            </div>
            
            {/* Footer */}
            <div className="absolute bottom-10 text-center opacity-0 animate-[fade-in_2s_ease-out_2s_forwards]">
                <p className="text-[9px] text-slate-500 font-mono uppercase tracking-[0.3em]">Secure Environment v2.1</p>
            </div>
        </div>
      );
  }

  // --- MAIN LOGIN SCREEN ---
  return (
    <div className="min-h-screen font-sans overflow-hidden relative flex items-center justify-center animate-fade-in bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-white transition-colors duration-500">
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
            -webkit-background-clip: text;
            -webkit-text-fill-color: inherit;
            transition: background-color 5000s ease-in-out 0s;
            box-shadow: inset 0 0 20px 20px transparent !important;
        }
        .dark input:-webkit-autofill {
            -webkit-text-fill-color: white;
        }
        @keyframes ken-burns {
            0% { transform: scale(1.1); }
            50% { transform: scale(1.25); }
            100% { transform: scale(1.1); }
        }
        .animate-ken-burns-slow {
            animation: ken-burns 60s ease-in-out infinite;
        }
      `}</style>
      
      {/* Dynamic BG Image Layer - High Visibility */}
      <div className="absolute inset-0 z-0">
          {bgImage && (
              <div 
                className="absolute inset-0 bg-cover bg-center transition-all duration-[3s] animate-ken-burns-slow"
                style={{ 
                    backgroundImage: `url('${bgImage}')`,
                    opacity: 0.6, 
                }}
              ></div>
          )}
          {/* Gradient Overlay - Subtle to keep image visible but ensure text contrast */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-white/90 dark:from-black/40 dark:via-transparent dark:to-black/80"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_0%,rgba(255,255,255,0)_100%)] dark:bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]"></div>
      </div>

      {/* --- LOGIN CARD --- */}
      <div className="relative z-10 w-full max-w-[400px] px-6">
        
        <div className="relative group">
            {/* Glass Panel */}
            <div className="relative bg-white/60 dark:bg-black/30 backdrop-blur-xl border border-white/40 dark:border-white/10 p-8 md:p-10 rounded-[2.5rem] shadow-2xl dark:shadow-none overflow-hidden transition-all duration-500 hover:bg-white/70 dark:hover:bg-black/40 hover:border-white/60 dark:hover:border-white/20">
                
                {/* Top Shine */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-slate-400/30 dark:via-white/30 to-transparent"></div>

                {/* Header */}
                <div className="flex flex-col items-center mb-10">
                    <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                        <div className="absolute inset-0 bg-brand-500/20 blur-[40px] rounded-full animate-pulse-slow"></div>
                        <UzielLogo className="w-16 h-16 text-slate-900 dark:text-white drop-shadow-[0_0_15px_rgba(41,170,226,0.3)] dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] relative z-10" />
                    </div>

                    <div className="text-center">
                        <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-wide mb-2">
                            BEM-VINDO
                        </h2>
                        <div className="flex items-center justify-center gap-3">
                            <div className="h-[1px] w-6 bg-slate-300 dark:bg-white/20"></div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-300 uppercase tracking-[0.3em] font-bold">Ministério Uziel</p>
                            <div className="h-[1px] w-6 bg-slate-300 dark:bg-white/20"></div>
                        </div>
                    </div>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Username Input */}
                    <div className="group relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <i className="fas fa-user text-slate-400 dark:text-white/50 group-focus-within:text-brand-600 dark:group-focus-within:text-brand-400 transition-colors text-xs"></i>
                        </div>
                        <input 
                            type="text" 
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="block w-full pl-10 pr-4 py-4 bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white placeholder-transparent focus:border-brand-500/50 focus:bg-white/80 dark:focus:bg-white/10 focus:ring-1 focus:ring-brand-500/50 transition-all text-sm font-medium outline-none peer"
                            placeholder="Identificação"
                            autoComplete="off"
                        />
                        <label 
                            htmlFor="username"
                            className="absolute left-10 -top-2.5 bg-transparent px-1 text-[10px] font-bold text-brand-600 dark:text-brand-400 transition-all 
                            peer-placeholder-shown:text-xs peer-placeholder-shown:text-slate-400 peer-placeholder-shown:dark:text-white/40 
                            peer-placeholder-shown:top-4 peer-placeholder-shown:font-medium 
                            peer-focus:-top-2.5 peer-focus:text-[10px] peer-focus:text-brand-600 peer-focus:dark:text-brand-400 peer-focus:font-bold 
                            uppercase tracking-wider backdrop-blur-md rounded-full"
                        >
                            Identificação
                        </label>
                    </div>

                    {/* Password Input */}
                    <div className="group relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <i className="fas fa-lock text-slate-400 dark:text-white/50 group-focus-within:text-brand-600 dark:group-focus-within:text-brand-400 transition-colors text-xs"></i>
                        </div>
                        <input 
                            type={showPassword ? "text" : "password"}
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="block w-full pl-10 pr-10 py-4 bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white placeholder-transparent focus:border-brand-500/50 focus:bg-white/80 dark:focus:bg-white/10 focus:ring-1 focus:ring-brand-500/50 transition-all text-sm font-medium outline-none peer"
                            placeholder="Senha"
                        />
                        <label 
                            htmlFor="password"
                            className="absolute left-10 -top-2.5 bg-transparent px-1 text-[10px] font-bold text-brand-600 dark:text-brand-400 transition-all 
                            peer-placeholder-shown:text-xs peer-placeholder-shown:text-slate-400 peer-placeholder-shown:dark:text-white/40 
                            peer-placeholder-shown:top-4 peer-placeholder-shown:font-medium 
                            peer-focus:-top-2.5 peer-focus:text-[10px] peer-focus:text-brand-600 peer-focus:dark:text-brand-400 peer-focus:font-bold 
                            uppercase tracking-wider backdrop-blur-md rounded-full"
                        >
                            Senha
                        </label>
                        
                        <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 dark:text-white/40 hover:text-brand-600 dark:hover:text-white transition-colors focus:outline-none"
                        >
                            <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                        </button>
                    </div>

                    {error && (
                        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 p-3 rounded-xl animate-fade-in-up backdrop-blur-sm">
                            <i className="fas fa-exclamation-circle text-red-500 dark:text-red-400 text-sm"></i>
                            <span className="text-red-600 dark:text-red-200 text-xs font-bold leading-tight">{error}</span>
                        </div>
                    )}

                    <div className="pt-2">
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="w-full py-4 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-2xl shadow-lg shadow-brand-600/20 transform hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-xs relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : null}
                                {isSubmitting ? 'Autenticando...' : 'Acessar'}
                            </span>
                        </button>
                    </div>
                </form>

                {/* Footer Icons */}
                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10 flex justify-center gap-8">
                    {[{icon: 'fa-church', label: 'Liturgia'}, {icon: 'fa-music', label: 'Louvor'}, {icon: 'fa-users', label: 'Unidade'}].map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-2 group cursor-default opacity-50 hover:opacity-100 transition-opacity">
                            <i className={`fas ${item.icon} text-slate-500 dark:text-white text-sm group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors`}></i>
                            <span className="text-[8px] font-bold uppercase text-slate-500 dark:text-white tracking-wider">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>

      <div className="absolute bottom-6 text-center z-10 opacity-60 pointer-events-none mix-blend-overlay dark:mix-blend-normal">
          <p className="text-[9px] text-slate-900 dark:text-white font-mono uppercase tracking-[0.2em]">
              System v2.1 • Secure Environment
          </p>
      </div>
    </div>
  );
};

export default Login;
