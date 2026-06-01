/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      screens: {
        xs: '475px',
      },
      colors: {
        primary: '#18469A',
        accent: '#E35D14',
      },
      backgroundImage: {
        'gradient-smart': 'linear-gradient(to bottom right, #18469A, #2563EB, #06B6D4)',
        'gradient-edz': 'linear-gradient(to bottom right, #E35D14, #FBBF24)',
        'gradient-brand': 'linear-gradient(to right, #18469A, #2563EB, #06B6D4, #FBBF24, #E35D14)',
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
        marquee: 'marquee 15s linear infinite',
        'marquee-reverse': 'marquee-reverse 15s linear infinite',
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'fade-in-up-delay-1': 'fadeInUp 0.8s ease-out 0.2s forwards',
        'fade-in-up-delay-2': 'fadeInUp 0.8s ease-out 0.4s forwards',
        'fade-in-up-delay-3': 'fadeInUp 0.8s ease-out 0.6s forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0, transform: 'scale(0.95)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
        marquee: {
          '0%': { transform: 'translateX(-300px)' },
          '100%': { transform: 'translateX(100vw)' },
        },
        'marquee-reverse': {
          '0%': { transform: 'translateX(100vw)' },
          '100%': { transform: 'translateX(-300px)' },
        },
        fadeInUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(30px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};