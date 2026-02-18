/**
 * Header Component
 * ─────────────────
 * App header with logo, title, and Hindi/English language toggle.
 */

import { useState } from 'react';

const LANGUAGES = [
    { code: 'en', label: 'EN', fullLabel: 'English' },
    { code: 'hi', label: 'हि', fullLabel: 'हिंदी' },
];

export default function Header({ language, onLanguageChange }) {
    return (
        <header className="glass-card sticky top-0 z-50 border-b border-white/5">
            <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                {/* ── Logo & Title ──────────────────────────────────── */}
                <div className="flex items-center gap-3">
                    {/* Scales of Justice SVG Icon */}
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-saffron-500 to-forest-500 flex items-center justify-center shadow-lg shadow-saffron-500/20">
                        <svg
                            className="w-6 h-6 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 3v18m0-18l-4 6h8l-4-6zM4 9l-2 6h6L4 9zm16 0l-2 6h6l-4-6z"
                            />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold bg-gradient-to-r from-saffron-400 via-white to-forest-400 bg-clip-text text-transparent">
                            NyayaAI
                        </h1>
                        <p className="text-[11px] text-gray-400 -mt-0.5 tracking-wide">
                            {language === 'hi' ? 'भारतीय नागरिकों का AI कानूनी सहायक' : 'AI Legal Assistant for Indian Citizens'}
                        </p>
                    </div>
                </div>

                {/* ── Language Toggle ───────────────────────────────── */}
                <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => onLanguageChange(lang.code)}
                            className={`
                px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                ${language === lang.code
                                    ? 'bg-gradient-to-r from-saffron-500/80 to-forest-500/80 text-white shadow-md'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                }
              `}
                            title={lang.fullLabel}
                        >
                            {lang.label}
                        </button>
                    ))}
                </div>
            </div>
        </header>
    );
}
