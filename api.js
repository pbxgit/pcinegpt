/*
================================================================
API.JS - TMDB API INTERACTION MODULE
- Handles all communication with The Movie Database (TMDB) API.
- Exports functions for trending, details, search, etc.
- Manages API key and base URLs with robust error handling.
================================================================
*/

// --- Configuration ---
// IMPORTANT: This is a public key for demonstration. For a real application,
// consider using a backend proxy to protect your key.
const API_KEY = '5bd8970deaa0e82346fc042a97499a59';
const API_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

// --- Core API Fetch Function ---

/**
 * A generic, robust function to fetch data from any TMDB endpoint.
 * @param {string} endpoint - The TMDB endpoint (e.g., '/movie/popular').
 * @param {string} [queryParams=''] - Optional query parameters (e.g., '&language=en-US').
 * @returns {Promise<object>} A promise that resolves to the JSON response data.
 * @throws {Error} If the network response is not ok.
 */
async function fetchFromTMDB(endpoint, queryParams = '') {
    // Construct the full URL with the required API key
    const url = `${API_BASE_URL}${endpoint}?api_key=${API_KEY}${queryParams}`;
    
    try {
        const response = await fetch(url);

        // Check if the response was successful (status code in the 200-299 range)
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); // Try to get error details
            throw new Error(`HTTP error! Status: ${response.status} - ${errorData.status_message || 'Unknown error'}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Error fetching from TMDB endpoint ${endpoint}:`, error);
        // Re-throw the error to be handled by the calling function (e.g., in the view renderer)
        throw error;
    }
}

// --- Exported API Functions ---

/**
 * Fetches the most popular movies trending this week.
 * @returns {Promise<object>} A promise resolving to the trending movies data.
 */
export function getTrendingMovies() {
    return fetchFromTMDB('/trending/movie/week');
}

/**
 * Fetches upcoming movies for the US region.
 * @returns {Promise<object>} A promise resolving to the upcoming movies data.
 */
export function getUpcomingMovies() {
    // Adding region and language parameters for more relevant results
    return fetchFromTMDB('/movie/upcoming', '&language=en-US&region=US');
}

/**
 * Fetches the full details for a specific movie, including trailers and cast.
 * @param {number} movieId - The TMDB ID of the movie.
 * @returns {Promise<object>} A promise resolving to the movie details object.
 */
export function getMovieDetails(movieId) {
    // Append 'videos' for trailers and 'credits' for cast information
    return fetchFromTMDB(`/movie/${movieId}`, '&append_to_response=videos,credits');
}

/**
 * Searches for a movie on TMDB based on its title and year.
 * Returns the first and most likely match.
 * @param {string} type - The content type ('movie' or 'tv').
 * @param {string} title - The title of the content.
 * @param {string} year - The release year of the content.
 * @returns {Promise<object|null>} The first search result object, or null if no match is found.
 */
export async function searchTMDB(type, title, year) {
    const endpoint = `/search/${type}`;
    const queryParams = `&query=${encodeURIComponent(title)}&primary_release_year=${year}`;
    try {
        const data = await fetchFromTMDB(endpoint, queryParams);
        // Return the first result if it exists, otherwise null
        return data.results && data.results.length > 0 ? data.results[0] : null;
    } catch (error) {
        console.error(`Failed to search for ${title} (${year}):`, error);
        return null; // Return null on error to prevent breaking the search results page
    }
}

/**
 * Constructs a full URL for a TMDB poster or backdrop image.
 * Provides a fallback placeholder image if the path is missing.
 * @param {string|null} imagePath - The path from the TMDB API (e.g., '/xxxxx.jpg').
 * @param {string} [size='w500'] - The desired image size (e.g., 'w300', 'w500', 'original').
 * @returns {string} The complete, absolute URL to the image.
 */
export function getPosterUrl(imagePath, size = 'w500') {
    if (!imagePath) {
        // Return a professional-looking placeholder that fits the dark theme
        return `https://via.placeholder.com/500x750/101010/333333?text=No+Image`;
    }
    return `${IMAGE_BASE_URL}${size}${imagePath}`;
}
