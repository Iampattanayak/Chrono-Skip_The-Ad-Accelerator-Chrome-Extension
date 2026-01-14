// Chrono-Skip: Ad Accelerator Core Logic

let isExtensionEnabled = true;
let observer = null; // Singleton observer reference

// Optimization & Safety State
let lastExecutionTime = 0;
const EXECUTION_DEBOUNCE = 50; // ms
let skipLog = []; // Timestamp log for safety check
const MAX_SKIPS_PER_SEC = 10; // Threshold for safety switch
let isSafetyCooldown = false;
const COOLDOWN_DURATION = 30000; // 30 seconds

// Initialize toggle state
try {
    if (chrome.runtime.id) {
        chrome.storage.local.get(['extensionEnabled'], (result) => {
            if (!chrome.runtime.lastError) {
                isExtensionEnabled = result.extensionEnabled !== false; // Default true
            }
        });
    }
} catch (e) {
    // Context invalidated handling
}

// Listen for toggle changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (!chrome.runtime.id) return;
    if (namespace === 'local' && changes.extensionEnabled) {
        isExtensionEnabled = changes.extensionEnabled.newValue;
    }
});

// Function to handle static banner ads and Cleanups (Premium)
const handleCleanup = () => {
    if (!isExtensionEnabled || isSafetyCooldown) return;

    // Ads and Banners
    const staticAdSelectors = [
        '.ytd-banner-promo-renderer',
        '.ytd-display-ad-renderer',
        '.ytd-action-companion-ad-renderer',
        'ytd-promoted-sparkles-web-renderer',
        'ytd-compact-promoted-item-renderer'
    ];

    // Premium Cleanup Selectors (Merch, Paid Promo, End Screens)
    const annoyanceSelectors = [
        '.ytd-merch-shelf-renderer', // Merch Shelf
        '.ytp-paid-content-overlay', // "Paid Promotion" Toast
        '.ytp-ce-element'            // End-screen video suggestions covering player
    ];

    const allSelectors = [...staticAdSelectors, ...annoyanceSelectors];

    allSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            if (el.style.display !== 'none') {
                el.style.display = 'none';
            }
        });
    });
};

const incrementAdCount = () => {
    if (!chrome.runtime.id) return; // Context invalidated check
    try {
        chrome.storage.local.get(['adsSkippedCount'], (result) => {
            if (chrome.runtime.lastError) return; // Handle potential error
            const newCount = (result.adsSkippedCount || 0) + 1;
            chrome.storage.local.set({ adsSkippedCount: newCount });
        });
    } catch (e) {
        // Extension context likely invalidated
        if (observer) observer.disconnect();
    }
};

// Global Heuristics Data
const SKIP_TRANSLATIONS = [
    'skip', 'skip ad', 'skip ads', // English
    'omitir', 'saltar',            // Spanish
    'passer', 'ignorer',           // French
    'überspringen',                // German
    'pular',                       // Portuguese
    'пропустить',                  // Russian
    'スキップ',                     // Japanese
    '건너뛰기',                     // Korean
    'छोड़ें',                       // Hindi
    'ข้าม'                         // Thai
];

const SKIP_ICON_PATHS = [
    "M6 4l12 8-12 8V4z",
    "M 12,24 20.5,18 12,12 V 24 z M 22,12 v 12 h 2 V 12 h -2 z",
    "M8 5v14l11-7z",
    "m 12,12 12,12 -12,12 v -24 z"
];

// Heuristic Finder for Skip Buttons (Multilingual + SVG)
const findSkipButtonHeuristic = () => {
    // Optimization: Target specific ad container or player to avoid false positives on page
    const container = document.querySelector('.visited-module, .ytp-ad-module') || document.querySelector('.html5-video-player') || document.body;

    // Narrow down candidates significantly
    const candidates = container.querySelectorAll('button.ytp-ad-skip-button, div.ytp-ad-skip-button-slot, .ytp-ad-skip-button-container');

    for (const el of candidates) {
        // Must be visible
        if (el.offsetParent === null) continue;

        if (el.id && el.id.toLowerCase().includes('skip')) return el;

        const text = (el.innerText || el.textContent || '').trim().toLowerCase();
        if (text.length > 0 && text.length < 50 && SKIP_TRANSLATIONS.some(word => text.includes(word))) {
            return el;
        }

        // Removed broad aria-label check to prevent "Skip navigation" matches

        // Check for specific skip icon paths if class/id fails
        const paths = el.querySelectorAll('path');
        for (const path of paths) {
            const d = path.getAttribute('d');
            if (d && SKIP_ICON_PATHS.some(skipPath => d.includes(skipPath) || skipPath.includes(d))) {
                return el;
            }
        }
    }
    return null;
};

