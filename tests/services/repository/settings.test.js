import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbConnection } from '~repository/db';
import {
    getDurationLimit,
    saveDurationLimit,
    getDefaultTeacher,
    saveDefaultTeacher,
    getIgnoredUsers,
    saveIgnoredUsers,
    getTeachers,
    saveTeachers,
    clearSettings,
} from '~repository/settings';
import { saveMember, getAllMembers } from '~repository/members';
import { createMemberFixture, resetIdCounter } from './helpers';

describe('settings.js', () => {
    beforeEach(async () => {
        localStorage.clear();
        await resetDbConnection();
        resetIdCounter();
    });

    describe('getDurationLimit & saveDurationLimit', () => {
        it('should save and retrieve duration limit for default workspace', async () => {
            localStorage.setItem('edutrace_current_workspace', 'default');

            await saveDurationLimit(30);
            expect(localStorage.getItem('durationLimit')).toBe('30');

            const limit = await getDurationLimit();
            expect(limit).toBe(30);
        });

        it('should save and retrieve duration limit for custom workspace', async () => {
            localStorage.setItem('edutrace_current_workspace', 'ws1');

            await saveDurationLimit(45);
            expect(localStorage.getItem('durationLimit_ws1')).toBe('45');

            const limit = await getDurationLimit();
            expect(limit).toBe(45);
        });

        it('should return 0 when no duration limit is set', async () => {
            const limit = await getDurationLimit();
            expect(limit).toBe(0);
        });

        it('should handle corrupted data gracefully', async () => {
            localStorage.setItem('durationLimit', 'invalid');
            const limit = await getDurationLimit();
            expect(limit).toBe(0); // parseInt('invalid') = NaN, but we should handle it
        });
    });

    describe('getDefaultTeacher & saveDefaultTeacher', () => {
        let consoleErrorSpy;

        beforeEach(() => {
            consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        });

        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it('should save and retrieve default teacher for default workspace', async () => {
            localStorage.setItem('edutrace_current_workspace', 'default');

            const teacher = 'Dr. Smith';
            await saveDefaultTeacher(teacher);

            const stored = localStorage.getItem('defaultTeacher');
            expect(stored).toEqual(teacher);

            const retrieved = await getDefaultTeacher();
            expect(retrieved).toEqual(teacher);
        });

        it('should save and retrieve default teacher for custom workspace', async () => {
            localStorage.setItem('edutrace_current_workspace', 'ws1');

            const teacher = 'Dr. Jones';
            await saveDefaultTeacher(teacher);

            const stored = localStorage.getItem('defaultTeacher_ws1');
            expect(stored).toEqual(teacher);

            const retrieved = await getDefaultTeacher();
            expect(retrieved).toEqual(teacher);
        });

        it('should return null when no default teacher is set', async () => {
            const teacher = await getDefaultTeacher();
            expect(teacher).toBeNull();
        });


    });

    describe('getIgnoredUsers & saveIgnoredUsers', () => {
        let consoleErrorSpy;

        beforeEach(() => {
            consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        });

        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it('should save and retrieve ignored users for default workspace', async () => {
            localStorage.setItem('edutrace_current_workspace', 'default');

            const users = ['user1@example.com', 'user2@example.com'];
            await saveIgnoredUsers(users);

            const stored = localStorage.getItem('ignoredUsers');
            expect(JSON.parse(stored)).toEqual(users);

            const retrieved = await getIgnoredUsers();
            expect(retrieved).toEqual(users);
        });

        it('should save and retrieve ignored users for custom workspace', async () => {
            localStorage.setItem('edutrace_current_workspace', 'ws1');

            const users = ['user3@example.com'];
            await saveIgnoredUsers(users);

            const stored = localStorage.getItem('ignoredUsers_ws1');
            expect(JSON.parse(stored)).toEqual(users);

            const retrieved = await getIgnoredUsers();
            expect(retrieved).toEqual(users);
        });

        it('should return empty array when no ignored users are set', async () => {
            const users = await getIgnoredUsers();
            expect(users).toEqual([]);
        });

        it('should handle corrupted JSON gracefully', async () => {
            localStorage.setItem('ignoredUsers', 'invalid-json');
            const users = await getIgnoredUsers();
            expect(users).toEqual([]);
        });
    });

    describe('getTeachers & saveTeachers', () => {
        let consoleErrorSpy;

        beforeEach(() => {
            consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        });

        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });


        it('should save and retrieve teachers for default workspace', async () => {
            localStorage.setItem('edutrace_current_workspace', 'default');

            const teachers = ['Dr. Smith', 'Prof. Jones'];
            await saveTeachers(teachers);

            const stored = localStorage.getItem('teachers');
            expect(JSON.parse(stored)).toEqual(teachers);

            const retrieved = await getTeachers();
            expect(retrieved).toEqual(teachers);
        });

        it('should save and retrieve teachers for custom workspace', async () => {
            localStorage.setItem('edutrace_current_workspace', 'ws1');

            const teachers = ['Dr. Brown'];
            await saveTeachers(teachers);

            const stored = localStorage.getItem('teachers_ws1');
            expect(JSON.parse(stored)).toEqual(teachers);

            const retrieved = await getTeachers();
            expect(retrieved).toEqual(teachers);
        });

        it('should return empty array when no teachers are set', async () => {
            const teachers = await getTeachers();
            expect(teachers).toEqual([]);
        });

        it('should handle corrupted JSON gracefully', async () => {
            localStorage.setItem('teachers', 'invalid-json');
            const teachers = await getTeachers();
            expect(teachers).toEqual([]);
        });
    });

    describe('saveTeachers - role sync', () => {
        it('should update member roles when teachers list changes', async () => {
            // Create members
            const memberA = createMemberFixture({ name: 'A', role: 'student' });
            const memberB = createMemberFixture({ name: 'B', role: 'student' });
            const memberC = createMemberFixture({ name: 'C', role: 'student' });

            await saveMember(memberA);
            await saveMember(memberB);
            await saveMember(memberC);

            // Set A and C as teachers
            await saveTeachers(['A', 'C']);

            const allMembers = await getAllMembers();

            const a = allMembers.find(m => m.name === 'A');
            const b = allMembers.find(m => m.name === 'B');
            const c = allMembers.find(m => m.name === 'C');

            expect(a.role).toBe('teacher');
            expect(b.role).toBe('student');
            expect(c.role).toBe('teacher');
        });

        it('should demote teachers when removed from list', async () => {
            // Create members with teacher role
            const memberA = createMemberFixture({ name: 'A', role: 'teacher' });
            const memberB = createMemberFixture({ name: 'B', role: 'teacher' });

            await saveMember(memberA);
            await saveMember(memberB);

            // Remove A from teachers list
            await saveTeachers(['B']);

            const allMembers = await getAllMembers();

            const a = allMembers.find(m => m.name === 'A');
            const b = allMembers.find(m => m.name === 'B');

            expect(a.role).toBe('student');
            expect(b.role).toBe('teacher');
        });

        it('should handle empty teachers list', async () => {
            const memberA = createMemberFixture({ name: 'A', role: 'teacher' });
            await saveMember(memberA);

            await saveTeachers([]);

            const allMembers = await getAllMembers();
            expect(allMembers[0].role).toBe('student');
        });
    });

    describe('clearSettings', () => {
        it('should clear all settings for default workspace', async () => {
            localStorage.setItem('edutrace_current_workspace', 'default');

            localStorage.setItem('durationLimit', '30');
            localStorage.setItem('ignoredUsers', '["user1"]');
            localStorage.setItem('defaultTeacher', '{"name":"Dr. Smith"}');
            localStorage.setItem('teachers', '["Dr. Smith"]');

            clearSettings();

            expect(localStorage.getItem('durationLimit')).toBeNull();
            expect(localStorage.getItem('ignoredUsers')).toBeNull();
            expect(localStorage.getItem('defaultTeacher')).toBeNull();
            expect(localStorage.getItem('teachers')).toBeNull();
        });

        it('should clear all settings for custom workspace', async () => {
            localStorage.setItem('edutrace_current_workspace', 'ws1');

            localStorage.setItem('durationLimit_ws1', '45');
            localStorage.setItem('ignoredUsers_ws1', '["user2"]');
            localStorage.setItem('defaultTeacher_ws1', '{"name":"Dr. Jones"}');
            localStorage.setItem('teachers_ws1', '["Dr. Jones"]');

            clearSettings();

            expect(localStorage.getItem('durationLimit_ws1')).toBeNull();
            expect(localStorage.getItem('ignoredUsers_ws1')).toBeNull();
            expect(localStorage.getItem('defaultTeacher_ws1')).toBeNull();
            expect(localStorage.getItem('teachers_ws1')).toBeNull();
        });

        it('should not affect other workspace settings', async () => {
            localStorage.setItem('edutrace_current_workspace', 'default');
            localStorage.setItem('durationLimit', '30');
            localStorage.setItem('durationLimit_ws1', '45');

            clearSettings();

            expect(localStorage.getItem('durationLimit')).toBeNull();
            expect(localStorage.getItem('durationLimit_ws1')).toBe('45'); // Should remain
        });
    });
});
