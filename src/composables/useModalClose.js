import { onMounted, onUnmounted, watch, toRef } from 'vue';

// Global modal stack to track open modals in order
const modalStack = [];
let escListenerAttached = false;

// Global ESC key handler - only closes the topmost modal
function handleGlobalEscape(event) {
    if (event.key === 'Escape' && modalStack.length > 0) {
        // Get the topmost modal and call its close callback
        const topModal = modalStack[modalStack.length - 1];
        topModal.closeCallback();
    }
}

export function useModalClose(isOpenOrCallback, closeCallback) {
    // Support both old and new API
    // Old: useModalClose(callback)
    // New: useModalClose(isOpenRef, callback)
    let isOpenRef;
    let callback;

    if (typeof isOpenOrCallback === 'function') {
        // Old API: always register (for backwards compatibility)
        callback = isOpenOrCallback;
        isOpenRef = null;
    } else {
        // New API: register only when isOpen is true
        isOpenRef = toRef(isOpenOrCallback);
        callback = closeCallback;
    }

    // Unique identifier for this modal instance
    const modalId = Symbol();

    function registerModal() {
        // Add this modal to the stack if not already there
        if (!modalStack.find(m => m.id === modalId)) {
            modalStack.push({ id: modalId, closeCallback: callback });

            // Attach global listener if not already attached
            if (!escListenerAttached) {
                window.addEventListener('keydown', handleGlobalEscape);
                escListenerAttached = true;
            }
        }
    }

    function unregisterModal() {
        // Remove this modal from the stack
        const index = modalStack.findIndex(m => m.id === modalId);
        if (index !== -1) {
            modalStack.splice(index, 1);
        }

        // Remove global listener if no modals are open
        if (modalStack.length === 0 && escListenerAttached) {
            window.removeEventListener('keydown', handleGlobalEscape);
            escListenerAttached = false;
        }
    }

    if (isOpenRef) {
        // New API: watch isOpen and register/unregister accordingly
        watch(isOpenRef, (isOpen) => {
            if (isOpen) {
                registerModal();
            } else {
                unregisterModal();
            }
        }, { immediate: true });

        // Cleanup on unmount
        onUnmounted(() => unregisterModal());
    } else {
        // Old API: register immediately (backwards compatibility)
        onMounted(() => {
            registerModal();
        });
        // Return cleanup function
        onUnmounted(() => unregisterModal());
    }
}
