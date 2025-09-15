/*
================================================================
APP.JS - MAIN APPLICATION ENTRY POINT
- Initializes the application and service worker.
- Contains the client-side router for SPA-like navigation.
- Manages the rendering of different 'views' into the app-root.
================================================================
*/

// Import API functions
import { getTrendingMovies, getUpcomingMovies, getPosterUrl } from './api.js';

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
     * Fetches data using the provided API function and renders a carousel.
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
                // Generate HTML with data-src for lazy loading
                const postersHTML = movies.map(movie => {
                    if (!movie.poster_path) return '';
                    return `
                        <div class="poster-card" data-movie-id="${movie.id}">
                            <img class="lazy" data-src="${getPosterUrl(movie.poster_path)}" alt="${movie.title}">
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
 * Implements lazy loading for images using the Intersection Observer API.
 * It targets all images with the class 'lazy' and replaces their
 * data-src with src when they enter the viewport.
 */
function lazyLoadImages() {
    const lazyImages = document.querySelectorAll('img.lazy');

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src; // Load the image
                    
                    // Once the image is loaded, add the 'loaded' class for the fade-in effect
                    img.onload = () => {
                        img.classList.remove('lazy');
                        img.classList.add('loaded');
                    };
                    
                    observer.unobserve(img); // Clean up and stop observing the loaded image
                }
            });
        });

        lazyImages.forEach(img => observer.observe(img));
    } else {
        // Fallback for browsers that do not support Intersection Observer
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
    
    window.addEventListener('hashchange', () => router.navigate());
    window.addEventListener('load', () => router.navigate());

    if (!window.location.hash) {
        window.location.hash = '#home';
    } else {
        router.navigate();
    }
}

document.addEventListener('DOMContentLoaded', initialize);
