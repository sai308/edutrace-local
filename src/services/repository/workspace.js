// workspace.js
import { openDB } from 'idb';
import { DB_VERSION, resetDbConnection, initDbSchema, DEFAULT_DB_NAME } from './db';

const WORKSPACE_KEY = 'edutrace_workspaces';
const CURRENT_WORKSPACE_KEY = 'edutrace_current_workspace';

/**
 * Get all workspaces from localStorage
 * @returns {Array} Array of workspace objects
 */
export function getWorkspaces() {
    try {
        const stored = localStorage.getItem(WORKSPACE_KEY);
        return stored ? JSON.parse(stored) : [{
            id: 'default',
            name: 'Default',
            dbName: DEFAULT_DB_NAME,
            createdAt: new Date().toISOString()
        }];
    } catch (e) {
        console.error('Error retrieving or parsing workspaces from localStorage.', e);
        return [{
            id: 'default',
            name: 'Default',
            dbName: DEFAULT_DB_NAME,
            createdAt: new Date().toISOString()
        }];
    }
}

/**
 * Save workspaces list to localStorage
 * @param {Array} workspaces - Array of workspace objects
 */
export function saveWorkspaces(workspaces) {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspaces));
}

/**
 * Get current workspace ID
 * @returns {string} Current workspace ID
 */
export function getCurrentWorkspaceId() {
    return localStorage.getItem(CURRENT_WORKSPACE_KEY) || 'default';
}

/**
 * Set current workspace ID
 * @param {string} id - Workspace ID
 */
export function setCurrentWorkspaceId(id) {
    localStorage.setItem(CURRENT_WORKSPACE_KEY, id);
}

/**
 * Create a new workspace
 */
export async function createWorkspace(name, options = {}) {
    const workspaces = getWorkspaces();
    const id = crypto.randomUUID();
    const newWorkspace = {
        id,
        name,
        icon: options.icon || 'Database',
        dbName: `meet-attendance-db-${id}`,
        createdAt: new Date().toISOString()
    };
    workspaces.push(newWorkspace);
    saveWorkspaces(workspaces);

    if (options.exportSettings && options.getSettings && options.saveSettings) {
        // 1. Get current settings from original workspace
        const settings = await options.getSettings();

        // 2. Switch to new workspace temporarily
        const originalWorkspaceId = getCurrentWorkspaceId();
        setCurrentWorkspaceId(id);
        await resetDbConnection();

        // 3. Save settings to new workspace (via scoped localStorage keys)
        await options.saveSettings(settings);

        // 4. Restore original workspace
        setCurrentWorkspaceId(originalWorkspaceId);
        await resetDbConnection();
    }

    return id;
}

/**
 * Update workspace metadata
 */
export async function updateWorkspace(id, updates) {
    const workspaces = getWorkspaces();
    const index = workspaces.findIndex(w => w.id === id);

    if (index === -1) {
        throw new Error('Workspace not found');
    }

    // Prevent updating default workspace ID or dbName
    const { id: _, dbName: __, ...allowedUpdates } = updates;

    workspaces[index] = {
        ...workspaces[index],
        ...allowedUpdates,
        updatedAt: new Date().toISOString()
    };

    saveWorkspaces(workspaces);
    return workspaces[index];
}

/**
 * Switch to a different workspace
 */
export async function switchWorkspace(id, onLoading = () => { }) {
    const workspaces = getWorkspaces();
    if (!workspaces.find(w => w.id === id)) {
        throw new Error('Workspace not found');
    }
    setCurrentWorkspaceId(id);
    await resetDbConnection();
    onLoading();
}

/**
 * Delete a workspace and its database
 */
export async function deleteWorkspace(id) {
    if (id === 'default') {
        throw new Error('Cannot delete default workspace');
    }

    const workspaces = getWorkspaces();
    const workspace = workspaces.find(w => w.id === id);
    if (!workspace) return;

    // 1. Delete DB (requires no open connections)
    await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase(workspace.dbName);
        req.onsuccess = () => resolve();
        req.onerror = (e) => {
            console.error(`Error deleting DB ${workspace.dbName}:`, e);
            reject(e);
        };
        req.onblocked = () => {
            console.warn(`Deletion of ${workspace.dbName} blocked. Ensure all connections are closed.`);
            resolve(); // Resolve anyway, as it might be deleted later by the browser
        };
    });


    // 2. Update list
    const newWorkspaces = workspaces.filter(w => w.id !== id);
    saveWorkspaces(newWorkspaces);

    // 3. If current was deleted, switch to default
    if (getCurrentWorkspaceId() === id) {
        await switchWorkspace('default');
    }
}

/**
 * Export multiple workspaces to backup file
 */
export async function exportWorkspaces(workspaceIds) {
    const allWorkspaces = getWorkspaces();
    const workspacesToExport = allWorkspaces.filter(w => workspaceIds.includes(w.id));

    const exportData = {
        type: 'multi-workspace-backup',
        version: 1,
        timestamp: new Date().toISOString(),
        workspaces: []
    };

    const storeNames = ['meets', 'groups', 'tasks', 'marks', 'members'];

    for (const ws of workspacesToExport) {
        let db;
        try {
            // Open DB instance (no upgrade needed for read-only operation)
            db = await openDB(ws.dbName, DB_VERSION);

            // Fetch all data in parallel
            const [meets, groups, tasks, marks, members] = await Promise.all(
                storeNames.map(name => db.getAll(name))
            );

            exportData.workspaces.push({
                id: ws.id,
                name: ws.name,
                icon: ws.icon,
                dbName: ws.dbName,
                data: { meets, groups, tasks, marks, members }
            });
        } catch (e) {
            console.error(`Error exporting data for workspace ${ws.name}:`, e);
            // Continue to next workspace
        } finally {
            if (db) db.close();
        }
    }

    return exportData;
}

