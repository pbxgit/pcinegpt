/*
================================================================
GEMINI.JS - AWWWARDS REBUILD 2025 (ENHANCED & REFINED)
- Handles all communication with the Google Gemini 1.5 Flash model.
- Constructs flexible, conversational prompts with improved reliability.
- Features more robust error handling and best-practice warnings.
================================================================
*/

// --- Configuration ---

// CRITICAL SECURITY WARNING:
// Do NOT expose your API key in client-side code in a real application.
// This is done for demonstration purposes only. In a production environment,
// all API calls should be routed through a secure backend proxy server that
// holds the key, preventing it from being stolen by users.
const API_KEY = 'AIzaSyCedFL1iG-ABr0oDKJOJNr6alSpCnZUscA'; // Replace with your Gemini API Key
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;


// --- Core API Fetch Function ---

/**
 * Sends a structured prompt to the Gemini API and returns the text response.
 * @param {string} prompt - The complete text prompt for the AI.
 * @returns {Promise<string>} A promise that resolves to the raw text content of the AI's response.
 * @throws {Error} If the network response is not 'ok' or if the format is unexpected.
 */
async function fetchFromGemini(prompt) {
    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.7, // Lowered for more focused, less random recommendations
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
        },
        safetySettings: [ // Explicitly set safety settings
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        ]
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorDetails = await response.json().catch(() => ({ error: { message: "Unknown API error." }}));
            console.error('Gemini API Error Response:', errorDetails);
            throw new Error(`HTTP error! status: ${response.status} - ${errorDetails.error.message}`);
        }

        const data = await response.json();
        // Added more robust parsing to prevent crashes on unusual response shapes
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (typeof text === 'string') {
            return text;
        } else {
            console.error('Unexpected Gemini API response format:', data);
            throw new Error('Could not parse a valid text response from the Gemini API.');
        }

    } catch (error) {
        console.error('Error fetching from Gemini API:', error);
        throw error; // Re-throw the error to be handled by the caller
    }
}


// --- Public-Facing Functions ---

/**
 * Builds a conversational prompt and fetches AI-powered recommendations.
 * @param {object} params - The parameters for building the prompt.
 * @param {string} params.searchQuery - The user's original, natural language query.
 * @param {string} [params.type='movie'] - The content type ('movie' or 'tv').
 * @param {number} [params.numResults=10] - The number of results to request.
 * @returns {Promise<string>} The raw, pipe-separated text response from the AI, or an empty string on failure.
 */
export async function getAIRecommendations({
    searchQuery,
    type = 'movie', // 'movie' or 'tv'
    numResults = 10,
}) {
    // This prompt has been heavily refined for reliability and accuracy.
    const prompt = `
You are a world-class film and television curator AI. Your sole purpose is to provide recommendations based on user requests.

Analyze the user's request: "${searchQuery}"

Provide a list of exactly ${numResults} recommendations.
The recommendations can be movies or TV shows, based on the user's query. If the query is ambiguous, provide a mix.

CRITICAL INSTRUCTIONS:
1.  Your entire response MUST be ONLY the formatted list. Do NOT include any explanations, summaries, introductory text, markdown, or numbering.
2.  Each item in the list must be on a new line.
3.  Each item MUST follow this exact pipe-separated format: type|name|year
4.  The 'type' must be either 'movie' or 'tv'.
5.  The 'name' must be the original title of the work.
6.  The 'year' must be the year of its first release.

EXAMPLE RESPONSE FORMAT:
movie|Dune|2021
tv|Severance|2022
movie|Parasite|2019
movie|The Godfather|1972
tv|Breaking Bad|2008

Now, fulfill the request for: "${searchQuery}"
`.trim();

    try {
        return await fetchFromGemini(prompt);
    } catch (error) {
        console.error('Failed to get AI recommendations:', error);
        // Return an empty string on failure to allow the UI to handle it gracefully.
        return '';
    }
}
