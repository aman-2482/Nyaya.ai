/**
 * NyayaAI – Main Application
 * ============================
 * Root component that orchestrates the chat interface.
 */

import { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import ChatInput from './components/ChatInput';
import ChatMessage, { TypingIndicator } from './components/ChatMessage';
import Disclaimer from './components/Disclaimer';
import { askQuestion } from './api/client';

// ── Suggested questions to display on first load ────────────────────────
const SUGGESTIONS = {
    en: [
        '🏠 What are my rights if my landlord refuses to return my security deposit?',
        '📝 How do I file a complaint in consumer court?',
        '👮 Can I get bail after being arrested for a bailable offence?',
        '💼 What are my rights if terminated without notice from my job?',
    ],
    hi: [
        '🏠 अगर मकान मालिक सिक्योरिटी डिपॉजिट वापस नहीं करता तो मेरे क्या अधिकार हैं?',
        '📝 उपभोक्ता अदालत में शिकायत कैसे दर्ज करें?',
        '👮 जमानती अपराध में गिरफ्तारी के बाद क्या मुझे तुरंत जमानत मिल सकती है?',
        '💼 बिना नोटिस के नौकरी से निकाले जाने पर मेरे क्या अधिकार हैं?',
    ],
};

export default function App() {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [language, setLanguage] = useState('en');
    const [error, setError] = useState(null);
    const chatEndRef = useRef(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSend = async (query) => {
        setError(null);

        // Add user message
        const userMessage = { role: 'user', content: query };
        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);

        try {
            const response = await askQuestion(query, language);
            const aiMessage = {
                role: 'assistant',
                data: response,
            };
            setMessages((prev) => [...prev, aiMessage]);
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
            // Add error message to chat
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    data: {
                        summary: language === 'hi'
                            ? 'क्षमा करें, कुछ गड़बड़ हो गई। कृपया पुन: प्रयास करें।'
                            : 'Sorry, something went wrong. Please try again.',
                        disclaimer: 'This is informational only and does not constitute legal advice.',
                    },
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        // Remove emoji prefix for cleaner query
        const cleanQuery = suggestion.replace(/^[^\w\u0900-\u097F]+/, '').trim();
        handleSend(cleanQuery);
    };

    const isHindi = language === 'hi';

    return (
        <div className="flex flex-col h-screen">
            {/* Header */}
            <Header language={language} onLanguageChange={setLanguage} />

            {/* Chat Container */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                    {/* Disclaimer */}
                    <Disclaimer language={language} />

                    {/* Empty State / Suggestions */}
                    {messages.length === 0 && (
                        <div className="animate-fade-in text-center py-12">
                            {/* Hero Icon */}
                            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-saffron-500/20 to-forest-500/20 border border-white/10 flex items-center justify-center">
                                <svg className="w-10 h-10 text-saffron-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18l-4 6h8l-4-6zM4 9l-2 6h6L4 9zm16 0l-2 6h6l-4-6z" />
                                </svg>
                            </div>

                            <h2 className={`text-xl font-semibold text-gray-200 mb-2 ${isHindi ? 'hindi-text' : ''}`}>
                                {isHindi ? 'नमस्ते! मैं NyayaAI हूँ' : 'Namaste! I am NyayaAI'}
                            </h2>
                            <p className={`text-sm text-gray-400 mb-8 max-w-md mx-auto ${isHindi ? 'hindi-text' : ''}`}>
                                {isHindi
                                    ? 'मैं भारतीय कानूनों को सरल भाषा में समझाने में आपकी मदद करता हूँ। नीचे दिए गए सुझावों में से कोई चुनें या अपना सवाल पूछें।'
                                    : 'I help explain Indian laws in simple language. Pick a suggestion below or ask your own question.'
                                }
                            </p>

                            {/* Suggestion Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                                {(SUGGESTIONS[language] || SUGGESTIONS.en).map((suggestion, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSuggestionClick(suggestion)}
                                        className={`
                      glass-card glass-card-hover text-left px-4 py-3 rounded-xl
                      text-sm text-gray-300 hover:text-gray-100
                      transition-all duration-200 hover:scale-[1.02]
                      ${isHindi ? 'hindi-text' : ''}
                    `}
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    {messages.map((msg, i) => (
                        <ChatMessage
                            key={i}
                            message={msg}
                            language={language}
                            isLatest={i === messages.length - 1 && msg.role === 'assistant'}
                        />
                    ))}

                    {/* Typing Indicator */}
                    {isLoading && <TypingIndicator />}

                    {/* Scroll Anchor */}
                    <div ref={chatEndRef} />
                </div>
            </main>

            {/* Input (sticky bottom) */}
            <ChatInput
                onSend={handleSend}
                isLoading={isLoading}
                language={language}
            />
        </div>
    );
}
