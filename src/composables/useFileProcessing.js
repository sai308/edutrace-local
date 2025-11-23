import { ref } from 'vue';
import { parseCSV } from '../services/csvParser';
import { repository } from '../services/repository';
import { toast } from '../services/toast';
import { useMeets } from './useMeets';

export function useFileProcessing() {
    const isProcessing = ref(false);
    const { loadMeets, groupsMap } = useMeets();

    async function handleFilesDropped(files, onRefreshDashboard) {
        isProcessing.value = true;
        try {
            const promises = files.map(file => parseCSV(file));
            const results = await Promise.all(promises);

            // Get duration limit
            const limitMinutes = await repository.getDurationLimit();
            const limitSeconds = limitMinutes > 0 ? limitMinutes * 60 : 0;

            let savedCount = 0;
            let skippedCount = 0;

            for (const result of results) {
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

            await loadMeets();
            if (onRefreshDashboard && typeof onRefreshDashboard === 'function') {
                onRefreshDashboard();
            }
        } catch (e) {
            console.error('Error parsing files:', e);
            toast.error('Error parsing files. Please check the console for details.');
        } finally {
            isProcessing.value = false;
        }
    }

    return {
        isProcessing,
        handleFilesDropped
    };
}
