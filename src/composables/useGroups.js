import { ref } from 'vue';
import { repository } from '../services/repository';
import { toast } from '../services/toast';
import { v4 as uuidv4 } from 'uuid';

export function useGroups() {
    const groups = ref([]);
    const memberCounts = ref({});
    const allMeetIds = ref([]);
    const allTeachers = ref([]);

    async function loadData() {
        const [loadedGroups, meets, members, teacherList] = await Promise.all([
            repository.getGroups(),
            repository.getAllMeets(),
            repository.getAllMembers(),
            repository.getTeachers()
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

        // 1. From Member entity explicit groupName
        members.forEach(m => {
            if (teacherSet.has(m.name)) return;
            if (m.groupName) {
                if (!groupMemberSets[m.groupName]) groupMemberSets[m.groupName] = new Set();
                groupMemberSets[m.groupName].add(m.name);
            }
        });

        // 2. From Meets participants
        meets.forEach(meet => {
            const groupName = meetToGroup[meet.meetId];
            if (groupName) {
                if (!groupMemberSets[groupName]) groupMemberSets[groupName] = new Set();
                meet.participants.forEach(p => {
                    if (!teacherSet.has(p.name)) {
                        groupMemberSets[groupName].add(p.name);
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
