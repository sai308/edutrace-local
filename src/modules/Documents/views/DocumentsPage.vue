<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { Users, BookDashed } from 'lucide-vue-next';
import DocumentsList from '../components/DocumentsList.vue';
import CustomSelect from '@/components/CustomSelect.vue';
import { summaryService } from '@/modules/Summary/services/summary.service';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const availableGroups = ref([]);
const selectedGroup = ref(null);
const assessmentType = ref('examination');

const assessmentTypeOptions = computed(() => [
    { value: 'examination', label: t('summary.types.examination') },
    { value: 'credit', label: t('summary.types.credit') }
]);

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

    const typeQuery = route.query.assessmentType;
    if (typeQuery && ['examination', 'credit'].includes(typeQuery)) {
        assessmentType.value = typeQuery;
    }
});

watch(selectedGroup, (newGroup) => {
    if (newGroup?.name) {
        router.replace({ query: { ...route.query, group: newGroup.name } });
    }
});

watch(assessmentType, (newType) => {
    router.replace({ query: { ...route.query, assessmentType: newType } });
});

</script>

<template>
    <div class="container mx-auto p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <!-- Header -->
        <div class="flex flex-col gap-2">
            <h1 class="text-3xl font-bold tracking-tight">{{ $t('nav.documents') }}</h1>
            <p class="text-muted-foreground">{{ $t('documents.description') }}</p>
        </div>

        <!-- Filters Row -->
        <div class="flex flex-wrap items-end gap-4 p-4 border rounded-lg bg-card">
            <!-- Group Picker -->
            <div class="flex-1 min-w-[200px]">
                <CustomSelect v-model="selectedGroup" :options="availableGroups" display-key="name"
                    :placeholder="$t('summary.selectGroup')">
                    <template #label>
                        <Users class="w-4 h-4" />
                        {{ $t('summary.targetGroup') }}
                    </template>
                </CustomSelect>
            </div>

            <!-- Assessment Type Picker -->
            <div class="flex-1 min-w-[200px]">
                <CustomSelect v-model="assessmentType" :options="assessmentTypeOptions" display-key="label"
                    value-key="value">
                    <template #label>
                        <BookDashed class="w-4 h-4" />
                        {{ $t('summary.assessmentType') }}
                    </template>
                </CustomSelect>
            </div>
        </div>

        <!-- Documents List -->
        <DocumentsList :group="selectedGroup" :assessment-type="assessmentType" />
    </div>
</template>
