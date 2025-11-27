<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { repository } from '../services/repository';
import { useModalClose } from '../composables/useModalClose';
import {
    Database, Plus, Check, Trash2, X, Download, AlertTriangle, HelpCircle,
    GraduationCap, BookOpen, NotebookPen, NotebookText, BriefcaseBusiness,
    Atom, Code, Binary, BugOff, ScrollText, SquareTerminal, FlaskConical,
    UsersRound, Scale, Calendar, Globe, PencilRuler, PenTool
} from 'lucide-vue-next';

const router = useRouter();

const icons = {
    Database, GraduationCap, BookOpen, NotebookPen, NotebookText, BriefcaseBusiness,
    Atom, Code, Binary, BugOff, ScrollText, SquareTerminal, FlaskConical,
    UsersRound, Scale, Calendar, Globe, PencilRuler, PenTool
};

const iconList = Object.keys(icons).filter(k => k !== 'Database'); // Database is default/fallback, not in picker? Or maybe in picker too? User said "add 6x3 icons grid with the next Lucide icons", list didn't include Database.
// User list: graduation-cap, book-open, ... (18 icons). 6x3 = 18.
// So Database is NOT in the grid. It's the fallback.

const isOpen = ref(false);
const workspaces = ref([]);
const currentWorkspaceId = ref('');

// Create Modal State
const showCreateModal = ref(false);
const newWorkspaceName = ref('');
const exportSettings = ref(true);
const selectedIcon = ref('Database'); // Default to Database if none selected? Or maybe 'GraduationCap'? User said "Default workspace has no icon, if no icon exist ... show currently use 'database' icon".
// For new workspace, user picks one.
// Let's default selectedIcon to one of the list or Database?
// "In the create modal add 6x3 icons grid"
// I'll default to the first one in the list or just keep 'Database' as internal default but let user pick from grid.


// Delete Modal State
const showDeleteModal = ref(false);
const workspaceToDelete = ref(null);
const deleteConfirmationName = ref('');

function loadWorkspaces() {
    workspaces.value = repository.getWorkspaces();
    currentWorkspaceId.value = repository.getCurrentWorkspaceId();
}

onMounted(() => {
    loadWorkspaces();
});

const currentWorkspaceName = computed(() => {
    const ws = workspaces.value.find(w => w.id === currentWorkspaceId.value);
    return ws ? ws.name : 'Default';
});

async function handleSwitch(id) {
    if (id === currentWorkspaceId.value) return;
    await repository.switchWorkspace(id);
}

async function handleCreate() {
    if (!newWorkspaceName.value.trim()) return;

    const name = newWorkspaceName.value;
    const options = {
        exportSettings: exportSettings.value,
        icon: selectedIcon.value
    };

    // Close modal FIRST to avoid UI glitch during reload
    showCreateModal.value = false;
    newWorkspaceName.value = '';
    selectedIcon.value = 'Database'; // Reset

    const id = await repository.createWorkspace(name, options);

    // Auto-switch to new workspace for better UX
    await handleSwitch(id);
}

function openDeleteModal(ws) {
    workspaceToDelete.value = ws;
    deleteConfirmationName.value = '';
    showDeleteModal.value = true;
    isOpen.value = false; // Close dropdown
}

async function handleDelete() {
    if (!workspaceToDelete.value) return;
    if (deleteConfirmationName.value !== workspaceToDelete.value.name) return;

    await repository.deleteWorkspace(workspaceToDelete.value.id);

    showDeleteModal.value = false;
    workspaceToDelete.value = null;
    deleteConfirmationName.value = '';
    loadWorkspaces();
}

function openWorkspaceGuide() {
    isOpen.value = false;
    router.push({ path: '/guide', hash: '#workspaces' }).then(() => {
        // Wait for next tick to ensure DOM is updated
        setTimeout(() => {
            const element = document.getElementById('workspaces');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }, 300);
    });
}

function openCreateModal() {
    showCreateModal.value = true;
    newWorkspaceName.value = '';
    exportSettings.value = true;
    isOpen.value = false; // Close dropdown
}

useModalClose(() => {
    if (showCreateModal.value) {
        showCreateModal.value = false;
        return;
    }
    if (showDeleteModal.value) {
        showDeleteModal.value = false;
        return;
    }
    if (isOpen.value) {
        isOpen.value = false;
    }
});
</script>

