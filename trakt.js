/*
================================================================
TRAKT.JS - TRAKT.TV API & OAUTH 2.0 (PKCE) MODULE
- Manages the full, secure OAuth 2.0 PKCE authentication flow.
- Handles making authenticated API requests for user stats,
  history, and ratings.
- Implements token management and automatic logout on 401 errors.
================================================================
*/

import { saveTraktTokens, getTraktTokens, clearTraktTokens } from './storage.js';

// --- Configuration ---
// IMPORTANT: This CLIENT_ID is for a specific, registered application.
// Replace with your own Trakt application's Client ID.
const CLIENT_ID = '4817758e941a6135b5efc85f8ec52d5ebd72b677fab299fb94f2bb5d1bcb8843';
const REDIRECT_URI = window.location.origin + window.location.pathname; // Dynamic for local/prod
const TRAKT_API_URL = 'https://api.trakt.tv';

// --- PKCE (Proof Key for Code Exchange) Helper Functions ---

/**
 * Generates a cryptographically random string for the code verifier.
 * @param {number} length - The desired length of the verifier string.
 * @returns {string} The generated code verifier.
 */
function generateCodeVerifier(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let text = '';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Creates a SHA-256 hash of the verifier, then Base64URL encodes it.
 * @param {string} verifier - The code verifier generated earlier.
 * @returns {Promise<string>} The resulting code challenge.
 */
async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);

    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// --- Core Authentication Flow ---

/**
 * Initiates the Trakt authentication process by redirecting the user.
 */
export async function redirectToTraktAuth() {
    // 1. Generate and store the verifier for later
    const verifier = generateCodeVerifier(128);
    sessionStorage.setItem('trakt_code_verifier', verifier);

    // 2. Create the challenge from the verifier
    const challenge = await generateCodeChallenge(verifier);

    // 3. Construct the authorization URL with PKCE parameters
    const authUrl = new URL(`${TRAKT_API_URL}/oauth/authorize`);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('code_challenge', challenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');

    // 4. Redirect the user
    window.location.href = authUrl.toString();
}

/**
 * Handles the callback from Trakt after user authorization.
 * Exchanges the authorization code for access and refresh tokens.
 * @param {string} authCode - The authorization code from the URL.
 */
export async function handleTraktCallback(authCode) {
    const verifier = sessionStorage.getItem('trakt_code_verifier');
    if (!verifier) throw new Error('Code verifier not found in session storage. Auth flow is invalid.');

    const body = JSON.stringify({
        code: authCode,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: verifier
    });

    try {
        const response = await fetch(`${TRAKT_API_URL}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });

        if (!response.ok) {
            throw new Error('Failed to exchange authorization code for tokens.');
        }

        const tokens = await response.json();
        saveTraktTokens(tokens);

    } catch (error) {
        console.error('Error during Trakt token exchange:', error);
        clearTraktTokens(); // Clear any partial/bad data
    } finally {
        // Clean up session storage and URL regardless of success or failure
        sessionStorage.removeItem('trakt_code_verifier');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

/**
 * Logs the user out by clearing their tokens and reloading the page.
 */
export function logoutTrakt() {
    clearTraktTokens();
    console.log('Logged out from Trakt. Tokens cleared.');
    location.reload();
}

// --- Authenticated API Fetching ---

/**
 * A centralized fetch function for making authenticated requests to the Trakt API.
 * @param {string} endpoint - The API endpoint to request (e.g., '/users/me/stats').
 * @returns {Promise<any>} The JSON response from the Trakt API.
 */
async function fetchFromTrakt(endpoint) {
    const tokens = getTraktTokens();
    if (!tokens) throw new Error('User is not authenticated with Trakt.');

    const url = `${TRAKT_API_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': CLIENT_ID,
        'Authorization': `Bearer ${tokens.access_token}`
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
        // If the token is expired or invalid (401), log the user out automatically.
        if (response.status === 401) {
            logoutTrakt();
        }
        throw new Error(`Trakt API error! Status: ${response.status}`);
    }
    return response.json();
}


// --- Exported Data-Fetching Functions ---

/**
 * Fetches the user's primary statistics.
 * @returns {Promise<object>} User stats object.
 */
export function getUserStats() {
    return fetchFromTrakt('/users/me/stats');
}

/**
 * Fetches the user's recently watched movies and shows.
 * @returns {Promise<Array<object>>} A combined array of movie and show history items.
 */
export async function getTraktHistory() {
    // Fetch both movies and shows in parallel for efficiency
    const [movies, shows] = await Promise.all([
        fetchFromTrakt('/users/me/history/movies?limit=15'),
        fetchFromTrakt('/users/me/history/shows?limit=15')
    ]);
    return [...movies, ...shows]; // Combine and return
}

/**
 * Fetches the user's highly-rated (9 and 10) movies and shows.
 * @returns {Promise<Array<object>>} A combined array of highly-rated items.
 */
export async function getTraktRatings() {
    const [movies10, shows10, movies9, shows9] = await Promise.all([
        fetchFromTrakt('/users/me/ratings/movies/10?limit=15'),
        fetchFromTrakt('/users/me/ratings/shows/10?limit=15'),
        fetchFromTrakt('/users/me/ratings/movies/9?limit=15'),
        fetchFromTrakt('/users/me/ratings/shows/9?limit=15')
    ]);
    return [...movies10, ...shows10, ...movies9, ...shows9];
}
