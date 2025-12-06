import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { summaryService } from '../services/summary.service';

export function useSummaryData() {
    const { t } = useI18n();
    const students = ref([]);
    const isLoading = ref(false);

    // Data required for StudentProfileModal
    const meets = ref([]);
    const tasks = ref([]);
    const groupsMap = ref({});

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
            const data = await summaryService.loadExamData(group, {
                modules,
                completionThreshold,
                attendanceThreshold,
                attendanceEnabled,
                gradeFormat,
                requiredTasks,
                assessmentType,
                t
            });

            students.value = data.students;
            meets.value = data.context.meets;
            tasks.value = data.context.tasks;
            groupsMap.value = data.context.groupsMap;

        } catch (error) {
            console.error('Error loading summary data:', error);
            students.value = [];
        } finally {
            isLoading.value = false;
        }
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