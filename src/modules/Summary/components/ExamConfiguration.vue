<script setup>
import { ref, watch, computed } from 'vue';
import { Plus, Layers } from 'lucide-vue-next';
import ModuleCard from './ModuleCard.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import { summaryService } from '../services/summary.service';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
    group: Object,
    completionThreshold: {
        type: Number,
        default: 70
    },
    attendanceThreshold: {
        type: Number,
        default: 60
    },
    modules: Array
});

const emit = defineEmits(['update:group', 'update:completionThreshold', 'update:attendanceThreshold', 'update:modules', 'delete']);

const attendanceEnabled = ref(true);
const allGroupTasks = ref([]);

// Delete confirmation state
const showDeleteConfirm = ref(false);
const moduleToDelete = ref(null);

// Drag and drop state
const draggedIndex = ref(null);

// Watch for attendance toggle to emit null or value
watch(attendanceEnabled, (enabled) => {
    if (!enabled) {
        emit('update:attendanceThreshold', 0);
    } else {
        emit('update:attendanceThreshold', 60);
    }
});

// Fetch tasks when group changes
watch(() => props.group, async (newGroup) => {
    if (newGroup?.name) {
        allGroupTasks.value = await summaryService.getTasksByGroup(newGroup.name);
    } else {
        allGroupTasks.value = [];
    }
}, { immediate: true });

function getTaskKey(task) {
    if (!task) return '';
    return `${task.name}_${task.date}`;
}

// Compute set of used keys for each module index to exclude
function getBlockedKeysForModule(moduleIndex) {
    const usedKeys = new Set();
    props.modules.forEach((mod, idx) => {
        if (idx === moduleIndex) return; // Skip current module

        if (mod.test) usedKeys.add(getTaskKey(mod.test));
        if (mod.tasks && Array.isArray(mod.tasks)) {
            mod.tasks.forEach(t => usedKeys.add(getTaskKey(t)));
        }
    });
    return usedKeys;
}

function addModule() {
    const newModule = {
        id: Date.now(),
        name: '',
        tasks: [],
        test: null,
        tasksCoefficient: 0.5,
        testCoefficient: 0.5,
        minTasksRequired: 1
    };
    emit('update:modules', [...props.modules, newModule]);
}

function requestRemoveModule(index) {
    moduleToDelete.value = index;
    showDeleteConfirm.value = true;
}

function confirmDelete() {
    if (moduleToDelete.value !== null) {
        const module = props.modules[moduleToDelete.value];
        emit('delete', module);

        // Optimistically update the list for UI responsiveness
        const newModules = [...props.modules];
        newModules.splice(moduleToDelete.value, 1);
        emit('update:modules', newModules);
    }
    showDeleteConfirm.value = false;
    moduleToDelete.value = null;
}

function cancelDelete() {
    showDeleteConfirm.value = false;
    moduleToDelete.value = null;
}

function updateModule(index, updatedModule) {
    const newModules = [...props.modules];
    newModules[index] = updatedModule;
    emit('update:modules', newModules);
}

// Drag and drop handlers
function handleDragStart(index, event) {
    draggedIndex.value = index;
    event.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

function handleDrop(targetIndex, event) {
    event.preventDefault();

    if (draggedIndex.value === null || draggedIndex.value === targetIndex) {
        draggedIndex.value = null;
        return;
    }

    const newModules = [...props.modules];
    const [draggedModule] = newModules.splice(draggedIndex.value, 1);
    newModules.splice(targetIndex, 0, draggedModule);

    emit('update:modules', newModules);
    draggedIndex.value = null;
}

function handleDragEnd() {
    draggedIndex.value = null;
}
</script>

<template>
    <div class="space-y-8">
        <!-- Modules Configuration -->
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold flex items-center gap-2">
                    <Layers class="w-5 h-5" />
                    {{ $t('summary.modules.title') }}
                </h3>
                <button @click="addModule" :disabled="!group"
                    class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2">
                    <Plus class="w-4 h-4 mr-2" />
                    {{ $t('summary.modules.add') }}
                </button>
            </div>

            <div class="grid grid-cols-1 gap-4">
                <div v-for="(module, index) in modules" :key="module.id" class="transition-all duration-200"
                    :class="{ 'border-2 border-primary border-dashed rounded-lg': draggedIndex !== null && draggedIndex !== index }"
                    @dragover="handleDragOver" @drop="handleDrop(index, $event)">
                    <ModuleCard :model-value="module" :index="index" :all-tasks="allGroupTasks"
                        :blocked-keys="getBlockedKeysForModule(index)" @update:model-value="updateModule(index, $event)"
                        @remove="requestRemoveModule(index)" @drag-start="handleDragStart(index, $event)"
                        @drag-end="handleDragEnd" />
                </div>
                <div v-if="!group" class="text-center py-8 border rounded-lg border-dashed text-muted-foreground">
                    {{ $t('summary.modules.selectGroupHint') }}
                </div>
                <div v-else-if="modules.length === 0"
                    class="text-center py-8 border rounded-lg border-dashed text-muted-foreground">
                    {{ $t('summary.modules.emptyHint') }}
                </div>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <ConfirmModal :is-open="showDeleteConfirm" :title="$t('summary.modules.deleteConfirmTitle')"
            :message="$t('summary.modules.deleteConfirmMessage')" :confirm-text="$t('confirm.confirm')"
            :cancel-text="$t('confirm.cancel')" variant="danger" @confirm="confirmDelete" @cancel="cancelDelete" />
    </div>
</template>
