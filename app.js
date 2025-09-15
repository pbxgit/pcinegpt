/*
================================================================
APP.JS - MAIN APPLICATION ORCHESTRATOR & SPA ROUTER (OVERHAULED)
- The single entry point and core controller for the pcinegpt application.
- Implements a lightweight, hash-based SPA router to manage views.
- Handles view lifecycle, state management, and global event listeners.
- Orchestrates data flow between the UI and the refactored API modules.
================================================================
*/

// --- Module Imports ---
import * as TMDB_API from './api.js';
import * as GEMINI_API from './gemini.js';
import * as TRAKT_API from './trakt.js';
import * as STORAGE from './storage.js';

// --- DOM Element Cache ---
// Caching these elements prevents repeated and costly DOM queries.
const appRoot = document.getElementById('app-root');
const searchInput = document.getElementById('search-input');
const traktAuthButton = document.getElementById('trakt-auth-button');
const statsNavLink = document.getElementById('stats-nav-link');

// --- Application State ---
// A simple object to hold application-level state.
const state = {
    isTraktAuthenticated: !!STORAGE.getTraktTokens(),
};

// --- VIEWS & RENDERING LOGIC ---

/**
 * Renders a loading spinner and message.
 * @param {string} message - The text to display below the spinner.
 * @returns {string} HTML string for the loading indicator.
 */
function renderLoading(message = 'Loading...') {
    return `
        <div class="loading-container">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
}

/**
 * Renders an error message view.
 * @param {string} errorMessage - The error message to display.
 * @returns {string} HTML string for the error view.
 */
function renderError(errorMessage = 'Something went wrong.') {
    return `
        <div class="error-container" style="text-align: center; padding: 5rem 0;">
            <h2>Oops!</h2>
            <p>${errorMessage}</p>
        </div>
    `;
}

/**
 * Creates the HTML for a single movie/show poster card.
 * @param {object} item - A movie or show object from the TMDB API.
 * @returns {string} HTML string for a poster card.
 */
function renderPosterCard(item) {
    if (!item || !item.id || !item.poster_path) return '';
    const imageUrl = TMDB_API.getImageUrl(item.poster_path, 'w500');
    // Using data-src for lazy loading
    return `
        <div class="poster-card" data-movie-id="${item.id}">
            <a href="#movie/${item.id}">
                <img data-src="${imageUrl}" alt="${item.title || item.name}" class="lazy">
            </a>
            <!-- Favorite icon can be implemented later -->
        </div>
    `;
}

/**
 * Creates the HTML for a carousel of poster cards.
 * @param {string} title - The title of the carousel (e.g., "Trending").
 * @param {Array<object>} items - An array of movie/show objects.
 * @returns {string} HTML string for a complete carousel section.
 */
function renderCarousel(title, items) {
    if (!items || items.length === 0) return '';
    return `
        <section class="carousel">
            <h2>${title}</h2>
            <div class="carousel-content">
                ${items.map(renderPosterCard).join('')}
            </div>
        </section>
    `;
}

/**
 * The Home View: Displays curated carousels of movies.
 */
async function renderHomeView() {
    appRoot.innerHTML = renderLoading('Fetching the latest movies...');
    try {
        const [trending, upcoming] = await Promise.all([
            TMDB_API.getTrendingMovies(),
            TMDB_API.getUpcomingMovies()
        ]);
        appRoot.innerHTML = `
            <div class="view home-view">
                <div class="hero-section">
                    <h1>Welcome to pcinegpt</h1>
                    <p class="tagline">Navigating the Cinematic Universe with AI.</p>
                </div>
                ${renderCarousel('Trending This Week', trending.results)}
                ${renderCarousel('Coming Soon', upcoming.results)}
            </div>
        `;
    } catch (error) {
        console.error('Error rendering home view:', error);
        appRoot.innerHTML = renderError('Could not load movie carousels. Please try again later.');
    }
}

/**
 * The Search View: Handles AI-powered search and displays results.
 * @param {string} query - The user's search query.
 */
async function renderSearchView(query) {
    appRoot.innerHTML = renderLoading(`Analyzing your request: "${query}"...`);

    try {
        // 1. Get Trakt data if authenticated, for personalization.
        let recentlyWatchedList = '';
        let highlyRatedList = '';
        if (state.isTraktAuthenticated) {
            const [history, ratings] = await Promise.all([
                TRAKT_API.getTraktHistory(),
                TRAKT_API.getTraktRatings()
            ]);
            recentlyWatchedList = history.map(item => `- ${item.movie.title} (${item.movie.year})`).join('\n');
            highlyRatedList = ratings.map(item => `- ${item.movie.title} (${item.movie.year})`).join('\n');
        }

        // 2. Get AI recommendations.
        const { type } = await GEMINI_API.analyzeQuery(query);
        const recommendationsText = await GEMINI_API.getAIRecommendations({
            searchQuery: query,
            type,
            highlyRatedList,
            recentlyWatchedList
        });
        const aiResults = GEMINI_API.parseAIResponse(recommendationsText);

        if (aiResults.length === 0) {
            appRoot.innerHTML = renderError(`The AI could not find any results for "${query}".`);
            return;
        }

        appRoot.innerHTML = renderLoading(`Finding details for ${aiResults.length} recommendations...`);

        // 3. Fetch TMDB data for each AI recommendation concurrently.
        const tmdbDataPromises = aiResults.map(result =>
            TMDB_API.findTMDBEntry(result.type, result.title, result.year)
        );
        const tmdbResults = (await Promise.all(tmdbDataPromises)).filter(Boolean);

        // 4. Render the final grid.
        appRoot.innerHTML = `
            <div class="view search-view">
                <h1>Results for: <span class="query-display">"${query}"</span></h1>
                <div class="search-results-grid">
                    ${tmdbResults.map(renderPosterCard).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error during AI search process:', error);
        appRoot.innerHTML = renderError('An error occurred during the AI search.');
    }
}

