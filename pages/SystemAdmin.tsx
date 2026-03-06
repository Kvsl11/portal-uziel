
import React, { useState, useEffect, useMemo } from 'react';
import { getDocs, collection, query, writeBatch, orderBy, limit, where, doc, getDoc, Timestamp } from "firebase/firestore";
import { db, AuditService, DailyImageService, SystemAdminService, DEFAULT_FIREBASE_CONFIG } from '../services/firebase';
import { APP_ID } from '../constants';
import { useAuth, DEFAULT_PERMISSIONS, PERMISSION_MODULES } from '../context/AuthContext';
import Card from '../components/Card';
import Loading from '../components/Loading';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import ImageViewer from '../components/ImageViewer';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { updateLocalCache } from '../services/geminiService';

const DevBadge = ({ label }: { label: string }) => (
    <span className="px-2 py-0.5 rounded bg-brand-600 text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-brand-500/20">
        {label}
    </span>
);

// --- MODAL: EXPLORADOR DE DADOS ---
const DataExplorerModal = ({ collectionName, onClose }: { collectionName: string, onClose: () => void }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const load = async () => {
            const result = await SystemAdminService.getFullCollectionData(collectionName);
            setData(result);
            setLoading(false);
        };
        load();
    }, [collectionName]);

    const filtered = data.filter(item => 
        JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return createPortal(
        <div className="fixed inset-0 z-[10000] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-0 md:p-6 animate-fade-in">
            <div className="w-full h-full md:max-w-6xl md:max-h-[90vh] bg-white dark:bg-[#0b1221] md:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/10">
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/80 dark:bg-[#0b1221]/80 backdrop-blur-md sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xl shadow-sm">
                            <i className="fas fa-database"></i>
                        </div>
                        <div>
                            <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white uppercase tracking-tight">Coleção: {collectionName}</h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{data.length} registros localizados</p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            <input 
                                type="text" 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Filtrar dados..." 
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm outline-none focus:border-brand-500"
                            />
                        </div>
                        <button onClick={onClose} className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-500 transition-colors flex items-center justify-center border border-slate-200 dark:border-white/10">
                            <i className="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-slate-50/50 dark:bg-black/10">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Lendo registros do núcleo...</p>
                        </div>
                    ) : filtered.length > 0 ? (
                        <div className="grid grid-cols-1 gap-6">
                            {filtered.map((item) => (
                                <div key={item.id} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-md group hover:shadow-xl transition-all relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-6xl"><i className="fas fa-file-code"></i></div>
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-50 dark:border-white/5 pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-widest">Documento ID</div>
                                            <span className="font-mono text-sm font-bold text-slate-500 dark:text-slate-400 select-all bg-slate-50 dark:bg-black/20 px-3 py-1 rounded-md">{item.id}</span>
                                        </div>
                                        <button className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-brand-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400" onClick={() => { navigator.clipboard.writeText(JSON.stringify(item, null, 2)); alert("JSON copiado!"); }}>
                                            <i className="fas fa-copy mr-2"></i> Copiar Estrutura
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {Object.entries(item).map(([key, value]) => {
                                            if (key === 'id') return null;
                                            const isObject = typeof value === 'object' && value !== null;
                                            return (
                                                <div key={key} className="flex flex-col md:flex-row md:items-start gap-2 p-3 rounded-xl bg-slate-50/50 dark:bg-black/10 border border-slate-100 dark:border-white/5">
                                                    <span className="w-full md:w-40 shrink-0 text-[10px] font-black uppercase text-brand-600 dark:text-brand-400 tracking-wider pt-0.5">{key}:</span>
                                                    <div className="flex-1 min-w-0">
                                                        {isObject ? (
                                                            <pre className="text-xs font-mono text-slate-600 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap bg-white dark:bg-black/20 p-3 rounded-lg border border-slate-100 dark:border-white/5">
                                                                {JSON.stringify(value, null, 2)}
                                                            </pre>
                                                        ) : (
                                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 break-all leading-relaxed">
                                                                {String(value)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 opacity-40">
                            <i className="fas fa-search text-6xl mb-6 text-slate-300"></i>
                            <p className="font-bold text-slate-500 uppercase tracking-widest text-lg">Nenhum registro corresponde ao filtro.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- MODAL: SELETOR DE CONTEXTO ---
const ContextSelectorModal = ({ currentImage, onSelect, onClose }: { currentImage: any, onSelect: (context: string) => void, onClose: () => void }) => {
    const [selectedPage, setSelectedPage] = useState<string | null>(null);

    const pages = [
        { id: 'home_hero', label: 'Início', icon: 'fa-home' },
        { id: 'login', label: 'Tela de Login', icon: 'fa-sign-in-alt' },
        { id: 'playlists_hero', label: 'Playlists', icon: 'fa-music' },
        { id: 'calendar_hero', label: 'Liturgia', icon: 'fa-calendar-check' },
        { id: 'rota_hero', label: 'Escala Salmistas', icon: 'fa-calendar-alt' }
    ];

    const periods = [
        { id: 'morning', label: 'Manhã', icon: 'fa-sun', color: 'text-orange-500' },
        { id: 'afternoon', label: 'Tarde', icon: 'fa-cloud-sun', color: 'text-brand-500' },
        { id: 'night', label: 'Noite', icon: 'fa-moon', color: 'text-indigo-400' }
    ];

    const getPeriod = () => {
        const h = new Date().getHours();
        if (h >= 5 && h < 12) return 'morning';
        if (h >= 12 && h < 18) return 'afternoon';
        return 'night';
    };
    const currentPeriod = getPeriod();

    return createPortal(
        <div className="fixed inset-0 z-[10000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] p-8 md:p-10 shadow-2xl border border-white/10 animate-scale-in">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
                        <i className="fas fa-map-marker-alt"></i>
                    </div>
                    <h3 className="text-2xl font-display font-bold text-slate-800 dark:text-white">Redirecionar Asset</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">
                        {selectedPage ? 'Agora escolha o período do dia' : 'Escolha a página de destino'}
                    </p>
                </div>

                {!selectedPage ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2 mb-8">
                        {pages.map(page => (
                            <button 
                                key={page.id} 
                                onClick={() => setSelectedPage(page.id)}
                                className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all text-left group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-brand-500 shadow-sm transition-colors shrink-0">
                                    <i className={`fas ${page.icon}`}></i>
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-brand-600 transition-colors">{page.label}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-3 mb-8">
                        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-900/50">
                            <i className={`fas ${pages.find(p => p.id === selectedPage)?.icon} text-sm`}></i>
                            <span className="text-xs font-black uppercase tracking-wider">{pages.find(p => p.id === selectedPage)?.label}</span>
                            <button onClick={() => setSelectedPage(null)} className="ml-auto text-[10px] underline uppercase font-bold opacity-60 hover:opacity-100">Trocar Página</button>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {periods.map(period => {
                                const isCurrent = period.id === currentPeriod;
                                return (
                                    <button 
                                        key={period.id} 
                                        onClick={() => onSelect(`${selectedPage}_${period.id}`)}
                                        className={`flex items-center justify-between p-5 rounded-2xl border transition-all group relative overflow-hidden ${
                                            isCurrent 
                                            ? 'bg-green-50 dark:bg-green-900/20 border-green-500 ring-2 ring-green-500/20' 
                                            : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className={`w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-xl shadow-sm ${period.color}`}>
                                                <i className={`fas ${period.icon}`}></i>
                                            </div>
                                            <div>
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-brand-600 transition-colors block">{period.label}</span>
                                                {isCurrent && <span className="text-[9px] font-black uppercase text-green-600 dark:text-green-400 tracking-widest bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded flex items-center gap-1 w-fit mt-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Agora</span>}
                                            </div>
                                        </div>
                                        <i className="fas fa-chevron-right text-slate-300 group-hover:text-brand-500 transition-all group-hover:translate-x-1 relative z-10"></i>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all uppercase text-xs tracking-wider">Cancelar</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const SystemAdmin: React.FC = () => {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'storage' | 'assets' | 'config' | 'acl'>('storage');
    const [stats, setStats] = useState<Record<string, number>>({});
    const [previews, setPreviews] = useState<Record<string, any[]>>({});
    const [dailyImages, setDailyImages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCleaning, setIsCleaning] = useState(false);
    const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [exploringCollection, setExploringCollection] = useState<string | null>(null);
    const [mappingImage, setMappingImage] = useState<any | null>(null);
    const [purgeModal, setPurgeModal] = useState<{ isOpen: boolean, target: string, title: string, desc: string, action?: () => Promise<void> } | null>(null);
    
    // ACL State
    const { usersList, updateUser } = useAuth();
    const [selectedUserForACL, setSelectedUserForACL] = useState<string | null>(null);
    const [aclPermissions, setAclPermissions] = useState<string[]>([]);
    const [isSavingACL, setIsSavingACL] = useState(false);
    const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const PERMISSION_ACTIONS_LABELS: Record<string, string> = {
        view: 'Visualizar',
        create: 'Criar',
        edit: 'Editar',
        delete: 'Excluir'
    };

    const MODULE_CONFIG: Record<string, { label: string, actions: string[] }> = {
        dashboard: { label: 'Dashboard', actions: ['view'] },
        repertory: { label: 'Repertório', actions: ['view', 'create', 'edit', 'delete'] },
        liturgy: { label: 'Liturgia', actions: ['view'] },
        scales: { label: 'Salmistas', actions: ['view', 'create', 'edit'] },
        users: { label: 'Equipe', actions: ['view', 'create', 'edit', 'delete'] },
        attendance: { label: 'Presença', actions: ['view', 'create', 'edit'] },
        rehearsals: { label: 'Agenda', actions: ['view', 'create', 'edit', 'delete'] },
        playlists: { label: 'Playlists', actions: ['view', 'create', 'edit', 'delete'] },
        polls: { label: 'Enquetes', actions: ['view', 'create', 'edit', 'delete'] },
        justifications: { label: 'Justificativas', actions: ['view', 'create', 'edit'] },
        monitoring: { label: 'Comando', actions: ['view'] },
        system: { label: 'Engine Room', actions: ['view', 'edit', 'delete'] }
    };

    const handleSelectUserACL = (userId: string) => {
        const user = usersList.find(u => u.username === userId);
        if (user) {
            setSelectedUserForACL(userId);
            
            if (user.customPermissions && user.customPermissions.length > 0) {
                setAclPermissions(user.customPermissions);
            } else {
                // Pre-fill with Role Defaults
                // We need to cast to any or keyof typeof DEFAULT_PERMISSIONS because TS might complain about string index
                const roleDefaults = (DEFAULT_PERMISSIONS as any)[user.role] || [];
                setAclPermissions([...roleDefaults]);
            }

            // On mobile, scroll to matrix
            if (window.innerWidth < 1024) {
                setTimeout(() => {
                    document.getElementById('acl-matrix')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        }
    };

    const togglePermission = (module: string, action: string) => {
        const perm = `${module}:${action}`;
        setAclPermissions(prev => {
            if (prev.includes(perm)) return prev.filter(p => p !== perm);
            return [...prev, perm];
        });
    };

    const handleSaveACL = async () => {
        if (!selectedUserForACL) return;
        setIsSavingACL(true);
        try {
            const user = usersList.find(u => u.username === selectedUserForACL);
            if (user) {
                await updateUser({ ...user, customPermissions: aclPermissions });
                setNotification({ message: "Permissões atualizadas com sucesso!", type: 'success' });
            }
        } catch (e) {
            setNotification({ message: "Erro ao salvar permissões.", type: 'error' });
        } finally {
            setIsSavingACL(false);
        }
    };

    const handleResetACL = async () => {
        if (!selectedUserForACL) return;
        if (confirm("Isso removerá todas as permissões personalizadas e o usuário voltará a ter as permissões padrão do seu Cargo (Role). Continuar?")) {
            setIsSavingACL(true);
            try {
                const user = usersList.find(u => u.username === selectedUserForACL);
                if (user) {
                    await updateUser({ ...user, customPermissions: [] }); // Empty array or undefined to reset
                    setAclPermissions([]);
                    setNotification({ message: "Permissões resetadas para o padrão do cargo.", type: 'success' });
                }
            } catch (e) {
                setNotification({ message: "Erro ao resetar permissões.", type: 'error' });
            } finally {
                setIsSavingACL(false);
            }
        }
    };

    const [customGeminiKey, setCustomGeminiKey] = useState('');
    const [customFirebaseConfig, setCustomFirebaseConfig] = useState('');
    const [geminiSource, setGeminiSource] = useState<'env' | 'custom'>('env');
    const [fbSource, setFbSource] = useState<'default' | 'custom'>('default');
    
    const [isEditingGemini, setIsEditingGemini] = useState(false);
    const [isEditingFirebase, setIsEditingFirebase] = useState(false);

    const [aiUsage, setAiUsage] = useState({ 
        textCount: 0, textTokens: 0,
        imageCount: 0, imageTokens: 0,
        audioCount: 0, audioTokens: 0
    });

    const collections = [
        'users', 'attendance', 'repertory', 'audit_logs', 
        'justifications', 'polls', 'daily_images', 
        'liturgy_cache', 'chat_histories', 'schedules', 'settings'
    ];

    const fetchAllData = async () => {
        setLoading(true);
        const newStats: Record<string, number> = {};
        const newPreviews: Record<string, any[]> = {};
        
        try {
            await Promise.all(collections.map(async (col) => {
                const colPath = `artifacts/${APP_ID}/public/data/${col}`;
                const snap = await getDocs(collection(db, colPath));
                newStats[col] = snap.size;
                
                const dataPreview = await SystemAdminService.getCollectionPreview(col);
                newPreviews[col] = dataPreview;
            }));
            setStats(newStats);
            setPreviews(newPreviews);

            const imgSnap = await getDocs(query(
                collection(db, `artifacts/${APP_ID}/public/data/daily_images`),
                orderBy('createdAt', 'desc'),
                limit(200)
            ));
            const imagesList = imgSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setDailyImages(imagesList);

            const yesterday = new Date();
            yesterday.setHours(yesterday.getHours() - 24);
            const yesterdayTimestamp = Timestamp.fromDate(yesterday);

            const recentImagesQuery = query(
                collection(db, `artifacts/${APP_ID}/public/data/daily_images`),
                where('createdAt', '>=', yesterdayTimestamp)
            );
            const recentImagesSnap = await getDocs(recentImagesQuery);
            const dailyImageCount = recentImagesSnap.size;
            
            const logsSnap = await getDocs(query(
                collection(db, `artifacts/${APP_ID}/public/data/audit_logs`),
                where('timestamp', '>=', yesterdayTimestamp)
            ));
            
            let textReqs = 0;
            let textTokens = 0;
            let imageReqs = dailyImageCount;
            let imageTokens = dailyImageCount * 2500; 
            let audioReqs = 0;
            let audioTokens = 0;

            logsSnap.docs.forEach(d => {
                const log = d.data();
                if (
                    (log.module === 'AI Assistant' && log.action === 'CREATE' && !log.details.toLowerCase().includes('imagem') && !log.details.toLowerCase().includes('voz')) ||
                    (log.module === 'Repertory' && log.action === 'AI_LYRICS') ||
                    (log.module === 'Liturgy' && log.action === 'AI_LITURGY')
                ) {
                    textReqs++;
                    textTokens += 1500;
                }
                else if (
                    (log.module === 'AI Assistant' && log.action === 'CREATE' && log.details.toLowerCase().includes('imagem')) ||
                    (log.module === 'Repertory' && log.action === 'AI_COVER')
                ) {
                    imageReqs++;
                    imageTokens += 2500;
                }
                else if (log.module === 'AI Assistant' && log.action === 'CREATE' && (log.details.toLowerCase().includes('voz') || log.details.toLowerCase().includes('speech'))) {
                    audioReqs++;
                    audioTokens += 500;
                }
            });

            setAiUsage({ 
                textCount: textReqs, textTokens: textTokens,
                imageCount: imageReqs, imageTokens: imageTokens,
                audioCount: audioReqs, audioTokens: audioTokens
            });

        } catch (e) {
            console.error("Erro no mapeamento Ops:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
        const localGemini = localStorage.getItem('uziel_custom_gemini_api_key');
        if (localGemini) {
            setCustomGeminiKey(localGemini);
            setGeminiSource('custom');
        } else {
            let envKey = "";
            try { envKey = import.meta.env.VITE_GEMINI_API_KEY || ""; } catch(e) {}
            if (!envKey) { try { envKey = process.env.GEMINI_API_KEY || ""; } catch(e) {} }
            
            setCustomGeminiKey(envKey);
            setGeminiSource('env');
        }
        const localFbConfig = localStorage.getItem('uziel_custom_firebase_config');
        if (localFbConfig) {
            try {
                const parsed = JSON.parse(localFbConfig);
                setCustomFirebaseConfig(JSON.stringify(parsed, null, 2));
                setFbSource('custom');
            } catch(e) {
                setCustomFirebaseConfig(JSON.stringify(DEFAULT_FIREBASE_CONFIG, null, 2));
                setFbSource('default');
            }
        } else {
            setCustomFirebaseConfig(JSON.stringify(DEFAULT_FIREBASE_CONFIG, null, 2));
            setFbSource('default');
        }
    }, []);

    const toggleImageSelection = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newSet = new Set(selectedImages);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedImages(newSet);
    };

    const deleteSelectedImages = async () => {
        if (selectedImages.size === 0) return;
        setIsCleaning(true);
        try {
            await DailyImageService.deleteImages(Array.from(selectedImages));
            if (currentUser) {
                await AuditService.log(currentUser.username, 'System', 'DELETE', `Removidos ${selectedImages.size} assets manuais do sistema.`, currentUser.role, currentUser.name);
            }
            setSelectedImages(new Set());
            fetchAllData();
        } catch (e) {
            alert("Erro ao remover ativos.");
        } finally {
            setIsCleaning(false);
            setPurgeModal(null);
        }
    };

    const handleClearInactiveImages = async () => {
        setIsCleaning(true);
        try {
            const inactive = dailyImages.filter(img => !img.isActive).map(img => img.id);
            if (inactive.length === 0) {
                alert("Nenhum asset inativo encontrado.");
                setIsCleaning(false);
                return;
            }
            await DailyImageService.deleteImages(inactive);
            if (currentUser) {
                await AuditService.log(currentUser.username, 'System', 'DELETE', `Limpeza em massa: ${inactive.length} assets antigos.`, currentUser.role, currentUser.name);
            }
            alert(`${inactive.length} imagens antigas foram removidas.`);
            fetchAllData();
        } catch (e) {
            alert("Erro na limpeza.");
        } finally {
            setIsCleaning(false);
        }
    };

    const handleApplyContext = async (context: string) => {
        if (!mappingImage) return;
        setIsCleaning(true);
        try {
            await DailyImageService.setActive(mappingImage.id, context);
            updateLocalCache(context, mappingImage.imageUrl);
            window.dispatchEvent(new CustomEvent('background-update', {
                detail: { contextKey: context, imageUrl: mappingImage.imageUrl }
            }));
            if (currentUser) {
                await AuditService.log(currentUser.username, 'System', 'UPDATE', `Mapeou imagem ${mappingImage.id} para o menu: ${context}`, currentUser.role, currentUser.name);
            }
            setMappingImage(null);
            fetchAllData();
        } catch (e) {
            alert("Erro ao atualizar contexto da imagem.");
        } finally {
            setIsCleaning(false);
        }
    };

    const handlePurgeCollection = async (target: string) => {
        setIsCleaning(true);
        try {
            const colRef = collection(db, `artifacts/${APP_ID}/public/data/${target}`);
            const snap = await getDocs(colRef);
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            if (currentUser) await AuditService.log(currentUser.username, 'System', 'DELETE', `OPS: Limpeza completa da coleção [${target}]`, currentUser.role, currentUser.name);
            fetchAllData();
        } catch (e) { alert("Erro na purga da coleção."); } 
        finally { setIsCleaning(false); setPurgeModal(null); }
    };

    const handleSaveConfigs = () => {
        try {
            const inputKey = customGeminiKey.trim();
            if (inputKey) {
                localStorage.setItem('uziel_custom_gemini_api_key', inputKey);
            } else {
                localStorage.removeItem('uziel_custom_gemini_api_key');
            }
            const inputFbConfig = customFirebaseConfig.trim();
            if (inputFbConfig) {
                const parsed = JSON.parse(inputFbConfig);
                if (!parsed.apiKey || !parsed.projectId) throw new Error("Configuração Firebase inválida (JSON incompleto).");
                localStorage.setItem('uziel_custom_firebase_config', JSON.stringify(parsed));
            } else {
                localStorage.removeItem('uziel_custom_firebase_config');
            }
            if (confirm("Configurações salvas no armazenamento local. A página será recarregada para aplicar as alterações. Continuar?")) {
                window.location.reload();
            }
        } catch (e: any) {
            alert("Erro ao salvar: " + e.message);
        }
    };

    const handleResetGemini = () => {
        if(confirm("Restaurar chave Gemini para o padrão do sistema (ENV)?")) {
            localStorage.removeItem('uziel_custom_gemini_api_key');
            
            let envKey = "";
            try { envKey = import.meta.env.VITE_GEMINI_API_KEY || ""; } catch(e) {}
            if (!envKey) { try { envKey = process.env.GEMINI_API_KEY || ""; } catch(e) {} }

            setCustomGeminiKey(envKey);
            setGeminiSource('env');
            setIsEditingGemini(false);
        }
    };

    const handleResetFirebase = () => {
        if(confirm("Restaurar configuração Firebase para o padrão do sistema?")) {
            localStorage.removeItem('uziel_custom_firebase_config');
            setCustomFirebaseConfig(JSON.stringify(DEFAULT_FIREBASE_CONFIG, null, 2));
            setFbSource('default');
            setIsEditingFirebase(false);
        }
    };

    const totalDocs = useMemo(() => {
        return (Object.values(stats) as number[]).reduce((a: number, b: number) => a + b, 0);
    }, [stats]);

    const estimatedUsageKB = totalDocs * 0.8;

    if (loading) return <Loading message="Auditando Sistemas..." />;

    return (
        <div className="space-y-8 animate-fade-in-up pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-100 dark:border-white/5 pb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <DevBadge label="Servidor Local: PR-S1" />
                        <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Núcleo de Operações Neurais</p>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-display font-bold text-slate-900 dark:text-white leading-[0.8] tracking-tight">
                        Engine <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-sky-400">Room</span>
                    </h1>
                </div>
                
                <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-3xl flex gap-1 shadow-inner border border-slate-200 dark:border-white/5 w-fit">
                    <button onClick={() => setActiveTab('storage')} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'storage' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-md' : 'text-slate-500'}`} title="Banco de Dados">
                        <i className="fas fa-database text-lg"></i>
                    </button>
                    <button onClick={() => setActiveTab('assets')} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'assets' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-md' : 'text-slate-500'}`} title="Assets de IA">
                        <i className="fas fa-images text-lg"></i>
                    </button>
                    <button onClick={() => setActiveTab('config')} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'config' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-md' : 'text-slate-500'}`} title="Infra & Cotas">
                        <i className="fas fa-microchip text-lg"></i>
                    </button>
                    <button onClick={() => setActiveTab('acl')} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'acl' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-md' : 'text-slate-500'}`} title="Controle de Acesso">
                        <i className="fas fa-user-shield text-lg"></i>
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'acl' && (
                    <motion.div key="acl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                            {/* User List */}
                            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 border border-slate-100 dark:border-white/5 shadow-xl flex flex-col">
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <i className="fas fa-users text-brand-500"></i> Selecione um Usuário
                                </h3>
                                <div className="space-y-2 pr-2">
                                    {usersList.map(user => (
                                        <button
                                            key={user.username}
                                            onClick={() => handleSelectUserACL(user.username)}
                                            className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-all text-left border ${
                                                selectedUserForACL === user.username
                                                ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-500 shadow-md'
                                                : 'bg-slate-50 dark:bg-white/5 border-transparent hover:bg-slate-100 dark:hover:bg-white/10'
                                            }`}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden ${
                                                user.role === 'super-admin' ? 'bg-purple-500' : user.role === 'admin' ? 'bg-blue-500' : 'bg-slate-400'
                                            }`}>
                                                {user.photoURL ? (
                                                    <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    user.name.charAt(0)
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold truncate ${selectedUserForACL === user.username ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                                    {user.name}
                                                </p>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{user.role}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Permissions Matrix */}
                            <div id="acl-matrix" className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 md:p-8 border border-slate-100 dark:border-white/5 shadow-xl flex flex-col relative overflow-hidden min-h-[500px]">
                                {selectedUserForACL ? (
                                    <>
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-100 dark:border-white/5 pb-6 gap-4">
                                            <div>
                                                <h2 className="text-xl md:text-2xl font-display font-bold text-slate-800 dark:text-white mb-1">
                                                    Matriz de Acesso
                                                </h2>
                                                <p className="text-sm text-slate-400">
                                                    Editando: <span className="text-brand-500 font-bold">{usersList.find(u => u.username === selectedUserForACL)?.name}</span>
                                                </p>
                                            </div>
                                            <div className="flex gap-2 w-full md:w-auto">
                                                <button 
                                                    onClick={handleResetACL}
                                                    className="flex-1 md:flex-none px-4 py-3 md:py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-xs font-bold uppercase tracking-wider"
                                                >
                                                    Resetar
                                                </button>
                                                <button 
                                                    onClick={handleSaveACL}
                                                    disabled={isSavingACL}
                                                    className="flex-[2] md:flex-none px-6 py-3 md:py-2 rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-500/30 hover:bg-brand-500 transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                                                >
                                                    {isSavingACL ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>}
                                                    Salvar
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 overflow-y-auto custom-scrollbar pr-2 pb-20 max-h-[60vh] lg:max-h-none">
                                            {Object.entries(PERMISSION_MODULES).map(([modKey, modValue]) => {
                                                const config = MODULE_CONFIG[modValue];
                                                if (!config) return null;

                                                return (
                                                <div key={modKey} className="bg-slate-50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-white/5">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 shadow-sm">
                                                            <i className={`fas ${
                                                                modValue === 'dashboard' ? 'fa-chart-pie' :
                                                                modValue === 'repertory' ? 'fa-music' :
                                                                modValue === 'liturgy' ? 'fa-calendar-check' :
                                                                modValue === 'scales' ? 'fa-calendar-alt' :
                                                                modValue === 'users' ? 'fa-users-cog' :
                                                                modValue === 'attendance' ? 'fa-clipboard-user' :
                                                                modValue === 'rehearsals' ? 'fa-calendar-day' :
                                                                modValue === 'playlists' ? 'fab fa-spotify' :
                                                                modValue === 'polls' ? 'fa-poll' :
                                                                modValue === 'justifications' ? 'fa-envelope-open-text' :
                                                                modValue === 'monitoring' ? 'fa-terminal' :
                                                                modValue === 'system' ? 'fa-microchip' :
                                                                'fa-cogs'
                                                            }`}></i>
                                                        </div>
                                                        <h4 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-xs tracking-widest">
                                                            {config.label}
                                                        </h4>
                                                    </div>
                                                    
                                                    <div className="space-y-2">
                                                        {config.actions.map((action) => {
                                                            const permString = `${modValue}:${action}`;
                                                            const isGlobalWildcard = aclPermissions.includes('*');
                                                            const isModuleWildcard = aclPermissions.includes(`${modValue}:*`);
                                                            const isChecked = isGlobalWildcard || isModuleWildcard || aclPermissions.includes(permString);
                                                            
                                                            return (
                                                                <label key={action} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-white/5 cursor-pointer transition-colors group select-none">
                                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 ${
                                                                        isChecked 
                                                                        ? 'bg-brand-500 border-brand-500 text-white' 
                                                                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                                                                    }`}>
                                                                        {isChecked && <i className="fas fa-check text-[10px]"></i>}
                                                                    </div>
                                                                    <input 
                                                                        type="checkbox" 
                                                                        className="hidden"
                                                                        checked={isChecked}
                                                                        onChange={() => togglePermission(modValue, action)}
                                                                        disabled={(isGlobalWildcard || isModuleWildcard)} 
                                                                    />
                                                                    <span className={`text-xs font-medium ${isChecked ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                                                                        {PERMISSION_ACTIONS_LABELS[action] || action}
                                                                        {modValue === 'users' && (action === 'delete' || action === 'edit') && (
                                                                            <span className="block text-[9px] text-brand-500 font-bold uppercase tracking-wider mt-0.5">
                                                                                *Exceto outros Admins
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )})}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-300 dark:text-slate-600 py-20 lg:py-0">
                                        <i className="fas fa-user-shield text-6xl mb-4 opacity-50"></i>
                                        <p className="text-lg font-bold uppercase tracking-widest text-center px-4">Selecione um usuário</p>
                                        <p className="text-sm mt-2 max-w-xs text-center opacity-70 px-4">Toque em um nome na lista acima para gerenciar suas permissões.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'storage' && (
                    <motion.div key="storage" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card noPadding className="p-6 border-brand-500/30 border-2 relative overflow-hidden">
                                <p className="text-[10px] uppercase font-black text-brand-400 tracking-widest mb-1">Mapeamento Total</p>
                                <p className="text-4xl font-mono font-bold text-slate-800 dark:text-white">{totalDocs}</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-brand-300/50 mt-1 uppercase tracking-wider">Documentos Registrados</p>
                            </Card>
                            <Card noPadding className="p-6 border-sky-500/30 border-2 relative overflow-hidden">
                                <p className="text-[10px] uppercase font-black text-sky-400 tracking-widest mb-1">Consumo de Dados</p>
                                <p className="text-4xl font-mono font-bold text-slate-800 dark:text-white">~{estimatedUsageKB.toFixed(1)} KB</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-sky-300/50 mt-1 uppercase tracking-wider">Persistência Firestore</p>
                            </Card>
                            <Card noPadding className="p-6 border-green-500/30 border-2 relative overflow-hidden">
                                <p className="text-[10px] uppercase font-black text-green-400 tracking-widest mb-1">Estado do Cluster</p>
                                <p className="text-4xl font-mono font-bold text-slate-800 dark:text-white">ESTÁVEL</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-green-300/50 mt-1 uppercase tracking-wider">Sincronização em 16ms</p>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 gap-8">
                            <div className="space-y-6">
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2 ml-2">
                                    <i className="fas fa-layer-group text-brand-500"></i> Auditoria de Estruturas
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {Object.entries(stats).map(([key, val]) => (
                                        <div 
                                            key={key} 
                                            onClick={() => setExploringCollection(key)}
                                            className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-white/5 flex flex-col overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
                                        >
                                            <div className="p-5 border-b border-slate-50 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-black/20">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-brand-500 group-hover:text-brand-600 transition-colors">{key.replace('_', ' ')}</p>
                                                    <p className="text-xl font-mono font-bold text-slate-800 dark:text-white">{val} docs</p>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setPurgeModal({ isOpen: true, target: key, title: `Limpar [${key}]`, desc: `Deseja realmente apagar os ${val} documentos da coleção "${key}"?`, action: () => handlePurgeCollection(key) }) }} 
                                                    className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                                >
                                                    <i className="fas fa-eraser"></i>
                                                </button>
                                            </div>
                                            <div className="p-5 space-y-2 flex-1 relative overflow-hidden">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Amostra Visual:</p>
                                                {previews[key]?.map((item, idx) => (
                                                    <div key={idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate">
                                                        <span className="text-brand-500 font-bold mr-2">{item.id?.slice(-4)}:</span>
                                                        {JSON.stringify(item).slice(0, 100)}...
                                                    </div>
                                                ))}
                                                {(!previews[key] || previews[key].length === 0) && <p className="text-xs text-slate-300 italic">Estrutura vazia.</p>}
                                                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white dark:from-slate-800 to-transparent pointer-events-none opacity-60"></div>
                                            </div>
                                            <div className="p-3 text-center border-t border-slate-50 dark:border-white/5 text-[9px] font-black uppercase text-brand-500 tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                                Explorar Dados Completos
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'assets' && (
                    <motion.div key="assets" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                        <div className="bg-slate-900 rounded-[3rem] p-10 border border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden shadow-2xl">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                            <div className="relative z-10">
                                <h3 className="text-3xl font-display font-bold text-white mb-2">Galeria de Ativos Neuronais</h3>
                                <p className="text-slate-400 text-sm max-w-md leading-relaxed">Gestão central de imagens geradas por IA. Cada asset pode ser reutilizado ou trocado manualmente para qualquer menu do portal.</p>
                            </div>
                            <div className="flex gap-4 relative z-10 flex-wrap justify-center">
                                {selectedImages.size > 0 && (
                                    <button 
                                        onClick={() => setPurgeModal({ isOpen: true, target: 'daily_images', title: 'Excluir Selecionados', desc: `Confirmar exclusão de ${selectedImages.size} assets selecionados?`, action: deleteSelectedImages })}
                                        className="px-8 py-5 rounded-2xl bg-red-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-red-500 shadow-lg shadow-red-500/20 transition-all flex items-center gap-3 animate-scale-in"
                                    >
                                        <i className="fas fa-trash"></i> Apagar Seleção ({selectedImages.size})
                                    </button>
                                )}
                                <button 
                                    onClick={handleClearInactiveImages}
                                    className="px-6 py-5 rounded-2xl bg-slate-800 text-red-400 font-bold text-xs uppercase tracking-widest border border-red-500/30 hover:bg-red-900/20 transition-all flex items-center gap-2"
                                >
                                    <i className="fas fa-broom"></i> Limpar Inativos
                                </button>
                                <button onClick={() => setSelectedImages(new Set())} className="px-6 py-5 rounded-2xl bg-white/5 text-slate-400 font-bold text-xs uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all">Limpar Seleção</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {dailyImages.map((img) => {
                                const isSelected = selectedImages.has(img.id);
                                const contextMap: Record<string, string> = {
                                    'home_hero_morning': 'Início: Manhã',
                                    'home_hero_afternoon': 'Início: Tarde',
                                    'home_hero_night': 'Início: Noite',
                                    'login_morning': 'Login: Manhã',
                                    'login_afternoon': 'Login: Tarde',
                                    'login_night': 'Login: Noite',
                                    'playlists_hero_morning': 'Playlists: Manhã',
                                    'playlists_hero_afternoon': 'Playlists: Tarde',
                                    'playlists_hero_night': 'Playlists: Noite',
                                    'calendar_hero_morning': 'Liturgia: Manhã',
                                    'calendar_hero_afternoon': 'Liturgia: Tarde',
                                    'calendar_hero_night': 'Liturgia: Noite',
                                    'rota_hero_morning': 'Escala: Manhã',
                                    'rota_hero_afternoon': 'Escala: Tarde',
                                    'rota_hero_night': 'Escala: Noite'
                                };
                                const cleanContext = img.context ? (contextMap[img.context] || img.context) : 'Geral / Outros';

                                return (
                                    <div key={img.id} className="flex flex-col gap-3 group animate-scale-in">
                                        <div 
                                            onClick={() => setViewingImage(img.imageUrl)}
                                            className={`relative aspect-square rounded-[2rem] overflow-hidden border-2 transition-all hover:shadow-2xl cursor-zoom-in ${isSelected ? 'border-brand-500 ring-4 ring-brand-500/20' : img.isActive ? 'border-green-500 shadow-lg' : 'border-slate-200 dark:border-white/5 opacity-60 grayscale hover:opacity-100 hover:grayscale-0'}`}
                                        >
                                            <img src={img.imageUrl} className="w-full h-full object-cover animate-breathing" alt="IA Asset" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none"></div>
                                            
                                            <div className="absolute top-4 left-4 z-20">
                                                <button 
                                                    onClick={(e) => toggleImageSelection(img.id, e)} 
                                                    className={`w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-brand-500 border-brand-500 text-white shadow-lg' : 'bg-black/30 border-white/20 text-white hover:bg-black/50'}`}
                                                >
                                                    <i className={`fas ${isSelected ? 'fa-check' : 'fa-plus'} text-xs`}></i>
                                                </button>
                                            </div>

                                            {img.isActive && (
                                                <div className="absolute top-4 right-4 bg-green-500 text-white text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg shadow-lg z-20 animate-pulse border border-white/20">
                                                    Em Uso
                                                </div>
                                            )}

                                            <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-1 z-20 pointer-events-none">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-white truncate drop-shadow-md bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/10 w-fit mb-1">{cleanContext}</span>
                                                    <span className="text-[8px] font-bold text-white/70 uppercase tracking-widest">{img.date}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setMappingImage(img)}
                                            className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm ${img.isActive ? 'bg-green-50 dark:bg-green-900/20 text-green-600 hover:bg-green-100' : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-brand-500 hover:text-white'}`}
                                        >
                                            {img.isActive ? 'Trocar Menu Ativo' : 'Ativar Manualmente'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {activeTab === 'config' && (
                    <motion.div key="config" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-6xl mx-auto space-y-8">
                        <div className="mb-8">
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] mb-4 flex items-center gap-2">
                                <i className="fas fa-chart-pie text-brand-500"></i> Consumo de Recursos de IA (24h)
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card noPadding className="p-5 border-indigo-500/20 border relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-2 relative z-10">
                                        <i className="fas fa-brain text-indigo-500 text-xl"></i>
                                        <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">Texto (LLM)</span>
                                    </div>
                                    <p className="text-3xl font-mono font-bold text-slate-800 dark:text-white relative z-10">
                                        {(aiUsage.textTokens >= 1000 ? (aiUsage.textTokens/1000).toFixed(1) + 'k' : aiUsage.textTokens)}
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide relative z-10">
                                        Tokens Consumidos ({aiUsage.textCount} reqs)
                                    </p>
                                    <div className="absolute -right-4 -bottom-4 text-8xl text-indigo-500/5 rotate-12"><i className="fas fa-brain"></i></div>
                                </Card>

                                <Card noPadding className="p-5 border-pink-500/20 border relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-2 relative z-10">
                                        <i className="fas fa-palette text-pink-500 text-xl"></i>
                                        <span className="text-[9px] font-black uppercase text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded">Imagem (Flash)</span>
                                    </div>
                                    <p className="text-3xl font-mono font-bold text-slate-800 dark:text-white relative z-10">
                                        {(aiUsage.imageTokens >= 1000 ? (aiUsage.imageTokens/1000).toFixed(1) + 'k' : aiUsage.imageTokens)}
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide relative z-10">
                                        Tokens Consumidos ({aiUsage.imageCount} imgs)
                                    </p>
                                    <div className="absolute -right-4 -bottom-4 text-8xl text-pink-500/5 rotate-12"><i className="fas fa-image"></i></div>
                                </Card>

                                <Card noPadding className="p-5 border-cyan-500/20 border relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-2 relative z-10">
                                        <i className="fas fa-volume-up text-cyan-500 text-xl"></i>
                                        <span className="text-[9px] font-black uppercase text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">Áudio (TTS)</span>
                                    </div>
                                    <p className="text-3xl font-mono font-bold text-slate-800 dark:text-white relative z-10">
                                        {(aiUsage.audioTokens >= 1000 ? (aiUsage.audioTokens/1000).toFixed(1) + 'k' : aiUsage.audioTokens)}
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide relative z-10">
                                        Tokens Consumidos ({aiUsage.audioCount} auds)
                                    </p>
                                    <div className="absolute -right-4 -bottom-4 text-8xl text-cyan-500/5 rotate-12"><i className="fas fa-waveform"></i></div>
                                </Card>

                                <Card noPadding className="p-5 border-amber-500/20 border relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-2 relative z-10">
                                        <i className="fas fa-coins text-amber-500 text-xl"></i>
                                        <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Total Estimado</span>
                                    </div>
                                    <p className="text-2xl font-mono font-bold text-slate-800 dark:text-white relative z-10">
                                        ~{((aiUsage.textTokens + aiUsage.imageTokens + aiUsage.audioTokens)/1000).toFixed(1)}k
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide relative z-10">Cota Diária Combinada</p>
                                    <div className="absolute -right-4 -bottom-4 text-8xl text-amber-500/5 rotate-12"><i className="fas fa-coins"></i></div>
                                </Card>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <Card className="p-8 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-6xl"><i className="fas fa-key"></i></div>
                                <h3 className="text-xl font-display font-bold text-slate-800 dark:text-white mb-6 border-b border-slate-100 dark:border-white/5 pb-4 flex items-center gap-3">
                                    <i className="fas fa-shield-alt text-brand-500"></i> Segurança & Provedores
                                </h3>
                                <div className="space-y-6">
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gemini API Key</label>
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${geminiSource === 'env' ? 'bg-slate-200 dark:bg-white/10 text-slate-500' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                                FONTE: {geminiSource === 'env' ? 'ARQUIVO / ENV' : 'PERSONALIZADA / LOCAL'}
                                            </span>
                                        </div>
                                        
                                        {isEditingGemini ? (
                                            <div className="flex items-center gap-2 animate-fade-in-right">
                                                <div className="flex-1 flex items-center gap-4 bg-slate-100 dark:bg-black/40 p-4 rounded-2xl font-mono text-xs text-slate-500 border-2 border-brand-500 shadow-sm relative">
                                                    <i className="fas fa-microchip text-brand-500"></i>
                                                    <input 
                                                        type="text" 
                                                        value={customGeminiKey}
                                                        onChange={(e) => { setCustomGeminiKey(e.target.value); setGeminiSource('custom'); }}
                                                        placeholder="Sua chave API aqui..." 
                                                        className="bg-transparent border-none outline-none w-full text-slate-700 dark:text-slate-300 font-bold pr-8"
                                                        autoFocus
                                                    />
                                                </div>
                                                <button onClick={() => setIsEditingGemini(false)} className="w-12 h-12 rounded-2xl bg-brand-500 text-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
                                                    <i className="fas fa-check"></i>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="group relative" onClick={() => setIsEditingGemini(true)}>
                                                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-white/10 cursor-pointer hover:border-brand-500/50 transition-colors shadow-inner">
                                                    <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-500">
                                                        <i className="fas fa-key text-xs"></i>
                                                    </div>
                                                    <div className="flex-1 font-mono text-xs text-slate-600 dark:text-slate-400 truncate">
                                                        {customGeminiKey && customGeminiKey.length > 10 
                                                            ? `${customGeminiKey.substring(0, 8)}••••••••••••••••${customGeminiKey.substring(customGeminiKey.length - 4)}`
                                                            : '••••••••••••••••••••••••'
                                                        }
                                                    </div>
                                                    {geminiSource === 'custom' && (
                                                        <button onClick={(e) => {e.stopPropagation(); handleResetGemini();}} className="text-slate-400 hover:text-red-500 p-2" title="Restaurar Padrão">
                                                            <i className="fas fa-undo"></i>
                                                        </button>
                                                    )}
                                                </div>
                                                <button className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-brand-500 text-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                                                    <i className="fas fa-pen text-xs"></i>
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-[9px] text-slate-400 mt-2 ml-1">O valor exibido é a chave ativa no momento.</p>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Firebase Cloud Config</label>
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${fbSource === 'default' ? 'bg-slate-200 dark:bg-white/10 text-slate-500' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                                FONTE: {fbSource === 'default' ? 'PADRÃO / HARDCODED' : 'PERSONALIZADA / LOCAL'}
                                            </span>
                                        </div>
                                        
                                        {isEditingFirebase ? (
                                            <div className="relative animate-fade-in-up">
                                                <textarea 
                                                    value={customFirebaseConfig}
                                                    onChange={(e) => { setCustomFirebaseConfig(e.target.value); setFbSource('custom'); }}
                                                    placeholder='Cole o objeto JSON do Firebase aqui...'
                                                    className="w-full h-48 bg-slate-100 dark:bg-black/40 p-4 rounded-2xl font-mono text-xs text-slate-700 dark:text-slate-300 border-2 border-brand-500 outline-none transition-colors resize-none shadow-sm"
                                                    autoFocus
                                                />
                                                <div className="absolute bottom-4 right-4 flex gap-2">
                                                    <button onClick={() => setIsEditingFirebase(false)} className="px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg hover:bg-brand-600 transition-colors">
                                                        Confirmar Edição
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="relative group cursor-pointer" onClick={() => setIsEditingFirebase(true)}>
                                                <div className="w-full h-48 bg-[#1e1e1e] p-4 rounded-2xl border border-slate-800 shadow-inner overflow-hidden relative">
                                                    <div className="absolute top-0 left-0 w-full h-6 bg-[#252526] border-b border-[#333] flex items-center px-3 gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                                                        <span className="ml-2 text-[10px] text-slate-500 font-mono">firebase_config.json</span>
                                                    </div>
                                                    <pre className="mt-4 font-mono text-[10px] text-blue-300 overflow-hidden opacity-90 leading-relaxed">
                                                        {customFirebaseConfig.slice(0, 300)}...
                                                    </pre>
                                                    <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e1e] via-transparent to-transparent pointer-events-none"></div>
                                                    <div className="absolute bottom-3 right-4 text-[10px] font-mono text-slate-500">JSON • Read Only</div>
                                                </div>
                                                
                                                <button className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-brand-500 text-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 z-10">
                                                    <i className="fas fa-pen text-xs"></i>
                                                </button>

                                                {fbSource === 'custom' && (
                                                    <button onClick={(e) => {e.stopPropagation(); handleResetFirebase();}} className="absolute bottom-4 right-4 z-20 text-slate-400 hover:text-red-500 bg-white/10 p-2 rounded-lg backdrop-blur-sm" title="Restaurar Padrão">
                                                        <i className="fas fa-undo"></i>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <button 
                                        onClick={handleSaveConfigs}
                                        className="w-full py-4 rounded-2xl bg-brand-600 text-white font-bold uppercase text-xs tracking-widest hover:bg-brand-500 transition-all shadow-lg mt-4"
                                    >
                                        Salvar e Aplicar Configurações
                                    </button>
                                </div>
                            </Card>

                            <Card className="p-8 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-6xl"><i className="fas fa-network-wired"></i></div>
                                <h3 className="text-xl font-display font-bold text-slate-800 dark:text-white mb-6 border-b border-slate-100 dark:border-white/5 pb-4 flex items-center gap-3">
                                    <i className="fas fa-cloud-sun text-sky-500"></i> Cluster de Persistência
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10">
                                        <p className="text-[9px] font-black uppercase text-slate-400 mb-1">ID do Projeto (Firestore)</p>
                                        <p className="font-mono text-xs text-slate-700 dark:text-slate-200 font-bold">portal-uziel-295cb</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10">
                                        <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Identidade do WebApp</p>
                                        <p className="font-mono text-xs text-slate-700 dark:text-slate-200 font-bold truncate">1:98540572300:web</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10">
                                        <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Bucket Principal</p>
                                        <p className="font-mono text-xs text-slate-700 dark:text-slate-200 font-bold truncate">portal-uziel-295cb.firebasestorage.app</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10">
                                        <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Região Geográfica</p>
                                        <p className="font-mono text-xs text-green-500 font-bold">multi-region (US/SA-E1)</p>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        <Card className="p-10 shadow-2xl">
                            <h3 className="text-2xl font-display font-bold text-slate-800 dark:text-white mb-8 border-b border-slate-100 dark:border-white/5 pb-4 flex items-center gap-3">
                                <i className="fas fa-server"></i> Ambiente de Produção Edge
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-1">CDN Network</label>
                                    <div className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 flex items-center justify-between group hover:border-brand-500 transition-colors">
                                        <span className="font-mono text-sm text-green-500 uppercase tracking-widest font-black">Cloudflare Proxy Ativo</span>
                                        <i className="fas fa-globe text-slate-300 group-hover:text-brand-500 transition-colors"></i>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-1">Runtime Status</label>
                                    <div className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 flex items-center justify-between group hover:border-brand-500 transition-colors">
                                        <span className="font-mono text-sm text-blue-500 uppercase tracking-widest font-black">Node 20.x • React 19</span>
                                        <i className="fab fa-react text-slate-300 group-hover:text-brand-500 transition-colors"></i>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {viewingImage && <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />}

            {exploringCollection && (
                <DataExplorerModal 
                    collectionName={exploringCollection} 
                    onClose={() => setExploringCollection(null)} 
                />
            )}

            {mappingImage && (
                <ContextSelectorModal 
                    currentImage={mappingImage} 
                    onSelect={handleApplyContext} 
                    onClose={() => setMappingImage(null)} 
                />
            )}

            {purgeModal && (
                <DeleteConfirmationModal 
                    isOpen={purgeModal.isOpen} 
                    onClose={() => setPurgeModal(null)} 
                    onConfirm={purgeModal.action!} 
                    title={purgeModal.title} 
                    description={purgeModal.desc} 
                    isProcessing={isCleaning} 
                />
            )}

            {notification && createPortal(
                <div className="fixed bottom-6 right-6 z-[10000] animate-fade-in-up">
                    <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border ${
                        notification.type === 'success' 
                        ? 'bg-green-500 text-white border-green-400' 
                        : 'bg-red-500 text-white border-red-400'
                    }`}>
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg">
                            <i className={`fas ${notification.type === 'success' ? 'fa-check' : 'fa-exclamation-triangle'}`}></i>
                        </div>
                        <div>
                            <p className="font-bold text-sm uppercase tracking-wider">{notification.type === 'success' ? 'Sucesso' : 'Erro'}</p>
                            <p className="text-xs font-medium opacity-90">{notification.message}</p>
                        </div>
                        <button onClick={() => setNotification(null)} className="ml-4 opacity-60 hover:opacity-100 transition-opacity">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default SystemAdmin;