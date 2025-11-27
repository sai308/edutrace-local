<script setup>
import { ref, computed } from 'vue';
import { X, User as UserIcon, BarChart3, Award, Mail, Copy, Check } from 'lucide-vue-next';
import { Bar, Pie } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement } from 'chart.js';
import { useI18n } from 'vue-i18n';
import { useFormatters } from '../../composables/useFormatters';
import { useMarkFormat } from '../../composables/useMarkFormat';
import { useToast } from '../../services/toast';
import { useColors } from '../../composables/useColors';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement);

const { t } = useI18n();
const { formatDuration, formatTime } = useFormatters();
const { formatMarkToFiveScale } = useMarkFormat();
const { toast } = useToast();
const { getScoreColor } = useColors();

const showCopyCheck = ref(false);

function copyEmail() {
    if (props.student?.email) {
        navigator.clipboard.writeText(props.student.email);
        showCopyCheck.value = true;
        toast.success(t('toast.emailCopied'));
        setTimeout(() => {
            showCopyCheck.value = false;
        }, 2000);
    }
}

const props = defineProps({
    isOpen: Boolean,
    student: Object,
    meets: Array,
    groupsMap: Object,
    tasks: Array
});

const emit = defineEmits(['close']);

import { useModalClose } from '../../composables/useModalClose';

useModalClose(() => {
    if (props.isOpen) {
        emit('close');
    }
});


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

// Calculate meet duration the same way as useStudents.js
function calculateMeetDuration(meet) {
    const durations = meet.participants.map(p => p.duration).sort((a, b) => a - b);
    if (durations.length === 0) return 0;

    const mid = Math.floor(durations.length / 2);
    const median = durations.length % 2 !== 0
        ? durations[mid]
        : (durations[mid - 1] + durations[mid]) / 2;

    // Filter out durations that are more than 2x the median
    const validDurations = durations.filter(d => d <= median * 2);
    if (validDurations.length === 0) return 0;

    // Use the max of the valid durations
    return Math.max(...validDurations);
}

