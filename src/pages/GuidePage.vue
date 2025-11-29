<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { File, LayoutDashboard, Users, UserRoundSearch, Star, Settings, BookOpen, Database } from 'lucide-vue-next';

const { t, tm } = useI18n();

// Helper function to get detail items
const getDetailItems = (basePath) => {
    const details = tm(basePath);
    return Object.keys(details).map(key => details[key]);
};

// Create sections from translations
const sections = computed(() => [
    {
        id: 'intro',
        title: t('guide.intro.title'),
        icon: BookOpen,
        content: t('guide.intro.content'),
        details: [
            {
                title: t('guide.intro.whatMakesDifferent'),
                items: getDetailItems('guide.intro.details').slice(0, 5)
            },
            {
                title: t('guide.intro.importantToKnow'),
                items: getDetailItems('guide.intro.details').slice(5, 10)
            }
        ],
        hasImage: false
    },
    {
        id: 'reports',
        title: t('guide.reports.title'),
        icon: File,
        content: t('guide.reports.content'),
        details: [
            {
                title: t('guide.reports.howToUse'),
                items: getDetailItems('guide.reports.details').slice(0, 5)
            },
            {
                title: t('guide.reports.whatYouGet'),
                items: getDetailItems('guide.reports.details').slice(5, 8)
            }
        ],
        hasImage: true
    },
    {
        id: 'analytics',
        title: t('guide.analytics.title'),
        icon: LayoutDashboard,
        content: t('guide.analytics.content'),
        details: [
            {
                title: t('guide.analytics.howToUse'),
                items: getDetailItems('guide.analytics.details').slice(0, 6)
            },
            {
                title: t('guide.analytics.whatYouGet'),
                items: getDetailItems('guide.analytics.details').slice(6, 9)
            }
        ],
        hasImage: true
    },
    {
        id: 'groups',
        title: t('guide.groups.title'),
        icon: Users,
        content: t('guide.groups.content'),
        details: [
            {
                title: t('guide.groups.howToUse'),
                items: getDetailItems('guide.groups.details').slice(0, 6)
            },
            {
                title: t('guide.groups.whatYouGet'),
                items: getDetailItems('guide.groups.details').slice(6, 11)
            }
        ],
        hasImage: true
    },
    {
        id: 'students',
        title: t('guide.students.title'),
        icon: UserRoundSearch,
        content: t('guide.students.content'),
        details: [
            {
                title: t('guide.students.howToUse'),
                items: getDetailItems('guide.students.details').slice(0, 8)
            },
            {
                title: t('guide.students.whatYouGet'),
                items: getDetailItems('guide.students.details').slice(8, 15)
            }
        ],
        hasImage: true
    },
    {
        id: 'marks',
        title: t('guide.marks.title'),
        icon: Star,
        content: t('guide.marks.content'),
        details: [
            {
                title: t('guide.marks.howToUse'),
                items: getDetailItems('guide.marks.details').slice(0, 8)
            },
            {
                title: t('guide.marks.whatYouGet'),
                items: getDetailItems('guide.marks.details').slice(8, 16)
            }
        ],
        hasImage: true
    },
    {
        id: 'settings',
        title: t('guide.settings.title'),
        icon: Settings,
        content: t('guide.settings.content'),
        details: [
            {
                title: t('guide.settings.howToUse'),
                items: getDetailItems('guide.settings.details').slice(0, 8)
            },
            {
                title: t('guide.settings.whatYouGet'),
                items: getDetailItems('guide.settings.details').slice(8, 16)
            }
        ],
        hasImage: true
    },
    {
        id: 'workspaces',
        title: t('guide.workspaces.title'),
        icon: Database,
        content: t('guide.workspaces.content'),
        details: [
            {
                title: t('guide.workspaces.howToUse'),
                items: getDetailItems('guide.workspaces.details').slice(0, 5)
            },
            {
                title: t('guide.workspaces.whatYouGet'),
                items: getDetailItems('guide.workspaces.details').slice(5, 13)
            }
        ],
        hasImage: true
    }
]);

const activeSection = ref('intro');
let observer = null;

function scrollToSection(id) {
    activeSection.value = id;
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

function setupScrollObserver() {
    // Create an Intersection Observer to track which section is in view
    const options = {
        root: null, // viewport
        rootMargin: '-20% 0px -70% 0px', // Trigger when section is in the top 30% of viewport
        threshold: 0
    };

    observer = new IntersectionObserver((entries) => {
        // Find the entry that is intersecting and has the highest intersection ratio
        const visibleEntries = entries.filter(entry => entry.isIntersecting);

        if (visibleEntries.length > 0) {
            // Sort by intersection ratio and get the most visible one
            visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
            const mostVisible = visibleEntries[0];
            activeSection.value = mostVisible.target.id;
        }
    }, options);

    // Observe all section elements
    sections.value.forEach(section => {
        const element = document.getElementById(section.id);
        if (element) {
            observer.observe(element);
        }
    });
}

onMounted(() => {
    // Small delay to ensure DOM is fully rendered
    setTimeout(() => {
        setupScrollObserver();
    }, 100);
});

onUnmounted(() => {
    if (observer) {
        observer.disconnect();
    }
});
</script>

<template>
    <div class="flex gap-8 max-w-6xl mx-auto">
        <!-- Sidebar Navigation -->
        <aside class="w-64 flex-shrink-0 hidden lg:block sticky top-24 h-fit">
            <nav class="space-y-1">
                <a v-for="section in sections" :key="section.id" href="#" @click.prevent="scrollToSection(section.id)"
                    class="flex items-center gap-3 px-4 py-2 rounded-lg transition-colors"
                    :class="activeSection === section.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'">
                    <component :is="section.icon" class="w-4 h-4" />
                    {{ section.title }}
                </a>
            </nav>
        </aside>

        <!-- Main Content -->
        <div class="flex-1 space-y-12 pb-12">
            <div v-for="section in sections" :key="section.id" :id="section.id" class="scroll-mt-24">
                <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 rounded-lg bg-primary/10 text-primary">
                        <component :is="section.icon" class="w-6 h-6" />
                    </div>
                    <h2 class="text-2xl font-bold">{{ section.title }}</h2>
                </div>

                <div class="prose prose-slate max-w-none text-muted-foreground">
                    <p class="text-lg leading-relaxed mb-6">
                        <span v-if="section.details" class="font-bold text-primary block mb-2">TL;DR</span>
                        {{ section.content }}
                    </p>

                    <div v-if="section.details" class="space-y-8 my-8 ">
                        <div v-for="(detail, idx) in section.details" :key="idx" class="bg-card border rounded-xl p-6">
                            <h3 class="text-xl font-semibold text-foreground mb-4">{{ detail.title }}</h3>
                            <ul class="space-y-3 list-none pl-0">
                                <li v-for="(item, i) in detail.items" :key="i" class="flex gap-3 items-start">
                                    <div class="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 flex-shrink-0"></div>
                                    <div class="leading-relaxed">
                                        <h4 class="font-medium text-primary">{{ item.title }}</h4>
                                        <p>{{ item.description }}</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div v-if="section.hasImage"
                    class="border-2 border-dashed border-muted rounded-xl p-12 flex flex-col items-center justify-center text-muted-foreground bg-muted/30">
                    <component :is="section.icon" class="w-12 h-12 mb-4 opacity-50" />
                    <span class="font-medium">Screenshot Placeholder: {{ section.title }} Page</span>
                    <span class="text-sm opacity-75 mt-1">Image will be added here</span>
                </div>
            </div>
        </div>
    </div>
</template>
