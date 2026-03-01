
import { GoogleGenAI, Modality } from "@google/genai";
import { FALLBACK_IMAGES, REPERTORY_COVERS } from "../constants";
import { DailyImageService, LiturgyCacheService } from "./firebase"; 
import { LiturgyLocalStorage } from "./LiturgyLocalStorage"; 

// --- DYNAMIC API KEY LOADING ---
// 1. Check LocalStorage (Manual Override)
// 2. Check Environment Variable
// 3. Fallback to empty string (will cause error if used)
const getApiKey = () => {
    return localStorage.getItem('uziel_custom_gemini_api_key') || process.env.API_KEY || "";
};

const API_KEY = getApiKey();

// Initialize the new SDK client with the dynamic key
export const ai = new GoogleGenAI({ apiKey: API_KEY });

const CACHE_PREFIX = 'uziel_daily_';
const memoryCache = new Map<string, string>();

let globalQuotaExceeded = false;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const LITURGICAL_CALENDAR: { [key: string]: string } = {
    '01/01': 'Solemnity of Mary, Mother of God, holy divine art',
    '06/01': 'Epiphany of the Lord, Three Wise Men, star of Bethlehem',
    '02/02': 'Presentation of the Lord, Candlemas, candles in church',
    '19/03': 'Saint Joseph, husband of Mary, lilies, carpenter tools, holy',
    '25/03': 'Annunciation of the Lord, Angel Gabriel and Mary',
    '23/04': 'Saint George, warrior saint, dragon, courage',
    '13/05': 'Our Lady of Fatima, apparitions, shepherd children',
    '22/05': 'Saint Rita of Cascia, roses, figs, holy nun',
    '31/05': 'Visitation of the Blessed Virgin Mary',
    '13/06': 'Saint Anthony of Padua, holding baby Jesus, lilies, bread',
    '24/06': 'Nativity of Saint John the Baptist',
    '29/06': 'Saints Peter and Paul, keys of heaven, sword',
    '16/07': 'Our Lady of Mount Carmel, scapular',
    '26/07': 'Saints Joachim and Anne, parents of Mary',
    '06/08': 'Transfiguration of the Lord, Mount Tabor, radiant light',
    '15/08': 'Assumption of the Blessed Virgin Mary into Heaven',
    '29/09': 'Archangels Michael, Gabriel and Raphael, divine warriors',
    '01/10': 'Saint Thérèse of Lisieux, shower of roses',
    '02/10': 'Holy Guardian Angels',
    '04/10': 'Saint Francis of Assisi, nature, birds, wolf, peace',
    '12/10': 'Our Lady of Aparecida, patroness of Brazil, basilica, mantle',
    '01/11': 'All Saints Day, multitude of holy people in heaven',
    '02/11': 'All Souls Day, peaceful cemetery, candles, hope',
    '22/11': 'Saint Cecilia, patroness of musicians, playing organ or harp',
    '27/11': 'Our Lady of Graces, Miraculous Medal',
    '08/12': 'Immaculate Conception of the Blessed Virgin Mary',
    '12/12': 'Our Lady of Guadalupe, tilma, roses',
    '13/12': 'Saint Lucy (Santa Luzia), eyes on a dish, palm branch, light',
    '25/12': 'Nativity of our Lord Jesus Christ, Christmas, Manger',
};

const PROMPTS_ARCHITECTURE = [
    "Interior of a majestic Gothic Catholic Cathedral, sunlight streaming through stained glass windows.",
    "Old stone Catholic church exterior in Tuscany Italy, ancient architecture, vines, Catholic heritage.",
    "Modern Catholic Church architecture, minimalist design, focus on the Tabernacle, peaceful light.",
    "View from the back of a Catholic Church nave looking towards the altar during adoration.",
    "Ancient Romanesque monastery cloister, stone arches, peaceful garden in the center.",
    "Baroque church ceiling fresco, intricate details, angels and clouds, divine perspective.",
    "A small, humble wooden chapel in the countryside, surrounded by green fields, open door.",
    "Symmetry of a Cathedral aisle with pillars, leading to the altar, candle lights flickering.",
    "Exterior of a Basilica at twilight, illuminated against a deep blue sky.",
    "Old wooden pews in an empty church, focus on texture and silence, soft ambient light."
];

