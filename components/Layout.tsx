
import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HOURLY_VERSES } from '../constants';
import UzielLogo from './UzielLogo';
import { AiAssistant } from './AiAssistant';
import EditProfileModal from './EditProfileModal';
import AbsenceNotificationModal from './AbsenceNotificationModal'; 
import { AuditService, AttendanceService, JustificationService } from '../services/firebase';
import { AttendanceRecord, Justification } from '../types';

const SidebarItem = ({ to, icon, label, onClick, badgeCount = 0, isDev = false }: any) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      `flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group relative mb-1 ${
        isActive
          ? 'text-white bg-brand-600 shadow-lg shadow-brand-500/20'
          : 'text-slate-600 dark:text-slate-400 hover:bg-brand-50 dark:hover:bg-white/5 hover:text-brand-600 dark:hover:text-brand-200'
      } ${isDev ? 'border-l-2 border-dashed border-brand-500/30' : ''}`
    }
  >
    <div className="w-6 text-center shrink-0">
       <i className={`${icon.startsWith('fa-') ? `fas ${icon}` : icon} text-lg`}></i>
    </div>
    <span className="text-sm font-medium flex-1 truncate">{label}</span>
    {badgeCount > 0 && (
      <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{badgeCount}</span>
    )}
  </NavLink>
);

const SidebarSection = ({ title }: { title: string }) => (
  <div className="px-5 mt-6 mb-2 flex items-center gap-3">
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 whitespace-nowrap">{title}</span>
    <div className="h-px bg-slate-100 dark:bg-white/5 flex-1"></div>
  </div>
);

