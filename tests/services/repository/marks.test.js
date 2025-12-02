import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbConnection } from '~repository/db';
import {
    saveMark,
    getAllMarks,
    getMarksByTask,
    getMarksByStudent,
    deleteMark,
    deleteMarks,
    getAllMarksWithRelations,
    updateMarkSynced,
} from '~repository/marks';
import { saveTask } from '~repository/tasks';
import { saveMember } from '~repository/members';
import { createMarkFixture, createTaskFixture, createMemberFixture, resetIdCounter } from './helpers';

// Mock settings for members
import { vi } from 'vitest';
vi.mock('~repository/settings', () => ({
    getTeachers: vi.fn(() => Promise.resolve([])),
}));

describe('marks.js', () => {
    beforeEach(async () => {
        localStorage.clear();
        await resetDbConnection();
        resetIdCounter();
    });

    describe('saveMark - new mark', () => {
        it('should create new mark with isNew: true', async () => {
            const task = createTaskFixture({ name: 'Lab 1', date: '2024-01-15', groupName: 'KH-41' });
            const { id: taskId } = await saveTask(task);

            const member = createMemberFixture({ name: 'John Doe', groupName: 'KH-41' });
            const studentId = await saveMember(member);

            const mark = createMarkFixture({ taskId, studentId, score: 10 });
            const result = await saveMark(mark);

            expect(result.isNew).toBe(true);
            expect(result.id).toBeDefined();

            const allMarks = await getAllMarks();
            expect(allMarks).toHaveLength(1);
            expect(allMarks[0].score).toBe(10);
            expect(allMarks[0].createdAt).toBeDefined();
        });
    });

    describe('saveMark - duplicate with same score', () => {
        it('should return existing mark without creating duplicate', async () => {
            const task = createTaskFixture({ name: 'Lab 1', date: '2024-01-15', groupName: 'KH-41' });
            const { id: taskId } = await saveTask(task);

            const member = createMemberFixture({ name: 'John Doe', groupName: 'KH-41' });
            const studentId = await saveMember(member);

            const mark = createMarkFixture({ taskId, studentId, score: 10 });

            const result1 = await saveMark(mark);
            expect(result1.isNew).toBe(true);

            // Try to save again with same score
            const result2 = await saveMark(mark);
            expect(result2.isNew).toBe(false);
            expect(result2.id).toBe(result1.id);

            // Should still be only one mark
            const allMarks = await getAllMarks();
            expect(allMarks).toHaveLength(1);
        });
    });

    describe('saveMark - update with different score', () => {
        it('should update existing mark when score changes', async () => {
            const task = createTaskFixture({ name: 'Lab 1', date: '2024-01-15', groupName: 'KH-41' });
            const { id: taskId } = await saveTask(task);

            const member = createMemberFixture({ name: 'John Doe', groupName: 'KH-41' });
            const studentId = await saveMember(member);

            // Create initial mark
            const mark1 = createMarkFixture({ taskId, studentId, score: 10 });
            const result1 = await saveMark(mark1);
            expect(result1.isNew).toBe(true);

            // Update with different score
            const mark2 = createMarkFixture({ taskId, studentId, score: 5 });
            const result2 = await saveMark(mark2);

            expect(result2.isNew).toBe(false);
            expect(result2.id).toBe(result1.id);

            // Verify score was updated
            const allMarks = await getAllMarks();
            expect(allMarks).toHaveLength(1);
            expect(allMarks[0].score).toBe(5);
            expect(allMarks[0].synced).toBe(false);
        });
    });

    describe('getMarksByTask', () => {
        it('should return marks for specific task', async () => {
            const task1 = createTaskFixture({ name: 'Lab 1', date: '2024-01-15', groupName: 'KH-41' });
            const task2 = createTaskFixture({ name: 'Lab 2', date: '2024-01-16', groupName: 'KH-41' });

            const { id: taskId1 } = await saveTask(task1);
            const { id: taskId2 } = await saveTask(task2);

            const member = createMemberFixture({ name: 'John Doe', groupName: 'KH-41' });
            const studentId = await saveMember(member);

            await saveMark(createMarkFixture({ taskId: taskId1, studentId, score: 10 }));
            await saveMark(createMarkFixture({ taskId: taskId2, studentId, score: 8 }));

            const task1Marks = await getMarksByTask(taskId1);
            expect(task1Marks).toHaveLength(1);
            expect(task1Marks[0].taskId).toBe(taskId1);
            expect(task1Marks[0].score).toBe(10);

            const task2Marks = await getMarksByTask(taskId2);
            expect(task2Marks).toHaveLength(1);
            expect(task2Marks[0].taskId).toBe(taskId2);
            expect(task2Marks[0].score).toBe(8);
        });
    });

    describe('getMarksByStudent', () => {
        it('should return marks for specific student', async () => {
            const task = createTaskFixture({ name: 'Lab 1', date: '2024-01-15', groupName: 'KH-41' });
            const { id: taskId } = await saveTask(task);

            const member1 = createMemberFixture({ name: 'John Doe', groupName: 'KH-41' });
            const member2 = createMemberFixture({ name: 'Jane Smith', groupName: 'KH-41' });

            const studentId1 = await saveMember(member1);
            const studentId2 = await saveMember(member2);

            await saveMark(createMarkFixture({ taskId, studentId: studentId1, score: 10 }));
            await saveMark(createMarkFixture({ taskId, studentId: studentId2, score: 8 }));

            const student1Marks = await getMarksByStudent(studentId1);
            expect(student1Marks).toHaveLength(1);
            expect(student1Marks[0].studentId).toBe(studentId1);
            expect(student1Marks[0].score).toBe(10);

            const student2Marks = await getMarksByStudent(studentId2);
            expect(student2Marks).toHaveLength(1);
            expect(student2Marks[0].studentId).toBe(studentId2);
            expect(student2Marks[0].score).toBe(8);
        });
    });

    describe('deleteMark', () => {
        it('should delete a single mark', async () => {
            const task = createTaskFixture({ name: 'Lab 1', date: '2024-01-15', groupName: 'KH-41' });
            const { id: taskId } = await saveTask(task);

            const member = createMemberFixture({ name: 'John Doe', groupName: 'KH-41' });
            const studentId = await saveMember(member);

            const { id: markId } = await saveMark(createMarkFixture({ taskId, studentId, score: 10 }));

            let allMarks = await getAllMarks();
            expect(allMarks).toHaveLength(1);

            await deleteMark(markId);

            allMarks = await getAllMarks();
            expect(allMarks).toHaveLength(0);
        });
    });

    describe('deleteMarks', () => {
        it('should delete multiple marks', async () => {
            const task = createTaskFixture({ name: 'Lab 1', date: '2024-01-15', groupName: 'KH-41' });
            const { id: taskId } = await saveTask(task);

            const member1 = createMemberFixture({ name: 'John', groupName: 'KH-41' });
            const member2 = createMemberFixture({ name: 'Jane', groupName: 'KH-41' });
            const member3 = createMemberFixture({ name: 'Bob', groupName: 'KH-41' });

            const studentId1 = await saveMember(member1);
            const studentId2 = await saveMember(member2);
            const studentId3 = await saveMember(member3);

            const { id: markId1 } = await saveMark(createMarkFixture({ taskId, studentId: studentId1, score: 10 }));
            const { id: markId2 } = await saveMark(createMarkFixture({ taskId, studentId: studentId2, score: 8 }));
            const { id: markId3 } = await saveMark(createMarkFixture({ taskId, studentId: studentId3, score: 9 }));

            await deleteMarks([markId1, markId2]);

            const allMarks = await getAllMarks();
            expect(allMarks).toHaveLength(1);
            expect(allMarks[0].id).toBe(markId3);
        });
    });

    describe('updateMarkSynced', () => {
        it('should update synced status', async () => {
            const task = createTaskFixture({ name: 'Lab 1', date: '2024-01-15', groupName: 'KH-41' });
            const { id: taskId } = await saveTask(task);

            const member = createMemberFixture({ name: 'John Doe', groupName: 'KH-41' });
            const studentId = await saveMember(member);

            const { id: markId } = await saveMark(createMarkFixture({ taskId, studentId, score: 10 }));

            await updateMarkSynced(markId, true);

            const allMarks = await getAllMarks();
            expect(allMarks[0].synced).toBe(true);

            await updateMarkSynced(markId, false);

            const updatedMarks = await getAllMarks();
            expect(updatedMarks[0].synced).toBe(false);
        });
    });

    describe('getAllMarksWithRelations', () => {
        it('should return flattened marks with related data', async () => {
            const task = createTaskFixture({
                name: 'Lab 1',
                date: '2024-01-15',
                groupName: 'KH-41',
                maxPoints: 10,
            });
            const { id: taskId } = await saveTask(task);

            const member = createMemberFixture({ name: 'John Doe', groupName: 'KH-41' });
            const studentId = await saveMember(member);

            await saveMark(createMarkFixture({ taskId, studentId, score: 8 }));

            const flatMarks = await getAllMarksWithRelations();

            expect(flatMarks).toHaveLength(1);
            expect(flatMarks[0]).toMatchObject({
                studentName: 'John Doe',
                groupName: 'KH-41',
                taskName: 'Lab 1',
                taskDate: '2024-01-15',
                maxPoints: 10,
                score: 8,
            });
            expect(flatMarks[0].id).toBeDefined();
            expect(flatMarks[0].createdAt).toBeDefined();
        });

        it('should skip marks with missing task', async () => {
            const task = createTaskFixture({ name: 'Lab 1', date: '2024-01-15', groupName: 'KH-41' });
            const { id: taskId } = await saveTask(task);

            const member = createMemberFixture({ name: 'John Doe', groupName: 'KH-41' });
            const studentId = await saveMember(member);

            await saveMark(createMarkFixture({ taskId, studentId, score: 8 }));

            // Create orphaned mark with non-existent taskId
            await saveMark(createMarkFixture({ taskId: 999, studentId, score: 10 }));

            const flatMarks = await getAllMarksWithRelations();

            // Should only return the mark with valid task
            expect(flatMarks).toHaveLength(1);
            expect(flatMarks[0].taskName).toBe('Lab 1');
        });

        it('should skip marks with missing student', async () => {
            const task = createTaskFixture({ name: 'Lab 1', date: '2024-01-15', groupName: 'KH-41' });
            const { id: taskId } = await saveTask(task);

            const member = createMemberFixture({ name: 'John Doe', groupName: 'KH-41' });
            const studentId = await saveMember(member);

            await saveMark(createMarkFixture({ taskId, studentId, score: 8 }));

            // Create orphaned mark with non-existent studentId
            await saveMark(createMarkFixture({ taskId, studentId: 999, score: 10 }));

            const flatMarks = await getAllMarksWithRelations();

            // Should only return the mark with valid student
            expect(flatMarks).toHaveLength(1);
            expect(flatMarks[0].studentName).toBe('John Doe');
        });

        it('should handle multiple marks correctly', async () => {
            const task1 = createTaskFixture({ name: 'Lab 1', date: '2024-01-15', groupName: 'KH-41', maxPoints: 10 });
            const task2 = createTaskFixture({ name: 'Lab 2', date: '2024-01-16', groupName: 'KH-42', maxPoints: 20 });

            const { id: taskId1 } = await saveTask(task1);
            const { id: taskId2 } = await saveTask(task2);

            const member1 = createMemberFixture({ name: 'John', groupName: 'KH-41' });
            const member2 = createMemberFixture({ name: 'Jane', groupName: 'KH-42' });

            const studentId1 = await saveMember(member1);
            const studentId2 = await saveMember(member2);

            await saveMark(createMarkFixture({ taskId: taskId1, studentId: studentId1, score: 8 }));
            await saveMark(createMarkFixture({ taskId: taskId2, studentId: studentId2, score: 15 }));

            const flatMarks = await getAllMarksWithRelations();

            expect(flatMarks).toHaveLength(2);

            const mark1 = flatMarks.find(m => m.studentName === 'John');
            expect(mark1).toMatchObject({
                taskName: 'Lab 1',
                groupName: 'KH-41',
                maxPoints: 10,
                score: 8,
            });

            const mark2 = flatMarks.find(m => m.studentName === 'Jane');
            expect(mark2).toMatchObject({
                taskName: 'Lab 2',
                groupName: 'KH-42',
                maxPoints: 20,
                score: 15,
            });
        });
    });
});
