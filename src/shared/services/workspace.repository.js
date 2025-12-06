import { openDB } from 'idb';
import { databaseService, DB_VERSION, DEFAULT_DB_NAME } from './DatabaseService';
import { local as storage } from './StorageService';

// Workspace logic uses DB creation/deletion which is lower level.
// It also interacts with Settings.

const WORKSPACE_KEY = 'edutrace_workspaces';
const CURRENT_WORKSPACE_KEY = 'edutrace_current_workspace';

export class WorkspaceRepository {

    getWorkspaces() {
        return storage.get(WORKSPACE_KEY, [{
            id: 'default',
            name: 'Default',
            dbName: DEFAULT_DB_NAME,
            createdAt: new Date().toISOString()
        }]);
    }

    saveWorkspaces(workspaces) {
        storage.set(WORKSPACE_KEY, workspaces);
    }

    getCurrentWorkspaceId() {
        return storage.get(CURRENT_WORKSPACE_KEY, 'default');
    }

    setCurrentWorkspaceId(id) {
        storage.set(CURRENT_WORKSPACE_KEY, id);
    }

    async createWorkspace(name, options = {}) {
        const workspaces = this.getWorkspaces();
        const id = crypto.randomUUID();
        const newWorkspace = {
            id,
            name,
            icon: options.icon || 'Database',
            dbName: `meet-attendance-db-${id}`,
            createdAt: new Date().toISOString()
        };
        workspaces.push(newWorkspace);
        this.saveWorkspaces(workspaces);

        if (options.exportSettings && options.getSettings && options.saveSettings) {
            const settings = await options.getSettings();

            const originalWorkspaceId = this.getCurrentWorkspaceId();
            this.setCurrentWorkspaceId(id);
            await databaseService.resetConnection();

            await options.saveSettings(settings);

            this.setCurrentWorkspaceId(originalWorkspaceId);
            await databaseService.resetConnection();
        }

        return id;
    }

    async updateWorkspace(id, updates) {
        const workspaces = this.getWorkspaces();
        const index = workspaces.findIndex(w => w.id === id);

        if (index === -1) {
            throw new Error('Workspace not found');
        }

        const { id: _, dbName: __, ...allowedUpdates } = updates;

        workspaces[index] = {
            ...workspaces[index],
            ...allowedUpdates,
            updatedAt: new Date().toISOString()
        };

        this.saveWorkspaces(workspaces);
        return workspaces[index];
    }

    async switchWorkspace(id, onLoading = () => { }) {
        const workspaces = this.getWorkspaces();
        if (!workspaces.find(w => w.id === id)) {
            throw new Error('Workspace not found');
        }
        this.setCurrentWorkspaceId(id);
        await databaseService.resetConnection();
        onLoading();
    }

    async deleteWorkspace(id) {
        if (id === 'default') {
            throw new Error('Cannot delete default workspace');
        }

        const workspaces = this.getWorkspaces();
        const workspace = workspaces.find(w => w.id === id);
        if (!workspace) return;

        await new Promise((resolve, reject) => {
            const req = indexedDB.deleteDatabase(workspace.dbName);
            req.onsuccess = () => resolve();
            req.onerror = (e) => {
                console.error(`Error deleting DB ${workspace.dbName}:`, e);
                reject(e);
            };
            req.onblocked = () => {
                console.warn(`Deletion of ${workspace.dbName} blocked.`);
                resolve();
            };
        });

        const newWorkspaces = workspaces.filter(w => w.id !== id);
        this.saveWorkspaces(newWorkspaces);

        if (this.getCurrentWorkspaceId() === id) {
            await this.switchWorkspace('default');
        }
    }

