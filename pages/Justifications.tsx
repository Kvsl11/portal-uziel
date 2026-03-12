
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { JustificationService, RehearsalService, AttendanceService, AuditService } from '../services/firebase';
import { getApiKey } from '../services/geminiService';
import { GoogleGenAI, Type } from "@google/genai";
import { Rehearsal, AttendanceRecord, Justification, AttendanceSettings } from '../types';
import Loading from '../components/Loading';
import Card from '../components/Card';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';

// --- ICONS & ASSETS ---
const AiScannerIcon = () => (
    <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
        <div className="absolute inset-0 border-2 border-brand-500/20 rounded-full animate-spin" style={{ animationDuration: '3s' }}></div>
        <div className="absolute inset-0 border-2 border-t-brand-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
        <div className="relative z-10 text-brand-500 animate-pulse text-[8px]">
            <i className="fas fa-brain"></i>
        </div>
    </div>
);

const REASONS = [
    { id: 'Trabalho', icon: 'fa-briefcase', label: 'Trabalho', color: 'blue' },
    { id: 'Doença', icon: 'fa-heart-pulse', label: 'Saúde', color: 'red' },
    { id: 'Viagem', icon: 'fa-plane-departure', label: 'Viagem', color: 'indigo' },
    { id: 'Luto', icon: 'fa-ribbon', label: 'Luto', color: 'slate' },
    { id: 'Transporte', icon: 'fa-car-burst', label: 'Transp.', color: 'orange' },
    { id: 'Outros', icon: 'fa-asterisk', label: 'Outros', color: 'emerald' }
];

