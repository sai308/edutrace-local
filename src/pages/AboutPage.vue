<script setup>
import { useI18n } from 'vue-i18n';
import { ExternalLink, Github, Heart, Shield, Zap, Globe, Database, Code2, BookOpen } from 'lucide-vue-next';

const { t } = useI18n();
</script>

<template>
    <div class="max-w-4xl mx-auto space-y-12 pb-12">
        <!-- Hero Section -->
        <div class="text-center space-y-4">
            <h1 class="text-4xl font-bold tracking-tight">{{ $t('about.hero.title') }}</h1>
            <p class="text-xl text-muted-foreground max-w-2xl mx-auto">
                {{ $t('about.hero.subtitle') }}
            </p>
        </div>

        <!-- Project Goals -->
        <div class="space-y-6">
            <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-primary/10 text-primary">
                    <Heart class="w-6 h-6" />
                </div>
                <h2 class="text-2xl font-bold">{{ $t('about.goals.title') }}</h2>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
                <div class="border rounded-lg p-6 space-y-3 bg-card">
                    <div class="flex items-center gap-2">
                        <Shield class="w-5 h-5 text-primary" />
                        <h3 class="font-semibold">{{ $t('about.goals.privacyFirst.title') }}</h3>
                    </div>
                    <p class="text-sm text-muted-foreground">
                        {{ $t('about.goals.privacyFirst.description') }}
                    </p>
                </div>

                <div class="border rounded-lg p-6 space-y-3 bg-card">
                    <div class="flex items-center gap-2">
                        <Zap class="w-5 h-5 text-primary" />
                        <h3 class="font-semibold">{{ $t('about.goals.simplifyWorkflow.title') }}</h3>
                    </div>
                    <p class="text-sm text-muted-foreground">
                        {{ $t('about.goals.simplifyWorkflow.description') }}
                    </p>
                </div>

                <div class="border rounded-lg p-6 space-y-3 bg-card">
                    <div class="flex items-center gap-2">
                        <Globe class="w-5 h-5 text-primary" />
                        <h3 class="font-semibold">{{ $t('about.goals.accessibleFree.title') }}</h3>
                    </div>
                    <p class="text-sm text-muted-foreground">
                        {{ $t('about.goals.accessibleFree.description') }}
                    </p>
                </div>

                <div class="border rounded-lg p-6 space-y-3 bg-card">
                    <div class="flex items-center gap-2">
                        <Database class="w-5 h-5 text-primary" />
                        <h3 class="font-semibold">{{ $t('about.goals.offlineCapable.title') }}</h3>
                    </div>
                    <p class="text-sm text-muted-foreground">
                        {{ $t('about.goals.offlineCapable.description') }}
                    </p>
                </div>
            </div>
        </div>

        <!-- Technologies Used -->
        <div class="space-y-6">
            <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-primary/10 text-primary">
                    <Code2 class="w-6 h-6" />
                </div>
                <h2 class="text-2xl font-bold">{{ $t('about.technologies.title') }}</h2>
            </div>

            <div class="border rounded-lg overflow-hidden bg-card">
                <div class="divide-y">
                    <!-- Core Framework -->
                    <div class="p-4 hover:bg-muted/50 transition-colors">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 rounded-lg bg-[#42b883]/10 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                                            stroke="#42b883" stroke-width="2" stroke-linecap="round"
                                            stroke-linejoin="round" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="font-semibold">{{ $t('about.technologies.vue.name') }}</h3>
                                    <p class="text-sm text-muted-foreground">{{ $t('about.technologies.vue.description')
                                        }}</p>
                                </div>
                            </div>
                            <a href="https://vuejs.org/" target="_blank" rel="noopener noreferrer"
                                class="text-primary hover:underline flex items-center gap-1 flex-shrink-0">
                                <ExternalLink class="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    <!-- Build Tool -->
                    <div class="p-4 hover:bg-muted/50 transition-colors">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 rounded-lg bg-[#646cff]/10 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#646cff" />
                                        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#ffc517" stroke-width="2"
                                            stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="font-semibold">{{ $t('about.technologies.vite.name') }}</h3>
                                    <p class="text-sm text-muted-foreground">{{
                                        $t('about.technologies.vite.description') }}</p>
                                </div>
                            </div>
                            <a href="https://vitejs.dev/" target="_blank" rel="noopener noreferrer"
                                class="text-primary hover:underline flex items-center gap-1 flex-shrink-0">
                                <ExternalLink class="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    <!-- Styling -->
                    <div class="p-4 hover:bg-muted/50 transition-colors">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 rounded-lg bg-[#06b6d4]/10 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 2L2 7v10l10 5 10-5V7l-10-5z" stroke="#06b6d4" stroke-width="2"
                                            stroke-linecap="round" stroke-linejoin="round" />
                                        <path d="M12 22V12M12 12L2 7M12 12l10-5" stroke="#06b6d4" stroke-width="2"
                                            stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="font-semibold">{{ $t('about.technologies.tailwind.name') }}</h3>
                                    <p class="text-sm text-muted-foreground">{{
                                        $t('about.technologies.tailwind.description') }}</p>
                                </div>
                            </div>
                            <a href="https://tailwindcss.com/" target="_blank" rel="noopener noreferrer"
                                class="text-primary hover:underline flex items-center gap-1 flex-shrink-0">
                                <ExternalLink class="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    <!-- Routing -->
                    <div class="p-4 hover:bg-muted/50 transition-colors">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 rounded-lg bg-[#42b883]/10 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none">
                                        <path d="M3 12h18M3 6h18M3 18h18" stroke="#42b883" stroke-width="2"
                                            stroke-linecap="round" />
                                        <circle cx="12" cy="12" r="2" fill="#42b883" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="font-semibold">{{ $t('about.technologies.router.name') }}</h3>
                                    <p class="text-sm text-muted-foreground">{{
                                        $t('about.technologies.router.description') }}</p>
                                </div>
                            </div>
                            <a href="https://router.vuejs.org/" target="_blank" rel="noopener noreferrer"
                                class="text-primary hover:underline flex items-center gap-1 flex-shrink-0">
                                <ExternalLink class="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    <!-- Internationalization -->
                    <div class="p-4 hover:bg-muted/50 transition-colors">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 rounded-lg bg-[#42b883]/10 flex items-center justify-center flex-shrink-0">
                                    <Globe class="w-5 h-5 text-[#42b883]" />
                                </div>
                                <div>
                                    <h3 class="font-semibold">{{ $t('about.technologies.i18n.name') }}</h3>
                                    <p class="text-sm text-muted-foreground">{{
                                        $t('about.technologies.i18n.description') }}</p>
                                </div>
                            </div>
                            <a href="https://kazupon.github.io/vue-i18n/" target="_blank" rel="noopener noreferrer"
                                class="text-primary hover:underline flex items-center gap-1 flex-shrink-0">
                                <ExternalLink class="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    <!-- Data Storage -->
                    <div class="p-4 hover:bg-muted/50 transition-colors">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center flex-shrink-0">
                                    <Database class="w-5 h-5 text-[#f59e0b]" />
                                </div>
                                <div>
                                    <h3 class="font-semibold">{{ $t('about.technologies.idb.name') }}</h3>
                                    <p class="text-sm text-muted-foreground">{{ $t('about.technologies.idb.description')
                                        }}</p>
                                </div>
                            </div>
                            <a href="https://github.com/jakearchibald/idb" target="_blank" rel="noopener noreferrer"
                                class="text-primary hover:underline flex items-center gap-1 flex-shrink-0">
                                <ExternalLink class="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    <!-- CSV Parsing -->
                    <div class="p-4 hover:bg-muted/50 transition-colors">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 rounded-lg bg-[#10b981]/10 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none">
                                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="#10b981"
                                            stroke-width="2" />
                                        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="#10b981" stroke-width="2" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="font-semibold">{{ $t('about.technologies.papaparse.name') }}</h3>
                                    <p class="text-sm text-muted-foreground">{{
                                        $t('about.technologies.papaparse.description') }}</p>
                                </div>
                            </div>
                            <a href="https://www.papaparse.com/" target="_blank" rel="noopener noreferrer"
                                class="text-primary hover:underline flex items-center gap-1 flex-shrink-0">
                                <ExternalLink class="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    <!-- Icons -->
                    <div class="p-4 hover:bg-muted/50 transition-colors">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 rounded-lg bg-[#f56565]/10 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="#f56565" stroke-width="2" />
                                        <path d="M8 12h8M12 8v8" stroke="#f56565" stroke-width="2"
                                            stroke-linecap="round" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="font-semibold">{{ $t('about.technologies.lucide.name') }}</h3>
                                    <p class="text-sm text-muted-foreground">{{
                                        $t('about.technologies.lucide.description') }}</p>
                                </div>
                            </div>
                            <a href="https://lucide.dev/" target="_blank" rel="noopener noreferrer"
                                class="text-primary hover:underline flex items-center gap-1 flex-shrink-0">
                                <ExternalLink class="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    <!-- VueUse -->
                    <div class="p-4 hover:bg-muted/50 transition-colors">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 rounded-lg bg-[#42b883]/10 flex items-center justify-center flex-shrink-0">
                                    <Zap class="w-5 h-5 text-[#42b883]" />
                                </div>
                                <div>
                                    <h3 class="font-semibold">{{ $t('about.technologies.vueuse.name') }}</h3>
                                    <p class="text-sm text-muted-foreground">{{
                                        $t('about.technologies.vueuse.description') }}</p>
                                </div>
                            </div>
                            <a href="https://vueuse.org/" target="_blank" rel="noopener noreferrer"
                                class="text-primary hover:underline flex items-center gap-1 flex-shrink-0">
                                <ExternalLink class="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Guide -->
        <div class="border rounded-lg p-6 bg-card space-y-4">
            <div class="flex items-center gap-3">
                <BookOpen class="w-6 h-6 text-primary" />
                <h2 class="text-2xl font-bold">{{ $t('about.guide.title') }}</h2>
            </div>
            <p class="text-muted-foreground">
                {{ $t('about.guide.description') }}
            </p>
            <router-link to="/guide"
                class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                <BookOpen class="w-4 h-4" />
                {{ $t('about.guide.button') }}
            </router-link>
        </div>

        <!-- Open Source -->
        <div class="border rounded-lg p-6 bg-card space-y-4">
            <div class="flex items-center gap-3">
                <Github class="w-6 h-6 text-primary" />
                <h2 class="text-2xl font-bold">{{ $t('about.openSource.title') }}</h2>
            </div>
            <p class="text-muted-foreground">
                {{ $t('about.openSource.description') }}
            </p>
            <a href="https://github.com/sai308/edutrace-local" target="_blank" rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                <Github class="w-4 h-4" />
                {{ $t('about.openSource.button') }}
                <ExternalLink class="w-4 h-4" />
            </a>
        </div>

        <!-- Version Info -->
        <div class="text-center text-sm text-muted-foreground">
            <p>{{ $t('about.footer') }}</p>
        </div>
    </div>
</template>
