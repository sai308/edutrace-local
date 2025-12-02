import { beforeEach, vi } from 'vitest';
import { resetDbConnection, DEFAULT_DB_NAME } from '~repository/db';

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
    for (const name of TEST_DB_NAMES) {
        try {
            indexedDB.deleteDatabase(name);
        } catch {
            // ignore in tests
        }
    }

    // If fake-indexeddb ever supports indexedDB.databases(), you could
    // also enumerate and delete everything dynamically.
}

beforeEach(async () => {
    // reset db connection
    await resetDbConnection();

    // reset indexeddb
    await resetIndexedDb();

    // jsdom localStorage – safe & test-only
    localStorage.clear();

    // Drop cached modules so repository singletons are rebuilt per test
    vi.resetModules();
});
