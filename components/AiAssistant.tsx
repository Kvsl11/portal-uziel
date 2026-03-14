
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { generateChatResponse, generateImageFromChat, generateSpeech, getTimeUntilQuotaReset } from '../services/geminiService';
import { ContextService } from '../services/contextService'; // Import Context Service
import ImageViewer from './ImageViewer';
import ChordRenderer from './ChordRenderer';
import { motion, AnimatePresence } from 'framer-motion';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { useAuth } from '../context/AuthContext';
import { AuditService, ChatService, UserService } from '../services/firebase';
import { MediaUtils } from '../utils/mediaUtils';

// --- QUOTA TIMER COMPONENT ---
const QuotaTimer = () => {
    const [timeLeft, setTimeLeft] = useState(getTimeUntilQuotaReset());

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft(getTimeUntilQuotaReset());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-500 shrink-0">
                <i className="fas fa-hourglass-half animate-pulse"></i>
            </div>
            <div>
                <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-0.5">Cota Esgotada</p>
                <p className="text-sm text-red-600 dark:text-red-300 font-medium">
                    O limite gratuito da API foi atingido. A cota será renovada em: <span className="font-mono font-bold bg-white/50 dark:bg-slate-900/40 px-1.5 py-0.5 rounded">{timeLeft}</span>
                </p>
            </div>
        </div>
    );
};

// --- ICONS (Monochromatic / Brand Themed) ---

const GeminiLogo = ({ className = "w-6 h-6", isAnimating = false }: { className?: string, isAnimating?: boolean }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={`${className} ${isAnimating ? 'animate-pulse' : ''}`}>
        <path d="M11.691 1.70464C11.8384 1.2587 12.4746 1.2587 12.622 1.70464L14.2882 6.74619C14.6548 7.85539 15.5303 8.73087 16.6395 9.09746L21.6811 10.7637C22.127 10.9111 22.127 11.5473 21.6811 11.6947L16.6395 13.3609C15.5303 13.7275 14.6548 14.603 14.2882 15.7122L12.622 20.7538C12.4746 21.1997 11.8384 21.1997 11.691 20.7538L10.0248 15.7122C9.65821 14.603 8.78274 13.7275 7.67354 13.3609L2.63199 11.6947C2.18605 11.5473 2.18605 10.9111 2.63199 10.7637L7.67354 9.09746C8.78274 8.73087 9.65821 7.85539 10.0248 6.74619L11.691 1.70464Z" />
    </svg>
);

