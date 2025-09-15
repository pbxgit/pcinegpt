/*
================================================================
TRAKT.JS - AWWWARDS REBUILD 2025
- Manages the secure OAuth 2.0 PKCE authentication flow for Trakt.tv.
- Handles all authenticated API requests for user data.
- Implements token management and automatic logout on authorization failure.
================================================================
*/

import { saveTraktTokens, getTraktTokens, clearTraktTokens } from './storage.js';

// --- Configuration ---
const CLIENT_ID = '4817758e941a6135b5efc85f8ec52d5ebd72b677fab299fb94f2bb5d1bcb8843';
const REDIRECT_URI = window.location.origin + window.location.pathname; // Dynamic for any domain
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
    const verifier = generateCodeVerifier(128);
    sessionStorage.setItem('trakt_code_verifier', verifier);
    const challenge = await generateCodeChallenge(verifier);

    const authUrl = new URL(`${TRAKT_API_URL}/oauth/authorize`);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('code_challenge', challenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');

    window.location.href = authUrl.toString();
}

/**
 * Handles the callback from Trakt after user authorization.
 * @param {string} authCode - The authorization code from the URL.
 */
export async function handleTraktCallback(authCode) {
    const verifier = sessionStorage.getItem('trakt_code_verifier');
    if (!verifier) throw new Error('Code verifier not found. Authentication flow is invalid.');

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
        clearTraktTokens(); // Clear any partial data
    } finally {
        sessionStorage.removeItem('trakt_code_verifier');
        // Clean the URL, allowing the app's router to take over.
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

/**
 * Logs the user out by clearing their tokens and reloading the page.
 */
export function logoutTrakt() {
    clearTraktTokens();
    location.reload(); // A full reload is the simplest way to reset state on logout.
}

// --- Authenticated API Fetching ---

/**
 * A centralized fetch function for authenticated requests to the Trakt API.
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
        // If the token is expired/invalid (401), log the user out automatically.
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
 * Fetches the user's highly-rated (9 and 10) movies and shows.
 * This is used to seed personalized AI recommendations.
 * @returns {Promise<Array<object>>} A combined array of highly-rated items.
 */
export async function getTraktRatings() {
    const [movies10, shows10, movies9, shows9] = await Promise.all([
        fetchFromTrakt('/users/me/ratings/movies/10?limit=10'),
        fetchFromTrakt('/users/me/ratings/shows/10?limit=10'),
        fetchFromTrakt('/users/me/ratings/movies/9?limit=10'),
        fetchFromTrakt('/users/me/ratings/shows/9?limit=10')
    ]);
    return [...movies10, ...shows10, ...movies9, ...shows9];
}
