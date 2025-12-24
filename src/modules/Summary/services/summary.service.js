import * as Comlink from 'comlink';
import SummaryWorker from '@/workers/summary.worker?worker'; // Import worker
import { modulesRepository } from './modules.repository';
import { finalAssessmentsRepository } from './finalAssessments.repository';
import { studentsRepository } from '../../Students/services/students.repository';
import { tasksRepository } from '../../Marks/services/tasks.repository';
import { marksRepository } from '../../Marks/services/marks.repository';
import { meetsRepository } from '../../Analytics/services/meets.repository';
import { groupsRepository } from '../../Groups/services/groups.repository';
import { settingsRepository } from '@/shared/services/settings.repository';

export class SummaryService {
    constructor() {
        this.workerWrapper = new SummaryWorker();
        this.worker = Comlink.wrap(this.workerWrapper);
    }

    async loadExamData(group, options = {}) {
        if (!group) return [];

        const {
            modules = [],
            completionThreshold = 70,
            attendanceThreshold = 60,
            attendanceEnabled = true,
            gradeFormat = '5-scale',
            requiredTasks = 0,
            assessmentType = 'examination',
            t // Localization function
        } = options;

        const [
            members,
            allTasks,
            allMarks,
            allMeets,
            allGroupsMap,
            durationLimitMinutes,
            allAssessments
        ] = await Promise.all([
            studentsRepository.getMembersByGroup(group.name),
            tasksRepository.getTasksByGroup(group.name),
            marksRepository.getMarksByGroup(group.name),
            meetsRepository.getMeetsByMeetId(group.meetId),
            groupsRepository.getGroupMap(),
            settingsRepository.getDurationLimit(),
            finalAssessmentsRepository.getAllFinalAssessments()
        ]);

        const durationLimitSeconds = durationLimitMinutes > 0 ? durationLimitMinutes * 60 : Infinity;
        const activeMembers = members.filter(m => m.role !== 'teacher' && !m.hidden);

        // Offload calculation to worker
        // Pass Plain Objects (POJOs)
        const workerResults = await this.worker.calculateSummary(
            JSON.parse(JSON.stringify(activeMembers)),
            JSON.parse(JSON.stringify(allMarks)),
            JSON.parse(JSON.stringify(allMeets)),
            JSON.parse(JSON.stringify(allTasks)),
            JSON.parse(JSON.stringify(modules)),
            {
                durationLimitSeconds,
                gradeFormat,
                requiredTasks
            }
        );

        // Map Results back to UI model with localization
        const assessmentMap = new Map();
        for (const assess of allAssessments) {
            assessmentMap.set(`${assess.studentId}_${assess.assessmentType}`, assess);
        }

        const statsMap = new Map();
        workerResults.forEach(r => statsMap.set(r.id, r.stats));

        const marksByStudent = new Map();
        for (const mark of allMarks) {
            const sid = mark.studentId;
            if (!marksByStudent.has(sid)) marksByStudent.set(sid, []);
            marksByStudent.get(sid).push(mark);
        }

        const studentsData = activeMembers.map(member => {
            const stats = statsMap.get(member.id);
            if (!stats) return null; // Should not happen for active members

            const { completionExact, completedRegularTasks, effectiveTotal, attendance, modules: moduleStats, averageMark } = stats;
            const { percentage: attendancePercent, attendedMeets, totalMeets, attendedDuration } = attendance;
            const { moduleGrades, total, moduleDetailsData, isAutomaticCandidate, automaticFailureReason } = moduleStats;

            // Reconstruct status logic (lightweight)
            const isAttendanceMet = !attendanceEnabled || attendancePercent >= attendanceThreshold;
            let status = 'notAllowed';

            if (isAutomaticCandidate && total !== null) {
                status = 'automatic';
            } else if (completionExact >= completionThreshold && isAttendanceMet) {
                status = 'allowed';
            }

            // Localization Logic (Main Thread)
            let statusCause = '';
            if (status === 'notAllowed') {
                const reasons = [];
                if (attendanceEnabled && attendancePercent < attendanceThreshold) {
                    reasons.push(t('summary.data.reasons.attendance', {
                        percentage: Math.round(attendancePercent),
                        threshold: attendanceThreshold
                    }));
                }
                if (completionExact < completionThreshold) {
                    reasons.push(t('summary.data.reasons.completion', {
                        percentage: Math.round(completionExact),
                        threshold: completionThreshold
                    }));
                }
                if (completionExact >= completionThreshold && isAttendanceMet && total === null) {
                    reasons.push(t('summary.data.reasons.modulesIncomplete'));
                }
                statusCause = reasons.length === 0
                    ? t('summary.data.cause.criteriaNotMet')
                    : t('summary.data.cause.requirementsNotMet', { reasons: reasons.join(', ') });
            } else if (status === 'automatic') {
                statusCause = t('summary.data.cause.excellentPerformance', {
                    completion: Math.round(completionExact)
                });
            } else if (status === 'allowed') {
                statusCause = t('summary.data.cause.admitted', {
                    attendanceThreshold,
                    completionThreshold
                });
            }

            // Map module details data to strings
            const moduleDetails = {};
            Object.entries(moduleDetailsData).forEach(([modName, det]) => {
                if (det.type === 'incompleteMissingTest') {
                    moduleDetails[modName] = t('summary.data.details.modules.incompleteMissingTest');
                } else if (det.type === 'incompleteMissingTasks') {
                    moduleDetails[modName] = t('summary.data.details.modules.incompleteMissingTasks', { count: det.count }, det.count);
                } else if (det.type === 'details') {
                    moduleDetails[modName] = t('summary.data.details.modules.details', {
                        avg: det.data.avg,
                        tasksCoeff: det.data.tasksCoeff,
                        test: det.data.test,
                        testCoeff: det.data.testCoeff
                    });
                }
            });

            const assessment = assessmentMap.get(`${member.id}_${assessmentType}`);

            return {
                id: member.id,
                name: member.name,
                email: member.email,
                aliases: member.aliases || [],
                groups: [member.groupName],
                marks: marksByStudent.get(member.id) || [],

                // Stats
                sessionCount: attendedMeets,
                totalSessions: totalMeets,
                totalDuration: attendedDuration,
                averageAttendancePercent: attendancePercent,
                averageMark: averageMark,
                totalTasks: effectiveTotal,
                completedTasks: completedRegularTasks,
                completionPercent: completionExact,

                completion: Math.round(completionExact),
                completionExact: completionExact.toFixed(2),
                completionDetails: t('summary.data.details.completion', {
                    completed: completedRegularTasks,
                    total: effectiveTotal
                }),
                attendance: Math.round(attendancePercent),
                attendanceExact: attendancePercent.toFixed(2),
                attendanceDetails: t('summary.data.details.attendance', {
                    attended: attendedMeets,
                    total: totalMeets
                }),
                status,
                statusCause,
                isAllowed: status === 'allowed' || status === 'automatic',
                moduleGrades,
                moduleDetails,
                total,
                examGrade: assessment ? assessment.grade : null,
                completedAt: assessment ? assessment.createdAt : null,
                meets: allMeets
            };
        }).filter(Boolean);

        return {
            students: studentsData,
            context: {
                meets: allMeets,
                tasks: allTasks,
                groupsMap: allGroupsMap
            }
        };
    }

