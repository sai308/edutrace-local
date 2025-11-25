<script setup>
import { ref, computed } from 'vue';
import { X, User as UserIcon, BarChart3, Award } from 'lucide-vue-next';
import { Bar, Pie } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement } from 'chart.js';
import { useI18n } from 'vue-i18n';
import { useFormatters } from '../../composables/useFormatters';
import { useMarkFormat } from '../../composables/useMarkFormat';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement);

const { t } = useI18n();
const { formatDuration } = useFormatters();
const { formatMarkToFiveScale } = useMarkFormat();

const props = defineProps({
    isOpen: Boolean,
    student: Object,
    meets: Array,
    groupsMap: Object,
    tasks: Array
});

const emit = defineEmits(['close']);

const viewMode = ref('attendance');

// Attendance Chart Data
const attendanceChartData = computed(() => {
    if (!props.student || !props.meets) return null;

    const studentGroups = props.student.groups || [];
    const studentMeets = props.meets.filter(meet => {
        const groupName = props.groupsMap[meet.meetId]?.name;
        return groupName && studentGroups.includes(groupName);
    });

    const labels = studentMeets.map(meet => meet.date);
    const durations = studentMeets.map(meet => {
        const participant = meet.participants.find(p =>
            p.name === props.student.name || (props.student.aliases && props.student.aliases.includes(p.name))
        );
        return participant ? participant.duration / 3600 : 0; // Convert to hours
    });

    return {
        labels,
        datasets: [{
            label: t('students.profile.attendance.duration'),
            data: durations,
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1
        }]
    };
});

const attendanceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false
        }
    },
    scales: {
        y: {
            beginAtZero: true,
            title: {
                display: true,
                text: t('students.profile.attendance.hours')
            }
        }
    }
};

// Attendance Stats
const attendanceStats = computed(() => {
    if (!props.student) return {};
    return {
        totalSessions: props.student.sessionCount || 0,
        totalPossibleSessions: props.student.totalSessions || 0,
        averagePercent: props.student.averageAttendancePercent?.toFixed(1) || '0',
        totalTime: formatDuration(props.student.totalDuration || 0)
    };
});

// Marks Chart Data
const gradeDistributionData = computed(() => {
    if (!props.student || !props.student.marks || !props.tasks) return null;

    const grades = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    // Create task map for quick lookup
    const taskMap = new Map();
    props.tasks.forEach(task => {
        taskMap.set(task.id, task);
    });

    props.student.marks.forEach(mark => {
        const task = taskMap.get(mark.taskId);
        if (task && task.maxPoints && task.maxPoints > 0) {
            const grade = formatMarkToFiveScale({ score: mark.score, maxPoints: task.maxPoints });
            grades[grade] = (grades[grade] || 0) + 1;
        }
    });

    return {
        labels: ['5', '4', '3', '2', '1'],
        datasets: [{
            data: [grades[5], grades[4], grades[3], grades[2], grades[1]],
            backgroundColor: [
                'rgba(34, 197, 94, 0.8)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(234, 179, 8, 0.8)',
                'rgba(249, 115, 22, 0.8)',
                'rgba(239, 68, 68, 0.8)'
            ]
        }]
    };
});

const taskCompletionData = computed(() => {
    if (!props.student) return null;

    const completed = props.student.completedTasks || 0;
    const pending = (props.student.totalTasks || 0) - completed;

    return {
        labels: [t('students.profile.marks.completed'), t('students.profile.marks.pending')],
        datasets: [{
            data: [completed, pending],
            backgroundColor: [
                'rgba(34, 197, 94, 0.8)',
                'rgba(148, 163, 184, 0.8)'
            ]
        }]
    };
});

const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom'
        }
    }
};

// Marks Stats
const marksStats = computed(() => {
    if (!props.student) return {};
    return {
        averageGrade: props.student.averageMark?.toFixed(2) || '0',
        completedTasks: props.student.completedTasks || 0,
        totalTasks: props.student.totalTasks || 0,
        completionPercent: props.student.completionPercent?.toFixed(1) || '0'
    };
});
</script>

