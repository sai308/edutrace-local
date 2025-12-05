
import { describe, it, expect } from 'vitest';
import { serializeModule } from '../../src/services/examSerialization';

describe('Exam Serialization', () => {
    const mockGroup = { id: 101, name: 'CS-101' };

    it('should serialize a comprehensive module correctly', () => {
        const inputModule = {
            id: 1,
            name: 'Core Module',
            tasks: [
                { id: 10, name: 'Task 1', date: '2023-01-01', groupName: 'CS-101', groupId: 101, extra: 'ignore' }
            ],
            test: { id: 20, name: 'Final Test', date: '2023-01-02', groupName: 'CS-101', groupId: 101, extra: 'ignore' },
            tasksCoefficient: 0.6,
            testCoefficient: 0.4,
            minTasksRequired: 5, // The critical fix
            extraProp: 'should be ignored'
        };

        const result = serializeModule(inputModule, mockGroup);

        expect(result).toEqual({
            id: 1,
            name: 'Core Module',
            tasks: [
                { id: 10, name: 'Task 1', date: '2023-01-01', groupName: 'CS-101', groupId: 101 }
            ],
            test: { id: 20, name: 'Final Test', date: '2023-01-02', groupName: 'CS-101', groupId: 101 },
            tasksCoefficient: 0.6,
            testCoefficient: 0.4,
            minTasksRequired: 5,
            groupName: 'CS-101',
            groupId: 101
        });
    });

    it('should handle missing optional fields (tasks, test)', () => {
        const inputModule = {
            id: 2,
            name: 'Simple Module',
            tasksCoefficient: 1.0,
            testCoefficient: 0.0,
            minTasksRequired: 1
        };

        const result = serializeModule(inputModule, mockGroup);

        expect(result.tasks).toEqual([]);
        expect(result.test).toBeNull();
        expect(result.minTasksRequired).toBe(1);
    });

    it('should strip extra properties not defined in the schema', () => {
        const inputModule = {
            id: 3,
            name: 'Clean Module',
            minTasksRequired: 3,
            tempState: 'dirty',
            isDragging: true
        };

        const result = serializeModule(inputModule, mockGroup);

        expect(result.tempState).toBeUndefined();
        expect(result.isDragging).toBeUndefined();
        expect(result.minTasksRequired).toBe(3);
    });
});
