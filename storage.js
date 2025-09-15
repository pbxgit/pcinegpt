/**
 * @module storage
 * @description A utility module for interacting with the browser's localStorage.
 *              Provides a simple and consistent API for getting, setting, and removing data.
 */

/**
 * @function set
 * @description Saves a value to localStorage under a specified key. The value is JSON stringified.
 * @param {string} key - The key under which to store the value.
 * @param {*} value - The value to store. Can be any JSON-serializable type.
 */
export function set(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Error saving to localStorage for key "${key}":`, error);
    }
}

/**
 * @function get
 * @description Retrieves a value from localStorage by its key. The value is parsed from JSON.
 * @param {string} key - The key of the item to retrieve.
 * @returns {*} The retrieved value, or null if the key doesn't exist or an error occurs.
 */
export function get(key) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        console.error(`Error reading from localStorage for key "${key}":`, error);
        return null;
    }
}

/**
 * @function remove
 * @description Removes an item from localStorage by its key.
 * @param {string} key - The key of the item to remove.
 */
export function remove(key) {
    try {
        localStorage.removeItem(key);
    } catch (error)
        {
        console.error(`Error removing from localStorage for key "${key}":`, error);
    }
}

/**
 * @function getFavorites
 * @description Retrieves the list of favorite movie IDs from storage.
 * @returns {Array<string>} An array of movie IDs. Returns an empty array if none are found.
 */
export function getFavorites() {
    return get('favoriteMovies') || [];
}

/**
 * @function setFavorites
 * @description Saves the list of favorite movie IDs to storage.
 * @param {Array<string>} favoritesArray - An array of movie IDs.
 */
export function setFavorites(favoritesArray) {
    set('favoriteMovies', favoritesArray);
}

/**
 * @function isFavorite
 * @description Checks if a specific movie ID is in the favorites list.
 * @param {string} movieId - The movie ID to check.
 * @returns {boolean} True if the movie is a favorite, false otherwise.
 */
export function isFavorite(movieId) {
    const favorites = getFavorites();
    return favorites.includes(String(movieId));
}

/**
 * @function toggleFavorite
 * @description Adds or removes a movie ID from the favorites list.
 * @param {string} movieId - The movie ID to add or remove.
 * @returns {boolean} The new favorite status (true if added, false if removed).
 */
export function toggleFavorite(movieId) {
    const favorites = getFavorites();
    const movieIdStr = String(movieId);
    const index = favorites.indexOf(movieIdStr);

    if (index > -1) {
        // Movie is already a favorite, so remove it
        favorites.splice(index, 1);
    } else {
        // Movie is not a favorite, so add it
        favorites.push(movieIdStr);
    }

    setFavorites(favorites);
    return index === -1; // Return true if it was added, false if removed
}
