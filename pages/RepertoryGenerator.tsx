
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import pptxgen from 'pptxgenjs';
import { SONG_TYPES, REPERTORY_COVERS } from '../constants';
import { RepertoryService, AuditService } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { Song, Repertory } from '../types';
import { fetchLyrics, generateRepertoryImage, smartProcessLyrics } from '../services/geminiService';
import ImageViewer from '../components/ImageViewer';
import { AnimatePresence, motion } from 'framer-motion';
import ChordRenderer from '../components/ChordRenderer';
import Loading from '../components/Loading'; 
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import PremiumBackground from '../components/PremiumBackground';
import { MusicUtils } from '../utils/musicUtils';

// --- DND KIT IMPORTS ---
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  MeasuringStrategy 
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const compressImage = (base64Str: string, maxWidth = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { resolve(base64Str); };
  });
};

const getSpotifyEmbedUrl = (url: string) => {
    if (!url) return null;
    const regex = /(?:https?:\/\/)?(?:open\.spotify\.com\/)(?:intl-[a-z]{2}\/)?(?:track|album|playlist|artist)\/([a-zA-Z0-9]{22})/;
    const match = url.match(regex);
    return match ? `https://open.spotify.com/embed/track/${match[1]}?utm_source=generator&theme=0` : null;
};

const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return null;
    const regex = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
};

const normalizeFilename = (str: string) => {
    let normalized = str.replace(/ç/g, 'c').replace(/Ç/g, 'C').replace(/ñ/g, 'n').replace(/Ñ/g, 'N');
    return normalized
        .normalize("NFD")
        .replace(/[\u0300-\u030f]/g, "") 
        .replace(/[^a-zA-Z0-9 -]/g, "") 
        .replace(/\s+/g, "_"); 
};

// --- RICH TEXT HELPER (Tokenizer) ---
interface TextToken {
    text: string;
    bold: boolean;
    italic: boolean;
    color: string | null;
}

const parseRichText = (input: string): TextToken[] => {
    const regex = /(<c:#[a-fA-F0-9]{3,6}>.*?<\/c>|\*\*.*?\*\*|\*.*?\*)/g;
    const parts = input.split(regex).filter(Boolean);
    
    let tokens: TextToken[] = [];

    parts.forEach(part => {
        if (part.startsWith('<c:') && part.endsWith('</c>')) {
            const hexMatch = part.match(/<c:(#[a-fA-F0-9]{3,6})>/);
            const content = part.replace(/<c:#[a-fA-F0-9]{3,6}>|<\/c>/g, '');
            const color = hexMatch ? hexMatch[1] : null;
            
            const innerTokens = parseRichText(content);
            innerTokens.forEach(t => t.color = color); 
            tokens = [...tokens, ...innerTokens];
        } else if (part.startsWith('**') && part.endsWith('**')) {
            tokens.push({ text: part.replace(/\*\*/g, ''), bold: true, italic: false, color: null });
        } else if (part.startsWith('*') && part.endsWith('*')) {
            tokens.push({ text: part.replace(/\*/g, ''), bold: false, italic: true, color: null });
        } else {
            tokens.push({ text: part, bold: false, italic: false, color: null });
        }
    });

    if (tokens.length === 0) return [];
    
    const merged: TextToken[] = [];
    let current = tokens[0];
    
    for (let i = 1; i < tokens.length; i++) {
        const next = tokens[i];
        if (next.bold === current.bold && next.italic === current.italic && next.color === current.color) {
            current.text += next.text;
        } else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    
    return merged;
};

// --- COLOR UTILS FOR "CANVA-LIKE" HARMONY ---
const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
};

const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
};

const hslToHex = (h: number, s: number, l: number) => {
    l /= 100; const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
};

const generateHarmony = (hex: string) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return [];
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return [
        hex,
        hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l), 
        hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l),  
        hslToHex((hsl.h - 30 + 360) % 360, hsl.s, hsl.l), 
        hslToHex(hsl.h, hsl.s, Math.min(hsl.l + 20, 95)), 
        hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 20, 10))  
    ];
};

const ColorPickerPopover = ({ currentColor, onSelect, onClose }: { currentColor: string, onSelect: (hex: string) => void, onClose: () => void }) => {
    const [tempColor, setTempColor] = useState(currentColor);
    const harmonyColors = useMemo(() => generateHarmony(tempColor), [tempColor]);

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-[#1e293b] p-6 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 w-full max-w-sm relative animate-scale-in flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full shadow-inner border-2 border-white/20" style={{ backgroundColor: tempColor }}></div>
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Editar Slot</span>
                            <span className="text-sm font-bold text-slate-700 dark:text-white font-mono">{tempColor.toUpperCase()}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"><i className="fas fa-times"></i></button>
                </div>
                <div className="relative w-full h-48 rounded-2xl overflow-hidden mb-6 border border-slate-200 dark:border-white/10 shadow-inner group bg-slate-100 dark:bg-black/20">
                    <input type="color" value={tempColor} onChange={(e) => setTempColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30" />
                    <div className="w-full h-full absolute inset-0 z-10" style={{ backgroundColor: tempColor }}>
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30 pointer-events-none"></div>
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
                        <i className="fas fa-eye-dropper text-white/90 drop-shadow-md text-3xl mb-2"></i>
                        <span className="text-white/90 font-bold text-xs uppercase tracking-wider drop-shadow-md bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">Toque para alterar</span>
                    </div>
                </div>
                <div className="mb-6">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide flex items-center gap-2"><i className="fas fa-palette"></i> Sugestões de Harmonia</p>
                    <div className="flex gap-3 justify-center flex-wrap">
                        {harmonyColors.map((c, i) => (
                            <button key={i} onClick={() => setTempColor(c)} className="w-10 h-10 rounded-full border-2 border-white/20 shadow-sm transition-transform hover:scale-110 active:scale-95 relative group" style={{ backgroundColor: c }} title={c}>{c === tempColor && <div className="absolute inset-0 flex items-center justify-center"><div className="w-3 h-3 bg-white rounded-full shadow-sm animate-scale-in"></div></div>}</button>
                        ))}
                    </div>
                </div>
                <button onClick={() => { onSelect(tempColor); onClose(); }} className="w-full py-4 bg-brand-600 text-white rounded-2xl font-bold text-sm uppercase tracking-wider hover:bg-brand-500 transition-colors shadow-lg shadow-brand-500/30 flex items-center justify-center gap-2 active:scale-[0.98]"><i className="fas fa-check"></i> Aplicar Cor</button>
            </div>
        </div>, document.body
    );
};

const LyricsToolbar = ({ textareaRef, onInsert }: { textareaRef: React.RefObject<HTMLTextAreaElement>, onInsert: (val: string) => void }) => {
    const DEFAULT_PALETTE = [
        { hex: '#29aae2', label: 'Marca' }, { hex: '#ff3b30', label: 'Erro' }, { hex: '#34c759', label: 'Sucesso' },
        { hex: '#ffcc00', label: 'Aviso' }, { hex: '#af52de', label: 'Destaque' }, { hex: '#ff9500', label: 'Atenção' }, { hex: '#8e8e93', label: 'Neutro' }
    ];
    const [palette, setPalette] = useState(() => {
        const saved = localStorage.getItem('uziel_editor_palette');
        return saved ? JSON.parse(saved) : DEFAULT_PALETTE;
    });
    const [editingSlot, setEditingSlot] = useState<number | null>(null);
    useEffect(() => { localStorage.setItem('uziel_editor_palette', JSON.stringify(palette)); }, [palette]);
    const insertTag = (start: string, end: string) => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        const startPos = el.selectionStart;
        const endPos = el.selectionEnd;
        const selection = el.value.substring(startPos, endPos);
        let replacement = selection.length > 0 && selection.includes('\n') ? selection.split('\n').map(line => !line.trim() ? line : `${start}${line}${end}`).join('\n') : `${start}${selection}${end}`;
        const success = document.execCommand('insertText', false, replacement);
        if (!success) {
            const newValue = el.value.substring(0, startPos) + replacement + el.value.substring(endPos);
            onInsert(newValue);
            setTimeout(() => { el.setSelectionRange(startPos, startPos + replacement.length); }, 0);
        }
    };
    return (
        <div className="flex flex-col gap-3 p-4 bg-white dark:bg-[#0b1221] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm mx-4 -mt-4 relative z-20">
            <div className="flex items-center gap-3">
                <button type="button" onClick={() => insertTag('**', '**')} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center font-extrabold text-slate-700 dark:text-slate-200 transition-colors shadow-sm" title="Negrito">B</button>
                <button type="button" onClick={() => insertTag('*', '*')} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center italic font-serif text-slate-700 dark:text-slate-200 transition-colors shadow-sm" title="Itálico">I</button>
                <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1"></div>
                <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar py-2 px-1 relative flex-1">
                    {palette.map((c: any, index: number) => (
                        <div key={index} className="relative group shrink-0">
                            <button type="button" onClick={() => insertTag(`<c:${c.hex}>`, `</c>`)} onContextMenu={(e) => { e.preventDefault(); setEditingSlot(index); }} className="w-8 h-8 rounded-full transition-transform hover:scale-110 relative shrink-0 shadow-sm ring-2 ring-white dark:ring-[#0b1221] cursor-pointer" style={{ backgroundColor: c.hex }} title="Clique para aplicar. Botão direito para editar."></button>
                            {editingSlot === index && <ColorPickerPopover currentColor={c.hex} onSelect={(hex) => { const newP = [...palette]; newP[index] = { ...newP[index], hex }; setPalette(newP); }} onClose={() => setEditingSlot(null)} />}
                        </div>
                    ))}
                    <div className="relative group ml-1 shrink-0">
                        <label htmlFor="custom-color-picker" className="cursor-pointer w-8 h-8 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:border-brand-500 hover:text-brand-500 transition-colors bg-transparent"><i className="fas fa-plus text-[10px]"></i></label>
                        <input id="custom-color-picker" type="color" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10" onChange={(e) => insertTag(`<c:${e.target.value}>`, `</c>`)} title="Cor Única (Sem Salvar)" />
                    </div>
                </div>
            </div>
            <div className="flex justify-between items-center pl-1"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Editor Rico</p><p className="text-[9px] text-slate-300 italic mr-1">Botão direito na cor para editar atalho</p></div>
        </div>
    );
};

