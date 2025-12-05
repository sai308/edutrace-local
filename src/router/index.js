import { createRouter, createWebHistory } from 'vue-router';
import NotFoundPage from '../pages/NotFoundPage.vue';

const routes = [
    {
        path: '/',
        redirect: '/reports'
    },
    {
        path: '/reports',
        name: 'Reports',
        component: () => import('../pages/ReportsPage.vue')
    },
    {
        path: '/students',
        name: 'Students',
        component: () => import('../pages/StudentsPage.vue')
    },
    {
        path: '/reports/:id',
        name: 'ReportDetails',
        component: () => import('../pages/ReportDetailsPage.vue'),
        props: true
    },
    {
        path: '/analytics/:id',
        name: 'AnalyticsDetails',
        component: () => import('../pages/AnalyticsDetailsPage.vue'),
        props: true
    },
    {
        path: '/analytics',
        name: 'Analytics',
        component: () => import('../pages/AnalyticsPage.vue')
    },
    {
        path: '/groups',
        name: 'Groups',
        component: () => import('../pages/GroupsPage.vue')
    },
    {
        path: '/marks',
        name: 'Marks',
        component: () => import('../pages/MarksPage.vue')
    },
    {
        path: '/summary',
        name: 'Summary',
        component: () => import('../pages/ExamPage.vue')
    },
    {
        path: '/guide',
        name: 'Guide',
        component: () => import('../pages/GuidePage.vue')
    },
    {
        path: '/about',
        name: 'About',
        component: () => import('../pages/AboutPage.vue')
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
