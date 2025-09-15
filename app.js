/*
================================================================
APP.JS - AWWWARDS-LEVEL ORCHESTRATOR & UX ENGINE (OVERHAULED)
- Completely rewritten to orchestrate the new visual and interactive experience.
- Implements advanced animations: scroll-triggered reveals, parallax, page transitions.
- Manages the UI, from loading skeletons to cinematic detail views.
- Integrates all data modules into the new, expressive front-end.
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
const searchInput = document.getElementById('search-input');
const traktAuthButton = document.getElementById('trakt-auth-button');
const statsNavLink = document.getElementById('stats-nav-link');
const header = document.querySelector('.app-header');

// --- 3. APPLICATION STATE & HELPERS ---
const state = {
    isTraktAuthenticated: !!STORAGE.getTraktTokens(),
    lastScrollY: 0,
};

// --- 4. ANIMATION & INTERACTION MODULES ---

/**
 * Manages scroll-triggered animations for elements with the .reveal-on-scroll class.
 */
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
            this.observe();
        } else {
            // Fallback for older browsers: reveal all immediately.
            document.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-visible'));
        }
    },
    observe(container = document) {
        if (!this.observer) return;
        container.querySelectorAll('.reveal-on-scroll').forEach(el => this.observer.observe(el));
    }
};

/**
 * Manages the custom cursor effect.
 */
const customCursor = {
    dot: document.querySelector('.cursor-dot'),
    outline: document.querySelector('.cursor-outline'),
    init() {
        if (window.matchMedia("(pointer: fine)").matches) { // Only for mouse users
            body.classList.add('cursor-active');
            window.addEventListener('mousemove', e => {
                this.dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
                this.outline.style.transform = `translate(${e.clientX - 20}px, ${e.clientY - 20}px)`;
            });
        }
    }
};

/**
 * Handles global scroll-based UI changes like the header and parallax.
 */
function handleGlobalScroll() {
    state.lastScrollY = window.scrollY;

    // Header effect
    if (state.lastScrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
    
    // Parallax effect for detail view backdrop
    const backdrop = document.querySelector('.backdrop-image');
    if (backdrop) {
        const speed = 0.4;
        backdrop.style.transform = `translateY(${state.lastScrollY * speed}px)`;
    }
}


// --- 5. UI & COMPONENT RENDERING ---

/**
 * Renders loading skeletons for a better perceived performance.
 * @param {number} count - The number of skeleton cards to render.
 * @returns {string} HTML string for the skeleton grid.
 */
function renderLoadingSkeletons(count = 10) {
    const skeletonCard = `<div class="skeleton-card"></div>`;
    return `<div class="skeleton-grid">${skeletonCard.repeat(count)}</div>`;
}

function renderError(message = 'An unknown error occurred.') {
    return `
        <div class="hero-section">
            <h1 class="tagline">Oops.</h1>
            <p class="subtitle">${message}</p>
        </div>
    `;
}

function renderPosterCard(item) {
    if (!item || !item.id || !item.poster_path) return '';
    const imageUrl = TMDB_API.getImageUrl(item.poster_path, 'w500');
    return `
        <div class="poster-card reveal-on-scroll">
            <a href="#movie/${item.id}">
                <img data-src="${imageUrl}" alt="${item.title || item.name}" class="lazy">
            </a>
        </div>
    `;
}

function renderCarousel(title, items) {
    if (!items || items.length === 0) return '';
    return `
        <section class="carousel reveal-on-scroll">
            <h2 class="carousel-title">${title}</h2>
            <div class="carousel-content">
                ${items.map(renderPosterCard).join('')}
            </div>
        </section>
    `;
}

// --- 6. VIEW RENDERING ---

async function renderHomeView() {
    appRoot.innerHTML = `
        <div class="view home-view">
            <section class="hero-section">
                <h1 class="tagline">Cinematic AI Navigator.</h1>
                <p class="subtitle reveal-on-scroll">An award-winning fusion of design and AI. Discover movies and shows through a futuristic, human-centered experience.</p>
            </section>
            ${renderLoadingSkeletons(6)}
        </div>
    `;
    
    try {
        const [trending, upcoming] = await Promise.all([
            TMDB_API.getTrendingMovies(),
            TMDB_API.getUpcomingMovies()
        ]);
        appRoot.querySelector('.skeleton-grid').remove();
        appRoot.innerHTML += `
            ${renderCarousel('Trending This Week', trending.results)}
            ${renderCarousel('Coming Soon', upcoming.results)}
        `;
    } catch (error) {
        console.error('Error rendering home view content:', error);
        appRoot.querySelector('.skeleton-grid').innerHTML = renderError('Could not load movie carousels.');
    }
}

async function renderSearchView(query) {
    appRoot.innerHTML = `
        <div class="view search-view">
             <div class="hero-section">
                <p class="subtitle">Results for</p>
                <h1 class="tagline">“${query}”</h1>
            </div>
            <div class="search-results-grid">
                ${renderLoadingSkeletons(10)}
            </div>
        </div>
    `;

    try {
        const { type } = await GEMINI_API.analyzeQuery(query);
        const recommendationsText = await GEMINI_API.getAIRecommendations({ searchQuery: query, type });
        const aiResults = GEMINI_API.parseAIResponse(recommendationsText);

        if (aiResults.length === 0) {
            appRoot.querySelector('.search-results-grid').innerHTML = `<p class="subtitle">The AI couldn't find any results for that query.</p>`;
            return;
        }

        const tmdbDataPromises = aiResults.map(result => TMDB_API.findTMDBEntry(result.type, result.title, result.year));
        const tmdbResults = (await Promise.all(tmdbDataPromises)).filter(Boolean);

        appRoot.querySelector('.search-results-grid').innerHTML = tmdbResults.map(renderPosterCard).join('');
    } catch (error) {
        console.error('Error during AI search:', error);
        appRoot.querySelector('.search-results-grid').innerHTML = renderError('The AI search failed.');
    }
}

async function renderDetailView(movieId) {
    appRoot.innerHTML = `<div class="view detail-view">${renderLoadingSkeletons(1)}</div>`;
    
    try {
        const movie = await TMDB_API.getMovieDetails(movieId);
        const backdropUrl = TMDB_API.getImageUrl(movie.backdrop_path, 'original');
        const posterUrl = TMDB_API.getImageUrl(movie.poster_path, 'w500');

        appRoot.innerHTML = `
            <div class="view detail-view">
                <section class="detail-hero">
                    <img src="${backdropUrl}" class="backdrop-image" alt="">
                    <div class="backdrop-overlay"></div>
                    <div class="detail-hero-content reveal-on-scroll">
                        <h1>${movie.title}</h1>
                        <div class="detail-meta">
                            <span>${movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}</span>
                            <span>${movie.runtime ? `${movie.runtime} min` : ''}</span>
                        </div>
                    </div>
                </section>
                <section class="detail-body">
                    <div class="detail-poster reveal-on-scroll">
                        <img src="${posterUrl}" alt="${movie.title}">
                    </div>
                    <div class="detail-info reveal-on-scroll">
                        <h2>Overview</h2>
                        <p>${movie.overview || 'No overview available.'}</p>
                        <button class="primary-button" style="margin-top: 2rem;">Add to Watchlist</button>
                    </div>
                </section>
                <div id="similar-movies-container"></div>
            </div>
        `;

        renderSimilarMovies(movieId, 'similar-movies-container');

    } catch (error) {
        console.error('Error rendering detail view:', error);
        appRoot.innerHTML = renderError('Could not load movie details.');
    }
}

async function renderStatsView() {
    // This view can be styled later to match the new design.
    appRoot.innerHTML = `<div class="view stats-view hero-section"><h1 class="tagline">Stats Coming Soon</h1></div>`;
}

async function renderSimilarMovies(movieId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const similar = await TMDB_API.getSimilarMovies(movieId);
        if (similar.results && similar.results.length > 0) {
            container.innerHTML = renderCarousel('You Might Also Like', similar.results.slice(0, 10));
            lazyLoader.observe(container);
            scrollAnimator.observe(container);
        }
    } catch (error) { console.warn('Could not fetch similar movies:', error); }
}


