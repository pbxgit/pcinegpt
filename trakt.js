/*
================================================================
TRAKT.JS - TRAKT.TV API & AUTHENTICATION MODULE
- Manages the full OAuth 2.0 PKCE flow.
- Handles making authenticated API requests.
================================================================
*/

import { saveTraktTokens, getTraktTokens, clearTraktTokens } from './storage.js';

// --- Configuration ---
const CLIENT_ID = '4817758e941a6135b5efc85f8ec52d5ebd72b677fab299fb94f2bb5d1bcb8843';
const REDIRECT_URI = 'https://pcinegpt.netlify.app';
const TRAKT_API_URL = 'https://api.trakt.tv';

// --- PKCE & Auth Flow Functions (Unchanged) ---
async function generateCodeChallenge(verifier) { /* ... */ }
function generateCodeVerifier(length) { /* ... */ }
// For brevity, the existing functions are collapsed. Assume they are still here.
const generateCodeVerifier = l=>[...crypto.getRandomValues(new Uint8Array(l))].map(c=>(c%62<10?c%62:c%62<36?String.fromCharCode(c%62+55):String.fromCharCode(c%62+61))).join('');async function generateCodeChallenge(v){const d=new TextEncoder().encode(v);const h=await crypto.subtle.digest('SHA-256',d);return btoa(String.fromCharCode(...new Uint8Array(h))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}

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
    const body = JSON.stringify({ code: authCode, client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code', code_verifier: verifier });
    try {
        const response = await fetch(`${TRAKT_API_URL}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        if (!response.ok) throw new Error('Failed to fetch token');
        const tokens = await response.json();
        saveTraktTokens(tokens);
        sessionStorage.removeItem('trakt_code_verifier');
        window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
        console.error('Error during token exchange:', error);
        clearTraktTokens();
    }
}
export function logoutTrakt() {
    clearTraktTokens();
    console.log('Logged out from Trakt.');
    location.reload();
}

// --- NEW: Authenticated API Fetching ---

/**
 * A generic, authenticated fetch wrapper for the Trakt API.
 * @param {string} endpoint - The API endpoint to request (e.g., '/users/me/stats').
 * @returns {Promise<object>} A promise that resolves to the JSON response data.
 */
async function fetchFromTrakt(endpoint) {
    const tokens = getTraktTokens();
    if (!tokens) throw new Error('User is not authenticated with Trakt.');

    // Note: A full production app would handle token refreshing here.
    // For this project, we assume tokens are valid.

    const url = `${TRAKT_API_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': CLIENT_ID,
        'Authorization': `Bearer ${tokens.access_token}`
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
        // If unauthorized, clear tokens as they might be invalid
        if (response.status === 401) {
            clearTraktTokens();
            location.reload();
        }
        throw new Error(`Trakt API error! status: ${response.status}`);
    }
    return response.json();
}

/**
 * Fetches the statistics for the authenticated user.
 * @returns {Promise<object>} The user's stats object from Trakt.
 */
export function getUserStats() {
    return fetchFromTrakt('/users/me/stats');
}
