/**
 * Global Manager for Steam Cloud Synchronization
 * Handles game settings (volume, lang, controls)
 */

window.GlobalSettings = {
    language: 'es',
    controlProfile: 'arrows',
    volumeMaster: 100,
    volumeMusic: 70,
    volumeSfx: 70
};

const CLOUD_FILENAME = 'settings.json';
let saveTimeout = null;

/**
 * Loads data from Steam Cloud or fallback to localStorage
 */
function loadCloudSettings() {
    let cloudData = null;
    
    // 1. Try Steam Cloud
    if (typeof steamworksAPI !== 'undefined' && steamworksAPI && steamworksAPI.cloud) {
        try {
            if (steamworksAPI.cloud.fileExists(CLOUD_FILENAME)) {
                const content = steamworksAPI.cloud.readFile(CLOUD_FILENAME);
                cloudData = JSON.parse(content);
                console.log("Steam Cloud: Settings loaded successfully.");
            }
        } catch (e) {
            console.warn("Steam Cloud: Error reading file, fallback to local.", e);
        }
    }

    // 2. Fallback to localStorage / Defaults
    if (!cloudData) {
        cloudData = {
            language: localStorage.getItem('language') || 'es',
            controlProfile: localStorage.getItem('control_profile') || 'arrows',
            volumeMaster: parseInt(localStorage.getItem('volume_master')) || 100,
            volumeMusic: parseInt(localStorage.getItem('volume_music')) || 70,
            volumeSfx: parseInt(localStorage.getItem('volume_sfx')) || 70
        };
        console.log("Local: Using localStorage settings.");
    }

    window.GlobalSettings = { ...window.GlobalSettings, ...cloudData };
    return window.GlobalSettings;
}

/**
 * Saves current window.GlobalSettings to Steam Cloud (debounced)
 */
function saveCloudSettings() {
    // Debounce to avoid flooding Steam API
    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(() => {
        const content = JSON.stringify(window.GlobalSettings);
        
        // Save to Steam Cloud
        if (typeof steamworksAPI !== 'undefined' && steamworksAPI && steamworksAPI.cloud) {
            try {
                steamworksAPI.cloud.writeFile(CLOUD_FILENAME, content);
                console.log("Steam Cloud: Settings synced.");
            } catch (e) {
                console.error("Steam Cloud: Save failed.", e);
            }
        }

        // Always save to localStorage as extra fallback
        localStorage.setItem('language', window.GlobalSettings.language);
        localStorage.setItem('control_profile', window.GlobalSettings.controlProfile);
        localStorage.setItem('volume_master', window.GlobalSettings.volumeMaster);
        localStorage.setItem('volume_music', window.GlobalSettings.volumeMusic);
        localStorage.setItem('volume_sfx', window.GlobalSettings.volumeSfx);
        
    }, 1000); // 1 second delay
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for steamworks to be ready if needed
    setTimeout(loadCloudSettings, 100);
});
