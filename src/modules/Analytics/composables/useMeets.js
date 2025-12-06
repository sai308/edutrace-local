import { ref } from 'vue';
import { meetsRepository } from '../services/meets.repository';
import { groupsRepository } from '../../Groups/services/groups.repository';
import { toast } from '@/services/toast';

// Global state - kept global to share across components if needed, or scoped if preferred.
// Keeping global/module-singleton pattern as per original file.
const meets = ref([]);
const groupsMap = ref({});

export function useMeets() {

    async function loadMeets() {
        // Parallel load
        const [allMeets, groupMap] = await Promise.all([
            meetsRepository.getAllMeets(),
            groupsRepository.getGroupMap()
        ]);
        meets.value = allMeets;
        groupsMap.value = groupMap;
    }

    async function deleteMeet(id) {
        await meetsRepository.deleteMeets([id]); // deleteMeet(id) isn't in repo, assumes deleteMeets for generic delete
        await loadMeets();
    }

    async function bulkDeleteMeets(ids) {
        await meetsRepository.deleteMeets(ids);
        await loadMeets();
    }

    return {
        meets,
        groupsMap,
        loadMeets,
        deleteMeet,
        bulkDeleteMeets
    };
}
