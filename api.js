/*
================================================================
API.JS - AWWWARDS REBUILD 2025
- Unified TMDB API interaction module for both movies and TV shows.
- Manages API key and base URLs with robust error handling.
================================================================
*/

// --- Configuration ---
const API_KEY = '5bd8970deaa0e82346fc042a97499a59';
const API_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

// --- Core API Fetch Function ---

/**
 * A generic, robust function to fetch data from any TMDB endpoint.
 * @param {string} endpoint - The TMDB endpoint (e.g., '/movie/popular').
 * @param {string} [queryParams=''] - Optional query parameters.
 * @returns {Promise<object>} A promise that resolves to the JSON response data.
 * @throws {Error} If the network response is not ok.
 */
async function fetchFromTMDB(endpoint, queryParams = '') {
    const url = `${API_BASE_URL}${endpoint}?api_key=${API_KEY}&language=en-US${queryParams}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP error! Status: ${response.status} - ${errorData.status_message || 'Unknown error'}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching from TMDB endpoint ${endpoint}:`, error);
        throw error;
    }
}

// --- Exported API Functions ---

/**
 * Fetches trending media for the week.
 * @param {string} type - The media type ('movie' or 'tv').
 * @returns {Promise<Array<object>>} A promise resolving to an array of media items.
 */
export async function getTrending(type = 'movie') {
    const data = await fetchFromTMDB(`/trending/${type}/week`);
    return data.results;
}

/**
 * Fetches top-rated media.
 * @param {string} type - The media type ('movie' or 'tv').
 * @returns {Promise<Array<object>>} A promise resolving to an array of media items.
 */
export async function getTopRated(type = 'movie') {
    const data = await fetchFromTMDB(`/${type}/top_rated`);
    return data.results;
}

/**
 * Fetches the full details for a specific movie or TV show.
 * @param {string} type - The media type ('movie' or 'tv').
 * @param {number} id - The TMDB ID of the media.
 * @returns {Promise<object>} A promise resolving to the media details object.
 */
export function getMediaDetails(type, id) {
    // Append 'videos' for trailers and 'credits' for cast information
    return fetchFromTMDB(`/${type}/${id}`, '&append_to_response=videos,credits');
}

/**
 * Searches for a movie or TV show on TMDB based on its title and year.
 * @param {string} type - The media type ('movie' or 'tv').
 * @param {string} title - The title of the content.
 * @param {string} year - The release year of the content.
 * @returns {Promise<object|null>} The first search result, or null if no match is found.
 */
export async function searchTMDB(type, title, year) {
    const endpoint = `/search/${type}`;
    const yearParam = type === 'movie' ? 'primary_release_year' : 'first_air_date_year';
    const queryParams = `&query=${encodeURIComponent(title)}&${yearParam}=${year}`;
    try {
        const data = await fetchFromTMDB(endpoint, queryParams);
        return data.results && data.results.length > 0 ? data.results[0] : null;
    } catch (error) {
        console.error(`Failed to search for ${title} (${year}):`, error);
        return null;
    }
}

/**
 * Constructs a full URL for a TMDB poster or backdrop image.
 * Provides a fallback placeholder image if the path is missing.
 * @param {string|null} imagePath - The path from the TMDB API (e.g., '/xxxxx.jpg').
 * @param {string} [size='w500'] - The desired image size (e.g., 'w500', 'w780', 'original').
 * @returns {string} The complete, absolute URL to the image.
 */
export function getPosterUrl(imagePath, size = 'w500') {
    if (!imagePath) {
        // A neutral placeholder that works with both light and dark themes.
        return `https://via.placeholder.com/500x750/CCCCCC/FFFFFF?text=No+Image`;
    }
    return `${IMAGE_BASE_URL}${size}${imagePath}`;
}
