/**
 * ChatMessage Component
 * ───────────────────────
 * Renders a single message (user query or AI response).
 * AI responses are displayed in a structured card with a
 * typewriter word-by-word reveal animation (ChatGPT-style).
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ══════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════

/** Convert any value (string, array, object) into a readable string. */
function flattenToString(val) {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) {
        return val.map(item => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item !== null) {
                return Object.entries(item)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join('. ');
            }
            return String(item);
        }).join('; ');
    }
    if (typeof val === 'object') {
        return Object.entries(val)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('. ');
    }
    return String(val);
}

/** Normalise AI response data — flatten nested structures, parse JSON strings. */
function normalizeData(raw) {
    if (!raw) return {};
    let data = raw;

    if (typeof raw === 'string') {
        const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*$/g, '').trim();
        try {
            const parsed = JSON.parse(cleaned);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed;
        } catch {
            return { summary: raw, relevant_law: '', your_rights: '', next_steps: [], disclaimer: 'This is informational only and does not constitute legal advice.' };
        }
    }

    if (typeof data !== 'object' || Array.isArray(data)) {
        return { summary: String(raw), relevant_law: '', your_rights: '', next_steps: [], disclaimer: '' };
    }

    const summary = data.summary || '';
    if (typeof summary === 'string' && summary.trim().startsWith('{') && summary.includes('"summary"')) {
        try {
            const inner = JSON.parse(summary.replace(/```json?\s*/g, '').replace(/```\s*$/g, ''));
            if (inner?.summary) data = inner;
        } catch { /* ignore */ }
    }

    return {
        summary: flattenToString(data.summary),
        relevant_law: flattenToString(data.relevant_law),
        your_rights: flattenToString(data.your_rights),
        next_steps: Array.isArray(data.next_steps) ? data.next_steps.map(flattenToString)
            : typeof data.next_steps === 'string' ? data.next_steps.split('\n').filter(s => s.trim()) : [],
        disclaimer: flattenToString(data.disclaimer) || 'This is informational only and does not constitute legal advice.',
        sources: data.sources || [],
    };
}

/** Build plain-text version for copy button. */
function formatForCopy(data) {
    let text = '';
    if (data.summary) text += `Summary:\n${data.summary}\n\n`;
    if (data.relevant_law) text += `Relevant Law:\n${data.relevant_law}\n\n`;
    if (data.your_rights) text += `Your Rights:\n${data.your_rights}\n\n`;
    if (data.next_steps?.length) {
        text += `Next Steps:\n`;
        data.next_steps.forEach((s, i) => { text += `${i + 1}. ${s}\n`; });
        text += '\n';
    }
    if (data.disclaimer) text += `⚠ ${data.disclaimer}`;
    return text.trim();
}

// ══════════════════════════════════════════════════════════════════════════
// TYPEWRITER HOOK
// ══════════════════════════════════════════════════════════════════════════

/**
 * Hook that reveals text word by word.
 * @param {string} fullText - The complete text to reveal.
 * @param {boolean} shouldAnimate - Whether to animate or show instantly.
 * @param {number} speed - Milliseconds between each word (default 30ms).
 * @returns {{ displayedText: string, isTyping: boolean }}
 */
function useTypewriter(fullText, shouldAnimate, speed = 30) {
    const [wordIndex, setWordIndex] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const words = useRef([]);

    useEffect(() => {
        if (!fullText) {
            words.current = [];
            setWordIndex(0);
            setIsTyping(false);
            return;
        }

        words.current = fullText.split(/(\s+)/); // preserve whitespace tokens

        if (!shouldAnimate) {
            setWordIndex(words.current.length);
            setIsTyping(false);
            return;
        }

        setWordIndex(0);
        setIsTyping(true);
    }, [fullText, shouldAnimate]);

    useEffect(() => {
        if (!isTyping || wordIndex >= words.current.length) {
            if (wordIndex >= words.current.length && words.current.length > 0) {
                setIsTyping(false);
            }
            return;
        }

        const timer = setTimeout(() => {
            // Reveal 1-3 tokens at a time for natural speed
            const step = words.current[wordIndex]?.trim() === '' ? 3 : 1;
            setWordIndex(prev => Math.min(prev + step, words.current.length));
        }, speed);

        return () => clearTimeout(timer);
    }, [wordIndex, isTyping, speed]);

    const displayedText = words.current.slice(0, wordIndex).join('');
    return { displayedText, isTyping };
}

// ══════════════════════════════════════════════════════════════════════════
// TYPEWRITER TEXT COMPONENT
// ══════════════════════════════════════════════════════════════════════════