const handleQuality = () => {
    if (!isExtensionEnabled || isSafetyCooldown) return;
    // Auto-4K logic stub
};

// Safety Check: Detect Infinite Loops
const checkSafety = () => {
    const now = Date.now();
    // Remove logs older than 1 second
    skipLog = skipLog.filter(t => now - t < 1000);
    skipLog.push(now);

    if (skipLog.length > MAX_SKIPS_PER_SEC) {
        isSafetyCooldown = true;
        // console.warn(`Chrono-Skip: Safety Threshold Reached. Pausing for ${COOLDOWN_DURATION}ms.`);
        skipLog = []; // Reset log

        // Disable observer temporarily
        if (observer) observer.disconnect();

        setTimeout(() => {
            isSafetyCooldown = false;
            // console.log("Chrono-Skip: Safety Cooldown Ended. Resuming...");
            startObserver(); // Re-attach observer
        }, COOLDOWN_DURATION);

        return false; // Stop execution
    }
    return true;
};

// Function to handle YouTube Shorts ads
const handleShorts = () => {
    if (!isExtensionEnabled || isSafetyCooldown) return;

    const activeShort = document.querySelector('ytd-reel-video-renderer[is-active]');

    if (activeShort) {
        const adSlot = activeShort.querySelector('.ytd-ad-slot-renderer');
        const adOverlay = activeShort.querySelector('.ad-showing');

        const sponsoredLabel = Array.from(activeShort.querySelectorAll('yt-formatted-string, span, div.badge-style-type-ad-badge')).some(el => {
            const txt = el.textContent.trim().toLowerCase();
            return txt === 'sponsored' || txt === 'ad' || txt === 'anuncio' || txt === 'gesponsert';
        });

        if (adSlot || adOverlay || sponsoredLabel) {
            // Safety Check before action
            if (!checkSafety()) return;

            const video = activeShort.querySelector('video');
            if (video && !video.muted) video.muted = true;

            const nextButton = document.querySelector('#navigation-button-down > ytd-button-renderer > yt-button-shape > button');

            if (nextButton) {
                nextButton.click();
            } else {
                const keyEvent = new KeyboardEvent('keydown', {
                    key: 'ArrowDown',
                    code: 'ArrowDown',
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                document.dispatchEvent(keyEvent);
            }

            if (!activeShort.dataset.adProcessed) {
                activeShort.dataset.adProcessed = "true";
                incrementAdCount();
            }
        }
    }
};

// Function to handle standard Video ads
const handleAds = () => {
    // 1. Check Enabled
    if (!isExtensionEnabled || isSafetyCooldown) return;

    // 2. Optimization: Debounce
    const now = Date.now();
    if (now - lastExecutionTime < EXECUTION_DEBOUNCE) {
        return;
    }
    lastExecutionTime = now;

    if (window.location.pathname.includes('/shorts/')) {
        handleShorts();
        return; // Exit here for shorts
    }

    const video = document.querySelector('video');
    const adShowing = document.querySelector('.ad-showing');
    const adInterrupting = document.querySelector('.ad-interrupting');

    let skipButton = document.querySelector('.ytp-ad-skip-button');
    let modernSkipButton = document.querySelector('.ytp-ad-skip-button-modern');

    if (!skipButton && !modernSkipButton) {
        skipButton = findSkipButtonHeuristic();
    } else if (modernSkipButton) {
        skipButton = modernSkipButton;
    }

    // Heuristic: Only consider it an ad state if there's a definitive ad marker OR a found skip button *within the player*
    // We removed the broad 'findSkipButtonHeuristic' search on document in the function below, so skipButton should be safer now.
    const isAdState = adShowing || adInterrupting || (skipButton !== null);

    if (isAdState) {

        // Safety Check before intensive actions
        if (!checkSafety()) return;

        let adSkipped = false;

        // REMOVED: Aggressive hiding of the player. 
        // This was causing the "gray screen" issue on normal videos if a false positive occurred.
        // const player = document.querySelector('.html5-video-player');
        // if (player) {
        //     player.style.opacity = '0';
        //     player.style.zIndex = '-1';
        // }

        if (video) {
            // Speed up & mute ONLY if we are fairly sure it's an ad
            if (!video.muted) video.muted = true;
            if (video.playbackRate !== 16.0) video.playbackRate = 16.0;

            if (video.duration && isFinite(video.duration) && !isNaN(video.duration)) {
                // If it's a long video (likely main content false positive), don't skip to end immediately 
                // unless we have a strong signal like .ad-showing
                if (video.duration < 300 || adShowing || adInterrupting) {
                    if (video.currentTime !== video.duration) {
                        video.currentTime = video.duration;
                        adSkipped = true;
                    }
                }
            }
        }

        if (skipButton) {
            skipButton.click();
            adSkipped = true;
        }

        if (adSkipped && video && !video.dataset.adProcessed) {
            video.dataset.adProcessed = "true";
            incrementAdCount();
        }

    } else {
        // Restore state if needed (though we removed the hiding, so less to restore)
        if (video && video.dataset.adProcessed) {
            delete video.dataset.adProcessed;
        }
    }

    handleCleanup();
    handleQuality();
};

// Initialize MutationObserver
const startObserver = () => {
    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
        handleAds();
    });

    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }
};

