import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbConnection } from '~repository/db';
import {
    saveMeet,
    getAllMeets,
    getMeetsByMeetId,
    getMeetById,
    checkMeetExists,
    isDuplicateFile,
    deleteMeet,
    deleteMeets,
    applyDurationLimitToAll,
} from '~repository/meets';
import { createMeetFixture, resetIdCounter } from './helpers';

describe('meets.js', () => {
    beforeEach(async () => {
        localStorage.clear();
        await resetDbConnection();
        resetIdCounter();
    });

    describe('saveMeet & getAllMeets', () => {
        it('should save a meet and retrieve it', async () => {
            const meet = createMeetFixture({
                meetId: 'test-meet-1',
                date: '2024-01-15',
            });

            await saveMeet(meet);
            const allMeets = await getAllMeets();

            expect(allMeets).toHaveLength(1);
            expect(allMeets[0]).toMatchObject({
                meetId: 'test-meet-1',
                date: '2024-01-15',
            });
        });

        it('should save multiple meets', async () => {
            const meet1 = createMeetFixture({ meetId: 'm1', date: '2024-01-15' });
            const meet2 = createMeetFixture({ meetId: 'm2', date: '2024-01-16' });

            await saveMeet(meet1);
            await saveMeet(meet2);

            const allMeets = await getAllMeets();
            expect(allMeets).toHaveLength(2);
        });
    });

    describe('getMeetsByMeetId', () => {
        it('should return meets with specific meetId', async () => {
            const meet1 = createMeetFixture({ meetId: 'meeting-A', date: '2024-01-15' });
            const meet2 = createMeetFixture({ meetId: 'meeting-A', date: '2024-01-16' });
            const meet3 = createMeetFixture({ meetId: 'meeting-B', date: '2024-01-15' });

            await saveMeet(meet1);
            await saveMeet(meet2);
            await saveMeet(meet3);

            const meetsA = await getMeetsByMeetId('meeting-A');
            expect(meetsA).toHaveLength(2);
            expect(meetsA.every(m => m.meetId === 'meeting-A')).toBe(true);

            const meetsB = await getMeetsByMeetId('meeting-B');
            expect(meetsB).toHaveLength(1);
            expect(meetsB[0].meetId).toBe('meeting-B');
        });

        it('should return empty array for non-existent meetId', async () => {
            const meets = await getMeetsByMeetId('non-existent');
            expect(meets).toEqual([]);
        });
    });

    describe('getMeetById', () => {
        it('should retrieve meet by its id', async () => {
            const meet = createMeetFixture({ id: 123, meetId: 'test-meet' });
            await saveMeet(meet);

            const retrieved = await getMeetById(123);
            expect(retrieved).toBeDefined();
            expect(retrieved.id).toBe(123);
            expect(retrieved.meetId).toBe('test-meet');
        });

        it('should return undefined for non-existent id', async () => {
            const retrieved = await getMeetById(999);
            expect(retrieved).toBeUndefined();
        });
    });

    describe('checkMeetExists', () => {
        it('should return true when meet exists with given meetId and date', async () => {
            const meet = createMeetFixture({ meetId: 'meet-1', date: '2024-01-15' });
            await saveMeet(meet);

            const exists = await checkMeetExists('meet-1', '2024-01-15');
            expect(exists).toBe(true);
        });

        it('should return false when meetId exists but date is different', async () => {
            const meet = createMeetFixture({ meetId: 'meet-1', date: '2024-01-15' });
            await saveMeet(meet);

            const exists = await checkMeetExists('meet-1', '2024-01-16');
            expect(exists).toBe(false);
        });

        it('should return false when meetId does not exist', async () => {
            const exists = await checkMeetExists('non-existent', '2024-01-15');
            expect(exists).toBe(false);
        });
    });

    describe('isDuplicateFile', () => {
        it('should return true when filename, meetId, and date match', async () => {
            const meet = createMeetFixture({
                meetId: 'meet-1',
                date: '2024-01-15',
                filename: 'attendance.csv',
            });
            await saveMeet(meet);

            const isDupe = await isDuplicateFile('attendance.csv', 'meet-1', '2024-01-15');
            expect(isDupe).toBe(true);
        });

        it('should return false when filename is different', async () => {
            const meet = createMeetFixture({
                meetId: 'meet-1',
                date: '2024-01-15',
                filename: 'attendance.csv',
            });
            await saveMeet(meet);

            const isDupe = await isDuplicateFile('other.csv', 'meet-1', '2024-01-15');
            expect(isDupe).toBe(false);
        });

        it('should return false when date is different', async () => {
            const meet = createMeetFixture({
                meetId: 'meet-1',
                date: '2024-01-15',
                filename: 'attendance.csv',
            });
            await saveMeet(meet);

            const isDupe = await isDuplicateFile('attendance.csv', 'meet-1', '2024-01-16');
            expect(isDupe).toBe(false);
        });
    });

    describe('deleteMeet', () => {
        it('should delete a single meet by id', async () => {
            const meet = createMeetFixture({ id: 1 });
            await saveMeet(meet);

            let allMeets = await getAllMeets();
            expect(allMeets).toHaveLength(1);

            await deleteMeet(1);

            allMeets = await getAllMeets();
            expect(allMeets).toHaveLength(0);
        });
    });

    describe('deleteMeets', () => {
        it('should delete multiple meets by ids', async () => {
            const meet1 = createMeetFixture({ id: 1 });
            const meet2 = createMeetFixture({ id: 2 });
            const meet3 = createMeetFixture({ id: 3 });

            await saveMeet(meet1);
            await saveMeet(meet2);
            await saveMeet(meet3);

            await deleteMeets([1, 2]);

            const allMeets = await getAllMeets();
            expect(allMeets).toHaveLength(1);
            expect(allMeets[0].id).toBe(3);
        });

        it('should handle empty array', async () => {
            const meet = createMeetFixture({ id: 1 });
            await saveMeet(meet);

            await deleteMeets([]);

            const allMeets = await getAllMeets();
            expect(allMeets).toHaveLength(1);
        });
    });

    describe('applyDurationLimitToAll', () => {
        it('should truncate durations exceeding the limit', async () => {
            const meet = createMeetFixture({
                id: 1,
                participants: [
                    { name: 'Alice', duration: 7200 }, // 120 minutes
                    { name: 'Bob', duration: 1800 },   // 30 minutes
                    { name: 'Charlie', duration: 5400 }, // 90 minutes
                ],
            });
            await saveMeet(meet);

            const fixedCount = await applyDurationLimitToAll(60); // 60 minutes = 3600 seconds

            expect(fixedCount).toBe(1); // Only one meet was modified

            const updated = await getMeetById(1);
            expect(updated.participants[0].duration).toBe(3600); // Truncated from 7200
            expect(updated.participants[1].duration).toBe(1800); // Unchanged
            expect(updated.participants[2].duration).toBe(3600); // Truncated from 5400
        });

        it('should not modify meets when all durations are within limit', async () => {
            const meet = createMeetFixture({
                id: 1,
                participants: [
                    { name: 'Alice', duration: 1800 }, // 30 minutes
                    { name: 'Bob', duration: 2400 },   // 40 minutes
                ],
            });
            await saveMeet(meet);

            const fixedCount = await applyDurationLimitToAll(60); // 60 minutes

            expect(fixedCount).toBe(0); // No meets modified

            const updated = await getMeetById(1);
            expect(updated.participants[0].duration).toBe(1800);
            expect(updated.participants[1].duration).toBe(2400);
        });

        it('should handle multiple meets', async () => {
            const meet1 = createMeetFixture({
                id: 1,
                participants: [{ name: 'Alice', duration: 7200 }],
            });
            const meet2 = createMeetFixture({
                id: 2,
                participants: [{ name: 'Bob', duration: 1800 }],
            });
            const meet3 = createMeetFixture({
                id: 3,
                participants: [{ name: 'Charlie', duration: 5400 }],
            });

            await saveMeet(meet1);
            await saveMeet(meet2);
            await saveMeet(meet3);

            const fixedCount = await applyDurationLimitToAll(60);

            expect(fixedCount).toBe(2); // meet1 and meet3 were modified
        });

        it('should return 0 when limitMinutes is 0 or negative', async () => {
            const meet = createMeetFixture({
                id: 1,
                participants: [{ name: 'Alice', duration: 7200 }],
            });
            await saveMeet(meet);

            const fixedCount1 = await applyDurationLimitToAll(0);
            expect(fixedCount1).toBe(0);

            const fixedCount2 = await applyDurationLimitToAll(-10);
            expect(fixedCount2).toBe(0);
        });

        it('should handle meets without participants', async () => {
            const meet = createMeetFixture({
                id: 1,
                participants: undefined,
            });
            await saveMeet(meet);

            const fixedCount = await applyDurationLimitToAll(60);
            expect(fixedCount).toBe(0);
        });
    });
});
