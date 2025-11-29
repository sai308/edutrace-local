<script setup>
import { Home, FileQuestion } from 'lucide-vue-next';
</script>

<template>
    <div class="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <div class="bg-muted/30 p-6 rounded-full mb-6">
            <FileQuestion class="w-16 h-16 text-muted-foreground" />
        </div>
        <h1 class="text-4xl font-bold mb-2">{{ $t('notFound.title') }}</h1>
        <p class="text-muted-foreground mb-8 max-w-md">
            {{ $t('notFound.description') }}
        </p>
        <router-link 
            to="/" 
            class="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
            <Home class="w-4 h-4" />
            {{ $t('notFound.goHome') }}
        </router-link>
    </div>
</template>
