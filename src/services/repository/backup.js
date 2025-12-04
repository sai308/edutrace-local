// backup.js
import { getDb } from './db';
import * as settings from './settings';
import * as meets from './meets';
import * as groups from './groups';
import * as tasks from './tasks';
import * as marks from './marks';
import * as members from './members';
import * as finalAssessments from './finalAssessments';
import * as modules from './modules';

// --- Clear Methods ---

export async function clearReports() {
    const db = await getDb();
    await db.clear('meets');
}

export async function clearGroups() {
    const db = await getDb();
    await db.clear('groups');
}

export async function clearMarks() {
    const db = await getDb();
    // Marks are coupled with tasks, clear both
    await db.clear('tasks');
    await db.clear('marks');
}

export async function clearMembers() {
    const db = await getDb();
    await db.clear('members');
}

export async function clearFinalAssessments() {
    const db = await getDb();
    await db.clear('finalAssessments');
}

export async function clearModules() {
    const db = await getDb();
    await db.clear('modules');
}

export async function clearAll() {
    await clearReports();
    await clearGroups();
    await clearMarks();
    await clearMembers();
    await clearFinalAssessments();
    await clearModules();
    settings.clearSettings(); // Clears localStorage settings for current workspace
}

// --- Full Export/Import ---

// Full backup format: version 4
export async function exportData() {
    const [allMeets, allGroups, ignoredUsers, durationLimit, defaultTeacher, allTeachers, allTasks, allMarks, allMembers, allFinalAssessments, allModules, examSettings] = await Promise.all([
        meets.getAllMeets(),
        groups.getGroups(),
        settings.getIgnoredUsers(),
        settings.getDurationLimit(),
        settings.getDefaultTeacher(),
        settings.getTeachers(),
        tasks.getAllTasks(),
        marks.getAllMarks(),
        members.getAllMembers(),
        finalAssessments.getAllFinalAssessments(),
        modules.getAllModules(),
        settings.getExamSettings()
    ]);

    return {
        meets: allMeets,
        groups: allGroups,
        tasks: allTasks,
        marks: allMarks,
        members: allMembers,
        finalAssessments: allFinalAssessments,
        modules: allModules,
        settings: {
            ignoredUsers,
            durationLimit,
            defaultTeacher,
            teachers: allTeachers,
            examSettings
        },
        version: 4, // Current version
        timestamp: new Date().toISOString()
    };
}

