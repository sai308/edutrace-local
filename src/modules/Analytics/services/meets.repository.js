import { BaseRepository } from '@/shared/services/BaseRepository';

class MeetsRepository extends BaseRepository {
    constructor() {
        super('meets');
    }

    async saveMeet(meetData) {
        return this.put(meetData);
    }

    async getAllMeets() {
        return this.getAll();
    }

    async getMeetsByMeetId(meetId) {
        return this.getAllFromIndex('meetId', meetId);
    }

    async getMeetById(id) {
        return this.getById(id);
    }

    async checkMeetExists(meetId, date) {
        const meets = await this.getAllFromIndex('meetId', meetId);
        return meets.some(m => m.date === date);
    }

    async isDuplicateFile(filename, meetId, date) {
        const meets = await this.getAllFromIndex('meetId', meetId);
        // Check if consistent date AND filename match
        return meets.some(m => m.date === date && m.filename === filename);
    }

    async deleteMeets(ids) {
        const db = await this.getDb();
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        await Promise.all(ids.map(id => store.delete(id)));
        await tx.done;
    }

    async applyDurationLimitToAll(limitMinutes) {
        if (!limitMinutes || limitMinutes <= 0) return 0;

        const limitSeconds = limitMinutes * 60;
        const db = await this.getDb();

        // Use readwrite transaction for the entire batch operation
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);

        // We can't use getAll() inside the same transaction if we want to iterate and put?
        // Actually IDB allows it.
        // But getAll() is on the object store.
        const meets = await store.getAll();

        let fixedCount = 0;

        // Process updates
        const updatePromises = meets.map(async (meet) => {
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
                // Must use store within the transaction
                await store.put(meet);
                fixedCount++;
            }
        });

        await Promise.all(updatePromises);
        await tx.done;
        return fixedCount;
    }
}

export const meetsRepository = new MeetsRepository();