// --- HELPER: ROBUST MARKDOWN PARSER ---
const formatMessage = (text: string) => {
  if (!text) return '';
  let formatted = text;

  // 1. Sanitize Basic HTML chars
  formatted = formatted.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 2. Headers
  formatted = formatted.replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-slate-900 dark:text-white mt-3 mb-1.5 border-l-4 border-brand-500 pl-3">$1</h3>');
  formatted = formatted.replace(/^## (.*$)/gim, '<h2 class="text-base font-bold text-slate-900 dark:text-white mt-4 mb-2 pb-1 border-b border-slate-100 dark:border-white/10">$1</h2>');

  // 3. Bold
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-brand-600 dark:text-brand-400">$1</strong>');

  // 4. Italic
  formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic text-slate-500 dark:text-slate-400">$1</em>');

  // 5. Code Blocks
  formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-slate-100 dark:bg-slate-900/40 px-1.5 py-0.5 rounded text-xs font-mono text-brand-600 dark:text-brand-400 border border-slate-200 dark:border-white/10 inline-block align-middle">$1</code>');

  // 6. Blockquotes
  formatted = formatted.replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-slate-300 dark:border-slate-600 pl-4 italic text-slate-500 dark:text-slate-400 my-2 py-1 bg-slate-50 dark:bg-white/5 rounded-r-lg">$1</blockquote>');

  // 7. Lists
  formatted = formatted.replace(/^\s*[-*]\s+(.*)$/gm, '<div class="flex items-start gap-2 ml-1 mb-1.5"><span class="text-brand-400 mt-1.5 text-[5px] shrink-0"><i class="fas fa-circle"></i></span><span class="flex-1 text-slate-700 dark:text-slate-300">$1</span></div>');

  // 8. Chords
  formatted = formatted.replace(/\[([A-G][a-z0-9#\/]*)\]/g, '<span class="text-brand-600 dark:text-brand-400 font-extrabold text-xs mx-0.5 relative -top-0.5 border-b-2 border-transparent hover:border-brand-500 transition-colors cursor-default" title="Acorde">$1</span>');

  // 9. Line breaks
  formatted = formatted.replace(/\n/g, '<br />');

  return formatted;
};

// Helper to extract YouTube ID
const extractYoutubeId = (text: string) => {
    const regex = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = text.match(regex);
    return match ? match[1] : null;
};

const getSpotifyEmbed = (url: string) => {
    if (!url) return null;
    const regex = /(?:https?:\/\/)?(?:open\.spotify\.com\/)(?:intl-[a-z]{2}\/)?(track|playlist|album|artist)\/([a-zA-Z0-9]{22})/g;
    const match = url.match(regex);
    return match ? `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0` : null;
};

const getFallbackFavicon = (domain: string) => {
    const letter = (domain.charAt(0) || '?').toUpperCase();
    return `https://ui-avatars.com/api/?name=${letter}&background=random&color=fff&size=64`;
};

const EMOJIS = ['😀', '😂', '🙏', '🙌', '🔥', '❤️', '👍', '⛪', '🎸', '🎹', '🎵', '🎤', '🕊️', '📖', '✝️'];
const VOICES = ['Kore', 'Fenrir', 'Puck', 'Charon', 'Aoede', 'Zephyr'];

type ChatMode = 'chat' | 'search' | 'image';

interface AiAssistantProps {
  embedded?: boolean;
  initialPrompt?: string;
  autoRun?: boolean;
  onApply?: (text: string) => void;
  onClose?: () => void;
  currentPage?: string;
  hidden?: boolean;
}

// --- MUSIC RESULT CARD ---
const MusicResultCard = ({ data }: { data: any }) => {
    const [showLyrics, setShowLyrics] = useState(false);
    const spotifyEmbedUrl = data.spotifyUrl ? getSpotifyEmbed(data.spotifyUrl) : null;
    const youtubeId = data.youtubeUrl ? extractYoutubeId(data.youtubeUrl) : null;

    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-md">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <p className="text-[10px] uppercase font-bold tracking-widest text-brand-600 dark:text-brand-400">Resultado da Música</p>
                <h4 className="font-bold text-lg text-slate-800 dark:text-white">{data.title}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{data.artist}</p>
            </div>
            
            <div className="p-4 space-y-4">
                {youtubeId && (
                    <div className="rounded-xl overflow-hidden aspect-video">
                        <iframe 
                            src={`https://www.youtube.com/embed/${youtubeId}`} 
                            title="YouTube video player" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowFullScreen
                            className="w-full h-full"
                        ></iframe>
                    </div>
                )}
                {spotifyEmbedUrl && !youtubeId && (
                    <div className="rounded-xl overflow-hidden">
                        <iframe 
                            src={spotifyEmbedUrl} 
                            width="100%" 
                            height="152" 
                            allowFullScreen 
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                            loading="lazy"
                        ></iframe>
                    </div>
                )}
                
                <div className="flex gap-2">
                    {data.content && (
                         <button onClick={() => setShowLyrics(!showLyrics)} className="flex-1 py-2 px-4 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-bold uppercase transition-colors text-slate-600 dark:text-slate-300">
                             {showLyrics ? 'Ocultar' : 'Ver'} Letra/Cifra <i className={`fas fa-chevron-down text-xs transition-transform ${showLyrics ? 'rotate-180' : ''}`}></i>
                         </button>
                    )}
                    {data.spotifyUrl && !spotifyEmbedUrl && <a href={data.spotifyUrl} target="_blank" rel="noreferrer" className="flex-1 py-2 px-4 rounded-lg bg-green-100 text-green-700 text-xs font-bold uppercase transition-colors text-center hover:bg-green-200"><i className="fab fa-spotify mr-1"></i> Spotify</a>}
                    {data.youtubeUrl && !youtubeId && <a href={data.youtubeUrl} target="_blank" rel="noreferrer" className="flex-1 py-2 px-4 rounded-lg bg-red-100 text-red-700 text-xs font-bold uppercase transition-colors text-center hover:bg-red-200"><i className="fab fa-youtube mr-1"></i> YouTube</a>}
                </div>
            </div>

            {showLyrics && data.content && (
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-t border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto">
                    <ChordRenderer text={data.content} />
                </div>
            )}
        </div>
    );
};

// --- AUDIO HELPERS ---
function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

const sanitizeModelOutput = (text: string): string => {
  if (!text) return '';
  let cleanedText = text;
  cleanedText = cleanedText.replace(/\)\s*;\s*}\s*;?\s*$/g, '');
  cleanedText = cleanedText.replace(/}\s*;?\s*$/g, '');
  cleanedText = cleanedText.replace(/\)\s*$/g, '');
  cleanedText = cleanedText.replace(/uisar\s*$/g, '');
  cleanedText = cleanedText.replace(/;\s*$/g, '');
  return cleanedText.trim(); 
};


