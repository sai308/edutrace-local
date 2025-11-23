import { ref } from 'vue';
import { repository } from '../services/repository';
import { toast } from '../services/toast';

// Global state
const meets = ref([]);
const groupsMap = ref({});

export function useMeets() {

    async function loadMeets() {
        meets.value = await repository.getAllMeets();
        groupsMap.value = await repository.getGroupMap();
    }

    async function deleteMeet(id) {
        await repository.deleteMeet(id);
        await loadMeets();
    }

    async function bulkDeleteMeets(ids) {
        await repository.deleteMeets(ids);
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
