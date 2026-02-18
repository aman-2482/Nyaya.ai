/**
 * Disclaimer Component
 * ──────────────────────
 * Persistent legal disclaimer banner shown at the top of the chat.
 */

export default function Disclaimer({ language }) {
    const isHindi = language === 'hi';

    return (
        <div className="mx-auto max-w-4xl px-4 mb-4">
            <div className="glass-card rounded-xl px-4 py-3 border-l-2 border-yellow-500/50">
                <div className="flex items-start gap-2.5">
                    <svg
                        className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <div>
                        <p className={`text-xs text-yellow-500/80 leading-relaxed ${isHindi ? 'hindi-text' : ''}`}>
                            {isHindi ? (
                                <>
                                    <strong>अस्वीकरण:</strong> NyayaAI केवल सूचनात्मक उद्देश्यों के लिए है और कानूनी सलाह नहीं देता।
                                    कृपया अपनी विशिष्ट स्थिति के लिए किसी योग्य वकील से परामर्श करें।
                                </>
                            ) : (
                                <>
                                    <strong>Disclaimer:</strong> NyayaAI is for informational purposes only and does not provide legal advice.
                                    Please consult a qualified lawyer for your specific situation.
                                </>
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
