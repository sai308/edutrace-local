import * as Comlink from 'comlink';
import ParserWorker from '@/workers/parser.worker?worker';
import { v4 as uuidv4 } from 'uuid';
import { marksRepository } from './marks.repository';
import { tasksRepository } from './tasks.repository';
import { groupsRepository } from '../../Groups/services/groups.repository'; // Cross-module dependency
import { studentsRepository } from '../../Students/services/students.repository'; // Cross-module dependency
import { meetsRepository } from '../../Analytics/services/meets.repository'; // Cross-module dependency
import { MarksReconciler } from './reconciliation/MarksReconciler';

export class MarksService {
    constructor() {
        this.marksReconciler = new MarksReconciler();
        this.worker = new ParserWorker();
        this.parser = Comlink.wrap(this.worker);
    }

    async processFile(file, groupName) {
        try {
            // 1. Parse via Worker
            const text = await file.text();
            const parsedData = await this.parser.parseMarksCSV(text, file.name);

            // 2. Reconcile
            const { students, tasks, marks } = await this.marksReconciler.reconcile(parsedData, groupName);

            // 3. Bulk Persist
            // Students
            if (students.length > 0) {
                await studentsRepository.bulkPut(students);
            }

            // Tasks
            if (tasks.length > 0) {
                await tasksRepository.bulkPut(tasks);
            }

            // Marks (Safe Save)
            let stats = { added: 0, updated: 0, skipped: 0 };
            if (marks.length > 0) {
                stats = await marksRepository.bulkSaveSafe(marks);
            }

            // Return stats
            return {
                newMarksCount: stats.added,
                skippedMarksCount: stats.skipped,
                updatedMarksCount: stats.updated
            };
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

    async loadGroups() {
        const groups = await groupsRepository.getAll();
        return groups.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }

    async createGroup(groupData) {
        // Ensure ID exists
        const dataToSave = { ...groupData };
        if (!dataToSave.id) {
            dataToSave.id = uuidv4();
        }

        await groupsRepository.add(dataToSave);
        return dataToSave;
    }

    async loadSuggestions() {
        // Fetch all meets and teachers for suggestions
        const [meets, teachersList] = await Promise.all([
            meetsRepository.getAll(), // TODO: optimize or use lightweight call
            import('@/shared/services/settings.repository').then(m => m.settingsRepository.getTeachers())
        ]);

        // Extract meetIds
        const allMeetIds = meets.map(m => m.meetId).filter(Boolean);
        // Unique meet IDs (though meets repo returns meets objects, meetId is a property)
        // If duplicates exist, Set handles it.
        const uniqueMeets = [...new Set(allMeetIds)];
        const uniqueTeachers = [...new Set(teachersList)];

        return { allMeetIds: uniqueMeets, allTeachers: uniqueTeachers };
    }

    async loadMarksData(groupName = null) {
        if (groupName) {
            return marksRepository.getMarksByGroupWithRelations(groupName);
        } else {
            return [];
        }
    }


    async deleteMarks(ids) {
        await marksRepository.deleteMarks(ids);
    }
}

export const marksService = new MarksService();