// --- 7. UTILITY FUNCTIONS (Lazy Loading) ---
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
            this.observe();
        } else {
            document.querySelectorAll('img.lazy').forEach(img => {
                img.src = img.dataset.src;
                img.classList.remove('lazy');
            });
        }
    },
    observe(container = document) {
        if (!this.observer) return;
        container.querySelectorAll('img.lazy').forEach(img => this.observer.observe(img));
    }
};

// --- 8. ROUTER ---
const routes = {
    '': renderHomeView,
    'search/:query': renderSearchView,
    'movie/:id': renderDetailView,
    'stats': renderStatsView,
};

async function router() {
    const hash = window.location.hash.substring(1);
    const [path, ...params] = hash.split('/');
    
    let renderFunc = routes[path] || routes[''];
    let queryParam;

    if (path === 'search' && params.length > 0) {
        renderFunc = routes['search/:query'];
        queryParam = decodeURIComponent(params.join('/'));
    } else if (path === 'movie' && params.length > 0) {
        renderFunc = routes['movie/:id'];
        queryParam = params[0];
    }
    
    appRoot.classList.add('view-exit');
    await new Promise(resolve => setTimeout(resolve, 300)); // Match CSS animation

    await renderFunc(queryParam);
    
    appRoot.classList.remove('view-exit');
    window.scrollTo(0, 0);

    // Re-initialize dynamic elements for the new view
    lazyLoader.observe();
    scrollAnimator.observe();
}

// --- 9. GLOBAL EVENT LISTENERS & INITIALIZATION ---
function updateUIForAuthState() {
    if (state.isTraktAuthenticated) {
        traktAuthButton.textContent = 'Logout';
        traktAuthButton.onclick = TRAKT_API.logoutTrakt;
        statsNavLink.style.display = 'inline-block';
    } else {
        traktAuthButton.textContent = 'Connect Trakt';
        traktAuthButton.onclick = TRAKT_API.redirectToTraktAuth;
        statsNavLink.style.display = 'none';
    }
}

function handleSearch(event) {
    if (event.key === 'Enter' && searchInput.value.trim()) {
        window.location.hash = `search/${encodeURIComponent(searchInput.value.trim())}`;
        searchInput.blur();
        searchInput.value = '';
    }
}

async function init() {
    // PWA Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(err => console.error('Service Worker Registration Failed:', err));
    }

    // Event Listeners
    window.addEventListener('hashchange', router);
    window.addEventListener('scroll', handleGlobalScroll, { passive: true });
    searchInput.addEventListener('keydown', handleSearch);

    // Check for Trakt OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const traktAuthCode = urlParams.get('code');
    if (traktAuthCode) {
        appRoot.innerHTML = `<div class="hero-section"><h1 class="tagline">Connecting...</h1></div>`;
        await TRAKT_API.handleTraktCallback(traktAuthCode);
        state.isTraktAuthenticated = true;
        window.location.hash = '';
    }

    // Initialize modules
    updateUIForAuthState();
    lazyLoader.init();
    scrollAnimator.init();
    customCursor.init();
    
    // Initial Route
    await router();
    body.classList.remove('loading');
}

// --- Let's begin ---
document.addEventListener('DOMContentLoaded', init);
