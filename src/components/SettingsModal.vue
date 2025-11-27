<script setup>
import { ref, onMounted, toRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { X, Download, Upload, Trash2, Settings2, Database, Zap, Cog } from 'lucide-vue-next';
import { repository } from '../services/repository';
import { toast } from '../services/toast';
import { localeService } from '../services/locale';
import FilterModal from './FilterModal.vue';
import ConfirmModal from './ConfirmModal.vue';

const { t, locale } = useI18n();

const props = defineProps({
    isOpen: Boolean
});

const DEFAULT_DURATION_MINUTES_LIMIT = 75;

const emit = defineEmits(['close', 'refresh']);

import { useModalClose } from '../composables/useModalClose';

useModalClose(() => {
    if (props.isOpen) {
        emit('close');
    }
});


// Tabs
const activeTab = ref('general');

// Language Settings
const availableLocales = [
    { code: 'en-US', name: 'settings.general.language.en-US' },
    { code: 'uk-UA', name: 'settings.general.language.uk-UA' }
];

function changeLanguage(newLocale) {
    locale.value = newLocale;
    localeService.setLocale(newLocale);
}

// General Settings
const defaultTeacher = ref('');
const durationLimit = ref(DEFAULT_DURATION_MINUTES_LIMIT);
const showTeachersModal = ref(false);
const allStudents = ref([]);
const teacherCount = ref(0);

// Entity Statistics
const entityCounts = ref({
    reports: 0,
    groups: 0,
    marks: 0,
    members: 0
});
const entitySizes = ref({
    reports: 0,
    groups: 0,
    marks: 0,
    members: 0
});

onMounted(async () => {
    // ... existing load logic ...
    const students = await repository.getAllStudents();
    allStudents.value = students.map(s => s.name);
});

// Confirmation Modals
const showEraseConfirm = ref(false);
const showEraseReportsConfirm = ref(false);
const showEraseGroupsConfirm = ref(false);
const showEraseMarksConfirm = ref(false);
const showEraseMembersConfirm = ref(false);
const showImportConfirm = ref(false);
const pendingImportData = ref(null);
const pendingImportType = ref(null);

// File inputs
const importAllInput = ref(null);
const importReportsInput = ref(null);
const importGroupsInput = ref(null);
const importMarksInput = ref(null);

onMounted(async () => {
    await loadSettings();
});

async function loadSettings() {
    const [ignored, limit, defaultT, students, counts, sizes] = await Promise.all([
        repository.getIgnoredUsers(),
        repository.getDurationLimit(),
        repository.getDefaultTeacher(),
        repository.getAllMembers(),
        repository.getEntityCounts(),
        repository.getEntitySizes()
    ]);
    defaultTeacher.value = defaultT;
    durationLimit.value = limit;
    const teachers = await repository.getTeachers(); // Get configured teachers list
    teacherCount.value = teachers.length;
    entityCounts.value = counts;
    entitySizes.value = sizes;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function saveDefaultTeacher() {
    await repository.saveDefaultTeacher(defaultTeacher.value);
    toast.success(t('toast.defaultTeacherSaved'));
}

async function saveDurationLimit() {
    await repository.saveDurationLimit(durationLimit.value);
    toast.success(t('toast.durationLimitSaved'));
}

async function applyDurationLimit() {
    const count = await repository.applyDurationLimitToAll(durationLimit.value);
    toast.success(t('toast.durationLimitApplied', { count }));
    emit('refresh');
}

// Export Functions
async function exportAll() {
    try {
        const data = await repository.exportData();
        downloadJSON(data, `edutrace-backup-${getTimestamp()}.json`);
        toast.success(t('toast.dataExported'));
    } catch (e) {
        console.error('Error exporting data:', e);
        toast.error(t('toast.dataExportFailed'));
    }
}

async function exportReports() {
    try {
        const data = await repository.exportReports();
        downloadJSON(data, `reports-${getTimestamp()}.json`);
        toast.success(t('toast.reportsExported'));
    } catch (e) {
        console.error('Error exporting reports:', e);
        toast.error(t('toast.reportsExportFailed'));
    }
}

async function exportGroups() {
    try {
        const data = await repository.exportGroups();
        downloadJSON(data, `groups-${getTimestamp()}.json`);
        toast.success(t('toast.groupsExported'));
    } catch (e) {
        console.error('Error exporting groups:', e);
        toast.error(t('toast.groupsExportFailed'));
    }
}

async function exportMarks() {
    try {
        const data = await repository.exportMarks();
        downloadJSON(data, `marks-${getTimestamp()}.json`);
        toast.success(t('toast.marksExported'));
    } catch (e) {
        console.error('Error exporting marks:', e);
        toast.error(t('toast.marksExportFailed'));
    }
}

function downloadJSON(data, filename) {
    const jsonString = JSON.stringify(data, null, 2);
    const uri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);
    const link = document.createElement('a');
    link.href = uri;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function getTimestamp() {
    return new Date().toISOString().split('T')[0];
}

// Import Functions
function triggerImportAll() {
    importAllInput.value?.click();
}

function triggerImportReports() {
    importReportsInput.value?.click();
}

function triggerImportGroups() {
    importGroupsInput.value?.click();
}

function triggerImportMarks() {
    importMarksInput.value?.click();
}

async function handleImportFile(event, type) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);
        pendingImportData.value = data;
        pendingImportType.value = type;
        showImportConfirm.value = true;
    } catch (e) {
        console.error('Error reading import file:', e);
        toast.error(t('toast.invalidJson'));
    }
    event.target.value = '';
}

