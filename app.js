/*
================================================================
APP.JS - THE GRAND REBUILD (FROM SCRATCH)
- Vision: A stable, performant, and feature-rich SPA orchestrator.
- Architecture: Built on a predictable lifecycle and atomic rendering
  pattern to eliminate all previous race condition bugs.
- Features: Powers the Awwwards-level animations, interactions,
  and human-centric UX defined in the new design system.
================================================================
*/

// --- 1. MODULE IMPORTS ---
import * as TMDB_API from './api.js';
import * as GEMINI_API from './gemini.js';
import * as TRAKT_API from './trakt.js';
import * as STORAGE from './storage.js';

// --- 2. DOM ELEMENT CACHE (populated by main function) ---
let body, appRoot, header, searchInput, traktAuthButton, searchIconBtn,
    searchOverlay, searchOverlayInput, searchOverlayClose;

// --- 3. APPLICATION STATE ---
const state = {
    isTraktAuthenticated: false,
};

// --- 4. INTERACTION & ANIMATION MODULES ---
const scrollAnimator = {
    observer: null,
    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        this.observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });
        }
    },
    observe(container = document) {
        if (!this.observer) return;
        container.querySelectorAll('.reveal-on-scroll').forEach(el => this.observer.observe(el));
    }
};

const interactiveCarousel = {
    init(container = document) {
        container.querySelectorAll('.carousel-content').forEach(carousel => {
            let isDown = false, startX, scrollLeft;
            const start = (e) => { isDown = true; startX = (e.pageX || e.touches[0].pageX) - carousel.offsetLeft; scrollLeft = carousel.scrollLeft; };
            const end = () => { isDown = false; };
            const move = (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = (e.pageX || e.touches[0].pageX) - carousel.offsetLeft;
                const walk = (x - startX) * 2;
                carousel.scrollLeft = scrollLeft - walk;
            };
            carousel.addEventListener('mousedown', start);
            carousel.addEventListener('touchstart', start, { passive: true });
            carousel.addEventListener('mouseleave', end);
            carousel.addEventListener('mouseup', end);
            carousel.addEventListener('touchend', end);
            carousel.addEventListener('mousemove', move);
            carousel.addEventListener('touchmove', move, { passive: true });
        });
    }
};

const lazyLoader = {
    observer: null,
    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries, observer) => {
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
        }
    },
    observe(container = document) {
        if (!this.observer) return;
        container.querySelectorAll('img.lazy').forEach(img => this.observer.observe(img));
    }
};

// --- 5. UI COMPONENT RENDERERS ---
const UI = {
    loadingSkeletons: (count = 8) => `<div class="skeleton-grid">${`<div class="skeleton-card"></div>`.repeat(count)}</div>`,
    error: (message = 'An unknown error occurred.') => `<div class="hero-section"><h1>Oops.</h1><p>${message}</p></div>`,
    posterCard: (item) => {
        if (!item || !item.id || !item.poster_path) return '';
        const imageUrl = TMDB_API.getImageUrl(item.poster_path, 'w500');
        return `<div class="poster-card reveal-on-scroll"><a href="#movie/${item.id}"><img data-src="${imageUrl}" alt="${item.title || item.name}" class="lazy"></a></div>`;
    },
    carousel: (title, items) => {
        if (!items || items.length === 0) return '';
        return `<section class="carousel reveal-on-scroll"><h2>${title}</h2><div class="carousel-content">${items.map(UI.posterCard).join('')}</div></section>`;
    }
};

