
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MemberService, AttendanceService, AuditService, JustificationService, RehearsalService } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Member, AttendanceRecord, AttendanceSettings, Justification, Rehearsal } from '../types';
import Loading from '../components/Loading';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

const DEFAULT_SETTINGS: AttendanceSettings = {
    pointsMissa: -5,
    pointsEnsaio: -4,
    pointsGeral: -10,
    pointsCompromisso: -3,
    pointsGravissima: -15
};

const Attendance: React.FC = () => {
  const { currentUser, usersList } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'register' | 'history'>('register');
  
  const [members, setMembers] = useState<Member[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [scheduledEvents, setScheduledEvents] = useState<Rehearsal[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [settings, setSettings] = useState<AttendanceSettings>(DEFAULT_SETTINGS);
  
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [eventType, setEventType] = useState('Missa');
  const [isManualEventType, setIsManualEventType] = useState(false);
  const [date, setDate] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>(''); 

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'present' | 'absent'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [toast, setToast] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoNotify, setAutoNotify] = useState(() => localStorage.getItem('uziel_auto_notify') === 'true');

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempSettings, setTempSettings] = useState<AttendanceSettings>(DEFAULT_SETTINGS);

  const [editEventModal, setEditEventModal] = useState<{
      isOpen: boolean;
      originalDate: string;
      originalType: string;
      newDate: string;
      newType: string;
      records: AttendanceRecord[];
      newDateInput: string;
  }>({ isOpen: false, originalDate: '', originalType: '', newDate: '', newType: '', records: [], newDateInput: '' });

  const [deleteModal, setDeleteModal] = useState<{
      isOpen: boolean;
      title: string;
      description: string;
      onConfirm: () => Promise<void>;
  }>({ isOpen: false, title: '', description: '', onConfirm: async () => {} });

  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super-admin';
  const isSuperAdmin = currentUser?.role === 'super-admin';

  useEffect(() => {
    const unsubM = MemberService.subscribe((data) => setMembers(data));
    const unsubR = AttendanceService.subscribe((data) => setRecords(data));
    const unsubJ = JustificationService.subscribe((data) => setJustifications(data as Justification[]));
    const unsubE = RehearsalService.subscribe((data) => setScheduledEvents(data as Rehearsal[]));
    
    AttendanceService.getSettings().then((data) => {
        if (data) {
            const loaded = data as any;
            setSettings({
                pointsMissa: loaded.pointsMissa ?? -5,
                pointsEnsaio: loaded.pointsEnsaio ?? -4,
                pointsGeral: loaded.pointsGeral ?? -10,
                pointsCompromisso: loaded.pointsCompromisso ?? -3,
                pointsGravissima: loaded.pointsGravissima ?? -15
            });
        }
        setInitialLoading(false);
    });
    return () => { unsubM(); unsubR(); unsubJ(); unsubE(); };
  }, []);

  const toggleAutoNotify = () => {
      const newState = !autoNotify;
      setAutoNotify(newState);
      localStorage.setItem('uziel_auto_notify', String(newState));
      setToast(newState ? "Notificação Automática ATIVADA" : "Notificação Automática DESATIVADA");
      setTimeout(() => setToast(null), 2000);
  };

  const calculatePoints = (typeStr: string, currentSettings: AttendanceSettings, specificType?: string) => {
      if (specificType) {
          if (specificType === 'Missa') return currentSettings.pointsMissa;
          if (specificType === 'Ensaio') return currentSettings.pointsEnsaio;
          return currentSettings.pointsGeral; 
      }
      const typeLower = typeStr.toLowerCase();
      if (typeLower.includes('missa') || typeLower.includes('celebração')) return currentSettings.pointsMissa;
      if (typeLower.includes('ensaio')) return currentSettings.pointsEnsaio;
      if (typeLower.includes('compromisso') || typeLower.includes('atraso') || typeLower.includes('função')) return currentSettings.pointsCompromisso;
      if (typeLower.includes('grave') || typeLower.includes('exclusão') || typeLower.includes('infração')) return currentSettings.pointsGravissima;
      return currentSettings.pointsGeral; 
  };

  const sortedMembers = useMemo(() => {
    const validUserIds = new Set(usersList.map(u => u.username.toLowerCase().trim()));
    const activeMembers = members.filter(m => validUserIds.has(m.id.toLowerCase().trim()));
    return activeMembers.sort((a,b) => a.name.localeCompare(b.name));
  }, [members, usersList]);

  const eventsForSelectedDate = useMemo(() => {
      return scheduledEvents.filter(e => e.date === date);
  }, [scheduledEvents, date]);

  useEffect(() => {
      if (eventsForSelectedDate.length === 1 && !isSessionActive) {
          const ev = eventsForSelectedDate[0];
          setEventType(ev.topic);
          setSelectedEventId(ev.id || '');
          setIsManualEventType(false);
      } else if (eventsForSelectedDate.length === 0 && !isManualEventType) {
          setEventType('Missa');
          setSelectedEventId('');
      }
  }, [eventsForSelectedDate, isSessionActive, date]);

  const eventHistory = useMemo(() => {
    const groups: {[key: string]: { date: string, type: string, records: AttendanceRecord[] }} = {};
    records.forEach(r => {
        const key = `${r.date}_${r.eventType}`;
        if (!groups[key]) {
            groups[key] = { date: r.date, type: r.eventType, records: [] };
        }
        groups[key].records.push(r);
    });
    return Object.values(groups).sort((a,b) => b.date.localeCompare(a.date));
  }, [records]);

  const sessionRecords = records.filter(r => r.date === date && r.eventType === eventType);
  
  const processedMembers = useMemo(() => {
      return sortedMembers.filter(m => {
          const nameMatch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
          if (!nameMatch) return false;
          const rec = sessionRecords.find(r => r.memberId.toLowerCase() === m.id.toLowerCase());
          
          if (filterStatus === 'all') return true;
          if (filterStatus === 'pending') return !rec;
          if (filterStatus === 'present') return rec?.status === 'Presente';
          if (filterStatus === 'absent') return rec?.status === 'Ausente';
          return true;
      });
  }, [sortedMembers, sessionRecords, searchTerm, filterStatus]);

  const stats = {
      present: sessionRecords.filter(r => r.status === 'Presente').length,
      absent: sessionRecords.filter(r => r.status === 'Ausente').length,
      total: sortedMembers.length,
      pending: sortedMembers.length - sessionRecords.length
  };
  
  const progressPercent = stats.total > 0 ? Math.round(((stats.present) / stats.total) * 100) : 0;
  const absencePercent = stats.total > 0 ? Math.round(((stats.absent) / stats.total) * 100) : 0;

  const formatDateForStorage = (dateStr: string) => {
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('/');
    if (!day || !month || !year) return dateStr;
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!day || !month || !year) return dateStr;
    return `${day}/${month}/${year}`;
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    if (value.length >= 5) {
      value = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
    } else if (value.length >= 3) {
      value = `${value.slice(0, 2)}/${value.slice(2)}`;
    }
    setDateInput(value);
    if (value.length === 10) {
        setDate(formatDateForStorage(value));
    } else {
        setDate('');
    }
  };

  const handleModalDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    if (value.length >= 5) {
      value = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
    } else if (value.length >= 3) {
      value = `${value.slice(0, 2)}/${value.slice(2)}`;
    }
    
    if (value.length === 10) {
         setEditEventModal(prev => ({ ...prev, newDateInput: value, newDate: formatDateForStorage(value) }));
    } else {
         setEditEventModal(prev => ({ ...prev, newDateInput: value, newDate: '' }));
    }
  };

  const formatDateBR = (isoDate: string) => {
      if (!isoDate) return '';
      const [y, m, d] = isoDate.split('-');
      return `${d}/${m}/${y}`;
  };

  const openSettings = () => {
      setTempSettings(settings);
      setShowSettingsModal(true);
  };

  const saveSettings = async () => {
      setIsProcessing(true);
      try {
          const cleanSettings: AttendanceSettings = {
              pointsMissa: -Math.abs(tempSettings.pointsMissa),
              pointsEnsaio: -Math.abs(tempSettings.pointsEnsaio),
              pointsGeral: -Math.abs(tempSettings.pointsGeral),
              pointsCompromisso: -Math.abs(tempSettings.pointsCompromisso),
              pointsGravissima: -Math.abs(tempSettings.pointsGravissima)
          };
          await AttendanceService.saveSettings(cleanSettings);
          setSettings(cleanSettings);
          if (currentUser) {
              await AuditService.log(currentUser.username, 'Attendance', 'UPDATE', 'Atualizou regras de penalidade', currentUser.role, currentUser.name);
          }
          setShowSettingsModal(false);
          setToast("Regras salvas!");
      } catch (e) {
          alert("Erro ao salvar configurações.");
      } finally {
          setIsProcessing(false);
          setTimeout(() => setToast(null), 3000);
      }
  };

  const notifyPenalty = (memberId: string, memberName: string, evType: string, evDate: string, pts: number) => {
      const targetUser = usersList.find(u => u.username.toLowerCase() === memberId.toLowerCase());
      if (!targetUser?.whatsapp) {
          alert(`O membro ${memberName} não possui WhatsApp cadastrado.`);
          return;
      }
      const cleanPhone = targetUser.whatsapp.replace(/\D/g, '');
      const eventDateFormatted = new Date(evDate + 'T12:00:00').toLocaleDateString('pt-BR');
      const portalLink = window.location.href.split('#')[0] + '#/justifications';
      const message = `*⚠️ NOTIFICAÇÃO DE AUSÊNCIA - MINISTÉRIO UZIEL*\n\nOlá, *${memberName.split(' ')[0]}*.\n\nFoi registrada sua ausência no evento:\n📅 *${evType}*\n🗓️ *${eventDateFormatted}*\n\nConforme o *Capítulo X do Estatuto*, foram aplicados automaticamente *${pts} pontos* de penalidade no seu registro.\n\n⏳ *PRAZO DE 24H:*\nVocê tem até *24 horas* para enviar sua justificativa no portal.\n\n🔗 *Link para justificar:*\n${portalLink}`;
      const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const handleAttendance = async (memberId: string, memberName: string, status: 'Presente' | 'Ausente', justification?: string, forcePoints?: number) => {
    try {
      // Security Check: Pending Justification
      const hasPendingJustification = justifications.some(j => 
          j.userId.toLowerCase() === memberId.toLowerCase() && 
          j.eventDate === date && 
          j.status === 'PENDING'
      );

      if (hasPendingJustification) {
          alert("Este membro possui uma justificativa em análise. Resolva-a na tela de Justificativas antes de alterar a presença.");
          return;
      }

      let points = 0;
      if (status === 'Presente') {
          points = 0;
      } else {
          if (forcePoints !== undefined) {
              points = forcePoints;
          } else {
              const eventObj = scheduledEvents.find(e => e.id === selectedEventId);
              points = calculatePoints(eventType, settings, eventObj?.type);
          }
      }
      
      const recordId = `${date}_${eventType}_${memberId}`.replace(/\s+/g, '-');
      await AttendanceService.register(recordId, memberId, memberName, eventType, date, status, justification || (status === 'Ausente' ? 'Aguardando justificativa' : ''), points, selectedEventId);
      if (currentUser) {
          AuditService.log(currentUser.username, 'Attendance', 'CREATE', `Registrou ${status} para ${memberName} em ${eventType} (${date})`, currentUser.role, currentUser.name);
      }
    } catch (error) {
      setToast("Erro ao registrar");
    }
  };

  const initiateAbsence = (id: string, name: string) => {
      // 1. Block if Pending
      const pendingJustification = justifications.find(j => 
          j.userId.toLowerCase() === id.toLowerCase() && 
          j.eventDate === date && 
          j.status === 'PENDING'
      );
      
      if (pendingJustification) {
          alert("Ação Bloqueada: Existe uma justificativa em análise para este membro nesta data. Acesse 'Justificativas' para aprovar ou reprovar.");
          return;
      }

      // 2. Auto-handle Accepted
      const acceptedJustification = justifications.find(j => 
          j.userId.toLowerCase() === id.toLowerCase() && 
          j.eventDate === date && 
          j.status === 'ACCEPTED'
      );

      if (acceptedJustification) {
          const autoReason = `Justificado (${acceptedJustification.reason}): ${acceptedJustification.description.substring(0, 30)}...`;
          handleAttendance(id, name, 'Ausente', autoReason, 0);
          setToast(`Ausência justificada automaticamente.`);
          return;
      }
      
      // 3. Default Penalty (Includes Rejected cases which default to penalty)
      const eventObj = scheduledEvents.find(e => e.id === selectedEventId);
      const pts = calculatePoints(eventType, settings, eventObj?.type);
      
      handleAttendance(id, name, 'Ausente', 'Falta lançada (Aguardando justificativa)', pts);
      if (autoNotify) notifyPenalty(id, name, eventType, date, pts);
  };

  const handleStartSession = () => {
      if (!eventType.trim()) return alert("Defina um nome para o evento.");
      setIsSessionActive(true);
  };

  const handleResetSession = () => {
        if (sessionRecords.length === 0) return; 
        setDeleteModal({
            isOpen: true,
            title: 'Reiniciar Chamada?',
            description: 'Isso apagará todas as presenças desta chamada agora.',
            onConfirm: async () => {
                setIsProcessing(true);
                try {
                    await AttendanceService.deleteBatch(sessionRecords.map(r => ({ id: r.id, memberId: r.memberId, points: r.points })));
                    setToast("Lista reiniciada!");
                } catch (e) {
                    alert("Erro ao limpar.");
                } finally {
                    setIsProcessing(false);
                    setDeleteModal(prev => ({...prev, isOpen: false}));
                }
            }
        });
  };

  const handleToggleHistoryStatus = async (record: AttendanceRecord) => {
      if (!isAdmin) return;
      const newStatus = record.status === 'Presente' ? 'Ausente' : 'Presente';
      setIsProcessing(true);
      try {
          await AttendanceService.delete(record.id, record.memberId, record.points);
          
          let specificType: string | undefined = undefined;
          if (record.eventId) {
              const ev = scheduledEvents.find(e => e.id === record.eventId);
              if (ev) specificType = ev.type;
          }
          
          let newPoints = newStatus === 'Presente' ? 0 : calculatePoints(record.eventType, settings, specificType);
          
          const currentEventId = record.eventId;
          await AttendanceService.register(record.id, record.memberId, record.memberName, record.eventType, record.date, newStatus, newStatus === 'Ausente' ? 'Alterado no histórico' : '', newPoints, currentEventId);
          setToast(`Status alterado para ${newStatus}`);
      } catch (e) {
          alert("Erro ao alterar status.");
      } finally {
          setIsProcessing(false);
          setTimeout(() => setToast(null), 3000);
      }
  };

  const openEditEventModal = (e: React.MouseEvent, date: string, type: string, records: AttendanceRecord[]) => {
      e.stopPropagation();
      setEditEventModal({ isOpen: true, originalDate: date, originalType: type, newDate: date, newType: type, records: records, newDateInput: formatDateForDisplay(date) });
  };

  const handleUpdateEvent = async () => {
      if (!editEventModal.newDate || !editEventModal.newType.trim()) return alert("Campos obrigatórios.");
      setIsProcessing(true);
      try {
          const updates = editEventModal.records.map(r => {
              let newPoints = r.status === 'Presente' ? 0 : calculatePoints(editEventModal.newType, settings);
              return {
                  recordId: r.id,
                  memberId: r.memberId,
                  newData: { date: editEventModal.newDate, eventType: editEventModal.newType, points: newPoints },
                  pointsDelta: newPoints - r.points
              };
          });
          await AttendanceService.updateBatch(updates);
          setToast("Evento atualizado!");
          setEditEventModal({ ...editEventModal, isOpen: false });
      } catch (error: any) {
          alert("Erro ao atualizar evento.");
      } finally {
          setIsProcessing(false);
      }
  };

  const requestDeleteEvent = (e: React.MouseEvent, eventRecords: AttendanceRecord[]) => {
      e.stopPropagation();
      setDeleteModal({
          isOpen: true, title: 'Excluir Evento?', description: `Excluir ${eventRecords.length} registros de ${formatDateBR(eventRecords[0]?.date)}.`,
          onConfirm: async () => {
              setIsProcessing(true);
              try {
                  await AttendanceService.deleteBatch(eventRecords.map(r => ({id: r.id, memberId: r.memberId, points: r.points})));
                  setToast("Evento excluído!");
              } catch (err: any) {
                  alert("Erro ao excluir.");
              } finally {
                  setIsProcessing(false);
                  setDeleteModal(prev => ({ ...prev, isOpen: false }));
              }
          }
      });
  };

  const requestDeleteRecord = (e: React.MouseEvent, recordId: string, memberId: string, points: number) => {
      e.stopPropagation();
      setDeleteModal({
          isOpen: true, title: 'Excluir Registro?', description: 'Remover a presença/falta deste membro.',
          onConfirm: async () => {
              setIsProcessing(true);
              try {
                  await AttendanceService.delete(recordId, memberId, points);
                  setToast("Registro excluído!");
              } catch (err: any) {
                  alert("Erro ao excluir.");
              } finally {
                  setIsProcessing(false);
                  setDeleteModal(prev => ({ ...prev, isOpen: false }));
              }
          }
      });
  };

  const chartData = useMemo(() => {
      return eventHistory.slice(0, 5).reverse().map(e => ({
          name: formatDateBR(e.date).substring(0, 5), 
          present: e.records.filter(r => r.status === 'Presente').length,
          absent: e.records.filter(r => r.status === 'Ausente').length,
          fullDate: e.date
      }));
  }, [eventHistory]);

  const selectScheduledEvent = (ev: Rehearsal) => {
      setEventType(ev.topic || 'Ensaio');
      setSelectedEventId(ev.id || '');
      setIsManualEventType(false);
  };

  if (initialLoading) return <Loading />;

  return (
    <div className="space-y-8 animate-fade-in-up pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-20">
        <div>
           <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-[2px] bg-brand-500"></span>
                <p className="text-brand-600 dark:text-brand-400 font-bold uppercase tracking-[0.2em] text-[10px]">Controle Administrativo</p>
           </div>
           <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white leading-[0.9] tracking-tight">
             Registro de <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-sky-500">Frequência</span>
           </h1>
           <p className="text-slate-500 dark:text-slate-400 mt-3 font-medium max-w-md">Gerencie a presença da equipe.</p>
        </div>
        <div className="flex gap-2">
            <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex gap-1 shadow-inner">
                <button onClick={() => setActiveTab('register')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'register' ? 'text-white bg-slate-900 dark:bg-white dark:text-slate-900 shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}><i className="fas fa-clipboard-user mr-2"></i>Chamada</button>
                <button onClick={() => setActiveTab('history')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'history' ? 'text-white bg-slate-900 dark:bg-white dark:text-slate-900 shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}><i className="fas fa-history mr-2"></i>Histórico</button>
            </div>
            {isSuperAdmin && (
                <button onClick={openSettings} className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 text-slate-400 hover:text-brand-500 flex items-center justify-center transition-all border border-slate-200 dark:border-white/5"><i className="fas fa-cog text-xl"></i></button>
            )}
        </div>
      </div>

      {toast && (
          <div className="fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl bg-slate-900/90 text-white shadow-2xl backdrop-blur-md font-bold text-sm flex items-center gap-3 animate-fade-in-right">
              <i className="fas fa-check-circle text-green-400"></i> {toast}
          </div>
      )}

      {activeTab === 'register' && !isSessionActive && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
              <div className="lg:col-span-2 relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 md:p-12 flex flex-col justify-between group border border-white/10 shadow-2xl">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                  <div className="relative z-10">
                      <h2 className="text-3xl md:text-4xl font-display font-bold mb-6 flex items-center gap-3"><span className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl"><i className="fas fa-play text-brand-400"></i></span>Painel de Controle</h2>
                      
                      <div className="space-y-6 max-w-xl mb-10">
                          {/* Date Selector */}
                          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Data do Evento</label>
                              <input type="text" value={dateInput} onChange={handleDateInputChange} placeholder="DD/MM/AAAA" maxLength={10} className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white font-bold outline-none focus:border-brand-500 transition-colors" />
                          </div>

                          {/* Dynamic Event Selector based on Date */}
                          <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-3">Selecione o Evento</label>
                              {eventsForSelectedDate.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                      {eventsForSelectedDate.map(ev => (
                                          <button 
                                            key={ev.id} 
                                            onClick={() => selectScheduledEvent(ev)}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden group ${selectedEventId === ev.id ? 'bg-brand-500 border-brand-500 text-white shadow-lg scale-[1.02]' : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300 hover:border-brand-500/50'}`}
                                          >
                                              <div className="flex justify-between items-start mb-2">
                                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedEventId === ev.id ? 'bg-white/20' : 'bg-black/20'}`}>
                                                      <i className="fas fa-calendar-check text-sm"></i>
                                                  </div>
                                                  {selectedEventId === ev.id && <div className="bg-white text-brand-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Selecionado</div>}
                                              </div>
                                              <div>
                                                  <p className="font-bold text-sm leading-tight mb-1 truncate">{ev.topic || 'Evento Sem Nome'}</p>
                                                  <div className="flex flex-col gap-0.5">
                                                      <p className={`text-[10px] font-bold uppercase ${selectedEventId === ev.id ? 'text-brand-100' : 'text-slate-500'}`}>{ev.time} • {ev.location || 'Sede'}</p>
                                                      {ev.type && <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded w-fit ${selectedEventId === ev.id ? 'bg-white/20 text-white' : 'bg-black/20 text-slate-400'}`}>{ev.type}</span>}
                                                  </div>
                                              </div>
                                          </button>
                                      ))}
                                  </div>
                              ) : (
                                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-slate-400 text-sm italic mb-4 flex items-center gap-3">
                                      <i className="fas fa-info-circle"></i> Nenhum agendamento para hoje. Use a opção manual abaixo.
                                  </div>
                              )}

                              <button 
                                onClick={() => { setSelectedEventId(''); setIsManualEventType(!isManualEventType); setEventType('Missa'); }}
                                className={`text-xs font-bold uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2 ${!selectedEventId || isManualEventType ? 'text-brand-400' : 'text-slate-500'}`}
                              >
                                  <i className={`fas ${isManualEventType ? 'fa-check-square' : 'fa-square'}`}></i> Criar Evento Avulso / Manual
                              </button>

                              {/* Manual Input Fallback */}
                              {(isManualEventType || eventsForSelectedDate.length === 0) && (
                                  <div className="animate-fade-in-up mt-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Tipo do Evento</label>
                                      <div className="relative">
                                          <select value={eventType} onChange={e => setEventType(e.target.value)} className="w-full pl-4 pr-10 py-3 bg-black/20 border border-white/10 rounded-xl text-white font-bold outline-none appearance-none cursor-pointer hover:border-brand-500 transition-colors">
                                              <option className="text-slate-900" value="Missa">Santa Missa</option>
                                              <option className="text-slate-900" value="Ensaio">Ensaio Geral</option>
                                              <option className="text-slate-900" value="Evento">Evento Extra</option>
                                          </select>
                                          <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>

                      <button onClick={handleStartSession} className="w-full sm:w-auto px-10 py-5 bg-brand-600 text-white rounded-2xl font-bold uppercase tracking-widest shadow-lg shadow-brand-500/30 hover:scale-105 hover:bg-brand-500 transition-all flex items-center justify-center gap-3">
                          <span>Iniciar Chamada</span> <i className="fas fa-arrow-right"></i>
                      </button>
                  </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-sm border border-slate-100 dark:border-white/5 min-h-[300px] flex flex-col">
                   <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-6 flex items-center gap-2"><i className="fas fa-chart-line text-brand-500"></i>Tendência de Frequência</h3>
                   <div className="flex-1 min-h-[200px]">
                        {chartData.length > 0 ? (
                           <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#29aae2" stopOpacity={0.3}/><stop offset="95%" stopColor="#29aae2" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="name" hide /><YAxis hide /><Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}} /><Area type="monotone" dataKey="present" stroke="#29aae2" strokeWidth={3} fill="url(#colorPresent)" /></AreaChart></ResponsiveContainer>
                        ) : <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold uppercase flex-col gap-2"><i className="fas fa-chart-bar text-2xl opacity-20"></i>Sem dados recentes</div>}
                   </div>
              </div>
          </div>
      )}
      
      {activeTab === 'register' && isSessionActive && (
          <div className="animate-scale-in space-y-6">
              {/* STICKY HEADER WITH PROGRESS BAR */}
              <div className="sticky top-4 z-40 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-5 rounded-[2.5rem] shadow-2xl flex flex-col gap-5 transition-all">
                   <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                       <div className="flex items-center gap-4 w-full lg:w-auto">
                           <button onClick={() => setIsSessionActive(false)} className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 flex items-center justify-center shadow-sm hover:bg-slate-200 transition-colors"><i className="fas fa-arrow-left"></i></button>
                           <div>
                               <h3 className="font-bold text-xl text-slate-800 dark:text-white leading-none">{eventType}</h3>
                               <p className="text-xs text-brand-600 font-bold uppercase mt-1">{formatDateBR(date)}</p>
                           </div>
                       </div>
                       
                       {/* STATS & PROGRESS BAR */}
                       <div className="flex-1 w-full lg:mx-8">
                           <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">
                               <span>Presentes: <span className="text-brand-600 dark:text-brand-400">{stats.present}</span></span>
                               <span>Ausentes: <span className="text-red-500">{stats.absent}</span></span>
                           </div>
                           <div className="h-4 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden flex">
                               <div className="h-full bg-gradient-to-r from-brand-500 to-purple-600 transition-all duration-500 ease-out relative group" style={{ width: `${progressPercent}%` }}>
                                   <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                               </div>
                               <div className="h-full bg-red-500 transition-all duration-500 ease-out relative group" style={{ width: `${absencePercent}%` }}></div>
                           </div>
                       </div>

                       <div className="flex gap-2 w-full lg:w-auto justify-end">
                           <button onClick={toggleAutoNotify} className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${autoNotify ? 'bg-green-500 text-white shadow-lg' : 'bg-slate-200 dark:bg-white/10 text-slate-400 grayscale'}`} title="Aviso WhatsApp Automático"><i className="fab fa-whatsapp"></i></button>
                           <button onClick={handleResetSession} className="px-4 py-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"><i className="fas fa-eraser"></i></button>
                       </div>
                   </div>
                   
                   {/* Search Bar & Filters */}
                   <div className="flex flex-col md:flex-row gap-4">
                       <div className="relative group flex-1">
                           <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors"></i>
                           <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar membro..." className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-sm font-bold text-slate-700 dark:text-white outline-none focus:border-brand-500 transition-all" />
                       </div>
                       
                       <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                           {/* Status Filters */}
                           {[
                               { id: 'all', label: 'Todos', icon: 'fa-users' },
                               { id: 'pending', label: 'Pendentes', icon: 'fa-hourglass-half' },
                               { id: 'present', label: 'Presentes', icon: 'fa-check' },
                               { id: 'absent', label: 'Ausentes', icon: 'fa-times' }
                           ].map(f => (
                               <button 
                                key={f.id} 
                                onClick={() => setFilterStatus(f.id as any)}
                                className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 whitespace-nowrap transition-all border ${filterStatus === f.id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-transparent hover:bg-white dark:hover:bg-white/10 hover:border-slate-200 dark:hover:border-white/10'}`}
                               >
                                   <i className={`fas ${f.icon}`}></i> {f.label}
                               </button>
                           ))}
                           
                           {/* Divider */}
                           <div className="w-px bg-slate-200 dark:bg-white/10 mx-1"></div>

                           {/* View Toggles */}
                           <button onClick={() => setViewMode('grid')} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-brand-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                               <i className="fas fa-th-large"></i>
                           </button>
                           <button onClick={() => setViewMode('list')} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-brand-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                               <i className="fas fa-list"></i>
                           </button>
                       </div>
                   </div>
              </div>

              <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "flex flex-col gap-3"}>
                  {processedMembers.map(member => {
                      const rec = sessionRecords.find(r => r.memberId.toLowerCase() === member.id.toLowerCase());
                      const status = rec?.status || 'pending';
                      
                      // LOGIC: PENDING JUSTIFICATION BLOCKS ACTION
                      const pendingJustification = justifications.find(j => 
                          j.userId.toLowerCase() === member.id.toLowerCase() && 
                          j.eventDate === date && 
                          j.status === 'PENDING'
                      );
                      const hasPendingJustification = !!pendingJustification;
                      const isJustified = rec?.points === 0 && status === 'Ausente';
                      const userProfile = usersList.find(u => u.username === member.id);

                      // Card Styles
                      let cardBase = `transition-all duration-300 group bg-white dark:bg-slate-800 border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-xl`;
                      if (status === 'Presente') cardBase = 'bg-green-50 dark:bg-green-900/10 border-green-500 shadow-lg';
                      else if (status === 'Ausente' && !isJustified) cardBase = 'bg-red-50 dark:bg-red-900/10 border-red-500 shadow-lg';
                      else if (status === 'Ausente' && isJustified) cardBase = 'bg-blue-50 dark:bg-blue-900/10 border-blue-500 shadow-lg';
                      else if (hasPendingJustification) cardBase = 'bg-amber-50 dark:bg-amber-900/10 border-amber-500 border-dashed shadow-xl';
                      
                      const statusBadgeClass = `text-[10px] font-black uppercase px-2 py-0.5 rounded-md inline-block tracking-wider ${
                          hasPendingJustification ? 'bg-amber-100 text-amber-700' : 
                          status === 'pending' ? 'bg-slate-100 text-slate-500' : 
                          status === 'Presente' ? 'bg-green-100 text-green-700' : 
                          isJustified ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                      }`;

                      if (viewMode === 'list') {
                          return (
                              <div key={member.id} className={`flex items-center justify-between p-3 px-4 rounded-2xl border-2 ${cardBase}`}>
                                  <div className="flex items-center gap-4">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm overflow-hidden shrink-0 border ${status === 'Presente' ? 'bg-green-500 text-white border-green-400' : status === 'Ausente' ? 'bg-red-500 text-white border-red-400' : hasPendingJustification ? 'bg-amber-100 text-amber-600 border-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 border-white dark:border-slate-600'}`}>
                                          {userProfile?.photoURL ? <img src={userProfile.photoURL} alt={member.name} className="w-full h-full object-cover" /> : member.name.charAt(0)}
                                      </div>
                                      <div>
                                          <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate">{member.name}</h4>
                                          <p className={statusBadgeClass}>
                                              {hasPendingJustification ? 'Em Análise' : status === 'pending' ? 'Aguardando' : status === 'Presente' ? 'Presente' : isJustified ? 'Justificado' : 'Falta'}
                                          </p>
                                      </div>
                                  </div>
                                  {isAdmin && (
                                      <div className="flex gap-2">
                                          {hasPendingJustification ? (
                                              <button onClick={() => navigate('/justifications')} className="px-4 py-2 rounded-xl bg-amber-500 text-white font-bold text-[10px] uppercase tracking-wider hover:bg-amber-600 transition-colors shadow-sm"><i className="fas fa-gavel mr-1"></i> Resolver</button>
                                          ) : (
                                              <>
                                                  <button onClick={() => handleAttendance(member.id, member.name, 'Presente')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${status === 'Presente' ? 'bg-green-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-green-500 hover:text-white'}`}><i className="fas fa-check"></i></button>
                                                  <button onClick={() => initiateAbsence(member.id, member.name)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${status === 'Ausente' ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-red-500 hover:text-white'}`}><i className="fas fa-times"></i></button>
                                              </>
                                          )}
                                      </div>
                                  )}
                              </div>
                          );
                      }

                      return (
                          <div key={member.id} className={`p-5 rounded-[2rem] border-2 flex flex-col justify-between ${cardBase}`}>
                              <div className="flex items-center gap-4 mb-5">
                                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shadow-md overflow-hidden shrink-0 border-2 ${status === 'Presente' ? 'bg-green-500 text-white border-green-400' : hasPendingJustification ? 'bg-amber-100 text-amber-600 border-amber-300' : status === 'Ausente' ? 'bg-red-500 text-white border-red-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 border-white dark:border-slate-600'}`}>
                                      {userProfile?.photoURL ? <img src={userProfile.photoURL} alt={member.name} className="w-full h-full object-cover" /> : member.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                      <h4 className="font-bold text-slate-800 dark:text-white truncate text-base leading-tight">{member.name}</h4>
                                      <p className={`${statusBadgeClass} mt-1`}>
                                          {hasPendingJustification ? 'Em Análise' : status === 'pending' ? 'Aguardando' : status === 'Presente' ? 'Presente' : isJustified ? 'Justificado' : 'Falta'}
                                      </p>
                                  </div>
                              </div>
                              {isAdmin && (
                                  <div className="flex gap-3 mt-auto">
                                      {hasPendingJustification ? (
                                          <button onClick={() => navigate('/justifications')} className="w-full py-4 rounded-xl bg-amber-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg hover:bg-amber-600 transition-all flex items-center justify-center gap-2">
                                              <i className="fas fa-gavel"></i> Resolver Pendência
                                          </button>
                                      ) : (
                                          <>
                                              <button onClick={() => handleAttendance(member.id, member.name, 'Presente')} className={`flex-1 py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm ${status === 'Presente' ? 'bg-green-600 text-white shadow-green-500/30 scale-105' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-green-500 hover:text-white'}`}>Presente</button>
                                              <button onClick={() => initiateAbsence(member.id, member.name)} className={`flex-1 py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm ${status === 'Ausente' ? 'bg-red-600 text-white shadow-red-500/30 scale-105' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-red-500 hover:text-white'}`}>Ausente</button>
                                          </>
                                      )}
                                  </div>
                              )}
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {activeTab === 'history' && (
          <div className="space-y-6 animate-fade-in-up">
              {eventHistory.map((event, idx) => {
                  const isExpanded = expandedEvents.has(idx);
                  const presentCount = event.records.filter(r => r.status === 'Presente').length;
                  const month = new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR', {month: 'short'}).replace('.', '');
                  const day = event.date.split('-')[2];

                  return (
                      <div key={idx} className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden group">
                          <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-6 cursor-pointer" onClick={() => { const n = new Set(expandedEvents); if(isExpanded) n.delete(idx); else n.add(idx); setExpandedEvents(n); }}>
                              <div className="flex items-center gap-5 w-full md:w-auto">
                                  <div className="w-20 h-20 rounded-[1.5rem] bg-slate-50 dark:bg-slate-700 flex flex-col items-center justify-center border border-slate-200 text-slate-600 shadow-inner group-hover:scale-105 transition-transform"><span className="text-[10px] font-bold uppercase tracking-widest text-brand-500">{month}</span><span className="text-3xl font-display font-bold leading-none text-slate-800 dark:text-white">{day}</span></div>
                                  <div><h3 className="text-xl font-bold text-slate-800 dark:text-white">{event.type}</h3><p className="text-xs text-slate-400 font-bold uppercase"><i className="fas fa-calendar-day mr-1"></i> {formatDateBR(event.date)}</p></div>
                              </div>
                              <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                                  <div className="text-center"><span className="block text-2xl font-bold text-green-500">{presentCount}</span><span className="text-[9px] font-bold uppercase text-slate-400">Presentes</span></div>
                                  <div className="w-px h-10 bg-slate-100 dark:bg-white/10"></div>
                                  <div className="text-center"><span className="block text-2xl font-bold text-red-400">{event.records.length - presentCount}</span><span className="text-[9px] font-bold uppercase text-slate-400">Ausentes</span></div>
                                  <div className={`w-10 h-10 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center transition-transform ${isExpanded ? 'rotate-180 bg-slate-200' : ''}`}><i className="fas fa-chevron-down"></i></div>
                              </div>
                          </div>
                          
                          {isExpanded && (
                              <div className="border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 p-6 animate-fade-in-up">
                                  {isAdmin && (
                                      <div className="mb-6 flex justify-end gap-2">
                                          <button onClick={(e) => openEditEventModal(e, event.date, event.type, event.records)} className="text-xs font-bold text-brand-500 hover:text-white uppercase tracking-widest px-5 py-3 bg-brand-50 dark:bg-brand-900/10 hover:bg-brand-500 rounded-xl transition-all border border-brand-200 dark:border-brand-900/30">Editar Evento</button>
                                          <button onClick={(e) => requestDeleteEvent(e, event.records)} className="text-xs font-bold text-red-500 hover:text-white uppercase tracking-widest px-5 py-3 bg-red-50 dark:bg-red-900/10 hover:bg-red-500 rounded-xl transition-all border border-red-200 dark:border-red-900/30">Excluir Tudo</button>
                                      </div>
                                  )}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {event.records.map(r => {
                                          const hasPendingJustification = justifications.some(j => j.userId === r.memberId && j.eventDate === event.date && j.status === 'PENDING');
                                          const isJustified = r.points === 0 && r.status === 'Ausente';
                                          const itemStyle = r.status === 'Presente' ? 'bg-green-100 text-green-700' : hasPendingJustification ? 'bg-amber-100 text-amber-700 border-amber-300' : isJustified ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700';

                                          return (
                                              <div key={r.id} className="flex justify-between items-center p-3 px-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm group/row relative overflow-hidden">
                                                  <div className="flex items-center gap-2 truncate">
                                                      <span className="font-bold text-sm text-slate-700 dark:text-slate-300 truncate">{r.memberName}</span>
                                                      {r.points < 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600">{r.points}</span>}
                                                  </div>
                                                  <div className="flex items-center gap-3 shrink-0">
                                                      {isAdmin ? (
                                                          <button onClick={() => handleToggleHistoryStatus(r)} className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all border-2 border-transparent ${itemStyle}`}>
                                                              {r.status === 'Presente' ? 'Presente' : hasPendingJustification ? 'Em Análise' : isJustified ? 'Justificado' : 'Falta'} <i className="fas fa-sync-alt ml-1 opacity-50 group-hover/row:opacity-100 transition-opacity"></i>
                                                          </button>
                                                      ) : (
                                                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${itemStyle}`}>
                                                              {r.status === 'Presente' ? 'Presente' : hasPendingJustification ? 'Em Análise' : isJustified ? 'Justificado' : 'Falta'}
                                                          </span>
                                                      )}
                                                      {isAdmin && <button onClick={(e) => requestDeleteRecord(e, r.id, r.memberId, r.points)} className="text-slate-300 hover:text-red-500 w-6 h-6 flex items-center justify-center transition-colors"><i className="fas fa-times"></i></button>}
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          )}
                      </div>
                  );
              })}
          </div>
      )}

      {/* Edit Event Modal */}
      {editEventModal.isOpen && createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
              <div className="w-full max-w-md bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-white/20 animate-scale-in">
                    <div className="mb-8 text-center"><h2 className="text-2xl font-bold text-slate-800 dark:text-white font-display">Editar Evento</h2><p className="text-slate-500 text-sm">Altere a data ou o tipo para todos os registros.</p></div>
                    <div className="space-y-5">
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Nova Data</label><input type="text" value={editEventModal.newDateInput} onChange={handleModalDateChange} placeholder="DD/MM/AAAA" maxLength={10} className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 font-bold text-slate-700 dark:text-white outline-none focus:border-brand-500" /></div>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Novo Tipo</label><select value={editEventModal.newType} onChange={e => setEditEventModal({...editEventModal, newType: e.target.value})} className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 font-bold text-slate-700 dark:text-white outline-none focus:border-brand-500"><option value="Missa">Santa Missa</option><option value="Ensaio">Ensaio Geral</option><option value="Evento">Evento Extra</option></select></div>
                        <button onClick={handleUpdateEvent} disabled={isProcessing} className="w-full py-4 rounded-xl bg-brand-600 text-white font-bold shadow-lg hover:bg-brand-500 transition-all uppercase text-xs tracking-wider flex items-center justify-center gap-2">{isProcessing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>}Salvar Alterações</button>
                        <button onClick={() => setEditEventModal({...editEventModal, isOpen: false})} className="w-full py-3 text-slate-400 font-bold uppercase text-xs">Cancelar</button>
                    </div>
              </div>
          </div>, document.body
      )}

      {/* Settings Modal */}
      {showSettingsModal && createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
              <div className="w-full max-w-lg bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-white/20 animate-scale-in">
                    <div className="mb-8 text-center"><h2 className="text-2xl font-bold text-slate-800 dark:text-white font-display">Regras de Penalidade</h2><p className="text-slate-500 text-sm">Defina os pontos retirados por infração.</p></div>
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Missa / Celebração</label><input type="number" value={Math.abs(tempSettings.pointsMissa)} onChange={e => setTempSettings({...tempSettings, pointsMissa: -Math.abs(parseInt(e.target.value))})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-center font-bold text-red-500" /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Ensaio</label><input type="number" value={Math.abs(tempSettings.pointsEnsaio)} onChange={e => setTempSettings({...tempSettings, pointsEnsaio: -Math.abs(parseInt(e.target.value))})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-center font-bold text-red-500" /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Falta Geral</label><input type="number" value={Math.abs(tempSettings.pointsGeral)} onChange={e => setTempSettings({...tempSettings, pointsGeral: -Math.abs(parseInt(e.target.value))})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-center font-bold text-red-500" /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Compromisso</label><input type="number" value={Math.abs(tempSettings.pointsCompromisso)} onChange={e => setTempSettings({...tempSettings, pointsCompromisso: -Math.abs(parseInt(e.target.value))})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-center font-bold text-red-500" /></div>
                            <div className="col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Gravíssima</label><input type="number" value={Math.abs(tempSettings.pointsGravissima)} onChange={e => setTempSettings({...tempSettings, pointsGravissima: -Math.abs(parseInt(e.target.value))})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-center font-bold text-red-500" /></div>
                        </div>
                        <button onClick={saveSettings} disabled={isProcessing} className="w-full py-4 rounded-xl bg-brand-600 text-white font-bold shadow-lg hover:bg-brand-500 transition-all uppercase text-xs tracking-wider flex items-center justify-center gap-2">{isProcessing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>}Salvar Regras</button>
                        <button onClick={() => setShowSettingsModal(false)} className="w-full py-3 text-slate-400 font-bold uppercase text-xs">Cancelar</button>
                    </div>
              </div>
          </div>, document.body
      )}

      <DeleteConfirmationModal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))} onConfirm={deleteModal.onConfirm} title={deleteModal.title} description={deleteModal.description} isProcessing={isProcessing} />
    </div>
  );
};

export default Attendance;
