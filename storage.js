/*
================================================================
STORAGE.JS - LOCALSTORAGE MANAGEMENT MODULE
- Provides a clean interface for interacting with the browser's
  localStorage for both the local watchlist and Trakt tokens.
================================================================
*/

const WATCHLIST_KEY = 'pcinegpt_watchlist';
const TRAKT_TOKEN_KEY = 'pcinegpt_trakt_tokens';

// --- Watchlist Functions ---

/**
 * Retrieves the entire watchlist from localStorage.
 * @returns {Array<number>} An array of movie IDs.
 */
export function getWatchlist() {
    const watchlistJSON = localStorage.getItem(WATCHLIST_KEY);
    return watchlistJSON ? JSON.parse(watchlistJSON) : [];
}

/**
 * Adds a movie ID to the watchlist in localStorage.
 * @param {number} movieId - The ID of the movie to add.
 */
export function addToWatchlist(movieId) {
    const watchlist = getWatchlist();
    if (!watchlist.includes(movieId)) {
        watchlist.push(movieId);
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    }
}

/**
 * Removes a movie ID from the watchlist in localStorage.
 * @param {number} movieId - The ID of the movie to remove.
 */
export function removeFromWatchlist(movieId) {
    let watchlist = getWatchlist();
    watchlist = watchlist.filter(id => id !== movieId);
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
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


// --- Trakt Token Functions ---

/**
 * Saves Trakt authentication tokens to localStorage.
 * @param {object} tokens - The token object from the Trakt API.
 */
export function saveTraktTokens(tokens) {
    localStorage.setItem(TRAKT_TOKEN_KEY, JSON.stringify(tokens));
}

/**
 * Retrieves Trakt authentication tokens from localStorage.
 * @returns {object|null} The token object or null if not found.
 */
export function getTraktTokens() {
    const tokensJSON = localStorage.getItem(TRAKT_TOKEN_KEY);
    return tokensJSON ? JSON.parse(tokensJSON) : null;
}

/**
 * Clears Trakt authentication tokens from localStorage.
 */
export function clearTraktTokens() {
    localStorage.removeItem(TRAKT_TOKEN_KEY);
}
