import { ref } from 'vue';
import { analyticsService } from '../services/analytics.service';
import { groupsRepository } from '../../Groups/services/groups.repository';

export function useAnalytics() {
    const stats = ref([]);
    const loading = ref(true);
    const groupsMap = ref({});

    async function loadStats() {
        loading.value = true;
        try {
            const [data, groups] = await Promise.all([
                analyticsService.getGlobalStats(),
                groupsRepository.getGroupMap()
            ]);
            stats.value = data;
            groupsMap.value = groups;
        } catch (error) {
            console.error('Error loading analytics:', error);
        } finally {
            loading.value = false;
        }
    }

    return {
        stats,
        groupsMap,
        loading,
        loadStats
    };
}
