import { ref } from 'vue';

export function useFileDrop(emit) {
    const isOver = ref(false);
    const isInvalidDrag = ref(false);
    let dragCounter = 0;

    function checkFileTypes(items) {
        if (!items) return false;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const type = item.type;
                const isValid = type === 'text/csv' ||
                    type === 'application/vnd.ms-excel' ||
                    type === 'application/csv' ||
                    type === 'text/x-csv' ||
                    type === 'application/x-csv' ||
                    type === 'text/comma-separated-values' ||
                    type === 'text/x-comma-separated-values' ||
                    type === '';

                if (!isValid) return false;
            }
        }
        return true;
    }

    function onDragEnter(e) {
        e.preventDefault();
        dragCounter++;

        if (dragCounter === 1) {
            isOver.value = true;
            if (e.dataTransfer && e.dataTransfer.items) {
                isInvalidDrag.value = !checkFileTypes(e.dataTransfer.items);
            }
        }
    }

    function onDragLeave(e) {
        e.preventDefault();
        dragCounter--;

        if (dragCounter === 0) {
            isOver.value = false;
            isInvalidDrag.value = false;
        }
    }

    function onDragOver(e) {
        e.preventDefault();
        // Necessary to allow dropping
    }

    function onDrop(e) {
        e.preventDefault();
        isOver.value = false;
        isInvalidDrag.value = false;
        dragCounter = 0;

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const validFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith('.csv'));
            if (validFiles.length > 0) {
                emit('files-dropped', validFiles);
            }
        }
    }

    return {
        isOver,
        isInvalidDrag,
        onDragEnter,
        onDragLeave,
        onDragOver,
        onDrop
    };
}
