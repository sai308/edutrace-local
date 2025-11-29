<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Logs, LayoutDashboard, File, Settings, Users, UserRoundSearch, Star, BookOpen } from 'lucide-vue-next';
import SettingsModal from './components/SettingsModal.vue';
import WorkspaceSwitcher from './components/WorkspaceSwitcher.vue';
import ToastContainer from './components/ToastContainer.vue';
import AppFooter from './components/AppFooter.vue';
import { useMeets } from './composables/useMeets';

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
          <WorkspaceSwitcher />
          <button @click="openSettings" class="p-2 hover:bg-muted rounded-full transition-colors"
            :title="$t('app.settings')">
            <Settings class="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>

    <main class="container mx-auto px-4 py-4 md:py-8 space-y-0 md:space-y-8">
      <!-- Desktop Navigation Tabs -->
      <div v-if="route.name !== 'ReportDetails'" class="hidden md:flex items-center gap-4 border-b pb-px overflow-x-auto">
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

    <!-- Mobile Bottom Navigation -->
    <nav v-if="route.name !== 'ReportDetails'"
      class="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-40 pb-safe">
      <div class="flex items-center justify-around h-16">
        <router-link to="/reports"
          class="flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] font-medium transition-colors"
          :class="route.path.startsWith('/reports') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'">
          <File class="w-5 h-5" />
          <span>{{ $t('nav.reports') }}</span>
        </router-link>
        <router-link to="/analytics"
          class="flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] font-medium transition-colors"
          :class="route.path.startsWith('/analytics') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'">
          <LayoutDashboard class="w-5 h-5" />
          <span>{{ $t('nav.analytics') }}</span>
        </router-link>
        <router-link to="/groups"
          class="flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] font-medium transition-colors"
          :class="route.path === '/groups' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'">
          <Users class="w-5 h-5" />
          <span>{{ $t('nav.groups') }}</span>
        </router-link>
        <router-link to="/students"
          class="flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] font-medium transition-colors"
          :class="route.path === '/students' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'">
          <UserRoundSearch class="w-5 h-5" />
          <span>{{ $t('nav.students') }}</span>
        </router-link>
        <router-link to="/marks"
          class="flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] font-medium transition-colors"
          :class="route.path === '/marks' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'">
          <Star class="w-5 h-5" />
          <span>{{ $t('nav.marks') }}</span>
        </router-link>
      </div>
    </nav>

    <!-- Footer -->
    <AppFooter />

    <!-- Settings Modal -->
    <SettingsModal :is-open="showSettings" @close="showSettings = false" @refresh="handleSettingsRefresh" />

    <ToastContainer />
  </div>
</template>
