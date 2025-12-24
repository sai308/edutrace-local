<script setup>
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { Users } from 'lucide-vue-next';
import { serializeModule } from '../../Summary/services/examSerialization';
import ExamConfiguration from '../../Summary/components/ExamConfiguration.vue';
import CustomSelect from '@/components/CustomSelect.vue';
import { summaryService } from '../../Summary/services/summary.service';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const availableGroups = ref([]);
const selectedGroup = ref(null);
const completionThreshold = ref(70);
const attendanceThreshold = ref(60);
const modules = ref([]);

let saveTimeout = null;

onMounted(async () => {
    availableGroups.value = (await summaryService.getGroups()).sort((a, b) => a.name.localeCompare(b.name));

    const groupQuery = route.query.group;
    if (groupQuery && availableGroups.value.length > 0) {
        const matchedGroup = availableGroups.value.find(g => g.name === groupQuery);
        if (matchedGroup) {
            selectedGroup.value = matchedGroup;
        } else if (availableGroups.value.length > 0) {
            selectedGroup.value = availableGroups.value[0];
        }
    } else if (availableGroups.value.length > 0) {
        selectedGroup.value = availableGroups.value[0];
    }

    const savedSettings = await summaryService.getExamSettings();
    if (savedSettings) {
        if (savedSettings.completionThreshold !== undefined) completionThreshold.value = savedSettings.completionThreshold;
        if (savedSettings.attendanceThreshold !== undefined) attendanceThreshold.value = savedSettings.attendanceThreshold;
    }
});

watch(selectedGroup, (newGroup) => {
    if (newGroup?.name) {
        router.replace({ query: { ...route.query, group: newGroup.name } });
    }
});

watch(selectedGroup, async (newGroup) => {
    if (newGroup?.name) {
        const groupModules = await summaryService.getModulesByGroup(newGroup.name);
        modules.value = groupModules;
    } else {
        modules.value = [];
    }
}, { immediate: true });

watch(modules, async (newModules) => {
    if (!selectedGroup.value?.name) return;

    if (saveTimeout) clearTimeout(saveTimeout);

    saveTimeout = setTimeout(async () => {
        for (const module of newModules) {
            try {
                const plainModule = serializeModule(module, selectedGroup.value);
                await summaryService.saveModule(plainModule);
            } catch (error) {
                console.error('Failed to save module:', error, module);
            }
        }
    }, 500);
}, { deep: true });

async function handleDeleteModule(module) {
    if (module && module.id) {
        await summaryService.deleteModule(module.id);
    }
}

</script>

<template>
    <div class="container mx-auto p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <!-- Header -->
        <div class="flex flex-col gap-2">
            <h1 class="text-3xl font-bold tracking-tight">{{ $t('modules.title') }}</h1>
            <p class="text-muted-foreground">{{ $t('modules.description') }}</p>
        </div>

        <!-- Group Selector -->
        <div class="flex flex-wrap items-end gap-4 p-4 border rounded-lg bg-card">
            <div class="flex-1 min-w-[200px]">
                <CustomSelect v-model="selectedGroup" :options="availableGroups" display-key="name"
                    :placeholder="$t('summary.selectGroup')">
                    <template #label>
                        <Users class="w-4 h-4" />
                        {{ $t('summary.targetGroup') }}
                    </template>
                </CustomSelect>
            </div>
        </div>

        <!-- Modules Configuration -->
        <ExamConfiguration :group="selectedGroup"
            v-model:completion-threshold="completionThreshold" v-model:attendance-threshold="attendanceThreshold"
            v-model:modules="modules" @delete="handleDeleteModule" />
    </div>
</template>
