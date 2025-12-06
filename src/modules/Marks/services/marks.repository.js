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
}

export const marksRepository = new MarksRepository();