    async deleteWorkspacesData(workspaceIds) {
        const workspaces = this.getWorkspaces();
        const storeNames = ['meets', 'groups', 'tasks', 'marks', 'members'];

        for (const id of workspaceIds) {
            const workspace = workspaces.find(w => w.id === id);
            if (!workspace) continue;

            let db;
            try {
                // We open specific DB, not the current one.
                db = await openDB(workspace.dbName, DB_VERSION, { upgrade: databaseService.initSchema.bind(databaseService) });

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

    async exportWorkspaces(workspaceIds) {
        const allWorkspaces = this.getWorkspaces();
        const workspacesToExport = allWorkspaces.filter(w => workspaceIds.includes(w.id));

        const exportData = {
            type: 'multi-workspace-backup',
            version: 1,
            timestamp: new Date().toISOString(),
            workspaces: []
        };

        const storeNames = ['meets', 'groups', 'tasks', 'marks', 'members', 'finalAssessments', 'modules'];

        for (const ws of workspacesToExport) {
            let db;
            try {
                db = await openDB(ws.dbName, DB_VERSION);
                const [meets, groups, tasks, marks, members, finalAssessments, modules] = await Promise.all(
                    storeNames.map(name => db.getAll(name))
                );

                exportData.workspaces.push({
                    id: ws.id,
                    name: ws.name,
                    icon: ws.icon,
                    dbName: ws.dbName,
                    data: { meets, groups, tasks, marks, members, finalAssessments, modules }
                });
            } catch (e) {
                console.error(`Error exporting data for workspace ${ws.name}:`, e);
            } finally {
                if (db) db.close();
            }
        }
        return exportData;
    }

    async importWorkspaces(data, selectedIds) {
        if (!data.workspaces || !Array.isArray(data.workspaces)) {
            throw new Error('Invalid workspace backup format');
        }

        const workspacesToImport = data.workspaces.filter(w => selectedIds.includes(w.id));
        const currentWorkspaces = this.getWorkspaces();

        for (const wsData of workspacesToImport) {
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
                this.saveWorkspaces(currentWorkspaces);
            } else {
                targetWs = { ...targetWs, name: wsData.name, icon: wsData.icon || 'Database' };
            }

            let db;
            try {
                db = await openDB(targetWs.dbName, DB_VERSION, { upgrade: databaseService.initSchema.bind(databaseService) });

                const storeNames = ['meets', 'groups', 'tasks', 'marks', 'members', 'finalAssessments', 'modules'];
                const tx = db.transaction(storeNames, 'readwrite');

                await Promise.all(storeNames.map(name => tx.objectStore(name).clear()));

                const { meets, groups, tasks, marks, members, finalAssessments, modules } = wsData.data;
                const importPromises = [];

                if (meets) importPromises.push(...meets.map(m => tx.objectStore('meets').put(m)));
                if (groups) importPromises.push(...groups.map(g => tx.objectStore('groups').put(g)));
                if (tasks) importPromises.push(...tasks.map(t => tx.objectStore('tasks').put(t)));
                if (marks) importPromises.push(...marks.map(m => tx.objectStore('marks').put(m)));
                if (members) importPromises.push(...members.map(m => tx.objectStore('members').put(m)));
                if (finalAssessments) importPromises.push(...finalAssessments.map(f => tx.objectStore('finalAssessments').put(f)));
                if (modules) importPromises.push(...modules.map(m => tx.objectStore('modules').put(m)));

                await Promise.all(importPromises);
                await tx.done;
            } catch (e) {
                console.error(`Error importing data into workspace ${targetWs.name}:`, e);
            } finally {
                if (db) db.close();
            }
        }
    }

    async getAllWorkspacesSizes() {
        const workspaces = this.getWorkspaces();
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
                db = await openDB(ws.dbName, DB_VERSION, { upgrade: databaseService.initSchema.bind(databaseService) });

                const missingStores = storeNames.filter(name => !db.objectStoreNames.contains(name));
                if (missingStores.length > 0) {
                    results.push({ id: ws.id, name: ws.name, size: 0, error: true, missing: missingStores });
                    continue;
                }

                const dataPromises = storeNames.map(name => db.getAll(name));
                const [meets, groups, tasks, marks, members] = await Promise.all(dataPromises);

                const size = getSize(meets) + getSize(groups) + getSize(tasks) + getSize(marks) + getSize(members);
                total += size;
                results.push({ id: ws.id, name: ws.name, size: size });
            } catch (e) {
                results.push({ id: ws.id, name: ws.name, size: 0, error: true });
            } finally {
                if (db) db.close();
            }
        }

        return { total, workspaces: results };
    }
}

export const workspaceRepository = new WorkspaceRepository();
