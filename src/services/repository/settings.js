// settings.js
import { getCurrentWorkspaceId } from './workspace';
import { getDb } from './db';

// --- Utility Functions for LocalStorage Abstraction ---

function getWorkspaceKey(key) {
    const wsId = getCurrentWorkspaceId();
    // Prepend key with identifier if not default
    return wsId === 'default' ? key : `${key}_${wsId}`;
}

function getSetting(key, defaultValue = null) {
    try {
        const stored = localStorage.getItem(getWorkspaceKey(key));
        if (stored === null) return defaultValue;

        // Handle numeric values separately if needed (like durationLimit)
        if (key === 'durationLimit') {
            const parsed = parseInt(stored, 10);
            return isNaN(parsed) ? defaultValue : parsed;
        }

        // Handle string values that are not JSON encoded
        if (key === 'defaultTeacher') {
            return stored;
        }

        // Default to JSON parsing
        return JSON.parse(stored);
    } catch (e) {
        console.error(`Error reading setting '${key}' from localStorage`, e);
        return defaultValue;
    }
}

function saveSetting(key, value) {
    try {
        const storedValue = (key === 'durationLimit' || key === 'defaultTeacher')
            ? String(value)
            : JSON.stringify(value);

        localStorage.setItem(getWorkspaceKey(key), storedValue);
    } catch (e) {
        console.error(`Error saving setting '${key}' to localStorage`, e);
    }
}

// --- Public Accessors ---

export async function getDurationLimit() {
    return getSetting('durationLimit', 0);
}

export async function saveDurationLimit(limit) {
    saveSetting('durationLimit', limit);
}

export async function getDefaultTeacher() {
    return getSetting('defaultTeacher', null);
}

export async function saveDefaultTeacher(teacher) {
    if (teacher) {
        saveSetting('defaultTeacher', teacher);
    } else {
        // Remove the setting if teacher is null/empty
        const wsKey = getWorkspaceKey('defaultTeacher');
        localStorage.removeItem(wsKey);
    }
}

export async function getIgnoredUsers() {
    return getSetting('ignoredUsers', []);
}

export async function saveIgnoredUsers(users) {
    saveSetting('ignoredUsers', Array.isArray(users) ? users : []);
}

export async function getTeachers() {
    return getSetting('teachers', []);
}

export async function saveTeachers(teachers) {
    saveSetting('teachers', Array.isArray(teachers) ? teachers : []);

    // Sync roles in DB
    try {
        const db = await getDb();
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
        console.error('Error syncing member roles after saving teachers.', e);
    }
}

export function clearSettings() {
    const settingsKeys = ['ignoredUsers', 'durationLimit', 'defaultTeacher', 'teachers'];

    settingsKeys.forEach(key => {
        const wsKey = getWorkspaceKey(key);
        localStorage.removeItem(wsKey);
    });
}