import { onMounted, onUnmounted } from 'vue';

export function useModalClose(closeCallback) {
    function handleKeydown(event) {
        if (event.key === 'Escape') {
            closeCallback();
        }
    }

    onMounted(() => {
        window.addEventListener('keydown', handleKeydown);
    });

    onUnmounted(() => {
        window.removeEventListener('keydown', handleKeydown);
    });
}
