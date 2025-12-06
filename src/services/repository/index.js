// index.js (Adapter for Backward Compatibility)

import { databaseService } from '@/shared/services/DatabaseService';
import { workspaceRepository } from '@/shared/services/workspace.repository';
import { settingsRepository } from '@/shared/services/settings.repository';
import { meetsRepository } from '@/modules/Analytics/services/meets.repository';
import { groupsRepository } from '@/modules/Groups/services/groups.repository';
import { studentsRepository } from '@/modules/Students/services/students.repository';
import { tasksRepository } from '@/modules/Marks/services/tasks.repository';
import { marksRepository } from '@/modules/Marks/services/marks.repository';
import { modulesRepository } from '@/modules/Summary/services/modules.repository';
import { finalAssessmentsRepository } from '@/modules/Summary/services/finalAssessments.repository';
import * as backupService from '@/shared/services/backup.service';
import * as statsService from '@/shared/services/stats.service';

// Stats was not moved in my plan, likely missed. 
// Step 40 showed `stats.js`.
// I should move `stats.js` too? It uses repositories.
// Let's assume stats.js is still local for now, but it imports from ./db probably.
// If stats.js imports ./db, we need to fix it or move it.
// Let's check stats.js content later. For now, keep it if it works, or if it breaks I fix it.

class Repository {
    // General DB Access
    async getAll(storeName) {
        const db = await databaseService.getDb();
        return db.getAll(storeName);
    }

    // --- Meets/Reports ---
    async saveMeet(meetData) {
        return meetsRepository.saveMeet(meetData);
    }

    async getAllMeets() {
        return meetsRepository.getAllMeets();
    }

    async getMeetsByMeetId(meetId) {
        return meetsRepository.getMeetsByMeetId(meetId);
    }

    async getMeetById(id) {
        return meetsRepository.getMeetById(id);
    }

    async checkMeetExists(meetId, date) {
        return meetsRepository.checkMeetExists(meetId, date);
    }

    async isDuplicateFile(filename, meetId, date) {
        return meetsRepository.isDuplicateFile(filename, meetId, date);
    }

    async deleteMeet(id) {
        return meetsRepository.deleteMeet(id);
    }

    async deleteMeets(ids) {
        return meetsRepository.deleteMeets(ids);
    }

    async applyDurationLimitToAll(limitMinutes) {
        return meetsRepository.applyDurationLimitToAll(limitMinutes);
    }

    // --- Groups ---
    async getGroups() {
        return groupsRepository.getGroups();
    }

    async saveGroup(group) {
        return groupsRepository.saveGroup(group);
    }

    async syncMembersFromMeets(group) {
        return groupsRepository.syncMembersFromMeets(group);
    }

    async deleteGroup(id) {
        return groupsRepository.deleteGroup(id);
    }

    async getGroupMap() {
        return groupsRepository.getGroupMap();
    }

    // --- Members ---
    async saveMember(member) {
        return studentsRepository.saveMember(member);
    }

    async getAllMembers() {
        return studentsRepository.getAllMembers();
    }

    async getMembersByGroup(groupName) {
        return studentsRepository.getMembersByGroup(groupName);
    }

    async deleteMember(id) {
        return studentsRepository.deleteMember(id);
    }

    async deleteMembers(ids) {
        return studentsRepository.deleteMembers(ids);
    }

    async syncAllMembersFromMeets() {
        return studentsRepository.syncAllMembersFromMeets();
    }

    async hideMember(id) {
        return studentsRepository.hideMember(id);
    }

    async hideMembers(ids) {
        return studentsRepository.hideMembers(ids);
    }

    // Legacy Aliases
    async saveStudent(student) {
        return this.saveMember(student);
    }

    async getAllStudents() {
        return this.getAllMembers();
    }

    async getStudentsByGroup(groupName) {
        return this.getMembersByGroup(groupName);
    }

    async clearStudents() {
        return studentsRepository.clearMembers();
    }

    // Member clear equivalent
    async clearMembers() {
        return studentsRepository.clearMembers();
    }

    // --- Tasks ---
    async saveTask(task) {
        return tasksRepository.saveTask(task);
    }

    async getAllTasks() {
        return tasksRepository.getAllTasks();
    }

    async getTasksByGroup(groupName) {
        return tasksRepository.getTasksByGroup(groupName);
    }

    async findTaskByNaturalKey(name, date, groupName) {
        return tasksRepository.findTaskByNaturalKey(name, date, groupName);
    }

    // --- Modules ---
    async saveModule(module) {
        return modulesRepository.saveModule(module);
    }

    async getAllModules() {
        return modulesRepository.getAllModules();
    }

    async getModulesByGroup(groupName) {
        return modulesRepository.getModulesByGroup(groupName);
    }

    async getModuleById(id) {
        return modulesRepository.getModuleById(id);
    }

    async deleteModule(id) {
        return modulesRepository.deleteModule(id);
    }

    // --- FinalAssessments ---
    async saveFinalAssessment(assessment) {
        return finalAssessmentsRepository.saveFinalAssessment(assessment);
    }

