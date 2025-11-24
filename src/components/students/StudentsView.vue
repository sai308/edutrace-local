<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, X, Timer, Edit2, Trash2 } from 'lucide-vue-next';
import EditStudentModal from './EditStudentModal.vue';
import ConfirmModal from '../ConfirmModal.vue';
import { useQuerySync } from '../../composables/useQuerySync';

import { useFormatters } from '../../composables/useFormatters';
import { useSort } from '../../composables/useSort';
import { useColors } from '../../composables/useColors';

const props = defineProps({
  students: { type: Array, default: () => [] },
  groupsMap: { type: Object, default: () => ({}) },
  teachers: { type: Set, default: () => new Set() }
});

const emit = defineEmits(['save-student', 'delete-student', 'bulk-delete-students', 'refresh']);
const { formatDuration } = useFormatters();
const { sortField, sortDirection, toggleSort } = useSort('name', 'asc');
const { getScoreColor } = useColors();

const router = useRouter();
const searchQuery = ref('');
const selectedGroup = ref(null);
// const sortField = ref('name');
// const sortDirection = ref('asc');

useQuerySync({
  search: searchQuery,
  group: selectedGroup,
  sort: sortField,
  order: sortDirection
});

const selectedStudents = ref(new Set()); // IDs of selected students

// Modal States
const showEditModal = ref(false);
const showDeleteModal = ref(false);
const studentToEdit = ref(null);
const studentToDeleteId = ref(null);
const isBulkDelete = ref(false);

const filteredStudents = computed(() => {
  let result = props.students;

  // Filter out teachers
  if (props.teachers.size > 0) {
    result = result.filter(s => !props.teachers.has(s.name));
  }

  if (selectedGroup.value) {
    result = result.filter(s => s.groups.includes(selectedGroup.value));
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.groups.some(g => g.toLowerCase().includes(query)) ||
      s.meetIds.some(m => m.toLowerCase().includes(query))
    );
  }

  return result.sort((a, b) => {
    let valA = a[sortField.value];
    let valB = b[sortField.value];

    if (sortField.value === 'groups') {
      valA = valA.join(', ');
      valB = valB.join(', ');
    }

    if (sortField.value === 'meetIds') {
      valA = valA.join(', ');
      valB = valB.join(', ');
    }

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortDirection.value === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection.value === 'asc' ? 1 : -1;
    return 0;
  });
});

const allGroupsList = computed(() => {
  const set = new Set();
  Object.values(props.groupsMap).forEach(g => set.add(g.name));
  return Array.from(set).sort();
});


// function formatDuration(seconds) {
//   const h = Math.floor(seconds / 3600);
//   const m = Math.floor((seconds % 3600) / 60);
//   return `${h}h ${m}m`;
// }

// function toggleSort(field) {
//   if (sortField.value === field) {
//     sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
//   } else {
//     sortField.value = field;
//     sortDirection.value = 'asc';
//   }
// }

// function getScoreColor(score) {
//   if (score >= 90) return 'text-green-600 font-bold';
//   if (score >= 75) return 'text-green-500';
//   if (score >= 50) return 'text-yellow-600';
//   return 'text-red-500';
// }

function openAnalytics(meetId) {
  router.push({ name: 'AnalyticsDetails', params: { id: meetId } });
}

// Selection Logic
function toggleSelect(id) {
  if (selectedStudents.value.has(id)) {
    selectedStudents.value.delete(id);
  } else {
    selectedStudents.value.add(id);
  }
}

function toggleSelectAll() {
  if (selectedStudents.value.size === filteredStudents.value.length) {
    selectedStudents.value.clear();
  } else {
    filteredStudents.value.forEach(s => {
      if (s.id) selectedStudents.value.add(s.id);
    });
  }
}

// Edit Logic
function openEditModal(student) {
  studentToEdit.value = student;
  showEditModal.value = true;
}

async function handleSaveStudent(formData) {
  emit('save-student', { formData, originalStudent: studentToEdit.value });
  showEditModal.value = false;
}

// Delete Logic
function openDeleteModal(id) {
  studentToDeleteId.value = id;
  isBulkDelete.value = false;
  showDeleteModal.value = true;
}

// We need to modify openDeleteModal signature and usage in template
function openDeleteModalObj(student) {
  studentToDeleteId.value = student.id;
  isBulkDelete.value = false;
  showDeleteModal.value = true;
}

function openBulkDeleteModal() {
  isBulkDelete.value = true;
  showDeleteModal.value = true;
}

