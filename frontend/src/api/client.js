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
 * Stream a legal answer over SSE and emit token updates as they arrive.
 * @param {string} query
 * @param {string} language
 * @param {{onToken?: Function, onDone?: Function, onError?: Function}} handlers
 * @returns {Promise<object>} Final structured legal response.
 */
export async function askQuestionStream(query, language = 'en', handlers = {}) {
    const response = await fetch(`${BASE_URL}/ask/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, language }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `Server error: ${response.status}`);
    }

    if (!response.body) {
        throw new Error('Streaming is not supported in this browser.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let eventEnd = buffer.indexOf('\n\n');
        while (eventEnd !== -1) {
            const rawEvent = buffer.slice(0, eventEnd);
            buffer = buffer.slice(eventEnd + 2);

            const dataLines = rawEvent
                .split('\n')
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).trim());

            if (!dataLines.length) {
                eventEnd = buffer.indexOf('\n\n');
                continue;
            }

            let payload;
            try {
                payload = JSON.parse(dataLines.join(''));
            } catch {
                eventEnd = buffer.indexOf('\n\n');
                continue;
            }

            if (payload.type === 'token') {
                if (handlers.onToken) handlers.onToken(payload.token || '');
            } else if (payload.type === 'done') {
                if (handlers.onDone) handlers.onDone(payload.response || {});
                return payload.response || {};
            } else if (payload.type === 'error') {
                const message = payload.error || 'Streaming failed.';
                if (handlers.onError) handlers.onError(message);
                throw new Error(message);
            }

            eventEnd = buffer.indexOf('\n\n');
        }
    }

    throw new Error('Stream ended before completion.');
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
