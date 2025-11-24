import { watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

/**
 * Syncs reactive state with URL query parameters.
 * 
 * @param {Object} stateMap - Map of query param keys to reactive refs.
 *                            Example: { search: searchQuery, sort: sortField }
 */
export function useQuerySync(stateMap) {
    const router = useRouter();
    const route = useRoute();

    // 1. Initialize state from route.query
    Object.entries(stateMap).forEach(([key, refVal]) => {
        if (route.query[key] !== undefined) {
            refVal.value = route.query[key];
        }
    });

    // 2. Watch route query to update state (Back/Forward navigation)
    watch(() => route.query, (newQuery) => {
        Object.entries(stateMap).forEach(([key, refVal]) => {
            const newVal = newQuery[key];

            // If param exists and is different, update state
            if (newVal !== undefined && newVal !== String(refVal.value)) {
                refVal.value = newVal;
            }
            // If param is missing but state has value, reset state (optional, but good for consistency)
            else if (newVal === undefined && refVal.value) {
                // Try to reset to "empty" value based on current type
                if (typeof refVal.value === 'boolean') refVal.value = false;
                else if (typeof refVal.value === 'string') refVal.value = '';
                else refVal.value = null;
            }
        });
    });

    // 3. Watch state to update route query
    watch(Object.values(stateMap), () => {
        const newQuery = { ...route.query };

        Object.entries(stateMap).forEach(([key, refVal]) => {
            const val = refVal.value;
            // Only add to query if truthy (or 0/false if we want to support those, but usually filters are optional)
            // For strings, empty string usually means no filter.
            if (val) {
                newQuery[key] = val;
            } else {
                delete newQuery[key];
            }
        });

        router.replace({ query: newQuery });
    });
}
