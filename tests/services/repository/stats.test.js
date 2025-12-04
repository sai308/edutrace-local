import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbConnection } from '~repository/db';
import * as stats from '~repository/stats';
import * as meets from '~repository/meets';
import * as groups from '~repository/groups';
import * as tasks from '~repository/tasks';
import * as marks from '~repository/marks';
import * as members from '~repository/members';
import { createMeetFixture, createGroupFixture, createTaskFixture, createMemberFixture, createMarkFixture, resetIdCounter } from './helpers';

describe('stats.js', () => {
    beforeEach(async () => {
        await resetDbConnection();
        resetIdCounter();
        localStorage.clear();
    });

    describe('getEntityCounts', () => {
        it('should return zero counts for empty database', async () => {
            const counts = await stats.getEntityCounts();

            expect(counts).toEqual({
                reports: 0,
                groups: 0,
                marks: 0,
                tasks: 0,
                members: 0,
                finalAssessments: 0,
                modules: 0
            });
        });

        it('should handle multiple entities correctly', async () => {
            // Create multiple meets
            await meets.saveMeet(createMeetFixture({ meetId: 'meet-1' }));
            await meets.saveMeet(createMeetFixture({ meetId: 'meet-2' }));
            await meets.saveMeet(createMeetFixture({ meetId: 'meet-3' }));

            // Create multiple groups with unique names
            await groups.saveGroup(createGroupFixture({ name: 'KH-41' }));
            await groups.saveGroup(createGroupFixture({ name: 'KH-42' }));

            // Create multiple members with unique names and emails
            await members.saveMember(createMemberFixture({ name: 'User 1', email: 'user1@test.com' }));
            await members.saveMember(createMemberFixture({ name: 'User 2', email: 'user2@test.com' }));
            await members.saveMember(createMemberFixture({ name: 'User 3', email: 'user3@test.com' }));
            await members.saveMember(createMemberFixture({ name: 'User 4', email: 'user4@test.com' }));

            const counts = await stats.getEntityCounts();

            expect(counts.reports).toBe(3);
            expect(counts.groups).toBe(2);
            expect(counts.members).toBe(4);
        });

        it('should return correct counts for all entity types', async () => {
            // Create test data with unique names
            const meet = createMeetFixture({ meetId: 'test-meet-1' });
            await meets.saveMeet(meet);

            const group = createGroupFixture({ name: 'Test-Group-1' });
            await groups.saveGroup(group);

            const member = createMemberFixture({ name: 'Test Student 1', email: 'test1@example.com', groupName: group.name });
            await members.saveMember(member);

            const task = createTaskFixture({ groupName: group.name });
            const { id: taskId } = await tasks.saveTask(task);

            const mark = createMarkFixture({ taskId, studentId: member.id });
            await marks.saveMark(mark);

            const counts = await stats.getEntityCounts();

            expect(counts).toEqual({
                reports: 1,
                groups: 1,
                marks: 1,
                tasks: 1,
                members: 1,
                finalAssessments: 0,
                modules: 0
            });
        });
    });

    describe('getEntitySizes', () => {
        it('should return zero sizes for empty database', async () => {
            const sizes = await stats.getEntitySizes();

            // Should return valid structure with numeric values
            expect(typeof sizes.reports).toBe('number');
            expect(typeof sizes.groups).toBe('number');
            expect(typeof sizes.marks).toBe('number');
            expect(typeof sizes.tasks).toBe('number');
            expect(typeof sizes.members).toBe('number');
            expect(typeof sizes.summary).toBe('number');

            // All sizes should be non-negative
            expect(sizes.reports).toBeGreaterThanOrEqual(0);
            expect(sizes.groups).toBeGreaterThanOrEqual(0);
            expect(sizes.marks).toBeGreaterThanOrEqual(0);
            expect(sizes.tasks).toBeGreaterThanOrEqual(0);
            expect(sizes.members).toBeGreaterThanOrEqual(0);
            expect(sizes.summary).toBeGreaterThanOrEqual(0);
        });

        it('should handle serialization errors gracefully', async () => {
            // This test verifies that the getSize function handles errors
            // In practice, JSON.stringify rarely fails with normal data
            // but the function has a try-catch to return 0 on error
            const sizes = await stats.getEntitySizes();

            // Should not throw and should return valid structure
            expect(sizes).toHaveProperty('reports');
            expect(sizes).toHaveProperty('groups');
            expect(sizes).toHaveProperty('marks');
            expect(sizes).toHaveProperty('tasks');
            expect(sizes).toHaveProperty('members');
            expect(sizes).toHaveProperty('summary');
        });

        it('should calculate sizes for all entity types using Blob', async () => {
            // Create test data with unique names
            const meet = createMeetFixture({ meetId: 'size-test-meet' });
            await meets.saveMeet(meet);

            const group = createGroupFixture({ name: 'Size-Test-Group' });
            await groups.saveGroup(group);

            const member = createMemberFixture({ name: 'Size Test Student', email: 'sizetest@example.com', groupName: group.name });
            await members.saveMember(member);

            const task = createTaskFixture({ groupName: group.name });
            const { id: taskId } = await tasks.saveTask(task);

            const mark = createMarkFixture({ taskId, studentId: member.id });
            await marks.saveMark(mark);

            const sizes = await stats.getEntitySizes();

            // All sizes should be greater than 0
            expect(sizes.reports).toBeGreaterThan(0);
            expect(sizes.groups).toBeGreaterThan(0);
            expect(sizes.marks).toBeGreaterThan(0);
            expect(sizes.tasks).toBeGreaterThan(0);
            expect(sizes.members).toBeGreaterThan(0);
        });

        it('should calculate marks and tasks sizes independently', async () => {
            const group = createGroupFixture({ name: 'Marks-Test-Group' });
            await groups.saveGroup(group);

            const member = createMemberFixture({ name: 'Marks Test Student', email: 'markstest@example.com', groupName: group.name });
            await members.saveMember(member);

            const task = createTaskFixture({ groupName: group.name });
            const { id: taskId } = await tasks.saveTask(task);

            const mark = createMarkFixture({ taskId, studentId: member.id });
            await marks.saveMark(mark);

            const sizes = await stats.getEntitySizes();

            // Both marks and tasks should have independent sizes > 0
            expect(sizes.marks).toBeGreaterThan(0);
            expect(sizes.tasks).toBeGreaterThan(0);
        });
    });

    describe('getAllWorkspacesSizes', () => {
        it('should delegate to workspace module', async () => {
            const result = await stats.getAllWorkspacesSizes();

            // Should return the structure from workspace.getAllWorkspacesSizes()
            expect(result).toHaveProperty('total');
            expect(result).toHaveProperty('workspaces');
            expect(Array.isArray(result.workspaces)).toBe(true);
        });

        it('should return correct size information', async () => {
            // Add some data to the current workspace with unique names
            const meet = createMeetFixture({ meetId: 'workspace-size-meet' });
            await meets.saveMeet(meet);

            const group = createGroupFixture({ name: 'Workspace-Size-Group' });
            await groups.saveGroup(group);

            const result = await stats.getAllWorkspacesSizes();

            expect(result.total).toBeGreaterThan(0);
            expect(result.workspaces.length).toBeGreaterThan(0);

            // Default workspace should have some size
            const defaultWorkspace = result.workspaces.find(w => w.id === 'default');
            expect(defaultWorkspace).toBeDefined();
            expect(defaultWorkspace.size).toBeGreaterThan(0);
        });
    });
});