const SongTypeInput = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  const isPredefined = SONG_TYPES.includes(value);
  const [isEditing, setIsEditing] = useState(!isPredefined);
  return (
    <div className="flex gap-2 w-full items-start">
       <div className="relative w-full group">
         {!isEditing ? (
            <div className="relative"><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full pl-4 pr-10 py-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm text-slate-700 dark:text-white focus:ring-2 focus:ring-brand-500/20 outline-none appearance-none cursor-pointer transition-all hover:border-brand-500/30 hover:shadow-sm">{SONG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select><i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none group-hover:text-brand-500 transition-colors"></i></div>
         ) : (
            <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm outline-none animate-fade-in-right shadow-inner" placeholder="Digite o nome..." autoFocus />
         )}
       </div>
       <button onClick={() => { if (isEditing && !SONG_TYPES.includes(value)) onChange(SONG_TYPES[0]); setIsEditing(!isEditing); }} type="button" className={`h-[46px] w-[46px] shrink-0 rounded-xl flex items-center justify-center transition-all border shadow-sm ${isEditing ? 'bg-brand-50 text-brand-600 border-brand-200 dark:bg-brand-900/20 dark:border-brand-800' : 'bg-slate-50 text-slate-400 border-slate-100 dark:bg-white/5 dark:border-white/5 hover:text-brand-500 hover:bg-white dark:hover:bg-white/10'}`} title={isEditing ? "Voltar para Lista" : "Editar manualmente"}><i className={`fas ${isEditing ? 'fa-list' : 'fa-pen'}`}></i></button>
    </div>
  );
};

