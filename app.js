/*
================================================================
APP.JS - CRITICAL BUG FIX & UX POLISH PASS
- Corrects carousel and search rendering logic to ensure content loads reliably.
- Implements a polished, full-screen mobile search overlay for a better UX.
- Activates the "Add to Watchlist" button with full interactivity and state management.
- Refines animations and user feedback for a truly seamless experience.
================================================================
*/

// --- 1. MODULE IMPORTS ---
import * as TMDB_API from './api.js';
import * as GEMINI_API from './gemini.js';
import * as TRAKT_API from './trakt.js';
import * as STORAGE from './storage.js';

// --- 2. DOM ELEMENT CACHE ---
const body = document.body;
const appRoot = document.getElementById('app-root');
const header = document.querySelector('.app-header');

// Caching these later as they might not exist on initial load
let searchInput, traktAuthButton, statsNavLink, searchIconBtn, searchOverlay, searchOverlayInput, searchOverlayClose;

// --- 3. APPLICATION STATE ---
const state = {
    isTraktAuthenticated: !!STORAGE.getTraktTokens(),
    lastScrollY: 0,
};

// --- 4. ANIMATION & INTERACTION MODULES ---

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
        if (!this.observer) { // Fallback for older browsers
            container.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-visible'));
            return;
        }
        container.querySelectorAll('.reveal-on-scroll').forEach(el => this.observer.observe(el));
    }
};

const interactiveCarousel = {
    init(container = document) {
        container.querySelectorAll('.carousel-content').forEach(carousel => {
            let isDown = false, startX, scrollLeft;
            carousel.addEventListener('mousedown', (e) => { isDown = true; startX = e.pageX - carousel.offsetLeft; scrollLeft = carousel.scrollLeft; });
            carousel.addEventListener('mouseleave', () => isDown = false);
            carousel.addEventListener('mouseup', () => isDown = false);
            carousel.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); const x = e.pageX - carousel.offsetLeft; const walk = (x - startX) * 2; carousel.scrollLeft = scrollLeft - walk; });
        });
    }
};

function handleGlobalScroll() {
    state.lastScrollY = window.scrollY;
    header.classList.toggle('scrolled', state.lastScrollY > 50);
    const backdrop = document.querySelector('.backdrop-image');
    if (backdrop) backdrop.style.transform = `translateY(${state.lastScrollY * 0.4}px)`;
}

// --- 5. UI & COMPONENT RENDERING ---

function renderLoadingSkeletons(count = 10) {
    return `<div class="skeleton-grid">${`<div class="skeleton-card"></div>`.repeat(count)}</div>`;
}

function renderError(message = 'An unknown error occurred.') {
    return `<div class="hero-section"><h1 class="title">Oops.</h1><p class="subtitle">${message}</p></div>`;
}

function renderPosterCard(item) {
    if (!item || !item.id || !item.poster_path) return '';
    const imageUrl = TMDB_API.getImageUrl(item.poster_path, 'w500');
    return `<div class="poster-card reveal-on-scroll"><a href="#movie/${item.id}"><img data-src="${imageUrl}" alt="${item.title || item.name}" class="lazy"></a></div>`;
}

function renderCarousel(title, items) {
    if (!items || items.length === 0) return '';
    return `<section class="carousel reveal-on-scroll"><h2 class="carousel-title">${title}</h2><div class="carousel-content">${items.map(renderPosterCard).join('')}</div></section>`;
}

// --- 6. VIEW RENDERING ---

async function renderHomeView() {
    let contentHTML = `<div class="hero-section"><h1 class="title">Discover Your Next Obsession.</h1><p class="subtitle reveal-on-scroll">AI-powered recommendations for movies and shows, tailored to your unique taste.</p></div>`;
    let carouselsHTML = `<div class="carousel-placeholder">${renderLoadingSkeletons(6)}</div>`;
    
    appRoot.innerHTML = `<div class="view home-view">${contentHTML}${carouselsHTML}</div>`;

    try {
        const [trending, upcoming] = await Promise.all([TMDB_API.getTrendingMovies(), TMDB_API.getUpcomingMovies()]);
        carouselsHTML = `
            ${renderCarousel('Trending This Week', trending.results)}
            ${renderCarousel('Coming Soon', upcoming.results)}
        `;
    } catch (error) {
        console.error('Error fetching homepage carousels:', error);
        carouselsHTML = renderError('Could not load movie carousels.');
    }
    
    // Safely replace the placeholder with the final content
    const placeholder = appRoot.querySelector('.carousel-placeholder');
    if (placeholder) placeholder.outerHTML = carouselsHTML;
}