<template>
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm !-mt-6"
        @click.self="emit('close')">
        <div
            class="bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <!-- Header -->
            <div class="flex items-center justify-between p-6 border-b">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-primary/10 rounded-full">
                        <UserIcon class="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold">{{ student?.name }}</h2>
                        <p class="text-sm text-muted-foreground">{{ student?.email || t('students.profile.noEmail') }}
                        </p>
                    </div>
                </div>
                <button @click="emit('close')"
                    class="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground">
                    <X class="w-5 h-5" />
                </button>
            </div>

            <!-- View Toggle -->
            <div class="flex gap-2 p-4 bg-muted/30 border-b">
                <button @click="viewMode = 'attendance'"
                    class="px-4 py-2 text-sm font-medium rounded-md transition-all capitalize flex items-center gap-2"
                    :class="viewMode === 'attendance' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'">
                    <BarChart3 class="w-4 h-4" />
                    {{ t('students.profile.views.attendance') }}
                </button>
                <button @click="viewMode = 'marks'"
                    class="px-4 py-2 text-sm font-medium rounded-md transition-all capitalize flex items-center gap-2"
                    :class="viewMode === 'marks' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'">
                    <Award class="w-4 h-4" />
                    {{ t('students.profile.views.marks') }}
                </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-6">
                <!-- Attendance View -->
                <div v-if="viewMode === 'attendance'" class="space-y-6">
                    <div class="h-80">
                        <Bar v-if="attendanceChartData" :data="attendanceChartData" :options="attendanceChartOptions" />
                    </div>

                    <div class="grid grid-cols-3 gap-4">
                        <div class="bg-muted/30 rounded-lg p-4">
                            <div class="text-sm text-muted-foreground">{{ t('students.profile.attendance.attended') }}
                            </div>
                            <div class="text-2xl font-bold mt-1">{{ attendanceStats.totalSessions }}/{{
                                attendanceStats.totalPossibleSessions }}</div>
                        </div>
                        <div class="bg-muted/30 rounded-lg p-4">
                            <div class="text-sm text-muted-foreground">{{ t('students.profile.attendance.avgPercent') }}
                            </div>
                            <div class="text-2xl font-bold mt-1">{{ attendanceStats.averagePercent }}%</div>
                        </div>
                        <div class="bg-muted/30 rounded-lg p-4">
                            <div class="text-sm text-muted-foreground">{{ t('students.profile.attendance.totalTime') }}
                            </div>
                            <div class="text-2xl font-bold mt-1">{{ attendanceStats.totalTime }}</div>
                        </div>
                    </div>
                </div>

                <!-- Marks View -->
                <div v-if="viewMode === 'marks'" class="space-y-6">
                    <div class="grid grid-cols-2 gap-6">
                        <div>
                            <h3 class="text-lg font-semibold mb-4">{{ t('students.profile.marks.gradeDistribution') }}
                            </h3>
                            <div class="h-64">
                                <Pie v-if="gradeDistributionData" :data="gradeDistributionData"
                                    :options="pieChartOptions" />
                            </div>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold mb-4">{{ t('students.profile.marks.taskCompletion') }}</h3>
                            <div class="h-64">
                                <Pie v-if="taskCompletionData" :data="taskCompletionData" :options="pieChartOptions" />
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-4">
                        <div class="bg-muted/30 rounded-lg p-4">
                            <div class="text-sm text-muted-foreground">{{ t('students.profile.marks.avgGrade') }}</div>
                            <div class="text-2xl font-bold mt-1">{{ marksStats.averageGrade }}</div>
                        </div>
                        <div class="bg-muted/30 rounded-lg p-4">
                            <div class="text-sm text-muted-foreground">{{ t('students.profile.marks.tasksCompleted') }}
                            </div>
                            <div class="text-2xl font-bold mt-1">{{ marksStats.completedTasks }}/{{
                                marksStats.totalTasks }}</div>
                        </div>
                        <div class="bg-muted/30 rounded-lg p-4">
                            <div class="text-sm text-muted-foreground">{{ t('students.profile.marks.completion') }}
                            </div>
                            <div class="text-2xl font-bold mt-1">{{ marksStats.completionPercent }}%</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
