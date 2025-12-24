import { studentsRepository } from './students.repository';
import { marksRepository } from '../../Marks/services/marks.repository';
import { meetsRepository } from '../../Analytics/services/meets.repository';
import { tasksRepository } from '../../Marks/services/tasks.repository';
import { groupsRepository } from '../../Groups/services/groups.repository';
import { settingsRepository } from '@/shared/services/settings.repository';
import { formatMarkToFiveScale } from '@/shared/utils/grades';

class StudentStatsService {
    /**
     * Loads and aggregates dashboard data.
     * @param {string|null} groupName - Optional group name to filter by.
     * @returns {Promise<Object>} Aggregated data
     */
    async loadDashboardData(groupName = null) {
        // 1. Fetch Students
        let members;
        if (groupName) {
            members = await studentsRepository.getMembersByGroup(groupName);
        } else {
            // Needed to sync members? Original code did `syncAllMembersFromMeets`.
            // We probably should still do it if viewing all or rely on reconcilers.
            // For dashboard "view", let's assume members are there or synced elsewhere?
            // The original `loadStudentsData` called `syncAllMembersFromMeets`.
            // Let's keep it safe and call it if no group specified, or maybe just rely on DB.
            // PROMPT didn't explicitly say "Sync members", just "Fetch".
            // Let's just fetch for speed.
            members = await studentsRepository.getAllMembers();
        }

        const studentIds = members.map(m => m.id);

        // 2. Fetch Dependent Data in Parallel
        // We fetch ALL meets/tasks for now as we haven't optimized those repos fully yet
        // or the logic requires global context (like calculating median duration from all meets?)
        // Actually, median duration is per meet.
        // We could filter meets/tasks by group if we had indices.
        // Tasks has groupName index. Meets doesn't.

        const promises = [
            meetsRepository.getAll(),
            groupsRepository.getGroupMap(),
            settingsRepository.getTeachers(),
            marksRepository.getMarksByStudentIds(studentIds),
            settingsRepository.getDurationLimit()
        ];

        // Conditional Task Fetching
        if (groupName) {
            promises.push(tasksRepository.getTasksByGroup(groupName));
        } else {
            promises.push(tasksRepository.getAll());
        }

        const [allMeets, groupMap, teacherList, marks, durationLimitMinutes, tasks] = await Promise.all(promises);

        const durationLimitSeconds = durationLimitMinutes > 0 ? durationLimitMinutes * 60 : Infinity;
        const teachersSet = new Set(teacherList);

        // 3. Process Data
        return this.processData({
            meets: allMeets,
            members,
            tasks,
            marks,
            groupsMap: groupMap,
            teachers: teachersSet,
            durationLimitSeconds,
            targetGroupName: groupName
        });
    }

