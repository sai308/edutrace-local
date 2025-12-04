<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { CheckCircle2, XCircle, Search, Calendar, CircleSlash, MoreVertical, Wand2, PenLine, ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from 'lucide-vue-next';
import { useFormatters } from '../../composables/useFormatters';
import { useExamData } from '../../composables/useExamData';
import ExamGradeModal from './ExamGradeModal.vue';
import StudentProfileModal from '../students/StudentProfileModal.vue';

const router = useRouter();
const route = useRoute();

const props = defineProps({
    group: {
        type: Object,
        default: null
    },
    completionThreshold: {
        type: Number,
        default: 80
    },
    attendanceThreshold: {
        type: Number,
        default: 80
    },
    assessmentType: {
        type: String,
        default: 'exam'
    },
    modules: {
        type: Array,
        default: () => []
    },
    attendanceEnabled: {
        type: Boolean,
        default: true
    },
    gradeFormat: {
        type: String,
        default: '5-scale'
    },
    requiredTasks: {
        type: Number,
        default: 0
    }
});

const emit = defineEmits(['update:group', 'update:completionThreshold', 'update:attendanceThreshold']);
const { formatDate } = useFormatters();

const searchQuery = ref('');

// Read search query param on mount
onMounted(() => {
    const searchParam = route.query.search;
    if (searchParam) {
        searchQuery.value = searchParam;
    }
});

// Sync searchQuery to URL query params
watch(searchQuery, (newSearch) => {
    if (newSearch) {
        router.replace({ query: { ...route.query, search: newSearch } });
    } else {
        // Remove search param if empty
        const { search, ...restQuery } = route.query;
        router.replace({ query: restQuery });
    }
});

// Action Menu State
const activeActionMenu = ref(null); // student ID
const showGradeModal = ref(false);
const selectedStudent = ref(null);

function formatDateSplit(dateString) {
    if (!dateString) return { line1: '-', line2: '' };
    const date = new Date(dateString);
    const line1 = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
    const line2 = date.getFullYear();
    return { line1, line2 };
}

const finalCheckColumn = computed(() => (props.assessmentType === 'exam' ? 'summary.list.table.examGrade' : 'summary.list.table.creditGrade'));

// Use the exam data composable
const { students: examStudents, isLoading, loadExamData, meets, tasks, groupsMap } = useExamData();

// Store manual exam grades
const manualGrades = ref({}); // { studentId: grade }

// Load data when group or modules change
watch([() => props.group, () => props.modules, () => props.completionThreshold, () => props.attendanceThreshold, () => props.attendanceEnabled, () => props.gradeFormat, () => props.requiredTasks, () => props.assessmentType],
    async ([newGroup, newModules, newCompletionThreshold, newAttendanceThreshold, newAttendanceEnabled, newGradeFormat, newRequiredTasks, newAssessmentType]) => {
        if (newGroup) {
            await loadExamData(newGroup, newModules, newCompletionThreshold, newAttendanceThreshold, newAttendanceEnabled, newGradeFormat, newRequiredTasks, newAssessmentType);
        }
    },
    { immediate: true, deep: true }
);

const sortColumn = ref('name');
const sortDirection = ref('asc');

function toggleSort(column, moduleName = null) {
    const key = moduleName ? `module_${moduleName}` : column;
    if (sortColumn.value === key) {
        sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn.value = key;
        sortDirection.value = 'asc';
    }
}

// Computed students with search filter, manual grades, and sorting applied
const sortedStudents = computed(() => {
    if (!props.group) {
        return [];
    }

    let studentList = examStudents.value.map(student => {
        // Apply manual grade if exists
        const storedGrade = manualGrades.value[student.id];
        const hasManualGrade = storedGrade !== undefined;

        // Determine effective grade
        const examGrade = hasManualGrade ? storedGrade : student.examGrade;

        // Determine if unsaved
        // It is unsaved if there is a manual grade AND it differs from the saved examGrade
        // Note: We need to handle type differences (string vs number) if necessary, but usually they match
        const isUnsaved = hasManualGrade && String(storedGrade) !== String(student.examGrade || '');

        return {
            ...student,
            examGrade,
            isUnsaved
        };
    });

    // Apply search filter
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        studentList = studentList.filter(student =>
            student.name.toLowerCase().includes(query)
        );
    }

    // Apply sorting
    return studentList.sort((a, b) => {
        let valA, valB;

        if (sortColumn.value.startsWith('module_')) {
            const moduleName = sortColumn.value.replace('module_', '');
            // Handle numeric grades for sorting, treating '-' as -1 or Infinity depending on direction
            const rawA = a.moduleGrades[moduleName];
            const rawB = b.moduleGrades[moduleName];

            // Helper to parse grade
            const parseGrade = (g) => {
                if (g === undefined || g === null || g === '-') return -Infinity;
                // If it's a number or string number
                if (!isNaN(parseFloat(g))) return parseFloat(g);
                // If it's a letter grade (ECTS), we might need a map, but for now simple string compare
                // or if we want to support ECTS sorting properly we need a map.
                // Assuming numeric for now as per previous logic, or simple string compare for ECTS
                return g;
            };

            valA = parseGrade(rawA);
            valB = parseGrade(rawB);

        } else {
            switch (sortColumn.value) {
                case 'name':
                    valA = a.name;
                    valB = b.name;
                    break;
                case 'total':
                    valA = a.total !== null ? a.total : -Infinity;
                    valB = b.total !== null ? b.total : -Infinity;
                    break;
                case 'completion':
                    valA = a.completion;
                    valB = b.completion;
                    break;
                case 'attendance':
                    valA = a.attendance;
                    valB = b.attendance;
                    break;
                case 'status':
                    // Custom order: Automatic > Allowed > Not Allowed
                    const statusOrder = { 'automatic': 3, 'allowed': 2, 'notAllowed': 1 };
                    valA = statusOrder[a.status] || 0;
                    valB = statusOrder[b.status] || 0;
                    break;
                case 'examGrade':
                    // Prioritize exam grade, then total if automatic
                    const getGradeVal = (s) => {
                        if (s.examGrade) return s.examGrade;
                        if (s.status === 'automatic' && s.total !== null) return s.total;
                        return -Infinity;
                    };
                    valA = getGradeVal(a);
                    valB = getGradeVal(b);
                    break;
                case 'date':
                    valA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                    valB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                    break;
                default:
                    valA = a[sortColumn.value];
                    valB = b[sortColumn.value];
            }
        }

        if (valA < valB) return sortDirection.value === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection.value === 'asc' ? 1 : -1;
        return 0;
    });
});

