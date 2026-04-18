import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        foreground: '#ededed',
        accent: '#3b82f6',
        panel: '#1a1a1a',
        border: '#2a2a2a',
      },
    },
  },
  plugins: [],
};

export default config;
