<script setup>
import { computed, ref, nextTick } from 'vue';
import { Trash2, X, GripVertical } from 'lucide-vue-next';

const props = defineProps({
    modelValue: {
        type: Object,
        required: true
    },
    index: {
        type: Number,
        required: true
    },
    allTasks: {
        type: Array,
        default: () => []
    },
    blockedKeys: {
        type: Set,
        default: () => new Set()
    }
});

const emit = defineEmits(['update:modelValue', 'remove', 'drag-start', 'drag-end']);

const isDragging = ref(false);

function handleDragStart(event) {
    isDragging.value = true;
    emit('drag-start', event);
}

function handleDragEnd(event) {
    isDragging.value = false;
    emit('drag-end', event);
}

function updateModel(updates) {
    emit('update:modelValue', { ...props.modelValue, ...updates });
}

// Proxies for direct inputs
const moduleName = computed({
    get: () => props.modelValue.name,
    set: (val) => updateModel({ name: val })
});

const testCoefficient = computed({
    get: () => props.modelValue.testCoefficient,
    set: (val) => updateModel({ testCoefficient: val })
});

const tasksCoefficient = computed({
    get: () => props.modelValue.tasksCoefficient,
    set: (val) => updateModel({ tasksCoefficient: val })
});

const minTasksRequired = computed({
    get: () => props.modelValue.minTasksRequired || 1,
    set: (val) => updateModel({ minTasksRequired: val })
});

// Helper to get task key
function getTaskKey(task) {
    if (!task) return '';
    return `${task.name}_${task.date}`;
}

// Helper to format task for display
function formatTask(task) {
    if (!task) return '';
    if (typeof task === 'string') return task; // Legacy fallback
    return task.name;
}

// --- Tasks Logic ---
const taskSearch = ref('');
const showTaskResults = ref(false);
const taskInput = ref(null);

const availableTasksForList = computed(() => {
    // Filter out tasks that are:
    // 1. Blocked globally (used in other modules)
    // 2. Used as the Test in this module
    // 3. Already in the tasks list of this module
    const currentTestKey = props.modelValue.test ? getTaskKey(props.modelValue.test) : '';
    const currentTaskKeys = new Set(props.modelValue.tasks.map(t => getTaskKey(t)));

    return props.allTasks.filter(t => {
        const key = getTaskKey(t);
        if (props.blockedKeys.has(key)) return false;
        if (key === currentTestKey) return false;
        if (currentTaskKeys.has(key)) return false;
        return true;
    });
});

const filteredTasks = computed(() => {
    const search = taskSearch.value.toLowerCase();
    return availableTasksForList.value.filter(t =>
        formatTask(t).toLowerCase().includes(search)
    );
});

function removeTask(task) {
    const keyToRemove = getTaskKey(task);
    const newTasks = props.modelValue.tasks.filter(t => getTaskKey(t) !== keyToRemove);
    updateModel({ tasks: newTasks });
}

function addTask(task) {
    if (task) {
        const newTasks = [...props.modelValue.tasks, task];
        updateModel({ tasks: newTasks });
    }
    taskSearch.value = '';
    nextTick(() => taskInput.value?.focus());
}

function handleTaskInputKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredTasks.value.length > 0) {
            addTask(filteredTasks.value[0]);
        }
    }
}

function hideTaskResults() {
    setTimeout(() => { showTaskResults.value = false; }, 200);
}

// --- Test Picker Logic ---
const testSearch = ref('');
const showTestResults = ref(false);

const availableTasksForTest = computed(() => {
    // Filter out tasks that are:
    // 1. Blocked globally
    // 2. Used in the tasks list of this module
    const currentTaskKeys = new Set(props.modelValue.tasks.map(t => getTaskKey(t)));

    return props.allTasks.filter(t => {
        const key = getTaskKey(t);
        if (props.blockedKeys.has(key)) return false;
        if (currentTaskKeys.has(key)) return false;
        return true;
    });
});

const filteredTests = computed(() => {
    const search = testSearch.value.toLowerCase();
    return availableTasksForTest.value.filter(t =>
        formatTask(t).toLowerCase().includes(search)
    );
});

// Display value for the test input
const testDisplayValue = computed(() => {
    if (showTestResults.value) return testSearch.value;
    return props.modelValue.test ? formatTask(props.modelValue.test) : testSearch.value;
});

function selectTest(test) {
    updateModel({ test: test });
    testSearch.value = '';
    showTestResults.value = false;
}

function hideTestResults() {
    setTimeout(() => { showTestResults.value = false; }, 200);
}
</script>

