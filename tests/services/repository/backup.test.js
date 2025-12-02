import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbConnection } from '~repository/db';
import * as backup from '~repository/backup';
import * as meets from '~repository/meets';
import * as groups from '~repository/groups';
import * as tasks from '~repository/tasks';
import * as marks from '~repository/marks';
import * as members from '~repository/members';
import * as settings from '~repository/settings';
import { createMeetFixture, createGroupFixture, createTaskFixture, createMemberFixture, createMarkFixture, resetIdCounter } from './helpers';

describe('backup.js', () => {
    beforeEach(async () => {
        await resetDbConnection();
        resetIdCounter();
        localStorage.clear();
    });

    describe('Full Backup & Restore', () => {
        it('should export and import all data correctly', async () => {
            // 1. Setup initial data
            const meet = createMeetFixture();
            await meets.saveMeet(meet);

            const group = createGroupFixture();
            await groups.saveGroup(group);

            const member = createMemberFixture({ groupName: group.name });
            await members.saveMember(member);

            const task = createTaskFixture({ groupName: group.name });
            const { id: taskId } = await tasks.saveTask(task);

            const mark = createMarkFixture({ taskId, studentId: member.id, score: 95 });
            await marks.saveMark(mark);

            await settings.saveDurationLimit(45);
            await settings.saveDefaultTeacher('Prof. Test');
            await settings.saveIgnoredUsers(['ignore@test.com']);
            await settings.saveTeachers(['Teacher A', 'Teacher B']);

            // 2. Export
            const data = await backup.exportData();

            expect(data.meets).toHaveLength(1);
            expect(data.groups).toHaveLength(1);
            expect(data.members).toHaveLength(1);
            expect(data.tasks).toHaveLength(1);
            expect(data.marks).toHaveLength(1);
            expect(data.settings.durationLimit).toBe(45);
            expect(data.settings.defaultTeacher).toBe('Prof. Test');
            expect(data.settings.ignoredUsers).toEqual(['ignore@test.com']);
            expect(data.settings.teachers).toEqual(['Teacher A', 'Teacher B']);

            // 3. Clear data
            await backup.clearAll();
            expect(await meets.getAllMeets()).toHaveLength(0);
            expect(await settings.getDurationLimit()).toBe(0);

            // 4. Import
            await backup.importData(data);

            // 5. Verify restoration
            const restoredMeets = await meets.getAllMeets();
            expect(restoredMeets).toHaveLength(1);
            expect(restoredMeets[0].meetId).toBe(meet.meetId);

            const restoredGroups = await groups.getGroups();
            expect(restoredGroups).toHaveLength(1);
            expect(restoredGroups[0].name).toBe(group.name);

            const restoredMembers = await members.getAllMembers();
            expect(restoredMembers).toHaveLength(1);
            expect(restoredMembers[0].name).toBe(member.name);

            const restoredTasks = await tasks.getAllTasks();
            expect(restoredTasks).toHaveLength(1);
            expect(restoredTasks[0].name).toBe(task.name);

            const restoredMarks = await marks.getAllMarks();
            expect(restoredMarks).toHaveLength(1);
            expect(restoredMarks[0].score).toBe(95);

            expect(await settings.getDurationLimit()).toBe(45);
            expect(await settings.getDefaultTeacher()).toBe('Prof. Test');
            expect(await settings.getIgnoredUsers()).toEqual(['ignore@test.com']);
            expect(await settings.getTeachers()).toEqual(['Teacher A', 'Teacher B']);
        });

        it('should handle task ID remapping on import', async () => {
            // 1. Create a task and mark in the "current" DB
            const group = createGroupFixture();
            await groups.saveGroup(group);

            const existingTask = createTaskFixture({ name: 'Existing Task', groupName: group.name });
            const { id: existingTaskId } = await tasks.saveTask(existingTask);

            // 2. Create backup data with a DIFFERENT task ID but SAME natural key (name/date/group)
            // This simulates importing data where the task already exists but might have a different ID in the source
            // Actually, the logic is: if natural key matches, use existing ID.
            // Let's test importing a NEW task that conflicts on ID with an existing one (though IDB handles this by ignoring ID if we add without it, but here we are putting with ID).
            // Wait, the import logic checks natural key.

            // Scenario A: Import a task that matches an existing one by natural key.
            // The import should update the existing task and remap marks to the existing ID.

            const backupTask = { ...existingTask, id: 999, maxPoints: 50 }; // Different ID, changed field
            const backupMark = createMarkFixture({ taskId: 999, score: 80 }); // Points to backup task ID

            const backupData = {
                meets: [],
                groups: [group],
                members: [],
                tasks: [backupTask],
                marks: [backupMark],
                settings: {}
            };

            // 3. Import
            // Note: importData clears all data first! 
            // So we can't test "merging" into an existing DB with clearAll() at the start of importData.
            // Ah, `importData` calls `clearAll()`. So it replaces everything.
            // The ID remapping logic in `importData` seems to be designed for when we *don't* clear, or maybe it's just defensive?
            // Let's look at `importData` again.
            // It calls `await clearAll();` at line 75.
            // So the DB is empty when we start restoring.
            // The remapping logic (lines 115-139) seems to be:
            // Iterate tasks from backup.
            // Check if task exists in DB (it won't, because we cleared it).
            // So it will always go to "New task" block (line 131).
            // It removes the ID and adds it, letting DB assign a new ID.
            // Then it maps oldId -> newId.
            // Then marks use this mapping.

            // So the test is: verify that marks are correctly linked to the new task ID.

            await backup.importData(backupData);

            const tasksInDb = await tasks.getAllTasks();
            expect(tasksInDb).toHaveLength(1);
            const newTaskId = tasksInDb[0].id;
            expect(newTaskId).not.toBe(999); // Should have a new auto-generated ID (likely 1 since we reset)
            expect(tasksInDb[0].maxPoints).toBe(50);

            const marksInDb = await marks.getAllMarks();
            expect(marksInDb).toHaveLength(1);
            expect(marksInDb[0].taskId).toBe(newTaskId); // Should be linked to the new task ID
        });
    });

    describe('Granular Backup & Restore', () => {
        it('should export and import reports (meets)', async () => {
            const meet = createMeetFixture();
            await meets.saveMeet(meet);

            const data = await backup.exportReports();
            expect(data.type).toBe('reports');
            expect(data.meets).toHaveLength(1);

            await backup.clearReports();
            expect(await meets.getAllMeets()).toHaveLength(0);

            await backup.importReports(data);
            expect(await meets.getAllMeets()).toHaveLength(1);
        });

        it('should export and import groups', async () => {
            const group = createGroupFixture();
            await groups.saveGroup(group);

            const data = await backup.exportGroups();
            expect(data.type).toBe('groups');
            expect(data.groups).toHaveLength(1);

            await backup.clearGroups();
            expect(await groups.getGroups()).toHaveLength(0);

            await backup.importGroups(data);
            expect(await groups.getGroups()).toHaveLength(1);
        });

        it('should export and import marks (with tasks and members)', async () => {
            const group = createGroupFixture();
            await groups.saveGroup(group);
            const member = createMemberFixture({ groupName: group.name });
            await members.saveMember(member);
            const task = createTaskFixture({ groupName: group.name });
            const { id: taskId } = await tasks.saveTask(task);
            const mark = createMarkFixture({ taskId, studentId: member.id });
            await marks.saveMark(mark);

            const data = await backup.exportMarks();
            expect(data.type).toBe('marks');
            expect(data.tasks).toHaveLength(1);
            expect(data.marks).toHaveLength(1);
            expect(data.members).toHaveLength(1);

            await backup.clearMarks();
            await backup.clearMembers();
            expect(await marks.getAllMarks()).toHaveLength(0);

            await backup.importMarks(data);

            const restoredMarks = await marks.getAllMarks();
            expect(restoredMarks).toHaveLength(1);

            // Verify task ID linkage is preserved (remapping logic applies here too)
            const restoredTasks = await tasks.getAllTasks();
            expect(restoredTasks).toHaveLength(1);
            expect(restoredMarks[0].taskId).toBe(restoredTasks[0].id);
        });
    });

    describe('Course Suggestion on Import', () => {
        it('should suggest course from group name if missing', async () => {
            const group1 = { ...createGroupFixture({ name: 'Group 1' }), course: null };
            const group2 = { ...createGroupFixture({ name: 'Group 2' }), course: null };
            const group3 = { ...createGroupFixture({ name: 'No Digit' }), course: null };
            const group4 = { ...createGroupFixture({ name: 'Group 4' }), course: 3 }; // Existing course should be preserved

            const data = {
                meets: [],
                groups: [group1, group2, group3, group4],
                members: [],
                tasks: [],
                marks: [],
                settings: {}
            };

            await backup.importData(data);

            const groupsInDb = await groups.getGroups();
            expect(groupsInDb).toHaveLength(4);

            const g1 = groupsInDb.find(g => g.name === 'Group 1');
            expect(g1.course).toBe(1);

            const g2 = groupsInDb.find(g => g.name === 'Group 2');
            expect(g2.course).toBe(2);

            const g3 = groupsInDb.find(g => g.name === 'No Digit');
            expect(g3.course).toBeNull();

            const g4 = groupsInDb.find(g => g.name === 'Group 4');
            expect(g4.course).toBe(3); // Should NOT be overwritten to 4
        });

        it('should suggest course during granular group import', async () => {
            const group = { ...createGroupFixture({ name: 'Group 3' }), course: null };
            const data = { groups: [group], version: 1, type: 'groups' };

            await backup.importGroups(data);

            const groupsInDb = await groups.getGroups();
            expect(groupsInDb).toHaveLength(1);
            expect(groupsInDb[0].course).toBe(3);
        });
    });
});
