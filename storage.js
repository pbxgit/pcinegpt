/*
================================================================
STORAGE.JS - AWWWARDS REBUILD 2025 (Corrected Version)
- Provides a clean, safe, and centralized interface for interacting
  with the browser's localStorage.
- Manages Trakt.tv tokens and the user's preferred theme.
================================================================
*/

// --- Define unique keys for the new version to prevent conflicts ---
const TRAKT_TOKEN_KEY = 'pcinegpt_trakt_tokens_v2';
const THEME_KEY = 'pcinegpt_theme_v2'; // The key was defined, but functions were missing

// --- Helper function for safe JSON parsing ---
function safeJsonParse(jsonString, defaultValue) {
    if (!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Failed to parse JSON from localStorage:", error);
        return defaultValue;
    }
}

// ================================================================
// --- TRAKT TOKEN FUNCTIONS ---
// ================================================================

export function saveTraktTokens(tokens) {
    try {
        localStorage.setItem(TRAKT_TOKEN_KEY, JSON.stringify(tokens));
    } catch (error) {
        console.error("Could not save Trakt tokens to localStorage:", error);
    }
}

export function getTraktTokens() {
    const tokensJSON = localStorage.getItem(TRAKT_TOKEN_KEY);
    return safeJsonParse(tokensJSON, null);
}

export function clearTraktTokens() {
    localStorage.removeItem(TRAKT_TOKEN_KEY);
}

// ================================================================
// --- THEME PREFERENCE FUNCTIONS (BUG FIX) ---
// ================================================================

/**
 * Saves the user's selected theme ('light' or 'dark') to localStorage.
 * @param {string} theme - The theme to save.
 */
export function saveTheme(theme) {
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
        console.error("Could not save theme to localStorage:", error);
    }
}

/**
 * Retrieves the user's saved theme from localStorage.
 * @returns {string | null} The saved theme string or null if not set.
 */
export function getTheme() {
    return localStorage.getItem(THEME_KEY);
}