const BottomNavItem = ({ to, icon, label, badgeCount = 0 }: any) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `relative flex flex-col items-center justify-center transition-all duration-500 ease-out w-14 h-14 ${
        isActive ? 'scale-110 -translate-y-1' : 'scale-100 translate-y-0 opacity-60'
      }`
    }
  >
    {({ isActive }) => (
      <>
        {isActive && (
            <div className="absolute inset-0 bg-brand-500/10 dark:bg-brand-500/20 blur-xl rounded-full scale-150 animate-pulse"></div>
        )}
        
        <div className={`relative z-10 transition-all duration-500 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'}`}>
          <i className={`${icon.startsWith('fa-') ? `fas ${icon}` : icon} text-2xl transition-transform duration-500 ${isActive ? 'scale-110' : 'scale-100'}`}></i>
          {badgeCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-white dark:ring-[#0f172a] shadow-md">
                  {badgeCount}
              </span>
          )}
        </div>
        
        <span className={`text-[9px] font-black uppercase tracking-tight mt-1 transition-all duration-500 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            {label}
        </span>

        {isActive && (
            <div className="absolute bottom-0 w-1 h-1 bg-brand-500 dark:bg-brand-400 rounded-full shadow-glow"></div>
        )}
      </>
    )}
  </NavLink>
);

const Layout: React.FC = () => {
  const { currentUser, logout, checkPermission } = useAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(false); 
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true); 
  const [verse, setVerse] = useState(HOURLY_VERSES[0]);
  const location = useLocation();
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [pendingAbsences, setPendingAbsences] = useState<AttendanceRecord[]>([]);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [isAbsenceModalDismissed, setIsAbsenceModalDismissed] = useState(false);

  // Initial theme state aligned with index.html logic:
  // True only if localStorage strictly equals 'dark'.
  const [isDark, setIsDark] = useState(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem('theme') === 'dark';
      }
      return false; // Default server/fallback state is Light
  });

  const toggleTheme = () => {
     const next = !isDark;
     setIsDark(next);
     document.documentElement.classList.toggle('dark', next);
     localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  useEffect(() => {
    const idx = Math.floor(Math.random() * HOURLY_VERSES.length);
    setVerse(HOURLY_VERSES[idx]);
  }, [location.pathname]);

  useEffect(() => {
      if (currentUser) {
          const unsubAttendance = AttendanceService.subscribe((recordsData) => {
              const records = recordsData as AttendanceRecord[];
              const myAbsences = records.filter(r => r.memberId.toLowerCase() === currentUser.username.toLowerCase() && r.status === 'Ausente' && r.points !== 0);
              const unsubJustifications = JustificationService.subscribe((justificationsData) => {
                  const justifications = justificationsData as Justification[];
                  const handledDates = new Set(justifications.filter(j => j.userId === currentUser.username).map(j => j.eventDate));
                  const trulyPending = myAbsences.filter(r => !handledDates.has(r.date));
                  setPendingAbsences(trulyPending);
                  if (trulyPending.length > 0 && location.pathname !== '/justifications' && !isAbsenceModalDismissed) {
                      setShowAbsenceModal(true);
                  } else {
                      setShowAbsenceModal(false);
                  }
              });
              return () => unsubJustifications();
          });
          return () => unsubAttendance();
      }
  }, [currentUser, location.pathname, isAbsenceModalDismissed]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super-admin';
  const isSuperAdmin = currentUser?.role === 'super-admin';

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-[#020617] relative">
      <div className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000">
          <div className={`absolute inset-0 bg-white dark:bg-[#020617]`} />
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `radial-gradient(circle at 0% 0%, #29aae2 0%, transparent 40%), radial-gradient(circle at 100% 100%, #38bdf8 0%, transparent 40%)` }} />
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[190] xl:hidden transition-all duration-300" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed xl:static inset-y-0 left-0 z-[200] transition-all duration-500 ease-in-out flex flex-col w-[80vw] max-w-[300px] xl:w-auto ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'} ${isDesktopSidebarOpen ? 'xl:w-[280px] xl:p-6' : 'xl:w-0 xl:overflow-hidden xl:p-0'}`}>
        <div className="h-full bg-white/90 dark:bg-[#0f172a]/95 glass-panel xl:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl xl:shadow-none border-r xl:border border-slate-100 dark:border-white/5">
          <div className="p-6 flex flex-col h-full">
            <div className="mb-8 flex items-center justify-between">
              <div 
                className="flex items-center gap-3 cursor-pointer group" 
                onClick={() => { 
                  setIsProfileModalOpen(true); 
                  setSidebarOpen(false); // Fecha o menu ao abrir o perfil para evitar sobreposição no mobile
                }}
              >
                <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-white font-bold text-xl overflow-hidden shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
                   {currentUser?.photoURL ? <img src={currentUser.photoURL} className="w-full h-full object-cover" /> : currentUser?.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[120px]">{currentUser?.name.split(' ')[0]}</p>
                  <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest">{currentUser?.role === 'super-admin' ? 'Dev' : currentUser?.role}</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="xl:hidden text-slate-400"><i className="fas fa-times"></i></button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-2 pb-6">
              <SidebarItem to="/" icon="fa-home" label="Início" />
              
              {checkPermission('dashboard', 'view') && (
                <SidebarItem to="/dashboard" icon="fa-chart-pie" label="Dashboard" />
              )}
              
              <SidebarSection title="Liturgia & Louvor" />
              
              {checkPermission('repertory', 'view') && (
                <>
                  <SidebarItem to="/repertory" icon="fa-music" label="Repertório" />
                </>
              )}
              {checkPermission('liturgy', 'view') && (
                <SidebarItem to="/calendar" icon="fa-calendar-check" label="Liturgia" />
              )}
              {checkPermission('rehearsals', 'view') && (
                <SidebarItem to="/rehearsals" icon="fa-calendar-day" label="Agenda" />
              )}
              {checkPermission('scales', 'view') && (
                <SidebarItem to="/rota" icon="fa-calendar-alt" label="Salmistas" />
              )}
              {checkPermission('playlists', 'view') && (
                <SidebarItem to="/playlists" icon="fab fa-spotify" label="Playlists" />
              )}

              <SidebarSection title="Gestão" />
              
              {checkPermission('justifications', 'view') && (
                <SidebarItem to="/justifications" icon="fa-envelope-open-text" label="Justificativas" badgeCount={pendingAbsences.length} />
              )}
              {checkPermission('polls', 'view') && (
                <SidebarItem to="/polls" icon="fa-poll" label="Enquetes" />
              )}
              {checkPermission('attendance', 'view') && (
                <SidebarItem to="/attendance" icon="fa-clipboard-user" label="Presença" />
              )}
              {checkPermission('users', 'view') && (
                <SidebarItem to="/users" icon="fa-users-cog" label="Equipe" />
              )}

              {checkPermission('system', 'view') && (
                <>
                  <SidebarSection title="Desenvolvedor" />
                  {checkPermission('monitoring', 'view') && (
                    <SidebarItem to="/monitoring" icon="fa-terminal" label="Comando" isDev />
                  )}
                  <SidebarItem to="/system" icon="fa-microchip" label="Engine Room" isDev />
                </>
              )}
            </nav>

            <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-4">
              <div className="flex gap-2">
                <button 
                  onClick={toggleTheme} 
                  className="flex-1 flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 transition-all duration-500 overflow-hidden"
                >
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-2 transition-colors">
                    {isDark ? 'Escuro' : 'Claro'}
                  </span>
                  
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center relative overflow-hidden transition-all duration-500 ${isDark ? 'bg-slate-700' : 'bg-white shadow-sm'}`}>
                      <i className={`fas fa-sun absolute text-brand-500 transition-all duration-500 transform ${isDark ? 'translate-y-10 rotate-90 opacity-0 scale-50' : 'translate-y-0 rotate-0 opacity-100 scale-100'}`}></i>
                      <i className={`fas fa-moon absolute text-brand-400 transition-all duration-500 transform ${isDark ? 'translate-y-0 rotate-0 opacity-100 scale-100' : '-translate-y-10 -rotate-90 opacity-0 scale-50'}`}></i>
                  </div>
                </button>
                <button onClick={() => setIsDesktopSidebarOpen(false)} className="hidden xl:flex w-12 h-12 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-brand-600 items-center justify-center transition-all"><i className="fas fa-chevron-left"></i></button>
              </div>
              
              <div className="relative p-5 rounded-[2rem] bg-brand-600 text-white overflow-hidden shadow-lg shadow-brand-500/20 group">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-brand-800"></div>
                <div className="relative z-10">
                  <p className="text-[10px] font-bold opacity-60 uppercase mb-2">Palavra</p>
                  <p className="text-[11px] italic font-medium leading-relaxed">"{verse.text}"</p>
                  <p className="text-[9px] font-bold mt-2 text-right opacity-80">— {verse.reference}</p>
                </div>
              </div>

              <button onClick={logout} className="w-full py-3 rounded-xl text-slate-400 hover:text-red-500 transition-colors font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                <i className="fas fa-sign-out-alt"></i> Sair
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {!isDesktopSidebarOpen && (
          <button onClick={() => setIsDesktopSidebarOpen(true)} className="hidden xl:flex absolute top-8 left-8 z-50 p-3 rounded-xl bg-white dark:bg-[#0f172a] shadow-xl border border-slate-100 dark:border-white/5 text-brand-600"><i className="fas fa-bars"></i></button>
        )}
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 lg:p-12 relative">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>

        <AiAssistant currentPage={location.pathname} hidden={isProfileModalOpen || location.pathname !== '/'} />
        <EditProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
        <AbsenceNotificationModal isOpen={showAbsenceModal} absences={pendingAbsences} onClose={() => { setShowAbsenceModal(false); setIsAbsenceModalDismissed(true); }} />
      </main>

      <div className={`xl:hidden fixed bottom-0 left-0 w-full glass-panel rounded-t-[1.5rem] rounded-b-none px-2 py-1 pb-5 z-[100] flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-all duration-300 ${isSidebarOpen ? 'translate-y-[150%] opacity-0' : 'translate-y-0 opacity-100'}`}>
          <BottomNavItem to="/" icon="fa-home" label="Home" />
          
          {checkPermission('justifications', 'view') && (
            <BottomNavItem to="/justifications" icon="fa-envelope-open-text" label="Justificar" badgeCount={pendingAbsences.length} />
          )}
          
          <div className="relative -top-5 mx-1">
            {checkPermission('attendance', 'view') ? (
                <NavLink 
                    to="/attendance" 
                    className={({ isActive }) => `
                        w-14 h-14 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl flex items-center justify-center 
                        transition-all duration-500 transform active:scale-90
                        border-[4px] border-white dark:border-[#020617]
                        ${isActive 
                            ? '!bg-brand-600 !text-white scale-110 shadow-[0_10px_25px_rgba(41,170,226,0.5)]' 
                            : ''
                        }
                    `}
                >
                   <i className="fas fa-clipboard-user text-xl"></i>
                </NavLink>
            ) : (
                checkPermission('dashboard', 'view') && (
                    <NavLink 
                        to="/dashboard" 
                        className={({ isActive }) => `
                            w-14 h-14 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl flex items-center justify-center 
                            transition-all duration-500 transform active:scale-90
                            border-[4px] border-white dark:border-[#020617]
                            ${isActive 
                                ? '!bg-brand-600 !text-white scale-110 shadow-[0_10px_25px_rgba(41,170,226,0.5)]' 
                                : ''
                            }
                        `}
                    >
                       <i className="fas fa-chart-pie text-xl"></i>
                    </NavLink>
                )
            )}
          </div>

          {checkPermission('scales', 'view') && (
            <BottomNavItem to="/rota" icon="fa-calendar-alt" label="Escala" />
          )}
          
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 opacity-60 hover:opacity-100"
          >
             <div className="bg-slate-100 dark:bg-white/5 w-10 h-10 rounded-full flex items-center justify-center">
                <i className="fas fa-bars text-xl text-slate-500"></i>
             </div>
          </button>
      </div>
    </div>
  );
};

export default Layout;
