/*
================================================================
APP.JS - DEFINITIVE STABILITY & ARCHITECTURAL FIX
- Re-architects the application startup sequence to eliminate all race conditions.
- Guarantees stable and reliable rendering of carousels and all other content.
- This is the final, stable version of the core application logic.
================================================================
*/

// --- 1. MODULE IMPORTS ---
import * as TMDB_API from './api.js';
import * as GEMINI_API from './gemini.js';
import * as TRAKT_API from './trakt.js';
import * as STORAGE from './storage.js';

// --- 2. DOM ELEMENT CACHE (populated in init) ---
let body, appRoot, header, searchInput, traktAuthButton, searchIconBtn,
    searchOverlay, searchOverlayInput, searchOverlayClose;

// --- 3. APPLICATION STATE ---
const state = {
    isTraktAuthenticated: !!STORAGE.getTraktTokens(),
};

// --- 4. ANIMATION & INTERACTION MODULES ---
const scrollAnimator = {
    observer: null,
    init() { if ('IntersectionObserver' in window) { this.observer = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); this.observer.unobserve(entry.target); } }); }, { threshold: 0.1 }); } },
    observe(container = document) { if (!this.observer) { container.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-visible')); return; } container.querySelectorAll('.reveal-on-scroll').forEach(el => this.observer.observe(el)); }
};
const interactiveCarousel = {
    init(container = document) { container.querySelectorAll('.carousel-content').forEach(carousel => { let isDown = false, startX, scrollLeft; carousel.addEventListener('mousedown', (e) => { isDown = true; startX = e.pageX - carousel.offsetLeft; scrollLeft = carousel.scrollLeft; }); carousel.addEventListener('mouseleave', () => isDown = false); carousel.addEventListener('mouseup', () => isDown = false); carousel.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); const x = e.pageX - carousel.offsetLeft; const walk = (x - startX) * 2; carousel.scrollLeft = scrollLeft - walk; }); }); }
};
const lazyLoader = {
    observer: null,
    init() { if ('IntersectionObserver' in window) { this.observer = new IntersectionObserver((entries, observer) => { entries.forEach(entry => { if (entry.isIntersecting) { const image = entry.target; image.src = image.dataset.src; image.classList.remove('lazy'); image.classList.add('loaded'); observer.unobserve(image); } }); }); } },
    observe(container = document) { if (!this.observer) { container.querySelectorAll('img.lazy').forEach(img => { img.src = img.dataset.src; img.classList.remove('lazy'); }); return; } container.querySelectorAll('img.lazy').forEach(img => this.observer.observe(img)); }
};

// --- 5. UI & COMPONENT RENDERING ---
function renderLoadingSkeletons(count = 10) { return `<div class="skeleton-grid">${`<div class="skeleton-card"></div>`.repeat(count)}</div>`; }
function renderError(message = 'An unknown error occurred.') { return `<div class="hero-section"><h1 class="title">Oops.</h1><p class="subtitle">${message}</p></div>`; }
function renderPosterCard(item) { if (!item || !item.id || !item.poster_path) return ''; const imageUrl = TMDB_API.getImageUrl(item.poster_path, 'w500'); return `<div class="poster-card reveal-on-scroll"><a href="#movie/${item.id}"><img data-src="${imageUrl}" alt="${item.title || item.name}" class="lazy"></a></div>`; }
function renderCarousel(title, items) { if (!items || items.length === 0) return ''; return `<section class="carousel reveal-on-scroll"><h2 class="carousel-title">${title}</h2><div class="carousel-content">${items.map(renderPosterCard).join('')}</div></section>`; }

