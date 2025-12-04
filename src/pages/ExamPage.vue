<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { List, Layers, Users, Percent, BookDashed, ChevronDown, SquareStar, FileText } from 'lucide-vue-next';
import ExamConfiguration from '../components/exam/ExamConfiguration.vue';
import ExamStudentList from '../components/exam/ExamStudentList.vue';
import DocumentsList from '../components/exam/DocumentsList.vue';
import CustomSelect from '../components/CustomSelect.vue';
import { repository } from '@/services/repository';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const availableGroups = ref([]);
const selectedGroup = ref(null);
const assessmentType = ref('examination'); // 'examination' or 'credit'
const completionThreshold = ref(70);
const attendanceThreshold = ref(60);
const attendanceEnabled = ref(true);
const requiredTasks = ref(0);
const modules = ref([]);
const selectedFormat = ref('5-scale'); // 'raw', '5-scale', '100-scale', 'ects'

const formatOptions = computed(() => [
    { value: '5-scale', label: t('marks.scales.5point') },
    { value: '100-scale', label: t('marks.scales.100point') },
    { value: 'ects', label: t('marks.scales.ects') }
]);

const assessmentTypeOptions = computed(() => [
    { value: 'examination', label: t('summary.types.examination') },
    { value: 'credit', label: t('summary.types.credit') }
]);

// View mode state
const viewMode = ref('list'); // 'list', 'modules', or 'documents'

let saveTimeout = null;

// Fetch groups on mount
onMounted(async () => {
    availableGroups.value = await repository.getGroups();

    // Check for group query param
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

    // Check for view query param
    const viewQuery = route.query.view;
    if (viewQuery && ['list', 'modules', 'documents'].includes(viewQuery)) {
        viewMode.value = viewQuery;
    }

    // Load saved settings
    const savedSettings = await repository.getExamSettings();
    if (savedSettings) {
        if (savedSettings.assessmentType) assessmentType.value = savedSettings.assessmentType;
        if (savedSettings.completionThreshold !== undefined) completionThreshold.value = savedSettings.completionThreshold;
        if (savedSettings.attendanceThreshold !== undefined) attendanceThreshold.value = savedSettings.attendanceThreshold;
        if (savedSettings.attendanceEnabled !== undefined) attendanceEnabled.value = savedSettings.attendanceEnabled;
        if (savedSettings.requiredTasks !== undefined) requiredTasks.value = savedSettings.requiredTasks;
    }
});

// Watch for settings changes to save them
watch([assessmentType, completionThreshold, attendanceThreshold, attendanceEnabled, requiredTasks], async () => {
    await repository.saveExamSettings({
        assessmentType: assessmentType.value,
        completionThreshold: completionThreshold.value,
        attendanceThreshold: attendanceThreshold.value,
        attendanceEnabled: attendanceEnabled.value,
        requiredTasks: requiredTasks.value
    });
}, { deep: true });

// Sync selectedGroup to URL query params
watch(selectedGroup, (newGroup) => {
    if (newGroup?.name) {
        router.replace({ query: { ...route.query, group: newGroup.name } });
    }
});

// Sync viewMode to URL query params
watch(viewMode, (newView) => {
    router.replace({ query: { ...route.query, view: newView } });
});

// Watch for group changes to load modules
watch(selectedGroup, async (newGroup) => {
    if (newGroup?.name) {
        // Load modules for this group
        const groupModules = await repository.getModulesByGroup(newGroup.name);
        modules.value = groupModules;
    } else {
        modules.value = [];
    }
}, { immediate: true });

// Watch for module changes to save them (debounced)
watch(modules, async (newModules) => {
    if (!selectedGroup.value?.name) return;

    // Clear existing timeout
    if (saveTimeout) clearTimeout(saveTimeout);

    // Debounce saves by 500ms
    saveTimeout = setTimeout(async () => {
        // Save all modules with group reference
        for (const module of newModules) {
            try {
                // Serialize module to plain object, stripping Vue proxies
                const plainModule = {
                    id: module.id,
                    name: module.name,
                    tasks: module.tasks ? module.tasks.map(t => ({
                        id: t.id,
                        name: t.name,
                        date: t.date,
                        groupName: t.groupName,
                        groupId: t.groupId
                    })) : [],
                    test: module.test ? {
                        id: module.test.id,
                        name: module.test.name,
                        date: module.test.date,
                        groupName: module.test.groupName,
                        groupId: module.test.groupId
                    } : null,
                    tasksCoefficient: module.tasksCoefficient,
                    testCoefficient: module.testCoefficient,
                    groupName: selectedGroup.value.name,
                    groupId: selectedGroup.value.id
                };

                await repository.saveModule(plainModule);
            } catch (error) {
                console.error('Failed to save module:', error, module);
            }
        }
    }, 500);
}, { deep: true });

