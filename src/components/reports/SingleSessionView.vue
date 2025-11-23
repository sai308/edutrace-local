<script setup>
import { computed, ref } from 'vue';
import { List, Calendar as CalendarIcon, Users, Clock, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import {
    startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
    format, addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO
} from 'date-fns';

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

const currentMonth = ref(new Date());

const sessionDate = computed(() => {
    if (!props.stats.metadata?.date) return null;
    return parseISO(props.stats.metadata.date);
});

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const calendarDays = computed(() => {
    const start = startOfWeek(startOfMonth(currentMonth.value));
    const end = endOfWeek(endOfMonth(currentMonth.value));

    return eachDayOfInterval({ start, end }).map(date => {
        const isSessionDay = sessionDate.value && isSameDay(date, sessionDate.value);

        return {
            date,
            dateStr: format(date, 'yyyy-MM-dd'),
            isCurrentMonth: isSameMonth(date, currentMonth.value),
            isToday: isToday(date),
            isSessionDay,
            participantCount: isSessionDay ? props.stats.matrix.length : 0
        };
    });
});

function formatDuration(seconds) {
    if (!seconds) return '-';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function formatTime(timeStr) {
    if (!timeStr) return '-';
    try {
        return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return timeStr;
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (e) {
        return dateStr;
    }
}

function nextMonth() {
    currentMonth.value = addMonths(currentMonth.value, 1);
}

function prevMonth() {
    currentMonth.value = subMonths(currentMonth.value, 1);
}

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
                <div class="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">Session Date</div>
                <div class="font-medium">{{ formatDate(stats.metadata.date) }}</div>
            </div>
            <div>
                <div class="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">Filename</div>
                <div class="font-medium truncate" :title="stats.metadata.filename">{{ stats.metadata.filename }}</div>
            </div>
            <div>
                <div class="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">Uploaded At</div>
                <div class="font-medium">{{ new Date(stats.metadata.uploadedAt).toLocaleString() }}</div>
            </div>
            <div>
                <div class="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">Meeting Code</div>
                <div class="font-medium">{{ stats.metadata.meetId }}</div>
            </div>
            <div>
                <div class="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">Time Range</div>
                <div class="font-medium">
                    {{ stats.metadata.startTime ? new Date(stats.metadata.startTime).toLocaleTimeString() : '-' }} -
                    {{ stats.metadata.endTime ? new Date(stats.metadata.endTime).toLocaleTimeString() : '-' }}
                </div>
            </div>
        </div>

        <!-- View Mode Toggle -->
        <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Session Details</h3>
            <div class="flex bg-muted p-1 rounded-lg">
                <button @click="localViewMode = 'overview'"
                    class="px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize flex items-center gap-2"
                    :class="localViewMode === 'overview' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'">
                    <Clock class="w-4 h-4" />
                    Overview
                </button>
                <button @click="localViewMode = 'table'"
                    class="px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize flex items-center gap-2"
                    :class="localViewMode === 'table' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'">
                    <List class="w-4 h-4" />
                    Table
                </button>
                <button @click="localViewMode = 'calendar'"
                    class="px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize flex items-center gap-2"
                    :class="localViewMode === 'calendar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'">
                    <CalendarIcon class="w-4 h-4" />
                    Calendar
                </button>
            </div>
        </div>

        <!-- Overview: Timeline Visualization -->
        <div v-if="localViewMode === 'overview'" class="space-y-4">
            <div class="border rounded-lg p-6">
                <div class="flex items-center justify-between mb-6">
                    <h4 class="text-sm font-semibold text-muted-foreground">PARTICIPANT TIMELINE</h4>
                    <div class="text-sm text-muted-foreground">
                        Session: {{ formatTimeHHMM(timelineData.startTime) }} - {{ formatTimeHHMM(timelineData.endTime)
                        }}
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
                            <th class="border-b h-12 px-4 font-medium text-left">Participant</th>
                            <th class="border-b h-12 px-4 font-medium text-center">First Seen At</th>
                            <th class="border-b h-12 px-4 font-medium text-center">Duration</th>
                            <th class="border-b h-12 px-4 font-medium text-center">Percentage</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        <tr v-for="(participant, index) in stats.matrix" :key="participant.name"
                            class="hover:bg-muted/50 transition-colors table-row-animate"
                            :style="{ animationDelay: `${index * 0.025}s` }">
                            <td class="p-4 font-medium">{{ participant.name }}</td>
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
                                Session
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
                                {{ day.participantCount }} participants
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