    async getFinalAssessmentByStudent(studentId, assessmentType) {
        return finalAssessmentsRepository.getFinalAssessmentByStudent(studentId, assessmentType);
    }

    async getAllFinalAssessments() {
        return finalAssessmentsRepository.getAllFinalAssessments();
    }

    async getFinalAssessmentsByType(assessmentType) {
        return finalAssessmentsRepository.getFinalAssessmentsByType(assessmentType);
    }

    async deleteFinalAssessment(id) {
        return finalAssessmentsRepository.deleteFinalAssessment(id);
    }

    async updateAssessmentSyncStatus(id, syncedAt) {
        return finalAssessmentsRepository.updateSyncStatus(id, syncedAt);
    }

    async updateAssessmentDocumentStatus(id, documentedAt) {
        return finalAssessmentsRepository.updateDocumentStatus(id, documentedAt);
    }

    // --- Marks ---
    async saveMark(mark) {
        return marksRepository.saveMark(mark);
    }

    async getMarksByTask(taskId) {
        return marksRepository.getMarksByTask(taskId);
    }

    async updateMarkSynced(id, synced) {
        return marksRepository.updateMarkSynced(id, synced);
    }

    async getMarksByStudent(studentId) {
        return marksRepository.getMarksByStudent(studentId);
    }

    async deleteMark(id) {
        return marksRepository.deleteMark(id);
    }

    async deleteMarks(ids) {
        return marksRepository.deleteMarks(ids);
    }

    async getAllMarksWithRelations() {
        return marksRepository.getAllMarksWithRelations();
    }

    // --- Settings ---
    async getDurationLimit() {
        return settingsRepository.getDurationLimit();
    }

    async saveDurationLimit(limit) {
        return settingsRepository.saveDurationLimit(limit);
    }

    async getDefaultTeacher() {
        return settingsRepository.getDefaultTeacher();
    }

    async saveDefaultTeacher(teacher) {
        return settingsRepository.saveDefaultTeacher(teacher);
    }

    async getIgnoredUsers() {
        return settingsRepository.getIgnoredUsers();
    }

    async saveIgnoredUsers(users) {
        return settingsRepository.saveIgnoredUsers(users);
    }

    async getTeachers() {
        return settingsRepository.getTeachers();
    }

    async saveTeachers(teachers) {
        return settingsRepository.saveTeachers(teachers);
    }

    async getExamSettings() {
        return settingsRepository.getExamSettings();
    }

    async saveExamSettings(examSettings) {
        return settingsRepository.saveExamSettings(examSettings);
    }

    // --- Workspace ---
    getWorkspaces() {
        return workspaceRepository.getWorkspaces();
    }

    getCurrentWorkspaceId() {
        return workspaceRepository.getCurrentWorkspaceId();
    }

    async createWorkspace(name, options = {}) {
        return workspaceRepository.createWorkspace(name, options);
    }

    async updateWorkspace(id, updates) {
        return workspaceRepository.updateWorkspace(id, updates);
    }

    async exportWorkspaces(workspaceIds) {
        return workspaceRepository.exportWorkspaces(workspaceIds);
    }

    async importWorkspaces(data, selectedIds) {
        return workspaceRepository.importWorkspaces(data, selectedIds);
    }

    async switchWorkspace(id) {
        return workspaceRepository.switchWorkspace(id);
    }

    async deleteWorkspace(id) {
        return workspaceRepository.deleteWorkspace(id);
    }

    async deleteWorkspacesData(workspaceIds) {
        return workspaceRepository.deleteWorkspacesData(workspaceIds);
    }

    // --- Backup/Clear ---
    async exportData() {
        return backupService.exportData();
    }

    async importData(jsonData) {
        return backupService.importData(jsonData);
    }

    async clearAll() {
        return backupService.clearAll();
    }

    async exportReports() {
        return backupService.exportReports();
    }

    async exportGroups() {
        return backupService.exportGroups();
    }

    async exportMarks() {
        return backupService.exportMarks();
    }

    async importReports(jsonData) {
        return backupService.importReports(jsonData);
    }

    async importGroups(jsonData) {
        return backupService.importGroups(jsonData);
    }

    async importMarks(jsonData) {
        return backupService.importMarks(jsonData);
    }

    async exportSummary() {
        return backupService.exportSummary();
    }

    async importSummary(jsonData) {
        return backupService.importSummary(jsonData);
    }

    async clearReports() {
        return backupService.clearReports();
    }

    async clearGroups() {
        return backupService.clearGroups();
    }

    async clearMarks() {
        return backupService.clearMarks();
    }

    // clearMembers already defined above

    async clearFinalAssessments() {
        return backupService.clearFinalAssessments();
    }

    async clearModules() {
        return backupService.clearModules();
    }

    // --- Statistics ---
    // Should be moved or wrapped
    async getEntityCounts() {
        // stats.js needs lookup.
        return statsService.getEntityCounts();
    }

    async getEntitySizes() {
        return statsService.getEntitySizes();
    }

    async getAllWorkspacesSizes() {
        return workspaceRepository.getAllWorkspacesSizes();
    }
}

export const repository = Object.freeze(new Repository());