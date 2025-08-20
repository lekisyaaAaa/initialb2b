/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'serif': ['Playfair Display', 'ui-serif', 'Georgia', 'serif'],
        'display': ['Playfair Display', 'ui-serif', 'Georgia', 'serif'],
        'hero': ['Merriweather', 'Crimson Text', 'ui-serif', 'serif'],
        'elegant': ['Crimson Text', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        // Coffee-themed primary colors (rich brown)
        primary: {
          50: '#faf8f5',
          100: '#f5f1ea',
          200: '#e8ddd0',
          300: '#d4c2a8',
          400: '#bc9d7b',
          500: '#a67c52', // Main coffee brown
          600: '#8b6332',
          700: '#6f4e28',
          800: '#5c4023',
          900: '#4a341c',
        },
        // Letran Crimson Red (school colors) - subtle accents
        letran: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#dc143c', // Letran Crimson Red
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#651e20',
        },
        // Coffee accent colors (warm cream/latte)
        coffee: {
          50: '#fefdf9',
          100: '#fdfbf3',
          200: '#f9f4e6',
          300: '#f4ead2',
          400: '#ecdab5',
          500: '#e1c794', // Latte cream
          600: '#d4af73',
          700: '#c19552',
          800: '#a67c42',
          900: '#8b6636',
        },
        // Espresso (dark coffee) for text and accents
        espresso: {
          50: '#f7f6f4',
          100: '#efede8',
          200: '#ddd8ce',
          300: '#c4bcab',
          400: '#a89c85',
          500: '#93816a',
          600: '#7d6a55',
          700: '#675546',
          800: '#56473b',
          900: '#3c2e24', // Deep espresso
        },
        // Success colors (coffee bean green) - Complete palette
        success: {
          50: '#f3f8f3',
          100: '#e3f0e3',
          200: '#c8e1c8',
          300: '#9dcb9d',
          400: '#6bb26b',
          500: '#4a8f4a', // Coffee plant green
          600: '#3d7a3d',
          700: '#326532',
          800: '#275227',
          900: '#1f401f',
        },
        // Warning colors (caramel/amber) - Complete palette
        warning: {
          50: '#fffbf0',
          100: '#fef3d9',
          200: '#fde4a8',
          300: '#fbd077',
          400: '#f9c647',
          500: '#f59e0b', // Caramel
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Danger colors (cherry/berry) - Complete palette
        danger: {
          50: '#fef7f7',
          100: '#fdeaea',
          200: '#fbd5d5',
          300: '#f7b3b3',
          400: '#f28b8b',
          500: '#dc2626', // Coffee cherry red
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#651e20',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}

