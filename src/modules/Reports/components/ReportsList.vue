<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

import { settingsRepository } from '@/shared/services/settings.repository';

import { useI18n } from 'vue-i18n';
import { Trash2, Eye, Calendar, Clock, ArrowUp, ArrowDown, ArrowUpDown, Search, X } from 'lucide-vue-next';
import ConfirmModal from '@/components/ConfirmModal.vue';
import ColumnPicker from '@/components/ColumnPicker.vue';
import { useQuerySync } from '@/composables/useQuerySync';
import { useColumnVisibility } from '@/composables/useColumnVisibility';

import { useFormatters } from '@/composables/useFormatters';
import { useSort } from '@/composables/useSort';
import { useInputHandlers } from '@/composables/useInputHandlers';

const props = defineProps({
  meets: {
    type: Array,
    default: () => []
  },
  groupsMap: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['view-details', 'delete-meet', 'bulk-delete']);

// State

const router = useRouter();
const route = useRoute();
const { formatDate, formatTime, formatCompactDate, formatDuration } = useFormatters();
const { sortField: sortKey, sortDirection: sortOrder, toggleSort } = useSort('date', 'desc');
const { handleMeetIdPasteUtil } = useInputHandlers();
const { t } = useI18n();

const searchQuery = ref('');
const selectedIds = ref(new Set());
const showBulkDeleteConfirm = ref(false);
const durationLimit = ref(0);

onMounted(async () => {
  durationLimit.value = await settingsRepository.getDurationLimit();
});
const selectedMeetId = ref(null); // For filtering by meetId
const selectedGroup = ref(null); // For filtering by group

// Column visibility setup
const columns = computed(() => [
  { id: 'group', label: t('reports.table.group'), defaultVisible: true },
  { id: 'meetId', label: t('reports.table.meetId'), defaultVisible: true },
  { id: 'date', label: t('reports.table.date'), defaultVisible: true },
  { id: 'participants', label: t('reports.table.participants'), defaultVisible: true },
  { id: 'duration', label: t('reports.table.duration'), defaultVisible: true },
  { id: 'filename', label: t('reports.table.filename'), defaultVisible: false },
  { id: 'uploadedAt', label: t('reports.table.uploadedAt'), defaultVisible: true }
]);

const { visibleColumns, toggleColumn, resetColumns, isColumnVisible } = useColumnVisibility('reports', columns.value);

useQuerySync({
  search: searchQuery,
  sort: sortKey,
  order: sortOrder,
  meetId: selectedMeetId,
  group: selectedGroup
});

// Helpers
function getGroupName(meetId) {
  const group = props.groupsMap[meetId];
  return group ? group.name : '-';
}

function getDisplayName(meetId) {
  const group = props.groupsMap[meetId];
  return group ? `${group.name} (${meetId})` : meetId;
}

function getMeetDuration(meet) {
  if (meet.participants && meet.participants.length > 0) {
    // Try to calculate from participants first
    const times = meet.participants
      .filter(p => p.joinTime)
      .map(p => {
        const joinDate = new Date(p.joinTime);
        // Check if date is valid
        if (isNaN(joinDate.getTime())) return null;
        return {
          start: joinDate.getTime(),
          end: joinDate.getTime() + (p.duration * 1000)
        };
      })
      .filter(t => t !== null);

    if (times.length > 0) {
      const minStart = Math.min(...times.map(t => t.start));
      const maxEnd = Math.max(...times.map(t => t.end));
      let duration = (maxEnd - minStart) / 1000;

      // Apply duration limit if set
      if (durationLimit.value > 0 && duration > durationLimit.value * 60) {
        duration = durationLimit.value * 60;
      }
      return duration;
    }
  }

  // Fallback to metadata
  if (meet.startTime && meet.endTime) {
    const start = new Date(meet.startTime).getTime();
    const end = new Date(meet.endTime).getTime();
    let duration = (end - start) / 1000;

    // Apply duration limit if set
    if (durationLimit.value > 0 && duration > durationLimit.value * 60) {
      duration = durationLimit.value * 60;
    }
    return duration;
  }
  return 0;
}

// Sorting & Filtering
const filteredMeets = computed(() => {
  let result = [...props.meets];

  // Filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(meet => {
      const displayName = getDisplayName(meet.meetId).toLowerCase();
      return displayName.includes(query);
    });
  }

  // Filter by selected meetId
  if (selectedMeetId.value) {
    result = result.filter(meet => meet.meetId === selectedMeetId.value);
  }

  // Filter by selected group
  if (selectedGroup.value) {
    result = result.filter(meet => getGroupName(meet.meetId) === selectedGroup.value);
  }

  // Sort
  result.sort((a, b) => {
    let valA, valB;

    if (sortKey.value === 'meetId') {
      valA = a.meetId.toLowerCase();
      valB = b.meetId.toLowerCase();
    } else if (sortKey.value === 'group') {
      valA = getGroupName(a.meetId).toLowerCase();
      valB = getGroupName(b.meetId).toLowerCase();
    } else if (sortKey.value === 'date') {
      valA = new Date(a.date).getTime();
      valB = new Date(b.date).getTime();
    } else if (sortKey.value === 'duration') {
      valA = getMeetDuration(a);
      valB = getMeetDuration(b);
    } else if (sortKey.value === 'filename') {
      valA = a.filename.toLowerCase();
      valB = b.filename.toLowerCase();
    } else if (sortKey.value === 'uploadedAt') {
      valA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      valB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
    }

    if (valA < valB) return sortOrder.value === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder.value === 'asc' ? 1 : -1;
    return 0;
  });

  return result;
});