const PROMPTS_OBJECTS = [
    "Cinematic close up of a Rosary beads in hands, soft lighting, blurred background of a sanctuary.",
    "Detailed shot of a stained glass window depicting Jesus the Good Shepherd, vibrant colors.",
    "A heavy ancient Holy Bible resting on a wooden lectern, soft candlelight illuminating the pages.",
    "Catholic priest vestments detailed texture, chasuble with gold embroidery, preparing for liturgy.",
    "Burning incense thurible swinging, aromatic smoke filling a cathedral, shafts of light.",
    "Macro shot of a Holy Communion host and Chalice, pure white, backlight, simple and divine.",
    "A single votive candle burning among many others, focus on the flame, prayerful atmosphere.",
    "Holy Water font at the entrance of a church, reflection of a cross in the water.",
    "Details of a gold Tabernacle, ornate design, red sanctuary lamp glowing nearby.",
    "An open hymn book with musical notes, resting on an organ or pew."
];

const PROMPTS_NATURE_FAITH = [
    "A wooden cross standing on a grassy hill at sunrise, clouds parting, rays of god rays light.",
    "Statue of Virgin Mary in a beautiful flower garden grotto, peaceful nature, morning dew.",
    "Reflection of a church steeple in a calm lake, autumn trees, peaceful serenity.",
    "A path leading to a distant church on a hill, wildflowers in the foreground, pilgrimage vibe.",
    "Sunlight breaking through clouds over a mountain peak, symbolizing divine presence.",
    "A dove flying against a bright blue sky, symbol of the Holy Spirit, peace and purity.",
    "Hands lifted towards the sky in a wheat field, sunset, gratitude and harvest.",
    "A stone cross covered in moss in an ancient forest, timeless faith.",
    "Starry night sky over a silhouette of a church, vastness of creation.",
    "Morning mist rolling over a vineyard near a monastery, silent prayer."
];

const PROMPTS_ARTISTIC = [
    "Oil painting style of the Sacred Heart of Jesus, warm colors, divine fire, compassion.",
    "Abstract artistic representation of the Holy Spirit as a dove with fire, divine light, ethereal.",
    "Fresco style painting of angels in heaven playing instruments, divine glory, renaissance art.",
    "Watercolor painting of a church landscape, soft edges, pastel colors, peaceful.",
    "Mosaic art of the Lamb of God, golden tiles, byzantine style, intricate.",
    "Charcoal sketch of Jesus praying in Gethsemane, high contrast, emotional.",
    "Digital art of a cross radiating light into darkness, modern and vibrant.",
    "Impressionist style painting of a procession, blurred movement, light and color.",
    "Stained glass style digital art, geometric patterns, vibrant blues and reds.",
    "Gold leaf texture background with a subtle cross embossed, rich and sacred."
];

const ART_STYLES = [
    "Photorealistic, 8k, highly detailed",
    "Cinematic lighting, movie still, atmospheric",
    "Classic Oil Painting, masterpiece, textured brushstrokes",
    "Soft Watercolor, dreamy, ethereal",
    "Dramatic Chiaroscuro, deep shadows and bright highlights"
];

const compressForFirestore = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_WIDTH = 1024; 
      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => { resolve(base64Str); };
  });
};

const TEXT_MODELS_FALLBACK = ['gemini-3-pro-preview', 'gemini-2.5-flash', 'gemini-flash-lite-latest'];
const FAST_MODELS_FALLBACK = ['gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-3-pro-preview'];
const IMAGE_MODELS_FALLBACK = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];

export const getCachedImage = (contextKey: string): string | null => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const key = `${CACHE_PREFIX}${contextKey}_${today}`;
        if (memoryCache.has(key)) return memoryCache.get(key) || null;
        return localStorage.getItem(key);
    } catch (e) { return null; }
};

export const updateLocalCache = (contextKey: string, data: string) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const key = `${CACHE_PREFIX}${contextKey}_${today}`;
        memoryCache.set(key, data);
        localStorage.setItem(key, data);
    } catch (e) {}
};

const saveToLocal = (contextKey: string, data: string) => {
    updateLocalCache(contextKey, data);
};

