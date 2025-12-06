<script setup>
const props = defineProps({
    stats: {
        type: Object,
        required: true
    }
});

function formatDateForTable(dateStr) {
    const date = new Date(dateStr);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
}

function getFinalStatusColor(totalPercentage) {
    if (totalPercentage >= 75) return 'text-green-500';
    if (totalPercentage >= 50) return 'text-amber-500';
    return 'text-red-500';
}
</script>

<template>
    <!-- Table View -->
    <div class="overflow-x-auto rounded-lg border bg-card">
        <table class="w-full text-sm table-auto">
            <thead class="bg-muted/50 text-muted-foreground">
                <tr>
                    <th class="p-2 px-4 font-medium sticky left-0 bg-muted/50 text-left border-r whitespace-nowrap">
                        {{ $t('analytics.details.table.student') }}
                    </th>
                    <th v-for="date in stats.dates" :key="date"
                        class="p-2 font-medium text-center whitespace-nowrap border-r">
                        {{ formatDateForTable(date) }}
                    </th>
                    <th class="p-2 font-medium text-center whitespace-nowrap bg-muted/50 sticky right-0 border-l">
                        {{ $t('analytics.details.table.total') }}
                    </th>
                </tr>
            </thead>
            <tbody class="divide-y divide-border">
                <tr v-for="student in stats.matrix" :key="student.name" class="hover:bg-muted/30">
                    <td class="p-2 px-4 font-medium sticky left-0 bg-background border-r whitespace-nowrap">{{
                        student.name }}</td>
                    <td v-for="date in stats.dates" :key="date" class="p-1 text-center border-r">
                        <div v-if="student[date]" class="w-full h-full flex items-center justify-center">
                            <div :class="['w-full px-3 py-2 rounded text-xs font-medium', student[date].status]">
                                {{ student[date].percentage }}%
                            </div>
                        </div>
                        <div v-else class="text-muted-foreground py-2">-</div>
                    </td>
                    <td class="p-1 px-2 text-center font-bold sticky right-0 bg-background border-l">
                        <div class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full font-bold"
                            :class="getFinalStatusColor(student.totalPercentage)">
                            {{ student.totalPercentage }}%
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
