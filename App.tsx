
import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Attendance from './pages/Attendance';
import RepertoryGenerator from './pages/RepertoryGenerator';
import Playlists from './pages/Playlists';
import Rota from './pages/Rota';
import Users from './pages/Users';
import Rehearsals from './pages/Rehearsals';
import Monitoring from './pages/Monitoring';
import SystemAdmin from './pages/SystemAdmin'; // NEW
import LiturgicalCalendar from './pages/LiturgicalCalendar';
import Justifications from './pages/Justifications';
import Polls from './pages/Polls';
import Layout from './components/Layout';
import Loading from './components/Loading';

const ProtectedRoute = ({ children }: React.PropsWithChildren) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading fullScreen />;

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const SuperAdminRoute = ({ children }: React.PropsWithChildren) => {
    const { currentUser, loading } = useAuth();
    if (loading) return <Loading fullScreen />;
    
    if (currentUser?.role !== 'super-admin') {
        return <Navigate to="/" replace />;
    }
    
    return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <div className="animate-fade-in w-full h-full">
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Home />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="repertory" element={<RepertoryGenerator />} />
              <Route path="playlists" element={<Playlists />} />
              <Route path="rota" element={<Rota />} />
              <Route path="calendar" element={<LiturgicalCalendar />} />
              <Route path="users" element={<Users />} />
              <Route path="rehearsals" element={<Rehearsals />} />
              <Route path="justifications" element={<Justifications />} />
              <Route path="polls" element={<Polls />} />
              
              {/* Developer Only Routes */}
              <Route path="monitoring" element={<SuperAdminRoute><Monitoring /></SuperAdminRoute>} />
              <Route path="system" element={<SuperAdminRoute><SystemAdmin /></SuperAdminRoute>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </div>
  );
};

export default App;
