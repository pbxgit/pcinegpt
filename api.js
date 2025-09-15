/*
================================================================
API.JS - TMDB API INTERACTION MODULE (REFACTORED)
- Handles all communication with The Movie Database (TMDB) API.
- Features a centralized, robust fetch function with improved error handling.
- Exports clear, single-purpose functions for fetching movie and show data.
- Aligns with the API Configuration section of the project README.
================================================================
*/

// --- Configuration (As per project README) ---

// IMPORTANT: Replace with your own TMDB API key.
const API_KEY = '5bd8970deaa0e2346fc042a97499a59';
const API_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

// --- Core API Fetch Function ---

/**
 * A centralized and robust fetch function for the TMDB API.
 * @param {string} endpoint The API endpoint to request (e.g., '/movie/popular').
 * @param {string} [queryParams=''] Additional query parameters as a string (e.g., '&page=2').
 * @returns {Promise<any>} A promise that resolves to the JSON response from the API.
 * @throws {Error} If the network response is not OK.
 */
async function fetchFromTMDB(endpoint, queryParams = '') {
    const url = `${API_BASE_URL}${endpoint}?api_key=${API_KEY}${queryParams}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`TMDB API request failed: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching from TMDB endpoint ${endpoint}:`, error);
        // Re-throw the error to be handled by the calling function.
        throw error;
    }
}

// --- Exported API Functions ---

/**
 * Fetches the movies currently trending for the week.
 * @returns {Promise<object>} A promise that resolves to the API response object.
 */
export function getTrendingMovies() {
    return fetchFromTMDB('/trending/movie/week');
}

/**
 * Fetches upcoming movies for the US region.
 * @returns {Promise<object>} A promise that resolves to the API response object.
 */
export function getUpcomingMovies() {
    return fetchFromTMDB('/movie/upcoming', '&region=US&language=en-US');
}

/**
 * Fetches the full details for a specific movie, including trailer videos.
 * @param {number|string} movieId The TMDB ID of the movie.
 * @returns {Promise<object>} A promise that resolves to the movie details object.
 */
export function getMovieDetails(movieId) {
    return fetchFromTMDB(`/movie/${movieId}`, '&append_to_response=videos,credits');
}

/**
 * Fetches movies similar to a specific movie.
 * @param {number|string} movieId The TMDB ID of the movie.
 * @returns {Promise<object>} A promise that resolves to the API response object.
 */
export function getSimilarMovies(movieId) {
    return fetchFromTMDB(`/movie/${movieId}/similar`);
}

/**
 * Searches TMDB for a specific movie or show title and year to find its TMDB ID.
 * This is a crucial utility for linking AI recommendations to TMDB data.
 * @param {string} type The content type, either 'movie' or 'tv'.
 * @param {string} title The title of the content.
 * @param {number} year The release year of the content.
 * @returns {Promise<object|null>} The first search result, or null if no match is found.
 */
export async function findTMDBEntry(type, title, year) {
    const endpoint = `/search/${type}`;
    // Searching with year provides much more accurate results.
    const queryParams = `&query=${encodeURIComponent(title)}&primary_release_year=${year}`;
    try {
        const data = await fetchFromTMDB(endpoint, queryParams);
        // Return the first result as it's typically the most accurate match.
        return data.results && data.results.length > 0 ? data.results[0] : null;
    } catch (error) {
        console.error(`Failed to find TMDB entry for ${title} (${year}):`, error);
        return null;
    }
}

/**
 * Constructs a full URL for a TMDB poster or backdrop image.
 * @param {string} imagePath The path from the API response (e.g., '/xyz.jpg').
 * @param {string} [size='w500'] The desired image width (e.g., 'w300', 'w500', 'original').
 * @returns {string} The complete, absolute URL to the image.
 */
export function getImageUrl(imagePath, size = 'w500') {
    if (!imagePath) {
        // Return a placeholder if no image path is provided.
        const dimensions = size === 'w500' ? '500x750' : '1280x720';
        return `https://via.placeholder.com/${dimensions}.png?text=No+Image`;
    }
    return `${IMAGE_BASE_URL}${size}${imagePath}`;
}
