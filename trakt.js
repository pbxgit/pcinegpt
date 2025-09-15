/*
================================================================
TRAKT.JS - TRAKT.TV API & AUTHENTICATION MODULE
- Manages the full OAuth 2.0 PKCE flow for secure user authentication.
- Handles storing, retrieving, and refreshing API tokens.
- Provides authenticated fetch methods for making requests to the Trakt API.
================================================================
*/

import { saveTraktTokens, getTraktTokens, clearTraktTokens } from './storage.js';

// --- Configuration ---
const CLIENT_ID = '4817758e941a6135b5efc85f8ec52d5ebd72b677fab299fb94f2bb5d1bcb8843';
const REDIRECT_URI = 'https://pcinegpt.netlify.app'; // Your live website URL
const TRAKT_API_URL = 'https://api.trakt.tv';

// --- PKCE Helper Functions ---

/**
 * Generates a random string for the PKCE code verifier.
 * @param {number} length - The length of the string to generate.
 * @returns {string} The random verifier string.
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
 * Creates a SHA-256 hash of the code verifier, then encodes it in Base64URL.
 * This is the PKCE code challenge.
 * @param {string} verifier - The code verifier string.
 * @returns {Promise<string>} The Base64URL encoded code challenge.
 */
async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    
    // Base64URL encoding
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// --- Core Authentication Flow ---

/**
 * Initiates the authentication process by redirecting the user to Trakt.
 */
export async function redirectToTraktAuth() {
    const verifier = generateCodeVerifier(128);
    sessionStorage.setItem('trakt_code_verifier', verifier); // Use sessionStorage as it's temporary

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
 * Handles the callback from Trakt after the user authorizes the app.
 * It exchanges the authorization code for an access token.
 * @param {string} authCode - The authorization code from the URL query params.
 */
export async function handleTraktCallback(authCode) {
    const verifier = sessionStorage.getItem('trakt_code_verifier');
    if (!verifier) {
        throw new Error('Code verifier not found in session storage.');
    }

    const tokenUrl = `${TRAKT_API_URL}/oauth/token`;
    const body = JSON.stringify({
        code: authCode,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: verifier
    });

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to fetch token: ${errorData.error_description}`);
        }

        const tokens = await response.json();
        saveTraktTokens(tokens);
        sessionStorage.removeItem('trakt_code_verifier'); // Clean up
        
        // Redirect to clean the URL of auth codes
        window.history.replaceState({}, document.title, window.location.pathname);

    } catch (error) {
        console.error('Error during token exchange:', error);
        clearTraktTokens(); // Clear any partial tokens
    }
}

/**
 * Logs the user out by clearing all Trakt-related data.
 */
export function logoutTrakt() {
    clearTraktTokens();
    // Here you would typically also revoke the token via API, but for simplicity
    // we just clear it locally. A full implementation would do that.
    console.log('Logged out from Trakt.');
    location.reload(); // Refresh the page to update UI
}
