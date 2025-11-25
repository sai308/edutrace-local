<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from '../../services/toast';
import DropZone from '../DropZone.vue';
import GroupModal from '../groups/GroupModal.vue';
import ConfirmModal from '../ConfirmModal.vue';
import MarksFilterModal from './MarksFilterModal.vue';
import ColumnPicker from '../ColumnPicker.vue';
import { useQuerySync } from '../../composables/useQuerySync';
import { useColumnVisibility } from '../../composables/useColumnVisibility';

import { useFormatters } from '../../composables/useFormatters';
import { useSort } from '../../composables/useSort';
import { useMarkFormat } from '../../composables/useMarkFormat';
import { Calendar, Search, Clock, Trash2, CircleCheckBig, Filter, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown } from 'lucide-vue-next';

const { t } = useI18n();

const props = defineProps({
    marks: { type: Array, default: () => [] },
    groups: { type: Array, default: () => [] },
    isProcessing: { type: Boolean, default: false },
    allMeetIds: { type: Array, default: () => [] },
    allTeachers: { type: Array, default: () => [] }
});

const emit = defineEmits(['process-file', 'create-group', 'delete-mark', 'bulk-delete-marks', 'toggle-synced', 'refresh']);
const { formatDate, formatTime } = useFormatters();
const { sortField, sortDirection, toggleSort: handleSort } = useSort('createdAt', 'desc');
const { getFormattedMark, getMarkTooltip, formatMarkToFiveScale, formatMarkToECTS } = useMarkFormat();

const searchQuery = ref('');
const showFormatDropdown = ref(false);
const selectedFormat = ref('raw'); // 'raw', '5-scale', '100-scale', 'ects'

// Advanced Filters
const showFilterModal = ref(false);
const filterSynced = ref('unsynced');
const filterDateFrom = ref('');
const filterGroup = ref(null);

const activeFilters = computed(() => ({
    synced: filterSynced.value,
    dateFrom: filterDateFrom.value,
    group: filterGroup.value
}));

const activeFilterCount = computed(() => {
    let count = 0;
    if (activeFilters.value.synced !== 'all') count++;
    if (activeFilters.value.dateFrom) count++;
    if (activeFilters.value.group) count++;
    return count;
});

// Column visibility setup
const columns = computed(() => [
    { id: 'added', label: t('marks.table.added'), defaultVisible: true },
    { id: 'student', label: t('marks.table.student'), defaultVisible: true },
    { id: 'group', label: t('marks.table.group'), defaultVisible: true },
    { id: 'task', label: t('marks.table.task'), defaultVisible: true },
    { id: 'mark', label: t('marks.table.mark'), defaultVisible: true }
]);

const { visibleColumns, toggleColumn, resetColumns, isColumnVisible } = useColumnVisibility('marks', columns.value);

// Sorting
useQuerySync({
    search: searchQuery,
    format: selectedFormat,
    synced: filterSynced,
    dateFrom: filterDateFrom,
    group: filterGroup,
    sort: sortField,
    order: sortDirection
});

// Selection
const selectedMarks = ref(new Set());

// Group Modal State
const showGroupModal = ref(false);
const pendingGroup = ref(null);
const pendingFile = ref(null);
const fileQueue = ref([]); // Queue for multiple files
const isQueueProcessing = ref(false);

// Delete Modal State
const showDeleteModal = ref(false);
const markToDelete = ref(null); // Single mark
const isBulkDelete = ref(false);

const filteredMarks = computed(() => {
    let result = [...props.marks];

    // 1. Filters
    if (activeFilters.value.synced === 'unsynced') {
        result = result.filter(m => !m.synced);
    }

    if (activeFilters.value.dateFrom) {
        const fromDate = new Date(activeFilters.value.dateFrom).setHours(0, 0, 0, 0);
        result = result.filter(m => new Date(m.createdAt) >= fromDate);
    }

    if (activeFilters.value.group) {
        result = result.filter(m => m.groupName === activeFilters.value.group);
    }

    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        result = result.filter(m =>
            m.studentName.toLowerCase().includes(query) ||
            m.groupName.toLowerCase().includes(query) ||
            m.taskName.toLowerCase().includes(query)
        );
    }

    // 2. Sorting
    result.sort((a, b) => {
        let valA = a[sortField.value];
        let valB = b[sortField.value];

        // Handle specific fields
        if (sortField.value === 'createdAt' || sortField.value === 'taskDate') {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        } else if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        if (valA < valB) return sortDirection.value === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection.value === 'asc' ? 1 : -1;
        return 0;
    });

    return result;
});

