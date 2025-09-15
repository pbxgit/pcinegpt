/*
================================================================
GEMINI.JS - GOOGLE GEMINI API INTERACTION MODULE
- Handles all communication with the Google Gemini API.
- Constructs prompts based on the official AI Prompt Library.
- Parses the AI's responses into a structured format.
================================================================
*/

// --- Configuration ---

// IMPORTANT: Replace with your actual Google Gemini API Key.
// You can get a free key from Google AI Studio.
const API_KEY = 'AIzaSyCedFL1iG-ABr0oDKJOJNr6alSpCnZUscA';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// --- Core API Fetch Function ---

/**
 * A generic function to send a prompt to the Gemini API.
 * @param {string} prompt - The complete, formatted text prompt.
 * @returns {Promise<string>} A promise that resolves to the text content of the AI's response.
 * @throws {Error} If the network response is not ok or the response format is unexpected.
 */
async function fetchFromGemini(prompt) {
    const url = `${API_URL}?key=${API_KEY}`;
    const body = JSON.stringify({
        contents: [{
            parts: [{ text: prompt }]
        }]
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Extract the text from the Gemini response structure
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
            return data.candidates[0].content.parts[0].text;
        } else {
            // Log the problematic response for debugging
            console.error('Unexpected Gemini API response format:', data);
            throw new Error('Could not parse the response from Gemini API.');
        }

    } catch (error) {
        console.error('Error fetching from Gemini API:', error);
        throw error;
    }
}

// --- AI Prompt Library Integration ---

/**
 * Uses the 'queryAnalysis_v1' prompt to determine the user's intent.
 * @param {string} userQuery - The raw search query from the user.
 * @returns {Promise<{type: string, genres: string[]}>} An object containing the content type and a list of genres.
 */
export async function analyzeQuery(userQuery) {
    // Template from the Project Blueprint
    const template = `Analyze this recommendation query: "{{query}}"

Determine:
1. What type of content is being requested (movie, series, or ambiguous)
2. What genres are relevant to this query

Respond in a single line with pipe-separated format:
type|genre1,genre2,genre3

Examples:
movie|action,thriller,sci-fi
series|comedy,drama

Do not include any explanatory text.`;

    const prompt = template.replace('{{query}}', userQuery);
    
    try {
        const response = await fetchFromGemini(prompt);
        const [type, genresStr] = response.trim().split('|');
        const genres = genresStr ? genresStr.split(',') : [];
        return { type, genres };
    } catch (error) {
        console.error('Failed to analyze query:', error);
        // Fallback in case of an error
        return { type: 'movie', genres: [] };
    }
}

/**
 * Builds the 'mainSearch_v1' prompt and fetches recommendations.
 * @param {object} params - The parameters for building the prompt.
 * @param {string} params.searchQuery - The user's original query.
 * @param {string} params.type - The content type ('movie' or 'series').
 * @param {number} [params.numResults=10] - The number of results to request.
 * @param {string} [params.recentlyWatchedList=''] - Optional list of recently watched titles.
 * @param {string} [params.highlyRatedList=''] - Optional list of highly rated titles.
 * @returns {Promise<string>} The raw, formatted text response from the AI.
 */
export async function getAIRecommendations({
    searchQuery,
    type,
    numResults = 10,
    recentlyWatchedList = '',
    highlyRatedList = ''
}) {
    // --- Build the prompt dynamically based on the blueprint ---
    let prompt = `You are a ${type} recommendation expert. Analyze this query: "${searchQuery}"`;

    // B. User Personalization (Optional)
    if (recentlyWatchedList && highlyRatedList) {
        prompt += `\n\nUSER'S VIEWING HISTORY (FOR CONTEXT):\n\nRecently watched:\n${recentlyWatchedList}\n\nHighly rated:\n${highlyRatedList}\n\nRECOMMENDATION STRATEGY:\n- DO NOT recommend any titles listed in the user's history above.\n- Recommend titles SIMILAR to the user's highly rated items.`;
    }
    
    // C. Critical Instructions & Rules
    prompt += `\n\nIMPORTANT INSTRUCTIONS:\n- You MUST use the Google Search tool to ensure your recommendations are current and accurate.\n- You MUST return exactly ${numResults} ${type} recommendations.\n- Prioritize quality and relevance.\n- Handle franchise queries (e.g., 'Star Wars') by listing all mainline films in chronological order first.`;

    // D. Formatting Requirements
    prompt += `\n\nFORMAT:\ntype|name|year\n\nRULES:\n- Use | separator\n- Year must be in YYYY format\n- Type must be hardcoded to "${type}"`;

    return fetchFromGemini(prompt);
}
