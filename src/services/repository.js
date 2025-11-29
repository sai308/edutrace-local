import { openDB } from 'idb';
import { fadeOutAndReload } from '../utils/transition';
import { localeService } from './locale';

const DB_VERSION = 8;
const DEFAULT_DB_NAME = 'meet-attendance-db';

// Workspace Management
const WORKSPACE_KEY = 'edutrace_workspaces';
const CURRENT_WORKSPACE_KEY = 'edutrace_current_workspace';

function getWorkspaces() {
    try {
        const stored = localStorage.getItem(WORKSPACE_KEY);
        return stored ? JSON.parse(stored) : [{ id: 'default', name: 'Default', dbName: DEFAULT_DB_NAME, createdAt: new Date().toISOString() }];
    } catch (e) {
        return [{ id: 'default', name: 'Default', dbName: DEFAULT_DB_NAME, createdAt: new Date().toISOString() }];
    }
}

function saveWorkspaces(workspaces) {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspaces));
}

function getCurrentWorkspaceId() {
    return localStorage.getItem(CURRENT_WORKSPACE_KEY) || 'default';
}

function setCurrentWorkspaceId(id) {
    localStorage.setItem(CURRENT_WORKSPACE_KEY, id);
}

function getCurrentDbName() {
    const currentId = getCurrentWorkspaceId();
    const workspaces = getWorkspaces();
    const workspace = workspaces.find(w => w.id === currentId);
    return workspace ? workspace.dbName : DEFAULT_DB_NAME;
}

// Dynamic DB Connection
let _dbPromise = null;
let _currentDbName = null;