export const AiAssistant: React.FC<AiAssistantProps> = ({ 
    embedded = false, 
    initialPrompt = '', 
    autoRun = false, 
    onApply, 
    onClose, 
    currentPage = '/',
    hidden = false 
}) => {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [enableTransition, setEnableTransition] = useState(false);
  
  const [messages, setMessages] = useState<{
      role: 'user' | 'model', 
      text: string, 
      timestamp?: number, 
      grounding?: any[], 
      attachments?: string[], 
      generatedImage?: string, 
      musicData?: any
  }[]>([]);
  const [input, setInput] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasAutoRunRef = useRef(false);
  const cancelRequestRef = useRef(false);
  const [copyFeedback, setCopyFeedback] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const [pendingFiles, setPendingFiles] = useState<{data: string, mime: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  const [chatMode, setChatMode] = useState<ChatMode>('chat');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<{ url: string } | null>(null);

  const [ttsState, setTtsState] = useState<{ index: number, status: 'loading' | 'playing' } | null>(null);
  const [isTtsAvailable, setIsTtsAvailable] = useState(true);
  
  // --- VOICE STATE WITH PERSISTENCE PER USER (FIREBASE + LOCAL) ---
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false); 

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioPlaybackRef = useRef(new Map<number, { sources: Set<AudioBufferSourceNode>, cancel: () => void, nextStartTime: number }>());
  const audioCacheRef = useRef(new Map<number, AudioBuffer[]>());
  
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const isSuperAdmin = currentUser?.role === 'super-admin';
  const isAdmin = currentUser?.role === 'admin' || isSuperAdmin;
  
  const availableTools: { id: ChatMode, icon: string, label: string }[] = [];
  
  if (isAdmin) {
      availableTools.push({ id: 'search', icon: 'fa-globe', label: 'Busca Web' });
  }
  if (isSuperAdmin) {
      availableTools.push({ id: 'image', icon: 'fa-palette', label: 'Criar Imagem' });
  }

  // --- SAVE VOICE PREFERENCE (Cloud + Local) ---
  useEffect(() => {
      // 1. Prioritize Cloud Preference from currentUser (loaded by AuthProvider via Firestore)
      if (currentUser?.voicePreference && VOICES.includes(currentUser.voicePreference)) {
          setSelectedVoice(currentUser.voicePreference);
          // Sync local storage just in case
          const userKey = `uziel_ai_voice_${currentUser.username}`;
          localStorage.setItem(userKey, currentUser.voicePreference);
      } 
      // 2. Fallback to LocalStorage if user data hasn't loaded yet or cloud is empty
      else if (currentUser) {
          const userKey = `uziel_ai_voice_${currentUser.username}`;
          const savedVoice = localStorage.getItem(userKey);
          if (savedVoice && VOICES.includes(savedVoice)) {
              setSelectedVoice(savedVoice);
          }
      }
  }, [currentUser]); // Runs when user logs in or user data updates

  const handleVoiceChange = (voice: string) => {
      setSelectedVoice(voice);
      setShowVoiceSettings(false);
      
      if (currentUser) {
          // 1. Save to LocalStorage (Instant)
          const userKey = `uziel_ai_voice_${currentUser.username}`;
          localStorage.setItem(userKey, voice);
          
          // 2. Save to Firebase (Cloud Persistence)
          UserService.updateVoicePreference(currentUser.username, voice);
      }
  };

  const toggleTool = (toolId: ChatMode) => {
      if (chatMode === toolId) {
          setChatMode('chat');
      } else {
          setChatMode(toolId);
      }
  };

  useEffect(() => {
    if (isOpen && !isExpanded && !embedded) {
      setIsOpen(false);
    }
  }, [currentPage]);

  useEffect(() => {
    if (embedded) setIsOpen(true);
  }, [embedded]);

  const stopAllAudio = () => {
      audioPlaybackRef.current.forEach((playback) => {
          playback.cancel();
          playback.sources.forEach(source => {
              try { source.stop(); } catch (e) {}
          });
      });
      audioPlaybackRef.current.clear();
      if (audioContextRef.current && audioContextRef.current.state === 'running') {
          audioContextRef.current.suspend();
      }
      setTtsState(null);
  };

  useEffect(() => {
      if (!isOpen) {
          stopAllAudio();
          setViewingImage(null);
          setShowVoiceSettings(false); // Close settings when closing chat
          setEnableTransition(false);
      } else {
          // Enable transition after a short delay to prevent initial mount stretching
          const timer = setTimeout(() => setEnableTransition(true), 50);
          return () => clearTimeout(timer);
      }
  }, [isOpen]);

  useEffect(() => {
      if (currentUser && !hasAutoRunRef.current && messages.length === 0) {
          ChatService.getHistory(currentUser.username).then(history => {
              if (history && history.length > 0) {
                  // --- 48 HOUR AUTO-DELETION LOGIC ---
                  const now = Date.now();
                  const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
                  
                  const freshHistory = history.filter((msg: any) => {
                      return msg.timestamp && (now - msg.timestamp) < TWO_DAYS_MS;
                  });

                  if (freshHistory.length !== history.length) {
                      ChatService.saveHistory(currentUser.username, freshHistory);
                  }

                  if (freshHistory.length > 0) {
                      const normalizedHistory = freshHistory.map((msg: any) => ({
                          ...msg,
                          attachments: msg.attachments ? msg.attachments : (msg.attachment ? [msg.attachment] : [])
                      }));
                      setMessages(normalizedHistory);
                  }
              }
          });
      }
  }, [currentUser]);

  useEffect(() => {
      if (currentUser && messages.length > 0) {
          ChatService.saveHistory(currentUser.username, messages);
      }
  }, [messages, currentUser]);

  useEffect(() => {
    const handleOpenRequest = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail && customEvent.detail.prompt) {
            setIsOpen(true);
            setInput(customEvent.detail.prompt);
            setTimeout(() => textareaRef.current?.focus(), 100);
        }
    };
    window.addEventListener('open-assistant', handleOpenRequest);
    return () => {
        window.removeEventListener('open-assistant', handleOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (autoRun && initialPrompt && !hasAutoRunRef.current && isOpen) {
        hasAutoRunRef.current = true;
        handleSend(initialPrompt);
    } else if (!autoRun && initialPrompt && !hasAutoRunRef.current) {
        setInput(initialPrompt);
        hasAutoRunRef.current = true;
    }
  }, [autoRun, initialPrompt, isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, loading, pendingFiles]);
  
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    return () => stopAllAudio();
  }, []);

  const requestClear = () => {
      if (messages.length > 0) {
          setShowClearConfirm(true);
      }
  };

  const confirmClear = async () => {
    stopAllAudio();
    audioCacheRef.current.clear();
    setMessages([]);
    setPendingFiles([]);
    hasAutoRunRef.current = false;
    
    if (currentUser) {
        await ChatService.clearHistory(currentUser.username);
    }
    
    setShowClearConfirm(false);
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(index);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleDownloadImage = (base64Data: string, index: number) => {
      const link = document.createElement('a');
      link.href = base64Data;
      link.download = `uziel_ai_generated_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files) as File[];
        
        const filePromises = files.map(file => {
            return new Promise<{data: string, mime: string}>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    const [header, data] = result.split(',');
                    const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
                    resolve({ data, mime });
                };
                reader.readAsDataURL(file);
            });
        });

        Promise.all(filePromises).then(results => {
            setPendingFiles(prev => [...prev, ...results]);
            if (fileInputRef.current) fileInputRef.current.value = '';
        });
    }
  };

  const removePendingFile = (index: number) => {
      setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleVoiceInput = () => {
    if (isRecording) return; 

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    
    recognition.onerror = (event: any) => {
        const errorMessage = event.error || 'Erro desconhecido';
        console.error(`Speech Recognition Error:`, event.error);
        
        setIsRecording(false);
        
        if (errorMessage !== 'no-speech' && errorMessage !== 'aborted') {
             if (errorMessage === 'not-allowed') {
                 alert("Acesso ao microfone bloqueado. Verifique as permissões do navegador ou do sistema.");
             } else if (errorMessage === 'network') {
                 console.warn("Erro de rede no reconhecimento de voz (sem conexão).");
             } else {
                 console.warn(`Speech recognition error: ${errorMessage}`);
             }
        }
    };

    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
    };

    try {
        recognition.start();
    } catch (e) {
        console.error("Failed to start recognition", e);
    }
  };
  
  const handleCancel = () => {
      cancelRequestRef.current = true;
      setLoading(false);
      
      setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.role === 'user') {
              setInput(lastMessage.text); 
              if (lastMessage.attachments && lastMessage.attachments.length > 0) {
                  const restoredFiles = lastMessage.attachments.map(att => {
                      const [header, data] = att.split(',');
                      const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
                      return { data, mime };
                  });
                  setPendingFiles(restoredFiles);
              }
              return prev.slice(0, -1); 
          }
          return prev; 
      });
  };

  const handleReadAloud = async (text: string, index: number) => {
      // (Implementation mostly same as before, simplified for XML display but kept functional)
      if (ttsState) {
          const currentPlayback = audioPlaybackRef.current.get(ttsState.index);
          if (currentPlayback) {
              currentPlayback.cancel();
              currentPlayback.sources.forEach(s => { try { s.stop(); } catch(e) {} });
          }
          audioPlaybackRef.current.delete(ttsState.index);
          if (ttsState.index === index) {
              setTtsState(null);
              return;
          }
      }
  
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
  
      let isCancelled = false;
      const cancel = () => { isCancelled = true; };
      const sources = new Set<AudioBufferSourceNode>();
      audioPlaybackRef.current.set(index, { sources, cancel, nextStartTime: ctx.currentTime });
      
      if (audioCacheRef.current.has(index)) {
          // Play cached...
          const cachedBuffers = audioCacheRef.current.get(index)!;
          if (cachedBuffers.length > 0) {
              setTtsState({ index, status: 'playing' });
              let nextTime = ctx.currentTime;
              cachedBuffers.forEach((buf, i) => {
                  if (isCancelled) return;
                  const source = ctx.createBufferSource();
                  source.buffer = buf;
                  source.connect(ctx.destination);
                  source.start(nextTime);
                  sources.add(source);
                  nextTime += buf.duration;
                  source.onended = () => {
                      sources.delete(source);
                      if (i === cachedBuffers.length - 1 && !isCancelled) {
                          setTtsState(null);
                          audioPlaybackRef.current.delete(index);
                      }
                  };
              });
              return;
          }
      }

      setTtsState({ index, status: 'loading' });

      if (currentUser) {
          AuditService.log(
              currentUser.username,
              'AI Assistant',
              'CREATE',
              `Gerou voz (TTS) para mensagem ${index}`,
              currentUser.role,
              currentUser.name
          );
      }

      try {
          const rawChunks = text.match(/[^.!?;\n]+[.!?;\n]+|[^.!?;\n]+$/g) || [text];
          let chunkQueue: string[] = [];
          let tempChunk = "";
          for (const c of rawChunks) {
              if ((tempChunk + c).length < 250 && !c.includes('\n')) {
                  tempChunk += c;
              } else {
                  if (tempChunk) chunkQueue.push(tempChunk);
                  tempChunk = c;
                  chunkQueue.push(tempChunk);
                  tempChunk = "";
              }
          }
          if (tempChunk) chunkQueue.push(tempChunk);
          if (chunkQueue.length === 0) chunkQueue = [text];

          const generatedBuffers: AudioBuffer[] = [];

          for (let i = 0; i < chunkQueue.length; i++) {
              if (isCancelled) break;
              const chunk = chunkQueue[i];
              if (!chunk.trim()) continue;
              const base64Audio = await generateSpeech(chunk, selectedVoice);
              if (isCancelled) break;
              const audioBytes = decode(base64Audio);
              const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
              if (isCancelled) break;
              generatedBuffers.push(audioBuffer);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              const playback = audioPlaybackRef.current.get(index);
              if (!playback) break;
              const startTime = Math.max(playback.nextStartTime, ctx.currentTime);
              source.start(startTime);
              playback.nextStartTime = startTime + audioBuffer.duration;
              sources.add(source);
              if (i === 0) { setTtsState({ index, status: 'playing' }); }
              source.onended = () => {
                  sources.delete(source);
                  if (i === chunkQueue.length - 1 && !isCancelled) {
                      setTtsState(null);
                      audioPlaybackRef.current.delete(index);
                      audioCacheRef.current.set(index, generatedBuffers);
                  }
              };
          }
      } catch (error: any) {
          console.error("TTS Error:", error);
          if (!isCancelled) {
              setTtsState(null);
              let alertMessage = "Erro ao gerar áudio.";
              const errorStr = error ? error.toString() : "";
              if (errorStr.includes("quota") || error?.error?.code === 429) {
                  setIsTtsAvailable(false);
                  alertMessage = "Cota de áudio excedida.";
              }
              if (ttsState?.index === index) alert(alertMessage);
          }
          audioPlaybackRef.current.delete(index);
      }
  };


  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    const filesToSend = pendingFiles; 
    const currentMode = chatMode;
    
    if (!textToSend.trim() && filesToSend.length === 0) return;
    
    if (currentUser) {
        AuditService.log(
            currentUser.username, 
            'AI Assistant', 
            'CREATE', 
            `Prompt (${currentMode}): ${textToSend.substring(0, 50)}${textToSend.length > 50 ? '...' : ''}`, 
            currentUser.role, 
            currentUser.name
        );
    }
    
    if (!overrideInput) {
        setInput('');
        setPendingFiles([]);
        setShowEmoji(false);
    }
    
    setMessages(prev => [...prev, { 
        role: 'user', 
        text: textToSend,
        timestamp: Date.now(), 
        attachments: filesToSend.length > 0 ? filesToSend.map(f => `data:${f.mime};base64,${f.data}`) : undefined
    }]);
    setLoading(true);
    cancelRequestRef.current = false;

    try {
      let response: any;
      if (currentMode === 'image') {
          response = await generateImageFromChat(textToSend);
          if (cancelRequestRef.current) return;
          
          let cleanText = sanitizeModelOutput(response.text || "");
          
          setMessages(prev => [...prev, { 
            role: 'model', 
            text: cleanText,
            timestamp: Date.now(),
            generatedImage: response.image
          }]);
      } else {
          // --- BUILD DYNAMIC CONTEXT HERE ---
          // Fetch real-time data from ContextService
          const systemContext = await ContextService.buildSystemContext(currentUser);
          
          const fullSystemInstruction = `
Você é um assistente virtual útil e altamente inteligente do Ministério de Música Uziel.
Seu objetivo é ajudar a gestão e os membros com informações precisas e espirituais.

${systemContext}

INSTRUÇÕES ADICIONAIS:
- Responda com naturalidade e tom acolhedor.
- Use as informações acima como verdade absoluta para o estado atual.
- Se perguntarem sobre pontuação ou regras, consulte a seção de Estatutos.
- Se perguntarem sobre a escala, consulte a seção de Escala de Salmistas.
- Se não souber algo que não está no contexto, diga que não encontrou a informação.
`;

          const history = messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }] 
          }));
          
          response = await generateChatResponse(
              history, 
              textToSend, 
              false, 
              currentMode === 'search',
              filesToSend.length > 0 ? filesToSend.map(f => ({ mimeType: f.mime, data: f.data })) : null,
              currentPage,
              fullSystemInstruction // PASS NEW PARAMETER
          );
          
          if (cancelRequestRef.current) return;

          let cleanText = sanitizeModelOutput(response.text || "Sem resposta.");
          
          setMessages(prev => [...prev, { 
            role: 'model', text: cleanText, 
            timestamp: Date.now(),
            grounding: response.grounding, musicData: response.musicData
          }]);
      }
    } catch (e: any) {
      console.error(e);
      if (cancelRequestRef.current) return;
      let errMsg = "Desculpe, ocorreu um erro.";
      if (e.message && e.message.includes("API key")) errMsg = "Erro de chave de API. Verifique as configurações.";
      else if (e.message) errMsg = `Erro: ${e.message}`; // Adicionado para debug
      setMessages(prev => [...prev, { role: 'model', text: errMsg, timestamp: Date.now() }]);
    } finally {
      if (!cancelRequestRef.current) {
        setLoading(false);
      }
    }
  };

  const assistantVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.95, 
      y: 20,
      transition: { duration: 0.2 }
    },
    collapsed: {
      opacity: 1,
      scale: 1,
      y: 0,
      width: '420px',
      height: '650px',
      right: '32px',
      bottom: '32px',
      borderRadius: '24px',
      transition: { type: 'spring', damping: 25, stiffness: 200 }
    },
    expanded: {
      opacity: 1,
      scale: 1,
      y: 0,
      width: '100vw',
      height: '100vh',
      right: '0px',
      bottom: '0px',
      borderRadius: '0px',
      transition: { type: 'spring', damping: 25, stiffness: 200 }
    },
    embedded: {
      opacity: 1,
      scale: 1,
      y: 0,
      width: '800px',
      height: '700px',
      borderRadius: '24px',
      transition: { type: 'spring', damping: 25, stiffness: 200 }
    }
  };

  const assistantContent = (
    <>
      {embedded && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]" onClick={onClose}></div>}
      
      <motion.div 
        initial="hidden"
        animate={embedded ? "embedded" : (isExpanded ? "expanded" : "collapsed")}
        variants={assistantVariants}
        style={{
          position: 'fixed',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...(embedded ? {
            top: '50%',
            left: '50%',
            x: '-50%',
            y: '-50%',
            maxWidth: '95%',
            maxHeight: '85vh',
          } : {
            top: 'auto',
            left: 'auto',
          })
        }}
        className="bg-white dark:bg-[#0f172a] shadow-2xl border border-slate-200 dark:border-slate-800 !transition-none"
      >
            
            <div className="flex justify-between items-center p-5 pt-6 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-100 dark:border-white/5">
                <div className={`${isExpanded ? 'max-w-4xl mx-auto w-full' : 'w-full'} flex justify-between items-center`}>
                <div className="flex items-center gap-3">
                    <div className="relative w-8 h-8 flex items-center justify-center">
                         <GeminiLogo className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-800 dark:text-white leading-tight">Gemini</h3>
                        <p className="text-[10px] font-bold text-brand-500 uppercase tracking-widest flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                            {chatMode === 'search' ? 'Busca na Web' : chatMode === 'image' ? 'Gerar Imagens' : 'Assistente Virtual'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     {!embedded && (
                         <button onClick={() => setIsExpanded(!isExpanded)} className="hidden md:flex w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-brand-500 items-center justify-center transition-colors" title={isExpanded ? "Restaurar" : "Tela Cheia"}>
                             <i className={`fas ${isExpanded ? 'fa-compress' : 'fa-expand'}`}></i>
                         </button>
                     )}
                     <button onClick={requestClear} className="w-9 h-9 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors">
                        <i className="fas fa-trash-alt"></i>
                     </button>
                     <button onClick={() => { embedded && onClose ? onClose() : setIsOpen(false); }} className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 flex items-center justify-center transition-colors">
                        <i className={`fas ${embedded ? 'fa-times' : 'fa-chevron-down'}`}></i>
                     </button>
                </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 relative bg-white dark:bg-[#0f172a]" ref={scrollRef}>
                 <div className={`${isExpanded ? 'max-w-4xl mx-auto w-full' : 'w-full'} flex flex-col h-full`}>
                 {activeMedia && createPortal(
                    <div className="fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl animate-fade-in-up p-4">
                        <button type="button" onClick={() => setActiveMedia(null)} className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 md:w-14 md:h-14 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all z-50"><i className="fas fa-times text-lg md:text-xl"></i></button>
                        <div className="w-full max-w-4xl h-full flex flex-col items-center justify-center relative z-10">
                            {(() => {
                                const embedUrl = MediaUtils.getEmbedUrl(activeMedia.url);
                                if (embedUrl) {
                                    return <iframe src={embedUrl} className="w-full h-[60vh] rounded-2xl shadow-2xl" allow="autoplay; encrypted-media; fullscreen" title="Media Player" />;
                                }
                                return <div className="text-white text-center">Mídia não suportada para preview.</div>;
                            })()}
                        </div>
                    </div>, document.body
                  )}

                 <AnimatePresence>
                    {messages.length === 0 && !loading ? (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="h-full flex flex-col items-center justify-center -mt-10 px-4">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-brand-400 to-blue-600 flex items-center justify-center shadow-[0_0_40px_rgba(56,189,248,0.4)] mb-8 animate-float">
                                <GeminiLogo className="w-14 h-14 text-white" />
                            </div>
                            <h2 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-700 to-slate-900 dark:from-white dark:to-slate-300 mb-3 text-center">
                                Como posso ajudar?
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs text-center leading-relaxed font-medium">
                                Tenho acesso à escala atual, repertórios e aos estatutos do ministério.
                            </p>
                        </motion.div>
                    ) : (
                        <div className="space-y-6 pb-4">
                            {messages.map((m, i) => {
                               const youtubeId = m.role === 'model' ? extractYoutubeId(m.text) : null;
                               const isReading = ttsState?.index === i;
                               const isLoadingTTS = isReading && ttsState.status === 'loading';
                               const isPlayingTTS = isReading && ttsState.status === 'playing';
                               const attachments = m.attachments || [];

                               return (
                               <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} layout className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                   {m.role === 'model' && <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-1 bg-white dark:bg-white/10"><GeminiLogo className="w-5 h-5 text-brand-600 dark:text-brand-400"/></div>}
                                   <div className={`max-w-[85%] relative group transition-all duration-300 ${m.musicData ? 'w-full' : 'w-auto'}`}>
                                       {m.musicData ? <MusicResultCard data={m.musicData} /> : (
                                        <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div className={`p-4 text-sm leading-relaxed shadow-sm break-words ${m.role === 'user' ? 'bg-brand-600 text-white rounded-[1.5rem] rounded-br-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-[1.5rem] rounded-bl-none'}`}>
                                                {attachments.length > 0 && (
                                                    <div className={`grid gap-2 mb-3 ${attachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                                        {attachments.map((src, imgIdx) => (
                                                            <div key={imgIdx} className="relative group/img overflow-hidden rounded-xl cursor-zoom-in">
                                                                <img src={src} alt={`Anexo ${imgIdx + 1}`} className="w-full h-auto object-cover max-h-48" onClick={() => setViewingImage(src)} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {m.generatedImage && (
                                                    <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 group/img relative shadow-lg">
                                                        <img src={m.generatedImage} alt="Gerada por IA" className="w-full h-auto cursor-zoom-in hover:opacity-90 transition-opacity animate-breathing" onClick={() => setViewingImage(m.generatedImage || null)} />
                                                        <button onClick={(e) => { e.stopPropagation(); handleDownloadImage(m.generatedImage!, i); }} className="absolute bottom-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-md z-10" title="Baixar Imagem"><i className="fas fa-download text-xs"></i></button>
                                                    </div>
                                                )}
                                                {m.text === "Erro: QUOTA_EXHAUSTED_CIRCUIT_BREAKER" || m.text.includes("429") ? (
                                                    <QuotaTimer />
                                                ) : (
                                                    <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMessage(m.text) }}></div>
                                                )}
                                                {youtubeId && <div className="mt-3 rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-white/10"><iframe width="100%" height="200" src={`https://www.youtube.com/embed/${youtubeId}`} title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="block"></iframe></div>}
                                            </div>
                                            {m.grounding && m.grounding.length > 0 && (
                                                <div className="mt-2 w-full flex flex-wrap gap-2">
                                                    {m.grounding.map((chunk: any, idx: number) => {
                                                        if (chunk.web?.uri) {
                                                            let domain = ''; try { domain = new URL(chunk.web.uri).hostname; } catch(e){}
                                                            const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
                                                            return (
                                                                <a key={idx} href={chunk.web.uri} target="_blank" rel="noreferrer" className="pl-1.5 pr-3 py-1 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 rounded-full text-[10px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 flex items-center gap-1.5 transition-colors">
                                                                    <img src={favicon} alt="" className="w-3 h-3 rounded-full" onError={(e) => { const t = e.target as HTMLImageElement; t.onerror = null; t.src = getFallbackFavicon(domain); }} />
                                                                    <span className="truncate max-w-[100px]">{chunk.web.title || domain}</span>
                                                                </a>
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                </div>
                                            )}
                                            {m.role === 'model' && m.text && (
                                                <div className={`mt-1 flex gap-1 justify-start transition-opacity ${isReading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                    <button onClick={() => isTtsAvailable && handleReadAloud(m.text, i)} disabled={!isTtsAvailable} className={`w-7 h-7 flex items-center justify-center text-xs rounded-full transition-colors ${isReading ? 'bg-brand-100 text-brand-600' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}>{isLoadingTTS ? <i className="fas fa-circle-notch fa-spin"></i> : isPlayingTTS ? <i className="fas fa-stop"></i> : <i className="fas fa-volume-up"></i>}</button>
                                                    <button onClick={() => handleCopy(m.text, i)} className={`w-7 h-7 flex items-center justify-center text-xs rounded-full transition-colors ${copyFeedback === i ? 'text-green-500' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}><i className={`fas ${copyFeedback === i ? 'fa-check' : 'fa-copy'}`}></i></button>
                                                    {onApply && <button onClick={() => { onApply(m.text); if(onClose) onClose(); }} className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[9px] font-bold uppercase rounded-md hover:bg-brand-100 ml-1">Usar</button>}
                                                </div>
                                            )}
                                        </div>
                                       )}
                                   </div>
                                   {m.role === 'user' && (
                                       <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-1 bg-white dark:bg-white/10 overflow-hidden border border-slate-200 dark:border-white/10">
                                           {currentUser?.photoURL ? (
                                               <img src={currentUser.photoURL} alt="User" className="w-full h-full object-cover" />
                                           ) : (
                                               <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                                   {currentUser?.name?.charAt(0) || 'U'}
                                               </div>
                                           )}
                                       </div>
                                   )}
                               </motion.div>
                               );
                            })}
                            {loading && (
                                <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start items-center gap-3">
                                   <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-white/10 shadow-sm"><GeminiLogo className="w-5 h-5 text-brand-600 dark:text-brand-400" isAnimating /></div>
                                   <span className="text-xs font-bold text-slate-400 animate-pulse">{chatMode === 'image' ? 'Criando arte...' : chatMode === 'search' ? 'Pesquisando...' : 'Pensando...'}</span>
                                </motion.div>
                            )}
                        </div>
                    )}
                 </AnimatePresence>
                 </div>
            </div>

            <div className="p-4 bg-white dark:bg-[#0f172a] border-t border-slate-100 dark:border-white/5">
                <div className={`${isExpanded ? 'max-w-4xl mx-auto w-full' : 'w-full'}`}>
                {/* TOOLBAR FIX: Separate scrolling tools from fixed settings button */}
                <div className="flex items-center justify-between mb-3 px-1">
                    
                    {/* SCROLLABLE TOOLS (Left) */}
                    <div className="flex gap-2 overflow-x-auto hide-scrollbar max-w-[70%]">
                        {(isAdmin || isSuperAdmin) && (
                            <>
                                {isAdmin && (
                                    <button onClick={() => toggleTool('search')} className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border flex items-center gap-1.5 transition-all whitespace-nowrap ${chatMode === 'search' ? 'bg-brand-600 text-white border-brand-600 shadow-md' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50'}`}>
                                        <i className="fas fa-globe"></i> Web
                                    </button>
                                )}
                                {isSuperAdmin && (
                                    <button onClick={() => toggleTool('image')} className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border flex items-center gap-1.5 transition-all whitespace-nowrap ${chatMode === 'image' ? 'bg-brand-600 text-white border-brand-600 shadow-md' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50'}`}>
                                        <i className="fas fa-palette"></i> Criar
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                    
                    {/* VOICE SETTINGS (Fixed Right) - Moved OUT of scroll container */}
                    <div className="relative shrink-0 z-50 ml-2">
                        <button 
                            type="button"
                            onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                            className="flex items-center gap-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        >
                            <i className="fas fa-volume-high text-brand-500 text-xs"></i>
                            <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300 truncate max-w-[60px]">{selectedVoice}</span>
                            <i className={`fas fa-chevron-up text-[8px] text-slate-400 transition-transform ${showVoiceSettings ? 'rotate-180' : ''}`}></i>
                        </button>

                        {showVoiceSettings && (
                            <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 p-2 z-50 animate-scale-in origin-bottom-right" onClick={(e) => e.stopPropagation()}>
                                <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2 border-b border-slate-100 dark:border-white/5 mb-1">
                                    Voz do Assistente
                                </h4>
                                <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                                    {VOICES.map(v => (
                                        <button 
                                            key={v} 
                                            type="button"
                                            onClick={() => handleVoiceChange(v)}
                                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                                                selectedVoice === v 
                                                ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400' 
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            <span>{v}</span>
                                            {selectedVoice === v && <i className="fas fa-check text-brand-500"></i>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pending Files Preview - MOVED ABOVE INPUT BAR */}
                {pendingFiles.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto mb-3 px-1">
                        {pendingFiles.map((file, idx) => (
                            <div key={idx} className="relative group shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm">
                                <img src={`data:${file.mime};base64,${file.data}`} className="w-full h-full object-cover" />
                                <button onClick={() => removePendingFile(idx)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"><i className="fas fa-times"></i></button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="bg-slate-100 dark:bg-slate-800/80 rounded-[2rem] p-2 pr-2 flex items-end gap-2 border border-transparent focus-within:border-brand-200 dark:focus-within:border-brand-500/30 transition-all shadow-inner relative">
                    <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors shrink-0 mb-0.5">
                        <i className="fas fa-paperclip"></i>
                    </button>
                    <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
                    
                    <textarea 
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                        placeholder={chatMode === 'image' ? "Descreva a imagem..." : "Digite sua mensagem..."}
                        className="flex-1 bg-transparent border-none outline-none py-3 text-slate-800 dark:text-white placeholder-slate-400 text-sm font-medium resize-none max-h-32 min-h-[44px]"
                        rows={1}
                    />

                    {input.trim() || pendingFiles.length > 0 ? (
                        <button onClick={() => handleSend()} className="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-lg hover:bg-brand-500 transition-all shrink-0 mb-0.5 animate-scale-in">
                            <i className="fas fa-paper-plane text-sm"></i>
                        </button>
                    ) : (
                        <button onClick={handleVoiceInput} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 mb-0.5 ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg' : 'bg-slate-200 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-white/10'}`}>
                            <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
                        </button>
                    )}
                </div>

                <p className="text-[10px] text-center text-slate-400 mt-3 font-medium opacity-60">
                    O Gemini pode cometer erros. Verifique as informações importantes.
                </p>
                </div>
            </div>

            {viewingImage && (
                <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />
            )}

            <DeleteConfirmationModal isOpen={showClearConfirm} onClose={() => setShowClearConfirm(false)} onConfirm={confirmClear} title="Limpar Conversa?" description="Esta ação removerá todas as mensagens e o histórico atual do assistente." />
      </motion.div>
    </>
  );

  if (embedded) return assistantContent;

  // If hidden and chat is not open, return null to hide the floating trigger button
  if (hidden && !isOpen) return null;

  if (!isOpen) {
      return createPortal(
          <button onClick={() => setIsOpen(true)} className="fixed z-[9999] bottom-32 right-4 md:bottom-8 md:right-8 group flex items-center justify-center p-1">
              <div className="relative w-16 h-16 rounded-full bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/40 hover:scale-110 transition-all duration-300 z-10">
                  <GeminiLogo className="w-8 h-8 text-white" />
              </div>
              <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-20 animate-ping group-hover:bg-brand-500"></span>
          </button>,
          document.body
      );
  }

  return createPortal(assistantContent, document.body);
};