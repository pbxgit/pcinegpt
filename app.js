/*
================================================================
APP.JS - CORE APPLICATION LOGIC
- SPA Router: Handles navigation and view rendering.
- State Management: Manages the application's state.
- Rendering Lifecycle: Controls how and when components are rendered.
- Event Handling: Centralizes all user interaction logic.
================================================================
*/

// --- MODULE IMPORTS ---
import * as api from './api.js';
import * as gemini from './gemini.js';
import * as trakt from './trakt.js';
import * as storage from './storage.js';

// --- DOM ELEMENT SELECTORS ---
const dom = {
    root: document.getElementById('app-root'),
    header: document.querySelector('.app-header'),
    backdrop: document.querySelector('.backdrop-container'),
    search: {
        overlay: document.getElementById('search-overlay'),
        openBtn: document.getElementById('search-button'),
        closeBtn: document.getElementById('close-search-button'),
        input: document.getElementById('search-input'),
    },
    trakt: {
        authBtn: document.getElementById('trakt-auth-button'),
        statsLink: document.getElementById('stats-nav-link'),
    }
};

// --- APPLICATION STATE ---
const state = {
    isTraktAuthenticated: false,
    currentBackdrop: null,
};

// ================================================================
// --- ROUTING & NAVIGATION ---
// ================================================================

const routes = {
    '/': 'renderHomeView',
    '/movie/:id': 'renderDetailView',
    '/search/:query': 'renderSearchView',
    '/stats': 'renderStatsView',
};

async function router() {
    const hash = window.location.hash.substring(1) || '/';
    const [path, param] = hash.split(/(?<=^\/[a-zA-Z]+)\/(.*)/s).filter(Boolean);

    const routeHandlerName = routes[path] || routes['/'];
    const handler = viewHandlers[routeHandlerName];

    if (handler) {
        showLoading();
        await handler(param); // Pass the ID or query to the handler
    }
}

// ================================================================
// --- VIEW RENDERING LOGIC ---
// ================================================================