<template>
    <div class="relative">
        <button @click="isOpen = !isOpen"
            class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm font-medium border border-transparent hover:border-border"
            :class="{ 'bg-muted border-border': isOpen }">
            <component :is="icons[workspaces.find(w => w.id === currentWorkspaceId)?.icon || 'Database']"
                class="w-4 h-4 text-primary" />
            <span class="hidden sm:inline">{{ currentWorkspaceName }}</span>
        </button>

        <!-- Dropdown -->
        <div v-if="isOpen"
            class="absolute right-0 top-full mt-2 w-64 bg-card rounded-lg shadow-lg border z-50 animate-in fade-in zoom-in-95 duration-200">
            <div class="p-2 space-y-1">
                <div class="px-2 py-1.5 flex items-center justify-between">
                    <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {{ $t('workspace.title') }}
                    </span>
                    <button @click.stop="openWorkspaceGuide" class="p-1 rounded hover:bg-muted transition-colors"
                        :title="$t('guide.workspaces.title')">
                        <HelpCircle class="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                </div>

                <div v-for="ws in workspaces" :key="ws.id"
                    class="group flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors"
                    :class="{ 'bg-primary/10 text-primary': ws.id === currentWorkspaceId }"
                    @click="handleSwitch(ws.id)">
                    <div class="flex items-center gap-2 truncate">
                        <component :is="icons[ws.icon || 'Database']" class="w-4 h-4"
                            :class="ws.id === currentWorkspaceId ? 'text-primary' : 'text-muted-foreground'" />
                        <span class="text-sm font-medium truncate">{{ ws.name }}</span>
                    </div>

                    <div class="flex items-center gap-1">
                        <Check v-if="ws.id === currentWorkspaceId" class="w-3 h-3" />
                        <button v-if="ws.id !== 'default' && ws.id !== currentWorkspaceId"
                            @click.stop="openDeleteModal(ws)"
                            class="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                            :title="$t('workspace.delete_button')">
                            <Trash2 class="w-3 h-3" />
                        </button>
                    </div>
                </div>

                <div class="h-px bg-border my-1"></div>

                <button @click="openCreateModal"
                    class="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <Plus class="w-4 h-4" />
                    {{ $t('workspace.create_new') }}
                </button>
            </div>
        </div>

        <!-- Backdrop for dropdown -->
        <div v-if="isOpen" @click="isOpen = false" class="fixed inset-0 z-40"></div>

        <!-- Create Modal -->
        <Teleport to="body">
            <div v-if="showCreateModal"
                class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div class="bg-card w-full max-w-md rounded-lg shadow-lg border p-6 animate-in zoom-in-95 duration-200">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold">{{ $t('workspace.create_modal_title') }}</h3>
                        <button @click="showCreateModal = false" class="p-1 hover:bg-muted rounded-full">
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <div class="space-y-4">
                        <div class="space-y-2">
                            <label class="text-sm font-medium">{{ $t('workspace.name_label') }}</label>
                            <input v-model="newWorkspaceName" type="text" placeholder="e.g. 2nd Semester 2024"
                                class="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                                @keyup.enter="handleCreate" autoFocus />
                        </div>

                        <div class="space-y-2">
                            <label class="text-sm font-medium">{{ $t('workspace.icon_label') }}</label>
                            <div class="grid grid-cols-6 gap-2 p-2 border rounded-md bg-muted/20">
                                <button v-for="iconName in iconList" :key="iconName" @click="selectedIcon = iconName"
                                    class="p-2 rounded-md flex items-center justify-center transition-all hover:bg-muted hover:scale-110"
                                    :class="selectedIcon === iconName ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary ring-offset-2' : 'text-muted-foreground'">
                                    <component :is="icons[iconName]" class="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div class="flex items-start gap-3 p-3 rounded-md bg-muted/50 border">
                            <div class="mt-0.5">
                                <input type="checkbox" id="exportSettings" v-model="exportSettings"
                                    class="rounded border-gray-300 text-primary focus:ring-primary" />
                            </div>
                            <label for="exportSettings" class="text-sm cursor-pointer select-none">
                                <div class="font-medium flex items-center gap-2">
                                    <Download class="w-3 h-3" />
                                    {{ $t('workspace.copy_settings') }}
                                </div>
                                <div class="text-muted-foreground text-xs mt-0.5">
                                    {{ $t('workspace.copy_settings_desc') }}
                                </div>
                            </label>
                        </div>

                        <div class="flex justify-end gap-2 pt-2">
                            <button @click="showCreateModal = false"
                                class="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors">
                                {{ $t('workspace.cancel') }}
                            </button>
                            <button @click="handleCreate"
                                class="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
                                :disabled="!newWorkspaceName.trim()">
                                {{ $t('workspace.create_button') }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Delete Confirmation Modal -->
        <Teleport to="body">
            <div v-if="showDeleteModal"
                class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div class="bg-card w-full max-w-md rounded-lg shadow-lg border p-6 animate-in zoom-in-95 duration-200">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold text-destructive flex items-center gap-2">
                            <AlertTriangle class="w-5 h-5" />
                            {{ $t('workspace.delete_modal_title') }}
                        </h3>
                        <button @click="showDeleteModal = false" class="p-1 hover:bg-muted rounded-full">
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <div class="space-y-4">
                        <p class="text-sm text-muted-foreground">
                            {{ $t('workspace.delete_warning', { name: workspaceToDelete?.name }) }}
                        </p>

                        <div class="space-y-2">
                            <label class="text-sm font-medium">
                                <i18n-t keypath="workspace.delete_confirm_label" tag="span">
                                    <template #name>
                                        <span class="font-bold select-all">{{ workspaceToDelete?.name }}</span>
                                    </template>
                                </i18n-t>
                            </label>
                            <input v-model="deleteConfirmationName" type="text"
                                class="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-destructive/50"
                                @keyup.enter="handleDelete" autoFocus />
                        </div>

                        <div class="flex justify-end gap-2 pt-2">
                            <button @click="showDeleteModal = false"
                                class="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors">
                                {{ $t('workspace.cancel') }}
                            </button>
                            <button @click="handleDelete"
                                class="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md transition-colors disabled:opacity-50"
                                :disabled="deleteConfirmationName !== workspaceToDelete?.name">
                                {{ $t('workspace.delete_button') }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
