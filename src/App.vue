<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Logs, LayoutDashboard, File, Settings, Users, UserRoundSearch, Star } from 'lucide-vue-next';
import SettingsModal from './components/SettingsModal.vue';
import ToastContainer from './components/ToastContainer.vue';
import { useMeets } from './composables/useMeets';

// State
const router = useRouter();
const route = useRoute();
const dashboardRef = ref(null);

const { meets, groupsMap, loadMeets } = useMeets();

// Load initial data
onMounted(loadMeets);

function refreshDashboard() {
  if (dashboardRef.value && typeof dashboardRef.value.refresh === 'function') {
    dashboardRef.value.refresh();
  }
}

function handleViewDetails(id) {
  if (route.path.startsWith('/reports')) {
    router.push({ name: 'ReportDetails', params: { id } });
  } else if (route.path.startsWith('/analytics')) {
    router.push({ name: 'AnalyticsDetails', params: { id } });
  }
}

function handleBack() {
  router.back();
}

// Settings
const showSettings = ref(false);
const refreshKey = ref(0);

function openSettings() {
  showSettings.value = true;
}

async function handleSettingsRefresh() {
  await loadMeets();
  refreshDashboard();
  refreshKey.value++;
}

// Hotkeys
function handleKeydown(e) {
  // Esc to close modals
  if (e.key === 'Escape') {
    if (showSettings.value) showSettings.value = false;
  }

  // Ctrl+, for Settings
  if (e.ctrlKey && e.key === ',') {
    e.preventDefault();
    openSettings();
  }

  // Ctrl+B for Back (if in detailed view)
  if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
    e.preventDefault();
    if (route.name === 'ReportDetails') {
      handleBack();
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="min-h-screen bg-background text-foreground transition-colors duration-300">
    <!-- Header -->
    <header class="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div class="container mx-auto px-4 h-16 flex items-center justify-between">
        <div class="flex items-center gap-2 font-bold text-xl">
          <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
            <Logs class="w-4 h-4 text-cyan-8" />
          </div>
          {{ $t('app.title') }}
        </div>

        <div class="flex items-center gap-4">
          <button @click="openSettings" class="p-2 hover:bg-muted rounded-full transition-colors"
            :title="$t('app.settings')">
            <Settings class="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>

    <main class="container mx-auto px-4 py-8 space-y-8">
      <!-- Navigation Tabs -->
      <div v-if="route.name !== 'ReportDetails'" class="flex items-center gap-4 border-b pb-px overflow-x-auto">
        <router-link to="/reports"
          class="flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap"
          :class="route.path.startsWith('/reports') ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'">
          <File class="w-4 h-4" />
          {{ $t('nav.reports') }}
        </router-link>
        <router-link to="/analytics"
          class="flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap"
          :class="route.path.startsWith('/analytics') ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'">
          <LayoutDashboard class="w-4 h-4" />
          {{ $t('nav.analytics') }}
        </router-link>
        <router-link to="/groups"
          class="flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap"
          :class="route.path === '/groups' ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'">
          <Users class="w-4 h-4" />
          {{ $t('nav.groups') }}
        </router-link>
        <router-link to="/students"
          class="flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap"
          :class="route.path === '/students' ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'">
          <UserRoundSearch class="w-4 h-4" />
          {{ $t('nav.students') }}
        </router-link>
        <router-link to="/marks"
          class="flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap"
          :class="route.path === '/marks' ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'">
          <Star class="w-4 h-4" />
          {{ $t('nav.marks') }}
        </router-link>
      </div>

      <!-- Views -->
      <router-view v-slot="{ Component }" :key="refreshKey">
        <Transition name="fade" mode="out-in">
          <component :is="Component" :meets="meets" :groups-map="groupsMap" ref="dashboardRef"
            @view-details="handleViewDetails" @back="handleBack" @group-updated="loadMeets" />
        </Transition>
      </router-view>
    </main>

    <!-- Settings Modal -->
    <SettingsModal :is-open="showSettings" @close="showSettings = false" @refresh="handleSettingsRefresh" />

    <ToastContainer />
  </div>
</template>
