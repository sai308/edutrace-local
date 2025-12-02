// marks.js
import { getDb } from './db';

export async function getAllMarks() {
    const db = await getDb();
    return db.getAll('marks');
}

export async function saveMark(mark) {
    const db = await getDb();
    const tx = db.transaction('marks', 'readwrite');
    const store = tx.objectStore('marks');

    // Check for duplicates using composite index (taskId, studentId)
    const index = store.index('task_student');
    const existing = await index.get([mark.taskId, mark.studentId]);

    if (existing) {
        // Update existing mark if score or other fields changed
        if (existing.score !== mark.score) {
            const updated = {
                ...existing,
                ...mark, // Allow updating other fields like score/synced
                id: existing.id,
                synced: false,
            };
            await store.put(updated);
            await tx.done;
            return { id: existing.id, isNew: false, updated: true };
        }
        // Score is same, so it's a true duplicate/skip
        return { id: existing.id, isNew: false, updated: false };
    }

    // New mark
    const id = await store.add({
        ...mark,
        createdAt: new Date().toISOString()
    });
    await tx.done;
    return { id, isNew: true, updated: false };
}

export async function getMarksByTask(taskId) {
    const db = await getDb();
    return db.getAllFromIndex('marks', 'taskId', taskId);
}

export async function updateMarkSynced(id, synced) {
    const db = await getDb();
    const tx = db.transaction('marks', 'readwrite');
    const store = tx.objectStore('marks');

    const mark = await store.get(id);
    if (mark) {
        // Only update if the value is actually different to avoid unnecessary writes
        if (mark.synced !== synced) {
            mark.synced = synced;
            await store.put(mark);
        }
    }
    await tx.done;
}

export async function getMarksByStudent(studentId) {
    const db = await getDb();
    return db.getAllFromIndex('marks', 'studentId', studentId);
}

export async function deleteMark(id) {
    const db = await getDb();
    return db.delete('marks', id);
}

export async function deleteMarks(ids) {
    const db = await getDb();
    const tx = db.transaction('marks', 'readwrite');
    const store = tx.objectStore('marks');

    await Promise.all(ids.map(id => store.delete(id)));

    await tx.done;
}

export async function getAllMarksWithRelations() {
    const db = await getDb();

    // Fetch all data in parallel
    const [allMarks, allTasks, allMembers] = await Promise.all([
        db.getAll('marks'),
        db.getAll('tasks'),
        db.getAll('members')
    ]);

    // Build lookup maps for O(1) access
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    const memberMap = new Map(allMembers.map(m => [m.id, m]));

    // Transform marks with related data
    const flatMarks = [];
    for (const mark of allMarks) {
        const task = taskMap.get(mark.taskId);
        const student = memberMap.get(mark.studentId);

        // Skip if related data is missing (orphaned records)
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