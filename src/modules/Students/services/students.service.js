
// Actually, in Phase 1 we migrated to specific repositories but kept `repository/index.js` as facade.
// For Phase 2, we should use the specific repositories if possible, or the facade if it simplifies things.
// `useStudents.js` used `../services/repository` (facade). 
// The facsimile `repository` is located at `src/services/repository/index.js`.
// But we want to use the new modular Structure.
// `src/modules/Students/services/students.repository.js` exists.
// `src/shared/services/settings.repository.js` exists.
// `src/modules/Analytics/services/meets.repository.js` exists.
// `src/modules/Marks/services/tasks.repository.js` exists.

// To avoid circular or messy imports, checking `repository/index.js` content showed it exports everything.
// Accessing it via facade is safer for now to avoid Missing Exports, OR we can import specific ones.
// Given strict "Module" refactoring, we should import what we need.

import { studentsRepository } from './students.repository';
import { meetsRepository } from '../../Analytics/services/meets.repository';
import { groupsRepository } from '../../Groups/services/groups.repository';
import { tasksRepository } from '../../Marks/services/tasks.repository';
import { marksRepository } from '../../Marks/services/marks.repository';
import { settingsRepository } from '@/shared/services/settings.repository';
// We might need to adjust paths. `src/modules/Students/services` -> `../../Analytics...`

// Helper for mark formatting (duplicated from useMarkFormat to avoid composable dependency)
function formatMarkToFiveScale(score, maxPoints) {
    const max = Number(maxPoints) || 100;
    const percent = (Number(score) / max) * 100;

    if (percent >= 90) return 5;
    if (percent >= 75) return 4;
    if (percent >= 60) return 3;
    if (percent >= 35) return 2;
    return 1;
}

export class StudentsService {
    async loadStudentsData() {
        // Sync members first
        await studentsRepository.syncAllMembersFromMeets();

        const [allMeets, groupMap, teacherList, allMembers, allTasks, allMarks] = await Promise.all([
            meetsRepository.getAll(),
            groupsRepository.getGroupMap(),
            settingsRepository.getTeachers(),
            studentsRepository.getAll(), // `getAllMembers` equivalent
            tasksRepository.getAll(),
            marksRepository.getAll()
        ]);

        const durationLimitMinutes = await settingsRepository.getDurationLimit();
        const durationLimitSeconds = durationLimitMinutes > 0 ? durationLimitMinutes * 60 : Infinity;
        const teachersSet = new Set(teacherList);

        return this.processData({
            meets: allMeets,
            members: allMembers,
            tasks: allTasks,
            marks: allMarks,
            groupsMap: groupMap,
            teachers: teachersSet,
            durationLimitSeconds
        });
    }

    processData({ meets, members, tasks, marks, groupsMap, teachers, durationLimitSeconds }) {
        const studentMap = new Map();

        // Initialize members
        members.forEach(m => {
            if (m.role === 'teacher') return;
            if (teachers.has(m.name)) return;
            if (m.hidden) return;

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
        meets.forEach(meet => {
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

            const groupName = groupsMap[meet.meetId]?.name || meet.meetId;
            if (!meetsByGroup[groupName]) {
                meetsByGroup[groupName] = new Set();
            }
            meetsByGroup[groupName].add(meet);
        });

        // 2. Identify students/participation
        const nameToStudent = new Map();
        studentMap.forEach(s => {
            nameToStudent.set(s.name, s);
            if (s.aliases) s.aliases.forEach(a => nameToStudent.set(a, s));
        });

        meets.forEach(meet => {
            meet.participants.forEach(p => {
                const student = nameToStudent.get(p.name);
                if (student) {
                    student.totalDuration += p.duration;
                    student.sessionCount += 1;
                    if (!student.groupName && groupsMap[meet.meetId]?.name) {
                        student.groups.add(groupsMap[meet.meetId].name);
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
                const groupMeets = meetsByGroup[groupName] || new Set();
                groupMeets.forEach(meet => {
                    const meetDuration = meetDurations[meet.id];
                    if (meetDuration <= 0) return;

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
            meets,
            tasks
        };
    }

    async saveStudent(formData, originalStudent) {
        const oldName = originalStudent.name;
        const newName = formData.name;
        const currentId = originalStudent.id;

        const memberData = {
            id: oldName !== newName ? undefined : currentId,
            name: newName,
            email: formData.email,
            groupName: formData.groupName,
            role: originalStudent.role || 'student',
            hidden: originalStudent.hidden || false,
            aliases: originalStudent.aliases ? [...originalStudent.aliases] : []
        };

        if (oldName !== newName) {
            if (!memberData.aliases.includes(oldName)) {
                memberData.aliases.push(oldName);
            }
        }

        await studentsRepository.saveMember(memberData);
    }

    async deleteStudent(id) {
        await studentsRepository.hideMember(id);
    }

    async bulkDeleteStudents(ids) {
        await studentsRepository.hideMembers(ids);
    }
}

export const studentsService = new StudentsService();
