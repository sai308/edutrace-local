<script setup>
import { useRouter } from 'vue-router';
import DetailedView from '../components/DetailedView.vue';

const router = useRouter();

defineProps({
    id: {
        type: String,
        required: true
    }
});

function handleBack() {
    router.push({ name: 'Reports' });
}
</script>

<template>
    <DetailedView :id="id" @back="handleBack" />
</template>
