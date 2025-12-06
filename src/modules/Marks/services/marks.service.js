import { marksRepository } from './marks.repository';
import { tasksRepository } from './tasks.repository';
import { groupsRepository } from '../../Groups/services/groups.repository'; // Cross-module dependency
import { studentsRepository } from '../../Students/services/students.repository'; // Cross-module dependency
import { meetsRepository } from '../../Analytics/services/meets.repository'; // Cross-module dependency
import { parseMarksCSV } from './marksParser';

export class MarksService {
    async loadGroups() {
        const allGroups = await groupsRepository.getGroups();
        return allGroups.sort((a, b) => a.name.localeCompare(b.name));
    }

    async loadSuggestions() {
        const meets = await meetsRepository.getAll();
        const meetIds = new Set();
        const teachers = new Set();

        meets.forEach(meet => {
            if (meet.meetId) meetIds.add(meet.meetId);
            if (meet.participants) {
                meet.participants.forEach(p => teachers.add(p.name));
            }
        });

        return {
            allMeetIds: Array.from(meetIds).sort(),
            allTeachers: Array.from(teachers).sort()
        };
    }

    async loadAllData() {
        const groups = await this.loadGroups();
        // Use the new batch query method - single efficient database call
        // Note: marksRepository.getAllMarksWithRelations needs to be verified or implemented if it was on the generic repo previously
        // Looking at Phase 1 edits, `getAllMarksWithRelations` seems to be a specific method likely on marksRepository or originally on DatabaseService/BaseRepo?
        // Checking useMarks.js: await repository.getAllMarksWithRelations()
        // We need to ensure marksRepository has this.
        const flatMarks = await marksRepository.getAllMarksWithRelations();
        return { groups, flatMarks };
    }

    async createGroup(groupData) {
        const { _pendingFile, ...rest } = groupData;
        const newGroup = {
            id: crypto.randomUUID(),
            ...rest
        };

        try {
            await groupsRepository.saveGroup(newGroup);

            if (_pendingFile) {
                await this.processFile(_pendingFile, newGroup.name);
            }

            return newGroup;
        } catch (e) {
            console.error('Error creating group:', e);
            throw e;
        }
    }

    async processFile(file, groupName) {
        try {
            const result = await parseMarksCSV(file);

            const taskIds = [];
            for (const task of result.tasks) {
                task.groupName = groupName;
                const { id } = await tasksRepository.saveTask(task);
                taskIds.push(id);
            }

            let newMarksCount = 0;
            let skippedMarksCount = 0;

            for (const item of result.studentsData) {
                item.student.groupName = groupName;
                // Ensure role is set if not present (though saveMember handles it)
                const studentId = await studentsRepository.saveMember(item.student);

                for (const mark of item.marks) {
                    const taskId = taskIds[mark.taskIndex];
                    // mark.score is parsed, ensure it's correct type
                    const { isNew } = await marksRepository.saveMark({
                        taskId,
                        studentId,
                        score: mark.score,
                        synced: mark.synced
                    });

                    if (isNew) {
                        newMarksCount++;
                    } else {
                        skippedMarksCount++;
                    }
                }
            }

            return { newMarksCount, skippedMarksCount };
        } catch (e) {
            console.error('Error processing marks:', e);
            throw e;
        }
    }

    async toggleSynced(mark) {
        if (!mark) return;
        const newSynced = !mark.synced;
        await marksRepository.updateMarkSynced(mark.id, newSynced);
        return newSynced;
    }

    async deleteMark(id) {
        await marksRepository.deleteMark(id);
    }

    async deleteMarks(ids) {
        await marksRepository.deleteMarks(ids);
    }
}

export const marksService = new MarksService();
