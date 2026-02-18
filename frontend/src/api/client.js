/**
 * NyayaAI – API Client
 * ======================
 * Thin wrapper around fetch for communicating with the FastAPI backend.
 */

// In development, Vite proxies /api → localhost:8000
// In production, set this to your Render backend URL
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Send a legal question and get a structured response.
 * @param {string} query - The user's legal question.
 * @param {string} language - "en" or "hi".
 * @returns {Promise<object>} Structured legal response.
 */
export async function askQuestion(query, language = 'en') {
    const response = await fetch(`${BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, language }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `Server error: ${response.status}`);
    }

    return response.json();
}

/**
 * Check backend health.
 * @returns {Promise<object>} Health status.
 */
export async function checkHealth() {
    const response = await fetch(`${BASE_URL}/health`);
    return response.json();
}

/**
 * Submit user feedback.
 * @param {string} query - Original query.
 * @param {number} rating - 1-5 star rating.
 * @param {string} [comment] - Optional comment.
 * @returns {Promise<object>} Success message.
 */
export async function submitFeedback(query, rating, comment = null) {
    const response = await fetch(`${BASE_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, rating, comment }),
    });

    if (!response.ok) {
        throw new Error('Failed to submit feedback');
    }

    return response.json();
}
