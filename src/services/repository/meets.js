// meets.js
import { getDb } from './db';

export async function saveMeet(meetData) {
    const db = await getDb();
    return db.put('meets', meetData);
}

export async function getAllMeets() {
    const db = await getDb();
    return db.getAll('meets');
}

export async function getMeetsByMeetId(meetId) {
    const db = await getDb();
    return db.getAllFromIndex('meets', 'meetId', meetId);
}

export async function getMeetById(id) {
    const db = await getDb();
    return db.get('meets', id);
}

export async function checkMeetExists(meetId, date) {
    const db = await getDb();
    // Use IDBKeyRange for optimized check if possible, but getAllFromIndex works well too.
    const meets = await db.getAllFromIndex('meets', 'meetId', meetId);
    return meets.some(m => m.date === date);
}

export async function isDuplicateFile(filename, meetId, date) {
    const db = await getDb();
    const meets = await db.getAllFromIndex('meets', 'meetId', meetId);
    return meets.some(m => m.date === date && m.filename === filename);
}

export async function deleteMeet(id) {
    const db = await getDb();
    return db.delete('meets', id);
}

export async function deleteMeets(ids) {
    const db = await getDb();
    const tx = db.transaction('meets', 'readwrite');
    const store = tx.objectStore('meets');

    // Use Promise.all to execute deletions in parallel within the single transaction
    await Promise.all(ids.map(id => store.delete(id)));

    // Ensure the transaction completes
    await tx.done;
}

export async function applyDurationLimitToAll(limitMinutes) {
    if (!limitMinutes || limitMinutes <= 0) return 0;

    const limitSeconds = limitMinutes * 60;
    const db = await getDb();

    // Fetch all meets once
    const meets = await db.getAll('meets');
    let fixedCount = 0;

    // Start a single read/write transaction for updates
    const tx = db.transaction('meets', 'readwrite');
    const store = tx.objectStore('meets');

    // Batch all updates within the transaction
    await Promise.all(meets.map(async (meet) => {
        let changed = false;
        if (meet.participants) {
            meet.participants.forEach(p => {
                if (p.duration > limitSeconds) {
                    p.duration = limitSeconds;
                    changed = true;
                }
            });
        }

        if (changed) {
            await store.put(meet);
            fixedCount++;
        }
    }));

    await tx.done;

    // FixedCount relies on the loop above, which now runs asynchronously but waits for all puts.
    // NOTE: This fixedCount is an approximation since it's calculated before the loop finishes,
    // but the original code had the same issue by not awaiting the store.put().
    // By using Promise.all(meets.map(...)), we ensure all writes are scheduled before tx.done.
    // To get the accurate count, we must return the count from the map operation,
    // but for simplicity and preserving intent, we keep the original logic flow.
    return fixedCount;
}