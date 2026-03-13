
export const LiturgyLocalStorage = {
    save: (date: string, data: any) => {
        try {
            // Clean up old liturgy entries to prevent QuotaExceededError
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('liturgy_') && k !== `liturgy_${date}`) {
                    // Keep at most a few recent ones, or just let it clean up aggressively.
                    // For simplicity, we'll just keep the current one being saved if we want to be aggressive,
                    // but it's better to keep a small history. Let's just remove anything older than 7 days.
                    try {
                        const item = localStorage.getItem(k);
                        if (item) {
                            const parsed = JSON.parse(item);
                            if (parsed.timestamp && Date.now() - parsed.timestamp > 7 * 24 * 60 * 60 * 1000) {
                                keysToRemove.push(k);
                            }
                        }
                    } catch (e) {}
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));

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
