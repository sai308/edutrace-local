// index.js (Refactored)

import { getDb } from './db';
import * as workspace from './workspace';
import * as settings from './settings';
import * as meets from './meets';
import * as groups from './groups';
import * as members from './members';
import * as tasks from './tasks';
import * as marks from './marks';
import * as backup from './backup';
import * as stats from './stats';
import * as modules from './modules';
import * as finalAssessments from './finalAssessments';

class Repository {
    // General DB Access
    async getAll(storeName) {
        const db = await getDb();
        return db.getAll(storeName);
    }

    // --- Meets/Reports (from meets.js) ---
    async saveMeet(meetData) {
        return meets.saveMeet(meetData);
    }

    async getAllMeets() {
        return meets.getAllMeets();
    }

    async getMeetsByMeetId(meetId) {
        return meets.getMeetsByMeetId(meetId);
    }

    async getMeetById(id) {
        return meets.getMeetById(id);
    }

    async checkMeetExists(meetId, date) {
        return meets.checkMeetExists(meetId, date);
    }

    async isDuplicateFile(filename, meetId, date) {
        return meets.isDuplicateFile(filename, meetId, date);
    }

    async deleteMeet(id) {
        return meets.deleteMeet(id);
    }

    async deleteMeets(ids) {
        return meets.deleteMeets(ids);
    }

    async applyDurationLimitToAll(limitMinutes) {
        return meets.applyDurationLimitToAll(limitMinutes);
    }

    // --- Groups (from groups.js) ---
    async getGroups() {
        return groups.getGroups();
    }

    async saveGroup(group) {
        return groups.saveGroup(group);
    }

    async syncMembersFromMeets(group) {
        return groups.syncMembersFromMeets(group);
    }

    async deleteGroup(id) {
        return groups.deleteGroup(id);
    }

    async getGroupMap() {
        return groups.getGroupMap();
    }

    // --- Members (from members.js) ---
    async saveMember(member) {
        return members.saveMember(member);
    }

    async getAllMembers() {
        return members.getAllMembers();
    }

    async getMembersByGroup(groupName) {
        return members.getMembersByGroup(groupName);
    }

    async deleteMember(id) {
        return members.deleteMember(id);
    }

    async deleteMembers(ids) {
        return members.deleteMembers(ids);
    }

    async syncAllMembersFromMeets() {
        return members.syncAllMembersFromMeets();
    }

    async hideMember(id) {
        return members.hideMember(id);
    }

    async hideMembers(ids) {
        return members.hideMembers(ids);
    }

    // Legacy Aliases for Students - PRESERVED CONTRACT
    /** @deprecated Use saveMember instead */
    async saveStudent(student) {
        return this.saveMember(student);
    }

    /** @deprecated Use getAllMembers instead */
    async getAllStudents() {
        return this.getAllMembers();
    }

    /** @deprecated Use getMembersByGroup instead */
    async getStudentsByGroup(groupName) {
        return this.getMembersByGroup(groupName);
    }

    /** @deprecated Use clearMembers instead */
    async clearStudents() {
        return this.clearMembers();
    }


    // --- Tasks (from tasks.js) ---
    async saveTask(task) {
        return tasks.saveTask(task);
    }

    async getAllTasks() {
        return tasks.getAllTasks();
    }

    async getTasksByGroup(groupName) {
        return tasks.getTasksByGroup(groupName);
    }

    async findTaskByNaturalKey(name, date, groupName) {
        return tasks.findTaskByNaturalKey(name, date, groupName);
    }

    // --- Modules (from modules.js) ---
    async saveModule(module) {
        return modules.saveModule(module);
    }

    async getAllModules() {
        return modules.getAllModules();
    }

    async getModulesByGroup(groupName) {
        return modules.getModulesByGroup(groupName);
    }

    async getModuleById(id) {
        return modules.getModuleById(id);
    }

    async deleteModule(id) {
        return modules.deleteModule(id);
    }

    // --- FinalAssessments (from finalAssessments.js) ---
    async saveFinalAssessment(assessment) {
        return finalAssessments.saveFinalAssessment(assessment);
    }

    async getFinalAssessmentByStudent(studentId, assessmentType) {
        return finalAssessments.getFinalAssessmentByStudent(studentId, assessmentType);
    }

    async getAllFinalAssessments() {
        return finalAssessments.getAllFinalAssessments();
    }

    async getFinalAssessmentsByType(assessmentType) {
        return finalAssessments.getFinalAssessmentsByType(assessmentType);
    }

    async deleteFinalAssessment(id) {
        return finalAssessments.deleteFinalAssessment(id);
    }

    async updateAssessmentSyncStatus(id, syncedAt) {
        return finalAssessments.updateSyncStatus(id, syncedAt);
    }

    async updateAssessmentDocumentStatus(id, documentedAt) {
        return finalAssessments.updateDocumentStatus(id, documentedAt);
    }