function TypewriterText({ text, animate, className, onFinished, speed = 30 }) {
    const { displayedText, isTyping } = useTypewriter(text, animate, speed);
    const prevTyping = useRef(isTyping);

    useEffect(() => {
        if (prevTyping.current && !isTyping && onFinished) {
            onFinished();
        }
        prevTyping.current = isTyping;
    }, [isTyping, onFinished]);

    return (
        <p className={className}>
            {displayedText}
            {isTyping && <span className="typewriter-cursor" />}
        </p>
    );
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION COMPONENTS (with staggered appear)
// ══════════════════════════════════════════════════════════════════════════

function SectionRelevantLaw({ text, isHindi, animate }) {
    if (!text) return null;
    return (
        <div className={`px-5 py-3 border-b border-white/5 bg-saffron-500/5 ${animate ? 'section-reveal' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-saffron-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="text-xs font-semibold text-saffron-400 uppercase tracking-wider">
                    {isHindi ? 'संबंधित कानून' : 'Relevant Law'}
                </span>
            </div>
            <p className="text-sm text-gray-300">{text}</p>
        </div>
    );
}

function SectionYourRights({ text, isHindi, animate }) {
    if (!text) return null;
    return (
        <div className={`px-5 py-3 border-b border-white/5 bg-forest-500/5 ${animate ? 'section-reveal' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-forest-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-xs font-semibold text-forest-400 uppercase tracking-wider">
                    {isHindi ? 'आपके अधिकार' : 'Your Rights'}
                </span>
            </div>
            <p className="text-sm text-gray-300">{text}</p>
        </div>
    );
}

function SectionNextSteps({ steps, isHindi, animate }) {
    if (!steps?.length) return null;
    return (
        <div className={`px-5 py-3 border-b border-white/5 ${animate ? 'section-reveal' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">
                    {isHindi ? 'अगले कदम' : 'Next Steps'}
                </span>
            </div>
            <ol className="space-y-1.5">
                {steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                            {i + 1}
                        </span>
                        <span>{step}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

function SectionDisclaimer({ text, animate }) {
    if (!text) return null;
    return (
        <div className={`px-5 py-2.5 bg-yellow-500/5 border-b border-white/5 ${animate ? 'section-reveal' : ''}`}>
            <p className="text-[11px] text-yellow-500/80 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                {text}
            </p>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════
// COPY BUTTON
// ══════════════════════════════════════════════════════════════════════════

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
            title="Copy response"
        >
            {copied ? (
                <>
                    <svg className="w-3.5 h-3.5 text-forest-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-forest-400">Copied!</span>
                </>
            ) : (
                <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Copy</span>
                </>
            )}
        </button>
    );
}

// ══════════════════════════════════════════════════════════════════════════
// TYPING INDICATOR
// ══════════════════════════════════════════════════════════════════════════

export function TypingIndicator() {
    return (
        <div className="flex items-start gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-saffron-500/20 to-forest-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-saffron-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18l-4 6h8l-4-6zM4 9l-2 6h6L4 9zm16 0l-2 6h6l-4-6z" />
                </svg>
            </div>
            <div className="glass-card px-5 py-4 rounded-2xl rounded-tl-md">
                <div className="flex items-center gap-1.5">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN CHAT MESSAGE
// ══════════════════════════════════════════════════════════════════════════

export default function ChatMessage({ message, language, isLatest = false }) {
    const isUser = message.role === 'user';
    const isHindi = language === 'hi';

    // Track which sections have been revealed (staggered animation)
    const [revealedSections, setRevealedSections] = useState(
        isLatest ? 0 : 99  // if not latest, show everything instantly
    );

    // When summary typewriter finishes, reveal next sections one by one
    const revealNext = useCallback(() => {
        setRevealedSections(prev => prev + 1);
    }, []);

    // For non-latest messages, show all sections immediately
    useEffect(() => {
        if (!isLatest) setRevealedSections(99);
    }, [isLatest]);

    // Auto-reveal remaining sections with a stagger delay after summary finishes
    useEffect(() => {
        if (!isLatest || revealedSections === 0) return;
        if (revealedSections >= 5) return; // all revealed

        const timer = setTimeout(() => {
            setRevealedSections(prev => prev + 1);
        }, 300); // 300ms stagger between sections

        return () => clearTimeout(timer);
    }, [revealedSections, isLatest]);

    if (isUser) {
        return (
            <div className="flex justify-end animate-fade-in">
                <div className={`
                    max-w-[80%] px-5 py-3 rounded-2xl rounded-tr-md
                    bg-gradient-to-r from-primary-600 to-primary-700
                    text-white text-sm leading-relaxed shadow-lg shadow-primary-600/20
                    ${isHindi ? 'hindi-text' : ''}
                `}>
                    {message.content}
                </div>
            </div>
        );
    }

    // AI response
    const data = normalizeData(message.data);
    const copyText = formatForCopy(data);
    const shouldAnimate = isLatest;

    return (
        <div className="flex items-start gap-3 animate-slide-up">
            {/* AI Avatar */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-saffron-500/20 to-forest-500/20 border border-white/10 flex items-center justify-center flex-shrink-0 mt-1">
                <svg className="w-4 h-4 text-saffron-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18l-4 6h8l-4-6zM4 9l-2 6h6L4 9zm16 0l-2 6h6l-4-6z" />
                </svg>
            </div>

            {/* Response Card */}
            <div className={`flex-1 glass-card rounded-2xl rounded-tl-md overflow-hidden ${isHindi ? 'hindi-text' : ''}`}>
                {/* Summary — animated word by word */}
                {data.summary && (
                    <div className="px-5 py-4 border-b border-white/5">
                        <TypewriterText
                            text={data.summary}
                            animate={shouldAnimate}
                            className="text-sm text-gray-200 leading-relaxed"
                            onFinished={revealNext}
                            speed={25}
                        />
                    </div>
                )}

                {/* Remaining sections reveal one by one with stagger */}
                {revealedSections >= 1 && (
                    <SectionRelevantLaw text={data.relevant_law} isHindi={isHindi} animate={shouldAnimate} />
                )}
                {revealedSections >= 2 && (
                    <SectionYourRights text={data.your_rights} isHindi={isHindi} animate={shouldAnimate} />
                )}
                {revealedSections >= 3 && (
                    <SectionNextSteps steps={data.next_steps} isHindi={isHindi} animate={shouldAnimate} />
                )}
                {revealedSections >= 4 && (
                    <SectionDisclaimer text={data.disclaimer} animate={shouldAnimate} />
                )}

                {/* Actions Bar — show after all sections */}
                {revealedSections >= 5 && (
                    <div className={`px-4 py-2 flex items-center justify-end ${shouldAnimate ? 'section-reveal' : ''}`}>
                        <CopyButton text={copyText} />
                    </div>
                )}
            </div>
        </div>
    );
}
