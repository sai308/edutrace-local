import { ref, computed, watch } from 'vue';

/**
 * Composable for managing column visibility in tables
 * @param {string} tableId - Unique identifier for the table (used for localStorage key)
 * @param {Array} columns - Array of column definitions { id: string, label: string, defaultVisible: boolean }
 * @returns {Object} - { visibleColumns, toggleColumn, resetColumns, isColumnVisible }
 */
export function useColumnVisibility(tableId, columns) {
    const storageKey = `table_columns_${tableId}`;

    // Load saved state from localStorage or use defaults
    const loadSavedState = () => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load column visibility state:', e);
        }

        // Return default state
        return columns.reduce((acc, col) => {
            acc[col.id] = col.defaultVisible !== false; // Default to true if not specified
            return acc;
        }, {});
    };

    const visibleColumns = ref(loadSavedState());

    // Save state to localStorage whenever it changes
    watch(visibleColumns, (newState) => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(newState));
        } catch (e) {
            console.error('Failed to save column visibility state:', e);
        }
    }, { deep: true });

    // Toggle a column's visibility
    const toggleColumn = (columnId) => {
        visibleColumns.value[columnId] = !visibleColumns.value[columnId];
    };

    // Reset to default visibility
    const resetColumns = () => {
        visibleColumns.value = columns.reduce((acc, col) => {
            acc[col.id] = col.defaultVisible !== false;
            return acc;
        }, {});
    };

    // Check if a column is visible
    const isColumnVisible = (columnId) => {
        return visibleColumns.value[columnId] !== false;
    };

    // Count of visible columns
    const visibleCount = computed(() => {
        return Object.values(visibleColumns.value).filter(Boolean).length;
    });

    return {
        visibleColumns,
        toggleColumn,
        resetColumns,
        isColumnVisible,
        visibleCount
    };
}
