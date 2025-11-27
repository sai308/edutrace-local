import { ref } from 'vue';
import { repository } from '../services/repository';
import { parseMarksCSV } from '../services/marksParser';
import { toast } from '../services/toast';

export function useMarks() {
    const groups = ref([]);
    const flatMarks = ref([]);
    const isProcessing = ref(false);
    const allMeetIds = ref([]);
    const allTeachers = ref([]);

    async function loadGroups() {
        const allGroups = await repository.getGroups();
        groups.value = allGroups.sort((a, b) => a.name.localeCompare(b.name));
    }

    async function loadSuggestions() {
        const meets = await repository.getAllMeets();
        const meetIds = new Set();
        const teachers = new Set();

        meets.forEach(meet => {
            if (meet.meetId) meetIds.add(meet.meetId);
            if (meet.participants) {
                meet.participants.forEach(p => teachers.add(p.name));
            }
        });

        allMeetIds.value = Array.from(meetIds).sort();
        allTeachers.value = Array.from(teachers).sort();
    }

    async function loadAllData() {
        await loadGroups();
        // Use the new batch query method - single efficient database call
        flatMarks.value = await repository.getAllMarksWithRelations();
    }

    async function createGroup(groupData) {
        try {
            const { _pendingFile, ...rest } = groupData;
            const newGroup = {
                id: crypto.randomUUID(),
                ...rest
            };

            await repository.saveGroup(newGroup);
            await loadGroups();
            toast.success(`Group "${newGroup.name}" created.`);

            if (_pendingFile) {
                await processFile(_pendingFile, newGroup.name);
            }

            return newGroup;
        } catch (e) {
            console.error('Error creating group:', e);
            if (e.name === 'ConstraintError') {
                toast.error('A group with this Name or Meet ID already exists.');
            } else {
                toast.error('Failed to create group.');
            }
            throw e;
        }
    }

    async function processFile(file, groupName) {
        isProcessing.value = true;
        try {
            const result = await parseMarksCSV(file);

            const taskIds = [];
            for (const task of result.tasks) {
                task.groupName = groupName;
                const { id } = await repository.saveTask(task);
                taskIds.push(id);
            }

            let newMarksCount = 0;
            let skippedMarksCount = 0;

            for (const item of result.studentsData) {
                item.student.groupName = groupName;
                // Ensure role is set if not present (though saveMember handles it)
                const studentId = await repository.saveMember(item.student);

                for (const mark of item.marks) {
                    const taskId = taskIds[mark.taskIndex];
                    const { isNew } = await repository.saveMark({
                        taskId,
                        studentId,
                        score: mark.score,
                        synced: mark.synced
                    });

                    if (isNew) {
                        newMarksCount++;
                    } else {
                        skippedMarksCount++;
                    }
                }
            }

            if (newMarksCount > 0) {
                toast.success(`Imported ${newMarksCount} marks.`);
            }
            if (skippedMarksCount > 0) {
                toast.info(`Skipped ${skippedMarksCount} duplicate marks.`);
            }
            if (newMarksCount === 0 && skippedMarksCount === 0) {
                toast.info('No marks found in file.');
            }

            await loadAllData();
        } catch (e) {
            console.error('Error processing marks:', e);
            toast.error('Failed to process marks CSV');
            throw e;
        } finally {
            isProcessing.value = false;
        }
    }

    async function toggleSynced(mark) {
        if (!mark) return;
        const newSynced = !mark.synced;
        // Optimistic update in the local list (if needed by caller, but we reload usually or caller handles it)
        // Actually, caller passes the mark object, so we can mutate it here or let caller do it.
        // Let's mutate it here for immediate feedback if the caller uses the same object reference.
        mark.synced = newSynced;
        await repository.updateMarkSynced(mark.id, newSynced);
    }

    async function deleteMark(id) {
        try {
            await repository.deleteMark(id);
            // Incremental update: remove from array instead of full reload
            flatMarks.value = flatMarks.value.filter(m => m.id !== id);
            toast.success('Mark deleted');
        } catch (e) {
            console.error('Error deleting mark:', e);
            toast.error('Failed to delete mark');
            throw e;
        }
    }

    async function deleteMarks(ids) {
        try {
            await repository.deleteMarks(ids);
            // Incremental update: remove multiple marks from array
            const idsSet = new Set(ids);
            flatMarks.value = flatMarks.value.filter(m => !idsSet.has(m.id));
            toast.success(`${ids.length} marks deleted`);
        } catch (e) {
            console.error('Error deleting marks:', e);
            toast.error('Failed to delete marks');
            throw e;
        }
    }

    return {
        groups,
        flatMarks,
        isProcessing,
        allMeetIds,
        allTeachers,
        loadGroups,
        loadSuggestions,
        loadAllData,
        createGroup,
        processFile,
        toggleSynced,
        deleteMark,
        deleteMarks
    };
}
