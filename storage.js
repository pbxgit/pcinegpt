/*
================================================================
STORAGE.JS - LOCALSTORAGE MANAGEMENT MODULE
- Provides a clean, safe, and centralized interface for interacting
  with the browser's localStorage.
- Manages the local movie watchlist and Trakt.tv tokens.
- Includes error handling for cases where localStorage might be
  unavailable or full.
================================================================
*/

// --- Define unique keys to prevent collisions ---
const WATCHLIST_KEY = 'pcinegpt_watchlist_v1';
const TRAKT_TOKEN_KEY = 'pcinegpt_trakt_tokens_v1';

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
// --- WATCHLIST FUNCTIONS ---
// ================================================================

/**
 * Retrieves the entire watchlist from localStorage.
 * @returns {Array<number>} An array of movie IDs. Returns an empty array on failure.
 */
export function getWatchlist() {
    const watchlistJSON = localStorage.getItem(WATCHLIST_KEY);
    return safeJsonParse(watchlistJSON, []);
}

/**
 * Saves the entire watchlist array to localStorage.
 * @param {Array<number>} watchlist - The array of movie IDs to save.
 */
function saveWatchlist(watchlist) {
    try {
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    } catch (error) {
        console.error("Could not save watchlist to localStorage:", error);
    }
}

/**
 * Adds a movie ID to the watchlist if it's not already present.
 * @param {number} movieId - The ID of the movie to add.
 */
export function addToWatchlist(movieId) {
    const watchlist = getWatchlist();
    if (!watchlist.includes(movieId)) {
        watchlist.push(movieId);
        saveWatchlist(watchlist);
    }
}

/**
 * Removes a movie ID from the watchlist.
 * @param {number} movieId - The ID of the movie to remove.
 */
export function removeFromWatchlist(movieId) {
    let watchlist = getWatchlist();
    const initialLength = watchlist.length;
    watchlist = watchlist.filter(id => id !== movieId);

    // Only update localStorage if a change actually occurred
    if (watchlist.length < initialLength) {
        saveWatchlist(watchlist);
    }
}

/**
 * Checks if a specific movie ID is in the watchlist.
 * @param {number} movieId - The ID of the movie to check.
 * @returns {boolean} True if the movie is in the watchlist, false otherwise.
 */
export function isMovieInWatchlist(movieId) {
    const watchlist = getWatchlist();
    return watchlist.includes(movieId);
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
