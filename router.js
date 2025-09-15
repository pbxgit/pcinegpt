/**
 * @class Router
 * @description A simple hash-based router for the single-page application.
 */
class Router {
    constructor() {
        this.routes = {};
        // Listen for hash changes to trigger navigation
        window.addEventListener('hashchange', this.handleRouteChange.bind(this));
        // Handle initial page load
        window.addEventListener('load', this.handleRouteChange.bind(this));
    }

    /**
     * @method addRoute
     * @description Adds a new route to the router.
     * @param {string} route - The route hash (e.g., '#/' or '#/movie/:id').
     * @param {Function} handler - The function to execute when the route is matched.
     */
    addRoute(route, handler) {
        this.routes[route] = handler;
    }

    /**
     * @method handleRouteChange
     * @description Handles the hash change event by finding the matching route and executing its handler.
     */
    handleRouteChange() {
        const hash = window.location.hash || '#/';
        let matchedRoute = null;
        let params = null;

        // Check for routes with parameters (e.g., '#/movie/:id')
        for (const route in this.routes) {
            const routeRegex = new RegExp(`^${route.replace(/:\w+/g, '([\\w-]+)')}$`);
            const match = hash.match(routeRegex);

            if (match) {
                matchedRoute = route;
                params = match.slice(1);
                break;
            }
        }

        // If a matching route is found, call its handler with the parameters
        if (matchedRoute && this.routes[matchedRoute]) {
            this.routes[matchedRoute](...params);
        } else {
            // Fallback for unmatched routes
            console.warn(`No route found for hash: ${hash}`);
            // Optionally, redirect to a default or 404 page
            // this.navigateTo('#/');
        }
    }

    /**
     * @method navigateTo
     * @description Navigates to a specified route programmatically.
     * @param {string} hash - The destination hash (e.g., '#/').
     */
    navigateTo(hash) {
        window.location.hash = hash;
    }
}

export default Router;