<template>
    <div class="p-4 border rounded-xl bg-card text-card-foreground shadow-sm hover:shadow-md transition-all duration-200 relative group"
        :class="{ 'opacity-50 scale-95': isDragging }">
        <!-- Drag Handle (Top Left) -->
        <div class="absolute top-3 left-3 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
            draggable="true" @dragstart="handleDragStart" @dragend="handleDragEnd">
            <GripVertical class="w-5 h-5 text-muted-foreground" />
        </div>

        <!-- Delete Button (Top Right) -->
        <button @click="$emit('remove')"
            class="absolute top-3 right-3 h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
            :title="$t('summary.modules.card.remove')">
            <Trash2 class="w-4 h-4" />
        </button>

        <div class="flex flex-col lg:flex-row gap-4 items-stretch pt-8">

            <div class="flex items-center justify-center min-w-[44px]">
                <div
                    class="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    #{{ index + 1 }}
                </div>
            </div>

            <div class="flex flex-col gap-4 flex-[2] min-w-[220px]">
                <div class="space-y-2">
                    <label class="text-xs font-semibold tracking-wide text-muted-foreground">{{
                        $t('summary.modules.card.name') }}</label>
                    <input v-model="moduleName" type="text" placeholder="e.g. Theoretical"
                        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>

                <div class="space-y-2 relative">
                    <label class="text-xs font-semibold tracking-wide text-muted-foreground">{{
                        $t('summary.modules.card.testTask') }}</label>
                    <div class="relative">
                        <input :value="testDisplayValue"
                            @input="e => { testSearch = e.target.value; if (!showTestResults) updateModel({ test: null }); }"
                            @focus="showTestResults = true" @blur="hideTestResults" type="text"
                            :placeholder="$t('summary.modules.card.selectTest')"
                            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />

                        <div v-if="showTestResults && filteredTests.length > 0"
                            class="absolute top-full left-0 mt-1 w-full bg-popover border rounded-md shadow-md z-20 max-h-48 overflow-y-auto">
                            <div v-for="test in filteredTests" :key="getTaskKey(test)" @click="selectTest(test)"
                                class="px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors">
                                {{ formatTask(test) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex flex-col flex-[3] min-w-[280px]">
                <label class="text-xs font-semibold tracking-wide text-muted-foreground mb-2">{{
                    $t('summary.modules.card.tasks') }}</label>
                <div
                    class="flex-1 flex flex-col gap-2 p-2 border rounded-md bg-transparent focus-within:ring-1 focus-within:ring-ring relative min-h-[80px]">

                    <span v-for="task in props.modelValue.tasks" :key="getTaskKey(task)"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground w-fit transition-all hover:bg-secondary/80">
                        {{ formatTask(task) }}
                        <button @click.stop="removeTask(task)"
                            class="hover:text-destructive transition-colors focus:outline-none">
                            <X class="w-3.5 h-3.5" />
                        </button>
                    </span>

                    <div class="relative w-full">
                        <input ref="taskInput" v-model="taskSearch" @focus="showTaskResults = true"
                            @blur="hideTaskResults" @keydown="handleTaskInputKeydown" type="text"
                            :placeholder="$t('summary.modules.card.addTask')"
                            class="w-full bg-transparent text-sm outline-none h-7 px-1 placeholder:text-muted-foreground/70" />

                        <div v-if="showTaskResults && filteredTasks.length > 0"
                            class="absolute top-full left-0 mt-2 w-full min-w-[180px] bg-popover border rounded-md shadow-md z-20 max-h-48 overflow-y-auto">
                            <div v-for="task in filteredTasks" :key="getTaskKey(task)"
                                @mousedown.prevent="addTask(task)"
                                class="px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors">
                                {{ formatTask(task) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex flex-col gap-4 w-full lg:w-[110px]">
                <div class="space-y-2">
                    <label class="text-xs font-semibold  tracking-wide text-muted-foreground">{{
                        $t('summary.modules.card.testCoeff') }}</label>
                    <input v-model.number="testCoefficient" type="number" step="0.1" min="0.1" max="1.0"
                        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>

                <div class="space-y-2">
                    <label class="text-xs font-semibold  tracking-wide text-muted-foreground">{{
                        $t('summary.modules.card.tasksCoeff') }}</label>
                    <input v-model.number="tasksCoefficient" type="number" step="0.1" min="0.1" max="1.0"
                        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>

                <div class="space-y-2">
                    <label class="text-xs font-semibold  tracking-wide text-muted-foreground">{{
                        $t('summary.modules.card.minTasks') }}</label>
                    <input v-model.number="minTasksRequired" type="number" step="1" min="1"
                        :max="modelValue.tasks.length || 1"
                        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>
            </div>

        </div>
    </div>
</template>