<script setup>
import { useFormatters } from '@/composables/useFormatters';

const props = defineProps({
    stats: {
        type: Object,
        required: true
    }
});

const { formatDuration, formatTime } = useFormatters();
</script>

<template>
    <div class="border rounded-lg overflow-hidden bg-card shadow-sm">
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
                        :style="{ animationDelay: `${index * 0.0125}s` }">
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
</template>
