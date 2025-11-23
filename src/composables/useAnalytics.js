import { ref } from 'vue';
import { analytics } from '../services/analytics';

export function useAnalytics() {
    const stats = ref([]);
    const loading = ref(true);

    async function loadStats() {
        loading.value = true;
        try {
            stats.value = await analytics.getGlobalStats();
        } finally {
            loading.value = false;
        }
    }

    return {
        stats,
        loading,
        loadStats
    };
}
