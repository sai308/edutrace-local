<script setup>
import { useRouter } from 'vue-router';
import { Users, Eye, Clock } from 'lucide-vue-next';
import { useFormatters } from '@/composables/useFormatters';

const props = defineProps({
    stats: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['navigate-to-report']);

const router = useRouter();
const { formatDuration, formatTime, formatDate } = useFormatters();

function getSessionAttendees(date) {
    if (!props.stats?.sessions[date]) return 0;
    return Object.keys(props.stats.sessions[date].participants).length;
}

function getStatusDotColor(duration, maxDuration) {
    const percentage = (duration / maxDuration) * 100;
    if (percentage >= 75) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
}

function navigateToReportDetails(date) {
    const reportId = props.stats?.reportIds?.[date];

    if (reportId) {
        router.push({ name: 'ReportDetails', params: { id: reportId } });
    } else {
        console.warn('No report ID found for date:', date);
    }
}

function getSortedParticipants(date) {
    if (!props.stats?.sessions[date]?.participants) return [];

    const participants = props.stats.sessions[date].participants;

    // Convert object to array of [name, duration] pairs, sort by duration DESC, then back to object
    return Object.entries(participants)
        .sort((a, b) => b[1] - a[1]) // Sort by duration descending
        .reduce((acc, [name, duration]) => {
            acc[name] = duration;
            return acc;
        }, {});
}
</script>

<template>
    <!-- Overview View -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div v-for="date in stats.dates" :key="date"
            class="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow">
            <!-- Session Header -->
            <div class="flex items-center justify-between mb-2 pb-2 border-b">
                <div class="font-semibold">{{ formatDate(date) }}</div>
                <div class="flex items-center gap-2">
                    <div class="flex items-center gap-2 text-xs text-muted-foreground px-2">
                        <Clock class="w-3 h-3" />
                        <span>{{ formatDuration(stats.sessions[date].maxDuration) }}</span>
                    </div>
                    <div class="flex items-center gap-1.5 px-2 py-1 text-xs text-primary"
                        :title="$t('analytics.details.overview.seeDetails')">
                        <Users class="w-3.5 h-3.5" />
                        <span>{{ getSessionAttendees(date) }}</span>
                    </div>
                    <button @click="navigateToReportDetails(date)"
                        class="flex items-center gap-1.5 px-2 py-1 text-xs text-primary rounded transition-colors"
                        :title="$t('analytics.details.overview.seeDetails')">
                        <Eye
                            class="w-4 h-4 cursor-pointer text-muted-foreground hover:text-primary transition-colors" />
                    </button>
                </div>
            </div>

            <!-- Session Time & Duration -->
            <div v-if="stats.sessions[date]?.startTime"
                class="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Clock class="w-3 h-3" />
                <span>{{ formatTime(stats.sessions[date].startTime) }} - {{
                    formatTime(stats.sessions[date].endTime) }}</span>
            </div>

            <!-- Participants List -->
            <div class="space-y-0.5 max-h-64 overflow-y-auto">
                <div v-for="(participant, name) in getSortedParticipants(date)" :key="name"
                    class="flex items-center justify-between text-sm py-0.5">
                    <span class="truncate flex-1 text-xs">{{ name }}</span>
                    <div class="flex items-center gap-2 ml-2">
                        <span class="text-xs text-muted-foreground">{{ formatDuration(participant) }}</span>
                        <div class="w-2 h-2 rounded-full"
                            :class="getStatusDotColor(participant, stats.sessions[date].maxDuration)"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
