
// --- LITURGICAL CALENDAR ENGINE ---

type LiturgicalColor = 'green' | 'purple' | 'red' | 'white' | 'rose' | 'black';

export interface LiturgicalDay {
    date: Date;
    day: number;
    month: number;
    year: number;
    season: 'Advent' | 'Christmas' | 'Lent' | 'Easter' | 'Ordinary';
    color: LiturgicalColor;
    title?: string;
    isSolemnity: boolean;
    isFeast: boolean;
    isMemorial: boolean;
    priority: number; // Para resolver conflitos
}

// Fixed Feasts (Month/Day)
const FIXED_FEASTS: { [key: string]: { title: string, color: LiturgicalColor, rank: 'solemnity' | 'feast' | 'memorial' } } = {
    '1/1': { title: 'Santa Maria, Mãe de Deus', color: 'white', rank: 'solemnity' },
    '6/1': { title: 'Epifania do Senhor', color: 'white', rank: 'solemnity' },
    '19/3': { title: 'São José, Esposo de Maria', color: 'white', rank: 'solemnity' },
    '25/3': { title: 'Anunciação do Senhor', color: 'white', rank: 'solemnity' },
    '1/5': { title: 'São José Operário', color: 'white', rank: 'memorial' },
    '13/5': { title: 'Nossa Senhora de Fátima', color: 'white', rank: 'memorial' },
    '24/6': { title: 'Natividade de São João Batista', color: 'white', rank: 'solemnity' },
    '29/6': { title: 'São Pedro e São Paulo', color: 'red', rank: 'solemnity' },
    '6/8': { title: 'Transfiguração do Senhor', color: 'white', rank: 'feast' },
    '15/8': { title: 'Assunção de Nossa Senhora', color: 'white', rank: 'solemnity' },
    '14/9': { title: 'Exaltação da Santa Cruz', color: 'red', rank: 'feast' },
    '29/9': { title: 'Arcanjos Miguel, Gabriel e Rafael', color: 'white', rank: 'feast' },
    '12/10': { title: 'Nossa Senhora Aparecida', color: 'white', rank: 'solemnity' },
    '1/11': { title: 'Todos os Santos', color: 'white', rank: 'solemnity' },
    '2/11': { title: 'Fiéis Defuntos', color: 'purple', rank: 'solemnity' }, // Or Black
    '8/12': { title: 'Imaculada Conceição', color: 'white', rank: 'solemnity' },
    '12/12': { title: 'Nossa Senhora de Guadalupe', color: 'white', rank: 'feast' },
    '13/12': { title: 'Santa Luzia', color: 'red', rank: 'memorial' },
    '25/12': { title: 'Natal do Senhor', color: 'white', rank: 'solemnity' },
    // Adicione mais santos conforme necessidade
};

// Helper: Get Easter Date (Meeus/Jones/Butcher's Algorithm)
const getEasterDate = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
};

const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

