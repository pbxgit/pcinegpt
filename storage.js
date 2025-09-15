/*
================================================================
STORAGE.JS - LOCALSTORAGE MANAGEMENT MODULE
- Provides a clean interface for interacting with the browser's
  localStorage.
- Handles getting, adding, and removing items from the
  local watchlist.
================================================================
*/

const WATCHLIST_KEY = 'pcinegpt_watchlist';

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
