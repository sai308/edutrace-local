import { ref } from 'vue';
import { repository } from '../services/repository';
import { toast } from '../services/toast';

export function useStudents() {
    const students = ref([]);
    const groupsMap = ref({});
    const teachers = ref(new Set());

    async function loadData() {
        // Ensure all meet participants have member records
        await repository.syncAllMembersFromMeets();

        const [allMeets, allGroups, teacherList, allMembers] = await Promise.all([
            repository.getAllMeets(),
            repository.getGroupMap(),
            repository.getTeachers(),
            repository.getAllMembers()
        ]);
        groupsMap.value = allGroups;
        teachers.value = new Set(teacherList);
        processData(allMeets, allMembers);
    }

    async function processData(meets, members) {
        const studentMap = new Map();

        // Get duration limit setting
        const durationLimitMinutes = await repository.getDurationLimit();
        const durationLimitSeconds = durationLimitMinutes > 0 ? durationLimitMinutes * 60 : Infinity;

        // Initialize with all known members
        members.forEach(m => {
            if (m.role === 'teacher') return; // Skip teachers
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
                attendancePercentages: []
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
            await repository.deleteMember(id);
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
            await repository.deleteMembers(ids);
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
        loadData,
        saveStudent,
        deleteStudent,
        bulkDeleteStudents
    };
}
