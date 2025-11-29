import { ref } from 'vue';
import { repository } from '../services/repository';
import { toast } from '../services/toast';

import { useMarkFormat } from '../composables/useMarkFormat';
const { formatMarkToFiveScale } = useMarkFormat();


export function useStudents() {
    const students = ref([]);
    const groupsMap = ref({});
    const teachers = ref(new Set());
    const meets = ref([]);
    const tasks = ref([]);
    const isLoading = ref(false);

    async function loadData() {
        isLoading.value = true;
        try {
            // Ensure all meet participants have member records
            await repository.syncAllMembersFromMeets();

            const [allMeets, allGroups, teacherList, allMembers, allTasks, allMarks] = await Promise.all([
                repository.getAllMeets(),
                repository.getGroupMap(),
                repository.getTeachers(),
                repository.getAllMembers(),
                repository.getAll('tasks'),
                repository.getAll('marks')
            ]);
            groupsMap.value = allGroups;
            teachers.value = new Set(teacherList);
            meets.value = allMeets;
            tasks.value = allTasks;
            processData(allMeets, allMembers, allTasks, allMarks);
        } finally {
            isLoading.value = false;
        }
    }

    async function processData(meets, members, tasks, marks) {
        const studentMap = new Map();

        // Get duration limit setting
        const durationLimitMinutes = await repository.getDurationLimit();
        const durationLimitSeconds = durationLimitMinutes > 0 ? durationLimitMinutes * 60 : Infinity;

        // Initialize with all known members
        members.forEach(m => {
            if (m.role === 'teacher') return; // Skip teachers
            if (teachers.value.has(m.name)) return; // Skip members listed as teachers in settings
            if (m.hidden) return; // Skip hidden/deleted members

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
                marks: [], // Store marks for this student
                totalTasks: 0, // Total tasks assigned to student's groups
                completedTasks: 0 // Tasks completed by student
            });
        });

        const meetDurations = {}; // meetId -> duration (seconds)
        const meetsByGroup = {}; // groupName -> Set(meet objects)

        // 1. Calculate meet durations and organize meets by group
        meets.forEach(meet => {
            // Calculate duration: use Median * 2 to filter massive outliers
            const durations = meet.participants.map(p => p.duration).sort((a, b) => a - b);
            let calculatedDuration = 0;

            if (durations.length > 0) {
                const mid = Math.floor(durations.length / 2);
                const median = durations.length % 2 !== 0
                    ? durations[mid]
                    : (durations[mid - 1] + durations[mid]) / 2;

                // Filter out durations that are more than 2x the median (likely outliers)
                const validDurations = durations.filter(d => d <= median * 2);

                // Use the max of the valid durations to capture the full class time
                calculatedDuration = Math.max(...validDurations);
            }

            // Apply duration limit to prevent time artifacts
            const duration = Math.min(calculatedDuration || 0, durationLimitSeconds);

            meetDurations[meet.id] = duration;

            const groupName = groupsMap.value[meet.meetId]?.name || meet.meetId;
            if (!meetsByGroup[groupName]) {
                meetsByGroup[groupName] = new Set();
            }
            meetsByGroup[groupName].add(meet);
        });

        // 2. Identify students and their groups
        // We ONLY iterate existing members now. 
        // Any participant NOT in members is effectively hidden/deleted (or hasn't been synced yet, but we just synced).

        // However, we need to populate stats for members based on meets.
        // We iterate meets to find participation.

        // OPTIMIZATION: Build a comprehensive name lookup
        const nameToStudent = new Map();
        studentMap.forEach(s => {
            nameToStudent.set(s.name, s);
            if (s.aliases) {
                s.aliases.forEach(a => nameToStudent.set(a, s));
            }
        });

        meets.forEach(meet => {
            const groupName = groupsMap.value[meet.meetId]?.name || meet.meetId;

            meet.participants.forEach(p => {
                const student = nameToStudent.get(p.name);
                if (student) {
                    student.totalDuration += p.duration;
                    student.sessionCount += 1;

                    // Only add inferred group if student doesn't have an assigned group
                    if (!student.groupName && groupsMap.value[meet.meetId]?.name) {
                        student.groups.add(groupsMap.value[meet.meetId].name);
                    }

                    student.meetIds.add(meet.meetId);
                }
            });
        });

        // 3. Calculate stats for each student
        studentMap.forEach(student => {
            // Use the determined groups for stats calculation
            const statsGroups = student.groups;

            // Set of names to check in meets (current name + aliases)
            const studentNames = new Set([student.name]);
            if (student.aliases) {
                student.aliases.forEach(a => studentNames.add(a));
            }

            statsGroups.forEach(groupName => {
                const groupMeets = meetsByGroup[groupName] || new Set();

                groupMeets.forEach(meet => {
                    const meetDuration = meetDurations[meet.id];
                    if (meetDuration <= 0) return; // Skip invalid meets

                    // Check if any of the student's names (or aliases) participated
                    const participant = meet.participants.find(p => studentNames.has(p.name));
                    const studentDuration = participant ? participant.duration : 0;

                    // Both possibleDuration and attendedDuration use the capped duration
                    student.possibleDuration += meetDuration;
                    student.attendedDuration += studentDuration;
                    student.totalSessions += 1;

                    const percent = Math.min((studentDuration / meetDuration) * 100, 100);
                    student.attendancePercentages.push(percent);
                });
            });

            student.totalAttendancePercent = student.possibleDuration > 0
                ? (student.attendedDuration / student.possibleDuration) * 100
                : 0;

            student.averageAttendancePercent = student.attendancePercentages.length > 0
                ? student.attendancePercentages.reduce((a, b) => a + b, 0) / student.attendancePercentages.length
                : 0;
        });

        // Create a task map for looking up maxPoints
        const taskMap = new Map();
        tasks.forEach(task => {
            taskMap.set(task.id, task);
        });

        // Calculate marks statistics for each student
        studentMap.forEach(student => {
            // Find all marks for this student (by member ID)
            const studentMarks = marks.filter(mark => mark.studentId === student.id);
            student.marks = studentMarks;

            // Calculate average mark in 5-grade scale
            if (studentMarks.length > 0) {
                let totalGrade = 0;
                let validMarksCount = 0;

                studentMarks.forEach(mark => {
                    // Look up the task to get maxPoints
                    const task = taskMap.get(mark.taskId);

                    if (task && task.maxPoints && task.maxPoints > 0) {
                        const grade = formatMarkToFiveScale({
                            score: mark.score,
                            maxPoints: task.maxPoints
                        });

                        totalGrade += grade;
                        validMarksCount++;
                    }
                });

                student.averageMark = validMarksCount > 0 ? totalGrade / validMarksCount : 0;
            } else {
                student.averageMark = 0;
            }

            // Calculate completion percentage
            // Count total tasks assigned to student's groups
            const groupTasksSet = new Set();
            student.groups.forEach(groupName => {
                const groupTasks = tasks.filter(task => task.groupName === groupName);
                groupTasks.forEach(task => groupTasksSet.add(task.id));
            });
            student.totalTasks = groupTasksSet.size;

            // Count completed tasks (tasks with marks for this student)
            const completedTaskIds = new Set(studentMarks.map(mark => mark.taskId));
            student.completedTasks = completedTaskIds.size;

            // Calculate completion percentage
            student.completionPercent = student.totalTasks > 0
                ? (student.completedTasks / student.totalTasks) * 100
                : 0;
        });

        students.value = Array.from(studentMap.values()).map(s => ({
            ...s,
            groups: Array.from(s.groups).sort(),
            meetIds: Array.from(s.meetIds).sort()
        }));
    }

    async function saveStudent(formData, originalStudent) {
        try {
            const oldName = originalStudent.name;
            const newName = formData.name;
            const currentId = originalStudent.id;

            // 2. Save/Update Member (Upsert by Name)
            // We must ONLY save persistent fields, not the view model stats
            const memberData = {
                id: oldName !== newName ? undefined : currentId, // If name changed, treat as new/merge target
                name: newName,
                email: formData.email,
                groupName: formData.groupName,
                role: originalStudent.role || 'student',
                hidden: originalStudent.hidden || false,
                aliases: originalStudent.aliases ? [...originalStudent.aliases] : []
            };

            // If name changed, add old name to aliases to preserve history
            if (oldName !== newName) {
                // Ensure aliases is an array (it should be from initialization, but be safe)
                if (!Array.isArray(memberData.aliases)) {
                    memberData.aliases = [];
                }
                if (!memberData.aliases.includes(oldName)) {
                    memberData.aliases.push(oldName);
                }
            }

            await repository.saveMember(memberData);
            await loadData();
            toast.success('Student updated');
        } catch (e) {
            console.error('Error in saveStudent:', e);
            toast.error('Error updating student');
            throw e;
        }
    }

    async function deleteStudent(id) {
        try {
            await repository.hideMember(id);
            await loadData();
            toast.success('Student deleted');
        } catch (e) {
            console.error(e);
            toast.error('Error deleting student');
            throw e;
        }
    }

    async function bulkDeleteStudents(ids) {
        try {
            await repository.hideMembers(ids);
            await loadData();
            toast.success('Selected students deleted');
        } catch (e) {
            console.error(e);
            toast.error('Error deleting students');
            throw e;
        }
    }

    return {
        students,
        groupsMap,
        teachers,
        meets,
        tasks,
        loadData,
        saveStudent,
        deleteStudent,
        bulkDeleteStudents,
        isLoading
    };
}