export const LiturgicalService = {
    getDayInfo: (date: Date): LiturgicalDay => {
        const year = date.getFullYear();
        const d = new Date(date);
        d.setHours(0,0,0,0);
        
        // Critical Dates Calculation
        const easter = getEasterDate(year);
        const ashWednesday = addDays(easter, -46);
        const palmSunday = addDays(easter, -7);
        const goodFriday = addDays(easter, -2);
        const pentecost = addDays(easter, 49);
        const corpusChristi = addDays(easter, 60); // Thursday
        const sacredHeart = addDays(easter, 68); // Friday
        
        // Advent Calculation (4 Sundays before Dec 25)
        const christmas = new Date(year, 11, 25);
        const christmasDayOfWeek = christmas.getDay(); // 0 = Sun
        const daysToSubtract = christmasDayOfWeek === 0 ? 28 : 21 + christmasDayOfWeek; 
        const firstSundayAdvent = new Date(year, 11, 25 - daysToSubtract);

        // --- DETERMINE SEASON ---
        let season: LiturgicalDay['season'] = 'Ordinary';
        let color: LiturgicalColor = 'green';
        let title = '';
        let isSolemnity = false;
        let isFeast = false;
        let isMemorial = false;

        // 1. LENT & EASTER
        if (d >= ashWednesday && d < easter) {
            season = 'Lent';
            color = 'purple';
            if (d.getTime() === ashWednesday.getTime()) { title = 'Quarta-feira de Cinzas'; isSolemnity = true; }
            else if (d.getTime() === palmSunday.getTime()) { title = 'Domingo de Ramos'; color = 'red'; isSolemnity = true; }
            else if (d.getTime() === addDays(easter, -3).getTime()) { title = 'Quinta-feira Santa'; color = 'white'; isSolemnity = true; }
            else if (d.getTime() === goodFriday.getTime()) { title = 'Sexta-feira da Paixão'; color = 'red'; isSolemnity = true; }
            else if (d.getTime() === addDays(easter, -1).getTime()) { title = 'Sábado Santo (Vigília)'; color = 'white'; isSolemnity = true; }
            // Laetare Sunday (4th of Lent)
            else if (d.getTime() === addDays(easter, -21).getTime()) { title = 'Domingo da Alegria (Laetare)'; color = 'rose'; }
        } else if (d >= easter && d <= pentecost) {
            season = 'Easter';
            color = 'white';
            if (d.getTime() === easter.getTime()) { title = 'Domingo de Páscoa'; color = 'white'; isSolemnity = true; }
            else if (d.getTime() === addDays(easter, 39).getTime()) { title = 'Ascensão do Senhor'; color = 'white'; isSolemnity = true; } // Brazil moves to Sunday usually, keep standard
            else if (d.getTime() === pentecost.getTime()) { title = 'Pentecostes'; color = 'red'; isSolemnity = true; }
        } else if (d >= firstSundayAdvent && d < christmas) {
            season = 'Advent';
            color = 'purple';
            // Gaudete Sunday (3rd of Advent)
            if (d.getTime() === addDays(firstSundayAdvent, 14).getTime()) { title = 'Domingo da Alegria (Gaudete)'; color = 'rose'; }
        } else if (d >= christmas || d <= new Date(year, 0, 13)) { // Rough approximation for Baptism
            season = 'Christmas';
            color = 'white';
        }

        // 2. MOVEABLE SOLEMNITIES IN ORDINARY TIME
        if (season === 'Ordinary') {
            if (d.getTime() === addDays(pentecost, 7).getTime()) { title = 'Santíssima Trindade'; color = 'white'; isSolemnity = true; }
            if (d.getTime() === corpusChristi.getTime()) { title = 'Corpus Christi'; color = 'white'; isSolemnity = true; }
            if (d.getTime() === sacredHeart.getTime()) { title = 'Sagrado Coração de Jesus'; color = 'white'; isSolemnity = true; }
        }

        // 3. FIXED FEASTS (Override Ordinary/Lent if Solemnity, check precedence)
        const key = `${d.getDate()}/${d.getMonth() + 1}`;
        const fixed = FIXED_FEASTS[key];
        
        if (fixed) {
            // Basic precedence logic: Solemnities override seasons except Triduum/Easter/Xmas
            if (fixed.rank === 'solemnity') {
                title = fixed.title;
                color = fixed.color;
                isSolemnity = true;
            } else if (!isSolemnity && !title) {
                // Only apply memorials if day is "empty" or lower rank
                if (season !== 'Lent' && season !== 'Advent' && season !== 'Easter') {
                    title = fixed.title;
                    color = fixed.color;
                    isFeast = fixed.rank === 'feast';
                    isMemorial = fixed.rank === 'memorial';
                } else if (fixed.rank === 'feast') {
                     // Feasts can occur in some seasons
                     title = fixed.title;
                     color = fixed.color;
                     isFeast = true;
                }
            }
        }

        // Sunday Title Logic if empty
        if (!title && d.getDay() === 0) {
            if (season === 'Ordinary') title = `${Math.ceil((d.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}º Domingo do Tempo Comum`;
            if (season === 'Lent') title = `Domingo da Quaresma`;
            if (season === 'Advent') title = `Domingo do Advento`;
            if (season === 'Easter') title = `Domingo da Páscoa`;
        }

        return {
            date: d,
            day: d.getDate(),
            month: d.getMonth(),
            year: year,
            season,
            color,
            title: title || '',
            isSolemnity,
            isFeast,
            isMemorial,
            priority: isSolemnity ? 1 : 2
        };
    },

    getMonthData: (year: number, month: number): LiturgicalDay[] => {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days: LiturgicalDay[] = [];
        
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(LiturgicalService.getDayInfo(new Date(year, month, i)));
        }
        return days;
    }
};
