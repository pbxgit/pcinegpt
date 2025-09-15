/*
================================================================
GEMINI.JS - AWWWARDS REBUILD 2025
- Handles all communication with the Google Gemini 1.5 Flash model.
- Constructs flexible, conversational prompts for movie or TV recommendations.
================================================================
*/

// --- Configuration ---
const API_KEY = 'AIzaSyCedFL1iG-ABr0oDKJOJNr6alSpCnZUscA'; // Replace with your Gemini API Key
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

// --- Core API Fetch Function ---

/**
 * Sends a structured prompt to the Gemini API and returns the text response.
 * @param {string} prompt - The complete text prompt for the AI.
 * @returns {Promise<string>} A promise that resolves to the raw text content of the AI's response.
 * @throws {Error} If the network response is not 'ok' or if the format is unexpected.
 */
async function fetchFromGemini(prompt) {
    const url = `${API_URL}?key=${API_KEY}`;
    
    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.8, // Slightly higher for more creative recommendations
            topK: 40,
        },
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorDetails = await response.json().catch(() => null);
            console.error('Gemini API Error Response:', errorDetails);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            return text;
        } else {
            console.error('Unexpected Gemini API response format:', data);
            throw new Error('Could not parse a valid text response from the Gemini API.');
        }

    } catch (error) {
        console.error('Error fetching from Gemini API:', error);
        throw error;
    }
}

// --- Public-Facing Functions ---

/**
 * Builds a conversational prompt and fetches AI-powered recommendations.
 * @param {object} params - The parameters for building the prompt.
 * @param {string} params.searchQuery - The user's original, natural language query.
 * @param {string} [params.type='movie'] - The content type ('movie' or 'tv'). Defaults to 'movie'.
 * @param {number} [params.numResults=10] - The number of results to request.
 * @returns {Promise<string>} The raw, pipe-separated text response from the AI.
 */
export async function getAIRecommendations({
    searchQuery,
    type = 'movie', // Can now be 'movie' or 'tv'
    numResults = 10,
}) {
    // The prompt is updated to be more direct and fit the new conversational UI.
    const prompt = `
You are a movie and TV show recommendation AI.
Analyze the user's request: "${searchQuery}"

Provide a list of exactly ${numResults} recommendations.
The recommendations can be movies or TV shows, unless the user specifies one.

CRITICAL INSTRUCTIONS:
- You MUST provide the response in the specified format ONLY.
- Do NOT include any explanations or summaries. Your entire response must be the formatted list.
- For each item, provide the correct media type ('movie' or 'tv'), the original title, and the correct release year.

REQUIRED FORMAT (Pipe-separated):
type|name|year

EXAMPLE:
movie|Dune|2021
tv|Severance|2022
movie|Parasite|2019

Fulfill the request for: "${searchQuery}"
`.trim();

    try {
        return await fetchFromGemini(prompt);
    } catch (error) {
        console.error('Failed to get AI recommendations:', error);
        return ''; // Return an empty string on failure to prevent app crashes.
    }
}
