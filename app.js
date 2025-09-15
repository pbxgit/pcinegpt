/*
================================================================
APP.JS - AWWWARDS REBUILD 2025 (Corrected Version)
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
    // BUG FIX: Add state to track the current view to prevent race conditions
    currentView: null,
    traktWatchlist: [], // Cache watchlist for faster checks
};

// ================================================================
// --- THEME MANAGEMENT ---
// ================================================================

function applyTheme(theme) {
    state.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    storage.saveTheme(theme); // Use storage module to save theme

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
    '/tv/:id': 'renderDetailView', // Reuse detail view for TV
    '/search/:query': 'renderSearchView',
    '/stats': 'renderStatsView',
};

async function router() {
    dom.root.innerHTML = '';
    showLoading();

    const hash = window.location.hash.substring(1) || '/';
    state.currentView = hash.split('/')[1] || 'home'; // Update current view state
    const [path, param] = hash.split(/(?<=^\/[a-zA-Z]+)\/(.*)/s).filter(Boolean);
    const routeHandlerName = routes[path] || routes['/'];
    const handler = viewHandlers[routeHandlerName];

    try {
        const type = path.includes('/tv/') ? 'tv' : 'movie';
        await handler({ param, type });
    } catch (error) {
        console.error(`Failed to render view: ${routeHandlerName}`, error);
        renderError('Could not load content.');
    }
}

const viewHandlers = {
    async renderHomeView() {
        const aiPromptHtml = createAIPrompt();
        render(aiPromptHtml, { instant: true });
        // Asynchronously fetch carousels after the main UI is visible
        loadDiscoveryCarousels();
    },

    async renderDetailView({ param: id, type }) {
        const details = await api.getMediaDetails(type, id);
        const releaseYear = (details.release_date || details.first_air_date || '').split('-')[0];
        const isInWatchlist = state.traktWatchlist.some(item => (item.movie?.ids?.tmdb || item.show?.ids?.tmdb) === details.id);
        
        const html = `
            <div class="view detail-view" data-media-id="${details.id}" data-media-type="${type}" data-media-title="${details.title || details.name}" data-media-year="${releaseYear}">
                <div class="detail-poster">
                    <img src="${api.getPosterUrl(details.poster_path, 'w780')}" alt="${details.title || details.name}">
                </div>
                <div class="detail-info">
                    <h1>${details.title || details.name}</h1>
                    <div class="detail-meta">
                        <span>${releaseYear}</span>
                        ${details.runtime ? `<span>• ${details.runtime} min</span>` : ''}
                        <span>• ★ ${details.vote_average.toFixed(1)}</span>
                    </div>
                    <p>${details.overview}</p>
                    <button class="trakt-button watchlist-button" style="margin-top: 2rem;">
                        ${isInWatchlist ? '<i data-lucide="check"></i> In Watchlist' : '<i data-lucide="plus"></i> Add to Watchlist'}
                    </button>
                </div>
            </div>
        `;
        render(html);
    },

    async renderSearchView({ param: query }) {
        const decodedQuery = decodeURIComponent(query);
        let html = `<div class="view search-view">
                        <h1 class="search-title">Results for "${decodedQuery}"</h1>
                    </div>`;
        render(html, { instant: true });

        const recommendationsText = await gemini.getAIRecommendations({ searchQuery: decodedQuery });
        const results = await parseAndFetchGeminiResults(recommendationsText);
        
        if (results.length > 0) {
            const searchCarousel = createCarousel('AI Recommendations', results);
            document.querySelector('.search-view').insertAdjacentHTML('beforeend', searchCarousel);
        } else {
            // BUG FIX: Provide better feedback on empty search
            renderError('The AI could not find any results. Please try another query.', document.querySelector('.search-view'));
            document.querySelector('.search-title').style.display = 'none'; // Hide the heading
        }
    },
    
    async renderStatsView() {
        if (!state.isTraktAuthenticated) {
            window.location.hash = '/'; return;
        }
        const stats = await trakt.getUserStats();
        const { movies, shows, episodes } = stats;
        const totalDays = ((movies.minutes || 0) + (episodes.minutes || 0)) / 60 / 24;

        let html = `
            <div class="view stats-view">
                <h1>My Stats</h1>
                <div class="stats-grid">
                    <div class="stat-card">
                        <span>Movies Watched</span>
                        <p>${(movies.watched || 0).toLocaleString()}</p>
                    </div>
                    <div class="stat-card">
                        <span>Shows Watched</span>
                        <p>${(shows.watched || 0).toLocaleString()}</p>
                    </div>
                    <div class="stat-card">
                        <span>Episodes Watched</span>
                        <p>${(episodes.watched || 0).toLocaleString()}</p>
                    </div>
                    <div class="stat-card">
                        <span>Total Time</span>
                        <p>${totalDays.toFixed(0)} <span class="unit">days</span></p>
                    </div>
                </div>
            </div>
        `;
        render(html);
    }
};

function render(html, options = {}) {
    const target = options.target || dom.root;
    if (options.instant) {
        target.innerHTML = html;
    } else {
        target.innerHTML = ''; // Clear loading spinner
        target.insertAdjacentHTML('beforeend', html);
    }
    lucide.createIcons();
    bindSearchInputEvents();
}

function renderError(message, target = dom.root) {
    target.innerHTML = `<div class="error-view" style="text-align: center;"><p>${message}</p></div>`;
}

// ================================================================
// --- DYNAMIC CONTENT LOADING ---
// ================================================================

async function loadDiscoveryCarousels() {
    // BUG FIX: Check if we are still on the home page before rendering to prevent race condition.
    if (state.currentView !== 'home') return;
    
    const carouselContainer = document.querySelector('.carousel-master-container');
    if (!carouselContainer) return; // Exit if the container isn't on the page

    const carouselsToLoad = [
        { title: "Trending Movies", fetcher: () => api.getTrending('movie'), type: 'movie' },
        { title: "Trending TV Shows", fetcher: () => api.getTrending('tv'), type: 'tv' },
        { title: "Top Rated Movies", fetcher: () => api.getTopRated('movie'), type: 'movie' },
        { title: "Top Rated TV Shows", fetcher: () => api.getTopRated('tv'), type: 'tv' },
    ];

    if (state.isTraktAuthenticated) {
        carouselsToLoad.push({
            title: "Based on Your Top Ratings",
            fetcher: getTraktPersonalizedRecs,
            type: 'movie'
        });
    }

    for (let i = 0; i < carouselsToLoad.length; i++) {
        // Double-check view before each async operation
        if (state.currentView !== 'home') return;
        try {
            const { title, fetcher, type } = carouselsToLoad[i];
            const data = await fetcher();
            if (data && data.length > 0) {
                const carouselHtml = createCarousel(title, data, type);
                // Final check before DOM insertion
                if (state.currentView === 'home') {
                    const carouselEl = document.createElement('div');
                    carouselEl.className = 'carousel-container';
                    carouselEl.style.animationDelay = `${i * 150}ms`;
                    carouselEl.innerHTML = carouselHtml;
                    carouselContainer.appendChild(carouselEl);
                }
            }
        } catch (error) {
            console.error(`Failed to load carousel:`, error);
        }
    }
}


async function getTraktPersonalizedRecs() {
    const ratings = await trakt.getTraktRatings();
    if (ratings.length === 0) return [];
    
    const seedItem = ratings[Math.floor(Math.random() * ratings.length)];
    const seedTitle = seedItem.movie?.title || seedItem.show?.title;
    const seedType = seedItem.movie ? 'movie' : 'show';

    const prompt = `The user highly rated "${seedTitle}". Recommend 10 similar ${seedType}s.`;
    const geminiResponse = await gemini.getAIRecommendations({ searchQuery: prompt, type: seedType });
    return parseAndFetchGeminiResults(geminiResponse);
}

async function parseAndFetchGeminiResults(geminiResponse) {
    if (!geminiResponse) return [];
    const lines = geminiResponse.trim().split('\n');
    const promises = lines.map(line => {
        const [type, title, year] = line.split('|');
        if (type && title && year) {
            return api.searchTMDB(type, title, year);
        }
        return null;
    }).filter(Boolean);
    
    const results = await Promise.all(promises);
    return results.filter(Boolean);
}


// ================================================================
// --- COMPONENT FACTORIES ---
// ================================================================

function createAIPrompt() {
    return `
        <div class="view home-view">
            <div class="ai-prompt-container">
                <h1>Your Conversational Movie Navigator</h1>
                <p>Tell me what you're in the mood for. A genre, an actor, a vibe – anything.</p>
                <div class="search-input-wrapper">
                    <input type="text" class="search-input" id="main-search-input" placeholder="e.g., &quot;space operas like Dune&quot;">
                </div>
                <div class="suggestion-chips">
                    <button class="chip" data-query="mind-bending sci-fi movies">Sci-Fi</button>
                    <button class="chip" data-query="cozy mystery shows">Mysteries</button>
                    <button class="chip" data-query="oscar winning dramas from the 90s">Dramas</button>
                </div>
            </div>
            <div class="carousel-master-container"></div>
        </div>
    `;
}

function createCarousel(title, items, type = 'movie') {
    return `
        <h2 class="carousel-title">${title}</h2>
        <div class="carousel-content">
            ${items.map(item => createPosterCard(item, type)).join('')}
        </div>
    `;
}

function createPosterCard(item, type) {
    const title = item.title || item.name;
    const hrefType = item.media_type || type;
    return `
        <div class="poster-card">
            <a href="#/${hrefType}/${item.id}">
                <img src="${api.getPosterUrl(item.poster_path)}" alt="${title}" loading="lazy">
                <div class="poster-overlay">
                    <span>${title}</span>
                </div>
            </a>
        </div>
    `;
}

// ================================================================
// --- EVENT HANDLING & INITIALIZATION ---
// ================================================================
function handleSearch(query) {
    if (query && query.trim() !== '') {
        window.location.hash = `#/search/${encodeURIComponent(query.trim())}`;
    }
}

function bindSearchInputEvents() {
    const searchInput = document.getElementById('main-search-input');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSearch(e.target.value);
        });
    }
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => handleSearch(chip.dataset.query));
    });
}

async function handleWatchlistClick(e) {
    const button = e.target.closest('.watchlist-button');
    if (!button) return;

    if (!state.isTraktAuthenticated) {
        trakt.redirectToTraktAuth();
        return;
    }

    const view = e.target.closest('.detail-view');
    const { mediaId, mediaType, mediaTitle, mediaYear } = view.dataset;
    const mediaItem = { id: parseInt(mediaId), type: mediaType, title: mediaTitle, year: parseInt(mediaYear) };

    const isInWatchlist = state.traktWatchlist.some(item => (item.movie?.ids?.tmdb || item.show?.ids?.tmdb) === mediaItem.id);

    button.disabled = true;
    button.innerHTML = 'Updating...';
    
    try {
        if (isInWatchlist) {
            await trakt.removeFromWatchlist(mediaItem);
        } else {
            await trakt.addToWatchlist(mediaItem);
        }
        await fetchTraktWatchlist(); // Refresh local cache
        button.innerHTML = !isInWatchlist ? '<i data-lucide="check"></i> In Watchlist' : '<i data-lucide="plus"></i> Add to Watchlist';
        lucide.createIcons();
    } catch (error) {
        console.error("Failed to update watchlist:", error);
        button.innerHTML = 'Error';
    } finally {
        button.disabled = false;
    }
}

function showLoading() {
    dom.root.innerHTML = `<div class="loading-container"><div class="spinner"></div></div>`;
}

function updateAuthUI() {
    if (storage.getTraktTokens()) {
        state.isTraktAuthenticated = true;
        dom.trakt.authBtn.textContent = 'Logout';
        dom.trakt.statsLink.style.display = 'inline';
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
        await trakt.handleTraktCallback(authCode);
        updateAuthUI();
        window.location.hash = '/';
    }
}

async function fetchTraktWatchlist() {
    if (state.isTraktAuthenticated) {
        try {
            state.traktWatchlist = await trakt.getWatchlist();
        } catch (error) {
            console.error("Could not fetch Trakt watchlist:", error);
            state.traktWatchlist = [];
        }
    }
}

function initEventListeners() {
    window.addEventListener('hashchange', router);
    dom.themeToggleBtn.addEventListener('click', toggleTheme);
    dom.trakt.authBtn.addEventListener('click', () => {
        state.isTraktAuthenticated ? trakt.logoutTrakt() : trakt.redirectToTraktAuth();
    });
    dom.root.addEventListener('click', handleWatchlistClick);
}

async function init() {
    lucide.createIcons();
    initTheme();
    initEventListeners();
    await handleAuthCallback();
    updateAuthUI();
    await fetchTraktWatchlist();
    router();
}

// Start the application
init();
