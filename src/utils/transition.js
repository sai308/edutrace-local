/**
 * Utility for smooth page transitions
 */

/**
 * Creates a fade-out overlay and reloads the page after animation
 * @param {string} message - Message to display during transition
 */
export function fadeOutAndReload(message = 'Loading...') {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        opacity: 0;
        transition: opacity 300ms ease-in-out;
    `;

    // Create message container
    const messageContainer = document.createElement('div');
    messageContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
    `;

    // Create spinner
    const spinner = document.createElement('div');
    spinner.style.cssText = `
        width: 40px;
        height: 40px;
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    `;

    // Add spinner animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    // Create message text
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = `
        color: white;
        font-size: 1.1rem;
        font-weight: 500;
        text-align: center;
    `;

    messageContainer.appendChild(spinner);
    messageContainer.appendChild(messageEl);
    overlay.appendChild(messageContainer);
    document.body.appendChild(overlay);

    // Trigger fade-in
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
    });

    // Reload after animation
    setTimeout(() => {
        window.location.reload();
    }, 350);
}
