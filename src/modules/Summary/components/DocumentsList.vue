<script setup>
import { ref, computed, watch } from 'vue';
import { Search, Calendar, CircleCheckBig, FileCheck, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-vue-next';
import { summaryService } from '../services/summary.service';
import { useSummaryData } from '../composables/useSummaryData';
import StudentProfileModal from '@/modules/Students/components/StudentProfileModal.vue';

const props = defineProps({
    group: {
        type: Object,
        default: null
    },
    assessmentType: {
        type: String,
        default: 'examination'
    }
});

const searchQuery = ref('');
const sortColumn = ref('studentName');
const sortDirection = ref('asc');
const assessments = ref([]);
const students = ref([]);
const isLoading = ref(false);

function toggleSort(column) {
    if (sortColumn.value === column) {
        sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn.value = column;
        sortDirection.value = 'asc';
    }
}

const { students: enrichedStudents, loadExamData, meets, tasks, groupsMap } = useSummaryData();
const showProfileModal = ref(false);
const profileStudent = ref(null);

// Load data when group or assessment type changes
watch([() => props.group, () => props.assessmentType], async () => {
    await loadData();
}, { immediate: true });

async function loadData() {
    if (!props.group) {
        assessments.value = [];
        return;
    }

    isLoading.value = true;
    try {
        // Get all final assessments
        const allAssessments = await summaryService.getAllFinalAssessments();

        // Get students for this specific group
        const groupStudents = await summaryService.getMembersByGroup(props.group.name);
        students.value = groupStudents;

        // Load enriched exam data for profile modal
        await loadExamData(props.group, [], 70, 60, true, '5-scale', 0, props.assessmentType);

        const groupStudentIds = new Set(groupStudents.map(s => s.id));

        assessments.value = allAssessments
            .filter(a =>
                groupStudentIds.has(a.studentId) &&
                a.assessmentType === props.assessmentType
            )
            .map(a => {
                const student = groupStudents.find(s => s.id === a.studentId);
                return {
                    ...a,
                    studentName: student?.name || 'Unknown',
                    studentId: a.studentId
                };
            });
    } catch (error) {
        console.error('Failed to load assessments:', error);
    } finally {
        isLoading.value = false;
    }
}
// Filter and Sort Assessments
const filteredAssessments = computed(() => {
    let result = assessments.value;

    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        result = result.filter(a =>
            a.studentName.toLowerCase().includes(query)
        );
    }

    return result.sort((a, b) => {
        const aVal = a[sortColumn.value];
        const bVal = b[sortColumn.value];

        if (sortDirection.value === 'asc') {
            return aVal > bVal ? 1 : -1;
        }
        return aVal < bVal ? 1 : -1;
    });
});


async function toggleSynced(assessment) {
    const newSyncedAt = assessment.syncedAt ? null : new Date().toISOString();
    await summaryService.updateAssessmentSyncStatus(assessment.id, newSyncedAt);
    assessment.syncedAt = newSyncedAt;
}

async function toggleDocumented(assessment) {
    const newDocumentedAt = assessment.documentedAt ? null : new Date().toISOString();
    await summaryService.updateAssessmentDocumentStatus(assessment.id, newDocumentedAt);
    assessment.documentedAt = newDocumentedAt;
}

function formatDateSplit(dateString) {
    if (!dateString) return { line1: '-', line2: '' };
    const date = new Date(dateString);
    const line1 = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
    const line2 = date.getFullYear();
    return { line1, line2 };
}

// Helper to convert percentage (0-100) to 5-scale
function percentToFiveScale(percent) {
    if (percent >= 90) return 5;
    if (percent >= 75) return 4;
    if (percent >= 60) return 3;
    if (percent >= 35) return 2;
    return 1;
}

// Helper to convert percentage (0-100) to ECTS
function percentToECTS(percent) {
    if (percent >= 90) return 'A';
    if (percent >= 82) return 'B';
    if (percent >= 75) return 'C';
    if (percent >= 67) return 'D';
    if (percent >= 60) return 'E';
    if (percent >= 35) return 'FX';
    return 'F';
}