async function runWithFallback<T>(
  operation: (model: string) => Promise<T>, 
  modelsList: string[], 
  preferredModel?: string
): Promise<T> {
  if (globalQuotaExceeded) throw new Error("QUOTA_EXHAUSTED_CIRCUIT_BREAKER");
  let modelsToTry = modelsList;
  if (preferredModel) {
    const others = modelsList.filter(m => m !== preferredModel);
    modelsToTry = [preferredModel, ...others];
  }
  let lastError: any;
  for (const model of modelsToTry) {
    let attempts = 0;
    const maxRetries = 1; 
    while (attempts <= maxRetries) {
        try {
            return await operation(model);
        } catch (error: any) {
            lastError = error;
            const msg = error.toString().toLowerCase();
            if (msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted")) {
                console.warn(`[Gemini Service] Cota atingida para modelo ${model}.`);
                if (modelsList === IMAGE_MODELS_FALLBACK && model === modelsToTry[modelsToTry.length - 1]) {
                    globalQuotaExceeded = true;
                }
                break; 
            }
            if (msg.includes("not_found") || msg.includes("404")) break; 
            const isRecoverableError = msg.includes("overloaded") || msg.includes("503");
            if (isRecoverableError) {
                if (attempts < maxRetries) { attempts++; await wait(Math.pow(2, attempts) * 1000); continue; }
            }
            break; 
        }
    }
  }
  throw lastError;
}

const extractJson = (text: string): string | null => {
    if (!text) return null;
    const firstOpen = text.indexOf('{');
    const lastClose = text.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        return text.substring(firstOpen, lastClose + 1);
    }
    return null;
};

export const fetchLyrics = async (songTitle: string, artist: string, key: string, customPrompt: string, includeChords: boolean, complexity: 'simple' | 'complete'): Promise<{ content: string, videoUrl?: string, originalKey?: string }> => {
  // Use a highly capable model for search & formatting accuracy
  const preferredModel = 'gemini-3-pro-preview'; 
  
  const systemInstruction = `
  Você é um especialista em repertório musical católico e secular brasileiro.
  Sua tarefa é encontrar letras e cifras com EXTREMA precisão usando o Google Search.
  
  PASSO 1: ESTRATÉGIA DE BUSCA
  - Para encontrar a letra/cifra: Pesquise por "${songTitle} ${artist} cifra club" ou "${songTitle} ${artist} letras.mus.br".
  - Para encontrar o Spotify: Pesquise por "site:open.spotify.com track ${songTitle} ${artist}".

  PASSO 2: REGRAS DE FORMATAÇÃO (CRÍTICO)
  ${includeChords 
    ? `- CIFRAS INLINE OBRIGATÓRIAS: Você DEVE colocar os acordes entre colchetes [ ] exatamente antes da sílaba onde a mudança ocorre.
       - Exemplo CORRETO: "A [D]luz que [A]brilha"
       - Exemplo ERRADO (Não faça isso):
         D       A
         A luz que brilha
       - NÃO coloque acordes flutuando acima do texto. O sistema quebra.` 
    : `- Apenas a letra pura, formatada em estrofes.`
  }
  - Remova tablaturas, intros complexas de guitarra (solo/riff) ou cabeçalhos desnecessários.
  - Mantenha a estrutura de estrofes e refrão.

  PASSO 3: OUTPUT JSON
  Retorne APENAS um objeto JSON válido (sem markdown em volta se possível, mas lidaremos se houver).
  {
    "content": "A letra/cifra formatada aqui...",
    "spotifyUrl": "Link completo https://open.spotify.com/track/...",
    "title": "Título Oficial encontrado",
    "artist": "Artista Oficial encontrado",
    "originalKey": "Tom encontrado (ex: G, Cm)"
  }
  `;

  const prompt = `
  Encontre a música: "${songTitle}" do artista "${artist}".
  ${includeChords ? "Preciso da CIFRA no formato [Acorde]Letra." : "Preciso apenas da LETRA."}
  Se não encontrar a cifra exata, traga a letra e avise no início.
  Busque também o link do Spotify Track.
  `;

  try {
    const response = await runWithFallback(async (modelName) => {
        const freshAi = new GoogleGenAI({ apiKey: getApiKey() });
        return await freshAi.models.generateContent({ 
            model: modelName, 
            contents: prompt, 
            config: { 
                systemInstruction, 
                tools: [{ googleSearch: {} }], 
                temperature: 0.1 // Low temperature for factual extraction
            } 
        });
    }, TEXT_MODELS_FALLBACK, preferredModel);

    let text = response.text || "";
    const jsonString = extractJson(text);
    
    let contentClean = "";
    let finalUrl = "";
    let detectedKey = "";

    if (jsonString) {
        try {
            const jsonResponse = JSON.parse(jsonString);
            contentClean = jsonResponse.content || "";
            finalUrl = jsonResponse.spotifyUrl || "";
            detectedKey = jsonResponse.originalKey || ""; 
        } catch (e) {
            console.warn("JSON Parse Error, using raw text", e);
            contentClean = text; 
        }
    } else {
        contentClean = text;
    }

    // Clean up typical garbage from AI outputs if JSON failed
    if (!jsonString) {
        contentClean = contentClean.replace(/```json/g, '').replace(/```/g, '');
    }

    // Final cleanup of content
    contentClean = contentClean
        .replace(/^.*(Intro:|Introd:|Introdução:|Solo:|Riff:|Tab:|Ponte:).*$/gim, '') // Remove headers of instrumental parts if they have no lyrics
        .replace(/E\|.*?\n/g, '').replace(/B\|.*?\n/g, '') // Remove guitar tabs
        .trim();
    
    if (contentClean.length < 50) {
        contentClean = "Conteúdo não encontrado com qualidade suficiente. Por favor, tente ajustar o nome da música ou artista.";
    }

    return { 
        content: contentClean, 
        videoUrl: finalUrl, 
        originalKey: detectedKey 
    };

  } catch (error) { 
      console.error("Fetch Lyrics Critical Error:", error);
      return { content: "Erro de conexão com a IA. Verifique sua chave de API ou tente novamente em instantes.", videoUrl: "" }; 
  }
};

