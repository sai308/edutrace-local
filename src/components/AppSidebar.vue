<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  File,
  LayoutDashboard,
  Users,
  UserRoundSearch,
  Star,
  Layers,
  FileText,
  FileBadge,
  Settings
} from 'lucide-vue-next';
import WorkspaceSwitcher from './WorkspaceSwitcher.vue';

const route = useRoute();

const emit = defineEmits(['open-settings']);

const navigationGroups = [
  {
    label: 'nav.navGroups.attendance',
    items: [
      {
        to: '/reports',
        icon: File,
        label: 'nav.reports',
        isActive: (path) => path.startsWith('/reports')
      },
      {
        to: '/analytics',
        icon: LayoutDashboard,
        label: 'nav.analytics',
        isActive: (path) => path.startsWith('/analytics')
      }
    ]
  },
  {
    label: 'nav.navGroups.organization',
    items: [
      {
        to: '/groups',
        icon: Users,
        label: 'nav.groups',
        isActive: (path) => path === '/groups'
      },
      {
        to: '/students',
        icon: UserRoundSearch,
        label: 'nav.students',
        isActive: (path) => path === '/students'
      },
    ]
  },
  {
    label: 'nav.navGroups.control',
    items: [
      {
        to: '/marks',
        icon: Star,
        label: 'nav.marks',
        isActive: (path) => path === '/marks'
      },
      {
        to: '/modules',
        icon: Layers,
        label: 'nav.modules',
        isActive: (path) => path === '/modules'
      },
      {
        to: '/summary',
        icon: FileBadge,
        label: 'nav.summary',
        isActive: (path) => path === '/summary'
      },
    ]
  },
  {
    label: 'nav.navGroups.documentation',
    items: [
      {
        to: '/documents',
        icon: FileText,
        label: 'nav.documents',
        isActive: (path) => path === '/documents'
      }
    ]
  }
];

const isItemActive = (item) => {
  return item.isActive(route.path);
};
</script>

<template>
  <aside class="hidden md:flex md:flex-col fixed left-0 top-0 h-screen w-60 bg-card border-r z-40">
    <!-- Workspace Picker -->
    <div class="p-4 border-b">
      <WorkspaceSwitcher />
    </div>

    <!-- Navigation Groups -->
    <nav class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
      <div v-for="group in navigationGroups" :key="group.label" class="space-y-1">
        <!-- Group Label -->
        <div class="px-3 py-2">
          <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {{ $t(group.label) }}
          </h3>
        </div>

        <!-- Group Items -->
        <div class="space-y-0.5">
          <router-link v-for="item in group.items" :key="item.to" :to="item.to"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors" :class="isItemActive(item)
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'">
            <component :is="item.icon" class="w-4 h-4 flex-shrink-0" />
            <span>{{ $t(item.label) }}</span>
          </router-link>
        </div>
      </div>
    </nav>

    <!-- Footer with Settings -->
    <div class="border-t p-4">
      <button @click="emit('open-settings')"
        class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
        <Settings class="w-4 h-4 flex-shrink-0" />
        <span>{{ $t('app.settings') }}</span>
      </button>
    </div>
  </aside>
</template>
