/*
================================================================
APP.JS - MAIN APPLICATION ENTRY POINT (DEBUGGED & REFACTORED)
- Initializes the application and all core features.
- Contains a more robust client-side router and view management
  system that properly handles cleanup to prevent memory leaks.
================================================================
*/

// Import modules with consistent named imports
import { getTrendingMovies, getUpcomingMovies, getPosterUrl, getMovieDetails, searchTMDB } from './api.js';
import { getWatchlist, addToWatchlist, removeFromWatchlist, isMovieInWatchlist, getTraktTokens } from './storage.js';
import { redirectToTraktAuth, handleTraktCallback, logoutTrakt } from './trakt.js';
import { analyzeQuery, getAIRecommendations } from './gemini.js';


// --- VIEW CLASSES ---

class HomeView {
    async render() {
        document.getElementById('app-root').innerHTML = `
            <div class="view home-view">
                <section class="hero-section">
                    <h1>Welcome to pcinegpt.</h1>
                    <p class="tagline">Navigating the Cinematic Universe with AI.</p>
                </section>
                <section id="trending-carousel" class="carousel"><h2>Trending Now</h2><div class="carousel-content"></div></section>
                <section id="upcoming-carousel" class="carousel"><h2>Coming Soon</h2><div class="carousel-content"></div></section>
            </div>
        `;
        await this.renderCarousel('#trending-carousel', getTrendingMovies);
        await this.renderCarousel('#upcoming-carousel', getUpcomingMovies);
        lazyLoadImages();
    }

    async renderCarousel(carouselId, apiFunction) {
        const contentContainer = document.querySelector(`${carouselId} .carousel-content`);
        try {
            const data = await apiFunction();
            if (data && data.results) {
                contentContainer.innerHTML = data.results.map(movie => {
                    if (!movie.poster_path) return '';
                    return createPosterCardHTML(movie);
                }).join('');
            }
        } catch (error) { console.error(`Failed to render carousel ${carouselId}:`, error); }
    }
    // This view has no listeners to clean up, so no destroy method is needed.
}

class SearchView {
    async render(queryString) {
        const appRoot = document.getElementById('app-root');
        const query = new URLSearchParams(queryString).get('q');
        if (!query) {
            appRoot.innerHTML = `<div class="view search-view"><h1>Please provide a search query.</h1></div>`;
            return;
        }

        appRoot.innerHTML = createLoadingHTML(query);

        try {
            const analysis = await analyzeQuery(query);
            const recommendationsText = await getAIRecommendations({ searchQuery: query, type: analysis.type, numResults: 12 });
            const recommendations = recommendationsText.trim().split('\n').map(line => {
                const [type, name, year] = line.split('|');
                return { type, name, year };
            });

            const resultsWithData = await Promise.all(
                recommendations.map(rec => searchTMDB(rec.type === 'series' ? 'tv' : 'movie', rec.name, rec.year))
            );

            document.querySelector('.loading-container').style.display = 'none';
            const resultsGrid = document.querySelector('.search-results-grid');
            resultsGrid.innerHTML = resultsWithData
                .filter(Boolean) // Filter out any null results from searchTMDB
                .map(movieData => createPosterCardHTML(movieData))
                .join('');
            lazyLoadImages();
        } catch (error) {
            console.error('Failed to get AI search results:', error);
            document.querySelector('.loading-container').innerHTML = `<p>Sorry, an error occurred while asking the AI.</p>`;
        }
    }
}

class DetailView {
    constructor() {
        this.handleParallaxScroll = this.handleParallaxScroll.bind(this);
    }

