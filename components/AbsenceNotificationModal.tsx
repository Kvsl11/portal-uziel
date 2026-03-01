
import React from 'react';
import { createPortal } from 'react-dom';
import { AttendanceRecord } from '../types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface AbsenceNotificationModalProps {
  isOpen: boolean;
  absences: AttendanceRecord[];
  onClose?: () => void;
}

const AbsenceNotificationModal: React.FC<AbsenceNotificationModalProps> = ({ isOpen, absences, onClose }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  if (!isOpen || absences.length === 0) return null;

  const handleRedirect = () => {
    navigate('/justifications');
  };

  const isDev = currentUser?.role === 'super-admin';

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 overflow-hidden">
      {/* Heavy blur backdrop - Bloqueio de navegação conforme regimento */}
      <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl animate-fade-in"></div>
      
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0f172a] rounded-[2.5rem] p-8 shadow-2xl border-2 border-red-500/30 animate-scale-in flex flex-col overflow-hidden max-h-[95vh]">
        
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-bl-[100px] pointer-events-none"></div>
        
        <div className="flex items-center gap-4 mb-6 shrink-0 border-b border-slate-100 dark:border-white/5 pb-6">
            <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-3xl text-red-500 shadow-sm border border-red-100 dark:border-red-500/20 shrink-0">
                <i className="fas fa-gavel animate-bounce"></i>
            </div>
            <div>
                <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white leading-tight">
                    Ação Obrigatória
                </h3>
                <p className="text-sm text-red-500 dark:text-red-400 font-bold uppercase tracking-wider text-[10px]">
                    Capítulo X — Estatuto Nº 02
                </p>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-6 mb-6">
            {/* Absence List Section */}
            <div className="bg-slate-50 dark:bg-black/40 rounded-3xl p-5 border border-slate-100 dark:border-white/5 shadow-inner">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 ml-1 flex justify-between">
                    <span>Faltas sem Protocolo de Análise</span>
                    <span className="text-red-500">{absences.length} Registro(s)</span>
                </p>
                <div className="space-y-3">
                    {absences.map((rec) => (
                        <div key={rec.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center text-xs font-bold border border-red-200 dark:border-red-800">
                                    {new Date(rec.date + 'T12:00:00').getDate()}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-white group-hover:text-red-500 transition-colors">{rec.eventType}</p>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                                        {new Date(rec.date + 'T12:00:00').toLocaleDateString('pt-BR', {month: 'long'})}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[10px] font-black text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg border border-red-100 dark:border-red-900/30">
                                {rec.points} PTS
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Statute Context Section - UPDATED WITH REAL ARTICLES */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <i className="fas fa-book-bible text-brand-500 text-xs"></i>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Regimento Interno (Vigente em 24/10/24)</p>
                </div>
                
                {/* AVISO DO PRAZO DE 24 HORAS */}
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 flex gap-3 items-start animate-pulse-slow">
                   <i className="fas fa-clock text-blue-600 dark:text-blue-400 mt-1"></i>
                   <div>
                       <p className="text-xs font-bold text-blue-700 dark:text-blue-300">Prazo de Regularização</p>
                       <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 leading-tight">
                           Conforme regimento, as justificativas devem ser enviadas em até <strong>24 horas</strong> após o evento.
                       </p>
                   </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                        <div className="flex gap-3">
                            <i className="fas fa-exclamation-circle text-amber-600 dark:text-amber-400 mt-1"></i>
                            <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                                <p className="font-bold text-amber-700 dark:text-amber-400 mb-1">Capítulo X - Art. 3º (Pontuação Máxima)</p>
                                <p>A pontuação máxima acumulada para que se inicie um processo de exclusão é de <strong className="text-amber-800 dark:text-amber-200">15 pontos</strong> (10 pontos para membros Nóveis).</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-3 ml-1">Penalidades (Art. 3º, § 1º):</p>
                        <ul className="space-y-2.5">
                            <li className="flex justify-between text-[11px] font-medium border-b border-slate-100 dark:border-white/5 pb-2">
                                <span className="text-slate-600 dark:text-slate-400">• Ausência em Missas/Celebrações</span>
                                <span className="font-black text-red-500">5 Pontos</span>
                            </li>
                            <li className="flex justify-between text-[11px] font-medium border-b border-slate-100 dark:border-white/5 pb-2">
                                <span className="text-slate-600 dark:text-slate-400">• Ausência em Ensaios</span>
                                <span className="font-black text-red-500">4 Pontos</span>
                            </li>
                            <li className="flex justify-between text-[11px] font-medium">
                                <span className="text-slate-600 dark:text-slate-400">• Falta de Compromisso (Atrasos)</span>
                                <span className="font-black text-red-500">3 Pontos</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="text-center px-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    Conforme o <strong className="text-slate-900 dark:text-white">Art. 2º do Capítulo XI</strong>, você tem o direito de recorrer, mas deve regularizar as faltas acima para remover as penalidades automáticas.
                </p>
            </div>
        </div>

        <div className="flex flex-col gap-3 shrink-0">
            <button 
                onClick={handleRedirect}
                className="w-full py-5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs uppercase tracking-[0.2em] shadow-2xl shadow-brand-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group"
            >
                <i className="fas fa-paper-plane group-hover:-rotate-12 transition-transform"></i> 
                Regularizar e Justificar
            </button>

            {isDev && (
                <button 
                    onClick={onClose}
                    className="w-full py-3 rounded-xl bg-transparent text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center justify-center gap-2"
                >
                    <i className="fas fa-code"></i> Ignorar Bloqueio (Modo Dev)
                </button>
            )}
        </div>

      </div>
    </div>,
    document.body
  );
};

export default AbsenceNotificationModal;
