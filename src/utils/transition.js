/**
 * Utility for smooth page transitions
 */

// Define the ID for the overlay so we can target it on both pages
const OVERLAY_ID = 'page-transition-overlay';

/**
 * Creates the initial fade-in overlay that covers the screen immediately.
 * This should be called *before* the Vue app is mounted, ideally in your
 * main HTML file or very early in your main.js.
 */
export function createAndShowFadeInOverlay(message = '') {
    // Check if the overlay already exists to prevent duplication
    if (document.getElementById(OVERLAY_ID)) {
        return;
    }

    // Create and style the overlay (same as before)
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        /* The key change: start at opacity 1 to cover the page */
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999; /* Higher z-index */
        opacity: 1; 
        transition: opacity 500ms ease-in-out; /* Longer transition for smoother effect */
    `;

    // ... (Your existing code for spinner and message container goes here) ...
    // Note: You must include the spinner, message, and style creation as in your original function.
    // I am omitting it here for brevity, but they are necessary.

    // Re-inserting the content creation for completeness:
    const messageContainer = document.createElement('div');
    messageContainer.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 1rem;';
    const spinner = document.createElement('div');
    spinner.style.cssText = 'width: 40px; height: 40px; border: 3px solid rgba(255, 255, 255, 0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite;';
    const style = document.createElement('style');
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = 'color: white; font-size: 1.1rem; font-weight: 500; text-align: center;';

    messageContainer.appendChild(spinner);
    messageContainer.appendChild(messageEl);
    overlay.appendChild(messageContainer);
    document.body.appendChild(overlay);
}

/**
 * Fades out the overlay after the new page has loaded.
 * This should be called when your main Vue component mounts.
 */
export function fadeOutOnLoad() {
    const overlay = document.getElementById(OVERLAY_ID);

    if (overlay) {
        // Trigger fade-out
        requestAnimationFrame(() => {
            overlay.style.opacity = '0';
        });

        // Remove overlay from DOM after transition completes
        const transitionDuration = 500; // Must match the transition time in createAndShowFadeInOverlay
        setTimeout(() => {
            overlay.remove();
        }, transitionDuration);
    }
}

/**
 * Creates a fade-out overlay and reloads the page after animation.
 * Use this only for navigation that *must* be a full page reload.
 */
export function fadeOutAndReload(message = '') {
    // Reuse the creation logic, but force opacity=1 immediately if it doesn't exist
    createAndShowFadeInOverlay(message);
    const overlay = document.getElementById(OVERLAY_ID);

    // Ensure it's fully opaque before reloading
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
    });

    // Reload immediately after ensuring the overlay is visible
    setTimeout(() => {
        // Important: Use a minimal timeout or 0 to ensure the browser has registered the opacity change.
        // The overlay is already opaque from the 'arrival' logic, so we just need to ensure it's visible.
        window.location.reload();
    }, 10);
}