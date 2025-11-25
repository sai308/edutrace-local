<script setup>
import { computed, watch } from 'vue';
import { List, Calendar as CalendarIcon, Users, Clock, ChevronLeft, ChevronRight, ChartBar } from 'lucide-vue-next';
import { format, parseISO } from 'date-fns';
import { useFormatters } from '../../composables/useFormatters';
import { useCalendar } from '../../composables/useCalendar';

const props = defineProps({
    stats: {
        type: Object,
        required: true
    },
    viewMode: {
        type: String,
        default: 'table'
    }
});

const emit = defineEmits(['update:viewMode']);

const localViewMode = computed({
    get: () => props.viewMode,
    set: (value) => emit('update:viewMode', value)
});

const { formatDuration, formatTime, formatDate } = useFormatters();
const { currentMonth, weekDays, nextMonth, prevMonth, generateCalendarDays } = useCalendar();

const sessionDate = computed(() => {
    if (!props.stats.metadata?.date) return null;
    return parseISO(props.stats.metadata.date);
});

watch(sessionDate, (newDate) => {
    if (newDate) {
        currentMonth.value = newDate;
    }
}, { immediate: true });

const calendarDays = computed(() => {
    // We need to adapt generateCalendarDays to match the specific logic here (isSessionDay, participantCount)
    // The composable returns basic day info. We can map over it or pass a custom session map.
    // But here we only have ONE session.

    // Let's use the composable's generator but we need to pass a map or handle the single session logic.
    // The composable expects a sessionsMap. Let's construct a simple one or just map the result.

    // Actually, the composable logic for `generateCalendarDays` is a bit specific to having a map of sessions.
    // Here we have a single session date.
    // Let's see if we can reuse the composable.

    // The composable accepts `sessionsMap` and `sessionDate`.
    // If we pass `null` for map and `sessionDate` for the second arg, it might work if we adjust the composable?
    // Wait, I wrote the composable to accept `sessionsMap` and `sessionDate`.
    // And it sets `isSessionDay` based on `sessionDate`.
    // But `participantCount` logic is specific here.

    // Let's use the composable to get the days, then map to add our specific props.
    const days = generateCalendarDays(null, sessionDate.value);

    return days.map(day => ({
        ...day,
        participantCount: day.isSessionDay ? props.stats.matrix.length : 0
    }));
});

// Timeline calculations for Overview
const timelineData = computed(() => {
    if (!props.stats.metadata?.startTime || !props.stats.metadata?.endTime) {
        return { participants: [], totalDuration: 0, startTime: null, endTime: null };
    }

    const sessionStart = new Date(props.stats.metadata.startTime);
    const sessionEnd = new Date(props.stats.metadata.endTime);
    const totalDuration = (sessionEnd - sessionStart) / 1000; // in seconds

    const participants = props.stats.matrix.map(p => {
        const joinTime = p.joinTime ? new Date(p.joinTime) : sessionStart;
        const offsetSeconds = (joinTime - sessionStart) / 1000;
        const offsetPercent = (offsetSeconds / totalDuration) * 100;
        const durationPercent = (p.totalDuration / totalDuration) * 100;

        return {
            name: p.name,
            joinTime: p.joinTime,
            duration: p.totalDuration,
            offsetPercent: Math.max(0, offsetPercent),
            durationPercent: Math.min(100 - offsetPercent, durationPercent),
            percentage: p.totalPercentage
        };
    });

    return {
        participants,
        totalDuration,
        startTime: sessionStart,
        endTime: sessionEnd
    };
});

function formatTimeHHMM(date) {
    if (!date) return '';
    return format(date, 'HH:mm');
}

</script>

