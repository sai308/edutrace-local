import { BaseRepository } from '@/shared/services/BaseRepository';

class MarksRepository extends BaseRepository {
    constructor() {
        super('marks');
    }

    async saveMark(mark) {
        const db = await this.getDb();
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);

        // Check for duplicates using composite index (taskId, studentId)
        const index = store.index('task_student');
        const existing = await index.get([mark.taskId, mark.studentId]);

        if (existing) {
            // Prevent overwriting if already synced
            if (existing.synced) {
                return { id: existing.id, isNew: false, updated: false, skipped: true };
            }

            // Update existing mark if score or other fields changed
            if (existing.score !== mark.score) {
                const updated = {
                    ...existing,
                    ...mark,
                    id: existing.id,
                    synced: false,
                    syncedAt: null
                };
                await store.put(updated);
                await tx.done;
                return { id: existing.id, isNew: false, updated: true };
            }
            return { id: existing.id, isNew: false, updated: false };
        }

        const id = await store.add({
            ...mark,
            createdAt: new Date().toISOString()
        });
        await tx.done;
        return { id, isNew: true, updated: false };
    }

    async bulkSaveSafe(marks) {
        const db = await this.getDb();
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);

        const stats = { added: 0, updated: 0, skipped: 0 };

        for (const mark of marks) {
            // We expect marks to have IDs if they were reconciled against existing data.
            // If ID is present, check existence by ID. 
            // If ID is new uuid, it might not exist.

            // However, MarksReconciler assigns IDs.
            // If it's a new UUID, store.get(id) returns undefined.
            // If it's an existing ID, store.get(id) returns the record.

            const existing = await store.get(mark.id);

            if (existing) {
                if (existing.synced) {
                    stats.skipped++;
                    continue;
                }

                // Compare scores to decide if update is needed?
                // The reconciler might have updated the score in the passed `mark` object.
                // If we want to strictly follow "Update existing mark if score ... changed", we can check.
                // But `mark` from reconciler has the *new* score. `existing` has old.

                if (existing.score !== mark.score) {
                    await store.put(mark);
                    stats.updated++;
                } else {
                    // Even if score same, maybe other fields? 
                    // For now count as skipped or just ignore?
                    // Let's assume passed mark is what we want unless synced.
                    // But if identical, puts are cheap-ish but stats might be misleading.
                    // Let's just put it to be safe and simple.
                    await store.put(mark);
                    stats.updated++;
                }
            } else {
                await store.add(mark);
                stats.added++;
            }
        }
        await tx.done;
        return stats;
    }

    async getMarksByTask(taskId) {
        return this.getAllFromIndex('taskId', taskId);
    }

    async getMarksByStudent(studentId) {
        return this.getAllFromIndex('studentId', studentId);
    }

    async updateMarkSynced(id, synced) {
        const db = await this.getDb();
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);

        const mark = await store.get(id);
        if (mark) {
            if (mark.synced !== synced) {
                mark.synced = synced;
                mark.syncedAt = synced ? new Date().toISOString() : null;
                await store.put(mark);
            }
        }
        await tx.done;
    }

    async deleteMarks(ids) {
        const db = await this.getDb();
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        await Promise.all(ids.map(id => store.delete(id)));
        await tx.done;
    }

    async getAllMarksWithRelations() {
        const db = await this.getDb();

        const [allMarks, allTasks, allMembers] = await Promise.all([
            db.getAll('marks'),
            db.getAll('tasks'),
            db.getAll('members')
        ]);

        const taskMap = new Map(allTasks.map(t => [t.id, t]));
        const memberMap = new Map(allMembers.map(m => [m.id, m]));

        const flatMarks = [];
        for (const mark of allMarks) {
            const task = taskMap.get(mark.taskId);
            const student = memberMap.get(mark.studentId);

            if (!task || !student) continue;

            flatMarks.push({
                id: mark.id,
                studentName: student.name,
                groupName: task.groupName,
                taskName: task.name,
                taskDate: task.date,
                maxPoints: task.maxPoints,
                score: mark.score,
                synced: mark.synced,
                createdAt: mark.createdAt
            });
        }

        return flatMarks;
    }
    async getAllMarks() {
        return this.getAll();
    }
    async getMarksByGroup(groupName) {
        return this.getAllFromIndex('groupName', groupName);
    }

    async getMarksByGroupWithRelations(groupName) {
        const db = await this.getDb();
        const tx = db.transaction(['marks', 'tasks', 'members'], 'readonly');

        // 1. Get tasks for the group (Tasks reliably have groupName)
        const tasksIndex = tx.objectStore('tasks').index('groupName');
        const groupTasks = await tasksIndex.getAll(groupName);

        if (groupTasks.length === 0) {
            return [];
        }

        const groupTaskMap = new Map(groupTasks.map(t => [t.id, t]));

        // 2. Get marks for these tasks
        // We use 'taskId' index on marks, which is reliable.
        const marksStore = tx.objectStore('marks');
        const taskIdIndex = marksStore.index('taskId');

        // Fetch marks for each task in parallel
        // Optimization: For very large number of tasks, this might create many requests.
        // But usually a group has < 100 tasks.
        const marksPromises = groupTasks.map(t => taskIdIndex.getAll(t.id));
        const marksArrays = await Promise.all(marksPromises);
        const groupMarks = marksArrays.flat();

        if (groupMarks.length === 0) {
            return [];
        }

        // 3. Get all members for name lookup
        // We fetch all members to ensure we find the student even if group linkage is ambiguous.
        // Members list is generally small enough.
        const allMembers = await tx.objectStore('members').getAll();
        const memberMap = new Map(allMembers.map(m => [m.id, m]));

        const flatMarks = [];
        for (const mark of groupMarks) {
            const task = groupTaskMap.get(mark.taskId);
            const student = memberMap.get(mark.studentId);

            if (!task || !student) continue;

            flatMarks.push({
                id: mark.id,
                studentName: student.name,
                groupName: task.groupName,
                taskName: task.name,
                taskDate: task.date,
                maxPoints: task.maxPoints,
                score: mark.score,
                synced: mark.synced,
                createdAt: mark.createdAt
            });
        }

        return flatMarks;
    }

    async getMarksByStudentIds(studentIds) {
        const db = await this.getDb();
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const index = store.index('studentId');

        const promises = studentIds.map(id => index.getAll(id));
        const results = await Promise.all(promises);

        // Flatten array of arrays
        return results.flat();
    }
}

export const marksRepository = new MarksRepository();
