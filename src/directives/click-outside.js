export const clickOutside = {
    mounted(el, binding) {
        el.clickOutsideEvent = function (event) {
            // Check if the click was outside the element and its children
            if (!(el === event.target || el.contains(event.target))) {
                // Invoke the provided method
                binding.value(event);
            }
        };
        document.addEventListener('click', el.clickOutsideEvent);
    },
    unmounted(el) {
        document.removeEventListener('click', el.clickOutsideEvent);
    },
};
