import { ref } from 'vue';
import { analyticsService } from '@/modules/Analytics/services/analytics.service';
import { toast } from '@/services/toast';

export function useReportDetails(reportId) {
    const stats = ref(null);
    const loading = ref(true);
    const error = ref(null);

    async function loadDetails() {
        loading.value = true;
        error.value = null;
        try {
            stats.value = await analyticsService.getSingleReportStats(reportId);
        } catch (err) {
            console.error('Failed to load report details:', err);
            error.value = err;
            toast.error('Failed to load report details');
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