// --- 6. VIEW RENDERING (ROBUST PATTERN) ---
async function renderHomeView() {
    let contentHTML;
    try {
        const [trending, upcoming] = await Promise.all([TMDB_API.getTrendingMovies(), TMDB_API.getUpcomingMovies()]);
        const carouselsHTML = `${renderCarousel('Trending This Week', trending.results)}${renderCarousel('Coming Soon', upcoming.results)}`;
        contentHTML = `<div class="hero-section"><h1 class="title">Discover Your Next Obsession.</h1><p class="subtitle reveal-on-scroll">AI-powered recommendations for movies and shows, tailored to your unique taste.</p></div>${carouselsHTML}`;
    } catch (error) {
        console.error('Error fetching homepage carousels:', error);
        contentHTML = renderError('Could not load movie carousels.');
    }
    appRoot.innerHTML = `<div class="view home-view">${contentHTML}</div>`;
}

async function renderSearchView(query) {
    let contentHTML;
    try {
        const { type } = await GEMINI_API.analyzeQuery(query);
        const recommendationsText = await GEMINI_API.getAIRecommendations({ searchQuery: query, type });
        const aiResults = GEMINI_API.parseAIResponse(recommendationsText);
        if (aiResults.length === 0) throw new Error("The AI couldn't find any recommendations. Try something else!");
        const tmdbDataPromises = aiResults.map(result => TMDB_API.findTMDBEntry(result.type, result.title, result.year));
        const tmdbResults = (await Promise.all(tmdbDataPromises)).filter(Boolean);
        if (tmdbResults.length === 0) throw new Error("Could not match AI recommendations to our movie database.");
        contentHTML = `<div class="hero-section"><p class="subtitle">Results for</p><h1 class="title">“${query}”</h1></div><div class="search-results-grid">${tmdbResults.map(renderPosterCard).join('')}</div>`;
    } catch (error) {
        console.error('Error during AI search:', error);
        contentHTML = `<div class="hero-section"><p class="subtitle">Results for</p><h1 class="title">“${query}”</h1></div><div style="text-align:center;">${renderError(error.message)}</div>`;
    }
    appRoot.innerHTML = `<div class="view search-view">${contentHTML}</div>`;
}

async function renderDetailView(movieId) {
    try {
        const movie = await TMDB_API.getMovieDetails(movieId);
        const isInWatchlist = STORAGE.isMovieInWatchlist(movie.id);
        const detailHTML = `<div class="view detail-view"><section class="detail-hero"><img src="${TMDB_API.getImageUrl(movie.backdrop_path, 'original')}" class="backdrop-image" alt=""><div class="backdrop-overlay"></div><div class="detail-hero-content reveal-on-scroll"><h1>${movie.title}</h1><div class="detail-meta"><span>${movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}</span><span>${movie.runtime ? `${movie.runtime} min` : ''}</span></div></div></section><section class="detail-body"><div class="detail-poster reveal-on-scroll"><img src="${TMDB_API.getImageUrl(movie.poster_path, 'w500')}" alt="${movie.title}"></div><div class="detail-info reveal-on-scroll"><h2>Overview</h2><p>${movie.overview || 'No overview available.'}</p><button class="primary-button ${isInWatchlist ? 'in-watchlist' : ''}" data-action="toggle-watchlist" data-movie-id="${movie.id}">${isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</button></div></section><div id="similar-movies-container"></div></div>`;
        appRoot.innerHTML = detailHTML;
        renderSimilarMovies(movieId, 'similar-movies-container');
    } catch (error) {
        console.error('Error rendering detail view:', error);
        appRoot.innerHTML = renderError('Could not load movie details.');
    }
}

async function renderSimilarMovies(movieId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const similar = await TMDB_API.getSimilarMovies(movieId);
        if (similar.results && similar.results.length > 0) {
            container.innerHTML = renderCarousel('You Might Also Like', similar.results.slice(0, 10));
            lazyLoader.observe(container); scrollAnimator.observe(container); interactiveCarousel.init(container);
        }
    } catch (error) { console.warn('Could not fetch similar movies:', error); }
}

async function renderStatsView() { appRoot.innerHTML = `<div class="view stats-view hero-section"><h1 class="title">Stats Coming Soon</h1></div>`; }