// --- 6. VIEW RENDERERS (ATOMIC PATTERN) ---
async function renderHomeView() {
    let viewHTML;
    try {
        const [trending, upcoming] = await Promise.all([TMDB_API.getTrendingMovies(), TMDB_API.getUpcomingMovies()]);
        const carouselsHTML = `${UI.carousel('Trending This Week', trending.results)}${UI.carousel('Coming Soon', upcoming.results)}`;
        viewHTML = `<div class="hero-section reveal-on-scroll"><h1>Discover Your Next Obsession.</h1><p>AI-powered recommendations for movies and shows, tailored to your unique taste.</p></div>${carouselsHTML}`;
    } catch (error) {
        console.error('Error fetching homepage content:', error);
        viewHTML = UI.error('Could not load the cinematic universe.');
    }
    appRoot.innerHTML = `<div class="view home-view">${viewHTML}</div>`;
}

async function renderSearchView(query) {
    let viewHTML;
    try {
        const { type } = await GEMINI_API.analyzeQuery(query);
        const recommendationsText = await GEMINI_API.getAIRecommendations({ searchQuery: query, type });
        const aiResults = GEMINI_API.parseAIResponse(recommendationsText);
        if (aiResults.length === 0) throw new Error("The AI returned no recommendations. Try a different query!");
        
        const tmdbDataPromises = aiResults.map(result => TMDB_API.findTMDBEntry(result.type, result.title, result.year));
        const tmdbResults = (await Promise.all(tmdbDataPromises)).filter(Boolean);
        if (tmdbResults.length === 0) throw new Error("AI recommendations found, but could not match them to our database.");

        viewHTML = `<div class="hero-section reveal-on-scroll"><p>Results for</p><h1>“${query}”</h1></div><div class="skeleton-grid">${tmdbResults.map(UI.posterCard).join('')}</div>`;
    } catch (error) {
        console.error('Error during AI search:', error);
        viewHTML = `<div class="hero-section"><p>Results for</p><h1>“${query}”</h1></div>${UI.error(error.message)}`;
    }
    appRoot.innerHTML = `<div class="view search-view">${viewHTML}</div>`;
}

async function renderDetailView(movieId) {
    try {
        const movie = await TMDB_API.getMovieDetails(movieId);
        const isInWatchlist = STORAGE.isMovieInWatchlist(movie.id);
        const backdropUrl = TMDB_API.getImageUrl(movie.backdrop_path, 'original');

        const viewHTML = `
            <section class="detail-hero">
                <img src="${backdropUrl}" class="backdrop-image" alt="">
                <div class="backdrop-overlay"></div>
                <div class="detail-hero-content reveal-on-scroll">
                    <h1>${movie.title}</h1>
                </div>
            </section>
            <section class="detail-body">
                <div class="detail-poster reveal-on-scroll">
                    <img src="${TMDB_API.getImageUrl(movie.poster_path, 'w500')}" alt="${movie.title}">
                </div>
                <div class="detail-info reveal-on-scroll">
                    <h2>Overview</h2>
                    <p>${movie.overview || 'No overview available.'}</p>
                    <button class="primary-button ${isInWatchlist ? 'in-watchlist' : ''}" data-action="toggle-watchlist" data-movie-id="${movie.id}">
                        ${isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                    </button>
                </div>
            </section>
            <div id="similar-movies-container"></div>`;
        appRoot.innerHTML = `<div class="view detail-view">${viewHTML}</div>`;
        renderSimilarMovies(movieId, 'similar-movies-container');
    } catch (error) {
        console.error('Error rendering detail view:', error);
        appRoot.innerHTML = `<div class="view detail-view">${UI.error('Could not load movie details.')}</div>`;
    }
}

async function renderSimilarMovies(movieId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const similar = await TMDB_API.getSimilarMovies(movieId);
        if (similar.results && similar.results.length > 0) {
            container.innerHTML = UI.carousel('You Might Also Like', similar.results.slice(0, 10));
            // Re-initialize interactions for this new content
            lazyLoader.observe(container);
            scrollAnimator.observe(container);
            interactiveCarousel.init(container);
        }
    } catch (error) { console.warn('Could not fetch similar movies:', error); }
}

