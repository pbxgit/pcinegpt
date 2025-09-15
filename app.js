/*
================================================================
APP.JS - MAIN APPLICATION ENTRY POINT (FINAL VERSION)
- Contains the complete, final logic for all project features,
  including hyper-personalized AI search via Trakt.tv data.
================================================================
*/

// Import modules
import * as api from './api.js';
import * as storage from './storage.js';
import * as trakt from './trakt.js';
import * as gemini from './gemini.js';

// --- VIEW CLASSES ---
class HomeView { /* ... (Unchanged) ... */
    async render(){document.getElementById('app-root').innerHTML=`<div class="view home-view"><section class="hero-section"><h1>Welcome to pcinegpt.</h1><p class="tagline">Navigating the Cinematic Universe with AI.</p></section><section id="trending-carousel" class="carousel"><h2>Trending Now</h2><div class="carousel-content"></div></section><section id="upcoming-carousel" class="carousel"><h2>Coming Soon</h2><div class="carousel-content"></div></section></div>`;await this.renderCarousel('#trending-carousel',api.getTrendingMovies);await this.renderCarousel('#upcoming-carousel',api.getUpcomingMovies);lazyLoadImages()}
    async renderCarousel(carouselId,apiFunction){const contentContainer=document.querySelector(`${carouselId} .carousel-content`);try{const data=await apiFunction();if(data&&data.results){contentContainer.innerHTML=data.results.map(movie=>{if(!movie.poster_path)return'';return createPosterCardHTML(movie)}).join('')}}catch(error){console.error(`Failed to render carousel ${carouselId}:`,error)}}
}

class SearchView {
    async render(queryString) {
        const appRoot = document.getElementById('app-root');
        const query = new URLSearchParams(queryString).get('q');
        if (!query) return;

        appRoot.innerHTML = createLoadingHTML(query);

        try {
            // --- PERSONALIZATION LOGIC ---
            let personalizationParams = {};
            if (storage.getTraktTokens()) {
                console.log("Trakt user detected. Fetching data for personalization...");
                try {
                    const [history, ratings] = await Promise.all([
                        trakt.getTraktHistory(),
                        trakt.getTraktRatings()
                    ]);
                    // Format the data into simple text lists for the AI prompt
                    const recentlyWatchedList = history.map(item => `${item.movie?.title || item.show?.title} (${item.movie?.year || item.show?.year})`).join('\n');
                    const highlyRatedList = ratings.map(item => `${item.movie?.title || item.show?.title} (${item.movie?.year || item.show?.year})`).join('\n');
                    
                    personalizationParams = { recentlyWatchedList, highlyRatedList };
                    console.log("Personalization data prepared for AI.");
                } catch (error) {
                    console.warn('Could not fetch Trakt data for personalization. Proceeding with standard search.', error);
                }
            }
            // --- END PERSONALIZATION LOGIC ---

            const analysis = await gemini.analyzeQuery(query);
            const recommendationsText = await gemini.getAIRecommendations({
                searchQuery: query,
                type: analysis.type,
                numResults: 12,
                ...personalizationParams // Spread the personalization data into the request
            });

            const recommendations = recommendationsText.trim().split('\n').map(line => {
                const [type, name, year] = line.split('|');
                return { type, name, year };
            });

            const resultsWithData = await Promise.all(recommendations.map(rec => api.searchTMDB(rec.type === 'series' ? 'tv' : 'movie', rec.name, rec.year)));
            
            document.querySelector('.loading-container').style.display = 'none';
            document.querySelector('.search-results-grid').innerHTML = resultsWithData.filter(Boolean).map(createPosterCardHTML).join('');
            lazyLoadImages();

        } catch (error) {
            console.error('Failed to get AI search results:', error);
            document.querySelector('.loading-container').innerHTML = `<p>Sorry, an error occurred while asking the AI.</p>`;
        }
    }
}