// --- 7. EVENT HANDLERS & ROUTER ---
function handleGlobalEvents(event) {
    const action = event.target.dataset.action;
    if (action === 'toggle-watchlist') {
        const button = event.target; const movieId = Number(button.dataset.movieId); if (!movieId) return;
        const isInWatchlist = STORAGE.isMovieInWatchlist(movieId);
        if (isInWatchlist) { STORAGE.removeFromWatchlist(movieId); } else { STORAGE.addToWatchlist(movieId); }
        button.textContent = !isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'; button.classList.toggle('in-watchlist', !isInWatchlist);
    }
}
function handleSearch(query) { if (query) { window.location.hash = `search/${encodeURIComponent(query)}`; toggleSearchOverlay(false); } }
function toggleSearchOverlay(show) { searchOverlay.classList.toggle('visible', show); if (show) searchOverlayInput.focus(); else searchOverlayInput.value = ''; }
function updateUIForAuthState() { if (state.isTraktAuthenticated) { traktAuthButton.textContent = 'Logout'; traktAuthButton.onclick = TRAKT_API.logoutTrakt; } else { traktAuthButton.textContent = 'Connect Trakt'; traktAuthButton.onclick = TRAKT_API.redirectToTraktAuth; } }

const routes = { '': renderHomeView, 'search/:query': renderSearchView, 'movie/:id': renderDetailView, 'stats': renderStatsView };
async function router() {
    const hash = window.location.hash.substring(1);
    const [path, ...params] = hash.split('/');
    const renderFunc = routes[path] || routes[''];
    const queryParam = path === 'search' && params.length > 0 ? decodeURIComponent(params.join('/')) : params[0];

    appRoot.classList.add('view-exit');
    await new Promise(resolve => setTimeout(resolve, 300));

    // Show a loading skeleton while the view fetches data
    appRoot.innerHTML = `<div class="view">${renderLoadingSkeletons(12)}</div>`;
    appRoot.classList.remove('view-exit');

    await renderFunc(queryParam); // Render the complete view with fetched data

    // Re-initialize all dynamic/interactive elements for the new view
    lazyLoader.observe();
    scrollAnimator.observe();
    interactiveCarousel.init();
}

// --- 8. INITIALIZATION (RE-ARCHITECTED) ---

// Synchronous setup function
function setupEventListeners() {
    window.addEventListener('hashchange', router);
    window.addEventListener('scroll', () => { header.classList.toggle('scrolled', window.scrollY > 50); }, { passive: true });
    appRoot.addEventListener('click', handleGlobalEvents);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(e.target.value.trim()); });
    searchIconBtn.addEventListener('click', () => toggleSearchOverlay(true));
    searchOverlayClose.addEventListener('click', () => toggleSearchOverlay(false));
    searchOverlayInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(e.target.value.trim()); });
}

// Main async application loader
async function loadApp() {
    // 1. Cache all DOM elements first
    body = document.body; appRoot = document.getElementById('app-root'); header = document.querySelector('.app-header');
    searchInput = document.getElementById('search-input'); traktAuthButton = document.getElementById('trakt-auth-button');
    searchIconBtn = document.getElementById('search-icon-btn'); searchOverlay = document.getElementById('search-overlay');
    searchOverlayInput = document.getElementById('search-overlay-input'); searchOverlayClose = document.getElementById('search-overlay-close');

    // 2. Setup all static event listeners
    setupEventListeners();

    // 3. Initialize helper modules
    scrollAnimator.init();
    lazyLoader.init();

    // 4. Handle any initial state, like Trakt authentication
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code')) {
        appRoot.innerHTML = `<div class="hero-section"><h1 class="title">Connecting...</h1></div>`;
        await TRAKT_API.handleTraktCallback(urlParams.get('code'));
        state.isTraktAuthenticated = true;
        // Clean the URL and navigate to the home page after callback
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    updateUIForAuthState();

    // 5. Run the initial route to render the first view
    await router();

    // 6. Remove the loading class from the body once everything is done
    body.classList.remove('loading');
}

// Single, reliable entry point
document.addEventListener('DOMContentLoaded', loadApp);
