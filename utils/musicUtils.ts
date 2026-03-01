
// --- MUSIC THEORY ENGINE ---

const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTES_FLAT =  ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Normaliza notas para facilitar cálculos (ex: Cb vira B, E# vira F)
const NORMALIZE_MAP: { [key: string]: string } = {
    'Cb': 'B', 'E#': 'F', 'B#': 'C', 'Fb': 'E'
};

const getSemitoneIndex = (note: string) => {
    if (!note) return -1;
    // Remove sufixos de acordes (m, 7, sus, etc) para encontrar a nota raiz pura na escala
    // Ex: "C#m7" -> "C#", "Bb" -> "Bb"
    const cleanNote = note.replace(/m.*/, '').replace(/[0-9].*/, '').replace(/sus.*/, '').replace(/aug.*/, '').replace(/dim.*/, '');
    
    const n = NORMALIZE_MAP[cleanNote] || cleanNote;
    let idx = NOTES_SHARP.indexOf(n);
    if (idx === -1) idx = NOTES_FLAT.indexOf(n);
    return idx;
};

export const MusicUtils = {
    // Lista de tons para o Select (Apenas raízes)
    KEYS: ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],

    // Transpõe uma única nota/acorde raiz
    transposeNote: (note: string, semitones: number) => {
        if (!note) return note;
        const index = getSemitoneIndex(note);
        if (index === -1) return note; // Não é nota musical reconhecida

        let newIndex = (index + semitones) % 12;
        if (newIndex < 0) newIndex += 12;

        // Decide se usa sustenido ou bemol baseado na simplicidade (padrão sharp por enquanto)
        return NOTES_SHARP[newIndex];
    },

    // Transpõe um acorde complexo (ex: C#m7/G#)
    transposeChord: (chord: string, semitones: number) => {
        // Regex para separar a nota raiz, o sufixo (m7, sus4, etc) e o baixo
        // Ex: [C#][m7]/[G#]
        // Grupo 1: Raiz (A-G e opcional #/b)
        // Grupo 2: Sufixo (qualquer coisa até a barra ou fim)
        // Grupo 3: Barra + Baixo (opcional)
        // Grupo 4: Nota do Baixo (sem a barra)
        const regex = /^([A-G][#b]?)(.*?)(\/([A-G][#b]?))?$/;
        const match = chord.match(regex);

        if (!match) return chord; // Não parece um acorde válido

        const root = match[1];
        const suffix = match[2] || '';
        const bass = match[4];

        const newRoot = MusicUtils.transposeNote(root, semitones);
        let newBass = '';

        if (bass) {
            newBass = '/' + MusicUtils.transposeNote(bass, semitones);
        }

        return newRoot + suffix + newBass;
    },

    // Transpõe um texto inteiro contendo acordes entre colchetes [Am]
    transposeText: (text: string, fromKey: string, toKey: string): string => {
        if (!fromKey || !toKey) return text;
        
        // Remove 'm' para calcular a distância entre as tônicas (Ex: Am -> C = A -> C)
        const rootFrom = fromKey.replace(/m.*/, '');
        const rootTo = toKey.replace(/m.*/, '');

        const idxFrom = getSemitoneIndex(rootFrom);
        const idxTo = getSemitoneIndex(rootTo);

        if (idxFrom === -1 || idxTo === -1) return text; // Tons inválidos

        const semitones = idxTo - idxFrom;
        if (semitones === 0) return text;

        // Substitui tudo que estiver entre colchetes []
        return text.replace(/\[([^\]]+)\]/g, (match, chordInner) => {
            const transposed = MusicUtils.transposeChord(chordInner, semitones);
            return `[${transposed}]`;
        });
    },
    
    // Tenta detectar o tom predominante 
    detectKey: (text: string): string | null => {
        // 1. Tenta achar metadado explícito "Tom: X"
        const metaMatch = text.match(/Tom:\s*([A-G][#b]?m?)/i);
        if (metaMatch) return metaMatch[1];

        // 2. Fallback: Heurística baseada no último acorde
        const matches = text.match(/\[([A-G][#b]?m?)\]/g);
        if (!matches || matches.length === 0) return null;
        
        // Pega o último acorde da música (geralmente resolve na tônica)
        const lastChord = matches[matches.length - 1];
        const cleanLast = lastChord.replace(/[\[\]]/g, '');
        
        return cleanLast;
    }
};
