/*
================================================================
TRAKT.JS - TRAKT.TV API & AUTHENTICATION MODULE
- Manages the full OAuth 2.0 PKCE flow.
- Handles making authenticated API requests for stats, history, and ratings.
================================================================
*/

import { saveTraktTokens, getTraktTokens, clearTraktTokens } from './storage.js';

// --- Configuration ---
const CLIENT_ID = '4817758e941a6135b5efc85f8ec52d5ebd72b677fab299fb94f2bb5d1bcb8843';
const REDIRECT_URI = 'https://pcinegpt.netlify.app';
const TRAKT_API_URL = 'https://api.trakt.tv';

// --- PKCE & Auth Flow Functions (Unchanged) ---
function generateCodeVerifier(l){const p='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';let t='';for(let i=0;i<l;i++)t+=p.charAt(Math.floor(Math.random()*p.length));return t}
async function generateCodeChallenge(v){const d=new TextEncoder().encode(v);const h=await crypto.subtle.digest('SHA-256',d);return btoa(String.fromCharCode(...new Uint8Array(h))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
export async function redirectToTraktAuth(){const v=generateCodeVerifier(128);sessionStorage.setItem('trakt_code_verifier',v);const c=await generateCodeChallenge(v);const a=new URL(`${TRAKT_API_URL}/oauth/authorize`);a.searchParams.append('response_type','code');a.searchParams.append('client_id',CLIENT_ID);a.searchParams.append('redirect_uri',REDIRECT_URI);a.searchParams.append('code_challenge',c);a.searchParams.append('code_challenge_method','S256');window.location.href=a.toString()}
export async function handleTraktCallback(a){const v=sessionStorage.getItem('trakt_code_verifier');if(!v)throw new Error('Code verifier not found.');const b=JSON.stringify({code:a,client_id:CLIENT_ID,redirect_uri:REDIRECT_URI,grant_type:'authorization_code',code_verifier:v});try{const r=await fetch(`${TRAKT_API_URL}/oauth/token`,{method:'POST',headers:{'Content-Type':'application/json'},body:b});if(!r.ok)throw new Error('Failed to fetch token');const t=await r.json();saveTraktTokens(t);sessionStorage.removeItem('trakt_code_verifier');window.history.replaceState({},document.title,window.location.pathname)}catch(e){console.error('Error during token exchange:',e);clearTraktTokens()}}
export function logoutTrakt(){clearTraktTokens();console.log('Logged out from Trakt.');location.reload()}

// --- Authenticated API Fetching ---
async function fetchFromTrakt(endpoint) {
    const tokens = getTraktTokens();
    if (!tokens) throw new Error('User is not authenticated with Trakt.');
    const url = `${TRAKT_API_URL}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', 'trakt-api-version': '2', 'trakt-api-key': CLIENT_ID, 'Authorization': `Bearer ${tokens.access_token}` };
    const response = await fetch(url, { headers });
    if (!response.ok) { if (response.status === 401) { clearTraktTokens(); location.reload(); } throw new Error(`Trakt API error! status: ${response.status}`); }
    return response.json();
}

export function getUserStats() {
    return fetchFromTrakt('/users/me/stats');
}

/**
 * NEW: Fetches the user's most recently watched movies and shows.
 * @returns {Promise<Array>} A combined list of recently watched items.
 */
export async function getTraktHistory() {
    // Fetch both movies and shows history in parallel
    const [movies, shows] = await Promise.all([
        fetchFromTrakt('/users/me/history/movies?limit=15'),
        fetchFromTrakt('/users/me/history/shows?limit=15')
    ]);
    return [...movies, ...shows];
}

/**
 * NEW: Fetches the user's highest-rated movies and shows (9s and 10s).
 * @returns {Promise<Array>} A combined list of highly-rated items.
 */
export async function getTraktRatings() {
    // Fetch 10-star and 9-star ratings in parallel
    const [movies10, shows10, movies9, shows9] = await Promise.all([
        fetchFromTrakt('/users/me/ratings/movies/10?limit=15'),
        fetchFromTrakt('/users/me/ratings/shows/10?limit=15'),
        fetchFromTrakt('/users/me/ratings/movies/9?limit=15'),
        fetchFromTrakt('/users/me/ratings/shows/9?limit=15')
    ]);
    return [...movies10, ...shows10, ...movies9, ...shows9];
}
