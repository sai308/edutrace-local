import { describe, it, expect, vi, beforeEach } from 'vitest';
import { marksService } from '../marks.service';
import { marksRepository } from '../marks.repository';
import { tasksRepository } from '../tasks.repository';
import { groupsRepository } from '../../../Groups/services/groups.repository';
import { studentsRepository } from '../../../Students/services/students.repository';
import { meetsRepository } from '../../../Analytics/services/meets.repository';

// Mock repositories
vi.mock('../marks.repository');
vi.mock('../tasks.repository');
vi.mock('../../../Groups/services/groups.repository');
vi.mock('../../../Students/services/students.repository');
vi.mock('../../../Analytics/services/meets.repository');
vi.mock('../marksParser', () => ({
    parseMarksCSV: vi.fn(),
    validateMarksFile: vi.fn()
}));

// Import mocked parser
import { parseMarksCSV } from '../marksParser';

describe('MarksService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('processFile', () => {
        it('should orchestrate file processing correctly', async () => {
            // Mock Parser Output
            parseMarksCSV.mockResolvedValue({
                tasks: [{ name: 'Task1' }],
                studentsData: [
                    {
                        student: { name: 'S1' },
                        marks: [{ taskIndex: 0, score: 90 }]
                    }
                ]
            });

            // Mock Repositories
            tasksRepository.saveTask.mockResolvedValue({ id: 't1' });
            studentsRepository.saveMember.mockResolvedValue('s1');
            marksRepository.saveMark.mockResolvedValue({ isNew: true });

            // Execute
            const result = await marksService.processFile({}, 'Group1');

            // Verify
            expect(parseMarksCSV).toHaveBeenCalled();
            expect(tasksRepository.saveTask).toHaveBeenCalledWith(expect.objectContaining({ name: 'Task1', groupName: 'Group1' }));
            expect(studentsRepository.saveMember).toHaveBeenCalledWith(expect.objectContaining({ name: 'S1', groupName: 'Group1' }));
            expect(marksRepository.saveMark).toHaveBeenCalledWith(expect.objectContaining({
                taskId: 't1',
                studentId: 's1',
                score: 90
            }));

            expect(result.newMarksCount).toBe(1);
        });
    });

    describe('deleteMarks', () => {
        it('should call repository deleteMarks', async () => {
            await marksService.deleteMarks(['m1', 'm2']);
            expect(marksRepository.deleteMarks).toHaveBeenCalledWith(['m1', 'm2']);
        });
    });
});
