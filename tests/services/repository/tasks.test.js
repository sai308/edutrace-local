import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbConnection } from '~repository/db';
import {
    saveTask,
    getAllTasks,
    getTasksByGroup,
    findTaskByNaturalKey,
    getTaskById,
} from '~repository/tasks';
import { createTaskFixture, resetIdCounter } from './helpers';

describe('tasks.js', () => {
    beforeEach(async () => {
        localStorage.clear();
        await resetDbConnection();
        resetIdCounter();
    });

    describe('saveTask - unique natural key', () => {
        it('should save new task and return isNew: true', async () => {
            const task = createTaskFixture({
                name: 'Lab 1',
                date: '2024-01-15',
                groupName: 'KH-41',
                maxPoints: 10,
            });

            const result = await saveTask(task);

            expect(result.isNew).toBe(true);
            expect(result.id).toBeDefined();

            const allTasks = await getAllTasks();
            expect(allTasks).toHaveLength(1);
            expect(allTasks[0].name).toBe('Lab 1');
        });

        it('should detect duplicate by natural key and return isNew: false', async () => {
            const task = createTaskFixture({
                name: 'Lab 1',
                date: '2024-01-15',
                groupName: 'KH-41',
                maxPoints: 10,
            });

            const result1 = await saveTask(task);
            expect(result1.isNew).toBe(true);

            // Try to save again with same natural key
            const result2 = await saveTask(task);
            expect(result2.isNew).toBe(false);
            expect(result2.id).toBe(result1.id);

            // Should still be only one task
            const allTasks = await getAllTasks();
            expect(allTasks).toHaveLength(1);
        });

        it('should allow tasks with same name but different date', async () => {
            const task1 = createTaskFixture({
                name: 'Lab 1',
                date: '2024-01-15',
                groupName: 'KH-41',
            });

            const task2 = createTaskFixture({
                name: 'Lab 1',
                date: '2024-01-16', // Different date
                groupName: 'KH-41',
            });

            const result1 = await saveTask(task1);
            const result2 = await saveTask(task2);

            expect(result1.isNew).toBe(true);
            expect(result2.isNew).toBe(true);
            expect(result1.id).not.toBe(result2.id);

            const allTasks = await getAllTasks();
            expect(allTasks).toHaveLength(2);
        });

        it('should allow tasks with same name and date but different group', async () => {
            const task1 = createTaskFixture({
                name: 'Lab 1',
                date: '2024-01-15',
                groupName: 'KH-41',
            });

            const task2 = createTaskFixture({
                name: 'Lab 1',
                date: '2024-01-15',
                groupName: 'KH-42', // Different group
            });

            const result1 = await saveTask(task1);
            const result2 = await saveTask(task2);

            expect(result1.isNew).toBe(true);
            expect(result2.isNew).toBe(true);

            const allTasks = await getAllTasks();
            expect(allTasks).toHaveLength(2);
        });
    });

    describe('getTasksByGroup', () => {
        it('should return tasks for specific group', async () => {
            const task1 = createTaskFixture({ name: 'Lab 1', groupName: 'KH-41', date: '2024-01-15' });
            const task2 = createTaskFixture({ name: 'Lab 2', groupName: 'KH-41', date: '2024-01-16' });
            const task3 = createTaskFixture({ name: 'Lab 1', groupName: 'KH-42', date: '2024-01-15' });

            await saveTask(task1);
            await saveTask(task2);
            await saveTask(task3);

            const kh41Tasks = await getTasksByGroup('KH-41');
            expect(kh41Tasks).toHaveLength(2);
            expect(kh41Tasks.every(t => t.groupName === 'KH-41')).toBe(true);

            const kh42Tasks = await getTasksByGroup('KH-42');
            expect(kh42Tasks).toHaveLength(1);
            expect(kh42Tasks[0].groupName).toBe('KH-42');
        });

        it('should return empty array for group with no tasks', async () => {
            const tasks = await getTasksByGroup('NonExistent');
            expect(tasks).toEqual([]);
        });
    });

    describe('findTaskByNaturalKey', () => {
        it('should find task by natural key', async () => {
            const task = createTaskFixture({
                name: 'Lab 1',
                date: '2024-01-15',
                groupName: 'KH-41',
                maxPoints: 10,
            });

            await saveTask(task);

            const found = await findTaskByNaturalKey('Lab 1', '2024-01-15', 'KH-41');
            expect(found).toBeDefined();
            expect(found.name).toBe('Lab 1');
            expect(found.date).toBe('2024-01-15');
            expect(found.groupName).toBe('KH-41');
            expect(found.maxPoints).toBe(10);
        });

        it('should return undefined when task not found', async () => {
            const found = await findTaskByNaturalKey('NonExistent', '2024-01-15', 'KH-41');
            expect(found).toBeUndefined();
        });

        it('should distinguish between tasks with similar keys', async () => {
            const task1 = createTaskFixture({
                name: 'Lab 1',
                date: '2024-01-15',
                groupName: 'KH-41',
            });

            const task2 = createTaskFixture({
                name: 'Lab 1',
                date: '2024-01-16',
                groupName: 'KH-41',
            });

            await saveTask(task1);
            await saveTask(task2);

            const found1 = await findTaskByNaturalKey('Lab 1', '2024-01-15', 'KH-41');
            const found2 = await findTaskByNaturalKey('Lab 1', '2024-01-16', 'KH-41');

            expect(found1).toBeDefined();
            expect(found2).toBeDefined();
            expect(found1.id).not.toBe(found2.id);
            expect(found1.date).toBe('2024-01-15');
            expect(found2.date).toBe('2024-01-16');
        });
    });

    describe('getTaskById', () => {
        it('should retrieve task by id', async () => {
            const task = createTaskFixture({
                name: 'Lab 1',
                date: '2024-01-15',
                groupName: 'KH-41',
            });

            const { id } = await saveTask(task);
            const retrieved = await getTaskById(id);

            expect(retrieved).toBeDefined();
            expect(retrieved.id).toBe(id);
            expect(retrieved.name).toBe('Lab 1');
        });

        it('should return undefined for non-existent id', async () => {
            const retrieved = await getTaskById(999);
            expect(retrieved).toBeUndefined();
        });
    });

    describe('getAllTasks', () => {
        it('should return all tasks', async () => {
            const task1 = createTaskFixture({ name: 'Lab 1', date: '2024-01-15', groupName: 'KH-41' });
            const task2 = createTaskFixture({ name: 'Lab 2', date: '2024-01-16', groupName: 'KH-42' });
            const task3 = createTaskFixture({ name: 'Lab 3', date: '2024-01-17', groupName: 'KH-43' });

            await saveTask(task1);
            await saveTask(task2);
            await saveTask(task3);

            const allTasks = await getAllTasks();
            expect(allTasks).toHaveLength(3);
        });

        it('should return empty array when no tasks exist', async () => {
            const allTasks = await getAllTasks();
            expect(allTasks).toEqual([]);
        });
    });
});