function getGradeDisplay(assessment) {
    const grade = assessment.grade;
    if (!grade && grade !== 0) return '-';

    // Use stored format if available
    // For backwards compatibility: if no format is stored and grade > 5, assume 100-scale
    const format = assessment.gradeFormat || (grade > 5 ? '100-scale' : '5-scale');

    let fiveScale, hundredScale, ects;

    if (format === '5-scale') {
        // Grade is stored as 1-5, convert to other formats
        fiveScale = grade;
        // Convert 5-scale to 100-scale
        const fiveToHundred = {
            5: 95,
            4: 82,
            3: 67,
            2: 47,
            1: 20
        };
        hundredScale = fiveToHundred[grade] || grade;
        ects = percentToECTS(hundredScale);
    } else if (format === '100-scale') {
        // Grade is stored as 0-100, convert to other formats
        fiveScale = percentToFiveScale(grade);
        hundredScale = grade;
        ects = percentToECTS(grade);
    } else if (format === 'ects') {
        // Grade is stored as ECTS letter, convert to other formats
        const ectsToPercent = {
            'A': 95, 'B': 82, 'C': 75, 'D': 67, 'E': 60, 'FX': 47, 'F': 20
        };
        hundredScale = ectsToPercent[grade] || 0;
        fiveScale = percentToFiveScale(hundredScale);
        ects = grade;
    }

    return `${fiveScale} / ${hundredScale} / ${ects}`;
}

function openProfile(studentId) {
    const student = enrichedStudents.value.find(s => s.id === studentId);
    if (student) {
        profileStudent.value = student;
        showProfileModal.value = true;
    }
}
</script>

