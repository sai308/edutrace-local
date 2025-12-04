import { ref } from 'vue';
import { parseCSV } from '../services/csvParser';
import { repository } from '../services/repository';
import { toast } from '../services/toast';
import { useMeets } from './useMeets';

export function useFileProcessing() {
    const isProcessing = ref(false);
    const { loadMeets, groupsMap } = useMeets();
    const pendingFiles = ref([]);
    const showFilterModal = ref(false);
    const filterCallback = ref(null);

    async function handleFilesDropped(files, onRefreshDashboard) {
        // Store files and callback for later processing
        pendingFiles.value = files;
        filterCallback.value = onRefreshDashboard;

        // Show filter modal
        showFilterModal.value = true;
    }
    async function processFiles(filterMode) {
        if (!pendingFiles.value || pendingFiles.value.length === 0) return;
        isProcessing.value = true;
        showFilterModal.value = false;

        try {
            const promises = pendingFiles.value.map(file => parseCSV(file));
            const results = await Promise.all(promises);
            // Get duration limit
            const limitMinutes = await repository.getDurationLimit();
            const limitSeconds = limitMinutes > 0 ? limitMinutes * 60 : 0;
            let savedCount = 0;
            let skippedCount = 0;
            let unrecognizedCount = 0;
            for (const result of results) {
                // Check if filtering by related groups
                if (filterMode === 'related') {
                    const hasGroup = groupsMap.value[result.meetId];
                    if (!hasGroup) {
                        console.warn(`Skipping file with unrecognized group ID: ${result.meetId}`);
                        unrecognizedCount++;
                        continue;
                    }
                }
                const isDup = await repository.isDuplicateFile(result.filename, result.meetId, result.date);
                if (isDup) {
                    console.warn(`Skipping duplicate file: ${result.filename}`);
                    skippedCount++;
                    continue;
                }
                // Apply duration limit if set
                if (limitSeconds > 0) {
                    result.participants.forEach(p => {
                        if (p.duration > limitSeconds) {
                            p.duration = limitSeconds;
                        }
                    });
                }
                await repository.saveMeet(result);
                savedCount++;
                // Check if group exists for this meetId, if so, add students
                const group = groupsMap.value[result.meetId];
                if (group) {
                    for (const p of result.participants) {
                        await repository.saveMember({
                            name: p.name,
                            groupName: group.name,
                            email: p.email || '',
                            role: 'student' // Default role
                        });
                    }
                }
            }
            if (savedCount > 0) {
                toast.success(`Successfully processed ${savedCount} files.`);
            }
            if (skippedCount > 0) {
                toast.info(`Skipped ${skippedCount} duplicate files.`);
            }
            if (unrecognizedCount > 0) {
                toast.info(`Skipped ${unrecognizedCount} file(s) with unrecognized group IDs.`);
            }

            await loadMeets();

            if (filterCallback.value && typeof filterCallback.value === 'function') {
                filterCallback.value();
            }
        } catch (e) {
            console.error('Error parsing files:', e);
            toast.error('Error parsing files. Please check the console for details.');
        } finally {
            isProcessing.value = false;
            pendingFiles.value = [];
            filterCallback.value = null;
        }
    }

    function cancelFilter() {
        showFilterModal.value = false;
        pendingFiles.value = [];
        filterCallback.value = null;
    }

    return {
        handleFilesDropped,
        showFilterModal,
        isProcessing,
        pendingFiles,
        processFiles,
        cancelFilter
    };
}
