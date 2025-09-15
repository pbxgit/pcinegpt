/*
================================================================
APP.JS - AWWWARDS REBUILD 2025 (ENHANCED & POLISHED)
- Core application logic with a focus on fluid UX and performance.
- Manages theme, state, routing, and dynamic view rendering.
- Features graceful view transitions, optimized loading, and accessibility improvements.
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
    trakt: {
        authBtn: document.getElementById('trakt-auth-button'),
        statsLink: document.getElementById('stats-nav-link'),
    },
    themeToggleBtn: document.getElementById('theme-toggle-button'),
};

// --- APPLICATION STATE ---
const state = {
    isTraktAuthenticated: false,
    currentTheme: 'light',
    currentRoute: null,
    traktWatchlist: [],
};

// ================================================================
// --- THEME MANAGEMENT ---
// ================================================================

function applyTheme(theme) {
    state.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    storage.saveTheme(theme);
    const sunIcon = dom.themeToggleBtn.querySelector('.theme-icon-sun');
    const moonIcon = dom.themeToggleBtn.querySelector('.theme-icon-moon');
    if (theme === 'dark') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    }
}

function toggleTheme() {
    applyTheme(state.currentTheme === 'light' ? 'dark' : 'light');
}

function initTheme() {
    const savedTheme = storage.getTheme();
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(savedTheme || (systemPrefersDark ? 'dark' : 'light'));
}

// ================================================================
// --- ROUTING & VIEW RENDERING ---
// ================================================================

const routes = {
    '/': 'renderHomeView',
    '/movie/:id': 'renderDetailView',
    '/tv/:id': 'renderDetailView',
    '/search/:query': 'renderSearchView',
    '/stats': 'renderStatsView',
};

async function router() {
    const hash = window.location.hash.substring(1) || '/';
    const [path, param] = hash.split(/(?<=^\/[a-zA-Z]+)\/(.*)/s).filter(Boolean);
    state.currentRoute = path || '/';

    if (!dom.root) return;

    // Fade out the current view for a smooth transition
    dom.root.classList.add('view-transition-out');
    await new Promise(resolve => setTimeout(resolve, 200));

    dom.root.innerHTML = ''; // Clear previous content
    showLoading();
    dom.root.classList.remove('view-transition-out');

    const routeHandlerName = routes[path] || routes['/'];
    const handler = viewHandlers[routeHandlerName];

    try {
        const type = path.includes('/tv/') ? 'tv' : 'movie';
        await handler({ param, type });
        // Set focus on the new view's main heading for accessibility
        const mainHeading = dom.root.querySelector('h1');
        if (mainHeading) mainHeading.setAttribute('tabindex', '-1');
        if (mainHeading) mainHeading.focus();

    } catch (error) {
        console.error(`Failed to render view: ${routeHandlerName}`, error);
        renderError('Could not load content. Please check your connection and try again.');
    }
}

const viewHandlers = {
    async renderHomeView() {
        render(createAIPrompt(), { instant: true });
        loadDiscoveryCarousels();
    },
    async renderDetailView({ param: id, type }) {
        const details = await api.getMediaDetails(type, id);
        const releaseYear = (details.release_date || details.first_air_date || '').split('-')[0];
        const isInWatchlist = state.traktWatchlist.some(item => (item.movie?.ids?.tmdb || item.show?.ids?.tmdb) === details.id);
        const html = `<div class="view detail-view" data-media-id="${details.id}" data-media-type="${type}" data-media-title="${details.title || details.name}" data-media-year="${releaseYear}"><div class="detail-poster"><img src="${api.getPosterUrl(details.poster_path, 'w780')}" alt="${details.title || details.name}"></div><div class="detail-info"><h1>${details.title || details.name}</h1><div class="detail-meta"><span>${releaseYear}</span>${details.runtime ? `<span>• ${details.runtime} min</span>` : ''}<span>• ★ ${details.vote_average.toFixed(1)}</span></div><p>${details.overview}</p><button class="trakt-button watchlist-button" style="margin-top: 2rem;">${isInWatchlist ? '<i data-lucide="check"></i> In Watchlist' : '<i data-lucide="plus"></i> Add to Watchlist'}</button></div></div>`;
        render(html);
    },
    async renderSearchView({ param: query }) {
        const decodedQuery = decodeURIComponent(query);
        render(`<div class="view search-view"><h1 class="search-title">Results for "${decodedQuery}"</h1><div class="search-results-container"></div></div>`, { instant: true });
        const recommendationsText = await gemini.getAIRecommendations({ searchQuery: decodedQuery });
        const results = await parseAndFetchGeminiResults(recommendationsText);
        const resultsContainer = document.querySelector('.search-results-container');
        if (resultsContainer && results.length > 0) {
            resultsContainer.innerHTML = createCarousel('AI Recommendations', results);
        } else if (resultsContainer) {
            renderError('The AI could not find any recommendations for that query.', resultsContainer);
        }
    },
    async renderStatsView() {
        if (!state.isTraktAuthenticated) { window.location.hash = '/'; return; }
        const stats = await trakt.getUserStats();
        const { movies, shows, episodes } = stats;
        const totalDays = ((movies.minutes || 0) + (episodes.minutes || 0)) / 60 / 24;
        const html = `<div class="view stats-view"><h1>My Stats</h1><div class="stats-grid"><div class="stat-card"><span>Movies Watched</span><p>${(movies.watched || 0).toLocaleString()}</p></div><div class="stat-card"><span>Shows Watched</span><p>${(shows.watched || 0).toLocaleString()}</p></div><div class="stat-card"><span>Episodes Watched</span><p>${(episodes.watched || 0).toLocaleString()}</p></div><div class="stat-card"><span>Total Time</span><p>${totalDays.toFixed(0)} <span class="unit">days</span></p></div></div></div>`;
        render(html);
    }
};

function render(html, options = {}) {
    const target = options.target || dom.root;
    if (target) {
        options.instant ? target.innerHTML = html : (target.innerHTML = '', target.insertAdjacentHTML('beforeend', html));
        if (window.lucide) lucide.createIcons();
        bindSearchInputEvents();
    }
}

function renderError(message, target = dom.root) {
    if (target) {
        target.innerHTML = `<div class="error-view" style="text-align: center; padding: 2rem; color: var(--color-text-secondary);"><i data-lucide="alert-circle" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i><p>${message}</p></div>`;
        if (window.lucide) lucide.createIcons();
    }
}

// ================================================================
// --- DYNAMIC CONTENT LOADING & COMPONENTS ---
// ================================================================

async function loadDiscoveryCarousels() {
    if (state.currentRoute !== '/') return;
    const masterContainer = document.querySelector('.carousel-master-container');
    if (!masterContainer) return;

    const carouselsToLoad = [
        { title: "Trending Movies", fetcher: () => api.getTrending('movie'), type: 'movie' },
        { title: "Trending TV Shows", fetcher: () => api.getTrending('tv'), type: 'tv' },
        { title: "Top Rated Movies", fetcher: () => api.getTopRated('movie'), type: 'movie' },
        { title: "Top Rated TV Shows", fetcher: () => api.getTopRated('tv'), type: 'tv' },
    ];

    if (state.isTraktAuthenticated) {
        carouselsToLoad.push({ title: "Based on Your Top Ratings", fetcher: getTraktPersonalizedRecs });
    }

    const promises = carouselsToLoad.map(config => config.fetcher().then(data => ({ ...config, data })));
    const results = await Promise.allSettled(promises);

    results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value.data?.length > 0 && state.currentRoute === '/') {
            const { title, data, type } = result.value;
            const carouselEl = document.createElement('div');
            carouselEl.className = 'carousel-container';
            carouselEl.style.animationDelay = `${i * 150}ms`;
            carouselEl.innerHTML = createCarousel(title, data, type);
            masterContainer.appendChild(carouselEl);
        } else if (result.status === 'rejected') {
            console.error(`Failed to load carousel "${carouselsToLoad[i].title}":`, result.reason);
        }
    });
}


async function getTraktPersonalizedRecs() {
    const ratings = await trakt.getTraktRatings();
    if (ratings.length === 0) return [];
    const seedItem = ratings[Math.floor(Math.random() * ratings.length)];
    const seedTitle = seedItem.movie?.title || seedItem.show?.title;
    const geminiResponse = await gemini.getAIRecommendations({ searchQuery: `Recommend 10 similar titles to "${seedTitle}".` });
    return parseAndFetchGeminiResults(geminiResponse);
}

async function parseAndFetchGeminiResults(geminiResponse) {
    if (!geminiResponse) return [];
    const lines = geminiResponse.trim().split('\n');
    const promises = lines.map(line => {
        const [type, title, year] = line.split('|');
        if (type && title && year) return api.searchTMDB(type.trim(), title.trim(), year.trim());
        return null;
    }).filter(Boolean);
    return (await Promise.all(promises)).filter(Boolean);
}

function createAIPrompt() { return `<style>.view{animation:none;}</style><div class="view home-view"><div class="ai-prompt-container"><h1>Your Conversational Movie Navigator</h1><p>Tell me what you're in the mood for. A genre, an actor, a vibe – anything.</p><div class="search-input-wrapper"><input type="text" class="search-input" id="main-search-input" placeholder="e.g., &quot;space operas like Dune&quot;" aria-label="Search for movies and shows"></div><div class="suggestion-chips"><button class="chip" data-query="mind-bending sci-fi movies">Sci-Fi</button><button class="chip" data-query="cozy mystery shows">Mysteries</button><button class="chip" data-query="oscar winning dramas from the 90s">Dramas</button></div></div><div class="carousel-master-container"></div></div>`; }
function createCarousel(title, items, type = 'movie') { return `<h2 class="carousel-title">${title}</h2><div class="carousel-content">${items.map(item => createPosterCard(item, type)).join('')}</div>`; }
function createPosterCard(item, type) { const title = item.title || item.name; const hrefType = item.media_type || type; return `<div class="poster-card"><a href="#/${hrefType}/${item.id}"><img src="${api.getPosterUrl(item.poster_path)}" alt="${title}" loading="lazy"><div class="poster-overlay"><span>${title}</span></div></a></div>`; }

// ================================================================
// --- EVENT HANDLING & INITIALIZATION ---
// ================================================================

function handleSearch(query) { if (query?.trim()) window.location.hash = `#/search/${encodeURIComponent(query.trim())}`; }
function bindSearchInputEvents() { const searchInput = document.getElementById('main-search-input'); if (searchInput) searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(e.target.value); }); document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => handleSearch(chip.dataset.query))); }
async function handleWatchlistClick(e) { const button = e.target.closest('.watchlist-button'); if (!button) return; if (!state.isTraktAuthenticated) { trakt.redirectToTraktAuth(); return; } const view = e.target.closest('.detail-view'); const { mediaId, mediaType, mediaTitle, mediaYear } = view.dataset; const mediaItem = { id: parseInt(mediaId), type: mediaType, title: mediaTitle, year: parseInt(mediaYear) }; const isInWatchlist = state.traktWatchlist.some(item => (item.movie?.ids?.tmdb || item.show?.ids?.tmdb) === mediaItem.id); button.disabled = true; button.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:auto;"></div>'; try { isInWatchlist ? await trakt.removeFromWatchlist(mediaItem) : await trakt.addToWatchlist(mediaItem); await fetchTraktWatchlist(); button.innerHTML = !isInWatchlist ? '<i data-lucide="check"></i> In Watchlist' : '<i data-lucide="plus"></i> Add to Watchlist'; if (window.lucide) lucide.createIcons(); } catch (error) { console.error("Failed to update watchlist:", error); button.innerHTML = 'Error'; } finally { button.disabled = false; } }
function showLoading() { if (dom.root) dom.root.innerHTML = `<div class="loading-container"><div class="spinner"></div></div>`; }
function updateAuthUI() { state.isTraktAuthenticated = !!storage.getTraktTokens(); dom.trakt.authBtn.textContent = state.isTraktAuthenticated ? 'Logout Trakt' : 'Connect Trakt'; dom.trakt.statsLink.style.display = state.isTraktAuthenticated ? 'inline-block' : 'none'; }
async function handleAuthCallback() { const urlParams = new URLSearchParams(window.location.search); const authCode = urlParams.get('code'); if (authCode) { window.history.replaceState({}, document.title, window.location.pathname); showLoading(); await trakt.handleTraktCallback(authCode); } }
async function fetchTraktWatchlist() { if (storage.getTraktTokens()) { try { state.traktWatchlist = await trakt.getWatchlist(); } catch (error) { console.error("Could not fetch Trakt watchlist:", error); state.traktWatchlist = []; } } }
function initEventListeners() { window.addEventListener('hashchange', router); dom.themeToggleBtn.addEventListener('click', toggleTheme); dom.trakt.authBtn.addEventListener('click', () => { state.isTraktAuthenticated ? trakt.logoutTrakt() : trakt.redirectToTraktAuth(); }); dom.root.addEventListener('click', handleWatchlistClick); }

async function init() {
    console.log("Application initializing...");
    try {
        // 1. Set up all synchronous UI event listeners and initial theme.
        initEventListeners();
        initTheme();
        if (window.lucide) lucide.createIcons();

        // 2. Handle potential Trakt authentication callback from URL.
        await handleAuthCallback();
        
        // 3. Update UI based on authentication state and fetch user data.
        updateAuthUI();
        await fetchTraktWatchlist();
        
        // 4. Run the router for the first time to render the initial view.
        console.log("Initialization complete. Routing to initial view.");
        router();

    } catch (error) {
        console.error("A critical error occurred during app initialization:", error);
        renderError("The application failed to start. Please try refreshing the page.");
    }
}

// Start the application once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', init);
