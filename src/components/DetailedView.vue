<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { analytics } from '../services/analytics';
import { repository } from '../services/repository';
import { ArrowLeft, LayoutGrid, List, Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Users, Eye } from 'lucide-vue-next';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO
} from 'date-fns';
import DayDetailsModal from './analytics/DayDetailsModal.vue';
import SingleSessionView from './reports/SingleSessionView.vue';

const props = defineProps({
  meetId: {
    type: String,
    default: ''
  },
  id: {
    type: String,
    default: ''
  },
  meets: {
    type: Array,
    default: () => []
  },
  groupsMap: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['back', 'view-details', 'delete-meet', 'bulk-delete', 'group-updated']);

const route = useRoute();
const router = useRouter();

// Use either meetId prop or id prop (from router params)
const effectiveMeetId = computed(() => props.meetId || props.id || route.params.id);
const stats = ref({ dates: [], matrix: [], sessions: {}, metadata: null });
const loading = ref(true);
const viewMode = ref(route.query.view || 'overview'); // 'overview', 'table', 'calendar'
const ignoredUsers = ref(new Set());
const currentMonth = ref(new Date());

const isReportContext = computed(() => route.name === 'ReportDetails');
const effectiveId = computed(() => props.id || props.meetId);

// Sync view mode with URL
watch(() => route.query.view, (newView) => {
  if (newView && ['overview', 'table', 'calendar'].includes(newView)) {
    viewMode.value = newView;
  }
});

watch(viewMode, (newView) => {
  router.replace({
    query: { ...route.query, view: newView }
  });
});

// Force table view for Report Context
watch(isReportContext, (isReport) => {
  if (isReport) {
    viewMode.value = 'table';
  }
}, { immediate: true });

// ... (rest of script)



// Modal State
const showDayModal = ref(false);
const selectedDayDetails = ref({
  date: '',
  meetId: '',
  participants: []
});
const error = ref(null); // Added error ref
const selectedDay = ref(null); // Added selectedDay ref

const displayName = computed(() => {
  if (isReportContext.value) {
    return `Report Details (${effectiveId.value})`;
  }
  const group = props.groupsMap[effectiveMeetId.value]; // Changed effectiveId.value to effectiveMeetId.value
  return group ? `${group.name} (${effectiveMeetId.value})` : effectiveMeetId.value; // Changed effectiveId.value to effectiveMeetId.value
});

const teacherName = computed(() => {
  return props.groupsMap[effectiveMeetId.value]?.teacher; // Changed effectiveId.value to effectiveMeetId.value
});

async function loadData() {
  if (!effectiveMeetId.value) return; // Added check for effectiveMeetId.value

  loading.value = true;
  error.value = null; // Reset error
  try {
    let data;
    if (isReportContext.value) {
      data = await analytics.getSingleReportStats(effectiveMeetId.value); // Changed effectiveId.value to effectiveMeetId.value
    } else {
      data = await analytics.getDetailedStats(effectiveMeetId.value); // Changed effectiveId.value to effectiveMeetId.value
    }

    const ignored = await repository.getIgnoredUsers();
    stats.value = data;
    ignoredUsers.value = new Set(ignored);
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
watch(() => effectiveId.value, loadData);

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

function formatDuration(seconds) {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getSessionDuration(date) {
  // Find max duration for this date from matrix
  let max = 0;
  stats.value.matrix.forEach(row => {
    if (row[date] && row[date].duration > max) {
      max = row[date].duration;
    }
  });
  return formatDuration(max);
}

function getSessionTimeRange(date) {
  const session = stats.value.sessions ? stats.value.sessions[date] : null;
  if (!session || !session.startTime || !session.endTime) return null;

  const start = new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const end = new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return { start, end };
}

function getParticipantsForDate(date) {
  return stats.value.matrix
    .filter(row => {
      if (teacherName.value && row.name === teacherName.value) return false;
      if (ignoredUsers.value.has(row.name)) return false;
      return row[date] && row[date].duration > 0;
    })
    .map(row => ({
      name: row.name,
      duration: row[date].duration,
      percentage: row[date].percentage,
      status: row[date].status
    }))
    .sort((a, b) => b.duration - a.duration);
}

// Calendar Logic
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const sessionsMap = computed(() => {
  if (!stats.value.dates) return new Map();

  const map = new Map();

  stats.value.dates.forEach(dateStr => {
    const participants = getParticipantsForDate(dateStr);
    const timeRange = getSessionTimeRange(dateStr);

    map.set(dateStr, {
      attendees: participants.length,
      participants: participants,
      startTime: timeRange ? timeRange.start : null,
      endTime: timeRange ? timeRange.end : null
    });
  });

  return map;
});

const calendarDays = computed(() => {
  const start = startOfWeek(startOfMonth(currentMonth.value));
  const end = endOfWeek(endOfMonth(currentMonth.value));

  return eachDayOfInterval({ start, end }).map(date => {
    const dateStr = format(date, 'yyyy-MM-dd');
    let session = null;

    // Search for matching date in map keys
    for (const [key, val] of sessionsMap.value.entries()) {
      if (isSameDay(parseISO(key), date)) {
        session = val;
        break;
      }
    }

    return {
      date,
      dateStr,
      isCurrentMonth: isSameMonth(date, currentMonth.value),
      isToday: isToday(date),
      session
    };
  });
});

function nextMonth() {
  currentMonth.value = addMonths(currentMonth.value, 1);
}

function prevMonth() {
  currentMonth.value = subMonths(currentMonth.value, 1);
}

function handleDayClick(day) {
  if (!day.session) return;

  selectedDayDetails.value = {
    date: format(day.date, 'EEEE, MMMM d, yyyy'),
    meetId: effectiveId.value,
    participants: day.session.participants
  };
  showDayModal.value = true;
}

function navigateToReportDetails(reportId = effectiveMeetId.value) {
  router.push({ name: 'ReportDetails', params: { id: reportId } });
}

async function getReportIdForDate(date) {
  // Find the report ID that matches this meetId and date
  const allMeets = await repository.getAllMeets();
  const match = allMeets.find(meet =>
    meet.meetId === effectiveMeetId.value && meet.date === date
  );
  return match ? match.id : null;
}

async function handleViewReportForDate(date) {
  const reportId = await getReportIdForDate(date);
  if (reportId) {
    router.push({ name: 'ReportDetails', params: { id: reportId }, query: { view: 'table' } });
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <button @click="$emit('back')" class="p-2 hover:bg-muted rounded-full transition-colors" title="Back">
          <ArrowLeft class="w-5 h-5" />
        </button>
        <div>
          <h2 class="text-2xl font-bold tracking-tight">{{ $t('reports.details.title') }}</h2>
          <div class="flex flex-wrap items-center md:gap-x-16 gap-x-4 text-muted-foreground">
            <span>{{ displayName }}</span>
            <span v-if="teacherName" class="flex items-center gap-x-2">
              <span>{{ $t('reports.details.teacher') }}</span>
              <span class="text-xs bg-muted px-2 py-0.5 rounded">
                {{ teacherName }}
              </span>
            </span>
          </div>
        </div>
      </div>

      <!-- View toggle only for non-report context -->
      <div v-if="!isReportContext" class="flex bg-muted p-1 rounded-lg">
        <button v-for="mode in ['overview', 'table', 'calendar']" :key="mode" @click="viewMode = mode"
          class="px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize flex items-center gap-2"
          :class="viewMode === mode ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'">
          <LayoutGrid v-if="mode === 'overview'" class="w-4 h-4" />
          <List v-else-if="mode === 'table'" class="w-4 h-4" />
          <CalendarIcon v-else class="w-4 h-4" />
          {{ mode }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="error" class="flex-1 flex items-center justify-center text-destructive">
      {{ error }}
    </div>

    <!-- Report Context: Use SingleSessionView -->
    <SingleSessionView v-else-if="isReportContext" :stats="stats" :view-mode="viewMode"
      @update:view-mode="viewMode = $event" />

    <!-- Regular Context: Use existing views -->
    <div v-else>
      <Transition name="fade" mode="out-in">
        <!-- Overview View (Card Layout) -->
        <div v-if="viewMode === 'overview'" key="overview"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div v-for="date in stats.dates" :key="date" class="bg-card rounded-lg border p-4 space-y-3">
            <div class="flex items-center justify-between border-b pb-2">
              <div class="font-medium">{{ formatDate(date) }}</div>
              <div class="flex items-center gap-2">
                <Eye
                  class="w-4 h-4 cursor-pointer text-muted-foreground hover:text-foreground hover:text-primary transition-colors"
                  @click="handleViewReportForDate(date)" :title="$t('reports.details.viewReport')" />
                <div class="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                  {{ getSessionDuration(date) }}
                </div>
              </div>
            </div>

            <div v-if="getSessionTimeRange(date)" class="text-xs text-muted-foreground flex items-center gap-1">
              <Clock class="w-3 h-3" />
              {{ getSessionTimeRange(date).start }} - {{ getSessionTimeRange(date).end }}
            </div>

            <div class="space-y-2">
              <div v-for="p in getParticipantsForDate(date)" :key="p.name"
                class="flex items-center justify-between text-sm">
                <span class="truncate flex-1" :title="p.name">{{ p.name }}</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground">{{ formatDuration(p.duration) }}</span>
                  <div class="w-2 h-2 rounded-full" :class="p.status" :title="`${p.percentage}%`"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Table View -->
        <div v-else-if="viewMode === 'table'" key="table" class="border rounded-lg overflow-hidden bg-card shadow-sm">
          <div class="overflow-x-auto overflow-y-hidden">
            <table class="w-full text-sm text-left border-collapse">
              <thead class="bg-muted/50 text-muted-foreground">
                <tr>
                  <th class="sticky left-0 z-10 bg-muted/95 border-b border-r h-12 px-4 font-medium min-w-[200px]">
                    {{ $t('reports.details.table.participant') }}
                  </th>
                  <th v-for="date in stats.dates" :key="date"
                    class="border-b h-12 px-4 font-medium text-center min-w-[100px]">
                    {{ formatDate(date) }}
                  </th>
                  <th class="border-b h-12 px-4 font-medium text-center min-w-[100px]">
                    {{ $t('reports.details.table.total') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="(student, index) in filteredStudents" :key="student.name"
                  class="hover:bg-muted/5 transition-colors table-row-animate"
                  :style="{ animationDelay: `${index * 0.025}s` }">
                  <td class="sticky left-0 z-10 bg-background border-r p-4 font-medium whitespace-nowrap">
                    {{ student.name }}
                  </td>
                  <td v-for="date in stats.dates" :key="date" class="p-1 text-center border-r last:border-r-0">
                    <div v-if="student[date]"
                      class="w-full h-full min-h-[3rem] flex flex-col items-center justify-center rounded-md text-xs font-medium transition-all"
                      :class="student[date].status" :title="formatDuration(student[date].duration)">
                      <span>{{ student[date].percentage }}%</span>
                    </div>
                    <div v-else class="text-muted-foreground/20">-</div>
                  </td>
                  <td class="p-4 text-center font-bold">
                    <div class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      :class="student.totalPercentage >= 75 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'">
                      {{ student.totalPercentage }}%
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Calendar View -->
        <div v-else key="calendar" class="space-y-4">
          <!-- Calendar Header -->
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold capitalize">
              {{ format(currentMonth, 'MMMM yyyy') }}
            </h3>
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
              <div v-for="day in weekDays" :key="day" class="p-3 text-center text-sm font-medium text-muted-foreground">
                {{ day }}
              </div>
            </div>

            <!-- Days -->
            <div class="grid grid-cols-7 divide-x divide-y bg-background">
              <div v-for="day in calendarDays" :key="day.date.toString()" @click="handleDayClick(day)"
                class="min-h-[120px] p-2 transition-colors relative group" :class="[
                  !day.isCurrentMonth && 'bg-muted/10 text-muted-foreground',
                  day.isToday && 'bg-primary/5',
                  day.session ? 'cursor-pointer hover:bg-muted/5' : ''
                ]">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full"
                    :class="day.isToday && 'bg-primary text-primary-foreground'">
                    {{ format(day.date, 'd') }}
                  </span>
                </div>

                <div v-if="day.session" class="flex flex-col gap-1.5">
                  <!-- Start Time -->
                  <div v-if="day.session.startTime" class="flex items-center gap-1 text-xs font-medium text-primary">
                    <Clock class="w-3 h-3" />
                    {{ day.session.startTime }}
                  </div>

                  <!-- Members Count -->
                  <div class="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users class="w-3 h-3" />
                    {{ day.session.attendees }} {{ $t('reports.details.calendar.members') }}
                  </div>

                  <!-- End Time -->
                  <div v-if="day.session.endTime" class="flex items-center gap-1 text-xs text-muted-foreground">
                    <span class="text-[10px] uppercase font-bold text-muted-foreground/70">{{
                      $t('reports.details.calendar.end') }}</span>
                    {{ day.session.endTime }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <DayDetailsModal :is-open="showDayModal" :date="selectedDayDetails.date" :meet-id="selectedDayDetails.meetId"
      :participants="selectedDayDetails.participants" @close="showDayModal = false" />
  </div>
</template>
```
