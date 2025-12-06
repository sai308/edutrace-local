<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ArrowLeft, List, Calendar as CalendarIcon, ChartBar } from 'lucide-vue-next';
import { useReportDetails } from '../composables/useReportDetails';
import ReportOverviewView from '../views/ReportOverviewView.vue';
import ReportTableView from '../views/ReportTableView.vue';
import ReportCalendarView from '../views/ReportCalendarView.vue';
import { useFormatters } from '@/composables/useFormatters';

const router = useRouter();
const route = useRoute();

const props = defineProps({
    id: {
        type: String,
        required: true
    }
});

const { stats, loading, loadDetails } = useReportDetails(props.id);
const { formatDate } = useFormatters();

// View mode state with query param sync
const viewMode = ref(route.query.view || 'table');

// Sync viewMode with URL query params
watch(viewMode, (newView) => {
    router.replace({ query: { ...route.query, view: newView } });
});

// Initialize from query params
watch(() => route.query.view, (newView) => {
    if (newView && newView !== viewMode.value) {
        viewMode.value = newView;
    }
}, { immediate: true });

onMounted(() => {
    loadDetails();
});

function handleBack() {
    router.push({ name: 'Reports' });
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
                    <h2 class="text-2xl font-bold tracking-tight">{{ $t('reports.session.title') }}</h2>
                    <div v-if="stats?.metadata"
                        class="flex flex-wrap items-center md:gap-x-16 gap-x-4 text-muted-foreground">
                        <span>{{ stats.metadata.meetId }}</span>
                        <span>{{ formatDate(stats.metadata.date) }}</span>
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

        <!-- Metadata Section -->
        <div v-if="stats?.metadata" class="bg-card rounded-lg border p-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
                <div class="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">{{
                    $t('reports.session.metadata.date') }}</div>
                <div class="font-medium">{{ formatDate(stats.metadata.date) }}</div>
            </div>
            <div>
                <div class="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">{{
                    $t('reports.session.metadata.filename') }}</div>
                <div class="font-medium truncate" :title="stats.metadata.filename">{{ stats.metadata.filename }}</div>
            </div>
            <div>
                <div class="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">{{
                    $t('reports.session.metadata.uploaded') }}</div>
                <div class="font-medium">{{ new Date(stats.metadata.uploadedAt).toLocaleString() }}</div>
            </div>
            <div>
                <div class="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">{{
                    $t('reports.session.metadata.code') }}</div>
                <div class="font-medium">{{ stats.metadata.meetId }}</div>
            </div>
            <div>
                <div class="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">{{
                    $t('reports.session.metadata.timeRange') }}</div>
                <div class="font-medium">
                    {{ stats.metadata.startTime ? new Date(stats.metadata.startTime).toLocaleTimeString() : '-' }} -
                    {{ stats.metadata.endTime ? new Date(stats.metadata.endTime).toLocaleTimeString() : '-' }}
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>

        <!-- Views -->
        <div v-else-if="stats" class="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ReportOverviewView v-if="viewMode === 'overview'" :stats="stats" />
            <ReportTableView v-else-if="viewMode === 'table'" :stats="stats" />
            <ReportCalendarView v-else-if="viewMode === 'calendar'" :stats="stats" />
        </div>

        <!-- No Data State -->
        <div v-else class="text-center py-12 text-muted-foreground">
            Report not found.
        </div>
    </div>
</template>
