import { ref } from 'vue';
import { repository } from '../services/repository';
import { toast } from '../services/toast';
import { v4 as uuidv4 } from 'uuid';
import { useMarkFormat } from './useMarkFormat';

const { formatMarkToFiveScale } = useMarkFormat();

export function useGroups() {
    const groups = ref([]);
    const memberCounts = ref({});
    const allMeetIds = ref([]);
    const allTeachers = ref([]);

    async function loadData() {
        const [loadedGroups, meets, members, teacherList, allTasks, allMarks] = await Promise.all([
            repository.getGroups(),
            repository.getAllMeets(),
            repository.getAllMembers(),
            repository.getTeachers(),
            repository.getAll('tasks'),
            repository.getAll('marks')
        ]);

        groups.value = loadedGroups;

        // Create a map of meetId -> groupName
        const meetToGroup = {};
        loadedGroups.forEach(g => {
            if (g.meetId) meetToGroup[g.meetId] = g.name;
        });

        // Identify teachers
        const teacherSet = new Set(teacherList);
        members.forEach(m => {
            if (m.role === 'teacher') teacherSet.add(m.name);
        });

        // Calculate unique members per group
        const groupMemberSets = {}; // groupName -> Set(studentName)
        const groupMemberIds = {}; // groupName -> Set(studentId)

        // 1. From Member entity explicit groupName
        members.forEach(m => {
            if (teacherSet.has(m.name)) return;
            if (m.groupName) {
                if (!groupMemberSets[m.groupName]) {
                    groupMemberSets[m.groupName] = new Set();
                    groupMemberIds[m.groupName] = new Set();
                }
                groupMemberSets[m.groupName].add(m.name);
                groupMemberIds[m.groupName].add(m.id);
            }
        });

        // 2. From Meets participants
        meets.forEach(meet => {
            const groupName = meetToGroup[meet.meetId];
            if (groupName) {
                if (!groupMemberSets[groupName]) {
                    groupMemberSets[groupName] = new Set();
                    groupMemberIds[groupName] = new Set(); // Note: we might not have IDs for pure participants if not synced, but syncAllMembersFromMeets should handle it
                }
                meet.participants.forEach(p => {
                    if (!teacherSet.has(p.name)) {
                        groupMemberSets[groupName].add(p.name);
                        // We can't easily add ID here without lookup, but the Member entity loop above covers synced members.
                        // For stats, we rely on Members.
                    }
                });
            }
        });

        // Convert Sets to counts
        const counts = {};
        for (const [name, set] of Object.entries(groupMemberSets)) {
            counts[name] = set.size;
        }
        memberCounts.value = counts;

        // Calculate Average Task Completion
        // 1. Map tasks to groups
        const tasksByGroup = {};
        allTasks.forEach(task => {
            if (!tasksByGroup[task.groupName]) tasksByGroup[task.groupName] = [];
            tasksByGroup[task.groupName].push(task.id);
        });

        // 2. Map marks to students
        const marksByStudent = {}; // studentId -> Set(taskId)
        allMarks.forEach(mark => {
            if (!marksByStudent[mark.studentId]) marksByStudent[mark.studentId] = new Set();
            marksByStudent[mark.studentId].add(mark.taskId);
        });

        // 3. Calculate for each group
        groups.value.forEach(group => {
            const groupName = group.name;
            const memberIds = groupMemberIds[groupName] ? Array.from(groupMemberIds[groupName]) : [];
            const groupTaskIds = tasksByGroup[groupName] || [];
            const totalGroupTasks = groupTaskIds.length;

            if (totalGroupTasks === 0 || memberIds.length === 0) {
                group.avgTaskCompletion = 0;
                return;
            }

            let totalStudentCompletionPercent = 0;

            memberIds.forEach(studentId => {
                const studentCompletedTasks = marksByStudent[studentId] || new Set();
                // Count how many of the group's tasks this student has completed
                let completedCount = 0;
                groupTaskIds.forEach(taskId => {
                    if (studentCompletedTasks.has(taskId)) {
                        completedCount++;
                    }
                });

                const completionPercent = (completedCount / totalGroupTasks) * 100;
                totalStudentCompletionPercent += completionPercent;
            });

            group.avgTaskCompletion = totalStudentCompletionPercent / memberIds.length;

            // Calculate Average and Mode Marks (5-scale)
            const groupMarks = [];
            memberIds.forEach(studentId => {
                const studentMarks = allMarks.filter(m => m.studentId === studentId);
                studentMarks.forEach(mark => {
                    // Find task to get maxPoints
                    const task = allTasks.find(t => t.id === mark.taskId);
                    if (task) {
                        const grade = formatMarkToFiveScale({
                            score: mark.score,
                            maxPoints: task.maxPoints
                        });
                        groupMarks.push(grade);
                    }
                });
            });

            if (groupMarks.length > 0) {
                // Average
                const sum = groupMarks.reduce((a, b) => a + b, 0);
                group.avgMark = sum / groupMarks.length;

                // Mode
                const frequency = {};
                let maxFreq = 0;
                let mode = groupMarks[0];

                groupMarks.forEach(m => {
                    frequency[m] = (frequency[m] || 0) + 1;
                    if (frequency[m] > maxFreq) {
                        maxFreq = frequency[m];
                        mode = m;
                    }
                });
                group.modeMark = mode;

                // Median
                const sortedMarks = [...groupMarks].sort((a, b) => a - b);
                const mid = Math.floor(sortedMarks.length / 2);
                if (sortedMarks.length % 2 === 0) {
                    group.medianMark = (sortedMarks[mid - 1] + sortedMarks[mid]) / 2;
                } else {
                    group.medianMark = sortedMarks[mid];
                }
            } else {
                group.avgMark = 0;
                group.modeMark = 0;
                group.medianMark = 0;
            }
        });

        // Extract unique meet IDs and potential teachers (participants)
        const meetIds = new Set();
        const teachers = new Set();

        meets.forEach(meet => {
            if (meet.meetId) meetIds.add(meet.meetId);
            if (meet.participants) {
                meet.participants.forEach(p => teachers.add(p.name));
            }
        });

        allMeetIds.value = Array.from(meetIds).sort();
        allTeachers.value = Array.from(teachers).sort();
    }

    async function saveGroup(formData) {
        if (!formData.name || !formData.meetId) {
            toast.error('Group Name and Meet ID are required');
            throw new Error('Validation failed');
        }

        try {
            const group = {
                id: formData.id || uuidv4(),
                ...formData
            };
            await repository.saveGroup(group);
            await loadData();
            toast.success(formData.id ? 'Group updated' : 'Group created');
        } catch (e) {
            console.error(e);
            toast.error('Error saving group');
            throw e;
        }
    }

    async function deleteGroup(id) {
        try {
            await repository.deleteGroup(id);
            await loadData();
            toast.success('Group deleted');
        } catch (e) {
            console.error(e);
            toast.error('Error deleting group');
            throw e;
        }
    }

    return {
        groups,
        memberCounts,
        allMeetIds,
        allTeachers,
        loadData,
        saveGroup,
        deleteGroup
    };
}
