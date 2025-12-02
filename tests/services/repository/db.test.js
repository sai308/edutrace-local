import { describe, it, expect, beforeEach } from 'vitest';
import { openDB } from 'idb';
import {
    getDb,
    getCurrentDbName,
    resetDbConnection,
    initDbSchema,
    DB_VERSION,
    DEFAULT_DB_NAME,
} from '~repository/db';

describe('db.js - Schema & Connection', () => {
    beforeEach(async () => {
        localStorage.clear();
        await resetDbConnection();
    });

    describe('getCurrentDbName', () => {
        it('should return DEFAULT_DB_NAME when no workspaces configured', () => {
            const dbName = getCurrentDbName();
            expect(dbName).toBe(DEFAULT_DB_NAME);
        });

        it('should return DEFAULT_DB_NAME for default workspace', () => {
            localStorage.setItem('edutrace_current_workspace', 'default');
            localStorage.setItem(
                'edutrace_workspaces',
                JSON.stringify([
                    { id: 'default', name: 'Default', dbName: DEFAULT_DB_NAME, createdAt: new Date().toISOString() },
                ])
            );

            const dbName = getCurrentDbName();
            expect(dbName).toBe(DEFAULT_DB_NAME);
        });

        it('should return custom dbName for custom workspace', () => {
            const customDbName = 'meet-attendance-db-test';
            localStorage.setItem('edutrace_current_workspace', 'testWs');
            localStorage.setItem(
                'edutrace_workspaces',
                JSON.stringify([
                    { id: 'default', name: 'Default', dbName: DEFAULT_DB_NAME, createdAt: new Date().toISOString() },
                    { id: 'testWs', name: 'Test Workspace', dbName: customDbName, createdAt: new Date().toISOString() },
                ])
            );

            const dbName = getCurrentDbName();
            expect(dbName).toBe(customDbName);
        });

        it('should handle corrupted workspace data gracefully', () => {
            localStorage.setItem('edutrace_workspaces', 'invalid-json');
            const dbName = getCurrentDbName();
            expect(dbName).toBe(DEFAULT_DB_NAME);
        });
    });

    describe('Initial Schema Creation', () => {
        it('should create all required stores and indexes', async () => {
            const db = await getDb();

            // Check all stores exist
            expect(db.objectStoreNames.contains('meets')).toBe(true);
            expect(db.objectStoreNames.contains('settings')).toBe(true);
            expect(db.objectStoreNames.contains('groups')).toBe(true);
            expect(db.objectStoreNames.contains('tasks')).toBe(true);
            expect(db.objectStoreNames.contains('marks')).toBe(true);
            expect(db.objectStoreNames.contains('members')).toBe(true);

            // Check meets store indexes
            const tx = db.transaction('meets', 'readonly');
            const meetStore = tx.objectStore('meets');
            expect(meetStore.indexNames.contains('meetId')).toBe(true);
            expect(meetStore.indexNames.contains('date')).toBe(true);
            await tx.done;

            // Check groups store indexes
            const groupTx = db.transaction('groups', 'readonly');
            const groupStore = groupTx.objectStore('groups');
            expect(groupStore.indexNames.contains('meetId')).toBe(true);
            expect(groupStore.indexNames.contains('name')).toBe(true);
            await groupTx.done;

            // Check tasks store indexes
            const taskTx = db.transaction('tasks', 'readonly');
            const taskStore = taskTx.objectStore('tasks');
            expect(taskStore.indexNames.contains('groupName')).toBe(true);
            expect(taskStore.indexNames.contains('name_date_group')).toBe(true);
            await taskTx.done;

            // Check marks store indexes
            const markTx = db.transaction('marks', 'readonly');
            const markStore = markTx.objectStore('marks');
            expect(markStore.indexNames.contains('taskId')).toBe(true);
            expect(markStore.indexNames.contains('studentId')).toBe(true);
            expect(markStore.indexNames.contains('task_student')).toBe(true);
            expect(markStore.indexNames.contains('createdAt')).toBe(true);
            await markTx.done;

            // Check members store indexes
            const memberTx = db.transaction('members', 'readonly');
            const memberStore = memberTx.objectStore('members');
            expect(memberStore.indexNames.contains('name')).toBe(true);
            expect(memberStore.indexNames.contains('groupName')).toBe(true);
            expect(memberStore.indexNames.contains('role')).toBe(true);
            await memberTx.done;

            db.close();
        });
    });

    describe('Groups Store Migration', () => {
        it('should add course field based on group name during migration', async () => {
            // Create DB with old version
            const dbName = 'test-migration-groups';
            const oldDb = await openDB(dbName, 7, {
                upgrade(db, oldVersion) {
                    if (!db.objectStoreNames.contains('groups')) {
                        const store = db.createObjectStore('groups', { keyPath: 'id' });
                        store.createIndex('meetId', 'meetId', { unique: false });
                        store.createIndex('name', 'name', { unique: true });
                    }
                },
            });

            // Insert group without course
            await oldDb.add('groups', { id: 'g1', name: 'KH-41', meetId: 'm1' });
            await oldDb.add('groups', { id: 'g2', name: 'KH-22', meetId: 'm2' });
            await oldDb.add('groups', { id: 'g3', name: 'NoDigit', meetId: 'm3' });
            oldDb.close();

            // Upgrade to new version
            const newDb = await openDB(dbName, 8, {
                upgrade: initDbSchema,
            });

            // Check migration results
            const g1 = await newDb.get('groups', 'g1');
            expect(g1.course).toBe(4); // First digit is 4

            const g2 = await newDb.get('groups', 'g2');
            expect(g2.course).toBe(2); // First digit is 2

            const g3 = await newDb.get('groups', 'g3');
            expect(g3.course).toBeUndefined(); // No digit found

            newDb.close();
            await indexedDB.deleteDatabase(dbName);
        });
    });

    describe('Tasks Store Migration', () => {
        it('should add groupName index and update composite index', async () => {
            const dbName = 'test-migration-tasks';

            // Create old version without groupName index
            const oldDb = await openDB(dbName, 5, {
                upgrade(db) {
                    if (!db.objectStoreNames.contains('tasks')) {
                        const store = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('groupId', 'groupId', { unique: false });
                    }
                },
            });
            oldDb.close();

            // Upgrade to new version
            const newDb = await openDB(dbName, DB_VERSION, {
                upgrade: initDbSchema,
            });

            const tx = newDb.transaction('tasks', 'readonly');
            const store = tx.objectStore('tasks');

            expect(store.indexNames.contains('groupName')).toBe(true);
            expect(store.indexNames.contains('name_date_group')).toBe(true);

            await tx.done;
            newDb.close();
            await indexedDB.deleteDatabase(dbName);
        });
    });

    describe('Marks Store Migration', () => {
        it('should add createdAt index during migration', async () => {
            const dbName = 'test-migration-marks';

            // Create old version without createdAt index
            const oldDb = await openDB(dbName, 3, {
                upgrade(db) {
                    if (!db.objectStoreNames.contains('marks')) {
                        const store = db.createObjectStore('marks', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('taskId', 'taskId', { unique: false });
                        store.createIndex('studentId', 'studentId', { unique: false });
                        store.createIndex('task_student', ['taskId', 'studentId'], { unique: true });
                    }
                },
            });
            oldDb.close();

            // Upgrade to new version
            const newDb = await openDB(dbName, DB_VERSION, {
                upgrade: initDbSchema,
            });

            const tx = newDb.transaction('marks', 'readonly');
            const store = tx.objectStore('marks');

            expect(store.indexNames.contains('createdAt')).toBe(true);

            await tx.done;
            newDb.close();
            await indexedDB.deleteDatabase(dbName);
        });
    });

    describe('Drop Legacy Students Store', () => {
        it('should remove students store during migration to v9', async () => {
            const dbName = 'test-migration-students';

            // Create old version with students store
            const oldDb = await openDB(dbName, 8, {
                upgrade(db, oldVersion) {
                    // Create students store (legacy)
                    if (!db.objectStoreNames.contains('students')) {
                        db.createObjectStore('students', { keyPath: 'id', autoIncrement: true });
                    }
                    // Create other required stores for version 8
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
                        store.createIndex('name_date_group', ['name', 'date', 'groupName'], { unique: true });
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
                },
            });

            expect(oldDb.objectStoreNames.contains('students')).toBe(true);
            oldDb.close();

            // Upgrade to v9
            const newDb = await openDB(dbName, DB_VERSION, {
                upgrade: initDbSchema,
            });

            expect(newDb.objectStoreNames.contains('students')).toBe(false);
            expect(newDb.objectStoreNames.contains('members')).toBe(true);

            newDb.close();
            await indexedDB.deleteDatabase(dbName);
        });
    });

    describe('getDb Caching', () => {
        it('should cache database connection for same workspace', async () => {
            localStorage.setItem('edutrace_current_workspace', 'default');

            const db1 = await getDb();
            const db2 = await getDb();

            // Should return the same promise/connection
            expect(db1).toBe(db2);

            db1.close();
        });

        it('should create new connection after resetDbConnection', async () => {
            const db1 = await getDb();
            const dbName1 = db1.name;
            db1.close();

            await resetDbConnection();

            const db2 = await getDb();
            const dbName2 = db2.name;

            // Should be same dbName but different connection
            expect(dbName1).toBe(dbName2);
            // Note: We can't easily test that they're different instances with fake-indexeddb
            // but we can verify resetDbConnection clears the cache

            db2.close();
        });

        it('should use correct dbName for different workspaces', async () => {
            // Set up default workspace
            localStorage.setItem('edutrace_current_workspace', 'default');
            localStorage.setItem(
                'edutrace_workspaces',
                JSON.stringify([
                    { id: 'default', name: 'Default', dbName: DEFAULT_DB_NAME, createdAt: new Date().toISOString() },
                    { id: 'ws1', name: 'Workspace 1', dbName: 'meet-attendance-db-ws1', createdAt: new Date().toISOString() },
                ])
            );

            const db1 = await getDb();
            expect(db1.name).toBe(DEFAULT_DB_NAME);
            db1.close();

            // Switch workspace
            localStorage.setItem('edutrace_current_workspace', 'ws1');
            await resetDbConnection();

            const db2 = await getDb();
            expect(db2.name).toBe('meet-attendance-db-ws1');
            db2.close();

            // Clean up
            await indexedDB.deleteDatabase('meet-attendance-db-ws1');
        });
    });
});
