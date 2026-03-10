
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
  const { currentUser, usersList, checkPermission } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeMedia, setActiveMedia] = useState<Playlist | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  const canCreate = checkPermission('playlists', 'create');
  const canDelete = checkPermission('playlists', 'delete');
  
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
  const [previewData, setPreviewData] = useState<{title?: string, thumbnail_url?: string, type?: string} | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
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

  useEffect(() => {
    const fetchPreview = async () => {
        if (!newUrl) {
            setPreviewData(null);
            return;
        }
        const info = MediaUtils.parseUrl(newUrl);
        if (info.type !== 'spotify') {
            setPreviewData(null);
            return;
        }
        
        setIsPreviewLoading(true);
        try {
            const metadata = await MediaUtils.fetchSpotifyOEmbed(newUrl);
            setPreviewData({
                title: metadata.title,
                thumbnail_url: metadata.thumbnail_url,
                type: info.subType || undefined
            });
        } catch (e) {
            setPreviewData(null);
        } finally {
            setIsPreviewLoading(false);
        }
    };
    
    const timeoutId = setTimeout(fetchPreview, 500);
    return () => clearTimeout(timeoutId);
  }, [newUrl]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newUrl) return;
    const info = MediaUtils.parseUrl(newUrl); if (info.type !== 'spotify') return alert("Insira um link do Spotify.");
    setIsSubmitting(true);
    try {
      const metadata = previewData || await MediaUtils.fetchSpotifyOEmbed(newUrl);
      await PlaylistService.add(newUrl, currentUser?.username || 'unknown', metadata.title || undefined, metadata.thumbnail_url || undefined);
      if (currentUser) AuditService.log(currentUser.username, 'Playlist', 'CREATE', `Adicionou: ${metadata.title || newUrl}`, currentUser.role);
      setNewUrl(''); setPreviewData(null); setShowAddModal(false);
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
                {canCreate && <button onClick={() => setShowAddModal(true)} className="bg-white text-slate-900 px-6 py-4 rounded-2xl font-bold hover:bg-[#1DB954] hover:text-white transition-all shadow-lg flex items-center gap-2 uppercase text-xs tracking-wider"><i className="fas fa-plus-circle"></i><span>Adicionar Link</span></button>}
           </div>
      </div>
      <Card noPadding className="flex flex-col md:flex-row gap-4 justify-between items-center p-2"><div className="relative group w-full"><i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1DB954] transition-colors"></i><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar na biblioteca..." className="pl-12 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-700/50 border-none outline-none focus:ring-2 focus:ring-[#1DB954]/20 w-full transition-all font-medium text-slate-700 dark:text-slate-200 text-center md:text-left" /></div></Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredPlaylists.map((item) => {
              const info = MediaUtils.parseUrl(item.url); const addedByUser = usersList.find(u => u.username === item.addedBy);
              const typeLabel = info.subType === 'track' ? 'Faixa' : info.subType === 'playlist' ? 'Playlist' : info.subType === 'album' ? 'Álbum' : info.subType === 'artist' ? 'Artista' : 'Spotify';
              return (
                  <Card key={item.id} hover noPadding onClick={() => setActiveMedia(item)} className="flex flex-col group h-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/5 transition-all duration-300 cursor-pointer rounded-md p-4 shadow-sm dark:shadow-none">
                      <div className={`aspect-square bg-slate-100 dark:bg-slate-800 relative overflow-hidden shadow-md dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] mb-4 ${info.subType === 'artist' ? 'rounded-full' : 'rounded-md'}`}>
                          {item.image ? <img src={item.image} alt={item.title || 'Cover'} className="absolute inset-0 w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden"><i className="fab fa-spotify text-4xl text-slate-400 dark:text-white/50"></i></div>}
                          
                          {/* Play Button Overlay (Spotify Style) */}
                          <div className="absolute bottom-2 right-2 z-20 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                              <div className="w-12 h-12 bg-[#1DB954] text-white dark:text-black rounded-full flex items-center justify-center text-xl shadow-[0_8px_8px_rgba(0,0,0,0.3)] hover:scale-105 hover:bg-[#1ed760] transition-all">
                                  <i className="fas fa-play pl-1"></i>
                              </div>
                          </div>
                          
                          {canDelete && <button onClick={(e) => requestDelete(e, item.id)} className="absolute top-2 right-2 z-30 w-8 h-8 rounded-full bg-white/90 dark:bg-black/60 text-red-600 dark:text-white/70 hover:text-red-700 dark:hover:text-white flex items-center justify-center shadow-md transition-all hover:bg-white dark:hover:bg-red-600/80"><i className="fas fa-trash text-xs"></i></button>}
                      </div>
                      <div className="flex-1 flex flex-col">
                         <p className="text-base font-bold text-slate-900 dark:text-white line-clamp-1 mb-1" title={item.title || `Spotify ${typeLabel}`}>{item.title || `Spotify ${typeLabel}`}</p>
                         <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 font-medium">
                            {typeLabel} • {addedByUser ? addedByUser.name : item.addedBy.split('@')[0]}
                         </p>
                      </div>
                  </Card>
              );
          })}
      </div>
      {filteredPlaylists.length === 0 && ( <div className="text-center py-20 opacity-50 flex flex-col items-center"><i className="fab fa-spotify text-5xl text-[#1DB954] mb-6"></i><p className="font-bold text-slate-400 text-lg">Biblioteca Vazia</p></div> )}
      {activeMedia && <SpotifyPlayerOverlay url={activeMedia.url} onClose={() => setActiveMedia(null)} />}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
             <div className="w-full max-w-lg bg-white dark:bg-slate-900 p-8 rounded-[1rem] shadow-2xl border border-slate-200 dark:border-white/10 animate-scale-in relative overflow-hidden">
                 <div className="relative z-10">
                     <div className="flex justify-between items-start mb-8"><div><h2 className="text-2xl font-bold text-slate-900 dark:text-white font-display">Adicionar ao Spotify</h2></div><button onClick={() => { setShowAddModal(false); setNewUrl(''); setPreviewData(null); }} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors text-slate-500 hover:text-slate-700 dark:text-white/70 dark:hover:text-white"><i className="fas fa-times"></i></button></div>
                     <form onSubmit={handleAdd} className="space-y-6">
                        <div className="group">
                            <label className="text-xs font-bold text-slate-500 dark:text-white/70 mb-2 block ml-1">Link do Spotify</label>
                            <div className="relative">
                                <input type="text" className="w-full px-5 py-4 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent outline-none focus:border-[#1DB954] focus:bg-white dark:focus:bg-slate-700 focus:shadow-sm transition-all font-medium text-slate-900 dark:text-white pl-12" placeholder="https://open.spotify.com/..." value={newUrl} onChange={e => setNewUrl(e.target.value)} autoFocus />
                                <i className="fas fa-link absolute left-5 top-1/2 -translate-y-1/2 text-lg text-slate-400 dark:text-white/50 group-focus-within:text-[#1DB954] transition-colors"></i>
                            </div>
                        </div>
                        
                        {/* Preview Section */}
                        {(isPreviewLoading || previewData) && (
                            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 p-4 rounded-md flex items-center gap-4 animate-fade-in">
                                {isPreviewLoading ? (
                                    <div className="w-full flex items-center justify-center py-4 text-[#1DB954]">
                                        <i className="fas fa-circle-notch fa-spin text-2xl"></i>
                                    </div>
                                ) : previewData ? (
                                    <>
                                        <div className={`w-16 h-16 shrink-0 bg-slate-200 dark:bg-slate-700 overflow-hidden ${previewData.type === 'artist' ? 'rounded-full' : 'rounded-md'}`}>
                                            {previewData.thumbnail_url ? (
                                                <img src={previewData.thumbnail_url} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center"><i className="fab fa-spotify text-2xl text-slate-400 dark:text-white/50"></i></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-slate-900 dark:text-white font-bold truncate">{previewData.title || 'Item do Spotify'}</p>
                                            <p className="text-slate-500 dark:text-slate-400 text-sm capitalize">{previewData.type === 'track' ? 'Faixa' : previewData.type === 'playlist' ? 'Playlist' : previewData.type === 'album' ? 'Álbum' : previewData.type === 'artist' ? 'Artista' : 'Spotify'}</p>
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        )}

                        <button disabled={isSubmitting || !newUrl} type="submit" className="w-full py-4 rounded-full bg-[#1DB954] text-white dark:text-black font-bold hover:scale-105 hover:bg-[#1ed760] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-lg shadow-[#1DB954]/20">
                            {isSubmitting ? <><i className="fas fa-circle-notch fa-spin"></i> Salvando...</> : 'Adicionar à Biblioteca'}
                        </button>
                     </form>
                 </div>
             </div>
        </div>, document.body
      )}
      <DeleteConfirmationModal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false, playlistId: null }))} onConfirm={confirmDelete} title={deleteModal.title} description={deleteModal.description} isProcessing={isProcessing} />
    </div>
  );
};

export default Playlists;
