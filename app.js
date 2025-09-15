/*
================================================================
APP.JS - MAIN APPLICATION ENTRY POINT
- Initializes the application, service worker, and authentication logic.
- Contains the client-side router for SPA-like navigation.
- Manages the rendering of different 'views' into the app-root.
================================================================
*/

// Import modules
import * as api from './api.js';
import * as storage from './storage.js';
import * as trakt from './trakt.js';
import * as gemini from './gemini.js';


/**
 * Router to manage SPA navigation.
 */
const router = {
    routes: {
        '': 'HomeView',
        'home': 'HomeView',
        'search': 'SearchView' // New route for search results
    },

    async navigate() {
        // Extract the base path and the query parameter
        const fullHash = window.location.hash.slice(1);
        const [path, query] = fullHash.split('?');
        const viewName = this.routes[path.toLowerCase()] || this.routes[''];

        if (viewName) {
            const view = new window[viewName]();
            // Pass the query to the view's render method
            view.render(query); 
        } else {
            console.error(`No route found for path: ${path}`);
        }
    }
};

/**
 * Home View: Renders the main landing page.
 */
class HomeView {
    async render() {
        const appRoot = document.getElementById('app-root');
        appRoot.innerHTML = `
            <div class="view home-view">
                <section class="hero-section">
                    <h1>Welcome to pcinegpt.</h1>
                    <p class="tagline">Navigating the Cinematic Universe with AI.</p>
                </section>
                <section id="trending-carousel" class="carousel">
                    <h2>Trending Now</h2>
                    <div class="carousel-content"></div>
                </section>
                <section id="upcoming-carousel" class="carousel">
                    <h2>Coming Soon</h2>
                    <div class="carousel-content"></div>
                </section>
            </div>
        `;
        await this.renderCarousel('#trending-carousel', api.getTrendingMovies);
        await this.renderCarousel('#upcoming-carousel', api.getUpcomingMovies);
        lazyLoadImages();
    }

    async renderCarousel(carouselId, apiFunction) { /* ... (This function remains unchanged) ... */ }
}
// This is a condensed version for brevity. Assume the full function from the previous step is here.
HomeView.prototype.renderCarousel = async function(carouselId, apiFunction) {
    const contentContainer = document.querySelector(`${carouselId} .carousel-content`);
    try {
        const data = await apiFunction();
        const movies = data.results;
        if (movies && movies.length > 0) {
            contentContainer.innerHTML = movies.map(movie => {
                if (!movie.poster_path) return '';
                const activeClass = storage.isMovieInWatchlist(movie.id) ? 'active' : '';
                return `
                    <div class="poster-card" data-movie-id="${movie.id}">
                        <img class="lazy" data-src="${api.getPosterUrl(movie.poster_path)}" alt="${movie.title}">
                        <div class="favorite-icon ${activeClass}" data-movie-id="${movie.id}"><svg viewBox="0 0 24 24"><path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"></path></svg></div>
                    </div>`;
            }).join('');
        }
    } catch (error) { console.error(`Failed to render carousel ${carouselId}:`, error); }
};

/**
 * Search View: Renders the AI-powered search results.
 */