async function handleDeleteConfirm() {
  if (isBulkDelete.value) {
    emit('bulk-delete-students', Array.from(selectedStudents.value));
    selectedStudents.value.clear();
  } else {
    if (studentToDeleteId.value) {
      emit('delete-student', studentToDeleteId.value);
    }
  }
  showDeleteModal.value = false;
  studentToDeleteId.value = null;
  studentToEdit.value = null;
}
</script>

<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <!-- ... (Header remains same) ... -->
    <div class="flex flex-col sm:flex-row gap-4 justify-between items-center">
      <div class="space-y-1">
        <div class="flex items-center gap-4">
          <h2 class="text-2xl font-bold tracking-tight">{{ $t('students.title') }}</h2>
          <span class="text-muted-foreground text-sm">{{ $t('students.subtitle', {
            count: filteredStudents.length,
            total: students.length - (teachers.size || 0)
          }) }}</span>
        </div>

        <div v-if="selectedGroup" class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">{{ $t('students.groupFilter') }}</span>
          <button @click="selectedGroup = null"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
            {{ selectedGroup }}
            <X class="w-3 h-3" />
          </button>
        </div>
      </div>

      <div class="flex gap-2 w-full sm:w-auto">
        <button v-if="selectedStudents.size > 0" @click="openBulkDeleteModal"
          class="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md transition-colors flex items-center gap-2">
          <Trash2 class="w-4 h-4" />
          {{ $t('students.delete', { count: selectedStudents.size }) }}
        </button>

        <div class="relative w-full sm:w-72">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input v-model="searchQuery" type="text" :placeholder="$t('students.searchPlaceholder')"
            class="w-full pl-9 pr-4 py-2 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="border rounded-lg bg-card overflow-hidden shadow-sm">
      <div class="overflow-x-auto overflow-y-hidden">
        <table class="w-full text-sm text-left">
          <thead class="bg-muted/50 text-muted-foreground font-medium border-b">
            <tr>
              <th class="w-10 px-4 py-3">
                <input type="checkbox"
                  :checked="selectedStudents.size > 0 && selectedStudents.size === filteredStudents.length"
                  @change="toggleSelectAll" class="rounded border-gray-300 text-primary focus:ring-primary" />
              </th>
              <th class="w-12 px-4 py-3 text-center">#</th>
              <th class="px-4 py-3 cursor-pointer hover:text-foreground transition-colors" @click="toggleSort('name')">
                <div class="flex items-center gap-2">
                  {{ $t('students.table.name') }}
                  <ArrowUp v-if="sortField === 'name' && sortDirection === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortField === 'name' && sortDirection === 'desc'" class="w-3 h-3" />
                  <ArrowUpDown v-if="sortField !== 'name'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th class="px-4 py-3 cursor-pointer hover:text-foreground transition-colors"
                @click="toggleSort('groups')">
                <div class="flex items-center gap-2">
                  {{ $t('students.table.groups') }}
                  <ArrowUp v-if="sortField === 'groups' && sortDirection === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortField === 'groups' && sortDirection === 'desc'" class="w-3 h-3" />
                  <ArrowUpDown v-if="sortField !== 'groups'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th class="px-4 py-3 cursor-pointer hover:text-foreground transition-colors"
                @click="toggleSort('meetIds')">
                <div class="flex items-center gap-2">
                  {{ $t('students.table.meetIds') }}
                  <ArrowUp v-if="sortField === 'meetIds' && sortDirection === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortField === 'meetIds' && sortDirection === 'desc'" class="w-3 h-3" />
                  <ArrowUpDown v-if="sortField !== 'meetIds'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th class="px-4 py-3 text-right cursor-pointer hover:text-foreground transition-colors"
                @click="toggleSort('sessionCount')">
                <div class="flex items-center justify-end gap-2">
                  {{ $t('students.table.sessions') }}
                  <ArrowUp v-if="sortField === 'sessionCount' && sortDirection === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortField === 'sessionCount' && sortDirection === 'desc'" class="w-3 h-3" />
                  <ArrowUpDown v-if="sortField !== 'sessionCount'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th class="px-4 py-3 text-right cursor-pointer hover:text-foreground transition-colors"
                @click="toggleSort('averageAttendancePercent')">
                <div class="flex items-center justify-end gap-2">
                  {{ $t('students.table.avg') }}
                  <Timer class="w-3 h-3" /> %
                  <ArrowUp v-if="sortField === 'averageAttendancePercent' && sortDirection === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortField === 'averageAttendancePercent' && sortDirection === 'desc'"
                    class="w-3 h-3" />
                  <ArrowUpDown v-if="sortField !== 'averageAttendancePercent'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th class="px-4 py-3 text-right cursor-pointer hover:text-foreground transition-colors"
                @click="toggleSort('totalAttendancePercent')">
                <div class="flex items-center justify-end gap-2">
                  {{ $t('students.table.total') }}
                  <Timer class="w-3 h-3" /> %
                  <ArrowUp v-if="sortField === 'totalAttendancePercent' && sortDirection === 'asc'" class="w-3 h-3" />
                  <ArrowDown v-if="sortField === 'totalAttendancePercent' && sortDirection === 'desc'"
                    class="w-3 h-3" />
                  <ArrowUpDown v-if="sortField !== 'totalAttendancePercent'" class="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th class="px-4 py-3 text-right">{{ $t('students.table.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="(student, index) in filteredStudents" :key="student.id"
              class="hover:bg-muted/50 transition-colors table-row-animate"
              :style="{ animationDelay: `${index * 0.025}s` }"
              :class="{ 'bg-muted/30': selectedStudents.has(student.id) }">
              <td class="px-4 py-3">
                <input type="checkbox" :checked="student.id && selectedStudents.has(student.id)"
                  @change="toggleSelect(student.id)" :disabled="!student.id"
                  class="rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                  title="Only saved members can be bulk deleted" />
              </td>
              <td class="px-4 py-3 text-center text-muted-foreground text-xs">{{ index + 1 }}</td>
              <td class="px-4 py-3 font-medium">{{ student.name }}</td>
              <td class="px-4 py-3 text-muted-foreground max-w-xs">
                <div class="flex flex-wrap gap-1">
                  <button v-for="group in student.groups" :key="group" @click="selectedGroup = group"
                    class="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium whitespace-nowrap hover:bg-secondary/80 transition-colors cursor-pointer"
                    :class="{ 'ring-2 ring-primary': selectedGroup === group }">
                    {{ group }}
                  </button>
                </div>
              </td>
              <td class="px-4 py-3 text-muted-foreground max-w-xs">
                <div class="flex flex-wrap gap-1">
                  <button v-for="meetId in student.meetIds" :key="meetId" @click="openAnalytics(meetId)"
                    class="px-2 py-0.5 rounded-full bg-muted hover:bg-primary/10 hover:text-primary text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border border-transparent hover:border-primary/20"
                    title="View Analytics">
                    {{ meetId }}
                  </button>
                </div>
              </td>
              <td class="px-4 py-3 text-right">
                <span class="font-medium">{{ student.sessionCount }}</span>
                <span class="text-muted-foreground">/{{ student.totalSessions }}</span>
              </td>
              <td class="px-4 py-3 text-right font-mono" :class="getScoreColor(student.averageAttendancePercent)"
                :title="`Across ${student.sessionCount} sessions`">
                {{ student.averageAttendancePercent.toFixed(1) }}%
              </td>
              <td class="px-4 py-3 text-right font-mono" :class="getScoreColor(student.totalAttendancePercent)"
                :title="formatDuration(student.totalDuration)">
                {{ student.totalAttendancePercent.toFixed(1) }}%
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <button @click="openEditModal(student)"
                    class="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
                    title="Edit">
                    <Edit2 class="w-4 h-4" />
                  </button>
                  <button @click="openDeleteModalObj(student)"
                    class="p-2 hover:bg-destructive/10 rounded-md transition-colors text-destructive hover:text-destructive"
                    title="Delete">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredStudents.length === 0">
              <td colspan="8" class="px-4 py-8 text-center text-muted-foreground">
                {{ $t('students.noStudents') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modals -->
    <EditStudentModal :is-open="showEditModal" :student="studentToEdit" :all-groups="allGroupsList"
      @close="showEditModal = false" @save="handleSaveStudent" />

    <ConfirmModal :is-open="showDeleteModal"
      :title="isBulkDelete ? $t('students.deleteModal.bulkTitle') : $t('students.deleteModal.title')"
      :message="isBulkDelete ? $t('students.deleteModal.bulkMessage', { count: selectedStudents.size }) : $t('students.deleteModal.message')"
      :confirm-text="$t('students.deleteModal.confirm')" @cancel="showDeleteModal = false"
      @confirm="handleDeleteConfirm" />
  </div>
</template>
