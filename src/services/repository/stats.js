// stats.js
import { getDb } from './db';
import * as workspace from './workspace';
import * as meets from './meets';
import * as marks from './marks';
import * as groups from './groups';
import * as tasks from './tasks';
import * as members from './members';

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
    const db = await getDb();

    // Use parallel count operations for efficiency
    const [meetsCount, groupsCount, tasksCount, marksCount, membersCount] = await Promise.all([
        db.count('meets'),
        db.count('groups'),
        db.count('tasks'),
        db.count('marks'),
        db.count('members')
    ]);

    return {
        reports: meetsCount,
        groups: groupsCount,
        marks: marksCount,
        tasks: tasksCount,
        members: membersCount
    };
}

export async function getEntitySizes() {
    const [allMeets, allGroups, allTasks, allMarks, allMembers] = await Promise.all([
        meets.getAllMeets(),
        groups.getGroups(),
        tasks.getAllTasks(),
        marks.getAllMarks(),
        members.getAllMembers()
    ]);

    return {
        reports: getSize(allMeets),
        groups: getSize(allGroups),
        marks: getSize(allMarks), // marks are stored independently
        tasks: getSize(allTasks),
        members: getSize(allMembers)
    };
}

export async function getAllWorkspacesSizes() {
    // Delegates entirely to workspace.js
    return workspace.getAllWorkspacesSizes();
}