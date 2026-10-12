import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base: the export must work from an IPFS gateway subpath or an ENS name.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