async function renderSearchView(query) {
    let contentHTML = `<div class="hero-section"><p class="subtitle">Results for</p><h1 class="title">“${query}”</h1></div><div class="search-results-grid">${renderLoadingSkeletons(10)}</div>`;
    appRoot.innerHTML = `<div class="view search-view">${contentHTML}</div>`;

    try {
        const { type } = await GEMINI_API.analyzeQuery(query);
        const recommendationsText = await GEMINI_API.getAIRecommendations({ searchQuery: query, type });
        const aiResults = GEMINI_API.parseAIResponse(recommendationsText);

        if (aiResults.length === 0) {
            throw new Error("The AI couldn't find any recommendations for that query. Try something else!");
        }

        const tmdbDataPromises = aiResults.map(result => TMDB_API.findTMDBEntry(result.type, result.title, result.year));
        const tmdbResults = (await Promise.all(tmdbDataPromises)).filter(Boolean);

        if (tmdbResults.length === 0) {
            throw new Error("Found AI recommendations, but could not match them to our movie database.");
        }

        const resultsGrid = appRoot.querySelector('.search-results-grid');
        if (resultsGrid) resultsGrid.innerHTML = tmdbResults.map(renderPosterCard).join('');

    } catch (error) {
        console.error('Error during AI search:', error);
        const resultsGrid = appRoot.querySelector('.search-results-grid');
        if (resultsGrid) resultsGrid.innerHTML = `<p class="subtitle" style="text-align: center;">${error.message}</p>`;
    }
}

async function renderDetailView(movieId) {
    appRoot.innerHTML = `<div class="view detail-view">${renderLoadingSkeletons(1)}</div>`;
    try {
        const movie = await TMDB_API.getMovieDetails(movieId);
        const backdropUrl = TMDB_API.getImageUrl(movie.backdrop_path, 'original');
        const posterUrl = TMDB_API.getImageUrl(movie.poster_path, 'w500');

        const isInWatchlist = STORAGE.isMovieInWatchlist(movie.id);
        const watchlistBtnText = isInWatchlist ? 'In Watchlist' : 'Add to Watchlist';
        const watchlistBtnClass = isInWatchlist ? 'primary-button in-watchlist' : 'primary-button';

        appRoot.innerHTML = `
            <div class="view detail-view">
                <section class="detail-hero"><img src="${backdropUrl}" class="backdrop-image" alt=""><div class="backdrop-overlay"></div><div class="detail-hero-content reveal-on-scroll"><h1>${movie.title}</h1><div class="detail-meta"><span>${movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}</span><span>${movie.runtime ? `${movie.runtime} min` : ''}</span></div></div></section>
                <section class="detail-body"><div class="detail-poster reveal-on-scroll"><img src="${posterUrl}" alt="${movie.title}"></div><div class="detail-info reveal-on-scroll"><h2>Overview</h2><p>${movie.overview || 'No overview available.'}</p><button class="${watchlistBtnClass}" id="watchlist-btn" data-movie-id="${movie.id}">${watchlistBtnText}</button></div></section>
                <div id="similar-movies-container"></div>
            </div>
        `;
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
            // Re-initialize interactions for newly added content
            lazyLoader.observe(container);
            scrollAnimator.observe(container);
            interactiveCarousel.init(container);
        }
    } catch (error) { console.warn('Could not fetch similar movies:', error); }
}

async function renderStatsView() {
    appRoot.innerHTML = `<div class="view stats-view hero-section"><h1 class="title">Stats Coming Soon</h1></div>`;
}