startObserver();

// --- Manual Override & Hotkeys ---

// Toast Notification Helper
const showToast = (message) => {
    // Remove existing toast if any
    const existing = document.querySelector('.chrono-skip-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'chrono-skip-toast';
    toast.textContent = message;

    // Inline styles for isolation
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '80px', // Above player controls usually
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: '8px',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        zIndex: '2147483647', // Max Z-index
        pointerEvents: 'none',
        transition: 'opacity 0.3s ease',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)'
    });

    document.body.appendChild(toast);

    // Fade out
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
};

// Toggle Extension
const toggleExtension = () => {
    if (!chrome.runtime.id) return;
    const newState = !isExtensionEnabled;
    chrome.storage.local.set({ extensionEnabled: newState }, () => {
        showToast(newState ? 'Chrono-Skip: Enabled' : 'Chrono-Skip: Disabled');
        // Icon update is handled by background.js listening to storage change
    });
};

// Force Skip (Speedrun)
const forceSkip = () => {
    // Determine context (Shorts or Video)
    if (window.location.pathname.includes('/shorts/')) {
        const activeShort = document.querySelector('ytd-reel-video-renderer[is-active]');
        if (activeShort) {
            const video = activeShort.querySelector('video');
            const nextButton = document.querySelector('#navigation-button-down > ytd-button-renderer > yt-button-shape > button');

            if (video) video.muted = true;
            if (nextButton) {
                nextButton.click();
            } else {
                const keyEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true, view: window });
                document.dispatchEvent(keyEvent);
            }
            showToast('Chrono-Skip: Force Skipped (Shorts)');
        }
    } else {
        const video = document.querySelector('video');
        if (video) {
            video.muted = true;
            video.playbackRate = 16.0;
            if (isFinite(video.duration)) video.currentTime = video.duration;
            showToast('Chrono-Skip: Force Skipped');

            // Also try clicking buttons
            const skipButton = findSkipButtonHeuristic();
            if (skipButton) skipButton.click();
        } else {
            showToast('Chrono-Skip: No Video Found');
        }
    }
};

// Keyboard Listener
document.addEventListener('keydown', (e) => {
    // Check for Alt key combo
    if (e.altKey) {
        if (e.code === 'KeyS') {
            e.preventDefault();
            forceSkip();
        } else if (e.code === 'KeyX') {
            e.preventDefault();
            toggleExtension();
        }
    }
});
