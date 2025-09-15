/*
================================================================
TRAKT.JS - AWWWARDS REBUILD 2025 (Corrected Version)
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

// ... (PKCE and Auth Flow functions are unchanged) ...
function generateCodeVerifier(length) { /* ... */ }
async function generateCodeChallenge(verifier) { /* ... */ }
export async function redirectToTraktAuth() { /* ... */ }
export async function handleTraktCallback(authCode) { /* ... */ }
export function logoutTrakt() { /* ... */ }
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
    const config = { headers, ...options };
    const response = await fetch(url, config);
    if (response.status === 204) return { success: true };
    if (!response.ok) {
        if (response.status === 401) logoutTrakt();
        throw new Error(`Trakt API error! Status: ${response.status}`);
    }
    return response.json();
}

// --- Exported Data-Fetching Functions ---
export function getUserStats() { return fetchFromTrakt('/users/me/stats'); }

/**
 * (BUG FIX) Fetches the user's highly-rated (9 and 10) movies and shows.
 * This was previously returning an empty array. It is now fully functional.
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


// --- Watchlist Management Functions ---
export async function getWatchlist() {
    const movies = await fetchFromTrakt('/users/me/watchlist/movies');
    const shows = await fetchFromTrakt('/users/me/watchlist/shows');
    return [...movies, ...shows];
}
export function addToWatchlist({ id, title, year, type }) {
    const payload = {
        [type === 'tv' ? 'shows' : 'movies']: [{ title, year, ids: { tmdb: id } }]
    };
    return fetchFromTrakt('/sync/watchlist', { method: 'POST', body: JSON.stringify(payload) });
}
export function removeFromWatchlist({ id, title, year, type }) {
    const payload = {
        [type === 'tv' ? 'shows' : 'movies']: [{ title, year, ids: { tmdb: id } }]
    };
    return fetchFromTrakt('/sync/watchlist/remove', { method: 'POST', body: JSON.stringify(payload) });
}
