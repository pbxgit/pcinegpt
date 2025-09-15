import Router from './router.js';
import HomeView from './views/HomeView.js';
import DetailView from './views/DetailView.js';
import SearchView from './views/SearchView.js';
import StatsView from './views/StatsView.js';
import { authenticateWithTrakt, handleTraktCallback, isTraktAuthenticated, logoutTrakt } from './api/trakt.js';
import { getFavorites } from './storage.js';

/**
 * @class App
 * @description Main application class that initializes the router, views, and global event listeners.
 */
class App {
    constructor() {
        this.router = new Router();
        this.appRoot = document.getElementById('app-root');
        this.searchInput = document.getElementById('search-input');
        this.authButton = document.getElementById('trakt-auth-button');
        this.statsNavLink = document.getElementById('stats-nav-link');
    }

    /**
     * @method init
     * @description Initializes the application, sets up routes, and attaches event listeners.
     */
    init() {
        this.setupRoutes();
        this.attachEventListeners();
        this.handleAuthentication();
        this.router.navigateTo(window.location.hash || '#/');
    }

    /**
     * @method setupRoutes
     * @description Defines the application's routes and associates them with their respective views.
     */
    setupRoutes() {
        this.router.addRoute('#/', () => new HomeView().render(this.appRoot));
        this.router.addRoute('#/movie/:id', (id) => new DetailView(id).render(this.appRoot));
        this.router.addRoute('#/search/:query', (query) => new SearchView(query).render(this.appRoot));
        this.router.addRoute('#/stats', () => new StatsView().render(this.appRoot));
        this.router.addRoute('#/auth/callback', () => this.handleAuthCallback());
    }

    /**
     * @method attachEventListeners
     * @description Attaches global event listeners for search and authentication.
     */
    attachEventListeners() {
        // Handle search input
        this.searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                const query = this.searchInput.value.trim();
                if (query) {
                    this.router.navigateTo(`#/search/${encodeURIComponent(query)}`);
                    this.searchInput.value = '';
                }
            }
        });

        // Handle Trakt authentication button click
        this.authButton.addEventListener('click', () => {
            if (isTraktAuthenticated()) {
                logoutTrakt();
                this.updateAuthState(false);
            } else {
                authenticateWithTrakt();
            }
        });

        // Add a global click listener for favorite icons to support dynamic content
        document.body.addEventListener('click', (event) => {
            const favoriteIcon = event.target.closest('.favorite-icon');
            if (favoriteIcon) {
                const movieId = favoriteIcon.dataset.movieId;
                this.handleFavoriteClick(movieId, favoriteIcon);
            }
        });
    }

    /**
     * @method handleAuthentication
     * @description Checks the current authentication state with Trakt and updates the UI accordingly.
     */
    handleAuthentication() {
        const authenticated = isTraktAuthenticated();
        this.updateAuthState(authenticated);
    }

    /**
     * @method updateAuthState
     * @description Updates the UI elements based on the authentication state.
     * @param {boolean} isAuthenticated - Whether the user is authenticated with Trakt.
     */
    updateAuthState(isAuthenticated) {
        if (isAuthenticated) {
            this.authButton.textContent = 'Disconnect Trakt';
            this.statsNavLink.style.display = 'inline';
        } else {
            this.authButton.textContent = 'Connect Trakt';
            this.statsNavLink.style.display = 'none';
        }
    }

    /**
     * @method handleAuthCallback
     * @description Handles the OAuth callback from Trakt, exchanges the code for a token,
     * and redirects the user back to the home page.
     */
    async handleAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
            try {
                // Show a loading/processing state in the UI
                this.appRoot.innerHTML = `
                    <div class="loading-container">
                        <div class="spinner"></div>
                        <p>Authenticating with Trakt...</p>
                    </div>
                `;
                await handleTraktCallback(code);
                this.updateAuthState(true);
                // Redirect to home page after successful authentication
                this.router.navigateTo('#/');
            } catch (error) {
                console.error('Authentication failed:', error);
                this.appRoot.innerHTML = `<p>Authentication failed. Please try again.</p>`;
                this.updateAuthState(false);
                // Optionally redirect after a delay
                setTimeout(() => this.router.navigateTo('#/'), 3000);
            }
        } else {
            // No code found, redirect home
            this.router.navigateTo('#/');
        }
    }

     /**
     * @method handleFavoriteClick
     * @description Toggles the favorite status of a movie and updates the UI.
     * @param {string} movieId - The ID of the movie.
     * @param {HTMLElement} iconElement - The favorite icon element that was clicked.
     */
    handleFavoriteClick(movieId, iconElement) {
        // This is a placeholder for the actual favorite logic.
        // The full implementation will be in a later step.
        console.log(`Toggling favorite for movie ID: ${movieId}`);
        iconElement.classList.toggle('active');
    }
}

// Entry point for the application
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
