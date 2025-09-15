/*
================================================================
GEMINI.JS - THE GRAND REBUILD (UPDATED)
- Vision: A stable and powerful AI engine for the application.
- Architecture: Centralizes prompt templates and provides a robust,
  single point of contact with the Google Gemini API.
- Update: Now uses the gemini-2.5-flash model as specified.
================================================================
*/

// --- 1. CONFIGURATION ---
const API_KEY = 'AIzaSyCedFL1iG-ABr0oDKJOJNr6alSpCnZUscA';
// Updated to use the gemini-2.5-flash model precisely as requested.
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

// --- 2. PROMPT TEMPLATES ---
const PROMPTS = {
    analyzeQuery: `Analyze this recommendation query: "{{query}}"

Determine:
1. What type of content is being requested (movie or series)
2. What genres are relevant to this query

Respond in a single line with pipe-separated format:
type|genre1,genre2,genre-3

Examples:
movie|action,thriller,sci-fi
series|comedy,drama

Do not include any explanatory text.`,

    getRecommendations: `You are a movie and series recommendation expert. Analyze this query: "{{searchQuery}}"

IMPORTANT INSTRUCTIONS:
- You MUST return exactly 12 {{type}} recommendations.
- Prioritize quality, relevance, and diverse choices.
- DO NOT recommend any titles from this user's history: {{historyList}}
- Recommend titles SIMILAR to the user's highly rated items: {{ratingsList}}

FORMAT:
{{type}}|name|year

RULES:
- Use | separator.
- Year must be in YYYY format.
- Provide ONLY the list with no extra text.`,
};

// --- 3. CORE FETCH FUNCTION ---

/**
 * A centralized and robust fetch function for all Gemini API requests.
 * @param {string} prompt The complete, formatted text prompt.
 * @returns {Promise<string>} A promise that resolves to the text content from the AI.
 * @throws {Error} Throws an error if the network response is not OK or the response is malformed.
 */
async function fetchFromGemini(prompt) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`Gemini API Error: ${errorBody.error.message || response.statusText}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        } else {
            // This catches cases where the API returns a 200 OK but no valid content (e.g., safety blocks)
            throw new Error('Gemini API returned an empty or malformed response.');
        }
    } catch (error) {
        console.error('Error fetching from Gemini API:', error);
        throw error; // Re-throw to be caught by the view renderer
    }
}

// --- 4. EXPORTED API METHODS ---

/**
 * Uses Gemini to determine the user's intent from a search query.
 * @param {string} userQuery The raw search query from the user.
 * @returns {Promise<{type: string, genres: string[]}>}
 */
export async function analyzeQuery(userQuery) {
    const prompt = PROMPTS.analyzeQuery.replace('{{query}}', userQuery);
    try {
        const response = await fetchFromGemini(prompt);
        const [type, genresStr] = response.trim().split('|');
        const genres = genresStr ? genresStr.split(',').map(g => g.trim()) : [];
        return { type: type || 'movie', genres }; // Default to 'movie' if type is missing
    } catch (error) {
        console.error('Failed to analyze query, falling back to default:', error);
        // In case of any failure, return a safe default to allow the search to proceed.
        return { type: 'movie', genres: [] };
    }
}

/**
 * Uses Gemini to get personalized movie or series recommendations.
 * @param {object} params - The parameters for building the prompt.
 * @returns {Promise<string>} The raw, formatted text response from the AI.
 */
export async function getAIRecommendations({
    searchQuery,
    type,
    // These can be expanded later with Trakt data
    historyList = 'None',
    ratingsList = 'None'
}) {
    let prompt = PROMPTS.getRecommendations;
    prompt = prompt.replace('{{searchQuery}}', searchQuery);
    prompt = prompt.replace(/{{type}}/g, type); // Replace all instances of 'type'
    prompt = prompt.replace('{{historyList}}', historyList);
    prompt = prompt.replace('{{ratingsList}}', ratingsList);

    return fetchFromGemini(prompt);
}

/**
 * A utility function to parse the standard `type|title|year` AI response into a usable object.
 * @param {string} responseText The raw text from a Gemini API call.
 * @returns {Array<{type: string, title: string, year: number}>}
 */
export function parseAIResponse(responseText) {
    if (!responseText) return [];
    
    return responseText
        .trim()
        .split('\n')
        .map(line => {
            const parts = line.split('|');
            if (parts.length < 3) return null;
            
            const [type, title, year] = parts.map(p => p.trim());
            const parsedYear = parseInt(year, 10);

            if (!type || !title || isNaN(parsedYear)) return null;

            return { type, title, year: parsedYear };
        })
        .filter(Boolean); // Filter out any null (malformed) entries
}
