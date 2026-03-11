
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
    const [copiedId, setCopiedId] = useState<string | null>(null);

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

    const handleCopy = (item: any) => {
        navigator.clipboard.writeText(JSON.stringify(item, null, 2));
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

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
                                        <button 
                                            className={`px-4 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                                                copiedId === item.id 
                                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105' 
                                                    : 'bg-slate-100 dark:bg-white/5 hover:bg-brand-500 hover:text-white text-slate-500 dark:text-slate-400'
                                            }`} 
                                            onClick={() => handleCopy(item)}
                                        >
                                            {copiedId === item.id ? (
                                                <><i className="fas fa-check"></i> Copiado!</>
                                            ) : (
                                                <><i className="fas fa-copy"></i> Copiar Estrutura</>
                                            )}
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
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            System Online
                        </div>
                        <DevBadge label="PR-S1" />
                        <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] hidden sm:block">Núcleo de Operações Neurais</p>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-display font-bold text-slate-900 dark:text-white leading-[0.8] tracking-tight">
                        Engine <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-sky-400">Room</span>
                    </h1>
                </div>
                
                <div className="bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl flex flex-wrap md:flex-nowrap gap-1 shadow-inner border border-slate-200/50 dark:border-white/5 w-full md:w-fit backdrop-blur-xl">
                    <button onClick={() => setActiveTab('storage')} className={`flex-1 md:flex-none px-4 h-11 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-[11px] uppercase tracking-wider ${activeTab === 'storage' ? 'bg-white dark:bg-brand-500 text-brand-600 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-brand-400/50' : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-white/5'}`} title="Banco de Dados">
                        <i className="fas fa-database text-sm"></i> <span className="hidden sm:inline">Storage</span>
                    </button>
                    <button onClick={() => setActiveTab('assets')} className={`flex-1 md:flex-none px-4 h-11 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-[11px] uppercase tracking-wider ${activeTab === 'assets' ? 'bg-white dark:bg-brand-500 text-brand-600 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-brand-400/50' : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-white/5'}`} title="Assets de IA">
                        <i className="fas fa-images text-sm"></i> <span className="hidden sm:inline">Assets IA</span>
                    </button>
                    <button onClick={() => setActiveTab('config')} className={`flex-1 md:flex-none px-4 h-11 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-[11px] uppercase tracking-wider ${activeTab === 'config' ? 'bg-white dark:bg-brand-500 text-brand-600 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-brand-400/50' : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-white/5'}`} title="Infra & Cotas">
                        <i className="fas fa-microchip text-sm"></i> <span className="hidden sm:inline">Infra</span>
                    </button>
                    <button onClick={() => setActiveTab('acl')} className={`flex-1 md:flex-none px-4 h-11 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-[11px] uppercase tracking-wider ${activeTab === 'acl' ? 'bg-white dark:bg-brand-500 text-brand-600 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-brand-400/50' : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-white/5'}`} title="Controle de Acesso">
                        <i className="fas fa-user-shield text-sm"></i> <span className="hidden sm:inline">ACL</span>
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'acl' && (
                    <motion.div key="acl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                            {/* User List */}
                            <div className="bg-white dark:bg-slate-800/80 backdrop-blur-md rounded-3xl p-6 border border-slate-200/50 dark:border-white/10 shadow-xl flex flex-col h-full max-h-[800px]">
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] mb-6 flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-white/5">
                                    <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500 border border-brand-100 dark:border-brand-500/20">
                                        <i className="fas fa-users"></i>
                                    </div>
                                    Diretório de Usuários
                                </h3>
                                <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1">
                                    {usersList.map(user => (
                                        <button
                                            key={user.username}
                                            onClick={() => handleSelectUserACL(user.username)}
                                            className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all text-left border group relative overflow-hidden ${
                                                selectedUserForACL === user.username
                                                ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-500 shadow-md ring-1 ring-brand-500/50'
                                                : 'bg-slate-50/50 dark:bg-white/5 border-slate-200/50 dark:border-white/5 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm hover:border-brand-500/30'
                                            }`}
                                        >
                                            {selectedUserForACL === user.username && (
                                                <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 to-transparent pointer-events-none"></div>
                                            )}
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden shadow-inner relative z-10 ${
                                                user.role === 'super-admin' ? 'bg-gradient-to-br from-purple-400 to-purple-600' : user.role === 'admin' ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gradient-to-br from-slate-400 to-slate-600'
                                            }`}>
                                                {user.photoURL ? (
                                                    <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    user.name.charAt(0)
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 relative z-10">
                                                <p className={`text-sm font-bold truncate transition-colors ${selectedUserForACL === user.username ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-400'}`}>
                                                    {user.name}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                                                        user.role === 'super-admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                        user.role === 'admin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                                    }`}>
                                                        {user.role}
                                                    </span>
                                                </div>
                                            </div>
                                            {selectedUserForACL === user.username && (
                                                <i className="fas fa-chevron-right text-brand-500 opacity-50 relative z-10"></i>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Permissions Matrix */}
                            <div id="acl-matrix" className="lg:col-span-2 bg-white dark:bg-slate-800/80 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-slate-200/50 dark:border-white/10 shadow-xl flex flex-col relative overflow-hidden min-h-[500px]">
                                {selectedUserForACL ? (
                                    <>
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-100 dark:border-white/5 pb-6 gap-4 relative z-10">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500 border border-brand-100 dark:border-brand-500/20 hidden md:flex">
                                                    <i className="fas fa-shield-alt text-xl"></i>
                                                </div>
                                                <div>
                                                    <h2 className="text-xl md:text-2xl font-display font-bold text-slate-800 dark:text-white mb-1">
                                                        Matriz de Acesso
                                                    </h2>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                        Editando permissões para: <span className="text-brand-600 dark:text-brand-400 font-bold bg-brand-50 dark:bg-brand-500/10 px-2 py-0.5 rounded-md ml-1">{usersList.find(u => u.username === selectedUserForACL)?.name}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 w-full md:w-auto">
                                                <button 
                                                    onClick={handleResetACL}
                                                    className="flex-1 md:flex-none px-5 py-3 md:py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-[10px] font-black uppercase tracking-widest border border-transparent hover:border-red-200 dark:hover:border-red-900/50"
                                                >
                                                    Descartar
                                                </button>
                                                <button 
                                                    onClick={handleSaveACL}
                                                    disabled={isSavingACL}
                                                    className="flex-[2] md:flex-none px-6 py-3 md:py-2.5 rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-500/30 hover:bg-brand-500 hover:-translate-y-0.5 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0"
                                                >
                                                    {isSavingACL ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>}
                                                    Salvar Alterações
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 overflow-y-auto custom-scrollbar pr-2 pb-20 max-h-[60vh] lg:max-h-none relative z-10">
                                            {Object.entries(PERMISSION_MODULES).map(([modKey, modValue]) => {
                                                const config = MODULE_CONFIG[modValue];
                                                if (!config) return null;

                                                return (
                                                <div key={modKey} className="bg-slate-50/50 dark:bg-black/20 rounded-2xl p-5 border border-slate-200/50 dark:border-white/5 hover:border-brand-500/30 transition-colors group">
                                                    <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-200/50 dark:border-white/5">
                                                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 shadow-sm border border-slate-100 dark:border-white/5 group-hover:text-brand-500 transition-colors">
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
                                                        <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[10px] tracking-widest">
                                                            {config.label}
                                                        </h4>
                                                    </div>
                                                    
                                                    <div className="space-y-2.5">
                                                        {config.actions.map((action) => {
                                                            const permString = `${modValue}:${action}`;
                                                            const isGlobalWildcard = aclPermissions.includes('*');
                                                            const isModuleWildcard = aclPermissions.includes(`${modValue}:*`);
                                                            const isChecked = isGlobalWildcard || isModuleWildcard || aclPermissions.includes(permString);
                                                            
                                                            return (
                                                                <label key={action} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-white/5 cursor-pointer transition-all group/item select-none border border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:shadow-sm">
                                                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                                                        isChecked 
                                                                        ? 'bg-brand-500 border-brand-500 text-white shadow-sm shadow-brand-500/30' 
                                                                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 group-hover/item:border-brand-400'
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
                                                                    <span className={`text-xs font-medium transition-colors ${isChecked ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 group-hover/item:text-slate-800 dark:group-hover/item:text-slate-200'}`}>
                                                                        {PERMISSION_ACTIONS_LABELS[action] || action}
                                                                        {modValue === 'users' && (action === 'delete' || action === 'edit') && (
                                                                            <span className="block text-[9px] text-brand-500 font-bold uppercase tracking-wider mt-1 opacity-80">
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
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 py-20 lg:py-0 relative z-10">
                                        <div className="w-24 h-24 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-6 border border-slate-100 dark:border-white/5 shadow-inner">
                                            <i className="fas fa-user-shield text-4xl text-slate-300 dark:text-slate-600"></i>
                                        </div>
                                        <p className="text-lg font-black uppercase tracking-widest text-center px-4 text-slate-700 dark:text-slate-300">Selecione um usuário</p>
                                        <p className="text-xs mt-3 max-w-xs text-center opacity-80 px-4 leading-relaxed">Escolha um perfil no diretório ao lado para visualizar e configurar sua matriz de acesso ao sistema.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'storage' && (
                    <motion.div key="storage" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card noPadding className="p-5 border-brand-500/30 border-2 relative overflow-hidden group bg-gradient-to-br from-brand-500/5 to-transparent">
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 dark:text-brand-400 border border-brand-500/20">
                                            <i className="fas fa-database text-lg"></i>
                                        </div>
                                        <div>
                                            <h4 className="text-slate-800 dark:text-white font-bold text-sm">Mapeamento Total</h4>
                                            <p className="text-[9px] text-brand-600 dark:text-brand-400 uppercase tracking-widest font-black">Documentos Registrados</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative z-10 mt-2">
                                    <p className="text-4xl font-mono font-bold text-slate-800 dark:text-white">{totalDocs}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-brand-300/60 font-bold uppercase tracking-wide mt-1">Entidades no Firestore</p>
                                </div>
                                <div className="absolute -right-4 -bottom-4 text-8xl text-brand-500/5 rotate-12 transition-transform hover:scale-110 hover:rotate-6"><i className="fas fa-database"></i></div>
                            </Card>

                            <Card noPadding className="p-5 border-sky-500/30 border-2 relative overflow-hidden group bg-gradient-to-br from-sky-500/5 to-transparent">
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-500 dark:text-sky-400 border border-sky-500/20">
                                            <i className="fas fa-hdd text-lg"></i>
                                        </div>
                                        <div>
                                            <h4 className="text-slate-800 dark:text-white font-bold text-sm">Consumo de Dados</h4>
                                            <p className="text-[9px] text-sky-600 dark:text-sky-400 uppercase tracking-widest font-black">Persistência Firestore</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative z-10 mt-2">
                                    <p className="text-4xl font-mono font-bold text-slate-800 dark:text-white">~{estimatedUsageKB.toFixed(1)} <span className="text-xl text-slate-400">KB</span></p>
                                    <p className="text-[10px] text-slate-500 dark:text-sky-300/60 font-bold uppercase tracking-wide mt-1">Estimativa de Volume</p>
                                </div>
                                <div className="absolute -right-4 -bottom-4 text-8xl text-sky-500/5 rotate-12 transition-transform hover:scale-110 hover:rotate-6"><i className="fas fa-hdd"></i></div>
                            </Card>

                            <Card noPadding className="p-5 border-emerald-500/30 border-2 relative overflow-hidden group bg-gradient-to-br from-emerald-500/5 to-transparent">
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
                                            <i className="fas fa-server text-lg"></i>
                                        </div>
                                        <div>
                                            <h4 className="text-slate-800 dark:text-white font-bold text-sm">Estado do Cluster</h4>
                                            <p className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-black">Health Check</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative z-10 mt-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                        <p className="text-4xl font-mono font-bold text-slate-800 dark:text-white">ESTÁVEL</p>
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-emerald-300/60 font-bold uppercase tracking-wide mt-1">Sincronização em 16ms</p>
                                </div>
                                <div className="absolute -right-4 -bottom-4 text-8xl text-emerald-500/5 rotate-12 transition-transform hover:scale-110 hover:rotate-6"><i className="fas fa-network-wired"></i></div>
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
                                            className="bg-white dark:bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-200/50 dark:border-white/10 flex flex-col overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-brand-500/50 transition-all cursor-pointer group relative"
                                        >
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-brand-500/20"></div>
                                            <div className="p-5 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-black/20 relative z-10">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500 border border-brand-100 dark:border-brand-500/20">
                                                        <i className="fas fa-folder-open"></i>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase text-brand-500 group-hover:text-brand-400 transition-colors tracking-widest">{key.replace('_', ' ')}</p>
                                                        <p className="text-2xl font-mono font-bold text-slate-800 dark:text-white leading-none mt-1">{val} <span className="text-xs text-slate-400 font-sans font-medium uppercase tracking-wider">docs</span></p>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setPurgeModal({ isOpen: true, target: key, title: `Limpar [${key}]`, desc: `Deseja realmente apagar os ${val} documentos da coleção "${key}"?`, action: () => handlePurgeCollection(key) }) }} 
                                                    className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center border border-red-100 dark:border-red-900/30"
                                                    title="Limpar Coleção"
                                                >
                                                    <i className="fas fa-eraser"></i>
                                                </button>
                                            </div>
                                            <div className="p-5 space-y-2 flex-1 relative overflow-hidden bg-slate-50/30 dark:bg-transparent">
                                                <div className="flex items-center justify-between mb-3">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Amostra de Dados</p>
                                                    <i className="fas fa-code text-slate-300 dark:text-slate-600"></i>
                                                </div>
                                                {previews[key]?.map((item, idx) => (
                                                    <div key={idx} className="p-3 rounded-xl bg-white dark:bg-black/40 border border-slate-200/50 dark:border-white/5 text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate shadow-sm">
                                                        <span className="text-brand-500 font-bold mr-2">{item.id?.slice(-4)}:</span>
                                                        <span className="opacity-80">{JSON.stringify(item).slice(0, 80)}...</span>
                                                    </div>
                                                ))}
                                                {(!previews[key] || previews[key].length === 0) && (
                                                    <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-500">
                                                        <i className="fas fa-box-open text-2xl mb-2 opacity-50"></i>
                                                        <p className="text-xs italic">Estrutura vazia</p>
                                                    </div>
                                                )}
                                                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white dark:from-slate-800 to-transparent pointer-events-none opacity-80"></div>
                                            </div>
                                            <div className="p-3 text-center border-t border-slate-100 dark:border-white/5 text-[9px] font-black uppercase text-brand-500 tracking-widest opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50/50 dark:bg-black/20">
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
                                            className={`relative aspect-square rounded-[2rem] overflow-hidden border-2 transition-all hover:shadow-2xl cursor-zoom-in ${isSelected ? 'border-brand-500 ring-4 ring-brand-500/20' : img.isActive ? 'border-green-500 shadow-lg shadow-green-500/20' : 'border-slate-200 dark:border-white/5 opacity-70 hover:opacity-100'}`}
                                        >
                                            <img src={img.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="IA Asset" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 pointer-events-none"></div>
                                            
                                            <div className="absolute top-4 left-4 z-20">
                                                <button 
                                                    onClick={(e) => toggleImageSelection(img.id, e)} 
                                                    className={`w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all backdrop-blur-md ${isSelected ? 'bg-brand-500 border-brand-500 text-white shadow-lg' : 'bg-black/30 border-white/20 text-white hover:bg-black/60'}`}
                                                >
                                                    <i className={`fas ${isSelected ? 'fa-check' : 'fa-plus'} text-xs`}></i>
                                                </button>
                                            </div>

                                            {img.isActive && (
                                                <div className="absolute top-4 right-4 bg-green-500/90 backdrop-blur-md text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-xl shadow-lg z-20 animate-pulse border border-green-400/50 flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                                    Em Uso
                                                </div>
                                            )}

                                            <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-1 z-20 pointer-events-none">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-white truncate drop-shadow-md bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/10 w-fit mb-1">{cleanContext}</span>
                                                    <span className="text-[8px] font-bold text-white/70 uppercase tracking-widest">{img.date ? img.date.split('-').reverse().join('/') : ''}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setMappingImage(img)}
                                            className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 ${img.isActive ? 'bg-green-50 dark:bg-green-900/20 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-brand-500 hover:text-white border border-transparent'}`}
                                        >
                                            {img.isActive ? <><i className="fas fa-exchange-alt"></i> Trocar Menu Ativo</> : <><i className="fas fa-bolt"></i> Ativar Manualmente</>}
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
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                <Card noPadding className="p-5 border-indigo-500/30 border-2 relative overflow-hidden group bg-gradient-to-br from-indigo-500/5 to-transparent">
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400 border border-indigo-500/20">
                                                <i className="fas fa-brain text-lg"></i>
                                            </div>
                                            <div>
                                                <h4 className="text-slate-800 dark:text-white font-bold text-sm">Texto (LLM)</h4>
                                                <p className="text-[9px] text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-black">Geração de Texto</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 relative z-10">
                                        <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Prompts (Reqs)</p>
                                            <p className="text-xl font-mono font-bold text-slate-800 dark:text-white">{aiUsage.textCount}</p>
                                        </div>
                                        <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Tokens (Est.)</p>
                                            <p className="text-xl font-mono font-bold text-slate-800 dark:text-white">{(aiUsage.textTokens >= 1000 ? (aiUsage.textTokens/1000).toFixed(1) + 'k' : aiUsage.textTokens)}</p>
                                        </div>
                                    </div>
                                    <div className="absolute -right-4 -bottom-4 text-8xl text-indigo-500/5 rotate-12 transition-transform hover:scale-110 hover:rotate-6"><i className="fas fa-brain"></i></div>
                                </Card>

                                <Card noPadding className="p-5 border-pink-500/30 border-2 relative overflow-hidden group bg-gradient-to-br from-pink-500/5 to-transparent">
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500 dark:text-pink-400 border border-pink-500/20">
                                                <i className="fas fa-palette text-lg"></i>
                                            </div>
                                            <div>
                                                <h4 className="text-slate-800 dark:text-white font-bold text-sm">Imagem (Flash)</h4>
                                                <p className="text-[9px] text-pink-600 dark:text-pink-400 uppercase tracking-widest font-black">Geração Visual</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 relative z-10">
                                        <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Prompts (Reqs)</p>
                                            <p className="text-xl font-mono font-bold text-slate-800 dark:text-white">{aiUsage.imageCount}</p>
                                        </div>
                                        <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Imagens</p>
                                            <p className="text-xl font-mono font-bold text-slate-800 dark:text-white">{aiUsage.imageCount}</p>
                                        </div>
                                    </div>
                                    <div className="absolute -right-4 -bottom-4 text-8xl text-pink-500/5 rotate-12 transition-transform hover:scale-110 hover:rotate-6"><i className="fas fa-image"></i></div>
                                </Card>

                                <Card noPadding className="p-5 border-cyan-500/30 border-2 relative overflow-hidden group bg-gradient-to-br from-cyan-500/5 to-transparent">
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-500 dark:text-cyan-400 border border-cyan-500/20">
                                                <i className="fas fa-volume-up text-lg"></i>
                                            </div>
                                            <div>
                                                <h4 className="text-slate-800 dark:text-white font-bold text-sm">Áudio (TTS)</h4>
                                                <p className="text-[9px] text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-black">Síntese de Voz</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 relative z-10">
                                        <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Prompts (Reqs)</p>
                                            <p className="text-xl font-mono font-bold text-slate-800 dark:text-white">{aiUsage.audioCount}</p>
                                        </div>
                                        <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Caracteres</p>
                                            <p className="text-xl font-mono font-bold text-slate-800 dark:text-white">{(aiUsage.audioTokens >= 1000 ? (aiUsage.audioTokens/1000).toFixed(1) + 'k' : aiUsage.audioTokens)}</p>
                                        </div>
                                    </div>
                                    <div className="absolute -right-4 -bottom-4 text-8xl text-cyan-500/5 rotate-12 transition-transform hover:scale-110 hover:rotate-6"><i className="fas fa-waveform"></i></div>
                                </Card>

                                <Card noPadding className="p-6 border-amber-500/40 border-2 relative overflow-hidden group bg-gradient-to-br from-amber-500/10 to-transparent">
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 dark:text-amber-400 border border-amber-500/20">
                                                <i className="fas fa-chart-line text-lg"></i>
                                            </div>
                                            <div>
                                                <h4 className="text-slate-800 dark:text-white font-bold text-sm">Cota Diária</h4>
                                                <p className="text-[9px] text-amber-600 dark:text-amber-400 uppercase tracking-widest font-black">Limite Free Tier</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="relative z-10 mt-2">
                                        <div className="flex justify-between items-end mb-2">
                                            <p className="text-3xl font-mono font-bold text-slate-800 dark:text-white leading-none">
                                                {aiUsage.textCount + aiUsage.imageCount + aiUsage.audioCount}
                                            </p>
                                            <p className="text-xs font-bold text-slate-400 mb-1">/ 1500 <span className="text-[9px] uppercase tracking-wider">Reqs</span></p>
                                        </div>
                                        
                                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mt-3 overflow-hidden border border-slate-300 dark:border-slate-700 shadow-inner">
                                            <div className="bg-gradient-to-r from-amber-400 to-amber-600 h-full rounded-full relative" style={{ width: `${Math.min(100, ((aiUsage.textCount + aiUsage.imageCount + aiUsage.audioCount) / 1500) * 100)}%` }}>
                                                <div className="absolute inset-0 bg-white/20 w-full h-full animate-pulse"></div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between mt-2">
                                            <p className="text-[9px] text-slate-500 dark:text-amber-300/60 font-bold uppercase tracking-wide">Consumo Atual</p>
                                            <p className="text-[9px] text-slate-500 dark:text-amber-300/60 font-bold uppercase tracking-wide">{((aiUsage.textCount + aiUsage.imageCount + aiUsage.audioCount) / 1500 * 100).toFixed(1)}%</p>
                                        </div>
                                    </div>
                                    <div className="absolute -right-6 -bottom-6 text-8xl text-amber-500/5 rotate-12 transition-transform hover:scale-110 hover:rotate-6"><i className="fas fa-tachometer-alt"></i></div>
                                </Card>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <Card className="p-8 shadow-xl border border-slate-200/50 dark:border-white/10 relative overflow-hidden bg-white dark:bg-slate-800/80 backdrop-blur-md rounded-3xl">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none text-6xl"><i className="fas fa-key"></i></div>
                                
                                <div className="flex items-center gap-4 mb-8 border-b border-slate-100 dark:border-white/5 pb-6 relative z-10">
                                    <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500 border border-brand-100 dark:border-brand-500/20">
                                        <i className="fas fa-shield-alt text-xl"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-display font-bold text-slate-800 dark:text-white leading-tight">
                                            Segurança & Provedores
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                                            Gerenciamento de chaves e configurações externas
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-8 relative z-10">
                                    <div className="bg-slate-50/50 dark:bg-black/20 p-5 rounded-2xl border border-slate-200/50 dark:border-white/5">
                                        <div className="flex justify-between items-center mb-4">
                                            <div className="flex items-center gap-2">
                                                <i className="fas fa-robot text-brand-500"></i>
                                                <label className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Gemini API Key</label>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${geminiSource === 'env' ? 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-slate-400' : 'bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-900/20 dark:border-orange-500/30 dark:text-orange-400'}`}>
                                                FONTE: {geminiSource === 'env' ? 'ARQUIVO / ENV' : 'PERSONALIZADA / LOCAL'}
                                            </span>
                                        </div>
                                        
                                        {isEditingGemini ? (
                                            <div className="flex items-center gap-3 animate-fade-in-right">
                                                <div className="flex-1 flex items-center gap-4 bg-white dark:bg-black/40 p-4 rounded-xl font-mono text-xs text-slate-500 border-2 border-brand-500 shadow-sm shadow-brand-500/20 relative">
                                                    <i className="fas fa-key text-brand-500 opacity-50"></i>
                                                    <input 
                                                        type="text" 
                                                        value={customGeminiKey}
                                                        onChange={(e) => { setCustomGeminiKey(e.target.value); setGeminiSource('custom'); }}
                                                        placeholder="Sua chave API aqui..." 
                                                        className="bg-transparent border-none outline-none w-full text-slate-700 dark:text-slate-300 font-bold pr-8"
                                                        autoFocus
                                                    />
                                                </div>
                                                <button onClick={() => setIsEditingGemini(false)} className="w-12 h-12 rounded-xl bg-brand-500 text-white shadow-lg shadow-brand-500/30 flex items-center justify-center hover:-translate-y-0.5 transition-transform">
                                                    <i className="fas fa-check"></i>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="group relative" onClick={() => setIsEditingGemini(true)}>
                                                <div className="flex items-center gap-4 bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer hover:border-brand-500/50 transition-colors shadow-sm">
                                                    <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500 border border-brand-100 dark:border-brand-500/20">
                                                        <i className="fas fa-lock text-xs"></i>
                                                    </div>
                                                    <div className="flex-1 font-mono text-xs text-slate-600 dark:text-slate-400 truncate tracking-wider">
                                                        {customGeminiKey && customGeminiKey.length > 10 
                                                            ? `${customGeminiKey.substring(0, 8)}••••••••••••••••${customGeminiKey.substring(customGeminiKey.length - 4)}`
                                                            : '••••••••••••••••••••••••'
                                                        }
                                                    </div>
                                                    {geminiSource === 'custom' && (
                                                        <button onClick={(e) => {e.stopPropagation(); handleResetGemini();}} className="text-slate-400 hover:text-red-500 p-2 transition-colors" title="Restaurar Padrão">
                                                            <i className="fas fa-undo"></i>
                                                        </button>
                                                    )}
                                                </div>
                                                <button className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 flex items-center justify-center opacity-100 transition-all hover:scale-110">
                                                    <i className="fas fa-pen text-xs"></i>
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-[9px] text-slate-400 mt-3 ml-1 flex items-center gap-1.5 font-medium">
                                            <i className="fas fa-info-circle opacity-50"></i> O valor exibido é a chave ativa no momento.
                                        </p>
                                    </div>

                                    <div className="bg-slate-50/50 dark:bg-black/20 p-5 rounded-2xl border border-slate-200/50 dark:border-white/5">
                                        <div className="flex justify-between items-center mb-4">
                                            <div className="flex items-center gap-2">
                                                <i className="fas fa-fire text-orange-500"></i>
                                                <label className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Firebase Cloud Config</label>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${fbSource === 'default' ? 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-slate-400' : 'bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-900/20 dark:border-orange-500/30 dark:text-orange-400'}`}>
                                                FONTE: {fbSource === 'default' ? 'PADRÃO / HARDCODED' : 'PERSONALIZADA / LOCAL'}
                                            </span>
                                        </div>
                                        
                                        {isEditingFirebase ? (
                                            <div className="relative animate-fade-in-up">
                                                <textarea 
                                                    value={customFirebaseConfig}
                                                    onChange={(e) => { setCustomFirebaseConfig(e.target.value); setFbSource('custom'); }}
                                                    placeholder='Cole o objeto JSON do Firebase aqui...'
                                                    className="w-full h-48 bg-white dark:bg-black/40 p-4 rounded-xl font-mono text-xs text-slate-700 dark:text-slate-300 border-2 border-brand-500 outline-none transition-colors resize-none shadow-sm shadow-brand-500/10"
                                                    autoFocus
                                                />
                                                <div className="absolute bottom-4 right-4 flex gap-2">
                                                    <button onClick={() => setIsEditingFirebase(false)} className="px-5 py-2.5 rounded-lg bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-500/30 hover:-translate-y-0.5 transition-all">
                                                        Confirmar Edição
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="relative group cursor-pointer" onClick={() => setIsEditingFirebase(true)}>
                                                <div className="w-full h-48 bg-[#1e1e1e] p-4 rounded-xl border border-slate-800 shadow-inner overflow-hidden relative group-hover:border-brand-500/50 transition-colors">
                                                    <div className="absolute top-0 left-0 w-full h-8 bg-[#252526] border-b border-[#333] flex items-center px-4 gap-2">
                                                        <div className="flex gap-1.5">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                                                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                                                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                                                        </div>
                                                        <span className="ml-3 text-[10px] text-slate-400 font-mono">firebase_config.json</span>
                                                    </div>
                                                    <pre className="mt-6 font-mono text-[11px] text-blue-300/90 overflow-hidden leading-relaxed">
                                                        {customFirebaseConfig.slice(0, 300)}...
                                                    </pre>
                                                    <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e1e] via-transparent to-transparent pointer-events-none"></div>
                                                    <div className="absolute bottom-3 right-4 text-[9px] font-mono text-slate-500 font-bold tracking-widest uppercase">JSON • Read Only</div>
                                                </div>
                                                
                                                <button className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 flex items-center justify-center opacity-100 transition-all hover:scale-110 z-10">
                                                    <i className="fas fa-pen text-xs"></i>
                                                </button>

                                                {fbSource === 'custom' && (
                                                    <button onClick={(e) => {e.stopPropagation(); handleResetFirebase();}} className="absolute bottom-4 right-4 z-20 text-slate-400 hover:text-red-500 bg-white/10 p-2 rounded-lg backdrop-blur-sm transition-colors" title="Restaurar Padrão">
                                                        <i className="fas fa-undo"></i>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <button 
                                        onClick={handleSaveConfigs}
                                        className="w-full py-4 rounded-xl bg-brand-600 text-white font-black uppercase text-[10px] tracking-widest hover:bg-brand-500 hover:-translate-y-0.5 transition-all shadow-lg shadow-brand-500/20 mt-4 flex items-center justify-center gap-2"
                                    >
                                        <i className="fas fa-save"></i> Salvar e Aplicar Configurações
                                    </button>
                                </div>
                            </Card>

                            <Card className="p-8 shadow-xl border border-slate-200/50 dark:border-white/10 relative overflow-hidden bg-white dark:bg-slate-800/80 backdrop-blur-md rounded-3xl">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none text-6xl"><i className="fas fa-network-wired"></i></div>
                                
                                <div className="flex items-center gap-4 mb-8 border-b border-slate-100 dark:border-white/5 pb-6 relative z-10">
                                    <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center text-sky-500 border border-sky-100 dark:border-sky-500/20">
                                        <i className="fas fa-cloud-sun text-xl"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-display font-bold text-slate-800 dark:text-white leading-tight">
                                            Cluster de Persistência
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                                            Informações do banco de dados e storage
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 relative z-10">
                                    <div className="p-5 rounded-2xl bg-slate-50/50 dark:bg-black/20 border border-slate-200/50 dark:border-white/5 hover:border-sky-500/30 transition-colors group">
                                        <div className="flex items-center gap-2 mb-2">
                                            <i className="fas fa-project-diagram text-sky-500 opacity-70"></i>
                                            <p className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">ID do Projeto (Firestore)</p>
                                        </div>
                                        <p className="font-mono text-sm text-slate-800 dark:text-slate-200 font-bold group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">portal-uziel-295cb</p>
                                    </div>
                                    <div className="p-5 rounded-2xl bg-slate-50/50 dark:bg-black/20 border border-slate-200/50 dark:border-white/5 hover:border-sky-500/30 transition-colors group">
                                        <div className="flex items-center gap-2 mb-2">
                                            <i className="fas fa-fingerprint text-sky-500 opacity-70"></i>
                                            <p className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Identidade do WebApp</p>
                                        </div>
                                        <p className="font-mono text-sm text-slate-800 dark:text-slate-200 font-bold truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">1:98540572300:web</p>
                                    </div>
                                    <div className="p-5 rounded-2xl bg-slate-50/50 dark:bg-black/20 border border-slate-200/50 dark:border-white/5 hover:border-sky-500/30 transition-colors group">
                                        <div className="flex items-center gap-2 mb-2">
                                            <i className="fas fa-box-open text-sky-500 opacity-70"></i>
                                            <p className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Bucket Principal</p>
                                        </div>
                                        <p className="font-mono text-sm text-slate-800 dark:text-slate-200 font-bold truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">portal-uziel-295cb.firebasestorage.app</p>
                                    </div>
                                    <div className="p-5 rounded-2xl bg-slate-50/50 dark:bg-black/20 border border-slate-200/50 dark:border-white/5 hover:border-sky-500/30 transition-colors group">
                                        <div className="flex items-center gap-2 mb-2">
                                            <i className="fas fa-globe-americas text-sky-500 opacity-70"></i>
                                            <p className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Região Geográfica</p>
                                        </div>
                                        <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400 font-bold group-hover:text-emerald-500 transition-colors">multi-region (US/SA-E1)</p>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        <Card className="p-8 shadow-xl border border-slate-200/50 dark:border-white/10 relative overflow-hidden bg-white dark:bg-slate-800/80 backdrop-blur-md rounded-3xl">
                            <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none"></div>
                            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none text-8xl"><i className="fas fa-server"></i></div>
                            
                            <div className="flex items-center gap-4 mb-8 border-b border-slate-100 dark:border-white/5 pb-6 relative z-10">
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-100 dark:border-indigo-500/20">
                                    <i className="fas fa-server text-xl"></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-display font-bold text-slate-800 dark:text-white leading-tight">
                                        Ambiente de Produção Edge
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                                        Status da infraestrutura de entrega
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                <div className="bg-slate-50/50 dark:bg-black/20 p-6 rounded-2xl border border-slate-200/50 dark:border-white/5 group hover:border-indigo-500/30 transition-colors">
                                    <div className="flex items-center gap-2 mb-4">
                                        <i className="fas fa-network-wired text-indigo-500"></i>
                                        <label className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">CDN Network</label>
                                    </div>
                                    <div className="w-full p-4 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 flex items-center justify-between shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="relative flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                            </div>
                                            <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-black">Cloudflare Proxy Ativo</span>
                                        </div>
                                        <i className="fas fa-globe text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors text-xl"></i>
                                    </div>
                                </div>
                                <div className="bg-slate-50/50 dark:bg-black/20 p-6 rounded-2xl border border-slate-200/50 dark:border-white/5 group hover:border-indigo-500/30 transition-colors">
                                    <div className="flex items-center gap-2 mb-4">
                                        <i className="fas fa-microchip text-indigo-500"></i>
                                        <label className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Runtime Status</label>
                                    </div>
                                    <div className="w-full p-4 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 flex items-center justify-between shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                <i className="fab fa-react"></i>
                                            </div>
                                            <span className="font-mono text-xs text-blue-600 dark:text-blue-400 uppercase tracking-widest font-black">Node 20.x • React 19</span>
                                        </div>
                                        <i className="fas fa-bolt text-slate-300 dark:text-slate-600 group-hover:text-yellow-500 transition-colors text-xl"></i>
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