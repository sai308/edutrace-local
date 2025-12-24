<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Logs, Settings, File, LayoutDashboard, Users, UserRoundSearch, Star, Layers, FileText, FileBadge } from 'lucide-vue-next';
import SettingsModal from './components/SettingsModal.vue';
import AppSidebar from './components/AppSidebar.vue';
import ToastContainer from './components/ToastContainer.vue';
import AppFooter from './components/AppFooter.vue';
import { useMeets } from '@/modules/Analytics/composables/useMeets';

import { fadeOutOnLoad } from './utils/transition';

// State
const router = useRouter();
const route = useRoute();
const dashboardRef = ref(null);

const { meets, groupsMap, loadMeets } = useMeets();

// First-visit redirect
const VISITED_KEY = 'edutrace_has_visited';

function checkFirstVisit() {
  const hasVisited = localStorage.getItem(VISITED_KEY);

  if (!hasVisited) {
    // Mark as visited
    localStorage.setItem(VISITED_KEY, 'true');

    // Redirect to about page if not already there
    if (route.path !== '/about') {
      router.push('/about');
    }
  }
}

// Load initial data
onMounted(() => {
  loadMeets();
  checkFirstVisit();
  fadeOutOnLoad();
});

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
  <div class="min-h-screen bg-background text-foreground transition-colors duration-300 flex flex-col">
    <!-- Sidebar Navigation -->
    <AppSidebar @open-settings="openSettings" />

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col md:ml-60">
      <!-- Header - Temporarily hidden, keeping for future use -->
      <!-- <header class="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
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
      </header> -->

      <main class="container mx-auto px-4 py-4 md:py-8 space-y-0 md:space-y-8 flex-1">
        <!-- Views -->
        <router-view v-slot="{ Component }" :key="refreshKey">
          <Transition name="fade" mode="out-in">
            <component :is="Component" :meets="meets" :groups-map="groupsMap" ref="dashboardRef"
              @view-details="handleViewDetails" @back="handleBack" @group-updated="loadMeets" />
          </Transition>
        </router-view>
      </main>

      <!-- Mobile Bottom Navigation -->
      <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-40 pb-safe">
        <div class="flex items-center justify-around h-16 overflow-x-auto custom-scrollbar">
          <router-link to="/reports"
            class="flex flex-col items-center justify-center min-w-[60px] h-full gap-1 text-[10px] font-medium transition-colors"
            :class="route.path.startsWith('/reports') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'">
            <File class="w-5 h-5" />
            <span>{{ $t('nav.reports') }}</span>
          </router-link>
          <router-link to="/analytics"
            class="flex flex-col items-center justify-center min-w-[60px] h-full gap-1 text-[10px] font-medium transition-colors"
            :class="route.path.startsWith('/analytics') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'">
            <LayoutDashboard class="w-5 h-5" />
            <span>{{ $t('nav.analytics') }}</span>
          </router-link>
          <router-link to="/groups"
            class="flex flex-col items-center justify-center min-w-[60px] h-full gap-1 text-[10px] font-medium transition-colors"
            :class="route.path === '/groups' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'">
            <Users class="w-5 h-5" />
            <span>{{ $t('nav.groups') }}</span>
          </router-link>
          <router-link to="/students"
            class="flex flex-col items-center justify-center min-w-[60px] h-full gap-1 text-[10px] font-medium transition-colors"
            :class="route.path === '/students' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'">
            <UserRoundSearch class="w-5 h-5" />
            <span>{{ $t('nav.students') }}</span>
          </router-link>
          <router-link to="/marks"
            class="flex flex-col items-center justify-center min-w-[60px] h-full gap-1 text-[10px] font-medium transition-colors"
            :class="route.path === '/marks' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'">
            <Star class="w-5 h-5" />
            <span>{{ $t('nav.marks') }}</span>
          </router-link>
          <router-link to="/modules"
            class="flex flex-col items-center justify-center min-w-[60px] h-full gap-1 text-[10px] font-medium transition-colors"
            :class="route.path === '/modules' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'">
            <Layers class="w-5 h-5" />
            <span>{{ $t('nav.modules') }}</span>
          </router-link>
          <router-link to="/summary"
            class="flex flex-col items-center justify-center min-w-[60px] h-full gap-1 text-[10px] font-medium transition-colors"
            :class="route.path === '/summary' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'">
            <FileBadge class="w-5 h-5" />
            <span>{{ $t('nav.summary') }}</span>
          </router-link>
          <router-link to="/documents"
            class="flex flex-col items-center justify-center min-w-[60px] h-full gap-1 text-[10px] font-medium transition-colors"
            :class="route.path === '/documents' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'">
            <FileText class="w-5 h-5" />
            <span>{{ $t('nav.documents') }}</span>
          </router-link>
        </div>
      </nav>

      <!-- Settings Modal -->
      <SettingsModal :is-open="showSettings" @close="showSettings = false" @refresh="handleSettingsRefresh" />

      <ToastContainer />
    </div>

    <!-- Footer - positioned below sidebar -->
    <AppFooter class="md:ml-60" />
  </div>
</template>