class DetailView { /* ... (Unchanged) ... */
    constructor(){this.handleParallaxScroll=this.handleParallaxScroll.bind(this)}
    async render(movieId){if(!movieId)return;const appRoot=document.getElementById('app-root');appRoot.innerHTML=`<div class="loading-container"><div class="spinner"></div></div>`;try{const details=await api.getMovieDetails(movieId);const posterUrl=api.getPosterUrl(details.poster_path,'w500');appRoot.innerHTML=`<div class="view detail-view"><div class="backdrop"></div><div class="detail-content"><header class="detail-header"><div class="detail-poster"><img src="${posterUrl}" alt="${details.title}" crossorigin="anonymous"></div><div class="detail-title"><h1>${details.title}</h1><p>${details.tagline||''}</p><div class="detail-meta"><span>${(new Date(details.release_date)).getFullYear()}</span><span>•</span><span>${details.runtime} min</span><span>•</span><span>⭐ ${details.vote_average.toFixed(1)}</span></div><div class="detail-actions"></div></div></header><main class="detail-body"><h2>Overview</h2><p>${details.overview}</p></main></div></div>`;this.setupParallax(details.backdrop_path);this.setupDynamicTheming(movieId)}catch(error){console.error('Failed to render detail view:',error);appRoot.innerHTML=`<p>Could not load movie details.</p>`}}
    setupDynamicTheming(movieId){const posterImg=document.querySelector('.detail-poster img');if(posterImg.complete){this.applyColorTheme(posterImg,movieId)}else{posterImg.addEventListener('load',()=>this.applyColorTheme(posterImg,movieId),{once:!0})}}
    applyColorTheme(imgElement,movieId){const colorThief=new ColorThief;const[r,g,b]=colorThief.getColor(imgElement);const brightness=299*r+587*g+114*b;const textColor=brightness>125e3?"#000000":"#FFFFFF";const themeColor=`rgb(${r}, ${g}, ${b})`;document.documentElement.style.setProperty('--theme-color-primary',themeColor);document.documentElement.style.setProperty('--theme-color-text',textColor);const isInWatchlist=storage.isMovieInWatchlist(movieId);document.querySelector('.detail-actions').innerHTML=`<button class="watchlist-btn" data-movie-id="${movieId}" data-action="toggle-watchlist">${isInWatchlist?"✓ Added to Watchlist":"+ Add to Watchlist"}</button>`}
    setupParallax(backdropPath){this.backdrop=document.querySelector('.backdrop');if(this.backdrop){this.backdrop.style.backgroundImage=`url(${api.getPosterUrl(backdropPath,'original')})`;window.addEventListener('scroll',this.handleParallaxScroll)}}
    handleParallaxScroll(){if(this.backdrop){this.backdrop.style.transform=`translateY(${window.scrollY*.4}px)`}}
    destroy(){window.removeEventListener('scroll',this.handleParallaxScroll);document.documentElement.style.removeProperty('--theme-color-primary');document.documentElement.style.removeProperty('--theme-color-text');console.log('DetailView destroyed.')}
}

class StatsView { /* ... (Unchanged) ... */
    async render(){if(!storage.getTraktTokens()){document.getElementById('app-root').innerHTML=`<div class="view stats-view"><div class="stats-prompt"><h2>Unlock Your Personal Stats</h2><p>Connect your Trakt.tv account to see a beautiful visualization of your viewing habits.</p><button class="trakt-button" data-action="connect-trakt">Connect Trakt</button></div></div>`;return}
    document.getElementById('app-root').innerHTML=`<div class="loading-container"><div class="spinner"></div><p>Fetching your stats...</p></div>`;try{const stats=await trakt.getUserStats();const moviesWatched=stats.movies.watched;const showsWatched=stats.shows.watched;const totalHours=Math.round((stats.movies.minutes+stats.episodes.minutes)/60);const topGenres=(stats.genres||[]).slice(0,5);const maxCount=topGenres.length>0?topGenres[0].count:0;document.getElementById('app-root').innerHTML=`<div class="view stats-view"><h1>Your Stats</h1><div class="stats-grid"><div class="stat-card"><h2>Total Hours Watched</h2><p class="stat-highlight">${totalHours.toLocaleString()}</p><p class="stat-label">of cinematic adventures</p></div><div class="stat-card"><h2>Movies vs Shows</h2><p class="stat-highlight">${moviesWatched.toLocaleString()} <span class="stat-label">Movies</span></p><p class="stat-highlight">${showsWatched.toLocaleString()} <span class="stat-label">Shows</span></p></div><div class="stat-card"><h2>Top Genres</h2><ul class="bar-chart">${topGenres.map(genre=>{const width=maxCount>0?genre.count/maxCount*100:0;return`<li class="bar-chart-row"><span class="bar-chart-label">${genre.name}</span><div class="bar-chart-bar-container"><div class="bar-chart-bar" style="width: ${width}%;">${genre.count.toLocaleString()}</div></div></li>`}).join('')}</ul></div></div></div>`}catch(error){console.error('Failed to fetch Trakt stats:',error);document.getElementById('app-root').innerHTML=`<p>Sorry, there was an error fetching your stats.</p>`}}
}