    async render(movieId) {
        if (!movieId) return;
        const appRoot = document.getElementById('app-root');
        appRoot.innerHTML = `<div class="loading-container"><div class="spinner"></div></div>`;
        
        try {
            const details = await getMovieDetails(movieId);
            const posterUrl = getPosterUrl(details.poster_path, 'w500');

            appRoot.innerHTML = `
                <div class="view detail-view">
                    <div class="backdrop"></div>
                    <div class="detail-content">
                        <header class="detail-header">
                            <div class="detail-poster"><img src="${posterUrl}" alt="${details.title}" crossorigin="anonymous"></div>
                            <div class="detail-title">
                                <h1>${details.title}</h1>
                                <p>${details.tagline || ''}</p>
                                <div class="detail-meta">
                                    <span>${new Date(details.release_date).getFullYear()}</span>
                                    <span>•</span>
                                    <span>${details.runtime} min</span>
                                    <span>•</span>
                                    <span>⭐ ${details.vote_average.toFixed(1)}</span>
                                </div>
                                <div class="detail-actions"></div>
                            </div>
                        </header>
                        <main class="detail-body">
                            <h2>Overview</h2>
                            <p>${details.overview}</p>
                        </main>
                    </div>
                </div>
            `;
            
            this.setupParallax(details.backdrop_path);
            this.setupDynamicTheming(movieId);
        } catch (error) {
            console.error('Failed to render detail view:', error);
            appRoot.innerHTML = `<p>Could not load movie details.</p>`;
        }
    }
    
    setupDynamicTheming(movieId) {
        const posterImg = document.querySelector('.detail-poster img');
        if (posterImg.complete) {
            this.applyColorTheme(posterImg, movieId);
        } else {
            posterImg.addEventListener('load', () => this.applyColorTheme(posterImg, movieId), { once: true });
        }
    }

    applyColorTheme(imgElement, movieId) {
        const colorThief = new ColorThief();
        const [r, g, b] = colorThief.getColor(imgElement);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        const textColor = brightness > 125 ? '#000000' : '#FFFFFF';
        const themeColor = `rgb(${r}, ${g}, ${b})`;
        
        document.documentElement.style.setProperty('--theme-color-primary', themeColor);
        document.documentElement.style.setProperty('--theme-color-text', textColor);
        
        const isInWatchlist = isMovieInWatchlist(movieId);
        document.querySelector('.detail-actions').innerHTML = `
            <button class="watchlist-btn" data-movie-id="${movieId}">
                ${isInWatchlist ? '✓ Added to Watchlist' : '+ Add to Watchlist'}
            </button>`;
    }

    setupParallax(backdropPath) {
        this.backdrop = document.querySelector('.backdrop');
        if (this.backdrop) {
            this.backdrop.style.backgroundImage = `url(${getPosterUrl(backdropPath, 'original')})`;
            window.addEventListener('scroll', this.handleParallaxScroll);
        }
    }

    handleParallaxScroll() {
        if (this.backdrop) {
            this.backdrop.style.transform = `translateY(${window.scrollY * 0.4}px)`;
        }
    }
    
    destroy() {
        window.removeEventListener('scroll', this.handleParallaxScroll);
        document.documentElement.style.removeProperty('--theme-color-primary');
        document.documentElement.style.removeProperty('--theme-color-text');
        console.log('DetailView destroyed, scroll listener removed.');
    }
}

// --- ROUTER & LIFECYCLE MANAGEMENT (REFACTORED) ---
const router = {
    routes: {
        '': HomeView,
        'home': HomeView,
        'search': SearchView,
        'detail': DetailView
    },
    currentView: null,

    async navigate() {
        // 1. Clean up the previous view
        if (this.currentView && typeof this.currentView.destroy === 'function') {
            this.currentView.destroy();
        }

        // 2. Determine the new view
        const fullHash = window.location.hash.slice(1);
        const [path, param] = fullHash.split('/');
        const [basePath, query] = path.split('?');
        
        const ViewClass = this.routes[basePath.toLowerCase()] || this.routes[''];
        if (ViewClass) {
            // 3. Create a new instance and render it
            this.currentView = new ViewClass();
            this.currentView.render(param || query);
        } else {
            console.error(`No route found for path: ${basePath}`);
            // Optionally, render a 404 view
            document.getElementById('app-root').innerHTML = `<h1>404 - Not Found</h1>`;
        }
    }
};

