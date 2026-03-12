import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { composeSong } from '../services/geminiService';
import { useAuth } from '../context/AuthContext';
import { AuditService } from '../services/firebase';
import { MusicUtils } from '../utils/musicUtils';
import ChordRenderer from '../components/ChordRenderer';
import { jsPDF } from 'jspdf';

interface Composition {
    title: string;
    composer?: string;
    lyricsWithChords: string;
    chordsSummary: string;
    key: string;
    arrangementNotes: string;
}

const Composer: React.FC = () => {
    const { currentUser, checkPermission } = useAuth();
    const canView = checkPermission('composer', 'view');
    const canCreate = checkPermission('composer', 'create');
    const canEdit = checkPermission('composer', 'edit');
    const canDelete = checkPermission('composer', 'delete');

    const [idea, setIdea] = useState('');
    const [style, setStyle] = useState('Worship');
    const [isGenerating, setIsGenerating] = useState(false);
    const [composition, setComposition] = useState<Composition | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedComp, setEditedComp] = useState<Composition | null>(null);
    const [showChords, setShowChords] = useState(true);
    const [isCopied, setIsCopied] = useState(false);

    const SUGGESTED_STYLES = [
        'Worship',
        'Pop Rock Cristão',
        'Acústico / Folk',
        'Gospel Tradicional',
        'R&B / Soul',
        'Rock Alternativo',
        'Eletrônico / Synthpop'
    ];

    const handleGenerate = async () => {
        if (!idea.trim()) {
            alert("Por favor, descreva sua ideia para a música.");
            return;
        }

        setIsGenerating(true);
        setComposition(null);
        try {
            const result = await composeSong(idea, style);
            setComposition(result);
            setEditedComp(result);
            
            if (currentUser) {
                await AuditService.log(
                    currentUser.username,
                    'Composer',
                    'CREATE',
                    `Gerou uma composição no estilo ${style}: "${result.title}"`,
                    currentUser.role,
                    currentUser.name
                );
            }
        } catch (error) {
            console.error("Erro ao gerar:", error);
            alert("Ocorreu um erro ao gerar a composição. Tente novamente.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        if (!editedComp) return;
        const textToCopy = `Título: ${editedComp.title}\nCompositor: ${editedComp.composer || currentUser?.name || 'Uziel AI'}\nTom: ${editedComp.key}\n\nLetra:\n${editedComp.lyricsWithChords.replace(/\[[^\]]+\]/g, '')}\n\nNotas de Arranjo:\n${editedComp.arrangementNotes}`;
        navigator.clipboard.writeText(textToCopy);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleTranspose = (targetKey: string) => {
        if (!editedComp) return;
        const currentKey = editedComp.key;
        const transposedLyrics = MusicUtils.transposeText(editedComp.lyricsWithChords, currentKey, targetKey);
        const transposedSummary = MusicUtils.transposeText(editedComp.chordsSummary, currentKey, targetKey);
        
        setEditedComp({
            ...editedComp,
            key: targetKey,
            lyricsWithChords: transposedLyrics,
            chordsSummary: transposedSummary
        });
    };

    const handleExportPDF = () => {
        if (!editedComp) return;
        
        const doc = new jsPDF();
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 25;

        // Background Header Accent
        doc.setFillColor(41, 170, 226); // brand-600
        doc.rect(0, 0, pageWidth, 40, 'F');

        // Header Text
        doc.setFont("helvetica", "bold");
        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255); // White
        doc.text(editedComp.title.toUpperCase(), margin, 25);
        
        y = 55;

        // Metadata Block
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(41, 170, 226); // brand-600
        doc.text("COMPOSITOR", margin, y);
        doc.text("ESTILO", margin + 70, y);
        doc.text("TOM", margin + 130, y);
        
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59); // slate-800
        doc.text((editedComp.composer || currentUser?.name || 'Uziel AI').toUpperCase(), margin, y);
        doc.text(style.toUpperCase(), margin + 70, y);
        doc.text(editedComp.key.toUpperCase(), margin + 130, y);

        // Horizontal line
        y += 5;
        doc.setDrawColor(37, 99, 235); // brand-600
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 15;

        // Lyrics Rendering
        const lines = editedComp.lyricsWithChords.split('\n');
        
        lines.forEach(line => {
            if (y > 270) {
                doc.addPage();
                y = 25;
            }

            const trimmedLine = line.trim();
            // Detect section headers like [REFRÃO] or [VERSO]
            const isSectionHeader = trimmedLine.startsWith('[') && trimmedLine.endsWith(']') && (trimmedLine.match(/\[/g) || []).length === 1 && trimmedLine.length > 4;
            
            if (isSectionHeader) {
                y += 5;
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(41, 170, 226); // brand-600
                doc.text(trimmedLine.toUpperCase(), margin, y);
                y += 8;
            } else if (trimmedLine === "") {
                y += 6;
            } else {
                if (showChords && line.includes('[')) {
                    // Render chords above text
                    const parts = line.split(/(\[[^\]]+\])/g);
                    
                    // Chords pass
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(9);
                    doc.setTextColor(41, 170, 226);
                    
                    let textX = margin;
                    parts.forEach(part => {
                        if (part.startsWith('[') && part.endsWith(']')) {
                            const chord = part.replace(/[\[\]]/g, '');
                            doc.text(chord, textX, y);
                        } else {
                            textX += doc.getTextWidth(part);
                        }
                    });
                    
                    y += 5;
                    // Lyrics pass
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(11);
                    doc.setTextColor(0, 0, 0);
                    doc.text(line.replace(/\[[^\]]+\]/g, ''), margin, y);
                    y += 8;
                } else {
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(11);
                    doc.setTextColor(0, 0, 0);
                    doc.text(line.replace(/\[[^\]]+\]/g, ''), margin, y);
                    y += 7;
                }
            }
        });

        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184); // slate-400
            doc.text(`Página ${i} de ${pageCount} | Gerado por Uziel AI Studio`, margin, 285);
        }

        doc.save(`${editedComp.title.replace(/\s+/g, '_')}.pdf`);
    };

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white dark:bg-slate-800 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-xl animate-fade-in">
                <div className="w-20 h-20 rounded-3xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center text-4xl mb-6 shadow-inner">
                    <i className="fas fa-lock"></i>
                </div>
                <h2 className="text-2xl font-display font-bold text-slate-800 dark:text-white mb-2">Acesso Restrito</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md">
                    Você não tem permissão para acessar o Estúdio de Composição. 
                    Entre em contato com um administrador para solicitar acesso.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in-up pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-100 dark:border-white/5 pb-8">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-500/20 shadow-sm">
                            <i className="fas fa-pen-nib text-lg"></i>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-[10px] font-black uppercase tracking-widest border border-brand-200 dark:border-brand-500/30">
                            AI Studio
                        </span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
                        Estúdio de <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-blue-400">Composição</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
                        Crie letras e arranjos modernos com o poder da Inteligência Artificial.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Painel de Configuração */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white dark:bg-slate-800/80 backdrop-blur-md rounded-[2rem] p-6 md:p-8 border border-slate-200/50 dark:border-white/10 shadow-xl">
                        <h3 className="text-lg font-display font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                            <i className="fas fa-sliders-h text-brand-500"></i> Parâmetros
                        </h3>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                                    Sobre o que é a música?
                                </label>
                                <textarea
                                    value={idea}
                                    onChange={(e) => setIdea(e.target.value)}
                                    placeholder="Ex: Uma música sobre esperança em tempos difíceis..."
                                    className="w-full h-32 p-4 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all resize-none"
                                ></textarea>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                                    Estilo Musical (Prompt)
                                </label>
                                <textarea
                                    value={style}
                                    onChange={(e) => setStyle(e.target.value)}
                                    placeholder="Ex: Worship lento com piano e cordas, crescendo no refrão..."
                                    className="w-full h-24 p-4 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all resize-none"
                                ></textarea>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {SUGGESTED_STYLES.map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setStyle(s)}
                                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${style === s ? 'bg-brand-600 border-brand-600 text-white shadow-md shadow-brand-500/20' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:border-brand-500 hover:text-brand-500'}`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !idea.trim() || !canCreate}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-600 to-blue-500 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-3"
                            >
                                {isGenerating ? (
                                    <><i className="fas fa-circle-notch fa-spin"></i> Compondo...</>
                                ) : (
                                    <><i className="fas fa-magic"></i> Gerar Composição</>
                                )}
                            </button>
                            {!canCreate && (
                                <p className="text-[10px] text-center text-red-500 font-bold uppercase tracking-wider mt-2">
                                    Acesso restrito para criação.
                                </p>
                            )}
                        </div>
                    </div>

                    {editedComp && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-slate-800/80 backdrop-blur-md rounded-[2rem] p-6 border border-slate-200/50 dark:border-white/10 shadow-xl space-y-4"
                        >
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                <i className="fas fa-tools text-brand-500"></i> Ferramentas
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={handleCopy} className={`p-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${isCopied ? 'bg-emerald-500 text-white shadow-md scale-105' : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'}`}>
                                    <i className={`fas ${isCopied ? 'fa-check animate-bounce' : 'fa-copy'}`}></i> {isCopied ? 'Copiado!' : 'Copiar'}
                                </button>
                                <button 
                                    onClick={() => setIsEditing(!isEditing)} 
                                    disabled={!canEdit}
                                    className={`p-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''} ${isEditing ? 'bg-brand-600 text-white' : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'}`}
                                >
                                    <i className="fas fa-edit"></i> {isEditing ? 'Visualizar' : 'Editar'}
                                </button>
                            </div>

                            <div className="pt-2">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Transpor Tom</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {MusicUtils.KEYS.map(k => (
                                        <button 
                                            key={k}
                                            onClick={() => handleTranspose(k)}
                                            className={`flex-1 min-w-[3rem] py-2 rounded-lg text-[10px] font-bold transition-all ${editedComp.key.replace(/m.*/, '') === k ? 'bg-brand-600 text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}
                                        >
                                            {k}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Incluir Cifras no PDF</span>
                                    <button 
                                        onClick={() => setShowChords(!showChords)}
                                        className={`w-10 h-5 rounded-full transition-colors relative outline-none focus:outline-none ${showChords ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                    >
                                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${showChords ? 'right-1' : 'left-1'}`}></div>
                                    </button>
                                </div>
                                <button 
                                    onClick={handleExportPDF}
                                    className="w-full px-6 py-3 rounded-xl bg-white dark:bg-white/10 text-slate-800 dark:text-white font-bold hover:bg-slate-100 dark:hover:bg-white/20 transition-all active:scale-95 active:shadow-inner flex items-center justify-center gap-2 shadow-sm text-xs uppercase tracking-wider group"
                                >
                                    <i className="fas fa-file-pdf text-red-500 text-lg transition-transform group-active:scale-125 group-active:rotate-12"></i> Exportar PDF
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Painel de Resultado */}
                <div className="lg:col-span-8">
                    <AnimatePresence mode="wait">
                        {isGenerating ? (
                            <motion.div 
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="h-full min-h-[500px] bg-white dark:bg-slate-800/80 backdrop-blur-md rounded-[2.5rem] border border-slate-200/50 dark:border-white/10 shadow-xl flex flex-col items-center justify-center p-8 text-center"
                            >
                                <div className="w-24 h-24 relative mb-8">
                                    <div className="absolute inset-0 border-4 border-brand-100 dark:border-brand-900/30 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-brand-600 rounded-full border-t-transparent animate-spin"></div>
                                    <i className="fas fa-music absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl text-brand-500 animate-pulse"></i>
                                </div>
                                <h3 className="text-2xl font-display font-bold text-slate-800 dark:text-white mb-3">
                                    A inspiração está fluindo...
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                                    Nossa IA está conectando harmonias e sentimentos para criar algo único para você.
                                </p>
                            </motion.div>
                        ) : editedComp ? (
                            <motion.div 
                                key="result"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white dark:bg-slate-800/80 backdrop-blur-md rounded-[2.5rem] border border-slate-200/50 dark:border-white/10 shadow-2xl overflow-hidden"
                            >
                                <div className="p-8 md:p-12 border-b border-slate-100 dark:border-white/5 bg-gradient-to-br from-brand-50 to-transparent dark:from-brand-900/10">
                                    <div className="flex flex-wrap items-center gap-3 mb-6">
                                        <span className="px-4 py-1.5 rounded-full bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm border border-slate-100 dark:border-white/5">
                                            {style}
                                        </span>
                                        <span className="px-4 py-1.5 rounded-full bg-brand-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-brand-500/20">
                                            Tom: {editedComp.key}
                                        </span>
                                    </div>
                                    
                                    {isEditing ? (
                                        <div className="space-y-4">
                                            <input 
                                                type="text"
                                                value={editedComp.title}
                                                onChange={(e) => setEditedComp({...editedComp, title: e.target.value})}
                                                placeholder="Título da Música"
                                                className="w-full text-4xl md:text-5xl font-display font-bold bg-transparent border-b-2 border-brand-500 outline-none text-slate-900 dark:text-white pb-2"
                                            />
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compositor:</span>
                                                <input 
                                                    type="text"
                                                    value={editedComp.composer || ''}
                                                    onChange={(e) => setEditedComp({...editedComp, composer: e.target.value})}
                                                    placeholder="Seu Nome"
                                                    className="bg-transparent border-b border-slate-200 dark:border-white/10 text-sm font-medium text-brand-600 outline-none px-2 py-1"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <h2 className="text-4xl md:text-6xl font-display font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                                {editedComp.title}
                                            </h2>
                                            <p className="text-brand-600 dark:text-brand-400 font-bold text-sm mt-2 uppercase tracking-widest">
                                                Por: {editedComp.composer || currentUser?.name || 'Uziel AI'}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="p-8 md:p-12 space-y-12">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
                                        <div className="md:col-span-7">
                                            <div className="flex items-center justify-between mb-5">
                                                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 dark:text-white flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/30">
                                                        <i className="fas fa-align-left text-xs"></i>
                                                    </div>
                                                    Letra & Cifras
                                                </h4>
                                                {isEditing && (
                                                    <button 
                                                        onClick={() => {
                                                            const cleanedText = editedComp.lyricsWithChords
                                                                .replace(/\[.*?\]/g, '')
                                                                .replace(/^[ \t]*\n/gm, '\n')
                                                                .replace(/\n{3,}/g, '\n\n')
                                                                .trim();
                                                            setEditedComp({
                                                                ...editedComp,
                                                                lyricsWithChords: cleanedText
                                                            });
                                                        }}
                                                        className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:text-red-600 transition-colors flex items-center gap-2 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-lg"
                                                        title="Remove todas as cifras e marcadores de seção da letra"
                                                    >
                                                        <i className="fas fa-eraser"></i> Limpar Cifras/Seções
                                                    </button>
                                                )}
                                            </div>
                                            
                                            {isEditing ? (
                                                <textarea 
                                                    value={editedComp.lyricsWithChords}
                                                    onChange={(e) => setEditedComp({...editedComp, lyricsWithChords: e.target.value})}
                                                    className="w-full h-[600px] p-6 rounded-3xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 font-mono text-sm outline-none focus:border-brand-500 transition-all resize-none"
                                                />
                                            ) : (
                                                <div className="bg-white dark:bg-[#0b1221] p-6 md:p-8 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm">
                                                    <ChordRenderer text={editedComp.lyricsWithChords} showChords={showChords} />
                                                </div>
                                            )}
                                        </div>

                                        <div className="md:col-span-5 space-y-8">
                                            <div>
                                                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 dark:text-white mb-5 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/30">
                                                        <i className="fas fa-guitar text-xs"></i>
                                                    </div>
                                                    Resumo Harmônico
                                                </h4>
                                                {isEditing ? (
                                                    <textarea 
                                                        value={editedComp.chordsSummary}
                                                        onChange={(e) => setEditedComp({...editedComp, chordsSummary: e.target.value})}
                                                        className="w-full h-32 p-5 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 font-mono text-xs outline-none focus:border-brand-500 transition-all resize-none"
                                                    />
                                                ) : (
                                                    <div className="bg-brand-50 dark:bg-brand-900/30 p-6 md:p-8 rounded-[2rem] border border-brand-100 dark:border-brand-500/20 shadow-sm">
                                                        <div className="text-brand-600 dark:text-brand-400 font-black text-sm leading-relaxed whitespace-pre-wrap">
                                                            {editedComp.chordsSummary.replace(/\[|\]/g, '')}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 dark:text-white mb-5 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/30">
                                                        <i className="fas fa-headphones text-xs"></i>
                                                    </div>
                                                    Direção de Arranjo
                                                </h4>
                                                {isEditing ? (
                                                    <textarea 
                                                        value={editedComp.arrangementNotes}
                                                        onChange={(e) => setEditedComp({...editedComp, arrangementNotes: e.target.value})}
                                                        className="w-full h-48 p-5 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm outline-none focus:border-brand-500 transition-all resize-none"
                                                    />
                                                ) : (
                                                    <div className="bg-brand-50 dark:bg-brand-900/30 p-6 md:p-8 rounded-[2rem] border border-brand-100 dark:border-brand-500/20 shadow-sm">
                                                        <div className="text-brand-600 dark:text-brand-400 font-black text-sm leading-relaxed whitespace-pre-wrap">
                                                            {editedComp.arrangementNotes.replace(/\[|\]/g, '')}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="h-full min-h-[500px] bg-slate-50/50 dark:bg-white/5 rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 border-dashed flex flex-col items-center justify-center p-8 text-center"
                            >
                                <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600 text-4xl mb-8 shadow-inner">
                                    <i className="fas fa-pen-nib"></i>
                                </div>
                                <h3 className="text-2xl font-display font-bold text-slate-400 dark:text-slate-500 mb-3">
                                    Pronto para compor?
                                </h3>
                                <p className="text-slate-400 dark:text-slate-500 max-w-sm leading-relaxed">
                                    Preencha os detalhes ao lado e deixe a tecnologia transformar sua inspiração em música.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default Composer;