    // --- Marks (from marks.js) ---
    async saveMark(mark) {
        return marks.saveMark(mark);
    }

    async getMarksByTask(taskId) {
        return marks.getMarksByTask(taskId);
    }

    async updateMarkSynced(id, synced) {
        return marks.updateMarkSynced(id, synced);
    }

    async getMarksByStudent(studentId) {
        return marks.getMarksByStudent(studentId);
    }

    async deleteMark(id) {
        return marks.deleteMark(id);
    }

    async deleteMarks(ids) {
        return marks.deleteMarks(ids);
    }

    async getAllMarksWithRelations() {
        return marks.getAllMarksWithRelations();
    }

    // --- Settings (from settings.js) ---
    async getDurationLimit() {
        return settings.getDurationLimit();
    }

    async saveDurationLimit(limit) {
        return settings.saveDurationLimit(limit);
    }

    async getDefaultTeacher() {
        return settings.getDefaultTeacher();
    }

    async saveDefaultTeacher(teacher) {
        return settings.saveDefaultTeacher(teacher);
    }

    async getIgnoredUsers() {
        return settings.getIgnoredUsers();
    }

    async saveIgnoredUsers(users) {
        return settings.saveIgnoredUsers(users);
    }

    async getTeachers() {
        return settings.getTeachers();
    }

    async saveTeachers(teachers) {
        return settings.saveTeachers(teachers);
    }

    async getExamSettings() {
        return settings.getExamSettings();
    }

    async saveExamSettings(examSettings) {
        return settings.saveExamSettings(examSettings);
    }

    // --- Workspace (from workspace.js) ---
    getWorkspaces() {
        return workspace.getWorkspaces();
    }

    getCurrentWorkspaceId() {
        return workspace.getCurrentWorkspaceId();
    }

    async createWorkspace(name, options = {}) {
        // Provide callbacks for settings management (as was done in original file)
        const settingsOptions = {
            ...options,
            getSettings: options.exportSettings ? async () => {
                return {
                    durationLimit: await settings.getDurationLimit(),
                    defaultTeacher: await settings.getDefaultTeacher(),
                    ignoredUsers: await settings.getIgnoredUsers(),
                    teachers: await settings.getTeachers()
                };
            } : null,
            saveSettings: options.exportSettings ? async (s) => {
                await settings.saveDurationLimit(s.durationLimit);
                await settings.saveDefaultTeacher(s.defaultTeacher);
                await settings.saveIgnoredUsers(s.ignoredUsers);
                await settings.saveTeachers(s.teachers || []);
            } : null
        };
        return workspace.createWorkspace(name, settingsOptions);
    }

    async updateWorkspace(id, updates) {
        return workspace.updateWorkspace(id, updates);
    }

    async exportWorkspaces(workspaceIds) {
        return workspace.exportWorkspaces(workspaceIds);
    }

    async importWorkspaces(data, selectedIds) {
        return workspace.importWorkspaces(data, selectedIds);
    }

    async switchWorkspace(id) {
        return workspace.switchWorkspace(id);
    }

    async deleteWorkspace(id) {
        return workspace.deleteWorkspace(id);
    }

    async deleteWorkspacesData(workspaceIds) {
        return workspace.deleteWorkspacesData(workspaceIds);
    }

    // --- Backup/Clear (from backup.js) ---
    async exportData() {
        return backup.exportData();
    }

    async importData(jsonData) {
        return backup.importData(jsonData);
    }

    async clearAll() {
        return backup.clearAll();
    }

    // Granular Export Methods
    async exportReports() {
        return backup.exportReports();
    }

    async exportGroups() {
        return backup.exportGroups();
    }

    async exportMarks() {
        return backup.exportMarks();
    }

    // Granular Import Methods
    async importReports(jsonData) {
        return backup.importReports(jsonData);
    }

    async importGroups(jsonData) {
        return backup.importGroups(jsonData);
    }

    async importMarks(jsonData) {
        return backup.importMarks(jsonData);
    }

    async exportSummary() {
        return backup.exportSummary();
    }

    async importSummary(jsonData) {
        return backup.importSummary(jsonData);
    }

    // Granular Clear Methods
    async clearReports() {
        return backup.clearReports();
    }

    async clearGroups() {
        return backup.clearGroups();
    }

    async clearMarks() {
        return backup.clearMarks();
    }

    async clearMembers() {
        return backup.clearMembers();
    }

    async clearFinalAssessments() {
        return backup.clearFinalAssessments();
    }

    async clearModules() {
        return backup.clearModules();
    }

    // --- Statistics (from stats.js) ---
    async getEntityCounts() {
        return stats.getEntityCounts();
    }

    async getEntitySizes() {
        return stats.getEntitySizes();
    }

    async getAllWorkspacesSizes() {
        return stats.getAllWorkspacesSizes();
    }
}

export const repository = Object.freeze(new Repository());