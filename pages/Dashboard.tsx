
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { MemberService, AttendanceService } from '../services/firebase';
import { Member, AttendanceRecord } from '../types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Card from '../components/Card';
import Loading from '../components/Loading';

// --- COMPONENTS ---

const KpiCard = ({ title, value, subtext, icon, color, trend }: any) => (
    <Card variant="custom" className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5 group transition-all duration-300 hover:shadow-lg">
        <div className="p-6">
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500`}>
                <i className={`fas ${icon} text-6xl text-${color}-500`}></i>
            </div>
            <div className="relative z-10">
                <div className={`w-12 h-12 rounded-2xl bg-${color}-50 dark:bg-${color}-900/20 flex items-center justify-center text-${color}-600 dark:text-${color}-400 mb-4 text-xl shadow-sm`}>
                    <i className={`fas ${icon}`}></i>
                </div>
                <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</h3>
                <p className={`text-4xl font-display font-bold mb-2 ${typeof value === 'number' && value < 0 ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>{value}</p>
                {subtext && (
                    <div className="flex items-center gap-2">
                        {trend && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${trend === 'down' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} font-bold`}>
                                <i className={`fas fa-arrow-${trend === 'up' ? 'up' : 'down'}`}></i>
                            </span>
                        )}
                        <span className="text-xs text-slate-400 font-medium">{subtext}</span>
                    </div>
                )}
            </div>
        </div>
    </Card>
);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl text-xs z-50">
          <p className="font-bold text-white mb-2 text-sm">{label}</p>
          <div className="space-y-2">
              <p className="text-red-400 font-bold flex items-center gap-2 bg-white/5 p-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  Ausências: <span className="text-white ml-auto">{payload[0].value}</span>
              </p>
              <p className="text-slate-400 font-bold flex items-center gap-2 bg-white/5 p-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                  Presentes: <span className="text-white ml-auto">{payload[1].value}</span>
              </p>
          </div>
        </div>
      );
    }
    return null;
};

const Dashboard: React.FC = () => {
  const { currentUser, usersList } = useAuth();
  
  // Data State
  const [dbMembers, setDbMembers] = useState<Member[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const isMemberRole = currentUser?.role === 'member';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super-admin';

  useEffect(() => {
    // Parallel fetching
    const unsubMembers = MemberService.subscribe((data) => {
        setDbMembers(data);
    });
    
    // Fetch records to calculate real-time points
    const unsubRecords = AttendanceService.subscribe((data) => {
        setRecords(data); 
        setLoading(false);
    });

    return () => { unsubMembers(); unsubRecords(); };
  }, []);

  // --- DATA PROCESSING LOGIC ---

  // 1. Identify Active Team Members
  const activeUsers = useMemo(() => {
    if (isMemberRole) {
        return usersList.filter(u => u.username === currentUser?.username);
    }
    return usersList.filter(u => u.username !== 'admin'); 
  }, [usersList, isMemberRole, currentUser]);

  // 2. Map Database Points to Active Users & Rank by MOST ABSENCES
  // CRITICAL FIX: Calculate total points dynamically from records to ensure accuracy
  // This prevents desync issues where user has 0 absences but DB says "points: -50"
  const rankedMembers = useMemo(() => {
    const pointsMap = new Map<string, number>();
    
    // Initialize
    usersList.forEach(u => pointsMap.set(u.username.toLowerCase(), 0));

    // Sum
    records.forEach(r => {
        const uid = r.memberId.toLowerCase();
        const current = pointsMap.get(uid) || 0;
        pointsMap.set(uid, current + (r.points || 0));
    });

    const allRanked = usersList.filter(u => u.username !== 'admin').map(user => {
        const realPoints = pointsMap.get(user.username.toLowerCase()) || 0;
        return {
            id: user.username,
            name: user.name,
            role: user.role,
            totalPoints: realPoints,
            photoURL: user.photoURL
        };
    }).sort((a, b) => a.totalPoints - b.totalPoints); // ASCENDING SORT: -50 (Worst) -> 0 (Best)

    if (isMemberRole) {
        return allRanked.filter(m => m.id === currentUser?.username);
    }
    
    return allRanked;
  }, [usersList, records, isMemberRole, currentUser]);

  // 3. Process Attendance Metrics (Last 10 Events)
  const chartData = useMemo(() => {
      const groups: { [key: string]: { name: string, fullDate: string, present: number, absent: number } } = {};
      const sortedRecords = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const recentRecords = sortedRecords.slice(-500); // Analyze last 500 entries for graph

      recentRecords.forEach(r => {
          const isVisibleMember = activeUsers.some(u => u.username === r.memberId);
          if (!isVisibleMember) return;

          const key = `${r.date}_${r.eventType}`;
          if (!groups[key]) {
              groups[key] = { 
                  name: `${new Date(r.date).getDate()}/${new Date(r.date).getMonth()+1}`, 
                  fullDate: r.date,
                  present: 0, 
                  absent: 0 
              };
          }
          if (r.status === 'Presente') groups[key].present += 1;
          else groups[key].absent += 1;
      });

      // Return last 8 events for cleaner graph
      return Object.values(groups).slice(-8);
  }, [records, activeUsers]);

  // 4. Calculate Rates
  const absenceRate = useMemo(() => {
      if (chartData.length === 0) return 0;
      const totalP = chartData.reduce((acc, curr) => acc + curr.present, 0);
      const totalA = chartData.reduce((acc, curr) => acc + curr.absent, 0);
      const total = totalP + totalA;
      if (total === 0) return 0;
      return Math.round((totalA / total) * 100);
  }, [chartData]);

  const totalPenalizedAbsences = useMemo(() => {
      return records.filter(r => 
          activeUsers.some(u => u.username === r.memberId) && 
          r.status === 'Ausente' && 
          r.points < 0
      ).length;
  }, [records, activeUsers]);

  const recentActivity = useMemo(() => {
      return [...records]
        .filter(r => activeUsers.some(u => u.username === r.memberId))
        .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
        .slice(0, 5);
  }, [records, activeUsers]);

  const groupHealth = useMemo(() => {
      if (records.length === 0) return { label: 'Sem Dados', color: 'text-slate-500', dot: 'bg-slate-400' };
      const relevantRecords = records.filter(r => activeUsers.some(u => u.username === r.memberId));
      const totalPresence = relevantRecords.filter(r => r.status === 'Presente').length;
      const totalPenalties = relevantRecords.filter(r => r.points < 0).length;

      if (totalPenalties > totalPresence) return { label: 'Saúde Crítica', color: 'text-red-500', dot: 'bg-red-500', borderColor: 'border-red-500/20' };
      return { label: 'Sistema Saudável', color: 'text-green-500', dot: 'bg-green-500', borderColor: 'border-green-500/20' };
  }, [records, activeUsers]);


  if (loading) return <Loading fullScreen message="Calculando Métricas..." />;

  const myPoints = rankedMembers[0]?.totalPoints || 0;
  const isPerfect = myPoints === 0;

  return (
    <div className="space-y-8 pb-32">
      
      {/* --- HERO SECTION --- */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 animate-fade-in-up">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white leading-tight">
                Painel de Controle
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                {isMemberRole ? 'Monitore seu desempenho e regularidade.' : 'Visão geral da integridade do ministério.'}
            </p>
          </div>
          
          {isAdmin && (
              <div className={`flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl border ${groupHealth.borderColor}`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ml-2 ${groupHealth.dot}`}></span>
                  <span className={`text-xs font-bold uppercase tracking-wider pr-3 ${groupHealth.color}`}>
                      {groupHealth.label}
                  </span>
              </div>
          )}
      </div>

      {/* --- KPI GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up delay-100">
          
          <KpiCard 
             title={isMemberRole ? "Minha Pontuação" : "Pontuação Geral"} 
             value={isMemberRole ? myPoints : "Auditada"} 
             subtext={isMemberRole ? (isPerfect ? "Sem penalidades!" : "Pontos Perdidos") : "Cálculo em Tempo Real"}
             icon={isPerfect && isMemberRole ? "fa-trophy" : "fa-sort-numeric-down"} 
             color={isPerfect && isMemberRole ? "yellow" : "red"}
          />

          <KpiCard 
             title={isMemberRole ? "Minha Frequência" : "Taxa de Ausência"} 
             value={isMemberRole ? `${100 - absenceRate}%` : `${absenceRate}%`} 
             subtext={isMemberRole ? "Presença Confirmada" : "Média do Grupo"}
             icon={isMemberRole ? "fa-user-check" : "fa-user-times"} 
             color={absenceRate < 20 ? 'green' : 'red'}
             trend={absenceRate < 20 ? 'down' : 'up'}
          />

          <KpiCard 
             title="Faltas Penalizadas" 
             value={totalPenalizedAbsences} 
             subtext="Não Justificadas"
             icon="fa-calendar-times" 
             color="orange"
          />

          <KpiCard 
             title={isMemberRole ? "Situação" : "Maior Déficit"} 
             value={isMemberRole ? (myPoints < -10 ? "Crítico" : myPoints < 0 ? "Atenção" : "Excelente") : (rankedMembers[0]?.name.split(' ')[0] || '-')} 
             subtext={isMemberRole ? "Status Atual" : `${rankedMembers[0]?.totalPoints || 0} pts (Ranking)`}
             icon={isMemberRole ? (myPoints === 0 ? "fa-star" : "fa-exclamation-circle") : "fa-users"} 
             color={isMemberRole ? (myPoints === 0 ? "green" : "slate") : "slate"}
          />
      </div>

      {/* --- MAIN CONTENT GRID --- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fade-in-up delay-200">
          
          {/* LEFT: Charts & Analysis */}
          <div className="xl:col-span-2 space-y-8">
              
              {/* Main Activity Chart */}
              <Card variant="custom" className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-white/5 relative overflow-hidden" noPadding>
                  <div className="p-6 md:p-8">
                      <div className="flex justify-between items-center mb-8">
                          <div>
                              <h3 className="text-xl font-bold text-slate-800 dark:text-white">{isMemberRole ? 'Minhas Ausências' : 'Ausências da Equipe'}</h3>
                              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Tendência Recente</p>
                          </div>
                          <div className="flex gap-4 text-xs font-bold">
                              <div className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full bg-red-500"></span> Ausente
                              </div>
                              <div className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600"></span> Presente
                              </div>
                          </div>
                      </div>

                      <div style={{ width: '100%', height: 300 }}>
                          <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                  <defs>
                                      <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                      </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}} dy={10} />
                                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#ef4444', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                  <Area 
                                      type="monotone" 
                                      dataKey="absent" 
                                      stroke="#ef4444" 
                                      strokeWidth={4} 
                                      fill="url(#colorAbsent)" 
                                      activeDot={{r: 6, fill: "#fff", stroke: "#ef4444", strokeWidth: 3}}
                                      animationDuration={1500}
                                  />
                                  <Area 
                                      type="monotone" 
                                      dataKey="present" 
                                      stroke="#cbd5e1" 
                                      strokeWidth={2} 
                                      fill="transparent" 
                                      strokeDasharray="4 4" 
                                      activeDot={false} 
                                  />
                              </AreaChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              </Card>

              {/* Recent Activity List */}
              <Card variant="custom" className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-white/5" noPadding>
                  <div className="p-8">
                      <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-6">Últimas Atualizações</h3>
                      <div className="space-y-4">
                          {recentActivity.map((rec) => {
                              const isJustified = rec.status === 'Ausente' && rec.points === 0;
                              
                              return (
                                  <div key={rec.id} className="flex items-center justify-between group">
                                      <div className="flex items-center gap-4">
                                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-110 ${rec.status === 'Ausente' ? (isJustified ? 'bg-amber-500' : 'bg-red-500') : 'bg-green-500'}`}>
                                              <i className={`fas ${rec.status === 'Ausente' ? (isJustified ? 'fa-check-circle' : 'fa-user-times') : 'fa-check'}`}></i>
                                          </div>
                                          <div className="min-w-0">
                                              <p className="font-bold text-slate-700 dark:text-white text-sm truncate">{rec.memberName}</p>
                                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                                                  {new Date(rec.date).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})} • {rec.eventType}
                                              </p>
                                              {isJustified && rec.justification && (
                                                  <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5 truncate max-w-[200px] italic">
                                                      {rec.justification}
                                                  </p>
                                              )}
                                          </div>
                                      </div>
                                      <div className="flex flex-col items-end">
                                          <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase ${
                                              rec.status === 'Ausente' 
                                                ? (isJustified 
                                                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' 
                                                    : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400') 
                                                : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                          }`}>
                                              {isJustified ? 'Justificado' : rec.status}
                                          </span>
                                          {rec.points !== 0 && (
                                              <span className="text-[10px] font-bold mt-1 text-red-500">
                                                  {rec.points} pts
                                              </span>
                                          )}
                                      </div>
                                  </div>
                              );
                          })}
                          {recentActivity.length === 0 && (
                              <p className="text-center text-slate-400 text-sm py-4">Nenhuma atividade recente encontrada.</p>
                          )}
                      </div>
                  </div>
              </Card>
          </div>

          {/* RIGHT: Leaderboard / Personal Stats */}
          <div className="xl:col-span-1">
              <Card variant="custom" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-white/5 h-full relative overflow-hidden flex flex-col" noPadding>
                  <div className="p-8 h-full flex flex-col">
                      {/* Background Effects */}
                      <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-20 -mr-10 -mt-10 animate-pulse-slow ${isMemberRole && isPerfect ? 'bg-green-500' : 'bg-red-600'}`}></div>
                      
                      <div className="relative z-10 mb-8">
                          <div className="flex items-center gap-3 mb-2">
                              <i className={`fas ${isMemberRole ? 'fa-id-card' : 'fa-list-ol'} ${isMemberRole && isPerfect ? 'text-green-500 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'} text-xl`}></i>
                              <h3 className="font-bold text-xl">{isMemberRole ? 'Meu Status' : 'Ranking de Penalidades'}</h3>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">{isMemberRole ? 'Resumo de desempenho' : 'Membros com maior número de pontos negativos.'}</p>
                      </div>

                      {!isMemberRole ? (
                          <>
                            {/* Top 3 Podium Style (Worst Attendees) */}
                            <div className="flex justify-center items-end gap-3 mb-10 min-h-[140px]">
                                {/* 2nd Worst */}
                                {rankedMembers[1] && (
                                    <div className="flex flex-col items-center w-1/3">
                                        <div className="w-12 h-12 rounded-full border-2 border-orange-200 dark:border-orange-800 mb-2 overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold">
                                            {rankedMembers[1].photoURL ? <img src={rankedMembers[1].photoURL} alt={rankedMembers[1].name} className="w-full h-full object-cover" /> : rankedMembers[1].name.charAt(0)}
                                        </div>
                                        <div className="w-full bg-orange-50 dark:bg-slate-700/50 rounded-t-xl h-20 flex flex-col items-center justify-end p-2 relative border-t-2 border-orange-300 dark:border-orange-800">
                                            <span className="text-2xl font-display font-bold text-orange-600 dark:text-orange-700">2</span>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-2 truncate w-full text-center">{rankedMembers[1].name.split(' ')[0]}</p>
                                        <p className="text-[9px] text-red-500 dark:text-red-400 font-bold">{rankedMembers[1].totalPoints}</p>
                                    </div>
                                )}
                                
                                {/* 1st Worst (Most Negative) */}
                                {rankedMembers[0] && (
                                    <div className="flex flex-col items-center w-1/3 z-10">
                                        <i className="fas fa-exclamation-triangle text-red-500 text-sm mb-1 animate-bounce"></i>
                                        <div className="w-16 h-16 rounded-full border-2 border-red-400 dark:border-red-600 mb-2 overflow-hidden bg-gradient-to-br from-red-100 to-white dark:from-red-900 dark:to-slate-900 flex items-center justify-center text-red-600 dark:text-white text-xl font-bold shadow-[0_0_15px_rgba(220,38,38,0.3)] dark:shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                                            {rankedMembers[0].photoURL ? <img src={rankedMembers[0].photoURL} alt={rankedMembers[0].name} className="w-full h-full object-cover" /> : rankedMembers[0].name.charAt(0)}
                                        </div>
                                        <div className="w-full bg-gradient-to-t from-red-100 to-red-50 dark:from-red-900 dark:to-red-600 rounded-t-xl h-28 flex flex-col items-center justify-end p-2 shadow-lg relative border-t-2 border-red-300 dark:border-transparent">
                                            <span className="text-4xl font-display font-bold text-red-600 dark:text-white">1</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-800 dark:text-white mt-2 truncate w-full text-center">{rankedMembers[0].name.split(' ')[0]}</p>
                                        <p className="text-[10px] text-red-500 dark:text-red-300 font-bold">{rankedMembers[0].totalPoints} pts</p>
                                    </div>
                                )}

                                {/* 3rd Worst */}
                                {rankedMembers[2] && (
                                    <div className="flex flex-col items-center w-1/3">
                                        <div className="w-12 h-12 rounded-full border-2 border-slate-200 dark:border-slate-600 mb-2 overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold">
                                            {rankedMembers[2].photoURL ? <img src={rankedMembers[2].photoURL} alt={rankedMembers[2].name} className="w-full h-full object-cover" /> : rankedMembers[2].name.charAt(0)}
                                        </div>
                                        <div className="w-full bg-slate-50 dark:bg-slate-700/30 rounded-t-xl h-14 flex flex-col items-center justify-end p-2 relative border-t-2 border-slate-200 dark:border-transparent">
                                            <span className="text-xl font-display font-bold text-slate-400 dark:text-slate-500">3</span>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-2 truncate w-full text-center">{rankedMembers[2].name.split(' ')[0]}</p>
                                        <p className="text-[9px] text-red-500 dark:text-red-400 font-bold">{rankedMembers[2].totalPoints}</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                                {rankedMembers.slice(3).map((member, idx) => (
                                    <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-slate-100 dark:border-white/5">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-4">{idx + 4}</span>
                                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-[10px] overflow-hidden text-slate-600 dark:text-white">
                                                {member.photoURL ? <img src={member.photoURL} className="w-full h-full object-cover" /> : member.name.charAt(0)}
                                            </div>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{member.name}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${member.totalPoints < 0 ? 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30' : 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'}`}>
                                            {member.totalPoints} pts
                                        </span>
                                    </div>
                                ))}
                            </div>
                          </>
                      ) : (
                          // Member View (Self Card)
                          <div className="flex-1 flex flex-col items-center justify-center p-4">
                              <div className="relative">
                                  <div className={`w-32 h-32 rounded-full border-4 ${isPerfect ? 'border-green-500' : 'border-red-500'} bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-6xl font-bold mb-6 overflow-hidden shadow-2xl transition-colors duration-500 text-slate-700 dark:text-white`}>
                                      {rankedMembers[0]?.photoURL ? <img src={rankedMembers[0].photoURL} className="w-full h-full object-cover" /> : rankedMembers[0]?.name.charAt(0)}
                                  </div>
                                  {!isPerfect && (
                                      <div className="absolute bottom-6 right-0 w-10 h-10 bg-red-500 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center text-white shadow-lg animate-bounce z-10" title="Atenção às faltas">
                                          <i className="fas fa-exclamation text-lg"></i>
                                      </div>
                                  )}
                                  {isPerfect && (
                                      <div className="absolute bottom-6 right-0 w-10 h-10 bg-green-500 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center text-white shadow-lg z-10" title="Excelente!">
                                          <i className="fas fa-star text-lg"></i>
                                      </div>
                                  )}
                              </div>
                              
                              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 text-center">{rankedMembers[0]?.name}</h2>
                              <span className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold mb-8">Membro do Ministério</span>
                              
                              <div className="w-full grid grid-cols-2 gap-4">
                                  <div className={`rounded-2xl p-4 text-center border ${isPerfect ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-500/20' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/20'}`}>
                                      <p className={`text-3xl font-display font-bold mb-1 ${isPerfect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{myPoints}</p>
                                      <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Pontos (Saldo)</p>
                                  </div>
                                  <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4 text-center border border-slate-100 dark:border-white/5">
                                      <p className={`text-3xl font-display font-bold mb-1 ${absenceRate > 20 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{100 - absenceRate}%</p>
                                      <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Frequência</p>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              </Card>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
