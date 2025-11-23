<script setup>
import { useToast } from '../services/toast';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-vue-next';

const { toasts, toast } = useToast();

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle
};

const colors = {
  success: 'bg-green-500 text-white',
  error: 'bg-destructive text-destructive-foreground',
  info: 'bg-blue-500 text-white',
  warning: 'bg-yellow-500 text-white'
};
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
    <TransitionGroup name="toast">
      <div 
        v-for="t in toasts" 
        :key="t.id"
        class="pointer-events-auto flex items-center gap-3 p-4 rounded-lg shadow-lg border transition-all duration-300"
        :class="[colors[t.type] || colors.info]"
      >
        <component :is="icons[t.type] || icons.info" class="w-5 h-5 shrink-0" />
        <p class="text-sm font-medium flex-1">{{ t.message }}</p>
        <button @click="toast.remove(t.id)" class="p-1 hover:bg-black/20 rounded transition-colors">
          <X class="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