const Justifications: React.FC = () => {
  const { currentUser, checkPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'create' | 'history' | 'admin'>('create');
  
  // Data
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{ valid: boolean, message: string } | null>(null);
  
  // Notifications
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // Admin Action State
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'>('ALL');
  
  // Decision Modals
  const [reviewModal, setReviewModal] = useState<{
      isOpen: boolean;
      justification: Justification | null;
      action: 'ACCEPTED' | 'REJECTED';
  }>({ isOpen: false, justification: null, action: 'ACCEPTED' });

  const canAdmin = checkPermission('attendance', 'edit'); // Using attendance module for justification review
  const canDelete = checkPermission('attendance', 'delete');

  useEffect(() => {
      const unsubJ = JustificationService.subscribe((data) => setJustifications(data as Justification[]));
      const unsubR = RehearsalService.subscribe((data) => setRehearsals(data as Rehearsal[]));
      const unsubA = AttendanceService.subscribe((data) => setAttendance(data as AttendanceRecord[]));
      const unsubS = AttendanceService.subscribeSettings((s: any) => setSettings(s as AttendanceSettings));

      setLoading(false);
      return () => { unsubJ(); unsubR(); unsubA(); unsubS(); };
  }, []);

  const showNotification = (message: string, type: 'success' | 'error') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 4000);
  };

  const resetForm = () => {
      setSelectedReason('');
      setDescription('');
      setEditingId(null);
      setSelectedEventId('');
      setAiFeedback(null);
  };

  const calculateOriginalPoints = (eventType: string) => {
      if (!settings) return -5;
      const typeLower = eventType.toLowerCase();
      if (typeLower.includes('missa') || typeLower.includes('celebração')) return settings.pointsMissa;
      if (typeLower.includes('ensaio')) return settings.pointsEnsaio;
      if (typeLower.includes('compromisso')) return settings.pointsCompromisso;
      if (typeLower.includes('grave')) return settings.pointsGravissima;
      return settings.pointsGeral;
  };

  const handleEdit = (e: React.MouseEvent | null, just: Justification) => {
      if (e) e.stopPropagation();

      // PERMISSION CHECK: Members cannot edit submitted justifications
      if (!canAdmin) {
          alert("Política de Segurança: Membros não podem editar justificativas enviadas. Caso haja erro, exclua este protocolo e envie um novo.");
          return;
      }

      if (just.status !== 'PENDING') {
          if (!confirm(`Este registro já foi marcado como ${just.status === 'ACCEPTED' ? 'APROVADO' : 'RECUSADO'}. Se você editá-lo, ele voltará para o status "Pendente" para nova análise da coordenação. Deseja prosseguir?`)) return;
      }
      
      setEditingId(just.id!);
      setSelectedReason(just.reason);
      setDescription(just.description);
      
      if (just.eventId) {
          setSelectedEventId(just.eventId);
      } else {
          // Try to find matching attendance record to ensure the ID key matches the list
          const match = attendance.find(a => 
              a.memberId.toLowerCase() === just.userId.toLowerCase() && 
              a.date === just.eventDate &&
              a.status === 'Ausente'
          );
          
          if (match) {
              setSelectedEventId(`missed|${just.eventDate}|${match.eventType}`);
          } else {
              setSelectedEventId(`missed|${just.eventDate}|${just.eventType}`);
          }
      }
      
      setAiFeedback(null);
      setActiveTab('create');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const requestDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeleteModal({ isOpen: true, id });
  };

  const openReviewModal = (e: React.MouseEvent, just: Justification, action: 'ACCEPTED' | 'REJECTED') => {
      e.stopPropagation();
      setReviewModal({ isOpen: true, justification: just, action });
  };

  const validateJustificationWithAI = async (reason: string, text: string): Promise<{ valid: boolean, message: string }> => {
      
      const systemInstruction = `
      Você é um auditor neural de justificativas do Ministério Uziel.
      Sua missão é garantir que os membros forneçam explicações detalhadas e honestas.
      
      CRITÉRIOS DE BLOQUEIO (valid = false):
      - Texto vago ou genérico (ex: "trabalhei", "não deu", "imprevisto", "saúde").
      - Menos de 15 caracteres.
      - Descrições que não explicam o contexto do impedimento.
      - Tom sarcástico ou desrespeitoso.
      
      IMPORTANTE: Caso bloqueie, explique o porquê de forma curta e firme no campo "message", dizendo como o membro pode melhorar o relato.
      
      RETORNE APENAS JSON: { "valid": boolean, "message": "Feedback técnico em português" }
      `;

      try {
          const freshAi = new GoogleGenAI({ apiKey: getApiKey() });
          const response = await freshAi.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: `Motivo: ${reason}. Relato: "${text}"`,
              config: {
                  systemInstruction,
                  responseMimeType: "application/json",
                  responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                          valid: { type: Type.BOOLEAN },
                          message: { type: Type.STRING }
                      },
                      required: ["valid", "message"]
                  }
              }
          });

          const result = JSON.parse(response.text || '{"valid":false, "message":"Falha na análise neural."}');
          return result;
      } catch (e) {
          if (text.trim().length < 15) return { valid: false, message: "O relato está curto demais. Detalhe melhor o ocorrido para validar sua justificativa." };
          return { valid: true, message: "Validado localmente." };
      }
  };

  const confirmDelete = async () => {
      if (!deleteModal.id) return;
      const justToDelete = justifications.find(j => j.id === deleteModal.id);
      
      try {
          setIsSubmitting(true);
          if (justToDelete && justToDelete.status === 'ACCEPTED') {
              const targetUserId = justToDelete.userId.toLowerCase().trim();
              const match = attendance.find(a => 
                  a.memberId.toLowerCase().trim() === targetUserId && 
                  a.date === justToDelete.eventDate && 
                  a.status === 'Ausente'
              );

              if (match) {
                  const originalPenalty = calculateOriginalPoints(justToDelete.eventType);
                  await AttendanceService.updateBatch([{
                      recordId: match.id,
                      memberId: match.memberId,
                      newData: { 
                          points: originalPenalty, 
                          justification: 'Protocolo excluído. Penalidade restaurada.' 
                      },
                      pointsDelta: originalPenalty - match.points
                  }]);
              }
          }
          await JustificationService.delete(deleteModal.id);
          showNotification("Justificativa excluída com sucesso.", 'success');
          setDeleteModal({ isOpen: false, id: null });
      } catch (e) {
          showNotification("Erro ao excluir registro.", 'error');
      } finally {
          setIsSubmitting(false);
      }
  };

  const processSubmit = async () => {
      setIsSubmitting(true);
      setIsValidating(true);
      setAiFeedback(null);

      try {
          const validation = await validateJustificationWithAI(selectedReason, description);
          
          if (!validation.valid) {
              setAiFeedback(validation);
              setIsValidating(false);
              setIsSubmitting(false);
              const element = document.getElementById('ai-feedback-box');
              element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              return;
          }

          setIsValidating(false);
          let eventDate = '';
          let eventType = '';
          
          if (selectedEventId.startsWith('missed|')) {
              const parts = selectedEventId.split('|');
              eventDate = parts[1];
              eventType = parts[2];
          } else {
              const reh = rehearsals.find(r => r.id === selectedEventId);
              if (reh) {
                  eventDate = reh.date;
                  eventType = `Ensaio: ${reh.topic}`;
              }
          }

          const originalJust = editingId ? justifications.find(j => j.id === editingId) : null;
          
          if (originalJust && originalJust.status === 'ACCEPTED') {
              const targetUserId = originalJust.userId.toLowerCase().trim();
              const match = attendance.find(a => a.memberId.toLowerCase().trim() === targetUserId && a.date === originalJust.eventDate && a.status === 'Ausente');
              if (match) {
                  const originalPenalty = calculateOriginalPoints(originalJust.eventType);
                  await AttendanceService.updateBatch([{
                      recordId: match.id,
                      memberId: match.memberId,
                      newData: { points: originalPenalty, justification: 'Relato em re-análise...' },
                      pointsDelta: originalPenalty - match.points
                  }]);
              }
          }

          const payload: any = {
              userId: originalJust ? originalJust.userId : currentUser?.username,
              userName: originalJust ? originalJust.userName : currentUser?.name,
              eventId: selectedEventId.startsWith('missed|') ? null : selectedEventId,
              eventDate,
              eventType,
              reason: selectedReason,
              description,
              status: 'PENDING',
              createdAt: originalJust ? originalJust.createdAt : new Date().toISOString()
          };

          await JustificationService.submit(payload, editingId || undefined);
          await AuditService.log(currentUser?.username || 'unknown', 'Attendance', editingId ? 'UPDATE' : 'CREATE', `Enviou relato: ${eventType}`, currentUser?.role, currentUser?.name);

          showNotification("Justificativa validada e enviada com sucesso!", 'success');
          resetForm();
          setActiveTab('history');
      } catch (e) {
          showNotification("Erro ao enviar. Tente novamente.", 'error');
      } finally {
          setIsSubmitting(false);
          setIsValidating(false);
      }
  };

  const handleSubmit = () => {
      if (!selectedEventId) return alert("Selecione o evento.");
      if (!selectedReason) return alert("Selecione o motivo.");
      if (!description || description.trim().length < 10) return alert("O relato deve ser detalhado (mínimo 10 caracteres).");
      processSubmit();
  };

  const confirmReviewAction = async () => {
      const { justification: just, action } = reviewModal;
      if (!just || !just.id) return;

      setIsSubmitting(true);
      try {
          await JustificationService.review(just.id, action);
          const targetUserId = just.userId.toLowerCase().trim();
          const match = attendance.find(a => a.memberId.toLowerCase().trim() === targetUserId && a.date === just.eventDate && a.status === 'Ausente');

          if (match) {
              if (action === 'ACCEPTED') {
                  await AttendanceService.updateBatch([{
                      recordId: match.id,
                      memberId: match.memberId,
                      newData: { points: 0, justification: `Acatado: ${just.reason}` },
                      pointsDelta: -match.points
                  }]);
              } else if (action === 'REJECTED') {
                  const originalPenalty = calculateOriginalPoints(just.eventType);
                  await AttendanceService.updateBatch([{
                      recordId: match.id,
                      memberId: match.memberId,
                      newData: { points: originalPenalty, justification: `Recusado pela coordenação` },
                      pointsDelta: originalPenalty - match.points
                  }]);
              }
          }
          
          showNotification(
              action === 'ACCEPTED' ? "Justificativa APROVADA com sucesso!" : "Justificativa RECUSADA. Pontos mantidos.",
              action === 'ACCEPTED' ? 'success' : 'error'
          );
          
          setReviewModal({ isOpen: false, justification: null, action: 'ACCEPTED' });
      } catch (e) {
          showNotification("Erro ao processar a ação.", 'error');
      } finally {
          setIsSubmitting(false);
      }
  };

  // --- TARGET USER RESOLUTION (CRITICAL FIX FOR ADMIN EDITING) ---
  const targetUserId = useMemo(() => {
      if (editingId) {
          const j = justifications.find(x => x.id === editingId);
          return j ? j.userId : currentUser?.username;
      }
      return currentUser?.username;
  }, [editingId, justifications, currentUser]);

  const myJustifications = useMemo(() => {
    return justifications.filter(j => j.userId === currentUser?.username);
  }, [justifications, currentUser]);

  const myMissedRecords = useMemo(() => {
      if (!targetUserId) return [];
      
      const editingJustification = editingId ? justifications.find(j => j.id === editingId) : null;

      return attendance.filter(a => {
          // 1. Filtrar registros do USUÁRIO ALVO (seja o próprio ou quem o Admin está editando)
          if (a.memberId.toLowerCase() !== targetUserId.toLowerCase()) return false;
          
          // CRITICAL: Se este registro corresponde ao que estamos editando agora, mostre-o sempre!
          // Isso permite editar justificativas aprovadas (pontos=0) ou recusadas.
          if (editingJustification && a.date === editingJustification.eventDate && a.status === 'Ausente') {
              return true; 
          }

          if (a.status !== 'Ausente') return false;
          if (a.points === 0) return false; // Hide resolved/justified absences normally

          // 2. Verificar se já existe uma justificativa RESOLVIDA
          const resolvedJustification = justifications.find(j => 
              j.userId.toLowerCase() === targetUserId.toLowerCase() && 
              j.eventDate === a.date && 
              (j.status === 'ACCEPTED' || j.status === 'REJECTED')
          );

          if (resolvedJustification && resolvedJustification.id !== editingId) return false;

          return true;
      }).sort((a,b) => b.date.localeCompare(a.date));
  }, [attendance, targetUserId, justifications, editingId]);

  const upcomingRehearsals = useMemo(() => {
      if (!currentUser || !targetUserId) return [];
      const today = new Date();
      today.setHours(0,0,0,0);
      
      return rehearsals.filter(r => {
          const isUpcoming = new Date(r.date + 'T12:00:00') >= today;
          // Check participation for the TARGET USER, not necessarily the logged admin
          const isParticipant = r.participants?.includes(targetUserId);
          
          if (!isUpcoming || !isParticipant) return false;

          const resolvedJustification = justifications.find(j => 
              j.userId.toLowerCase() === targetUserId.toLowerCase() && 
              j.eventId === r.id && 
              (j.status === 'ACCEPTED' || j.status === 'REJECTED')
          );

          if (resolvedJustification && resolvedJustification.id !== editingId) return false;

          return true;
      });
  }, [rehearsals, currentUser, justifications, targetUserId, editingId]);

  const adminFilteredJustifications = useMemo(() => {
      let list = justifications;
      if (filterStatus !== 'ALL') list = list.filter(j => j.status === filterStatus);
      return list.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [justifications, filterStatus]);

  if (loading) return <Loading fullScreen />;

  return (
    <div className="space-y-8 animate-fade-in-up pb-32">
        {/* --- NOTIFICATION TOAST --- */}
        {notification && (
            <div className={`fixed top-6 right-6 z-[11000] px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-md border flex items-center gap-3 animate-fade-in-right ${notification.type === 'success' ? 'bg-green-500/90 text-white border-green-400' : 'bg-red-500/90 text-white border-red-400'}`}>
                <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} text-xl`}></i>
                <span className="font-bold text-sm">{notification.message}</span>
            </div>
        )}

        {/* --- HEADER --- */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-slate-100 dark:border-white/5 pb-8 relative z-10">
            <div>
               <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-[2px] bg-brand-500"></span>
                    <p className="text-brand-600 dark:text-brand-400 font-bold uppercase tracking-[0.2em] text-[10px]">Portal de Regularização</p>
               </div>
               <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white leading-[0.9] tracking-tight">
                  Gestão de <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-brand-500">Justificativas</span>
               </h1>
               <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Regularize suas faltas ou comunique ausências futuras.</p>
            </div>
            
            <div className={`bg-white dark:bg-slate-800 p-1.5 rounded-[1.5rem] grid ${canAdmin ? 'grid-cols-3' : 'grid-cols-2'} lg:flex gap-1 shadow-premium border border-slate-100 dark:border-white/5 w-full lg:w-auto`}>
                 <button onClick={() => { resetForm(); setActiveTab('create'); }} className={`px-2 md:px-6 py-3 rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${activeTab === 'create' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                     <i className="fas fa-plus-circle"></i> <span className="truncate">Nova</span>
                 </button>
                 <button onClick={() => { resetForm(); setActiveTab('history'); }} className={`px-2 md:px-6 py-3 rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                     <i className="fas fa-history"></i> <span className="truncate">Minhas</span>
                 </button>
                 {canAdmin && (
                    <button onClick={() => { resetForm(); setActiveTab('admin'); }} className={`px-2 md:px-6 py-3 rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${activeTab === 'admin' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                        <i className="fas fa-gavel"></i>
                        <span className="truncate">Análise</span>
                        {justifications.filter(j => j.status === 'PENDING').length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-white text-red-500 rounded-full text-[9px] font-black">{justifications.filter(j => j.status === 'PENDING').length}</span>}
                    </button>
                 )}
            </div>
        </div>

        {/* --- CREATE TAB --- */}
        <AnimatePresence mode="wait">
        {activeTab === 'create' && (
            <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -10}} className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* LEFT: FORM AREA */}
                <div className="xl:col-span-2 space-y-8">
                    
                    {/* 1. SELEÇÃO DE EVENTO (ALERTAS) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center text-[10px]">1</span>
                                Selecione o Evento
                            </h3>
                            {myMissedRecords.length > 0 && <span className="text-[9px] font-bold text-red-500 uppercase tracking-wide animate-pulse">Ação Necessária</span>}
                        </div>

                        {/* LISTA DE FALTAS (PRIORIDADE) */}
                        {myMissedRecords.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {myMissedRecords.map(ev => {
                                    const eventKey = `missed|${ev.date}|${ev.eventType}`;
                                    const isSelected = selectedEventId === eventKey;
                                    const dateObj = new Date(ev.date + 'T12:00:00');
                                    
                                    // Robust Check: Is there ANY Pending justification for this date?
                                    // Use targetUserId to check the correct user's pending status
                                    const isPending = justifications.some(j => 
                                        j.userId.toLowerCase() === targetUserId?.toLowerCase() && 
                                        j.eventDate === ev.date && 
                                        j.status === 'PENDING' &&
                                        j.id !== editingId // Allow selection if editing
                                    );

                                    return (
                                        <button 
                                            key={ev.id}
                                            onClick={() => !isPending && setSelectedEventId(isSelected ? '' : eventKey)}
                                            disabled={isPending}
                                            className={`relative p-5 rounded-[2rem] text-left transition-all duration-300 group overflow-hidden flex flex-col justify-between min-h-[120px] 
                                                ${isPending 
                                                    ? 'bg-slate-50 dark:bg-white/5 border-2 border-dashed border-amber-300 dark:border-amber-700 opacity-80 cursor-not-allowed grayscale-[0.5]' 
                                                    : isSelected 
                                                        ? 'bg-red-500 text-white shadow-xl scale-[1.02] ring-4 ring-red-500/20' 
                                                        : 'bg-white dark:bg-slate-800 border-2 border-red-100 dark:border-red-900/30 hover:border-red-400'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start w-full mb-2">
                                                <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest 
                                                    ${isPending 
                                                        ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' 
                                                        : isSelected 
                                                            ? 'bg-white/20 text-white' 
                                                            : 'bg-red-50 dark:bg-red-900/20 text-red-500'
                                                    }`}>
                                                    {isPending ? 'Em Análise' : 'Falta Registrada'}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {isPending ? <i className="fas fa-hourglass-half text-amber-500 text-sm animate-pulse"></i> : <i className="fas fa-exclamation-circle text-sm animate-pulse"></i>}
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className={`font-bold text-base leading-tight mb-1 ${isSelected && !isPending ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{ev.eventType}</h4>
                                                <p className={`text-[10px] font-bold uppercase tracking-wider ${isSelected && !isPending ? 'text-white/80' : 'text-slate-400'}`}>{dateObj.toLocaleDateString('pt-BR', {weekday: 'long', day:'numeric', month: 'long'})}</p>
                                                {isPending && <p className="text-[9px] text-amber-500 font-bold mt-1 uppercase tracking-wide">Protocolo de antecedência detectado</p>}
                                            </div>
                                            {isSelected && !isPending && <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/20 rounded-full blur-xl"></div>}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-6 rounded-[2rem] bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 flex items-center gap-4">
                                <div className="w-12 h-12 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg shrink-0"><i className="fas fa-check text-xl"></i></div>
                                <div>
                                    <p className="text-green-800 dark:text-green-300 font-bold text-sm">Sem pendências!</p>
                                    <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">Nenhuma falta não justificada encontrada.</p>
                                </div>
                            </div>
                        )}

                        {/* LISTA DE FUTUROS (SECUNDÁRIO) */}
                        {upcomingRehearsals.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Eventos Futuros (Antecipar)</p>
                                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                                    {upcomingRehearsals.map(r => {
                                        const isSelected = selectedEventId === r.id;
                                        const dateObj = new Date(r.date + 'T12:00:00');
                                        
                                        // Check pending status by EventID OR Date match
                                        const isPending = justifications.some(j => 
                                            j.userId.toLowerCase() === targetUserId?.toLowerCase() && 
                                            (j.eventId === r.id || j.eventDate === r.date) && 
                                            j.status === 'PENDING' &&
                                            j.id !== editingId // Allow selection if editing
                                        );

                                        return (
                                            <button 
                                                key={r.id} 
                                                onClick={() => !isPending && setSelectedEventId(isSelected ? '' : r.id!)} 
                                                disabled={isPending}
                                                className={`flex-shrink-0 w-48 p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden
                                                    ${isPending 
                                                        ? 'bg-slate-50 dark:bg-white/5 border-dashed border-amber-300 dark:border-amber-700 opacity-70 cursor-not-allowed' 
                                                        : isSelected 
                                                            ? 'bg-brand-600 border-brand-600 text-white shadow-lg' 
                                                            : 'bg-slate-50 dark:bg-white/5 border-transparent hover:bg-white dark:hover:bg-white/10 hover:border-slate-200'
                                                    }`}
                                            >
                                                {isPending && (
                                                    <div className="absolute top-2 right-2 text-amber-500">
                                                        <i className="fas fa-lock text-xs"></i>
                                                    </div>
                                                )}
                                                <span className={`block text-[9px] font-bold uppercase mb-1 ${isSelected && !isPending ? 'text-white/70' : 'text-slate-400'}`}>
                                                    {dateObj.toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})} • {r.time}
                                                </span>
                                                <span className={`block font-bold text-xs truncate ${isSelected && !isPending ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {isPending ? "Em Análise..." : r.topic}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. MOTIVO E RELATO */}
                    <div className={`transition-all duration-500 ${!selectedEventId ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-100 dark:border-white/5">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                                <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center text-[10px]">2</span>
                                {editingId ? 'Editando Justificativa' : 'Detalhes da Ausência'}
                            </h3>

                            {/* GRID DE MOTIVOS */}
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
                                {REASONS.map(r => (
                                    <button 
                                        key={r.id} 
                                        onClick={() => setSelectedReason(r.id)} 
                                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all aspect-square ${selectedReason === r.id ? `bg-${r.color}-50 dark:bg-${r.color}-900/20 border-${r.color}-500 text-${r.color}-600 dark:text-${r.color}-400 shadow-md scale-105` : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-400 hover:bg-white dark:hover:bg-white/10 hover:border-slate-200'}`}
                                    >
                                        <i className={`fas ${r.icon} text-lg mb-1`}></i>
                                        <span className="text-[9px] font-bold uppercase tracking-wide">{r.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* ÁREA DE TEXTO COM IA */}
                            <div className="relative group">
                                <div className="absolute -top-3 left-4 bg-white dark:bg-slate-800 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest z-10 flex items-center gap-2">
                                    <span>Relato Obrigatório</span>
                                    <span className={`w-1.5 h-1.5 rounded-full ${description.length >= 15 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                </div>
                                <textarea 
                                    value={description} 
                                    onChange={e => { setDescription(e.target.value); if(aiFeedback) setAiFeedback(null); }} 
                                    className={`w-full p-6 rounded-[2rem] bg-slate-50 dark:bg-black/20 border-2 outline-none text-sm font-medium leading-relaxed min-h-[160px] resize-none transition-all ${aiFeedback ? 'border-red-500 ring-4 ring-red-500/10' : 'border-slate-200 dark:border-white/5 focus:border-brand-500 focus:bg-white dark:focus:bg-black/40'}`}
                                    placeholder="Descreva o motivo com detalhes. A IA analisará a consistência do seu relato..."
                                ></textarea>
                                
                                {/* AI Feedback Overlay */}
                                {aiFeedback && !aiFeedback.valid && (
                                    <div id="ai-feedback-box" className="absolute bottom-4 left-4 right-4 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-500/30 p-4 rounded-xl flex items-start gap-3 animate-scale-in shadow-lg backdrop-blur-md">
                                        <div className="bg-red-500 text-white w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"><i className="fas fa-robot"></i></div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase text-red-600 dark:text-red-300 tracking-widest mb-0.5">Análise Neural</p>
                                            <p className="text-xs font-bold text-red-800 dark:text-red-100 leading-snug">{aiFeedback.message}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-4 mt-8">
                                <button onClick={resetForm} className="px-6 py-4 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Cancelar</button>
                                <button 
                                    onClick={handleSubmit} 
                                    disabled={isSubmitting || !selectedEventId || isValidating} 
                                    className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:scale-100"
                                >
                                    {isValidating ? <><AiScannerIcon /> Validando...</> : isSubmitting ? <><i className="fas fa-circle-notch fa-spin"></i> Enviando...</> : <><i className="fas fa-paper-plane"></i> {editingId ? 'Atualizar' : 'Enviar'}</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: INFO & STATUTES */}
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-brand-600 rounded-[2.5rem] p-8 text-white shadow-premium relative overflow-hidden group">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl mb-4 border border-white/20 shadow-lg">
                                <i className="fas fa-balance-scale"></i>
                            </div>
                            <h3 className="text-2xl font-display font-bold mb-2">Regras de Ausência</h3>
                            <p className="text-brand-100 text-sm font-medium leading-relaxed mb-6">
                                Conforme o Estatuto Nº 02, todas as faltas geram penalidade automática até que sejam justificadas e acatadas.
                            </p>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-xs font-bold border-b border-white/20 pb-2">
                                    <span>Missa / Celebração</span>
                                    <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">-5 Pts</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold border-b border-white/20 pb-2">
                                    <span>Ensaio Geral</span>
                                    <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">-4 Pts</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span>Atrasos</span>
                                    <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">-3 Pts</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 rounded-[2.5rem] bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest ml-1"><i className="fas fa-clock mr-1"></i> Prazos</h4>
                        <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-6">
                            <div className="relative">
                                <div className="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-slate-800"></div>
                                <p className="text-xs font-bold text-slate-700 dark:text-white">Evento Ocorre</p>
                                <p className="text-[10px] text-slate-400">Data e Hora marcada</p>
                            </div>
                            <div className="relative">
                                <div className="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-slate-800 animate-pulse"></div>
                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400">Prazo de 24h</p>
                                <p className="text-[10px] text-slate-400">Envio da justificativa no portal</p>
                            </div>
                            <div className="relative">
                                <div className="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-slate-800"></div>
                                <p className="text-xs font-bold text-slate-700 dark:text-white">Análise da Coordenação</p>
                                <p className="text-[10px] text-slate-400">Retirada ou manutenção dos pontos</p>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        )}
        </AnimatePresence>

        {/* --- HISTORY TAB --- */}
        {activeTab === 'history' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-4 md:ml-8 space-y-8 pl-8 md:pl-10 py-4">
                    {myJustifications.length > 0 ? myJustifications.sort((a,b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()).map(j => {
                        const dateObj = new Date(j.eventDate + 'T12:00:00');
                        const statusColor = j.status === 'ACCEPTED' ? 'green' : j.status === 'REJECTED' ? 'red' : 'amber';
                        
                        return (
                            <div key={j.id} className="relative group">
                                <div className={`absolute -left-[43px] md:-left-[51px] top-0 w-5 h-5 rounded-full border-4 border-white dark:border-slate-900 bg-${statusColor}-500 shadow-md z-10`}></div>
                                
                                <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-white/5 relative overflow-hidden transition-all hover:shadow-lg">
                                    <div className={`absolute top-0 right-0 px-4 py-2 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest bg-${statusColor}-100 text-${statusColor}-700 dark:bg-${statusColor}-900/30 dark:text-${statusColor}-400`}>
                                        {j.status === 'PENDING' ? 'Em Análise' : j.status === 'ACCEPTED' ? 'Aprovado' : 'Recusado'}
                                    </div>

                                    <div className="mb-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{dateObj.toLocaleDateString('pt-BR')}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{j.eventType}</span>
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                            {j.reason}
                                        </h4>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-100 dark:border-white/5 mb-4">
                                        <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">"{j.description}"</p>
                                    </div>

                                    {j.adminNotes && (
                                        <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-100 dark:bg-white/5">
                                            <i className="fas fa-comment-dots text-slate-400 mt-0.5"></i>
                                            <div>
                                                <p className="text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-0.5">Resposta da Coordenação</p>
                                                <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{j.adminNotes}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {canAdmin && (
                                            <button onClick={(e) => handleEdit(e, j)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-brand-500 text-xs font-bold uppercase tracking-wider transition-colors"><i className="fas fa-pen mr-2"></i> Editar</button>
                                        )}
                                        <button onClick={(e) => requestDelete(e, j.id!)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-red-500 text-xs font-bold uppercase tracking-wider transition-colors"><i className="fas fa-trash mr-2"></i> Excluir</button>
                                    </div>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="text-center py-20 opacity-50">
                            <i className="fas fa-history text-4xl text-slate-300 mb-4"></i>
                            <p className="font-bold text-slate-500 uppercase tracking-widest">Histórico Vazio</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* --- ADMIN TAB --- */}
        {activeTab === 'admin' && canAdmin && (
            <div className="space-y-8 animate-fade-in">
                {/* Admin Filters */}
                <div className="flex justify-center mb-8">
                    <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl grid grid-cols-2 sm:flex sm:gap-1 shadow-inner w-full sm:w-auto">
                        {['ALL', 'PENDING', 'ACCEPTED', 'REJECTED'].map(s => (
                            <button 
                                key={s} 
                                onClick={() => setFilterStatus(s as any)} 
                                className={`px-2 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all ${filterStatus === s ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {s === 'ALL' ? 'Todos' : s === 'PENDING' ? 'Pendentes' : s === 'ACCEPTED' ? 'Aprovados' : 'Recusados'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {adminFilteredJustifications.map(j => (
                        <div key={j.id} className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-sm border border-slate-100 dark:border-white/5 relative group flex flex-col h-full hover:shadow-xl transition-all">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-lg font-bold text-slate-500 shadow-sm shrink-0">
                                    {j.userName.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-slate-800 dark:text-white truncate">{j.userName}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{new Date(j.createdAt).toLocaleDateString('pt-BR')}</p>
                                </div>
                                <span className={`ml-auto px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${j.status === 'PENDING' ? 'bg-amber-100 text-amber-600' : j.status === 'ACCEPTED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                    {j.status === 'PENDING' ? 'Análise' : j.status === 'ACCEPTED' ? 'OK' : 'Negado'}
                                </span>
                            </div>

                            <div className="mb-4">
                                <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500 text-[9px] font-bold uppercase mb-2">{j.reason}</span>
                                <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-100 dark:border-white/5 h-24 overflow-y-auto custom-scrollbar">
                                    <p className="text-xs text-slate-600 dark:text-slate-300 italic">"{j.description}"</p>
                                </div>
                            </div>

                            <div className="mt-auto border-t border-slate-100 dark:border-white/5 pt-4 flex gap-2">
                                {j.status === 'PENDING' ? (
                                    <>
                                        <button onClick={(e) => openReviewModal(e, j, 'ACCEPTED')} className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-green-600 shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2"><i className="fas fa-check"></i> Acatar</button>
                                        <button onClick={(e) => openReviewModal(e, j, 'REJECTED')} className="flex-1 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 font-bold text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2"><i className="fas fa-times"></i> Recusar</button>
                                    </>
                                ) : (
                                    <div className="flex gap-2 w-full">
                                        <button onClick={(e) => handleEdit(e, j)} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-brand-500 font-bold text-[10px] uppercase tracking-widest transition-all"><i className="fas fa-pen mr-2"></i> Editar</button>
                                        <button onClick={(e) => requestDelete(e, j.id!)} className="w-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 transition-all"><i className="fas fa-trash"></i></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {reviewModal.isOpen && createPortal(
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in" onClick={() => setReviewModal(prev => ({...prev, isOpen: false}))}>
                <div className="bg-white dark:bg-[#0f172a] w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-white/10 animate-scale-in" onClick={e => e.stopPropagation()}>
                    <div className={`w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center text-4xl shadow-inner ${reviewModal.action === 'ACCEPTED' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                        <i className={`fas ${reviewModal.action === 'ACCEPTED' ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                    </div>
                    <h3 className="text-2xl font-display font-bold text-slate-800 dark:text-white text-center mb-2">{reviewModal.action === 'ACCEPTED' ? 'Aprovar Justificativa?' : 'Recusar Justificativa?'}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-8 leading-relaxed font-medium">
                        {reviewModal.action === 'ACCEPTED' ? "Os pontos negativos serão removidos do perfil do membro." : "A penalidade será mantida no registro de presença."}
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => setReviewModal(prev => ({...prev, isOpen: false}))} className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-widest hover:bg-slate-200">Cancelar</button>
                        <button onClick={confirmReviewAction} disabled={isSubmitting} className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest text-white shadow-lg ${reviewModal.action === 'ACCEPTED' ? 'bg-green-600 hover:bg-green-500 shadow-green-500/20' : 'bg-red-600 hover:bg-red-500 shadow-red-500/20'}`}>{isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : 'Confirmar'}</button>
                    </div>
                </div>
            </div>,
            document.body
        )}

        <DeleteConfirmationModal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({isOpen: false, id: null})} onConfirm={confirmDelete} title="Excluir Registro?" description="Esta ação é permanente." isProcessing={isSubmitting} />
    </div>
  );
};

export default Justifications;
