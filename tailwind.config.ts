import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        ink: '#f5f7fb',
        paper: '#000000',
        panel: '#12161c',
        line: '#2a313a',
        sage: '#7ef2bc',
        rust: '#ffb38a',
        amber: '#f5bc62'
      },
      boxShadow: {
        soft: '0 18px 50px rgba(0, 0, 0, 0.45)'
      }
    }
  },
  plugins: []
} satisfies Config;
