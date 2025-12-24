<script setup>
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { X, Copy } from 'lucide-vue-next';
import { summaryService } from '../services/summary.service';

const { t } = useI18n();

const props = defineProps({
    isOpen: {
        type: Boolean,
        required: true
    },
    currentGroup: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['close', 'copy']);

const groups = ref([]);
const selectedGroup = ref(null);
const loading = ref(false);

const groupsWithModules = computed(() => {
    return groups.value
        .filter(g => g.name !== props.currentGroup?.name) // Exclude current group
        .filter(g => g.moduleCount > 0) // Only groups with modules
        .sort((a, b) => a.name.localeCompare(b.name));
});

onMounted(async () => {
    await loadGroups();
});

async function loadGroups() {
    loading.value = true;
    try {
        const allGroups = await summaryService.getGroups();
        
        // Fetch module counts for each group
        const groupsWithCounts = await Promise.all(
            allGroups.map(async (group) => {
                const modules = await summaryService.getModulesByGroup(group.name);
                return {
                    ...group,
                    moduleCount: modules.length
                };
            })
        );
        
        groups.value = groupsWithCounts;
    } catch (error) {
        console.error('Failed to load groups:', error);
    } finally {
        loading.value = false;
    }
}

function handleCopy() {
    if (selectedGroup.value) {
        emit('copy', selectedGroup.value);
        emit('close');
    }
}

function handleClose() {
    selectedGroup.value = null;
    emit('close');
}
</script>

<template>
    <Teleport to="body">
        <Transition name="modal">
            <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                @click.self="handleClose">
                <div class="bg-background border rounded-lg shadow-lg max-w-md w-full max-h-[80vh] flex flex-col"
                    @click.stop>
                    <!-- Header -->
                    <div class="flex items-center justify-between p-4 border-b">
                        <h2 class="text-lg font-semibold">{{ $t('summary.modules.copyModal.title') }}</h2>
                        <button @click="handleClose"
                            class="p-1 hover:bg-muted rounded-md transition-colors">
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <!-- Content -->
                    <div class="flex-1 overflow-y-auto p-4">
                        <p class="text-sm text-muted-foreground mb-4">
                            {{ $t('summary.modules.copyModal.selectGroup') }}
                        </p>

                        <div v-if="loading" class="text-center py-8 text-muted-foreground">
                            {{ $t('loader.loading') }}
                        </div>

                        <div v-else-if="groupsWithModules.length === 0" class="text-center py-8 text-muted-foreground">
                            {{ $t('summary.modules.copyModal.noGroups') }}
                        </div>

                        <div v-else class="space-y-2">
                            <button v-for="group in groupsWithModules" :key="group.name" @click="selectedGroup = group"
                                class="w-full flex items-center justify-between p-3 border rounded-lg transition-colors hover:bg-muted"
                                :class="selectedGroup?.name === group.name ? 'border-primary bg-primary/5' : 'border-border'">
                                <span class="font-medium">{{ group.name }}</span>
                                <span
                                    class="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                                    {{ $t('summary.modules.copyModal.modulesCount', { count: group.moduleCount }, group.moduleCount) }}
                                </span>
                            </button>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="flex items-center justify-end gap-2 p-4 border-t">
                        <button @click="handleClose"
                            class="px-4 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors">
                            {{ $t('summary.modules.copyModal.cancel') }}
                        </button>
                        <button @click="handleCopy" :disabled="!selectedGroup"
                            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none">
                            <Copy class="w-4 h-4" />
                            {{ $t('summary.modules.copyModal.copy') }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}

.modal-enter-active .bg-background,
.modal-leave-active .bg-background {
    transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from .bg-background,
.modal-leave-to .bg-background {
    transform: scale(0.95);
    opacity: 0;
}
</style>
