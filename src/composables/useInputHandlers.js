export function useInputHandlers() {
    function handleMeetIdPasteUtil(event, searchQueryRef) {
        const text = event.clipboardData.getData('text');
        if (!text) return;

        // Regex to match Google Meet IDs (xxx-xxxx-xxx)
        // It might be part of a URL like https://meet.google.com/abc-defg-hij
        // or just the ID itself.
        const match = text.match(/[a-z]{3}-[a-z]{4}-[a-z]{3}/);
        if (match) {
            event.preventDefault();
            searchQueryRef.value = match[0];
        }
    }

    return {
        handleMeetIdPasteUtil
    };
}
