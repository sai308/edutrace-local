import { createRouter, createWebHistory } from 'vue-router';
import ReportsPage from '../pages/ReportsPage.vue';
import AnalyticsPage from '../pages/AnalyticsPage.vue';
import GroupsPage from '../pages/GroupsPage.vue';
import StudentsPage from '../pages/StudentsPage.vue';
import MarksPage from '../pages/MarksPage.vue';
import GuidePage from '../pages/GuidePage.vue';
import AboutPage from '../pages/AboutPage.vue';
import NotFoundPage from '../pages/NotFoundPage.vue';
import DetailedView from '../components/DetailedView.vue';

const routes = [
    {
        path: '/',
        redirect: '/reports'
    },
    {
        path: '/reports',
        name: 'Reports',
        component: ReportsPage
    },
    {
        path: '/students',
        name: 'Students',
        component: StudentsPage
    },
    {
        path: '/reports/:id',
        name: 'ReportDetails',
        component: DetailedView,
        props: true
    },
    {
        path: '/analytics/:id',
        name: 'AnalyticsDetails',
        component: DetailedView,
        props: true
    },
    {
        path: '/analytics',
        name: 'Analytics',
        component: AnalyticsPage
    },
    {
        path: '/groups',
        name: 'Groups',
        component: GroupsPage
    },
    {
        path: '/marks',
        name: 'Marks',
        component: MarksPage
    },
    {
        path: '/exam',
        name: 'Exam',
        component: () => import('../pages/ExamPage.vue')
    },
    {
        path: '/guide',
        name: 'Guide',
        component: GuidePage
    },
    {
        path: '/about',
        name: 'About',
        component: AboutPage
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: NotFoundPage
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(to, from, savedPosition) {
        // 1. If the user clicked the "Back" button, return to their previous position
        if (savedPosition) {
            return savedPosition
        }

        // 2. If moving to a specific anchor (e.g., /page#header), scroll there
        if (to.hash) {
            return {
                el: to.hash,
                behavior: 'smooth',
            }
        }

        // 3. Default: Scroll to the very top
        return { top: 0, behavior: 'smooth' }
    }
});

export default router;
