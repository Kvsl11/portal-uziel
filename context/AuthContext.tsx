
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { MemberService, UserService, AuthService, AuditService, auth } from '../services/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

interface AuthContextType {
  currentUser: User | null;
  usersList: User[];
  login: (username: string, pass: string) => Promise<boolean>;
  logout: () => void;
  addUser: (user: User) => Promise<void>;
  removeUser: (username: string) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

// Lista de usuários padrão para semear o banco SE necessário
const DEFAULT_USERS: User[] = [
    { username: 'kaio@uziel.com', password: 'Uziel@2025', name: 'KAIO VINICIUS', role: 'super-admin', whatsapp: '' },
    { username: 'junior@uziel.com', password: 'Uziel@2025', name: 'JUNIOR CAVALCANTE', role: 'admin', whatsapp: '' },
    { username: 'willian@uziel.com', password: 'Uziel@2025', name: 'WILLIAN FALAVINA', role: 'admin', whatsapp: '' },
    { username: 'ana@uziel.com', password: 'Uziel@2025', name: 'ANA BONIN', role: 'member', whatsapp: '' },
    { username: 'enio@uziel.com', password: 'Uziel@2025', name: 'ÊNIO HENRIQUE', role: 'member', whatsapp: '' },
    { username: 'camila@uziel.com', password: 'Uziel@2025', name: 'CAMILA FALAVINA', role: 'member', whatsapp: '' },
    { username: 'karla@uziel.com', password: 'Uziel@2025', name: 'KARLA VANESSA', role: 'member', whatsapp: '' },
    { username: 'mel@uziel.com', password: 'Uziel@2025', name: 'MEL BUZZO', role: 'member', whatsapp: '' },
    { username: 'alexandre@uziel.com', password: 'Uziel@2025', name: 'ALEXANDRE MANDELI', role: 'member', whatsapp: '' },
    { username: 'julio@uziel.com', password: 'Uziel@2025', name: 'JULIO CÉSAR', role: 'admin', whatsapp: '' }
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Função para garantir que os usuários padrão existam no Auth e Firestore
  const seedDefaultUsers = async (currentUsers: User[]) => {
      if (localStorage.getItem('defaultUsersSeedAttempted') === 'true') {
          return;
      }
      
      try {
          let changesMade = false;
          for (const defaultUser of DEFAULT_USERS) {
              const exists = currentUsers.some(u => u.username.toLowerCase() === defaultUser.username.toLowerCase());
              if (!exists) {
                  try {
                      if (defaultUser.password) {
                          await AuthService.createAccount(defaultUser.username, defaultUser.password);
                      }
                      await UserService.saveUser(defaultUser);
                      changesMade = true;
                  } catch (e: any) {
                      const msg = e.message || '';
                      if (msg.includes('permission')) {
                          localStorage.setItem('defaultUsersSeedAttempted', 'true');
                          break; 
                      }
                  }
              }
          }
          localStorage.setItem('defaultUsersSeedAttempted', 'true');
      } catch (globalError) {
          localStorage.setItem('defaultUsersSeedAttempted', 'true');
      }
  };

  // 1. Monitora Lista de Usuários do Firestore
  useEffect(() => {
    const unsubUsers = UserService.subscribe((firestoreUsers) => {
        const rawUsers = firestoreUsers as User[];
        const uniqueUsersMap = new Map<string, User>();
        rawUsers.forEach(u => {
            if (u.username) {
                uniqueUsersMap.set(u.username.toLowerCase().trim(), u);
            }
        });
        const users = Array.from(uniqueUsersMap.values());

        setUsersList(users);
        MemberService.syncLocalUsers(users);
        
        const seedTimeout = setTimeout(() => seedDefaultUsers(users), 500);
        return () => clearTimeout(seedTimeout);
    });
    return () => unsubUsers();
  }, []);

  // 2. Monitora Estado de Autenticação
  useEffect(() => {
      const authUnsub = onAuthStateChanged(auth, (user) => {
          setFirebaseUser(user);
          if (!user) {
              setCurrentUser(null);
              setLoading(false); 
          }
      });
      return () => authUnsub();
  }, []);

  // 3. Sincroniza Auth + Firestore
  useEffect(() => {
      if (firebaseUser && usersList.length > 0) {
          const matchedUser = usersList.find(u => u.username.toLowerCase() === firebaseUser.email?.toLowerCase());
          if (matchedUser) {
              const prevUser = currentUser;
              setCurrentUser(matchedUser);
              localStorage.setItem('currentUser', JSON.stringify(matchedUser));
              
              // Log Login only if it's a fresh session or distinct user
              if (!prevUser || prevUser.username !== matchedUser.username) {
                  AuditService.log(matchedUser.username, 'Auth', 'LOGIN', 'Sessão iniciada com sucesso', matchedUser.role, matchedUser.name);
              }
          } else {
              setCurrentUser(null);
          }
          setLoading(false);
      } else if (!firebaseUser) {
          setCurrentUser(null);
          if (usersList.length > 0) setLoading(false);
      }
  }, [firebaseUser, usersList]);

  const login = async (usernameInput: string, pass: string): Promise<boolean> => {
    if (!usernameInput || !usernameInput.trim()) {
        throw { code: 'auth/invalid-email', message: 'O usuário não pode ser vazio.' };
    }
    if (!pass || !pass.trim()) {
        throw { code: 'auth/wrong-password', message: 'A senha não pode ser vazia.' };
    }

    const username = usernameInput.includes('@') ? usernameInput : `${usernameInput}@uziel.com`;
    
    try {
        await AuthService.login(username, pass);
        // Login success log handled in useEffect to ensure user data is loaded
        return true;
    } catch (error: any) {
        console.error("Auth Error:", error);
        AuditService.log(username, 'Auth', 'ERROR', `Falha no login: ${error.code || 'Desconhecido'}`, 'unknown');
        throw error;
    }
  };

  const logout = async () => {
    if (currentUser) {
        AuditService.log(currentUser.username, 'Auth', 'LOGOUT', 'Usuário desconectado', currentUser.role, currentUser.name);
    }
    await AuthService.logout();
    setCurrentUser(null);
    setFirebaseUser(null);
    localStorage.removeItem('currentUser');
  };

  const addUser = async (newUser: User) => {
      if (newUser.password) {
          await AuthService.createAccount(newUser.username, newUser.password);
      }
      // Salva no Firestore
      await UserService.saveUser(newUser);
      
      if (currentUser) {
          AuditService.log(currentUser.username, 'Users', 'CREATE', `Criou o usuário: ${newUser.username} (${newUser.role})`, currentUser.role, currentUser.name);
      }
  };

  const removeUser = async (username: string) => {
      try {
        await UserService.deleteUser(username);
        if (currentUser) {
            AuditService.log(currentUser.username, 'Users', 'DELETE', `Excluiu o usuário: ${username}`, currentUser.role, currentUser.name);
        }
      } catch (error) {
        console.error("Failed to delete user data", error);
        throw error;
      }
  };

  const updateUser = async (updatedUser: User) => {
      // 1. Atualiza no Auth (Login) se aplicável
      if (auth.currentUser && updatedUser.password && updatedUser.password.trim().length > 0) {
          if (updatedUser.username.toLowerCase() === auth.currentUser.email?.toLowerCase()) {
              // Only update if the password actually changed, to avoid unnecessary reauth
              if (updatedUser.password !== currentUser?.password) {
                  try {
                      let currentPassword = currentUser?.password || '';
                      
                      try {
                          await AuthService.updateCurrentUserPassword(currentPassword, updatedUser.password);
                      } catch (initialError: any) {
                          // If it fails due to invalid credential (wrong stored password) or requires recent login and reauth failed
                          if (initialError.code === 'auth/invalid-credential' || initialError.code === 'auth/wrong-password' || initialError.code === 'auth/requires-recent-login' || initialError.code === 'auth/missing-password') {
                              // Prompt the user for their actual current password
                              const userProvidedPassword = window.prompt("Para alterar sua senha, por favor digite sua senha ATUAL:");
                              if (!userProvidedPassword) {
                                  throw new Error("Alteração de senha cancelada. Senha atual é necessária.");
                              }
                              // Try again with the provided password
                              await AuthService.updateCurrentUserPassword(userProvidedPassword, updatedUser.password);
                          } else {
                              throw initialError;
                          }
                      }
                  } catch (error: any) {
                      console.error("Auth password update failed:", error);
                      if (error.code === 'auth/requires-recent-login' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                          throw new Error("Senha atual incorreta. A alteração de senha falhou.");
                      }
                      if (error.code === 'auth/weak-password') {
                          throw new Error("A nova senha é muito fraca (mínimo 6 caracteres).");
                      }
                      // Prevent partial update (Firestore without Auth)
                      throw new Error("Erro ao atualizar senha. Nenhuma alteração foi salva.");
                  }
              }
          } else if (currentUser?.role === 'super-admin' || currentUser?.role === 'admin') {
              // Updating another user's password
              // We need to use the secondary app trick to update their password in Firebase Auth
              // We need their old password to sign in as them, which we have in usersList
              const targetUserOldData = usersList.find(u => u.username.toLowerCase() === updatedUser.username.toLowerCase());
              if (targetUserOldData && targetUserOldData.password && targetUserOldData.password !== updatedUser.password) {
                  try {
                      await AuthService.updateOtherUserPassword(updatedUser.username, targetUserOldData.password, updatedUser.password);
                  } catch (error: any) {
                      console.error("Failed to update other user's password in Auth:", error);
                      throw new Error(`Não foi possível alterar a senha no sistema de login. O usuário precisará redefinir a senha. Erro: ${error.message}`);
                  }
              }
          }
      }

      // 2. Prepara objeto para Firestore
      const userToSaveToFirestore = { ...updatedUser };
      if (!userToSaveToFirestore.password || userToSaveToFirestore.password.trim() === '') {
          delete userToSaveToFirestore.password;
      }
      if (userToSaveToFirestore.photoURL === undefined) {
          delete userToSaveToFirestore.photoURL;
      }

      // Salva no Firestore
      await UserService.saveUser(userToSaveToFirestore);
      
      if (currentUser) {
          AuditService.log(currentUser.username, 'Users', 'UPDATE', `Atualizou dados de: ${updatedUser.username}`, currentUser.role, currentUser.name);
      }
      
      // Atualiza estado local imediatamente para feedback instantâneo na UI
      if (currentUser && currentUser.username === updatedUser.username) {
          setCurrentUser(prev => prev ? { ...prev, ...userToSaveToFirestore, password: userToSaveToFirestore.password || prev.password } : null);
      }
  };

  return (
    <AuthContext.Provider value={{ currentUser, usersList, login, logout, addUser, removeUser, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
