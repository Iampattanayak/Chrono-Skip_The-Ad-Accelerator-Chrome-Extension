// Background service worker wrapper

// Listen for storage changes to update icon state
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.extensionEnabled) {
        updateIcon(changes.extensionEnabled.newValue);
    }
});

// Initial check on startup
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['extensionEnabled'], (result) => {
        // Default to true if undefined
        const isEnabled = result.extensionEnabled !== false;
        updateIcon(isEnabled);
    });
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['extensionEnabled'], (result) => {
        const isEnabled = result.extensionEnabled !== false;
        updateIcon(isEnabled);
    });
});

const updateIcon = (isEnabled) => {
    if (isEnabled) {
        // Enabled: Clear badge or set to "ON" (optional, but cleaner without text usually)
        chrome.action.setBadgeText({ text: "" });
        // Restore default icon (if we had a color vs grayscale image, we'd swap path here)
        // chrome.action.setIcon({ path: "icon.png" });
    } else {
        // Disabled: Show "OFF" badge
        chrome.action.setBadgeText({ text: "OFF" });
        chrome.action.setBadgeBackgroundColor({ color: "#666666" });
    }
};
