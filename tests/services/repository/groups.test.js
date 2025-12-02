import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDbConnection } from '~repository/db';
import {
    getGroups,
    getGroupById,
    saveGroup,
    deleteGroup,
    getGroupMap,
} from '~repository/groups';
import { createGroupFixture, resetIdCounter } from './helpers';

// Mock the members module to test sync behavior
vi.mock('~repository/members', () => ({
    syncParticipants: vi.fn(),
}));

// Mock the meets module
vi.mock('~repository/meets', () => ({
    getMeetsByMeetId: vi.fn(),
}));

describe('groups.js', () => {
    beforeEach(async () => {
        localStorage.clear();
        await resetDbConnection();
        resetIdCounter();
        vi.clearAllMocks();
    });

    describe('CRUD Operations (without sync)', () => {
        it('should save and retrieve a group', async () => {
            const group = createGroupFixture({
                id: 'g1',
                name: 'KH-41',
                meetId: undefined, // No meetId, so no sync
            });

            await saveGroup(group);
            const groups = await getGroups();

            expect(groups).toHaveLength(1);
            expect(groups[0]).toMatchObject({
                id: 'g1',
                name: 'KH-41',
            });
        });

        it('should retrieve group by id', async () => {
            const group = createGroupFixture({
                id: 'g1',
                name: 'KH-41',
                meetId: undefined,
            });

            await saveGroup(group);
            const retrieved = await getGroupById('g1');

            expect(retrieved).toBeDefined();
            expect(retrieved.id).toBe('g1');
            expect(retrieved.name).toBe('KH-41');
        });

        it('should delete a group', async () => {
            const group = createGroupFixture({
                id: 'g1',
                name: 'KH-41',
                meetId: undefined,
            });

            await saveGroup(group);
            let groups = await getGroups();
            expect(groups).toHaveLength(1);

            await deleteGroup('g1');
            groups = await getGroups();
            expect(groups).toHaveLength(0);
        });

        it('should save multiple groups', async () => {
            const group1 = createGroupFixture({ id: 'g1', name: 'KH-41', meetId: undefined });
            const group2 = createGroupFixture({ id: 'g2', name: 'KH-42', meetId: undefined });

            await saveGroup(group1);
            await saveGroup(group2);

            const groups = await getGroups();
            expect(groups).toHaveLength(2);
        });
    });

    describe('getGroupMap', () => {
        it('should return object keyed by meetId', async () => {
            const group1 = createGroupFixture({ id: 'g1', name: 'KH-41', meetId: 'm1' });
            const group2 = createGroupFixture({ id: 'g2', name: 'KH-42', meetId: 'm2' });
            const group3 = createGroupFixture({ id: 'g3', name: 'KH-43', meetId: 'm3' });

            await saveGroup(group1);
            await saveGroup(group2);
            await saveGroup(group3);

            const groupMap = await getGroupMap();

            expect(groupMap).toHaveProperty('m1');
            expect(groupMap).toHaveProperty('m2');
            expect(groupMap).toHaveProperty('m3');

            expect(groupMap.m1.name).toBe('KH-41');
            expect(groupMap.m2.name).toBe('KH-42');
            expect(groupMap.m3.name).toBe('KH-43');
        });

        it('should return empty object when no groups exist', async () => {
            const groupMap = await getGroupMap();
            expect(groupMap).toEqual({});
        });
    });

    describe('saveGroup with member sync', () => {
        it('should trigger syncParticipants when meetId is present', async () => {
            const { syncParticipants } = await import('~repository/members');
            const { getMeetsByMeetId } = await import('~repository/meets');

            const mockMeets = [
                { id: 1, meetId: 'm1', date: '2024-01-15', participants: [{ name: 'Alice' }] },
                { id: 2, meetId: 'm1', date: '2024-01-16', participants: [{ name: 'Bob' }] },
            ];

            getMeetsByMeetId.mockResolvedValue(mockMeets);

            const group = createGroupFixture({
                id: 'g1',
                name: 'KH-41',
                meetId: 'm1',
            });

            await saveGroup(group);

            // Verify getMeetsByMeetId was called with correct meetId
            expect(getMeetsByMeetId).toHaveBeenCalledWith('m1');
            expect(getMeetsByMeetId).toHaveBeenCalledTimes(1);

            // Verify syncParticipants was called with meets and group name
            expect(syncParticipants).toHaveBeenCalledWith(mockMeets, 'KH-41');
            expect(syncParticipants).toHaveBeenCalledTimes(1);
        });

        it('should not trigger sync when meetId is not present', async () => {
            const { syncParticipants } = await import('~repository/members');
            const { getMeetsByMeetId } = await import('~repository/meets');

            const group = createGroupFixture({
                id: 'g1',
                name: 'KH-41',
                meetId: undefined,
            });

            await saveGroup(group);

            expect(getMeetsByMeetId).not.toHaveBeenCalled();
            expect(syncParticipants).not.toHaveBeenCalled();
        });

        it('should handle empty meets array during sync', async () => {
            const { syncParticipants } = await import('~repository/members');
            const { getMeetsByMeetId } = await import('~repository/meets');

            getMeetsByMeetId.mockResolvedValue([]);

            const group = createGroupFixture({
                id: 'g1',
                name: 'KH-41',
                meetId: 'm1',
            });

            await saveGroup(group);

            expect(getMeetsByMeetId).toHaveBeenCalledWith('m1');
            expect(syncParticipants).toHaveBeenCalledWith([], 'KH-41');
        });
    });
});
