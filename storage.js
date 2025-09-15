/*
================================================================
STORAGE.JS - AWWWARDS REBUILD 2025 (ENHANCED & DOCUMENTED)
- Provides a clean, safe, and centralized interface for interacting
  with the browser's localStorage.
- Manages Trakt.tv tokens and the user's preferred theme with versioned keys.
- Includes comprehensive JSDoc comments for improved clarity.
================================================================
*/

// --- Define unique keys for the new version to prevent conflicts with old data ---
const TRAKT_TOKEN_KEY = 'pcinegpt_trakt_tokens_v3';
const THEME_KEY = 'pcinegpt_theme_v3';

// --- Helper function for safe JSON parsing ---

/**
 * Safely parses a JSON string from localStorage, returning a default value on failure.
 * @param {string | null} jsonString The string to parse.
 * @param {*} defaultValue The value to return if parsing fails or the string is null.
 * @returns {*} The parsed object or the default value.
 */
function safeJsonParse(jsonString, defaultValue) {
    if (!jsonString) {
        return defaultValue;
    }
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

/**
 * Saves the Trakt.tv authentication tokens to localStorage.
 * @param {object} tokens The token object received from the Trakt API.
 */
export function saveTraktTokens(tokens) {
    if (!tokens) return;
    try {
        localStorage.setItem(TRAKT_TOKEN_KEY, JSON.stringify(tokens));
    } catch (error) {
        console.error("Could not save Trakt tokens to localStorage:", error);
    }
}

/**
 * Retrieves the Trakt.tv authentication tokens from localStorage.
 * @returns {object | null} The parsed token object or null if not found or invalid.
 */
export function getTraktTokens() {
    const tokensJSON = localStorage.getItem(TRAKT_TOKEN_KEY);
    return safeJsonParse(tokensJSON, null);
}

/**
 * Removes the Trakt.tv authentication tokens from localStorage.
 */
export function clearTraktTokens() {
    try {
        localStorage.removeItem(TRAKT_TOKEN_KEY);
    } catch (error) {
        console.error("Could not clear Trakt tokens from localStorage:", error);
    }
}


// ================================================================
// --- THEME PREFERENCE FUNCTIONS ---
// ================================================================

/**
 * Saves the user's selected theme ('light' or 'dark') to localStorage.
 * @param {string} theme The theme string to save.
 */
export function saveTheme(theme) {
    if (!theme) return;
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
        console.error("Could not save theme to localStorage:", error);
    }
}

/**
 * Retrieves the user's saved theme from localStorage.
 * @returns {string | null} The saved theme string ('light' or 'dark') or null if not set.
 */
export function getTheme() {
    try {
        return localStorage.getItem(THEME_KEY);
    } catch (error) {
        console.error("Could not retrieve theme from localStorage:", error);
        return null;
    }
}
