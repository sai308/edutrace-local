// tasks.js
import { getDb } from './db';

export async function saveTask(task) {
    const db = await getDb();
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');

    // Use composite natural key (name, date, groupName) to detect duplicates
    const index = store.index('name_date_group');
    const existing = await index.get([task.name, task.date, task.groupName]);

    if (existing) {
        // Task exists - update fields if needed, return existing ID
        const updated = { ...existing, ...task, id: existing.id };
        await store.put(updated);
        await tx.done;
        return { id: existing.id, isNew: false };
    }

    // New task - add
    const id = await store.add(task);
    await tx.done;
    return { id, isNew: true };
}

export async function getAllTasks() {
    const db = await getDb();
    return db.getAll('tasks');
}

export async function getTasksByGroup(groupName) {
    const db = await getDb();
    return db.getAllFromIndex('tasks', 'groupName', groupName);
}

export async function findTaskByNaturalKey(name, date, groupName) {
    const db = await getDb();
    return db.getFromIndex('tasks', 'name_date_group', [name, date, groupName]);
}

export async function getTaskById(id) {
    const db = await getDb();
    return db.get('tasks', id);
}