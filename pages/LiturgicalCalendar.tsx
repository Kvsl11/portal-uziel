
import React, { useState, useEffect, useMemo } from 'react';
import { LiturgicalService, LiturgicalDay } from '../services/liturgicalService';
import { fetchLiturgyDetails, generateCatholicChurchImage, getCachedImage, getDateKey } from '../services/geminiService';
import { LiturgyCacheService, AuditService } from '../services/firebase'; 
import { LiturgyLocalStorage } from '../services/LiturgyLocalStorage';
import { useAuth } from '../context/AuthContext';
import PremiumBackground from '../components/PremiumBackground';
import Loading from '../components/Loading';
import { createPortal } from 'react-dom';

// --- DATA: ROBUST SYNOPSES ---
const SEASON_SYNOPSES: Record<string, { title: string, description: string }> = {
    'ordinary': {
        title: 'Tempo Comum',
        description: `
            <div class="space-y-6">
                <p class="text-slate-600 dark:text-slate-300 leading-relaxed text-base">O Tempo Comum não é um tempo "vazio", mas o tempo de viver o cotidiano santificado pela presença de Cristo. É o período de esperança e crescimento, onde a Igreja medita a vida pública de Jesus, seus gestos e ensinamentos.</p>
                
                <div class="bg-green-50 dark:bg-green-900/10 p-5 rounded-2xl border-l-4 border-green-500 shadow-sm">
                    <div class="mb-4">
                        <h4 class="text-green-600 dark:text-green-400 font-black uppercase text-xs tracking-widest mb-1 flex items-center gap-2"><i class="fas fa-book-bible"></i> Significado Teológico</h4>
                        <p class="text-slate-700 dark:text-slate-300 text-sm font-medium">A vivência fiel do discipulado no dia a dia. Não celebra um mistério específico, mas todo o mistério de Cristo em sua plenitude.</p>
                    </div>
                    
                    <div>
                        <h4 class="text-green-600 dark:text-green-400 font-black uppercase text-xs tracking-widest mb-1 flex items-center gap-2"><i class="fas fa-palette"></i> Uso da Cor Verde</h4>
                        <p class="text-slate-700 dark:text-slate-300 text-sm font-medium">Usada para simbolizar a <strong class="text-green-700 dark:text-green-300">esperança</strong> cristã e o <strong class="text-green-700 dark:text-green-300">crescimento</strong> espiritual.</p>
                    </div>
                </div>
            </div>
        `
    },
    'purple': {
        title: 'Advento & Quaresma',
        description: `
            <div class="space-y-6">
                <p class="text-slate-600 dark:text-slate-300 leading-relaxed text-base">Tempos "fortes" de preparação e penitência. O Roxo nos convida à introspecção, vigilância e conversão do coração.</p>
                
                <div class="bg-purple-50 dark:bg-purple-900/10 p-5 rounded-2xl border-l-4 border-purple-500 shadow-sm">
                    <div class="mb-4">
                        <h4 class="text-purple-600 dark:text-purple-400 font-black uppercase text-xs tracking-widest mb-1 flex items-center gap-2"><i class="fas fa-praying-hands"></i> Significado Teológico</h4>
                        <ul class="list-none space-y-2 mt-2">
                            <li class="flex gap-2 text-sm text-slate-700 dark:text-slate-300 font-medium"><span class="font-bold text-purple-700 dark:text-purple-300">Advento:</span> Expectativa piedosa e alegre da dupla vinda de Cristo (Encarnação e Fim dos Tempos).</li>
                            <li class="flex gap-2 text-sm text-slate-700 dark:text-slate-300 font-medium"><span class="font-bold text-purple-700 dark:text-purple-300">Quaresma:</span> Caminho de conversão e deserto espiritual rumo à Páscoa.</li>
                        </ul>
                    </div>
                    
                    <div>
                        <h4 class="text-purple-600 dark:text-purple-400 font-black uppercase text-xs tracking-widest mb-1 flex items-center gap-2"><i class="fas fa-palette"></i> Uso da Cor Roxa</h4>
                        <p class="text-slate-700 dark:text-slate-300 text-sm font-medium">Simboliza a <strong class="text-purple-700 dark:text-purple-300">penitência</strong>, a contrição e a preparação espiritual profunda.</p>
                    </div>
                </div>
            </div>
        `
    },
    'solemnity': {
        title: 'Solenidades & Festas',
        description: `
            <div class="space-y-6">
                <p class="text-slate-600 dark:text-slate-300 leading-relaxed text-base">São os dias de grau máximo na liturgia. Celebram os mistérios centrais da fé (como a Páscoa e o Natal) ou os santos de maior importância universal.</p>
                
                <div class="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-2xl border-l-4 border-amber-500 shadow-sm">
                    <div class="mb-4">
                        <h4 class="text-amber-600 dark:text-amber-400 font-black uppercase text-xs tracking-widest mb-1 flex items-center gap-2"><i class="fas fa-star"></i> Significado Teológico</h4>
                        <p class="text-slate-700 dark:text-slate-300 text-sm font-medium">A irrupção da Glória de Deus no tempo. Nestes dias, o Céu toca a Terra de forma especial.</p>
                    </div>
                    
                    <div>
                        <h4 class="text-amber-600 dark:text-amber-400 font-black uppercase text-xs tracking-widest mb-1 flex items-center gap-2"><i class="fas fa-palette"></i> Uso da Cor Branca/Dourada</h4>
                        <p class="text-slate-700 dark:text-slate-300 text-sm font-medium">Simboliza a <strong class="text-amber-700 dark:text-amber-300">alegria</strong>, a <strong class="text-amber-700 dark:text-amber-300">pureza</strong>, a vitória e a luz divina.</p>
                    </div>
                </div>
            </div>
        `
    },
    'red': {
        title: 'Paixão & Mártires',
        description: `
            <div class="space-y-6">
                <p class="text-slate-600 dark:text-slate-300 leading-relaxed text-base">A cor vermelha possui duplo significado na liturgia: recorda o fogo abrasador do Espírito Santo e o sangue derramado por amor a Cristo.</p>
                
                <div class="bg-red-50 dark:bg-red-900/10 p-5 rounded-2xl border-l-4 border-red-500 shadow-sm">
                    <div class="mb-4">
                        <h4 class="text-red-600 dark:text-red-400 font-black uppercase text-xs tracking-widest mb-1 flex items-center gap-2"><i class="fas fa-fire"></i> Significado Teológico</h4>
                        <p class="text-slate-700 dark:text-slate-300 text-sm font-medium">O testemunho supremo de amor (martírio) e o dom da onipotência divina (Pentecostes).</p>
                    </div>
                    
                    <div>
                        <h4 class="text-red-600 dark:text-red-400 font-black uppercase text-xs tracking-widest mb-1 flex items-center gap-2"><i class="fas fa-palette"></i> Uso da Cor Vermelha</h4>
                        <p class="text-slate-700 dark:text-slate-300 text-sm font-medium">Usada no <strong class="text-red-700 dark:text-red-300">Domingo de Ramos</strong>, <strong class="text-red-700 dark:text-red-300">Sexta-feira da Paixão</strong>, <strong class="text-red-700 dark:text-red-300">Pentecostes</strong> e nas festas dos <strong class="text-red-700 dark:text-red-300">Mártires</strong>.</p>
                    </div>
                </div>
            </div>
        `
    },
    'rose': {
        title: 'Domingos da Alegria',
        description: `
            <div class="space-y-6">
                <p class="text-slate-600 dark:text-slate-300 leading-relaxed text-base">São breves pausas na austeridade do Advento e da Quaresma. A Igreja antecipa a alegria das festas que se aproximam para nos dar ânimo.</p>
                
                <div class="bg-pink-50 dark:bg-pink-900/10 p-5 rounded-2xl border-l-4 border-pink-500 shadow-sm">
                    <div class="mb-4">
                        <h4 class="text-pink-600 dark:text-pink-400 font-black uppercase text-xs tracking-widest mb-1 flex items-center gap-2"><i class="fas fa-smile-beam"></i> Significado Teológico</h4>
                        <p class="text-slate-700 dark:text-slate-300 text-sm font-medium">O <strong class="text-pink-700 dark:text-pink-300">"Gaudete"</strong> e o <strong class="text-pink-700 dark:text-pink-300">"Laetare"</strong>. Um respiro de esperança no meio da penitência.</p>
                    </div>
                    
                    <div>
                        <h4 class="text-pink-600 dark:text-pink-400 font-black uppercase text-xs tracking-widest mb-1 flex items-center gap-2"><i class="fas fa-palette"></i> Uso da Cor Rosa</h4>
                        <p class="text-slate-700 dark:text-slate-300 text-sm font-medium">Usada exclusivamente no <strong class="text-pink-700 dark:text-pink-300">3º Domingo do Advento</strong> e no <strong class="text-pink-700 dark:text-pink-300">4º Domingo da Quaresma</strong>.</p>
                    </div>
                </div>
            </div>
        `
    }
};

