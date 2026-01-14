document.addEventListener('DOMContentLoaded', () => {
    const adsCountElem = document.getElementById('adsCount');
    const timeSavedElem = document.getElementById('timeSaved');
    const toggleSwitch = document.getElementById('toggleSwitch');

    // Load initial state
    chrome.storage.local.get(['adsSkippedCount', 'extensionEnabled'], (result) => {
        const count = result.adsSkippedCount || 0;
        const enabled = result.extensionEnabled !== false; // Default to true if not set

        updateStats(count);
        toggleSwitch.checked = enabled;
    });

    // Toggle switch listener
    toggleSwitch.addEventListener('change', () => {
        const isEnabled = toggleSwitch.checked;
        chrome.storage.local.set({ extensionEnabled: isEnabled });
    });

    // Listen for storage changes to update UI in real-time (if popup is open while ad is skipped)
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.adsSkippedCount) {
            updateStats(changes.adsSkippedCount.newValue);
        }
    });

    function updateStats(count) {
        adsCountElem.textContent = count;

        // Calculate time saved: count * 15 seconds
        const totalSeconds = count * 15;
        let timeString = '';

        if (totalSeconds < 60) {
            timeString = `${totalSeconds}s`;
        } else if (totalSeconds < 3600) {
            const minutes = Math.floor(totalSeconds / 60);
            timeString = `${minutes}m`;
        } else {
            const hours = (totalSeconds / 3600).toFixed(1);
            timeString = `${hours}h`;
        }

        timeSavedElem.textContent = timeString;
    }
});
