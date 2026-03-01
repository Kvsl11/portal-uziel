
export const LiturgyLocalStorage = {
    save: (date: string, data: any) => {
        try {
            localStorage.setItem(`liturgy_${date}`, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error("Local Storage Error", e);
        }
    },
    get: (date: string) => {
        try {
            const item = localStorage.getItem(`liturgy_${date}`);
            if (!item) return null;
            const parsed = JSON.parse(item);
            // Optional: Expiry check (e.g., 30 days)
            return parsed.data;
        } catch (e) {
            return null;
        }
    },
    delete: (date: string) => {
        localStorage.removeItem(`liturgy_${date}`);
    },
    clear: () => {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('liturgy_')) {
                localStorage.removeItem(key);
            }
        });
    },
    getKeys: () => {
        return Object.keys(localStorage).filter(k => k.startsWith('liturgy_')).map(k => k.replace('liturgy_', ''));
    },
    has: (date: string) => {
        return !!localStorage.getItem(`liturgy_${date}`);
    }
};
