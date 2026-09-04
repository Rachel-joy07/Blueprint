/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        blueprint: {
          bg: '#0B1E33',      // deep drafting-table blue
          grid: '#152D48',    // grid line / hover wash
          panel: '#102A45',   // panel surface
          panel2: '#0D2338',  // recessed surface (code blocks, wells)
          border: '#24507A',
          line: '#EAF2F8',    // primary ink
        },
        risk: '#FF5D5D',
        waste: '#FFB454',
        clean: '#45D6AE',
        accent: '#5EC8F2',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        caption: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
      },
      backgroundImage: {
        'blueprint-grid':
          'linear-gradient(#152D48 1px, transparent 1px), linear-gradient(90deg, #152D48 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '32px 32px',
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 20px 40px -20px rgba(0,0,0,0.5)',
        float: '0 12px 32px -8px rgba(0,0,0,0.55)',
        'glow-accent': '0 0 0 1px rgba(94,200,242,0.4), 0 0 24px -4px rgba(94,200,242,0.35)',
        'glow-risk': '0 0 0 1px rgba(255,93,93,0.4), 0 0 20px -6px rgba(255,93,93,0.4)',
        'glow-waste': '0 0 0 1px rgba(255,180,84,0.4), 0 0 20px -6px rgba(255,180,84,0.4)',
        'glow-clean': '0 0 0 1px rgba(69,214,174,0.35), 0 0 16px -6px rgba(69,214,174,0.3)',
      },
      keyframes: {
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'msg-in': {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pulse-ring': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'msg-in': 'msg-in 0.25s cubic-bezier(0.16,1,0.3,1) both',
        'pulse-ring': 'pulse-ring 2s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
