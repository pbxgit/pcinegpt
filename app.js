/*
================================================================
APP.JS - MAIN APPLICATION ENTRY POINT
- Initializes the application.
- Contains the client-side router for SPA-like navigation.
- Manages the rendering of different 'views' into the app-root.
================================================================
*/

/**
 * A simple, hash-based router for navigating between views without
 * full page reloads, enabling a fluid SPA experience.
 *
 * It works by mapping URL hash fragments (e.g., #home, #detail/123)
 * to specific view rendering functions.
 */
const router = {
    // Maps URL hash routes to their corresponding view components.
    routes: {
        '': 'HomeView', // Default route
        'home': 'HomeView',
        // Example for a detail view: 'detail/:id': DetailView,
    },

    /**
     * Finds the matching view for the current URL hash and renders it.
     * It also handles simple parameter extraction (e.g., an ID from the URL).
     */
    async navigate() {
        const path = window.location.hash.slice(1).toLowerCase().split('/')[0] || '/';
        const viewName = this.routes[path] || this.routes['']; // Fallback to HomeView

        if (viewName) {
            // Dynamically create an instance of the view and render it.
            const view = new window[viewName]();
            view.render();
        } else {
            console.error(`No route found for path: ${path}`);
            // Optionally, render a "404 Not Found" view.
        }
    }
};

/**
 * Represents the Home View.
 * This class is responsible for fetching data and rendering the
 * main landing page of the application, including dynamic carousels.
 */
class HomeView {
    /**
     * Renders the HTML structure for the home view into the app's root element.
     * This is a placeholder and will be populated with dynamic TMDB data
     * in a future milestone.
     */
    render() {
        const appRoot = document.getElementById('app-root');
        if (!appRoot) {
            console.error('App root element #app-root not found!');
            return;
        }

        // The initial HTML structure for the home view.
        // It's designed with placeholders for the dynamic carousels.
        appRoot.innerHTML = `
            <div class="view home-view">
                <section class="hero-section">
                    <h1>Welcome to pcinegpt.</h1>
                    <p class="tagline">Navigating the Cinematic Universe with AI.</p>
                </section>
                <section id="trending-carousel" class="carousel">
                    <h2>Trending Now</h2>
                    <div class="carousel-content">
                        <!-- Movie posters will be dynamically inserted here -->
                        <p style="color: var(--color-subtle-text);">Loading content...</p>
                    </div>
                </section>
                <section id="upcoming-carousel" class="carousel">
                    <h2>Coming Soon</h2>
                    <div class="carousel-content">
                        <!-- Movie posters will be dynamically inserted here -->
                    </div>
                </section>
            </div>
        `;
    }
}

// Make the HomeView class globally accessible so the router can find it.
window.HomeView = HomeView;

/**
 * Main App Initializer
 * This function sets up the event listeners and kicks off the application.
 */
function initialize() {
    // Listen for hash changes to trigger navigation.
    window.addEventListener('hashchange', () => router.navigate());
    // Also navigate on initial page load.
    window.addEventListener('load', ()' => router.navigate());

    // Set the initial route if none is present in the URL.
    if (!window.location.hash) {
        window.location.hash = '#home';
    }
}

// Start the application once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', initialize);