// --- ROUTER & LIFECYCLE MANAGEMENT ---
const router = { /* ... (Unchanged) ... */
    routes:{'':HomeView,home:HomeView,search:SearchView,detail:DetailView,stats:StatsView},currentView:null,async navigate(){if(this.currentView&&typeof this.currentView.destroy=="function")this.currentView.destroy();const[path,param]=window.location.hash.slice(1).split('/');const[basePath,query]=path.split('?');const ViewClass=this.routes[basePath.toLowerCase()]||this.routes[''];if(ViewClass){this.currentView=new ViewClass;this.currentView.render(param||query)}else{console.error(`No route for ${basePath}`);document.getElementById('app-root').innerHTML=`<h1>404</h1>`}}
};

// --- GLOBAL HELPERS & EVENT HANDLERS ---
function createPosterCardHTML(movieData) { /* ... (Unchanged) ... */
    const{id,title,name,poster_path}=movieData;const isInWatchlist=storage.isMovieInWatchlist(id);return`<div class="poster-card" data-movie-id="${id}"><a href="#detail/${id}"><img class="lazy" data-src="${api.getPosterUrl(poster_path)}" alt="${title||name}"></a><div class="favorite-icon ${isInWatchlist?'active':''} " data-movie-id="${id}" data-action="toggle-watchlist"><svg viewBox="0 0 24 24"><path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"></path></svg></div></div>`
}
function createLoadingHTML(query) { /* ... (Unchanged) ... */
    return`<div class="view search-view"><h1>Results for: <span class="query-display">"${query}"</span></h1><div class="loading-container"><div class="spinner"></div><p>Asking the AI...</p></div><div class="search-results-grid"></div></div>`
}
function handleAppClick(event) { /* ... (Unchanged) ... */
    const target=event.target.closest('[data-action]');if(!target)return;const action=target.dataset.action;if(action==='toggle-watchlist'){const movieId=parseInt(target.closest('[data-movie-id]').dataset.movieId,10);if(!movieId)return;const isAdding=!storage.isMovieInWatchlist(movieId);isAdding?storage.addToWatchlist(movieId):storage.removeFromWatchlist(movieId);document.querySelectorAll(`[data-movie-id="${movieId}"]`).forEach(el=>{if(el.dataset.action==='toggle-watchlist'){el.classList.toggle('active',isAdding);if(el.tagName==='BUTTON')el.textContent=isAdding?'✓ Added to Watchlist':'+ Add to Watchlist'}})}
    if(action==='connect-trakt'){trakt.redirectToTraktAuth()}}
}
function handleSearch(event) { /* ... (Unchanged) ... */
    if(event.key==='Enter'){const q=event.target.value.trim();if(q)window.location.hash=`#search?q=${encodeURIComponent(q)}`;event.target.value=''}}
function lazyLoadImages() { /* ... (Unchanged) ... */
    const l=document.querySelectorAll('img.lazy');if('IntersectionObserver'in window){const o=new IntersectionObserver((e,s)=>{e.forEach(t=>{if(t.isIntersecting){const n=t.target;n.src=n.dataset.src;n.classList.remove('lazy');n.onload=()=>n.classList.add('loaded');s.unobserve(n)}})},{rootMargin:"0px 0px 200px 0px"});l.forEach(e=>o.observe(e))}else{l.forEach(e=>{e.src=e.dataset.src;e.classList.add('loaded')})}}
function registerServiceWorker() { /* ... (Unchanged) ... */
    if('serviceWorker'in navigator)window.addEventListener('load',()=>{navigator.serviceWorker.register('/service-worker.js').then(e=>console.log('SW registered.',e)).catch(e=>console.error('SW reg failed:',e))})}
function updateUserUI() { /* ... (Unchanged) ... */
    const isLoggedIn=!!storage.getTraktTokens();document.getElementById('trakt-auth-button').textContent=isLoggedIn?'Logout Trakt':'Connect Trakt';document.getElementById('stats-nav-link').style.display=isLoggedIn?'inline':'none'}
// --- INITIALIZATION ---
async function initialize() { /* ... (Unchanged) ... */
    registerServiceWorker();document.getElementById('app-root').addEventListener('click',handleAppClick);document.getElementById('search-input').addEventListener('keypress',handleSearch);document.getElementById('trakt-auth-button').addEventListener('click',()=>{storage.getTraktTokens()?trakt.logoutTrakt():trakt.redirectToTraktAuth()});const urlParams=new URLSearchParams(window.location.search);if(urlParams.has('code'))await trakt.handleTraktCallback(urlParams.get('code'));updateUserUI();window.addEventListener('hashchange',()=>router.navigate());if(!window.location.hash)window.location.hash='#home';router.navigate()}
document.addEventListener('DOMContentLoaded', initialize);
