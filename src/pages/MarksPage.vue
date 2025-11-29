<script setup>
import { onMounted } from 'vue';
import MarksView from '../components/marks/MarksView.vue';
import { useMarks } from '../composables/useMarks';

const {
    groups,
    flatMarks,
    isProcessing,
    allMeetIds,
    allTeachers,
    loadAllData,
    loadSuggestions,
    createGroup,
    processFile,
    toggleSynced,
    deleteMark,
    deleteMarks,
    isLoading
} = useMarks();

onMounted(async () => {
    await Promise.all([
        loadAllData(),
        loadSuggestions()
    ]);
});

function handleProcessFile(payload) {
    processFile(payload.file, payload.groupName);
}

function handleCreateGroup(groupData) {
    createGroup(groupData);
}

function handleToggleSynced(mark) {
    toggleSynced(mark);
}

function handleDeleteMark(id) {
    deleteMark(id);
}

function handleBulkDeleteMarks(ids) {
    deleteMarks(ids);
}
</script>

<template>
    <div class="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <MarksView :marks="flatMarks" :groups="groups" :is-processing="isProcessing" :all-meet-ids="allMeetIds"
            :all-teachers="allTeachers" :is-loading="isLoading" @process-file="handleProcessFile"
            @create-group="handleCreateGroup" @toggle-synced="handleToggleSynced" @delete-mark="handleDeleteMark"
            @bulk-delete-marks="handleBulkDeleteMarks" @refresh="loadAllData" />
    </div>
</template>