export async function importData(jsonData) {
    if (!jsonData || !jsonData.meets || !jsonData.groups) {
        throw new Error('Invalid data format: Missing meets or groups data');
    }

    await clearAll();

    const db = await getDb();
    const taskIdMapping = new Map(); // Maps old task IDs to new task IDs

    // 1. Restore Meets
    if (jsonData.meets.length > 0) {
        const txMeets = db.transaction('meets', 'readwrite');
        const storeMeets = txMeets.objectStore('meets');
        await Promise.all(jsonData.meets.map(meet => storeMeets.put(meet)));
        await txMeets.done;
    }

    // 2. Restore Groups
    if (jsonData.groups.length > 0) {
        const txGroups = db.transaction('groups', 'readwrite');
        const storeGroups = txGroups.objectStore('groups');
        await Promise.all(jsonData.groups.map(group => storeGroups.put(enrichGroupWithCourse(group))));
        await txGroups.done;
    }

    // 3. Restore Settings (Stored in localStorage, scoped by workspace)
    if (jsonData.settings) {
        const { durationLimit, defaultTeacher, ignoredUsers, teachers, examSettings } = jsonData.settings;
        if (durationLimit !== undefined) {
            await settings.saveDurationLimit(durationLimit);
        }
        if (Object.prototype.hasOwnProperty.call(jsonData.settings, 'defaultTeacher')) {
            await settings.saveDefaultTeacher(defaultTeacher || null);
        }
        if (Object.prototype.hasOwnProperty.call(jsonData.settings, 'ignoredUsers')) {
            await settings.saveIgnoredUsers(Array.isArray(ignoredUsers) ? ignoredUsers : []);
        }
        if (Object.prototype.hasOwnProperty.call(jsonData.settings, 'teachers')) {
            await settings.saveTeachers(Array.isArray(teachers) ? teachers : []);
        }
        // Restore exam settings (version 4+)
        if (Object.prototype.hasOwnProperty.call(jsonData.settings, 'examSettings')) {
            await settings.saveExamSettings(examSettings || {});
        }
    }

    // 4. Restore Tasks with Upsert/Mapping Logic
    if (jsonData.tasks && jsonData.tasks.length > 0) {
        const txTasks = db.transaction('tasks', 'readwrite');
        const storeTasks = txTasks.objectStore('tasks');

        for (const task of jsonData.tasks) {
            const oldId = task.id;

            // Find existing task by natural key (name + date + groupName)
            const index = storeTasks.index('name_date_group');
            const existing = await index.get([task.name, task.date, task.groupName]);

            if (existing) {
                // Task exists - preserve its ID and update other fields
                await storeTasks.put({ ...task, id: existing.id });
                taskIdMapping.set(oldId, existing.id);
            } else {
                // New task - remove ID to let auto-increment assign one
                const { id, ...taskWithoutId } = task;
                const newId = await storeTasks.add(taskWithoutId);
                taskIdMapping.set(oldId, newId);
            }
        }
        await txTasks.done;
    }

    // 5. Restore Members
    if (jsonData.members && jsonData.members.length > 0) {
        const txMembers = db.transaction('members', 'readwrite');
        const storeMembers = txMembers.objectStore('members');
        await Promise.all(jsonData.members.map(member => storeMembers.put(member)));
        await txMembers.done;
    }

    // 6. Restore Marks with Updated Task IDs
    if (jsonData.marks && jsonData.marks.length > 0) {
        const txMarks = db.transaction('marks', 'readwrite');
        const storeMarks = txMarks.objectStore('marks');

        await Promise.all(jsonData.marks.map(mark => {
            // Update taskId to the new ID if mapping exists
            const newTaskId = taskIdMapping.get(mark.taskId) || mark.taskId;
            return storeMarks.put({ ...mark, taskId: newTaskId });
        }));

        await txMarks.done;
    }

    // 7. Restore Final Assessments (version 4+)
    if (jsonData.finalAssessments && jsonData.finalAssessments.length > 0) {
        const txFinalAssessments = db.transaction('finalAssessments', 'readwrite');
        const storeFinalAssessments = txFinalAssessments.objectStore('finalAssessments');
        await Promise.all(jsonData.finalAssessments.map(item => storeFinalAssessments.put(item)));
        await txFinalAssessments.done;
    }

    // 8. Restore Modules (version 4+)
    if (jsonData.modules && jsonData.modules.length > 0) {
        const txModules = db.transaction('modules', 'readwrite');
        const storeModules = txModules.objectStore('modules');
        await Promise.all(jsonData.modules.map(item => storeModules.put(item)));
        await txModules.done;
    }
}

// --- Granular Export Methods ---
export async function exportReports() {
    const allMeets = await meets.getAllMeets();
    return { meets: allMeets, version: 1, type: 'reports', timestamp: new Date().toISOString() };
}

export async function exportGroups() {
    const allGroups = await groups.getGroups();
    return { groups: allGroups, version: 1, type: 'groups', timestamp: new Date().toISOString() };
}

// Marks backup format (version 2): tasks, marks, members
export async function exportMarks() {
    const [allTasks, allMarks, allMembers] = await Promise.all([
        tasks.getAllTasks(),
        marks.getAllMarks(),
        members.getAllMembers()
    ]);
    return {
        tasks: allTasks,
        marks: allMarks,
        members: allMembers,
        version: 2,
        type: 'marks',
        timestamp: new Date().toISOString()
    };
}

// --- Granular Import Methods ---
export async function importReports(jsonData) {
    if (!jsonData || !jsonData.meets) {
        throw new Error('Invalid reports data format');
    }

    await clearReports();
    const db = await getDb();

    if (jsonData.meets.length > 0) {
        const tx = db.transaction('meets', 'readwrite');
        const store = tx.objectStore('meets');
        await Promise.all(jsonData.meets.map(meet => store.put(meet)));
        await tx.done;
    }
}

export async function importGroups(jsonData) {
    if (!jsonData || !jsonData.groups) {
        throw new Error('Invalid groups data format');
    }

    await clearGroups();
    const db = await getDb();

    if (jsonData.groups.length > 0) {
        const tx = db.transaction('groups', 'readwrite');
        const store = tx.objectStore('groups');
        await Promise.all(jsonData.groups.map(group => store.put(enrichGroupWithCourse(group))));
        await tx.done;
    }
}