/**
 * Import workspaces from backup file
 */
export async function importWorkspaces(data, selectedIds) {
    if (!data.workspaces || !Array.isArray(data.workspaces)) {
        throw new Error('Invalid workspace backup format');
    }

    const workspacesToImport = data.workspaces.filter(w => selectedIds.includes(w.id));
    const currentWorkspaces = getWorkspaces();

    for (const wsData of workspacesToImport) {
        // 1. Find or Create Workspace Entry
        let targetWs = currentWorkspaces.find(w => w.id === wsData.id);

        if (!targetWs) {
            targetWs = {
                id: wsData.id,
                name: wsData.name,
                icon: wsData.icon || 'Database',
                dbName: wsData.dbName || `meet-attendance-db-${wsData.id}`,
                createdAt: new Date().toISOString()
            };
            currentWorkspaces.push(targetWs);
            saveWorkspaces(currentWorkspaces);
        } else {
            // If workspace exists, update metadata (name/icon)
            targetWs = { ...targetWs, name: wsData.name, icon: wsData.icon || 'Database' };
        }

        // 2. Import data into workspace's DB
        let db;
        try {
            // Open DB, initialize schema if necessary
            db = await openDB(targetWs.dbName, DB_VERSION, { upgrade: initDbSchema });

            const storeNames = ['meets', 'groups', 'tasks', 'marks', 'members'];
            const tx = db.transaction(storeNames, 'readwrite');

            // Clear existing data
            await Promise.all(storeNames.map(name => tx.objectStore(name).clear()));

            // Import new data
            const { meets, groups, tasks, marks, members } = wsData.data;

            const importPromises = [];

            if (meets) importPromises.push(...meets.map(m => tx.objectStore('meets').put(m)));
            if (groups) importPromises.push(...groups.map(g => tx.objectStore('groups').put(g)));
            if (tasks) importPromises.push(...tasks.map(t => tx.objectStore('tasks').put(t)));
            if (marks) importPromises.push(...marks.map(m => tx.objectStore('marks').put(m)));
            if (members) importPromises.push(...members.map(m => tx.objectStore('members').put(m)));

            await Promise.all(importPromises);
            await tx.done;
        } catch (e) {
            console.error(`Error importing data into workspace ${targetWs.name}:`, e);
        } finally {
            if (db) db.close();
        }
    }
}

/**
 * Clear data from specific workspaces
 */
export async function deleteWorkspacesData(workspaceIds) {
    const workspaces = getWorkspaces();
    const storeNames = ['meets', 'groups', 'tasks', 'marks', 'members'];

    for (const id of workspaceIds) {
        const workspace = workspaces.find(w => w.id === id);
        if (!workspace) continue;

        let db;
        try {
            // Open the workspace database (ensure schema is up-to-date)
            db = await openDB(workspace.dbName, DB_VERSION, { upgrade: initDbSchema });

            // Clear all data from the workspace
            const tx = db.transaction(storeNames, 'readwrite');
            await Promise.all(storeNames.map(name => tx.objectStore(name).clear()));
            await tx.done;
        } catch (e) {
            console.error(`Error clearing data for workspace ${workspace.name}:`, e);
        } finally {
            if (db) db.close();
        }
    }
}

/**
 * Calculate storage size for all workspaces
 */
export async function getAllWorkspacesSizes() {
    const workspaces = getWorkspaces();
    const results = [];
    let total = 0;
    const storeNames = ['meets', 'groups', 'tasks', 'marks', 'members'];

    const getSize = (data) => {
        try {
            return new Blob([JSON.stringify(data)]).size;
        } catch (e) {
            return 0;
        }
    };

    for (const ws of workspaces) {
        let db;
        try {
            db = await openDB(ws.dbName, DB_VERSION, { upgrade: initDbSchema });

            // Ensure all stores exist before querying them
            const missingStores = storeNames.filter(name => !db.objectStoreNames.contains(name));
            if (missingStores.length > 0) {
                console.warn(`Workspace ${ws.name} is missing stores: ${missingStores.join(', ')}. Size estimated at 0.`);
                results.push({ id: ws.id, name: ws.name, size: 0, error: true, missing: missingStores });
                continue;
            }

            const dataPromises = storeNames.map(name => db.getAll(name));
            const [meets, groups, tasks, marks, members] = await Promise.all(dataPromises);

            const size = getSize(meets) + getSize(groups) + getSize(tasks) + getSize(marks) + getSize(members);
            total += size;
            results.push({ id: ws.id, name: ws.name, size: size });
        } catch (e) {
            console.error(`Error calculating size for workspace ${ws.name}:`, e);
            results.push({ id: ws.id, name: ws.name, size: 0, error: true });
        } finally {
            if (db) db.close();
        }
    }

    return { total, workspaces: results };
}