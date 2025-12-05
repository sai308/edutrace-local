import { describe, it, expect, beforeEach } from 'vitest';
import { saveMark, updateMarkSynced } from './marks';
import { resetDbConnection, getDb } from './db';
import 'fake-indexeddb/auto';

describe('Marks Repository - Import Fix', () => {
    beforeEach(async () => {
        await resetDbConnection();
        // Clear DB manually if needed, but resetDbConnection + unique DB name per test run usually helps.
        // For simplicity, we rely on fake-indexeddb being fresh or cleared.
        // Actually, fake-indexeddb persists in memory unless we close/delete.
        const db = await getDb();
        const tx = db.transaction(['marks'], 'readwrite');
        await tx.objectStore('marks').clear();
        await tx.done;
    });

    it('should prevent overwriting a synced mark', async () => {
        const mark = {
            taskId: 1,
            studentId: 1,
            score: 10,
            synced: true, // Already synced
            syncedAt: '2023-01-01T00:00:00.000Z'
        };

        // 1. Save initial synced mark
        await saveMark(mark);

        // Verify it's saved
        const db = await getDb();
        const saved = await db.getFromIndex('marks', 'task_student', [1, 1]);
        expect(saved.score).toBe(10);
        expect(saved.synced).toBe(true);

        // 2. Try to overwrite with new score
        const newMark = {
            taskId: 1,
            studentId: 1,
            score: 20, // Different score
            synced: false
        };

        const result = await saveMark(newMark);

        // 3. Verify result indicates skipped
        expect(result.skipped).toBe(true);
        expect(result.updated).toBe(false);

        // 4. Verify DB still has old score
        const current = await db.getFromIndex('marks', 'task_student', [1, 1]);
        expect(current.score).toBe(10);
    });

    it('should allow overwriting a non-synced mark', async () => {
        const mark = {
            taskId: 2,
            studentId: 2,
            score: 10,
            synced: false
        };

        await saveMark(mark);

        const newMark = {
            taskId: 2,
            studentId: 2,
            score: 20,
            synced: false
        };

        const result = await saveMark(newMark);

        expect(result.updated).toBe(true);

        const db = await getDb();
        const current = await db.getFromIndex('marks', 'task_student', [2, 2]);
        expect(current.score).toBe(20);
    });

    it('should set syncedAt when marking as synced', async () => {
        const mark = {
            taskId: 3,
            studentId: 3,
            score: 10,
            synced: false
        };
        const { id } = await saveMark(mark);

        await updateMarkSynced(id, true);

        const db = await getDb();
        const current = await db.get('marks', id);
        expect(current.synced).toBe(true);
        expect(current.syncedAt).toBeDefined();
        expect(new Date(current.syncedAt).getTime()).not.toBeNaN();
    });

    it('should clear syncedAt when marking as not synced', async () => {
        const mark = {
            taskId: 4,
            studentId: 4,
            score: 10,
            synced: true,
            syncedAt: '2023-01-01T00:00:00.000Z'
        };
        // We have to force save this because saveMark prevents overwrite if synced=true.
        // But here we are creating a NEW mark, so saveMark works.
        const { id } = await saveMark(mark);

        await updateMarkSynced(id, false);

        const db = await getDb();
        const current = await db.get('marks', id);
        expect(current.synced).toBe(false);
        expect(current.syncedAt).toBeNull();
    });
});
