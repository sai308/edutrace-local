import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('GroupsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('loadGroupsData', () => {
        it('should load and aggregate data correctly', async () => {
            // Setup Mocks
            const mockGroups = [
                { id: 'g1', name: 'Group1', meetId: 'm1' },
                { id: 'g2', name: 'Group2', meetId: 'm2' }
            ];

            const mockMembers = [
                { id: 's1', name: 'Alice', groupName: 'Group1' },
                { id: 's2', name: 'Bob', groupName: 'Group1' },
                { id: 's3', name: 'Charlie', groupName: 'Group2' },
                { id: 't1', name: 'Teacher1', role: 'teacher' }
            ];

            const mockMeets = [
                { meetId: 'm1', participants: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Teacher1' }] }
            ];

            const mockTasks = [
                { id: 't1', groupName: 'Group1', maxPoints: 100 },
                { id: 't2', groupName: 'Group1', maxPoints: 100 }
            ];

            const mockMarks = [
                { studentId: 's1', taskId: 't1', score: 90 }, // 5
                { studentId: 's1', taskId: 't2', score: 90 }, // 5
                { studentId: 's2', taskId: 't1', score: 50 }, // 2 (below 60)
            ];

            groupsRepository.getGroups.mockResolvedValue(mockGroups);
            meetsRepository.getAll.mockResolvedValue(mockMeets);
            studentsRepository.getAllMembers.mockResolvedValue(mockMembers);
            settingsRepository.getTeachers.mockResolvedValue(['Teacher1']);
            tasksRepository.getAll.mockResolvedValue(mockTasks);
            marksRepository.getAll.mockResolvedValue(mockMarks);

            // Execute
            const result = await groupsService.loadGroupsData();

            // Verify
            expect(result.groups).toHaveLength(2);
            expect(result.allTeachers).toContain('Teacher1');
            expect(result.allMeetIds).toContain('m1');

            // Verify Member Counts
            expect(result.memberCounts['Group1']).toBe(2); // Alice, Bob
            expect(result.memberCounts['Group2']).toBe(1); // Charlie

            // Verify Stats for Group1
            const g1 = result.groups.find(g => g.name === 'Group1');

            // Completion
            // Alice: 2/2 tasks = 100%
            // Bob: 1/2 tasks = 50%
            // Avg = 75%
            expect(g1.avgTaskCompletion).toBe(75);

            // Marks
            // Alice: 90 (5), 90 (5) -> Avg 5
            // Bob: 50 (2) -> Avg 2
            // Group Marks: [5, 5, 2]
            // Avg: (5+5+2)/3 = 4
            expect(g1.avgMark).toBe(4);

            // Mode: 5 (appears twice)
            expect(g1.modeMark).toBe(5);

            // Median: 2, 5, 5 -> 5
            expect(g1.medianMark).toBe(5);
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