async function executeImport() {
    showImportConfirm.value = false;
    try {
        const data = toRaw(pendingImportData.value);
        const type = pendingImportType.value;

        if (type === 'all') {
            await repository.importData(data);
        } else if (type === 'reports') {
            await repository.importReports(data);
        } else if (type === 'groups') {
            await repository.importGroups(data);
        } else if (type === 'marks') {
            await repository.importMarks(data);
        }

        toast.success(t('toast.dataImported'));
        await loadSettings(); // Reload counts
        emit('refresh');
    } catch (e) {
        console.error('Error importing data:', e);
        toast.error(t('toast.dataImportFailed') + ': ' + e.message);
    } finally {
        pendingImportData.value = null;
        pendingImportType.value = null;
    }
}

// Erase Functions
async function executeEraseAll() {
    showEraseConfirm.value = false;
    try {
        await repository.clearAll();
        defaultTeacher.value = '';
        durationLimit.value = DEFAULT_DURATION_MINUTES_LIMIT;
        toast.success(t('toast.allDataErased'));
        await loadSettings(); // Reload counts
        emit('refresh');
    } catch (e) {
        console.error('Error erasing data:', e);
        toast.error(t('toast.dataEraseFailed'));
    }
}

async function executeEraseReports() {
    showEraseReportsConfirm.value = false;
    try {
        await repository.clearReports();
        toast.success(t('toast.reportsErased'));
        await loadSettings(); // Reload counts
        emit('refresh');
    } catch (e) {
        console.error('Error erasing reports:', e);
        toast.error(t('toast.reportsEraseFailed'));
    }
}

async function executeEraseGroups() {
    showEraseGroupsConfirm.value = false;
    try {
        await repository.clearGroups();
        toast.success(t('toast.groupsErased'));
        await loadSettings(); // Reload counts
        emit('refresh');
    } catch (e) {
        console.error('Error erasing groups:', e);
        toast.error(t('toast.groupsEraseFailed'));
    }
}

async function executeEraseMarks() {
    showEraseMarksConfirm.value = false;
    try {
        await repository.clearMarks();
        toast.success(t('toast.marksErased'));
        await loadSettings(); // Reload counts
        emit('refresh');
    } catch (e) {
        console.error('Error erasing marks:', e);
        toast.error(t('toast.marksEraseFailed'));
    }
}

async function executeEraseMembers() {
    showEraseMembersConfirm.value = false;
    try {
        await repository.clearMembers();
        toast.success(t('toast.membersErased'));
        // Reload local state
        const members = await repository.getAllMembers();
        allStudents.value = members.map(s => s.name);
        await loadSettings(); // Reload counts
        emit('refresh');
    } catch (e) {
        console.error('Error erasing members:', e);
        toast.error(t('toast.membersEraseFailed'));
    }
}
</script>

