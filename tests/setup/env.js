import { beforeEach, vi } from 'vitest';
import { databaseService, DEFAULT_DB_NAME } from '@/shared/services/DatabaseService';
import 'fake-indexeddb/auto';

// Mock Worker globally for JSDOM
if (typeof Worker === 'undefined') {
    global.Worker = class {
        constructor() { }
        postMessage() { }
        onmessage() { }
        terminate() { }
    };
}

// Define a mock implementation for the File constructor
const FileMock = class File {
    constructor(chunks, fileName, options = {}) {
        this.chunks = chunks;
        this.fileName = fileName;
        this.options = options;
    }
    // Add other properties or methods as needed by your application
    size() { return this.chunks.join('').length } // Simple size calculation
    text() { return Promise.resolve(this.chunks.join('')) }
    arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)) }
    slice() { return this }
}

vi.stubGlobal('File', FileMock)

// Optional helper if you want a single place to maintain DB names
const TEST_DB_NAMES = [
    DEFAULT_DB_NAME,
    'test-migration-groups',
    'test-migration-tasks',
    'test-migration-marks',
    'test-migration-students',
];

async function resetIndexedDb() {
    // best-effort cleanup: delete all known DBs
    // With fake-indexeddb, we might need to be careful, but deleteDatabase works.
    for (const name of TEST_DB_NAMES) {
        try {
            indexedDB.deleteDatabase(name);
        } catch {
            // ignore in tests
        }
    }
}

beforeEach(async () => {
    // reset db connection
    await databaseService.resetConnection();

    // reset indexeddb
    await resetIndexedDb();

    // jsdom localStorage – safe & test-only
    localStorage.clear();
    sessionStorage.clear();

    // Drop cached modules so repository singletons are rebuilt per test
    vi.resetModules();
});
