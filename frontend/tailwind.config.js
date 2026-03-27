/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                    950: '#172554',
                },
                saffron: {
                    50: '#fff8f0',
                    100: '#ffecd6',
                    200: '#ffd5a8',
                    300: '#ffb86a',
                    400: '#ff9838',
                    500: '#ff7b11',
                    600: '#e65d00',
                    700: '#bf4800',
                    800: '#993a00',
                    900: '#7a3000',
                },
                forest: {
                    50: '#f0fdf0',
                    100: '#dcfce7',
                    200: '#bbf7d0',
                    300: '#86efac',
                    400: '#4ade80',
                    500: '#22c55e',
                    600: '#16a34a',
                    700: '#138a3d',
                    800: '#166534',
                    900: '#14532d',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                hindi: ['Noto Sans Devanagari', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
                'typing': 'typing 1.4s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.6' },
                },
                typing: {
                    '0%': { opacity: '0.2' },
                    '20%': { opacity: '1' },
                    '100%': { opacity: '0.2' },
                },
            },
        },
    },
    plugins: [],
}