const viewHandlers = {
    async renderHomeView() {
        updateBackdrop(); // Clear backdrop for home
        const [trending, upcoming] = await Promise.all([
            api.getTrendingMovies(),
            api.getUpcomingMovies(),
        ]);

        const heroMovie = trending.results[0];
        updateBackdrop(api.getPosterUrl(heroMovie.backdrop_path, 'original'));

        let html = `
            <div class="view">
                <section class="hero-section">
                    <h1>${heroMovie.title}</h1>
                    <p class="tagline">${heroMovie.overview}</p>
                </section>
                ${createCarousel('Trending This Week', trending.results)}
                ${createCarousel('Coming Soon', upcoming.results)}
            </div>
        `;
        render(html);
    },

    async renderDetailView(id) {
        const movie = await api.getMovieDetails(id);
        updateBackdrop(api.getPosterUrl(movie.backdrop_path, 'original'));
        updateThemeColor(api.getPosterUrl(movie.poster_path));

        const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
        const runtime = movie.runtime ? `${movie.runtime} min` : 'N/A';
        const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';

        let html = `
            <div class="view detail-view-container">
                <div class="detail-content">
                    <header class="detail-header">
                        <div class="detail-poster">
                            <img src="${api.getPosterUrl(movie.poster_path)}" alt="${movie.title}">
                        </div>
                        <div class="detail-title">
                            <h1>${movie.title}</h1>
                            <p>${movie.tagline || ''}</p>
                            <div class="detail-meta">
                                <span>${releaseYear}</span>
                                <span>${runtime}</span>
                                <span><i data-lucide="star" style="width: 16px; display: inline-block; margin-right: 4px;"></i>${rating}</span>
                            </div>
                        </div>
                    </header>
                    <section class="detail-body">
                        <h2>Synopsis</h2>
                        <p>${movie.overview}</p>
                    </section>
                </div>
            </div>
        `;
        render(html);
    },

    async renderSearchView(query) {
        updateBackdrop();
        const decodedQuery = decodeURIComponent(query);
        render(`<div class="view search-view"><h1>Results for: <span class="query-display">${decodedQuery}</span></h1><div class="search-results-grid"></div></div>`);
        
        // Use Gemini to get a list of movie titles
        const recommendationsText = await gemini.getAIRecommendations({ searchQuery: decodedQuery, type: 'movie' });
        const recommendationLines = recommendationsText.trim().split('\n');

        const searchGrid = document.querySelector('.search-results-grid');
        
        // Fetch details for each title from TMDB
        const moviePromises = recommendationLines.map(line => {
            const [, title, year] = line.split('|');
            return api.searchTMDB('movie', title, year);
        });

        const movieResults = await Promise.all(moviePromises);
        const validMovies = movieResults.filter(Boolean); // Filter out null results

        if (validMovies.length > 0) {
            searchGrid.innerHTML = validMovies.map(createPosterCard).join('');
            lucide.createIcons(); // Re-initialize icons
        } else {
            searchGrid.innerHTML = `<p>No results found. Try a different query.</p>`;
        }
    },

    async renderStatsView() {
        if (!state.isTraktAuthenticated) {
            render(`
                <div class="view stats-prompt">
                    <h2>Unlock Your Personal Stats</h2>
                    <p>Connect your Trakt.tv account to see detailed statistics about your viewing habits.</p>
                    <button class="trakt-button" id="prompt-trakt-connect">Connect Trakt</button>
                </div>
            `);
            document.getElementById('prompt-trakt-connect').addEventListener('click', trakt.redirectToTraktAuth);
            return;
        }

        const stats = await trakt.getUserStats();
        const { movies, shows, episodes } = stats;

        let html = `
            <div class="view">
                <h1>My Stats</h1>
                <div class="stats-grid">
                    <div class="stat-card">
                        <h2>Total Movies Watched</h2>
                        <div class="stat-highlight">${movies.watched.toLocaleString()}</div>
                        <div class="stat-label">Movies</div>
                    </div>
                    <div class="stat-card">
                        <h2>Total Shows Watched</h2>
                        <div class="stat-highlight">${shows.watched.toLocaleString()}</div>
                        <div class="stat-label">Shows</div>
                    </div>
                    <div class="stat-card">
                        <h2>Total Episodes Watched</h2>
                        <div class="stat-highlight">${episodes.watched.toLocaleString()}</div>
                        <div class="stat-label">Episodes</div>
                    </div>
                     <div class="stat-card">
                        <h2>Total Time Wasted</h2>
                        <div class="stat-highlight">${(movies.minutes / 60 / 24 + episodes.minutes / 60 / 24).toFixed(0)}</div>
                        <div class="stat-label">Days</div>
                    </div>
                </div>
            </div>
        `;
        render(html);
    }
};

function render(html) {
    dom.root.innerHTML = html;
    lucide.createIcons();
}

// ================================================================
// --- COMPONENT FACTORIES ---
// ================================================================

function createCarousel(title, movies) {
    if (!movies || movies.length === 0) return '';
    return `
        <section class="carousel">
            <h2>${title}</h2>
            <div class="carousel-content">
                ${movies.map(createPosterCard).join('')}
            </div>
        </section>
    `;
}

function createPosterCard(movie) {
    const isInWatchlist = storage.isMovieInWatchlist(movie.id);
    return `
        <div class="poster-card" data-movie-id="${movie.id}">
            <a href="#/movie/${movie.id}">
                <img class="lazy" data-src="${api.getPosterUrl(movie.poster_path)}" alt="${movie.title}">
            </a>
            <div class="watchlist-icon ${isInWatchlist ? 'active' : ''}" aria-label="Toggle Watchlist">
                <i data-lucide="bookmark"></i>
            </div>
        </div>
    `;
}

// ================================================================
// --- UI & EVENT HANDLERS ---
// ================================================================