<template>
    <div class="space-y-4">
        <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">{{ $t('summary.documents.title') }}</h3>
        </div>

        <!-- Search -->
        <div class="relative">
            <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input v-model="searchQuery" type="text" :placeholder="$t('summary.documents.searchPlaceholder')"
                class="pl-8 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>

        <div class="border rounded-lg overflow-hidden bg-card shadow-sm">
            <div class="overflow-x-auto overflow-visible">
                <table class="w-full text-sm text-left">
                    <thead class="bg-muted/50 text-muted-foreground font-medium border-b">
                        <tr>
                            <th class="p-3 w-10 text-center">#</th>
                            <th class="p-3 min-w-[150px] cursor-pointer hover:text-foreground transition-colors"
                                @click="toggleSort('studentName')">
                                <div class="flex items-center gap-1">
                                    {{ $t('summary.documents.table.student') }}
                                    <ArrowUpDown v-if="sortColumn !== 'studentName'" class="w-3 h-3 opacity-50" />
                                    <ArrowUp v-else-if="sortDirection === 'asc'" class="w-3 h-3 text-primary" />
                                    <ArrowDown v-else class="w-3 h-3 text-primary" />
                                </div>
                            </th>
                            <th class="p-3 text-center min-w-[150px] cursor-pointer hover:text-foreground transition-colors"
                                @click="toggleSort('grade')">
                                <div class="flex items-center justify-center gap-1">
                                    {{ $t('summary.documents.table.grade') }}
                                    <ArrowUpDown v-if="sortColumn !== 'grade'" class="w-3 h-3 opacity-50" />
                                    <ArrowUp v-else-if="sortDirection === 'asc'" class="w-3 h-3 text-primary" />
                                    <ArrowDown v-else class="w-3 h-3 text-primary" />
                                </div>
                            </th>
                            <th class="p-3 text-center min-w-[100px] cursor-pointer hover:text-foreground transition-colors"
                                @click="toggleSort('assessmentType')">
                                <div class="flex items-center justify-center gap-1">
                                    {{ $t('summary.documents.table.assessmentType') }}
                                    <ArrowUpDown v-if="sortColumn !== 'assessmentType'" class="w-3 h-3 opacity-50" />
                                    <ArrowUp v-else-if="sortDirection === 'asc'" class="w-3 h-3 text-primary" />
                                    <ArrowDown v-else class="w-3 h-3 text-primary" />
                                </div>
                            </th>
                            <th class="p-3 text-center min-w-[100px] cursor-pointer hover:text-foreground transition-colors"
                                @click="toggleSort('createdAt')">
                                <div class="flex items-center justify-center gap-1">
                                    {{ $t('summary.documents.table.createdAt') }}
                                    <ArrowUpDown v-if="sortColumn !== 'createdAt'" class="w-3 h-3 opacity-50" />
                                    <ArrowUp v-else-if="sortDirection === 'asc'" class="w-3 h-3 text-primary" />
                                    <ArrowDown v-else class="w-3 h-3 text-primary" />
                                </div>
                            </th>
                            <th class="p-3 text-center min-w-[100px] cursor-pointer hover:text-foreground transition-colors"
                                @click="toggleSort('syncedAt')">
                                <div class="flex items-center justify-center gap-1">
                                    {{ $t('summary.documents.table.syncedAt') }}
                                    <ArrowUpDown v-if="sortColumn !== 'syncedAt'" class="w-3 h-3 opacity-50" />
                                    <ArrowUp v-else-if="sortDirection === 'asc'" class="w-3 h-3 text-primary" />
                                    <ArrowDown v-else class="w-3 h-3 text-primary" />
                                </div>
                            </th>
                            <th class="p-3 text-center min-w-[100px] cursor-pointer hover:text-foreground transition-colors"
                                @click="toggleSort('documentedAt')">
                                <div class="flex items-center justify-center gap-1">
                                    {{ $t('summary.documents.table.documentedAt') }}
                                    <ArrowUpDown v-if="sortColumn !== 'documentedAt'" class="w-3 h-3 opacity-50" />
                                    <ArrowUp v-else-if="sortDirection === 'asc'" class="w-3 h-3 text-primary" />
                                    <ArrowDown v-else class="w-3 h-3 text-primary" />
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        <tr v-for="(assessment, index) in filteredAssessments" :key="assessment.id"
                            class="hover:bg-muted/50 transition-colors">
                            <td class="p-3 text-center text-muted-foreground">{{ index + 1 }}</td>
                            <td class="p-3 font-medium cursor-pointer hover:text-primary hover:underline hover:decoration-dashed underline-offset-4 transition-colors"
                                @click="openProfile(assessment.studentId)">
                                {{ assessment.studentName }}
                            </td>
                            <td class="p-3 text-center font-mono font-bold text-primary">
                                {{ getGradeDisplay(assessment) }}
                            </td>
                            <td class="p-3 text-center">
                                <span
                                    class="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                                    {{ $t(`summary.types.${assessment.assessmentType}`) }}
                                </span>
                            </td>
                            <td class="p-3 text-center text-muted-foreground text-xs">
                                <div v-if="assessment.createdAt" class="flex flex-col items-center leading-tight">
                                    <Calendar class="w-4 h-4 mb-0.5" />
                                    <span class="font-medium">{{ formatDateSplit(assessment.createdAt).line1 }}</span>
                                    <span class="text-[10px] opacity-70">{{ formatDateSplit(assessment.createdAt).line2
                                        }}</span>
                                </div>
                                <span v-else>-</span>
                            </td>
                            <td class="p-3 text-center">
                                <div class="flex items-center justify-center gap-2">
                                    <div v-if="assessment.syncedAt"
                                        class="flex flex-col items-center text-xs text-muted-foreground leading-tight">
                                        <Calendar class="w-4 h-4 mb-0.5" />
                                        <span class="font-medium">{{ formatDateSplit(assessment.syncedAt).line1
                                            }}</span>
                                        <span class="text-[10px] opacity-70">{{
                                            formatDateSplit(assessment.syncedAt).line2 }}</span>
                                    </div>
                                    <span v-else class="text-muted-foreground">-</span>
                                    <button @click="toggleSynced(assessment)" class="p-1.5 rounded-md transition-colors"
                                        :class="assessment.syncedAt ? 'text-green-600 hover:bg-green-50' : 'text-muted-foreground hover:text-primary hover:bg-muted'"
                                        :title="assessment.syncedAt ? $t('summary.documents.tooltips.markAsUnsynced') : $t('summary.documents.tooltips.markAsSynced')">
                                        <CircleCheckBig class="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                            <td class="p-3 text-center">
                                <div class="flex items-center justify-center gap-2">
                                    <div v-if="assessment.documentedAt"
                                        class="flex flex-col items-center text-xs text-muted-foreground leading-tight">
                                        <Calendar class="w-4 h-4 mb-0.5" />
                                        <span class="font-medium">{{ formatDateSplit(assessment.documentedAt).line1
                                            }}</span>
                                        <span class="text-[10px] opacity-70">{{
                                            formatDateSplit(assessment.documentedAt).line2 }}</span>
                                    </div>
                                    <span v-else class="text-muted-foreground">-</span>
                                    <button @click="toggleDocumented(assessment)"
                                        class="p-1.5 rounded-md transition-colors"
                                        :class="assessment.documentedAt ? 'text-blue-600 hover:bg-blue-50' : 'text-muted-foreground hover:text-primary hover:bg-muted'"
                                        :title="assessment.documentedAt ? $t('summary.documents.tooltips.markAsUndocumented') : $t('summary.documents.tooltips.markAsDocumented')">
                                        <FileCheck class="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div v-if="filteredAssessments.length === 0" class="text-center py-12 text-muted-foreground">
            {{ searchQuery ? 'No students match your search.' : 'No assessments found for this group.' }}
        </div>

        <StudentProfileModal :is-open="showProfileModal" :student="profileStudent" :meets="meets"
            :groups-map="groupsMap" :tasks="tasks" @close="showProfileModal = false" />
    </div>
</template>
