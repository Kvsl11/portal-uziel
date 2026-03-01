
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit?: User | null; // Se passado, edita este usuário. Se null e !isCreating, edita currentUser.
  isCreating?: boolean; // Se true, modo de criação
}

// --- Image Compression Helper ---
const resizeImage = (base64Str: string, maxWidth = 300, maxHeight = 300): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85)); // Compresses to JPEG 85%
    };
  });
};

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, userToEdit, isCreating = false }) => {
  const { currentUser, updateUser, addUser, usersList } = useAuth();
  
  // 1. Resolve Target User (Source of Truth)
  // We look up the latest version of the user in usersList to ensure we aren't editing stale data.
  const targetUser = useMemo(() => {
      if (isCreating) return { role: 'member', name: '', username: '', password: '', whatsapp: '' } as User;
      
      const usernameToFind = userToEdit?.username || currentUser?.username;
      if (usernameToFind) {
          const fresh = usersList.find(u => u.username.toLowerCase() === usernameToFind.toLowerCase());
          return fresh || userToEdit || currentUser || {} as User;
      }
      return {} as User;
  }, [isCreating, userToEdit?.username, currentUser?.username, usersList]); // Depend on IDs/Lists to refresh if DB updates

  const [formData, setFormData] = useState<Partial<User>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Permissões
  const isLoggedInUserSuperAdmin = currentUser?.role === 'super-admin';
  const isLoggedInUserAdmin = currentUser?.role === 'admin';
  
  // Pode editar role se: for SuperAdmin OU (for Admin e não estiver editando a si mesmo nem outro Admin)
  const canEditRole = isCreating 
    ? (isLoggedInUserSuperAdmin || isLoggedInUserAdmin) 
    : (isLoggedInUserSuperAdmin || (isLoggedInUserAdmin && targetUser.role === 'member'));

  // 2. Initialize Form Data ONLY when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: targetUser.name,
        // Show prefix only for display, but we will use targetUser.username for the ID when saving if editing
        username: targetUser.username ? targetUser.username.split('@')[0] : '',
        password: targetUser.password || '', 
        whatsapp: targetUser.whatsapp || '',
        role: targetUser.role || 'member',
        photoURL: targetUser.photoURL
      });
      setError('');
      setShowPassword(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Critical: Only run on open, do NOT include targetUser/currentUser to avoid resetting form while typing if background sync happens

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Resize all images to ensure they fit in Firestore document limit (1MB)
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
            const rawBase64 = reader.result as string;
            // Compress image to max 300x300
            const compressedBase64 = await resizeImage(rawBase64, 300, 300);
            setFormData(prev => ({ ...prev, photoURL: compressedBase64 }));
        } catch (err) {
            console.error("Image processing error", err);
            setError("Erro ao processar imagem.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Phone Mask Handler ---
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é dígito
    if (value.length > 11) value = value.slice(0, 11); // Limita a 11 dígitos (DDD + 9 dígitos)

    let formatted = value;
    if (value.length > 2) {
      formatted = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 7) {
      formatted = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    }

    setFormData({ ...formData, whatsapp: formatted });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || formData.name.trim().length < 3) {
        setError('Nome muito curto.');
        return;
    }
    
    if (isCreating && (!formData.username || formData.username.trim().length < 3)) {
        setError('Usuário muito curto.');
        return;
    }

    // Validação de senha
    if (isCreating && (!formData.password || formData.password.length < 6)) {
        setError('Para novos usuários, a senha deve ter no mínimo 6 caracteres.');
        return;
    }
    if (!isCreating && formData.password && formData.password.length > 0 && formData.password.length < 6) {
        setError('A senha deve ter no mínimo 6 caracteres.');
        return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      let finalUsername = '';

      if (isCreating) {
          // Creating new user: construct the ID
          const rawUsername = formData.username!.trim();
          finalUsername = rawUsername.includes('@') ? rawUsername.toLowerCase() : `${rawUsername}@uziel.com`.toLowerCase();
          
          // Check duplicate
          if (usersList.some(u => u.username.toLowerCase() === finalUsername)) {
              throw new Error("Este nome de usuário já existe.");
          }
      } else {
          // Editing existing: MUST use the original ID to ensure update happens on same doc
          if (!targetUser.username) throw new Error("ID do usuário inválido.");
          finalUsername = targetUser.username.toLowerCase();
      }
      
      const userPayload: User = {
        username: finalUsername, 
        name: formData.name!.toUpperCase(),
        role: formData.role as any, 
        whatsapp: formData.whatsapp || '',
        password: formData.password
      };

      // Se photoURL for uma string (incluindo string vazia para remoção), adicionamos ao payload
      if (formData.photoURL !== undefined) {
          userPayload.photoURL = formData.photoURL;
      }

      if (isCreating) {
          await addUser(userPayload);
      } else {
          await updateUser(userPayload);
      }

      onClose();
    } catch (err: any) {
      console.error(err);
      setError('Erro ao salvar: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-0 md:p-4 animate-fade-in">
      {/* 
         LAYOUT FIX MOBILE (FULL SCREEN MODE):
         - overflow-x-hidden added to prevent horizontal scroll
         - p-0 no container pai no mobile.
         - h-full no container interno no mobile.
         - rounded-none no mobile.
         - overflow-y-auto no container interno no mobile.
      */}
      <div className="w-full max-w-4xl bg-white dark:bg-[#0f172a] md:rounded-[2.5rem] shadow-2xl border-none md:border md:border-white/20 dark:md:border-white/5 flex flex-col md:flex-row h-full md:h-auto md:max-h-[90vh] overflow-y-auto overflow-x-hidden md:overflow-hidden animate-scale-in">
        
        {/* LEFT COLUMN: IDENTITY & VISUALS */}
        <div className="w-full md:w-2/5 bg-slate-50 dark:bg-[#0b1221] p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 dark:border-white/5 relative shrink-0">
             
             {/* Close button for Mobile only (Easier access) */}
             <button type="button" onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 md:hidden flex items-center justify-center text-slate-500 z-20">
                <i className="fas fa-times"></i>
             </button>

             <div className="relative z-10 flex flex-col items-center w-full">
                 {/* Avatar Container */}
                 <div className="group relative w-40 h-40 rounded-full mb-6 shadow-2xl border-4 border-white dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden transform-gpu">
                     {formData.photoURL ? (
                         <img src={formData.photoURL} alt="Avatar" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                     ) : (
                         <div className="w-full h-full bg-gradient-to-tr from-brand-500 to-brand-600 flex items-center justify-center text-white text-5xl font-bold">
                             {formData.name?.charAt(0) || '?'}
                         </div>
                     )}
                     
                     <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-sm rounded-full">
                         <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors" title="Upload Foto">
                             <i className="fas fa-camera"></i>
                         </button>
                         {/* FIX: Set to empty string instead of undefined to signal removal to AuthContext */}
                         <button type="button" onClick={() => setFormData(prev => ({...prev, photoURL: ''}))} className="p-2 rounded-full bg-red-500/50 hover:bg-red-500 text-white transition-colors" title="Remover Foto">
                             <i className="fas fa-trash"></i>
                         </button>
                     </div>
                     <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                 </div>

                 <h3 className="text-xl font-bold text-slate-800 dark:text-white text-center mb-1 line-clamp-1 w-full">{formData.name || 'Novo Usuário'}</h3>
                 
                 {/* Visual Role Badge */}
                 <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border mb-6 ${
                     formData.role === 'super-admin' ? 'bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' :
                     formData.role === 'admin' ? 'bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' :
                     'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                 }`}>
                     {formData.role === 'super-admin' ? 'Dev' : formData.role}
                 </span>
             </div>
        </div>

        {/* RIGHT COLUMN: FORM DATA */}
        {/* LAYOUT FIX: Mobile uses main container scroll, Desktop uses this div scroll */}
        <div className="w-full md:w-3/5 p-6 md:p-8 flex flex-col relative md:overflow-y-auto">
             {/* Desktop Close Button */}
             <button type="button" onClick={onClose} className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 hidden md:flex items-center justify-center transition-colors text-slate-500 dark:text-slate-400 z-10">
                <i className="fas fa-times"></i>
             </button>

             <div className="mb-8">
                 <h2 className="text-2xl font-bold text-slate-800 dark:text-white font-display mb-1">
                     {isCreating ? 'Novo Membro' : 'Editar Dados'}
                 </h2>
                 <p className="text-sm text-slate-400">
                     {isCreating ? 'Preencha os dados para criar o acesso.' : 'Atualize as informações do perfil.'}
                 </p>
             </div>

             <form onSubmit={handleSubmit} className="space-y-5 flex-1">
                 {/* Role Selection (Only if allowed) */}
                 {canEditRole && (
                     <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Nível de Acesso</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'member', label: 'Membro', icon: 'fa-user' },
                                { id: 'admin', label: 'Admin', icon: 'fa-shield-alt' },
                                { id: 'super-admin', label: 'Dev', icon: 'fa-code' }
                            ].map(opt => (
                                <button 
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, role: opt.id as any })}
                                    disabled={!isLoggedInUserSuperAdmin && opt.id === 'super-admin'} // Only SuperAdmin can create SuperAdmins
                                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                                        formData.role === opt.id 
                                        ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-500 text-brand-600 dark:text-brand-400' 
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    } ${(!isLoggedInUserSuperAdmin && opt.id === 'super-admin') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <i className={`fas ${opt.icon} text-sm`}></i>
                                    <span className="text-[9px] font-bold uppercase">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                     </div>
                 )}

                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Nome Completo</label>
                    <div className="relative group">
                        <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors"></i>
                        <input 
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:border-brand-500 focus:bg-white dark:focus:bg-black/40 outline-none transition-all font-medium text-slate-700 dark:text-slate-200 text-sm"
                            value={formData.name || ''} 
                            onChange={e => setFormData({...formData, name: e.target.value})} 
                            placeholder="Seu nome" 
                        />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Usuário (ID)</label>
                        <div className="relative group">
                            <i className="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors"></i>
                            <input 
                                className={`w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 outline-none transition-all font-medium text-slate-700 dark:text-slate-200 text-sm ${!isCreating ? 'opacity-60 cursor-not-allowed' : 'focus:border-brand-500 focus:bg-white dark:focus:bg-black/40'}`}
                                value={formData.username || ''} 
                                onChange={e => setFormData({...formData, username: e.target.value})} 
                                placeholder="usuario" 
                                disabled={!isCreating} // Username ID cannot be changed after creation to maintain DB integrity
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">
                            {isCreating ? 'Senha Inicial' : 'Nova Senha'}
                        </label>
                        <div className="relative group">
                            <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors"></i>
                            <input 
                                className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:border-brand-500 focus:bg-white dark:focus:bg-black/40 outline-none transition-all font-medium text-slate-700 dark:text-slate-200 text-sm"
                                type={showPassword ? "text" : "password"} 
                                value={formData.password || ''} 
                                onChange={e => setFormData({...formData, password: e.target.value})} 
                                placeholder={isCreating ? "Mínimo 6 chars" : "Preencher para alterar"} 
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-500 transition-colors w-6 h-6 flex items-center justify-center">
                                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                    </div>
                 </div>

                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">WhatsApp</label>
                    <div className="relative group">
                        <i className="fab fa-whatsapp absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-green-500 transition-colors"></i>
                        <input 
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:border-green-500 focus:bg-white dark:focus:bg-black/40 outline-none transition-all font-medium text-slate-700 dark:text-slate-200 text-sm"
                            value={formData.whatsapp || ''} 
                            onChange={handlePhoneChange} 
                            placeholder="(00) 00000-0000" 
                        />
                    </div>
                 </div>

                 {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in-up">
                        <i className="fas fa-exclamation-circle"></i> {error}
                    </div>
                 )}

                 <div className="pt-4 mt-auto flex gap-3">
                    <button type="button" onClick={onClose} className="flex-1 py-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all uppercase text-xs tracking-wider">
                        Cancelar
                    </button>
                    <button type="submit" disabled={isSubmitting} className="flex-[2] py-4 rounded-xl bg-brand-600 text-white font-bold shadow-lg shadow-brand-500/30 hover:bg-brand-500 hover:scale-[1.02] active:scale-95 transition-all uppercase text-xs tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-check"></i>}
                        {isCreating ? 'Criar Usuário' : 'Salvar Alterações'}
                    </button>
                 </div>
             </form>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default EditProfileModal;