function initEventListeners() {
    window.addEventListener('hashchange', router);
    window.addEventListener('DOMContentLoaded', router);

    // Search Overlay
    dom.search.openBtn.addEventListener('click', () => dom.search.overlay.classList.add('visible'));
    dom.search.closeBtn.addEventListener('click', () => dom.search.overlay.classList.remove('visible'));
    dom.search.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && dom.search.input.value.trim()) {
            window.location.hash = `#/search/${encodeURIComponent(dom.search.input.value.trim())}`;
            dom.search.input.value = '';
            dom.search.overlay.classList.remove('visible');
        }
    });

    // Trakt Auth
    dom.trakt.authBtn.addEventListener('click', () => {
        if (state.isTraktAuthenticated) {
            trakt.logoutTrakt();
        } else {
            trakt.redirectToTraktAuth();
        }
    });

    // Event Delegation for Watchlist icons and Lazy Loading
    dom.root.addEventListener('click', handleRootClick);
    const observer = new IntersectionObserver(handleImageLazyLoad, { rootMargin: "200px" });
    document.addEventListener('view-rendered', () => {
        document.querySelectorAll('img.lazy').forEach(img => observer.observe(img));
    });
}

function handleRootClick(e) {
    const watchlistIcon = e.target.closest('.watchlist-icon');
    if (watchlistIcon) {
        const card = watchlistIcon.closest('.poster-card');
        const movieId = parseInt(card.dataset.movieId);
        
        if (storage.isMovieInWatchlist(movieId)) {
            storage.removeFromWatchlist(movieId);
            watchlistIcon.classList.remove('active');
        } else {
            storage.addToWatchlist(movieId);
            watchlistIcon.classList.add('active');
        }
    }
}

function handleImageLazyLoad(entries, observer) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            img.classList.add('loaded');
            observer.unobserve(img);
        }
    });
}

// ================================================================
// --- UTILITY & HELPER FUNCTIONS ---
// ================================================================

function showLoading() {
    render(`<div class="loading-container"><div class="spinner"></div><p>Loading Cinematic Data...</p></div>`);
}

function updateBackdrop(imageUrl = null) {
    if (imageUrl && state.currentBackdrop !== imageUrl) {
        dom.backdrop.style.backgroundImage = `url(${imageUrl})`;
        dom.backdrop.style.opacity = '1';
        state.currentBackdrop = imageUrl;
    } else if (!imageUrl) {
        dom.backdrop.style.opacity = '0';
        state.currentBackdrop = null;
    }
}

function updateThemeColor(imageUrl) {
    const img = document.createElement('img');
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;
    img.onload = () => {
        const colorThief = new ColorThief();
        const dominantColor = colorThief.getColor(img);
        document.documentElement.style.setProperty('--color-primary', `rgb(${dominantColor.join(',')})`);
        document.documentElement.style.setProperty('--color-primary-glow', `rgba(${dominantColor.join(',')}, 0.3)`);
    };
    img.onerror = () => { // Reset to default if image fails
        document.documentElement.style.setProperty('--color-primary', '#00f6ff');
        document.documentElement.style.setProperty('--color-primary-glow', 'rgba(0, 246, 255, 0.3)');
    };
}

function updateAuthUI() {
    if (storage.getTraktTokens()) {
        state.isTraktAuthenticated = true;
        dom.trakt.authBtn.textContent = 'Logout Trakt';
        dom.trakt.statsLink.style.display = 'inline-block';
    } else {
        state.isTraktAuthenticated = false;
        dom.trakt.authBtn.textContent = 'Connect Trakt';
        dom.trakt.statsLink.style.display = 'none';
    }
}

async function handleAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    if (authCode) {
        try {
            await trakt.handleTraktCallback(authCode);
            updateAuthUI();
        } catch (error) {
            console.error("Trakt auth failed:", error);
            // Optionally show an error message to the user
        }
    }
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => console.log('Service Worker registered with scope:', registration.scope))
            .catch(error => console.log('Service Worker registration failed:', error));
    }
}

// ================================================================
// --- APPLICATION INITIALIZATION ---
// ================================================================

async function init() {
    registerServiceWorker();
    await handleAuthCallback();
    updateAuthUI();
    initEventListeners();
    router();
}

init();
