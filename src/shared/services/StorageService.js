/**
 * StorageService
 * 
 * Unified adapter for LocalStorage and SessionStorage.
 * Handles:
 * - JSON serialization/deserialization
 * - Error handling (e.g., quota exceeded)
 * - Type safety defaults
 */

class StorageAdapter {
    /**
     * @param {Storage} storage - localStorage or sessionStorage
     */
    constructor(storage) {
        this.storage = storage;
    }

    /**
     * Get a value from storage.
     * Automatically parses JSON.
     * @param {string} key 
     * @param {any} defaultValue 
     * @returns {any}
     */
    get(key, defaultValue = null) {
        try {
            const item = this.storage.getItem(key);
            if (item === null) return defaultValue;

            // Attempt to parse JSON
            try {
                return JSON.parse(item);
            } catch (e) {
                // If parse fails, return strict string or try to infer?
                // For safety, if it looks like a number/bool, unquote it? 
                // Actually JSON.parse handles "123" -> 123. 
                // But if it was saved as raw string "simple string", JSON.parse("simple string") throws.
                // So if parse fails, return the raw string.
                return item;
            }
        } catch (e) {
            console.error(`StorageService: Error getting key '${key}'`, e);
            return defaultValue;
        }
    }

    /**
     * Set a value in storage.
     * Automatically stringifies objects.
     * @param {string} key 
     * @param {any} value 
     */
    set(key, value) {
        try {
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            this.storage.setItem(key, stringValue);
        } catch (e) {
            console.error(`StorageService: Error setting key '${key}'`, e);
            // Could emit an event or throw if critical
        }
    }

    /**
     * Remove a value from storage.
     * @param {string} key 
     */
    remove(key) {
        try {
            this.storage.removeItem(key);
        } catch (e) {
            console.error(`StorageService: Error removing key '${key}'`, e);
        }
    }

    /**
     * Clear all keys in this storage.
     */
    clear() {
        try {
            this.storage.clear();
        } catch (e) {
            console.error('StorageService: Error clearing storage', e);
        }
    }
}

export const local = new StorageAdapter(window.localStorage);
export const session = new StorageAdapter(window.sessionStorage);

export default {
    local,
    session
};
