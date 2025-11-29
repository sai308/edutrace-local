const LOCALE_KEY = 'edutrace_locale';
const DEFAULT_LOCALE = 'en-US';

// Import locale data
import enUS from '../locales/en-US.json';
import ukUA from '../locales/uk-UA.json';

const locales = {
    'en-US': enUS,
    'uk-UA': ukUA
};

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
    },

    /**
     * Get a translation for a key path (e.g., 'loader.switchingWorkspace')
     * @param {string} keyPath - Dot-separated path to translation key
     * @returns {string} Translated text or key path if not found
     */
    getTranslation(keyPath) {
        const locale = this.getLocale();
        const messages = locales[locale] || locales[DEFAULT_LOCALE];

        // Navigate through the object using the key path
        const keys = keyPath.split('.');
        let value = messages;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return keyPath; // Return key path if not found
            }
        }

        return typeof value === 'string' ? value : keyPath;
    }
};