export const fetchLiturgyDetails = async (date: Date, prioritizeSpeed: boolean = false): Promise<{ title: string; reading1: string; psalm: string; reading2: string; gospel: string; _fromCache?: boolean; }> => {
  const dateKey = getDateKey(date);
  
  // 1. Check Local Storage
  const localData = LiturgyLocalStorage.get(dateKey);
  if (localData) return { ...localData, _fromCache: true };

  // 2. Check Firestore Cache
  const cachedData = await LiturgyCacheService.get(dateKey);
  if (cachedData) {
      LiturgyLocalStorage.save(dateKey, cachedData);
      return { ...cachedData, _fromCache: true };
  }

  const systemInstruction = `VOCÊ É UM ASSISTENTE LITÚRGICO CATÓLICO (CNBB). OBJETIVO: Retornar a liturgia do dia EXATA para o Brasil. RETORNE JSON: { "title": "...", "reading1": "HTML", "psalm": "HTML", "reading2": "HTML", "gospel": "HTML" }. USE HTML para formatar os textos.`;
  const prompt = `Liturgia Diária completa e EXATA para o dia ${date.toLocaleDateString('pt-BR')} (Fonte: CNBB/Canção Nova). Retorne JSON.`;

  try {
    const response = await runWithFallback(async (modelName) => {
        const freshAi = new GoogleGenAI({ apiKey: getApiKey() });
        return await freshAi.models.generateContent({ model: modelName, contents: prompt, config: { systemInstruction, tools: [{ googleSearch: {} }], temperature: 0.1 } });
    }, prioritizeSpeed ? FAST_MODELS_FALLBACK : TEXT_MODELS_FALLBACK);

    let text = response.text || "";
    const jsonString = extractJson(text);
    let parsed: any = {};
    if (jsonString) try { parsed = JSON.parse(jsonString); } catch (e) {}

    const result = { title: parsed.title || "Liturgia", reading1: parsed.reading1 || "N/A", psalm: parsed.psalm || "N/A", reading2: parsed.reading2 || "", gospel: parsed.gospel || "N/A" };
    
    // Save to caches
    if (result.title !== "Liturgia" && result.reading1 !== "N/A") {
        LiturgyLocalStorage.save(dateKey, result);
        LiturgyCacheService.save(dateKey, result);
    }
    
    return { ...result, _fromCache: false };
  } catch (error) { throw new Error("Falha na busca."); }
};

