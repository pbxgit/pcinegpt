/*
================================================================
API.JS - THE GRAND REBUILD
- Vision: A stable and reliable data-fetching module for TMDB.
- Architecture: Centralized API logic with robust error handling,
  designed to support the atomic rendering pattern of app.js.
================================================================
*/

// --- 1. CONFIGURATION ---
const API_KEY = '5bd8970deaa0e2346fc042a97499a59'; // Your TMDB API Key
const API_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

// --- 2. CORE FETCH FUNCTION ---

/**
 * A centralized and robust fetch function for all TMDB API requests.
 * @param {string} endpoint The API endpoint to request (e.g., '/movie/popular').
 * @param {string} [queryParams=''] Additional query parameters.
 * @returns {Promise<any>} A promise that resolves to the JSON response.
 * @throws {Error} Throws an error if the network response is not OK.
 */
async function fetchFromTMDB(endpoint, queryParams = '') {
    const url = `${API_BASE_URL}${endpoint}?api_key=${API_KEY}${queryParams}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`TMDB API Error: ${errorData.status_message || response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching from TMDB endpoint ${endpoint}:`, error);
        throw error; // Re-throw the error to be caught by the view renderer
    }
}

// --- 3. EXPORTED API METHODS ---

/**
 * Fetches the movies currently trending for the week.
 * @returns {Promise<object>}
 */
export function getTrendingMovies() {
    return fetchFromTMDB('/trending/movie/week');
}

/**
 * Fetches upcoming movies for the US region.
 * @returns {Promise<object>}
 */
export function getUpcomingMovies() {
    return fetchFromTMDB('/movie/upcoming', '&region=US&language=en-US');
}

/**
 * Fetches the full details for a specific movie, including credits.
 * @param {string|number} movieId The TMDB ID of the movie.
 * @returns {Promise<object>}
 */
export function getMovieDetails(movieId) {
    return fetchFromTMDB(`/movie/${movieId}`, '&append_to_response=credits,videos');
}

/**
 * Fetches movies similar to a specific movie.
 * @param {string|number} movieId The TMDB ID of the movie.
 * @returns {Promise<object>}
 */
export function getSimilarMovies(movieId) {
    return fetchFromTMDB(`/movie/${movieId}/similar`);
}

/**
 * Searches TMDB for a specific title and year to find its ID.
 * This is a crucial utility for linking AI recommendations to TMDB data.
 * @param {string} type The content type ('movie' or 'tv').
 * @param {string} title The title of the content.
 * @param {number} year The release year of the content.
 * @returns {Promise<object|null>} The first search result, or null if no match.
 */
export async function findTMDBEntry(type, title, year) {
    const endpoint = `/search/${type}`;
    const queryParams = `&query=${encodeURIComponent(title)}&primary_release_year=${year}`;
    try {
        const data = await fetchFromTMDB(endpoint, queryParams);
        return data.results && data.results.length > 0 ? data.results[0] : null;
    } catch (error) {
        // This is a non-critical error in the context of a list, so we don't re-throw.
        console.error(`Failed to find TMDB entry for ${title} (${year}):`, error);
        return null;
    }
}

/**
 * Constructs a full URL for a TMDB poster or backdrop image.
 * @param {string} imagePath The path from the API response (e.g., '/xyz.jpg').
 * @param {string} [size='w500'] The desired image width.
 * @returns {string} The complete, absolute URL to the image.
 */
export function getImageUrl(imagePath, size = 'w500') {
    if (!imagePath) {
        // Provide a consistent placeholder for missing images.
        return `https://via.placeholder.com/${size === 'original' ? '1280x720' : '500x750'}?text=No+Image`;
    }
    return `${IMAGE_BASE_URL}${size}${imagePath}`;
}
