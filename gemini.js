/*
================================================================
GEMINI.JS - GOOGLE GEMINI API INTERACTION MODULE
- Handles all communication with the Google Gemini 2.5 Flash model.
- Constructs conversational prompts for movie/show recommendations.
- Parses the AI's responses into a structured format.
================================================================
*/

// --- Configuration ---

// IMPORTANT: This API key is exposed client-side for demonstration purposes only.
// In a production environment, this key should be kept secret and all API calls
// should be proxied through a secure backend server.
const API_KEY = 'AIzaSyCedFL1iG-ABr0oDKJOJNr6alSpCnZUscA'; // Replace with your Gemini API Key

// API URL updated to use the 'gemini-2.5-flash' model endpoint as requested.
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// --- Core API Fetch Function ---

/**
 * Sends a structured prompt to the Gemini API and returns the text response.
 * @param {string} prompt - The complete, formatted text prompt for the AI.
 * @returns {Promise<string>} A promise that resolves to the raw text content of the AI's response.
 * @throws {Error} If the network response is not 'ok' or if the response format is unexpected.
 */
async function fetchFromGemini(prompt) {
    const url = `${API_URL}?key=${API_KEY}`;
    
    // Construct the request body according to the Gemini API specification
    const requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        // Configuration for the generation process
        generationConfig: {
            temperature: 0.7, // A balance between creativity and predictability
            topK: 40,
        },
        // Safety settings to filter harmful content
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
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
        
        // Safely navigate the response structure to extract the text
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            return text;
        } else {
            // Log the problematic response for easier debugging
            console.error('Unexpected Gemini API response format:', data);
            throw new Error('Could not parse a valid text response from the Gemini API.');
        }

    } catch (error) {
        console.error('Error fetching from Gemini API:', error);
        // Propagate the error to be handled by the caller
        throw error;
    }
}

// --- Public-Facing Functions ---

/**
 * Builds a conversational prompt and fetches AI-powered recommendations.
 * @param {object} params - The parameters for building the prompt.
 * @param {string} params.searchQuery - The user's original, natural language query.
 * @param {string} [params.type='movie'] - The content type ('movie' or 'series').
 * @param {number} [params.numResults=15] - The number of results to request.
 * @returns {Promise<string>} The raw, pipe-separated text response from the AI.
 */
export async function getAIRecommendations({
    searchQuery,
    type = 'movie',
    numResults = 15,
}) {
    // This prompt is engineered to be conversational and provide clear instructions.
    // It establishes a persona ("Cinematic AI Navigator") and defines a strict output format.
    const prompt = `
You are pcinegpt, a "Cinematic AI Navigator." Your expertise is in understanding natural language queries and recommending movies or shows using the power of the Gemini 2.5 Flash model.

Analyze the user's request: "${searchQuery}"

YOUR TASK:
Provide a list of exactly ${numResults} ${type} recommendations that match the user's request. Ensure the recommendations are relevant, high-quality, and diverse.

CRITICAL INSTRUCTIONS:
- You MUST provide the response in the specified format ONLY.
- Do NOT include any introductory text, explanations, or summaries. Your entire response must be the formatted list.
- For each item, provide the original title and the correct release year.

REQUIRED FORMAT (Pipe-separated):
type|name|year

EXAMPLE:
movie|Inception|2010
movie|The Matrix|1999
movie|Blade Runner 2049|2017

Now, fulfill the request for: "${searchQuery}"
`.trim();

    try {
        return await fetchFromGemini(prompt);
    } catch (error) {
        console.error('Failed to get AI recommendations:', error);
        // Return an empty string or a default error message to prevent app crashes
        return '';
    }
}
