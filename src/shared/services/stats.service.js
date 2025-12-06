import { databaseService } from './DatabaseService';
import { workspaceRepository } from './workspace.repository';
import { meetsRepository } from '@/modules/Analytics/services/meets.repository';
import { groupsRepository } from '@/modules/Groups/services/groups.repository';
import { tasksRepository } from '@/modules/Marks/services/tasks.repository';
import { marksRepository } from '@/modules/Marks/services/marks.repository';
import { studentsRepository } from '@/modules/Students/services/students.repository';
import { finalAssessmentsRepository } from '@/modules/Summary/services/finalAssessments.repository';
import { modulesRepository } from '@/modules/Summary/services/modules.repository';

/**
 * Estimates the size of data using JSON.stringify (in bytes).
 * @param {any} data
 * @returns {number}
 */
const getSize = (data) => {
    try {
        // Use Blob to accurately count UTF-8 bytes, avoiding JS string length issues
        return new Blob([JSON.stringify(data)]).size;
    } catch (e) {
        console.error('Error calculating size for data:', e);
        return 0;
    }
};

export async function getEntityCounts() {
    const db = await databaseService.getDb();

    // Check which stores exist (for backward compatibility with older DB versions)
    const storeNames = Array.from(db.objectStoreNames);

    // Use parallel count operations
    // Note: IDB count() is standard on the store or index. db.count is likely from IDB-Keyval or simplified wrapper?
    // 'idb' library's DB object doesn't have .count() on valid stores directly?
    // Actually typically: db.count(storeName) works in 'idb' library if using 'idb' wrapper properly.
    // Let's verify 'idb' usage. `db.count('storeName')` is valid in `idb` package.

    const counts = await Promise.all([
        db.count('meets'),
        db.count('groups'),
        db.count('tasks'),
        db.count('marks'),
        db.count('members'),
        storeNames.includes('finalAssessments') ? db.count('finalAssessments') : Promise.resolve(0),
        storeNames.includes('modules') ? db.count('modules') : Promise.resolve(0)
    ]);

    return {
        reports: counts[0],
        groups: counts[1],
        marks: counts[3],
        tasks: counts[2],
        members: counts[4],
        finalAssessments: counts[5],
        modules: counts[6]
    };
}

export async function getEntitySizes() {
    const [allMeets, allGroups, allTasks, allMarks, allMembers, allFinalAssessments, allModules] = await Promise.all([
        meetsRepository.getAllMeets(),
        groupsRepository.getGroups(),
        tasksRepository.getAllTasks(),
        marksRepository.getAllMarks(),
        studentsRepository.getAllMembers(),
        finalAssessmentsRepository.getAllFinalAssessments(),
        modulesRepository.getAllModules()
    ]);

    return {
        reports: getSize(allMeets),
        groups: getSize(allGroups),
        marks: getSize(allMarks),
        tasks: getSize(allTasks),
        members: getSize(allMembers),
        summary: getSize(allFinalAssessments) + getSize(allModules)
    };
}

export async function getAllWorkspacesSizes() {
    return workspaceRepository.getAllWorkspacesSizes();
}
