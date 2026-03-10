async function test() {
    const url = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
    const spotifyOembedApi = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    
    try {
        const r1 = await fetch(spotifyOembedApi);
        console.log('Direct status:', r1.status);
        console.log('CORS headers:', r1.headers.get('access-control-allow-origin'));
    } catch (e) {
        console.error('Direct error:', e.message);
    }
}

test();
