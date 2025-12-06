import { databaseService } from './DatabaseService';
import { local as storage } from './StorageService';

// Settings rely heavily on LocalStorage but also have some DB interactions (syncing teacher roles).
// We encapsulate this as a Repository/Service hybrid.

class SettingsRepository {

    constructor() {
        // Helper to access DB if needed
    }

    async getDb() {
        return databaseService.getDb();
    }

    // --- Utility Functions for LocalStorage Abstraction ---

    _getWorkspaceKey(key) {
        // We reuse the logic but use storage service for the ID lookup
        // Note: WorkspaceRepository manages the ID key, but we don't import it to avoid cycles if any.
        // We really should constantize the keys somewhere shared.
        const wsId = storage.get('edutrace_current_workspace', 'default');
        return wsId === 'default' ? key : `${key}_${wsId}`;
    }

    _getSetting(key, defaultValue = null) {
        // StorageService handles JSON parsing
        // But specialized handling for 'durationLimit' being int vs string?

        const val = storage.get(this._getWorkspaceKey(key), defaultValue);

        if (key === 'durationLimit' && val !== null) {
            const parsed = parseInt(val, 10);
            return isNaN(parsed) ? defaultValue : parsed;
        }

        return val;
    }

    _saveSetting(key, value) {
        storage.set(this._getWorkspaceKey(key), value);
    }

    // --- Public Accessors ---

    async getDurationLimit() {
        return this._getSetting('durationLimit', 0);
    }

    async saveDurationLimit(limit) {
        this._saveSetting('durationLimit', limit);
    }

    async getDefaultTeacher() {
        return this._getSetting('defaultTeacher', null);
    }

    async saveDefaultTeacher(teacher) {
        if (teacher) {
            this._saveSetting('defaultTeacher', teacher);
        } else {
            const wsKey = this._getWorkspaceKey('defaultTeacher');
            storage.remove(wsKey);
        }
    }

    async getIgnoredUsers() {
        return this._getSetting('ignoredUsers', []);
    }

    async saveIgnoredUsers(users) {
        this._saveSetting('ignoredUsers', Array.isArray(users) ? users : []);
    }

    async getTeachers() {
        return this._getSetting('teachers', []);
    }

    async saveTeachers(teachers) {
        this._saveSetting('teachers', Array.isArray(teachers) ? teachers : []);

        // Sync roles in DB
        try {
            const db = await this.getDb();
            const tx = db.transaction('members', 'readwrite');
            // We need to iterate all members. getAll() + put() loop inside transaction.
            const store = tx.objectStore('members');
            const allMembers = await store.getAll();

            const teacherSet = new Set(teachers);

            for (const member of allMembers) {
                const isTeacher = teacherSet.has(member.name);
                const currentRole = member.role || 'student';

                if (isTeacher && currentRole !== 'teacher') {
                    member.role = 'teacher';
                    await store.put(member);
                } else if (!isTeacher && currentRole === 'teacher') {
                    member.role = 'student';
                    await store.put(member);
                }
            }
            await tx.done;
        } catch (e) {
            console.error('Error syncing member roles after saving teachers.', e);
        }
    }

    async getExamSettings() {
        return this._getSetting('examSettings', {});
    }

    async saveExamSettings(settings) {
        this._saveSetting('examSettings', settings || {});
    }

    clearSettings() {
        const settingsKeys = ['ignoredUsers', 'durationLimit', 'defaultTeacher', 'teachers', 'examSettings'];

        settingsKeys.forEach(key => {
            const wsKey = this._getWorkspaceKey(key);
            storage.remove(wsKey);
        });
    }
}

export const settingsRepository = new SettingsRepository();
