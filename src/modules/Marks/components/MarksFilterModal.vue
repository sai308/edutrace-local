<script setup>
import { ref, watch } from 'vue';
import { X, Calendar } from 'lucide-vue-next';

const props = defineProps({
    isOpen: Boolean,
    groups: {
        type: Array,
        default: () => []
    },
    filters: {
        type: Object,
        default: () => ({
            synced: 'all', // 'all', 'unsynced'
            dateFrom: '',
            group: null,
            hideFailed: false
        })
    }
});

const emit = defineEmits(['close', 'apply']);

import { useModalClose } from '@/composables/useModalClose';

useModalClose(() => {
    if (props.isOpen) {
        emit('close');
    }
});


const localFilters = ref({ ...props.filters });

watch(() => props.isOpen, (newVal) => {
    if (newVal) {
        localFilters.value = { ...props.filters };
    }
});

const dateInput = ref(null);

function handleDateClick() {
    // Ensure browser supports the showPicker() method
    if (dateInput.value && typeof dateInput.value.showPicker === 'function') {
        dateInput.value.showPicker();
    }
}

function apply() {
    emit('apply', { ...localFilters.value });
    emit('close');
}

function clear() {
    localFilters.value = {
        synced: 'all',
        dateFrom: '',
        group: null,
        hideFailed: false
    };
}
</script>

<template>
    <div v-if="isOpen"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm !-mt-6 p-4 animate-in fade-in duration-200">
        <div
            class="bg-card w-full max-w-md rounded-lg shadow-lg border flex flex-col animate-in zoom-in-95 duration-200">
            <!-- Header -->
            <div class="p-4 border-b flex items-center justify-between">
                <h3 class="text-lg font-bold">{{ $t('marks.filterModal.title') }}</h3>
                <button @click="$emit('close')" class="p-2 hover:bg-muted rounded-full transition-colors">
                    <X class="w-5 h-5" />
                </button>
            </div>

            <!-- Content -->
            <div class="p-6 space-y-6">
                <!-- Group Filter -->
                <div class="space-y-2">
                    <label class="text-sm font-medium">{{ $t('marks.filterModal.group') }}</label>
                    <select v-model="localFilters.group"
                        class="w-full p-2 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                        <option :value="null">{{ $t('marks.filterModal.allGroups') }}</option>
                        <option v-for="g in groups" :key="g.id" :value="g.name">{{ g.name }}</option>
                    </select>
                </div>

                <!-- Synced Status -->
                <div class="space-y-2">
                    <label class="text-sm font-medium">{{ $t('marks.filterModal.status') }}</label>
                    <div class="flex items-center gap-4">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="radio" v-model="localFilters.synced" value="all" class="accent-primary" />
                            <span class="text-sm">{{ $t('marks.filterModal.all') }}</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="radio" v-model="localFilters.synced" value="unsynced" class="accent-primary" />
                            <span class="text-sm">{{ $t('marks.filterModal.unsynced') }}</span>
                        </label>
                    </div>
                </div>

                <!-- Hide Failed Grades -->
                <div class="space-y-2">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" v-model="localFilters.hideFailed"
                            class="rounded border-gray-300 text-primary focus:ring-primary" />
                        <span class="text-sm font-medium">{{ $t('marks.filterModal.hideFailed') }}</span>
                    </label>
                </div>

                <!-- Date From -->
                <div class="space-y-2">
                    <label for="DateFromFilter" class="text-sm font-medium">{{ $t('marks.filterModal.dateFrom')
                        }}</label>
                    <div class="relative">
                        <Calendar class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input name="DateFromFilter" ref="dateInput" @click="handleDateClick"
                            v-model="localFilters.dateFrom" type="date"
                            class="w-full pl-9 pr-4 py-2 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="p-4 border-t bg-muted/10 flex justify-between items-center">
                <button @click="clear" class="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {{ $t('marks.filterModal.reset') }}
                </button>
                <div class="flex gap-2">
                    <button @click="$emit('close')"
                        class="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors">
                        {{ $t('marks.filterModal.cancel') }}
                    </button>
                    <button @click="apply"
                        class="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors">
                        {{ $t('marks.filterModal.apply') }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style>
::-webkit-calendar-picker-indicator {
    filter: opacity(0)
}
</style>