<template>
    <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div
            class="bg-card w-full max-w-3xl h-[600px] rounded-lg shadow-lg border flex flex-col animate-in zoom-in-95 duration-200">
            <!-- Header -->
            <div class="p-4 border-b flex items-center justify-between flex-shrink-0">
                <h3 class="text-lg font-bold">{{ $t('settings.title') }}</h3>
                <button @click="$emit('close')" class="p-2 hover:bg-muted rounded-full transition-colors">
                    <X class="w-5 h-5" />
                </button>
            </div>

            <!-- Tabs -->
            <div class="border-b flex-shrink-0">
                <div class="flex gap-1 p-1 justify-center">
                    <button @click="activeTab = 'general'"
                        class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors"
                        :class="activeTab === 'general' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'">
                        <Settings2 class="w-4 h-4" />
                        {{ $t('settings.tabs.general') }}
                    </button>
                    <button @click="activeTab = 'data'"
                        class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors"
                        :class="activeTab === 'data' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'">
                        <Database class="w-4 h-4" />
                        {{ $t('settings.tabs.data') }}
                    </button>
                    <button @click="activeTab = 'advanced'"
                        class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors"
                        :class="activeTab === 'advanced' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'">
                        <Zap class="w-4 h-4" />
                        {{ $t('settings.tabs.advanced') }}
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-6 min-h-0">
                <Transition name="fade" mode="out-in">
                    <!-- General Tab -->
                    <div v-if="activeTab === 'general'" key="general" class="space-y-6">
                        <!-- Language -->
                        <div class="space-y-2">
                            <label class="text-sm font-medium">{{ $t('settings.general.language.label') }}</label>
                            <select v-model="locale" @change="changeLanguage(locale)"
                                class="w-full px-3 py-2 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                                <option v-for="loc in availableLocales" :key="loc.code" :value="loc.code">
                                    {{ $t(loc.name) }}
                                </option>
                            </select>
                            <p class="text-xs text-muted-foreground">{{ $t('settings.general.language.description') }}
                            </p>
                        </div>

                        <!-- Default Teacher -->
                        <div class="space-y-2">
                            <label class="text-sm font-medium">{{ $t('settings.general.defaultTeacher.label') }}</label>
                            <div class="flex gap-2">
                                <input v-model="defaultTeacher" type="text"
                                    :placeholder="$t('settings.general.defaultTeacher.placeholder')"
                                    class="flex-1 px-3 py-2 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
                                <button @click="saveDefaultTeacher"
                                    class="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors">
                                    {{ $t('settings.general.defaultTeacher.save') }}
                                </button>
                            </div>
                            <p class="text-xs text-muted-foreground">{{
                                $t('settings.general.defaultTeacher.description') }}</p>
                        </div>

                        <!-- Duration Limit -->
                        <div class="space-y-2">
                            <label class="text-sm font-medium">{{ $t('settings.general.durationLimit.label') }}</label>
                            <div class="flex flex-col gap-2">
                                <input v-model.number="durationLimit" type="number" min="0"
                                    :placeholder="$t('settings.general.durationLimit.placeholder')"
                                    class="w-full px-3 py-2 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
                                <div class="flex flex-col sm:flex-row gap-2">
                                    <button @click="saveDurationLimit"
                                        class="flex-1 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors">
                                        {{ $t('settings.general.durationLimit.save') }}
                                    </button>
                                    <button @click="applyDurationLimit"
                                        class="flex-1 px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md transition-colors">
                                        {{ $t('settings.general.durationLimit.applyToAll') }}
                                    </button>
                                </div>
                            </div>
                            <p class="text-xs text-muted-foreground">{{ $t('settings.general.durationLimit.description')
                            }}</p>
                        </div>

                        <!-- Teachers -->
                        <div class="space-y-2">
                            <label class="text-sm font-medium">{{ $t('settings.general.teachers.label') }}</label>
                            <button @click="showTeachersModal = true"
                                class="w-full px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors flex items-center justify-between">
                                <span>{{ $t('settings.general.teachers.manage') }}</span>
                                <span v-if="teacherCount > 0"
                                    class="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                                    {{ teacherCount }}
                                </span>
                            </button>
                            <p class="text-xs text-muted-foreground">{{ $t('settings.general.teachers.description') }}
                            </p>
                        </div>
                    </div>

                    <!-- Data Management Tab -->
                    <div v-else-if="activeTab === 'data'" key="data" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Reports Card -->
                        <div class="border rounded-lg p-4 space-y-3">
                            <div class="flex items-center justify-between">
                                <h4 class="font-medium">{{ $t('settings.data.reports.title') }}</h4>
                                <span v-if="entityCounts.reports > 0"
                                    class="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                                    {{ entityCounts.reports }}
                                </span>
                            </div>
                            <p v-if="entitySizes.reports > 0" class="text-xs text-muted-foreground">
                                {{ $t('settings.data.reports.memory') }}: {{ formatBytes(entitySizes.reports) }}
                            </p>
                            <div class="flex flex-wrap gap-2">
                                <button @click="exportReports"
                                    class="flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors">
                                    <Download class="w-4 h-4" />
                                    {{ $t('settings.data.actions.export') }}
                                </button>
                                <button @click="triggerImportReports"
                                    class="flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors">
                                    <Upload class="w-4 h-4" />
                                    {{ $t('settings.data.actions.import') }}
                                </button>
                                <button @click="showEraseReportsConfirm = true"
                                    class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-destructive border border-destructive/20 rounded-md hover:bg-destructive/10 transition-colors">
                                    <Trash2 class="w-4 h-4" />
                                    {{ $t('settings.data.actions.erase') }}
                                </button>
                            </div>
                        </div>

                        <!-- Groups Card -->
                        <div class="border rounded-lg p-4 space-y-3">
                            <div class="flex items-center justify-between">
                                <h4 class="font-medium">{{ $t('settings.data.groups.title') }}</h4>
                                <span v-if="entityCounts.groups > 0"
                                    class="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                                    {{ entityCounts.groups }}
                                </span>
                            </div>
                            <p v-if="entitySizes.groups > 0" class="text-xs text-muted-foreground">
                                {{ $t('settings.data.groups.memory') }}: {{ formatBytes(entitySizes.groups) }}
                            </p>
                            <div class="flex flex-wrap gap-2">
                                <button @click="exportGroups"
                                    class="flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors">
                                    <Download class="w-4 h-4" />
                                    {{ $t('settings.data.actions.export') }}
                                </button>
                                <button @click="triggerImportGroups"
                                    class="flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors">
                                    <Upload class="w-4 h-4" />
                                    {{ $t('settings.data.actions.import') }}
                                </button>
                                <button @click="showEraseGroupsConfirm = true"
                                    class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-destructive border border-destructive/20 rounded-md hover:bg-destructive/10 transition-colors">
                                    <Trash2 class="w-4 h-4" />
                                    {{ $t('settings.data.actions.erase') }}
                                </button>
                            </div>
                        </div>

                        <!-- Marks Card -->
                        <div class="border rounded-lg p-4 space-y-3">
                            <div class="flex items-center justify-between">
                                <h4 class="font-medium">{{ $t('settings.data.marks.title') }}</h4>
                                <span v-if="entityCounts.marks > 0"
                                    class="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                                    {{ entityCounts.marks }}
                                </span>
                            </div>
                            <p v-if="entitySizes.marks > 0" class="text-xs text-muted-foreground">
                                {{ $t('settings.data.marks.memory') }}: {{ formatBytes(entitySizes.marks) }}
                            </p>
                            <div class="flex flex-wrap gap-2">
                                <button @click="exportMarks"
                                    class="flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors">
                                    <Download class="w-4 h-4" />
                                    {{ $t('settings.data.actions.export') }}
                                </button>
                                <button @click="triggerImportMarks"
                                    class="flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors">
                                    <Upload class="w-4 h-4" />
                                    {{ $t('settings.data.actions.import') }}
                                </button>
                                <button @click="showEraseMarksConfirm = true"
                                    class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-destructive border border-destructive/20 rounded-md hover:bg-destructive/10 transition-colors">
                                    <Trash2 class="w-4 h-4" />
                                    {{ $t('settings.data.actions.erase') }}
                                </button>
                            </div>
                        </div>

                        <!-- Members Card -->
                        <div class="border rounded-lg p-4 space-y-3">
                            <div class="flex items-center justify-between">
                                <h4 class="font-medium">{{ $t('settings.data.members.title') }}</h4>
                                <span v-if="entityCounts.members > 0"
                                    class="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                                    {{ entityCounts.members }}
                                </span>
                            </div>
                            <p v-if="entitySizes.members > 0" class="text-xs text-muted-foreground">
                                {{ $t('settings.data.members.memory') }}: {{ formatBytes(entitySizes.members) }}
                            </p>
                            <div class="flex gap-2">
                                <button @click="showEraseMembersConfirm = true"
                                    class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-destructive border border-destructive/20 rounded-md hover:bg-destructive/10 transition-colors">
                                    <Trash2 class="w-4 h-4" />
                                    {{ $t('settings.data.actions.erase') }}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Advanced Tab -->
                    <div v-else-if="activeTab === 'advanced'" key="advanced" class="space-y-6">
                        <!-- Global Operations -->
                        <div class="border rounded-lg p-4 space-y-3">
                            <h4 class="font-medium">{{ $t('settings.advanced.global.title') }}</h4>
                            <p class="text-sm text-muted-foreground">{{ $t('settings.advanced.global.description') }}
                            </p>
                            <p v-if="entityCounts.reports + entityCounts.groups + entityCounts.marks + entityCounts.members > 0"
                                class="text-xs text-muted-foreground">
                                {{ $t('settings.advanced.global.totalRecords') }}: {{ entityCounts.reports +
                                    entityCounts.groups + entityCounts.marks +
                                    entityCounts.members }} |
                                {{ $t('settings.advanced.global.totalMemory') }}: {{ formatBytes(entitySizes.reports +
                                    entitySizes.groups +
                                    entitySizes.marks + entitySizes.members) }}
                            </p>
                            <div class="flex flex-wrap gap-2">
                                <button @click="exportAll"
                                    class="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors">
                                    <Download class="w-4 h-4" />
                                    {{ $t('settings.advanced.global.exportAll') }}
                                </button>
                                <button @click="triggerImportAll"
                                    class="flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors">
                                    <Upload class="w-4 h-4" />
                                    {{ $t('settings.advanced.global.importAll') }}
                                </button>
                                <button @click="showEraseConfirm = true"
                                    class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-destructive border border-destructive rounded-md hover:bg-destructive/10 transition-colors">
                                    <Trash2 class="w-4 h-4" />
                                    {{ $t('settings.advanced.global.eraseAll') }}
                                </button>
                            </div>
                        </div>

                        <!-- Sync (Coming Soon) -->
                        <div class="border border-dashed rounded-lg p-4 space-y-3 opacity-60">
                            <div class="flex items-center gap-2">
                                <h4 class="font-medium">{{ $t('settings.advanced.sync.title') }}</h4>
                                <span class="text-xs bg-muted px-2 py-0.5 rounded-full">{{
                                    $t('settings.advanced.sync.comingSoon') }}</span>
                            </div>
                            <p class="text-sm text-muted-foreground">
                                {{ $t('settings.advanced.sync.description') }}
                            </p>
                            <div class="flex gap-2">
                                <button disabled
                                    class="flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-md opacity-50 cursor-not-allowed">
                                    <Cog class="w-4 h-4" />
                                    {{ $t('settings.advanced.sync.configure') }}
                                </button>
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>

            <!-- Footer -->
            <div class="p-4 border-t bg-muted/10 flex justify-end flex-shrink-0">
                <button @click="$emit('close')"
                    class="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors">
                    {{ $t('settings.close') }}
                </button>
            </div>
        </div>

        <!-- Hidden File Inputs -->
        <input ref="importAllInput" type="file" accept=".json" @change="handleImportFile($event, 'all')"
            class="hidden" />
        <input ref="importReportsInput" type="file" accept=".json" @change="handleImportFile($event, 'reports')"
            class="hidden" />
        <input ref="importGroupsInput" type="file" accept=".json" @change="handleImportFile($event, 'groups')"
            class="hidden" />
        <input ref="importMarksInput" type="file" accept=".json" @change="handleImportFile($event, 'marks')"
            class="hidden" />

        <!-- Filter Modal -->
        <FilterModal :is-open="showTeachersModal" :all-users="allStudents" mode="teachers"
            @close="showTeachersModal = false" @update:items="(items) => teacherCount = items.length" />

        <!-- Confirmation Modals -->
        <ConfirmModal :is-open="showImportConfirm" :title="$t('confirm.import.title')"
            :message="$t('confirm.import.message')" :confirm-text="$t('confirm.import.confirm')"
            @cancel="showImportConfirm = false" @confirm="executeImport" />

        <ConfirmModal :is-open="showEraseConfirm" :title="$t('confirm.eraseAll.title')"
            :message="$t('confirm.eraseAll.message')" :confirm-text="$t('confirm.eraseAll.confirm')"
            @cancel="showEraseConfirm = false" @confirm="executeEraseAll" />

        <ConfirmModal :is-open="showEraseReportsConfirm" :title="$t('confirm.eraseReports.title')"
            :message="$t('confirm.eraseReports.message')" :confirm-text="$t('confirm.eraseReports.confirm')"
            @cancel="showEraseReportsConfirm = false" @confirm="executeEraseReports" />

        <ConfirmModal :is-open="showEraseGroupsConfirm" :title="$t('confirm.eraseGroups.title')"
            :message="$t('confirm.eraseGroups.message')" :confirm-text="$t('confirm.eraseGroups.confirm')"
            @cancel="showEraseGroupsConfirm = false" @confirm="executeEraseGroups" />

        <ConfirmModal :is-open="showEraseMarksConfirm" :title="$t('confirm.eraseMarks.title')"
            :message="$t('confirm.eraseMarks.message')" :confirm-text="$t('confirm.eraseMarks.confirm')"
            @cancel="showEraseMarksConfirm = false" @confirm="executeEraseMarks" />

        <ConfirmModal :is-open="showEraseMembersConfirm" :title="$t('confirm.eraseMembers.title')"
            :message="$t('confirm.eraseMembers.message')" :confirm-text="$t('confirm.eraseMembers.confirm')"
            @cancel="showEraseMembersConfirm = false" @confirm="executeEraseMembers" />
    </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
