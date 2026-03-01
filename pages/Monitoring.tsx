
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AuditLog, User } from '../types';
import { AuditService } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import Card from '../components/Card';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

// --- HELPER: Parse User Agent ---
const parseClientInfo = (userAgent?: string) => {
    if (!userAgent) return { os: 'Desconhecido', browser: 'Desconhecido' };
    
    let os = 'Outro';
    // A ordem importa: Android contém "Linux" no UA, então checamos Android primeiro.
    if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('iPod')) os = 'iOS';
    else if (userAgent.includes('Win')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'MacOS';
    else if (userAgent.includes('CrOS')) os = 'Chrome OS';
    else if (userAgent.includes('Linux')) os = 'Linux';

    let browser = 'Outro';
    if (userAgent.includes('Edg')) browser = 'Edge';
    else if (userAgent.includes('OPR') || userAgent.includes('Opera')) browser = 'Opera';
    else if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';

    return { os, browser };
};

// --- COMPONENT: LOG DETAIL MODAL ---
const LogDetailModal = ({ log, onClose, userProfile }: { log: AuditLog, onClose: () => void, userProfile?: User }) => {
    const client = parseClientInfo(log.userAgent);
    const displayRole = log.role === 'super-admin' ? 'Dev' : log.role;
    
    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
                <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-black/20">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <i className="fas fa-shield-alt text-brand-500"></i> Auditoria de Segurança
                        </h3>
                        <p className="text-xs text-slate-400 font-mono mt-1">ID: {log.id}</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white dark:bg-white/5 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors shadow-sm">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* User Info */}
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                        <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-2xl font-bold text-slate-600 dark:text-slate-300 shadow-sm overflow-hidden">
                            {userProfile?.photoURL ? (
                                <img src={userProfile.photoURL} alt={log.userName || log.user} className="w-full h-full object-cover" />
                            ) : (
                                (log.userName ? log.userName.charAt(0) : log.user.charAt(0))
                            )}
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-slate-800 dark:text-white">{log.userName || 'Usuário Desconhecido'}</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{log.user}</p>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                                {displayRole || 'Role N/A'}
                            </span>
                        </div>
                    </div>

                    {/* Action Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Módulo / Ação</p>
                            <p className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                <span className="px-2 py-1 rounded bg-brand-100 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-xs">{log.module}</span>
                                <i className="fas fa-arrow-right text-slate-300 text-xs"></i>
                                <span className="px-2 py-1 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs">{log.action}</span>
                            </p>
                        </div>
                        <div className="p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Data e Hora</p>
                            <p className="font-bold text-slate-700 dark:text-slate-200">
                                {new Date(log.timestamp).toLocaleDateString('pt-BR')} às {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                            </p>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1">Descrição do Evento</p>
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-100 dark:border-white/5 font-mono text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {log.details}
                        </div>
                    </div>

                    {/* Technical Data */}
                    <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1">Metadados Técnicos</p>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                                <span className="block text-slate-400 mb-1">Sistema Operacional</span>
                                <span className="font-bold text-slate-700 dark:text-white flex items-center gap-2">
                                    <i className={`fab fa-${client.os === 'Windows' ? 'windows' : client.os === 'Android' ? 'android' : client.os === 'iOS' || client.os === 'MacOS' ? 'apple' : 'linux'}`}></i>
                                    {client.os}
                                </span>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                                <span className="block text-slate-400 mb-1">Navegador</span>
                                <span className="font-bold text-slate-700 dark:text-white flex items-center gap-2">
                                    <i className={`fab fa-${client.browser === 'Chrome' ? 'chrome' : client.browser === 'Firefox' ? 'firefox' : client.browser === 'Safari' ? 'safari' : client.browser === 'Edge' ? 'edge' : 'internet-explorer'}`}></i>
                                    {client.browser}
                                </span>
                            </div>
                            <div className="col-span-2 p-3 rounded-xl bg-slate-50 dark:bg-white/5 break-all">
                                <span className="block text-slate-400 mb-1">User Agent String</span>
                                <span className="font-mono text-slate-600 dark:text-slate-400">{log.userAgent || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const Monitoring: React.FC = () => {
  const { usersList } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & Search
  const [filterUser, setFilterUser] = useState('ALL');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterModule, setFilterModule] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Modals
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
      isOpen: boolean;
      type: 'single' | 'all';
      id?: string;
      title: string;
      description: string;
  }>({ isOpen: false, type: 'single', title: '', description: '' });

  useEffect(() => {
    const unsub = AuditService.subscribe((data) => {
        setLogs(data as AuditLog[]);
        setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
      setCurrentPage(1);
  }, [filterUser, filterAction, filterModule, searchTerm]);

  const uniqueUsers = useMemo<[string, string][]>(() => {
      const users = new Map<string, string>();
      logs.forEach(log => {
          if (!users.has(log.user)) {
              users.set(log.user, log.userName || log.user);
          }
      });
      return Array.from(users.entries());
  }, [logs]);

  const filteredLogs = useMemo<AuditLog[]>(() => {
      return logs.filter(log => {
          const matchUser = filterUser === 'ALL' || log.user === filterUser;
          const matchAction = filterAction === 'ALL' || log.action === filterAction;
          const matchModule = filterModule === 'ALL' || log.module === filterModule;
          
          const searchLower = searchTerm.toLowerCase();
          const matchSearch = searchTerm === '' || 
              log.details.toLowerCase().includes(searchLower) ||
              log.user.toLowerCase().includes(searchLower) ||
              (log.userName && log.userName.toLowerCase().includes(searchLower));

          return matchUser && matchAction && matchModule && matchSearch;
      });
  }, [logs, filterUser, filterAction, filterModule, searchTerm]);

  const paginatedLogs = useMemo<AuditLog[]>(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  // KPIs
  const kpis = useMemo(() => {
      const today = new Date().toDateString();
      const actionsToday = logs.filter(l => new Date(l.timestamp).toDateString() === today);
      const uniqueUsersCount = new Set(actionsToday.map(l => l.user)).size;
      const errors = actionsToday.filter(l => l.action === 'ERROR').length;
      
      const healthScore = Math.max(0, 100 - (errors * 5)); // Simple heuristic
      
      return {
          totalToday: actionsToday.length,
          uniqueUsers: uniqueUsersCount,
          errors,
          healthScore
      };
  }, [logs]);

  const handleDeleteLog = (log: AuditLog, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteModal({
          isOpen: true,
          type: 'single',
          id: log.id,
          title: 'Apagar Registro?',
          description: 'Isso removerá esta linha do histórico de auditoria permanentemente.'
      });
  };

  const handleClearHistory = () => {
      setDeleteModal({
          isOpen: true,
          type: 'all',
          title: 'LIMPEZA TOTAL',
          description: 'ATENÇÃO: Você está prestes a apagar TODO o histórico de auditoria. Esta ação é irreversível e removerá todos os logs de rastreamento.'
      });
  };

  const confirmDelete = async () => {
      setIsProcessing(true);
      try {
          if (deleteModal.type === 'single' && deleteModal.id) {
              await AuditService.deleteLog(deleteModal.id);
          } else if (deleteModal.type === 'all') {
              await AuditService.clearAllLogs();
          }
      } catch (error) {
          alert("Erro ao processar exclusão.");
      } finally {
          setIsProcessing(false);
          setDeleteModal(prev => ({ ...prev, isOpen: false }));
      }
  };

  const handleExportCSV = () => {
      const headers = ["Timestamp", "User", "Role", "Module", "Action", "Details", "UserAgent"];
      const csvContent = [
          headers.join(","),
          ...filteredLogs.map(log => [
              `"${new Date(log.timestamp).toISOString()}"`,
              `"${log.userName || log.user}"`,
              `"${log.role}"`,
              `"${log.module}"`,
              `"${log.action}"`,
              `"${log.details.replace(/"/g, '""')}"`,
              `"${log.userAgent || ''}"`
          ].join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `audit_logs_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const getActionStyle = (action: string) => {
      switch(action) {
          case 'CREATE': return { bg: 'bg-violet-100 dark:bg-violet-500/20', text: 'text-violet-700 dark:text-violet-400', icon: 'fa-plus-circle', border: 'border-violet-200 dark:border-violet-500/30' };
          case 'DELETE': return { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400', icon: 'fa-trash-alt', border: 'border-red-200 dark:border-red-500/30' };
          case 'UPDATE': return { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', icon: 'fa-pen', border: 'border-amber-200 dark:border-amber-500/30' };
          case 'LOGIN': return { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', icon: 'fa-sign-in-alt', border: 'border-blue-200 dark:border-blue-500/30' };
          case 'LOGOUT': return { bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400', icon: 'fa-sign-out-alt', border: 'border-slate-300 dark:border-slate-600' };
          case 'ERROR': return { bg: 'bg-rose-500 text-white', text: 'text-white', icon: 'fa-bug', border: 'border-rose-600' };
          default: return { bg: 'bg-slate-100 dark:bg-white/5', text: 'text-slate-500 dark:text-slate-400', icon: 'fa-info-circle', border: 'border-slate-200 dark:border-white/10' };
      }
  };

  if (loading) return <Loading fullScreen message="Carregando Logs de Segurança..." />;

  return (
    <div className="space-y-8 animate-fade-in-up pb-32">
        {/* --- HEADER SECTION --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
            <div>
               <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-[2px] bg-red-500"></span>
                    <p className="text-red-500 font-bold uppercase tracking-[0.2em] text-[10px]">Área Restrita - Nível 5</p>
               </div>
               <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white leading-[0.9] tracking-tight">
                  Centro de <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-purple-600">Comando</span>
               </h1>
               <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium max-w-md">
                  Monitoramento em tempo real de acessos, segurança e integridade do sistema.
               </p>
            </div>
            
            <div className="flex gap-3">
                <button onClick={handleClearHistory} className="bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 px-5 py-3 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2 text-xs uppercase tracking-widest border border-red-200 dark:border-red-900/50">
                    <i className="fas fa-trash"></i> <span className="hidden sm:inline">Limpar Tudo</span>
                </button>
                <button onClick={handleExportCSV} className="bg-slate-900 dark:bg-white hover:bg-slate-800 text-white dark:text-slate-900 px-5 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 text-xs uppercase tracking-widest">
                    <i className="fas fa-download"></i> <span className="hidden sm:inline">Exportar CSV</span>
                </button>
            </div>
        </div>

        {/* --- KPI DASHBOARD --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <Card noPadding className="p-6 flex items-center gap-4 border-l-4 border-l-blue-500">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center text-2xl">
                    <i className="fas fa-bolt"></i>
                </div>
                <div>
                    <p className="text-3xl font-display font-bold text-slate-800 dark:text-white">{kpis.totalToday}</p>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Eventos (Hoje)</p>
                </div>
            </Card>
            
            <Card noPadding className="p-6 flex items-center gap-4 border-l-4 border-l-green-500">
                <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-500 flex items-center justify-center text-2xl">
                    <i className="fas fa-users"></i>
                </div>
                <div>
                    <p className="text-3xl font-display font-bold text-slate-800 dark:text-white">{kpis.uniqueUsers}</p>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Usuários Ativos</p>
                </div>
            </Card>

            <Card noPadding className="p-6 flex items-center gap-4 border-l-4 border-l-purple-500">
                <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-500 flex items-center justify-center text-2xl">
                    <i className="fas fa-heartbeat"></i>
                </div>
                <div>
                    <p className="text-3xl font-display font-bold text-slate-800 dark:text-white">{kpis.healthScore}%</p>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Saúde do Sistema</p>
                </div>
            </Card>

            <Card noPadding className="p-6 flex items-center gap-4 border-l-4 border-l-red-500">
                <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center text-2xl">
                    <i className="fas fa-bug"></i>
                </div>
                <div>
                    <p className="text-3xl font-display font-bold text-slate-800 dark:text-white">{kpis.errors}</p>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Erros Detectados</p>
                </div>
            </Card>
        </div>

        {/* --- FILTERS TOOLBAR --- */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5 flex flex-col xl:flex-row gap-4">
            <div className="relative flex-1 group">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors"></i>
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Pesquisar logs..." 
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-black/20 border-none rounded-xl text-sm font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                />
            </div>
            
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="bg-slate-50 dark:bg-black/20 px-4 py-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer border-r-[10px] border-r-transparent">
                    <option value="ALL">Todas Ações</option>
                    <option value="LOGIN">Login</option>
                    <option value="LOGOUT">Logout</option>
                    <option value="VIEW">Visualização</option>
                    <option value="CREATE">Criação</option>
                    <option value="UPDATE">Edição</option>
                    <option value="DELETE">Exclusão</option>
                    <option value="ERROR">Erro</option>
                </select>

                <select value={filterModule} onChange={(e) => setFilterModule(e.target.value)} className="bg-slate-50 dark:bg-black/20 px-4 py-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer border-r-[10px] border-r-transparent">
                    <option value="ALL">Todos Módulos</option>
                    <option value="Auth">Autenticação</option>
                    <option value="Repertory">Repertório</option>
                    <option value="Users">Usuários</option>
                    <option value="Playlist">Playlist</option>
                    <option value="Rehearsals">Ensaios</option>
                    <option value="Attendance">Presença</option>
                    <option value="Navigation">Navegação</option>
                </select>

                <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="bg-slate-50 dark:bg-black/20 px-4 py-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer border-r-[10px] border-r-transparent max-w-[150px]">
                    <option value="ALL">Todos Usuários</option>
                    {uniqueUsers.map(([email, name]) => (
                        <option key={email} value={email}>{name}</option>
                    ))}
                </select>
            </div>
        </div>

        {/* --- LOGS LIST --- */}
        <div className="space-y-4">
            {paginatedLogs.map(log => {
                const style = getActionStyle(log.action);
                const logUser = usersList.find(u => u.username === log.user);

                return (
                    <div 
                        key={log.id} 
                        onClick={() => setSelectedLog(log)}
                        className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center justify-between gap-4"
                    >
                        <div className="flex items-center gap-4 overflow-hidden">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${style.bg} ${style.text}`}>
                                <i className={`fas ${style.icon}`}></i>
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-bold text-slate-800 dark:text-white truncate">{log.userName || log.user}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wide">{log.module}</span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{log.details}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4 shrink-0">
                            {/* User Avatar */}
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold overflow-hidden shadow-sm hidden sm:flex">
                                {logUser?.photoURL ? (
                                    <img src={logUser.photoURL} alt={logUser.name} className="w-full h-full object-cover" />
                                ) : (
                                    (log.userName ? log.userName.charAt(0) : log.user.charAt(0))
                                )}
                            </div>

                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{new Date(log.timestamp).toLocaleDateString('pt-BR')}</p>
                                <p className="text-[10px] text-slate-400 font-mono">{new Date(log.timestamp).toLocaleTimeString('pt-BR')}</p>
                            </div>
                            <button 
                                onClick={(e) => handleDeleteLog(log, e)}
                                className="w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-500 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                            >
                                <i className="fas fa-trash text-xs"></i>
                            </button>
                            <i className="fas fa-chevron-right text-slate-300 text-xs"></i>
                        </div>
                    </div>
                );
            })}
            
            {filteredLogs.length === 0 && (
                <div className="text-center py-20 opacity-50">
                    <i className="fas fa-search text-4xl text-slate-300 mb-4"></i>
                    <p className="font-bold text-slate-500">Nenhum registro encontrado.</p>
                </div>
            )}
        </div>

        {/* --- PAGINATION --- */}
        {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                    <i className="fas fa-chevron-left text-slate-500"></i>
                </button>
                <span className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center">
                    {currentPage} / {totalPages}
                </span>
                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                    <i className="fas fa-chevron-right text-slate-500"></i>
                </button>
            </div>
        )}

        {/* --- MODALS --- */}
        {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} userProfile={usersList.find(u => u.username === selectedLog.user)} />}
        
        <DeleteConfirmationModal 
            isOpen={deleteModal.isOpen}
            onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
            onConfirm={confirmDelete}
            title={deleteModal.title}
            description={deleteModal.description}
            isProcessing={isProcessing}
        />
    </div>
  );
};

export default Monitoring;
