import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// GitHub Pages serves the site under /<repo>/. Change REPO if the repo name changes.
const REPO = 'living-boundless';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${REPO}/` : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        coach: resolve(import.meta.dirname, 'index.html'),
        patient: resolve(import.meta.dirname, 'p/index.html'),
      },
    },
  },
  server: { port: 5173 },
}));
