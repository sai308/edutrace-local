import { ref } from 'vue';

const toasts = ref([]);

let idCounter = 0;

export const toast = {
    add(message, type = 'info', duration = 3000) {
        const id = idCounter++;
        toasts.value.push({ id, message, type });
        if (duration > 0) {
            setTimeout(() => {
                this.remove(id);
            }, duration);
        }
    },
    remove(id) {
        const index = toasts.value.findIndex(t => t.id === id);
        if (index !== -1) {
            toasts.value.splice(index, 1);
        }
    },
    success(message, duration) {
        this.add(message, 'success', duration);
    },
    error(message, duration) {
        this.add(message, 'error', duration);
    },
    info(message, duration) {
        this.add(message, 'info', duration);
    },
    warning(message, duration) {
        this.add(message, 'warning', duration);
    }
};

export function useToast() {
    return { toasts, toast };
}
