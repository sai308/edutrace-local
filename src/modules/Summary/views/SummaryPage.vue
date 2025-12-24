<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { List, Users, Percent, BookDashed, SquareStar } from 'lucide-vue-next';
import ExamStudentList from '../components/ExamStudentList.vue';
import CustomSelect from '@/components/CustomSelect.vue';
import { summaryService } from '../services/summary.service';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const props = defineProps(['group']); // group can also be passed as prop if used as component

const availableGroups = ref([]);
const selectedGroup = ref(null);
const assessmentType = ref('examination');
const completionThreshold = ref(70);
const attendanceThreshold = ref(60);
const attendanceEnabled = ref(true);
const requiredTasks = ref(0);
const modules = ref([]);
const selectedFormat = ref('100-scale');

const formatOptions = computed(() => [
    { value: '5-scale', label: t('marks.scales.5point') },
    { value: '100-scale', label: t('marks.scales.100point') },
    { value: 'ects', label: t('marks.scales.ects') }
]);

const assessmentTypeOptions = computed(() => [
    { value: 'examination', label: t('summary.types.examination') },
    { value: 'credit', label: t('summary.types.credit') }
]);


let saveTimeout = null;

onMounted(async () => {
    availableGroups.value = (await summaryService.getGroups()).sort((a, b) => a.name.localeCompare(b.name));

    const groupQuery = route.query.group;
    if (groupQuery && availableGroups.value.length > 0) {
        const matchedGroup = availableGroups.value.find(g => g.name === groupQuery);
        if (matchedGroup) {
            selectedGroup.value = matchedGroup;
        } else if (availableGroups.value.length > 0) {
            selectedGroup.value = availableGroups.value[0];
        }
    } else if (availableGroups.value.length > 0) {
        selectedGroup.value = availableGroups.value[0];
    }

    const savedSettings = await summaryService.getExamSettings();
    if (savedSettings) {
        if (savedSettings.assessmentType) assessmentType.value = savedSettings.assessmentType;
        if (savedSettings.completionThreshold !== undefined) completionThreshold.value = savedSettings.completionThreshold;
        if (savedSettings.attendanceThreshold !== undefined) attendanceThreshold.value = savedSettings.attendanceThreshold;
        if (savedSettings.attendanceEnabled !== undefined) attendanceEnabled.value = savedSettings.attendanceEnabled;
        if (savedSettings.requiredTasks !== undefined) requiredTasks.value = savedSettings.requiredTasks;
    }
});

watch([assessmentType, completionThreshold, attendanceThreshold, attendanceEnabled, requiredTasks], async () => {
    await summaryService.saveExamSettings({
        assessmentType: assessmentType.value,
        completionThreshold: completionThreshold.value,
        attendanceThreshold: attendanceThreshold.value,
        attendanceEnabled: attendanceEnabled.value,
        requiredTasks: requiredTasks.value
    });
}, { deep: true });

watch(selectedGroup, (newGroup) => {
    if (newGroup?.name) {
        router.replace({ query: { ...route.query, group: newGroup.name } });
    }
});

// Load modules when group changes
watch(selectedGroup, async (newGroup) => {
    if (newGroup?.name) {
        const groupModules = await summaryService.getModulesByGroup(newGroup.name);
        modules.value = groupModules;
    } else {
        modules.value = [];
    }
}, { immediate: true });


</script>

<template>
    <div class="container mx-auto p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div class="flex flex-col gap-2">
            <h1 class="text-3xl font-bold tracking-tight">{{ $t('nav.summary') }}</h1>
            <p class="text-muted-foreground">{{ $t('summary.description') }}</p>
        </div>

        <!-- Filters and Conditions Row -->
        <div class="flex flex-col lg:flex-row gap-4">
            <!-- Filters Container -->
            <div class="flex flex-wrap items-end gap-4 p-4 border rounded-lg bg-card flex-1">
                <!-- Group Picker -->
                <div class="flex-1 min-w-[200px]">
                    <CustomSelect v-model="selectedGroup" :options="availableGroups" display-key="name"
                        :placeholder="$t('summary.selectGroup')">
                        <template #label>
                            <Users class="w-4 h-4" />
                            {{ $t('summary.targetGroup') }}
                        </template>
                    </CustomSelect>
                </div>

                <!-- Format Picker -->
                <div class="flex-1 min-w-[200px]"
                    :class="{ 'opacity-50 pointer-events-none': viewMode === 'documents' }">
                    <CustomSelect v-model="selectedFormat" :options="formatOptions" display-key="label"
                        value-key="value" :placeholder="$t('marks.scales.default')"
                        :disabled="viewMode === 'documents'">
                        <template #label>
                            <SquareStar class="w-4 h-4" />
                            {{ $t('marks.gradeScale') }}
                        </template>
                    </CustomSelect>
                </div>
            </div>

            <!-- Conditions Container -->
            <div class="flex flex-wrap items-end gap-4 p-4 border rounded-lg bg-card">

                <!-- Assessment Type Picker -->
                <div class="flex-1 min-w-[150px]">
                    <CustomSelect v-model="assessmentType" :options="assessmentTypeOptions" display-key="label"
                        value-key="value">
                        <template #label>
                            <BookDashed class="w-4 h-4" />
                            {{ $t('summary.assessmentType') }}
                        </template>
                    </CustomSelect>
                </div>

                <!-- Required Tasks -->
                <div class="w-full min-w-[150px] sm:w-32 space-y-2">
                    <label class="text-sm font-medium flex items-center gap-2">
                        <List class="w-4 h-4" />
                        {{ $t('summary.thresholds.requiredTasks') }}
                    </label>
                    <input v-model.number="requiredTasks" type="number" min="0"
                        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
                </div>

                <!-- Completion Threshold -->
                <div class="w-full min-w-[150px] sm:w-48 space-y-2">
                    <label class="text-sm font-medium flex items-center gap-2">
                        <Percent class="w-4 h-4" />
                        {{ $t('summary.thresholds.completion') }}
                    </label>
                    <input v-model.number="completionThreshold" type="number" min="0" max="100"
                        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
                </div>

                <!-- Attendance Threshold -->
                <div class="w-full min-w-[150px] sm:w-48 space-y-2">
                    <div class="flex items-center justify-between">
                        <label class="text-sm font-medium flex items-center gap-2"
                            :class="{ 'opacity-50': !attendanceEnabled }">
                            <Percent class="w-4 h-4" />
                            {{ $t('summary.thresholds.attendance') }}
                        </label>
                        <input type="checkbox" v-model="attendanceEnabled"
                            :title="$t('summary.thresholds.attendanceTitle')"
                            class="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4" />
                    </div>
                    <input v-model.number="attendanceThreshold" type="number" min="0" max="100"
                        :disabled="!attendanceEnabled"
                        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
                </div>
            </div>
        </div>



        <!-- Student List -->
        <ExamStudentList :group="selectedGroup" :completion-threshold="completionThreshold"
            :attendance-threshold="attendanceThreshold" :attendance-enabled="attendanceEnabled" :modules="modules"
            :grade-format="selectedFormat" :assessment-type="assessmentType" :required-tasks="requiredTasks" />
    </div>
</template>
