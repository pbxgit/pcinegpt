/*
================================================================
API.JS - TMDB API INTERACTION MODULE
- Handles all communication with The Movie Database (TMDB) API.
- Exports functions to fetch data like trending, upcoming, etc.
- Manages API key and base URLs centrally.
================================================================
*/

// --- Configuration ---

// IMPORTANT: Replace with your actual TMDB API Key.
// You can get a free key by signing up at https://www.themoviedb.org/
const API_KEY = '5bd8970deaa0e82346fc042a97499a59';

const API_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

// --- Core API Fetch Function ---

/**
 * A generic function to fetch data from a specified TMDB endpoint.
 * @param {string} endpoint - The API endpoint to request (e.g., '/movie/popular').
 * @param {string} [queryParams=''] - Optional query parameters (e.g., '&page=2').
 * @returns {Promise<object>} A promise that resolves to the JSON response data.
 * @throws {Error} If the network response is not ok.
 */
async function fetchFromTMDB(endpoint, queryParams = '') {
    const url = `${API_BASE_URL}${endpoint}?api_key=${API_KEY}${queryParams}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching from TMDB endpoint ${endpoint}:`, error);
        throw error; // Re-throw the error to be handled by the caller
    }
}

// --- Exported API Functions ---

/**
 * Fetches the list of trending movies for the week.
 * @returns {Promise<object>} A promise that resolves to the API response.
 */
export function getTrendingMovies() {
    return fetchFromTMDB('/trending/movie/week');
}

/**
 * Fetches the list of upcoming movies.
 * @returns {Promise<object>} A promise that resolves to the API response.
 */
export function getUpcomingMovies() {
    return fetchFromTMDB('/movie/upcoming', '&region=US&language=en-US');
}

/**
 * Constructs a full image URL for a given poster path and size.
 * @param {string} posterPath - The path to the poster image from the API.
 * @param {string} [size='w500'] - The desired image width (e.g., 'w300', 'w500', 'original').
 * @returns {string} The complete, absolute URL for the image.
 */
export function getPosterUrl(posterPath, size = 'w500') {
    return `${IMAGE_BASE_URL}${size}${posterPath}`;
}
