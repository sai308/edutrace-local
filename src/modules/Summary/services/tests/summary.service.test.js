import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Worker globally for JSDOM
if (typeof Worker === 'undefined') {
    global.Worker = class {
        constructor() { }
        postMessage() { }
        onmessage() { }
        terminate() { }
    };
}

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

const { mockCalculateSummary } = vi.hoisted(() => ({
    mockCalculateSummary: vi.fn()
}));

vi.mock('comlink', () => ({
    wrap: vi.fn().mockReturnValue({
        calculateSummary: mockCalculateSummary
    }),
    expose: vi.fn()
}));

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

    it('should load data and delegate processing to worker', async () => {
        // Setup Mocks
        const mockStudents = [{ id: 's1', name: 'Alice', role: 'student' }];
        const mockTasks = [{ id: 't1' }];
        const mockMarks = [{ score: 10 }];
        const mockMeets = [{ id: 'meet1' }];
        const mockGroupsMap = { 'm1': mockGroup };
        const mockDurationLimit = 60;
        const mockAssessments = [];

        const modules = [{ name: 'Mod1' }];

        studentsRepository.getMembersByGroup.mockResolvedValue(mockStudents);
        tasksRepository.getTasksByGroup.mockResolvedValue(mockTasks);
        marksRepository.getMarksByGroup.mockResolvedValue(mockMarks);
        meetsRepository.getMeetsByMeetId.mockResolvedValue(mockMeets);
        groupsRepository.getGroupMap.mockResolvedValue(mockGroupsMap);
        settingsRepository.getDurationLimit.mockResolvedValue(mockDurationLimit);
        finalAssessmentsRepository.getAllFinalAssessments.mockResolvedValue(mockAssessments);

        // Reset and configure the mock for this specific test
        mockCalculateSummary.mockClear();
        mockCalculateSummary.mockResolvedValueOnce([
            {
                id: 's1',
                stats: {
                    completionExact: 100,
                    completedRegularTasks: 1,
                    effectiveTotal: 1,
                    attendance: { percentage: 100, attendedMeets: 1, totalMeets: 1, attendedDuration: 3600 },
                    modules: { moduleGrades: { 'Mod1': 5 }, total: 5, moduleDetailsData: {}, isAutomaticCandidate: true },
                    averageMark: 5
                }
            }
        ]);

        const { students } = await summaryService.loadExamData(mockGroup, { ...mockOptions, modules });

        // Verify Delegation
        expect(mockCalculateSummary).toHaveBeenCalled();

        expect(students).toHaveLength(1);
        const alice = students[0];
        expect(alice.moduleGrades['Mod1']).toBe(5);
        expect(alice.status).toBe('automatic');
    });
});
