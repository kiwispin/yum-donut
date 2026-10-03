import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production-mode synthetic fixtures only; never used for the deployed app.
export default defineConfig({ plugins: [react()], base: '/yum-donut/', build: { rollupOptions: { input: {
  care: 'verification/care-speed.html', preview: 'verification/surround.html',
} } } });
