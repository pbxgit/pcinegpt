/*
================================================================
STORAGE.JS - THE GRAND REBUILD
- Vision: A stable and reliable interface for browser storage.
- Architecture: Provides a safe, centralized API for all
  localStorage GET/SET operations, with robust error handling.
================================================================
*/

// --- 1. CONFIGURATION ---
const WATCHLIST_KEY = 'pcinegpt_watchlist_v2'; // Versioned key to prevent conflicts with old data
const TRAKT_TOKEN_KEY = 'pcinegpt_trakt_tokens_v2';

// --- 2. CORE UTILITY FUNCTIONS ---

/**
 * Safely retrieves and parses a JSON item from localStorage.
 * Includes error handling for corrupted data.
 * @param {string} key The key of the item to retrieve.
 * @returns {any|null} The parsed object, or null if not found or parsing fails.
 */
function getItem(key) {
    try {
        const itemJSON = localStorage.getItem(key);
        return itemJSON ? JSON.parse(itemJSON) : null;
    } catch (error) {
        console.error(`Error parsing JSON from localStorage for key "${key}":`, error);
        // If data is corrupted, it's safer to remove it.
        localStorage.removeItem(key);
        return null;
    }
}

/**
 * Safely stringifies and sets an item in localStorage.
 * @param {string} key The key of the item to set.
 * @param {any} value The value to be stored (will be JSON stringified).
 */
function setItem(key, value) {
    try {
        const itemJSON = JSON.stringify(value);
        localStorage.setItem(key, itemJSON);
    } catch (error) {
        console.error(`Error stringifying value for localStorage key "${key}":`, error);
    }
}

// --- 3. EXPORTED WATCHLIST METHODS ---

/**
 * Retrieves the entire watchlist from localStorage.
 * @returns {Array<number>} An array of movie IDs. Defaults to an empty array.
 */
export function getWatchlist() {
    return getItem(WATCHLIST_KEY) || [];
}

/**
 * Adds a movie ID to the watchlist if it's not already present.
 * @param {number} movieId The TMDB ID of the movie to add.
 */
export function addToWatchlist(movieId) {
    const watchlist = getWatchlist();
    if (!watchlist.includes(movieId)) {
        watchlist.push(movieId);
        setItem(WATCHLIST_KEY, watchlist);
    }
}

/**
 * Removes a movie ID from the watchlist.
 * @param {number} movieId The TMDB ID of the movie to remove.
 */
export function removeFromWatchlist(movieId) {
    const watchlist = getWatchlist().filter(id => id !== movieId);
    setItem(WATCHLIST_KEY, watchlist);
}

/**
 * Checks if a specific movie ID is in the local watchlist.
 * @param {number} movieId The TMDB ID of the movie to check.
 * @returns {boolean} True if the movie is in the watchlist.
 */
export function isMovieInWatchlist(movieId) {
    return getWatchlist().includes(movieId);
}

// --- 4. EXPORTED TRAKT TOKEN METHODS ---

/**
 * Saves Trakt authentication tokens to localStorage.
 * @param {object} tokens The token object from the Trakt API.
 */
export function saveTraktTokens(tokens) {
    setItem(TRAKT_TOKEN_KEY, tokens);
}

/**
 * Retrieves Trakt authentication tokens from localStorage.
 * @returns {object|null} The token object or null if not found.
 */
export function getTraktTokens() {
    return getItem(TRAKT_TOKEN_KEY);
}

/**
 * Clears Trakt authentication tokens from localStorage to log the user out.
 */
export function clearTraktTokens() {
    localStorage.removeItem(TRAKT_TOKEN_KEY);
}
