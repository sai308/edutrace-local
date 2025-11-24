import { ref } from 'vue';

export function useSort(initialField = 'date', initialDirection = 'desc') {
    const sortField = ref(initialField);
    const sortDirection = ref(initialDirection);

    function toggleSort(field) {
        if (sortField.value === field) {
            sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
        } else {
            sortField.value = field;
            sortDirection.value = 'asc'; // Default to asc for new field

            // Special case for date-like fields, usually want desc first
            if (['date', 'createdAt', 'uploadedAt', 'taskDate'].includes(field)) {
                sortDirection.value = 'desc';
            }
        }
    }

    return {
        sortField,
        sortDirection,
        toggleSort
    };
}
