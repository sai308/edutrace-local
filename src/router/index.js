import { createRouter, createWebHistory } from 'vue-router';
import ReportsPage from '../pages/ReportsPage.vue';
import AnalyticsPage from '../pages/AnalyticsPage.vue';
import GroupsPage from '../pages/GroupsPage.vue';
import StudentsPage from '../pages/StudentsPage.vue';
import MarksPage from '../pages/MarksPage.vue';
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
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

export default router;
