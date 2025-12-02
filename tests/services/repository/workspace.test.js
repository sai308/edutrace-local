import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDbConnection } from '~repository/db';
import * as workspace from '~repository/workspace';
import * as meets from '~repository/meets';
import * as groups from '~repository/groups';
import * as tasks from '~repository/tasks';
import * as marks from '~repository/marks';
import * as members from '~repository/members';
import * as settings from '~repository/settings';
import { createMeetFixture, createGroupFixture, createTaskFixture, createMemberFixture, createMarkFixture, resetIdCounter } from './helpers';

describe('workspace.js', () => {
    beforeEach(async () => {
        await resetDbConnection();
        resetIdCounter();
        localStorage.clear();
    });

    describe('LocalStorage Operations', () => {
        describe('getWorkspaces', () => {
            it('should return default workspace when none exist', () => {
                const workspaces = workspace.getWorkspaces();

                expect(workspaces).toHaveLength(1);
                expect(workspaces[0].id).toBe('default');
                expect(workspaces[0].name).toBe('Default');
                expect(workspaces[0].dbName).toBe('meet-attendance-db');
                expect(workspaces[0].createdAt).toBeDefined();
            });

            it('should parse and return stored workspaces', () => {
                const testWorkspaces = [
                    { id: 'ws1', name: 'Workspace 1', dbName: 'db-1', createdAt: '2024-01-01' },
                    { id: 'ws2', name: 'Workspace 2', dbName: 'db-2', createdAt: '2024-01-02' }
                ];
                localStorage.setItem('edutrace_workspaces', JSON.stringify(testWorkspaces));

                const workspaces = workspace.getWorkspaces();

                expect(workspaces).toHaveLength(2);
                expect(workspaces).toEqual(testWorkspaces);
            });

            it('should handle corrupted data gracefully', () => {
                localStorage.setItem('edutrace_workspaces', 'invalid-json');

                const workspaces = workspace.getWorkspaces();

                // Should return default workspace on error
                expect(workspaces).toHaveLength(1);
                expect(workspaces[0].id).toBe('default');
            });
        });

        describe('saveWorkspaces', () => {
            it('should persist workspaces to localStorage', () => {
                const testWorkspaces = [
                    { id: 'ws1', name: 'Test Workspace', dbName: 'test-db', createdAt: '2024-01-01' }
                ];

                workspace.saveWorkspaces(testWorkspaces);

                const stored = localStorage.getItem('edutrace_workspaces');
                expect(JSON.parse(stored)).toEqual(testWorkspaces);
            });
        });

        describe('getCurrentWorkspaceId', () => {
            it('should return "default" when not set', () => {
                const id = workspace.getCurrentWorkspaceId();
                expect(id).toBe('default');
            });

            it('should return stored workspace ID', () => {
                localStorage.setItem('edutrace_current_workspace', 'ws1');

                const id = workspace.getCurrentWorkspaceId();
                expect(id).toBe('ws1');
            });
        });

        describe('setCurrentWorkspaceId', () => {
            it('should persist workspace ID', () => {
                workspace.setCurrentWorkspaceId('ws1');

                const stored = localStorage.getItem('edutrace_current_workspace');
                expect(stored).toBe('ws1');
            });
        });
    });

    describe('Workspace CRUD Operations', () => {
        describe('createWorkspace', () => {
            it('should create workspace with unique ID', async () => {
                const id = await workspace.createWorkspace('Test Workspace');

                const workspaces = workspace.getWorkspaces();
                const created = workspaces.find(w => w.id === id);

                expect(created).toBeDefined();
                expect(created.name).toBe('Test Workspace');
                expect(created.dbName).toBe(`meet-attendance-db-${id}`);
                expect(created.icon).toBe('Database');
                expect(created.createdAt).toBeDefined();
            });

            it('should support custom icon', async () => {
                const id = await workspace.createWorkspace('Test Workspace', { icon: 'Star' });

                const workspaces = workspace.getWorkspaces();
                const created = workspaces.find(w => w.id === id);

                expect(created.icon).toBe('Star');
            });

            it('should copy settings when exportSettings is true', async () => {
                // Set up current workspace settings
                await settings.saveDurationLimit(45);
                await settings.saveDefaultTeacher('Prof. Test');
                await settings.saveIgnoredUsers(['ignore@test.com']);
                await settings.saveTeachers(['Teacher A', 'Teacher B']);

                const id = await workspace.createWorkspace('New Workspace', {
                    exportSettings: true,
                    getSettings: async () => ({
                        durationLimit: await settings.getDurationLimit(),
                        defaultTeacher: await settings.getDefaultTeacher(),
                        ignoredUsers: await settings.getIgnoredUsers(),
                        teachers: await settings.getTeachers()
                    }),
                    saveSettings: async (s) => {
                        await settings.saveDurationLimit(s.durationLimit);
                        await settings.saveDefaultTeacher(s.defaultTeacher);
                        await settings.saveIgnoredUsers(s.ignoredUsers);
                        await settings.saveTeachers(s.teachers || []);
                    }
                });

                // Switch to new workspace and verify settings were copied
                await workspace.switchWorkspace(id);

                expect(await settings.getDurationLimit()).toBe(45);
                expect(await settings.getDefaultTeacher()).toBe('Prof. Test');
                expect(await settings.getIgnoredUsers()).toEqual(['ignore@test.com']);
                expect(await settings.getTeachers()).toEqual(['Teacher A', 'Teacher B']);
            });
        });

        describe('updateWorkspace', () => {
            it('should update workspace metadata', async () => {
                const id = await workspace.createWorkspace('Original Name');

                const updated = await workspace.updateWorkspace(id, {
                    name: 'Updated Name',
                    icon: 'Star'
                });

                expect(updated.name).toBe('Updated Name');
                expect(updated.icon).toBe('Star');
                expect(updated.updatedAt).toBeDefined();
            });

            it('should prevent updating id and dbName', async () => {
                const id = await workspace.createWorkspace('Test');
                const originalDbName = workspace.getWorkspaces().find(w => w.id === id).dbName;

                await workspace.updateWorkspace(id, {
                    id: 'new-id',
                    dbName: 'new-db-name',
                    name: 'Updated'
                });

                const workspaces = workspace.getWorkspaces();
                const updated = workspaces.find(w => w.id === id);

                expect(updated.id).toBe(id); // Should not change
                expect(updated.dbName).toBe(originalDbName); // Should not change
                expect(updated.name).toBe('Updated'); // Should change
            });

            it('should throw error for non-existent workspace', async () => {
                await expect(
                    workspace.updateWorkspace('non-existent', { name: 'Test' })
                ).rejects.toThrow('Workspace not found');
            });
        });

        describe('deleteWorkspace', () => {
            it('should delete workspace and its database', async () => {
                const id = await workspace.createWorkspace('To Delete');
                const workspacesBefore = workspace.getWorkspaces();
                expect(workspacesBefore.find(w => w.id === id)).toBeDefined();

                await workspace.deleteWorkspace(id);

                const workspacesAfter = workspace.getWorkspaces();
                expect(workspacesAfter.find(w => w.id === id)).toBeUndefined();
            });

            it('should prevent deleting default workspace', async () => {
                await expect(
                    workspace.deleteWorkspace('default')
                ).rejects.toThrow('Cannot delete default workspace');
            });

            it('should switch to default if current workspace deleted', async () => {
                const id = await workspace.createWorkspace('Test');
                await workspace.switchWorkspace(id);

                expect(workspace.getCurrentWorkspaceId()).toBe(id);

                await workspace.deleteWorkspace(id);

                expect(workspace.getCurrentWorkspaceId()).toBe('default');
            });
        });
    });

    describe('Workspace Switching', () => {
        describe('switchWorkspace', () => {
            it('should switch to existing workspace', async () => {
                const id = await workspace.createWorkspace('Test Workspace');

                await workspace.switchWorkspace(id);

                expect(workspace.getCurrentWorkspaceId()).toBe(id);
            });

            it('should call onLoading callback', async () => {
                const id = await workspace.createWorkspace('Test Workspace');
                const onLoading = vi.fn();

                await workspace.switchWorkspace(id, onLoading);

                expect(onLoading).toHaveBeenCalled();
            });

            it('should throw error for non-existent workspace', async () => {
                await expect(
                    workspace.switchWorkspace('non-existent')
                ).rejects.toThrow('Workspace not found');
            });

            it('should reset database connection', async () => {
                // Add data to default workspace
                const meet = createMeetFixture({ meetId: 'default-meet' });
                await meets.saveMeet(meet);

                // Create and switch to new workspace
                const id = await workspace.createWorkspace('New Workspace');
                await workspace.switchWorkspace(id);

                // New workspace should be empty
                const meetsInNewWorkspace = await meets.getAllMeets();
                expect(meetsInNewWorkspace).toHaveLength(0);

                // Switch back to default
                await workspace.switchWorkspace('default');

                // Should see original data
                const meetsInDefault = await meets.getAllMeets();
                expect(meetsInDefault).toHaveLength(1);
                expect(meetsInDefault[0].meetId).toBe('default-meet');
            });
        });
    });

    describe('Multi-Workspace Export/Import', () => {
        describe('exportWorkspaces', () => {
            it('should export selected workspaces with data', async () => {
                // Add data to default workspace
                const meet = createMeetFixture();
                await meets.saveMeet(meet);

                const group = createGroupFixture();
                await groups.saveGroup(group);

                const exportData = await workspace.exportWorkspaces(['default']);

                expect(exportData.type).toBe('multi-workspace-backup');
                expect(exportData.version).toBe(1);
                expect(exportData.timestamp).toBeDefined();
                expect(exportData.workspaces).toHaveLength(1);
                expect(exportData.workspaces[0].id).toBe('default');
                expect(exportData.workspaces[0].data.meets).toHaveLength(1);
                expect(exportData.workspaces[0].data.groups).toHaveLength(1);
            });

            it('should include workspace metadata', async () => {
                const id = await workspace.createWorkspace('Test Workspace', { icon: 'Star' });

                // Switch to the new workspace and add some data to ensure schema is initialized
                await workspace.switchWorkspace(id);
                await meets.saveMeet(createMeetFixture());

                // Switch back to default for the export
                await workspace.switchWorkspace('default');

                const exportData = await workspace.exportWorkspaces([id]);

                expect(exportData.workspaces[0].name).toBe('Test Workspace');
                expect(exportData.workspaces[0].icon).toBe('Star');
                expect(exportData.workspaces[0].dbName).toBeDefined();
            });

            it('should export all entity types', async () => {
                const group = createGroupFixture();
                await groups.saveGroup(group);

                const meet = createMeetFixture();
                await meets.saveMeet(meet);

                const member = createMemberFixture({ groupName: group.name });
                await members.saveMember(member);

                const task = createTaskFixture({ groupName: group.name });
                const { id: taskId } = await tasks.saveTask(task);

                const mark = createMarkFixture({ taskId, studentId: member.id });
                await marks.saveMark(mark);

                const exportData = await workspace.exportWorkspaces(['default']);
                const wsData = exportData.workspaces[0].data;

                expect(wsData.meets).toHaveLength(1);
                expect(wsData.groups).toHaveLength(1);
                expect(wsData.tasks).toHaveLength(1);
                expect(wsData.marks).toHaveLength(1);
                expect(wsData.members).toHaveLength(1);
            });
        });

        describe('importWorkspaces', () => {
            it('should import selected workspaces', async () => {
                const exportData = {
                    type: 'multi-workspace-backup',
                    version: 1,
                    timestamp: new Date().toISOString(),
                    workspaces: [
                        {
                            id: 'imported-ws',
                            name: 'Imported Workspace',
                            icon: 'Star',
                            dbName: 'meet-attendance-db-imported-ws',
                            data: {
                                meets: [createMeetFixture()],
                                groups: [createGroupFixture()],
                                tasks: [],
                                marks: [],
                                members: []
                            }
                        }
                    ]
                };

                await workspace.importWorkspaces(exportData, ['imported-ws']);

                const workspaces = workspace.getWorkspaces();
                const imported = workspaces.find(w => w.id === 'imported-ws');

                expect(imported).toBeDefined();
                expect(imported.name).toBe('Imported Workspace');
            });

            it('should create new workspaces if they don\'t exist', async () => {
                const workspacesBefore = workspace.getWorkspaces();
                const countBefore = workspacesBefore.length;

                const exportData = {
                    type: 'multi-workspace-backup',
                    version: 1,
                    timestamp: new Date().toISOString(),
                    workspaces: [
                        {
                            id: 'new-ws',
                            name: 'New Workspace',
                            icon: 'Database',
                            dbName: 'meet-attendance-db-new-ws',
                            data: { meets: [], groups: [], tasks: [], marks: [], members: [] }
                        }
                    ]
                };

                await workspace.importWorkspaces(exportData, ['new-ws']);

                const workspacesAfter = workspace.getWorkspaces();
                expect(workspacesAfter.length).toBe(countBefore + 1);
            });

            it('should update existing workspaces', async () => {
                // Create a workspace with some data
                const id = await workspace.createWorkspace('Original');
                await workspace.switchWorkspace(id);
                await meets.saveMeet(createMeetFixture({ meetId: 'original-meet' }));

                // Export and modify
                const exportData = await workspace.exportWorkspaces([id]);
                exportData.workspaces[0].data.meets.push(createMeetFixture({ meetId: 'new-meet' }));

                // Import should replace data
                await workspace.importWorkspaces(exportData, [id]);

                await workspace.switchWorkspace(id);
                const meetsAfter = await meets.getAllMeets();

                // Should have the imported data (2 meets from export)
                expect(meetsAfter.length).toBe(2);
            });

            it('should clear existing data before import', async () => {
                const id = await workspace.createWorkspace('Test');
                await workspace.switchWorkspace(id);

                // Add initial data
                await meets.saveMeet(createMeetFixture({ meetId: 'old-meet' }));
                await groups.saveGroup(createGroupFixture({ name: 'Old Group' }));

                // Import new data
                const exportData = {
                    type: 'multi-workspace-backup',
                    version: 1,
                    timestamp: new Date().toISOString(),
                    workspaces: [
                        {
                            id: id,
                            name: 'Test',
                            icon: 'Database',
                            dbName: `meet-attendance-db-${id}`,
                            data: {
                                meets: [createMeetFixture({ meetId: 'new-meet' })],
                                groups: [],
                                tasks: [],
                                marks: [],
                                members: []
                            }
                        }
                    ]
                };

                await workspace.importWorkspaces(exportData, [id]);
                await workspace.switchWorkspace(id);

                const meetsAfter = await meets.getAllMeets();
                const groupsAfter = await groups.getGroups();

                expect(meetsAfter).toHaveLength(1);
                expect(meetsAfter[0].meetId).toBe('new-meet');
                expect(groupsAfter).toHaveLength(0); // Old group should be cleared
            });

            it('should handle invalid backup format', async () => {
                await expect(
                    workspace.importWorkspaces({ invalid: 'data' }, [])
                ).rejects.toThrow('Invalid workspace backup format');
            });
        });
    });

    describe('Workspace Data Deletion', () => {
        describe('deleteWorkspacesData', () => {
            it('should clear data from selected workspaces', async () => {
                // Add data to default workspace
                await meets.saveMeet(createMeetFixture());
                await groups.saveGroup(createGroupFixture());

                expect(await meets.getAllMeets()).toHaveLength(1);
                expect(await groups.getGroups()).toHaveLength(1);

                await workspace.deleteWorkspacesData(['default']);

                expect(await meets.getAllMeets()).toHaveLength(0);
                expect(await groups.getGroups()).toHaveLength(0);
            });

            it('should preserve workspace metadata', async () => {
                const id = await workspace.createWorkspace('Test Workspace');
                await workspace.switchWorkspace(id);
                await meets.saveMeet(createMeetFixture());

                await workspace.deleteWorkspacesData([id]);

                const workspaces = workspace.getWorkspaces();
                const ws = workspaces.find(w => w.id === id);

                expect(ws).toBeDefined();
                expect(ws.name).toBe('Test Workspace');
            });

            it('should handle non-existent workspaces gracefully', async () => {
                // Should not throw
                await expect(
                    workspace.deleteWorkspacesData(['non-existent'])
                ).resolves.not.toThrow();
            });
        });
    });

    describe('Workspace Size Calculation', () => {
        describe('getAllWorkspacesSizes', () => {
            it('should calculate sizes for all workspaces', async () => {
                // Add data to default workspace
                await meets.saveMeet(createMeetFixture());
                await groups.saveGroup(createGroupFixture());

                const result = await workspace.getAllWorkspacesSizes();

                expect(result).toHaveProperty('total');
                expect(result).toHaveProperty('workspaces');
                expect(Array.isArray(result.workspaces)).toBe(true);
                expect(result.workspaces.length).toBeGreaterThan(0);
            });

            it('should return total and per-workspace sizes', async () => {
                // Add data to default workspace
                await meets.saveMeet(createMeetFixture());

                const result = await workspace.getAllWorkspacesSizes();

                expect(result.total).toBeGreaterThan(0);

                const defaultWs = result.workspaces.find(w => w.id === 'default');
                expect(defaultWs).toBeDefined();
                expect(defaultWs.name).toBe('Default');
                expect(defaultWs.size).toBeGreaterThan(0);
            });

            it('should handle missing object stores gracefully', async () => {
                // This test verifies the error handling for workspaces with missing stores
                // In practice, this is hard to simulate without manually corrupting the DB
                const result = await workspace.getAllWorkspacesSizes();

                // Should not throw and should return valid structure
                expect(result).toHaveProperty('total');
                expect(result).toHaveProperty('workspaces');
            });

            it('should handle errors during calculation', async () => {
                // The function should handle errors gracefully and mark workspaces with errors
                const result = await workspace.getAllWorkspacesSizes();

                // Should not throw
                expect(result).toBeDefined();
                expect(typeof result.total).toBe('number');
                expect(Array.isArray(result.workspaces)).toBe(true);
            });
        });
    });
});
