import { useI18n } from 'vue-i18n';

export function useFormatters() {
    const { t } = useI18n();
    // We might need i18n for some formatting if it depends on locale, 
    // but usually toLocaleDateString handles it if we pass undefined or the locale.
    // For now, we'll stick to the patterns seen in the code (undefined locale).

    function formatDate(dateStr, options = {}) {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                ...options
            });
        } catch (e) {
            return dateStr;
        }
    }

    function formatDateTime(dateStr, options = {}) {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                ...options
            });
        } catch (e) {
            return dateStr;
        }
    }

    function formatTime(dateStr, options = {}) {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                ...options
            });
        } catch (e) {
            return dateStr;
        }
    }

    function formatDuration(seconds) {
        if (!seconds && seconds !== 0) return '-';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}${t('duration.hours')} ${m}${t('duration.minutes')}`;
        return `${m}${t('duration.minutes')}`;
    }

    function formatCompactDate(isoString) {
        if (!isoString) return '-';
        try {
            return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) {
            return isoString;
        }
    }

    return {
        formatDate,
        formatDateTime,
        formatTime,
        formatDuration,
        formatCompactDate
    };
}
