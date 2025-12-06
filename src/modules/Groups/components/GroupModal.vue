<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { X, Save, ChevronDown } from 'lucide-vue-next';
import { repository } from '@/services/repository';

const props = defineProps({
  isOpen: Boolean,
  group: {
    type: Object,
    default: null
  },
  allMeetIds: {
    type: Array,
    default: () => []
  },
  allTeachers: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['close', 'save']);

import { useModalClose } from '@/composables/useModalClose';

useModalClose(() => {
  if (props.isOpen) {
    emit('close');
  }
});


const formData = ref({
  name: '',
  meetId: '',
  teacher: '',
  course: null
});

const defaultTeacher = ref('');

// Autocomplete states
const showMeetIdSuggestions = ref(false);
const showTeacherSuggestions = ref(false);

onMounted(async () => {
  defaultTeacher.value = await repository.getDefaultTeacher();
});

// Initialize form when modal opens or group changes
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (props.group) {
      formData.value = { ...props.group };
      // Suggest course if missing for existing group
      if (!formData.value.course && formData.value.name) {
        suggestCourse(formData.value.name);
      }
    } else {
      formData.value = {
        name: '',
        meetId: '',
        teacher: defaultTeacher.value, // Pre-fill with default teacher
        course: null
      };
    }
    showMeetIdSuggestions.value = false;
    showTeacherSuggestions.value = false;
  }
});

// Auto-suggest course from name
watch(() => formData.value.name, (newName) => {
  if (!props.group && newName) { // Only auto-suggest for new groups or if explicit
    // Actually, let's suggest if course is empty, even for existing groups if user is editing name
    if (!formData.value.course) {
      suggestCourse(newName);
    }
  }
});

function suggestCourse(name) {
  const match = name.match(/\d/);
  if (match) {
    const course = parseInt(match[0], 10);
    if (course >= 1 && course <= 4) {
      formData.value.course = course;
    }
  }
}

// Filtered suggestions
const filteredMeetIds = computed(() => {
  const query = formData.value.meetId.toLowerCase();
  return props.allMeetIds.filter(id => id.toLowerCase().includes(query));
});

const filteredTeachers = computed(() => {
  const query = formData.value.teacher.toLowerCase();
  return props.allTeachers.filter(t => t.toLowerCase().includes(query));
});

function selectMeetId(id) {
  formData.value.meetId = id;
  showMeetIdSuggestions.value = false;
}

function selectTeacher(name) {
  formData.value.teacher = name;
  showTeacherSuggestions.value = false;
}

function handleSave() {
  emit('save', { ...formData.value });
}

// Close suggestions when clicking outside (simplified for now, can use v-click-outside if available or just blur with delay)
function handleBlur(type) {
  // Small delay to allow click event on suggestion to fire
  setTimeout(() => {
    if (type === 'meetId') showMeetIdSuggestions.value = false;
    if (type === 'teacher') showTeacherSuggestions.value = false;
  }, 200);
}

function handlePaste(event) {
  const text = event.clipboardData.getData('text');
  if (!text) return;

  // Regex to match Google Meet IDs (xxx-xxxx-xxx)
  // It might be part of a URL like https://meet.google.com/abc-defg-hij
  // or just the ID itself.
  const match = text.match(/[a-z]{3}-[a-z]{4}-[a-z]{3}/);
  if (match) {
    event.preventDefault();
    formData.value.meetId = match[0];
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[60] overflow-y-auto">
    <div class="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm !-mt-6 transition-opacity" @click="emit('close')" />

      <div
        class="relative transform overflow-visible bg-card text-left shadow-xl transition-all sm:my-8 w-full max-w-2xl rounded-lg border p-6">
        <div class="flex items-center justify-between border-b pb-4 mb-4">
          <h3 class="text-lg font-bold">{{ group ? $t('groups.modal.editTitle') : $t('groups.modal.addTitle') }}</h3>
          <button @click="emit('close')" class="p-1 hover:bg-muted rounded-md transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-4">
          <!-- Group Name -->
          <div class="space-y-2">
            <label class="text-sm font-medium">{{ $t('groups.modal.name') }} <span
                class="text-destructive">*</span></label>
            <input v-model="formData.name" type="text" :placeholder="$t('groups.modal.namePlaceholder')"
              class="w-full px-3 py-2 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              autofocus />
          </div>

          <!-- Course -->
          <div class="space-y-2">
            <label class="text-sm font-medium">{{ $t('groups.modal.course') }}</label>
            <input v-model.number="formData.course" type="number" min="1" max="4"
              :placeholder="$t('groups.modal.coursePlaceholder')"
              class="w-full px-3 py-2 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
          </div>

          <!-- Meet ID with Autocomplete -->
          <div class="space-y-2 relative">
            <label class="text-sm font-medium">{{ $t('groups.modal.meetId') }} <span
                class="text-destructive">*</span></label>
            <div class="relative">
              <input v-model="formData.meetId" type="text" :placeholder="$t('groups.modal.meetIdPlaceholder')"
                class="w-full px-3 py-2 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                @focus="showMeetIdSuggestions = true" @blur="handleBlur('meetId')" @paste="handlePaste" />
              <button v-if="allMeetIds.length > 0" @click="showMeetIdSuggestions = !showMeetIdSuggestions"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                tabindex="-1">
                <ChevronDown class="w-4 h-4" />
              </button>
            </div>

            <!-- Suggestions Dropdown -->
            <div v-if="showMeetIdSuggestions && filteredMeetIds.length > 0"
              class="absolute z-20 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
              <button v-for="id in filteredMeetIds" :key="id" @click="selectMeetId(id)"
                class="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                {{ id }}
              </button>
            </div>
          </div>

          <!-- Teacher Name with Autocomplete -->
          <div class="space-y-2 relative">
            <label class="text-sm font-medium">{{ $t('groups.modal.teacher') }}</label>
            <div class="relative">
              <input v-model="formData.teacher" type="text" :placeholder="$t('groups.modal.teacherPlaceholder')"
                class="w-full px-3 py-2 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                @focus="showTeacherSuggestions = true" @blur="handleBlur('teacher')" />
              <button v-if="allTeachers.length > 0" @click="showTeacherSuggestions = !showTeacherSuggestions"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                tabindex="-1">
                <ChevronDown class="w-4 h-4" />
              </button>
            </div>

            <!-- Suggestions Dropdown -->
            <div v-if="showTeacherSuggestions && filteredTeachers.length > 0"
              class="absolute z-20 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
              <button v-for="teacher in filteredTeachers" :key="teacher" @click="selectTeacher(teacher)"
                class="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                {{ teacher }}
              </button>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t mt-6">
          <button @click="emit('close')"
            class="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors">
            {{ $t('groups.modal.cancel') }}
          </button>
          <button @click="handleSave"
            class="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors">
            <Save class="w-4 h-4" />
            {{ $t('groups.modal.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
