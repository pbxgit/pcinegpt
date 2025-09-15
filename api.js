/*
================================================================
API.JS - TMDB API INTERACTION MODULE
- Handles all communication with The Movie Database (TMDB) API.
- Exports functions to fetch data like trending, upcoming, details, etc.
- Manages API key and base URLs centrally.
================================================================
*/

// --- Configuration ---
const API_KEY = '5bd8970deaa0e82346fc042a97499a59';
const API_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

// --- Core API Fetch Function ---
async function fetchFromTMDB(endpoint, queryParams = '') {
    const url = `${API_BASE_URL}${endpoint}?api_key=${API_KEY}${queryParams}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching from TMDB endpoint ${endpoint}:`, error);
        throw error;
    }
}

// --- Exported API Functions ---

export function getTrendingMovies() {
    return fetchFromTMDB('/trending/movie/week');
}

export function getUpcomingMovies() {
    return fetchFromTMDB('/movie/upcoming', '&region=US&language=en-US');
}

/**
 * Fetches the full details for a specific movie.
 * @param {number} movieId - The TMDB ID of the movie.
 * @returns {Promise<object>} A promise that resolves to the movie details object.
 */
export function getMovieDetails(movieId) {
    // Append 'videos' to the response to get trailer links if available
    return fetchFromTMDB(`/movie/${movieId}`, '&append_to_response=videos');
}

export async function searchTMDB(type, title, year) {
    const endpoint = `/search/${type}`;
    const queryParams = `&query=${encodeURIComponent(title)}&primary_release_year=${year}`;
    try {
        const data = await fetchFromTMDB(endpoint, queryParams);
        return data.results && data.results.length > 0 ? data.results[0] : null;
    } catch (error) {
        console.error(`Failed to search for ${title} (${year}):`, error);
        return null;
    }
}

export function getPosterUrl(posterPath, size = 'w500') {
    if (!posterPath) {
        return 'https://via.placeholder.com/500x750.png?text=No+Image';
    }
    return `${IMAGE_BASE_URL}${size}${posterPath}`;
}