// --- Helpers ---

function enrichGroupWithCourse(group) {
    if (!group.course && group.name) {
        const match = group.name.match(/\d/);
        if (match) {
            const course = parseInt(match[0], 10);
            if (course >= 1 && course <= 4) {
                return { ...group, course };
            }
        }
    }
    return group;
}

export async function importMarks(jsonData) {
    if (!jsonData) {
        throw new Error('Invalid marks data format');
    }

    await clearMarks();
    const db = await getDb();

    const tasksData = jsonData.tasks || [];
    const marksData = jsonData.marks || [];
    const membersData = jsonData.members || [];
    const taskIdMapping = new Map(); // Maps old task IDs to new task IDs

    // 1. Import tasks with upsert logic
    if (tasksData.length > 0) {
        const tx = db.transaction('tasks', 'readwrite');
        const store = tx.objectStore('tasks');

        for (const task of tasksData) {
            const oldId = task.id;

            // Find existing task by natural key (name + date + groupName)
            const index = store.index('name_date_group');
            const existing = await index.get([task.name, task.date, task.groupName]);

            if (existing) {
                // Task exists - preserve its ID and update other fields
                await store.put({ ...task, id: existing.id });
                taskIdMapping.set(oldId, existing.id);
            } else {
                // New task - remove ID to let auto-increment assign one
                const { id, ...taskWithoutId } = task;
                const newId = await store.add(taskWithoutId);
                taskIdMapping.set(oldId, newId);
            }
        }
        await tx.done;
    }

    // 2. Import members (Note: Roles are defaulted if missing)
    if (membersData.length > 0) {
        const tx = db.transaction('members', 'readwrite');
        const store = tx.objectStore('members');
        await Promise.all(membersData.map(member => store.put({ ...member, role: member.role || 'student' })));
        await tx.done;
    }

    // 3. Import marks with updated task IDs
    if (marksData.length > 0) {
        const tx = db.transaction('marks', 'readwrite');
        const store = tx.objectStore('marks');

        await Promise.all(marksData.map(mark => {
            // Update taskId to the new ID if mapping exists
            const newTaskId = taskIdMapping.get(mark.taskId) || mark.taskId;
            return store.put({ ...mark, taskId: newTaskId });
        }));

        await tx.done;
    }
}
// Summary backup format (version 1): finalAssessments, modules, examSettings
export async function exportSummary() {
    const [allFinalAssessments, allModules, examSettings] = await Promise.all([
        finalAssessments.getAllFinalAssessments(),
        modules.getAllModules(),
        settings.getExamSettings()
    ]);
    return {
        finalAssessments: allFinalAssessments,
        modules: allModules,
        settings: {
            examSettings
        },
        version: 1,
        type: 'summary',
        timestamp: new Date().toISOString()
    };
}

export async function importSummary(jsonData) {
    if (!jsonData) {
        throw new Error('Invalid summary data format');
    }

    const db = await getDb();

    // 1. Create ONE transaction for all stores involved in the import
    // This locks 'finalAssessments' and 'modules' for the duration of the entire import
    const tx = db.transaction(['finalAssessments', 'modules'], 'readwrite');

    const finalAssessmentsStore = tx.objectStore('finalAssessments');
    const modulesStore = tx.objectStore('modules');

    // 2. Clear existing data within the SAME transaction
    // (We inline the clear logic here to ensure atomicity)
    await Promise.all([
        finalAssessmentsStore.clear(),
        modulesStore.clear()
    ]);

    const finalAssessmentsData = jsonData.finalAssessments || [];
    const modulesData = jsonData.modules || [];

    // 3. Import new data
    // We map the operations to an array of promises
    const operations = [];

    if (finalAssessmentsData.length > 0) {
        finalAssessmentsData.forEach(item => {
            operations.push(finalAssessmentsStore.put(item));
        });
    }

    if (modulesData.length > 0) {
        modulesData.forEach(item => {
            operations.push(modulesStore.put(item));
        });
    }

    // 4. Await all operations, then await the transaction commit
    await Promise.all(operations);
    await tx.done;

    // 5. Import Exam Settings (This usually goes to LocalStorage or a separate store, so it stays outside)
    if (jsonData.settings && jsonData.settings.examSettings) {
        await settings.saveExamSettings(jsonData.settings.examSettings);
    }
}