async function handleDeleteModule(module) {
    if (module && module.id) {
        await repository.deleteModule(module.id);
    }
}

</script>

<template>
    <div class="container mx-auto p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <!-- Header with View Switcher -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="flex flex-col gap-2">
                <h1 class="text-3xl font-bold tracking-tight">{{ $t('nav.summary') }}</h1>
                <p class="text-muted-foreground">{{ $t('summary.description') }}</p>
            </div>

            <!-- View Mode Switcher -->
            <div class="flex items-center gap-1 p-1 bg-muted rounded-lg">
                <button @click="viewMode = 'list'"
                    class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    :class="viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'">
                    <List class="w-4 h-4" />
                    {{ $t('summary.views.list') }}
                </button>
                <button @click="viewMode = 'modules'"
                    class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    :class="viewMode === 'modules' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'">
                    <Layers class="w-4 h-4" />
                    {{ $t('summary.views.modules') }}
                </button>
                <button @click="viewMode = 'documents'"
                    class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    :class="viewMode === 'documents' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'">
                    <FileText class="w-4 h-4" />
                    {{ $t('summary.views.documents') }}
                </button>
            </div>
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
                <div class="flex-1 min-w-[150px]"
                    :class="{ 'opacity-50 pointer-events-none': viewMode === 'documents' }">
                    <CustomSelect v-model="assessmentType" :options="assessmentTypeOptions" display-key="label"
                        value-key="value" :disabled="viewMode === 'documents'">
                        <template #label>
                            <BookDashed class="w-4 h-4" />
                            {{ $t('summary.assessmentType') }}
                        </template>
                    </CustomSelect>
                </div>

                <!-- Required Tasks -->
                <div class="w-full min-w-[150px] sm:w-32 space-y-2"
                    :class="{ 'opacity-50 pointer-events-none': viewMode === 'documents' }">
                    <label class="text-sm font-medium flex items-center gap-2">
                        <List class="w-4 h-4" />
                        {{ $t('summary.thresholds.requiredTasks') }}
                    </label>
                    <input v-model.number="requiredTasks" type="number" min="0" :disabled="viewMode === 'documents'"
                        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
                </div>

                <!-- Completion Threshold -->
                <div class="w-full min-w-[150px] sm:w-48 space-y-2"
                    :class="{ 'opacity-50 pointer-events-none': viewMode === 'documents' }">
                    <label class="text-sm font-medium flex items-center gap-2">
                        <Percent class="w-4 h-4" />
                        {{ $t('summary.thresholds.completion') }}
                    </label>
                    <input v-model.number="completionThreshold" type="number" min="0" max="100"
                        :disabled="viewMode === 'documents'"
                        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
                </div>

                <!-- Attendance Threshold -->
                <div class="w-full min-w-[150px] sm:w-48 space-y-2"
                    :class="{ 'opacity-50 pointer-events-none': viewMode === 'documents' }">
                    <div class="flex items-center justify-between">
                        <label class="text-sm font-medium flex items-center gap-2"
                            :class="{ 'opacity-50': !attendanceEnabled }">
                            <Percent class="w-4 h-4" />
                            {{ $t('summary.thresholds.attendance') }}
                        </label>
                        <input type="checkbox" v-model="attendanceEnabled"
                            :title="$t('summary.thresholds.attendanceTitle')" :disabled="viewMode === 'documents'"
                            class="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4" />
                    </div>
                    <input v-model.number="attendanceThreshold" type="number" min="0" max="100"
                        :disabled="!attendanceEnabled || viewMode === 'documents'"
                        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
                </div>
            </div>
        </div>

        <!-- Modules View -->
        <ExamConfiguration v-if="viewMode === 'modules'" :group="selectedGroup"
            v-model:completion-threshold="completionThreshold" v-model:attendance-threshold="attendanceThreshold"
            v-model:modules="modules" @delete="handleDeleteModule" />

        <!-- List View -->
        <ExamStudentList v-if="viewMode === 'list'" :group="selectedGroup" :completion-threshold="completionThreshold"
            :attendance-threshold="attendanceThreshold" :attendance-enabled="attendanceEnabled" :modules="modules"
            :grade-format="selectedFormat" :assessment-type="assessmentType" :required-tasks="requiredTasks" />

        <!-- Documents View -->
        <DocumentsList v-if="viewMode === 'documents'" :group="selectedGroup" :assessment-type="assessmentType" />
    </div>
</template>
