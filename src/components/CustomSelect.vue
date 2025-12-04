<script setup>
import { ref, computed } from 'vue';
import { ChevronDown } from 'lucide-vue-next';

const props = defineProps({
    modelValue: {
        type: [String, Number, Object],
        default: null
    },
    options: {
        type: Array,
        default: () => []
    },
    label: {
        type: String,
        default: ''
    },
    placeholder: {
        type: String,
        default: 'Select...'
    },
    // Key to display in the dropdown list. Can be a string (property name) or function.
    displayKey: {
        type: [String, Function],
        default: null
    },
    // Key to use as the value. Can be a string (property name) or function.
    // If null, the option object itself is the value.
    valueKey: {
        type: [String, Function],
        default: null
    },
    disabled: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(false);

function getValue(option) {
    if (props.valueKey) {
        if (typeof props.valueKey === 'function') return props.valueKey(option);
        return option[props.valueKey];
    }
    return option;
}

function getLabel(option) {
    if (props.displayKey) {
        if (typeof props.displayKey === 'function') return props.displayKey(option);
        return option[props.displayKey];
    }
    return option;
}

const selectedLabel = computed(() => {
    const selectedOption = props.options.find(opt => {
        const val = getValue(opt);
        // Simple equality check for primitives, JSON stringify for objects to handle value equality
        if (val === props.modelValue) return true;
        if (typeof val === 'object' && typeof props.modelValue === 'object') {
            return JSON.stringify(val) === JSON.stringify(props.modelValue);
        }
        return false;
    });

    if (selectedOption) {
        return getLabel(selectedOption);
    }

    return props.placeholder;
});

function select(option) {
    emit('update:modelValue', getValue(option));
    isOpen.value = false;
}

function toggle() {
    if (!props.disabled) {
        isOpen.value = !isOpen.value;
    }
}

function close() {
    isOpen.value = false;
}
</script>

<template>
    <div class="space-y-2">
        <label v-if="label || $slots.label" class="text-sm font-medium flex items-center gap-2">
            <slot name="label">{{ label }}</slot>
        </label>
        <div class="relative" v-click-outside="close">
            <button @click="toggle" type="button" :disabled="disabled"
                class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                <span class="truncate" :class="{ 'text-muted-foreground': selectedLabel === placeholder }">
                    {{ selectedLabel }}
                </span>
                <ChevronDown class="h-4 w-4 opacity-50" />
            </button>

            <div v-if="isOpen"
                class="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-auto">
                <div class="p-1">
                    <button v-for="(option, index) in options" :key="index" @click="select(option)"
                        class="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                        :class="{ 'bg-accent text-accent-foreground': JSON.stringify(getValue(option)) === JSON.stringify(modelValue) }">
                        {{ getLabel(option) }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
