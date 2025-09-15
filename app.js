/*
================================================================
APP.JS - MAIN APPLICATION ENTRY POINT
- Initializes the application and service worker.
- Contains the client-side router for SPA-like navigation.
- Manages the rendering of different 'views' into the app-root.
================================================================
*/

// Import API and Storage functions
import { getTrendingMovies, getUpcomingMovies, getPosterUrl } from './api.js';
import { getWatchlist, addToWatchlist, removeFromWatchlist, isMovieInWatchlist } from './storage.js';

/**
 * A simple, hash-based router for navigating between views without
 * full page reloads, enabling a fluid SPA experience.
 */
const router = {
    routes: {
        '': 'HomeView',
        'home': 'HomeView',
    },

    async navigate() {
        const path = window.location.hash.slice(1).toLowerCase().split('/')[0] || '/';
        const viewName = this.routes[path] || this.routes[''];

        if (viewName) {
            const view = new window[viewName]();
            view.render();
        } else {
            console.error(`No route found for path: ${path}`);
        }
    }
};

/**
 * Represents the Home View.
 * Renders the main landing page and populates it with dynamic data.
 */
class HomeView {
    async render() {
        const appRoot = document.getElementById('app-root');
        if (!appRoot) {
            console.error('App root element #app-root not found!');
            return;
        }

        appRoot.innerHTML = `
            <div class="view home-view">
                <section class="hero-section">
                    <h1>Welcome to pcinegpt.</h1>
                    <p class="tagline">Navigating the Cinematic Universe with AI.</p>
                </section>
                <section id="trending-carousel" class="carousel">
                    <h2>Trending Now</h2>
                    <div class="carousel-content"></div>
                </section>
                <section id="upcoming-carousel" class="carousel">
                    <h2>Coming Soon</h2>
                    <div class="carousel-content"></div>
                </section>
            </div>
        `;

        // Asynchronously fetch and render the carousels
        await this.renderCarousel('#trending-carousel', getTrendingMovies);
        await this.renderCarousel('#upcoming-carousel', getUpcomingMovies);

        // After rendering, initialize lazy loading for all new images.
        lazyLoadImages();
    }

    /**
     * Fetches data and renders a carousel with watchlist icons.
     * @param {string} carouselId - The CSS selector for the carousel container.
     * @param {Function} apiFunction - The function from api.js to call.
     */
    async renderCarousel(carouselId, apiFunction) {
        const carousel = document.querySelector(carouselId);
        const contentContainer = carousel.querySelector('.carousel-content');

        try {
            const data = await apiFunction();
            const movies = data.results;

            if (movies && movies.length > 0) {
                const postersHTML = movies.map(movie => {
                    if (!movie.poster_path) return '';
                    const isInWatchlist = isMovieInWatchlist(movie.id);
                    const activeClass = isInWatchlist ? 'active' : '';

                    return `
                        <div class="poster-card" data-movie-id="${movie.id}">
                            <img class="lazy" data-src="${getPosterUrl(movie.poster_path)}" alt="${movie.title}">
                            <div class="favorite-icon ${activeClass}" data-movie-id="${movie.id}" aria-label="Add to Watchlist">
                                <svg viewBox="0 0 24 24"><path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"></path></svg>
                            </div>
                        </div>
                    `;
                }).join('');
                contentContainer.innerHTML = postersHTML;
            } else {
                contentContainer.innerHTML = `<p>No content available.</p>`;
            }
        } catch (error) {
            console.error(`Failed to render carousel ${carouselId}:`, error);
            contentContainer.innerHTML = `<p style="color: var(--color-subtle-text);">Could not load content.</p>`;
        }
    }
}

window.HomeView = HomeView;

/**
 * Handles clicks on the watchlist (favorite) icons using event delegation.
 * @param {Event} event - The click event.
 */
function handleWatchlistClick(event) {
    const icon = event.target.closest('.favorite-icon');
    if (!icon) return;

    const movieId = parseInt(icon.dataset.movieId, 10);
    if (!movieId) return;

    if (isMovieInWatchlist(movieId)) {
        removeFromWatchlist(movieId);
        icon.classList.remove('active');
    } else {
        addToWatchlist(movieId);
        icon.classList.add('active');
    }
}

/**
 * Implements lazy loading for images using the Intersection Observer API.
 */
function lazyLoadImages() {
    const lazyImages = document.querySelectorAll('img.lazy');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.onload = () => {
                        img.classList.remove('lazy');
                        img.classList.add('loaded');
                    };
                    observer.unobserve(img);
                }
            });
        });
        lazyImages.forEach(img => observer.observe(img));
    } else {
        lazyImages.forEach(img => {
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            img.classList.add('loaded');
        });
    }
}

/**
 * Registers the service worker for PWA functionality.
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(reg => console.log('Service Worker registered.', reg))
                .catch(err => console.error('Service Worker registration failed:', err));
        });
    }
}

/**
 * Main App Initializer
 */
function initialize() {
    registerServiceWorker();
    
    // Add a single, delegated event listener for all watchlist clicks
    document.getElementById('app-root').addEventListener('click', handleWatchlistClick);

    window.addEventListener('hashchange', () => router.navigate());
    window.addEventListener('load', () => router.navigate());

    if (!window.location.hash) {
        window.location.hash = '#home';
    } else {
        router.navigate();
    }
}

document.addEventListener('DOMContentLoaded', initialize);