// --- GLOBAL HELPER FUNCTIONS ---

function createPosterCardHTML(movieData) {
    const id = movieData.id;
    const title = movieData.title || movieData.name;
    const posterPath = movieData.poster_path;
    const isInWatchlist = isMovieInWatchlist(id);

    return `
        <div class="poster-card" data-movie-id="${id}">
            <a href="#detail/${id}">
                <img class="lazy" data-src="${getPosterUrl(posterPath)}" alt="${title}">
            </a>
            <div class="favorite-icon ${isInWatchlist ? 'active' : ''}" data-movie-id="${id}">
                <svg viewBox="0 0 24 24"><path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"></path></svg>
            </div>
        </div>`;
}

function createLoadingHTML(query) {
    return `<div class="view search-view"><h1>Results for: <span class="query-display">"${query}"</span></h1><div class="loading-container"><div class="spinner"></div><p>Asking the AI...</p></div><div class="search-results-grid"></div></div>`;
}

function handleWatchlistClick(event) {
    const target = event.target.closest('.favorite-icon, .watchlist-btn');
    if (!target) return;
    const movieId = parseInt(target.dataset.movieId, 10);
    if (!movieId) return;
    
    const isAdding = !isMovieInWatchlist(movieId);
    
    if (isAdding) {
        addToWatchlist(movieId);
    } else {
        removeFromWatchlist(movieId);
    }
    
    // Update all relevant UI elements on the page
    document.querySelectorAll(`[data-movie-id="${movieId}"]`).forEach(el => {
        if (el.classList.contains('favorite-icon')) {
            el.classList.toggle('active', isAdding);
        }
        if (el.classList.contains('watchlist-btn')) {
            el.textContent = isAdding ? '✓ Added to Watchlist' : '+ Add to Watchlist';
        }
    });
}

function handleSearch(event) {
    if (event.key === 'Enter') {
        const query = event.target.value.trim();
        if (query) {
            window.location.hash = `#search?q=${encodeURIComponent(query)}`;
            event.target.value = '';
        }
    }
}

function lazyLoadImages() {
    const lazyImages = document.querySelectorAll('img.lazy');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    img.onload = () => img.classList.add('loaded');
                    obs.unobserve(img);
                }
            });
        }, { rootMargin: "0px 0px 200px 0px" }); // Start loading images 200px before they enter the viewport
        lazyImages.forEach(img => observer.observe(img));
    } else { // Fallback
        lazyImages.forEach(img => {
            img.src = img.dataset.src;
            img.classList.add('loaded');
        });
    }
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(reg => console.log('Service Worker registered.', reg))
                .catch(err => console.error('Service Worker registration failed:', err));
        });
    }
}

function updateTraktButtonUI() {
    const authButton = document.getElementById('trakt-auth-button');
    if (getTraktTokens()) {
        authButton.textContent = 'Logout Trakt';
    } else {
        authButton.textContent = 'Connect Trakt';
    }
}

// --- INITIALIZATION ---
async function initialize() {
    registerServiceWorker();

    // Setup global event listeners
    document.getElementById('app-root').addEventListener('click', handleWatchlistClick);
    document.getElementById('search-input').addEventListener('keypress', handleSearch);
    document.getElementById('trakt-auth-button').addEventListener('click', () => {
        getTraktTokens() ? logoutTrakt() : redirectToTraktAuth();
    });
    
    // Handle Trakt OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code')) {
        await handleTraktCallback(urlParams.get('code'));
    }
    
    updateTraktButtonUI();
    
    // Setup and start the router
    window.addEventListener('hashchange', () => router.navigate());
    if (!window.location.hash) {
        window.location.hash = '#home';
    }
    router.navigate(); // Initial page load navigation
}

document.addEventListener('DOMContentLoaded', initialize);
