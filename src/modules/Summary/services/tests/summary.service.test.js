import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summaryService } from '../summary.service';
import { studentsRepository } from '../../../Students/services/students.repository';
import { tasksRepository } from '../../../Marks/services/tasks.repository';
import { marksRepository } from '../../../Marks/services/marks.repository';
import { meetsRepository } from '../../../Analytics/services/meets.repository';
import { groupsRepository } from '../../../Groups/services/groups.repository';
import { settingsRepository } from '@/shared/services/settings.repository';
import { finalAssessmentsRepository } from '../finalAssessments.repository';

// Mocks
vi.mock('../../../Students/services/students.repository');
vi.mock('../../../Marks/services/tasks.repository');
vi.mock('../../../Marks/services/marks.repository');
vi.mock('../../../Analytics/services/meets.repository');
vi.mock('../../../Groups/services/groups.repository');
vi.mock('@/shared/services/settings.repository');
vi.mock('../finalAssessments.repository');

describe('SummaryService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockGroup = { name: 'G1', meetId: 'm1' };
    const mockOptions = { t: (key) => key }; // Mock translator

    it('should return empty arrays if no group provided', async () => {
        const result = await summaryService.loadExamData(null, {});
        expect(result).toEqual([]);
    });

    it('should load and process data correctly', async () => {
        // Setup Mocks
        studentsRepository.getMembersByGroup.mockResolvedValue([
            { id: 's1', name: 'Alice', groupName: 'G1' },
            { id: 's2', name: 'Bob', groupName: 'G1' }
        ]);
        tasksRepository.getTasksByGroup.mockResolvedValue([
            { id: 't1', title: 'Task 1', maxPoints: 10 },
            { id: 'test1', title: 'Test 1', maxPoints: 100 }
        ]);
        // allMarks mocking - assume raw structure
        marksRepository.getAllMarksWithRelations.mockResolvedValue([
            { studentId: 's1', taskId: 't1', score: 10 },
            { studentId: 's1', taskId: 'test1', score: 90 },
            { studentId: 's2', taskId: 't1', score: 5 },
            // Bob missing test
        ]);
        meetsRepository.getMeetsByMeetId.mockResolvedValue([
            {
                id: 'meet1',
                participants: [{ name: 'Alice', duration: 3600 }, { name: 'Bob', duration: 1800 }]
            }
        ]);
        groupsRepository.getGroupMap.mockResolvedValue({ 'm1': mockGroup });
        settingsRepository.getDurationLimit.mockResolvedValue(0);
        finalAssessmentsRepository.getAllFinalAssessments.mockResolvedValue([]);

        const modules = [
            {
                name: 'Mod1',
                tasks: [{ id: 't1' }],
                test: { id: 'test1' },
                minTasksRequired: 1,
                tasksCoefficient: 1,
                testCoefficient: 1
            }
        ];

        const { students } = await summaryService.loadExamData(mockGroup, { ...mockOptions, modules });

        expect(students).toHaveLength(2);

        const alice = students.find(s => s.id === 's1');
        const bob = students.find(s => s.id === 's2');

        // Alice: 10/10 task (100%), 90/100 test (90%). Avg = (100+90)/2 = 95.
        // Grade 5 (90+).
        expect(alice.moduleGrades['Mod1']).toBe(5);
        expect(alice.status).toBe('automatic'); // Or allowed? Automatic logic: All modules passed (candidate && grade).
        // She has test mark and enough tasks. And total calculation.

        // Bob: 5/10 task (50%), missing test.
        expect(bob.moduleGrades['Mod1']).toBeUndefined(); // Incomplete
        expect(bob.status).not.toBe('automatic');
    });
});
