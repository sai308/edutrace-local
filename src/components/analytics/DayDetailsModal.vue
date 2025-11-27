<script setup>
import { X } from 'lucide-vue-next';

const props = defineProps({
  isOpen: Boolean,
  date: String,
  meetId: String,
  participants: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['close']);

import { useModalClose } from '../../composables/useModalClose';

useModalClose(() => {
  if (props.isOpen) {
    emit('close');
  }
});


function formatDuration(seconds) {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center !-mt-6 p-4 sm:p-6">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')"></div>

    <div
      class="relative w-full max-w-2xl bg-card rounded-xl shadow-xl border flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b shrink-0">
        <div>
          <h3 class="text-xl font-bold tracking-tight">{{ $t('reports.details.dayDetails.title') }}</h3>
          <p class="text-muted-foreground text-sm mt-1">
            {{ date }} • {{ meetId }}
          </p>
        </div>
        <button @click="$emit('close')" class="p-2 hover:bg-muted rounded-full transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="overflow-y-auto p-0">
        <table class="w-full text-sm text-left">
          <thead class="bg-muted/50 text-muted-foreground sticky top-0 z-10">
            <tr>
              <th class="px-6 py-3 font-medium">{{ $t('reports.details.dayDetails.table.participant') }}</th>
              <th class="px-6 py-3 font-medium text-center">{{ $t('reports.details.dayDetails.table.duration') }}</th>
              <th class="px-6 py-3 font-medium text-center">{{ $t('reports.details.dayDetails.table.status') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-if="participants.length === 0">
              <td colspan="3" class="px-6 py-8 text-center text-muted-foreground">
                {{ $t('reports.details.dayDetails.noParticipants') }}
              </td>
            </tr>
            <tr v-for="(p, index) in participants" :key="p.name"
              class="hover:bg-muted/5 transition-colors table-row-animate"
              :style="{ animationDelay: `${index * 0.0125}s` }">
              <td class="px-6 py-3 font-medium">{{ p.name }}</td>
              <td class="px-6 py-3 text-center font-mono text-xs">
                {{ formatDuration(p.duration) }}
              </td>
              <td class="px-6 py-3 text-center">
                <div
                  class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium min-w-[3rem]"
                  :class="p.status">
                  {{ p.percentage }}%
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t bg-muted/20 shrink-0 flex justify-between items-center">
        <div class="text-xs text-muted-foreground">
          {{ $t('reports.details.dayDetails.total', { count: participants.length }) }}
        </div>
        <button @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors">
          {{ $t('reports.details.dayDetails.close') }}
        </button>
      </div>
    </div>
  </div>
</template>