    processData({ meets, members, tasks, marks, groupsMap, teachers, durationLimitSeconds, targetGroupName }) {
        const studentMap = new Map();

        // Initialize members
        members.forEach(m => {
            if (m.role === 'teacher') return;
            if (teachers.has(m.name)) return;
            // if (m.hidden) return; // repo already handles hidden

            studentMap.set(m.name, {
                id: m.id,
                name: m.name,
                email: m.email,
                groupName: m.groupName,
                aliases: m.aliases || [],
                totalDuration: 0,
                sessionCount: 0,
                groups: new Set(m.groupName ? [m.groupName] : []),
                meetIds: new Set(),
                attendedDuration: 0,
                possibleDuration: 0,
                totalSessions: 0,
                attendancePercentages: [],
                marks: [],
                totalTasks: 0,
                completedTasks: 0,
                averageMark: 0,
                completionPercent: 0,
                totalAttendancePercent: 0,
                averageAttendancePercent: 0
            });
        });

        const meetDurations = {};
        const meetsByGroup = {};

        // 1. Calculate meet durations
        // Filter meets if we are in group mode? The meets array passed is ALL meets.
        // Logic currently iterates ALL.
        meets.forEach(meet => {
            // Optimization: If we have a targetGroupName, only process meets for that group?
            // "Meets" don't explicitly have groupName on them in all versions, 
            // but we can infer from `groupsMap[meet.meetId]`.

            const groupInfo = groupsMap[meet.meetId];
            const meetGroupName = groupInfo?.name || meet.groupName; // fallback

            if (targetGroupName && meetGroupName && meetGroupName !== targetGroupName) {
                // Skip calculation for unrelated meets if checking a specific group
                return;
            }

            const durations = meet.participants.map(p => p.duration).sort((a, b) => a - b);
            let calculatedDuration = 0;

            if (durations.length > 0) {
                const mid = Math.floor(durations.length / 2);
                const median = durations.length % 2 !== 0
                    ? durations[mid]
                    : (durations[mid - 1] + durations[mid]) / 2;

                const validDurations = durations.filter(d => d <= median * 2);
                calculatedDuration = Math.max(...validDurations);
            }

            const duration = Math.min(calculatedDuration || 0, durationLimitSeconds);
            meetDurations[meet.id] = duration;

            const finalGroupName = meetGroupName || meet.meetId;
            if (!meetsByGroup[finalGroupName]) {
                meetsByGroup[finalGroupName] = new Set();
            }
            meetsByGroup[finalGroupName].add(meet);
        });

        // 2. Identify students/participation
        const nameToStudent = new Map();
        studentMap.forEach(s => {
            nameToStudent.set(s.name, s);
            if (s.aliases) s.aliases.forEach(a => nameToStudent.set(a, s));
        });

        meets.forEach(meet => {
            // Same optimization check
            const groupInfo = groupsMap[meet.meetId];
            const meetGroupName = groupInfo?.name || meet.groupName;

            if (targetGroupName && meetGroupName && meetGroupName !== targetGroupName) {
                return;
            }

            meet.participants.forEach(p => {
                const student = nameToStudent.get(p.name);
                if (student) {
                    student.totalDuration += p.duration;
                    student.sessionCount += 1;
                    if (!student.groupName && meetGroupName) {
                        student.groups.add(meetGroupName);
                    }
                    student.meetIds.add(meet.meetId);
                }
            });
        });

        // 3. Stats
        studentMap.forEach(student => {
            const statsGroups = student.groups;
            const studentNames = new Set([student.name, ...(student.aliases || [])]);

            statsGroups.forEach(groupName => {
                // If filtering by group, only process that group's meets
                if (targetGroupName && groupName !== targetGroupName) return;

                const groupMeets = meetsByGroup[groupName] || new Set();
                groupMeets.forEach(meet => {
                    const meetDuration = meetDurations[meet.id];
                    if (!meetDuration || meetDuration <= 0) return;

                    const participant = meet.participants.find(p => studentNames.has(p.name));
                    const studentDuration = participant ? participant.duration : 0;

                    student.possibleDuration += meetDuration;
                    student.attendedDuration += studentDuration;
                    student.totalSessions += 1;
                    student.attendancePercentages.push(Math.min((studentDuration / meetDuration) * 100, 100));
                });
            });

            student.totalAttendancePercent = student.possibleDuration > 0
                ? (student.attendedDuration / student.possibleDuration) * 100
                : 0;

            student.averageAttendancePercent = student.attendancePercentages.length > 0
                ? student.attendancePercentages.reduce((a, b) => a + b, 0) / student.attendancePercentages.length
                : 0;
        });

        // 4. Marks
        const taskMap = new Map();
        tasks.forEach(task => taskMap.set(task.id, task));

        studentMap.forEach(student => {
            // marks are already filtered by studentIds in the caller, but we need to assign to specific student
            const studentMarks = marks.filter(mark => mark.studentId === student.id);
            student.marks = studentMarks;

            if (studentMarks.length > 0) {
                let totalGrade = 0;
                let validMarksCount = 0;

                studentMarks.forEach(mark => {
                    const task = taskMap.get(mark.taskId);
                    if (task && task.maxPoints > 0) {
                        totalGrade += formatMarkToFiveScale(mark.score, task.maxPoints);
                        validMarksCount++;
                    }
                });
                student.averageMark = validMarksCount > 0 ? totalGrade / validMarksCount : 0;
            }

            const groupTasksSet = new Set();
            student.groups.forEach(groupName => {
                // If filtering by group, only consider tasks for that group?
                if (targetGroupName && groupName !== targetGroupName) return;

                const groupTasks = tasks.filter(task => task.groupName === groupName);
                groupTasks.forEach(task => groupTasksSet.add(task.id));
            });
            student.totalTasks = groupTasksSet.size;

            const completedTaskIds = new Set(studentMarks.map(mark => mark.taskId));
            student.completedTasks = completedTaskIds.size;

            student.completionPercent = student.totalTasks > 0
                ? (student.completedTasks / student.totalTasks) * 100
                : 0;

            // Arrays
            student.groups = Array.from(student.groups).sort();
            student.meetIds = Array.from(student.meetIds).sort();
        });

        return {
            students: Array.from(studentMap.values()),
            groupsMap,
            teachers,
            meets, // Should we return filter meets if groupName was set? The UI might expect all. preserving original behavior of returning what was passed.
            tasks
        };
    }
}

export const studentStatsService = new StudentStatsService();
