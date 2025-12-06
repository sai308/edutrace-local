<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import DropZone from '@/components/DropZone.vue';
import ReportsList from '../components/ReportsList.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import CsvFilterModal from '@/components/CsvFilterModal.vue';
import { useMeets } from '@/modules/Analytics/composables/useMeets';
import { useReportProcessing } from '../composables/useReportProcessing';
import { toast } from '@/services/toast';

const router = useRouter();
const { meets, groupsMap, loadMeets, deleteMeet, bulkDeleteMeets } = useMeets();
const { isProcessing, showFilterModal, pendingFiles, handleFilesDropped, processFiles, cancelFilter } = useReportProcessing();

// Load data on mount
onMounted(() => {
    loadMeets();
});

// File handling
function onFilesDropped(files) {
    handleFilesDropped(files, () => { });
}

function onFilterConfirm(mode) {
    processFiles(mode);
}

// Delete handling
const showDeleteConfirm = ref(false);
const meetToDeleteId = ref(null);
function handleDeleteMeet(id) {
    meetToDeleteId.value = id;
    showDeleteConfirm.value = true;
}
async function executeDeleteMeet() {
    if (!meetToDeleteId.value) return;
    try {
        await deleteMeet(meetToDeleteId.value);
        toast.success('Report deleted successfully');
    } catch (e) {
        console.error('Error deleting report:', e);
        toast.error('Failed to delete report');
    } finally {
        showDeleteConfirm.value = false;
        meetToDeleteId.value = null;
    }
}
async function handleBulkDelete(ids) {
    try {
        await bulkDeleteMeets(ids);
        toast.success(`Deleted ${ids.length} reports.`);
    } catch (e) {
        console.error('Error deleting reports:', e);
        toast.error('Failed to delete reports.');
    }
}
function handleViewDetails(id) {
    router.push({ name: 'ReportDetails', params: { id } });
}
</script>

<template>
    <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <DropZone :is-processing="isProcessing" @files-dropped="onFilesDropped"
            :prompt="$t('dropZone.reportsPrompt')" />
        <ReportsList :meets="meets" :groups-map="groupsMap" @view-details="handleViewDetails"
            @delete-meet="handleDeleteMeet" @bulk-delete="handleBulkDelete" />
        <ConfirmModal :is-open="showDeleteConfirm" title="Delete Report"
            message="Are you sure you want to delete this report? This action cannot be undone." confirm-text="Delete"
            variant="danger" @confirm="executeDeleteMeet" @cancel="showDeleteConfirm = false" />
        <CsvFilterModal :is-open="showFilterModal" :files-count="pendingFiles.length" @confirm="onFilterConfirm"
            @cancel="cancelFilter" />
    </div>
</template>