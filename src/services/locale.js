const LOCALE_KEY = 'edutrace_locale';
const DEFAULT_LOCALE = 'en-US';

export const localeService = {
    getLocale() {
        try {
            const saved = localStorage.getItem(LOCALE_KEY);
            return saved || DEFAULT_LOCALE;
        } catch (e) {
            console.warn('Failed to get locale from localStorage:', e);
            return DEFAULT_LOCALE;
        }
    },

    setLocale(locale) {
        try {
            localStorage.setItem(LOCALE_KEY, locale);
        } catch (e) {
            console.error('Failed to save locale to localStorage:', e);
        }
    }
};
