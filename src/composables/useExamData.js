import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { repository } from '../services/repository';

export function useExamData() {
    const { t } = useI18n();
    const students = ref([]);
    const isLoading = ref(false);

    // Data required for StudentProfileModal
    const meets = ref([]);
    const tasks = ref([]);
    const groupsMap = ref({});

    /**
     * Load and calculate exam data for students in a group
     */
    async function loadExamData(
        group,
        modules = [],
        completionThreshold = 70,
        attendanceThreshold = 60,
        attendanceEnabled = true,
        gradeFormat = '5-scale',
        requiredTasks = 0,
        assessmentType = 'examination'
    ) {
        if (!group) {
            students.value = [];
            return;
        }

        isLoading.value = true;
        try {
            // 1. Fetch all required data
            const [
                members,
                allTasks,
                allMarks,
                allMeets,
                allGroupsMap,
                durationLimitMinutes,
                allAssessments
            ] = await Promise.all([
                repository.getMembersByGroup(group.name),
                repository.getTasksByGroup(group.name),
                repository.getAll('marks'), // WARN: Consider filtering by group on backend if D1 table is large
                repository.getMeetsByMeetId(group.meetId),
                repository.getGroupMap(),
                repository.getDurationLimit(),
                repository.getAllFinalAssessments()
            ]);

            // Expose raw data for profile modal
            meets.value = allMeets;
            tasks.value = allTasks;
            groupsMap.value = allGroupsMap;

            const durationLimitSeconds = durationLimitMinutes > 0 ? durationLimitMinutes * 60 : Infinity;

            // 2. Data Indexing (The Performance Fix)
            // Group marks by studentId for O(1) lookup
            const marksByStudent = new Map();
            for (const mark of allMarks) {
                const sid = mark.studentId;
                if (!marksByStudent.has(sid)) marksByStudent.set(sid, []);
                marksByStudent.get(sid).push(mark);
            }

            // Index assessments by studentId + type key
            const assessmentMap = new Map();
            for (const assess of allAssessments) {
                // Key format: "studentId_type"
                assessmentMap.set(`${assess.studentId}_${assess.assessmentType}`, assess);
            }

            // Create task map
            const taskMap = new Map();
            allTasks.forEach(task => taskMap.set(task.id, task));

            // 3. Pre-calculations
            const meetDurations = calculateMeetDurations(allMeets, durationLimitSeconds);
            const activeMembers = members.filter(m => m.role !== 'teacher' && !m.hidden);

            // Create the formatting function instance once
            const formatMarkFn = createMarkFormatter(gradeFormat);
            const formatFiveScale = createMarkFormatter('5-scale'); // For average mark calculation

            // Identify Test Tasks (Global Set)
            const testTaskIds = new Set();
            modules.forEach(m => {
                if (m.test?.id) testTaskIds.add(m.test.id);
            });

            // Filter Regular Tasks (Exclude Test Tasks)
            const regularTasks = allTasks.filter(t => !testTaskIds.has(t.id));

            // 4. Process each student
            const studentsData = activeMembers.map(member => {
                // Fast Lookup
                const studentMarks = marksByStudent.get(member.id) || [];

                // --- Completion Logic (Global - Allowed Status) ---
                // Count unique regular tasks completed
                const completedRegularTasks = new Set(
                    studentMarks
                        .filter(m => !testTaskIds.has(m.taskId))
                        .map(m => m.taskId)
                ).size;

                const totalRegularTasks = regularTasks.length;
                const effectiveTotal = (requiredTasks > 0) ? requiredTasks : totalRegularTasks;
                const completionExact = effectiveTotal > 0 ? (completedRegularTasks / effectiveTotal) * 100 : 0;

                // --- Attendance Logic ---
                const attendanceData = calculateAttendanceWithDetails(member, allMeets, meetDurations);

                // --- Grades Logic & Automatic Status Check ---
                const { moduleGrades, total, moduleDetails, isAutomaticCandidate, automaticFailureReason } = calculateModuleGrades(
                    modules,
                    studentMarks,
                    taskMap,
                    formatMarkFn,
                    t
                );

                // --- Average Mark Calculation (for Profile) ---
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

                // --- Status Logic ---
                const isAttendanceMet = !attendanceEnabled || attendanceData.percentage >= attendanceThreshold;
                let status = 'notAllowed';

                // Automatic: All modules met criteria
                if (isAutomaticCandidate && total !== null) {
                    status = 'automatic';
                }
                // Allowed: Global completion >= threshold AND attendance met
                else if (completionExact >= completionThreshold && isAttendanceMet) {
                    status = 'allowed';
                }

                // Determine Cause
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
                    // If completion is high enough for allowed, but not automatic, and total is missing
                    if (completionExact >= completionThreshold && isAttendanceMet && total === null) {
                        reasons.push(t('summary.data.reasons.modulesIncomplete'));
                    }
                    // If it was a candidate for automatic but failed due to specific module reasons
                    if (!isAutomaticCandidate && automaticFailureReason) {
                        // This might be too detailed for the general status cause, but useful context
                        // For now, let's stick to the high-level reasons
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

                const isAllowed = status === 'allowed' || status === 'automatic';

                // Fast Assessment Lookup
                const assessment = assessmentMap.get(`${member.id}_${assessmentType}`);

                return {
                    id: member.id,
                    name: member.name,
                    email: member.email,
                    aliases: member.aliases || [],
                    groups: [member.groupName], // For profile modal
                    marks: studentMarks, // For profile modal

                    // Stats for profile modal
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
                    status: status, // Store raw status value, translate in template
                    statusCause,
                    isAllowed,
                    moduleGrades,
                    moduleDetails,
                    total,
                    examGrade: assessment ? assessment.grade : null,
                    completedAt: assessment ? assessment.createdAt : null
                };
            });

            students.value = studentsData;
        } catch (error) {
            console.error('Error loading exam data:', error);
            students.value = [];
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * Helper factory to avoid re-evaluating gradeFormat logic inside loops
     */
    function createMarkFormatter(gradeFormat) {
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

    function calculateMeetDurations(meets, durationLimitSeconds) {
        const meetDurations = {};

        // Use for...of for cleaner iteration
        for (const meet of meets) {
            // Optimization: Filter and sort in one go if possible, but Sort is crucial here
            const durations = meet.participants.map(p => p.duration).sort((a, b) => a - b);

            let calculatedDuration = 0;
            if (durations.length > 0) {
                const mid = Math.floor(durations.length / 2);
                const median = durations.length % 2 !== 0
                    ? durations[mid]
                    : (durations[mid - 1] + durations[mid]) / 2;

                // Filter outliers
                let maxValid = 0;
                const threshold = median * 2;

                // Micro-optimization: avoid creating new array with filter, just find max
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

    function calculateAttendanceWithDetails(member, meets, meetDurations) {
        let attendedDuration = 0;
        let possibleDuration = 0;
        let attendedMeets = 0;
        const totalMeets = meets.length;

        const studentNames = new Set([member.name]);
        if (member.aliases) {
            member.aliases.forEach(a => studentNames.add(a));
        }

        for (const meet of meets) {
            const meetDuration = meetDurations[meet.id];
            // Skip invalid meets early
            if (!meetDuration || meetDuration <= 0) continue;

            possibleDuration += meetDuration;

            // Optimization: Find is usually faster than iterating all if we stop early
            const participant = meet.participants.find(p => studentNames.has(p.name));
            const studentDuration = participant ? participant.duration : 0;

            attendedDuration += studentDuration;
            if (studentDuration > 0) {
                attendedMeets++;
            }
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

    function calculateModuleGrades(modules, studentMarks, taskMap, formatMark, t) {
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

            // Optimization: Single pass through student marks to find relevant ones
            // (Previous code scanned studentMarks twice: once for tasks, once for test)
            const taskMarks = [];
            let testMark = null;

            // Create a Set for O(1) checking if a mark belongs to this module
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

            // Logic Check for Automatic Status
            // 1. Must have Test Mark
            // 2. Must have >= minRequired tasks
            if (testMark === null || taskMarks.length < minRequired) {
                isAutomaticCandidate = false;
                if (!automaticFailureReason) { // Capture first failure reason
                    if (testMark === null) automaticFailureReason = `Missing test in ${module.name}`;
                    else automaticFailureReason = `Not enough tasks in ${module.name}`;
                }
            }

            // Logic Check for Grade Calculation (Same as before, but maybe we want to show partial info?)
            // For now, keeping existing behavior: if incomplete, no grade.
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

    return {
        students,
        isLoading,
        loadExamData,
        meets,
        tasks,
        groupsMap
    };
}