function toggleActionMenu(studentId) {
    if (activeActionMenu.value === studentId) {
        activeActionMenu.value = null;
    } else {
        activeActionMenu.value = studentId;
    }
}

function closeActionMenu() {
    activeActionMenu.value = null;
}

function applyAutoGrade(student) {
    if (student.total !== null) {
        manualGrades.value[student.id] = student.total;
    }
    closeActionMenu();
}

function openManualGrade(student) {
    selectedStudent.value = student;
    showGradeModal.value = true;
    closeActionMenu();
}

import { repository } from '@/services/repository';
import { Save } from 'lucide-vue-next';


async function saveGradeToDb(student) {
    if (!student) return;

    const gradeToSave = manualGrades.value[student.id];
    if (gradeToSave === undefined) return;

    try {
        await repository.saveFinalAssessment({
            studentId: student.id,
            assessmentType: props.assessmentType,
            grade: gradeToSave,
            gradeFormat: props.gradeFormat,
            isAutomatic: false // Assuming manual save is always manual override
        });

        // Clear manual grade as it is now saved
        delete manualGrades.value[student.id];

        // Reload data to reflect changes
        await loadExamData(props.group, props.modules, props.completionThreshold, props.attendanceThreshold, props.attendanceEnabled, props.gradeFormat, props.requiredTasks, props.assessmentType);
    } catch (error) {
        console.error('Failed to save grade:', error);
    }

    closeActionMenu();
}

function handleSaveGrade(grade) {
    if (selectedStudent.value) {
        manualGrades.value[selectedStudent.value.id] = grade;
    }
    showGradeModal.value = false;
    selectedStudent.value = null;
}

