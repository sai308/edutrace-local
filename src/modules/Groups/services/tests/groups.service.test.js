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

import { groupsService } from '../groups.service';
import { groupsRepository } from '../groups.repository';
import { meetsRepository } from '../../../Analytics/services/meets.repository';
import { studentsRepository } from '../../../Students/services/students.repository';
import { tasksRepository } from '../../../Marks/services/tasks.repository';
import { marksRepository } from '../../../Marks/services/marks.repository';
import { settingsRepository } from '@/shared/services/settings.repository';

// Mock repositories
vi.mock('../groups.repository');
vi.mock('../../../Analytics/services/meets.repository');
vi.mock('../../../Students/services/students.repository');
vi.mock('../../../Marks/services/tasks.repository');
vi.mock('../../../Marks/services/marks.repository');
vi.mock('@/shared/services/settings.repository');

const { mockProcessGroupsData } = vi.hoisted(() => ({
    mockProcessGroupsData: vi.fn()
}));

vi.mock('comlink', () => ({
    wrap: vi.fn().mockReturnValue({
        processGroupsData: mockProcessGroupsData
    }),
    expose: vi.fn()
}));

describe('GroupsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('loadGroupsData', () => {
        it('should fetch data and delegate processing to worker', async () => {
            // Setup Mocks for Repositories
            const mockGroups = [{ id: 'g1', name: 'Group1' }];
            const mockMeets = [{ meetId: 'm1' }];
            const mockMembers = [{ name: 'Alice' }];
            const mockTeacherList = ['Teacher1'];
            const mockTasks = [{ id: 't1' }];
            const mockMarks = [{ score: 90 }];

            groupsRepository.getGroups.mockResolvedValue(mockGroups);
            meetsRepository.getAll.mockResolvedValue(mockMeets);
            studentsRepository.getAllMembers.mockResolvedValue(mockMembers);
            settingsRepository.getTeachers.mockResolvedValue(mockTeacherList);
            tasksRepository.getAll.mockResolvedValue(mockTasks);
            marksRepository.getAll.mockResolvedValue(mockMarks);

            // Mock Worker Response
            const mockWorkerResult = {
                groups: [{ name: 'Group1', avgMark: 5 }],
                memberCounts: { 'Group1': 1 },
                allMeetIds: ['m1'],
                allTeachers: ['Teacher1'],
                teacherSet: new Set(['Teacher1'])
            };
            mockProcessGroupsData.mockResolvedValue(mockWorkerResult);

            // Execute
            const result = await groupsService.loadGroupsData();

            // Verify Repository Calls
            expect(groupsRepository.getGroups).toHaveBeenCalled();
            expect(meetsRepository.getAll).toHaveBeenCalled();

            // Verify Worker Call
            expect(mockProcessGroupsData).toHaveBeenCalledWith(
                mockGroups,
                mockMeets,
                mockMembers,
                mockTeacherList,
                mockTasks,
                mockMarks
            );

            // Verify Result passed through
            expect(result).toEqual(mockWorkerResult);
        });
    });

    describe('saveGroup', () => {
        it('should validate and save', async () => {
            await groupsService.saveGroup({ meetId: 'm_new', name: 'New Group' });
            expect(groupsRepository.saveGroup).toHaveBeenCalledWith(expect.objectContaining({
                name: 'New Group',
                meetId: 'm_new'
            }));
        });

        it('should throw on validation error', async () => {
            await expect(groupsService.saveGroup({ name: 'NoMeetId' }))
                .rejects.toThrow('Name and Meet ID are required');
        });
    });
});
