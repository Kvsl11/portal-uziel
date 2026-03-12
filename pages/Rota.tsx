
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { createPortal } from 'react-dom';
import { fetchLiturgyDetails, generateCatholicChurchImage, getCachedImage, getDateKey } from '../services/geminiService';
import { LiturgyCacheService, ScheduleService, AuditService } from '../services/firebase';
import Loading from '../components/Loading'; 
import PremiumBackground from '../components/PremiumBackground';
import { ScheduleItem } from '../types';

const PsalmModal = ({ date, liturgy, loading, onClose }: { date: Date, liturgy: any | null, loading: boolean, onClose: () => void }) => {
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
      if (liturgy && liturgy._fromCache) {
          setIsSaved(true);
      } else {
          setIsSaved(false);
      }
  }, [liturgy]);

  const handleCopy = () => {
    if (!liturgy) return;
    const textToCopy = `${liturgy.title}\n\n${liturgy.psalm.replace(/<[^>]+>/g, '')}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
      if (!liturgy) return;
      setSaving(true);
      try {
          const dateKey = getDateKey(date);
          await LiturgyCacheService.save(dateKey, liturgy);
          setIsSaved(true);
      } catch (e) {
          console.error(e);
          alert("Erro ao salvar.");
      } finally {
          setSaving(false);
      }
  };

  const handleDelete = async () => {
      setSaving(true);
      try {
          const dateKey = getDateKey(date);
          await LiturgyCacheService.delete(dateKey);
          setIsSaved(false);
      } catch (e) {
          console.error(e);
          alert("Erro ao excluir cache.");
      } finally {
          setSaving(false);
      }
  };

  const renderContent = () => {
    if (!liturgy) return null;
    let cleanContent = liturgy.psalm;
    const titleRegex = new RegExp(`^<[^>]*>${liturgy.title.split('(')[0]}[^<]*</[^>]*>`, 'i');
    cleanContent = cleanContent.replace(titleRegex, '');
    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="text-center border-b border-slate-100 dark:border-white/5 pb-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xl mx-auto mb-3 shadow-sm border border-brand-100 dark:border-brand-500/20">
                    <i className="fas fa-book-bible"></i>
                </div>
                <h3 className="text-xl md:text-2xl font-display font-bold text-slate-800 dark:text-white leading-tight mb-1 px-4">{liturgy.title.replace(/–|-/g, ' — ')}</h3>
                <p className="text-[10px] md:text-xs font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest">Liturgia da Palavra</p>
            </div>
            <div className="bg-white dark:bg-slate-800/50 rounded-[2rem] p-4 md:p-8 shadow-sm border border-slate-100 dark:border-white/5">
                <div 
                    className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 font-serif text-base md:text-lg leading-relaxed
                    [&>strong]:block [&>strong]:w-full [&>strong]:text-center [&>strong]:text-brand-600 dark:[&>strong]:text-brand-400 [&>strong]:font-sans [&>strong]:font-black [&>strong]:text-base md:[&>strong]:text-lg [&>strong]:uppercase [&>strong]:tracking-wider [&>strong]:my-8 [&>strong]:py-6 [&>strong]:px-4 [&>strong]:bg-brand-50 dark:[&>strong]:bg-brand-900/20 [&>strong]:rounded-2xl [&>strong]:border [&>strong]:border-brand-100 dark:[&>strong]:border-brand-500/30 [&>strong]:shadow-sm
                    [&>h3]:text-brand-600 dark:[&>h3]:text-brand-400 [&>h3]:font-black [&>h3]:text-xl
                    [&>p]:mb-8 [&>p]:pl-4 [&>p]:border-l-4 [&>p]:border-slate-200 dark:[&>p]:border-slate-700
                    [&_span]:!text-brand-600 dark:[&_span]:!text-brand-400 [&_font]:!text-brand-600 dark:[&_font]:!text-brand-400"
                    dangerouslySetInnerHTML={{ __html: cleanContent }} 
                />
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Palavra do Senhor</p>
                    <p className="text-sm font-bold text-brand-600 dark:text-brand-400 mt-1">Graças a Deus</p>
                </div>
            </div>
        </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-white dark:bg-[#0b1221] animate-fade-in flex flex-col">
        <div className="w-full h-full flex flex-col relative overflow-hidden">
            <div className="p-3 md:p-4 flex justify-between items-center bg-white/80 dark:bg-[#0b1221]/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-100 dark:border-white/5">
                 <div className="flex items-center gap-2">
                     <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-widest border border-slate-200 dark:border-white/10">
                        <i className="fas fa-calendar-day text-brand-500"></i>
                        {date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                     </div>
                     {!loading && liturgy && (
                        isSaved ? (
                            <div className="flex items-center gap-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/80 text-white text-[10px] font-bold uppercase tracking-widest border border-green-400/30 animate-scale-in shadow-md">
                                    <i className="fas fa-cloud-download-alt"></i> Salvo
                                </div>
                                <button onClick={handleDelete} disabled={saving} className="w-7 h-7 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center backdrop-blur-md border border-red-500/30 disabled:opacity-50">
                                    {saving ? <i className="fas fa-circle-notch fa-spin text-[10px]"></i> : <i className="fas fa-trash text-[10px]"></i>}
                                </button>
                            </div>
                        ) : (
                            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-600 text-white text-[10px] font-bold uppercase tracking-widest border border-brand-500 shadow-md hover:bg-brand-500 transition-colors disabled:opacity-50">
                                {saving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>} Salvar
                            </button>
                        )
                     )}
                 </div>
                <div className="flex gap-2">
                    {liturgy && !loading && (
                        <button onClick={handleCopy} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border ${copied ? 'bg-green-500 text-white border-green-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-brand-600 hover:bg-white border-slate-100 dark:border-slate-700'}`}><i className={copied ? "fas fa-check text-xs" : "fas fa-copy text-xs"}></i></button>
                    )}
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-all border border-slate-100 dark:border-slate-700"><i className="fas fa-times text-xs"></i></button>
                </div>
            </div>
            <div className="p-4 md:p-8 overflow-y-auto custom-scrollbar flex-1 relative bg-slate-50/30 dark:bg-black/20">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 space-y-6">
                        <div className="relative"><div className="w-20 h-20 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div><div className="absolute inset-0 border-4 border-t-brand-500 border-r-transparent border-b-brand-300 border-l-transparent rounded-full animate-spin"></div><i className="fas fa-book-open absolute inset-0 flex items-center justify-center text-slate-300 text-xl animate-pulse"></i></div>
                        <div className="text-center"><p className="text-slate-800 dark:text-white font-bold text-lg mb-1">Consultando o Missal</p><p className="text-slate-400 text-xs font-medium">Buscando o salmo do dia...</p></div>
                    </div>
                ) : liturgy ? renderContent() : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-60"><div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4"><i className="fas fa-bible text-4xl text-slate-300"></i></div><p className="font-bold text-slate-600 dark:text-slate-400">Salmo não disponível</p></div>
                )}
            </div>
        </div>
    </div>,
    document.body
  );
};