export const fetchDailyCuriosity = async (celebrationTitle: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const systemInstruction = "Você é um especialista em hagiografia e liturgia católica. Seu objetivo é fornecer UMA curiosidade breve, fascinante e espiritual sobre o santo ou festa do dia.";
        const prompt = `Hoje a Igreja celebra: ${celebrationTitle}. 
        Gere um parágrafo curto (máximo 40 palavras) com uma curiosidade histórica ou espiritual interessante sobre este santo ou festa. 
        Se for Tempo Comum (Féria), gere uma frase inspiradora curta de um santo aleatório.
        Não use markdown. Seja direto.`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: { systemInstruction, temperature: 0.7 }
        });

        return response.text?.trim() || "Dia de graça e paz no Senhor.";
    } catch (e) {
        return "Vivendo o mistério de Cristo no dia a dia.";
    }
};

export const generateSaintImage = async (celebrationTitle: string) => {
    const contextKey = `saint_${getDateKey(new Date())}`;
    const localCached = getCachedImage(contextKey);
    if (localCached) return localCached;

    if (globalQuotaExceeded) return null;

    const prompt = `Catholic iconography of ${celebrationTitle}. Sacred art style, detailed, golden halo, divine light, oil painting texture. High quality, 8k.`;

    try {
        const response = await runWithFallback(async (modelName) => {
            const freshAi = new GoogleGenAI({ apiKey: getApiKey() });
            return await freshAi.models.generateContent({ 
                model: modelName, 
                contents: { parts: [{ text: prompt }] }, 
                config: { imageConfig: { aspectRatio: "1:1" } } 
            });
        }, IMAGE_MODELS_FALLBACK);

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const compressedBase64 = await compressForFirestore(`data:image/png;base64,${part.inlineData.data}`);
                saveToLocal(contextKey, compressedBase64);
                return compressedBase64;
            }
        }
        return null;
    } catch (error) { return null; }
};

export const generateChatResponse = async (history: {role: string, parts: any[]}[], message: string, useThinking: boolean, useSearch: boolean, imageAttachments?: { mimeType: string, data: string }[] | null, currentPage: string = '/', customSystemInstruction?: string) => {
  let preferredModel = 'gemini-3-pro-preview';
  const config: any = { systemInstruction: customSystemInstruction || "Você é um assistente do Ministério Uziel." };
  if (useSearch) config.tools = [{ googleSearch: {} }];

  try {
    const currentMessageParts: any[] = [];
    if (imageAttachments) imageAttachments.forEach(img => currentMessageParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } }));
    if (message) currentMessageParts.push({ text: message });

    const result = await runWithFallback(async (modelName) => {
        const freshAi = new GoogleGenAI({ apiKey: getApiKey() });
        const chat = freshAi.chats.create({ model: modelName, history, config });
        return await chat.sendMessage({ message: currentMessageParts });
    }, TEXT_MODELS_FALLBACK, preferredModel);
    
    let cleanText = result.text || "Sem resposta.";
    const jsonMatch = cleanText.match(/```json\n?([\s\S]*?)\n?```/);
    let musicData = null;
    if (jsonMatch) { try { musicData = JSON.parse(jsonMatch[1]); if (musicData.type === 'music_result') cleanText = cleanText.replace(jsonMatch[0], '').trim(); } catch(e){} }
    return { text: cleanText, grounding: result.candidates?.[0]?.groundingMetadata?.groundingChunks, musicData };
  } catch (error) { throw error; }
};

