<script setup>
import { ref, computed } from 'vue';
import { Plus, Trash2, Edit2, QrCode, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-vue-next';
import GroupModal from './GroupModal.vue';
import ConfirmModal from '../ConfirmModal.vue';
import QrCodeModal from './QrCodeModal.vue';
import { useQuerySync } from '../../composables/useQuerySync';

const props = defineProps({
  groups: { type: Array, default: () => [] },
  memberCounts: { type: Object, default: () => ({}) },
  allMeetIds: { type: Array, default: () => [] },
  allTeachers: { type: Array, default: () => [] }
});

const emit = defineEmits(['save-group', 'delete-group', 'refresh']);

// Modal States
const showGroupModal = ref(false);
const showDeleteModal = ref(false);
const showQrModal = ref(false);
const selectedGroup = ref(null);
const groupToDeleteId = ref(null);
const qrMeetId = ref('');

// Filter & Sort
const searchQuery = ref('');
const sortField = ref('name');
const sortDirection = ref('asc');

useQuerySync({
  search: searchQuery,
  sort: sortField,
  order: sortDirection
});

const filteredGroups = computed(() => {
  let result = [...props.groups];

  // 1. Filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(g =>
      g.name.toLowerCase().includes(query) ||
      g.meetId.toLowerCase().includes(query)
    );
  }

  // 2. Sort
  result.sort((a, b) => {
    let valA = a[sortField.value];
    let valB = b[sortField.value];

    // Handle special cases
    if (sortField.value === 'members') {
      valA = props.memberCounts[a.name] || 0;
      valB = props.memberCounts[b.name] || 0;
    } else if (sortField.value === 'course') {
      valA = valA || 0; // Handle missing course
      valB = valB || 0;
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

function handleSort(field) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = 'asc';
  }
}


function handleSaveGroup(formData) {
  emit('save-group', formData);
  showGroupModal.value = false;
}

function handleDeleteConfirm() {
  if (!groupToDeleteId.value) return;
  emit('delete-group', groupToDeleteId.value);
  showDeleteModal.value = false;
  groupToDeleteId.value = null;
}

// Modal Handlers
function openCreateModal() {
  selectedGroup.value = null;
  showGroupModal.value = true;
}

function openEditModal(group) {
  selectedGroup.value = group;
  showGroupModal.value = true;
}

function openDeleteModal(groupId) {
  groupToDeleteId.value = groupId;
  showDeleteModal.value = true;
}

// QR Handler
function openQrModal(meetId) {
  qrMeetId.value = meetId;
  showQrModal.value = true;
}

</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <h2 class="text-2xl font-bold tracking-tight">{{ $t('groups.title') }}</h2>
        <span class="text-muted-foreground text-sm">{{ $t('groups.subtitle', {
          count: filteredGroups.length, total:
            groups.length
        }) }}</span>
      </div>

      <div class="flex items-center gap-4 w-full md:w-auto">
        <!-- Search -->
        <div class="relative w-full md:w-64">
          <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input v-model="searchQuery" :placeholder="$t('groups.searchPlaceholder')"
            class="pl-8 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>

        <button @click="openCreateModal"
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors whitespace-nowrap">
          <Plus class="w-4 h-4" />
          {{ $t('groups.add') }}
        </button>
      </div>
    </div>

    <!-- List -->
    <div class="bg-card rounded-lg border overflow-hidden">
      <div class="overflow-x-auto overflow-y-hidden">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 border-b">
            <tr>
              <th
                class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                @click="handleSort('name')">
                <div class="flex items-center gap-1">
                  {{ $t('groups.table.name') }}
                  <ArrowUp v-if="sortField === 'name' && sortDirection === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortField === 'name' && sortDirection === 'desc'" class="w-3 h-3" />
                  <ArrowUpDown v-if="sortField !== 'name'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th
                class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                @click="handleSort('course')">
                <div class="flex items-center gap-1">
                  {{ $t('groups.table.course') }}
                  <ArrowUp v-if="sortField === 'course' && sortDirection === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortField === 'course' && sortDirection === 'desc'" class="w-3 h-3" />
                  <ArrowUpDown v-if="sortField !== 'course'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th
                class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                @click="handleSort('meetId')">
                <div class="flex items-center gap-1">
                  {{ $t('groups.table.meetId') }}
                  <ArrowUp v-if="sortField === 'meetId' && sortDirection === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortField === 'meetId' && sortDirection === 'desc'" class="w-3 h-3" />
                  <ArrowUpDown v-if="sortField !== 'meetId'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th
                class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                @click="handleSort('members')">
                <div class="flex items-center gap-1">
                  {{ $t('groups.table.members') }}
                  <ArrowUp v-if="sortField === 'members' && sortDirection === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortField === 'members' && sortDirection === 'desc'" class="w-3 h-3" />
                  <ArrowUpDown v-if="sortField !== 'members'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th
                class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                @click="handleSort('teacher')">
                <div class="flex items-center gap-1">
                  {{ $t('groups.table.teacher') }}
                  <ArrowUp v-if="sortField === 'teacher' && sortDirection === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortField === 'teacher' && sortDirection === 'desc'" class="w-3 h-3" />
                  <ArrowUpDown v-if="sortField !== 'teacher'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground">{{
                $t('groups.table.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredGroups.length === 0">
              <td colspan="6" class="p-8 text-center text-muted-foreground">
                {{ searchQuery ? $t('groups.noMatch') : $t('groups.noGroups') }}
              </td>
            </tr>
            <tr v-for="(group, index) in filteredGroups" :key="group.id"
              class="border-b last:border-0 hover:bg-muted/50 transition-colors table-row-animate"
              :style="{ animationDelay: `${index * 0.025}s` }">
              <td class="p-4 font-medium">{{ group.name }}</td>
              <td class="p-4 text-muted-foreground">{{ group.course || '-' }}</td>
              <td class="p-4 font-mono text-xs">{{ group.meetId }}</td>
              <td class="p-4 text-muted-foreground">{{ memberCounts[group.name] || 0 }}</td>
              <td class="p-4 text-muted-foreground">{{ group.teacher || '-' }}</td>
              <td class="p-4 text-right">
                <div class="flex justify-end gap-2">
                  <button @click="openQrModal(group.meetId)"
                    class="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
                    title="Show QR Code">
                    <QrCode class="w-4 h-4" />
                  </button>
                  <button @click="openEditModal(group)"
                    class="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
                    title="Edit">
                    <Edit2 class="w-4 h-4" />
                  </button>
                  <button @click="openDeleteModal(group.id)"
                    class="p-2 hover:bg-destructive/10 rounded-md transition-colors text-destructive hover:text-destructive"
                    title="Delete">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modals -->
    <GroupModal :is-open="showGroupModal" :group="selectedGroup" :all-meet-ids="allMeetIds" :all-teachers="allTeachers"
      @close="showGroupModal = false" @save="handleSaveGroup" />

    <ConfirmModal :is-open="showDeleteModal" :title="$t('groups.deleteModal.title')"
      :message="$t('groups.deleteModal.message')" :confirm-text="$t('groups.deleteModal.confirm')"
      @cancel="showDeleteModal = false" @confirm="handleDeleteConfirm" />

    <QrCodeModal :is-open="showQrModal" :meet-id="qrMeetId" @close="showQrModal = false" />
  </div>

</template>
