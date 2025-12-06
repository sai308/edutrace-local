import { databaseService } from './DatabaseService';
import { settingsRepository } from './settings.repository';
import { meetsRepository } from '@/modules/Analytics/services/meets.repository';
import { groupsRepository } from '@/modules/Groups/services/groups.repository';
import { tasksRepository } from '@/modules/Marks/services/tasks.repository';
import { marksRepository } from '@/modules/Marks/services/marks.repository';
import { studentsRepository } from '@/modules/Students/services/students.repository';
import { finalAssessmentsRepository } from '@/modules/Summary/services/finalAssessments.repository';
import { modulesRepository } from '@/modules/Summary/services/modules.repository';

// --- Clear Methods ---

export async function clearReports() {
    const db = await databaseService.getDb();
    await db.clear('meets');
}

export async function clearGroups() {
    const db = await databaseService.getDb();
    await db.clear('groups');
}

export async function clearMarks() {
    const db = await databaseService.getDb();
    await db.clear('tasks');
    await db.clear('marks');
}

export async function clearMembers() {
    const db = await databaseService.getDb();
    await db.clear('members');
}

export async function clearFinalAssessments() {
    const db = await databaseService.getDb();
    await db.clear('finalAssessments');
}

export async function clearModules() {
    const db = await databaseService.getDb();
    await db.clear('modules');
}

export async function clearAll() {
    await clearReports();
    await clearGroups();
    await clearMarks();
    await clearMembers();
    await clearFinalAssessments();
    await clearModules();
    settingsRepository.clearSettings();
}

// --- Full Export/Import ---

