import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base ('./') keeps asset paths working on GitHub Pages
// regardless of the repository name (e.g. /neon-vanguard/).
export default defineConfig({
  base: './',
  plugins: [react()],
});