/**
 * The Movie Detail View: Shows detailed information about a single movie.
 * @param {string} movieId - The TMDB ID of the movie.
 */
async function renderDetailView(movieId) {
    appRoot.innerHTML = renderLoading('Loading movie details...');
    try {
        const movie = await TMDB_API.getMovieDetails(movieId);
        const backdropUrl = TMDB_API.getImageUrl(movie.backdrop_path, 'original');
        const posterUrl = TMDB_API.getImageUrl(movie.poster_path, 'w500');

        const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
        const runtime = movie.runtime ? `${movie.runtime} min` : 'N/A';
        const genres = movie.genres.map(g => g.name).join(', ');

        appRoot.innerHTML = `
            <div class="view detail-view">
                <div class="backdrop" style="background-image: url(${backdropUrl});"></div>
                <div class="detail-content">
                    <header class="detail-header">
                        <div class="detail-poster">
                            <img src="${posterUrl}" alt="${movie.title}" id="detail-poster-img" crossOrigin="anonymous">
                        </div>
                        <div class="detail-title">
                            <h1>${movie.title}</h1>
                            <p>${movie.tagline}</p>
                            <div class="detail-meta">
                                <span>${releaseYear}</span>
                                <span>${runtime}</span>
                                <span>${genres}</span>
                            </div>
                            <div class="detail-actions">
                                <button class="watchlist-btn" data-movie-id="${movie.id}">Add to Watchlist</button>
                            </div>
                        </div>
                    </header>
                    <section class="detail-body">
                        <h2>Overview</h2>
                        <p>${movie.overview}</p>
                    </section>
                    <div id="similar-movies-container"></div>
                </div>
            </div>
        `;

        // Asynchronously update theme and load similar movies after initial render
        updateThemeFromPoster(posterUrl);
        renderSimilarMovies(movieId, 'similar-movies-container');

    } catch (error) {
        console.error(`Error rendering detail view for movie ID ${movieId}:`, error);
        appRoot.innerHTML = renderError('Could not load movie details.');
    }
}