class SearchView {
    async render(queryString) {
        const appRoot = document.getElementById('app-root');
        const queryParams = new URLSearchParams(queryString);
        const query = queryParams.get('q');

        if (!query) {
            appRoot.innerHTML = `<div class="view search-view"><h1>Please enter a search term.</h1></div>`;
            return;
        }

        // Render loading state immediately
        appRoot.innerHTML = `
            <div class="view search-view">
                <h1>Results for: <span class="query-display">"${query}"</span></h1>
                <div class="loading-container">
                    <div class="spinner"></div>
                    <p>Asking the AI for recommendations...</p>
                </div>
                <div class="search-results-grid"></div>
            </div>
        `;

        try {
            // 1. Analyze the user's query
            const analysis = await gemini.analyzeQuery(query);
            
            // 2. Get recommendations from Gemini
            const recommendationsText = await gemini.getAIRecommendations({
                searchQuery: query,
                type: analysis.type,
                numResults: 12
            });

            // 3. Parse the AI response
            const recommendations = recommendationsText.trim().split('\n').map(line => {
                const [type, name, year] = line.split('|');
                return { type, name, year };
            });

            // 4. Fetch poster data for each recommendation from TMDB
            const resultsWithPosters = await Promise.all(
                recommendations.map(async (rec) => {
                    const tmdbData = await api.searchTMDB(rec.type === 'series' ? 'tv' : 'movie', rec.name, rec.year);
                    return { ...rec, tmdbData };
                })
            );

            // 5. Render the final results
            const resultsGrid = document.querySelector('.search-results-grid');
            document.querySelector('.loading-container').style.display = 'none'; // Hide spinner

            resultsGrid.innerHTML = resultsWithPosters.map(item => {
                if (!item.tmdbData) return ''; // Skip if no TMDB match found
                const activeClass = storage.isMovieInWatchlist(item.tmdbData.id) ? 'active' : '';
                const posterPath = item.tmdbData.poster_path;

                return `
                    <div class="poster-card" data-movie-id="${item.tmdbData.id}">
                        <img class="lazy" data-src="${api.getPosterUrl(posterPath)}" alt="${item.name}">
                        <div class="favorite-icon ${activeClass}" data-movie-id="${item.tmdbData.id}"><svg viewBox="0 0 24 24"><path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"></path></svg></div>
                    </div>
                `;
            }).join('');

            lazyLoadImages(); // Activate lazy loading for new images

        } catch (error) {
            console.error('Failed to get AI search results:', error);
            document.querySelector('.loading-container').innerHTML = `<p>Sorry, something went wrong while fetching results.</p>`;
        }
    }
}


// Make views globally accessible
window.HomeView = HomeView;
window.SearchView = SearchView;


// --- Event Handlers & Initializers ---

function handleWatchlistClick(event) { /* ... (Unchanged) ... */ }
HomeView.prototype.handleWatchlistClick = function(event) {
    const icon = event.target.closest('.favorite-icon');
    if (!icon) return;
    const movieId = parseInt(icon.dataset.movieId, 10);
    if (!movieId) return;
    if (storage.isMovieInWatchlist(movieId)) {
        storage.removeFromWatchlist(movieId);
        icon.classList.remove('active');
    } else {
        storage.addToWatchlist(movieId);
        icon.classList.add('active');
    }
};

function lazyLoadImages() { /* ... (Unchanged) ... */ }
HomeView.prototype.lazyLoadImages = function() {
    const lazyImages = document.querySelectorAll('img.lazy');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.onload = () => { img.classList.remove('lazy'); img.classList.add('loaded'); };
                    obs.unobserve(img);
                }
            });
        });
        lazyImages.forEach(img => observer.observe(img));
    }
};

function registerServiceWorker() { /* ... (Unchanged) ... */ }

function updateTraktButtonUI() { /* ... (Unchanged) ... */ }
HomeView.prototype.updateTraktButtonUI = function() {
    const authButton = document.getElementById('trakt-auth-button');
    if (storage.getTraktTokens()) {
        authButton.textContent = 'Logout Trakt';
    } else {
        authButton.textContent = 'Connect Trakt';
    }
};

function handleSearch(event) {
    if (event.key === 'Enter') {
        const searchInput = event.target;
        const query = searchInput.value.trim();
        if (query) {
            // Navigate to the search view with the query
            window.location.hash = `#search?q=${encodeURIComponent(query)}`;
            searchInput.value = ''; // Clear the input
        }
    }
}

async function initialize() {
    registerServiceWorker();

    // Event Listeners
    document.getElementById('app-root').addEventListener('click', HomeView.prototype.handleWatchlistClick);
    document.getElementById('search-input').addEventListener('keypress', handleSearch);
    document.getElementById('trakt-auth-button').addEventListener('click', () => {
        storage.getTraktTokens() ? trakt.logoutTrakt() : trakt.redirectToTraktAuth();
    });

    // Handle Trakt callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code')) {
        await trakt.handleTraktCallback(urlParams.get('code'));
    }
    
    HomeView.prototype.updateTraktButtonUI();

    // Set up router
    window.addEventListener('hashchange', () => router.navigate());
    // Initial load navigation
    if (!window.location.hash) {
        window.location.hash = '#home';
    }
    router.navigate();
}

document.addEventListener('DOMContentLoaded', initialize);