async function removeMark(student) {
    if (!student) return;

    try {
        // Fetch the final assessment for this student
        const assessment = await repository.getFinalAssessmentByStudent(student.id, props.assessmentType);

        if (assessment) {
            // Delete the assessment
            await repository.deleteFinalAssessment(assessment.id);
        }

        // Clear any manual grades for this student
        delete manualGrades.value[student.id];

        // Reload data to reflect changes
        await loadExamData(props.group, props.modules, props.completionThreshold, props.attendanceThreshold, props.attendanceEnabled, props.gradeFormat, props.requiredTasks, props.assessmentType);
    } catch (error) {
        console.error('Failed to remove mark:', error);
    }

    closeActionMenu();
}
const showProfileModal = ref(false);
const profileStudent = ref(null);

function openProfile(student) {
    profileStudent.value = student;
    showProfileModal.value = true;
}
</script>

<template>
    <div class="space-y-4" @click="closeActionMenu">
        <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">{{ $t('summary.list.title') }}</h3>
        </div>

        <!-- Search -->
        <div class="relative">
            <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input v-model="searchQuery" type="text" :placeholder="$t('summary.list.searchPlaceholder')"
                class="pl-8 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>

        <div class="border rounded-lg overflow-hidden bg-card shadow-sm">
            <div class="overflow-x-auto overflow-visible">
                <table class="w-full text-sm text-left">
                    <thead class="bg-muted/50 text-muted-foreground font-medium border-b">
                        <tr>
                            <th class="p-3 w-10 text-center">#</th>
                            <th class="p-3 min-w-[150px] cursor-pointer hover:text-foreground transition-colors"
                                @click="toggleSort('name')">
                                <div class="flex items-center gap-1">
                                    {{ $t('summary.list.table.student') }}
                                    <ArrowUpDown v-if="sortColumn !== 'name'" class="w-3 h-3 opacity-50" />
                                    <ArrowUp v-else-if="sortDirection === 'asc'" class="w-3 h-3 text-primary" />
                                    <ArrowDown v-else class="w-3 h-3 text-primary" />
                                </div>
                            </th>

                            <!-- Dynamic Module Columns -->
                            <th v-for="module in modules" :key="module.name"
                                class="p-3 text-center min-w-[100px] cursor-pointer hover:text-foreground transition-colors"
                                @click="toggleSort('module', module.name)">
                                <div class="flex items-center justify-center gap-1">
                                    {{ module.name }}
                                    <ArrowUpDown v-if="sortColumn !== `module_${module.name}`"
                                        class="w-3 h-3 opacity-50" />
                                    <ArrowUp v-else-if="sortDirection === 'asc'" class="w-3 h-3 text-primary" />
                                    <ArrowDown v-else class="w-3 h-3 text-primary" />
                                </div>
                            </th>

                            <th class="p-3 text-center min-w-[100px] cursor-pointer hover:text-foreground transition-colors"
                                @click="toggleSort('total')">
                                <div class="flex items-center justify-center gap-1">
                                    {{ $t('summary.list.table.total') }}
                                    <ArrowUpDown v-if="sortColumn !== 'total'" class="w-3 h-3 opacity-50" />
                                    <ArrowUp v-else-if="sortDirection === 'asc'" class="w-3 h-3 text-primary" />
                                    <ArrowDown v-else class="w-3 h-3 text-primary" />
                                </div>
                            </th>
                            <th class="p-3 text-center min-w-[100px] cursor-pointer hover:text-foreground transition-colors"
                                @click="toggleSort('completion')">
                                <div class="flex items-center justify-center gap-1">
                                    {{ $t('summary.list.table.completion') }}
                                    <ArrowUpDown v-if="sortColumn !== 'completion'" class="w-3 h-3 opacity-50" />
                                    <ArrowUp v-else-if="sortDirection === 'asc'" class="w-3 h-3 text-primary" />
                                    <ArrowDown v-else class="w-3 h-3 text-primary" />
                                </div>
                            </th>
                            <th class="p-3 text-center min-w-[100px] cursor-pointer hover:text-foreground transition-colors"
                                @click="toggleSort('attendance')">
                                <div class="flex items-center justify-center gap-1">
                                    {{ $t('summary.list.table.attendance') }}
                                    <ArrowUpDown v-if="sortColumn !== 'attendance'" class="w-3 h-3 opacity-50" />
                                    <ArrowUp v-else-if="sortDirection === 'asc'" class="w-3 h-3 text-primary" />
                                    <ArrowDown v-else class="w-3 h-3 text-primary" />
                                </div>
                            </th>
                            <th class="p-3 text-center min-w-[120px] cursor-pointer hover:text-foreground transition-colors"
                                @click="toggleSort('status')">
                                <div class="flex items-center justify-center gap-1">
                                    {{ $t('summary.list.table.status') }}
                                    <ArrowUpDown v-if="sortColumn !== 'status'" class="w-3 h-3 opacity-50" />
                                    <ArrowUp v-else-if="sortDirection === 'asc'" class="w-3 h-3 text-primary" />
                                    <ArrowDown v-else class="w-3 h-3 text-primary" />
                                </div>
                            </th>
                            <th class="p-3 text-center min-w-[120px] cursor-pointer hover:text-foreground transition-colors"
                                @click="toggleSort('examGrade')">
                                <div class="flex items-center justify-center gap-1">
                                    {{ $t(finalCheckColumn) }}
                                    <ArrowUpDown v-if="sortColumn !== 'examGrade'" class="w-3 h-3 opacity-50" />
                                    <ArrowUp v-else-if="sortDirection === 'asc'" class="w-3 h-3 text-primary" />
                                    <ArrowDown v-else class="w-3 h-3 text-primary" />
                                </div>
                            </th>
                            <th class="p-3 text-center min-w-[100px] cursor-pointer hover:text-foreground transition-colors"
                                @click="toggleSort('date')">
                                <div class="flex items-center justify-center gap-1">
                                    {{ $t('summary.list.table.date') }}
                                    <ArrowUpDown v-if="sortColumn !== 'date'" class="w-3 h-3 opacity-50" />
                                    <ArrowUp v-else-if="sortDirection === 'asc'" class="w-3 h-3 text-primary" />
                                    <ArrowDown v-else class="w-3 h-3 text-primary" />
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        <tr v-for="(student, index) in sortedStudents" :key="student.id"
                            class="hover:bg-muted/50 transition-colors">
                            <td class="p-3 text-center text-muted-foreground">{{ index + 1 }}</td>
                            <td class="p-3 font-medium cursor-pointer hover:text-primary hover:underline hover:decoration-dashed underline-offset-4 transition-colors"
                                @click="openProfile(student)">
                                {{ student.name }}
                            </td>

                            <!-- Dynamic Module Grades -->
                            <td v-for="module in modules" :key="module.name" class="p-3 text-center font-mono"
                                :title="student.moduleDetails?.[module.name] ? $t('summary.list.tooltips.moduleGrade', { details: student.moduleDetails[module.name] }) : ''">
                                {{ student.moduleGrades[module.name] || '-' }}
                            </td>

                            <!-- Total -->
                            <td class="p-3 text-center font-mono font-bold text-primary">
                                {{ student.total !== null ? student.total : '-' }}
                            </td>

                            <td class="p-3 text-center"
                                :class="{ 'text-destructive': student.completion < completionThreshold, 'text-green-600': student.completion >= completionThreshold }"
                                :title="$t('summary.list.tooltips.completion', { exact: student.completionExact, details: student.completionDetails })">
                                {{ student.completion }}%
                            </td>
                            <td class="p-3 text-center"
                                :class="{ 'text-destructive': student.attendance < attendanceThreshold, 'text-green-600': student.attendance >= attendanceThreshold }"
                                :title="$t('summary.list.tooltips.attendance', { exact: student.attendanceExact, details: student.attendanceDetails })">
                                {{ student.attendance }}%
                            </td>
                            <td class="p-3 text-center">
                                <div class="flex items-center justify-center gap-1.5">
                                    <!-- Automatic -->
                                    <div v-if="student.status === 'automatic'"
                                        class="flex items-center gap-1.5 text-blue-600 font-medium"
                                        :title="`${student.statusCause || $t('summary.list.status.automaticTooltip')}`">
                                        <CircleSlash class="w-4 h-4" />
                                        {{ $t('summary.list.status.automatic') }}
                                    </div>
                                    <!-- Allowed -->
                                    <div v-else-if="student.status === 'allowed'"
                                        class="flex items-center gap-1.5 text-green-600"
                                        :title="`${student.statusCause || $t('summary.list.status.allowedTooltip')}`">
                                        <CheckCircle2 class="w-4 h-4" />
                                        {{ $t('summary.list.status.allowed') }}
                                    </div>
                                    <!-- Not Allowed -->
                                    <div v-else class="flex items-center gap-1.5 text-destructive"
                                        :title="`${student.statusCause || $t('summary.list.status.notAllowedTooltip')}`">
                                        <XCircle class="w-4 h-4" />
                                        {{ $t('summary.list.status.notAllowed') }}
                                    </div>
                                </div>
                            </td>
                            <td class="p-3 text-center font-mono font-bold relative group">
                                <div class="flex items-center justify-center gap-2">
                                    <!-- Show exam grade if set, otherwise show total as placeholder for automatic status -->
                                    <div class="flex items-center gap-1">
                                        <span v-if="student.examGrade" class="text-foreground">{{ student.examGrade
                                        }}</span>
                                        <span v-else-if="student.status === 'automatic' && student.total !== null"
                                            class="text-muted-foreground">{{ student.total }}</span>
                                        <span v-else>-</span>

                                        <!-- Unsaved Marker -->
                                        <div v-if="student.isUnsaved" class="w-2 h-2 rounded-full bg-amber-500"
                                            :title="$t('summary.list.unsavedChanges')"></div>
                                    </div>

                                    <!-- Action Menu Button -->
                                    <div class="relative">
                                        <button @click.stop="toggleActionMenu(student.id)"
                                            class="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            :class="{ 'opacity-100 bg-muted text-foreground': activeActionMenu === student.id }">
                                            <MoreVertical class="w-4 h-4" />
                                        </button>

                                        <!-- Dropdown Menu -->
                                        <div v-if="activeActionMenu === student.id"
                                            class="absolute right-0 top-full mt-1 w-48 rounded-md border bg-popover shadow-lg z-50 animate-in fade-in zoom-in-95 duration-200">
                                            <div class="p-1">
                                                <button @click="saveGradeToDb(student)" v-if="student.isUnsaved"
                                                    class="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground text-orange-600">
                                                    <Save class="w-4 h-4" />
                                                    {{ $t('summary.list.actions.save') }}
                                                </button>
                                                <button @click="applyAutoGrade(student)"
                                                    :disabled="student.total === null"
                                                    class="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed">
                                                    <Wand2 class="w-4 h-4" />
                                                    {{ $t('summary.list.actions.applyAuto') }}
                                                </button>
                                                <button @click="openManualGrade(student)"
                                                    class="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground">
                                                    <PenLine class="w-4 h-4" />
                                                    {{ $t('summary.list.actions.setManual') }}
                                                </button>
                                                <button @click="removeMark(student)" v-if="student.examGrade"
                                                    class="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground text-destructive">
                                                    <Trash2 class="w-4 h-4" />
                                                    {{ $t('summary.list.actions.remove') }}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td class="p-3 text-center text-muted-foreground text-xs">
                                <div v-if="student.completedAt" class="flex flex-col items-center leading-tight">
                                    <Calendar class="w-4 h-4 mb-0.5" />
                                    <span class="font-medium">{{ formatDateSplit(student.completedAt).line1 }}</span>
                                    <span class="text-[10px] opacity-70">{{ formatDateSplit(student.completedAt).line2
                                        }}</span>
                                </div>
                                <span v-else>-</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <ExamGradeModal :is-open="showGradeModal" :initial-grade="selectedStudent?.examGrade"
            @close="showGradeModal = false" @save="handleSaveGrade" />

        <StudentProfileModal :is-open="showProfileModal" :student="profileStudent" :meets="meets"
            :groups-map="groupsMap" :tasks="tasks" @close="showProfileModal = false" />
    </div>
</template>
```