const SortableSongItem = ({ song, index, isExpanded, toggleExpand, onUpdate, onTranspose, onDelete, generatingSongId, handleGenerateLyrics, withChords, setWithChords }: any) => {
    const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>(window.innerWidth >= 1024 ? 'split' : 'edit');
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id });
    const style = { transform: CSS.Transform.toString(transform), transition: isDragging ? 'none' : transition, zIndex: isDragging ? 50 : 'auto', opacity: isDragging ? 0.9 : 1, position: 'relative' as 'relative', touchAction: 'pan-y' };
    const lyricsInputRef = useRef<HTMLTextAreaElement>(null);
    const spotifyUrl = getSpotifyEmbedUrl(song.link);
    const isGenerating = generatingSongId === song.id;
    const currentRootKey = song.key ? song.key.replace(/m.*/, '') : '';

    return (
        <div ref={setNodeRef} style={style} className={`bg-white dark:bg-[#0b1221] rounded-[2rem] shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden group mb-4 relative transition-shadow duration-200 ${isDragging ? 'shadow-2xl ring-2 ring-brand-500/50 z-50 scale-[1.03] cursor-grabbing' : ''}`}>
            <div className="p-5 flex items-center gap-4 select-none bg-white dark:bg-[#0b1221] relative z-10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors" onClick={toggleExpand}>
                <div className="text-slate-300 group-hover:text-brand-500 transition-colors cursor-grab active:cursor-grabbing p-2 -ml-2 touch-none" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}><i className="fas fa-grip-vertical text-lg"></i></div>
                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-sm font-bold text-slate-500 dark:text-slate-400">{index + 1}</div>
                <div className="flex-1 min-w-0 cursor-pointer"><div className="flex items-center gap-2 mb-0.5"><span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-300">{song.type}</span>{song.key && <span className="px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-900/20 text-[10px] font-bold text-brand-600 dark:text-brand-400">{song.key}</span>}</div><h4 className={`font-bold text-lg text-slate-800 dark:text-white truncate ${!song.title && 'italic text-slate-400'}`}>{song.title || 'Nova Música'}</h4></div>
                <button onClick={(e) => {e.stopPropagation(); onDelete()}} className="w-9 h-9 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors flex items-center justify-center"><i className="fas fa-trash"></i></button>
                <div className={`w-8 h-8 flex items-center justify-center rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-slate-100 dark:bg-white/10 text-slate-600' : 'text-slate-300'}`}><i className="fas fa-chevron-down"></i></div>
            </div>
            <AnimatePresence>
                {isExpanded && !isDragging && (
                    <motion.div key="content" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="px-4 md:px-6 pb-8 pt-2 bg-slate-50/50 dark:bg-[#0f172a]/50 border-t border-slate-100 dark:border-white/5 cursor-default overflow-hidden" onClick={e => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                         <div className="grid grid-cols-12 gap-4 mb-4">
                             <div className="col-span-12 md:col-span-4"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Momento</label><SongTypeInput value={song.type} onChange={(val) => onUpdate(song.id, 'type', val)} /></div>
                             <div className="col-span-12 md:col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Tom</label><div className="relative"><select value={currentRootKey} onChange={e => onTranspose(song.id, e.target.value)} className="w-full pl-4 pr-8 py-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm outline-none uppercase appearance-none cursor-pointer hover:bg-white/80 transition-colors"><option value="">--</option>{MusicUtils.KEYS.map(k => <option key={k} value={k}>{k}</option>)}</select><i className="fas fa-music absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i></div></div>
                             <div className="col-span-12 md:col-span-6"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Artista</label><input type="text" value={song.artist || ''} onChange={e => onUpdate(song.id, 'artist', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm outline-none" placeholder="Ex: Comunidade Shalom" /></div>
                         </div>
                         <div className="mb-6"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Nome da Canção</label><input type="text" value={song.title} onChange={e => onUpdate(song.id, 'title', e.target.value)} className="w-full px-5 py-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 font-display text-xl font-bold outline-none" placeholder="Digite o nome da música..." /></div>
                         
                         {/* VIEW CONTROLS */}
                         <div className="flex justify-between items-center mb-4">
                             <div className="flex bg-slate-200 dark:bg-white/10 p-1 rounded-xl gap-1 w-full sm:w-auto">
                                <button onClick={() => setViewMode('edit')} className={`flex-1 sm:flex-none px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${viewMode === 'edit' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                    <i className="fas fa-pen mr-2"></i> Editor
                                </button>
                                <button onClick={() => setViewMode('preview')} className={`flex-1 sm:flex-none px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${viewMode === 'preview' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                    <i className="fas fa-eye mr-2"></i> Preview
                                </button>
                                <button onClick={() => setViewMode('split')} className={`hidden lg:flex px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${viewMode === 'split' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                    <i className="fas fa-columns mr-2"></i> Lado a Lado
                                </button>
                             </div>
                         </div>

                         <div className={`flex gap-6 h-[700px] lg:h-[800px] mb-6 relative transition-all duration-300 ${viewMode === 'split' ? 'flex-row' : 'flex-col'}`}>
                            {/* Editor Column */}
                            <div className={`flex flex-col h-full relative group/editor 
                                ${viewMode === 'preview' ? 'hidden' : 'flex'}
                                ${viewMode === 'split' ? 'w-1/2 min-w-0 flex-1' : 'w-full flex-1'}
                            `}>
                                <div className="bg-slate-100 dark:bg-slate-800 rounded-t-[2rem] p-3 pb-6 flex items-center justify-between border border-slate-200 dark:border-white/10 border-b-0 relative z-10">
                                    <div className="flex items-center gap-2"><button onClick={() => handleGenerateLyrics(song, withChords)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm ${isGenerating ? 'bg-red-50 text-red-500 animate-pulse' : 'bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-brand-500'}`}>{isGenerating ? <i className="fas fa-times"></i> : <i className="fas fa-wand-magic-sparkles"></i>} {isGenerating ? 'Cancelar' : 'IA'}</button><div className="flex bg-slate-200 dark:bg-black/30 p-1 rounded-xl"><button onClick={() => setWithChords(false)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${!withChords ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400'}`}>Letra</button><button onClick={() => setWithChords(true)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${withChords ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400'}`}>+ Cifra</button></div></div>
                                    <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest bg-brand-50 dark:bg-brand-900/20 px-3 py-1 rounded-lg hidden sm:block">Editor</span>
                                </div>
                                <div className="flex-1 relative flex flex-col bg-white dark:bg-[#0b1221] border border-slate-200 dark:border-white/10 rounded-b-[2rem] rounded-tr-[2rem] -mt-4 pt-4 shadow-sm overflow-hidden">
                                    <LyricsToolbar textareaRef={lyricsInputRef} onInsert={(val) => onUpdate(song.id, 'lyrics', val)} />
                                    <textarea ref={lyricsInputRef} value={song.lyrics} onChange={e => onUpdate(song.id, 'lyrics', e.target.value)} className="flex-1 min-h-0 w-full bg-transparent p-6 text-sm font-mono leading-relaxed resize-none focus:outline-none text-slate-700 dark:text-slate-200" placeholder="Digite ou cole a letra/cifra aqui..."></textarea>
                                    {isGenerating && (<div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-30 rounded-b-[2rem]"><div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div><p className="text-brand-600 font-bold text-sm animate-pulse">Gerando com IA...</p></div>)}
                                </div>
                            </div>
                            
                            {/* Preview Column (Enhanced Visuals) */}
                            <div className={`flex flex-col h-full bg-white dark:bg-[#0b1221] border border-slate-200 dark:border-white/10 rounded-[2rem] overflow-hidden shadow-xl relative
                                ${viewMode === 'edit' ? 'hidden' : 'flex'}
                                ${viewMode === 'split' ? 'w-1/2 min-w-0 flex-1' : 'w-full flex-1'}
                            `}>
                                <div className="bg-slate-50 dark:bg-[#0f172a] border-b border-slate-100 dark:border-white/5 p-4 flex items-center justify-between sticky top-0 z-20">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 flex items-center justify-center shadow-sm">
                                            <i className="fas fa-eye text-xs"></i>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-brand-500 tracking-widest block">Preview</span>
                                            <span className="text-xs font-bold text-slate-700 dark:text-white">Tempo Real</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-sm"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-sm"></div>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white dark:bg-[#0b1221] relative">
                                    {/* Paper Texture Effect (Subtle) */}
                                    <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                                    
                                    <div className="relative z-10">
                                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 font-display tracking-tight text-center">{song.title || 'Título da Música'}</h3>
                                        <p className="text-sm font-medium text-slate-400 uppercase tracking-widest text-center mb-8">{song.artist || 'Artista Desconhecido'} • {song.key || 'Tom N/A'}</p>
                                        <div className="max-w-3xl mx-auto">
                                            <ChordRenderer text={song.lyrics} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                         </div>
                         <div className="flex items-center gap-3 bg-slate-100 dark:bg-[#0f172a] p-3 rounded-2xl border border-slate-200 dark:border-white/10"><div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${spotifyUrl ? 'bg-[#1DB954] text-white shadow-lg shadow-[#1DB954]/30' : 'bg-slate-200 dark:bg-white/10 text-slate-400'}`}><i className="fab fa-spotify"></i></div><div className="flex-1"><input type="text" value={song.link || ''} onChange={(e) => onUpdate(song.id, 'link', e.target.value)} placeholder="Cole o link do Spotify aqui para integrar o player..." className="w-full bg-transparent text-xs font-bold text-slate-700 dark:text-white outline-none placeholder:text-slate-400" /></div>{spotifyUrl && (<a href={song.link} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-white dark:bg-white/10 text-slate-400 hover:text-[#1DB954] flex items-center justify-center transition-colors"><i className="fas fa-external-link-alt text-xs"></i></a>)}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const RepertoryGenerator: React.FC = () => {
  const { currentUser, usersList } = useAuth();
  const [activeTab, setActiveTab] = useState<'build' | 'history' | 'view'>('history');
  const [history, setHistory] = useState<Repertory[]>([]);
  const [viewingRep, setViewingRep] = useState<Repertory | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'past'>('all');
  const [theme, setTheme] = useState('');
  const [date, setDate] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [coverImage, setCoverImage] = useState(REPERTORY_COVERS[0]); 
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedSong, setExpandedSong] = useState<string | null>(null);
  const [withChords, setWithChords] = useState(false);
  const [generatingSongId, setGeneratingSongId] = useState<string | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; title: string; description: string; onConfirm: () => Promise<void>; }>({ isOpen: false, title: '', description: '', onConfirm: async () => {} });
  const [showFullImage, setShowFullImage] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isSaveSuccess, setIsSaveSuccess] = useState(false);
  const [pdfChoiceModal, setPdfChoiceModal] = useState<{ isOpen: boolean, rep: Repertory | null }>({ isOpen: false, rep: null });
  const [pdfHeaderTitle, setPdfHeaderTitle] = useState("Ministério de Música Uziel");
  const [pptxChoiceModal, setPptxChoiceModal] = useState<{ isOpen: boolean, rep: Repertory | null }>({ isOpen: false, rep: null });
  const [isGeneratingPPTX, setIsGeneratingPPTX] = useState(false);
  const [pptxProgress, setPptxProgress] = useState({ current: 0, total: 0 });
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const activeGenerationRef = useRef<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 10 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) { setSongs((items) => { const oldIndex = items.findIndex((i) => i.id === active.id); const newIndex = items.findIndex((i) => i.id === over?.id); return arrayMove(items, oldIndex, newIndex); }); }
  };
  useEffect(() => { const unsub = RepertoryService.subscribe((data) => { setHistory(data as Repertory[]); setInitialLoading(false); }); return () => unsub(); }, [currentUser]);
  const addSongField = () => { const newId = Date.now().toString(); const newSong = { id: newId, type: SONG_TYPES[0], title: '', lyrics: '', link: '', artist: '', key: '' }; setSongs([...songs, newSong]); setExpandedSong(newId); };
  const updateSong = (id: string, field: keyof Song, value: string) => { setSongs(prevSongs => prevSongs.map(s => s.id === id ? { ...s, [field]: value } : s)); };
  const handleTranspose = (id: string, targetRoot: string) => { setSongs(prevSongs => prevSongs.map(s => { if (s.id !== id) return s; if (targetRoot === "") return { ...s, key: "" }; let currentKey = s.key || ''; if (!currentKey && s.lyrics) { const metaMatch = s.lyrics.match(/Tom:\s*([A-G][#b]?m?)/i); if (metaMatch) { currentKey = metaMatch[1]; } else { currentKey = MusicUtils.detectKey(s.lyrics) || 'C'; } } const isMinor = currentKey.includes('m'); const currentRoot = currentKey.replace(/m.*/, ''); const transposedLyrics = MusicUtils.transposeText(s.lyrics, currentRoot, targetRoot); const newKeyFull = targetRoot + (isMinor ? 'm' : ''); return { ...s, key: newKeyFull, lyrics: transposedLyrics }; })); };
  const handleViewTranspose = async (songId: string, targetRoot: string) => { if (!viewingRep) return; const updatedSongs = viewingRep.songs.map(s => { if (s.id !== songId) return s; let currentKey = s.key || ''; if (!currentKey && s.lyrics) { const metaMatch = s.lyrics.match(/Tom:\s*([A-G][#b]?m?)/i); if (metaMatch) currentKey = metaMatch[1]; else currentKey = MusicUtils.detectKey(s.lyrics) || 'C'; } const isMinor = currentKey.includes('m'); const currentRoot = currentKey.replace(/m.*/, ''); const transposedLyrics = MusicUtils.transposeText(s.lyrics, currentRoot, targetRoot); const newKeyFull = targetRoot + (isMinor ? 'm' : ''); return { ...s, key: newKeyFull, lyrics: transposedLyrics }; }); const updatedRep = { ...viewingRep, songs: updatedSongs }; setViewingRep(updatedRep); setHistory(prev => prev.map(h => h.id === updatedRep.id ? updatedRep : h)); try { await RepertoryService.save(updatedRep, updatedRep.id); } catch (e) { console.error("Auto-save transpose failed", e); } };
  const handleDeleteSong = (id: string) => { setSongs(songs.filter(s => s.id !== id)); if (expandedSong === id) setExpandedSong(null); };
  const handleGenerateLyrics = async (song: Song, includeChordsRef: boolean) => { if (generatingSongId === song.id) { setGeneratingSongId(null); activeGenerationRef.current = null; return; } if (!song.title) return alert("Por favor, insira o nome da música primeiro."); setGeneratingSongId(song.id); activeGenerationRef.current = song.id; try { const result = await fetchLyrics(song.title, song.artist || '', song.key || '', '', includeChordsRef, 'simple'); if (activeGenerationRef.current !== song.id) return; if (currentUser) { await AuditService.log(currentUser.username, 'Repertory', 'AI_LYRICS', `Gerou letra/cifra para: ${song.title}`, currentUser.role, currentUser.name); } setSongs(prevSongs => prevSongs.map(s => { if (s.id === song.id) { const newKey = result.originalKey || s.key || ''; return { ...s, lyrics: result.content, link: result.videoUrl || s.link, key: newKey }; } return s; })); } catch (error) { if (activeGenerationRef.current === song.id) { console.error("Erro na geração:", error); alert("Não foi possível gerar a letra. Tente novamente."); } } finally { if (activeGenerationRef.current === song.id) { setGeneratingSongId(null); activeGenerationRef.current = null; } } };
  const handleGenerateCover = async () => { if (!theme.trim()) return alert("Por favor, defina um tema para o evento antes de gerar a capa."); setIsGeneratingCover(true); try { const base64Image = await generateRepertoryImage(theme); if (base64Image) { const compressed = await compressImage(base64Image); setCoverImage(compressed); if (currentUser) { await AuditService.log(currentUser.username, 'Repertory', 'AI_COVER', `Gerou capa para repertório: ${theme}`, currentUser.role, currentUser.name); } } else { setCoverImage(REPERTORY_COVERS[0]); } } catch (error) { alert("Erro ao gerar capa. Tente novamente."); } finally { setIsGeneratingCover(false); } };
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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    if (value.length >= 5) {
      value = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
    } else if (value.length >= 3) {
      value = `${value.slice(0, 2)}/${value.slice(2)}`;
    }
    setDate(value);
  };

  const handleSave = async () => { if (!date) return alert("Data obrigatória"); try { setIsProcessing(true); const finalDate = formatDateForStorage(date); const repertoryData: any = { date: finalDate, theme, songs, createdBy: currentUser?.username, isPrivate, coverImage }; await RepertoryService.save(repertoryData, editingId || undefined); if (currentUser) { await AuditService.log(currentUser.username, 'Repertory', editingId ? 'UPDATE' : 'CREATE', `Salvou repertório: ${theme} (${finalDate})`, currentUser.role, currentUser.name); } setIsSaveSuccess(true); setTimeout(() => { setIsSaveSuccess(false); setEditingId(null); resetForm(); setActiveTab('history'); setIsProcessing(false); }, 1500); } catch(e) { setIsProcessing(false); alert("Erro ao salvar o repertório."); } };
  const loadForEditing = (rep: Repertory) => { window.scrollTo({ top: 0, behavior: 'smooth' }); setDate(formatDateForDisplay(rep.date)); setTheme(rep.theme); const sanitizedSongs = (rep.songs || []).map(s => ({ ...s, id: s.id || Date.now().toString() + Math.random().toString().slice(2) })); setSongs(sanitizedSongs); setIsPrivate(rep.isPrivate); const isValidUrl = (url?: string) => url && (url.startsWith('http') || url.startsWith('data:image')); const safeCover = isValidUrl(rep.coverImage) ? rep.coverImage! : REPERTORY_COVERS[0]; setCoverImage(safeCover); setEditingId(rep.id || null); setActiveTab('build'); };
  const resetForm = () => { setSongs([]); setTheme(''); setEditingId(null); setDate(''); setCoverImage(REPERTORY_COVERS[0]); };
  const requestDelete = (e: React.MouseEvent, id: string) => { e.stopPropagation(); e.preventDefault(); setDeleteModal({ isOpen: true, title: 'Excluir Repertório?', description: 'Você está prestes a excluir este repertório permanentemente.', onConfirm: async () => { setIsProcessing(true); const prevHistory = [...history]; setHistory(prev => prev.filter(h => h.id !== id)); setDeletingId(id); try { await RepertoryService.delete(id); if (currentUser) { await AuditService.log(currentUser.username, 'Repertory', 'DELETE', `Excluiu repertório ID: ${id}`, currentUser.role, currentUser.name); } } catch (err: any) { setHistory(prevHistory); alert("Erro ao excluir: " + err.message); } finally { setIsProcessing(false); setDeletingId(null); setDeleteModal(prev => ({...prev, isOpen: false})); } } }); };
  const getLogoGeometry = (x: number, y: number, size: number) => { const s = size / 100; return [ { type: 'rect', x: x + 44*s, y: y + 2*s, w: 12*s, h: 96*s }, { type: 'rect', x: x + 18*s, y: y + 22*s, w: 64*s, h: 12*s }, { type: 'rect', x: x + 30*s, y: y + 38*s, w: 10*s, h: 40*s }, { type: 'rect', x: x + 16*s, y: y + 50*s, w: 10*s, h: 20*s }, { type: 'rect', x: x + 60*s, y: y + 38*s, w: 10*s, h: 40*s }, { type: 'rect', x: x + 74*s, y: y + 50*s, w: 10*s, h: 20*s }, ]; };
  const generatePDF = async (repSongs: Song[], repTheme: string, repDate: string, creatorName: string, columns: 1 | 2 | 3 = 1, headerTitle: string = "Ministério de Música Uziel") => {
    try {
      setIsGeneratingPDF(true);
      setPdfProgress({ current: 0, total: repSongs.length });

      const doc = new jsPDF();
      const margin = 15; // Slightly reduced margin for 3 columns
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Column Configuration
      const colCount = columns;
      const colGap = 5;
      const colWidth = (pageWidth - (margin * 2) - (colGap * (colCount - 1))) / colCount;
      
      let currentCol = 0;
      let yPos = 20;

      // Helper to get current X based on column
      const getX = () => margin + (currentCol * (colWidth + colGap));



      // Header (Only on first page, spans all columns)
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 170, 226); // Brand Blue
      doc.text(headerTitle, pageWidth / 2, yPos, { align: "center" });
      yPos += 10;
      
      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      doc.text(`Repertório: ${repTheme}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 8;
      
      doc.setFontSize(12);
      doc.setTextColor(100);
      const formattedDate = new Date(repDate + 'T12:00:00').toLocaleDateString('pt-BR');
      doc.text(`Data: ${formattedDate} | Criado por: ${creatorName}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 10;
      doc.setDrawColor(200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 15;

      const startYFirstPage = yPos;

      // Helper to check page/column break
      const checkPageBreak = (heightNeeded: number) => {
        if (yPos + heightNeeded > pageHeight - margin) {
          if (currentCol < colCount - 1) {
            // Move to next column
            currentCol++;
            // If on first page, respect header height
            if (doc.getNumberOfPages() === 1) {
                yPos = startYFirstPage;
            } else {
                yPos = 20; // Top margin for new column on subsequent pages
            }
          } else {
            // New Page
            doc.addPage();
            currentCol = 0;
            yPos = 20;
          }
          return true;
        }
        return false;
      };

      for (let i = 0; i < repSongs.length; i++) {
        const song = repSongs[i];
        setPdfProgress({ current: i + 1, total: repSongs.length });
        
        checkPageBreak(40); // Ensure title fits

        // Song Title
        // 1 col: 16, 2 col: 14, 3 col: 12
        const titleSize = columns === 1 ? 16 : (columns === 2 ? 14 : 12);
        doc.setFontSize(titleSize);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        
        // Wrap title if needed
        const titleLines = doc.splitTextToSize(`${i + 1}. ${song.title} (${song.type})`, colWidth);
        doc.text(titleLines, getX(), yPos);
        yPos += (titleLines.length * (columns === 1 ? 7 : (columns === 2 ? 6 : 5)));

        // Metadata
        // 1 col: 10, 2 col: 9, 3 col: 8
        const metaSize = columns === 1 ? 10 : (columns === 2 ? 9 : 8);
        doc.setFontSize(metaSize);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100);
        
        const metaText = `Tom: ${song.key || 'N/A'} | Artista: ${song.artist || 'N/A'}`;
        const metaLines = doc.splitTextToSize(metaText, colWidth);
        doc.text(metaLines, getX(), yPos);
        yPos += (metaLines.length * (columns === 1 ? 5 : (columns === 2 ? 4 : 3)));
        yPos += (columns === 1 ? 5 : (columns === 2 ? 4 : 3)); // Extra padding after metadata

        // Process Lyrics with AI for PDF (Chorus expansion, formatting)
        let processedLyrics = song.lyrics;
        try {
            const result = await smartProcessLyrics(song.lyrics, 'pdf');
            if (typeof result === 'string') {
                processedLyrics = result;
            }
        } catch (e) {
            console.warn("PDF AI processing failed, falling back to raw lyrics", e);
        }

        // Lyrics Rendering
        const lines = processedLyrics.split(/\r\n|\r|\n/);
        
        lines.forEach(line => {
            if (!line.trim()) {
                yPos += (columns === 1 ? 5 : (columns === 2 ? 4 : 3));
                return;
            }

            // Check if line has chords
            if (line.includes('[')) {
                // CHORD LINE RENDERING
                const chordFontSize = columns === 1 ? 10 : (columns === 2 ? 9 : 8);
                const lyricFontSize = columns === 1 ? 12 : (columns === 2 ? 10 : 9);
                const chordHeight = columns === 1 ? 5 : (columns === 2 ? 4 : 3);
                const lyricHeight = columns === 1 ? 6 : (columns === 2 ? 5 : 4);
                const totalLineHeight = chordHeight + lyricHeight + (columns === 1 ? 2 : 1);

                checkPageBreak(totalLineHeight);

                let currentX = getX();
                
                // Split logic from ChordRenderer
                const parts = line.split(/(\[[^\]]+\])/g);
                let currentChord = '';
                
                // Group into blocks
                const blocks: {chord: string, lyric: string}[] = [];
                parts.forEach(part => {
                    if (part.startsWith('[') && part.endsWith(']')) {
                        if (currentChord) {
                            blocks.push({ chord: currentChord, lyric: '' });
                        }
                        currentChord = part.replace(/[\[\]]/g, '');
                    } else {
                        blocks.push({ chord: currentChord, lyric: part });
                        currentChord = '';
                    }
                });
                if (currentChord) blocks.push({ chord: currentChord, lyric: '' });

                // Render Blocks
                blocks.forEach(block => {
                    // Calculate Widths
                    doc.setFontSize(chordFontSize);
                    doc.setFont("helvetica", "bold");
                    const chordWidth = doc.getTextWidth(block.chord);

                    doc.setFontSize(lyricFontSize);
                    const tokens = parseRichText(block.lyric);
                    let lyricWidth = 0;
                    tokens.forEach(t => {
                        doc.setFont("helvetica", t.bold ? "bold" : (t.italic ? "italic" : "normal"));
                        lyricWidth += doc.getTextWidth(t.text.toUpperCase());
                    });

                    const blockWidth = Math.max(chordWidth, lyricWidth) + 1;

                    // Wrap if needed (basic wrapping for chords is hard, so we just clip/overflow or move to next line if huge)
                    // For 3 columns, wrapping is more likely needed.
                    if (currentX + blockWidth > getX() + colWidth) {
                        currentX = getX();
                        yPos += totalLineHeight;
                        checkPageBreak(totalLineHeight);
                    }

                    // Draw Chord
                    if (block.chord) {
                        doc.setFontSize(chordFontSize);
                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(41, 170, 226); // Brand Blue
                        doc.text(block.chord, currentX, yPos);
                    }

                    // Draw Lyric
                    if (block.lyric) {
                        let localX = currentX;
                        doc.setFontSize(lyricFontSize);
                        tokens.forEach(t => {
                            doc.setFont("helvetica", t.bold ? "bold" : (t.italic ? "italic" : "normal"));
                            
                            // Color handling
                            if (t.color) {
                                doc.setTextColor(t.color);
                            } else {
                                doc.setTextColor(0); // Default black
                            }

                            const upperText = t.text.toUpperCase();
                            doc.text(upperText, localX, yPos + chordHeight);
                            localX += doc.getTextWidth(upperText);
                        });
                    }

                    currentX += blockWidth;
                });

                yPos += totalLineHeight;

            } else {
                // TEXT ONLY LINE RENDERING
                const fontSize = columns === 1 ? 12 : (columns === 2 ? 10 : 9);
                const lineHeight = columns === 1 ? 6 : (columns === 2 ? 5 : 4);
                doc.setFontSize(fontSize);
                
                checkPageBreak(lineHeight);

                const tokens = parseRichText(line);
                let currentX = getX();

                tokens.forEach(t => {
                    doc.setFont("helvetica", t.bold ? "bold" : (t.italic ? "italic" : "normal"));
                    if (t.color) doc.setTextColor(t.color);
                    else doc.setTextColor(0);

                    // Word wrapping for text lines
                    const words = t.text.toUpperCase().split(/(\s+)/); // Split keeping spaces
                    
                    words.forEach(word => {
                        const wordWidth = doc.getTextWidth(word);
                        if (currentX + wordWidth > getX() + colWidth) {
                            currentX = getX();
                            yPos += lineHeight;
                            checkPageBreak(lineHeight);
                        }
                        doc.text(word, currentX, yPos);
                        currentX += wordWidth;
                    });
                });
                
                yPos += lineHeight;
            }
        });

        yPos += (columns === 1 ? 10 : (columns === 2 ? 8 : 5));
      }

      doc.save(`Repertorio_${normalizeFilename(repTheme)}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF. Verifique o console.");
    } finally {
      setIsGeneratingPDF(false);
      setPdfProgress({ current: 0, total: 0 });
    }
  };

  const generatePPTX = async (repSongs: Song[], repTheme: string, repDate: string, creatorName?: string, ratio: '16:9' | '4:3' = '16:9') => {
    try {
      setIsGeneratingPPTX(true);
      setPptxProgress({ current: 0, total: repSongs.length });

      const pptx = new pptxgen();
      pptx.layout = ratio === '16:9' ? 'LAYOUT_16x9' : 'LAYOUT_4x3';

      // Title Slide
      let slide = pptx.addSlide();
      slide.background = { color: "0B1221" };
      
      slide.addText("MINISTÉRIO DE MÚSICA UZIEL", {
        x: 0, y: "30%", w: "100%", align: "center",
        fontSize: 24, color: "29AAE2", bold: true
      });
      
      slide.addText(repTheme.toUpperCase(), {
        x: 0, y: "45%", w: "100%", align: "center",
        fontSize: 44, color: "FFFFFF", bold: true, wrap: true
      });
      
      const formattedDate = new Date(repDate + 'T12:00:00').toLocaleDateString('pt-BR');
      slide.addText(formattedDate, {
        x: 0, y: "65%", w: "100%", align: "center",
        fontSize: 18, color: "8E8E93"
      });

      // Song Slides
      for (let i = 0; i < repSongs.length; i++) {
        const song = repSongs[i];
        setPptxProgress({ current: i + 1, total: repSongs.length });

        let chunks: string[] = [];
        
        // Always use Gemini for intelligent processing (Chorus expansion, formatting, splitting)
        try {
            const result = await smartProcessLyrics(song.lyrics, 'pptx');
            if (Array.isArray(result)) {
                chunks = result;
            } else if (typeof result === 'string') {
                // Fallback if it returns a string (shouldn't happen for pptx mode but safe to handle)
                chunks = [result];
            }
        } catch (e) {
            console.warn("Gemini PPTX processing failed, falling back to simple split", e);
            // Fallback logic
            let clean = song.lyrics.replace(/\[.*?\]/g, '')
                .replace(/<c:#[a-fA-F0-9]{3,6}>|<\/c>/g, '')
                .replace(/\*\*/g, '').replace(/\*/g, '');
            const lines = clean.split('\n').filter(l => l.trim());
            for (let j = 0; j < lines.length; j += 5) {
                chunks.push(lines.slice(j, j + 5).join('\n'));
            }
        }

        if (!chunks || chunks.length === 0) {
            // Empty slide fallback
            let s = pptx.addSlide();
            s.background = { color: "000000" };
            const headerParts = [song.type.toUpperCase(), song.title.toUpperCase()];
            if (song.artist) headerParts.push(song.artist);
            if (song.key) headerParts.push(`Tom: ${song.key}`);
            
            s.addText(headerParts.join(' | '), {
                x: "5%", y: "5%", w: "90%", h: "10%",
                fontSize: 14, color: "8E8E93", align: "left", bold: true, wrap: true
            });
            
            s.addText(song.title.toUpperCase(), {
                x: 0, y: "40%", w: "100%", align: "center",
                fontSize: 40, color: "FFFFFF", bold: true, wrap: true
            });
            continue;
        }

        chunks.forEach((chunk, idx) => {
          let s = pptx.addSlide();
          s.background = { color: "000000" };
          
          const headerParts = [
            song.type.toUpperCase(),
            song.title.toUpperCase()
          ];
          if (song.artist) headerParts.push(song.artist);
          if (song.key) headerParts.push(`Tom: ${song.key}`);
          const headerText = headerParts.join(' | ');

          s.addText(headerText, {
            x: "5%", y: "5%", w: "90%", h: "10%",
            fontSize: 14, color: "8E8E93", align: "left", bold: true, wrap: true
          });

          s.addText(chunk, {
            x: "5%", y: "18%", w: "90%", h: "70%",
            fontSize: 36, color: "FFFFFF", align: "center", valign: "middle",
            bold: true, wrap: true
          });

          s.addText(`${idx + 1} / ${chunks.length}`, {
            x: "5%", y: "92%", w: "90%", h: "5%",
            fontSize: 12, color: "4A4A4A", align: "right"
          });
        });
      }

      pptx.writeFile({ fileName: `Projecao_${normalizeFilename(repTheme)}.pptx` });
    } catch (error) {
      console.error("Erro ao gerar PPTX:", error);
      alert("Erro ao gerar PPTX. Verifique o console.");
    } finally {
      setIsGeneratingPPTX(false);
      setPptxProgress({ current: 0, total: 0 });
    }
  };
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super-admin';
  const isSuperAdmin = currentUser?.role === 'super-admin';
  const displayHistory = useMemo(() => { const visible = history.filter(h => !h.isPrivate || h.createdBy === currentUser?.username || currentUser?.role === 'super-admin'); const sorted = visible.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); const today = new Date(); today.setHours(0,0,0,0); return sorted.filter(h => { if (filterStatus === 'all') return true; const hDate = new Date(h.date + 'T12:00:00'); hDate.setHours(0,0,0,0); if (filterStatus === 'upcoming') return hDate >= today; if (filterStatus === 'past') return hDate < today; return true; }); }, [history, currentUser, filterStatus]);
  if (initialLoading) return <Loading fullScreen message="Carregando repertórios..." />;
  const isCustomCover = coverImage !== REPERTORY_COVERS[0];

  return (
    <div className="space-y-8 pb-32 animate-fade-in-up w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10 mb-8">
        <div className="relative"><div className="flex items-center gap-2 mb-2"><span className="w-8 h-[2px] bg-brand-500"></span><p className="text-brand-600 dark:text-brand-400 font-bold uppercase tracking-[0.2em] text-[10px]">Liturgia & Louvor</p></div><h1 className="text-4xl md:text-6xl font-display font-bold text-slate-900 dark:text-white leading-[0.9]">Repertório <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-purple-500">Sacro</span></h1><p className="text-slate-500 dark:text-slate-400 mt-2 font-medium max-w-md">Gestão inteligente de cifras, letras e setlists para missas e eventos.</p></div>
        <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex gap-1 shadow-inner">{isAdmin && (<button onClick={() => { resetForm(); setActiveTab('build'); }} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'build' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}><i className="fas fa-plus mr-2"></i> Criar Novo</button>)}<button onClick={() => setActiveTab('history')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}><i className="fas fa-layer-group mr-2"></i> Galeria</button></div>
      </div>
      {activeTab === 'build' && isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-4 sticky top-6 space-y-6 order-2 md:order-1">
                <div className="bg-white/90 dark:bg-slate-800/80 backdrop-blur-xl p-6 rounded-[2rem] shadow-premium border border-slate-100 dark:border-white/5"><div className="space-y-5"><div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Tema</label><input type="text" value={theme} onChange={e => setTheme(e.target.value)} className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 outline-none text-sm font-bold text-slate-700 dark:text-white transition-all" placeholder="Ex: Domingo de Ramos" /></div><div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Data</label><input type="text" value={date} onChange={handleDateChange} placeholder="DD/MM/AAAA" maxLength={10} className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 outline-none text-sm font-bold text-slate-700 dark:text-white transition-all focus:border-brand-500" /></div><div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block ml-1">Capa (Preview)</label><div className="flex flex-col gap-3"><div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm bg-slate-100 dark:bg-white/5 group cursor-zoom-in" onClick={() => setShowFullImage(true)} title="Ver em tela cheia"><img src={coverImage || REPERTORY_COVERS[0]} onError={(e) => { const target = e.target as HTMLImageElement; target.onerror = null; target.src = REPERTORY_COVERS[0]; }} alt="Capa" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]"><div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white"><i className="fas fa-expand text-lg"></i></div></div>{isCustomCover && (<button onClick={(e) => { e.stopPropagation(); setCoverImage(REPERTORY_COVERS[0]); }} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-20" title="Remover Capa e Restaurar Padrão"><i className="fas fa-trash text-xs"></i></button>)}</div><button onClick={handleGenerateCover} disabled={isGeneratingCover} className="group relative w-full py-4 rounded-xl overflow-hidden shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"><div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-brand-600 animate-gradient-x opacity-90 group-hover:opacity-100 transition-opacity"></div><div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div><div className="relative flex items-center justify-center gap-3 z-10"><div className={`text-white text-lg ${isGeneratingCover ? 'animate-spin' : 'animate-bounce'}`} style={{ animationDuration: '3s' }}>{isGeneratingCover ? <i className="fas fa-circle-notch"></i> : <i className="fas fa-wand-magic-sparkles"></i>}</div><span className="font-bold text-white uppercase tracking-wider text-xs drop-shadow-sm">{isGeneratingCover ? 'Criando Arte...' : 'Gerar Capa IA'}</span></div></button></div></div><div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPrivate ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}><i className={`fas ${isPrivate ? 'fa-lock' : 'fa-globe'}`}></i></div><div className="flex flex-col"><span className="text-xs font-bold text-slate-700 dark:text-white">Status</span><span className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">{isPrivate ? 'Privado' : 'Publicado'}</span></div></div><button onClick={() => setIsPrivate(!isPrivate)} className={`w-12 h-7 rounded-full transition-all relative ${isPrivate ? 'bg-slate-300' : 'bg-brand-500'}`}><div className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-all ${isPrivate ? 'left-1' : 'left-6'}`}></div></button></div></div></div><button onClick={handleSave} disabled={isProcessing || isSaveSuccess} className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all duration-500 ease-out ${isSaveSuccess ? 'bg-green-500 text-white shadow-[0_20px_50px_-12px_rgba(34,197,94,0.6)] scale-[1.02]' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg'}`}>{isProcessing ? (<><i className="fas fa-circle-notch fa-spin"></i> Salvando...</>) : isSaveSuccess ? (<><i className="fas fa-check-circle text-lg animate-bounce"></i> Salvo com Sucesso!</>) : (<><i className="fas fa-save"></i> Salvar Tudo</>)}</button>
            </div>
            <div className="md:col-span-8 space-y-4 order-1 md:order-2">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} autoScroll={{ layoutShiftCompensation: false, acceleration: 50, interval: 10 }}>
                    <SortableContext items={songs.map(s => s.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-4">
                            {songs.map((song, index) => (
                                <SortableSongItem key={song.id} song={song} index={index} isExpanded={expandedSong === song.id} toggleExpand={() => setExpandedSong(expandedSong === song.id ? null : song.id)} onUpdate={updateSong} onTranspose={handleTranspose} onDelete={() => handleDeleteSong(song.id)} generatingSongId={generatingSongId} handleGenerateLyrics={handleGenerateLyrics} withChords={withChords} setWithChords={setWithChords} />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
                <button onClick={addSongField} className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-white/10 rounded-[2rem] text-slate-400 hover:border-brand-400 hover:text-brand-500 transition-all font-bold flex flex-col items-center justify-center gap-2 bg-slate-50/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10"><div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center"><i className="fas fa-plus"></i></div><span className="text-sm">Adicionar Música</span></button>
            </div>
        </div>
      )}
      {activeTab === 'history' && (
          <><div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">{[{ id: 'all', label: 'Todos', icon: 'fa-layer-group' }, { id: 'upcoming', label: 'Próximos', icon: 'fa-calendar-check' }, { id: 'past', label: 'Realizados', icon: 'fa-history' }].map((f) => (<button key={f.id} onClick={() => setFilterStatus(f.id as any)} className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap flex items-center gap-2 ${filterStatus === f.id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><i className={`fas ${f.icon}`}></i> {f.label}</button>))}</div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">{displayHistory.map((rep) => { const bgImage = rep.coverImage || REPERTORY_COVERS[0]; const isStaticFallback = bgImage === REPERTORY_COVERS[0]; const shouldUsePremium = isStaticFallback || !rep.coverImage; const isDeleting = deletingId === rep.id; const dateObj = new Date(rep.date + 'T12:00:00'); const today = new Date(); today.setHours(0,0,0,0); const repDate = new Date(rep.date + 'T12:00:00'); repDate.setHours(0,0,0,0); const isUpcoming = repDate >= today; const canManage = isSuperAdmin || (currentUser?.role === 'admin' && rep.createdBy === currentUser?.username); const creatorUser = usersList.find(u => u.username === rep.createdBy); const creatorName = creatorUser ? creatorUser.name.split(' ')[0] : (rep.createdBy ? rep.createdBy.split('@')[0] : 'Uziel'); return (<div key={rep.id} className={`group bg-white dark:bg-[#0b1221] rounded-[2.5rem] p-4 shadow-lg hover:shadow-2xl border border-slate-100 dark:border-white/5 transition-all hover:-translate-y-2 relative flex flex-col ${isDeleting ? 'opacity-50 pointer-events-none' : ''} ${isUpcoming ? 'opacity-100' : 'opacity-60 mix-blend-luminosity hover:mix-blend-normal hover:opacity-100 duration-500'}`}><div onClick={() => { const repWithCover = { ...rep, coverImage: bgImage }; setViewingRep(repWithCover); setActiveTab('view'); }} className="cursor-pointer"><div className="aspect-square rounded-[2rem] relative overflow-hidden p-8 flex flex-col justify-between text-white shadow-md z-0 transform-gpu bg-slate-900">{shouldUsePremium ? (<PremiumBackground variant="golden" />) : (<div className="absolute inset-0"><img src={bgImage} onError={(e) => { const target = e.target as HTMLImageElement; target.onerror = null; target.src = REPERTORY_COVERS[0]; }} alt="Capa" className="absolute inset-0 w-full h-full object-cover transition-transform duration-[10s] ease-in-out group-hover:scale-110 opacity-60 rounded-[2rem] animate-breathing" /></div>)}<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/20 rounded-[2rem]"></div><div className="flex justify-between items-start z-10"><span className="text-6xl font-display font-bold text-white drop-shadow-lg">{dateObj.getDate()}</span>{rep.isPrivate && <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20"><i className="fas fa-lock text-xs"></i></div>}</div><div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10"><div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-[10px] font-bold shadow-sm overflow-hidden">{creatorUser?.photoURL ? (<img src={creatorUser.photoURL} alt={creatorName} className="w-full h-full object-cover" />) : (creatorName.charAt(0).toUpperCase())}</div><span className="text-[10px] font-bold text-white uppercase tracking-wider">{creatorName}</span></div></div><div className="mt-5 mb-3 px-2"><span className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-1">{dateObj.toLocaleDateString('pt-BR', {month:'long', year:'numeric'})}</span><span className="block font-bold text-xl leading-tight line-clamp-2 text-slate-800 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{rep.theme || 'Culto de Domingo'}</span></div></div><div className="mt-auto px-2 pb-2 flex justify-between items-center relative z-20 border-t border-slate-100 dark:border-white/5 pt-4"><span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><i className="fas fa-music text-brand-500"></i> {rep.songs.length} faixas</span><div className="flex gap-2"><button onClick={(e) => { e.stopPropagation(); setPdfChoiceModal({ isOpen: true, rep }); }} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 flex items-center justify-center transition-all active:scale-90 active:bg-red-50 dark:active:bg-red-900/20 group/pdf"><i className="fas fa-file-pdf transition-transform group-active/pdf:scale-75 group-active/pdf:text-red-500"></i></button><button onClick={(e) => { e.stopPropagation(); setPptxChoiceModal({ isOpen: true, rep }); }} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 flex items-center justify-center transition-all active:scale-90 active:bg-orange-50 dark:active:bg-orange-900/20 group/pptx"><i className="fas fa-file-powerpoint transition-transform group-active/pptx:scale-75 group-active/pptx:text-orange-500"></i></button>{canManage && <button onClick={() => loadForEditing(rep)} className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 hover:bg-brand-100 dark:hover:bg-brand-500/20 text-brand-500 flex items-center justify-center transition-colors"><i className="fas fa-pen"></i></button>}{canManage && <button onClick={(e) => requestDelete(e, rep.id!)} disabled={isDeleting} className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-colors disabled:opacity-50">{isDeleting ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-trash"></i>}</button>}</div></div></div>); })} {displayHistory.length === 0 && (<div className="col-span-full py-20 text-center opacity-50 flex flex-col items-center"><div className="w-24 h-24 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4"><i className="fas fa-folder-open text-44 text-slate-300"></i></div><p className="font-bold text-slate-400">Nenhum repertório encontrado.</p></div>)}</div></>
      )}
      {activeTab === 'view' && viewingRep && (
         <div className="space-y-8 animate-fade-in-up"><div className="flex justify-between items-center"><button onClick={() => setActiveTab('history')} className="flex items-center gap-2 text-slate-500 hover:text-brand-600 font-bold text-xs uppercase tracking-widest bg-white dark:bg-white/5 px-6 py-3 rounded-xl shadow-sm w-fit transition-colors border border-slate-200 dark:border-white/5"><i className="fas fa-arrow-left"></i> Voltar</button><div className="flex gap-2"><button onClick={() => setPdfChoiceModal({ isOpen: true, rep: viewingRep })} className="px-6 py-3 rounded-xl bg-white dark:bg-white/10 text-slate-800 dark:text-white font-bold hover:bg-slate-100 dark:hover:bg-white/20 transition-all active:scale-95 active:shadow-inner flex items-center gap-2 shadow-sm text-xs uppercase tracking-wider group"><i className="fas fa-file-pdf text-red-500 text-lg transition-transform group-active:scale-125 group-active:rotate-12"></i> PDF</button><button onClick={() => setPptxChoiceModal({ isOpen: true, rep: viewingRep })} className="px-6 py-3 rounded-xl bg-white dark:bg-white/10 text-slate-800 dark:text-white font-bold hover:bg-slate-100 dark:hover:bg-white/20 transition-all active:scale-95 active:shadow-inner flex items-center gap-2 shadow-sm text-xs uppercase tracking-wider group"><i className="fas fa-file-powerpoint text-orange-400 text-lg transition-transform group-active:scale-125 group-active:rotate-12"></i> PPTX</button></div></div><div className="bg-slate-900 rounded-[3rem] p-10 md:p-16 text-center shadow-2xl relative overflow-hidden text-white group">{(() => { const bgImage = viewingRep.coverImage || REPERTORY_COVERS[0]; const isStaticFallback = bgImage === REPERTORY_COVERS[0]; const shouldUsePremium = isStaticFallback || !viewingRep.coverImage; if (shouldUsePremium) { return <PremiumBackground variant="golden" />; } return ( <img src={bgImage} onError={(e) => { const target = e.target as HTMLImageElement; target.onerror = null; target.src = REPERTORY_COVERS[0]; }} alt="Capa Hero" className="absolute inset-0 w-full h-full object-cover opacity-60 animate-breathing" /> ); })()}<div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div><div className="relative z-10 max-w-3xl mx-auto"><span className="inline-block px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-bold uppercase tracking-widest mb-6">Repertório Oficial</span><h2 className="text-5xl md:text-7xl font-display font-bold mb-4 text-shadow-lg">{viewingRep.theme}</h2><p className="text-slate-300 font-medium text-lg uppercase tracking-widest flex justify-center items-center gap-3"><i className="fas fa-calendar"></i> {new Date(viewingRep.date + 'T12:00:00').toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'})}</p><div className="mt-4 flex justify-center items-center gap-2 opacity-70">{(() => { const creatorUser = usersList.find(u => u.username === viewingRep.createdBy); const creatorName = creatorUser ? creatorUser.name.split(' ')[0] : (viewingRep.createdBy ? viewingRep.createdBy.split('@')[0] : 'Uziel'); return (<><div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-[10px] font-bold overflow-hidden">{creatorUser?.photoURL ? <img src={creatorUser.photoURL} className="w-full h-full object-cover" /> : creatorName.charAt(0).toUpperCase()}</div><span className="text-xs font-bold uppercase tracking-wider">Criado por {creatorName}</span></>); })()}</div></div></div><div className="space-y-6 max-w-5xl mx-auto">{viewingRep.songs.map((song, idx) => { const spotifyUrl = getSpotifyEmbedUrl(song.link); const youtubeUrl = getYoutubeEmbedUrl(song.link); const currentRootKey = song.key ? song.key.replace(/m.*/, '') : ''; const hasChords = song.lyrics.includes('['); return (<div key={idx} className="bg-white dark:bg-[#0b1221] rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden transition-all duration-300 md:hover:scale-[1.01] hover:shadow-2xl group"><div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 dark:bg-white/[0.02]"><div className="flex items-center gap-4 w-full justify-center md:justify-start"><div className="w-12 h-12 md:w-20 md:h-20 rounded-2xl bg-white dark:bg-white/10 flex items-center justify-center text-xl md:text-3xl font-bold text-slate-300 dark:text-slate-500 shadow-sm border border-slate-100 dark:border-white/5 transition-all duration-300 group-hover:bg-brand-500 group-hover:text-white group-hover:scale-110">{idx + 1}</div><div className="text-center md:text-left"><div className="flex items-center justify-center md:justify-start gap-2 md:gap-3 mb-1 md:mb-2"><span className="px-2 py-0.5 md:px-3 md:py-1 rounded-md bg-slate-200 dark:bg-white/10 text-[10px] md:text-sm font-bold uppercase text-slate-600 dark:text-slate-300">{song.type}</span>{hasChords && (<div className="relative group/key" onClick={e => e.stopPropagation()}><select value={currentRootKey} onChange={e => handleViewTranspose(song.id, e.target.value)} className="appearance-none bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-bold text-[10px] md:text-sm py-0.5 md:py-1 pl-2 md:pl-3 pr-5 md:pr-8 rounded-md cursor-pointer outline-none hover:bg-brand-200 dark:hover:bg-brand-900/50 transition-colors">{MusicUtils.KEYS.map(k => (<option key={k} value={k}>{k}</option>))}</select><div className="absolute right-1.5 md:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-brand-600 dark:text-brand-400 text-[8px] md:text-xs"><i className="fas fa-chevron-down"></i></div></div>)}</div><h3 className="text-2xl md:text-5xl font-bold text-slate-800 dark:text-white leading-tight md:leading-tight">{song.title}</h3>{song.artist && <p className="text-sm md:text-xl font-bold text-slate-400 mt-1">{song.artist}</p>}</div></div>{song.link && !spotifyUrl && !youtubeUrl && (<a href={song.link} target="_blank" rel="noreferrer" className="px-6 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs uppercase tracking-wider hover:scale-105 transition-transform flex items-center gap-2 shadow-lg"><i className="fas fa-external-link-alt"></i> Ouvir Mídia</a>)}</div><div className="flex flex-col"><div className="p-4 md:p-8 w-full"><ChordRenderer text={song.lyrics} center={true} /></div>{(spotifyUrl || youtubeUrl) && (<div className="bg-slate-50/50 dark:bg-black/20 border-t border-slate-100 dark:border-white/5 w-full p-4 md:p-6"><div className="max-w-4xl mx-auto">{spotifyUrl ? (<div className="w-full rounded-xl overflow-hidden shadow-sm"><iframe src={spotifyUrl} width="100%" height="152" frameBorder="0" allowFullScreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>) : (<div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg bg-black"><iframe src={youtubeUrl!} width="100%" height="100%" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe></div>)}</div></div>)}</div></div>); })}</div></div>
      )}
      {showFullImage && ( <ImageViewer src={coverImage || REPERTORY_COVERS[0]} onClose={() => setShowFullImage(false)} /> )}
      {isGeneratingPDF && createPortal(
        <div className="fixed inset-0 z-[10000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-white/20 animate-scale-in text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center text-3xl mx-auto mb-6 shadow-sm border border-red-100 dark:border-red-500/20">
                    <i className="fas fa-file-pdf"></i>
                </div>
                <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-2">Gerando PDF</h3>
                <div className="flex flex-col items-center justify-center py-4 animate-fade-in">
                    <div className="w-12 h-12 border-4 border-red-200 border-t-red-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-red-500 font-bold text-sm animate-pulse">
                        Processando música {pdfProgress.current} de {pdfProgress.total}...
                    </p>
                    <p className="text-xs text-slate-400 mt-2">Expandindo refrões e formatando...</p>
                </div>
            </div>
        </div>, document.body
      )}
      {pdfChoiceModal.isOpen && createPortal(<div className="fixed inset-0 z-[10000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"><div className="w-full max-w-sm bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-white/20 animate-scale-in text-center"><div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center text-3xl mx-auto mb-6 shadow-sm border border-red-100 dark:border-red-500/20"><i className="fas fa-file-pdf"></i></div><h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-2">Exportar PDF</h3><p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">Escolha o layout ideal para impressão.</p>
      
      <div className="mb-6 text-left">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Título do Cabeçalho</label>
        <input 
          type="text" 
          value={pdfHeaderTitle} 
          onChange={(e) => setPdfHeaderTitle(e.target.value)} 
          className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-700 dark:text-white focus:border-brand-500 outline-none transition-colors"
          placeholder="Ex: Ministério de Música Uziel"
        />
      </div>

      <div className="flex flex-col gap-3">
            <button onClick={async () => { if(pdfChoiceModal.rep) { const creatorUser = usersList.find(u => u.username === pdfChoiceModal.rep?.createdBy); const creatorName = creatorUser ? creatorUser.name.split(' ')[0] : (pdfChoiceModal.rep?.createdBy ? pdfChoiceModal.rep.createdBy.split('@')[0] : 'Uziel'); await generatePDF(pdfChoiceModal.rep.songs, pdfChoiceModal.rep.theme, pdfChoiceModal.rep.date, creatorName, 1, pdfHeaderTitle); setPdfChoiceModal({ isOpen: false, rep: null }); } }} className="w-full py-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all flex items-center justify-between px-6 group"><div className="flex flex-col items-start"><span className="text-sm font-bold text-slate-700 dark:text-white group-hover:text-brand-600 transition-colors">1 Coluna (Padrão)</span><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Letras grandes, fácil leitura</span></div><i className="fas fa-file-alt text-slate-300 group-hover:text-brand-500"></i></button>
            <button onClick={async () => { if(pdfChoiceModal.rep) { const creatorUser = usersList.find(u => u.username === pdfChoiceModal.rep?.createdBy); const creatorName = creatorUser ? creatorUser.name.split(' ')[0] : (pdfChoiceModal.rep?.createdBy ? pdfChoiceModal.rep.createdBy.split('@')[0] : 'Uziel'); await generatePDF(pdfChoiceModal.rep.songs, pdfChoiceModal.rep.theme, pdfChoiceModal.rep.date, creatorName, 2, pdfHeaderTitle); setPdfChoiceModal({ isOpen: false, rep: null }); } }} className="w-full py-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all flex items-center justify-between px-6 group"><div className="flex flex-col items-start"><span className="text-sm font-bold text-slate-700 dark:text-white group-hover:text-brand-600 transition-colors">2 Colunas (Equilibrado)</span><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bom equilíbrio entre espaço e tamanho</span></div><i className="fas fa-columns text-slate-300 group-hover:text-brand-500"></i></button>
            <button onClick={async () => { if(pdfChoiceModal.rep) { const creatorUser = usersList.find(u => u.username === pdfChoiceModal.rep?.createdBy); const creatorName = creatorUser ? creatorUser.name.split(' ')[0] : (pdfChoiceModal.rep?.createdBy ? pdfChoiceModal.rep.createdBy.split('@')[0] : 'Uziel'); await generatePDF(pdfChoiceModal.rep.songs, pdfChoiceModal.rep.theme, pdfChoiceModal.rep.date, creatorName, 3, pdfHeaderTitle); setPdfChoiceModal({ isOpen: false, rep: null }); } }} className="w-full py-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all flex items-center justify-between px-6 group"><div className="flex flex-col items-start"><span className="text-sm font-bold text-slate-700 dark:text-white group-hover:text-brand-600 transition-colors">3 Colunas (Compacto)</span><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Economiza papel, estilo livreto</span></div><i className="fas fa-columns text-slate-300 group-hover:text-brand-500"></i></button>
            <button onClick={() => setPdfChoiceModal({ isOpen: false, rep: null })} className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">Cancelar</button>
        </div>
      </div></div>, document.body)}
      {pptxChoiceModal.isOpen && createPortal(<div className="fixed inset-0 z-[10000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"><div className="w-full max-w-sm bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-white/20 animate-scale-in text-center"><div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-500 flex items-center justify-center text-3xl mx-auto mb-6 shadow-sm border border-orange-100 dark:border-orange-500/20"><i className="fas fa-file-powerpoint"></i></div><h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-2">Exportar PowerPoint</h3><p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">Escolha a proporção ideal para a projeção da sua igreja.</p>
      
      {isGeneratingPPTX ? (
        <div className="flex flex-col items-center justify-center py-4 animate-fade-in">
            <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-4"></div>
            <p className="text-orange-500 font-bold text-sm animate-pulse">
                Processando música {pptxProgress.current} de {pptxProgress.total}...
            </p>
            <p className="text-xs text-slate-400 mt-2">Utilizando IA para otimizar quebras de linha...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
            <button onClick={async () => { if(pptxChoiceModal.rep) { const creatorUser = usersList.find(u => u.username === pptxChoiceModal.rep?.createdBy); const creatorName = creatorUser ? creatorUser.name.split(' ')[0] : (pptxChoiceModal.rep?.createdBy ? pptxChoiceModal.rep.createdBy.split('@')[0] : 'Uziel'); await generatePPTX(pptxChoiceModal.rep.songs, pptxChoiceModal.rep.theme, pptxChoiceModal.rep.date, creatorName, '16:9'); setPptxChoiceModal({ isOpen: false, rep: null }); } }} className="w-full py-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all flex items-center justify-between px-6 group"><div className="flex flex-col items-start"><span className="text-sm font-bold text-slate-700 dark:text-white group-hover:text-brand-600 transition-colors">Widescreen (16:9)</span><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ideal para TVs e LEDs modernos</span></div><i className="fas fa-desktop text-slate-300 group-hover:text-brand-500"></i></button>
            <button onClick={async () => { if(pptxChoiceModal.rep) { const creatorUser = usersList.find(u => u.username === pptxChoiceModal.rep?.createdBy); const creatorName = creatorUser ? creatorUser.name.split(' ')[0] : (pptxChoiceModal.rep?.createdBy ? pptxChoiceModal.rep.createdBy.split('@')[0] : 'Uziel'); await generatePPTX(pptxChoiceModal.rep.songs, pptxChoiceModal.rep.theme, pptxChoiceModal.rep.date, creatorName, '4:3'); setPptxChoiceModal({ isOpen: false, rep: null }); } }} className="w-full py-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all flex items-center justify-between px-6 group"><div className="flex flex-col items-start"><span className="text-sm font-bold text-slate-700 dark:text-white group-hover:text-brand-600 transition-colors">Padrão (4:3)</span><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ideal para projetores antigos</span></div><i className="fas fa-square text-slate-300 group-hover:text-brand-500"></i></button>
            <button onClick={() => setPptxChoiceModal({ isOpen: false, rep: null })} className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">Cancelar</button>
        </div>
      )}
      </div></div>, document.body)}
      <DeleteConfirmationModal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))} onConfirm={deleteModal.onConfirm} title={deleteModal.title} description={deleteModal.description} isProcessing={isProcessing} />
    </div>
  );
};

export default RepertoryGenerator;
