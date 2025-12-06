<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, List, Calendar as CalendarIcon, ChartBar } from 'lucide-vue-next';
import { useAnalyticsDetails } from '../composables/useAnalyticsDetails';
import AnalyticsOverviewView from '../views/AnalyticsOverviewView.vue';
import AnalyticsTableView from '../views/AnalyticsTableView.vue';
import AnalyticsCalendarView from '../views/AnalyticsCalendarView.vue';

const route = useRoute();
const router = useRouter();

const props = defineProps({
    id: {
        type: String,
        required: true
    }
});

// View mode state management with URL sync
const viewMode = ref(route.query.view || 'overview');

watch(() => route.query.view, (newView) => {
    if (newView && newView !== viewMode.value) {
        viewMode.value = newView;
    }
});

watch(viewMode, (newMode) => {
    if (route.query.view !== newMode) {
        router.replace({ query: { ...route.query, view: newMode } });
    }
});

// Data fetching
const { stats, loading, loadDetails } = useAnalyticsDetails(props.id);

onMounted(() => {
    loadDetails();
});

function handleBack() {
    router.push({ name: 'Analytics' });
}
</script>

<template>
    <div class="container mx-auto p-6 space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                <button @click="handleBack" class="p-2 hover:bg-muted rounded-full transition-colors"
                    :title="$t('common.back')">
                    <ArrowLeft class="w-5 h-5" />
                </button>
                <div>
                    <h2 class="text-2xl font-bold tracking-tight">{{ $t('analytics.details.title') }}</h2>
                    <div class="flex flex-wrap items-center md:gap-x-16 gap-x-4 text-muted-foreground">
                        <span>{{ id }}</span>
                    </div>
                </div>
            </div>

            <!-- View Switcher -->
            <div v-if="stats" class="flex items-center gap-2 bg-muted/30 p-1 rounded-lg">
                <button @click="viewMode = 'overview'"
                    class="flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm font-medium"
                    :class="viewMode === 'overview' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'">
                    <ChartBar class="w-4 h-4" />
                    {{ $t('views.overview') }}
                </button>
                <button @click="viewMode = 'table'"
                    class="flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm font-medium"
                    :class="viewMode === 'table' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'">
                    <List class="w-4 h-4" />
                    {{ $t('views.table') }}
                </button>
                <button @click="viewMode = 'calendar'"
                    class="flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm font-medium"
                    :class="viewMode === 'calendar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'">
                    <CalendarIcon class="w-4 h-4" />
                    {{ $t('views.calendar') }}
                </button>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>

        <!-- Views -->
        <div v-else-if="stats" class="space-y-4">
            <AnalyticsOverviewView v-if="viewMode === 'overview'" :stats="stats" />
            <AnalyticsTableView v-else-if="viewMode === 'table'" :stats="stats" />
            <AnalyticsCalendarView v-else-if="viewMode === 'calendar'" :stats="stats" :id="id" />
        </div>

        <!-- No Data State -->
        <div v-else class="text-center py-12 text-muted-foreground">
            {{ $t('analytics.details.noData') }}
        </div>
    </div>
</template>
