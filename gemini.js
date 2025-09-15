/*
================================================================
GEMINI.JS - GOOGLE GEMINI API INTERACTION MODULE (REFACTORED)
- Handles all communication with the Google Gemini API.
- Centralizes the AI Prompt Library for maintainability.
- Provides dedicated functions for each type of AI request.
================================================================
*/

// --- Configuration ---

// IMPORTANT: As per the project README, replace with your actual Google Gemini API Key.
const API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// --- AI Prompt Library (as defined in the project README) ---
const PROMPT_TEMPLATES = {
    queryAnalysis_v1: `Analyze this recommendation query: "{{query}}"

Determine:
1. What type of content is being requested (movie, series, or ambiguous)
2. What genres are relevant to this query

Respond in a single line with pipe-separated format:
type|genre1,genre2,genre3

Examples:
movie|action,thriller,sci-fi
series|comedy,drama

Do not include any explanatory text.`,

    similarContent_v1: `You are an expert recommendation engine. Generate a list of exactly {{numResults}} recommendations highly similar to "{{sourceTitle}} ({{sourceYear}})".

First, list any other official entries from the same franchise in chronological order. Then, fill the remaining slots with unrelated titles that are highly similar in mood, theme, and genre, sorted by relevance.

CRITICAL RULES:
- DO NOT include "{{sourceTitle}} ({{sourceYear}})" in your list.
- Provide ONLY the list with no extra text.

Format:
{{type}}|name|year`,
};

// --- Core API Fetch Function ---

/**
 * Sends a prompt to the Gemini API and returns the text response.
 * @param {string} prompt - The complete, formatted text prompt.
 * @returns {Promise<string>} A promise that resolves to the raw text content from the AI.
 * @throws {Error} If the network response is not ok or the response format is unexpected.
 */
async function fetchFromGemini(prompt) {
    const url = `${API_URL}?key=${API_KEY}`;
    const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Gemini API Error Body:', errorBody);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        } else {
            console.error('Unexpected Gemini API response format:', data);
            throw new Error('Could not parse the response from Gemini API.');
        }
    } catch (error) {
        console.error('Error fetching from Gemini API:', error);
        throw error;
    }
}

// --- Exported API Functions ---

/**
 * Uses 'queryAnalysis_v1' to determine the user's intent from a search query.
 * @param {string} userQuery - The raw search query from the user.
 * @returns {Promise<{type: string, genres: string[]}>} An object with content type and genres.
 */
export async function analyzeQuery(userQuery) {
    const prompt = PROMPT_TEMPLATES.queryAnalysis_v1.replace('{{query}}', userQuery);
    
    try {
        const response = await fetchFromGemini(prompt);
        const [type, genresStr] = response.trim().split('|');
        const genres = genresStr ? genresStr.split(',').map(g => g.trim()) : [];
        return { type, genres };
    } catch (error) {
        console.error('Failed to analyze query:', error);
        return { type: 'movie', genres: [] }; // Fallback
    }
}

/**
 * Builds the 'mainSearch_v1' prompt and fetches personalized recommendations.
 * @param {object} params - The parameters for building the prompt.
 * @returns {Promise<string>} The raw, formatted text response from the AI.
 */
export async function getAIRecommendations({
    searchQuery,
    type,
    numResults = 10,
    recentlyWatchedList = '',
    highlyRatedList = ''
}) {
    // A. Initial Instruction
    let prompt = `You are a ${type} recommendation expert. Analyze this query: "${searchQuery}"`;

    // B. User Personalization (Optional)
    if (recentlyWatchedList && highlyRatedList) {
        prompt += `\n\nUSER'S VIEWING HISTORY (FOR CONTEXT):\n\nRecently watched:\n${recentlyWatchedList}\n\nHighly rated:\n${highlyRatedList}\n\nRECOMMENDATION STRATEGY:\n- DO NOT recommend any titles listed in the user's history above.\n- Recommend titles SIMILAR to the user's highly rated items.`;
    }
    
    // C. Critical Instructions & Rules
    prompt += `\n\nIMPORTANT INSTRUCTIONS:\n- You MUST use the Google Search tool to ensure your recommendations are current and accurate.\n- You MUST return exactly ${numResults} ${type} recommendations.\n- Prioritize quality and relevance.\n- Handle franchise queries (e.g., 'Star Wars') by listing all mainline films in chronological order first.`;

    // D. Formatting Requirements
    prompt += `\n\nFORMAT:\n${type}|name|year\n\nRULES:\n- Use | separator\n- Year must be in YYYY format`;

    return fetchFromGemini(prompt);
}

/**
 * Uses 'similarContent_v1' to get recommendations similar to a specific title.
 * @param {object} params - Parameters for the prompt.
 * @returns {Promise<string>} The raw, formatted text response from the AI.
 */
export async function getSimilarContent({ sourceTitle, sourceYear, type, numResults = 8 }) {
    let prompt = PROMPT_TEMPLATES.similarContent_v1;
    prompt = prompt.replace('{{numResults}}', numResults);
    prompt = prompt.replace('{{sourceTitle}}', sourceTitle);
    prompt = prompt.replace('{{sourceYear}}', sourceYear);
    prompt = prompt.replace('{{type}}', type);
    
    return fetchFromGemini(prompt);
}

/**
 * Uses a prompt from the 'homepageRecs_v1' library to get curated lists.
 * @param {string} creativePrompt - The creative prompt, e.g., "Recommend a hidden gem movie."
 * @param {string} type - The content type ('movie' or 'series').
 * @param {number} numResults - The number of results to fetch.
 * @returns {Promise<string>} The raw, formatted text response from the AI.
 */
export async function getHomepageRecommendation({ creativePrompt, type, numResults = 10 }) {
    // This prompt combines the creative query with strict formatting rules.
    const prompt = `${creativePrompt}

IMPORTANT INSTRUCTIONS:
- You MUST use the Google Search tool to find high-quality, relevant titles.
- You MUST return exactly ${numResults} ${type} recommendations.
- Provide ONLY the list with no extra text.

FORMAT:
${type}|name|year`;
    
    return fetchFromGemini(prompt);
}

/**
 * A utility function to parse the standard `type|title|year` AI response.
 * @param {string} responseText - The raw text from a Gemini API call.
 * @returns {Array<{type: string, title: string, year: number}>} An array of parsed movie/show objects.
 */
export function parseAIResponse(responseText) {
    if (!responseText) return [];
    
    return responseText
        .trim()
        .split('\n')
        .map(line => {
            const parts = line.split('|');
            if (parts.length < 3) return null; // Ensure the line is correctly formatted
            
            const [type, title, year] = parts.map(p => p.trim());
            const parsedYear = parseInt(year, 10);

            if (!type || !title || isNaN(parsedYear)) return null;

            return { type, title, year: parsedYear };
        })
        .filter(Boolean); // Remove any null entries from malformed or invalid lines
}
