/*
================================================================
STORAGE.JS - LOCALSTORAGE MANAGEMENT MODULE (REFACTORED)
- Provides a clean, reliable, and well-documented interface for
  interacting with the browser's localStorage.
- Manages distinct keys for the local watchlist and Trakt tokens
  to prevent data collisions.
- Includes robust error handling for JSON parsing.
================================================================
*/

// --- Constants ---
const WATCHLIST_KEY = 'pcinegpt_watchlist';
const TRAKT_TOKEN_KEY = 'pcinegpt_trakt_tokens';

// --- Generic Helper Functions ---

/**
 * Safely retrieves and parses a JSON item from localStorage.
 * @param {string} key The key of the item to retrieve.
 * @returns {any|null} The parsed object, or null if not found or if parsing fails.
 */
function getItem(key) {
    try {
        const itemJSON = localStorage.getItem(key);
        return itemJSON ? JSON.parse(itemJSON) : null;
    } catch (error) {
        console.error(`Error parsing JSON from localStorage key "${key}":`, error);
        // If parsing fails, it's safer to remove the corrupted data.
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

// --- Watchlist Functions ---

/**
 * Retrieves the entire watchlist from localStorage.
 * @returns {Array<number>} An array of movie IDs, or an empty array if none exists.
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
    let watchlist = getWatchlist();
    if (watchlist.includes(movieId)) {
        watchlist = watchlist.filter(id => id !== movieId);
        setItem(WATCHLIST_KEY, watchlist);
    }
}

/**
 * Checks if a specific movie ID is in the local watchlist.
 * @param {number} movieId The TMDB ID of the movie to check.
 * @returns {boolean} True if the movie is in the watchlist, false otherwise.
 */
export function isMovieInWatchlist(movieId) {
    const watchlist = getWatchlist();
    return watchlist.includes(movieId);
}

// --- Trakt Token Functions ---

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
