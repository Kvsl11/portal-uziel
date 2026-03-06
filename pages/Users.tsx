
import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';
import { MemberService } from '../services/firebase';
import Card from '../components/Card';
import EditProfileModal from '../components/EditProfileModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

const Users: React.FC = () => {
  const { usersList, removeUser, currentUser } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'member' | 'admin' | 'super-admin'>('all');
  
  // State for Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Delete Confirmation Modal State
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
      isOpen: boolean;
      title: string;
      description: string;
      onConfirm: () => Promise<void>;
  }>({ isOpen: false, title: '', description: '', onConfirm: async () => {} });

  const isSuperAdmin = currentUser?.role === 'super-admin';
  const isAdmin = currentUser?.role === 'admin';
  const isMember = currentUser?.role === 'member';

  const canManageUser = (targetUser: User) => {
      if (currentUser?.username === targetUser.username) return true;
      if (isSuperAdmin) return true;
      if (isAdmin) return targetUser.role === 'member';
      return false;
  };

  const filteredUsers = useMemo(() => {
    let visibleUsers = usersList;
    if (isMember) {
        visibleUsers = usersList.filter(u => u.username === currentUser?.username);
    } else if (isAdmin) {
        visibleUsers = usersList.filter(u => u.role === 'member' || u.role === 'admin' || u.username === currentUser?.username);
    }

    return visibleUsers.sort((a, b) => a.name.localeCompare(b.name)).filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || user.username.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [usersList, searchTerm, roleFilter, currentUser, isMember, isAdmin]);

  const handleCreate = () => {
      setSelectedUser(null);
      setIsCreating(true);
      setIsModalOpen(true);
  };

  const handleEdit = (user: User) => {
      if (!canManageUser(user)) {
          alert("Você não tem permissão para editar este usuário.");
          return;
      }
      setSelectedUser(user);
      setIsCreating(false);
      setIsModalOpen(true);
  };

  const handleCloseModal = () => {
      setIsModalOpen(false);
      setSelectedUser(null);
      setIsCreating(false);
  };

  const requestDelete = (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    
    if (!canManageUser(user)) {
        alert("Permissão negada para excluir este usuário.");
        return;
    }

    if (user.role === 'super-admin') {
        alert("Usuários Dev/Super-Admin não podem ser excluídos por segurança.");
        return;
    }

    setDeleteModal({
        isOpen: true,
        title: `Excluir ${user.name}?`,
        description: "Esta ação removerá permanentemente o acesso do usuário ao portal e seus dados de membro. Não é possível desfazer.",
        onConfirm: async () => {
            setIsProcessing(true);
            try { 
                await removeUser(user.username); 
                try {
                    await MemberService.delete(user.username); 
                } catch (memberErr: any) {
                    console.warn("Member data cleanup warning:", memberErr);
                }
            } catch (err: any) { 
                console.error(`[Users] Error deleting user ${user.username}:`, err);
                let msg = "Erro desconhecido ao excluir.";
                if (err.code === 'permission-denied') msg = "Permissão negada pelo banco de dados.";
                alert(msg);
            } finally {
                setIsProcessing(false);
                setDeleteModal(prev => ({...prev, isOpen: false}));
            }
        }
    });
  };

  const formatRoleDisplay = (role: string) => {
      if (role === 'super-admin') return 'Dev';
      if (role === 'admin') return 'Admin';
      if (role === 'member') return 'Membro';
      return role;
  };

  const RoleBadge = ({ role }: { role: User['role'] }) => {
    const styles: any = {
      'super-admin': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      'admin': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      'member': 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    };
    return <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${styles[role]}`}>{formatRoleDisplay(role)}</span>;
  };

  // Define visible filters based on user role
  const filterOptions = isSuperAdmin 
    ? ['all', 'member', 'admin', 'super-admin'] 
    : ['all', 'member', 'admin'];

  return (
    <div className="space-y-8 pb-32 animate-fade-in-up">
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
             <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white leading-[0.9] tracking-tight">
                Gestão da Equipe
             </h1>
             <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                Adicione, edite ou remova membros do ministério.
             </p>
          </div>
          {(isAdmin || isSuperAdmin) && (
              <button type="button" onClick={handleCreate} className="bg-brand-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-500 transition-all flex items-center gap-2 uppercase text-xs tracking-widest hover:scale-105">
                <i className="fas fa-user-plus"></i> Novo Membro
              </button>
          )}
        </div>

        {/* --- TOOLBAR --- */}
        <Card noPadding className="p-3 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
            <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input type="text" placeholder="Buscar por nome ou usuário..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-transparent outline-none text-slate-700 dark:text-slate-200 font-bold placeholder-slate-400" />
            </div>
            <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-900/50 rounded-xl overflow-x-auto w-full md:w-auto hide-scrollbar">
            {filterOptions.map((role) => (
                <button 
                    type="button" 
                    key={role} 
                    onClick={() => setRoleFilter(role as any)} 
                    className={`px-5 py-2 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${roleFilter === role ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                {role === 'all' ? 'Todos' : formatRoleDisplay(role)}
                </button>
            ))}
            </div>
        </Card>

        {/* --- USERS GRID VIEW (UNIFIED) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredUsers.map(user => {
                const isSelf = user.username === currentUser?.username;
                const isAllowed = canManageUser(user);
                
                return (
                    <div key={user.username} className="group relative bg-white dark:bg-slate-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 dark:border-white/5 overflow-hidden">
                        {/* Background Decoration */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-bl-[4rem] -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                        
                        <div className="relative z-10 flex flex-col items-center text-center">
                            {/* Avatar */}
                            <div className="relative mb-4">
                                <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-3xl text-brand-600 dark:text-brand-400 overflow-hidden shadow-inner ring-4 ring-white dark:ring-slate-800 group-hover:ring-brand-50 dark:group-hover:ring-brand-900/30 transition-all">
                                    {user.photoURL ? <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" /> : user.name.charAt(0)}
                                </div>
                                {isSelf && (
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm border-2 border-white dark:border-slate-800">
                                        Você
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white mb-1 truncate w-full px-2">
                                {user.name}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-3 truncate w-full px-4 opacity-80">
                                {user.username}
                            </p>
                            
                            <div className="mb-6">
                                <RoleBadge role={user.role} />
                            </div>

                            {/* Actions & Contact */}
                            <div className="w-full grid grid-cols-2 gap-3 mt-auto">
                                {user.whatsapp ? (
                                    <a 
                                        href={`https://wa.me/${user.whatsapp.replace(/\D/g, '')}`} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="col-span-2 flex items-center justify-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 py-2.5 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors group/btn"
                                    >
                                        <i className="fab fa-whatsapp text-lg group-hover/btn:scale-110 transition-transform"></i>
                                        <span className="text-xs font-bold uppercase tracking-wider">WhatsApp</span>
                                    </a>
                                ) : (
                                    <div className="col-span-2 py-2.5 text-center text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5">
                                        Sem contato
                                    </div>
                                )}

                                {isAllowed ? (
                                    <>
                                        <button 
                                            onClick={() => handleEdit(user)}
                                            className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 py-2.5 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 dark:hover:text-brand-400 transition-colors font-bold text-xs uppercase tracking-wider"
                                        >
                                            <i className="fas fa-pen"></i> Editar
                                        </button>
                                        {!isSelf && (
                                            <button 
                                                onClick={(e) => requestDelete(e, user)}
                                                className="flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/10 text-red-500 dark:text-red-400 py-2.5 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-bold text-xs uppercase tracking-wider"
                                            >
                                                <i className="fas fa-trash"></i> Excluir
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="col-span-2 flex items-center justify-center gap-2 py-2.5 text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-white/5 cursor-not-allowed">
                                        <i className="fas fa-lock"></i>
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Restrito</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>

        {/* --- UNIFIED MODAL --- */}
        <EditProfileModal 
            isOpen={isModalOpen} 
            onClose={handleCloseModal} 
            userToEdit={selectedUser} 
            isCreating={isCreating} 
        />

        {/* --- DELETE CONFIRMATION MODAL --- */}
        <DeleteConfirmationModal 
            isOpen={deleteModal.isOpen}
            onClose={() => setDeleteModal(prev => ({...prev, isOpen: false}))}
            onConfirm={deleteModal.onConfirm}
            title={deleteModal.title}
            description={deleteModal.description}
            isProcessing={isProcessing}
        />
    </div>
  );
};

export default Users;