// Selection
const allSelected = computed(() => {
  return filteredMeets.value.length > 0 && selectedIds.value.size === filteredMeets.value.length;
});

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value.clear();
  } else {
    filteredMeets.value.forEach(meet => selectedIds.value.add(meet.id));
  }
}

function toggleSelection(id) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
}

function handleBulkDelete() {
  showBulkDeleteConfirm.value = true;
}

function confirmBulkDelete() {
  emit('bulk-delete', Array.from(selectedIds.value));
  selectedIds.value.clear();
  showBulkDeleteConfirm.value = false;
}

function filterByMeetId(meetId) {
  selectedMeetId.value = selectedMeetId.value === meetId ? null : meetId;
}

function filterByGroup(groupName) {
  selectedGroup.value = selectedGroup.value === groupName ? null : groupName;
}

function handleSearchPaste(event) {
  handleMeetIdPasteUtil(event, searchQuery);
}

</script>

<template>
  <div class="space-y-4">
    <!-- Main Header Row -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <h2 class="text-2xl font-bold tracking-tight">{{ $t('reports.title') }}</h2>
        <span class="text-muted-foreground text-sm">{{ $t('reports.subtitle', {
          count: filteredMeets.length, total:
            meets.length
        }) }}</span>
        <!-- Bulk Delete -->
        <button v-if="selectedIds.size > 0" @click="handleBulkDelete"
          class="flex items-selectedIds gap-2 px-3 py-1.5 text-sm font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-md transition-colors">
          <Trash2 class="w-4 h-4" />
          Видалити
          <span class="ml-1 text-destructive bg-destructive/10 text-[10px] px-2 py-0.25 rounded-full">
            {{ selectedIds.size }}
          </span>
        </button>
      </div>
    </div>

    <!-- Search Row -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <input v-model="searchQuery" :placeholder="$t('reports.searchPlaceholder')" @paste="handleSearchPaste"
          class="pl-8 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
      </div>

      <ColumnPicker :columns="columns" :visible-columns="visibleColumns" @toggle-column="toggleColumn"
        @reset="resetColumns" />
    </div>

    <!-- Active Filters Row -->
    <div v-if="selectedMeetId || selectedGroup" class="flex items-center gap-3 px-1">
      <span class="text-sm text-muted-foreground">{{ $t('reports.activeFilters') }}</span>

      <!-- Active MeetId Filter -->
      <button v-if="selectedMeetId" @click="selectedMeetId = null"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
        {{ $t('reports.filterMeetId', { id: selectedMeetId }) }}
        <X class="w-3 h-3" />
      </button>

      <!-- Active Group Filter -->
      <button v-if="selectedGroup" @click="selectedGroup = null"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
        {{ $t('reports.filterGroup', { group: selectedGroup }) }}
        <X class="w-3 h-3" />
      </button>
    </div>

    <div class="bg-card rounded-lg border overflow-hidden">
      <div class="overflow-x-auto overflow-y-hidden">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 border-b">
            <tr>
              <th class="h-12 px-4 w-10 align-middle">
                <input type="checkbox" :checked="allSelected" @change="toggleSelectAll"
                  class="rounded border-gray-300 text-primary focus:ring-primary" />
              </th>
              <th v-if="isColumnVisible('group')"
                class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                @click="toggleSort('group')" :title="$t('reports.table.tooltips.group')">
                <div class="flex items-center gap-1">
                  {{ $t('reports.table.group') }}
                  <ArrowUp v-if="sortKey === 'group' && sortOrder === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortKey === 'group' && sortOrder === 'desc'" class="w-3 h-3" />
                  <ArrowUpDown v-if="sortKey !== 'group'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th v-if="isColumnVisible('meetId')"
                class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                @click="toggleSort('meetId')" :title="$t('reports.table.tooltips.meetId')">
                <div class="flex items-center gap-1">
                  {{ $t('reports.table.meetId') }}
                  <ArrowUp v-if="sortKey === 'meetId' && sortOrder === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortKey === 'meetId' && sortOrder === 'desc'" class="w-3 h-3" />
                  <ArrowUpDown v-if="sortKey !== 'meetId'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th v-if="isColumnVisible('date')"
                class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                @click="toggleSort('date')" :title="$t('reports.table.tooltips.date')">
                <div class="flex items-center gap-1">
                  {{ $t('reports.table.date') }}
                  <ArrowUp v-if="sortKey === 'date' && sortOrder === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortKey === 'date' && sortOrder === 'desc'" class="w-3 h-3" />
                  <ArrowUpDown v-if="sortKey !== 'date'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th v-if="isColumnVisible('participants')"
                class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                :title="$t('reports.table.tooltips.participants')">{{
                  $t('reports.table.participants') }}</th>
              <th v-if="isColumnVisible('duration')"
                class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                @click="toggleSort('duration')" :title="$t('reports.table.tooltips.duration')">
                <div class="flex items-center gap-1">
                  {{ $t('reports.table.duration') }}
                  <ArrowUp v-if="sortKey === 'duration' && sortOrder === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortKey === 'duration' && sortOrder === 'desc'" class="w-3 h-3" />
                  <ArrowUpDown v-if="sortKey !== 'duration'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th v-if="isColumnVisible('filename')"
                class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                @click="toggleSort('filename')" :title="$t('reports.table.tooltips.filename')">
                <div class="flex items-center gap-1">
                  {{ $t('reports.table.filename') }}
                  <ArrowUp v-if="sortKey === 'filename' && sortOrder === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortKey === 'filename' && sortOrder === 'desc'" class="w-3 h-3" />
                  <ArrowUpDown v-if="sortKey !== 'filename'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th v-if="isColumnVisible('uploadedAt')"
                class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                @click="toggleSort('uploadedAt')" :title="$t('reports.table.tooltips.uploadedAt')">
                <div class="flex items-center gap-1">
                  {{ $t('reports.table.uploadedAt') }}
                  <ArrowUp v-if="sortKey === 'uploadedAt' && sortOrder === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortKey === 'uploadedAt' && sortOrder === 'desc'" class="w-3 h-3" />
                  <ArrowUpDown v-if="sortKey !== 'uploadedAt'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground">{{
                $t('reports.table.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredMeets.length === 0">
              <td colspan="7" class="p-8 text-center text-muted-foreground">
                {{ searchQuery ? $t('reports.noMatch') : $t('reports.noReports') }}
              </td>
            </tr>
            <tr v-for="(meet, index) in filteredMeets" :key="meet.id"
              class="border-b last:border-0 hover:bg-muted/50 transition-colors table-row-animate"
              :style="{ animationDelay: `${index * 0.0125}s` }" :class="{ 'bg-muted/20': selectedIds.has(meet.id) }">
              <td class="p-4">
                <input type="checkbox" :checked="selectedIds.has(meet.id)" @change="toggleSelection(meet.id)"
                  class="rounded border-gray-300 text-primary focus:ring-primary" />
              </td>
              <td v-if="isColumnVisible('group')" class="p-4">
                <button v-if="getGroupName(meet.meetId) !== '-'" @click="filterByGroup(getGroupName(meet.meetId))"
                  class="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
                  :class="{ 'ring-2 ring-primary': selectedGroup === getGroupName(meet.meetId) }">
                  {{ getGroupName(meet.meetId) }}
                </button>
                <span v-else class="text-muted-foreground text-xs">-</span>
              </td>
              <td v-if="isColumnVisible('meetId')" class="p-4">
                <button @click="filterByMeetId(meet.meetId)"
                  class="px-2 py-0.5 rounded-full bg-muted hover:bg-primary/10 hover:text-primary text-xs font-mono font-medium transition-colors border border-transparent hover:border-primary/20"
                  :class="{ 'ring-2 ring-primary bg-primary/10 text-primary': selectedMeetId === meet.meetId }">
                  {{ meet.meetId }}
                </button>
              </td>

              <td v-if="isColumnVisible('date')" class="p-4">
                <div class="flex items-center gap-2">
                  <Calendar class="w-4 h-4 text-muted-foreground" />
                  {{ formatDate(meet.date) }}
                </div>
              </td>
              <td v-if="isColumnVisible('participants')" class="p-4">{{ meet.participants.length }}</td>
              <td v-if="isColumnVisible('duration')" class="p-4">
                <div class="flex items-center gap-2">
                  <Clock class="w-4 h-4 text-muted-foreground" />
                  {{ formatDuration(getMeetDuration(meet)) }}
                </div>
              </td>
              <td v-if="isColumnVisible('filename')" class="p-4 text-muted-foreground truncate max-w-[200px]"
                :title="meet.filename">
                {{ meet.filename }}
              </td>
              <td v-if="isColumnVisible('uploadedAt')" class="p-4 text-xs text-muted-foreground">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-1">
                    <Calendar class="w-3 h-3" />
                    {{ formatCompactDate(meet.uploadedAt) }}
                  </div>
                  <div class="flex items-center gap-1 text-[10px] opacity-80">
                    <Clock class="w-3 h-3" />
                    {{ formatTime(meet.uploadedAt) }}
                  </div>
                </div>
              </td>
              <td class="p-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    @click="router.push({ name: 'ReportDetails', params: { id: meet.id }, query: { view: 'table' } })"
                    class="p-2 hover:bg-primary/10 text-primary rounded-md transition-colors"
                    :title="$t('reports.tooltips.view')">
                    <Eye class="w-4 h-4" />
                  </button>
                  <button @click="$emit('delete-meet', meet.id)"
                    class="p-2 hover:bg-destructive/10 text-destructive rounded-md transition-colors"
                    :title="$t('reports.tooltips.delete')">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ConfirmModal :is-open="showBulkDeleteConfirm" :title="$t('reports.deleteModal.title')"
        :message="$t('reports.deleteModal.message', { count: selectedIds.size })"
        :confirm-text="$t('reports.deleteModal.confirm')" variant="danger" @confirm="confirmBulkDelete"
        @cancel="showBulkDeleteConfirm = false" />
    </div>
  </div>
</template>