type LiturgyTab = 'reading1' | 'psalm' | 'reading2' | 'gospel';

const DayDetailsModal = ({ day, onClose, onCacheChange }: { day: LiturgicalDay, onClose: () => void, onCacheChange: (dateStr: string, hasCache: boolean) => void }) => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState<{title: string, reading1: string, psalm: string, reading2: string, gospel: string} | null>(null);
    const [bgImage, setBgImage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<LiturgyTab>('reading1');
    const [isSaved, setIsSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    const dateKey = getDateKey(day.date);

    useEffect(() => {
        const load = async () => {
            try {
                const liturgyData = await fetchLiturgyDetails(day.date);
                
                // Track AI Usage if not from cache
                if (!liturgyData._fromCache && currentUser) {
                    await AuditService.log(
                        currentUser.username,
                        'Liturgy',
                        'AI_LITURGY',
                        `Fetched Liturgy details for ${dateKey}`,
                        currentUser.role,
                        currentUser.name
                    );
                }

                // Contexto de imagem específico para cada cor litúrgica para maior imersão
                const imgUrl = await generateCatholicChurchImage(`liturgy_${day.color}`);
                setContent(liturgyData as any);
                if(imgUrl) setBgImage(imgUrl);
                
                if (LiturgyLocalStorage.has(dateKey)) {
                    setIsSaved(true);
                    onCacheChange(dateKey, true);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [day]);

    const handleSave = async () => {
        if (!content) return;
        setSaving(true);
        try {
            LiturgyLocalStorage.save(dateKey, content);
            // Also save to remote cache for sync
            await LiturgyCacheService.save(dateKey, content);
            setIsSaved(true);
            onCacheChange(dateKey, true);
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setSaving(true);
        try {
            LiturgyLocalStorage.delete(dateKey);
            await LiturgyCacheService.delete(dateKey);
            setIsSaved(false);
            onCacheChange(dateKey, false);
        } catch (e) {
            console.error(e);
            alert("Erro ao excluir cache.");
        } finally {
            setSaving(false);
        }
    };

    const formattedDate = day.date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-white dark:bg-[#0b1221] animate-fade-in flex flex-col">
            <div className="w-full h-full flex flex-col relative overflow-hidden">
                
                <button onClick={onClose} className="absolute top-6 right-6 z-50 w-12 h-12 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-md transition-colors border border-white/20">
                    <i className="fas fa-times text-xl"></i>
                </button>

                <div className="relative shrink-0 h-auto min-h-[180px] md:min-h-[240px] flex flex-col justify-end">
                    {bgImage ? (
                        <img src={bgImage} className="absolute inset-0 w-full h-full object-cover animate-breathing" alt="Liturgia" />
                    ) : (
                        <PremiumBackground variant="holy" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b1221] via-[#0b1221]/60 to-transparent"></div>
                    <div className="relative z-10 p-6 md:p-8 text-white">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/10 backdrop-blur-md border border-white/20 shadow-lg`}>
                                {day.season === 'Ordinary' ? 'Tempo Comum' : day.season === 'Lent' ? 'Quaresma' : day.season === 'Advent' ? 'Advento' : day.season === 'Easter' ? 'Páscoa' : 'Natal'}
                            </span>
                            {day.isSolemnity && <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-500 text-white shadow-lg shadow-amber-500/30 flex items-center gap-2"><i className="fas fa-star"></i> Solenidade</span>}
                            
                            {!loading && content && (
                                isSaved ? (
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-green-500/80 text-white shadow-lg backdrop-blur-md flex items-center gap-2 border border-green-400/30 animate-scale-in">
                                            <i className="fas fa-cloud-download-alt"></i> Salvo
                                        </span>
                                        <button 
                                            onClick={handleDelete}
                                            disabled={saving}
                                            className="w-7 h-7 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center backdrop-blur-md border border-red-500/30 disabled:opacity-50"
                                            title="Excluir Cache"
                                        >
                                            {saving ? <i className="fas fa-circle-notch fa-spin text-[10px]"></i> : <i className="fas fa-trash text-[10px]"></i>}
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/20 hover:bg-white/30 text-white shadow-lg backdrop-blur-md flex items-center gap-2 border border-white/30 animate-scale-in transition-colors disabled:opacity-50"
                                    >
                                        {saving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>}
                                        Salvar
                                    </button>
                                )
                            )}
                        </div>
                        <h2 className="text-2xl md:text-4xl font-display font-bold leading-tight drop-shadow-lg mb-1 text-white">
                            {content?.title || day.title || 'Féria'}
                        </h2>
                        <p className="text-xs md:text-sm font-medium opacity-90 capitalize flex items-center gap-2 text-brand-300">
                            <i className="fas fa-calendar-day"></i> {formattedDate}
                        </p>
                    </div>
                </div>

                <div className="flex-1 flex flex-col bg-slate-50 dark:bg-[#0b1221] overflow-hidden relative min-h-0">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loading fullScreen={false} message="Consultando o Missal..." />
                        </div>
                    ) : content ? (
                        <div className="flex flex-col h-full min-h-0">
                            <div className="px-6 pt-6 pb-2 bg-white dark:bg-[#0b1221] border-b border-slate-100 dark:border-white/5 overflow-x-auto hide-scrollbar shrink-0">
                                <div className="flex space-x-2">
                                    {[
                                        { id: 'reading1', label: '1ª Leitura', icon: 'fa-scroll' },
                                        { id: 'psalm', label: 'Salmo', icon: 'fa-music' },
                                        ...(content.reading2 && content.reading2.length > 20 ? [{ id: 'reading2', label: '2ª Leitura', icon: 'fa-scroll' }] : []),
                                        { id: 'gospel', label: 'Evangelho', icon: 'fa-bible' }
                                    ].map((tab: any) => (
                                        <button 
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 border ${activeTab === tab.id 
                                                ? 'bg-brand-600 text-white border-brand-600 shadow-lg shadow-brand-500/25 scale-105' 
                                                : 'bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border-slate-200 dark:border-white/10'}`}
                                        >
                                            <i className={`fas ${tab.icon}`}></i> {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-slate-50 dark:bg-[#0b1221]">
                                <div className="bg-white dark:bg-slate-800/50 p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-white/5 animate-fade-in-up">
                                    <div 
                                        className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 font-serif text-lg md:text-xl leading-loose
                                        [&>h3]:text-2xl [&>h3]:font-display [&>h3]:font-bold [&>h3]:text-brand-600 dark:[&>h3]:text-brand-400 [&>h3]:mb-4 [&>h3]:mt-8
                                        [&>strong]:text-brand-600 dark:[&>strong]:text-brand-400 [&>strong]:font-black [&>strong]:tracking-wide
                                        [&>p:first-child]:text-brand-600 dark:[&>p:first-child]:text-brand-400 [&>p:first-child]:font-bold
                                        [&>p>strong]:block [&>p>strong]:w-full [&>p>strong]:text-center [&>p>strong]:bg-brand-50 dark:[&>p>strong]:bg-brand-900/20 [&>p>strong]:p-4 [&>p>strong]:rounded-xl [&>p>strong]:my-6 [&>p>strong]:border [&>p>strong]:border-brand-100 dark:[&>p>strong]:border-brand-500/20 [&>p>strong]:text-brand-700 dark:[&>p>strong]:text-brand-300
                                        [&>sup]:text-brand-500 [&>sup]:font-bold [&>sup]:mr-1
                                        [&>p]:mb-6
                                        [&_span]:!text-brand-600 dark:[&_span]:!text-brand-400 [&_font]:!text-brand-600 dark:[&_font]:!text-brand-400"
                                        dangerouslySetInnerHTML={{ __html: content[activeTab] }}
                                    />
                                    
                                    <div className="mt-12 pt-8 border-t border-slate-100 dark:border-white/5 text-center">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Palavra do Senhor</p>
                                        <p className="text-sm font-bold text-brand-600 dark:text-brand-400 mt-1">Graças a Deus</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-slate-400">Não foi possível carregar a liturgia.</div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

const SeasonSynopsisModal = ({ seasonKey, onClose }: { seasonKey: string, onClose: () => void }) => {
    const data = SEASON_SYNOPSES[seasonKey];
    if (!data) return null;
    return createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden relative animate-scale-in border border-white/20 dark:border-white/5" onClick={e => e.stopPropagation()}>
                <div className="bg-slate-50 dark:bg-black/20 p-8 border-b border-slate-100 dark:border-white/5 text-center">
                    <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-1 tracking-tight">{data.title}</h2>
                    <p className="text-xs font-bold text-brand-500 uppercase tracking-widest">Guia Litúrgico</p>
                </div>
                <div className="p-8">
                    <div dangerouslySetInnerHTML={{ __html: data.description }} />
                </div>
                <div className="p-6 bg-slate-50 dark:bg-black/20 border-t border-slate-100 dark:border-white/5">
                    <button onClick={onClose} className="w-full py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold uppercase tracking-widest text-xs hover:scale-[1.02] transition-transform">Entendi</button>
                </div>
            </div>
        </div>, document.body
    );
};

const LiturgicalCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<LiturgicalDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<LiturgicalDay | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [cachedDates, setCachedDates] = useState<Set<string>>(new Set());

  const getContextKey = () => {
      const hour = new Date().getHours();
      let period = 'morning';
      if (hour >= 12 && hour < 18) period = 'afternoon';
      else if (hour >= 18 || hour < 5) period = 'night';
      return `calendar_hero_${period}`;
  };

  // Logo adaptado para suportar ciclos diários (Manhã, Tarde, Noite)
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(() => {
      const hour = new Date().getHours();
      let period: 'morning' | 'afternoon' | 'night' = 'morning';
      if (hour >= 12 && hour < 18) period = 'afternoon'; else if (hour >= 18 || hour < 5) period = 'night';
      return getCachedImage(`calendar_hero_${period}`);
  });

  useEffect(() => {
      const data = LiturgicalService.getMonthData(currentDate.getFullYear(), currentDate.getMonth());
      setCalendarData(data);
  }, [currentDate]);

  // Listen for real-time background updates
  useEffect(() => {
      const handleBackgroundUpdate = (e: Event) => {
          const detail = (e as CustomEvent).detail;
          if (detail && detail.contextKey === getContextKey() && detail.imageUrl) {
              setHeroImageUrl(detail.imageUrl);
          }
      };
      
      window.addEventListener('background-update', handleBackgroundUpdate);
      return () => window.removeEventListener('background-update', handleBackgroundUpdate);
  }, []);

  useEffect(() => {
      const loadCacheKeys = async () => {
          // Load local keys first for immediate feedback
          const localKeys = LiturgyLocalStorage.getKeys();
          setCachedDates(new Set(localKeys));
          
          // Optionally sync with remote keys if needed, but local is priority for "offline" status
          // const year = currentDate.getFullYear();
          // const month = currentDate.getMonth(); 
          // const keys = await LiturgyCacheService.getMonthlyKeys(year, month);
          // setCachedDates(prev => new Set([...prev, ...keys]));
      };
      loadCacheKeys();
  }, [currentDate]);

  useEffect(() => {
    const fetchAndSetImage = async () => {
        try {
            // Updated: Will automatically check time of day and use correct cache key
            const newUrl = await generateCatholicChurchImage('calendar_hero');
            if (newUrl) setHeroImageUrl(newUrl); 
        } catch (error) {
            console.warn("Could not generate hero image", error);
        }
    };
    fetchAndSetImage();
  }, []);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const isToday = (d: Date) => {
      const today = new Date();
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };
  
  const handleCacheUpdate = (dateStr: string, hasCache: boolean) => {
      setCachedDates(prev => {
          const newSet = new Set(prev);
          if (hasCache) newSet.add(dateStr); else newSet.delete(dateStr);
          return newSet;
      });
  };

  const firstDayIndex = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const emptyDays = Array(firstDayIndex).fill(null);

  const LegendItem = ({ id, color, label, icon }: { id: string, color: string, label: string, icon: string }) => (
      <button 
        onClick={() => setSelectedSeason(id)}
        className={`flex items-center gap-3 p-3 rounded-2xl border bg-white dark:bg-slate-800 shadow-sm w-full transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 cursor-pointer text-left group ${color}`}
      >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/80 dark:bg-black/20 text-lg font-bold shrink-0 shadow-sm group-hover:scale-110 transition-transform">
              <i className={`fas ${icon}`}></i>
          </div>
          <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider block truncate opacity-80 mb-0.5">Tempo</span>
              <span className="text-xs font-bold block truncate">{label}</span>
          </div>
          <i className="fas fa-info-circle ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-sm"></i>
      </button>
  );

  return (
    <div className="space-y-8 animate-fade-in-up pb-32">
        <div className="relative rounded-[2.5rem] md:rounded-[3rem] overflow-hidden bg-slate-900 shadow-premium group min-h-[240px] md:min-h-[280px] flex flex-col justify-end p-6 md:p-12 border border-slate-100 dark:border-slate-700">
            {heroImageUrl ? (
                <div 
                    className="absolute inset-0 bg-cover bg-center animate-breathing opacity-70"
                    style={{ backgroundImage: `url('${heroImageUrl}')` }}
                ></div>
            ) : (
                <PremiumBackground variant="holy" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent"></div>
            <div className="relative z-10 w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                   <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-[2px] bg-brand-500"></span>
                        <p className="text-brand-300 font-bold uppercase tracking-[0.2em] text-[10px]">Ordo Litúrgico</p>
                   </div>
                   <h1 className="text-4xl md:text-6xl font-display font-bold text-white leading-[0.9] tracking-tight mb-2 text-shadow-lg">
                      Calendário <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-purple-400">Católico</span>
                   </h1>
                   <p className="text-slate-300 font-medium max-w-lg text-sm md:text-base text-shadow-sm">Acompanhe o ritmo da Igreja: Solenidades, Festas, Memórias e os Tempos Litúrgicos.</p>
                </div>
                <div className="flex items-center justify-between w-full md:w-auto gap-4 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/10">
                    <button onClick={prevMonth} className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"><i className="fas fa-chevron-left"></i></button>
                    <div className="text-center min-w-[120px] md:min-w-[140px]">
                        <span className="block text-xs font-bold uppercase tracking-widest text-brand-300">{currentDate.getFullYear()}</span>
                        <span className="block text-xl md:text-2xl font-bold text-white capitalize">{currentDate.toLocaleDateString('pt-BR', { month: 'long' })}</span>
                    </div>
                    <button onClick={nextMonth} className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"><i className="fas fa-chevron-right"></i></button>
                </div>
            </div>
        </div>

        <div className="p-6 md:p-8 rounded-[2.5rem] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm">
            <h3 className="text-xs font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2"><i className="fas fa-book-open"></i> Guia dos Tempos Litúrgicos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                <LegendItem id="ordinary" color="border-green-200 text-green-700 dark:text-green-400 dark:border-green-900/50 bg-green-50 dark:bg-green-900/10" label="Tempo Comum" icon="fa-leaf" />
                <LegendItem id="purple" color="border-purple-200 text-purple-700 dark:text-purple-400 dark:border-purple-900/50 bg-purple-50 dark:bg-purple-900/10" label="Advento/Quaresma" icon="fa-cross" />
                <LegendItem id="solemnity" color="border-amber-200 text-amber-700 dark:text-amber-400 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10" label="Solenidades" icon="fa-star" />
                <LegendItem id="red" color="border-red-200 text-red-700 dark:text-red-400 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10" label="Paixão/Mártires" icon="fa-fire" />
                <LegendItem id="rose" color="border-pink-200 text-pink-700 dark:text-pink-400 dark:border-pink-900/50 bg-pink-50 dark:bg-pink-900/10" label="Domingos Alegria" icon="fa-heart" />
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-4 md:p-8 shadow-sm border border-slate-100 dark:border-white/5">
            <div className="grid grid-cols-7 mb-2 md:mb-4">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, i) => (
                    <div key={i} className={`text-center text-[10px] md:text-xs font-bold uppercase tracking-widest py-2 ${i === 0 ? 'text-red-500' : 'text-slate-400'}`}>{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1 md:gap-4">
                {emptyDays.map((_, i) => <div key={`empty-${i}`} className="aspect-square"></div>)}
                {calendarData.map((day) => {
                    const isTodayFlag = isToday(day.date);
                    const key = getDateKey(day.date);
                    const isCached = cachedDates.has(key);
                    const todayDate = new Date(); todayDate.setHours(0,0,0,0);
                    const isPast = day.date < todayDate;
                    const colorStyles = {
                        green: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-400',
                        purple: 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-900/30 text-purple-700 dark:text-purple-300',
                        red: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400',
                        white: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-400',
                        rose: 'bg-pink-50 dark:bg-pink-900/10 border-pink-200 dark:border-pink-900/30 text-pink-700 dark:text-pink-400',
                        black: 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                    };
                    const baseStyle = colorStyles[day.color];
                    const hasEvent = !!day.title;

                    return (
                        <button 
                            key={day.day}
                            onClick={() => setSelectedDay(day)}
                            className={`aspect-square rounded-xl md:rounded-2xl border flex flex-col justify-between p-1.5 md:p-3 transition-all duration-500 relative group 
                            ${baseStyle} ${isTodayFlag ? 'ring-2 md:ring-4 ring-brand-500/30 shadow-lg scale-105 z-10 opacity-100' : isPast ? 'opacity-40 hover:opacity-100 hover:scale-105 hover:shadow-xl hover:z-10' : 'hover:scale-105 hover:shadow-xl hover:z-10 opacity-100'}`}
                        >
                            <div className="flex justify-between items-start w-full">
                                <span className={`text-xs md:text-lg font-bold ${day.date.getDay() === 0 ? 'text-current' : 'text-inherit'}`}>{day.day}</span>
                                {day.isSolemnity && <i className="fas fa-star text-[8px] md:text-[10px] text-amber-500 animate-pulse"></i>}
                            </div>
                            <div className="w-full">
                                {hasEvent ? <p className="text-[8px] md:text-[10px] font-bold leading-tight line-clamp-2 md:line-clamp-3 text-left opacity-90">{day.title}</p> : <div className="h-1 w-full bg-current opacity-10 rounded-full mt-1 md:mt-2"></div>}
                            </div>
                            {isTodayFlag && <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-brand-600 text-white text-[6px] md:text-[8px] font-bold uppercase px-1.5 py-0.5 md:px-2 md:py-1 rounded-full shadow-md">Hoje</div>}
                            {isCached && <div className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 bg-green-500 text-white w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full shadow-md z-20"><i className="fas fa-check text-[8px] md:text-[10px]"></i></div>}
                        </button>
                    );
                })}
            </div>
        </div>

        {selectedDay && <DayDetailsModal day={selectedDay} onClose={() => setSelectedDay(null)} onCacheChange={handleCacheUpdate} />}
        {selectedSeason && <SeasonSynopsisModal seasonKey={selectedSeason} onClose={() => setSelectedSeason(null)} />}
    </div>
  );
};

export default LiturgicalCalendar;