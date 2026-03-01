
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PlaylistService, AuditService } from '../services/firebase';
import { Playlist } from '../types';
import { useAuth } from '../context/AuthContext';
import Card from '../components/Card';
import Loading from '../components/Loading';
import { generateCatholicChurchImage, getCachedImage } from '../services/geminiService';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { MediaUtils } from '../utils/mediaUtils';
import PremiumBackground from '../components/PremiumBackground';

const SpotifyPlayerOverlay = ({ url, onClose }: { url: string, onClose: () => void }) => {
    const info = MediaUtils.parseUrl(url);
    const embedUrl = MediaUtils.getEmbedUrl(url);
    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-fade-in">
            <button onClick={onClose} className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all z-50"><i className="fas fa-times text-xl"></i></button>
            <div className="w-full max-w-4xl h-full flex flex-col items-center justify-center relative z-10 p-2">
                {embedUrl ? (
                    <div className="w-full max-w-md h-[80vh] md:h-[600px] rounded-[2rem] shadow-[0_0_100px_rgba(29,185,84,0.3)] border border-white/10 relative group bg-black overflow-hidden" style={{ transform: 'translateZ(0)', isolation: 'isolate' }}>
                        <iframe src={embedUrl} className="w-full h-full" style={{ borderRadius: '2rem', border: 'none' }} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" title="Spotify Player" loading="eager"></iframe>
                    </div>
                ) : (
                    <div className="text-center text-white bg-white/5 backdrop-blur-xl p-10 md:p-16 rounded-[3rem] border border-white/10 max-w-lg w-full relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#1DB954]/20 to-brand-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative z-10">
                            <div className="w-24 h-24 rounded-3xl bg-[#1DB954]/10 flex items-center justify-center mx-auto mb-8 shadow-inner border border-[#1DB954]/20"><i className="fab fa-spotify text-5xl text-[#1DB954]"></i></div>
                            <h3 className="text-3xl font-display font-bold mb-2">Link Externo</h3>
                            <p className="text-slate-400 mb-8 font-medium">Este conteúdo deve ser aberto diretamente no Spotify.</p>
                            <a href={url} target="_blank" rel="noreferrer" className="inline-flex px-8 py-4 bg-[#1DB954] text-white rounded-2xl font-bold hover:scale-105 transition-transform gap-3 items-center shadow-lg"><span>Abrir no App</span><i className="fas fa-arrow-right"></i></a>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

const Playlists: React.FC = () => {
  const { currentUser, usersList } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeMedia, setActiveMedia] = useState<Playlist | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  const getContextKey = () => {
      const hour = new Date().getHours();
      let period = 'morning';
      if (hour >= 12 && hour < 18) period = 'afternoon';
      else if (hour >= 18 || hour < 5) period = 'night';
      return `playlists_hero_${period}`;
  };

  // Logo adaptado para suportar ciclos diários (Manhã, Tarde, Noite)
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(() => {
      const hour = new Date().getHours();
      let period: 'morning' | 'afternoon' | 'night' = 'morning';
      if (hour >= 12 && hour < 18) period = 'afternoon'; else if (hour >= 18 || hour < 5) period = 'night';
      return getCachedImage(`playlists_hero_${period}`);
  });
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; title: string; description: string; playlistId: string | null; }>({ isOpen: false, title: '', description: '', playlistId: null });

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super-admin';

  useEffect(() => {
    const unsub = PlaylistService.subscribe((data) => { setPlaylists(data as Playlist[]); setLoading(false); });
    return () => unsub();
  }, []);

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
      if (!isAdmin || loading || playlists.length === 0) return;
      const autoCleanup = async () => {
          const nonSpotify = playlists.filter(p => MediaUtils.parseUrl(p.url).type !== 'spotify');
          if (nonSpotify.length > 0) {
              try { await Promise.all(nonSpotify.map(p => PlaylistService.delete(p.id))); if (currentUser) AuditService.log(currentUser.username, 'Playlist', 'DELETE', `Auto-limpeza: Removeu ${nonSpotify.length} links inválidos.`, currentUser.role); } catch (e) { console.error(e); }
          }
      };
      const timeoutId = setTimeout(autoCleanup, 2000); return () => clearTimeout(timeoutId);
  }, [playlists, isAdmin, loading, currentUser]);

  useEffect(() => {
    const fetchAndSetImage = async () => {
        try {
            const newUrl = await generateCatholicChurchImage('playlists_hero');
            if (newUrl) setHeroImageUrl(newUrl);
        } catch (error) { console.warn(error); }
    };
    fetchAndSetImage();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newUrl) return;
    const info = MediaUtils.parseUrl(newUrl); if (info.type !== 'spotify') return alert("Insira um link do Spotify.");
    setIsSubmitting(true);
    try {
      const metadata = await MediaUtils.fetchSpotifyOEmbed(newUrl);
      await PlaylistService.add(newUrl, currentUser?.username || 'unknown', metadata.title || undefined, metadata.thumbnail_url || undefined);
      if (currentUser) AuditService.log(currentUser.username, 'Playlist', 'CREATE', `Adicionou: ${metadata.title || newUrl}`, currentUser.role);
      setNewUrl(''); setShowAddModal(false);
    } catch (error) { console.error(error); alert("Erro ao adicionar."); } finally { setIsSubmitting(false); }
  };

  const requestDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation(); 
    setDeleteModal({ isOpen: true, title: 'Excluir Mídia?', description: 'Remover permanentemente da biblioteca.', playlistId: id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.playlistId) return; setIsProcessing(true); const id = deleteModal.playlistId;
    setPlaylists(prev => prev.filter(p => p.id !== id));
    try { await PlaylistService.delete(id); if (currentUser) AuditService.log(currentUser.username, 'Playlist', 'DELETE', `Removeu mídia: ${id}`, currentUser.role); } catch (err) { console.error(err); } finally { setIsProcessing(false); setDeleteModal(prev => ({ ...prev, isOpen: false, playlistId: null })); }
  };
  
  const filteredPlaylists = playlists.filter(p => {
    const info = MediaUtils.parseUrl(p.url); const isSpotify = info.type === 'spotify';
    const titleMatch = p.title ? p.title.toLowerCase().includes(search.toLowerCase()) : false;
    const urlMatch = p.url.toLowerCase().includes(search.toLowerCase());
    return isSpotify && (titleMatch || urlMatch);
  });

  if (loading && playlists.length === 0) return <Loading />;

  return (
    <div className="space-y-8 animate-fade-in-up pb-32">
      <div className="relative rounded-[3rem] overflow-hidden bg-slate-900 shadow-premium group min-h-[250px] flex items-end p-8 md:p-12 border border-slate-100 dark:border-slate-700">
           {heroImageUrl ? <div className="absolute inset-0 bg-cover bg-center animate-breathing opacity-60" style={{ backgroundImage: `url('${heroImageUrl}')` }}></div> : <PremiumBackground variant="music" />}
           <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
           <div className="relative z-10 w-full flex flex-col md:flex-row justify-between items-end gap-6">
                <div>
                   <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1DB954]/20 text-[#1DB954] text-[10px] font-bold uppercase tracking-widest mb-3 border border-[#1DB954]/30 backdrop-blur-md"><i className="fab fa-spotify text-lg"></i> Biblioteca Digital</span>
                   <h1 className="text-4xl md:text-6xl font-display font-bold text-white leading-[0.9] mb-4 text-shadow-lg tracking-tight">Spotify <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1DB954] to-emerald-300">Oficial</span></h1>
                   <p className="text-slate-300 font-medium max-w-lg">Acervo de playlists, álbuns e referências musicais do ministério.</p>
                </div>
                {isAdmin && <button onClick={() => setShowAddModal(true)} className="bg-white text-slate-900 px-6 py-4 rounded-2xl font-bold hover:bg-[#1DB954] hover:text-white transition-all shadow-lg flex items-center gap-2 uppercase text-xs tracking-wider"><i className="fas fa-plus-circle"></i><span>Adicionar Link</span></button>}
           </div>
      </div>
      <Card noPadding className="flex flex-col md:flex-row gap-4 justify-between items-center p-2"><div className="relative group w-full"><i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1DB954] transition-colors"></i><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar na biblioteca..." className="pl-12 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-700/50 border-none outline-none focus:ring-2 focus:ring-[#1DB954]/20 w-full transition-all font-medium text-slate-700 dark:text-slate-200 text-center md:text-left" /></div></Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPlaylists.map((item) => {
              const info = MediaUtils.parseUrl(item.url); const addedByUser = usersList.find(u => u.username === item.addedBy);
              const typeLabel = info.subType === 'track' ? 'Faixa' : info.subType === 'playlist' ? 'Playlist' : info.subType === 'album' ? 'Álbum' : info.subType === 'artist' ? 'Artista' : 'Spotify';
              return (
                  <Card key={item.id} hover noPadding onClick={() => setActiveMedia(item)} className="flex flex-col group h-full bg-white dark:bg-[#0b1221] border border-slate-100 dark:border-white/5">
                      <div className="aspect-square bg-slate-900 relative overflow-hidden m-4 rounded-[1.5rem] shadow-inner group-hover:shadow-2xl transition-all duration-500">
                          {item.image ? <img src={item.image} alt={item.title || 'Cover'} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 animate-breathing" /> : <div className="w-full h-full bg-gradient-to-br from-[#1DB954] to-[#0f172a] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden"><i className="fab fa-spotify text-6xl text-white drop-shadow-lg"></i></div>}
                          <div className="absolute top-3 left-3 z-10"><span className="text-[10px] text-white/90 font-bold uppercase tracking-widest bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">{typeLabel}</span></div>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px]"><div className="w-16 h-16 bg-[#1DB954] text-white rounded-full flex items-center justify-center text-2xl shadow-lg border-4 border-white/20 transform scale-50 group-hover:scale-100"><i className="fas fa-play pl-1"></i></div></div>
                          {isAdmin && <button onClick={(e) => requestDelete(e, item.id)} className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-700"><i className="fas fa-trash text-xs"></i></button>}
                      </div>
                      <div className="px-5 pb-5 flex-1 flex flex-col justify-between">
                         <div className="mb-4"><p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-[#1DB954] transition-colors">{item.title || `Spotify ${typeLabel}`}</p></div>
                         <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-white/5"><div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 overflow-hidden uppercase">{addedByUser?.photoURL ? <img src={addedByUser.photoURL} alt={item.addedBy} className="w-full h-full object-cover" /> : item.addedBy.charAt(0)}</div><div className="flex flex-col"><span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Criado por</span><span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">{addedByUser ? addedByUser.name : item.addedBy.split('@')[0]}</span></div></div>
                      </div>
                  </Card>
              );
          })}
      </div>
      {filteredPlaylists.length === 0 && ( <div className="text-center py-20 opacity-50 flex flex-col items-center"><i className="fab fa-spotify text-5xl text-[#1DB954] mb-6"></i><p className="font-bold text-slate-400 text-lg">Biblioteca Vazia</p></div> )}
      {activeMedia && <SpotifyPlayerOverlay url={activeMedia.url} onClose={() => setActiveMedia(null)} />}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
             <div className="w-full max-w-lg bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-white/20 animate-scale-in relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-2 bg-[#1DB954]"></div>
                 <div className="relative z-10">
                     <div className="flex justify-between items-start mb-8"><div><div className="w-12 h-12 rounded-xl bg-[#1DB954]/10 flex items-center justify-center text-[#1DB954] text-2xl mb-3"><i className="fab fa-spotify"></i></div><h2 className="text-2xl font-bold text-slate-800 dark:text-white font-display">Adicionar ao Spotify</h2></div><button onClick={() => setShowAddModal(false)} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 flex items-center justify-center transition-colors"><i className="fas fa-times text-slate-500"></i></button></div>
                     <form onSubmit={handleAdd} className="space-y-6"><div className="group"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Link do Spotify</label><div className="relative"><input type="text" className="w-full px-5 py-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 outline-none focus:border-[#1DB954] transition-all font-medium text-slate-700 dark:text-white pl-12" placeholder="https://open.spotify.com/..." value={newUrl} onChange={e => setNewUrl(e.target.value)} autoFocus /><i className="fas fa-link absolute left-5 top-1/2 -translate-y-1/2 text-lg text-slate-400 group-focus-within:text-[#1DB954] transition-colors"></i></div></div><button disabled={isSubmitting || !newUrl} type="submit" className="w-full py-4 rounded-2xl bg-[#1DB954] text-white font-bold shadow-lg shadow-[#1DB954]/30 hover:bg-[#1ed760] transition-all uppercase text-xs tracking-wider flex items-center justify-center gap-2">{isSubmitting ? <><i className="fas fa-circle-notch fa-spin"></i> Buscando...</> : <><i className="fas fa-check"></i> Confirmar</>}</button></form>
                 </div>
             </div>
        </div>, document.body
      )}
      <DeleteConfirmationModal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false, playlistId: null }))} onConfirm={confirmDelete} title={deleteModal.title} description={deleteModal.description} isProcessing={isProcessing} />
    </div>
  );
};

export default Playlists;
