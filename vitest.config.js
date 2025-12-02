import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            environment: 'jsdom', // gives you window, localStorage, etc.
            globals: true,
            setupFiles: [
                './tests/setup/env.js',
                './tests/setup/db.js',
            ],
            restoreMocks: true,
            clearMocks: true,
            mockReset: true,
        },
    })
);
