import { describe, it, expect, vi, beforeEach } from 'vitest';
import { studentsService } from '../students.service';
import { studentsRepository } from '../students.repository';
import { meetsRepository } from '../../../Analytics/services/meets.repository';
import { groupsRepository } from '../../../Groups/services/groups.repository';
import { tasksRepository } from '../../../Marks/services/tasks.repository';
import { marksRepository } from '../../../Marks/services/marks.repository';
import { settingsRepository } from '@/shared/services/settings.repository';

// Mock all repositories
vi.mock('../students.repository');
vi.mock('../../../Analytics/services/meets.repository');
vi.mock('../../../Groups/services/groups.repository');
vi.mock('../../../Marks/services/tasks.repository');
vi.mock('../../../Marks/services/marks.repository');
vi.mock('@/shared/services/settings.repository');

describe('StudentsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('loadStudentsData', () => {
        it('should load and process data correctly', async () => {
            // Setup Mocks
            studentsRepository.syncParticipants.mockResolvedValue();
            studentsRepository.getAll.mockResolvedValue([
                { id: '1', name: 'Alice', groupName: 'G1', email: 'alice@example.com' },
                { id: '2', name: 'Bob', groupName: 'G1', email: 'bob@example.com' }
            ]);
            meetsRepository.getAll.mockResolvedValue([
                {
                    id: 'm1',
                    meetId: 'm1',
                    participants: [
                        { name: 'Alice', duration: 60 },
                        { name: 'Bob', duration: 30 }
                    ]
                }
            ]);
            groupsRepository.getGroupMap.mockResolvedValue({
                'm1': { name: 'G1' }
            });
            settingsRepository.getTeachers.mockResolvedValue([]);
            settingsRepository.getDurationLimit.mockResolvedValue(0); // No limit
            tasksRepository.getAll.mockResolvedValue([
                { id: 't1', groupName: 'G1', maxPoints: 100 }
            ]);
            marksRepository.getAll.mockResolvedValue([
                { id: 'mk1', studentId: '1', taskId: 't1', score: 90 }
            ]);

            // Execute
            const result = await studentsService.loadStudentsData();

            // Verify
            expect(result.students).toHaveLength(2);

            const alice = result.students.find(s => s.name === 'Alice');
            const bob = result.students.find(s => s.name === 'Bob');

            // Stats Checks
            expect(alice.totalSessions).toBe(1);
            expect(alice.possibleDuration).toBe(60); // Max duration in meet was 60
            expect(alice.attendedDuration).toBe(60);
            expect(alice.attendancePercentages).toEqual([100]); // 60/60

            expect(bob.totalSessions).toBe(1);
            expect(bob.attendedDuration).toBe(30);
            expect(bob.attendancePercentages).toEqual([50]); // 30/60

            // Marks Checks
            expect(alice.averageMark).toBe(5); // 90/100 -> 5
            expect(bob.averageMark).toBe(0);

            // Completion Checks
            expect(alice.totalTasks).toBe(1);
            expect(alice.completedTasks).toBe(1);
            expect(alice.completionPercent).toBe(100);

            expect(bob.totalTasks).toBe(1); // Same group
            expect(bob.completedTasks).toBe(0);
            expect(bob.completionPercent).toBe(0);
        });

        it('should filter out teachers and hidden members', async () => {
            studentsRepository.syncParticipants.mockResolvedValue();
            studentsRepository.getAll.mockResolvedValue([
                { id: '1', name: 'Student1' },
                { id: '2', name: 'Teacher1', role: 'teacher' },
                { id: '3', name: 'Hidden1', hidden: true },
                { id: '4', name: 'Teacher2' } // But listed in settings
            ]);

            settingsRepository.getTeachers.mockResolvedValue(['Teacher2']);
            meetsRepository.getAll.mockResolvedValue([]);
            groupsRepository.getGroupMap.mockResolvedValue({});
            settingsRepository.getDurationLimit.mockResolvedValue(0);
            tasksRepository.getAll.mockResolvedValue([]);
            marksRepository.getAll.mockResolvedValue([]);

            const result = await studentsService.loadStudentsData();

            expect(result.students).toHaveLength(1);
            expect(result.students[0].name).toBe('Student1');
        });
    });

    describe('saveStudent', () => {
        it('should delegate to repository and handle aliases logic', async () => {
            const originalUser = { id: '1', name: 'OldName', aliases: [] };
            const formData = { name: 'NewName', email: 'new@example.com' };

            await studentsService.saveStudent(formData, originalUser);

            expect(studentsRepository.saveMember).toHaveBeenCalledWith({
                id: undefined, // New ID logic if name changes? The original code sets id undefined if name changes.
                name: 'NewName',
                email: 'new@example.com',
                groupName: undefined,
                role: 'student',
                hidden: false,
                aliases: ['OldName']
            });
        });
    });
});
