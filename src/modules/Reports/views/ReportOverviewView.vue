<script setup>
import { computed } from 'vue';
import { ChartBar } from 'lucide-vue-next';
import { format } from 'date-fns';
import { useFormatters } from '@/composables/useFormatters';

const props = defineProps({
    stats: {
        type: Object,
        required: true
    }
});

const { formatDuration, formatTime } = useFormatters();

// Timeline calculations
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
                            <div class="h-full flex items-center justify-center text-xs font-medium text-white px-2">
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
</template>