function toggleSelection(id) {
    if (selectedMarks.value.has(id)) {
        selectedMarks.value.delete(id);
    } else {
        selectedMarks.value.add(id);
    }
}

function toggleSelectAll() {
    if (selectedMarks.value.size === filteredMarks.value.length) {
        selectedMarks.value.clear();
    } else {
        filteredMarks.value.forEach(m => selectedMarks.value.add(m.id));
    }
}

async function processNextInQueue() {
    if (fileQueue.value.length === 0) {
        isQueueProcessing.value = false;
        return;
    }

    isQueueProcessing.value = true;
    const file = fileQueue.value[0];
    const filename = file.name;
    const match = filename.match(/^([^_]+)_/);
    const rawPrefix = match ? match[1] : null;

    if (!rawPrefix) {
        toast.error(`Could not determine group from filename: ${filename}`);
        fileQueue.value.shift(); // Skip invalid file
        processNextInQueue();
        return;
    }

    // Check if group exists
    let matchedGroup = props.groups.find(g => g.name === rawPrefix);
    if (!matchedGroup) {
        const normalizedPrefix = rawPrefix.replace(/-/g, '');
        matchedGroup = props.groups.find(g => g.name.replace(/-/g, '') === normalizedPrefix);
    }

    if (matchedGroup) {
        emit('process-file', { file, groupName: matchedGroup.name });
        fileQueue.value.shift(); // Done with this file
        processNextInQueue();
    } else {
        // Prompt to create group
        pendingGroup.value = { name: rawPrefix, meetId: '', teacher: '' };
        pendingFile.value = file;
        showGroupModal.value = true;
        // Wait for user action (handleCreateGroup or modal close)
    }
}

function handleFilesDropped(files) {
    if (files.length === 0) return;
    fileQueue.value.push(...Array.from(files));

    if (!isQueueProcessing.value && !showGroupModal.value) {
        processNextInQueue();
    }
}

function handleCreateGroup(groupData) {
    if (pendingFile.value) {
        emit('create-group', { ...groupData, _pendingFile: pendingFile.value });
        pendingFile.value = null;
        fileQueue.value.shift(); // Remove processed file from queue

        // Small delay to allow modal to close and state to update
        setTimeout(() => {
            processNextInQueue();
        }, 100);
    } else {
        emit('create-group', groupData);
    }
    showGroupModal.value = false;
}

function handleGroupModalClose() {
    showGroupModal.value = false;
    if (isQueueProcessing.value) {
        // User cancelled group creation for this file
        pendingFile.value = null;
        fileQueue.value.shift(); // Skip this file
        processNextInQueue();
    }
}

function toggleSynced(mark) {
    emit('toggle-synced', mark);
}

function confirmDelete(mark) {
    markToDelete.value = mark;
    isBulkDelete.value = false;
    showDeleteModal.value = true;
}

function confirmBulkDelete() {
    if (selectedMarks.value.size === 0) return;
    isBulkDelete.value = true;
    showDeleteModal.value = true;
}

function handleDelete() {
    if (isBulkDelete.value) {
        emit('bulk-delete-marks', Array.from(selectedMarks.value));
        selectedMarks.value.clear();
    } else if (markToDelete.value) {
        emit('delete-mark', markToDelete.value.id);
    }
    showDeleteModal.value = false;
    markToDelete.value = null;
    isBulkDelete.value = false;
}

function applyFilters(filters) {
    filterSynced.value = filters.synced;
    filterDateFrom.value = filters.dateFrom;
    filterGroup.value = filters.group;
}

function formatTaskName(taskName) {
    return taskName.replace(/_/g, ' ');
}

</script>