    async getAllFinalAssessments() {
        return finalAssessmentsRepository.getAllFinalAssessments();
    }

    async getMembersByGroup(groupName) {
        return studentsRepository.getMembersByGroup(groupName);
    }

    async updateAssessmentSyncStatus(id, syncedAt) {
        return finalAssessmentsRepository.updateSyncStatus(id, syncedAt);
    }

    async updateAssessmentDocumentStatus(id, documentedAt) {
        return finalAssessmentsRepository.updateDocumentStatus(id, documentedAt);
    }

    async getGroups() {
        return groupsRepository.getGroups();
    }

    async getExamSettings() {
        return settingsRepository.getExamSettings();
    }

    async saveExamSettings(settings) {
        return settingsRepository.saveExamSettings(settings);
    }

    async getTasksByGroup(groupName) {
        return tasksRepository.getTasksByGroup(groupName);
    }

    async saveFinalAssessment(assessment) {
        return finalAssessmentsRepository.save(assessment);
    }

    async getFinalAssessmentByStudent(studentId, type) {
        return finalAssessmentsRepository.getByStudent(studentId, type);
    }

    async deleteFinalAssessment(id) {
        return finalAssessmentsRepository.delete(id);
    }

    async getModulesByGroup(groupName) {
        return modulesRepository.getModulesByGroup(groupName);
    }

    async saveModule(module) {
        return modulesRepository.saveModule(module);
    }

    async deleteModule(id) {
        return modulesRepository.deleteModule(id);
    }
}

export const summaryService = new SummaryService();
