// db.js
import { openDB } from 'idb';
import { getCurrentWorkspaceId } from './workspace';

export const DB_VERSION = 11;
export const DEFAULT_DB_NAME = 'meet-attendance-db';

// Dynamic DB Connection Cache
let _dbPromise = null;
let _currentDbName = null;

/**
 * Get database name for current workspace
 */
export function getCurrentDbName() {
    const currentId = getCurrentWorkspaceId();
    const stored = localStorage.getItem('edutrace_workspaces');

    try {
        const workspaces = stored
            ? JSON.parse(stored)
            : [
                {
                    id: 'default',
                    name: 'Default',
                    dbName: DEFAULT_DB_NAME,
                    createdAt: new Date().toISOString(),
                },
            ];

        const workspace = workspaces.find((w) => w.id === currentId);
        return workspace ? workspace.dbName : DEFAULT_DB_NAME;
    } catch (e) {
        // Corrupted JSON or unexpected shape – fall back to default DB
        console.error('Error parsing workspace list, falling back to default DB.', e);
        return DEFAULT_DB_NAME;
    }
}

/**
 * Reset database connection (used when switching workspaces or between tests)
 */
export async function resetDbConnection() {
    if (_dbPromise) {
        try {
            // Await the promise to get the actual DB instance
            const db = await _dbPromise;
            // Explicitly close the connection to release the lock
            db.close();
            // Add a delay to ensure fake-indexeddb cleans up properly
            await new Promise(resolve => setTimeout(resolve, 10));
        } catch (e) {
            console.warn('Error closing DB connection during reset:', e);
        }
    }

    _dbPromise = null;
    _currentDbName = null;
}
/**
 * Initialize database schema and run migrations
 * Shared upgrade logic used by both main DB connection and workspace operations
 * @param {IDBDatabase} db - IndexedDB database instance
 * @param {number} oldVersion - Previous schema version
 * @param {number} newVersion - Target schema version
 * @param {IDBTransaction} transaction - Upgrade transaction
 */
export async function initDbSchema(db, oldVersion, newVersion, transaction) {
    // Meets Store
    if (!db.objectStoreNames.contains('meets')) {
        const meetStore = db.createObjectStore('meets', { keyPath: 'id' });
        meetStore.createIndex('meetId', 'meetId', { unique: false });
        meetStore.createIndex('date', 'date', { unique: false });
    }

    // Settings Store (Currently unused, but maintained for structure)
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

        // Migration: Ensure meetId and name indexes are correct
        if (oldVersion < 7 && store.indexNames.contains('meetId')) {
            store.deleteIndex('meetId');
            store.createIndex('meetId', 'meetId', { unique: true });
        }
        if (!store.indexNames.contains('name')) {
            store.createIndex('name', 'name', { unique: true });
        }

        // Migration: Backfill course for groups (v8)
        if (oldVersion < 8) {
            let cursor = await store.openCursor();
            while (cursor) {
                const group = cursor.value;
                let updated = false;

                if (!group.course && group.name) {
                    // Try to extract course from name (e.g. KH-41 -> 4)
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
                    // Update must be awaited inside the upgrade transaction
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
        // Natural key: (name, date, groupName)
        store.createIndex('name_date_group', ['name', 'date', 'groupName'], {
            unique: true,
        });
        store.createIndex('groupName', 'groupName', { unique: false });
    } else if (oldVersion < 9) {
        const store = transaction.objectStore('tasks');

        // Ensure groupName index exists
        if (!store.indexNames.contains('groupName')) {
            store.createIndex('groupName', 'groupName', { unique: false });
        }

        // Migration: Ensure composite index uses (name, date, groupName)
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

    // Members Store (formerly students)
    if (!db.objectStoreNames.contains('members')) {
        const store = db.createObjectStore('members', {
            keyPath: 'id',
            autoIncrement: true,
        });
        store.createIndex('name', 'name', { unique: true }); // Name should be unique for merging
        store.createIndex('groupName', 'groupName', { unique: false });
        store.createIndex('role', 'role', { unique: false });
    }

    // Drop legacy 'students' store
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
        // Composite unique index: one grade per student per assessment type
        store.createIndex('student_type', ['studentId', 'assessmentType'], {
            unique: true,
        });
    }
}

/**
 * Internal helper to (re)create DB connection for current workspace
 */
function createDb() {
    const dbName = getCurrentDbName();
    _currentDbName = dbName;

    _dbPromise = openDB(dbName, DB_VERSION, {
        upgrade: initDbSchema,
    });

    return _dbPromise;
}

/**
 * Get IndexedDB connection for current workspace
 * Always use this from repositories instead of importing a raw promise.
 */
export function getDb() {
    const dbName = getCurrentDbName();

    if (_dbPromise && _currentDbName === dbName) {
        return _dbPromise;
    }

    return createDb();
}