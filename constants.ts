
export const APP_ID = 'portal-uziel-v1-fallback'; // Matching original ID to ensure data consistency
export const SUPER_ADMIN_USERNAME = 'kaio@uziel.com';
export const BRAND_BLUE = '#29aae2';

export const SONG_TYPES = [
    'Antes da Missa', 'Entrada', 'Entradas Especiais', 'Ato Penitencial', 
    'Glória', 'Salmo Responsorial', 'Aclamação ao Evangelho', 'Ofertório', 
    'Santo', 'Comunhão', 'Final', 'Adoração'
];

export const HOURLY_VERSES = [
    { text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito...", reference: "João 3:16" },
    { text: "O Senhor é o meu pastor; nada me faltará.", reference: "Salmos 23:1" },
    { text: "Posso todas as coisas em Cristo que me fortalece.", reference: "Filipenses 4:13" },
    { text: "Se, porém, não lhes agrada servir ao Senhor, escolham hoje a quem servirão...", reference: "Josué 24:15" },
    { text: "Tudo o que fizerem, façam de todo o coração, como para o Senhor...", reference: "Colossenses 3:23" },
];

// Capa padrão estática (SVG Data URI) com gradiente rico da marca sem ruído
const DEFAULT_COVER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800' viewBox='0 0 800 800'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%230c4a6e;stop-opacity:1' /%3E%3Cstop offset='50%25' style='stop-color:%2329aae2;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%237c3aed;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grad)'/%3E%3Ccircle cx='800' cy='0' r='400' fill='%2338bdf8' opacity='0.2'/%3E%3Ccircle cx='0' cy='800' r='400' fill='%237c3aed' opacity='0.2'/%3E%3C/svg%3E";

export const REPERTORY_COVERS = [
    DEFAULT_COVER_SVG, // Padrão Estático Rico
    'https://images.unsplash.com/photo-1510915361408-d5a56d90fa25?q=80&w=2070&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1548625361-ae80de43cc61?q=80&w=2070&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=2070&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1515165592879-1849b88c43e9?q=80&w=2070&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1507838153414-b4b713384ebd?q=80&w=2070&auto=format&fit=crop'
];

export const FALLBACK_IMAGES = {
    login_morning: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=2070&auto=format&fit=crop', 
    login_afternoon: 'https://images.unsplash.com/photo-1548625361-ae80de43cc61?q=80&w=2070&auto=format&fit=crop', 
    login_night: 'https://images.unsplash.com/photo-1510915361408-d5a56d90fa25?q=80&w=2070&auto=format&fit=crop', 
    home_hero_1: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=2070&auto=format&fit=crop',
    home_hero_2: 'https://images.unsplash.com/photo-1548625361-ae80de43cc61?q=80&w=2070&auto=format&fit=crop',
    playlists_hero: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=2070&auto=format&fit=crop', 
    rota_hero: 'https://images.unsplash.com/photo-1507838153414-b4b713384ebd?q=80&w=2070&auto=format&fit=crop', 
    default: 'https://images.unsplash.com/photo-1548625361-ae80de43cc61?q=80&w=2070&auto=format&fit=crop'
};

export const PORTAL_LINKS = [
    { title: "Mídias", icon: "fa-photo-video", color: "purple", url: "https://drive.google.com/drive/folders/1Feuv0be087x3zRc9hmecsKO4ZSEMcD3Q?usp=drive_link", desc: "Acesse nosso acervo de fotos e vídeos." },
    { title: "Músicas para Missa", icon: "fa-music", color: "pink", url: "https://musicasparamissa.com.br/", desc: "Veja as músicas mais adequadas." },
    { title: "Oração Eucarística", icon: "fa-cross", color: "amber", url: "https://santuarionsamordivino.com.br/liturgia-eucaristica-novo-missal-romano/", desc: "Orações para adoração." },
    { title: "Liturgia Diária", icon: "fa-book-open", color: "yellow", url: "https://www.cnbb.org.br/liturgia-diaria/", desc: "Leituras e salmo do dia." },
    { title: "Novos Membros", icon: "fa-user-plus", color: "sky", url: "https://docs.google.com/forms/d/1VF8dLdhjZnqK4_K2r_-ELXhV1frXMRdSZF-ORHR-TZA/edit?usp=drivesdk", desc: "Questionário para novos membros." },
    { title: "Organograma", icon: "fa-sitemap", color: "slate", url: "https://drive.google.com/file/d/1Nt1H12O73Xk9GtnVa2P0U3xx9zTZe-gu/view?usp=drivesdk", desc: "Estrutura de liderança." },
    { title: "Processos", icon: "fa-cogs", color: "slate", url: "https://docs.google.com/document/d/1_DUy9LPo1L1ZV_bxB1Sa5P8ySR6zZdmPD3qs6B_-gZY/edit?usp=drivesdk", desc: "Fluxos e procedimentos." },
    { title: "Canal de Denúncias", icon: "fa-shield-alt", color: "red", url: "https://docs.google.com/forms/d/e/1FAIpQLSfUkS-wHsisihvP-QDA4tgo9N8k8e5eHCn-CLoyghEqVgcY8A/viewform", desc: "Relato seguro e anônimo." },
    { title: "Críticas e Sugestões", icon: "fa-lightbulb", color: "blue", url: "https://docs.google.com/forms/d/e/1FAIpQLSfPhK1m2uOWOioOxDj-oI5xuueDQylWlXgKbnjtEA1gAI0ahg/viewform", desc: "Sua opinião importa." },
];