// --- 7. UTILITY & EVENT HANDLERS ---
const lazyLoader = {
    observer: null,
    init() { if ('IntersectionObserver' in window) { this.observer = new IntersectionObserver((entries, observer) => { entries.forEach(entry => { if (entry.isIntersecting) { const image = entry.target; image.src = image.dataset.src; image.classList.remove('lazy'); image.classList.add('loaded'); observer.unobserve(image); } }); }); } },
    observe(container = document) { if (!this.observer) { container.querySelectorAll('img.lazy').forEach(img => { img.src = img.dataset.src; img.classList.remove('lazy'); }); return; } container.querySelectorAll('img.lazy').forEach(img => this.observer.observe(img)); }
};

function handleSearch(query) {
    if (query) {
        window.location.hash = `search/${encodeURIComponent(query)}`;
        toggleSearchOverlay(false);
    }
}

function toggleSearchOverlay(show) {
    searchOverlay.classList.toggle('visible', show);
    if (show) {
        searchOverlayInput.focus();
    } else {
        searchOverlayInput.value = '';
    }
}

function handleWatchlistToggle(event) {
    const button = event.target;
    const movieId = Number(button.dataset.movieId);
    if (!movieId) return;

    if (STORAGE.isMovieInWatchlist(movieId)) {
        STORAGE.removeFromWatchlist(movieId);
        button.textContent = 'Add to Watchlist';
        button.classList.remove('in-watchlist');
    } else {
        STORAGE.addToWatchlist(movieId);
        button.textContent = 'In Watchlist';
        button.classList.add('in-watchlist');
    }
}

// --- 8. ROUTER ---
const routes = { '': renderHomeView, 'search/:query': renderSearchView, 'movie/:id': renderDetailView, 'stats': renderStatsView };

async function router() {
    const hash = window.location.hash.substring(1);
    const [path, ...params] = hash.split('/');
    let renderFunc = routes[path] || routes[''];
    let queryParam = path === 'search' && params.length > 0 ? decodeURIComponent(params.join('/')) : params[0];
    
    appRoot.classList.add('view-exit');
    await new Promise(resolve => setTimeout(resolve, 300));
    await renderFunc(queryParam);
    appRoot.classList.remove('view-exit');
    window.scrollTo(0, 0);

    // Re-initialize all dynamic/interactive elements for the new view
    lazyLoader.observe();
    scrollAnimator.observe();
    interactiveCarousel.init();
    appRoot.addEventListener('click', (e) => { if (e.target.id === 'watchlist-btn') handleWatchlistToggle(e); });
}

// --- 9. INITIALIZATION ---
function updateUIForAuthState() {
    if (state.isTraktAuthenticated) {
        traktAuthButton.textContent = 'Logout'; traktAuthButton.onclick = TRAKT_API.logoutTrakt; statsNavLink.style.display = 'inline-block';
    } else {
        traktAuthButton.textContent = 'Connect Trakt'; traktAuthButton.onclick = TRAKT_API.redirectToTraktAuth; statsNavLink.style.display = 'none';
    }
}

function cacheDOMElements() {
    searchInput = document.getElementById('search-input');
    traktAuthButton = document.getElementById('trakt-auth-button');
    statsNavLink = document.getElementById('stats-nav-link');
    searchIconBtn = document.getElementById('search-icon-btn');
    searchOverlay = document.getElementById('search-overlay');
    searchOverlayInput = document.getElementById('search-overlay-input');
    searchOverlayClose = document.getElementById('search-overlay-close');
}

async function init() {
    cacheDOMElements();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(err => console.error('SW Registration Failed:', err));
    
    // Global Event Listeners
    window.addEventListener('hashchange', router);
    window.addEventListener('scroll', handleGlobalScroll, { passive: true });
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(e.target.value.trim()); });
    searchIconBtn.addEventListener('click', () => toggleSearchOverlay(true));
    searchOverlayClose.addEventListener('click', () => toggleSearchOverlay(false));
    searchOverlayInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(e.target.value.trim()); });

    // Handle Trakt OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const traktAuthCode = urlParams.get('code');
    if (traktAuthCode) {
        appRoot.innerHTML = `<div class="hero-section"><h1 class="title">Connecting...</h1></div>`;
        await TRAKT_API.handleTraktCallback(traktAuthCode);
        state.isTraktAuthenticated = true;
        window.location.hash = '';
    }

    updateUIForAuthState();
    lazyLoader.init();
    scrollAnimator.init();
    await router();
    body.classList.remove('loading');
}

document.addEventListener('DOMContentLoaded', init);
