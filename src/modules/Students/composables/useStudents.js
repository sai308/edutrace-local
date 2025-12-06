import { ref } from 'vue';
import { studentsService } from '../services/students.service';
import { toast } from '@/services/toast';

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
            const data = await studentsService.loadStudentsData();
            students.value = data.students;
            groupsMap.value = data.groupsMap;
            teachers.value = data.teachers;
            meets.value = data.meets;
            tasks.value = data.tasks;
        } catch (e) {
            console.error('Error loading student data:', e);
            toast.error('Failed to load students');
        } finally {
            isLoading.value = false;
        }
    }

    async function saveStudent(formData, originalStudent) {
        try {
            await studentsService.saveStudent(formData, originalStudent);
            await loadData();
            toast.success('Student updated');
        } catch (e) {
            console.error('Error in saveStudent:', e);
            toast.error('Error updating student');
        }
    }

    async function deleteStudent(id) {
        try {
            await studentsService.deleteStudent(id);
            await loadData();
            toast.success('Student deleted');
        } catch (e) {
            console.error(e);
            toast.error('Error deleting student');
        }
    }

    async function bulkDeleteStudents(ids) {
        try {
            await studentsService.bulkDeleteStudents(ids);
            await loadData();
            toast.success('Selected students deleted');
        } catch (e) {
            console.error(e);
            toast.error('Error deleting students');
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
