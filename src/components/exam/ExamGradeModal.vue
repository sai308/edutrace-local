<script setup>
import { ref, watch } from 'vue';
import { X } from 'lucide-vue-next';
import { useModalClose } from '../../composables/useModalClose';

const props = defineProps({
    isOpen: Boolean,
    initialGrade: {
        type: [Number, String],
        default: ''
    }
});

const emit = defineEmits(['close', 'save']);

const grade = ref('');

watch(() => props.isOpen, (newVal) => {
    if (newVal) {
        grade.value = props.initialGrade || '';
    }
});

useModalClose(() => {
    if (props.isOpen) {
        emit('close');
    }
});

function handleSave() {
    emit('save', Number(grade.value));
    emit('close');
}
</script>

<template>
    <div v-if="isOpen"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm !-mt-6 p-4">
        <div
            class="bg-card w-full max-w-sm rounded-lg shadow-lg border p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-bold">{{ $t('summary.modal.title') }}</h3>
                <button @click="emit('close')" class="p-1 hover:bg-muted rounded-md transition-colors">
                    <X class="w-4 h-4" />
                </button>
            </div>

            <div class="space-y-2">
                <label class="text-sm font-medium">{{ $t('summary.modal.grade') }}</label>
                <input v-model="grade" type="number" min="0" max="100" :placeholder="$t('summary.modal.placeholder')"
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    @keydown.enter="handleSave" />
            </div>

            <div class="flex justify-end gap-2 pt-2">
                <button @click="emit('close')"
                    class="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors">
                    {{ $t('common.cancel') }}
                </button>
                <button @click="handleSave"
                    class="px-4 py-2 text-sm font-medium rounded-md transition-colors text-white bg-primary hover:bg-primary/90">
                    {{ $t('common.save') }}
                </button>
            </div>
        </div>
    </div>
</template>