<template>
    <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <!-- Dropzone -->
        <DropZone :is-processing="isProcessing" @files-dropped="handleFilesDropped"
            :prompt="$t('dropZone.marksPrompt')" />

        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="space-y-1 w-full md:w-auto">
                <div class="flex items-center gap-4">
                    <h2 class="text-2xl font-bold tracking-tight">{{ $t('marks.title') }}</h2>
                    <span class="text-muted-foreground text-sm">{{ $t('marks.subtitle', {
                        count: filteredMarks.length,
                        total: marks.length
                    }) }}</span>
                </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto">
                <!-- Format Selector with Label (Custom Dropdown) -->
                <div class="relative flex items-center gap-2 px-3 py-1.5 rounded-md border bg-card">
                    <span class="text-xs font-medium text-muted-foreground whitespace-nowrap">{{ $t('marks.gradeScale')
                    }}</span>

                    <div class="relative">
                        <button @click="showFormatDropdown = !showFormatDropdown"
                            class="flex items-center justify-between min-w-[100px] text-sm font-medium focus:outline-none cursor-pointer bg-transparent pr-6">
                            {{ selectedFormat === 'raw' ? $t('marks.scales.default') : selectedFormat === '5-scale' ?
                                $t('marks.scales.5point') :
                                selectedFormat === '100-scale' ? $t('marks.scales.100point') : $t('marks.scales.ects') }}

                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                                class="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-50 pointer-events-none">
                                <polyline points="6 9 12 15 18 9" />
                            </svg>

                        </button>

                        <div v-if="showFormatDropdown"
                            class="absolute z-20 mt-1 right-0 min-w-[150px] rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">

                            <button @click="selectedFormat = 'raw'; showFormatDropdown = false"
                                :class="{ 'bg-accent text-accent-foreground': selectedFormat === 'raw' }"
                                class="block w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors">{{
                                    $t('marks.scales.default') }}</button>

                            <button @click="selectedFormat = '5-scale'; showFormatDropdown = false"
                                :class="{ 'bg-accent text-accent-foreground': selectedFormat === '5-scale' }"
                                class="block w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors">{{
                                    $t('marks.scales.5point') }}</button>

                            <button @click="selectedFormat = '100-scale'; showFormatDropdown = false"
                                :class="{ 'bg-accent text-accent-foreground': selectedFormat === '100-scale' }"
                                class="block w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors">{{
                                    $t('marks.scales.100point') }}</button>

                            <button @click="selectedFormat = 'ects'; showFormatDropdown = false"
                                :class="{ 'bg-accent text-accent-foreground': selectedFormat === 'ects' }"
                                class="block w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors">{{
                                    $t('marks.scales.ects') }}</button>
                        </div>
                    </div>
                </div>

                <!-- Bulk Delete -->
                <button v-if="selectedMarks.size > 0" @click="confirmBulkDelete"
                    class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-md transition-colors">
                    <Trash2 class="w-4 h-4" />
                </button>

                <!-- Filter Button -->
                <button @click="showFilterModal = true"
                    class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors relative"
                    :class="activeFilterCount > 0 ? 'bg-primary/10 text-primary border-primary/20' : 'bg-background text-muted-foreground hover:text-foreground'">
                    <Filter class="w-4 h-4" />
                    {{ $t('marks.filters') }}
                    <span v-if="activeFilterCount > 0"
                        class="ml-1 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full">
                        {{ activeFilterCount }}
                    </span>
                </button>
            </div>
        </div>

        <!-- Search Row -->
        <div class="flex items-center gap-2">
            <div class="relative flex-1">
                <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <input v-model="searchQuery" :placeholder="$t('marks.searchPlaceholder')"
                    :title="$t('marks.searchTitle')"
                    class="pl-8 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>

            <ColumnPicker :columns="columns" :visible-columns="visibleColumns" @toggle-column="toggleColumn"
                @reset="resetColumns" />
        </div>

        <!-- Data Table (Flat List) -->
        <div v-if="filteredMarks.length > 0" class="border rounded-lg overflow-hidden bg-card shadow-sm">
            <div class="overflow-x-auto overflow-y-hidden">
                <table class="w-full text-sm text-left">
                    <thead class="bg-muted/50 text-muted-foreground font-medium border-b">
                        <tr>
                            <th class="p-3 w-10 text-center">
                                <input type="checkbox"
                                    :checked="selectedMarks.size === filteredMarks.length && filteredMarks.length > 0"
                                    @change="toggleSelectAll"
                                    class="rounded border-gray-300 text-primary focus:ring-primary" />
                            </th>
                            <th v-if="isColumnVisible('added')"
                                class="p-3 text-left w-32 cursor-pointer hover:text-foreground transition-colors select-none"
                                @click="handleSort('createdAt')" :title="$t('marks.table.tooltips.added')">
                                <div class="flex items-center gap-1">
                                    {{ $t('marks.table.added') }}
                                    <ArrowUp v-if="sortField === 'createdAt' && sortDirection === 'asc'"
                                        class="w-3 h-3" />
                                    <ArrowDown v-if="sortField === 'createdAt' && sortDirection === 'desc'"
                                        class="w-3 h-3" />
                                    <ArrowUpDown v-if="sortField !== 'createdAt'" class="w-3 h-3 opacity-50" />
                                </div>
                            </th>
                            <th v-if="isColumnVisible('student')"
                                class="p-3 cursor-pointer hover:text-foreground transition-colors select-none"
                                @click="handleSort('studentName')" :title="$t('marks.table.tooltips.student')">
                                <div class="flex items-center gap-1">
                                    {{ $t('marks.table.student') }}
                                    <ArrowUp v-if="sortField === 'studentName' && sortDirection === 'asc'"
                                        class="w-3 h-3" />
                                    <ArrowDown v-if="sortField === 'studentName' && sortDirection === 'desc'"
                                        class="w-3 h-3" />
                                    <ArrowUpDown v-if="sortField !== 'studentName'" class="w-3 h-3 opacity-50" />
                                </div>
                            </th>
                            <th v-if="isColumnVisible('group')"
                                class="p-3 cursor-pointer hover:text-foreground transition-colors select-none"
                                @click="handleSort('groupName')" :title="$t('marks.table.tooltips.group')">
                                <div class="flex items-center gap-1">
                                    {{ $t('marks.table.group') }}
                                    <ArrowUp v-if="sortField === 'groupName' && sortDirection === 'asc'"
                                        class="w-3 h-3" />
                                    <ArrowDown v-if="sortField === 'groupName' && sortDirection === 'desc'"
                                        class="w-3 h-3" />
                                    <ArrowUpDown v-if="sortField !== 'groupName'" class="w-3 h-3 opacity-50" />
                                </div>
                            </th>
                            <th v-if="isColumnVisible('task')"
                                class="p-3 cursor-pointer hover:text-foreground transition-colors select-none"
                                @click="handleSort('taskName')" :title="$t('marks.table.tooltips.task')">
                                <div class="flex items-center gap-1">
                                    {{ $t('marks.table.task') }}
                                    <ArrowUp v-if="sortField === 'taskName' && sortDirection === 'asc'"
                                        class="w-3 h-3" />
                                    <ArrowDown v-if="sortField === 'taskName' && sortDirection === 'desc'"
                                        class="w-3 h-3" />
                                    <ArrowUpDown v-if="sortField !== 'taskName'" class="w-3 h-3 opacity-50" />
                                </div>
                            </th>
                            <th v-if="isColumnVisible('mark')" class="p-3 text-center"
                                :title="$t('marks.table.tooltips.mark')">{{ $t('marks.table.mark') }}</th>
                            <th class="p-3 text-center">{{ $t('marks.table.actions') }}</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        <tr v-for="(mark, index) in filteredMarks" :key="mark.id"
                            class="hover:bg-muted/50 transition-colors table-row-animate"
                            :style="{ animationDelay: `${index * 0.025}s` }"
                            :class="{ 'bg-muted/30': selectedMarks.has(mark.id) }">
                            <td class="p-3 text-center">
                                <input type="checkbox" :checked="selectedMarks.has(mark.id)"
                                    @change="toggleSelection(mark.id)"
                                    class="rounded border-gray-300 text-primary focus:ring-primary" />
                            </td>
                            <td v-if="isColumnVisible('added')" class="p-3 text-xs text-muted-foreground">
                                <div class="flex flex-col gap-1">
                                    <div class="flex items-center gap-1">
                                        <Calendar class="w-3 h-3" />
                                        {{ formatDate(mark.createdAt) }}
                                    </div>
                                    <div class="flex items-center gap-1 text-[10px] opacity-80">
                                        <Clock class="w-3 h-3" />
                                        {{ formatTime(mark.createdAt) }}
                                    </div>
                                </div>
                            </td>
                            <td v-if="isColumnVisible('student')" class="p-3 font-medium">{{ mark.studentName }}</td>
                            <td v-if="isColumnVisible('group')" class="p-3">
                                <button @click="activeFilters.group = mark.groupName"
                                    class="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
                                    :class="{ 'ring-2 ring-primary': activeFilters.group === mark.groupName }">
                                    {{ mark.groupName }}
                                </button>
                            </td>
                            <td v-if="isColumnVisible('task')" class="p-3" :title="mark.taskName">
                                <div class="flex flex-col">
                                    <span>{{ formatTaskName(mark.taskName) }}</span>
                                    <span class="text-xs text-muted-foreground">{{ mark.taskDate }}</span>
                                </div>
                            </td>
                            <td v-if="isColumnVisible('mark')" class="p-3 text-center relative">
                                <div class="flex items-center justify-center gap-1">
                                    <span
                                        class="font-mono font-bold cursor-help border-b border-dotted border-muted-foreground/50 group"
                                        @mouseenter="mark.showTooltip = true" @mouseleave="mark.showTooltip = false">
                                        {{ getFormattedMark(mark, selectedFormat) }}
                                        <Transition name="fade">
                                            <div v-if="mark.showTooltip"
                                                class="absolute z-10 px-3 py-2.5 bg-card border border-border rounded-md shadow-md text-xs text-card-foreground whitespace-nowrap right-full top-1/2 -translate-y-1/2 mr-2 pointer-events-none transition-opacity duration-200 ease-in-out">
                                                <div v-for="(tooltipLine, index) in getMarkTooltip(mark.score, mark.maxPoints)"
                                                    :key="index">{{ tooltipLine }}</div>
                                            </div>
                                        </Transition>
                                    </span>
                                    <!-- Unsynced Dot -->
                                    <div class="w-2 h-2 flex items-center justify-center">
                                        <span v-if="!mark.synced"
                                            class="w-2 h-2 rounded-full bg-orange-500 animate-pulse"
                                            :title="$t('marks.tooltips.unSynced')"></span>
                                    </div>
                                </div>
                            </td>
                            <td class="p-3 text-right">
                                <div class="flex items-center justify-end gap-2">
                                    <button @click="toggleSynced(mark)" class="p-1.5 rounded-md transition-colors"
                                        :class="mark.synced ? 'text-green-600 hover:bg-green-50' : 'text-muted-foreground hover:text-primary hover:bg-muted'"
                                        :title="mark.synced ? $t('marks.tooltips.markAsUnsynced') : $t('marks.tooltips.markAsSynced')">
                                        <CircleCheckBig class="w-4 h-4" />
                                    </button>
                                    <button @click="confirmDelete(mark)"
                                        class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                        :title="$t('marks.tooltips.delete')">
                                        <Trash2 class="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div v-else class="text-center py-12 text-muted-foreground">
            {{ searchQuery ? $t('marks.noMatch') : $t('marks.noMarks') }}
        </div>

        <!-- Group Modal -->
        <GroupModal :is-open="showGroupModal" :group="pendingGroup" :all-meet-ids="allMeetIds"
            :all-teachers="allTeachers" @close="handleGroupModalClose" @save="handleCreateGroup" />

        <!-- Delete Confirmation Modal -->
        <ConfirmModal :is-open="showDeleteModal"
            :title="isBulkDelete ? $t('marks.deleteModal.bulkTitle') : $t('marks.deleteModal.title')"
            :message="isBulkDelete ? $t('marks.deleteModal.bulkMessage', { count: selectedMarks.size }) : $t('marks.deleteModal.message')"
            :confirm-text="$t('marks.deleteModal.confirm')" @cancel="showDeleteModal = false" @confirm="handleDelete" />

        <!-- Filter Modal -->
        <MarksFilterModal :is-open="showFilterModal" :filters="activeFilters" :groups="groups"
            @close="showFilterModal = false" @apply="applyFilters" />
    </div>
</template>
