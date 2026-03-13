
import React, { useEffect, useState } from 'react';
import { PORTAL_LINKS, HOURLY_VERSES } from '../constants';
import { useAuth } from '../context/AuthContext';
import { generateCatholicChurchImage, getCachedImage, getDailyVerse } from '../services/geminiService';
import PremiumBackground from '../components/PremiumBackground';
import { BibleVerse } from '../types';

const Home: React.FC = () => {
  const { currentUser } = useAuth();
  const [verse, setVerse] = useState<BibleVerse>(HOURLY_VERSES[0]);
  
  const getContextKey = () => {
      const hour = new Date().getHours();
      let period = 'morning';
      if (hour >= 12 && hour < 18) period = 'afternoon';
      else if (hour >= 18 || hour < 5) period = 'night';
      return `home_hero_${period}`;
  };

  // Use state for image, initializing with cache check
  const [bgImage, setBgImage] = useState<string | null>(() => {
      return getCachedImage('home_hero'); 
  });

  useEffect(() => {
    const fetchVerse = async () => {
      try {
        const dailyVerse = await getDailyVerse();
        setVerse(dailyVerse);
      } catch (error) {
        console.error("Failed to fetch daily verse", error);
        setVerse(HOURLY_VERSES[Math.floor(Math.random() * HOURLY_VERSES.length)]);
      }
    };
    fetchVerse();
  }, []);

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

  // Use robust intelligent generation on mount
  useEffect(() => {
    const loadImage = async () => {
        try {
            const img = await generateCatholicChurchImage('home_hero');
            if (img) setBgImage(img);
        } catch (error) {
            console.error("Failed to load home background image", error);
        }
    };
    loadImage();
  }, []); 

  return (
    <div className="space-y-10 animate-fade-in-up pb-32">
      
      {/* 1. Immersive Hero Section */}
      <div className="relative w-full min-h-[480px] md:min-h-[550px] rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden shadow-2xl group flex flex-col justify-end border border-slate-100 dark:border-slate-800">
          
          {/* Layer 1: Background Image */}
          {bgImage ? (
              <div 
                className="absolute inset-0 bg-cover bg-center animate-breathing"
                style={{ 
                    backgroundImage: `url('${bgImage}')`,
                    backgroundPosition: 'center 30%' 
                }}
              ></div>
          ) : (
              <PremiumBackground variant="default" className="z-0" />
          )}
          
          {/* Layer 2: Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/60 to-transparent z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a]/80 to-transparent z-10"></div>
          
          {/* Layer 3: Content */}
          <div className="relative z-20 w-full p-8 md:p-14 flex flex-col gap-8">
              <div className="flex flex-col items-start gap-2 animate-fade-in-right py-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-xl text-white/90 text-[10px] font-bold uppercase tracking-widest border border-white/20 shadow-lg mb-4">
                      <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse"></span>
                      Portal Uziel v2.0
                  </div>
                  
                  <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold text-white leading-tight drop-shadow-2xl tracking-normal pb-2">
                      <span className="block text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400">Organização.</span>
                      <span className="block text-transparent bg-clip-text bg-gradient-to-br from-brand-400 to-indigo-500">Excelência.</span>
                      <span className="block text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400">Louvor.</span>
                  </h1>
              </div>
              
              <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-end justify-between w-full border-t border-white/10 pt-8 mt-4">
                  <div className="flex-1 max-w-2xl">
                      <p className="text-lg md:text-2xl text-slate-200 italic font-serif leading-relaxed text-shadow-sm">"{verse.text}"</p>
                      <p className="text-xs font-bold text-brand-400 uppercase tracking-widest mt-3 flex items-center gap-2">
                        <i className="fas fa-bible"></i> {verse.reference}
                      </p>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-white/5 backdrop-blur-xl p-3 pr-6 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors cursor-default">
                      <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-white font-bold text-xl overflow-hidden shadow-inner ring-2 ring-white/10">
                          {currentUser?.photoURL ? (
                              <img src={currentUser.photoURL} alt={currentUser.name} className="w-full h-full object-cover" />
                          ) : (
                              currentUser?.name.charAt(0)
                          )}
                      </div>
                      <div className="flex flex-col">
                          <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Bem-vindo,</p>
                          <p className="text-white font-bold text-base truncate max-w-[150px]">{currentUser?.name.split(' ')[0]}</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* 2. MAIN CONTENT GRID (Bento Layout) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 relative z-0">
          
          {/* LEFT COLUMN (MAIN ACTIONS) */}
          <div className="xl:col-span-8 space-y-10">
              
              {/* ACESSO RÁPIDO */}
              <div className="space-y-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                      <i className="fas fa-rocket text-brand-500"></i> Acesso Rápido
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-5 md:gap-6">
                      {PORTAL_LINKS.slice(0, 6).map((link, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => window.open(link.url, '_blank')}
                            className="group relative flex flex-col justify-between p-6 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1 overflow-hidden"
                          >
                              {/* Background Gradient on Hover */}
                              <div className={`absolute inset-0 bg-gradient-to-br from-${link.color}-500/0 to-${link.color}-500/0 group-hover:from-${link.color}-500/5 group-hover:to-${link.color}-500/10 transition-all duration-500`}></div>
                              
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg mb-4 bg-gradient-to-br from-${link.color}-500 to-${link.color}-600 group-hover:scale-110 transition-transform duration-300 relative z-10`}>
                                  <i className={`fas ${link.icon}`}></i>
                              </div>
                              
                              <div className="relative z-10">
                                  <h3 className="font-bold text-base md:text-lg text-slate-800 dark:text-white leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                      {link.title}
                                  </h3>
                                  <p className="text-[10px] text-slate-400 mt-2 line-clamp-2 leading-relaxed opacity-80 group-hover:opacity-100 font-medium">
                                      {link.desc}
                                  </p>
                              </div>
                              
                              {/* Arrow */}
                              <div className="absolute top-6 right-6 text-slate-200 dark:text-slate-700 group-hover:text-brand-500 transition-colors">
                                  <i className="fas fa-arrow-right -rotate-45 group-hover:rotate-0 transition-transform duration-300"></i>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              {/* DOCUMENTOS */}
              <div className="space-y-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                      <i className="fas fa-folder-open text-brand-500"></i> Documentação
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Estatuto Atual */}
                      <a 
                        href="https://drive.google.com/file/d/1hzVoqTGXw0pBBOTUG7PuIkTjZVrk_cKe/view" 
                        target="_blank" 
                        rel="noreferrer"
                        className="group relative rounded-[2.5rem] overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 h-full min-h-[220px]"
                      >
                          <div className="absolute inset-0 bg-gradient-to-br from-brand-500 via-indigo-500 to-purple-600 animate-gradient-x"></div>
                          <div className="absolute inset-[2px] bg-white dark:bg-slate-900 rounded-[2.4rem] p-8 flex flex-col justify-between z-10">
                              <div className="flex justify-between items-start">
                                  <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform duration-500 border border-brand-100 dark:border-brand-500/20">
                                      <i className="fas fa-file-contract"></i>
                                  </div>
                                  <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-black uppercase tracking-widest border border-green-500/20">Vigente</span>
                              </div>
                              <div className="space-y-2">
                                  <h4 className="text-xl font-bold text-slate-800 dark:text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-brand-600 group-hover:to-indigo-600 transition-all">Estatuto Oficial</h4>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-2">Regimento interno e diretrizes fundamentais do ministério.</p>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-brand-500 uppercase tracking-wider mt-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                                  <span>Ler Documento</span>
                                  <i className="fas fa-arrow-right"></i>
                              </div>
                          </div>
                      </a>

                      {/* Estatuto Antigo */}
                      <a 
                        href="https://drive.google.com/file/d/1sCjQkqn7VN0aanL0XvfuSocXregwZs_O/view" 
                        target="_blank" 
                        rel="noreferrer"
                        className="relative p-8 rounded-[2.5rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 shadow-sm group hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 flex flex-col justify-between h-full min-h-[220px]"
                      >
                          <div className="flex items-center justify-between mb-6">
                              <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-white/5 text-slate-500 flex items-center justify-center text-2xl group-hover:text-slate-700 dark:group-hover:text-white transition-colors">
                                  <i className="fas fa-history"></i>
                              </div>
                              <span className="px-3 py-1 rounded-full bg-slate-200/50 dark:bg-white/5 text-slate-500 text-[10px] font-bold uppercase tracking-widest">Arquivo</span>
                          </div>
                          <div>
                              <h4 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">Versão Anterior</h4>
                              <p className="text-xs text-slate-400 font-medium">Histórico para consulta.</p>
                          </div>
                      </a>
                  </div>
              </div>
          </div>

          {/* RIGHT COLUMN (SIDEBAR / TOOLS) */}
          <div className="xl:col-span-4 space-y-8">
              
              {/* LINKS ÚTEIS */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] p-6 border border-slate-100 dark:border-white/5">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                      <i className="fas fa-link text-brand-500"></i> Utilidades
                  </h3>
                  <div className="space-y-3">
                      {PORTAL_LINKS.slice(6).map((link, idx) => (
                          <a 
                            key={idx} 
                            href={link.url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 hover:border-brand-500 dark:hover:border-brand-500/50 transition-colors group shadow-sm hover:shadow-md"
                          >
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-${link.color}-50 dark:bg-${link.color}-900/20 text-${link.color}-600 dark:text-${link.color}-400 shrink-0`}>
                                  <i className={`fas ${link.icon}`}></i>
                              </div>
                              <div className="min-w-0">
                                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-brand-600 transition-colors truncate">
                                      {link.title}
                                  </h4>
                                  <p className="text-[10px] text-slate-400 truncate">Clique para acessar</p>
                              </div>
                              <i className="fas fa-external-link-alt text-xs text-slate-300 ml-auto group-hover:text-brand-500 transition-colors"></i>
                          </a>
                      ))}
                  </div>
              </div>

          </div>
      </div>
    </div>
  );
};

export default Home;
