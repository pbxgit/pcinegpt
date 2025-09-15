/*
================================================================
STORAGE.JS - AWWWARDS REBUILD 2025
- Provides a clean, safe, and centralized interface for interacting
  with the browser's localStorage.
- Manages Trakt.tv tokens and the user's preferred theme.
================================================================
*/

// --- Define unique keys for the new version to prevent conflicts ---
const TRAKT_TOKEN_KEY = 'pcinegpt_trakt_tokens_v2';
const THEME_KEY = 'pcinegpt_theme_v2';

// --- Helper function for safe JSON parsing ---
/**
 * Safely parses a JSON string, returning a default value on failure.
 * @param {string | null} jsonString - The string to parse.
 * @param {any} defaultValue - The value to return if parsing fails.
 * @returns {any} The parsed object or the default value.
 */
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

/**
 * Saves Trakt authentication tokens to localStorage.
 * @param {object} tokens - The token object from the Trakt API.
 */
export function saveTraktTokens(tokens) {
    try {
        localStorage.setItem(TRAKT_TOKEN_KEY, JSON.stringify(tokens));
    } catch (error) {
        console.error("Could not save Trakt tokens to localStorage:", error);
        // This could happen if storage is full.
    }
}

/**
 * Retrieves Trakt authentication tokens from localStorage.
 * @returns {object | null} The token object or null if not found or invalid.
 */
export function getTraktTokens() {
    const tokensJSON = localStorage.getItem(TRAKT_TOKEN_KEY);
    return safeJsonParse(tokensJSON, null);
}

/**
 * Clears Trakt authentication tokens from localStorage, effectively logging the user out.
 */
export function clearTraktTokens() {
    localStorage.removeItem(TRAKT_TOKEN_KEY);
}

// ================================================================
// --- THEME PREFERENCE FUNCTIONS ---
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
