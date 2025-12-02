import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDbConnection } from '~repository/db';
import {
    getAllMembers,
    getMembersByGroup,
    getMemberById,
    saveMember,
    deleteMember,
    deleteMembers,
    hideMember,
    hideMembers,
    syncParticipants,
    syncAllMembersFromMeets,
} from '~repository/members';
import { createMemberFixture, createMeetFixture, resetIdCounter } from './helpers';

// Mock settings module
vi.mock('~repository/settings', () => ({
    getTeachers: vi.fn(() => Promise.resolve([])),
}));

// Mock meets module
vi.mock('~repository/meets', () => ({
    getAllMeets: vi.fn(() => Promise.resolve([])),
}));

// Mock groups module
vi.mock('~repository/groups', () => ({
    getGroupMap: vi.fn(() => Promise.resolve({})),
}));

describe('members.js', () => {
    beforeEach(async () => {
        localStorage.clear();
        await resetDbConnection();
        resetIdCounter();
        vi.clearAllMocks();

        // Reset mocks to default implementations
        const { getTeachers } = await import('~repository/settings');
        getTeachers.mockResolvedValue([]);
    });

    describe('saveMember - role resolution', () => {
        it('should assign teacher role when name is in teachers list', async () => {
            const { getTeachers } = await import('~repository/settings');
            getTeachers.mockResolvedValue(['Teacher Name']);

            const member = createMemberFixture({
                name: 'Teacher Name',
                groupName: 'KH-41',
                role: undefined,
            });

            const id = await saveMember(member);
            const saved = await getMemberById(id);

            expect(saved.role).toBe('teacher');
        });

        it('should assign student role when name is not in teachers list', async () => {
            const { getTeachers } = await import('~repository/settings');
            getTeachers.mockResolvedValue(['Teacher Name']);

            const member = createMemberFixture({
                name: 'Student Name',
                groupName: 'KH-41',
                role: undefined,
            });

            const id = await saveMember(member);
            const saved = await getMemberById(id);

            expect(saved.role).toBe('student');
        });

        it('should preserve explicitly provided role', async () => {
            const member = createMemberFixture({
                name: 'Some Name',
                groupName: 'KH-41',
                role: 'teacher',
            });

            const id = await saveMember(member);
            const saved = await getMemberById(id);

            expect(saved.role).toBe('teacher');
        });
    });

    describe('saveMember - merge by id', () => {
        it('should merge with existing member when id matches', async () => {
            const original = createMemberFixture({
                name: 'John Doe',
                email: 'john@example.com',
                groupName: 'KH-41',
            });

            const id = await saveMember(original);

            // Update with same id
            const updated = {
                id: id,
                name: 'John Updated',
                email: 'newemail@example.com',
            };

            const resultId = await saveMember(updated);

            expect(resultId).toBe(id); // Same ID

            const saved = await getMemberById(id);
            expect(saved.name).toBe('John Updated');
            expect(saved.email).toBe('newemail@example.com');
            expect(saved.groupName).toBe('KH-41'); // Preserved from original
        });
    });

    describe('saveMember - merge by name', () => {
        it('should merge with existing member when name matches', async () => {
            const original = createMemberFixture({
                name: 'John Doe',
                email: 'john@example.com',
                groupName: 'KH-41',
            });

            const id = await saveMember(original);

            // Save again with same name but no id
            const updated = {
                name: 'John Doe',
                email: 'updated@example.com',
                groupName: 'KH-42',
            };

            const resultId = await saveMember(updated);

            expect(resultId).toBe(id); // Should return existing ID

            const saved = await getMemberById(id);
            expect(saved.email).toBe('updated@example.com');
            expect(saved.groupName).toBe('KH-42');

            // Should still be only one member
            const allMembers = await getAllMembers();
            expect(allMembers).toHaveLength(1);
        });
    });

    describe('deleteMember & deleteMembers', () => {
        it('should delete a single member', async () => {
            const member = createMemberFixture({ name: 'John' });
            const id = await saveMember(member);

            await deleteMember(id);

            const allMembers = await getAllMembers();
            expect(allMembers).toHaveLength(0);
        });

        it('should delete multiple members', async () => {
            const member1 = createMemberFixture({ name: 'John' });
            const member2 = createMemberFixture({ name: 'Jane' });
            const member3 = createMemberFixture({ name: 'Bob' });

            const id1 = await saveMember(member1);
            const id2 = await saveMember(member2);
            const id3 = await saveMember(member3);

            await deleteMembers([id1, id2]);

            const allMembers = await getAllMembers();
            expect(allMembers).toHaveLength(1);
            expect(allMembers[0].id).toBe(id3);
        });
    });

    describe('hideMember & hideMembers', () => {
        it('should hide a single member', async () => {
            const member = createMemberFixture({ name: 'John', hidden: false });
            const id = await saveMember(member);

            await hideMember(id);

            const hidden = await getMemberById(id);
            expect(hidden.hidden).toBe(true);
        });

        it('should hide multiple members', async () => {
            const member1 = createMemberFixture({ name: 'John', hidden: false });
            const member2 = createMemberFixture({ name: 'Jane', hidden: false });
            const member3 = createMemberFixture({ name: 'Bob', hidden: false });

            const id1 = await saveMember(member1);
            const id2 = await saveMember(member2);
            const id3 = await saveMember(member3);

            await hideMembers([id1, id2]);

            const m1 = await getMemberById(id1);
            const m2 = await getMemberById(id2);
            const m3 = await getMemberById(id3);

            expect(m1.hidden).toBe(true);
            expect(m2.hidden).toBe(true);
            expect(m3.hidden).toBe(false);
        });
    });

    describe('getMembersByGroup', () => {
        it('should return members for specific group', async () => {
            const member1 = createMemberFixture({ name: 'John', groupName: 'KH-41' });
            const member2 = createMemberFixture({ name: 'Jane', groupName: 'KH-41' });
            const member3 = createMemberFixture({ name: 'Bob', groupName: 'KH-42' });

            await saveMember(member1);
            await saveMember(member2);
            await saveMember(member3);

            const kh41Members = await getMembersByGroup('KH-41');
            expect(kh41Members).toHaveLength(2);
            expect(kh41Members.every(m => m.groupName === 'KH-41')).toBe(true);

            const kh42Members = await getMembersByGroup('KH-42');
            expect(kh42Members).toHaveLength(1);
            expect(kh42Members[0].name).toBe('Bob');
        });
    });

    describe('syncParticipants', () => {
        it('should create new members from meet participants', async () => {
            const meets = [
                createMeetFixture({
                    participants: [
                        { name: 'Alice', email: 'alice@example.com' },
                        { name: 'Bob', email: 'bob@example.com' },
                    ],
                }),
            ];

            await syncParticipants(meets, 'KH-41');

            const allMembers = await getAllMembers();
            expect(allMembers).toHaveLength(2);

            const alice = allMembers.find(m => m.name === 'Alice');
            expect(alice).toBeDefined();
            expect(alice.groupName).toBe('KH-41');
            expect(alice.email).toBe('alice@example.com');
            expect(alice.role).toBe('student');
            expect(alice.hidden).toBe(false);

            const bob = allMembers.find(m => m.name === 'Bob');
            expect(bob).toBeDefined();
            expect(bob.groupName).toBe('KH-41');
        });

        it('should not create duplicate members for existing names', async () => {
            // Create existing member
            const existing = createMemberFixture({ name: 'Alice', groupName: 'KH-41' });
            await saveMember(existing);

            const meets = [
                createMeetFixture({
                    participants: [
                        { name: 'Alice', email: 'alice@example.com' },
                        { name: 'Bob', email: 'bob@example.com' },
                    ],
                }),
            ];

            await syncParticipants(meets, 'KH-41');

            const allMembers = await getAllMembers();
            expect(allMembers).toHaveLength(2); // Alice (existing) + Bob (new)
        });

        it('should respect member aliases when checking for duplicates', async () => {
            // Create member with alias
            const existing = createMemberFixture({
                name: 'Alice Smith',
                aliases: ['Alice', 'A. Smith'],
                groupName: 'KH-41',
            });
            await saveMember(existing);

            const meets = [
                createMeetFixture({
                    participants: [
                        { name: 'Alice', email: 'alice@example.com' }, // Matches alias
                        { name: 'Bob', email: 'bob@example.com' },
                    ],
                }),
            ];

            await syncParticipants(meets, 'KH-41');

            const allMembers = await getAllMembers();
            expect(allMembers).toHaveLength(2); // Alice Smith (existing) + Bob (new)
        });

        it('should handle empty meets array', async () => {
            await syncParticipants([], 'KH-41');

            const allMembers = await getAllMembers();
            expect(allMembers).toHaveLength(0);
        });
    });

    describe('syncAllMembersFromMeets', () => {
        it('should create members from all meets with correct groupName', async () => {
            const { getAllMeets } = await import('~repository/meets');
            const { getGroupMap } = await import('~repository/groups');

            const meets = [
                createMeetFixture({
                    meetId: 'm1',
                    participants: [
                        { name: 'Alice', email: 'alice@example.com' },
                        { name: 'Bob', email: 'bob@example.com' },
                    ],
                }),
                createMeetFixture({
                    meetId: 'm2',
                    participants: [
                        { name: 'Charlie', email: 'charlie@example.com' },
                    ],
                }),
            ];

            const groupMap = {
                m1: { id: 'g1', name: 'KH-41', meetId: 'm1' },
                m2: { id: 'g2', name: 'KH-42', meetId: 'm2' },
            };

            getAllMeets.mockResolvedValue(meets);
            getGroupMap.mockResolvedValue(groupMap);

            await syncAllMembersFromMeets();

            const allMembers = await getAllMembers();
            expect(allMembers).toHaveLength(3);

            const alice = allMembers.find(m => m.name === 'Alice');
            expect(alice.groupName).toBe('KH-41');

            const bob = allMembers.find(m => m.name === 'Bob');
            expect(bob.groupName).toBe('KH-41');

            const charlie = allMembers.find(m => m.name === 'Charlie');
            expect(charlie.groupName).toBe('KH-42');
        });

        it('should handle meets without matching groups', async () => {
            const { getAllMeets } = await import('~repository/meets');
            const { getGroupMap } = await import('~repository/groups');

            const meets = [
                createMeetFixture({
                    meetId: 'm1',
                    participants: [{ name: 'Alice' }],
                }),
            ];

            getAllMeets.mockResolvedValue(meets);
            getGroupMap.mockResolvedValue({}); // No groups

            await syncAllMembersFromMeets();

            const allMembers = await getAllMembers();
            expect(allMembers).toHaveLength(1);
            expect(allMembers[0].groupName).toBe(''); // Empty groupName
        });

        it('should not create duplicates for existing members', async () => {
            const { getAllMeets } = await import('~repository/meets');
            const { getGroupMap } = await import('~repository/groups');

            // Create existing member
            const existing = createMemberFixture({ name: 'Alice', groupName: 'KH-41' });
            await saveMember(existing);

            const meets = [
                createMeetFixture({
                    meetId: 'm1',
                    participants: [
                        { name: 'Alice' },
                        { name: 'Bob' },
                    ],
                }),
            ];

            const groupMap = {
                m1: { id: 'g1', name: 'KH-41', meetId: 'm1' },
            };

            getAllMeets.mockResolvedValue(meets);
            getGroupMap.mockResolvedValue(groupMap);

            await syncAllMembersFromMeets();

            const allMembers = await getAllMembers();
            expect(allMembers).toHaveLength(2); // Alice (existing) + Bob (new)
        });
    });
});