function getDb() {
    const dbName = getCurrentDbName();

    if (_dbPromise && _currentDbName === dbName) {
        return _dbPromise;
    }

    _currentDbName = dbName;
    _dbPromise = openDB(dbName, DB_VERSION, {
        async upgrade(db, oldVersion, newVersion, transaction) {
            // Store for meets
            if (!db.objectStoreNames.contains('meets')) {
                const meetStore = db.createObjectStore('meets', { keyPath: 'id' });
                meetStore.createIndex('meetId', 'meetId', { unique: false });
                meetStore.createIndex('date', 'date', { unique: false });
            }
            // Store for settings (ignored users)
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
            // Store for groups
            if (!db.objectStoreNames.contains('groups')) {
                const store = db.createObjectStore('groups', { keyPath: 'id' });
                store.createIndex('meetId', 'meetId', { unique: true }); // Unique by default for new DBs
                store.createIndex('name', 'name', { unique: true });
            } else {
                // Upgrade existing groups store
                const store = transaction.objectStore('groups');

                // Ensure meetId is unique (recreate if needed)
                if (store.indexNames.contains('meetId')) {
                    // We can't easily check if it's unique, so we assume we need to upgrade it if we are hitting this block in v7
                    if (oldVersion < 7) {
                        store.deleteIndex('meetId');
                        store.createIndex('meetId', 'meetId', { unique: true });
                    }
                } else {
                    store.createIndex('meetId', 'meetId', { unique: true });
                }

                // Ensure name index exists and is unique
                if (!store.indexNames.contains('name')) {
                    store.createIndex('name', 'name', { unique: true });
                }

                // Migration: Backfill course for groups (v8)
                if (oldVersion < 8) {
                    let cursor = await store.openCursor();
                    while (cursor) {
                        const group = cursor.value;
                        if (!group.course && group.name) {
                            // Try to extract course from name (e.g. KH-41 -> 4)
                            const match = group.name.match(/\d/);
                            if (match) {
                                const course = parseInt(match[0], 10);
                                if (course >= 1 && course <= 4) {
                                    group.course = course;
                                    cursor.update(group);
                                }
                            }
                        }
                        cursor = await cursor.continue();
                    }
                }
            }
            // Store for tasks
            if (!db.objectStoreNames.contains('tasks')) {
                const store = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
                store.createIndex('groupId', 'groupId', { unique: false });
                store.createIndex('name_date_group', ['name', 'date', 'groupId'], { unique: true });
                store.createIndex('groupName', 'groupName', { unique: false }); // Added in v6
            } else {
                const store = transaction.objectStore('tasks');
                if (!store.indexNames.contains('groupName')) {
                    store.createIndex('groupName', 'groupName', { unique: false });
                }
            }
            // Store for marks
            if (!db.objectStoreNames.contains('marks')) {
                const store = db.createObjectStore('marks', { keyPath: 'id', autoIncrement: true });
                store.createIndex('taskId', 'taskId', { unique: false });
                store.createIndex('studentId', 'studentId', { unique: false });
                store.createIndex('task_student', ['taskId', 'studentId'], { unique: true });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            } else {
                // Upgrade existing store if needed (version 4)
                const store = transaction.objectStore('marks');
                if (!store.indexNames.contains('createdAt')) {
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            }
            // Store for members (formerly students)
            if (!db.objectStoreNames.contains('members')) {
                const store = db.createObjectStore('members', { keyPath: 'id', autoIncrement: true });
                store.createIndex('name', 'name', { unique: true }); // Name should be unique for merging
                store.createIndex('groupName', 'groupName', { unique: false });
                store.createIndex('role', 'role', { unique: false });
            }

            // Migration: Students -> Members
            if (oldVersion < 5) {
                if (db.objectStoreNames.contains('students')) {
                    // Skip auto-migration
                }
            }
        },
    });
    return _dbPromise;
}

export const repository = {
    async saveMeet(meetData) {
        const db = await getDb();
        return db.put('meets', meetData);
    },

    async getAll(storeName) {
        const db = await getDb();
        return db.getAll(storeName);
    },

    async getAllMeets() {
        const db = await getDb();
        return db.getAll('meets');
    },

    async getMeetsByMeetId(meetId) {
        const db = await getDb();
        return db.getAllFromIndex('meets', 'meetId', meetId);
    },

    async getMeetById(id) {
        const db = await getDb();
        return db.get('meets', id);
    },

    async checkMeetExists(meetId, date) {
        const db = await getDb();
        const meets = await db.getAllFromIndex('meets', 'meetId', meetId);
        return meets.some(m => m.date === date);
    },

    async isDuplicateFile(filename, meetId, date) {
        const db = await getDb();
        const meets = await db.getAllFromIndex('meets', 'meetId', meetId);
        return meets.some(m => m.date === date && m.filename === filename);
    },

    async deleteMeet(id) {
        const db = await getDb();
        return db.delete('meets', id);
    },

    async deleteMeets(ids) {
        const db = await getDb();
        const tx = db.transaction('meets', 'readwrite');
        const store = tx.objectStore('meets');
        await Promise.all(ids.map(id => store.delete(id)));
        await tx.done;
    },

    // Groups
    async getGroups() {
        const db = await getDb();
        return db.getAll('groups');
    },

    async saveGroup(group) {
        const db = await getDb();
        await db.put('groups', group);

        // Sync members from existing meets for this group
        if (group.meetId) {
            await this.syncMembersFromMeets(group);
        }
        return group.id;
    },

    async syncMembersFromMeets(group) {
        const meets = await this.getMeetsByMeetId(group.meetId);
        await this._syncParticipants(meets, group.name);
    },

    async syncAllMembersFromMeets() {
        const meets = await this.getAllMeets();
        const groupMap = await this.getGroupMap();

        // We need to pass the group name for each meet
        // But _syncParticipants expects a single group name if passed.
        // Let's refactor _syncParticipants or handle it here.

        const allMembers = await this.getAllMembers();
        const memberMap = new Map();
        allMembers.forEach(m => {
            memberMap.set(m.name, m);
            if (m.aliases) {
                m.aliases.forEach(a => memberMap.set(a, m));
            }
        });

        const db = await getDb();
        const tx = db.transaction('members', 'readwrite');
        const store = tx.objectStore('members');

        for (const meet of meets) {
            const group = groupMap[meet.meetId];
            const groupName = group ? group.name : '';

            for (const p of meet.participants) {
                if (!memberMap.has(p.name)) {
                    const newMember = {
                        name: p.name,
                        groupName: groupName,
                        email: p.email || '',
                        role: 'student',
                        aliases: [],
                        hidden: false
                    };
                    const id = await store.add(newMember);
                    newMember.id = id;
                    memberMap.set(p.name, newMember);
                }
            }
        }
        await tx.done;
    },

    async _syncParticipants(meets, groupName) {
        const allMembers = await this.getAllMembers();
        const memberMap = new Map();
        allMembers.forEach(m => {
            memberMap.set(m.name, m);
            if (m.aliases) {
                m.aliases.forEach(a => memberMap.set(a, m));
            }
        });

        const db = await getDb();
        const tx = db.transaction('members', 'readwrite');
        const store = tx.objectStore('members');

        for (const meet of meets) {
            for (const p of meet.participants) {
                if (!memberMap.has(p.name)) {
                    const newMember = {
                        name: p.name,
                        groupName: groupName,
                        email: p.email || '',
                        role: 'student',
                        aliases: [],
                        hidden: false
                    };
                    const id = await store.add(newMember);
                    newMember.id = id;
                    memberMap.set(p.name, newMember);
                }
            }
        }
        await tx.done;
    },

    async hideMember(id) {
        const db = await getDb();
        const tx = db.transaction('members', 'readwrite');
        const store = tx.objectStore('members');
        const member = await store.get(id);
        if (member) {
            member.hidden = true;
            await store.put(member);
        }
        await tx.done;
    },

    async hideMembers(ids) {
        const db = await getDb();
        const tx = db.transaction('members', 'readwrite');
        const store = tx.objectStore('members');
        await Promise.all(ids.map(async id => {
            const member = await store.get(id);
            if (member) {
                member.hidden = true;
                await store.put(member);
            }
        }));
        await tx.done;
    },

    // Members (Unified Entity)
    async saveMember(member) {
        // Resolve role before transaction
        let role = member.role;
        if (!role) {
            const teachers = await this.getTeachers();
            role = teachers.includes(member.name) ? 'teacher' : 'student';
        }

        const db = await getDb();
        const tx = db.transaction('members', 'readwrite');
        const store = tx.objectStore('members');

        let existing;
        if (member.id) {
            existing = await store.get(member.id);
        }

        if (!existing && member.name) {
            const index = store.index('name');
            existing = await index.get(member.name);
        }

        if (existing) {
            // Merge
            const updated = {
                aliases: [], // Default
                ...existing,
                ...member,
                id: existing.id,
                role: role
            };
            await store.put(updated);
            await tx.done;
            return existing.id;
        }

        const newMember = { aliases: [], ...member, role };
        const id = await store.add(newMember);
        await tx.done;
        return id;
    },

    async deleteGroup(id) {
        const db = await getDb();
        return db.delete('groups', id);
    },

    async getGroupMap() {
        const groups = await this.getGroups();
        const map = {};
        groups.forEach(g => {
            map[g.meetId] = g;
        });
        return map;
    },

    async applyDurationLimitToAll(limitMinutes) {
        if (!limitMinutes || limitMinutes <= 0) return 0;

        const limitSeconds = limitMinutes * 60;
        const meets = await this.getAllMeets();
        let fixedCount = 0;
        const db = await getDb();
        const tx = db.transaction('meets', 'readwrite');
        const store = tx.objectStore('meets');

        for (const meet of meets) {
            let changed = false;
            meet.participants.forEach(p => {
                if (p.duration > limitSeconds) {
                    p.duration = limitSeconds;
                    changed = true;
                }
            });

            if (changed) {
                await store.put(meet);
                fixedCount++;
            }
        }

        await tx.done;
        return fixedCount;
    },

    async removeIgnoredUsersFromAll(ignoredUsersList) {
        return 0;
    },

    async exportData() {
        const [meets, groups, ignoredUsers, durationLimit, defaultTeacher, tasks, marks, members] = await Promise.all([
            this.getAllMeets(),
            this.getGroups(),
            this.getIgnoredUsers(),
            this.getDurationLimit(),
            this.getDefaultTeacher(),
            this.getAll('tasks'),
            this.getAll('marks'),
            this.getAll('members')
        ]);

        return {
            meets,
            groups,
            tasks,
            marks,
            members,
            settings: {
                ignoredUsers,
                durationLimit,
                defaultTeacher
            },
            version: 3, // Bump version
            timestamp: new Date().toISOString()
        };
    },

    async importData(jsonData) {
        if (!jsonData || !jsonData.meets || !jsonData.groups) {
            throw new Error('Invalid data format');
        }

        await this.clearAll();

        const db = await getDb();

        // Restore meets
        if (jsonData.meets.length > 0) {
            const txMeets = db.transaction('meets', 'readwrite');
            const storeMeets = txMeets.objectStore('meets');
            for (const meet of jsonData.meets) {
                await storeMeets.put(meet);
            }
            await txMeets.done;
        }

        // Restore groups
        if (jsonData.groups.length > 0) {
            const txGroups = db.transaction('groups', 'readwrite');
            const storeGroups = txGroups.objectStore('groups');
            for (const group of jsonData.groups) {
                await storeGroups.put(group);
            }
            await txGroups.done;
        }

        // Restore settings
        if (jsonData.settings) {
            if (jsonData.settings.durationLimit !== undefined) {
                await this.saveDurationLimit(jsonData.settings.durationLimit);
            }
            if (jsonData.settings.defaultTeacher) {
                await this.saveDefaultTeacher(jsonData.settings.defaultTeacher);
            }
        }

        // Restore tasks with upsert logic (preserve IDs for existing tasks)
        const taskIdMapping = new Map(); // Maps old task IDs to new task IDs

        if (jsonData.tasks && jsonData.tasks.length > 0) {
            const db = await getDb();
            const tx = db.transaction('tasks', 'readwrite');
            const store = tx.objectStore('tasks');

            for (const task of jsonData.tasks) {
                const oldId = task.id;

                // Find existing task by natural key (name + date + groupName)
                const existing = await this.findTaskByNaturalKey(task.name, task.date, task.groupName);

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

        // Restore members
        if (jsonData.members && jsonData.members.length > 0) {
            const tx = db.transaction('members', 'readwrite');
            const store = tx.objectStore('members');
            for (const member of jsonData.members) {
                await store.put(member);
            }
            await tx.done;
        } else if (jsonData.students && jsonData.students.length > 0) {
            // Legacy support: import students as members
            const tx = db.transaction('members', 'readwrite');
            const store = tx.objectStore('members');
            for (const student of jsonData.students) {
                await store.put({ ...student, role: student.role || 'student' });
            }
            await tx.done;
        }

        // Restore marks with updated task IDs
        if (jsonData.marks && jsonData.marks.length > 0) {
            const tx = db.transaction('marks', 'readwrite');
            const store = tx.objectStore('marks');
            for (const mark of jsonData.marks) {
                // Update taskId to the new ID if mapping exists
                const newTaskId = taskIdMapping.get(mark.taskId) || mark.taskId;
                await store.put({ ...mark, taskId: newTaskId });
            }
            await tx.done;
        }
    },

    async clearAll() {
        const db = await getDb();
        await db.clear('meets');
        await db.clear('groups');
        await db.clear('tasks');
        await db.clear('marks');
        await db.clear('members');
        if (db.objectStoreNames.contains('students')) {
            await db.clear('students');
        }

        const wsId = getCurrentWorkspaceId();
        const suffix = wsId === 'default' ? '' : `_${wsId}`;

        localStorage.removeItem(wsId === 'default' ? 'ignoredUsers' : `ignoredUsers${suffix}`);
        localStorage.removeItem(wsId === 'default' ? 'durationLimit' : `durationLimit${suffix}`);
        localStorage.removeItem(wsId === 'default' ? 'defaultTeacher' : `defaultTeacher${suffix}`);
        localStorage.removeItem(wsId === 'default' ? 'teachers' : `teachers${suffix}`);
    },

    // Granular Export Methods
    async exportReports() {
        const meets = await this.getAllMeets();
        return {
            meets,
            version: 1,
            type: 'reports',
            timestamp: new Date().toISOString()
        };
    },

    async exportGroups() {
        const groups = await this.getGroups();
        return {
            groups,
            version: 1,
            type: 'groups',
            timestamp: new Date().toISOString()
        };
    },

    async exportMarks() {
        const db = await getDb();
        const [tasks, marks, members] = await Promise.all([
            db.getAll('tasks'),
            db.getAll('marks'),
            db.getAll('members')
        ]);
        return {
            tasks,
            marks,
            members,
            version: 2,
            type: 'marks',
            timestamp: new Date().toISOString()
        };
    },

    // Granular Import Methods
    async importReports(jsonData) {
        if (!jsonData || !jsonData.meets) {
            throw new Error('Invalid reports data format');
        }

        await this.clearReports();
        const db = await getDb();

        if (jsonData.meets.length > 0) {
            const tx = db.transaction('meets', 'readwrite');
            const store = tx.objectStore('meets');
            for (const meet of jsonData.meets) {
                await store.put(meet);
            }
            await tx.done;
        }
    },

    async importGroups(jsonData) {
        if (!jsonData || !jsonData.groups) {
            throw new Error('Invalid groups data format');
        }

        await this.clearGroups();
        const db = await getDb();

        if (jsonData.groups.length > 0) {
            const tx = db.transaction('groups', 'readwrite');
            const store = tx.objectStore('groups');
            for (const group of jsonData.groups) {
                await store.put(group);
            }
            await tx.done;
        }
    },

    async importMarks(jsonData) {
        if (!jsonData) {
            throw new Error('Invalid marks data format');
        }

        await this.clearMarks();
        const db = await getDb();

        const tasks = jsonData.tasks || [];
        const marks = jsonData.marks || [];
        const members = jsonData.members || jsonData.students || [];

        // Import tasks with upsert logic (preserve IDs for existing tasks)
        const taskIdMapping = new Map(); // Maps old task IDs to new task IDs

        if (tasks.length > 0) {
            const db = await getDb();
            const tx = db.transaction('tasks', 'readwrite');
            const store = tx.objectStore('tasks');

            for (const task of tasks) {
                const oldId = task.id;

                // Find existing task by natural key (name + date + groupName)
                const existing = await this.findTaskByNaturalKey(task.name, task.date, task.groupName);

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

        // Import members
        if (members.length > 0) {
            const tx = db.transaction('members', 'readwrite');
            const store = tx.objectStore('members');
            for (const member of members) {
                await store.put({ ...member, role: member.role || 'student' });
            }
            await tx.done;
        }

        // Import marks with updated task IDs
        if (marks.length > 0) {
            const tx = db.transaction('marks', 'readwrite');
            const store = tx.objectStore('marks');
            for (const mark of marks) {
                // Update taskId to the new ID if mapping exists
                const newTaskId = taskIdMapping.get(mark.taskId) || mark.taskId;
                await store.put({ ...mark, taskId: newTaskId });
            }
            await tx.done;
        }
    },

    // Granular Clear Methods
    async clearReports() {
        const db = await getDb();
        await db.clear('meets');
    },

    async clearGroups() {
        const db = await getDb();
        await db.clear('groups');
    },

    async clearMarks() {
        const db = await getDb();
        await db.clear('tasks');
        await db.clear('marks');
    },

    async clearMembers() {
        const db = await getDb();
        await db.clear('members');
    },

    // Legacy alias
    async clearStudents() {
        return this.clearMembers();
    },

    // Tasks
    async saveTask(task) {
        const db = await getDb();
        const tx = db.transaction('tasks', 'readwrite');

        // Use groupName index to find potential duplicates
        // The 'name_date_group' index was broken because it relied on 'groupId' which was undefined
        const groupIndex = tx.store.index('groupName');
        const tasksInGroup = await groupIndex.getAll(task.groupName);

        const existing = tasksInGroup.find(t => t.name === task.name && t.date === task.date);

        if (existing) {
            return { id: existing.id, isNew: false };
        }

        const id = await tx.store.add(task);
        await tx.done;
        return { id, isNew: true };
    },

    async getAllTasks() {
        const db = await getDb();
        return db.getAll('tasks');
    },

    async getTasksByGroup(groupName) {
        const db = await getDb();
        return db.getAllFromIndex('tasks', 'groupName', groupName);
    },

    async findTaskByNaturalKey(name, date, groupName) {
        const db = await getDb();
        const tasks = await db.getAllFromIndex('tasks', 'groupName', groupName);
        return tasks.find(t => t.name === name && t.date === date);
    },

    // Members (Unified Entity)
    async saveMember(member) {
        // Resolve role before transaction
        let role = member.role;
        if (!role) {
            const teachers = await this.getTeachers();
            role = teachers.includes(member.name) ? 'teacher' : 'student';
        }

        const db = await getDb();
        const tx = db.transaction('members', 'readwrite');
        const store = tx.objectStore('members');

        let existing;
        if (member.id) {
            existing = await store.get(member.id);
        }

        if (!existing && member.name) {
            const index = store.index('name');
            existing = await index.get(member.name);
        }

        if (existing) {
            // Merge
            const updated = {
                aliases: [], // Default
                ...existing,
                ...member,
                id: existing.id,
                role: role
            };
            await store.put(updated);
            await tx.done;
            return existing.id;
        }

        const newMember = { aliases: [], ...member, role };
        const id = await store.add(newMember);
        await tx.done;
        return id;
    },

    async getAllMembers() {
        const db = await getDb();
        return db.getAll('members');
    },

    async getMembersByGroup(groupName) {
        const db = await getDb();
        return db.getAllFromIndex('members', 'groupName', groupName);
    },

    async deleteMember(id) {
        const db = await getDb();
        return db.delete('members', id);
    },

    async deleteMembers(ids) {
        const db = await getDb();
        const tx = db.transaction('members', 'readwrite');
        const store = tx.objectStore('members');
        await Promise.all(ids.map(id => store.delete(id)));
        await tx.done;
    },

    // Legacy Aliases for Students
    async saveStudent(student) {
        return this.saveMember(student);
    },

    async getAllStudents() {
        return this.getAllMembers();
    },

    // Workspaces
    getWorkspaces() {
        return getWorkspaces();
    },

    getCurrentWorkspaceId() {
        return getCurrentWorkspaceId();
    },

    async createWorkspace(name, options = {}) {
        const workspaces = getWorkspaces();
        const id = crypto.randomUUID();
        const newWorkspace = {
            id,
            name,
            icon: options.icon || 'Database', // Default icon
            dbName: `meet-attendance-db-${id}`,
            createdAt: new Date().toISOString()
        };
        workspaces.push(newWorkspace);
        saveWorkspaces(workspaces);

        if (options.exportSettings) {
            const durationLimit = await this.getDurationLimit();
            const defaultTeacher = await this.getDefaultTeacher();
            const ignoredUsers = await this.getIgnoredUsers();

            // Switch to new workspace temporarily to save settings
            const originalWorkspaceId = getCurrentWorkspaceId();
            setCurrentWorkspaceId(id);
            _dbPromise = null; // Reset DB connection

            await this.saveDurationLimit(durationLimit);
            await this.saveDefaultTeacher(defaultTeacher);
            await this.saveIgnoredUsers(ignoredUsers);

            // Restore original workspace
            setCurrentWorkspaceId(originalWorkspaceId);
            _dbPromise = null; // Reset DB connection
        }

        return id;
    },

    async updateWorkspace(id, updates) {
        const workspaces = getWorkspaces();
        const index = workspaces.findIndex(w => w.id === id);

        if (index === -1) {
            throw new Error('Workspace not found');
        }

        // Prevent updating default workspace ID or dbName
        const { id: _, dbName: __, ...allowedUpdates } = updates;

        // Update workspace properties
        workspaces[index] = {
            ...workspaces[index],
            ...allowedUpdates,
            updatedAt: new Date().toISOString()
        };

        saveWorkspaces(workspaces);
        return workspaces[index];
    },

    async exportWorkspaces(workspaceIds) {
        const allWorkspaces = getWorkspaces();
        const workspacesToExport = allWorkspaces.filter(w => workspaceIds.includes(w.id));

        const exportData = {
            type: 'multi-workspace-backup',
            version: 1,
            timestamp: new Date().toISOString(),
            workspaces: []
        };

        for (const ws of workspacesToExport) {
            const db = await openDB(ws.dbName, DB_VERSION);
            try {
                const [meets, groups, tasks, marks, members] = await Promise.all([
                    db.getAll('meets'),
                    db.getAll('groups'),
                    db.getAll('tasks'),
                    db.getAll('marks'),
                    db.getAll('members')
                ]);

                exportData.workspaces.push({
                    id: ws.id,
                    name: ws.name,
                    icon: ws.icon,
                    dbName: ws.dbName,
                    data: { meets, groups, tasks, marks, members }
                });
            } finally {
                db.close();
            }
        }

        return exportData;
    },

    async importWorkspaces(data, selectedIds) {
        if (!data.workspaces || !Array.isArray(data.workspaces)) {
            throw new Error('Invalid workspace backup format');
        }

        const workspacesToImport = data.workspaces.filter(w => selectedIds.includes(w.id));
        const currentWorkspaces = getWorkspaces();

        for (const wsData of workspacesToImport) {
            // Check if workspace exists
            let targetWs = currentWorkspaces.find(w => w.id === wsData.id);

            if (!targetWs) {
                // Create new workspace entry if it doesn't exist
                targetWs = {
                    id: wsData.id,
                    name: wsData.name,
                    icon: wsData.icon || 'Database',
                    dbName: wsData.dbName || `meet-attendance-db-${wsData.id}`,
                    createdAt: new Date().toISOString()
                };
                currentWorkspaces.push(targetWs);
                saveWorkspaces(currentWorkspaces);
            }

            // Import data into this workspace's DB - ensure schema is initialized
            const db = await openDB(targetWs.dbName, DB_VERSION, {
                async upgrade(db, oldVersion, newVersion, transaction) {
                    // Create stores if they don't exist
                    if (!db.objectStoreNames.contains('meets')) {
                        const meetStore = db.createObjectStore('meets', { keyPath: 'id' });
                        meetStore.createIndex('meetId', 'meetId', { unique: false });
                        meetStore.createIndex('date', 'date', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('settings')) {
                        db.createObjectStore('settings', { keyPath: 'key' });
                    }
                    if (!db.objectStoreNames.contains('groups')) {
                        const store = db.createObjectStore('groups', { keyPath: 'id' });
                        store.createIndex('meetId', 'meetId', { unique: true });
                        store.createIndex('name', 'name', { unique: true });
                    }
                    if (!db.objectStoreNames.contains('tasks')) {
                        const store = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('groupId', 'groupId', { unique: false });
                        store.createIndex('name_date_group', ['name', 'date', 'groupId'], { unique: true });
                        store.createIndex('groupName', 'groupName', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('marks')) {
                        const store = db.createObjectStore('marks', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('taskId', 'taskId', { unique: false });
                        store.createIndex('studentId', 'studentId', { unique: false });
                        store.createIndex('task_student', ['taskId', 'studentId'], { unique: true });
                        store.createIndex('createdAt', 'createdAt', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('members')) {
                        const store = db.createObjectStore('members', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('name', 'name', { unique: true });
                        store.createIndex('groupName', 'groupName', { unique: false });
                        store.createIndex('role', 'role', { unique: false });
                    }
                }
            });
            try {
                const tx = db.transaction(['meets', 'groups', 'tasks', 'marks', 'members'], 'readwrite');

                // Clear existing data
                await Promise.all([
                    tx.objectStore('meets').clear(),
                    tx.objectStore('groups').clear(),
                    tx.objectStore('tasks').clear(),
                    tx.objectStore('marks').clear(),
                    tx.objectStore('members').clear()
                ]);

                // Import new data
                const { meets, groups, tasks, marks, members } = wsData.data;

                if (meets) {
                    for (const m of meets) {
                        await tx.objectStore('meets').put(m);
                    }
                }
                if (groups) {
                    for (const g of groups) {
                        await tx.objectStore('groups').put(g);
                    }
                }
                if (tasks) {
                    for (const t of tasks) {
                        await tx.objectStore('tasks').put(t);
                    }
                }
                if (marks) {
                    for (const m of marks) {
                        await tx.objectStore('marks').put(m);
                    }
                }
                if (members) {
                    for (const m of members) {
                        await tx.objectStore('members').put(m);
                    }
                }

                await tx.done;
            } finally {
                db.close();
            }
        }
    },

    // Settings
    async getDurationLimit() {
        try {
            const wsId = getCurrentWorkspaceId();
            const key = wsId === 'default' ? 'durationLimit' : `durationLimit_${wsId}`;
            const stored = localStorage.getItem(key);
            return stored ? parseInt(stored, 10) : 0;
        } catch (e) {
            console.error('Error reading duration limit from localStorage', e);
            return 0;
        }
    },

    async saveDurationLimit(limit) {
        const wsId = getCurrentWorkspaceId();
        const key = wsId === 'default' ? 'durationLimit' : `durationLimit_${wsId}`;
        localStorage.setItem(key, limit);
    },

    async getDefaultTeacher() {
        try {
            const wsId = getCurrentWorkspaceId();
            const key = wsId === 'default' ? 'defaultTeacher' : `defaultTeacher_${wsId}`;
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            console.error('Error reading default teacher from localStorage', e);
            return null;
        }
    },

    async saveDefaultTeacher(teacher) {
        const wsId = getCurrentWorkspaceId();
        const key = wsId === 'default' ? 'defaultTeacher' : `defaultTeacher_${wsId}`;
        localStorage.setItem(key, JSON.stringify(teacher));
    },

    async getIgnoredUsers() {
        try {
            const wsId = getCurrentWorkspaceId();
            const key = wsId === 'default' ? 'ignoredUsers' : `ignoredUsers_${wsId}`;
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Error reading ignored users from localStorage', e);
            return [];
        }
    },

    async saveIgnoredUsers(users) {
        const wsId = getCurrentWorkspaceId();
        const key = wsId === 'default' ? 'ignoredUsers' : `ignoredUsers_${wsId}`;
        localStorage.setItem(key, JSON.stringify(users));
    },

    async switchWorkspace(id) {
        const workspaces = getWorkspaces();
        if (!workspaces.find(w => w.id === id)) {
            throw new Error('Workspace not found');
        }
        setCurrentWorkspaceId(id);
        _dbPromise = null; // Force reconnection
        // Smooth transition before reload
        const message = localeService.getTranslation('loader.switchingWorkspace');
        fadeOutAndReload(message);
    },

    async deleteWorkspace(id) {
        if (id === 'default') {
            throw new Error('Cannot delete default workspace');
        }

        const workspaces = getWorkspaces();
        const workspace = workspaces.find(w => w.id === id);
        if (!workspace) return;

        // Delete DB
        await indexedDB.deleteDatabase(workspace.dbName);

        // Update list
        const newWorkspaces = workspaces.filter(w => w.id !== id);
        saveWorkspaces(newWorkspaces);

        // If current was deleted, switch to default
        if (getCurrentWorkspaceId() === id) {
            await this.switchWorkspace('default');
        }
    },

    async deleteWorkspacesData(workspaceIds) {
        const workspaces = getWorkspaces();

        for (const id of workspaceIds) {
            const workspace = workspaces.find(w => w.id === id);
            if (!workspace) continue;

            // Open the workspace database with upgrade callback
            const db = await openDB(workspace.dbName, DB_VERSION, {
                async upgrade(db, oldVersion, newVersion, transaction) {
                    // Create stores if they don't exist
                    if (!db.objectStoreNames.contains('meets')) {
                        const meetStore = db.createObjectStore('meets', { keyPath: 'id' });
                        meetStore.createIndex('meetId', 'meetId', { unique: false });
                        meetStore.createIndex('date', 'date', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('settings')) {
                        db.createObjectStore('settings', { keyPath: 'key' });
                    }
                    if (!db.objectStoreNames.contains('groups')) {
                        const store = db.createObjectStore('groups', { keyPath: 'id' });
                        store.createIndex('meetId', 'meetId', { unique: true });
                        store.createIndex('name', 'name', { unique: true });
                    }
                    if (!db.objectStoreNames.contains('tasks')) {
                        const store = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('groupId', 'groupId', { unique: false });
                        store.createIndex('name_date_group', ['name', 'date', 'groupId'], { unique: true });
                        store.createIndex('groupName', 'groupName', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('marks')) {
                        const store = db.createObjectStore('marks', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('taskId', 'taskId', { unique: false });
                        store.createIndex('studentId', 'studentId', { unique: false });
                        store.createIndex('task_student', ['taskId', 'studentId'], { unique: true });
                        store.createIndex('createdAt', 'createdAt', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('members')) {
                        const store = db.createObjectStore('members', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('name', 'name', { unique: true });
                        store.createIndex('groupName', 'groupName', { unique: false });
                        store.createIndex('role', 'role', { unique: false });
                    }
                }
            });

            try {
                // Clear all data from the workspace
                const tx = db.transaction(['meets', 'groups', 'tasks', 'marks', 'members'], 'readwrite');

                await Promise.all([
                    tx.objectStore('meets').clear(),
                    tx.objectStore('groups').clear(),
                    tx.objectStore('tasks').clear(),
                    tx.objectStore('marks').clear(),
                    tx.objectStore('members').clear()
                ]);

                await tx.done;
            } finally {
                db.close();
            }
        }
    },

    async getStudentsByGroup(groupName) {
        return this.getMembersByGroup(groupName);
    },

    // Teachers (Settings)
    async getTeachers() {
        try {
            const wsId = getCurrentWorkspaceId();
            const key = wsId === 'default' ? 'teachers' : `teachers_${wsId}`;
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Error reading teachers from localStorage', e);
            return [];
        }
    },

    async saveTeachers(teachers) {
        try {
            const wsId = getCurrentWorkspaceId();
            const key = wsId === 'default' ? 'teachers' : `teachers_${wsId}`;
            localStorage.setItem(key, JSON.stringify(teachers));

            // Sync roles in DB
            const db = await getDb();
            const tx = db.transaction('members', 'readwrite');
            const allMembers = await tx.store.getAll();

            const teacherSet = new Set(teachers);

            for (const member of allMembers) {
                const isTeacher = teacherSet.has(member.name);
                const currentRole = member.role || 'student';

                if (isTeacher && currentRole !== 'teacher') {
                    member.role = 'teacher';
                    await tx.store.put(member);
                } else if (!isTeacher && currentRole === 'teacher') {
                    member.role = 'student';
                    await tx.store.put(member);
                }
            }
            await tx.done;
        } catch (e) {
            console.error('Error saving teachers to localStorage', e);
        }
    },

    // Marks
    async saveMark(mark) {
        const db = await getDb();
        const tx = db.transaction('marks', 'readwrite');
        const index = tx.store.index('task_student');
        const existing = await index.get([mark.taskId, mark.studentId]);

        if (existing) {
            const updated = { ...existing, score: mark.score };
            if (existing.score !== mark.score) {
                await tx.store.put(updated);
                await tx.done;
                return { id: existing.id, isNew: true }; // Updated counts as "processed/new" for feedback? Or maybe separate "updated"?
                // Let's treat update as "new" work done, but strictly "isNew" usually means created.
                // User asked for "skipping import due duplicates".
                // If score is same, we skip. If score different, we update.
                // Let's refine:
            }
            // Score is same, so it's a true duplicate/skip
            return { id: existing.id, isNew: false };
        }

        const id = await tx.store.add({
            ...mark,
            createdAt: new Date().toISOString()
        });
        await tx.done;
        return { id, isNew: true };
    },

    async getMarksByTask(taskId) {
        const db = await getDb();
        return db.getAllFromIndex('marks', 'taskId', taskId);
    },

    async updateMarkSynced(id, synced) {
        const db = await getDb();
        const tx = db.transaction('marks', 'readwrite');
        const mark = await tx.store.get(id);
        if (mark) {
            mark.synced = synced;
            await tx.store.put(mark);
        }
        await tx.done;
    },

    async getMarksByStudent(studentId) {
        const db = await getDb();
        return db.getAllFromIndex('marks', 'studentId', studentId);
    },

    async deleteMark(id) {
        const db = await getDb();
        return db.delete('marks', id);
    },

    async deleteMarks(ids) {
        const db = await getDb();
        const tx = db.transaction('marks', 'readwrite');
        const store = tx.objectStore('marks');
        await Promise.all(ids.map(id => store.delete(id)));
        await tx.done;
    },

    async getAllMarksWithRelations() {
        const db = await getDb();

        // Fetch all data in parallel - single batch operation
        const [allMarks, allTasks, allMembers] = await Promise.all([
            db.getAll('marks'),
            db.getAll('tasks'),
            db.getAll('members')
        ]);

        // Build lookup maps for O(1) access
        const taskMap = new Map(allTasks.map(t => [t.id, t]));
        const memberMap = new Map(allMembers.map(m => [m.id, m]));

        // Transform marks with related data in a single pass
        const flatMarks = [];
        for (const mark of allMarks) {
            const task = taskMap.get(mark.taskId);
            const student = memberMap.get(mark.studentId);

            // Skip if related data is missing (orphaned records)
            if (!task || !student) continue;

            flatMarks.push({
                id: mark.id,
                studentName: student.name,
                groupName: task.groupName,
                taskName: task.name,
                taskDate: task.date,
                maxPoints: task.maxPoints,
                score: mark.score,
                synced: mark.synced,
                createdAt: mark.createdAt
            });
        }

        return flatMarks;
    },

    // Entity Statistics
    async getEntityCounts() {
        const db = await getDb();
        const [meets, groups, tasks, marks, members] = await Promise.all([
            db.count('meets'),
            db.count('groups'),
            db.count('tasks'),
            db.count('marks'),
            db.count('members')
        ]);

        return {
            reports: meets,
            groups: groups,
            marks: marks,
            tasks: tasks,
            members: members
        };
    },

    async getEntitySizes() {
        const [meets, groups, tasks, marks, members] = await Promise.all([
            this.getAllMeets(),
            this.getGroups(),
            this.getAll('tasks'),
            this.getAll('marks'),
            this.getAll('members')
        ]);

        // Estimate size in bytes using JSON.stringify
        const getSize = (data) => {
            try {
                return new Blob([JSON.stringify(data)]).size;
            } catch (e) {
                return 0;
            }
        };

        return {
            reports: getSize(meets),
            groups: getSize(groups),
            marks: getSize(marks) + getSize(tasks), // Marks includes tasks
            tasks: getSize(tasks),
            members: getSize(members)
        };
    },

    async getAllWorkspacesSizes() {
        const workspaces = getWorkspaces();
        const results = [];
        let total = 0;

        for (const ws of workspaces) {
            const db = await openDB(ws.dbName, DB_VERSION, {
                async upgrade(db, oldVersion, newVersion, transaction) {
                    // Minimal upgrade - just create stores if they don't exist
                    if (!db.objectStoreNames.contains('meets')) {
                        const meetStore = db.createObjectStore('meets', { keyPath: 'id' });
                        meetStore.createIndex('meetId', 'meetId', { unique: false });
                        meetStore.createIndex('date', 'date', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('settings')) {
                        db.createObjectStore('settings', { keyPath: 'key' });
                    }
                    if (!db.objectStoreNames.contains('groups')) {
                        const store = db.createObjectStore('groups', { keyPath: 'id' });
                        store.createIndex('meetId', 'meetId', { unique: true });
                        store.createIndex('name', 'name', { unique: true });
                    }
                    if (!db.objectStoreNames.contains('tasks')) {
                        const store = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('groupId', 'groupId', { unique: false });
                        store.createIndex('name_date_group', ['name', 'date', 'groupId'], { unique: true });
                        store.createIndex('groupName', 'groupName', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('marks')) {
                        const store = db.createObjectStore('marks', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('taskId', 'taskId', { unique: false });
                        store.createIndex('studentId', 'studentId', { unique: false });
                        store.createIndex('task_student', ['taskId', 'studentId'], { unique: true });
                        store.createIndex('createdAt', 'createdAt', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('members')) {
                        const store = db.createObjectStore('members', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('name', 'name', { unique: true });
                        store.createIndex('groupName', 'groupName', { unique: false });
                        store.createIndex('role', 'role', { unique: false });
                    }
                }
            });

            try {
                // Check if all required stores exist before trying to access them
                const storeNames = ['meets', 'groups', 'tasks', 'marks', 'members'];
                const missingStores = storeNames.filter(name => !db.objectStoreNames.contains(name));

                if (missingStores.length > 0) {
                    console.warn(`Workspace ${ws.name} is missing stores: ${missingStores.join(', ')}. Skipping size calculation.`);
                    db.close();
                    results.push({
                        id: ws.id,
                        name: ws.name,
                        size: 0,
                        error: true
                    });
                    continue;
                }

                const [meets, groups, tasks, marks, members] = await Promise.all([
                    db.getAll('meets'),
                    db.getAll('groups'),
                    db.getAll('tasks'),
                    db.getAll('marks'),
                    db.getAll('members')
                ]);

                const getSize = (data) => {
                    try {
                        return new Blob([JSON.stringify(data)]).size;
                    } catch (e) {
                        return 0;
                    }
                };

                const size = getSize(meets) + getSize(groups) + getSize(tasks) + getSize(marks) + getSize(members);
                total += size;
                results.push({
                    id: ws.id,
                    name: ws.name,
                    size: size
                });
            } catch (e) {
                console.error(`Error calculating size for workspace ${ws.name}:`, e);
                results.push({
                    id: ws.id,
                    name: ws.name,
                    size: 0,
                    error: true
                });
            } finally {
                db.close();
            }
        }

        return {
            total,
            workspaces: results
        };
    }
};