export async function exportData() {
    const [allMeets, allGroups, ignoredUsers, durationLimit, defaultTeacher, allTeachers, allTasks, allMarks, allMembers, allFinalAssessments, allModules, examSettings] = await Promise.all([
        meetsRepository.getAllMeets(),
        groupsRepository.getGroups(),
        settingsRepository.getIgnoredUsers(),
        settingsRepository.getDurationLimit(),
        settingsRepository.getDefaultTeacher(),
        settingsRepository.getTeachers(),
        tasksRepository.getAllTasks(),
        marksRepository.getAllMarks(),
        studentsRepository.getAllMembers(),
        finalAssessmentsRepository.getAllFinalAssessments(),
        modulesRepository.getAllModules(),
        settingsRepository.getExamSettings()
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
        version: 4,
        timestamp: new Date().toISOString()
    };
}

export async function importData(jsonData) {
    if (!jsonData || !jsonData.meets || !jsonData.groups) {
        throw new Error('Invalid data format: Missing meets or groups data');
    }

    await clearAll();

    const db = await databaseService.getDb();
    const taskIdMapping = new Map();

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

    // 3. Restore Settings
    if (jsonData.settings) {
        const { durationLimit, defaultTeacher, ignoredUsers, teachers, examSettings } = jsonData.settings;
        if (durationLimit !== undefined) {
            await settingsRepository.saveDurationLimit(durationLimit);
        }
        if (Object.prototype.hasOwnProperty.call(jsonData.settings, 'defaultTeacher')) {
            await settingsRepository.saveDefaultTeacher(defaultTeacher || null);
        }
        if (Object.prototype.hasOwnProperty.call(jsonData.settings, 'ignoredUsers')) {
            await settingsRepository.saveIgnoredUsers(Array.isArray(ignoredUsers) ? ignoredUsers : []);
        }
        if (Object.prototype.hasOwnProperty.call(jsonData.settings, 'teachers')) {
            await settingsRepository.saveTeachers(Array.isArray(teachers) ? teachers : []);
        }
        if (Object.prototype.hasOwnProperty.call(jsonData.settings, 'examSettings')) {
            await settingsRepository.saveExamSettings(examSettings || {});
        }
    }

    // 4. Restore Tasks
    if (jsonData.tasks && jsonData.tasks.length > 0) {
        const txTasks = db.transaction('tasks', 'readwrite');
        const storeTasks = txTasks.objectStore('tasks');

        for (const task of jsonData.tasks) {
            const oldId = task.id;
            const index = storeTasks.index('name_date_group');
            const existing = await index.get([task.name, task.date, task.groupName]);

            if (existing) {
                await storeTasks.put({ ...task, id: existing.id });
                taskIdMapping.set(oldId, existing.id);
            } else {
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

    // 6. Restore Marks
    if (jsonData.marks && jsonData.marks.length > 0) {
        const txMarks = db.transaction('marks', 'readwrite');
        const storeMarks = txMarks.objectStore('marks');

        await Promise.all(jsonData.marks.map(mark => {
            const newTaskId = taskIdMapping.get(mark.taskId) || mark.taskId;
            return storeMarks.put({ ...mark, taskId: newTaskId });
        }));

        await txMarks.done;
    }

    // 7. Restore Final Assessments
    if (jsonData.finalAssessments && jsonData.finalAssessments.length > 0) {
        const txFinalAssessments = db.transaction('finalAssessments', 'readwrite');
        const storeFinalAssessments = txFinalAssessments.objectStore('finalAssessments');
        await Promise.all(jsonData.finalAssessments.map(item => storeFinalAssessments.put(item)));
        await txFinalAssessments.done;
    }

    // 8. Restore Modules
    if (jsonData.modules && jsonData.modules.length > 0) {
        const txModules = db.transaction('modules', 'readwrite');
        const storeModules = txModules.objectStore('modules');
        await Promise.all(jsonData.modules.map(item => storeModules.put(item)));
        await txModules.done;
    }
}

// --- Helper ---
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

// ... Additional exports (exportReports, importReports etc.) should be similarly adapted if needed.
// For brevity I'll export granular ones using the repos directly where possible or implementing similar logic.

export async function exportReports() {
    const allMeets = await meetsRepository.getAllMeets();
    return { meets: allMeets, version: 1, type: 'reports', timestamp: new Date().toISOString() };
}

export async function exportGroups() {
    const allGroups = await groupsRepository.getGroups();
    return { groups: allGroups, version: 1, type: 'groups', timestamp: new Date().toISOString() };
}

export async function exportMarks() {
    const [allTasks, allMarks, allMembers] = await Promise.all([
        tasksRepository.getAllTasks(),
        marksRepository.getAllMarks(),
        studentsRepository.getAllMembers()
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
// etc... for importReports, importGroups, importMarks, exportSummary, importSummary.
export async function exportSummary() {
    const [finalAssessments, modules, examSettings] = await Promise.all([
        finalAssessmentsRepository.getAllFinalAssessments(),
        modulesRepository.getAllModules(),
        settingsRepository.getExamSettings()
    ]);
    return {
        finalAssessments,
        modules,
        settings: { examSettings },
        version: 1,
        type: 'summary',
        timestamp: new Date().toISOString()
    };
}

export async function importSummary(jsonData) {
    if (!jsonData) {
        throw new Error('Invalid summary data format');
    }

    const db = await databaseService.getDb();
    const tx = db.transaction(['finalAssessments', 'modules'], 'readwrite');

    const finalAssessmentsStore = tx.objectStore('finalAssessments');
    const modulesStore = tx.objectStore('modules');

    await Promise.all([
        finalAssessmentsStore.clear(),
        modulesStore.clear()
    ]);

    const finalAssessmentsData = jsonData.finalAssessments || [];
    const modulesData = jsonData.modules || [];

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

    await Promise.all(operations);
    await tx.done;

    if (jsonData.settings && jsonData.settings.examSettings) {
        await settingsRepository.saveExamSettings(jsonData.settings.examSettings);
    }
}

export async function importReports(jsonData) {
    if (!jsonData || !jsonData.meets) throw new Error('Invalid reports data');
    const db = await databaseService.getDb();
    const tx = db.transaction('meets', 'readwrite');
    const store = tx.objectStore('meets');
    await store.clear();
    await Promise.all(jsonData.meets.map(meet => store.put(meet)));
    await tx.done;
}

export async function importGroups(jsonData) {
    if (!jsonData || !jsonData.groups) throw new Error('Invalid groups data');
    const db = await databaseService.getDb();
    const tx = db.transaction('groups', 'readwrite');
    const store = tx.objectStore('groups');
    await store.clear();
    await Promise.all(jsonData.groups.map(group => store.put(enrichGroupWithCourse(group))));
    await tx.done;
}

export async function importMarks(jsonData) {
    if (!jsonData || !jsonData.marks) throw new Error('Invalid marks data');
    await clearMarks();
    await clearMembers();

    // We reuse full import logic for marks as it handles task IDs and members efficiently enough, 
    // or we can implement specific logic. For now, reusing generic approach parts:

    // Actually, granular import might assume partial data or replacement. 
    // Let's implement full clear & replace for simplicity as per other modules.
    const db = await databaseService.getDb();

    // Restore Members
    if (jsonData.members && jsonData.members.length > 0) {
        const txMembers = db.transaction('members', 'readwrite');
        const storeMembers = txMembers.objectStore('members');
        await Promise.all(jsonData.members.map(member => storeMembers.put(member)));
        await txMembers.done;
    }

    // Restore Tasks & Marks
    if (jsonData.tasks && jsonData.tasks.length > 0) {
        const txTasks = db.transaction('tasks', 'readwrite');
        const storeTasks = txTasks.objectStore('tasks');
        // We might need to handle ID mapping if we don't clear tasks, but importMarks calls clearMarks() above.
        // So we can blindly add.
        const taskIdMapping = new Map();

        for (const task of jsonData.tasks) {
            // For granular import, preserve IDs if possible or just add. 
            // Since we cleared, we can just put if we trust IDs, but safer to add.
            // However, to keep links with marks, we need to map.
            const oldId = task.id;
            const { id, ...taskWithoutId } = task;
            const newId = await storeTasks.add(taskWithoutId);
            taskIdMapping.set(oldId, newId);
        }
        await txTasks.done;

        if (jsonData.marks && jsonData.marks.length > 0) {
            const txMarks = db.transaction('marks', 'readwrite');
            const storeMarks = txMarks.objectStore('marks');
            await Promise.all(jsonData.marks.map(mark => {
                const newTaskId = taskIdMapping.get(mark.taskId) || mark.taskId;
                return storeMarks.put({ ...mark, taskId: newTaskId });
            }));
            await txMarks.done;
        }
    }
}
