
// --- MEDIA UTILITIES (SPOTIFY ONLY) ---
export const MediaUtils = {
  // Extrai informações detalhadas da URL (Focado em Spotify)
  parseUrl: (url: string) => {
    if (!url) return { type: 'link', id: null, subType: null };
    const cleanUrl = url.trim();

    // Spotify Pattern (Handle ?si= params by ignoring them in regex capture)
    if (cleanUrl.includes('spotify.com')) {
        const match = cleanUrl.match(/(track|playlist|album|artist|show|episode)\/([a-zA-Z0-9]{22})/);
        if (match) {
            return {
                type: 'spotify',
                subType: match[1],
                id: match[2]
            };
        }
    }

    return { type: 'link', id: null, subType: null };
  },

  // Gera a URL de Embed correta para o Spotify
  getEmbedUrl: (url: string) => {
      const info = MediaUtils.parseUrl(url);

      if (info.type === 'spotify' && info.id) {
          // utm_source=generator é padrão para embeds do Spotify para garantir o player correto
          return `https://open.spotify.com/embed/${info.subType}/${info.id}?utm_source=generator&theme=0`;
      }

      return null;
  },

  // Busca metadados reais (Título e Capa) usando o endpoint oEmbed do Spotify via Proxy
  fetchSpotifyOEmbed: async (url: string): Promise<{ title?: string, thumbnail_url?: string }> => {
      try {
          const info = MediaUtils.parseUrl(url);
          if (info.type !== 'spotify') return {};

          // Endpoint oficial do oEmbed do Spotify
          // Ensure we strip params for the oEmbed call
          const baseUrl = `https://open.spotify.com/${info.subType}/${info.id}`;
          const spotifyOembedApi = `https://open.spotify.com/oembed?url=${encodeURIComponent(baseUrl)}`;
          
          // Usamos o allorigins.win que é mais permissivo para retornar o JSON cru
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(spotifyOembedApi)}`;
          
          const response = await fetch(proxyUrl);
          if (!response.ok) throw new Error('Falha ao buscar metadados');
          
          const data = await response.json();
          
          return {
              title: data.title,
              thumbnail_url: data.thumbnail_url
          };
      } catch (e) {
          console.warn("Erro ao buscar metadados do Spotify via Proxy:", e);
          return {};
      }
  },

  getThumbnail: (url: string) => {
    return null; 
  },

  getMediaIcon: (url: string) => {
      const info = MediaUtils.parseUrl(url);
      if (info.type === 'spotify') return 'fa-spotify';
      return 'fa-link';
  },

  getMediaColor: (url: string) => {
      const info = MediaUtils.parseUrl(url);
      if (info.type === 'spotify') return 'text-green-500 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50';
      return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/50';
  }
};