const Rota: React.FC = () => {
  const { usersList, currentUser, checkPermission } = useAuth();
  const [schedule, setSchedule] = useState<{date: string, salmista: string, substituto: string, fullDate: Date}[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'titular' | 'reserva'>('all');
  const [liturgyData, setLiturgyData] = useState<any | null>(null);
  const [isPsalmLoading, setIsPsalmLoading] = useState(false);
  const [psalmModalDate, setPsalmModalDate] = useState<Date | null>(null);

  const [swapModal, setSwapModal] = useState<{isOpen: boolean, sourceDate: Date | null}>({isOpen: false, sourceDate: null});
  const [targetSwapDate, setTargetSwapDate] = useState<string>('');

  const canEdit = checkPermission('scales', 'edit');
  const canCreate = checkPermission('scales', 'create');

  const handleSwapClick = (date: Date) => {
      setSwapModal({ isOpen: true, sourceDate: date });
      setTargetSwapDate('');
  };

  const confirmSwap = async () => {
      if (!swapModal.sourceDate || !targetSwapDate) return;
      
      const sourceDateStr = swapModal.sourceDate.toISOString();
      const targetDateStr = new Date(targetSwapDate).toISOString();

      const newSchedule = [...schedule];
      const sourceIdx = newSchedule.findIndex(s => s.fullDate.toISOString() === sourceDateStr);
      const targetIdx = newSchedule.findIndex(s => s.fullDate.toISOString() === targetDateStr);

      if (sourceIdx === -1 || targetIdx === -1) {
          alert("Erro ao encontrar datas para troca.");
          return;
      }

      // Swap teams
      const tempSalmista = newSchedule[sourceIdx].salmista;
      const tempSubstituto = newSchedule[sourceIdx].substituto;

      newSchedule[sourceIdx].salmista = newSchedule[targetIdx].salmista;
      newSchedule[sourceIdx].substituto = newSchedule[targetIdx].substituto;

      newSchedule[targetIdx].salmista = tempSalmista;
      newSchedule[targetIdx].substituto = tempSubstituto;

      setSchedule(newSchedule);
      setSwapModal({ isOpen: false, sourceDate: null });
      
      // Save to backend
      try {
          // Format back for saving
          const toSave = newSchedule.map(s => ({
              date: s.date,
              fullDate: s.fullDate.toISOString(),
              salmista: s.salmista,
              substituto: s.substituto
          }));
          await ScheduleService.save(toSave);
          if (currentUser) {
              await AuditService.log(currentUser.username, 'Rota', 'UPDATE', `Trocou escala do dia ${swapModal.sourceDate.toLocaleDateString('pt-BR')} com ${new Date(targetSwapDate).toLocaleDateString('pt-BR')}`, currentUser.role, currentUser.name);
          }
      } catch (e) {
          console.error("Erro ao salvar troca", e);
          alert("Erro ao salvar a troca na nuvem.");
      }
  };

  const getContextKey = () => {
      const hour = new Date().getHours();
      let period = 'morning';
      if (hour >= 12 && hour < 18) period = 'afternoon';
      else if (hour >= 18 || hour < 5) period = 'night';
      return `rota_hero_${period}`;
  };

  // Logo adaptado para suportar ciclos diários (Manhã, Tarde, Noite)
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(() => {
      const hour = new Date().getHours();
      let period: 'morning' | 'afternoon' | 'night' = 'morning';
      if (hour >= 12 && hour < 18) period = 'afternoon'; else if (hour >= 18 || hour < 5) period = 'night';
      return getCachedImage(`rota_hero_${period}`);
  });

  const eligibleMembers = useMemo(() => {
    const excludedNames = ['JULIO CÉSAR', 'JULIO CESAR', 'JÚLIO CESAR', 'JÚLIO CÉSAR', 'JULIO', 'ALEXANDRE MANDELI', 'MEL BUZZO'];
    return usersList
        .filter(u => (u.role === 'member' || u.role === 'admin' || u.role === 'super-admin') && !excludedNames.includes(u.name))
        .map(u => u.name);
  }, [usersList]);
  
  const handleShowPsalm = async (date: Date) => {
    setPsalmModalDate(date);
    setIsPsalmLoading(true);
    setLiturgyData(null);
    try {
      const result = await fetchLiturgyDetails(date, true);
      
      // Log Audit if fresh fetch (not strictly robust but good enough for user action tracking)
      if (currentUser && !result._fromCache) {
          await AuditService.log(
              currentUser.username,
              'Liturgy',
              'AI_LITURGY', // Special action for SystemAdmin tracking
              `Fetched Psalm for ${date.toLocaleDateString('pt-BR')}`,
              currentUser.role,
              currentUser.name
          );
      }

      setLiturgyData(result);
    } catch (error) {
      console.error(error);
      setLiturgyData({ title: "Erro ao buscar", psalm: "Não foi possível conectar ao serviço." });
    } finally {
      setIsPsalmLoading(false);
    }
  };

  const closePsalmModal = () => { setPsalmModalDate(null); setLiturgyData(null); };

  const saveNewSchedule = async (newSchedule: any[]) => {
      try {
          await ScheduleService.save(newSchedule);
          if (currentUser) {
              await AuditService.log(currentUser.username, 'Rota', 'UPDATE', 'Gerou nova escala de salmistas', currentUser.role, currentUser.name);
          }
      } catch (e) { console.error(e); }
  };

  const generateSchedule = async (forceRandom = false) => {
    setLoading(true); setSelectedMember('all'); setFilterType('all');
    await new Promise(resolve => setTimeout(resolve, 500));
    const now = new Date();
    let baseSeed = forceRandom ? Math.random() * 10000 : now.getFullYear() * 100 + now.getMonth();
    const seededRandom = () => { const x = Math.sin(baseSeed++) * 10000; return x - Math.floor(x); };
    const shuffle = (array: string[]) => {
        let m = array.length, t, i; let arr = [...array];
        while (m) { i = Math.floor(seededRandom() * m--); t = arr[m]; arr[m] = arr[i]; arr[i] = t; }
        return arr;
    };
    if (eligibleMembers.length < 2) { setLoading(false); alert("Membros insuficientes."); return; }
    const order1 = shuffle(eligibleMembers);
    const order2 = shuffle(eligibleMembers);
    const newSchedule = [];
    let idx1 = 0, idx2 = 0;
    for (let i = 0; i < 24; i++) { 
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const firstSunday = new Date(d.setDate(d.getDate() + (7 - d.getDay()) % 7));
        let main = order1[idx1 % order1.length];
        let sub = order2[idx2 % order2.length];
        if (main === sub) { idx2++; sub = order2[idx2 % order2.length]; }
        newSchedule.push({
            date: firstSunday.toLocaleDateString('pt-BR', { month: 'long', day: 'numeric' }),
            fullDate: firstSunday.toISOString(),
            salmista: main,
            substituto: sub
        });
        idx1++; idx2++;
    }
    await saveNewSchedule(newSchedule);
    const localFormat = newSchedule.map(s => ({ ...s, fullDate: new Date(s.fullDate) }));
    setSchedule(localFormat);
    setLoading(false);
  };

  useEffect(() => {
      const initSchedule = async () => {
          if (eligibleMembers.length === 0) { setLoading(false); return; }
          try {
              const savedData = await ScheduleService.get();
              if (savedData && savedData.length > 0) {
                  const parsed = savedData.map((item: any) => ({ ...item, fullDate: new Date(item.fullDate) }));
                  setSchedule(parsed);
              } else { await generateSchedule(false); }
          } catch (e) { console.error(e); } finally { setLoading(false); }
      };
      initSchedule();
  }, [eligibleMembers]);

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
    const fetchAndSetImage = async () => {
        try {
            const newUrl = await generateCatholicChurchImage('rota_hero');
            if (newUrl) setHeroImageUrl(newUrl); 
        } catch (error) { console.warn(error); }
    };
    fetchAndSetImage();
  }, []);

  const displayedSchedule = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return schedule.filter(s => {
      const isFutureDate = s.fullDate >= today;
      if (!isFutureDate) return false;
      if (selectedMember === 'all') return true;
      const isMain = s.salmista === selectedMember;
      const isSub = s.substituto === selectedMember;
      if (filterType === 'all') return isMain || isSub;
      if (filterType === 'titular') return isMain;
      if (filterType === 'reserva') return isSub;
      return false;
    });
  }, [schedule, selectedMember, filterType]);

  const nextSchedule = displayedSchedule[0] || null;
  const getUserProfile = (name: string) => usersList.find(u => u.name === name);

  if (loading) return <Loading fullScreen message="Carregando Escala..." />;

  return (
    <>
      <div className="space-y-10 animate-fade-in-up pb-32">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-100 dark:border-white/5 pb-8 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2"><span className="w-8 h-[2px] bg-brand-500"></span><p className="text-brand-600 dark:text-brand-400 font-bold uppercase tracking-[0.2em] text-[10px]">Calendário Litúrgico</p></div>
              <h1 className="text-4xl md:text-6xl font-display font-bold text-slate-900 dark:text-white leading-[0.9] tracking-tight">Escala de <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-sky-500">Salmistas</span></h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium max-w-md">Planejamento anual dos ministros do salmo e suas substituições.</p>
            </div>
            {(canCreate) && (
                <button onClick={() => generateSchedule(true)} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-2xl font-bold hover:bg-brand-600 transition-all shadow-lg hover:scale-105 flex items-center gap-2 text-xs uppercase tracking-widest"><i className="fas fa-magic"></i><span>Gerar Nova Escala</span></button>
            )}
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-4 shadow-sm border border-slate-100 dark:border-white/5 flex flex-col xl:flex-row gap-6 relative z-20 items-center">
            <div className="flex-1 w-full bg-slate-50 dark:bg-white/5 p-2 pl-3 rounded-[2rem] flex items-center relative group focus-within:ring-2 focus-within:ring-brand-500/20 transition-all border border-slate-200 dark:border-white/5">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-white/10 flex items-center justify-center text-brand-500 text-xl shadow-sm"><i className="fas fa-user-circle"></i></div>
                <div className="flex-1 px-4 min-w-0">
                     <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Filtrar por Membro</label>
                     <div className="relative">
                        <select value={selectedMember} onChange={(e) => { setSelectedMember(e.target.value); setFilterType('all'); }} className="w-full bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl outline-none font-bold text-slate-700 dark:text-white appearance-none cursor-pointer relative z-10 text-sm md:text-base truncate pr-6">
                            <option value="all">Visualizar Geral (Todos)</option>
                            {eligibleMembers.sort().map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <i className="fas fa-chevron-down absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                     </div>
                </div>
            </div>
            <div className="hidden xl:block w-px h-12 bg-slate-100 dark:bg-white/10"></div>
            <div className={`w-full xl:w-auto grid grid-cols-3 gap-2 transition-all duration-300 ${selectedMember === 'all' ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                 {[ { id: 'all', label: 'Todos', icon: 'fa-layer-group' }, { id: 'titular', label: 'Titular', icon: 'fa-microphone-alt' }, { id: 'reserva', label: 'Reserva', icon: 'fa-clipboard-user' } ].map((opt) => (
                     <button key={opt.id} onClick={() => setFilterType(opt.id as any)} className={`px-4 py-3 rounded-[1.5rem] text-[10px] font-bold uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all whitespace-nowrap border ${filterType === opt.id ? opt.id === 'titular' ? 'bg-brand-600 text-white border-brand-600 shadow-lg' : opt.id === 'reserva' ? 'bg-amber-500 text-white border-amber-500 shadow-lg' : 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-slate-800 dark:border-white shadow-lg' : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                         <i className={`fas ${opt.icon}`}></i> {opt.label}
                     </button>
                 ))}
            </div>
        </div>

        {nextSchedule && (
            <div className="relative overflow-hidden rounded-[3rem] shadow-2xl group animate-fade-in-up delay-100 border border-slate-200/50 dark:border-white/10">
                {heroImageUrl ? <div className="absolute inset-0 bg-cover bg-center animate-breathing" style={{ backgroundImage: `url('${heroImageUrl}')` }}></div> : <PremiumBackground variant="holy" />}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-slate-900/40"></div>
                <div className="relative z-10 p-8 md:p-16 text-white flex flex-col md:flex-row gap-12 items-center justify-between">
                    <div className="flex-1 w-full">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-bold uppercase tracking-widest mb-6 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> 
                            {selectedMember === 'all' ? 'Próxima Escala Geral' : `Próxima de ${selectedMember.split(' ')[0]}`}
                        </div>
                        <h3 className="text-5xl lg:text-8xl font-display font-bold mb-4 capitalize leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70">
                            {nextSchedule.date}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 mt-8">
                            <button onClick={() => handleShowPsalm(nextSchedule.fullDate)} className="px-8 py-4 rounded-full bg-brand-500 text-white text-xs font-bold uppercase tracking-widest hover:bg-brand-400 transition-all shadow-[0_0_20px_rgba(41,170,226,0.4)] flex items-center gap-2 hover:scale-105 transform duration-300">
                                <i className="fas fa-book-open"></i> Ver Salmo do Dia
                            </button>
                            {(canEdit) && (
                                <button onClick={() => handleSwapClick(nextSchedule.fullDate)} className="px-6 py-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold uppercase tracking-widest hover:bg-white/20 transition-all shadow-lg flex items-center gap-2 hover:scale-105 transform duration-300">
                                    <i className="fas fa-exchange-alt"></i> Trocar
                                </button>
                            )}
                            <p className="text-slate-300 text-sm font-medium opacity-90 hidden md:block border-l border-white/20 pl-4">
                                Prepare-se para ministrar a Palavra.
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-6 w-full md:w-auto justify-center md:justify-end">
                        <div className={`flex flex-col items-center p-6 rounded-[2rem] bg-white/10 backdrop-blur-md border border-white/20 shadow-xl transition-all duration-300 ${(filterType === 'reserva' && selectedMember !== 'all') ? 'opacity-40 scale-95 blur-[2px]' : 'opacity-100 hover:-translate-y-2'}`}>
                            <div className="w-28 h-28 rounded-full bg-white text-brand-600 flex items-center justify-center text-4xl font-bold shadow-inner mb-4 border-4 border-white/30 overflow-hidden">
                                {getUserProfile(nextSchedule.salmista)?.photoURL ? <img src={getUserProfile(nextSchedule.salmista)?.photoURL} className="w-full h-full object-cover" /> : nextSchedule.salmista.charAt(0)}
                            </div>
                            <p className="font-bold text-xl text-white text-center">{nextSchedule.salmista}</p>
                            <p className="text-[10px] uppercase tracking-widest text-brand-300 font-bold mt-1 bg-brand-900/50 px-3 py-1 rounded-full">Titular</p>
                        </div>
                        
                        <div className={`flex flex-col items-center p-6 rounded-[2rem] bg-black/20 backdrop-blur-md border border-white/10 shadow-lg transition-all duration-300 ${(filterType === 'titular' && selectedMember !== 'all') ? 'opacity-40 scale-95 blur-[2px]' : 'opacity-100 hover:-translate-y-2'}`}>
                            <div className="w-24 h-24 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-3xl font-bold mb-4 border-2 border-white/20 overflow-hidden">
                                {getUserProfile(nextSchedule.substituto)?.photoURL ? <img src={getUserProfile(nextSchedule.substituto)?.photoURL} className="w-full h-full object-cover" /> : nextSchedule.substituto.charAt(0)}
                            </div>
                            <p className="font-bold text-lg text-slate-200 text-center">{nextSchedule.substituto}</p>
                            <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mt-1 bg-amber-900/30 px-3 py-1 rounded-full">Reserva</p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pt-8">
            {displayedSchedule.map((row, idx) => {
                const isPassed = row.fullDate < new Date(new Date().setHours(0,0,0,0)); 
                const isNext = row === nextSchedule;
                if (isNext) return null; // Skip next schedule as it's in the hero

                const highlightMain = selectedMember !== 'all' && row.salmista === selectedMember;
                const highlightSub = selectedMember !== 'all' && row.substituto === selectedMember;
                const salmistaUser = getUserProfile(row.salmista); 
                const substitutoUser = getUserProfile(row.substituto);
                
                return (
                    <div key={idx} className={`bg-white dark:bg-slate-800/50 rounded-[2rem] p-6 shadow-sm hover:shadow-xl border transition-all duration-300 flex flex-col ${isPassed ? 'opacity-60 grayscale hover:grayscale-0' : ''} border-slate-200 dark:border-white/5 hover:-translate-y-1`}>
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex flex-col items-center justify-center text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-500/20 shrink-0">
                                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">{row.fullDate.toLocaleDateString('pt-BR', {month:'short'}).replace('.', '')}</span>
                                    <span className="text-xl font-black leading-none">{row.fullDate.getDate()}</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-slate-800 dark:text-white capitalize leading-tight">{row.date.split(' de ')[0]}</h4>
                                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{row.fullDate.getFullYear()}</span>
                                </div>
                            </div>
                            <button onClick={() => handleShowPsalm(row.fullDate)} className="w-10 h-10 rounded-full bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 flex items-center justify-center transition-all" title="Ver Salmo">
                                <i className="fas fa-book-open"></i>
                            </button>
                            {(canEdit) && !isPassed && (
                                <button onClick={() => handleSwapClick(row.fullDate)} className="w-10 h-10 rounded-full bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center justify-center transition-all" title="Trocar Salmistas">
                                    <i className="fas fa-exchange-alt"></i>
                                </button>
                            )}
                        </div>
                        
                        <div className="space-y-3 mt-auto">
                            <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${highlightMain ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-200 dark:border-brand-500/30' : 'bg-slate-50 dark:bg-white/5 border-transparent'}`}>
                                <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-brand-600 font-bold text-sm shadow-sm overflow-hidden shrink-0">
                                    {salmistaUser?.photoURL ? <img src={salmistaUser.photoURL} className="w-full h-full object-cover" /> : row.salmista.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[9px] text-brand-500 uppercase font-black tracking-widest mb-0.5">Titular</p>
                                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm truncate">{row.salmista}</p>
                                </div>
                            </div>
                            
                            <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${highlightSub ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30' : 'bg-transparent border-slate-100 dark:border-white/5'}`}>
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0 overflow-hidden">
                                    {substitutoUser?.photoURL ? <img src={substitutoUser.photoURL} className="w-full h-full object-cover" /> : row.substituto.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Reserva</p>
                                    <p className="font-bold text-slate-600 dark:text-slate-400 text-xs truncate">{row.substituto}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
      {psalmModalDate && <PsalmModal date={psalmModalDate} liturgy={liturgyData} loading={isPsalmLoading} onClose={closePsalmModal} />}
      
      {swapModal.isOpen && swapModal.sourceDate && createPortal(
          <div className="fixed inset-0 z-[10000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
              <div className="w-full max-w-md bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-white/20 animate-scale-in">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-500 flex items-center justify-center text-3xl mx-auto mb-6 shadow-sm border border-amber-100 dark:border-amber-500/20">
                      <i className="fas fa-exchange-alt"></i>
                  </div>
                  <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-2 text-center">Trocar Salmistas</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium text-center">
                      Selecione uma data futura para trocar a dupla de salmistas com o dia <strong>{swapModal.sourceDate.toLocaleDateString('pt-BR')}</strong>.
                  </p>
                  
                  <div className="mb-8">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Data para Troca</label>
                      <div className="relative">
                          <select 
                              value={targetSwapDate} 
                              onChange={(e) => setTargetSwapDate(e.target.value)}
                              className="w-full px-4 py-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-700 dark:text-white focus:border-brand-500 outline-none transition-colors appearance-none cursor-pointer"
                          >
                              <option value="" disabled>Selecione uma data...</option>
                              {schedule
                                  .filter(s => s.fullDate > new Date(new Date().setHours(0,0,0,0)) && s.fullDate.toISOString() !== swapModal.sourceDate?.toISOString())
                                  .map(s => (
                                      <option key={s.fullDate.toISOString()} value={s.fullDate.toISOString()}>
                                          {s.date} - {s.salmista} & {s.substituto}
                                      </option>
                                  ))
                              }
                          </select>
                          <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                      </div>
                  </div>

                  <div className="flex gap-3">
                      <button onClick={() => setSwapModal({isOpen: false, sourceDate: null})} className="flex-1 py-4 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                          Cancelar
                      </button>
                      <button onClick={confirmSwap} disabled={!targetSwapDate} className="flex-1 py-4 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30">
                          Confirmar Troca
                      </button>
                  </div>
              </div>
          </div>,
          document.body
      )}
    </>
  );
};

export default Rota;