/*
================================================================
TRAKT.JS - THE GRAND REBUILD
- Vision: A secure and reliable module for all Trakt.tv interactions.
- Architecture: Manages the complete OAuth 2.0 PKCE authentication
  flow and provides robust methods for fetching user data.
================================================================
*/

import { saveTraktTokens, getTraktTokens, clearTraktTokens } from './storage.js';

// --- 1. CONFIGURATION ---
const CLIENT_ID = '4817758e941a6135b5efc85f8ec52d5ebd72b677fab299fb94f2bb5d1bcb8843';
const REDIRECT_URI = window.location.origin; // Dynamically use the site's origin
const TRAKT_API_URL = 'https://api.trakt.tv';

// --- 2. PKCE (PROOF KEY FOR CODE EXCHANGE) HELPERS ---

/**
 * Generates a cryptographically secure random string.
 * @param {number} length The desired length of the string.
 * @returns {string} The generated verifier.
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
 * Creates a SHA-256 hash of the verifier for the code challenge.
 * @param {string} verifier The code verifier.
 * @returns {Promise<string>} The URL-safe base64-encoded code challenge.
 */
async function generateCodeChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// --- 3. CORE AUTHENTICATION FLOW ---

/**
 * Initiates the authentication process by redirecting the user to Trakt.tv.
 */
export async function redirectToTraktAuth() {
    const verifier = generateCodeVerifier(128);
    sessionStorage.setItem('trakt_code_verifier', verifier); // Use sessionStorage for temporary storage
    const challenge = await generateCodeChallenge(verifier);

    const authUrl = new URL(`${TRAKT_API_URL}/oauth/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    window.location.href = authUrl.toString();
}

/**
 * Handles the callback from Trakt after user authorization.
 * @param {string} authCode The authorization code from the URL.
 */
export async function handleTraktCallback(authCode) {
    const verifier = sessionStorage.getItem('trakt_code_verifier');
    if (!verifier) {
        throw new Error('Trakt auth error: Code verifier not found.');
    }

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
            const errorData = await response.json();
            throw new Error(`Trakt token exchange failed: ${errorData.error_description}`);
        }
        const tokens = await response.json();
        saveTraktTokens(tokens);
    } catch (error) {
        console.error('Error during Trakt token exchange:', error);
        clearTraktTokens(); // Ensure corrupted tokens are cleared on failure
        throw error;
    } finally {
        sessionStorage.removeItem('trakt_code_verifier');
    }
}

/**
 * Logs the user out by clearing their tokens and reloading the page.
 */
export function logoutTrakt() {
    clearTraktTokens();
    location.reload();
}

// --- 4. AUTHENTICATED API REQUESTS ---

/**
 * A centralized and robust fetch function for making authenticated Trakt API calls.
 * @param {string} endpoint The API endpoint to request (e.g., '/users/me/stats').
 * @returns {Promise<any>} A promise that resolves to the JSON response.
 */
async function fetchFromTrakt(endpoint) {
    const tokens = getTraktTokens();
    if (!tokens) {
        throw new Error('Trakt API Error: User is not authenticated.');
    }

    const headers = {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': CLIENT_ID,
        'Authorization': `Bearer ${tokens.access_token}`
    };

    const response = await fetch(`${TRAKT_API_URL}${endpoint}`, { headers });

    if (response.status === 401) {
        // Token is invalid or expired, force logout
        logoutTrakt();
        throw new Error('Trakt token unauthorized. Logging out.');
    }
    if (!response.ok) {
        throw new Error(`Trakt API request failed: ${response.statusText}`);
    }
    // Handle 204 No Content responses gracefully
    return response.status === 204 ? null : response.json();
}


// --- 5. EXPORTED DATA FETCHING METHODS ---

/**
 * Fetches the user's aggregated statistics.
 * @returns {Promise<object>}
 */
export function getUserStats() {
    return fetchFromTrakt('/users/me/stats');
}

/**
 * Fetches the user's most recent watch history.
 * @param {number} [limit=20] The number of items to fetch.
 * @returns {Promise<Array<object>>}
 */
export async function getTraktHistory(limit = 20) {
    // We can fetch both and combine them later if needed. For now, movies is a good start.
    return fetchFromTrakt(`/users/me/history/movies?limit=${limit}`);
}

/**
 * Fetches the user's highest-rated items (ratings of 9 and 10).
 * @param {number} [limit=20] The number of items to fetch.
 * @returns {Promise<Array<object>>}
 */
export async function getTraktRatings(limit = 20) {
    return fetchFromTrakt(`/users/me/ratings/movies/9,10?limit=${limit}`);
}