<template>
    <div class="space-y-4">
        <!-- Metadata Section -->
        <div v-if="stats.metadata" class="bg-card rounded-lg border p-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
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

        <!-- View Mode Toggle -->
        <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">{{ $t('reports.session.title') }}</h3>
            <div class="flex bg-muted p-1 rounded-lg">
                <button @click="localViewMode = 'overview'"
                    class="px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize flex items-center gap-2"
                    :class="localViewMode === 'overview' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'">
                    <ChartBar class="w-4 h-4" />
                    {{ $t('views.overview') }}
                </button>
                <button @click="localViewMode = 'table'"
                    class="px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize flex items-center gap-2"
                    :class="localViewMode === 'table' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'">
                    <List class="w-4 h-4" />
                    {{ $t('views.table') }}
                </button>
                <button @click="localViewMode = 'calendar'"
                    class="px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize flex items-center gap-2"
                    :class="localViewMode === 'calendar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'">
                    <CalendarIcon class="w-4 h-4" />
                    {{ $t('views.calendar') }}
                </button>
            </div>
        </div>

        <!-- Overview: Timeline Visualization -->
        <div v-if="localViewMode === 'overview'" class="space-y-4">
            <div class="border rounded-lg p-6">
                <div class="flex items-center justify-between mb-6">
                    <h4 class="text-sm font-semibold text-muted-foreground">{{ $t('reports.session.timeline.title') }}
                    </h4>
                    <div class="text-sm text-muted-foreground">
                        {{ $t('reports.session.timeline.session', {
                            start: formatTimeHHMM(timelineData.startTime), end:
                                formatTimeHHMM(timelineData.endTime)
                        }) }}
                    </div>
                </div>

                <div class="space-y-3">
                    <div v-for="participant in timelineData.participants" :key="participant.name" class="space-y-1">
                        <div class="flex items-center justify-between text-sm">
                            <span class="font-medium">{{ participant.name }}</span>
                            <span class="text-xs text-muted-foreground">
                                {{ formatDuration(participant.duration) }} ({{ participant.percentage }}%)
                            </span>
                        </div>

                        <!-- Timeline Bar -->
                        <div class="relative h-8 bg-muted/30 rounded-lg overflow-hidden">
                            <!-- Time markers (optional grid) -->
                            <div class="absolute inset-0 flex">
                                <div v-for="i in 4" :key="i" class="flex-1 border-r border-muted/50 last:border-r-0">
                                </div>
                            </div>

                            <!-- Participant bar -->
                            <div class="absolute h-full rounded transition-all" :style="{
                                left: `${participant.offsetPercent}%`,
                                width: `${participant.durationPercent}%`,
                                backgroundColor: participant.percentage >= 75 ? '#22c55e' :
                                    participant.percentage >= 50 ? '#eab308' : '#ef4444'
                            }">
                                <div
                                    class="h-full flex items-center justify-center text-xs font-medium text-white px-2">
                                    <span v-if="participant.durationPercent > 15">
                                        {{ formatTime(participant.joinTime) }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Legend -->
                <div class="flex items-center gap-4 mt-6 pt-4 border-t text-xs">
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 rounded bg-green-500"></div>
                        <span class="text-muted-foreground">≥75%</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 rounded bg-yellow-500"></div>
                        <span class="text-muted-foreground">50-74%</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 rounded bg-red-500"></div>
                        <span class="text-muted-foreground">&lt;50%</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Table View -->
        <div v-if="localViewMode === 'table'" class="border rounded-lg overflow-hidden bg-card shadow-sm">
            <div class="overflow-x-auto overflow-y-hidden">
                <table class="w-full text-sm text-left border-collapse">
                    <thead class="bg-muted/50 text-muted-foreground">
                        <tr>
                            <th class="border-b h-12 px-4 font-medium text-left">{{
                                $t('reports.details.table.participant') }}</th>
                            <th class="border-b h-12 px-4 font-medium text-left">{{
                                $t('reports.details.table.group') }}</th>
                            <th class="border-b h-12 px-4 font-medium text-center">{{
                                $t('reports.details.table.firstSeen') }}</th>
                            <th class="border-b h-12 px-4 font-medium text-center">{{
                                $t('reports.details.table.duration') }}</th>
                            <th class="border-b h-12 px-4 font-medium text-center">{{
                                $t('reports.details.table.percentage') }}</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        <tr v-for="(participant, index) in stats.matrix" :key="participant.name"
                            class="hover:bg-muted/50 transition-colors table-row-animate"
                            :style="{ animationDelay: `${index * 0.025}s` }">
                            <td class="p-4 font-medium">{{ participant.name }}</td>
                            <td class="p-4 text-left text-sm text-muted-foreground">{{ participant.groupName || '-' }}
                            </td>
                            <td class="p-4 text-center font-mono text-xs">{{ formatTime(participant.joinTime) }}</td>
                            <td class="p-4 text-center font-mono text-xs">{{ formatDuration(participant.totalDuration)
                            }}
                            </td>
                            <td class="p-4 text-center">
                                <div class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium min-w-[3rem]"
                                    :class="participant.totalPercentage >= 75 ? 'bg-green-100 text-green-800' :
                                        participant.totalPercentage >= 50 ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'">
                                    {{ participant.totalPercentage }}%
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Calendar View -->
        <div v-else-if="localViewMode === 'calendar'" class="space-y-4">
            <!-- Calendar Header -->
            <div class="flex items-center justify-between">
                <h4 class="text-lg font-semibold capitalize">
                    {{ format(currentMonth, 'MMMM yyyy') }}
                </h4>
                <div class="flex items-center gap-1">
                    <button @click="prevMonth" class="p-2 hover:bg-muted rounded-full transition-colors">
                        <ChevronLeft class="w-5 h-5" />
                    </button>
                    <button @click="nextMonth" class="p-2 hover:bg-muted rounded-full transition-colors">
                        <ChevronRight class="w-5 h-5" />
                    </button>
                </div>
            </div>

            <!-- Calendar Grid -->
            <div class="border rounded-lg overflow-hidden">
                <!-- Weekday Headers -->
                <div class="grid grid-cols-7 bg-muted/50 border-b">
                    <div v-for="day in weekDays" :key="day"
                        class="p-3 text-center text-sm font-medium text-muted-foreground">
                        {{ day }}
                    </div>
                </div>

                <!-- Days -->
                <div class="grid grid-cols-7 divide-x divide-y bg-background">
                    <div v-for="day in calendarDays" :key="day.date.toString()"
                        class="min-h-[120px] p-2 transition-colors relative" :class="[
                            !day.isCurrentMonth && 'bg-muted/10 text-muted-foreground',
                            day.isToday && 'bg-primary/5',
                            day.isSessionDay && 'bg-green-50 dark:bg-green-950/20'
                        ]">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full"
                                :class="day.isToday && 'bg-primary text-primary-foreground'">
                                {{ format(day.date, 'd') }}
                            </span>
                        </div>

                        <!-- Session Info -->
                        <div v-if="day.isSessionDay" class="flex flex-col gap-1.5">
                            <!-- Session Badge -->
                            <div class="bg-green-500 text-white text-xs font-medium px-2 py-1 rounded">
                                {{ $t('reports.session.badge') }}
                            </div>

                            <!-- Time Range -->
                            <div v-if="stats.metadata.startTime"
                                class="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock class="w-3 h-3" />
                                {{ formatTime(stats.metadata.startTime) }}
                            </div>

                            <!-- Participants Count -->
                            <div class="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                                <Users class="w-3 h-3" />
                                {{ $t('reports.session.participants', { count: day.participantCount }) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