// --- 7. EVENT HANDLERS & ROUTER ---
function handleAppClick(event) {
    const action = event.target.dataset.action;
    if (action === 'toggle-watchlist') {
        const button = event.target;
        const movieId = Number(button.dataset.movieId);
        if (!movieId) return;
        const isInWatchlist = STORAGE.isMovieInWatchlist(movieId);
        if (isInWatchlist) {
            STORAGE.removeFromWatchlist(movieId);
            button.textContent = 'Add to Watchlist';
            button.classList.remove('in-watchlist');
        } else {
            STORAGE.addToWatchlist(movieId);
            button.textContent = 'In Watchlist';
            button.classList.add('in-watchlist');
        }
    }
}

function handleSearch(query) {
    if (query) {
        window.location.hash = `search/${encodeURIComponent(query)}`;
        toggleSearchOverlay(false);
    }
}

function toggleSearchOverlay(show) {
    searchOverlay.classList.toggle('visible', show);
    if (show) searchOverlayInput.focus();
    else searchOverlayInput.value = '';
}

function updateUIForAuthState() {
    state.isTraktAuthenticated = !!STORAGE.getTraktTokens();
    if (state.isTraktAuthenticated) {
        traktAuthButton.textContent = 'Logout Trakt';
        traktAuthButton.onclick = TRAKT_API.logoutTrakt;
    } else {
        traktAuthButton.textContent = 'Connect Trakt';
        traktAuthButton.onclick = TRAKT_API.redirectToTraktAuth;
    }
}

const routes = {
    '': renderHomeView,
    'search/:query': renderSearchView,
    'movie/:id': renderDetailView,
};

async function router() {
    try {
        const hash = window.location.hash.substring(1);
        const [path, param] = hash.split('/');
        const renderFunc = routes[path] || routes[''];

        appRoot.classList.add('view-exit');
        await new Promise(resolve => setTimeout(resolve, 300));
        appRoot.innerHTML = `<div class="view">${UI.loadingSkeletons()}</div>`;
        appRoot.classList.remove('view-exit');

        await renderFunc(decodeURIComponent(param || ''));

        window.scrollTo(0, 0);
        // Initialize animations and interactions for the new view
        lazyLoader.observe();
        scrollAnimator.observe();
        interactiveCarousel.init();
    } catch (error) {
        console.error("A critical error occurred in the router:", error);
        appRoot.innerHTML = UI.error("The application encountered a serious error.");
    }
}

// --- 8. MAIN APPLICATION INITIALIZATION ---
async function main() {
    // 1. Cache all critical DOM elements
    body = document.body;
    appRoot = document.getElementById('app-root');
    header = document.querySelector('.app-header');
    searchInput = document.getElementById('search-input');
    traktAuthButton = document.getElementById('trakt-auth-button');
    searchIconBtn = document.getElementById('search-icon-btn');
    searchOverlay = document.getElementById('search-overlay');
    searchOverlayInput = document.getElementById('search-overlay-input');
    searchOverlayClose = document.getElementById('search-overlay-close');

    // 2. Setup all static event listeners
    window.addEventListener('hashchange', router);
    window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 50), { passive: true });
    appRoot.addEventListener('click', handleAppClick);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(e.target.value.trim()); });
    searchIconBtn.addEventListener('click', () => toggleSearchOverlay(true));
    searchOverlayClose.addEventListener('click', () => toggleSearchOverlay(false));
    searchOverlayInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(e.target.value.trim()); });

    // 3. Initialize animation modules
    scrollAnimator.init();
    lazyLoader.init();

    // 4. Handle initial state (e.g., Trakt auth callback)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code')) {
        appRoot.innerHTML = `<div class="view">${UI.loadingSkeletons()}</div>`;
        await TRAKT_API.handleTraktCallback(urlParams.get('code'));
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    updateUIForAuthState();

    // 5. Run the initial route to render the first view
    await router();

    // 6. Remove loading class to show the fully rendered app
    body.classList.remove('loading');
}

// Single entry point: Wait for the DOM to be ready, then launch the app.
document.addEventListener('DOMContentLoaded', main);