export const generateCatholicChurchImage = async (contextKey: string = 'default') => {
  const hour = new Date().getHours();
  let period: 'morning' | 'afternoon' | 'night' = 'morning';
  if (hour >= 12 && hour < 18) period = 'afternoon'; else if (hour >= 18 || hour < 5) period = 'night';
  const today = new Date().toISOString().split('T')[0];
  const fullCacheKey = `${contextKey}_${period}`; 
  
  // 1. Check strict in-memory/local storage cache
  const localCached = getCachedImage(fullCacheKey); 
  if (localCached) return localCached;

  try {
      // 2. CHECK FIRESTORE FOR EXISTING ACTIVE IMAGE (ROBUST CHECK)
      // Instead of guessing the ID, we query for an active image matching the context and date.
      const existingImage = await DailyImageService.findActiveImage(fullCacheKey, today);
      
      if (existingImage && existingImage.imageUrl) {
          saveToLocal(fullCacheKey, existingImage.imageUrl); 
          return existingImage.imageUrl;
      }
  } catch (e) {
      console.warn("Failed to check existing image, proceeding to generation.", e);
  }

  // 3. Generate New Image (Only if quota allows)
  if (globalQuotaExceeded) return null;
  const prompt = getDiversePrompt(contextKey, period);

  try {
    const response = await runWithFallback(async (modelName) => {
        const freshAi = new GoogleGenAI({ apiKey: getApiKey() });
        return await freshAi.models.generateContent({ model: modelName, contents: { parts: [{ text: prompt }] }, config: { imageConfig: { aspectRatio: "16:9" } } });
    }, IMAGE_MODELS_FALLBACK);
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
         const compressedBase64 = await compressForFirestore(`data:image/png;base64,${part.inlineData.data}`);
         // Save with context metadata
         await DailyImageService.saveImage(`${fullCacheKey}_${today}_${Date.now()}`, compressedBase64, today, fullCacheKey);
         saveToLocal(fullCacheKey, compressedBase64);
         return compressedBase64;
      }
    }
    throw new Error("No image generated");
  } catch (error: any) { return null; }
};

const getDiversePrompt = (contextKey: string, period: 'morning' | 'afternoon' | 'night'): string => {
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const catIdx = (dayOfYear + (period === 'morning' ? 0 : period === 'afternoon' ? 2 : 4)) % 4; 
    let base = [PROMPTS_ARCHITECTURE, PROMPTS_NATURE_FAITH, PROMPTS_OBJECTS, PROMPTS_ARTISTIC][catIdx][dayOfYear % 10];
    let lighting = period === 'morning' ? "soft morning sunlight" : period === 'afternoon' ? "vivid natural daylight" : "mystical night candlelight";
    return `${base} Style: ${ART_STYLES[dayOfYear % 5]}. Context: ${lighting}. Masterpiece, 8k.`;
};

export const generateRepertoryImage = async (theme: string) => {
  const prompt = `Catholic Church songbook cover. Theme: "${theme}". Divine sacred art style. 4k, no text.`;
  try {
    const response = await runWithFallback(async (modelName) => {
        const freshAi = new GoogleGenAI({ apiKey: getApiKey() });
        return await freshAi.models.generateContent({ model: modelName, contents: { parts: [{ text: prompt }] }, config: { imageConfig: { aspectRatio: "1:1" } } });
    }, IMAGE_MODELS_FALLBACK);
    for (const part of response.candidates?.[0]?.content?.parts || []) if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    return null;
  } catch (e) { return null; }
};

export const generateImageFromChat = async (prompt: string) => {
  try {
    const response = await runWithFallback(async (modelName) => {
        const freshAi = new GoogleGenAI({ apiKey: getApiKey() });
        return await freshAi.models.generateContent({ model: modelName, contents: { parts: [{ text: prompt }] }, config: { imageConfig: { aspectRatio: "1:1" } } });
    }, IMAGE_MODELS_FALLBACK);
    for (const part of response.candidates?.[0]?.content?.parts || []) if (part.inlineData) return { image: `data:image/png;base64,${part.inlineData.data}`, text: "Imagem gerada." };
    throw new Error();
  } catch (e) { throw e; }
};

export const generateSpeech = async (text: string, voiceName: string = 'Kore') => {
  // --- BUG FIX: GUARD CLAUSE FOR EMPTY TEXT ---
  if (!text || !text.trim()) {
      console.warn("TTS: Empty text received, skipping generation.");
      return "";
  }

  try {
      const freshAi = new GoogleGenAI({ apiKey: getApiKey() });
      const response = await freshAi.models.generateContent({ 
          model: "gemini-2.5-flash-preview-tts", 
          contents: [{ parts: [{ text }] }], 
          config: { 
              responseModalities: [Modality.AUDIO], 
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } 
          } 
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  } catch (e) {
      console.error("Gemini TTS Error:", e);
      throw e; 
  }
};

export const generateTimeBasedBackground = async (period: 'morning' | 'afternoon' | 'night') => await generateCatholicChurchImage(`login`);
