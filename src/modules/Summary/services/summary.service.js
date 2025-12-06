import { ref } from 'vue';
import { modulesRepository } from './modules.repository';
import { finalAssessmentsRepository } from './finalAssessments.repository';
import { studentsRepository } from '../../Students/services/students.repository';
import { tasksRepository } from '../../Marks/services/tasks.repository';
import { marksRepository } from '../../Marks/services/marks.repository';
import { meetsRepository } from '../../Analytics/services/meets.repository';
import { groupsRepository } from '../../Groups/services/groups.repository';
import { settingsRepository } from '@/shared/services/settings.repository';
import { repository } from '@/services/repository'; // Fallback for some things or cross-module? 
// Ideally we import specific repositories.
// repository.getAll('marks') -> marksRepository.getAllMarksWithRelations()? Or we need specific method.
// marksRepository.getMarksByStudent etc.
// useSummaryData used repository.getAll('marks') which fetches ALL marks. Efficient?
// Maybe for specific group we can optimize.
// But for now, let's replicate logic.

export class SummaryService {
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
            t // Localization function passed in
        } = options;

        // Fetch Data
        // Optimization: Fetch only for group?
        // repository.getMembersByGroup(group.name) -> studentsRepository...
        // repository.getTasksByGroup(group.name) -> tasksRepository...
        // repository.getAll('marks') -> This is heavy. marksRepository should have getMarksByGroup?
        // If not, we use getAll for now.

        const [
            members,
            allTasks,
            allMarks, // TODO: Optimize to fetch by group/students
            allMeets,
            allGroupsMap,
            durationLimitMinutes,
            allAssessments
        ] = await Promise.all([
            studentsRepository.getMembersByGroup(group.name),
            tasksRepository.getTasksByGroup(group.name),
            marksRepository.getAllMarksWithRelations(), // Or getAll('marks'). getAllMarksWithRelations is heavy/slow? 
            // Original used repository.getAll('marks').
            // Let's use marksRepository.getAllMarks() if available or equivalent.
            // checking marksRepository later.
            meetsRepository.getMeetsByMeetId(group.meetId),
            groupsRepository.getGroupMap(),
            settingsRepository.getDurationLimit(),
            finalAssessmentsRepository.getAllFinalAssessments()
        ]);

        const durationLimitSeconds = durationLimitMinutes > 0 ? durationLimitMinutes * 60 : Infinity;

        // Index Data
        const marksByStudent = new Map();
        // Check if allMarks is array of objects {studentId, ...}
        // getAllMarksWithRelations might return enriched objects.
        // If we use getAll('marks'), it's raw.
        // Let's assume raw marks for now.
        for (const mark of allMarks) {
            const sid = mark.studentId;
            if (!marksByStudent.has(sid)) marksByStudent.set(sid, []);
            marksByStudent.get(sid).push(mark);
        }

        const assessmentMap = new Map();
        for (const assess of allAssessments) {
            assessmentMap.set(`${assess.studentId}_${assess.assessmentType}`, assess);
        }

        const taskMap = new Map();
        allTasks.forEach(task => taskMap.set(task.id, task));

        const meetDurations = this.calculateMeetDurations(allMeets, durationLimitSeconds);
        const activeMembers = members.filter(m => m.role !== 'teacher' && !m.hidden);

        const formatMarkFn = this.createMarkFormatter(gradeFormat);
        const formatFiveScale = this.createMarkFormatter('5-scale');

        const testTaskIds = new Set();
        modules.forEach(m => {
            if (m.test?.id) testTaskIds.add(m.test.id);
        });

        const regularTasks = allTasks.filter(t => !testTaskIds.has(t.id));

        const studentsData = activeMembers.map(member => {
            const studentMarks = marksByStudent.get(member.id) || [];

            // Completion Logic
            const completedRegularTasks = new Set(
                studentMarks
                    .filter(m => !testTaskIds.has(m.taskId))
                    .map(m => m.taskId)
            ).size;

            const effectiveTotal = (requiredTasks > 0) ? requiredTasks : regularTasks.length;
            const completionExact = effectiveTotal > 0 ? (completedRegularTasks / effectiveTotal) * 100 : 0;

            // Attendance Logic
            const attendanceData = this.calculateAttendanceWithDetails(member, allMeets, meetDurations, t);

            // Grades Logic & Status
            const { moduleGrades, total, moduleDetails, isAutomaticCandidate, automaticFailureReason } = this.calculateModuleGrades(
                modules,
                studentMarks,
                taskMap,
                formatMarkFn,
                t
            );

            // Avg Mark
            let totalGrade = 0;
            let validMarksCount = 0;
            studentMarks.forEach(mark => {
                const task = taskMap.get(mark.taskId);
                if (task && task.maxPoints && task.maxPoints > 0) {
                    totalGrade += formatFiveScale((mark.score / task.maxPoints) * 100);
                    validMarksCount++;
                }
            });
            const averageMark = validMarksCount > 0 ? totalGrade / validMarksCount : 0;

            // Status Logic
            const isAttendanceMet = !attendanceEnabled || attendanceData.percentage >= attendanceThreshold;
            let status = 'notAllowed';

            if (isAutomaticCandidate && total !== null) {
                status = 'automatic';
            } else if (completionExact >= completionThreshold && isAttendanceMet) {
                status = 'allowed';
            }

            let statusCause = '';
            if (status === 'notAllowed') {
                const reasons = [];
                if (attendanceEnabled && attendanceData.percentage < attendanceThreshold) {
                    reasons.push(t('summary.data.reasons.attendance', {
                        percentage: Math.round(attendanceData.percentage),
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

            const assessment = assessmentMap.get(`${member.id}_${assessmentType}`);

            return {
                id: member.id,
                name: member.name,
                email: member.email,
                aliases: member.aliases || [],
                groups: [member.groupName],
                marks: studentMarks, // raw marks

                // Stats
                sessionCount: attendanceData.attendedMeets,
                totalSessions: attendanceData.totalMeets,
                totalDuration: attendanceData.attendedDuration,
                averageAttendancePercent: attendanceData.percentage,
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
                attendance: Math.round(attendanceData.percentage),
                attendanceExact: attendanceData.percentage.toFixed(2),
                attendanceDetails: attendanceData.details,
                status: status,
                statusCause,
                isAllowed: status === 'allowed' || status === 'automatic',
                moduleGrades,
                moduleDetails,
                total,
                examGrade: assessment ? assessment.grade : null,
                completedAt: assessment ? assessment.createdAt : null,

                // Expose raw data for profile
                meets: allMeets, // Note: This attaches ALL meets to EVERY student. Memory heavy? 
                // In composable, meets/tasks were exposed separately.
                // Here we return an array of students.
                // The caller might want 'meets' separately.
            };
        });

        // Return object with students and context data if needed
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

    // --- Groups & Settings ---
    async getGroups() {
        return groupsRepository.getGroups();
    }

    async getExamSettings() {
        return settingsRepository.getExamSettings();
    }

    async saveExamSettings(settings) {
        return settingsRepository.saveExamSettings(settings);
    }

    // --- Tasks ---
    async getTasksByGroup(groupName) {
        return tasksRepository.getTasksByGroup(groupName);
    }

    // --- Final Assessments ---
    async saveFinalAssessment(assessment) {
        return finalAssessmentsRepository.save(assessment);
    }

    async getFinalAssessmentByStudent(studentId, type) {
        return finalAssessmentsRepository.getByStudent(studentId, type);
    }

    async deleteFinalAssessment(id) {
        return finalAssessmentsRepository.delete(id);
    }

    // --- Modules ---
    async getModulesByGroup(groupName) {
        return modulesRepository.getModulesByGroup(groupName);
    }

    async saveModule(module) {
        return modulesRepository.saveModule(module);
    }

    async deleteModule(id) {
        return modulesRepository.deleteModule(id);
    }

    calculateMeetDurations(meets, durationLimitSeconds) {
        const meetDurations = {};
        for (const meet of meets) {
            const durations = meet.participants.map(p => p.duration).sort((a, b) => a - b);
            let calculatedDuration = 0;
            if (durations.length > 0) {
                const mid = Math.floor(durations.length / 2);
                const median = durations.length % 2 !== 0
                    ? durations[mid]
                    : (durations[mid - 1] + durations[mid]) / 2;

                let maxValid = 0;
                const threshold = median * 2;
                for (let i = 0; i < durations.length; i++) {
                    if (durations[i] <= threshold) {
                        if (durations[i] > maxValid) maxValid = durations[i];
                    }
                }
                calculatedDuration = maxValid;
            }
            meetDurations[meet.id] = Math.min(calculatedDuration || 0, durationLimitSeconds);
        }
        return meetDurations;
    }

    calculateAttendanceWithDetails(member, meets, meetDurations, t) {
        let attendedDuration = 0;
        let possibleDuration = 0;
        let attendedMeets = 0;
        const totalMeets = meets.length;

        const studentNames = new Set([member.name]);
        if (member.aliases) member.aliases.forEach(a => studentNames.add(a));

        for (const meet of meets) {
            const meetDuration = meetDurations[meet.id];
            if (!meetDuration || meetDuration <= 0) continue;
            possibleDuration += meetDuration;
            const participant = meet.participants.find(p => studentNames.has(p.name));
            const studentDuration = participant ? participant.duration : 0;
            attendedDuration += studentDuration;
            if (studentDuration > 0) attendedMeets++;
        }

        const percentage = possibleDuration > 0 ? (attendedDuration / possibleDuration) * 100 : 0;
        return {
            percentage,
            attendedMeets,
            totalMeets,
            attendedDuration,
            details: t('summary.data.details.attendance', {
                attended: attendedMeets,
                total: totalMeets
            })
        };
    }

    calculateModuleGrades(modules, studentMarks, taskMap, formatMark, t) {
        const moduleGrades = {};
        const calculatedGrades = [];
        const moduleDetails = {};
        let isAutomaticCandidate = true;
        let automaticFailureReason = null;

        if (modules.length === 0) isAutomaticCandidate = false;

        for (const module of modules) {
            const taskIds = (module.tasks || []).map(t => t.id);
            const testTaskId = module.test?.id;

            if (taskIds.length === 0 || !testTaskId) {
                isAutomaticCandidate = false;
                continue;
            }

            const taskMarks = [];
            let testMark = null;
            const moduleTaskIdsSet = new Set(taskIds);

            for (const mark of studentMarks) {
                if (moduleTaskIdsSet.has(mark.taskId)) {
                    const task = taskMap.get(mark.taskId);
                    if (task && task.maxPoints > 0) {
                        taskMarks.push((mark.score / task.maxPoints) * 100);
                    }
                } else if (mark.taskId === testTaskId) {
                    const task = taskMap.get(mark.taskId);
                    if (task && task.maxPoints > 0) {
                        testMark = (mark.score / task.maxPoints) * 100;
                    }
                }
            }

            const minRequired = module.minTasksRequired || 1;

            if (testMark === null || taskMarks.length < minRequired) {
                isAutomaticCandidate = false;
                if (!automaticFailureReason) {
                    if (testMark === null) automaticFailureReason = `Missing test in ${module.name}`;
                    else automaticFailureReason = `Not enough tasks in ${module.name}`;
                }
            }

            if (taskMarks.length < minRequired || testMark === null) {
                if (testMark === null) {
                    moduleDetails[module.name] = t('summary.data.details.modules.incompleteMissingTest');
                } else {
                    const missing = minRequired - taskMarks.length;
                    moduleDetails[module.name] = t('summary.data.details.modules.incompleteMissingTasks', { count: missing }, missing);
                }
                continue;
            }

            const avgTaskMark = taskMarks.reduce((sum, mark) => sum + mark, 0) / taskMarks.length;
            const tasksCoeff = module.tasksCoefficient || 1;
            const testCoeff = module.testCoefficient || 1;
            const moduleGrade = (avgTaskMark * tasksCoeff + testMark * testCoeff) / (tasksCoeff + testCoeff);

            moduleGrades[module.name] = formatMark(moduleGrade);
            calculatedGrades.push(moduleGrade);
            moduleDetails[module.name] = t('summary.data.details.modules.details', {
                avg: formatMark(avgTaskMark),
                tasksCoeff,
                test: formatMark(testMark),
                testCoeff
            });
        }

        const totalRaw = calculatedGrades.length === modules.length && calculatedGrades.length > 0
            ? calculatedGrades.reduce((sum, grade) => sum + grade, 0) / calculatedGrades.length
            : null;

        const total = totalRaw !== null ? formatMark(totalRaw) : null;

        return { moduleGrades, total, moduleDetails, isAutomaticCandidate, automaticFailureReason };
    }

    createMarkFormatter(gradeFormat) {
        return (percent) => {
            if (gradeFormat === '5-scale') {
                if (percent >= 90) return 5;
                if (percent >= 75) return 4;
                if (percent >= 60) return 3;
                if (percent >= 35) return 2;
                return 1;
            }
            if (gradeFormat === 'ects') {
                if (percent >= 90) return 'A';
                if (percent >= 82) return 'B';
                if (percent >= 75) return 'C';
                if (percent >= 67) return 'D';
                if (percent >= 60) return 'E';
                if (percent >= 35) return 'FX';
                return 'F';
            }
            if (gradeFormat === '100-scale') {
                return Math.round(percent);
            }
            return Math.round(percent);
        };
    }
}

export const summaryService = new SummaryService();
