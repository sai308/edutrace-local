import { openDB } from 'idb';
import { local as storage } from '@/shared/services/StorageService';

/**
 * @typedef {import('idb').IDBPDatabase} IDBPDatabase
 * @typedef {import('idb').IDBPTransaction} IDBPTransaction
 */

export const DB_VERSION = 11;
export const DEFAULT_DB_NAME = 'meet-attendance-db';

class DatabaseService {
    constructor() {
        this._dbPromise = null;
        this._currentDbName = null;
    }

    /**
     * Get database name for current workspace
     */
    getCurrentDbName() {
        if (this._currentDbName) return this._currentDbName;

        try {
            // Use StorageService to get current workspace ID and list
            const currentId = storage.get('edutrace_current_workspace', 'default');

            if (!currentId || currentId === 'default') {
                this._currentDbName = DEFAULT_DB_NAME;
                return DEFAULT_DB_NAME;
            }

            const workspaces = storage.get('edutrace_workspaces', []);
            const workspace = workspaces.find((w) => w.id === currentId);

            if (workspace && workspace.dbName) {
                this._currentDbName = workspace.dbName;
                return workspace.dbName;
            }

            this._currentDbName = DEFAULT_DB_NAME;
            return DEFAULT_DB_NAME;

        } catch (e) {
            console.error('Error determining workspace DB, falling back to default.', e);
            return DEFAULT_DB_NAME;
        }
    }

    /**
     * reset database connection
     */
    async resetConnection() {
        if (this._dbPromise) {
            try {
                const db = await this._dbPromise;
                db.close();
                // Add a delay to ensure fake-indexeddb cleans up properly
                await new Promise(resolve => setTimeout(resolve, 10));
            } catch (e) {
                console.warn('Error closing DB connection during reset:', e);
            }
        }
        this._dbPromise = null;
        this._currentDbName = null;
    }

    /**
     * Initialize database schema
     * @param {IDBDatabase} db 
     * @param {number} oldVersion 
     * @param {number} newVersion 
     * @param {IDBTransaction} transaction 
     */
    async initSchema(db, oldVersion, newVersion, transaction) {
        // Meets Store
        if (!db.objectStoreNames.contains('meets')) {
            const meetStore = db.createObjectStore('meets', { keyPath: 'id' });
            meetStore.createIndex('meetId', 'meetId', { unique: false });
            meetStore.createIndex('date', 'date', { unique: false });
        }

        // Settings Store
        if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Groups Store
        if (!db.objectStoreNames.contains('groups')) {
            const store = db.createObjectStore('groups', { keyPath: 'id' });
            store.createIndex('meetId', 'meetId', { unique: true });
            store.createIndex('name', 'name', { unique: true });
        } else if (oldVersion < 9) {
            const store = transaction.objectStore('groups');

            if (oldVersion < 7 && store.indexNames.contains('meetId')) {
                store.deleteIndex('meetId');
                store.createIndex('meetId', 'meetId', { unique: true });
            }
            if (!store.indexNames.contains('name')) {
                store.createIndex('name', 'name', { unique: true });
            }

            if (oldVersion < 8) {
                let cursor = await store.openCursor();
                while (cursor) {
                    const group = cursor.value;
                    let updated = false;

                    if (!group.course && group.name) {
                        const match = group.name.match(/\d/);
                        if (match) {
                            const course = parseInt(match[0], 10);
                            if (course >= 1 && course <= 4) {
                                group.course = course;
                                updated = true;
                            }
                        }
                    }

                    if (updated) {
                        await cursor.update(group);
                    }
                    cursor = await cursor.continue();
                }
            }
        }

        // Tasks Store
        if (!db.objectStoreNames.contains('tasks')) {
            const store = db.createObjectStore('tasks', {
                keyPath: 'id',
                autoIncrement: true,
            });
            store.createIndex('groupId', 'groupId', { unique: false });
            store.createIndex('name_date_group', ['name', 'date', 'groupName'], {
                unique: true,
            });
            store.createIndex('groupName', 'groupName', { unique: false });
        } else if (oldVersion < 9) {
            const store = transaction.objectStore('tasks');

            if (!store.indexNames.contains('groupName')) {
                store.createIndex('groupName', 'groupName', { unique: false });
            }

            if (store.indexNames.contains('name_date_group') && oldVersion < 9) {
                store.deleteIndex('name_date_group');
                store.createIndex('name_date_group', ['name', 'date', 'groupName'], {
                    unique: true,
                });
            } else if (!store.indexNames.contains('name_date_group')) {
                store.createIndex('name_date_group', ['name', 'date', 'groupName'], {
                    unique: true,
                });
            }
        }

        // Marks Store
        if (!db.objectStoreNames.contains('marks')) {
            const store = db.createObjectStore('marks', {
                keyPath: 'id',
                autoIncrement: true,
            });
            store.createIndex('taskId', 'taskId', { unique: false });
            store.createIndex('studentId', 'studentId', { unique: false });
            store.createIndex('task_student', ['taskId', 'studentId'], {
                unique: true,
            });
            store.createIndex('createdAt', 'createdAt', { unique: false });
        } else if (oldVersion < 9) {
            const store = transaction.objectStore('marks');
            if (!store.indexNames.contains('createdAt')) {
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        }

        // Members Store
        if (!db.objectStoreNames.contains('members')) {
            const store = db.createObjectStore('members', {
                keyPath: 'id',
                autoIncrement: true,
            });
            store.createIndex('name', 'name', { unique: true });
            store.createIndex('groupName', 'groupName', { unique: false });
            store.createIndex('role', 'role', { unique: false });
        }

        // Legacy 'students' drop
        if (oldVersion < 9 && db.objectStoreNames.contains('students')) {
            db.deleteObjectStore('students');
        }

        // Modules Store
        if (!db.objectStoreNames.contains('modules')) {
            const store = db.createObjectStore('modules', {
                keyPath: 'id',
                autoIncrement: true,
            });
            store.createIndex('groupId', 'groupId', { unique: false });
            store.createIndex('groupName', 'groupName', { unique: false });
        } else if (oldVersion < 10) {
            const store = transaction.objectStore('modules');
            if (!store.indexNames.contains('groupId')) {
                store.createIndex('groupId', 'groupId', { unique: false });
            }
            if (!store.indexNames.contains('groupName')) {
                store.createIndex('groupName', 'groupName', { unique: false });
            }
        }

        // FinalAssessments Store
        if (!db.objectStoreNames.contains('finalAssessments')) {
            const store = db.createObjectStore('finalAssessments', {
                keyPath: 'id',
                autoIncrement: true,
            });
            store.createIndex('studentId', 'studentId', { unique: false });
            store.createIndex('assessmentType', 'assessmentType', { unique: false });
            store.createIndex('student_type', ['studentId', 'assessmentType'], {
                unique: true,
            });
        }
    }

    /**
     * Get DB instance
     * @returns {Promise<IDBPDatabase>}
     */
    getDb() {
        const dbName = this.getCurrentDbName();

        if (this._dbPromise && this._currentDbName === dbName) {
            return this._dbPromise;
        }

        this._currentDbName = dbName;
        this._dbPromise = openDB(dbName, DB_VERSION, {
            upgrade: this.initSchema.bind(this),
        });

        return this._dbPromise;
    }
}

export const databaseService = new DatabaseService();
