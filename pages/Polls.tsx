
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PollService, AuditService } from '../services/firebase';
import { Poll } from '../types';
import Loading from '../components/Loading';
import Card from '../components/Card';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

const Polls: React.FC = () => {
  const { currentUser, checkPermission } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'closed' | 'create'>('active');

  // Create Form State
  const [newPoll, setNewPoll] = useState({ title: '', description: '', options: ['', ''], deadline: '' });
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Modal
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

  const canCreate = checkPermission('polls', 'create');
  const canEdit = checkPermission('polls', 'edit');
  const canDelete = checkPermission('polls', 'delete');

  useEffect(() => {
      const unsub = PollService.subscribe((data) => {
          setPolls(data as Poll[]);
          setLoading(false);
      });
      return () => unsub();
  }, []);

  const handleCreate = async () => {
      if (!newPoll.title || !newPoll.deadline || newPoll.options.some(o => !o.trim())) {
          return alert("Preencha todos os campos e opções.");
      }
      setIsSubmitting(true);
      try {
          await PollService.create({
              ...newPoll,
              createdBy: currentUser?.username
          });
          if (currentUser) {
              await AuditService.log(currentUser.username, 'Polls', 'CREATE', `Criou enquete: ${newPoll.title}`, currentUser.role);
          }
          setNewPoll({ title: '', description: '', options: ['', ''], deadline: '' });
          setDeadlineDate('');
          setDeadlineTime('');
          setActiveTab('active');
      } catch (e) {
          alert("Erro ao criar.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleDeadlineDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    if (value.length >= 5) {
      value = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
    } else if (value.length >= 3) {
      value = `${value.slice(0, 2)}/${value.slice(2)}`;
    }
    setDeadlineDate(value);
    updateDeadline(value, deadlineTime);
  };

  const handleDeadlineTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 3) {
      value = `${value.slice(0, 2)}:${value.slice(2)}`;
    }
    setDeadlineTime(value);
    updateDeadline(deadlineDate, value);
  };

  const updateDeadline = (d: string, t: string) => {
      if (d.length === 10 && t.length === 5) {
          const [day, month, year] = d.split('/');
          const iso = `${year}-${month}-${day}T${t}`;
          setNewPoll(prev => ({ ...prev, deadline: iso }));
      } else {
          setNewPoll(prev => ({ ...prev, deadline: '' }));
      }
  };

  const handleVote = async (pollId: string, optionIndex: number, optionLabel: string) => {
      if (!currentUser) return;
      if (!confirm(`Confirmar voto em "${optionLabel}"? Esta ação não pode ser desfeita.`)) return;

      try {
          await PollService.vote(pollId, currentUser.username, currentUser.name, optionIndex);
          
          // Generate WhatsApp Link for confirmation
          const msg = `Olá! Confirmo meu voto na enquete "${polls.find(p=>p.id===pollId)?.title}": *${optionLabel}* ✅`;
          const waLink = `https://wa.me/?text=${encodeURIComponent(msg)}`;
          
          if(confirm("Voto registrado! Deseja confirmar no grupo do WhatsApp agora?")) {
              window.open(waLink, '_blank');
          }

      } catch (e: any) {
          alert(e.message);
      }
  };

  const handleClosePoll = async (id: string) => {
      if (confirm("Encerrar votação?")) {
          await PollService.close(id);
      }
  };

  const activePolls = polls.filter(p => p.status === 'OPEN');
  const closedPolls = polls.filter(p => p.status === 'CLOSED');

  if (loading) return <Loading fullScreen />;

  return (
    <div className="space-y-8 animate-fade-in-up pb-32">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-100 dark:border-white/5 pb-8">
            <div>
               <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-[2px] bg-brand-500"></span>
                    <p className="text-brand-600 dark:text-brand-400 font-bold uppercase tracking-[0.2em] text-[10px]">Democracia & Decisões</p>
               </div>
               <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white leading-[0.9] tracking-tight">
                  Enquetes <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-purple-500">Oficiais</span>
               </h1>
               <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium max-w-md">
                  Participe das decisões do grupo. Seu voto é registrado e auditável.
               </p>
            </div>
            
            <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex gap-1 shadow-inner border border-slate-200 dark:border-white/5">
                 <button onClick={() => setActiveTab('active')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'active' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}>Ativas</button>
                 <button onClick={() => setActiveTab('closed')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'closed' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}>Encerradas</button>
                 {canCreate && (
                    <button onClick={() => setActiveTab('create')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'create' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}>
                        <i className="fas fa-plus"></i> Criar
                    </button>
                 )}
            </div>
        </div>

        {activeTab === 'create' && canCreate && (
            <Card className="max-w-2xl mx-auto">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Nova Enquete</h3>
                <div className="space-y-4">
                    <input type="text" value={newPoll.title} onChange={e => setNewPoll({...newPoll, title: e.target.value})} placeholder="Título da Votação" className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 font-bold outline-none" />
                    <textarea value={newPoll.description} onChange={e => setNewPoll({...newPoll, description: e.target.value})} placeholder="Descrição e Contexto..." className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 outline-none min-h-[100px]" />
                    
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Opções</label>
                        {newPoll.options.map((opt, idx) => (
                            <input key={idx} type="text" value={opt} onChange={e => {
                                const newOpts = [...newPoll.options];
                                newOpts[idx] = e.target.value;
                                setNewPoll({...newPoll, options: newOpts});
                            }} placeholder={`Opção ${idx + 1}`} className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 outline-none text-sm" />
                        ))}
                        <button onClick={() => setNewPoll({...newPoll, options: [...newPoll.options, '']})} className="text-xs text-brand-500 font-bold uppercase tracking-wider hover:text-brand-600">+ Adicionar Opção</button>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest block mb-2">Prazo Limite</label>
                        <div className="grid grid-cols-2 gap-4">
                            <input type="text" value={deadlineDate} onChange={handleDeadlineDateChange} placeholder="DD/MM/AAAA" maxLength={10} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 font-bold outline-none" />
                            <input type="text" value={deadlineTime} onChange={handleDeadlineTimeChange} placeholder="HH:MM" maxLength={5} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 font-bold outline-none" />
                        </div>
                    </div>

                    <button onClick={handleCreate} disabled={isSubmitting} className="w-full py-4 rounded-xl bg-brand-600 text-white font-bold uppercase text-xs tracking-wider shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
                        {isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-check"></i>} Publicar Enquete
                    </button>
                </div>
            </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(activeTab === 'active' ? activePolls : closedPolls).map(poll => {
                const myVote = poll.votes?.find(v => v.userId === currentUser?.username);
                const totalVotes = poll.votes?.length || 0;
                const isExpired = new Date(poll.deadline) < new Date();

                return (
                    <div key={poll.id} className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-white/5 relative overflow-hidden">
                        {myVote && <div className="absolute top-0 right-0 bg-green-500 text-white text-[9px] font-bold uppercase px-3 py-1 rounded-bl-xl shadow-md">Votado</div>}
                        
                        <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-2">{poll.title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{poll.description}</p>
                        
                        <div className="space-y-3 mb-6">
                            {poll.options.map((opt, idx) => {
                                const count = poll.votes?.filter(v => v.optionIndex === idx).length || 0;
                                const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                                const isSelected = myVote?.optionIndex === idx;

                                return (
                                    <div key={idx} className="relative">
                                        <button 
                                            disabled={!!myVote || poll.status === 'CLOSED'}
                                            onClick={() => handleVote(poll.id!, idx, opt)}
                                            className={`w-full text-left p-3 rounded-xl border-2 transition-all relative z-10 flex justify-between items-center ${isSelected ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20'}`}
                                        >
                                            <span className={`font-bold text-sm ${isSelected ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'}`}>{opt}</span>
                                            {(myVote || poll.status === 'CLOSED' || canEdit) && (
                                                <span className="text-xs font-bold">{percent}%</span>
                                            )}
                                        </button>
                                        {(myVote || poll.status === 'CLOSED' || canEdit) && (
                                            <div className="absolute top-0 left-0 h-full bg-slate-100 dark:bg-white/5 rounded-xl transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-white/5">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                <i className="fas fa-clock mr-1"></i> Até {new Date(poll.deadline).toLocaleDateString('pt-BR')}
                            </div>
                            {canEdit && poll.status === 'OPEN' && (
                                <button onClick={() => handleClosePoll(poll.id!)} className="text-red-500 hover:text-red-600 text-xs font-bold uppercase tracking-wider">Encerrar</button>
                            )}
                        </div>
                    </div>
                );
            })}
            {(activeTab === 'active' ? activePolls : closedPolls).length === 0 && (
                <div className="col-span-full py-20 text-center opacity-50">
                    <i className="fas fa-box-open text-4xl text-slate-300 mb-4"></i>
                    <p className="font-bold text-slate-500">Nenhuma enquete encontrada.</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default Polls;
