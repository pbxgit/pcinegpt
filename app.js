/*
================================================================
APP.JS - AWWWARDS REBUILD 2025 (Final Corrected Version)
- Core application logic for the new conversational experience.
- Manages theme, state, routing, and dynamic view rendering.
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
    const newTheme = state.currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
}

function initTheme() {
    const savedTheme = storage.getTheme();
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    applyTheme(theme);
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
    dom.root.innerHTML = '';
    showLoading();

    const routeHandlerName = routes[path] || routes['/'];
    const handler = viewHandlers[routeHandlerName];

    try {
        const type = path.includes('/tv/') ? 'tv' : 'movie';
        await handler({ param, type });
    } catch (error) {
        console.error(`Failed to render view: ${routeHandlerName}`, error);
        renderError('Could not load content. Please try again later.');
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
        render(`<div class="view search-view"><h1 class="search-title">Results for "${decodedQuery}"</h1></div>`, { instant: true });
        const recommendationsText = await gemini.getAIRecommendations({ searchQuery: decodedQuery });
        const results = await parseAndFetchGeminiResults(recommendationsText);
        const searchView = document.querySelector('.search-view');
        if (searchView && results.length > 0) {
            searchView.insertAdjacentHTML('beforeend', createCarousel('AI Recommendations', results));
        } else if (searchView) {
            renderError('The AI could not find any results.', searchView);
            const title = searchView.querySelector('.search-title');
            if (title) title.style.display = 'none';
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
        target.innerHTML = `<div class="error-view" style="text-align: center; padding: 2rem;"><p>${message}</p></div>`;
    }
}

// ================================================================
// --- DYNAMIC CONTENT LOADING & COMPONENTS ---
// ================================================================

async function loadDiscoveryCarousels() {
    if (state.currentRoute !== '/') return;
    const carouselContainer = document.querySelector('.carousel-master-container');
    if (!carouselContainer) return;
    const carouselsToLoad = [{ title: "Trending Movies", fetcher: () => api.getTrending('movie'), type: 'movie' }, { title: "Trending TV Shows", fetcher: () => api.getTrending('tv'), type: 'tv' }, { title: "Top Rated Movies", fetcher: () => api.getTopRated('movie'), type: 'movie' }, { title: "Top Rated TV Shows", fetcher: () => api.getTopRated('tv'), type: 'tv' },];
    if (state.isTraktAuthenticated) carouselsToLoad.push({ title: "Based on Your Top Ratings", fetcher: getTraktPersonalizedRecs });
    for (let i = 0; i < carouselsToLoad.length; i++) {
        if (state.currentRoute !== '/') return;
        try {
            const { title, fetcher, type } = carouselsToLoad[i];
            const data = await fetcher();
            if (data && data.length > 0 && state.currentRoute === '/') {
                const carouselEl = document.createElement('div');
                carouselEl.className = 'carousel-container';
                carouselEl.style.animationDelay = `${i * 150}ms`;
                carouselEl.innerHTML = createCarousel(title, data, type);
                if (document.querySelector('.carousel-master-container')) {
                    document.querySelector('.carousel-master-container').appendChild(carouselEl);
                }
            }
        } catch (error) { console.error(`Failed to load carousel "${carouselsToLoad[i].title}":`, error); }
    }
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

function createAIPrompt() { return `<div class="view home-view"><div class="ai-prompt-container"><h1>Your Conversational Movie Navigator</h1><p>Tell me what you're in the mood for. A genre, an actor, a vibe – anything.</p><div class="search-input-wrapper"><input type="text" class="search-input" id="main-search-input" placeholder="e.g., &quot;space operas like Dune&quot;"></div><div class="suggestion-chips"><button class="chip" data-query="mind-bending sci-fi movies">Sci-Fi</button><button class="chip" data-query="cozy mystery shows">Mysteries</button><button class="chip" data-query="oscar winning dramas from the 90s">Dramas</button></div></div><div class="carousel-master-container"></div></div>`; }
function createCarousel(title, items, type = 'movie') { return `<h2 class="carousel-title">${title}</h2><div class="carousel-content">${items.map(item => createPosterCard(item, type)).join('')}</div>`; }
function createPosterCard(item, type) { const title = item.title || item.name; const hrefType = item.media_type || type; return `<div class="poster-card"><a href="#/${hrefType}/${item.id}"><img src="${api.getPosterUrl(item.poster_path)}" alt="${title}" loading="lazy"><div class="poster-overlay"><span>${title}</span></div></a></div>`; }

// ================================================================
// --- EVENT HANDLING & INITIALIZATION ---
// ================================================================

function handleSearch(query) { if (query?.trim()) window.location.hash = `#/search/${encodeURIComponent(query.trim())}`; }
function bindSearchInputEvents() { const searchInput = document.getElementById('main-search-input'); if (searchInput) searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(e.target.value); }); document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => handleSearch(chip.dataset.query))); }
async function handleWatchlistClick(e) { const button = e.target.closest('.watchlist-button'); if (!button) return; if (!state.isTraktAuthenticated) { trakt.redirectToTraktAuth(); return; } const view = e.target.closest('.detail-view'); const { mediaId, mediaType, mediaTitle, mediaYear } = view.dataset; const mediaItem = { id: parseInt(mediaId), type: mediaType, title: mediaTitle, year: parseInt(mediaYear) }; const isInWatchlist = state.traktWatchlist.some(item => (item.movie?.ids?.tmdb || item.show?.ids?.tmdb) === mediaItem.id); button.disabled = true; button.innerHTML = 'Updating...'; try { isInWatchlist ? await trakt.removeFromWatchlist(mediaItem) : await trakt.addToWatchlist(mediaItem); await fetchTraktWatchlist(); button.innerHTML = !isInWatchlist ? '<i data-lucide="check"></i> In Watchlist' : '<i data-lucide="plus"></i> Add to Watchlist'; if (window.lucide) lucide.createIcons(); } catch (error) { console.error("Failed to update watchlist:", error); button.innerHTML = 'Error'; } finally { button.disabled = false; } }
function showLoading() { if (dom.root) dom.root.innerHTML = `<div class="loading-container"><div class="spinner"></div></div>`; }
function updateAuthUI() { state.isTraktAuthenticated = !!storage.getTraktTokens(); dom.trakt.authBtn.textContent = state.isTraktAuthenticated ? 'Logout' : 'Connect Trakt'; dom.trakt.statsLink.style.display = state.isTraktAuthenticated ? 'inline-block' : 'none'; }
async function handleAuthCallback() { const urlParams = new URLSearchParams(window.location.search); const authCode = urlParams.get('code'); if (authCode) { window.history.replaceState({}, document.title, window.location.pathname); showLoading(); await trakt.handleTraktCallback(authCode); } }
async function fetchTraktWatchlist() { if (storage.getTraktTokens()) { try { state.traktWatchlist = await trakt.getWatchlist(); } catch (error) { console.error("Could not fetch Trakt watchlist:", error); state.traktWatchlist = []; } } }
function initEventListeners() { window.addEventListener('hashchange', router); dom.themeToggleBtn.addEventListener('click', toggleTheme); dom.trakt.authBtn.addEventListener('click', () => { state.isTraktAuthenticated ? trakt.logoutTrakt() : trakt.redirectToTraktAuth(); }); dom.root.addEventListener('click', handleWatchlistClick); }

// DEFINITIVE BUG FIX: New, robust, and linear initialization sequence.
async function init() {
    console.log("Application initializing...");
    try {
        // 1. Set up all synchronous parts of the UI first.
        initEventListeners();
        initTheme();
        if (window.lucide) {
            lucide.createIcons();
        } else {
             // Fallback if the icon library is slow to load
            document.addEventListener('lucide-loaded', () => lucide.createIcons());
        }

        // 2. Handle any authentication callbacks from Trakt, which updates localStorage.
        await handleAuthCallback();
        
        // 3. Update the UI and fetch data based on the now-settled authentication state.
        updateAuthUI();
        await fetchTraktWatchlist();
        
        // 4. Finally, and only once, run the router to render the correct view.
        console.log("Initialization complete. Running router.");
        router();

    } catch (error) {
        console.error("A critical error occurred during app initialization:", error);
        renderError("The application failed to start. Please try refreshing the page.");
    }
}

// Ensure the init function runs only when the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', init);
