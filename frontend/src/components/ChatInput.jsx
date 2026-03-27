/**
 * ChatInput Component
 * ─────────────────────
 * Text input with send button and loading state.
 */

import { useState, useRef, useEffect } from 'react';

const PLACEHOLDER = {
    en: 'Ask any legal question... e.g., "What are my rights as a tenant?"',
    hi: 'कोई भी कानूनी सवाल पूछें... जैसे, "किरायेदार के रूप में मेरे क्या अधिकार हैं?"',
};

export default function ChatInput({ onSend, isLoading, language }) {
    const [query, setQuery] = useState('');
    const textareaRef = useRef(null);

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 150) + 'px';
        }
    }, [query]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (!trimmed || isLoading) return;
        onSend(trimmed);
        setQuery('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <div className="sticky bottom-0 bg-gradient-to-t from-gray-950 via-gray-950/95 to-transparent pt-6 pb-4 px-4">
            <form
                onSubmit={handleSubmit}
                className="max-w-4xl mx-auto"
            >
                <div className="glass-card input-glow rounded-2xl p-1.5 transition-all duration-300">
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={textareaRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={PLACEHOLDER[language] || PLACEHOLDER.en}
                            disabled={isLoading}
                            rows={1}
                            className={`
                flex-1 bg-transparent text-gray-100 placeholder-gray-500
                px-4 py-3 text-sm resize-none outline-none
                ${language === 'hi' ? 'hindi-text' : ''}
              `}
                            maxLength={2000}
                        />

                        {/* Send Button */}
                        <button
                            type="submit"
                            disabled={!query.trim() || isLoading}
                            className={`
                flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                transition-all duration-200
                ${query.trim() && !isLoading
                                    ? 'bg-gradient-to-r from-saffron-500 to-forest-500 text-white shadow-lg shadow-saffron-500/20 hover:shadow-saffron-500/40 hover:scale-105'
                                    : 'bg-white/5 text-gray-600 cursor-not-allowed'
                                }
              `}
                        >
                            {isLoading ? (
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                <p className="text-center text-[11px] text-gray-600 mt-2">
                    {language === 'hi'
                        ? 'NyayaAI कानूनी सलाह नहीं देता। कृपया वकील से सलाह लें।'
                        : 'NyayaAI provides information, not legal advice. Consult a lawyer for your case.'
                    }
                </p>
            </form>
        </div>
    );
}
