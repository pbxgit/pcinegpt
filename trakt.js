/*
================================================================
TRAKT.JS - AWWWARDS REBUILD 2025 (Corrected & Expanded)
- Manages the secure OAuth 2.0 PKCE authentication flow for Trakt.tv.
- Handles all authenticated API requests for user data.
- Implements token management and automatic logout on authorization failure.
================================================================
*/

import { saveTraktTokens, getTraktTokens, clearTraktTokens } from './storage.js';

// --- Configuration ---
const CLIENT_ID = '4817758e941a6135b5efc85f8ec52d5ebd72b677fab299fb94f2bb5d1bcb8843';
const REDIRECT_URI = window.location.origin + window.location.pathname;
const TRAKT_API_URL = 'https://api.trakt.tv';

// --- PKCE Helper Functions ---
function generateCodeVerifier(length) { /* ... (unchanged) ... */ }
async function generateCodeChallenge(verifier) { /* ... (unchanged) ... */ }
function generateCodeVerifier(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let text = '';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}


// --- Core Authentication Flow ---
export async function redirectToTraktAuth() { /* ... (unchanged) ... */ }
export async function handleTraktCallback(authCode) { /* ... (unchanged) ... */ }
export function logoutTrakt() { /* ... (unchanged) ... */ }
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
export async function handleTraktCallback(authCode) {
    const verifier = sessionStorage.getItem('trakt_code_verifier');
    if (!verifier) throw new Error('Code verifier not found.');
    const body = JSON.stringify({
        code: authCode, client_id: CLIENT_ID, redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code', code_verifier: verifier
    });
    try {
        const response = await fetch(`${TRAKT_API_URL}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        if (!response.ok) throw new Error('Failed to fetch token');
        const tokens = await response.json();
        saveTraktTokens(tokens);
    } catch (error) {
        console.error('Error during token exchange:', error);
        clearTraktTokens();
    } finally {
        sessionStorage.removeItem('trakt_code_verifier');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}
export function logoutTrakt() {
    clearTraktTokens();
    location.reload();
}

// --- Authenticated API Fetching ---
async function fetchFromTrakt(endpoint, options = {}) {
    const tokens = getTraktTokens();
    if (!tokens) throw new Error('User is not authenticated with Trakt.');

    const url = `${TRAKT_API_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': CLIENT_ID,
        'Authorization': `Bearer ${tokens.access_token}`
    };

    const config = {
        headers,
        ...options
    };

    const response = await fetch(url, config);

    if (response.status === 204) { // Handle "No Content" responses for actions like remove
        return { success: true };
    }
    
    if (!response.ok) {
        if (response.status === 401) logoutTrakt();
        throw new Error(`Trakt API error! Status: ${response.status}`);
    }
    return response.json();
}

// --- Exported Data-Fetching Functions ---
export function getUserStats() { return fetchFromTrakt('/users/me/stats'); }
export async function getTraktRatings() { /* ... (unchanged) ... */ return []; }

// --- NEW: WATCHLIST MANAGEMENT FUNCTIONS ---

/**
 * Gets the user's entire watchlist (movies and shows).
 * @returns {Promise<Array<object>>} A promise that resolves to the user's watchlist items.
 */
export async function getWatchlist() {
    const movies = await fetchFromTrakt('/users/me/watchlist/movies');
    const shows = await fetchFromTrakt('/users/me/watchlist/shows');
    return [...movies, ...shows];
}

/**
 * Adds one or more items to the Trakt watchlist.
 * @param {object} media - The movie or show object to add.
 * @param {string} type - The type of media ('movie' or 'tv').
 */
export function addToWatchlist({ id, title, year, type }) {
    const payload = {
        [type === 'tv' ? 'shows' : 'movies']: [{
            title,
            year,
            ids: { tmdb: id }
        }]
    };
    return fetchFromTrakt('/sync/watchlist', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}

/**
 * Removes an item from the Trakt watchlist.
 * @param {object} media - The movie or show object to remove.
 * @param {string} type - The type of media ('movie' or 'tv').
 */
export function removeFromWatchlist({ id, title, year, type }) {
    const payload = {
        [type === 'tv' ? 'shows' : 'movies']: [{
            title,
            year,
            ids: { tmdb: id }
        }]
    };
    return fetchFromTrakt('/sync/watchlist/remove', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}
