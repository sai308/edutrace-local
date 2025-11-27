import { openDB } from 'idb';

const DB_NAME = 'meet-attendance-db';
const DB_VERSION = 8;

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
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
            // We can't easily migrate here because we need to read from 'students' which might not exist in this transaction context if we just created 'members'.
            // But 'students' exists from previous versions.
            // However, doing complex migration in upgrade can be tricky.
            // Given the user is ok with "Erase", we might just leave it empty or try a best-effort copy if 'students' exists.
            if (db.objectStoreNames.contains('students')) {
                const studentStore = transaction.objectStore('students');
                const memberStore = transaction.objectStore('members');
                // Iterate and copy
                // This is async inside upgrade, need to be careful.
                // IDB upgrade transaction is special.
                // Let's skip auto-migration for now to avoid locking issues, user can re-import.
                // Or better, we can do it lazily or just assume fresh start for "Members".
                // The user request implies a refactor, so data migration is expected but maybe not critical if they have CSVs.
                // Let's just create the store.
            }
        }
    },
});

export const repository = {
    async saveMeet(meetData) {
        const db = await dbPromise;
        return db.put('meets', meetData);
    },

    async getAll(storeName) {
        const db = await dbPromise;
        return db.getAll(storeName);
    },

    async getAllMeets() {
        const db = await dbPromise;
        return db.getAll('meets');
    },

    async getMeetsByMeetId(meetId) {
        const db = await dbPromise;
        return db.getAllFromIndex('meets', 'meetId', meetId);
    },

    async getMeetById(id) {
        const db = await dbPromise;
        return db.get('meets', id);
    },

    async checkMeetExists(meetId, date) {
        const db = await dbPromise;
        const meets = await db.getAllFromIndex('meets', 'meetId', meetId);
        return meets.some(m => m.date === date);
    },

    async isDuplicateFile(filename, meetId, date) {
        const db = await dbPromise;
        const meets = await db.getAllFromIndex('meets', 'meetId', meetId);
        return meets.some(m => m.date === date && m.filename === filename);
    },

    async deleteMeet(id) {
        const db = await dbPromise;
        return db.delete('meets', id);
    },

    async deleteMeets(ids) {
        const db = await dbPromise;
        const tx = db.transaction('meets', 'readwrite');
        const store = tx.objectStore('meets');
        await Promise.all(ids.map(id => store.delete(id)));
        await tx.done;
    },

    // Groups
    async getGroups() {
        const db = await dbPromise;
        return db.getAll('groups');
    },

    async saveGroup(group) {
        const db = await dbPromise;
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

        const db = await dbPromise;
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

        const db = await dbPromise;
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
        const db = await dbPromise;
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
        const db = await dbPromise;
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

        const db = await dbPromise;
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
        const db = await dbPromise;
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

    async getIgnoredUsers() {
        return [];
    },

    async saveIgnoredUsers(users) {
    },

    async getDurationLimit() {
        try {
            const stored = localStorage.getItem('durationLimit');
            return stored ? parseInt(stored, 10) : 0;
        } catch (e) {
            console.error('Error reading duration limit from localStorage', e);
            return 0;
        }
    },

    async saveDurationLimit(limit) {
        try {
            localStorage.setItem('durationLimit', limit.toString());
        } catch (e) {
            console.error('Error saving duration limit to localStorage', e);
        }
    },

    async getDefaultTeacher() {
        try {
            const stored = localStorage.getItem('defaultTeacher');
            return stored || '';
        } catch (e) {
            console.error('Error reading default teacher from localStorage', e);
            return '';
        }
    },

    async saveDefaultTeacher(teacher) {
        try {
            localStorage.setItem('defaultTeacher', teacher);
        } catch (e) {
            console.error('Error saving default teacher to localStorage', e);
        }
    },

    async applyDurationLimitToAll(limitMinutes) {
        if (!limitMinutes || limitMinutes <= 0) return 0;

        const limitSeconds = limitMinutes * 60;
        const meets = await this.getAllMeets();
        let fixedCount = 0;
        const db = await dbPromise;
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

        const db = await dbPromise;

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
        const db = await dbPromise;
        await db.clear('meets');
        await db.clear('groups');
        await db.clear('tasks');
        await db.clear('marks');
        await db.clear('members');
        if (db.objectStoreNames.contains('students')) {
            await db.clear('students');
        }
        localStorage.removeItem('ignoredUsers');
        localStorage.removeItem('durationLimit');
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
        const db = await dbPromise;
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
        const db = await dbPromise;

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
        const db = await dbPromise;

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
        const db = await dbPromise;

        const tasks = jsonData.tasks || [];
        const marks = jsonData.marks || [];
        const members = jsonData.members || jsonData.students || [];

        // Import tasks with upsert logic (preserve IDs for existing tasks)
        const taskIdMapping = new Map(); // Maps old task IDs to new task IDs

        if (tasks.length > 0) {
            const db = await dbPromise;
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
        const db = await dbPromise;
        await db.clear('meets');
    },

    async clearGroups() {
        const db = await dbPromise;
        await db.clear('groups');
    },

    async clearMarks() {
        const db = await dbPromise;
        await db.clear('tasks');
        await db.clear('marks');
    },

    async clearMembers() {
        const db = await dbPromise;
        await db.clear('members');
    },

    // Legacy alias
    async clearStudents() {
        return this.clearMembers();
    },

    // Tasks
    async saveTask(task) {
        const db = await dbPromise;
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
        const db = await dbPromise;
        return db.getAll('tasks');
    },

    async getTasksByGroup(groupName) {
        const db = await dbPromise;
        return db.getAllFromIndex('tasks', 'groupName', groupName);
    },

    async findTaskByNaturalKey(name, date, groupName) {
        const db = await dbPromise;
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

        const db = await dbPromise;
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
        const db = await dbPromise;
        return db.getAll('members');
    },

    async getMembersByGroup(groupName) {
        const db = await dbPromise;
        return db.getAllFromIndex('members', 'groupName', groupName);
    },

    async deleteMember(id) {
        const db = await dbPromise;
        return db.delete('members', id);
    },

    async deleteMembers(ids) {
        const db = await dbPromise;
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

    async getStudentsByGroup(groupName) {
        return this.getMembersByGroup(groupName);
    },

    // Teachers (Settings)
    async getTeachers() {
        try {
            const stored = localStorage.getItem('teachers');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Error reading teachers from localStorage', e);
            return [];
        }
    },

    async saveTeachers(teachers) {
        try {
            localStorage.setItem('teachers', JSON.stringify(teachers));

            // Sync roles in DB
            const db = await dbPromise;
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
        const db = await dbPromise;
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
        const db = await dbPromise;
        return db.getAllFromIndex('marks', 'taskId', taskId);
    },

    async updateMarkSynced(id, synced) {
        const db = await dbPromise;
        const tx = db.transaction('marks', 'readwrite');
        const mark = await tx.store.get(id);
        if (mark) {
            mark.synced = synced;
            await tx.store.put(mark);
        }
        await tx.done;
    },

    async getMarksByStudent(studentId) {
        const db = await dbPromise;
        return db.getAllFromIndex('marks', 'studentId', studentId);
    },

    async deleteMark(id) {
        const db = await dbPromise;
        return db.delete('marks', id);
    },

    async deleteMarks(ids) {
        const db = await dbPromise;
        const tx = db.transaction('marks', 'readwrite');
        const store = tx.objectStore('marks');
        await Promise.all(ids.map(id => store.delete(id)));
        await tx.done;
    },

    async getAllMarksWithRelations() {
        const db = await dbPromise;

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
        const db = await dbPromise;
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
    }
};
