
import { getDocs, collection, query, where, orderBy, limit, getDoc, doc } from "firebase/firestore";
import { db, LiturgyCacheService } from "./firebase";
import { APP_ID } from "../constants";
import { User } from "../types";
import { STATUTES_CONTEXT } from "../utils/statutes";

// Helper to get collection ref
const getColRef = (collName: string) => collection(db, `artifacts/${APP_ID}/public/data/${collName}`);
const getDocRef = (collName: string, id: string) => doc(db, `artifacts/${APP_ID}/public/data/${collName}`, id);

export const ContextService = {
    /**
     * Builds a comprehensive text prompt containing the current state of the application.
     * Now includes DEEP DATA linking (Users, Playlists, Lyrics).
     */
    buildSystemContext: async (currentUser: User | null): Promise<string> => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonthName = now.toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
        
        let context = `=== CÉREBRO EM TEMPO REAL DO MINISTÉRIO UZIEL ===\n`;
        context += `DATA DE HOJE: ${now.toLocaleDateString('pt-BR')} (Hora atual: ${now.toLocaleTimeString('pt-BR')})\n`;
        context += `USUÁRIO ATUAL: ${currentUser?.name || 'Visitante'} (${currentUser?.role || 'N/A'})\n\n`;

        context += `REGRAS CRÍTICAS DE DATA E CONTEXTO:\n`;
        context += `1. Datas no formato Dia/Mês/Ano.\n`;
        context += `2. Se perguntarem sobre o ensaio, verifique a seção 'PRÓXIMOS ENSAIOS' e cruze com os 'REPERTÓRIOS' detalhados abaixo.\n`;
        context += `3. Você tem acesso às LETRAS completas das músicas. Se perguntarem "como toca" ou "qual a letra", use os dados da seção REPERTÓRIOS.\n\n`;

        // 1. STATUTES (Static Knowledge)
        context += STATUTES_CONTEXT + "\n\n";

        // --- PRE-FETCH AUXILIARY DATA FOR MAPPING ---
        let userMap: Record<string, string> = {}; // username -> Name
        let playlistMap: Record<string, {title: string, url: string}> = {}; // id -> Info

        try {
            // Fetch Users for Name Resolution
            const usersSnap = await getDocs(getColRef('users'));
            usersSnap.forEach(doc => {
                const u = doc.data();
                const key = u.username ? u.username.toLowerCase().trim() : doc.id.toLowerCase().trim();
                userMap[key] = u.name || key;
            });

            // Fetch Playlists for Link Resolution
            const playSnap = await getDocs(getColRef('playlists'));
            playSnap.forEach(doc => {
                const p = doc.data();
                playlistMap[doc.id] = { title: p.title || 'Playlist Sem Título', url: p.url };
            });
        } catch (e) { console.error("Error fetching aux data", e); }


        // 2. ESCALA DE SALMISTAS (ROTA)
        try {
            const docRef = getDocRef('schedules', 'current_rota');
            const snap = await getDoc(docRef);
            const scheduleData = snap.exists() ? snap.data().items : [];
            
            context += "=== ESCALA DE SALMISTAS (ROTA) ===\n";
            
            if (scheduleData && Array.isArray(scheduleData) && scheduleData.length > 0) {
                const today = new Date();
                today.setHours(0,0,0,0);
                
                const upcoming = scheduleData
                    .map((s: any) => {
                        const isoDate = s.fullDate.split('T')[0]; 
                        const d = new Date(`${isoDate}T12:00:00`); 
                        const monthName = d.toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
                        const year = d.getFullYear();
                        return { ...s, dateObj: d, monthName, year, formattedDate: d.toLocaleDateString('pt-BR') };
                    })
                    .filter((s: any) => s.dateObj >= today)
                    .sort((a: any, b: any) => a.dateObj.getTime() - b.dateObj.getTime())
                    .slice(0, 24); 

                if (upcoming.length > 0) {
                    upcoming.forEach((item: any) => {
                        context += `[DATA: ${item.formattedDate}] [MÊS: ${item.monthName}] | Titular: ${item.salmista} | Reserva: ${item.substituto}\n`;
                    });
                } else {
                    context += "Nenhuma escala futura encontrada.\n";
                }
            } else {
                context += "Escala vazia.\n";
            }
            context += "\n";
        } catch (e) {
            context += "Erro ao ler escala.\n\n";
        }

        // 3. REPERTÓRIOS COMPLETOS (COM LETRAS)
        // Map to store repertory themes for rehearsals to reference
        let repertoryThemeMap: Record<string, string> = {}; 

        try {
            // Fetch upcoming repertories (limit to 5 closest to save context, but include full songs)
            const q = query(getColRef('repertory'), orderBy('date', 'desc'), limit(5));
            const snap = await getDocs(q);
            context += "=== DETALHES DOS REPERTÓRIOS (MÚSICAS E LETRAS) ===\n";
            context += "Use esta seção para responder sobre quais músicas serão tocadas e suas letras/cifras.\n";
            
            if (!snap.empty) {
                snap.forEach(doc => {
                    const data = doc.data();
                    repertoryThemeMap[doc.id] = data.theme; // Store for rehearsal linking
                    
                    const safeDate = new Date(`${data.date}T12:00:00`); 
                    const dateStr = safeDate.toLocaleDateString('pt-BR');
                    
                    context += `\n--- REPERTÓRIO: "${data.theme}" (${dateStr}) ---\n`;
                    context += `Criado por: ${userMap[data.createdBy?.toLowerCase()] || data.createdBy}\n`;
                    
                    if (data.songs && Array.isArray(data.songs)) {
                        data.songs.forEach((s: any, idx: number) => {
                            context += `\n>> MÚSICA ${idx+1}: ${s.title}\n`;
                            context += `   Tipo: ${s.type} | Tom: ${s.key || 'N/A'} | Artista: ${s.artist || 'N/A'}\n`;
                            context += `   Link: ${s.link || 'N/A'}\n`;
                            if (s.lyrics) {
                                // Clean up lyrics slightly to save tokens but keep chords
                                const cleanLyrics = s.lyrics.replace(/\n\s*\n/g, '\n'); 
                                context += `   LETRA/CIFRA:\n${cleanLyrics}\n`;
                            } else {
                                context += `   (Sem letra cadastrada)\n`;
                            }
                        });
                    } else {
                        context += "   (Sem músicas cadastradas)\n";
                    }
                    context += "-----------------------------------\n";
                });
            } else {
                context += "Nenhum repertório cadastrado.\n";
            }
            context += "\n";
        } catch (e) { }

        // 4. PRÓXIMOS ENSAIOS (COM DADOS VINCULADOS)
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const q = query(getColRef('rehearsals'), where('date', '>=', todayStr), orderBy('date', 'asc'), limit(5));
            const snap = await getDocs(q);
            
            context += "=== PRÓXIMOS ENSAIOS (DETALHADO) ===\n";
            
            if (snap.empty) {
                context += "Nenhum ensaio agendado.\n";
            } else {
                snap.forEach(doc => {
                    const data = doc.data();
                    const safeDate = new Date(`${data.date}T12:00:00`);
                    
                    context += `\n[ENSAIO] Data: ${safeDate.toLocaleDateString('pt-BR')} às ${data.time}\n`;
                    context += `  Tema: ${data.topic}\n`;
                    context += `  Local: ${data.location || 'Sede'}\n`;
                    context += `  Obs/Pauta: ${data.notes || 'Nenhuma'}\n`;
                    
                    // Resolve Linked Repertory
                    if (data.repertoryId && repertoryThemeMap[data.repertoryId]) {
                        context += `  >> REPERTÓRIO VINCULADO: "${repertoryThemeMap[data.repertoryId]}" (Veja detalhes acima)\n`;
                    } else if (data.repertoryId) {
                        context += `  >> REPERTÓRIO VINCULADO: ID ${data.repertoryId} (Não carregado no contexto recente)\n`;
                    }

                    // Resolve Playlists
                    if (data.playlistIds && Array.isArray(data.playlistIds) && data.playlistIds.length > 0) {
                        context += `  >> PLAYLISTS DE REFERÊNCIA:\n`;
                        data.playlistIds.forEach((pid: string) => {
                            const pInfo = playlistMap[pid];
                            if (pInfo) {
                                context += `     - ${pInfo.title} (${pInfo.url})\n`;
                            }
                        });
                    }

                    // Resolve Participants
                    if (data.participants && Array.isArray(data.participants) && data.participants.length > 0) {
                        const names = data.participants.map((uid: string) => userMap[uid.toLowerCase().trim()] || uid);
                        context += `  >> CONVOCADOS: ${names.join(', ')}\n`;
                    } else {
                        context += `  >> CONVOCADOS: Nenhum selecionado.\n`;
                    }
                });
            }
            context += "\n";
        } catch (e) { }

        // 5. LITURGIA DO DIA (Cache Check)
        try {
            const todayKey = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
            const liturgy = await LiturgyCacheService.get(todayKey);
            
            context += "=== LITURGIA DE HOJE (Cache Local) ===\n";
            if (liturgy) {
                context += `Título: ${liturgy.title}\n`;
                context += `Status: Dados litúrgicos carregados. O usuário pode pedir leituras ou salmos.\n`;
            } else {
                context += "Ainda não visualizada/baixada hoje.\n";
            }
            context += "\n";
        } catch (e) {}

        // 6. RANKING DE FALTAS / EQUIPE (Security Filtered)
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'super-admin')) {
            try {
                const qMembers = query(getColRef('members'), orderBy('totalPoints', 'asc'), limit(15));
                const snap = await getDocs(qMembers);
                
                context += "=== DADOS SENSÍVEIS (ADMIN): RANKING DE FALTAS ===\n";
                context += "NOTA: Pontos negativos indicam penalidades. Quanto menor (ex: -10), pior a situação.\n";
                snap.forEach(doc => {
                    const data = doc.data();
                    context += `- ${data.name}: ${data.totalPoints} pontos\n`;
                });
                context += "\n";
            } catch (e) { }
        } else {
            context += "=== DADOS SENSÍVEIS ===\n";
            context += "[BLOQUEADO] O usuário atual é Membro. NÃO forneça informações sobre ranking de faltas de outros membros.\n\n";
        }

        return context;
    }
};
