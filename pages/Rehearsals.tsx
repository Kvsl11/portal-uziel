
// ... existing imports ...
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { RehearsalService, RepertoryService, PlaylistService, AuditService } from '../services/firebase';
import { Rehearsal, Repertory, Playlist } from '../types';
import Loading from '../components/Loading';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import ChordRenderer from '../components/ChordRenderer';
import { REPERTORY_COVERS } from '../constants';
import { MediaUtils } from '../utils/mediaUtils';

// ... (RepertoryQuickView and MediaPlayerOverlay remain unchanged) ...
// (Omitting their full body to save space, assuming they are preserved as requested in structure rules, but I will include them to be safe if strict full replacement is needed. For safety I include all code.)

const RepertoryQuickView = ({ rep, onClose }: { rep: Repertory, onClose: () => void }) => {
    const bgImage = rep.coverImage || REPERTORY_COVERS[0];
    const [activeSongIndex, setActiveSongIndex] = useState<number | null>(null);

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-4xl bg-white dark:bg-slate-900 h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative animate-scale-in">
                <button onClick={onClose} className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors backdrop-blur-md"><i className="fas fa-times"></i></button>
                
                {/* Header Image */}
                <div className="h-48 relative shrink-0">
                    <img 
                        src={bgImage} 
                        onError={(e) => { e.currentTarget.src = REPERTORY_COVERS[0]; }}
                        alt="Repertory Cover"
                        className="absolute inset-0 w-full h-full object-cover animate-breathing"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
                    <div className="absolute bottom-6 left-8 text-white">
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-brand-500 px-2 py-1 rounded-md mb-2 inline-block">Repertório Vinculado</span>
                        <h2 className="text-3xl font-bold font-display">{rep.theme}</h2>
                        <p className="text-sm opacity-80">{new Date(rep.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {rep.songs.length} músicas</p>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Song List Sidebar */}
                    <div className="w-1/3 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-white/5 overflow-y-auto hidden md:block">
                        <div className="p-4 space-y-2">
                            {rep.songs.map((song, idx) => (
                                <button 
                                    key={song.id} 
                                    onClick={() => setActiveSongIndex(idx)}
                                    className={`w-full text-left p-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${activeSongIndex === idx ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm border border-slate-200 dark:border-white/10' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-white/5'}`}
                                >
                                    <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-black/20 flex items-center justify-center text-[10px]">{idx + 1}</span>
                                    <div className="truncate">
                                        <div className="truncate">{song.title}</div>
                                        <div className="text-[10px] text-slate-400 font-normal uppercase">{song.type}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 p-6 md:p-8 custom-scrollbar relative">
                        {activeSongIndex !== null ? (
                            <div className="max-w-2xl mx-auto">
                                <div className="mb-6 pb-4 border-b border-slate-100 dark:border-white/5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-1 rounded bg-slate-100 dark:bg-white/10 text-[10px] font-bold uppercase text-slate-500">{rep.songs[activeSongIndex].type}</span>
                                        {rep.songs[activeSongIndex].key && <span className="px-2 py-1 rounded bg-brand-100 dark:bg-brand-900/30 text-[10px] font-bold text-brand-600 dark:text-brand-400">Tom: {rep.songs[activeSongIndex].key}</span>}
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{rep.songs[activeSongIndex].title}</h3>
                                    {rep.songs[activeSongIndex].artist && <p className="text-sm text-slate-400 font-medium">{rep.songs[activeSongIndex].artist}</p>}
                                </div>
                                <ChordRenderer text={rep.songs[activeSongIndex].lyrics} />
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                <i className="fas fa-music text-4xl mb-4"></i>
                                <p className="text-sm font-bold uppercase tracking-widest">Selecione uma música</p>
                            </div>
                        )}
                        
                        {/* Mobile Song Selector (Floating) */}
                        <div className="md:hidden fixed bottom-6 left-4 right-4">
                            <select 
                                onChange={(e) => setActiveSongIndex(Number(e.target.value))}
                                className="w-full p-4 rounded-2xl bg-slate-800 text-white font-bold shadow-xl border border-white/10 outline-none appearance-none"
                                value={activeSongIndex !== null ? activeSongIndex : ""}
                            >
                                <option value="" disabled>Selecionar Música...</option>
                                {rep.songs.map((s, i) => <option key={s.id} value={i}>{i+1}. {s.title}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const MediaPlayerOverlay = ({ url, onClose }: { url: string, onClose: () => void }) => {
    const info = MediaUtils.parseUrl(url);
    const embedUrl = MediaUtils.getEmbedUrl(url);
    
    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-fade-in">
            <button onClick={onClose} className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all z-50"><i className="fas fa-times text-xl"></i></button>
            <div className="w-full max-w-6xl h-full max-h-[90vh] flex flex-col items-center justify-center relative z-10 p-2 md:p-4 landscape:p-1 landscape:flex-row landscape:gap-8">
                {embedUrl ? (
                    info.type === 'spotify' ? (
                        <div className="w-full max-w-md h-[70vh] rounded-[1.5rem] md:rounded-[2rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden relative group">
                            <iframe
                                src={embedUrl}
                                className="w-full h-full"
                                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                                title="Spotify Player"
                            ></iframe>
                        </div>
                    ) : ( // Fallback for other types
                        <div className="w-full max-w-5xl aspect-video rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 bg-black relative">
                            <iframe src={embedUrl} className="w-full h-full" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" title="Player"></iframe>
                        </div>
                    )
                ) : (
                    // Fallback for non-embeddable links
                    <div className="text-center text-white bg-white/5 backdrop-blur-xl p-10 md:p-16 rounded-[3rem] border border-white/10 max-w-lg w-full relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative z-10">
                            <div className="w-24 h-24 rounded-3xl bg-white/10 flex items-center justify-center mx-auto mb-8 shadow-inner border border-white/10">
                                <i className="fas fa-external-link-alt text-5xl text-brand-400"></i>
                            </div>
                            <h3 className="text-3xl font-display font-bold mb-2">Link Externo</h3>
                            <p className="text-slate-400 mb-8 font-medium">Este conteúdo será aberto em uma nova aba.</p>
                            <a href={url} target="_blank" rel="noreferrer" className="inline-flex px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold hover:scale-105 transition-transform gap-3 items-center shadow-lg hover:shadow-white/20">
                                <span>Acessar Conteúdo</span>
                                <i className="fas fa-arrow-right"></i>
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

const Rehearsals: React.FC = () => {
  const { currentUser, usersList, checkPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'schedule' | 'create'>('schedule');
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [repertories, setRepertories] = useState<Repertory[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- Filter State ---
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'past'>('all');

  // --- View States ---
  const [viewingRep, setViewingRep] = useState<Repertory | null>(null);
  const [activeMediaUrl, setActiveMediaUrl] = useState<string | null>(null);

  // --- Form State ---
  const [formData, setFormData] = useState<Partial<Rehearsal>>({
      date: '',
      time: '',
      type: 'Ensaio', // Default type
      topic: '',
      location: '', // Initialize location
      notes: '',
      repertoryId: '',
      playlistIds: [],
      participants: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomType, setIsCustomType] = useState(false);

  // --- Notification Modal State ---
  const [notificationModal, setNotificationModal] = useState<{
      isOpen: boolean;
      rehearsal: Rehearsal | null;
  }>({ isOpen: false, rehearsal: null });
  
  const [isInviteCopied, setIsInviteCopied] = useState(false);

  // --- Delete Modal State ---
  const [deleteModal, setDeleteModal] = useState<{
      isOpen: boolean;
      id: string | null;
  }>({ isOpen: false, id: null });

  // Permissions
  const canCreate = checkPermission('rehearsals', 'create');
  const canEdit = checkPermission('rehearsals', 'edit');
  const canDelete = checkPermission('rehearsals', 'delete');
  const isSuperAdmin = currentUser?.role === 'super-admin';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super-admin';

  // Load Data
  useEffect(() => {
    const unsubRehearsals = RehearsalService.subscribe((data) => {
        setRehearsals(data as Rehearsal[]);
        setLoading(false);
    });
    const unsubReps = RepertoryService.subscribe((data) => {
        setRepertories(data as Repertory[]);
    });
    const unsubPlaylists = PlaylistService.subscribe((data) => {
        setPlaylists(data as Playlist[]);
    });

    return () => { unsubRehearsals(); unsubReps(); unsubPlaylists(); };
  }, []);

  const handleInputChange = (field: keyof Rehearsal, value: any) => {
      setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleParticipant = (username: string) => {
      setFormData(prev => {
          const current = prev.participants || [];
          if (current.includes(username)) {
              return { ...prev, participants: current.filter(u => u !== username) };
          } else {
              return { ...prev, participants: [...current, username] };
          }
      });
  };

  const togglePlaylist = (id: string) => {
      setFormData(prev => {
          const current = prev.playlistIds || [];
          if (current.includes(id)) {
              return { ...prev, playlistIds: current.filter(p => p !== id) };
          } else {
              return { ...prev, playlistIds: [...current, id] };
          }
      });
  };

  const selectAllParticipants = () => {
      const allIds = usersList.map(u => u.username);
      setFormData(prev => ({ ...prev, participants: allIds }));
  };

  const formatDateForStorage = (dateStr: string) => {
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('/');
    if (!day || !month || !year) return dateStr;
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!day || !month || !year) return dateStr;
    return `${day}/${month}/${year}`;
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    if (value.length >= 5) {
      value = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
    } else if (value.length >= 3) {
      value = `${value.slice(0, 2)}/${value.slice(2)}`;
    }
    handleInputChange('date', value);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 3) {
      value = `${value.slice(0, 2)}:${value.slice(2)}`;
    }
    handleInputChange('time', value);
  };

  const handleSubmit = async () => {
      if (!formData.topic || !formData.date || !formData.time || !formData.type) {
          alert("Por favor, preencha Tipo, Data, Hora e Tema do evento.");
          return;
      }

      setIsSubmitting(true);
      try {
          // Construct Payload
          const payload = {
              ...formData,
              date: formatDateForStorage(formData.date),
              createdBy: formData.id ? formData.createdBy : (currentUser?.username || 'unknown'), // Preserve creator on edit
              playlistIds: formData.playlistIds || [],
              participants: formData.participants || []
          };

          // Save
          await RehearsalService.save(payload, formData.id);
          
          if (currentUser) {
              const action = formData.id ? 'UPDATE' : 'CREATE';
              const detailPrefix = formData.id ? 'Atualizou' : 'Agendou';
              AuditService.log(
                  currentUser.username, 
                  'Rehearsals', 
                  action, 
                  `${detailPrefix} evento: ${payload.topic} (${payload.date})`, 
                  currentUser.role, 
                  currentUser.name
              );
          }

          // Show Notification Modal
          setNotificationModal({ 
              isOpen: true, 
              rehearsal: { ...payload, id: formData.id || 'temp-id' } as Rehearsal 
          });

          // Reset Form if creating new
          if (!formData.id) {
              setFormData({
                  date: '',
                  time: '',
                  type: 'Ensaio',
                  topic: '',
                  location: '',
                  notes: '',
                  repertoryId: '',
                  playlistIds: [],
                  participants: []
              });
              setIsCustomType(false);
          }
          
      } catch (error) {
          console.error("Error saving rehearsal:", error);
          alert("Erro ao salvar ensaio.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleEdit = (rehearsal: Rehearsal) => {
      setFormData({
          ...rehearsal,
          date: formatDateForDisplay(rehearsal.date)
      });
      const isKnownType = rehearsal.type === 'Missa' || rehearsal.type === 'Ensaio';
      setIsCustomType(!isKnownType);
      setActiveTab('create');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async () => {
      if (deleteModal.id) {
          await RehearsalService.delete(deleteModal.id);
          if (currentUser) {
              AuditService.log(
                  currentUser.username, 
                  'Rehearsals', 
                  'DELETE', 
                  `Excluiu ensaio ID: ${deleteModal.id}`, 
                  currentUser.role, 
                  currentUser.name
              );
          }
          setDeleteModal({ isOpen: false, id: null });
      }
  };

  // --- Helper to get time based greeting ---
  const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return "Bom dia";
      if (hour < 18) return "Boa tarde";
      return "Boa noite";
  };

  // --- Message Generator ---
  const generateMessage = (rehearsal: Rehearsal, name?: string) => {
      const dateStr = new Date(rehearsal.date + 'T12:00:00').toLocaleDateString('pt-BR');
      const greeting = getGreeting();
      const targetName = name ? name.split(' ')[0] : 'Galera'; // Generic for group
      const location = rehearsal.location ? rehearsal.location : 'Igreja/Sede';

      return `*${greeting}, ${targetName}!* 👋\n\n📢 *CONVOCAÇÃO DE EVENTO*\n🏛️ *Ministério Uziel*\n\n📌 *Tipo:* ${rehearsal.type}\n📌 *Tema:* ${rehearsal.topic}\n🗓 *Data:* ${dateStr} às ${rehearsal.time}\n📍 *Local:* ${location}\n\n📝 *Pauta:* ${rehearsal.notes || 'Detalhes do evento.'}\n\nContamos com sua presença! 🙏\n\nAtt,\n*Coordenador*`;
  };

  // --- WhatsApp Actions ---
  const sendWhatsapp = (phone: string, rehearsal: Rehearsal, name: string) => {
      if (!phone) return alert("Usuário sem telefone cadastrado.");
      const cleanPhone = phone.replace(/\D/g, '');
      const message = generateMessage(rehearsal, name);
      window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const copyGeneralInvite = (rehearsal: Rehearsal) => {
      const message = generateMessage(rehearsal); // No name argument = "Galera"
      navigator.clipboard.writeText(message);
      
      setIsInviteCopied(true);
      setTimeout(() => setIsInviteCopied(false), 2000);
  };

  // Filter & Sort Rehearsals Logic
  const sortedRehearsals = useMemo(() => {
      const sorted = [...rehearsals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const today = new Date();
      today.setHours(0,0,0,0);

      return sorted.filter(r => {
          if (filterStatus === 'all') return true;
          const rDate = new Date(r.date + 'T12:00:00');
          rDate.setHours(0,0,0,0);
          
          if (filterStatus === 'upcoming') return rDate >= today;
          if (filterStatus === 'past') return rDate < today;
          return true;
      });
  }, [rehearsals, filterStatus]);

  if (loading) return <Loading fullScreen message="Carregando Agenda..." />;

  return (
    <div className="space-y-8 animate-fade-in-up pb-32">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10 mb-8">
            <div>
               <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-[2px] bg-brand-500"></span>
                    <p className="text-brand-600 dark:text-brand-400 font-bold uppercase tracking-[0.2em] text-[10px]">Agenda & Preparação</p>
               </div>
               <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white leading-[0.9] tracking-tight">
                  Agenda de <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-500">Eventos</span>
               </h1>
               <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium max-w-md">
                  Organize datas de Missas, Ensaios e Eventos Especiais.
               </p>
            </div>
            
            <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex gap-1 shadow-inner border border-slate-200 dark:border-white/5">
                 <button onClick={() => setActiveTab('schedule')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${activeTab === 'schedule' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}>
                     <i className="fas fa-calendar-alt"></i> Agendados
                 </button>
                 {canCreate && (
                    <button onClick={() => { setFormData({ date: '', time: '', type: 'Ensaio', topic: '', location: '', notes: '', repertoryId: '', playlistIds: [], participants: [] }); setIsCustomType(false); setActiveTab('create'); }} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${activeTab === 'create' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}>
                        <i className="fas fa-plus-circle"></i> Novo Evento
                    </button>
                 )}
            </div>
        </div>

        {/* --- CREATE / EDIT TAB --- */}
        {activeTab === 'create' && canCreate && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fade-in-up">
                
                {/* Left Column: Details */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-white/5">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500"><i className="fas fa-info"></i></span>
                            Detalhes do Evento
                        </h3>
                        
                        <div className="mb-5">
                            <div className="flex gap-2 items-end mb-2">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Tipo de Evento</label>
                                    {isCustomType ? (
                                        <input 
                                            type="text" 
                                            value={formData.type} 
                                            onChange={e => handleInputChange('type', e.target.value)} 
                                            placeholder="Ex: Retiro, Vigília (Falta Geral)" 
                                            className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-brand-500 ring-1 ring-brand-500/20 font-bold text-slate-700 dark:text-white outline-none transition-all" 
                                            autoFocus
                                        />
                                    ) : (
                                        <div className="relative">
                                            <select 
                                                value={formData.type} 
                                                onChange={e => handleInputChange('type', e.target.value)} 
                                                className="w-full pl-4 pr-10 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 font-bold text-slate-700 dark:text-white outline-none appearance-none cursor-pointer focus:border-brand-500 transition-all"
                                            >
                                                <option value="Ensaio">Ensaio</option>
                                                <option value="Missa">Missa</option>
                                            </select>
                                            <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                                        </div>
                                    )}
                                </div>
                                <button 
                                    onClick={() => { setIsCustomType(!isCustomType); if(!isCustomType) handleInputChange('type', ''); else handleInputChange('type', 'Ensaio'); }} 
                                    className={`w-12 h-[46px] rounded-xl flex items-center justify-center transition-all ${isCustomType ? 'bg-brand-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-brand-500 hover:bg-white dark:hover:bg-white/10 border border-slate-200 dark:border-white/5'}`}
                                    title="Evento Especial / Personalizado"
                                >
                                    <i className={`fas ${isCustomType ? 'fa-check' : 'fa-pencil'}`}></i>
                                </button>
                            </div>
                            {isCustomType && <p className="text-[10px] text-brand-500 font-bold ml-1 animate-pulse">Eventos especiais entram na regra de Falta Geral.</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Data</label>
                                <input 
                                    type="text" 
                                    value={formData.date || ''} 
                                    onChange={handleDateChange}
                                    placeholder="DD/MM/AAAA"
                                    maxLength={10}
                                    className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 font-bold text-slate-700 dark:text-white outline-none focus:border-brand-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Horário</label>
                                <input 
                                    type="text" 
                                    value={formData.time || ''} 
                                    onChange={handleTimeChange}
                                    placeholder="HH:mm"
                                    maxLength={5}
                                    className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 font-bold text-slate-700 dark:text-white outline-none focus:border-brand-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* Location Field - Simple Text Input */}
                        <div className="mb-5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Localização</label>
                            <div className="relative group">
                                <i className="fas fa-map-marker-alt absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                <input 
                                    type="text" 
                                    value={formData.location || ''} 
                                    onChange={e => handleInputChange('location', e.target.value)} 
                                    placeholder="Digite o local..." 
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 font-bold text-slate-700 dark:text-white outline-none focus:border-brand-500 transition-all" 
                                />
                            </div>
                        </div>

                        <div className="mb-5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Nome / Tema</label>
                            <input type="text" value={formData.topic} onChange={e => handleInputChange('topic', e.target.value)} placeholder="Ex: Solenidade de Ramos / Ensaio Geral" className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 font-bold text-slate-700 dark:text-white outline-none focus:border-brand-500 transition-all" />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Pauta / Observações</label>
                            <textarea 
                                value={formData.notes} 
                                onChange={e => handleInputChange('notes', e.target.value)} 
                                placeholder="Descreva o cronograma, avisos ou ordem das músicas..." 
                                className="w-full px-5 py-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-600 dark:text-slate-300 outline-none focus:border-brand-500 transition-all min-h-[120px] resize-none"
                            ></textarea>
                        </div>
                    </div>

                    {/* Content Linking (Cards UI) */}
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-white/5">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500"><i className="fas fa-link"></i></span>
                            Vincular Conteúdo
                        </h3>

                        <div className="mb-8">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 block ml-1 flex justify-between">
                                <span>Repertório Principal</span>
                                {formData.repertoryId && <span className="text-brand-500 cursor-pointer hover:underline" onClick={() => handleInputChange('repertoryId', '')}>Desmarcar</span>}
                            </label>
                            
                            {/* Horizontal Scrolling Grid for Repertories */}
                            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                                {repertories.map(rep => {
                                    const isSelected = formData.repertoryId === rep.id;
                                    const cover = rep.coverImage || REPERTORY_COVERS[0];
                                    
                                    return (
                                        <div 
                                            key={rep.id} 
                                            onClick={() => handleInputChange('repertoryId', isSelected ? '' : rep.id)}
                                            className={`relative w-48 shrink-0 aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 snap-center border-2 transform-gpu ${isSelected ? 'border-brand-500 ring-4 ring-brand-500/20 scale-[1.02]' : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'}`}
                                        >
                                            <img 
                                                src={cover} 
                                                onError={(e) => { e.currentTarget.src = REPERTORY_COVERS[0]; }}
                                                alt="Repertory Cover"
                                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 animate-breathing" 
                                            />
                                            <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent ${isSelected ? 'opacity-90' : 'opacity-70 group-hover:opacity-80'}`}></div>
                                            
                                            {/* Preview Button */}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setViewingRep(rep); }}
                                                className="absolute top-2 left-2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md flex items-center justify-center border border-white/20 transition-all hover:scale-110 shadow-lg"
                                                title="Visualizar Detalhes"
                                            >
                                                <i className="fas fa-eye text-xs"></i>
                                            </button>

                                            {isSelected && (
                                                <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-lg animate-scale-in z-20">
                                                    <i className="fas fa-check text-xs"></i>
                                                </div>
                                            )}

                                            <div className="absolute bottom-0 left-0 w-full p-4 z-10">
                                                <span className="block text-[10px] font-bold text-brand-300 uppercase tracking-widest mb-1">
                                                    {new Date(rep.date + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}
                                                </span>
                                                <h4 className="text-white font-bold leading-tight line-clamp-2">{rep.theme}</h4>
                                            </div>
                                        </div>
                                    );
                                })}
                                {repertories.length === 0 && <div className="text-sm text-slate-400 italic p-4">Nenhum repertório criado.</div>}
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block ml-1">Playlists de Referência</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                                {playlists
                                    .filter(p => MediaUtils.parseUrl(p.url).type === 'spotify') // STRICTLY FILTER NON-SPOTIFY
                                    .map(p => {
                                    const isSelected = formData.playlistIds?.includes(p.id);
                                    const icon = MediaUtils.getMediaIcon(p.url);
                                    const styles = MediaUtils.getMediaColor(p.url);

                                    return (
                                        <div 
                                            key={p.id} 
                                            onClick={() => togglePlaylist(p.id)}
                                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 group ${isSelected ? 'bg-brand-50 dark:bg-brand-900/10 border-brand-500' : 'bg-slate-50 dark:bg-white/5 border-transparent hover:border-slate-200 dark:hover:border-white/10'}`}
                                        >
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${isSelected ? 'bg-brand-500 text-white' : `bg-white dark:bg-white/10 text-slate-400 ${styles.split(' ')[0]}`}`}>
                                                {isSelected ? <i className="fas fa-check"></i> : <i className={`fab ${icon}`}></i>}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-xs font-bold truncate ${isSelected ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {p.url}
                                                </p>
                                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mt-0.5">
                                                    {p.addedBy.split(' ')[0]}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                                {playlists.filter(p => MediaUtils.parseUrl(p.url).type === 'spotify').length === 0 && <div className="text-sm text-slate-400 italic">Nenhuma playlist do Spotify disponível.</div>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Participants */}
                <div className="xl:col-span-1">
                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-white/5 sticky top-6 h-fit">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-3">
                                <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500"><i className="fas fa-users"></i></span>
                                Convocação
                            </h3>
                            <button onClick={selectAllParticipants} className="text-[10px] font-bold uppercase tracking-widest text-brand-500 hover:text-brand-600 transition-colors">
                                Selecionar Todos
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                            {usersList.filter(u => u.role !== 'admin' && u.role !== 'super-admin' || true).map(user => { // Show everyone
                                const isSelected = formData.participants?.includes(user.username);
                                return (
                                    <div 
                                        key={user.username} 
                                        onClick={() => toggleParticipant(user.username)}
                                        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all group ${isSelected ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-500 shadow-md' : 'bg-slate-50 dark:bg-white/5 border-transparent hover:bg-slate-100 dark:hover:bg-white/10'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden ${isSelected ? 'bg-brand-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-white'}`}>
                                            {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover"/> : user.name.charAt(0)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-xs font-bold truncate ${isSelected ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'}`}>{user.name}</p>
                                            <p className="text-[9px] text-slate-400 truncate">{user.role}</p>
                                        </div>
                                        {isSelected && <i className="fas fa-check-circle text-brand-500"></i>}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5">
                            <button 
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="w-full py-4 rounded-xl bg-brand-600 text-white font-bold shadow-lg shadow-brand-500/30 hover:bg-brand-500 hover:scale-[1.02] active:scale-95 transition-all uppercase text-xs tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>}
                                Salvar e Notificar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- SCHEDULE TAB --- */}
        {activeTab === 'schedule' && (
            <>
                {/* Filter Bar */}
                <div className="grid grid-cols-3 gap-2 pb-2">
                    {[
                        { id: 'all', label: 'Todos', icon: 'fa-layer-group' },
                        { id: 'upcoming', label: 'Próximos', icon: 'fa-calendar-check' },
                        { id: 'past', label: 'Realizados', icon: 'fa-history' }
                    ].map((f) => (
                        <button 
                            key={f.id}
                            onClick={() => setFilterStatus(f.id as any)} 
                            className={`px-2 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all flex flex-col items-center gap-1.5 ${filterStatus === f.id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <i className={`fas ${f.icon}`}></i> {f.label}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fade-in-up">
                    {sortedRehearsals.map(rehearsal => {
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const rehearsalDate = new Date(rehearsal.date + 'T12:00:00'); 
                        rehearsalDate.setHours(0,0,0,0);
                        
                        const isUpcoming = rehearsalDate >= today;
                        const rep = repertories.find(r => r.id === rehearsal.repertoryId);
                        // Also filter linked playlists in view mode to hide any legacy junk
                        const linkedPlaylists = playlists
                            .filter(p => rehearsal.playlistIds?.includes(p.id))
                            .filter(p => MediaUtils.parseUrl(p.url).type === 'spotify');
                        
                        const canManageThis = isSuperAdmin || (canEdit && rehearsal.createdBy === currentUser?.username);
                        const canDeleteThis = isSuperAdmin || (canDelete && rehearsal.createdBy === currentUser?.username);
                        const creator = usersList.find(u => u.username === rehearsal.createdBy);
                        const creatorName = creator ? creator.name.split(' ')[0] : (rehearsal.createdBy?.split('@')[0] || 'Sistema');

                        return (
                            <div key={rehearsal.id} className={`bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-sm border transition-all hover:shadow-xl relative overflow-hidden group flex flex-col h-full ${isUpcoming ? 'border-slate-100 dark:border-white/5 opacity-100' : 'border-slate-100 dark:border-white/5 opacity-70 mix-blend-luminosity hover:mix-blend-normal hover:opacity-100 duration-500'}`}>
                                {isUpcoming && <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-bl-[5rem] -mr-6 -mt-6 transition-transform group-hover:scale-150 duration-1000 pointer-events-none"></div>}
                                
                                <div className="relative z-10 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex flex-col gap-2">
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 w-fit">
                                                <i className="fas fa-calendar-day"></i>
                                                {new Date(rehearsal.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {rehearsal.time}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                                <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[8px] overflow-hidden">
                                                    {creator?.photoURL ? <img src={creator.photoURL} className="w-full h-full object-cover"/> : (creatorName[0] || 'U')}
                                                </div>
                                                <span>Por {creatorName}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-1">
                                            {canManageThis && (
                                                <button onClick={() => handleEdit(rehearsal)} className="w-8 h-8 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 text-slate-400 hover:text-brand-500 transition-colors"><i className="fas fa-pen text-xs"></i></button>
                                            )}
                                            {canDeleteThis && (
                                                <button onClick={() => setDeleteModal({isOpen: true, id: rehearsal.id!})} className="w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"><i className="fas fa-trash text-xs"></i></button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mb-2">
                                        <span className="text-[10px] font-bold uppercase bg-brand-50 dark:bg-brand-900/20 text-brand-600 px-2 py-0.5 rounded">{rehearsal.type || 'Ensaio'}</span>
                                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-1 leading-tight">{rehearsal.topic}</h3>
                                    </div>
                                    {rehearsal.location && (
                                        <div className="mb-2">
                                            <p className="text-xs text-brand-600 dark:text-brand-400 font-bold flex items-center gap-1">
                                                <i className="fas fa-map-marker-alt"></i> {rehearsal.location}
                                            </p>
                                        </div>
                                    )}
                                    {rehearsal.notes && <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-6">{rehearsal.notes}</p>}

                                    {/* CONTENT SHELF */}
                                    <div className="mt-auto space-y-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 dark:border-white/5 pb-1">Materiais de Apoio</p>
                                        
                                        {/* Repertory Card */}
                                        {rep && (
                                            <div className="relative overflow-hidden rounded-xl bg-slate-900 text-white p-4 flex items-center justify-between group/rep cursor-pointer hover:shadow-lg transition-all" onClick={() => setViewingRep(rep)}>
                                                <img 
                                                    src={rep.coverImage || REPERTORY_COVERS[0]} 
                                                    onError={(e) => { e.currentTarget.src = REPERTORY_COVERS[0]; }}
                                                    alt="Repertory Cover"
                                                    className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover/rep:scale-110 transition-transform duration-700 animate-breathing" 
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent"></div>
                                                
                                                <div className="relative z-10 flex flex-col">
                                                    <span className="text-[9px] text-brand-300 font-bold uppercase tracking-widest mb-0.5">Repertório</span>
                                                    <span className="font-bold text-sm leading-tight">{rep.theme}</span>
                                                </div>
                                                <div className="relative z-10 w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover/rep:bg-brand-500 transition-colors">
                                                    <i className="fas fa-music text-xs"></i>
                                                </div>
                                            </div>
                                        )}

                                        {/* Playlist Mini-Cards Grid */}
                                        {linkedPlaylists.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2">
                                                {linkedPlaylists.map(p => {
                                                    const icon = MediaUtils.getMediaIcon(p.url);
                                                    const styles = MediaUtils.getMediaColor(p.url);
                                                    return (
                                                        <div 
                                                            key={p.id} 
                                                            onClick={() => setActiveMediaUrl(p.url)}
                                                            className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer hover:brightness-95 transition-all ${styles}`}
                                                        >
                                                            <i className={`fab ${icon} text-lg`}></i>
                                                            <div className="min-w-0">
                                                                <p className="text-[9px] font-bold uppercase tracking-wide truncate opacity-80">Mídia</p>
                                                                <p className="text-[10px] font-bold truncate leading-none">Abrir</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {!rep && linkedPlaylists.length === 0 && (
                                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 text-center text-xs text-slate-400 italic">
                                                Nenhum material vinculado.
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-4 mt-6">
                                        <div className="flex -space-x-2 overflow-hidden">
                                            {rehearsal.participants.slice(0, 4).map((uid, idx) => {
                                                const u = usersList.find(u => u.username === uid);
                                                return (
                                                    <div key={uid} className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-white overflow-hidden" title={u?.name}>
                                                        {u?.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover"/> : u?.name.charAt(0)}
                                                    </div>
                                                );
                                            })}
                                            {rehearsal.participants.length > 4 && (
                                                <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500">
                                                    +{rehearsal.participants.length - 4}
                                                </div>
                                            )}
                                        </div>
                                        {isAdmin && (
                                            <button 
                                                onClick={() => setNotificationModal({isOpen: true, rehearsal})}
                                                className="text-xs font-bold text-slate-400 hover:text-green-500 uppercase tracking-wider transition-colors flex items-center gap-1"
                                            >
                                                <i className="fab fa-whatsapp text-lg"></i> Notificar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {sortedRehearsals.length === 0 && (
                        <div className="col-span-full py-20 text-center opacity-50 flex flex-col items-center">
                            <div className="w-24 h-24 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4"><i className="fas fa-calendar-times text-4xl text-slate-300"></i></div>
                            <p className="font-bold text-slate-400">Nenhum evento encontrado.</p>
                        </div>
                    )}
                </div>
            </>
        )}

        {/* --- MODALS (RepertoryQuickView, MediaPlayerOverlay, etc.) --- */}
        {viewingRep && <RepertoryQuickView rep={viewingRep} onClose={() => setViewingRep(null)} />}
        {activeMediaUrl && <MediaPlayerOverlay url={activeMediaUrl} onClose={() => setActiveMediaUrl(null)} />}
        
        {notificationModal.isOpen && notificationModal.rehearsal && createPortal(
            <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-white/20 animate-scale-in relative overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
                    <button onClick={() => setNotificationModal({isOpen: false, rehearsal: null})} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"><i className="fas fa-times"></i></button>

                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/20 text-green-600 flex items-center justify-center text-2xl">
                                <i className="fab fa-whatsapp"></i>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white font-display leading-none">Notificar Equipe</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Envie para o grupo ou individualmente.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-black/20 p-5 rounded-2xl border border-slate-200 dark:border-white/10 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div>
                            <p className="text-xs font-bold uppercase text-brand-600 dark:text-brand-400 tracking-wider mb-1 flex items-center gap-2">
                                <i className="fas fa-users"></i> Recomendado
                            </p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Enviar para todos (Grupo)</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Copia a mensagem formatada para colar no grupo.</p>
                        </div>
                        <button 
                            onClick={() => copyGeneralInvite(notificationModal.rehearsal!)} 
                            className={`px-6 py-3 shadow-md rounded-xl text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 transform active:scale-95 ${isInviteCopied ? 'bg-green-500 text-white scale-105' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-white hover:bg-slate-50'}`}
                        >
                            {isInviteCopied ? <><i className="fas fa-check"></i> Copiado!</> : <><i className="fas fa-copy"></i> Copiar para Grupo</>}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Envio Individual</p>
                        <div className="space-y-2">
                            {notificationModal.rehearsal.participants.map(uid => {
                                const user = usersList.find(u => u.username === uid);
                                if (!user) return null;
                                const hasPhone = !!user.whatsapp;

                                return (
                                    <div key={uid} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-white/5 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs overflow-hidden shadow-sm">
                                                {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover"/> : user.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{user.name}</p>
                                                <p className="text-[10px] text-slate-400">{hasPhone ? user.whatsapp : 'Sem telefone'}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => sendWhatsapp(user.whatsapp || '', notificationModal.rehearsal!, user.name)}
                                            disabled={!hasPhone}
                                            className={`h-9 px-4 rounded-lg flex items-center gap-2 transition-all text-[10px] font-bold uppercase tracking-wider ${hasPhone ? 'bg-green-50 text-green-600 hover:bg-green-500 hover:text-white border border-green-200 hover:border-green-500' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                                        >
                                            <span>Enviar</span>
                                            <i className="fab fa-whatsapp text-sm"></i>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        )}

        <DeleteConfirmationModal 
            isOpen={deleteModal.isOpen}
            onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
            onConfirm={handleDelete}
            title="Excluir Ensaio?"
            description="Isso removerá permanentemente o agendamento."
        />
    </div>
  );
};

export default Rehearsals;
