/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Discord-like color scheme
        background: {
          primary: '#313338',
          secondary: '#2b2d31',
          tertiary: '#1e1f22',
          accent: '#404249',
          floating: '#111214',
        },
        text: {
          normal: '#dbdee1',
          muted: '#949ba4',
          link: '#00aff4',
          positive: '#23a559',
          warning: '#f0b132',
          danger: '#f23f43',
        },
        brand: {
          primary: '#5865f2',
          hover: '#4752c4',
        },
        channel: {
          default: '#80848e',
          selected: '#f2f3f5',
        },
        status: {
          online: '#23a559',
          idle: '#f0b132',
          dnd: '#f23f43',
          offline: '#80848e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Ginto', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.33)' },
          '40%, 50%': { opacity: '0' },
          '100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
