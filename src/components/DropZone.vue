<script setup>
import { ref } from 'vue';
import { useDropZone } from '@vueuse/core';
import { UploadCloud, Loader2 } from 'lucide-vue-next';

const props = defineProps({
  isProcessing: Boolean,
  prompt: {
    type: String,
    default: 'Drop CSV files here'
  }
});

const emit = defineEmits(['files-dropped']);

const dropZoneRef = ref(null);

function onDrop(files) {
  if (files && files.length > 0) {
    emit('files-dropped', files);
  }
}

const { isOver } = useDropZone(dropZoneRef, {
  onDrop,
  dataTypes: ['text/csv', 'application/vnd.ms-excel'] // basic csv types
});

function onFileSelect(event) {
  const files = event.target.files;
  if (files && files.length > 0) {
    emit('files-dropped', Array.from(files));
  }
}
</script>

<template>
  <div ref="dropZoneRef"
    class="relative border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer" :class="[
      isOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
      isProcessing ? 'opacity-50 pointer-events-none' : ''
    ]" @click="$refs.fileInput.click()">
    <input ref="fileInput" type="file" multiple accept=".csv" class="hidden" @change="onFileSelect" />

    <div class="flex flex-col items-center gap-4">
      <div class="p-4 rounded-full bg-primary/10 text-primary">
        <Loader2 v-if="isProcessing" class="w-8 h-8 animate-spin" />
        <UploadCloud v-else class="w-8 h-8" />
      </div>

      <div class="space-y-1">
        <h3 class="font-semibold text-lg">
          {{ isProcessing ? $t('dropZone.processing') : (prompt === 'Drop CSV files here' ? $t('dropZone.prompt') :
          prompt) }}
        </h3>
        <p class="text-sm text-muted-foreground">
          {{ $t('dropZone.hint') }}
        </p>
      </div>
    </div>
  </div>
</template>
