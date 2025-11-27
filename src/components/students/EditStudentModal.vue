<script setup>
import { ref, watch } from 'vue';
import { X } from 'lucide-vue-next';

const props = defineProps({
  isOpen: Boolean,
  student: Object,
  allGroups: Array
});

const emit = defineEmits(['close', 'save']);

import { useModalClose } from '../../composables/useModalClose';

useModalClose(() => {
  if (props.isOpen) {
    emit('close');
  }
});


const formData = ref({
  name: '',
  groupName: '',
  email: ''
});

watch(() => props.student, (newVal) => {
  if (newVal) {
    formData.value = {
      name: newVal.name || '',
      groupName: newVal.groupName || '',
      email: newVal.email || ''
    };
  }
}, { immediate: true });

function save() {
  emit('save', { ...formData.value });
}
</script>

<template>
  <div v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 !-mt-6 animate-in fade-in duration-200">
    <div class="bg-card w-full max-w-md rounded-lg shadow-lg border flex flex-col animate-in zoom-in-95 duration-200">

      <!-- Header -->
      <div class="p-4 border-b flex items-center justify-between">
        <h3 class="text-lg font-bold">{{ $t('students.editModal.title') }}</h3>
        <button @click="$emit('close')" class="p-2 hover:bg-muted rounded-full transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ $t('students.editModal.name') }}</label>
          <input v-model="formData.name" type="text"
            class="w-full px-3 py-2 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            :placeholder="$t('students.editModal.name')" />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">{{ $t('students.editModal.groups') }}</label>
          <div class="relative">
            <input v-model="formData.groupName" type="text" list="group-suggestions"
              class="w-full px-3 py-2 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              :placeholder="$t('students.editModal.groups')" autocomplete="off" />
            <datalist id="group-suggestions">
              <option v-for="g in allGroups" :key="g" :value="g">{{ g }}</option>
            </datalist>
          </div>
          <p class="text-xs text-muted-foreground" v-if="allGroups.length > 0">
            {{ $t('students.editModal.groupHint') }}
          </p>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">{{ $t('students.editModal.email') }}</label>
          <input v-model="formData.email" type="email"
            class="w-full px-3 py-2 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            :placeholder="$t('students.editModal.emailPlaceholder')" />
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t bg-muted/10 flex justify-end gap-2">
        <button @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors">
          {{ $t('students.editModal.cancel') }}
        </button>
        <button @click="save"
          class="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors">
          {{ $t('students.editModal.save') }}
        </button>
      </div>
    </div>
  </div>
</template>