const attendedMeets = computed(() => {
    if (!props.student || !props.meets) return [];

    const studentGroups = props.student.groups || [];
    const studentMeets = props.meets.filter(meet => {
        const groupName = props.groupsMap[meet.meetId]?.name;
        return groupName && studentGroups.includes(groupName);
    });

    return studentMeets
        .map(meet => {
            const participant = meet.participants.find(p =>
                p.name === props.student.name || (props.student.aliases && props.student.aliases.includes(p.name))
            );

            const duration = participant ? participant.duration : 0;
            const meetDuration = calculateMeetDuration(meet);
            const percentage = meetDuration > 0 ? (duration / meetDuration) * 100 : 0;

            // Progress Bar Calculations
            let offsetPercent = 0;
            let durationPercent = 0;
            let startTime = null;
            let joinTime = null;

            if (meet.startTime && meet.endTime && participant?.joinTime) {
                let sessionStart = new Date(meet.startTime);
                let sessionEnd = new Date(meet.endTime);

                // Parse joinTime relative to session date
                // participant.joinTime is likely just a time string (e.g. "09:40 AM")
                // We need to combine it with the session date
                const timeComponent = new Date(participant.joinTime); // This defaults to Today + Time

                if (!isNaN(timeComponent.getTime())) {
                    joinTime = new Date(sessionStart);
                    joinTime.setHours(timeComponent.getHours());
                    joinTime.setMinutes(timeComponent.getMinutes());
                    joinTime.setSeconds(timeComponent.getSeconds());

                    // Handle edge case: if joinTime is significantly after sessionEnd (e.g. > 12 hours), 
                    // or significantly before sessionStart, it might be a date boundary issue.
                    // But for now, assuming same day is safest for typical school hours.

                    // If the resulting joinTime is drastically different from Today's time (which it won't be, we just took the time),
                    // We are good.
                } else {
                    // Fallback if parsing fails
                    joinTime = new Date(participant.joinTime);
                }

                // Adjust timeline to include participant if they are outside the metadata range
                const leaveTime = new Date(joinTime.getTime() + (participant.duration * 1000));

                if (joinTime < sessionStart) sessionStart = joinTime;

                // Fix for "infinite" meetings (left open for days)
                // If metadata duration is significantly larger than the calculated "safe" duration,
                // clamp the end time to a reasonable value.
                const safeDuration = calculateMeetDuration(meet); // seconds
                const metadataDuration = (sessionEnd - sessionStart) / 1000;

                // If metadata is > 5x safe duration (and safe duration is valid), clamp it
                if (safeDuration > 0 && metadataDuration > safeDuration * 5) {
                    const proposedEnd = new Date(sessionStart.getTime() + (safeDuration * 1000));
                    // Ensure we at least cover the student's leave time
                    sessionEnd = new Date(Math.max(proposedEnd.getTime(), leaveTime.getTime()));
                    // Add a 10% buffer for visual comfort
                    sessionEnd = new Date(sessionEnd.getTime() + (safeDuration * 0.1 * 1000));
                }

                if (leaveTime > sessionEnd) sessionEnd = leaveTime;

                const totalSessionDuration = (sessionEnd - sessionStart) / 1000; // seconds

                if (totalSessionDuration > 0) {
                    const offsetSeconds = (joinTime - sessionStart) / 1000;

                    offsetPercent = (offsetSeconds / totalSessionDuration) * 100;
                    durationPercent = (participant.duration / totalSessionDuration) * 100;

                    // Clamp values
                    offsetPercent = Math.max(0, Math.min(100, offsetPercent));
                    durationPercent = Math.max(0, Math.min(100 - offsetPercent, durationPercent));
                }
                startTime = sessionStart;
            }

            return {
                id: meet.meetId,
                date: new Date(meet.date).toLocaleDateString(),
                group: props.groupsMap[meet.meetId]?.name || 'Unknown',
                meetId: meet.meetId,
                duration: formatDuration(duration),
                percentage: Math.min(percentage, 100).toFixed(1),
                // Progress Bar Props
                hasTimeline: !!startTime,
                offsetPercent,
                durationPercent,
                joinTime
            };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));
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

const studentMarks = computed(() => {
    if (!props.student || !props.student.marks || !props.tasks) return [];

    const taskMap = new Map();
    props.tasks.forEach(task => {
        taskMap.set(task.id, task);
    });

    return props.student.marks
        .map(mark => {
            const task = taskMap.get(mark.taskId);
            const maxPoints = task?.maxPoints || 0;
            const grade = maxPoints > 0 ? formatMarkToFiveScale({ score: mark.score, maxPoints }) : '-';

            return {
                id: mark.id,
                date: new Date(mark.createdAt).toLocaleDateString(),
                taskName: task?.name || `Task #${mark.taskId}`,
                score: mark.score,
                maxPoints: maxPoints,
                grade: grade
            };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));
});
</script>

<template>
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm !-mt-6"
        @click.self="emit('close')">
        <div
            class="bg-background rounded-lg shadow-xl w-full max-w-4xl h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
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
                <div class="flex items-center gap-2">
                    <template v-if="student?.email">
                        <a :href="`mailto:${student.email}`" target="_blank"
                            class="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
                            :title="t('students.actions.email')">
                            <Mail class="w-5 h-5" />
                        </a>
                        <button @click="copyEmail"
                            class="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
                            :title="t('students.actions.copyEmail')">
                            <Check v-if="showCopyCheck" class="w-5 h-5 text-green-500" />
                            <Copy v-else class="w-5 h-5" />
                        </button>
                        <div class="w-px h-6 bg-border mx-1"></div>
                    </template>
                    <button @click="emit('close')"
                        class="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground">
                        <X class="w-5 h-5" />
                    </button>
                </div>
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
                <Transition name="fade" mode="out-in">
                    <!-- Attendance View -->
                    <div v-if="viewMode === 'attendance'" key="attendance" class="space-y-6">
                        <div class="h-80">
                            <Bar v-if="attendanceChartData" :data="attendanceChartData"
                                :options="attendanceChartOptions" />
                        </div>

                        <div class="grid grid-cols-3 gap-4">
                            <div class="bg-muted/30 rounded-lg p-4">
                                <div class="text-sm text-muted-foreground">{{ t('students.profile.attendance.attended')
                                }}
                                </div>
                                <div class="text-2xl font-bold mt-1">{{ attendanceStats.totalSessions }}/{{
                                    attendanceStats.totalPossibleSessions }}</div>
                            </div>
                            <div class="bg-muted/30 rounded-lg p-4">
                                <div class="text-sm text-muted-foreground">{{
                                    t('students.profile.attendance.avgPercent') }}
                                </div>
                                <div class="text-2xl font-bold mt-1">{{ attendanceStats.averagePercent }}%</div>
                            </div>
                            <div class="bg-muted/30 rounded-lg p-4">
                                <div class="text-sm text-muted-foreground">{{ t('students.profile.attendance.totalTime')
                                }}
                                </div>
                                <div class="text-2xl font-bold mt-1">{{ attendanceStats.totalTime }}</div>
                            </div>
                        </div>

                        <!-- Attendance History Table -->
                        <div class="space-y-2">
                            <h3 class="text-lg font-semibold">{{ t('students.profile.attendance.history') }}</h3>
                            <div class="border rounded-lg overflow-hidden">
                                <table class="w-full text-sm text-left">
                                    <thead class="bg-muted/50 text-muted-foreground font-medium border-b">
                                        <tr>
                                            <th class="px-4 py-2">{{ t('students.profile.attendance.table.date') }}</th>
                                            <th class="px-4 py-2">{{ t('students.profile.attendance.table.group') }}
                                            </th>
                                            <th class="px-4 py-2">{{ t('students.profile.attendance.table.meetId') }}
                                            </th>
                                            <th class="px-4 py-2 text-right">{{
                                                t('students.profile.attendance.table.duration') }}
                                            </th>
                                            <th class="px-4 py-2 text-center">{{
                                                t('students.profile.attendance.table.progress') }}
                                            </th>
                                            <th class="px-4 py-2 text-right">{{
                                                t('students.profile.attendance.table.status') }}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y">
                                        <tr v-for="meet in attendedMeets" :key="meet.id"
                                            class="hover:bg-muted/50 transition-colors">
                                            <td class="px-4 py-2">{{ meet.date }}</td>
                                            <td class="px-4 py-2">
                                                <span
                                                    class="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                                                    {{ meet.group }}
                                                </span>
                                            </td>
                                            <td class="px-4 py-2 font-mono text-xs text-muted-foreground">{{ meet.meetId
                                            }}</td>
                                            <td class="px-4 py-2 text-right font-mono">{{ meet.duration }}</td>
                                            <td class="px-4 py-2 w-48">
                                                <div v-if="meet.hasTimeline"
                                                    class="relative h-6 bg-muted/30 rounded overflow-hidden w-full min-w-[120px]">
                                                    <!-- Grid lines -->
                                                    <div class="absolute inset-0 flex">
                                                        <div v-for="i in 4" :key="i"
                                                            class="flex-1 border-r border-muted/50 last:border-r-0">
                                                        </div>
                                                    </div>
                                                    <!-- Progress Bar -->
                                                    <div class="absolute h-full rounded transition-all cursor-help"
                                                        :style="{
                                                            left: `${meet.offsetPercent}%`,
                                                            width: `${meet.durationPercent}%`,
                                                            backgroundColor: parseFloat(meet.percentage) >= 75 ? '#22c55e' :
                                                                parseFloat(meet.percentage) >= 50 ? '#eab308' : '#ef4444'
                                                        }" :title="formatTime(meet.joinTime)">
                                                        <div
                                                            class="h-full flex items-center justify-center text-xs font-medium text-white px-2 overflow-hidden whitespace-nowrap">
                                                            <span v-if="meet.durationPercent > 15 && meet.joinTime">
                                                                {{ meet.durationPercent < 25 ? '~' :
                                                                    formatTime(meet.joinTime) }} </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div v-else class="text-xs text-muted-foreground text-center">-</div>
                                            </td>
                                            <td class="px-4 py-2 text-right font-mono"
                                                :class="getScoreColor(parseFloat(meet.percentage))">
                                                {{ meet.percentage }}%
                                            </td>
                                        </tr>
                                        <tr v-if="attendedMeets.length === 0">
                                            <td colspan="5" class="px-4 py-8 text-center text-muted-foreground">
                                                No attendance records found
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Marks View -->
                    <div v-else-if="viewMode === 'marks'" key="marks" class="space-y-6">
                        <div class="grid grid-cols-2 gap-6">
                            <div>
                                <h3 class="text-lg font-semibold mb-4">{{ t('students.profile.marks.gradeDistribution')
                                }}
                                </h3>
                                <div class="h-64">
                                    <Pie v-if="gradeDistributionData" :data="gradeDistributionData"
                                        :options="pieChartOptions" />
                                </div>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold mb-4">{{ t('students.profile.marks.taskCompletion') }}
                                </h3>
                                <div class="h-64">
                                    <Pie v-if="taskCompletionData" :data="taskCompletionData"
                                        :options="pieChartOptions" />
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-3 gap-4">
                            <div class="bg-muted/30 rounded-lg p-4">
                                <div class="text-sm text-muted-foreground">{{ t('students.profile.marks.avgGrade') }}
                                </div>
                                <div class="text-2xl font-bold mt-1">{{ marksStats.averageGrade }}</div>
                            </div>
                            <div class="bg-muted/30 rounded-lg p-4">
                                <div class="text-sm text-muted-foreground">{{ t('students.profile.marks.tasksCompleted')
                                }}
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

                        <!-- Marks History Table -->
                        <div class="space-y-2">
                            <h3 class="text-lg font-semibold">{{ t('students.profile.marks.history') }}</h3>
                            <div class="border rounded-lg overflow-hidden">
                                <table class="w-full text-sm text-left">
                                    <thead class="bg-muted/50 text-muted-foreground font-medium border-b">
                                        <tr>
                                            <th class="px-4 py-2">{{ t('students.profile.marks.table.date') }}</th>
                                            <th class="px-4 py-2">{{ t('students.profile.marks.table.task') }}</th>
                                            <th class="px-4 py-2 text-center">{{ t('students.profile.marks.table.score')
                                            }}</th>
                                            <th class="px-4 py-2 text-center">{{ t('students.profile.marks.table.grade')
                                            }}</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y">
                                        <tr v-for="mark in studentMarks" :key="mark.id"
                                            class="hover:bg-muted/50 transition-colors">
                                            <td class="px-4 py-2">{{ mark.date }}</td>
                                            <td class="px-4 py-2 font-medium">{{ mark.taskName }}</td>
                                            <td class="px-4 py-2 text-center font-mono">
                                                {{ mark.score }} <span class="text-muted-foreground text-xs">/ {{
                                                    mark.maxPoints
                                                }}</span>
                                            </td>
                                            <td class="px-4 py-2 text-center font-bold" :class="{
                                                'text-green-600': mark.grade == 5,
                                                'text-blue-600': mark.grade == 4,
                                                'text-yellow-600': mark.grade == 3,
                                                'text-orange-600': mark.grade == 2,
                                                'text-red-600': mark.grade == 1
                                            }">
                                                {{ mark.grade }}
                                            </td>
                                        </tr>
                                        <tr v-if="studentMarks.length === 0">
                                            <td colspan="4" class="px-4 py-8 text-center text-muted-foreground">
                                                No marks found
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>
        </div>
    </div>
</template>
