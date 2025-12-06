import { ref } from 'vue';
import { analyticsService } from '../services/analytics.service';
import { toast } from '@/services/toast';

export function useAnalyticsDetails(meetId) {
    const stats = ref(null);
    const loading = ref(true);
    const error = ref(null);

    async function loadDetails(teacherName = null) {
        loading.value = true;
        error.value = null;
        try {
            stats.value = await analyticsService.getDetailedStats(meetId, teacherName);
        } catch (err) {
            console.error('Failed to load detailed stats:', err);
            error.value = err;
            toast.error('Failed to load analytics details');
        } finally {
            loading.value = false;
        }
    }

    return {
        stats,
        loading,
        error,
        loadDetails
    };
}