/**
 * The Stats View: Displays the user's Trakt.tv statistics.
 */
async function renderStatsView() {
    if (!state.isTraktAuthenticated) {
        appRoot.innerHTML = `
            <div class="view stats-view">
                <div class="stats-prompt">
                    <h2>Connect Your Trakt.tv Account</h2>
                    <p>See your personal viewing statistics, like total watch time and top genres.</p>
                    <button class="trakt-button" id="stats-connect-button">Connect Trakt</button>
                </div>
            </div>
        `;
        // Re-bind the click listener for the button inside the view
        document.getElementById('stats-connect-button').addEventListener('click', TRAKT_API.redirectToTraktAuth);
        return;
    }

    appRoot.innerHTML = renderLoading("Fetching your stats...");
    try {
        const stats = await TRAKT_API.getUserStats();
        const totalHours = Math.round(stats.movies.minutes / 60) + Math.round(stats.shows.watched_episodes * 45 / 60);

        // Basic genre calculation (can be expanded)
        const genreCounts = {};
        const [history] = await Promise.all([TRAKT_API.getTraktHistory(50)]);
        // This is a simplified genre aggregation. A more robust solution would fetch genres for each item.
        // For now, it's a placeholder to demonstrate the stats card layout.

        appRoot.innerHTML = `
            <div class="view stats-view">
                <h1>My Stats</h1>
                <div class="stats-grid">
                    <div class="stat-card">
                        <h2>Total Watch Time</h2>
                        <p class="stat-highlight">${totalHours.toLocaleString()}</p>
                        <p class="stat-label">Hours</p>
                    </div>
                    <div class="stat-card">
                        <h2>Movies Watched</h2>
                        <p class="stat-highlight">${stats.movies.watched.toLocaleString()}</p>
                        <p class="stat-label">Movies</p>
                    </div>
                     <div class="stat-card">
                        <h2>Shows Watched</h2>
                        <p class="stat-highlight">${stats.shows.watched.toLocaleString()}</p>
                        <p class="stat-label">Series</p>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error rendering stats view:', error);
        appRoot.innerHTML = renderError('Could not load your Trakt stats.');
    }
}


// --- DYNAMIC & ASYNC UI HELPERS ---

/**
 * Uses ColorThief to extract the dominant color from a poster and apply it as a theme.
 * @param {string} posterUrl - The URL of the poster image.
 */
function updateThemeFromPoster(posterUrl) {
    const posterImg = document.getElementById('detail-poster-img');
    const colorThief = new ColorThief();

    posterImg.addEventListener('load', () => {
        try {
            const dominantColor = colorThief.getColor(posterImg);
            const [r, g, b] = dominantColor;
            document.documentElement.style.setProperty('--theme-color-primary', `rgb(${r},${g},${b})`);
            // Also theme the meta color for mobile browsers
            document.querySelector('meta[name="theme-color"]').setAttribute('content', `rgb(${r},${g},${b})`);
        } catch (e) {
            console.error('ColorThief error:', e);
            // Fallback to default if there's an error
            document.documentElement.style.setProperty('--theme-color-primary', `var(--color-primary)`);
        }
    });
    // If the image is already cached and loaded, the 'load' event might not fire
    if (posterImg.complete) {
        posterImg.dispatchEvent(new Event('load'));
    }
}

/**
 * Fetches and renders similar movies into a container.
 * @param {string} movieId - The ID of the movie to find similar titles for.
 * @param {string} containerId - The ID of the element to render the carousel into.
 */
async function renderSimilarMovies(movieId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const similar = await TMDB_API.getSimilarMovies(movieId);
        if (similar.results && similar.results.length > 0) {
            container.innerHTML = renderCarousel('You Might Also Like', similar.results);
            observeImages(container); // Activate lazy loading for the new images
        }
    } catch (error) {
        console.warn('Could not fetch similar movies:', error);
        // Fail silently, as this is a non-critical component.
    }
}

/**
 * Sets up an IntersectionObserver to lazy-load images.
 * @param {HTMLElement} parentElement - The element to search for images within.
 */
function observeImages(parentElement = document) {
    const lazyImages = parentElement.querySelectorAll('img.lazy');
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const image = entry.target;
                    image.src = image.dataset.src;
                    image.classList.remove('lazy');
                    image.classList.add('loaded');
                    observer.unobserve(image);
                }
            });
        });
        lazyImages.forEach(img => imageObserver.observe(img));
    } else {
        // Fallback for older browsers
        lazyImages.forEach(img => {
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            img.classList.add('loaded');
        });
    }
}


// --- ROUTER ---

const routes = {
    '': renderHomeView,
    'search/:query': renderSearchView,
    'movie/:id': renderDetailView,
    'stats': renderStatsView,
};

/**
 * The main router function. Parses the URL hash and calls the appropriate view renderer.
 */
async function router() {
    const hash = window.location.hash.substring(1); // Remove '#'
    const [path, ...params] = hash.split('/');
    
    // Reset theme color on navigation
    document.documentElement.style.setProperty('--theme-color-primary', 'var(--color-primary)');
    document.querySelector('meta[name="theme-color"]').setAttribute('content', '#121212');

    let renderFunc = routes[path] || routes['']; // Default to home view
    let queryParam;

    // Handle parameterized routes like #search/query or #movie/id
    if (path === 'search' && params.length > 0) {
        renderFunc = routes['search/:query'];
        queryParam = decodeURIComponent(params.join('/'));
    } else if (path === 'movie' && params.length > 0) {
        renderFunc = routes['movie/:id'];
        queryParam = params[0];
    }
    
    // View transition
    appRoot.classList.add('view-exit');
    await new Promise(resolve => setTimeout(resolve, 150)); // Match CSS animation duration

    await renderFunc(queryParam);
    
    appRoot.classList.remove('view-exit');
    appRoot.classList.add('view-enter');
    await new Promise(resolve => setTimeout(resolve, 150));
    appRoot.classList.remove('view-enter');

    // Activate lazy loading for any new images in the view
    observeImages();
    window.scrollTo(0, 0); // Scroll to top on view change
}

// --- GLOBAL EVENT LISTENERS & INITIALIZATION ---

/**
 * Updates header UI based on Trakt authentication state.
 */
function updateUIForAuthState() {
    if (state.isTraktAuthenticated) {
        traktAuthButton.textContent = 'Logout Trakt';
        traktAuthButton.onclick = TRAKT_API.logoutTrakt;
        statsNavLink.style.display = 'inline-block';
    } else {
        traktAuthButton.textContent = 'Connect Trakt';
        traktAuthButton.onclick = TRAKT_API.redirectToTraktAuth;
        statsNavLink.style.display = 'none';
    }
}

/**
 * Handles the search input submission.
 * @param {Event} event
 */
function handleSearch(event) {
    if (event.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
            window.location.hash = `search/${encodeURIComponent(query)}`;
            searchInput.value = ''; // Clear input after search
        }
    }
}

/**
 * Main application initialization function.
 */
async function init() {
    // Register the service worker for PWA capabilities
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(() => console.log('Service Worker registered successfully.'))
            .catch(err => console.error('Service Worker registration failed:', err));
    }

    // Set up global event listeners
    window.addEventListener('hashchange', router);
    searchInput.addEventListener('keydown', handleSearch);

    // Check for Trakt OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const traktAuthCode = urlParams.get('code');

    if (traktAuthCode) {
        appRoot.innerHTML = renderLoading('Finalizing Trakt connection...');
        await TRAKT_API.handleTraktCallback(traktAuthCode);
        state.isTraktAuthenticated = true;
        // The callback handler already cleans the URL, so we can just navigate home
        window.location.hash = '';
    }

    updateUIForAuthState();
    
    // Initial route
    router();
}

// --- Let's go! ---
document.addEventListener('DOMContentLoaded', init);
